import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper: calculate risk scale from risk level
function getRiskScale(rl: number): string {
  if (rl >= 32) return 'Critical';
  if (rl >= 10) return 'High';
  if (rl >= 5) return 'Medium';
  return 'Low';
}

// Helper: update parent task's max risk level
async function updateTaskMaxRisk(taskId: string) {
  const supabase = getSupabase();

  const { data: hazards } = await supabase
    .from('risk_hazards')
    .select('risk_level')
    .eq('task_id', taskId);

  const maxRL = hazards && hazards.length > 0
    ? Math.max(...hazards.map(h => h.risk_level || 0))
    : 0;

  const hasPending = hazards?.some(h => !h);

  await supabase
    .from('risk_tasks')
    .update({
      max_risk_level: maxRL,
      risk_scale: maxRL > 0 ? getRiskScale(maxRL) : 'N/A',
      actions_pending: hasPending || false,
      last_update: new Date().toISOString(),
    })
    .eq('id', taskId);
}

// GET — List hazards for a task
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const companyId = searchParams.get('companyId');

  if (!taskId && !companyId) {
    return NextResponse.json({ error: 'Missing taskId or companyId' }, { status: 400 });
  }

  const supabase = getSupabase();
  let query = supabase.from('risk_hazards').select('*');

  if (taskId) query = query.eq('task_id', taskId);
  if (companyId) query = query.eq('company_id', companyId);

  query = query.order('hazard_no', { ascending: true });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST — Add a hazard to a task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, companyId, ...fields } = body;

    if (!taskId || !companyId || !fields.hazard_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get next hazard_no
    const { data: existing } = await supabase
      .from('risk_hazards')
      .select('hazard_no')
      .eq('task_id', taskId)
      .order('hazard_no', { ascending: false })
      .limit(1);

    const nextNo = existing && existing.length > 0 ? (existing[0].hazard_no || 0) + 1 : 1;

    const severity = fields.severity || 1;
    const probability = fields.probability || 1;
    const riskLevel = severity * probability;

    const resSev = fields.residual_severity || null;
    const resProb = fields.residual_probability || null;
    const resRL = resSev && resProb ? resSev * resProb : null;

    const { data, error } = await supabase
      .from('risk_hazards')
      .insert({
        task_id: taskId,
        company_id: companyId,
        hazard_no: nextNo,
        hazard_category: fields.hazard_category || null,
        hazard_description: fields.hazard_description,
        existing_controls: fields.existing_controls || null,
        severity,
        probability,
        risk_level: riskLevel,
        risk_scale: getRiskScale(riskLevel),
        new_control_measures: fields.new_control_measures || null,
        control_type: fields.control_type || null,
        responsible_person: fields.responsible_person || null,
        deadline: fields.deadline || null,
        done: fields.done || false,
        residual_severity: resSev,
        residual_probability: resProb,
        residual_risk_level: resRL,
        residual_risk_scale: resRL ? getRiskScale(resRL) : null,
        reference_doc: fields.reference_doc || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update parent task max risk
    await updateTaskMaxRisk(taskId);

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH — Update a hazard
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, taskId, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Recalculate risk levels if severity/probability changed
    if (fields.severity !== undefined || fields.probability !== undefined) {
      const s = fields.severity;
      const p = fields.probability;
      if (s !== undefined && p !== undefined) {
        fields.risk_level = s * p;
        fields.risk_scale = getRiskScale(s * p);
      }
    }

    if (fields.residual_severity !== undefined && fields.residual_probability !== undefined) {
      const rs = fields.residual_severity;
      const rp = fields.residual_probability;
      if (rs && rp) {
        fields.residual_risk_level = rs * rp;
        fields.residual_risk_scale = getRiskScale(rs * rp);
      }
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('risk_hazards')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update parent task max risk
    if (taskId) await updateTaskMaxRisk(taskId);

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Delete a hazard
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const taskId = searchParams.get('taskId');

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await getSupabase()
    .from('risk_hazards')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update parent task max risk
  if (taskId) await updateTaskMaxRisk(taskId);

  return NextResponse.json({ success: true });
}
