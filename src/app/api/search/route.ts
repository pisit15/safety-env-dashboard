import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=keyword&limit=20
 *
 * Cross-project search across multiple tables.
 * Returns categorized results.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = getServiceSupabase();
    const pattern = `%${q}%`;

    // Search 5 tables in parallel
    const [nmRes, incRes, empRes, trainingRes, projectRes] = await Promise.all([
      // Near miss
      supabase
        .from('near_miss_reports')
        .select('id, report_no, company_id, location, reporter_name, status, risk_level, incident_description')
        .or(`location.ilike.${pattern},incident_description.ilike.${pattern},reporter_name.ilike.${pattern},report_no.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Incidents
      supabase
        .from('incidents')
        .select('id, incident_no, company_id, incident_type, location, description, year')
        .or(`location.ilike.${pattern},description.ilike.${pattern},incident_no.ilike.${pattern},cause.ilike.${pattern}`)
        .order('incident_date', { ascending: false })
        .limit(limit),

      // Employees
      supabase
        .from('company_employees')
        .select('id, company_id, first_name, last_name, emp_code, position, department')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},emp_code.ilike.${pattern},position.ilike.${pattern}`)
        .limit(limit),

      // Training plans
      supabase
        .from('training_plans')
        .select('id, company_id, course_name, category, year')
        .ilike('course_name', pattern)
        .order('year', { ascending: false })
        .limit(limit),

      // Special projects
      supabase
        .from('special_projects')
        .select('id, company_id, name, status')
        .or(`name.ilike.${pattern}`)
        .limit(limit),
    ]);

    type SearchResult = {
      id: string;
      category: string;
      title: string;
      subtitle: string;
      companyId: string;
      href: string;
    };

    const results: SearchResult[] = [];

    // Near miss
    (nmRes.data || []).forEach((r) => {
      results.push({
        id: `nm-${r.id}`,
        category: 'Near Miss',
        title: `${r.report_no || 'NM'} — ${r.location || ''}`,
        subtitle: `${r.reporter_name || ''} · ${r.status || ''}${r.risk_level === 'HIGH' ? ' · ⚠️ HIGH' : ''}`,
        companyId: r.company_id,
        href: `/projects/nearmiss/${r.company_id}`,
      });
    });

    // Incidents
    (incRes.data || []).forEach((r) => {
      results.push({
        id: `inc-${r.id}`,
        category: 'อุบัติเหตุ',
        title: `${r.incident_no || ''} — ${r.location || ''}`,
        subtitle: `${r.incident_type || ''} · ${r.year || ''}`,
        companyId: r.company_id,
        href: `/projects/incidents/${r.company_id}`,
      });
    });

    // Employees
    (empRes.data || []).forEach((r) => {
      results.push({
        id: `emp-${r.id}`,
        category: 'พนักงาน',
        title: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        subtitle: `${r.emp_code || ''} · ${r.position || ''} · ${r.department || ''}`,
        companyId: r.company_id,
        href: `/projects/employees/${r.company_id}`,
      });
    });

    // Training
    (trainingRes.data || []).forEach((r) => {
      results.push({
        id: `tr-${r.id}`,
        category: 'อบรม',
        title: r.course_name || '',
        subtitle: `${r.category || ''} · ${r.year || ''}`,
        companyId: r.company_id,
        href: `/projects/training/${r.company_id}`,
      });
    });

    // Projects
    (projectRes.data || []).forEach((r) => {
      results.push({
        id: `sp-${r.id}`,
        category: 'โครงการพิเศษ',
        title: r.name || '',
        subtitle: r.status || '',
        companyId: r.company_id,
        href: `/projects/special/${r.company_id}`,
      });
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ results: [] });
  }
}
