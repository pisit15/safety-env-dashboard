import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();
  const results: Record<string, string> = {};

  // Check if incidents table exists
  const { error: testErr } = await supabase.from('incidents').select('id').limit(1);
  if (testErr && testErr.message.includes('does not exist')) {
    // Return SQL for manual execution in Supabase SQL Editor
    const sql = `
-- =============================================
-- EA Incident System — Database Schema
-- =============================================

-- 1. incidents — 1 row = 1 incident event
CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_no TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL,
  bu TEXT,

  -- IDENTIFICATION
  incident_date DATE NOT NULL,
  incident_time TEXT,
  year INTEGER NOT NULL,
  month TEXT,
  day_of_week TEXT,
  shift TEXT,
  report_date DATE,
  reporter TEXT,

  -- WHO
  person_type TEXT,
  department TEXT,

  -- WHAT & WHERE
  work_related TEXT DEFAULT 'ใช่',
  incident_type TEXT NOT NULL,
  actual_severity TEXT,
  potential_severity TEXT,
  injured_count INTEGER DEFAULT 0,
  contact_type TEXT,
  agency_source TEXT,
  activity TEXT,
  description TEXT,
  area TEXT,
  equipment TEXT,
  environment TEXT,

  -- PROPERTY DAMAGE
  property_damage_type TEXT,
  property_damage_detail TEXT,
  fire_equipment_used TEXT,

  -- CONSEQUENCE
  direct_cost NUMERIC(12,2) DEFAULT 0,
  indirect_cost NUMERIC(12,2) DEFAULT 0,
  production_impact TEXT,
  insurance_claim TEXT,

  -- INVESTIGATION
  investigation_level TEXT,
  investigation_start_date DATE,
  investigation_lead TEXT,
  rca_method TEXT,
  immediate_cause TEXT,
  contributing_cause TEXT,
  root_cause_category TEXT,
  root_cause_detail TEXT,
  barrier_failure TEXT,
  just_culture TEXT,

  -- CORRECTIVE ACTIONS
  corrective_action_1 TEXT,
  ca1_type TEXT,
  ca1_responsible TEXT,
  ca1_due_date DATE,
  ca1_status TEXT DEFAULT 'Open',
  corrective_action_2 TEXT,
  ca2_type TEXT,
  ca2_responsible TEXT,
  ca2_due_date DATE,
  ca2_status TEXT DEFAULT 'Open',

  -- CLOSURE
  lessons_learned TEXT,
  report_closed_date DATE,
  report_status TEXT DEFAULT 'Draft',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. injured_persons — 1 row = 1 injured person (linked to incident)
CREATE TABLE IF NOT EXISTS injured_persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_no TEXT NOT NULL REFERENCES incidents(incident_no) ON DELETE CASCADE,
  person_order INTEGER DEFAULT 1,

  person_type TEXT,
  full_name TEXT,
  position TEXT,
  department TEXT,
  years_of_service NUMERIC(5,1),
  training_status TEXT,

  injury_severity TEXT,
  nature_of_injury TEXT,
  body_part TEXT,
  body_side TEXT,
  injury_detail TEXT,
  is_lti TEXT DEFAULT 'ไม่ใช่',
  lost_work_days INTEGER DEFAULT 0,
  leave_start_date DATE,
  return_to_work_date DATE,
  treatment TEXT,
  hospital TEXT,
  medical_cost NUMERIC(12,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. man_hours — monthly man-hours per company
CREATE TABLE IF NOT EXISTS man_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  employee_count INTEGER DEFAULT 0,
  employee_manhours NUMERIC(12,2) DEFAULT 0,
  contractor_count INTEGER DEFAULT 0,
  contractor_manhours NUMERIC(12,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, year, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_year ON incidents(year);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_injured_incident ON injured_persons(incident_no);
CREATE INDEX IF NOT EXISTS idx_manhours_company_year ON man_hours(company_id, year);

-- RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON incidents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE injured_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON injured_persons FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE man_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON man_hours FOR ALL USING (true) WITH CHECK (true);
`;
    return NextResponse.json({
      status: 'tables_not_found',
      message: 'Please run this SQL in Supabase SQL Editor first',
      sql,
    });
  }

  results.incidents = 'exists';

  // Check injured_persons
  const { error: e2 } = await supabase.from('injured_persons').select('id').limit(1);
  results.injured_persons = e2 ? `error: ${e2.message}` : 'exists';

  // Check man_hours
  const { error: e3 } = await supabase.from('man_hours').select('id').limit(1);
  results.man_hours = e3 ? `error: ${e3.message}` : 'exists';

  return NextResponse.json({ status: 'tables_ready', results });
}
