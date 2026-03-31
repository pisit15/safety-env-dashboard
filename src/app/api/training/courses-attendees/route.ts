import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch courses with attendees for a company
// Returns: list of courses with their attendee details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const courseName = searchParams.get('courseName'); // optional search filter

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Get all training plans for this company
  const { data: plans, error: plansError } = await supabase
    .from('training_plans')
    .select('id, course_name, category, hours_per_course, in_house_external, planned_month, year')
    .eq('company_id', companyId)
    .order('year', { ascending: false });

  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  // Filter by course name if provided
  let filteredPlans = plans || [];
  if (courseName) {
    const lower = courseName.toLowerCase();
    filteredPlans = filteredPlans.filter((p: Record<string, unknown>) =>
      typeof p.course_name === 'string' && p.course_name.toLowerCase().includes(lower)
    );
  }

  // Deduplicate courses by name (keep most recent year)
  const courseMap = new Map<string, typeof filteredPlans[0]>();
  for (const plan of filteredPlans) {
    const key = (plan.course_name || '').trim().toLowerCase();
    if (!key) continue;
    if (!courseMap.has(key)) {
      courseMap.set(key, plan);
    }
  }

  // Get all plan IDs for fetching attendees
  const allPlanIds = filteredPlans.map(p => p.id);

  if (allPlanIds.length === 0) {
    return NextResponse.json({ courses: [] });
  }

  // Get attendees for these plans
  const { data: attendees, error: attError } = await supabase
    .from('training_attendees')
    .select('id, plan_id, session_id, emp_code, first_name, last_name, position, department, hours_attended, created_at, training_sessions(status, scheduled_date_start, scheduled_date_end)')
    .eq('company_id', companyId)
    .in('plan_id', allPlanIds);

  if (attError) {
    return NextResponse.json({ error: attError.message }, { status: 500 });
  }

  // Group attendees by plan_id
  const attendeesByPlan = new Map<string, typeof attendees>();
  for (const att of attendees || []) {
    const pid = att.plan_id;
    if (!attendeesByPlan.has(pid)) attendeesByPlan.set(pid, []);
    attendeesByPlan.get(pid)!.push(att);
  }

  // Build course result - group all plan IDs with same course_name
  const courseNameToPlans = new Map<string, string[]>();
  for (const plan of filteredPlans) {
    const key = (plan.course_name || '').trim().toLowerCase();
    if (!key) continue;
    if (!courseNameToPlans.has(key)) courseNameToPlans.set(key, []);
    courseNameToPlans.get(key)!.push(plan.id);
  }

  const courses = Array.from(courseMap.entries()).map(([key, plan]) => {
    const planIds = courseNameToPlans.get(key) || [];
    // Collect all attendees across all plan IDs for this course
    const allAttendees: typeof attendees = [];
    for (const pid of planIds) {
      const atts = attendeesByPlan.get(pid);
      if (atts) allAttendees.push(...atts);
    }

    // Deduplicate by emp_code + first_name + last_name (keep most recent)
    const seen = new Map<string, (typeof allAttendees)[0]>();
    for (const att of allAttendees) {
      const aKey = `${(att.emp_code || '').trim()}|${(att.first_name || '').trim().toLowerCase()}|${(att.last_name || '').trim().toLowerCase()}`;
      const existing = seen.get(aKey);
      if (!existing || new Date(att.created_at) > new Date(existing.created_at)) {
        seen.set(aKey, att);
      }
    }

    const uniqueAttendees = Array.from(seen.values());
    const completedCount = uniqueAttendees.filter(a => {
      const session = a.training_sessions as unknown as Record<string, unknown> | null;
      return session && session.status === 'completed';
    }).length;

    return {
      course_name: plan.course_name,
      category: plan.category,
      hours_per_course: plan.hours_per_course,
      in_house_external: plan.in_house_external,
      year: plan.year,
      planned_month: plan.planned_month,
      total_attendees: uniqueAttendees.length,
      completed_count: completedCount,
      attendees: uniqueAttendees.map(a => {
        const session = a.training_sessions as unknown as Record<string, unknown> | null;
        return {
          emp_code: a.emp_code,
          first_name: a.first_name,
          last_name: a.last_name,
          position: a.position,
          department: a.department,
          hours_attended: a.hours_attended,
          session_status: session?.status || 'planned',
          scheduled_date_start: session?.scheduled_date_start || null,
          scheduled_date_end: session?.scheduled_date_end || null,
        };
      }),
    };
  });

  // Sort by course name
  courses.sort((a, b) => (a.course_name || '').localeCompare(b.course_name || ''));

  return NextResponse.json({ courses });
}
