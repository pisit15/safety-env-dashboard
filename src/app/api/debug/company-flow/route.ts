/**
 * Debug endpoint: diagnose why a company's action plan data isn't loading.
 * Usage: GET /api/debug/company-flow?companyId=esl
 *
 * This traces the full data flow and reports where it breaks.
 * REMOVE THIS FILE after debugging is complete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { COMPANIES, DEFAULT_YEAR } from '@/lib/companies';
import { getCompanyByIdWithDb, getActiveCompaniesForYearWithDb, getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities, getCompanySummary } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') || 'esl';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  const results: Record<string, any> = { companyId, year, steps: {} };

  // Step 1: Static config
  const staticCompany = COMPANIES.find(c => c.id === companyId);
  results.steps['1_static_config'] = staticCompany
    ? { found: true, sheetId: staticCompany.sheetId || '(empty)', safetySheet: staticCompany.safetySheet || '(empty)', enviSheet: staticCompany.enviSheet || '(empty)', hasYears: !!staticCompany.years }
    : { found: false };

  // Step 2: DB-merged company
  try {
    const dbCompany = await getCompanyByIdWithDb(companyId);
    results.steps['2_db_merged'] = dbCompany
      ? { found: true, sheetId: dbCompany.sheetId || '(empty)', safetySheet: dbCompany.safetySheet || '(empty)', enviSheet: dbCompany.enviSheet || '(empty)' }
      : { found: false, note: 'getCompanyByIdWithDb returned undefined' };
  } catch (e: any) {
    results.steps['2_db_merged'] = { error: e.message };
  }

  // Step 3: getCompanyForYearWithDb (used by action-plan workspace)
  try {
    const yearCompany = await getCompanyForYearWithDb(companyId, year);
    results.steps['3_company_for_year'] = yearCompany
      ? { found: true, sheetId: yearCompany.sheetId || '(empty)', safetySheet: yearCompany.safetySheet || '(empty)', enviSheet: yearCompany.enviSheet || '(empty)' }
      : { found: false, note: 'getCompanyForYearWithDb returned undefined — action-plan workspace will 404' };
  } catch (e: any) {
    results.steps['3_company_for_year'] = { error: e.message };
  }

  // Step 4: getActiveCompaniesForYearWithDb (used by dashboard API)
  try {
    const activeCompanies = await getActiveCompaniesForYearWithDb(year);
    const match = activeCompanies.find(c => c.id === companyId);
    results.steps['4_active_for_year'] = {
      totalActive: activeCompanies.length,
      activeIds: activeCompanies.map(c => c.id),
      thisCompanyIncluded: !!match,
      thisCompanySheetId: match?.sheetId || '(not found)',
      thisCompanySafetySheet: match?.safetySheet || '(not found)',
      thisCompanyEnviSheet: match?.enviSheet || '(not found)',
    };
  } catch (e: any) {
    results.steps['4_active_for_year'] = { error: e.message };
  }

  // Step 5: Try fetching Google Sheets data
  try {
    const company = await getCompanyForYearWithDb(companyId, year);
    if (company && company.sheetId) {
      const sheetsResults: Record<string, any> = {};

      // Safety sheet
      if (company.safetySheet) {
        try {
          const safetyActivities = await fetchActivities(company, company.safetySheet);
          sheetsResults.safety = { success: true, activityCount: safetyActivities.length };
        } catch (e: any) {
          sheetsResults.safety = { success: false, error: e.message };
        }
      } else {
        sheetsResults.safety = { skipped: true, reason: 'safetySheet is empty' };
      }

      // Envi sheet
      if (company.enviSheet) {
        try {
          const enviActivities = await fetchActivities(company, company.enviSheet);
          sheetsResults.environment = { success: true, activityCount: enviActivities.length };
        } catch (e: any) {
          sheetsResults.environment = { success: false, error: e.message };
        }
      } else {
        sheetsResults.environment = { skipped: true, reason: 'enviSheet is empty' };
      }

      results.steps['5_google_sheets_fetch'] = sheetsResults;
    } else {
      results.steps['5_google_sheets_fetch'] = { skipped: true, reason: company ? 'sheetId is empty' : 'company not found' };
    }
  } catch (e: any) {
    results.steps['5_google_sheets_fetch'] = { error: e.message };
  }

  // Step 6: Direct DB check via Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from('company_settings')
      .select('company_id, sheet_id, safety_sheet, envi_sheet, company_name')
      .eq('company_id', companyId);

    if (error) {
      results.steps['6_direct_db_check'] = { error: error.message };
    } else if (!data || data.length === 0) {
      results.steps['6_direct_db_check'] = { found: false, note: 'No row in company_settings for this company_id' };
    } else {
      results.steps['6_direct_db_check'] = {
        found: true,
        row: data[0],
        sheet_id_truthy: !!data[0].sheet_id,
        safety_sheet_truthy: !!data[0].safety_sheet,
        envi_sheet_truthy: !!data[0].envi_sheet,
      };
    }
  } catch (e: any) {
    results.steps['6_direct_db_check'] = { error: e.message };
  }

  // Summary
  const step2 = results.steps['2_db_merged'];
  const step4 = results.steps['4_active_for_year'];
  const step5 = results.steps['5_google_sheets_fetch'];
  const step6 = results.steps['6_direct_db_check'];

  if (step6?.found === false) {
    results.diagnosis = 'ROOT CAUSE: No row in company_settings DB table. The admin may not have saved settings for this company.';
  } else if (step6?.sheet_id_truthy === false) {
    results.diagnosis = 'ROOT CAUSE: DB row exists but sheet_id is empty. The Google Sheet ID needs to be configured in admin.';
  } else if (step2?.sheetId === '(empty)') {
    results.diagnosis = 'BUG: DB has sheet_id but mergeCompany() returned empty sheetId. Check the merge logic.';
  } else if (step4?.thisCompanyIncluded === false) {
    results.diagnosis = 'BUG: Company has sheetId after merge but is not included in active companies list. Check getActiveCompaniesForYearWithDb filter logic.';
  } else if (step5?.safety?.success === false || step5?.environment?.success === false) {
    results.diagnosis = `Google Sheets fetch failed. Safety: ${JSON.stringify(step5?.safety)}. Environment: ${JSON.stringify(step5?.environment)}`;
  } else if (step5?.safety?.activityCount === 0 && step5?.environment?.activityCount === 0) {
    results.diagnosis = 'Google Sheets fetched successfully but returned 0 activities for both plans. Check sheet format/structure.';
  } else {
    results.diagnosis = 'All steps passed — data should be loading. Check client-side rendering or caching.';
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
