/**
 * Consolidated Action-Plan Workspace endpoint
 * Replaces 7-10 separate API calls with ONE parallel server-side fetch:
 *   - Google Sheets activities + summary (1-2 calls depending on total mode)
 *   - status_overrides (1-2 calls)
 *   - responsible_overrides (1-2 calls)
 *   - budget_overrides (1 call)
 *   - attachment counts (1 call — aggregated GROUP BY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_YEAR } from '@/lib/companies';
import { getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities, getCompanySummary } from '@/lib/sheets';
import { Activity, CompanySummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface StatusRow {
  activity_no: string;
  month: string;
  status: string;
  note?: string;
  postponed_to_month?: string;
  plan_type: string;
}

interface ResponsibleRow {
  activity_no: string;
  responsible: string;
  plan_type: string;
}

interface BudgetRow {
  activity_no: string;
  plan_type: string;
  actual_cost: number;
  note?: string;
}

interface AttachmentCountRow {
  activity_no: string;
  month: string;
  plan_type: string;
  count: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') || '';
  const planType = (searchParams.get('planType') || 'total') as 'safety' | 'environment' | 'total';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const company = await getCompanyForYearWithDb(companyId, year);
  if (!company || !company.sheetId) {
    return NextResponse.json(
      { error: 'Company not configured', activities: [], summary: null },
      { status: 404 }
    );
  }

  const supabase = getSupabase();
  const isTotal = planType === 'total';
  const planTypes = isTotal ? ['safety', 'environment'] as const : [planType] as const;

  try {
    // ── Run ALL queries in parallel ──────────────────────────────
    const [
      sheetsResult,
      statusResult,
      responsibleResult,
      budgetResult,
      attachmentCountResult,
    ] = await Promise.all([
      // 1. Google Sheets: activities + summary
      fetchSheets(company, planTypes, year),
      // 2. Status overrides
      fetchStatusOverrides(supabase, companyId, planTypes),
      // 3. Responsible overrides
      fetchResponsibleOverrides(supabase, companyId, planTypes),
      // 4. Budget overrides
      fetchBudgetOverrides(supabase, companyId, planType, year),
      // 5. Attachment counts (aggregated)
      fetchAttachmentCounts(supabase, companyId, planTypes),
    ]);

    return NextResponse.json({
      // Sheets data
      activities: sheetsResult.activities,
      summary: sheetsResult.summary,
      // Supabase overrides (raw rows — client builds maps)
      statusOverrides: statusResult,
      responsibleOverrides: responsibleResult,
      budgetOverrides: budgetResult,
      attachmentCounts: attachmentCountResult,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`Action-plan workspace error for ${companyId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace data' },
      { status: 500 }
    );
  }
}

// ── Helper: Fetch Google Sheets activities + summary ─────────
async function fetchSheets(
  company: NonNullable<Awaited<ReturnType<typeof getCompanyForYearWithDb>>>,
  planTypes: readonly ('safety' | 'environment')[],
  year: number
): Promise<{ activities: (Activity & { _planTag?: string })[]; summary: CompanySummary | null }> {
  if (planTypes.length === 2) {
    // Total mode: fetch both and merge
    const [safetyResult, enviResult] = await Promise.all([
      fetchSinglePlan(company, 'safety'),
      fetchSinglePlan(company, 'environment'),
    ]);

    const safetyActs = (safetyResult.activities || []).map((a: Activity) => ({ ...a, _planTag: 'S' as const }));
    const enviActs = (enviResult.activities || []).map((a: Activity) => ({ ...a, _planTag: 'E' as const }));

    const s1 = safetyResult.summary;
    const s2 = enviResult.summary;
    let merged: CompanySummary | null = null;

    if (s1 && s2) {
      merged = {
        companyId: s1.companyId,
        companyName: s1.companyName,
        shortName: s1.shortName,
        total: (s1.total || 0) + (s2.total || 0),
        done: (s1.done || 0) + (s2.done || 0),
        notStarted: (s1.notStarted || 0) + (s2.notStarted || 0),
        postponed: (s1.postponed || 0) + (s2.postponed || 0),
        cancelled: (s1.cancelled || 0) + (s2.cancelled || 0),
        notApplicable: (s1.notApplicable || 0) + (s2.notApplicable || 0),
        budget: (s1.budget || 0) + (s2.budget || 0),
        safetyBudget: s1.budget || 0,
        enviBudget: s2.budget || 0,
        pctDone: 0,
        monthlyProgress: s1.monthlyProgress?.map((m, i) => {
          const m2 = s2.monthlyProgress?.[i] || { planned: 0, completed: 0 };
          const planned = (m.planned || 0) + (m2.planned || 0);
          const completed = (m.completed || 0) + (m2.completed || 0);
          return {
            ...m,
            planned,
            completed,
            pctComplete: planned > 0 ? Math.round((completed / planned) * 100) : 0,
          };
        }),
      };
      if (merged) {
        merged.pctDone = merged.total > 0 ? Math.round((merged.done / merged.total) * 100) : 0;
      }
    } else {
      merged = s1 || s2 || null;
    }

    return { activities: [...safetyActs, ...enviActs], summary: merged };
  }

  // Single plan mode
  const result = await fetchSinglePlan(company, planTypes[0]);
  return { activities: result.activities || [], summary: result.summary || null };
}

async function fetchSinglePlan(
  company: NonNullable<Awaited<ReturnType<typeof getCompanyForYearWithDb>>>,
  pt: 'safety' | 'environment'
) {
  const sheetName = pt === 'safety' ? company.safetySheet : company.enviSheet;
  const [activities, summary] = await Promise.all([
    fetchActivities(company, sheetName),
    getCompanySummary(company, pt),
  ]);
  return { activities, summary };
}

// ── Helper: Fetch status overrides ───────────────────────────
async function fetchStatusOverrides(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  planTypes: readonly ('safety' | 'environment')[]
): Promise<StatusRow[]> {
  if (planTypes.length === 2) {
    const [s, e] = await Promise.all([
      supabase.from('status_overrides').select('activity_no,month,status,note,postponed_to_month,plan_type').eq('company_id', companyId).eq('plan_type', 'safety'),
      supabase.from('status_overrides').select('activity_no,month,status,note,postponed_to_month,plan_type').eq('company_id', companyId).eq('plan_type', 'environment'),
    ]);
    return [...(s.data || []), ...(e.data || [])] as StatusRow[];
  }
  const { data } = await supabase
    .from('status_overrides')
    .select('activity_no,month,status,note,postponed_to_month,plan_type')
    .eq('company_id', companyId)
    .eq('plan_type', planTypes[0]);
  return (data || []) as StatusRow[];
}

// ── Helper: Fetch responsible overrides ──────────────────────
async function fetchResponsibleOverrides(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  planTypes: readonly ('safety' | 'environment')[]
): Promise<ResponsibleRow[]> {
  if (planTypes.length === 2) {
    const [s, e] = await Promise.all([
      supabase.from('responsible_overrides').select('activity_no,responsible,plan_type').eq('company_id', companyId).eq('plan_type', 'safety'),
      supabase.from('responsible_overrides').select('activity_no,responsible,plan_type').eq('company_id', companyId).eq('plan_type', 'environment'),
    ]);
    return [...(s.data || []), ...(e.data || [])] as ResponsibleRow[];
  }
  const { data } = await supabase
    .from('responsible_overrides')
    .select('activity_no,responsible,plan_type')
    .eq('company_id', companyId)
    .eq('plan_type', planTypes[0]);
  return (data || []) as ResponsibleRow[];
}

// ── Helper: Fetch budget overrides ───────────────────────────
async function fetchBudgetOverrides(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  planType: 'safety' | 'environment' | 'total',
  year: number
): Promise<BudgetRow[]> {
  let query = supabase
    .from('budget_overrides')
    .select('activity_no,plan_type,actual_cost,note')
    .eq('company_id', companyId)
    .eq('year', year);

  if (planType !== 'total') {
    query = query.eq('plan_type', planType);
  }

  const { data } = await query;
  return (data || []) as BudgetRow[];
}

// ── Helper: Fetch attachment counts (aggregated) ─────────────
// Uses Supabase select with grouping to get counts per activity_no+month+plan_type
async function fetchAttachmentCounts(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  planTypes: readonly ('safety' | 'environment')[]
): Promise<AttachmentCountRow[]> {
  // Supabase doesn't support GROUP BY directly, so we fetch minimal columns
  // and aggregate on the server side
  let query = supabase
    .from('activity_attachments')
    .select('activity_no,month,plan_type')
    .eq('company_id', companyId);

  if (planTypes.length === 1) {
    query = query.eq('plan_type', planTypes[0]);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  // Aggregate counts server-side
  const countMap: Record<string, AttachmentCountRow> = {};
  data.forEach((row: { activity_no: string; month: string; plan_type: string }) => {
    const key = `${row.plan_type}:${row.activity_no}:${row.month}`;
    if (!countMap[key]) {
      countMap[key] = {
        activity_no: row.activity_no,
        month: row.month,
        plan_type: row.plan_type,
        count: 0,
      };
    }
    countMap[key].count++;
  });

  return Object.values(countMap);
}
