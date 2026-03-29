-- ============================================================
-- Training Module Tables for EA Safety & Environment Dashboard
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Training Plans (Master Data - imported from approved Excel)
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

-- 2. Training Sessions (Actual scheduling and completion per course)
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

-- 3. Training Attendees (Individual attendee records)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tp_company ON training_plans(company_id, year);
CREATE INDEX IF NOT EXISTS idx_tp_month ON training_plans(company_id, year, planned_month);
CREATE INDEX IF NOT EXISTS idx_ts_plan ON training_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_ts_company ON training_sessions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ts_dates ON training_sessions(scheduled_date_start);
CREATE INDEX IF NOT EXISTS idx_ta_session ON training_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_ta_emp ON training_attendees(emp_code, company_id);
CREATE INDEX IF NOT EXISTS idx_ta_plan ON training_attendees(plan_id);

-- RLS Policies (allow anon access like other tables)
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_plans_anon_all ON training_plans FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY training_sessions_anon_all ON training_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY training_attendees_anon_all ON training_attendees FOR ALL TO anon USING (true) WITH CHECK (true);
