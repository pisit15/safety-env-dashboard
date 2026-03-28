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

  // Recalculate monthly progress
  const monthlyProgress: MonthlyProgress[] = MONTH_KEYS.map((key, idx) => {
    let planned = 0;
    let doneCount = 0;
    let notApplicableCount = 0;

    activities.forEach(act => {
      const status = getEffective(act, key);
      if (status === 'not_applicable') {
        notApplicableCount++;
        planned++;  // ยกประโยชน์ให้
      } else if (status !== 'not_planned') {
        planned++;
        if (status === 'done') doneCount++;
      }
    });

    const completed = doneCount + notApplicableCount;
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

  // Recalculate KPI from effective statuses
  let done = 0, notStarted = 0, postponed = 0, cancelled = 0, notApplicable = 0;

  activities.forEach(act => {
    const allEffective = MONTH_KEYS.map(k => getEffective(act, k));
    const plannedMonths = MONTH_KEYS.filter((k, idx) => allEffective[idx] !== 'not_planned');

    if (plannedMonths.length === 0) { notStarted++; return; }

    // Check for not_applicable (any month or activity-level)
    const naMonths = plannedMonths.filter(k => getEffective(act, k) === 'not_applicable');
    const hasAnyNA = naMonths.length > 0 || act.status === 'not_applicable';
    if (hasAnyNA) notApplicable++;

    // Full activity is not_applicable → count as done
    if (act.status === 'not_applicable' || naMonths.length === plannedMonths.length) {
      done++;
      return;
    }

    // Full activity cancelled/postponed
    const cancelledAll = plannedMonths.filter(k => getEffective(act, k) === 'cancelled');
    if (act.status === 'cancelled' || cancelledAll.length === plannedMonths.length) { cancelled++; return; }

    const postponedAll = plannedMonths.filter(k => getEffective(act, k) === 'postponed');
    if (act.status === 'postponed' || postponedAll.length === plannedMonths.length) { postponed++; return; }

    // Check month-by-month up to current
    const currentMonthIdx = new Date().getMonth();
    const plannedUpToCurrent = MONTH_KEYS.filter((k, idx) =>
      idx <= currentMonthIdx && getEffective(act, k) !== 'not_planned' && getEffective(act, k) !== 'not_applicable'
    );
    const doneUpToCurrent = plannedUpToCurrent.filter(k => getEffective(act, k) === 'done');

    if (doneUpToCurrent.length > 0) {
      done++;
    } else {
      notStarted++;
    }
  });

  const total = baseSummary.total;
  return {
    ...baseSummary,
    done, notStarted, postponed, cancelled, notApplicable,
    pctDone: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
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
    const { data: allOverrides } = await sb
      .from('status_overrides')
      .select('company_id, activity_no, month, status')
      .eq('plan_type', planType);

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
