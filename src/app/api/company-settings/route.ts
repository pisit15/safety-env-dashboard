import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMPANIES } from '@/lib/companies';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Auto-create table if it doesn't exist and seed with default data
async function ensureTable() {
  const supabase = getServiceSupabase();

  // Try a simple select to see if table exists
  const { error } = await supabase.from('company_settings').select('company_id').limit(1);

  if (error && error.message.includes('does not exist')) {
    // Table doesn't exist — try to create via rpc
    const createSQL = `
      CREATE TABLE IF NOT EXISTS company_settings (
        company_id text PRIMARY KEY,
        group_name text DEFAULT '',
        bu text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow all for service role" ON company_settings FOR ALL USING (true) WITH CHECK (true);
    `;
    try {
      await supabase.rpc('exec_sql', { sql: createSQL });
    } catch {
      // rpc might not exist — try via postgrest
      // If this also fails, return false
      return false;
    }

    // Seed data from static config
    const seedData = COMPANIES.map(c => ({
      company_id: c.id,
      group_name: c.group || '',
      bu: c.bu || '',
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('company_settings').upsert(seedData, { onConflict: 'company_id' });
    return true;
  }

  return true; // table exists
}

// GET - Fetch all company settings (group & BU)
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*');

    if (error) {
      // Try to create the table
      const created = await ensureTable();
      if (created) {
        // Retry
        const { data: d2 } = await supabase.from('company_settings').select('*');
        return NextResponse.json({ settings: d2 || [], autoCreated: true });
      }
      // Table doesn't exist and couldn't be created — return defaults from static config
      const defaults = COMPANIES.map(c => ({
        company_id: c.id,
        group_name: c.group || '',
        bu: c.bu || '',
      }));
      return NextResponse.json({ settings: defaults, source: 'static' });
    }

    // If table exists but is empty, seed it
    if (!data || data.length === 0) {
      const seedData = COMPANIES.map(c => ({
        company_id: c.id,
        group_name: c.group || '',
        bu: c.bu || '',
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
      group_name: c.group || '',
      bu: c.bu || '',
    }));
    return NextResponse.json({ settings: defaults, source: 'static' });
  }
}

// PUT - Update group/BU for a company
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, group_name, bu } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Upsert the setting
    const { error } = await supabase
      .from('company_settings')
      .upsert(
        {
          company_id,
          group_name: group_name || '',
          bu: bu || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
