import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS budget_overrides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('safety', 'environment')),
  activity_no text NOT NULL,
  year integer NOT NULL DEFAULT 2026,
  actual_cost numeric(12,2) DEFAULT 0,
  note text,
  updated_by text DEFAULT 'admin',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, plan_type, activity_no, year)
);

CREATE INDEX IF NOT EXISTS idx_budget_overrides_company
  ON budget_overrides(company_id, plan_type, year);

ALTER TABLE budget_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'budget_overrides' AND policyname = 'Allow all budget_overrides'
  ) THEN
    CREATE POLICY "Allow all budget_overrides" ON budget_overrides FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  // Use Supabase's SQL endpoint directly (PostgREST pg/sql)
  const sqlUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

  // Try rpc first
  let rpcWorked = false;
  try {
    const rpcRes = await fetch(sqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql: SETUP_SQL }),
    });
    if (rpcRes.ok) {
      rpcWorked = true;
    }
  } catch { /* rpc not available */ }

  if (rpcWorked) {
    return NextResponse.json({ success: true, message: 'budget_overrides table created via rpc' });
  }

  // Fallback: Use Supabase Management API (requires project ref)
  // Extract project ref from URL: https://<ref>.supabase.co
  const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
  const projectRef = refMatch ? refMatch[1] : null;

  if (projectRef) {
    // Try the /pg/query endpoint (Supabase v2 SQL execution)
    try {
      const queryUrl = `https://${projectRef}.supabase.co/pg/query`;
      const pgRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: SETUP_SQL }),
      });
      if (pgRes.ok) {
        return NextResponse.json({ success: true, message: 'budget_overrides table created via pg/query' });
      }
    } catch { /* pg/query not available */ }
  }

  // Last resort: return SQL for manual execution
  return NextResponse.json({
    message: 'Auto-creation failed. Please run this SQL in Supabase SQL Editor (https://supabase.com/dashboard):',
    sql: SETUP_SQL,
    projectRef,
  });
}
