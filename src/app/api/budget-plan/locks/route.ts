import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?companyId=&year= — lock status for a company/year
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const companyId = sp.get('companyId');
  const year = parseInt(sp.get('year') || '', 10);
  if (!companyId || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from('budget_locks')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .maybeSingle();
  if (error) {
    if (error.message.includes('does not exist')) return NextResponse.json({ locked: false, lock: null });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ locked: !!data, lock: data || null });
}

// POST { companyId, year, isAdmin, lockedBy, note? } — lock (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { companyId, year } = body;
    if (!companyId || !Number.isFinite(parseInt(String(year), 10))) {
      return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from('budget_locks')
      .upsert({
        company_id: companyId,
        year: parseInt(String(year), 10),
        locked_by: body.lockedBy || 'admin',
        note: body.note || null,
      }, { onConflict: 'company_id,year' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Best-effort audit trail
    await sb.from('audit_log').insert({
      company_id: companyId,
      action: 'budget_lock',
      note: `ปิดการแก้ไขงบประมาณปี ${year}`,
      performed_by: body.lockedBy || 'admin',
    });

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
  const { error } = await sb
    .from('budget_locks')
    .delete()
    .eq('company_id', companyId)
    .eq('year', year);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('audit_log').insert({
    company_id: companyId,
    action: 'budget_unlock',
    note: `ปลดล็อกงบประมาณปี ${year}`,
    performed_by: sp.get('by') || 'admin',
  });

  return NextResponse.json({ success: true });
}
