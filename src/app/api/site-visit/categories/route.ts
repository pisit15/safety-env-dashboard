import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const parentType = request.nextUrl.searchParams.get('parent_type');
    const db = getSupabase();
    let query = db
      .from('site_visit_categories')
      .select('*')
      .eq('is_active', true);
    if (parentType) {
      query = query.eq('parent_type', parentType);
    }
    const { data, error } = await query.order('sort_order');
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
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
    if (body.name !== undefined) updates.name = body.name;
    if (body.name_th !== undefined) updates.name_th = body.name_th;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('site_visit_categories')
      .update(updates)
      .eq('id', body.id)
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update category', detail: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabase();
    const { data, error } = await db
      .from('site_visit_categories')
      .insert([body])
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create category', detail: msg }, { status: 500 });
  }
}
