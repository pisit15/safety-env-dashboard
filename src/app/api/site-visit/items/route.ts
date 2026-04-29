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
