import { NextResponse } from 'next/server';
import { COMPANIES, getActiveCompanies, getActiveCompaniesForYear, DEFAULT_YEAR } from '@/lib/companies';
import { getActiveCompaniesForYearWithDb, getCompaniesWithDbOverrides } from '@/lib/company-settings';
import { getCompanySummary, fetchActivities, MONTH_KEYS, MONTH_LABELS } from '@/lib/sheets';
import { getDemoDashboard } from '@/lib/demo-data';
import { DashboardData, CompanySummary, MonthlyProgress, Activity, MonthStatus } from '@/lib/types';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

export const dynamic = 'force-dynamic';

// Apply Supabase overrides to recalculate summary with effective statuses
// KPI uses month-slot counting (same as chart) — NOT unique activity counting
function recalcSummaryWithOverrides(
  baseSummary: CompanySummary,
  activities: Activity[],
  overrides: Record<string, string>
): CompanySummary {
  if (activities.length === 0) return baseSummary;

  const getEffective = (act: Activity, monthKey: string): MonthStatus => {
    const key = `${act.no}:${monthKey}`;
    if (overrides[key]) return overrides[key] as MonthStatus;
    return act.monthStatuses?.[monthKey] || 'not_planned';
  };

  // Phase B: Current month index for overdue calculation
  const currentMonthIdx = new Date().getMonth();

  // Recalculate monthly progress — track ALL statuses per month
  let totalDone = 0, totalNotStarted = 0, totalPostponed = 0, totalCancelled = 0, totalNotApplicable = 0, totalPlanned = 0;
  let overdueCount = 0; // Phase B: overdue tracking

  const monthlyProgress: MonthlyProgress[] = MONTH_KEYS.map((key, idx) => {
    let planned = 0;
    let doneCount = 0;
    let notApplicableCount = 0;
    let postponedCount = 0;
    let cancelledCount = 0;
    let overdueInMonth = 0; // Phase B

    activities.forEach(act => {
      const status = getEffective(act, key);
      if (status === 'not_planned') return;

      planned++;
      if (status === 'not_applicable') {
        notApplicableCount++;
      } else if (status === 'done') {
        doneCount++;
      } else if (status === 'postponed') {
        postponedCount++;
      } else if (status === 'cancelled') {
        cancelledCount++;
      } else if (idx < currentMonthIdx) {
        // Phase B: month passed but not completed = overdue
        overdueInMonth++;
      }
      // else: planned, overdue → counted in notStarted below
    });

    const completed = doneCount + notApplicableCount; // ยกประโยชน์ให้

    // Accumulate KPI totals from month-slots
    totalPlanned += planned;
    totalDone += doneCount; // เฉพาะที่ทำเสร็จจริง (ไม่รวม N/A)
    totalNotApplicable += notApplicableCount;
    totalPostponed += postponedCount;
    totalCancelled += cancelledCount;
    overdueCount += overdueInMonth; // Phase B

    return {
      month: key,
      label: MONTH_LABELS[key],
      planned,
      completed,
      pctComplete: planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0,
      doneCount,
      notApplicableCount,
      overdueCount: overdueInMonth, // Phase B
    };
  });

  // KPI derived from month-slot totals (same counting as chart)
  // done = เสร็จจริง (ไม่รวม N/A), notApplicable = แยกต่างหาก
  // % = (done + N/A) / total → ยกประโยชน์ให้
  totalNotStarted = totalPlanned - totalDone - totalNotApplicable - totalPostponed - totalCancelled;
  if (totalNotStarted < 0) totalNotStarted = 0;

  const pctDone = totalPlanned > 0
    ? Math.round(((totalDone + totalNotApplicable) / totalPlanned) * 1000) / 10
    : 0;

  return {
    ...baseSummary,
    total: totalPlanned,
    done: totalDone,
    notStarted: totalNotStarted,
    postponed: totalPostponed,
    cancelled: totalCancelled,
    notApplicable: totalNotApplicable,
    pctDone,
    monthlyProgress,
    overdueCount, // Phase B
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planType = (searchParams.get('plan') || 'environment') as 'safety' | 'environment';
  const useDemo = searchParams.get('demo') === 'true';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  if (useDemo) {
    return NextResponse.json(getDemoDashboard());
  }

  try {
    const activeCompanies = await getActiveCompaniesForYearWithDb(year);

    if (activeCompanies.length === 0) {
      return NextResponse.json(getDemoDashboard());
    }

    // Fetch all Supabase overrides for this plan type
    const sb = getSupabase();
    const { data: allOverrides, error: overrideError } = await sb
      .from('status_overrides')
      .select('company_id, activity_no, month, status')
      .eq('plan_type', planType);

    if (overrideError) console.error(`[dashboard] override fetch error: ${overrideError.message}`);

    // Group overrides by company
    const overridesByCompany: Record<string, Record<string, string>> = {};
    (allOverrides || []).forEach((o: any) => {
      if (!overridesByCompany[o.company_id]) overridesByCompany[o.company_id] = {};
      overridesByCompany[o.company_id][`${o.activity_no}:${o.month}`] = o.status;
    });

    // Fetch summaries + activities for each company, then recalculate with overrides
    const summaries: CompanySummary[] = await Promise.all(
      activeCompanies.map(async c => {
        const sheetName = planType === 'safety' ? c.safetySheet : c.enviSheet;
        const [baseSummary, activities] = await Promise.all([
          getCompanySummary(c, planType),
          (c.sheetId && sheetName) ? fetchActivities(c, sheetName) : Promise.resolve([]),
        ]);

        // Always recalculate with effective statuses (overrides + month-level data)
        const companyOverrides = overridesByCompany[c.id] || {};
        if (activities.length > 0) {
          return recalcSummaryWithOverrides(baseSummary, activities, companyOverrides);
        }
        return baseSummary;
      })
    );

    const hasRealData = summaries.some(s => s.total > 0);

    if (!hasRealData) {
      console.warn('No real data fetched from any company, falling back to demo data');
      return NextResponse.json(getDemoDashboard());
    }

    // Include placeholder companies (those without sheet IDs)
    const allCompaniesWithDb = await getCompaniesWithDbOverrides();
    const activeIds = new Set(activeCompanies.map(c => c.id));
    const placeholders = allCompaniesWithDb.filter(c => !activeIds.has(c.id)).map(c => ({
      companyId: c.id,
      companyName: c.name,
      shortName: c.shortName,
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0, notApplicable: 0,
      budget: 0, pctDone: 0, overdueCount: 0,
    }));

    const all = [...summaries, ...placeholders];

    // Aggregate monthly progress across all companies
    const monthlyProgress: MonthlyProgress[] = MONTH_KEYS.map((key, idx) => {
      let totalPlanned = 0;
      let totalCompleted = 0;
      let totalDoneCount = 0;
      let totalNACount = 0;
      summaries.forEach(s => {
        const mp = s.monthlyProgress?.find(m => m.month === key);
        if (mp) {
          totalPlanned += mp.planned;
          totalCompleted += mp.completed;
          totalDoneCount += mp.doneCount ?? mp.completed;
          totalNACount += mp.notApplicableCount ?? 0;
        }
      });
      return {
        month: key,
        label: MONTH_LABELS[key],
        planned: totalPlanned,
        completed: totalCompleted,
        pctComplete: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 1000) / 10 : 0,
        doneCount: totalDoneCount,
        notApplicableCount: totalNACount,
      };
    });

    const totalActs = all.reduce((s, c) => s + c.total, 0);
    const totalDoneAll = all.reduce((s, c) => s + c.done, 0);
    const totalNAAll = all.reduce((s, c) => s + (c.notApplicable || 0), 0);
    const totalOverdue = all.reduce((s, c) => s + (c.overdueCount || 0), 0);

    // Phase B: Fetch priority breakdown from activity_metadata
    let priorityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    try {
      const { data: metadataRows, error: metaError } = await sb
        .from('activity_metadata')
        .select('priority')
        .eq('plan_type', planType)
        .eq('year', year);
      if (!metaError && metadataRows) {
        metadataRows.forEach((r: any) => {
          const p = r.priority as keyof typeof priorityBreakdown;
          if (p in priorityBreakdown) priorityBreakdown[p]++;
        });
      }
    } catch {
      // activity_metadata table might not exist yet — ignore
    }

    const data: DashboardData = {
      companies: all,
      totalActivities: totalActs,
      totalDone: totalDoneAll,
      totalNotStarted: all.reduce((s, c) => s + c.notStarted, 0),
      totalPostponed: all.reduce((s, c) => s + c.postponed, 0),
      totalCancelled: all.reduce((s, c) => s + c.cancelled, 0),
      totalNotApplicable: totalNAAll,
      totalBudget: all.reduce((s, c) => s + c.budget, 0),
      // % = (done + N/A) / total → ยกประโยชน์ให้
      overallPct: totalActs > 0
        ? Math.round(((totalDoneAll + totalNAAll) / totalActs) * 1000) / 10
        : 0,
      monthlyProgress,
      totalOverdue,
      priorityBreakdown,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(getDemoDashboard());
  }
}
