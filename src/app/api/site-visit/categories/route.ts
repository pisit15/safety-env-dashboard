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
