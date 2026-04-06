import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { COMPANIES } from '@/lib/companies';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = getServiceSupabase();

    // Check if table exists
    const { error: testError } = await supabase.from('company_settings').select('company_id').limit(1);

    if (testError && testError.message.includes('does not exist')) {
      // Return SQL for manual execution
      const createSQL = `
CREATE TABLE IF NOT EXISTS company_settings (
  company_id text PRIMARY KEY,
  company_name text DEFAULT '',
  group_name text DEFAULT '',
  bu text DEFAULT '',
  sheet_id text DEFAULT '',
  safety_sheet text DEFAULT '',
  envi_sheet text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON company_settings FOR ALL USING (true) WITH CHECK (true);
      `.trim();

      return NextResponse.json({
        success: false,
        message: 'Table does not exist. Please create it manually with this SQL:',
        sql: createSQL,
      });
    }

    // Try to add new columns if they don't exist (ALTER TABLE is idempotent with IF NOT EXISTS workaround)
    const alterSQL = `
      DO $$ BEGIN
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS company_name text DEFAULT '';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS sheet_id text DEFAULT '';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS safety_sheet text DEFAULT '';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS envi_sheet text DEFAULT '';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS full_name text DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;
    try {
      await supabase.rpc('exec_sql', { sql: alterSQL });
    } catch {
      // rpc might not exist, columns might already exist
    }

    // Check if full_name column exists by trying to select it
    const { error: fnErr } = await supabase.from('company_settings').select('full_name').limit(1);
    if (fnErr && fnErr.message.includes('full_name')) {
      return NextResponse.json({
        success: false,
        message: 'full_name column is missing. Please run this SQL in Supabase SQL Editor:',
        sql: "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS full_name text DEFAULT '';\nNOTIFY pgrst, 'reload schema';",
      });
    }

    // Seed data from COMPANIES config
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

    const { error: upsertError } = await supabase
      .from('company_settings')
      .upsert(seedData, { onConflict: 'company_id' });

    if (upsertError) {
      return NextResponse.json({ success: false, error: upsertError.message });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${seedData.length} company settings`,
      data: seedData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
