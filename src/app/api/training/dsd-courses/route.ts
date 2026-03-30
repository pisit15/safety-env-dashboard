import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch distinct course names with dsd_eligible status and company count
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('training_plans')
      .select('course_name, dsd_eligible, company_id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by course_name
    const courseMap = new Map<string, { dsd_eligible: boolean; companies: Set<string> }>();
    for (const row of (data || [])) {
      const existing = courseMap.get(row.course_name);
      if (existing) {
        existing.companies.add(row.company_id);
        // If any plan has dsd_eligible true, consider the course eligible
        if (row.dsd_eligible === true) existing.dsd_eligible = true;
      } else {
        courseMap.set(row.course_name, {
          dsd_eligible: row.dsd_eligible === true,
          companies: new Set([row.company_id]),
        });
      }
    }

    const result = Array.from(courseMap.entries())
      .map(([course_name, info]) => ({
        course_name,
        dsd_eligible: info.dsd_eligible,
        company_count: info.companies.size,
      }))
      .sort((a, b) => a.course_name.localeCompare(b.course_name, 'th'));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
