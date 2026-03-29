import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  const { secret } = await request.json();
  if (secret !== 'setup-admin-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const results: string[] = [];

  try {
    // Use Supabase SQL API to create the table
    const sqlStatements = [
      `CREATE TABLE IF NOT EXISTS company_users (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, username)
      )`,
      `ALTER TABLE company_users ENABLE ROW LEVEL SECURITY`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow anon select company_users') THEN
          CREATE POLICY "Allow anon select company_users" ON company_users FOR SELECT TO anon USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow anon insert company_users') THEN
          CREATE POLICY "Allow anon insert company_users" ON company_users FOR INSERT TO anon WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow anon update company_users') THEN
          CREATE POLICY "Allow anon update company_users" ON company_users FOR UPDATE TO anon USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow anon delete company_users') THEN
          CREATE POLICY "Allow anon delete company_users" ON company_users FOR DELETE TO anon USING (true);
        END IF;
      END $$`,
      `INSERT INTO company_users (company_id, username, password, display_name, is_active)
       SELECT company_id, username, password, username, is_active
       FROM company_credentials
       ON CONFLICT (company_id, username) DO NOTHING`
    ];

    for (const sql of sqlStatements) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql })
      });

      // If rpc doesn't work, try the pg endpoint
      if (!res.ok) {
        // Try Supabase pg/query endpoint
        const pgRes = await fetch(`${supabaseUrl}/pg/query`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql })
        });

        if (pgRes.ok) {
          results.push(`OK: ${sql.substring(0, 50)}...`);
        } else {
          const errText = await pgRes.text();
          results.push(`PG Error (${pgRes.status}): ${errText.substring(0, 200)}`);
        }
      } else {
        results.push(`OK: ${sql.substring(0, 50)}...`);
      }
    }

    // Verify table exists
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.from('company_users').select('id', { count: 'exact' });

    return NextResponse.json({
      success: !error,
      results,
      verification: error ? { error: error.message } : { rowCount: data?.length || 0 },
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, results }, { status: 500 });
  }
}
