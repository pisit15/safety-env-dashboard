import { NextResponse } from 'next/server';
import { COMPANIES, getActiveCompanies } from '@/lib/companies';
import { getCompanySummary } from '@/lib/sheets';
import { getDemoDashboard } from '@/lib/demo-data';
import { DashboardData, CompanySummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planType = (searchParams.get('plan') || 'environment') as 'safety' | 'environment';
  const useDemo = searchParams.get('demo') === 'true';

  // If demo mode or no Google credentials, return demo data
  if (useDemo || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(getDemoDashboard());
  }

  try {
    const activeCompanies = getActiveCompanies();
    const summaries: CompanySummary[] = await Promise.all(
      activeCompanies.map(c => getCompanySummary(c, planType))
    );

    // Include placeholder companies (not yet configured)
    const placeholders = COMPANIES.filter(c => c.sheetId === '').map(c => ({
      companyId: c.id,
      companyName: c.name,
      shortName: c.shortName,
      total: 0, done: 0, inProgress: 0, notStarted: 0,
      budget: 0, pctDone: 0,
    }));

    const all = [...summaries, ...placeholders];
    const data: DashboardData = {
      companies: all,
      totalActivities: all.reduce((s, c) => s + c.total, 0),
      totalDone: all.reduce((s, c) => s + c.done, 0),
      totalInProgress: all.reduce((s, c) => s + c.inProgress, 0),
      totalNotStarted: all.reduce((s, c) => s + c.notStarted, 0),
      totalBudget: all.reduce((s, c) => s + c.budget, 0),
      overallPct: all.reduce((s, c) => s + c.total, 0) > 0
        ? Math.round((all.reduce((s, c) => s + c.done, 0) / all.reduce((s, c) => s + c.total, 0)) * 1000) / 10
        : 0,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    // Fallback to demo data on error
    return NextResponse.json(getDemoDashboard());
  }
}
