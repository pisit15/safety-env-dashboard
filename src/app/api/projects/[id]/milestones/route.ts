import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

// GET — milestones for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', params.id)
      .order('order_no', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ milestones: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — add milestone
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      title, description, order_no,
      planned_start, planned_end, status = 'pending', note,
    } = body;

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    // Auto order_no: max + 1
    let finalOrderNo = order_no;
    if (finalOrderNo === undefined) {
      const { data: existing } = await supabase
        .from('project_milestones')
        .select('order_no')
        .eq('project_id', params.id)
        .order('order_no', { ascending: false })
        .limit(1);
      finalOrderNo = existing && existing.length > 0 ? (existing[0].order_no + 1) : 0;
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .insert({
        project_id: params.id,
        title,
        description: description || null,
        order_no: finalOrderNo,
        planned_start: planned_start || null,
        planned_end: planned_end || null,
        actual_end: null,
        status,
        completion_pct: 0,
        note: note || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ milestone: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
