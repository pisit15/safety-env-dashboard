import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { COMPANIES, DEFAULT_YEAR } from '@/lib/companies';
import { getActiveCompaniesForYearWithDb, getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch company settings (optionally filtered by companyId)
// Add ?debug=esl to trace full data flow for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const debugId = searchParams.get('debug');

    // ── Debug mode: trace full data flow for a specific company ──
    if (debugId) {
      const year = DEFAULT_YEAR;
      const results: Record<string, any> = { companyId: debugId, year, steps: {} };

      // Step 1: Static config
      const staticCo = COMPANIES.find(c => c.id === debugId);
      results.steps['1_static'] = staticCo
        ? { sheetId: staticCo.sheetId || '(empty)', safetySheet: staticCo.safetySheet || '(empty)', enviSheet: staticCo.enviSheet || '(empty)' }
        : { error: 'not found in static config' };

      // Step 2: Direct DB row
      const supabase = getServiceSupabase();
      const { data: dbRow, error: dbErr } = await supabase
        .from('company_settings').select('*').eq('company_id', debugId);
      results.steps['2_db_row'] = dbErr
        ? { error: dbErr.message }
        : (dbRow && dbRow.length > 0)
          ? { sheet_id: dbRow[0].sheet_id || '(empty)', safety_sheet: dbRow[0].safety_sheet || '(empty)', envi_sheet: dbRow[0].envi_sheet || '(empty)', raw: dbRow[0] }
          : { error: 'NO ROW in DB for this company_id' };

      // Step 3: Merged company (DB + static)
      try {
        const merged = await getCompanyForYearWithDb(debugId, year);
        results.steps['3_merged'] = merged
          ? { sheetId: merged.sheetId || '(empty)', safetySheet: merged.safetySheet || '(empty)', enviSheet: merged.enviSheet || '(empty)' }
          : { error: 'getCompanyForYearWithDb returned undefined' };
      } catch (e: any) { results.steps['3_merged'] = { error: e.message }; }

      // Step 4: Active companies list
      try {
        const active = await getActiveCompaniesForYearWithDb(year);
        const match = active.find(c => c.id === debugId);
        results.steps['4_active'] = {
          totalActive: active.length,
          included: !!match,
          ids: active.map(c => c.id),
        };
      } catch (e: any) { results.steps['4_active'] = { error: e.message }; }

      // Step 5: Google Sheets fetch test
      try {
        const company = await getCompanyForYearWithDb(debugId, year);
        if (company && company.sheetId) {
          const sheets: Record<string, any> = {};
          if (company.safetySheet) {
            try { const a = await fetchActivities(company, company.safetySheet); sheets.safety = { ok: true, count: a.length }; }
            catch (e: any) { sheets.safety = { ok: false, error: e.message }; }
          } else { sheets.safety = { skipped: 'safetySheet empty' }; }
          if (company.enviSheet) {
            try { const a = await fetchActivities(company, company.enviSheet); sheets.envi = { ok: true, count: a.length }; }
            catch (e: any) { sheets.envi = { ok: false, error: e.message }; }
          } else { sheets.envi = { skipped: 'enviSheet empty' }; }
          results.steps['5_sheets'] = sheets;
        } else {
          results.steps['5_sheets'] = { skipped: company ? 'sheetId empty' : 'company not found' };
        }
      } catch (e: any) { results.steps['5_sheets'] = { error: e.message }; }

      // Diagnosis
      const s2 = results.steps['2_db_row'];
      const s4 = results.steps['4_active'];
      if (s2?.error?.includes('NO ROW')) results.diagnosis = 'DB ไม่มี row — ต้องตั้งค่าใน Admin ก่อน';
      else if (s2?.sheet_id === '(empty)') results.diagnosis = 'DB มี row แต่ sheet_id ว่าง — ต้องใส่ Google Sheet ID ใน Admin';
      else if (s4?.included === false) results.diagnosis = 'มี sheetId แต่ไม่อยู่ใน active list — ตรวจ getActiveCompaniesForYearWithDb';
      else if (results.steps['5_sheets']?.safety?.ok === false || results.steps['5_sheets']?.envi?.ok === false)
        results.diagnosis = 'Google Sheets fetch ล้มเหลว — ตรวจ permission หรือชื่อ sheet';
      else results.diagnosis = 'ทุกขั้นตอนผ่าน — ข้อมูลควรขึ้นแล้ว';

      return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = getServiceSupabase();
    let query = supabase.from('company_settings').select('*');
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;

    if (error) {
      // Table doesn't exist — return defaults from static config
      const defaults = COMPANIES.map(c => ({
        company_id: c.id,
        company_name: c.name,
        group_name: c.group || '',
        bu: c.bu || '',
        sheet_id: c.sheetId || '',
        safety_sheet: c.safetySheet || '',
        envi_sheet: c.enviSheet || '',
      }));
      return NextResponse.json({ settings: defaults, source: 'static' });
    }

    // If table exists but is empty, seed it
    if (!data || data.length === 0) {
      const seedData = COMPANIES.map(c => ({
        company_id: c.id,
        company_name: c.name,
        group_name: c.group || '',
        bu: c.bu || '',
        sheet_id: c.sheetId || '',
        safety_sheet: c.safetySheet || '',
        envi_sheet: c.enviSheet || '',
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('company_settings').upsert(seedData, { onConflict: 'company_id' });
      return NextResponse.json({ settings: seedData, seeded: true });
    }

    return NextResponse.json({ settings: data });
  } catch {
    // Fallback to static config
    const defaults = COMPANIES.map(c => ({
      company_id: c.id,
      company_name: c.name,
      group_name: c.group || '',
      bu: c.bu || '',
      sheet_id: c.sheetId || '',
      safety_sheet: c.safetySheet || '',
      envi_sheet: c.enviSheet || '',
    }));
    return NextResponse.json({ settings: defaults, source: 'static' });
  }
}

// PUT - Update settings for a company (partial update)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, ...fields } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Build upsert payload — only include fields that were sent
    const payload: Record<string, string> = { company_id, updated_at: new Date().toISOString() };
    const allowedFields = ['group_name', 'bu', 'company_name', 'full_name', 'sheet_id', 'safety_sheet', 'envi_sheet'];
    for (const f of allowedFields) {
      if (f in fields) {
        payload[f] = fields[f] ?? '';
      }
    }

    const { error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
