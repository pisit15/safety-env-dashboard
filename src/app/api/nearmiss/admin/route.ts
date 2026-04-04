import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// ── GET /api/nearmiss/admin ── All companies, admin-only
// Returns summary stats per company + recent reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary'; // 'summary' | 'all'
    const limit = parseInt(searchParams.get('limit') || '200');

    const supabase = getSupabase();

    if (view === 'all') {
      // Full list across all companies
      const { data, error, count } = await supabase
        .from('near_miss_reports')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data, total: count });
    }

    // Summary: aggregate by company
    const { data, error } = await supabase
      .from('near_miss_reports')
      .select('company_id, status, risk_level, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by company
    const companyMap: Record<string, {
      total: number;
      new: number;
      open: number;
      closed: number;
      high: number;
      latest: string | null;
    }> = {};

    for (const row of (data || [])) {
      const cid = row.company_id;
      if (!companyMap[cid]) {
        companyMap[cid] = { total: 0, new: 0, open: 0, closed: 0, high: 0, latest: null };
      }
      const c = companyMap[cid];
      c.total++;
      if (row.status === 'new') c.new++;
      if (row.status === 'closed') c.closed++;
      else c.open++;
      if (row.risk_level === 'HIGH') c.high++;
      if (!c.latest || row.created_at > c.latest) c.latest = row.created_at;
    }

    return NextResponse.json({ summary: companyMap, total: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
