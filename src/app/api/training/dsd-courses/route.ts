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

    // Fetch all rows (override default 1000-row limit)
    let allData: { course_name: string; dsd_eligible: boolean | null; company_id: string; is_active: boolean | null }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('training_plans')
        .select('course_name, dsd_eligible, company_id, is_active')
        .range(from, from + pageSize - 1);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Group by course_name
    const courseMap = new Map<string, { allEligible: boolean; allActive: boolean; companies: Set<string> }>();
    for (const row of allData) {
      const eligible = row.dsd_eligible !== false;
      const active = row.is_active !== false;
      const existing = courseMap.get(row.course_name);
      if (existing) {
        existing.companies.add(row.company_id);
        if (!eligible) existing.allEligible = false;
        if (!active) existing.allActive = false;
      } else {
        courseMap.set(row.course_name, {
          allEligible: eligible,
          allActive: active,
          companies: new Set([row.company_id]),
        });
      }
    }

    const result = Array.from(courseMap.entries())
      .map(([course_name, info]) => ({
        course_name,
        dsd_eligible: info.allEligible,
        is_active: info.allActive,
        company_count: info.companies.size,
      }))
      .sort((a, b) => a.course_name.localeCompare(b.course_name, 'th'));

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
