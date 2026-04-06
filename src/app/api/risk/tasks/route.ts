import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET — List tasks for a company (Risk Register)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const mode = searchParams.get('mode'); // 'summary' for dashboard

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const supabase = getSupabase();

  if (mode === 'summary') {
    // Lightweight: just counts by risk scale
    const { data, error } = await supabase
      .from('risk_tasks')
      .select('id, status, max_risk_level, risk_scale')
      .eq('company_id', companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  // Full list with hazard count
  const { data, error } = await supabase
    .from('risk_tasks')
    .select('*, risk_hazards(id)')
    .eq('company_id', companyId)
    .order('ra_no', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Transform: add hazard_count
  const tasks = (data || []).map(t => ({
    ...t,
    hazard_count: Array.isArray(t.risk_hazards) ? t.risk_hazards.length : 0,
    risk_hazards: undefined,
  }));

  return NextResponse.json(tasks);
}

// POST — Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, ...fields } = body;

    if (!companyId || !fields.task_name) {
      return NextResponse.json({ error: 'Missing companyId or task_name' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get next ra_no for this company
    const { data: existing } = await supabase
      .from('risk_tasks')
      .select('ra_no')
      .eq('company_id', companyId)
      .order('ra_no', { ascending: false })
      .limit(1);

    const nextRaNo = existing && existing.length > 0 ? (existing[0].ra_no || 0) + 1 : 1;

    const { data, error } = await supabase
      .from('risk_tasks')
      .insert({
        company_id: companyId,
        ra_no: nextRaNo,
        department: fields.department || null,
        working_area: fields.working_area || null,
        work_position: fields.work_position || null,
        task_name: fields.task_name,
        task_name_th: fields.task_name_th || null,
        task_description: fields.task_description || null,
        process_stage: fields.process_stage || null,
        start_point: fields.start_point || null,
        end_point: fields.end_point || null,
        machine: fields.machine || null,
        building_area: fields.building_area || null,
        persons_at_risk: fields.persons_at_risk || null,
        ra_reason: fields.ra_reason || null,
        responsible_person: fields.responsible_person || null,
        status: 'Pending',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH — Update a task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('risk_tasks')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Delete a task (cascades to hazards)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await getSupabase()
    .from('risk_tasks')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
