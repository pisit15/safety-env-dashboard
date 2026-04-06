import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET - Fetch attendees
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const planId = searchParams.get('planId');
  const companyId = searchParams.get('companyId');
  const empCode = searchParams.get('empCode');
  const courseName = searchParams.get('courseName');

  const supabase = getSupabase();
  let query = supabase
    .from('training_attendees')
    .select('*, training_sessions(status, scheduled_date_start, scheduled_date_end), training_plans(course_name, category, hours_per_course, in_house_external, planned_month, year)')
    .order('created_at', { ascending: true });

  if (sessionId) query = query.eq('session_id', sessionId);
  if (planId) query = query.eq('plan_id', planId);
  if (companyId) query = query.eq('company_id', companyId);
  if (empCode) query = query.eq('emp_code', empCode);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by course name if provided (partial match)
  let filtered = data || [];
  if (courseName) {
    const lowerName = courseName.toLowerCase();
    filtered = filtered.filter((a: Record<string, unknown>) => {
      const plan = a.training_plans as Record<string, unknown> | null;
      return plan && typeof plan.course_name === 'string' &&
        plan.course_name.toLowerCase().includes(lowerName);
    });
  }

  return NextResponse.json(filtered);
}

// POST - Add attendees (single or bulk)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { attendees, session_id, plan_id, company_id } = body;

      if (!session_id || !plan_id || !company_id) {
        return NextResponse.json({ error: 'Missing session_id, plan_id, or company_id' }, { status: 400 });
      }

      const attendeeList = Array.isArray(attendees) ? attendees : [body];

      const records = attendeeList.map((a: Record<string, unknown>) => ({
        session_id,
        plan_id,
        company_id,
        emp_code: a.emp_code || '',
        title: a.title || '',
        first_name: a.first_name || '',
        last_name: a.last_name || '',
        gender: a.gender || '',
        position: a.position || '',
        department: a.department || '',
        location: a.location || '',
        employee_level: a.employee_level || '',
        training_type: a.training_type || 'Mandatory',
        onsite_online: a.onsite_online || 'Onsite',
        external_inhouse: a.external_inhouse || '',
        learning_method: a.learning_method || 'Training',
        program_type: a.program_type || '',
        registration_type: a.registration_type || 'registered',
        hours_attended: a.hours_attended || 0,
      }));

      const { data, error } = await getSupabase()
        .from('training_attendees')
        .insert(records)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Update actual_participants count on session
      const { count } = await getSupabase()
        .from('training_attendees')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session_id);

      if (count !== null) {
        await getSupabase()
          .from('training_sessions')
          .update({ actual_participants: count })
          .eq('id', session_id);
      }

      return NextResponse.json({ success: true, count: data?.length || 0 });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove attendee
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const sessionId = searchParams.get('sessionId');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('training_attendees')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update participant count if sessionId provided
  if (sessionId) {
    const { count } = await supabase
      .from('training_attendees')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (count !== null) {
      await supabase
        .from('training_sessions')
        .update({ actual_participants: count })
        .eq('id', sessionId);
    }
  }

  return NextResponse.json({ success: true });
}

// PATCH - Update attendee
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, emp_code, first_name, last_name, position, department } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing attendee id' }, { status: 400 });
    }

    const supabase = getSupabase();

    const updateData: Record<string, string> = {};
    if (emp_code !== undefined) updateData.emp_code = emp_code;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (position !== undefined) updateData.position = position;
    if (department !== undefined) updateData.department = department;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('training_attendees')
      .update(updateData)
      .eq('id', id)
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
