import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get('item_id');
    const db = getSupabase();
    let query = db.from('site_visit_criteria').select('*').order('score');
    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching criteria:', error);
    return NextResponse.json({ error: 'Failed to fetch criteria' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabase();
    // Support bulk insert: body.criteria = [{item_id, score, description}]
    if (body.criteria && Array.isArray(body.criteria)) {
      const { data, error } = await db
        .from('site_visit_criteria')
        .insert(body.criteria)
        .select();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }
    // Single insert
    if (!body.item_id || body.score === undefined) {
      return NextResponse.json({ error: 'Missing required fields (item_id, score)' }, { status: 400 });
    }
    const { data, error } = await db
      .from('site_visit_criteria')
      .insert([{ item_id: body.item_id, score: body.score, description: body.description || '' }])
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create criterion', detail: msg }, { status: 500 });
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
    if (body.score !== undefined) updates.score = body.score;
    if (body.description !== undefined) updates.description = body.description;
    const { data, error } = await db
      .from('site_visit_criteria')
      .update(updates)
      .eq('id', body.id)
      .select();
    if (error) throw error;
    return NextResponse.json({ data: data[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update criterion', detail: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getSupabase();
    const { error } = await db.from('site_visit_criteria').delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete criterion', detail: msg }, { status: 500 });
  }
}
