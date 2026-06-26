import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCompaniesWithDbOverrides, invalidateCompanySettingsCache } from '@/lib/company-settings';
import { DEFAULT_YEAR } from '@/lib/companies';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Per-company, per-year Google Sheet configuration (Admin-managed).
 *
 * GET  /api/company-year-sheets?year=2027
 *   -> { year, rows: [{ company_id, company_name, group_name, bu, sheet_id, safety_sheet, envi_sheet }] }
 *
 * PUT  body { year, company_id, sheet_id?, safety_sheet?, envi_sheet? }
 *   -> upsert one company's sheet config for a year.
 */
export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const year = parseInt(yearParam || String(DEFAULT_YEAR), 10);

    const supabase = getServiceSupabase();
    const [{ data: sheetRows }, companies] = await Promise.all([
      supabase.from('company_year_sheets').select('*').eq('year', year),
      getCompaniesWithDbOverrides(),
    ]);

    const byId = new Map(
      (sheetRows || []).map((r: { company_id: string; sheet_id: string; safety_sheet: string; envi_sheet: string }) => [r.company_id, r]),
    );

    const rows = companies.map((c) => {
      const r = byId.get(c.id);
      return {
        company_id: c.id,
        company_name: c.name,
        full_name: c.fullName || '',
        group_name: c.group || '',
        bu: c.bu || '',
        sheet_id: r?.sheet_id ?? '',
        safety_sheet: r?.safety_sheet ?? '',
        envi_sheet: r?.envi_sheet ?? '',
      };
    });

    return NextResponse.json({ year, rows });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseInt(String(body.year), 10);
    const companyId = body.company_id;

    if (!Number.isFinite(year) || !companyId) {
      return NextResponse.json({ error: 'Missing year or company_id' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      company_id: companyId,
      year,
      updated_at: new Date().toISOString(),
    };
    for (const f of ['sheet_id', 'safety_sheet', 'envi_sheet'] as const) {
      if (f in body) payload[f] = body[f] ?? '';
    }

    const { error } = await getServiceSupabase()
      .from('company_year_sheets')
      .upsert(payload, { onConflict: 'company_id,year' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    invalidateCompanySettingsCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
