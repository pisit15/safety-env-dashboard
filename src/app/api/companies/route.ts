import { NextResponse } from 'next/server';
import { getCompaniesWithDbOverrides } from '@/lib/company-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/companies
 * Returns all companies with database overrides merged in.
 * This endpoint combines static COMPANIES with any overrides from the company_settings table.
 */
export async function GET() {
  try {
    const companies = await getCompaniesWithDbOverrides();
    return NextResponse.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    // Fallback: return empty array, clients should have static fallback
    return NextResponse.json([], { status: 500 });
  }
}
