import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * GET — Create user_company_access table
 * This table maps one user (from company_users) to multiple companies.
 * When a user logs in to one company, the system can auto-grant access to all linked companies.
 */
export async function GET() {
  const supabase = getServiceSupabase();

  const sql = `
    CREATE TABLE IF NOT EXISTS user_company_access (
      id SERIAL PRIMARY KEY,
      -- Reference username (the "master" identity)
      master_username TEXT NOT NULL,
      master_company_id TEXT NOT NULL,
      -- Additional company this user can access
      access_company_id TEXT NOT NULL,
      -- Display name override for this company (optional)
      display_name TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      -- Prevent duplicate mappings
      UNIQUE(master_username, master_company_id, access_company_id)
    );

    -- Index for fast lookup during login
    CREATE INDEX IF NOT EXISTS idx_uca_master
      ON user_company_access(master_username, master_company_id);
    CREATE INDEX IF NOT EXISTS idx_uca_access
      ON user_company_access(access_company_id);

    -- RLS
    ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

    -- Allow read/write for anon (same pattern as other tables)
    DO $$ BEGIN
      CREATE POLICY "anon_all_uca" ON user_company_access FOR ALL TO anon USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  // Try rpc exec_sql first
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql });

  if (rpcErr) {
    return NextResponse.json({
      message: 'กรุณา run SQL ด้านล่างใน Supabase SQL Editor',
      sql,
      error: rpcErr.message,
    });
  }

  return NextResponse.json({ success: true, message: 'สร้างตาราง user_company_access สำเร็จ' });
}
