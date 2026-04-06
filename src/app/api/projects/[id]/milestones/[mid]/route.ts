import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// PATCH — update milestone
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; mid: string } }
) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const allowed = [
      'title', 'description', 'order_no',
      'planned_start', 'planned_end', 'actual_end',
      'status', 'completion_pct', 'note',
    ];
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key];
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .update(updateData)
      .eq('id', params.mid)
      .eq('project_id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ milestone: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove milestone
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; mid: string } }
) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', params.mid)
      .eq('project_id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
