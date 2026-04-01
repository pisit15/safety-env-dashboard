import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  const results: Record<string, string> = {};
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Check if incidents table exists
  const { error: testErr } = await supabase.from('incidents').select('id').limit(1);
  if (testErr && testErr.message.includes('does not exist')) {
    return NextResponse.json({
      status: 'incidents_table_missing',
      message: 'The incidents table does not exist. Please create it first.',
      sql: getFullSQL(),
    });
  }
  results.incidents = 'exists';

  // Check injured_persons
  const { error: e2 } = await supabase.from('injured_persons').select('id').limit(1);
  results.injured_persons = e2 ? `missing` : 'exists';

  // Check man_hours
  const { error: e3 } = await supabase.from('man_hours').select('id').limit(1);
  results.man_hours = e3 ? `missing` : 'exists';

  // If action=create, try to create missing tables via REST API
  if (action === 'create') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || '';

    const createResults: string[] = [];

    if (results.injured_persons === 'missing') {
      // Try using the Supabase Management API via pg REST
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        });
        // This won't work for DDL, so let's try the SQL via pg endpoint
      } catch {}

      // Alternative: use the /pg endpoint if available
      // Since we can't run DDL via REST API, return SQL for manual execution
      createResults.push('injured_persons: Cannot create via API - need SQL Editor');
    }

    if (results.man_hours === 'missing') {
      createResults.push('man_hours: Cannot create via API - need SQL Editor');
    }

    return NextResponse.json({
      status: 'partial',
      results,
      createResults,
      sql: getMissingSQL(results),
    });
  }

  if (results.injured_persons === 'missing' || results.man_hours === 'missing') {
    return NextResponse.json({
      status: 'tables_incomplete',
      results,
      message: 'Some tables are missing. Use ?action=create or run SQL manually.',
      sql: getMissingSQL(results),
    });
  }

  return NextResponse.json({ status: 'tables_ready', results });
}

// POST — attempt to create tables via Supabase Management API
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || '';

  if (!serviceKey) {
    return NextResponse.json({ error: 'No Supabase key available' }, { status: 500 });
  }

  const sql = getMissingSQL({ injured_persons: 'missing', man_hours: 'missing' });

  // Try Supabase Management API (requires service role key with proper permissions)
  try {
    const res = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, data });
    }

    // If /pg/query doesn't work, try the SQL REST endpoint
    const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (res2.ok) {
      const data2 = await res2.json();
      return NextResponse.json({ success: true, data: data2, method: 'rpc' });
    }

    const errText = await res2.text();
    return NextResponse.json({
      error: 'Could not create tables via API',
      detail: errText,
      sql,
      message: 'Please run this SQL manually in Supabase SQL Editor',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      error: msg,
      sql,
      message: 'Please run this SQL manually in Supabase SQL Editor',
    });
  }
}

function getMissingSQL(results: Record<string, string>): string {
  let sql = '';

  if (results.injured_persons !== 'exists') {
    sql += `
-- injured_persons table
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
CREATE INDEX IF NOT EXISTS idx_injured_incident ON injured_persons(incident_no);
ALTER TABLE injured_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON injured_persons FOR ALL USING (true) WITH CHECK (true);
`;
  }

  if (results.man_hours !== 'exists') {
    sql += `
-- man_hours table
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
CREATE INDEX IF NOT EXISTS idx_manhours_company_year ON man_hours(company_id, year);
ALTER TABLE man_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON man_hours FOR ALL USING (true) WITH CHECK (true);
`;
  }

  return sql;
}

function getFullSQL(): string {
  return `
-- incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_no TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL,
  bu TEXT,
  incident_date DATE NOT NULL,
  incident_time TEXT,
  year INTEGER NOT NULL,
  month TEXT,
  day_of_week TEXT,
  shift TEXT,
  report_date DATE,
  reporter TEXT,
  person_type TEXT,
  department TEXT,
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
  property_damage_type TEXT,
  property_damage_detail TEXT,
  fire_equipment_used TEXT,
  direct_cost NUMERIC(12,2) DEFAULT 0,
  indirect_cost NUMERIC(12,2) DEFAULT 0,
  production_impact TEXT,
  insurance_claim TEXT,
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
  lessons_learned TEXT,
  report_closed_date DATE,
  report_status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_year ON incidents(year);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON incidents FOR ALL USING (true) WITH CHECK (true);

${getMissingSQL({ injured_persons: 'missing', man_hours: 'missing' })}
`;
}
