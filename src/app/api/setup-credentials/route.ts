import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// One-time setup endpoint — creates company_credentials table and migrates data
// Call once then remove or protect

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  const { secret } = await request.json();
  if (secret !== 'setup-admin-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
  });

  // Create table using raw SQL via rpc if available, or just try insert
  // Since we can't run DDL via REST API, we'll check if table exists first
  const { data: existing, error: checkErr } = await supabase
    .from('company_credentials')
    .select('id')
    .limit(1);

  if (checkErr && checkErr.message.includes('does not exist')) {
    // Table doesn't exist — need to create via SQL Editor
    return NextResponse.json({
      error: 'Table company_credentials does not exist yet. Please run the SQL migration first.',
      sql: `CREATE TABLE IF NOT EXISTS company_credentials (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE company_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select credentials" ON company_credentials FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert credentials" ON company_credentials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update credentials" ON company_credentials FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete credentials" ON company_credentials FOR DELETE TO anon USING (true);
INSERT INTO company_credentials (company_id, username, password) VALUES
  ('aab', 'aab', 'aab2026'),
  ('ea-kabin', 'ea-kabin', 'eakabin2026'),
  ('ebi', 'ebi', 'ebi2026')
ON CONFLICT (company_id) DO NOTHING;`
    });
  }

  // If table exists, try to seed default data
  if (existing && existing.length === 0) {
    const { error: insertErr } = await supabase.from('company_credentials').insert([
      { company_id: 'aab', username: 'aab', password: 'aab2026' },
      { company_id: 'ea-kabin', username: 'ea-kabin', password: 'eakabin2026' },
      { company_id: 'ebi', username: 'ebi', password: 'ebi2026' },
    ]);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Credentials table ready', existing: existing?.length || 0 });
}
