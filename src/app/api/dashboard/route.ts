import { NextResponse } from 'next/server';
import { COMPANIES, getActiveCompanies } from '@/lib/companies';
import { getCompanySummary, MONTH_KEYS, MONTH_LABELS } from '@/lib/sheets';
import { getDemoDashboard } from '@/lib/demo-data';
import { DashboardData, CompanySummary, MonthlyProgress } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

    const summaries: CompanySummary[] = await Promise.all(
      activeCompanies.map(c => getCompanySummary(c, planType))
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
