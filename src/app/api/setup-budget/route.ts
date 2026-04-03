import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SETUP_SQL = `
-- Budget overrides table: stores actual cost per activity
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

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_budget_overrides_company
  ON budget_overrides(company_id, plan_type, year);

-- RLS policy (allow all for now, same pattern as other tables)
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
  const supabase = getServiceSupabase();

  // Try using rpc exec_sql if available
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql: SETUP_SQL });

  if (rpcError) {
    // If rpc not available, return the SQL for manual execution
    return NextResponse.json({
      message: 'RPC not available. Please run this SQL in Supabase SQL Editor:',
      sql: SETUP_SQL,
      error: rpcError.message,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'budget_overrides table created successfully',
  });
}
