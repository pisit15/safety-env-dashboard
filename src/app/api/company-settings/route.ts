import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMPANIES } from '@/lib/companies';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch all company settings
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*');

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
    const allowedFields = ['group_name', 'bu', 'company_name', 'sheet_id', 'safety_sheet', 'envi_sheet'];
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
