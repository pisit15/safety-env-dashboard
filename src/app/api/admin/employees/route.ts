import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET — Admin: query all attendees across companies
// ?search=name — search by employee name
// ?companyId=xxx — filter by company
// ?courseName=xxx — filter by course name
// ?year=2026 — filter by plan year
// ?status=completed — filter by session status
// ?page=1&limit=50 — pagination
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const companyId = searchParams.get('companyId') || '';
  const courseName = searchParams.get('courseName') || '';
  const year = searchParams.get('year') || '';
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const mode = searchParams.get('mode') || 'attendees'; // 'attendees' | 'summary' | 'courses'

  const supabase = getSupabase();

  if (mode === 'summary') {
    // Summary stats per company
    const { data, error } = await supabase
      .from('training_attendees')
      .select('company_id, id, training_sessions(status), training_plans(year)');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by company
    const companyMap: Record<string, { total: number; completed: number; uniqueEmps: Set<string> }> = {};
    for (const row of (data || [])) {
      const cid = row.company_id;
      if (!companyMap[cid]) companyMap[cid] = { total: 0, completed: 0, uniqueEmps: new Set() };

      const plan = row.training_plans as unknown as Record<string, unknown> | null;
      if (year && plan && String(plan.year) !== year) continue;

      companyMap[cid].total++;
      const session = row.training_sessions as unknown as Record<string, unknown> | null;
      if (session?.status === 'completed') companyMap[cid].completed++;
    }

    const summary = Object.entries(companyMap).map(([cid, v]) => ({
      company_id: cid,
      total_records: v.total,
      completed_records: v.completed,
    }));

    return NextResponse.json({ summary });
  }

  if (mode === 'courses') {
    // List unique courses with attendee counts
    let query = supabase
      .from('training_attendees')
      .select('company_id, emp_code, first_name, last_name, training_plans(course_name, category, year, hours_per_course, in_house_external), training_sessions(status)');

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by course_name
    const courseMap: Record<string, {
      course_name: string;
      category: string;
      hours: number;
      type: string;
      companies: Set<string>;
      total_attendees: number;
      completed_attendees: number;
      unique_employees: Set<string>;
    }> = {};

    for (const row of (data || [])) {
      const plan = row.training_plans as unknown as Record<string, unknown> | null;
      if (!plan) continue;
      if (year && String(plan.year) !== year) continue;

      const cname = String(plan.course_name || '');
      if (!cname) continue;
      if (courseName && !cname.toLowerCase().includes(courseName.toLowerCase())) continue;

      if (!courseMap[cname]) {
        courseMap[cname] = {
          course_name: cname,
          category: String(plan.category || ''),
          hours: Number(plan.hours_per_course) || 0,
          type: String(plan.in_house_external || ''),
          companies: new Set(),
          total_attendees: 0,
          completed_attendees: 0,
          unique_employees: new Set(),
        };
      }
      const c = courseMap[cname];
      c.companies.add(row.company_id);
      c.total_attendees++;
      const session = row.training_sessions as unknown as Record<string, unknown> | null;
      if (session?.status === 'completed') c.completed_attendees++;
      const empKey = `${row.emp_code}|${row.first_name}|${row.last_name}`;
      c.unique_employees.add(empKey);
    }

    const courses = Object.values(courseMap).map(c => ({
      ...c,
      companies: Array.from(c.companies),
      company_count: c.companies.size,
      unique_employee_count: c.unique_employees.size,
      unique_employees: undefined,
    })).sort((a, b) => b.total_attendees - a.total_attendees);

    return NextResponse.json({ courses });
  }

  // Default: attendees list with search & filters
  let query = supabase
    .from('training_attendees')
    .select('id, company_id, emp_code, first_name, last_name, position, department, hours_attended, created_at, training_sessions(status, scheduled_date_start, scheduled_date_end), training_plans(course_name, category, hours_per_course, in_house_external, planned_month, year)')
    .order('created_at', { ascending: false });

  if (companyId) query = query.eq('company_id', companyId);

  // Supabase doesn't support OR across multiple columns easily, so we fetch and filter
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let filtered = data || [];

  // Filter by year
  if (year) {
    filtered = filtered.filter((a: Record<string, unknown>) => {
      const plan = a.training_plans as unknown as Record<string, unknown> | null;
      return plan && String(plan.year) === year;
    });
  }

  // Filter by status
  if (status) {
    filtered = filtered.filter((a: Record<string, unknown>) => {
      const session = a.training_sessions as unknown as Record<string, unknown> | null;
      return session && session.status === status;
    });
  }

  // Filter by course name
  if (courseName) {
    const lower = courseName.toLowerCase();
    filtered = filtered.filter((a: Record<string, unknown>) => {
      const plan = a.training_plans as unknown as Record<string, unknown> | null;
      return plan && typeof plan.course_name === 'string' && plan.course_name.toLowerCase().includes(lower);
    });
  }

  // Search by employee name/code
  if (search) {
    const lower = search.toLowerCase();
    filtered = filtered.filter((a: Record<string, unknown>) => {
      const fn = String(a.first_name || '').toLowerCase();
      const ln = String(a.last_name || '').toLowerCase();
      const code = String(a.emp_code || '').toLowerCase();
      const full = `${fn} ${ln}`;
      return fn.includes(lower) || ln.includes(lower) || code.includes(lower) || full.includes(lower);
    });
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return NextResponse.json({
    attendees: paged,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
