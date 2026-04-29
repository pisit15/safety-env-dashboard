import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get('category_id');
    const db = getSupabase();
    let query = db
      .from('site_visit_items')
      .select('*, site_visit_categories(name, name_th), site_visit_criteria(*)')
      .eq('is_active', true)
      .order('sort_order');
    if (categoryId) {
      query = query.eq('category_id', parseInt(categoryId));
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabase();
    const { data, error } = await db
      .from('site_visit_items')
      .insert([body])
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create item', detail: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const db = getSupabase();
    const updates: Record<string, unknown> = {};
    if (body.question !== undefined) updates.question = body.question;
    if (body.item_no !== undefined) updates.item_no = body.item_no;
    if (body.max_score !== undefined) updates.max_score = body.max_score;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('site_visit_items')
      .update(updates)
      .eq('id', body.id)
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update item', detail: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const db = getSupabase();
    // Delete related criteria first
    await db.from('site_visit_criteria').delete().eq('item_id', parseInt(id));
    // Delete the item
    const { error } = await db.from('site_visit_items').delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete item', detail: msg }, { status: 500 });
  }
}
