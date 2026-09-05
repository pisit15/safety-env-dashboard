import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Lock แผนอบรมรายปีต่อบริษัท — pattern เดียวกับ budget_locks

// GET ?companyId=&year= — lock status
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const companyId = sp.get('companyId');
  const year = parseInt(sp.get('year') || '', 10);
  if (!companyId || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from('training_plan_locks').select('*')
    .eq('company_id', companyId).eq('year', year).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locked: !!data, lock: data || null });
}

// POST { companyId, year, isAdmin, lockedBy } — lock (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.isAdmin !== true) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { companyId, year } = body;
    if (!companyId || !Number.isFinite(parseInt(String(year), 10))) {
      return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('training_plan_locks').upsert({
      company_id: companyId, year: parseInt(String(year), 10),
      locked_by: body.lockedBy || 'admin', note: body.note || null,
    }, { onConflict: 'company_id,year' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      await sb.from('audit_log').insert({
        company_id: companyId, action: 'training_plan_lock',
        note: `ล็อกแผนอบรมปี ${year}`, performed_by: body.lockedBy || 'admin',
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ lock: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE ?companyId=&year=&isAdmin=true&by= — unlock (admin only)
export async function DELETE(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get('isAdmin') !== 'true') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const companyId = sp.get('companyId');
  const year = parseInt(sp.get('year') || '', 10);
  if (!companyId || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
  }
  const sb = getSupabase();
  const { error } = await sb.from('training_plan_locks').delete()
    .eq('company_id', companyId).eq('year', year);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    await sb.from('audit_log').insert({
      company_id: companyId, action: 'training_plan_unlock',
      note: `ปลดล็อกแผนอบรมปี ${year}`, performed_by: sp.get('by') || 'admin',
    });
  } catch { /* best-effort */ }
  return NextResponse.json({ success: true });
}
