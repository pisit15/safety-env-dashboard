import { NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/companies';
import { fetchActivities } from '@/lib/sheets';
import { DEMO_EBI_ACTIVITIES } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('id') || '';
  const planType = (searchParams.get('plan') || 'environment') as 'safety' | 'environment';
  const useDemo = searchParams.get('demo') === 'true';

  // Demo mode
  if (useDemo || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    if (companyId === 'ebi') {
      return NextResponse.json({ activities: DEMO_EBI_ACTIVITIES });
    }
    return NextResponse.json({ activities: [] });
  }

  const company = getCompanyById(companyId);
  if (!company || !company.sheetId) {
    return NextResponse.json({ activities: [], error: 'Company not configured' }, { status: 404 });
  }

  try {
    const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;
    const activities = await fetchActivities(company, sheetName);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error(`Company API error for ${companyId}:`, error);
    return NextResponse.json({ activities: [], error: 'Failed to fetch data' }, { status: 500 });
  }
}
