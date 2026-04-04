import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

// GET — single project with milestones
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { id } = params;

    const [projectRes, milestonesRes] = await Promise.all([
      supabase.from('special_projects').select('*').eq('id', id).single(),
      supabase.from('project_milestones').select('*').eq('project_id', id).order('order_no', { ascending: true }),
    ]);

    if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 404 });

    return NextResponse.json({
      project: projectRes.data,
      milestones: milestonesRes.data || [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { id } = params;
    const body = await request.json();

    // Whitelist updatable fields
    const allowed = [
      'plan_type', 'project_scope', 'requesting_dept', 'category',
      'title', 'description', 'owner', 'status',
      'start_date', 'end_date', 'completion_pct',
      'budget_planned', 'budget_actual', 'notes',
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key];
    }

    const { data, error } = await supabase
      .from('special_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove project (cascades to milestones)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { id } = params;

    const { error } = await supabase.from('special_projects').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
