import { NextResponse } from 'next/server';
import { DEFAULT_YEAR } from '@/lib/companies';
import { getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities, getCompanySummary } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('id') || '';
  const planType = (searchParams.get('plan') || 'environment') as 'safety' | 'environment';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  const company = await getCompanyForYearWithDb(companyId, year);
  if (!company || !company.sheetId) {
    return NextResponse.json(
      { activities: [], summary: null, error: 'Company not configured' },
      { status: 404 }
    );
  }

  try {
    const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;
    const [activities, summary] = await Promise.all([
      fetchActivities(company, sheetName),
      getCompanySummary(company, planType),
    ]);

    return NextResponse.json({ activities, summary }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`Company API error for ${companyId}:`, error);
    return NextResponse.json(
      { activities: [], summary: null, error: 'Failed to fetch data' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
