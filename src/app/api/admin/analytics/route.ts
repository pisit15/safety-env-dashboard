import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics?years=2023,2024,2025,2026
 *
 * Advanced analytics API for multi-year trend analysis, safety rate
 * calculations (TRIR/LTIFR), and cross-company benchmarking.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const currentYear = new Date().getFullYear();

    // Parse years param — default to last 3 years + current
    const yearsParam = searchParams.get('years');
    const years = yearsParam
      ? yearsParam.split(',').map(Number).filter(Boolean)
      : [currentYear - 2, currentYear - 1, currentYear];

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // ── Run all queries in parallel ──
    const [
      nearMissRes,
      incidentsRes,
      injuredRes,
      manHoursRes,
      trainingPlansRes,
      trainingAttendeesRes,
      trainingSessionsRes,
    ] = await Promise.all([
      // Near Miss — all time (filtered client-side by created_at year)
      supabase
        .from('near_miss_reports')
        .select('company_id, status, risk_level, created_at, incident_date')
        .gte('created_at', `${minYear}-01-01`)
        .lt('created_at', `${maxYear + 1}-01-01`),

      // Incidents — multi-year
      supabase
        .from('incidents')
        .select('company_id, incident_type, work_related, year, month, actual_severity, direct_cost, indirect_cost, day_of_week')
        .gte('year', minYear)
        .lte('year', maxYear),

      // Injured persons — for TRIR/LTIFR
      supabase
        .from('injured_persons')
        .select('incident_no, person_type, is_lti, lost_work_days, injury_severity'),

      // Manhours — multi-year
      supabase
        .from('man_hours')
        .select('company_id, year, month, employee_manhours, contractor_manhours, employee_count, contractor_count')
        .gte('year', minYear)
        .lte('year', maxYear),

      // Training plans — multi-year
      supabase
        .from('training_plans')
        .select('company_id, year, category, hours_per_course, planned_month')
        .gte('year', minYear)
        .lte('year', maxYear),

      // Training attendees — multi-year
      supabase
        .from('training_attendees')
        .select('company_id, year, hours_attended')
        .gte('year', minYear)
        .lte('year', maxYear),

      // Training sessions — multi-year
      supabase
        .from('training_sessions')
        .select('status, actual_cost, actual_hours, total_man_hours, actual_participants, scheduled_date_start')
        .gte('scheduled_date_start', `${minYear}-01-01`)
        .lte('scheduled_date_start', `${maxYear}-12-31`),
    ]);

    const nmData = nearMissRes.data || [];
    const incData = incidentsRes.data || [];
    const injData = injuredRes.data || [];
    const mhData = manHoursRes.data || [];
    const tpData = trainingPlansRes.data || [];
    const taData = trainingAttendeesRes.data || [];
    const tsData = trainingSessionsRes.data || [];

    // Build incident_no → year lookup
    const incByNo: Record<string, { year: number; company_id: string }> = {};
    incData.forEach(r => {
      if (r.incident_type) incByNo[r.incident_type] = { year: r.year, company_id: r.company_id };
    });

    // ═══════════════════════════════════════════
    // 1. YEARLY TRENDS (Near Miss, Incidents, Training)
    // ═══════════════════════════════════════════
    const yearlyTrends = years.map(y => {
      const ymNm = nmData.filter(r => new Date(r.created_at).getFullYear() === y);
      const ymInc = incData.filter(r => r.year === y);
      const ymTp = tpData.filter(r => r.year === y);
      const ymTa = taData.filter(r => r.year === y);
      const ymMh = mhData.filter(r => r.year === y);

      const totalMh = ymMh.reduce((s, r) => s + (r.employee_manhours || 0) + (r.contractor_manhours || 0), 0);
      const totalWorkers = ymMh.reduce((s, r) => s + (r.employee_count || 0) + (r.contractor_count || 0), 0);

      return {
        year: y,
        nearMiss: { total: ymNm.length, high: ymNm.filter(r => r.risk_level === 'HIGH').length, closed: ymNm.filter(r => r.status === 'closed').length },
        incidents: { total: ymInc.length, workRelated: ymInc.filter(r => r.work_related === 'Yes' || r.work_related === 'yes').length },
        training: { plans: ymTp.length, attendees: ymTa.length, totalHours: ymTa.reduce((s, r) => s + (r.hours_attended || 0), 0) },
        manhours: { total: totalMh, workers: totalWorkers },
      };
    });

    // ═══════════════════════════════════════════
    // 2. MONTHLY TRENDS (12-month rolling for current year)
    // ═══════════════════════════════════════════
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thMonthToNum: Record<string, number> = { 'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12 };

    const monthlyTrends = years.map(y => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const monthStart = new Date(y, i, 1);
        const monthEnd = new Date(y, i + 1, 0, 23, 59, 59);

        const nmMonth = nmData.filter(r => {
          const d = new Date(r.created_at);
          return d >= monthStart && d <= monthEnd;
        });

        const incMonth = incData.filter(r => {
          if (r.year !== y) return false;
          const incMonthNum = thMonthToNum[r.month] || 0;
          return incMonthNum === m;
        });

        const mhMonth = mhData.filter(r => r.year === y && r.month === m);
        const totalMh = mhMonth.reduce((s, r) => s + (r.employee_manhours || 0) + (r.contractor_manhours || 0), 0);

        return {
          month: monthNames[i],
          nearMiss: nmMonth.length,
          nearMissHigh: nmMonth.filter(r => r.risk_level === 'HIGH').length,
          incidents: incMonth.length,
          manhours: totalMh,
        };
      });
      return { year: y, months };
    });

    // ═══════════════════════════════════════════
    // 3. SAFETY RATES (TRIR & LTIFR per company per year)
    // ═══════════════════════════════════════════
    // Collect all unique company_ids
    const companyIdSet = new Set<string>();
    nmData.forEach(r => { if (r.company_id) companyIdSet.add(r.company_id); });
    incData.forEach(r => { if (r.company_id) companyIdSet.add(r.company_id); });
    mhData.forEach(r => { if (r.company_id) companyIdSet.add(r.company_id); });
    const allCompanyIds = Array.from(companyIdSet);

    const safetyRates = years.map(y => {
      const companies = allCompanyIds.map(cid => {
        const cidMh = mhData.filter(r => r.company_id === cid && r.year === y);
        const totalMh = cidMh.reduce((s, r) => s + (r.employee_manhours || 0) + (r.contractor_manhours || 0), 0);

        // Get incident count for this company/year
        const cidInc = incData.filter(r => r.company_id === cid && r.year === y);

        // Get LTI count from injured_persons linked to these incidents
        const cidIncNos = cidInc.map(r => r.incident_type).filter(Boolean);
        const cidInjured = injData.filter(r => cidIncNos.includes(r.incident_no));
        const totalInjuries = cidInjured.length;
        const ltiCount = cidInjured.filter(r => r.is_lti === true || r.is_lti === 'true' || r.is_lti === 'Yes').length;
        const lostDays = cidInjured.reduce((s, r) => s + (Number(r.lost_work_days) || 0), 0);

        // TRIR = (Total Recordable Injuries / Total Manhours) × 1,000,000
        const trir = totalMh > 0 ? (totalInjuries / totalMh) * 1_000_000 : 0;
        // LTIFR = (Lost Time Injuries / Total Manhours) × 1,000,000
        const ltifr = totalMh > 0 ? (ltiCount / totalMh) * 1_000_000 : 0;
        // Severity Rate = (Lost Work Days / Total Manhours) × 1,000,000
        const severityRate = totalMh > 0 ? (lostDays / totalMh) * 1_000_000 : 0;

        return {
          companyId: cid,
          manhours: totalMh,
          incidents: cidInc.length,
          injuries: totalInjuries,
          lti: ltiCount,
          lostDays,
          trir: Math.round(trir * 100) / 100,
          ltifr: Math.round(ltifr * 100) / 100,
          severityRate: Math.round(severityRate * 100) / 100,
        };
      });

      // Overall totals
      const totalMh = companies.reduce((s, c) => s + c.manhours, 0);
      const totalInjuries = companies.reduce((s, c) => s + c.injuries, 0);
      const totalLti = companies.reduce((s, c) => s + c.lti, 0);
      const totalLostDays = companies.reduce((s, c) => s + c.lostDays, 0);

      return {
        year: y,
        overall: {
          manhours: totalMh,
          incidents: companies.reduce((s, c) => s + c.incidents, 0),
          injuries: totalInjuries,
          lti: totalLti,
          lostDays: totalLostDays,
          trir: totalMh > 0 ? Math.round((totalInjuries / totalMh) * 1_000_000 * 100) / 100 : 0,
          ltifr: totalMh > 0 ? Math.round((totalLti / totalMh) * 1_000_000 * 100) / 100 : 0,
          severityRate: totalMh > 0 ? Math.round((totalLostDays / totalMh) * 1_000_000 * 100) / 100 : 0,
        },
        companies,
      };
    });

    // ═══════════════════════════════════════════
    // 4. COMPANY BENCHMARK (cross-company comparison for latest year)
    // ═══════════════════════════════════════════
    const benchmark = allCompanyIds.map(cid => {
      const cidNm = nmData.filter(r => r.company_id === cid);
      const cidInc = incData.filter(r => r.company_id === cid);
      const cidTp = tpData.filter(r => r.company_id === cid);
      const cidTa = taData.filter(r => r.company_id === cid);
      const cidMh = mhData.filter(r => r.company_id === cid);
      const totalMh = cidMh.reduce((s, r) => s + (r.employee_manhours || 0) + (r.contractor_manhours || 0), 0);
      const nmCloseRate = cidNm.length > 0
        ? Math.round((cidNm.filter(r => r.status === 'closed').length / cidNm.length) * 100)
        : 0;

      return {
        companyId: cid,
        nearMiss: cidNm.length,
        nearMissCloseRate: nmCloseRate,
        incidents: cidInc.length,
        trainingPlans: cidTp.length,
        trainingAttendees: cidTa.length,
        trainingHours: cidTa.reduce((s, r) => s + (r.hours_attended || 0), 0),
        manhours: totalMh,
      };
    });

    // ═══════════════════════════════════════════
    // 5. INCIDENT PATTERNS (day-of-week, severity, cost)
    // ═══════════════════════════════════════════
    const dayOfWeekCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    let totalCost = 0;
    const costByYear: Record<number, number> = {};

    incData.forEach(r => {
      // Day of week
      if (r.day_of_week) dayOfWeekCounts[r.day_of_week] = (dayOfWeekCounts[r.day_of_week] || 0) + 1;
      // Severity
      if (r.actual_severity) severityCounts[r.actual_severity] = (severityCounts[r.actual_severity] || 0) + 1;
      // Cost
      const cost = (Number(r.direct_cost) || 0) + (Number(r.indirect_cost) || 0);
      totalCost += cost;
      costByYear[r.year] = (costByYear[r.year] || 0) + cost;
    });

    // ═══════════════════════════════════════════
    // 6. TRAINING OVERVIEW (completion, cost, sessions)
    // ═══════════════════════════════════════════
    const trainingByYear = years.map(y => {
      const yPlans = tpData.filter(r => r.year === y);
      const ySessions = tsData.filter(r => {
        if (!r.scheduled_date_start) return false;
        return new Date(r.scheduled_date_start).getFullYear() === y;
      });
      const completedSessions = ySessions.filter(r => r.status === 'completed' || r.status === 'จัดอบรมแล้ว').length;
      const totalCost = ySessions.reduce((s, r) => s + (Number(r.actual_cost) || 0), 0);
      const totalSessionHours = ySessions.reduce((s, r) => s + (Number(r.total_man_hours) || 0), 0);

      return {
        year: y,
        plans: yPlans.length,
        sessions: ySessions.length,
        completedSessions,
        completionRate: ySessions.length > 0 ? Math.round((completedSessions / ySessions.length) * 100) : 0,
        totalCost,
        totalSessionHours,
      };
    });

    return NextResponse.json({
      years,
      yearlyTrends,
      monthlyTrends,
      safetyRates,
      benchmark,
      incidentPatterns: {
        dayOfWeek: dayOfWeekCounts,
        severity: severityCounts,
        totalCost,
        costByYear,
      },
      trainingByYear,
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
