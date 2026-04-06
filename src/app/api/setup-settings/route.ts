import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// One-time setup endpoint — creates app_settings table with default values
// Uses the anon key since we just need to insert data

export async function POST(request: Request) {
  const { secret } = await request.json();
  if (secret !== 'setup-admin-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();

  // Try to check if table exists by selecting
  const { data: existing, error: checkErr } = await supabase
    .from('app_settings')
    .select('key')
    .limit(1);

  if (checkErr) {
    return NextResponse.json({
      error: 'Table app_settings does not exist. Run the SQL in Supabase SQL Editor.',
      sql: `CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is internal admin settings)
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default
INSERT INTO app_settings (key, value) VALUES ('deadline_enabled', 'true');`,
    }, { status: 400 });
  }

  // Table exists — try to insert default setting
  const { error: insertErr } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'deadline_enabled', value: 'true', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'app_settings table is ready with deadline_enabled = true',
  });
}
