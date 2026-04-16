import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard
 *
 * Cross-project aggregated KPIs for the admin overview dashboard.
 * Returns counts/stats from all 7 projects in one API call.
 */
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const year = new Date().getFullYear();

    // Run all queries in parallel
    const [
      nearMissRes,
      incidentsRes,
      trainingPlansRes,
      trainingAttendeesRes,
      riskHazardsRes,
      specialProjectsRes,
      employeesRes,
      manHoursRes,
    ] = await Promise.all([
      // 1. Near Miss summary
      supabase
        .from('near_miss_reports')
        .select('company_id, status, risk_level, created_at', { count: 'exact' }),

      // 2. Incidents this year
      supabase
        .from('incidents')
        .select('company_id, incident_type, work_related, year', { count: 'exact' })
        .eq('year', year),

      // 3. Training plans this year
      supabase
        .from('training_plans')
        .select('id, company_id, category, year', { count: 'exact' })
        .eq('year', year),

      // 4. Training attendees this year
      supabase
        .from('training_attendees')
        .select('id, company_id', { count: 'exact' })
        .eq('year', year),

      // 5. Risk hazards
      supabase
        .from('risk_hazards')
        .select('id, company_id, risk_level', { count: 'exact' }),

      // 6. Special projects
      supabase
        .from('special_projects')
        .select('id, company_id, status', { count: 'exact' }),

      // 7. Employees
      supabase
        .from('company_employees')
        .select('id, company_id', { count: 'exact' }),

      // 8. Manhours this year
      supabase
        .from('man_hours')
        .select('company_id, employee_manhours, contractor_manhours, employee_count, contractor_count')
        .eq('year', year),
    ]);

    // ── Near Miss ──
    const nmData = nearMissRes.data || [];
    const nmTotal = nmData.length;
    const nmNew = nmData.filter((r) => r.status === 'new').length;
    const nmOpen = nmData.filter((r) => r.status !== 'closed').length;
    const nmClosed = nmData.filter((r) => r.status === 'closed').length;
    const nmHigh = nmData.filter((r) => r.risk_level === 'HIGH').length;
    const now = new Date();
    const nmOverdue = nmData.filter((r) => {
      if (r.status === 'closed') return false;
      const days = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / 86400000);
      return days > 14;
    }).length;
    // Per-company near miss
    const nmByCompany: Record<string, number> = {};
    nmData.forEach((r) => { nmByCompany[r.company_id] = (nmByCompany[r.company_id] || 0) + 1; });

    // ── Incidents ──
    const incData = incidentsRes.data || [];
    const incTotal = incData.length;
    const incWorkRelated = incData.filter((r) => r.work_related === 'Yes' || r.work_related === 'yes').length;
    // Per-company incidents
    const incByCompany: Record<string, number> = {};
    incData.forEach((r) => { incByCompany[r.company_id] = (incByCompany[r.company_id] || 0) + 1; });

    // ── Training ──
    const tpData = trainingPlansRes.data || [];
    const tpTotal = tpData.length;
    const taTotal = trainingAttendeesRes.count || 0;
    // Training by category
    const tpByCategory: Record<string, number> = {};
    tpData.forEach((r) => { tpByCategory[r.category || 'อื่นๆ'] = (tpByCategory[r.category || 'อื่นๆ'] || 0) + 1; });

    // ── Risk ──
    const riskData = riskHazardsRes.data || [];
    const riskTotal = riskData.length;
    const riskHigh = riskData.filter((r) => r.risk_level === 'high' || r.risk_level === 'HIGH' || r.risk_level === 'สูง').length;

    // ── Special Projects ──
    const spData = specialProjectsRes.data || [];
    const spTotal = spData.length;
    const spCompleted = spData.filter((r) => r.status === 'completed' || r.status === 'เสร็จสิ้น').length;
    const spInProgress = spData.filter((r) => r.status === 'in_progress' || r.status === 'กำลังดำเนินการ').length;

    // ── Employees ──
    const empTotal = employeesRes.count || 0;

    // ── Manhours ──
    const mhData = manHoursRes.data || [];
    const totalManhours = mhData.reduce((s, r) => s + (r.employee_manhours || 0) + (r.contractor_manhours || 0), 0);
    const totalWorkers = mhData.reduce((s, r) => s + (r.employee_count || 0) + (r.contractor_count || 0), 0);

    // ── Monthly near miss trend (last 6 months) ──
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const nmTrend: { month: string; total: number; high: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthItems = nmData.filter((r) => {
        const cd = new Date(r.created_at);
        return cd >= monthStart && cd <= monthEnd;
      });
      nmTrend.push({
        month: monthNames[d.getMonth()],
        total: monthItems.length,
        high: monthItems.filter((r) => r.risk_level === 'HIGH').length,
      });
    }

    return NextResponse.json({
      year,
      nearMiss: {
        total: nmTotal,
        new: nmNew,
        open: nmOpen,
        closed: nmClosed,
        high: nmHigh,
        overdue: nmOverdue,
        byCompany: nmByCompany,
        trend: nmTrend,
      },
      incidents: {
        total: incTotal,
        workRelated: incWorkRelated,
        byCompany: incByCompany,
      },
      training: {
        plans: tpTotal,
        attendees: taTotal,
        byCategory: tpByCategory,
      },
      risk: {
        total: riskTotal,
        high: riskHigh,
      },
      specialProjects: {
        total: spTotal,
        completed: spCompleted,
        inProgress: spInProgress,
      },
      employees: {
        total: empTotal,
      },
      manhours: {
        total: totalManhours,
        totalWorkers,
      },
    });
  } catch (err) {
    console.error('Admin dashboard API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
