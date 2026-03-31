import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMPANIES } from '@/lib/companies';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);

    // Step 1: Create the table if not exists
    const createSQL = `
      CREATE TABLE IF NOT EXISTS company_settings (
        company_id text PRIMARY KEY,
        group_name text DEFAULT '',
        bu text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `;

    // Try to run via rpc
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createSQL });

    if (createError) {
      // If RPC not available, try direct insert to see if table exists
      // If table doesn't exist, return SQL for manual execution
      const { error: testError } = await supabase.from('company_settings').select('company_id').limit(1);

      if (testError && testError.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          message: 'Table does not exist. Please create it manually with this SQL:',
          sql: createSQL,
        });
      }
    }

    // Step 2: Seed data from COMPANIES config
    const seedData = COMPANIES.map(c => ({
      company_id: c.id,
      group_name: c.group || '',
      bu: c.bu || '',
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
