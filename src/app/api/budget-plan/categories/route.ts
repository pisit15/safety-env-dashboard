import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — list categories (shared across ALL companies; global standard list)
export async function GET() {
  const { data, error } = await getSupabase()
    .from('budget_categories')
    .select('*')
    .eq('company_id', '__all__')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

// POST { companyId, name } — create category (Admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    if (body.isAdmin !== true) {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สร้างหมวดหมู่ได้' }, { status: 403 });
    }
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    const db = getSupabase();
    // categories are global (company_id = '__all__'); next sort_order = max + 1
    const { data: maxRow } = await db
      .from('budget_categories')
      .select('sort_order')
      .eq('company_id', '__all__')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;
    const { data, error } = await db
      .from('budget_categories')
      .insert({ company_id: '__all__', name: String(name).trim(), sort_order: sortOrder })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT { id, name?, sort_order? } — rename / reorder
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (body.isAdmin !== true) {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
    }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { error } = await getSupabase().from('budget_categories').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE ?id= — delete category (its items cascade)
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (request.nextUrl.searchParams.get('isAdmin') !== 'true') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await getSupabase().from('budget_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
