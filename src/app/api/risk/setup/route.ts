import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = `
-- ==========================================
-- RISK ASSESSMENT MODULE — DB SCHEMA
-- Task Risk Management Methodology
-- ==========================================

-- 1) Risk Register: list of tasks per company
CREATE TABLE IF NOT EXISTS risk_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  ra_no integer NOT NULL DEFAULT 1,
  department text,
  working_area text,
  work_position text,
  task_name text NOT NULL,
  task_name_th text,
  task_description text,
  process_stage text,
  start_point text,
  end_point text,
  machine text,
  building_area text,
  persons_at_risk text,
  ra_reason text,
  responsible_person text,
  max_risk_level integer DEFAULT 0,
  risk_scale text DEFAULT 'N/A',
  status text DEFAULT 'Pending',
  actions_pending boolean DEFAULT false,
  revision_number integer DEFAULT 0,
  last_update timestamptz DEFAULT now(),
  next_review_date date,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_tasks_company ON risk_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_risk_tasks_status ON risk_tasks(status);

-- 2) Risk Hazards: hazard entries per task (Steps 2-4)
CREATE TABLE IF NOT EXISTS risk_hazards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES risk_tasks(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  hazard_no integer DEFAULT 1,
  hazard_category text,
  hazard_description text NOT NULL,
  existing_controls text,
  severity integer DEFAULT 1,
  probability integer DEFAULT 1,
  risk_level integer DEFAULT 1,
  risk_scale text DEFAULT 'Low',
  new_control_measures text,
  control_type text,
  responsible_person text,
  deadline date,
  done boolean DEFAULT false,
  residual_severity integer,
  residual_probability integer,
  residual_risk_level integer,
  residual_risk_scale text,
  reference_doc text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_hazards_task ON risk_hazards(task_id);
CREATE INDEX IF NOT EXISTS idx_risk_hazards_company ON risk_hazards(company_id);

-- 3) Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_risk_tasks_updated ON risk_tasks;
CREATE TRIGGER trg_risk_tasks_updated
  BEFORE UPDATE ON risk_tasks
  FOR EACH ROW EXECUTE FUNCTION update_risk_updated_at();

DROP TRIGGER IF EXISTS trg_risk_hazards_updated ON risk_hazards;
CREATE TRIGGER trg_risk_hazards_updated
  BEFORE UPDATE ON risk_hazards
  FOR EACH ROW EXECUTE FUNCTION update_risk_updated_at();
  `;

  // Try using service role key if available
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return NextResponse.json({
      message: 'SUPABASE_URL not configured. Please run this SQL manually in Supabase SQL Editor:',
      sql,
    });
  }

  if (!serviceKey) {
    // No service key — just return SQL for manual execution
    return NextResponse.json({
      message: 'No SUPABASE_SERVICE_ROLE_KEY configured. Please copy the SQL below and run it in Supabase Dashboard → SQL Editor → New Query → Run:',
      sql,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Try rpc exec_sql
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      return NextResponse.json({
        message: 'exec_sql RPC not available. Please copy the SQL below and run it in Supabase Dashboard → SQL Editor → New Query → Run:',
        sql,
        rpc_error: error.message,
      });
    }

    return NextResponse.json({ success: true, message: 'Risk Assessment tables created successfully!' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({
      message: 'Error occurred. Please copy the SQL below and run it in Supabase Dashboard → SQL Editor → New Query → Run:',
      sql,
      error: msg,
    });
  }
}
