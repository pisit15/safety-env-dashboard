/**
 * KPI Quarterly Score API
 *
 * GET /api/kpi/quarterly?companyId=xxx&planType=total&year=2026
 *
 * Returns quarterly KPI scores for a single company or all companies.
 * If companyId is omitted, returns KPI for all active companies (HQ view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { DEFAULT_YEAR } from '@/lib/companies';
import { getActiveCompaniesForYearWithDb, getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities, MONTH_KEYS } from '@/lib/sheets';
import { Activity, MonthStatus, CompanyConfig } from '@/lib/types';
import { calculateYearlyKPI, YearlyKPISummary } from '@/lib/kpi-calculator';

export const dynamic = 'force-dynamic';

// Shared type for postponed override rows
interface PostponedRow {
  activity_no: string;
  month: string;
  status: string;
  postponed_to_month?: string;
  plan_type?: string;
  company_id?: string;
}

// Apply overrides to activities' monthStatuses (same pattern as dashboard API)
function applyOverrides(
  activities: Activity[],
  overrides: Record<string, string>,
): Activity[] {
  const currentMonthIdx = new Date().getMonth();

  return activities.map(act => {
    const newMonthStatuses: Record<string, MonthStatus> = {};
    MONTH_KEYS.forEach((key, idx) => {
      const overrideKey = `${act.no}:${key}`;
      if (overrides[overrideKey]) {
        newMonthStatuses[key] = overrides[overrideKey] as MonthStatus;
      } else {
        const base = act.monthStatuses?.[key] || 'not_planned';
        // Auto-detect overdue: if month passed and still 'planned'
        if (base === 'planned' && idx < currentMonthIdx) {
          newMonthStatuses[key] = 'overdue';
        } else {
          newMonthStatuses[key] = base;
        }
      }
    });
    return { ...act, monthStatuses: newMonthStatuses };
  });
}

// Fetch activities + overrides for a single company+planType, return KPI
async function computeCompanyKPI(
  company: CompanyConfig,
  planType: 'safety' | 'environment',
  year: number,
  allOverrides: Record<string, Record<string, string>>,
  allPostponedOverrides: PostponedRow[],
): Promise<{ activities: Activity[]; overrides: PostponedRow[] }> {
  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;
  if (!company.sheetId || !sheetName) {
    return { activities: [], overrides: [] };
  }

  const activities = await fetchActivities(company, sheetName);
  const companyOverrides = allOverrides[company.id] || {};
  const withOverrides = applyOverrides(activities, companyOverrides);
  const relevantPostponed = allPostponedOverrides.filter(
    o => o.plan_type === planType
  );

  return { activities: withOverrides, overrides: relevantPostponed };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') || '';
  const planType = (searchParams.get('planType') || 'total') as 'safety' | 'environment' | 'total';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  try {
    const sb = getSupabase();
    const planTypes: ('safety' | 'environment')[] = planType === 'total'
      ? ['safety', 'environment']
      : [planType];

    // ── Determine which companies to process ────────────────────
    let companies: CompanyConfig[];
    if (companyId) {
      const c = await getCompanyForYearWithDb(companyId, year);
      companies = c ? [c as CompanyConfig] : [];
    } else {
      companies = await getActiveCompaniesForYearWithDb(year) as CompanyConfig[];
    }

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies found' }, { status: 404 });
    }

    // ── Fetch all status overrides in parallel ──────────────────
    const overridePromises = planTypes.map(pt =>
      sb
        .from('status_overrides')
        .select('company_id, activity_no, month, status, postponed_to_month, plan_type')
        .eq('plan_type', pt)
    );
    const overrideResults = await Promise.all(overridePromises);

    // Group overrides by company → {actNo:month} → status
    const overridesByCompany: Record<string, Record<string, string>> = {};
    const allPostponedRows: PostponedRow[] = [];

    overrideResults.forEach(result => {
      (result.data || []).forEach((o: any) => {
        if (!overridesByCompany[o.company_id]) overridesByCompany[o.company_id] = {};
        // Skip internal __noted__ status
        if (o.status && o.status !== '__noted__') {
          overridesByCompany[o.company_id][`${o.activity_no}:${o.month}`] = o.status;
        }
        if (o.status === 'postponed' && o.postponed_to_month) {
          allPostponedRows.push(o);
        }
      });
    });

    // ── Compute KPI for each company ────────────────────────────
    const results: YearlyKPISummary[] = [];

    for (const company of companies) {
      // Collect activities across plan types
      let allActivities: Activity[] = [];
      let relevantPostponed: PostponedRow[] = [];

      const companyPostponed = allPostponedRows.filter(o => o.company_id === company.id);

      for (const pt of planTypes) {
        const { activities, overrides: ptPostponed } = await computeCompanyKPI(
          company, pt, year,
          { [company.id]: overridesByCompany[company.id] || {} },
          companyPostponed,
        );
        // Tag activities with plan type for identification
        allActivities = allActivities.concat(activities);
        relevantPostponed = relevantPostponed.concat(ptPostponed);
      }

      const kpi = calculateYearlyKPI(
        company.id,
        planType,
        year,
        allActivities,
        relevantPostponed,
      );

      results.push(kpi);
    }

    // ── Response ────────────────────────────────────────────────
    if (companyId && results.length === 1) {
      return NextResponse.json(results[0], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json({
      year,
      planType,
      companies: results,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error) {
    console.error('[kpi/quarterly] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate KPI' },
      { status: 500 }
    );
  }
}
