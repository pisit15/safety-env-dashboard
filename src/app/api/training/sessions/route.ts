import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper function to log changes
async function logSessionChanges(
  supabase: any,
  sessionId: string,
  planId: string,
  companyId: string,
  changedBy: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
) {
  const fieldsToTrack = [
    'status', 'actual_cost', 'actual_hours', 'instructor_name',
    'training_location', 'training_method', 'scheduled_date_start',
    'scheduled_date_end',
  ];

  const changes = [];
  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    if (oldValue !== newValue && newValue !== undefined) {
      changes.push({
        session_id: sessionId,
        plan_id: planId,
        company_id: companyId,
        changed_by: changedBy,
        change_type: 'session_update',
        field_name: field,
        old_value: String(oldValue || ''),
        new_value: String(newValue || ''),
      });
    }
  }

  if (changes.length > 0) {
    try {
      await (supabase.from('training_change_log') as any).insert(changes);
    } catch (e) {
      // Silently fail if table doesn't exist
    }
  }
}

// GET - Fetch training sessions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planId = searchParams.get('planId');

  const supabase = getSupabase();
  let query = supabase
    .from('training_sessions')
    .select('*, training_plans(course_name, planned_month, category, in_house_external, hours_per_course)')
    .order('scheduled_date_start', { ascending: true });

  if (companyId) query = query.eq('company_id', companyId);
  if (planId) query = query.eq('plan_id', planId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Create or update a training session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan_id, company_id, status, scheduled_date_start, scheduled_date_end,
            actual_cost, actual_participants, hours_per_course, total_man_hours,
            note, hr_submitted, updated_by, postponed_to_month, original_planned_month,
            // DSD pre-training fields
            instructor_name, training_location, training_method,
            dsd_submitted, dsd_submitted_date, dsd_approved, dsd_approved_date,
            // DSD post-training fields
            actual_hours, dsd_report_submitted, dsd_report_submitted_date,
            dsd_approved_headcount, photos_submitted, signin_sheet_submitted } = body;

    if (!plan_id || !company_id) {
      return NextResponse.json({ error: 'Missing plan_id or company_id' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if session exists for this plan
    const { data: existing } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('plan_id', plan_id)
      .single();

    const sessionData = {
      plan_id,
      company_id,
      status: status || 'scheduled',
      scheduled_date_start,
      scheduled_date_end,
      actual_cost: actual_cost || 0,
      actual_participants: actual_participants || 0,
      hours_per_course: hours_per_course || 0,
      total_man_hours: total_man_hours || 0,
      note,
      hr_submitted: hr_submitted || false,
      updated_by,
      updated_at: new Date().toISOString(),
      ...(postponed_to_month !== undefined && { postponed_to_month }),
      ...(original_planned_month !== undefined && { original_planned_month }),
      // DSD pre-training
      ...(instructor_name !== undefined && { instructor_name }),
      ...(training_location !== undefined && { training_location }),
      ...(training_method !== undefined && { training_method }),
      ...(dsd_submitted !== undefined && { dsd_submitted }),
      ...(dsd_submitted_date !== undefined && { dsd_submitted_date }),
      ...(dsd_approved !== undefined && { dsd_approved }),
      ...(dsd_approved_date !== undefined && { dsd_approved_date }),
      // DSD post-training
      ...(actual_hours !== undefined && { actual_hours }),
      ...(dsd_report_submitted !== undefined && { dsd_report_submitted }),
      ...(dsd_report_submitted_date !== undefined && { dsd_report_submitted_date }),
      ...(dsd_approved_headcount !== undefined && { dsd_approved_headcount }),
      ...(photos_submitted !== undefined && { photos_submitted }),
      ...(signin_sheet_submitted !== undefined && { signin_sheet_submitted }),
    };

    let data;
    let error;

    if (existing) {
      // Update existing session
      const result = await supabase
        .from('training_sessions')
        .update(sessionData)
        .eq('id', existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Create new session
      const result = await supabase
        .from('training_sessions')
        .insert(sessionData)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log changes for significant fields
    if (data && existing && updated_by) {
      const oldData = existing;
      const newData = sessionData;
      await logSessionChanges(supabase, data.id, plan_id, company_id, updated_by, oldData, newData);
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Quick status update
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, note, updated_by } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('training_sessions')
      .update({ status, note, updated_by, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
