import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch training plans for a company/year
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const year = searchParams.get('year') || '2026';

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  let query = getSupabase()
    .from('training_plans')
    .select('*, training_sessions(*, training_attendees(count))')
    .eq('company_id', companyId)
    .eq('year', parseInt(year))
    .order('planned_month', { ascending: true })
    .order('course_no', { ascending: true });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Import training plans (bulk insert from Excel)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plans, companyId, year } = body;

    if (!plans || !Array.isArray(plans) || !companyId) {
      return NextResponse.json({ error: 'Missing plans array or companyId' }, { status: 400 });
    }

    // Delete existing plans for this company/year first
    const supabase = getSupabase();

    if (year) {
      await supabase
        .from('training_plans')
        .delete()
        .eq('company_id', companyId)
        .eq('year', year);
    }

    // Insert new plans
    const planData = plans.map((p: Record<string, unknown>) => ({
      company_id: companyId,
      year: year || 2026,
      course_no: p.course_no,
      category: p.category,
      course_name: p.course_name,
      in_house_external: p.in_house_external || 'External',
      planned_month: p.planned_month,
      hours_per_course: p.hours_per_course || 0,
      planned_participants: p.planned_participants || 0,
      total_planned_hours: p.total_planned_hours || 0,
      budget: p.budget || 0,
      target_group: p.target_group,
      training_necessity: p.training_necessity,
      responsible_person: p.responsible_person,
      remarks: p.remarks,
    }));

    const { data, error } = await supabase
      .from('training_plans')
      .insert(planData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a training plan
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('training_plans')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH - Update a training plan's planned_month
export async function PATCH(request: NextRequest) {
  try {
    const { plan_id, planned_month } = await request.json();

    if (!plan_id || !planned_month) {
      return NextResponse.json({ error: 'Missing plan_id or planned_month' }, { status: 400 });
    }

    if (planned_month < 1 || planned_month > 12) {
      return NextResponse.json({ error: 'planned_month must be between 1 and 12' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('training_plans')
      .update({ planned_month })
      .eq('id', plan_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
