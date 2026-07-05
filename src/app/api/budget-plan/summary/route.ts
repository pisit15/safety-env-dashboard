import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CompanySummary {
  companyId: string;
  itemCount: number;
  safetyCount: number;
  environmentCount: number;
  totalAmount: number;
  lastUpdated: string | null;
  lastBy: string | null;
  locked: boolean;
  lockedBy: string | null;
}

// GET ?year= — per-company budget progress for the admin landing page:
// how many items each company has entered, total amount, latest activity, lock status
export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing year' }, { status: 400 });
  }
  const sb = getSupabase();

  const [itemsRes, locksRes] = await Promise.all([
    sb.from('budget_items')
      .select('company_id, plan_type, monthly_amounts, created_at, updated_at, created_by')
      .eq('year', year),
    sb.from('budget_locks').select('company_id, locked_by').eq('year', year),
  ]);

  if (itemsRes.error) {
    return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  }

  const lockMap: Record<string, string> = {};
  (locksRes.data || []).forEach((l: { company_id: string; locked_by: string | null }) => {
    lockMap[l.company_id] = l.locked_by || 'admin';
  });

  const byCompany: Record<string, CompanySummary> = {};
  (itemsRes.data || []).forEach((it: {
    company_id: string;
    plan_type: string | null;
    monthly_amounts: Record<string, number> | null;
    created_at: string;
    updated_at: string | null;
    created_by: string | null;
  }) => {
    const cid = it.company_id;
    if (!byCompany[cid]) {
      byCompany[cid] = {
        companyId: cid, itemCount: 0, safetyCount: 0, environmentCount: 0,
        totalAmount: 0, lastUpdated: null, lastBy: null, locked: false, lockedBy: null,
      };
    }
    const s = byCompany[cid];
    s.itemCount += 1;
    if (it.plan_type === 'environment') s.environmentCount += 1; else s.safetyCount += 1;
    if (it.monthly_amounts) {
      for (const v of Object.values(it.monthly_amounts)) {
        const n = Number(v);
        if (Number.isFinite(n)) s.totalAmount += n;
      }
    }
    const ts = (it.updated_at && it.updated_at > it.created_at) ? it.updated_at : it.created_at;
    if (!s.lastUpdated || ts > s.lastUpdated) {
      s.lastUpdated = ts;
      s.lastBy = it.created_by || null;
    }
  });

  // Companies that are locked but have no items should still appear
  Object.keys(lockMap).forEach(cid => {
    if (!byCompany[cid]) {
      byCompany[cid] = {
        companyId: cid, itemCount: 0, safetyCount: 0, environmentCount: 0,
        totalAmount: 0, lastUpdated: null, lastBy: null, locked: false, lockedBy: null,
      };
    }
  });
  Object.values(byCompany).forEach(s => {
    if (lockMap[s.companyId]) { s.locked = true; s.lockedBy = lockMap[s.companyId]; }
  });

  return NextResponse.json({ year, summaries: Object.values(byCompany) });
}
