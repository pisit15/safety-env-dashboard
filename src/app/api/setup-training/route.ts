import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST() {
  try {
    const supabase = getSupabase();

    // Check if tables already exist by trying to query them
    const { error: checkError } = await supabase.from('training_plans').select('id').limit(1);

    if (!checkError) {
      return NextResponse.json({ success: true, message: 'Training tables already exist' });
    }

    // Tables don't exist - return SQL for manual creation
    const sql = `-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS training_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  year integer NOT NULL DEFAULT 2026,
  course_no integer,
  category text,
  course_name text NOT NULL,
  in_house_external text DEFAULT 'External',
  planned_month integer CHECK (planned_month >= 1 AND planned_month <= 12),
  hours_per_course numeric DEFAULT 0,
  planned_participants integer DEFAULT 0,
  total_planned_hours numeric DEFAULT 0,
  budget numeric DEFAULT 0,
  target_group text,
  training_necessity text,
  responsible_person text,
  remarks text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES training_plans(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  status text DEFAULT 'planned' CHECK (status IN ('planned','scheduled','completed','cancelled','postponed')),
  scheduled_date_start date,
  scheduled_date_end date,
  actual_cost numeric DEFAULT 0,
  actual_participants integer DEFAULT 0,
  hours_per_course numeric DEFAULT 0,
  total_man_hours numeric DEFAULT 0,
  note text,
  hr_submitted boolean DEFAULT false,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_attendees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES training_plans(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  emp_code text,
  title text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text,
  position text,
  department text,
  location text,
  employee_level text,
  training_type text DEFAULT 'Mandatory',
  onsite_online text DEFAULT 'Onsite',
  external_inhouse text,
  learning_method text DEFAULT 'Training',
  program_type text,
  registration_type text DEFAULT 'registered' CHECK (registration_type IN ('registered','attended')),
  hours_attended numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_company ON training_plans(company_id, year);
CREATE INDEX IF NOT EXISTS idx_tp_month ON training_plans(company_id, year, planned_month);
CREATE INDEX IF NOT EXISTS idx_ts_plan ON training_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_ts_company ON training_sessions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ts_dates ON training_sessions(scheduled_date_start);
CREATE INDEX IF NOT EXISTS idx_ta_session ON training_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_ta_emp ON training_attendees(emp_code, company_id);
CREATE INDEX IF NOT EXISTS idx_ta_plan ON training_attendees(plan_id);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_plans_anon_all ON training_plans FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY training_sessions_anon_all ON training_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY training_attendees_anon_all ON training_attendees FOR ALL TO anon USING (true) WITH CHECK (true);`;

    return NextResponse.json({
      success: false,
      message: 'Tables do not exist. Please run the SQL below in Supabase SQL Editor.',
      sql
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Check if training tables exist
export async function GET() {
  try {
    const supabase = getSupabase();
    const tables = ['training_plans', 'training_sessions', 'training_attendees'];
    const results: Record<string, boolean> = {};

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      results[table] = !error;
    }

    const allExist = Object.values(results).every(v => v);
    return NextResponse.json({ allExist, tables: results });
  } catch {
    return NextResponse.json({ allExist: false, error: 'Failed to check tables' });
  }
}
