import { NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/companies';
import { fetchActivities } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company') || 'ea-kabin';
  const planType = searchParams.get('type') || 'safety';

  const company = getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;
  const activities = await fetchActivities(company, sheetName);

  const budgetDetails = activities.map(a => ({
    no: a.no,
    activity: a.activity.substring(0, 60),
    budget: a.budget,
    status: a.status,
  }));

  const totalBudget = activities.reduce((sum, a) => sum + a.budget, 0);

  return NextResponse.json({
    company: companyId,
    planType,
    sheetName,
    totalActivities: activities.length,
    totalBudget,
    activities: budgetDetails,
  });
}
