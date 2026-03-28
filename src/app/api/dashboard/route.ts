import { NextResponse } from 'next/server';
import { COMPANIES, getActiveCompanies } from '@/lib/companies';
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

  // Recalculate monthly progress — track ALL statuses per month
  let totalDone = 0, totalNotStarted = 0, totalPostponed = 0, totalCancelled = 0, totalNotApplicable = 0, totalPlanned = 0;

  const monthlyProgress: MonthlyProgress[] = MONTH_KEYS.map((key, idx) => {
    let planned = 0;
    let doneCount = 0;
    let notApplicableCount = 0;
    let postponedCount = 0;
    let cancelledCount = 0;

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
      }
      // else: planned, overdue → counted in notStarted below
    });

    const completed = doneCount + notApplicableCount; // ยกประโยชน์ให้

    // Accumulate KPI totals from month-slots
    totalPlanned += planned;
    totalDone += doneCount + notApplicableCount; // ยกประโยชน์ให้
    totalNotApplicable += notApplicableCount;
    totalPostponed += postponedCount;
    totalCancelled += cancelledCount;

    return {
      month: key,
      label: MONTH_LABELS[key],
      planned,
      completed,
      pctComplete: planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0,
      doneCount,
      notApplicableCount,
    };
  });

  // KPI derived from month-slot totals (same counting as chart)
  totalNotStarted = totalPlanned - totalDone - totalPostponed - totalCancelled;
  if (totalNotStarted < 0) totalNotStarted = 0;

  return {
    ...baseSummary,
    total: totalPlanned,
    done: totalDone,
    notStarted: totalNotStarted,
    postponed: totalPostponed,
    cancelled: totalCancelled,
    notApplicable: totalNotApplicable,
    pctDone: totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 1000) / 10 : 0,
    monthlyProgress,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planType = (searchParams.get('plan') || 'environment') as 'safety' | 'environment';
  const useDemo = searchParams.get('demo') === 'true';

  if (useDemo) {
    return NextResponse.json(getDemoDashboard());
  }

  try {
    const activeCompanies = getActiveCompanies();

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

    // Include placeholder companies
    const placeholders = COMPANIES.filter(c => c.sheetId === '').map(c => ({
      companyId: c.id,
      companyName: c.name,
      shortName: c.shortName,
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0, notApplicable: 0,
      budget: 0, pctDone: 0,
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
    const data: DashboardData = {
      companies: all,
      totalActivities: totalActs,
      totalDone: all.reduce((s, c) => s + c.done, 0),
      totalNotStarted: all.reduce((s, c) => s + c.notStarted, 0),
      totalPostponed: all.reduce((s, c) => s + c.postponed, 0),
      totalCancelled: all.reduce((s, c) => s + c.cancelled, 0),
      totalNotApplicable: all.reduce((s, c) => s + (c.notApplicable || 0), 0),
      totalBudget: all.reduce((s, c) => s + c.budget, 0),
      overallPct: totalActs > 0
        ? Math.round((all.reduce((s, c) => s + c.done, 0) / totalActs) * 1000) / 10
        : 0,
      monthlyProgress,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(getDemoDashboard());
  }
}
