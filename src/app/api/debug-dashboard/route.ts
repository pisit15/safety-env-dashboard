import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { COMPANIES, getActiveCompanies } from '@/lib/companies';
import { getActiveCompaniesWithDb } from '@/lib/company-settings';
import { getCompanySummary, fetchActivities, MONTH_KEYS } from '@/lib/sheets';
import { Activity, MonthStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planType = (searchParams.get('plan') || 'safety') as 'safety' | 'environment';
  const companyFilter = searchParams.get('company') || '';

  try {
    const activeCompanies = await getActiveCompaniesWithDb();
    const companies = companyFilter
      ? activeCompanies.filter(c => c.id === companyFilter)
      : activeCompanies;

    // Fetch Supabase overrides
    const sb = getSupabase();
    const { data: allOverrides, error: overrideError } = await sb
      .from('status_overrides')
      .select('company_id, activity_no, month, status')
      .eq('plan_type', planType);

    const overridesByCompany: Record<string, Record<string, string>> = {};
    (allOverrides || []).forEach((o: any) => {
      if (!overridesByCompany[o.company_id]) overridesByCompany[o.company_id] = {};
      overridesByCompany[o.company_id][`${o.activity_no}:${o.month}`] = o.status;
    });

    const debugResults: any[] = [];

    for (const c of companies) {
      const sheetName = planType === 'safety' ? c.safetySheet : c.enviSheet;
      const [baseSummary, activities] = await Promise.all([
        getCompanySummary(c, planType),
        (c.sheetId && sheetName) ? fetchActivities(c, sheetName) : Promise.resolve([]),
      ]);

      const companyOverrides = overridesByCompany[c.id] || {};

      // Debug each activity
      const activityDebug = activities.map(act => {
        const monthData: Record<string, any> = {};
        let hasNA = false;

        MONTH_KEYS.forEach(k => {
          const overrideKey = `${act.no}:${k}`;
          const override = companyOverrides[overrideKey];
          const original = act.monthStatuses?.[k] || 'not_planned';
          const effective = override || original;
          if (effective === 'not_applicable') hasNA = true;

          if (original !== 'not_planned' || override) {
            monthData[k] = {
              original,
              override: override || null,
              effective,
              planMark: act.planMonths?.[k] || '',
              actualMark: act.actualMonths?.[k] || '',
            };
          }
        });

        return {
          no: act.no,
          activity: act.activity?.substring(0, 50),
          status: act.status,
          hasNA,
          months: monthData,
        };
      });

      // Recalculate KPI (same logic as recalcSummaryWithOverrides)
      const getEffective = (act: Activity, monthKey: string): MonthStatus => {
        const key = `${act.no}:${monthKey}`;
        if (companyOverrides[key]) return companyOverrides[key] as MonthStatus;
        return act.monthStatuses?.[monthKey] || 'not_planned';
      };

      let done = 0, notStarted = 0, postponed = 0, cancelled = 0, notApplicable = 0;
      const kpiBreakdown: any[] = [];

      activities.forEach(act => {
        const allEffective = MONTH_KEYS.map(k => getEffective(act, k));
        const plannedMonths = MONTH_KEYS.filter((k, idx) => allEffective[idx] !== 'not_planned');

        if (plannedMonths.length === 0) {
          notStarted++;
          kpiBreakdown.push({ no: act.no, result: 'notStarted', reason: 'no planned months' });
          return;
        }

        const naMonths = plannedMonths.filter(k => getEffective(act, k) === 'not_applicable');
        const hasAnyNA = naMonths.length > 0 || act.status === 'not_applicable';
        if (hasAnyNA) notApplicable++;

        if (act.status === 'not_applicable' || naMonths.length === plannedMonths.length) {
          done++;
          kpiBreakdown.push({ no: act.no, result: 'done(NA)', reason: `fullyNA: status=${act.status}, naMonths=${naMonths.length}/${plannedMonths.length}` });
          return;
        }

        const cancelledAll = plannedMonths.filter(k => getEffective(act, k) === 'cancelled');
        if (act.status === 'cancelled' || cancelledAll.length === plannedMonths.length) {
          cancelled++;
          kpiBreakdown.push({ no: act.no, result: 'cancelled', reason: `cancelledAll=${cancelledAll.length}/${plannedMonths.length}` });
          return;
        }

        const postponedAll = plannedMonths.filter(k => getEffective(act, k) === 'postponed');
        if (act.status === 'postponed' || postponedAll.length === plannedMonths.length) {
          postponed++;
          kpiBreakdown.push({ no: act.no, result: 'postponed', reason: `postponedAll=${postponedAll.length}/${plannedMonths.length}` });
          return;
        }

        const currentMonthIdx = new Date().getMonth();
        const plannedUpToCurrent = MONTH_KEYS.filter((k, idx) =>
          idx <= currentMonthIdx && getEffective(act, k) !== 'not_planned' && getEffective(act, k) !== 'not_applicable'
        );
        const doneUpToCurrent = plannedUpToCurrent.filter(k => getEffective(act, k) === 'done');

        if (doneUpToCurrent.length > 0) {
          done++;
          kpiBreakdown.push({ no: act.no, result: 'done', reason: `doneUpToCurrent=${doneUpToCurrent.length}/${plannedUpToCurrent.length}, months=[${doneUpToCurrent}]` });
        } else {
          notStarted++;
          kpiBreakdown.push({ no: act.no, result: 'notStarted', reason: `plannedUpToCurrent=${plannedUpToCurrent.length}, none done` });
        }
      });

      debugResults.push({
        companyId: c.id,
        planType,
        activitiesCount: activities.length,
        overridesCount: Object.keys(companyOverrides).length,
        overrideKeys: Object.keys(companyOverrides),
        baseSummary: {
          done: baseSummary.done,
          notStarted: baseSummary.notStarted,
          notApplicable: baseSummary.notApplicable,
          postponed: baseSummary.postponed,
          cancelled: baseSummary.cancelled,
        },
        recalcSummary: { done, notStarted, notApplicable, postponed, cancelled },
        kpiBreakdown: kpiBreakdown.filter(k => k.result.includes('done') || k.result.includes('NA')),
        naActivities: activityDebug.filter(a => a.hasNA || a.status === 'not_applicable'),
      });
    }

    return NextResponse.json({
      planType,
      overrideFetchError: overrideError?.message || null,
      totalOverrides: allOverrides?.length || 0,
      companies: debugResults,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
