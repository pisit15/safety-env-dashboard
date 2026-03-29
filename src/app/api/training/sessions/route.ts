import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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
            note, hr_submitted, updated_by, postponed_to_month, original_planned_month } = body;

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
