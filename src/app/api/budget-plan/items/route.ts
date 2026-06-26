import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?companyId=&year= — list items for a company + year
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const companyId = sp.get('companyId');
  const year = parseInt(sp.get('year') || '', 10);
  if (!companyId || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from('budget_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// POST { companyId, year, categoryId, name, amount, month?, createdBy? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, categoryId, name } = body;
    if (!companyId || !Number.isFinite(parseInt(String(year), 10)) || !categoryId || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const month = body.month == null || body.month === '' ? null : parseInt(String(body.month), 10);
    const { data, error } = await getSupabase()
      .from('budget_items')
      .insert({
        company_id: companyId,
        year: parseInt(String(year), 10),
        category_id: categoryId,
        name: String(name).trim(),
        amount: Number(body.amount) || 0,
        month: month,
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

// PUT { id, name?, amount?, month?, categoryId? }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (body.amount !== undefined) patch.amount = Number(body.amount) || 0;
    if (body.month !== undefined) patch.month = body.month == null || body.month === '' ? null : parseInt(String(body.month), 10);
    if (body.categoryId !== undefined) patch.category_id = body.categoryId;
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
