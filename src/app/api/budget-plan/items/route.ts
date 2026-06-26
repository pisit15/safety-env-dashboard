import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Sanitize a { monthKey: amount } map -> { "0".."12": number }, dropping empty/zero
function cleanMonthly(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const m = parseInt(k, 10);
      if (!Number.isFinite(m) || m < 0 || m > 12) continue;
      const amt = Number(v);
      if (Number.isFinite(amt) && amt !== 0) out[String(m)] = amt;
    }
  }
  return out;
}

// GET ?companyId=&year= — list items for a company + year
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const companyId = sp.get('companyId');
  const year = parseInt(sp.get('year') || '', 10);
  if (!companyId || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
  }
  const planType = sp.get('planType');
  let q = getSupabase()
    .from('budget_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year);
  if (planType) q = q.eq('plan_type', planType);
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// POST { companyId, year, categoryId, name, monthlyAmounts, createdBy }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, categoryId, name } = body;
    if (!companyId || !Number.isFinite(parseInt(String(year), 10)) || !categoryId || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { data, error } = await getSupabase()
      .from('budget_items')
      .insert({
        company_id: companyId,
        year: parseInt(String(year), 10),
        category_id: categoryId,
        name: String(name).trim(),
        plan_type: body.planType === 'environment' ? 'environment' : 'safety',
        monthly_amounts: cleanMonthly(body.monthlyAmounts),
        created_by: body.createdBy || '',
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT { id, name?, categoryId?, monthlyAmounts? }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (body.categoryId !== undefined) patch.category_id = body.categoryId;
    if (body.monthlyAmounts !== undefined) patch.monthly_amounts = cleanMonthly(body.monthlyAmounts);
    const { error } = await getSupabase().from('budget_items').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE ?id=
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await getSupabase().from('budget_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
