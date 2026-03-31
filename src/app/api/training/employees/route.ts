import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch employees for a company
// Priority: company_employees table (master list) > training_attendees (fallback)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const all = searchParams.get('all'); // If 'true', include resigned employees

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Try company_employees master table first
  let query = supabase
    .from('company_employees')
    .select('id, emp_code, first_name, last_name, gender, position, department, employment_status, is_active, created_at, updated_at')
    .eq('company_id', companyId)
    .order('first_name', { ascending: true });

  if (all !== 'true') {
    query = query.eq('is_active', true);
  }

  const { data: masterData, error: masterError } = await query;

  if (!masterError && masterData && masterData.length > 0) {
    return NextResponse.json(masterData);
  }

  // Fallback: get unique employees from training_attendees
  const { data, error } = await supabase
    .from('training_attendees')
    .select('emp_code, first_name, last_name, gender, position, department')
    .eq('company_id', companyId)
    .order('first_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate by first_name + last_name
  const seen = new Map<string, typeof data[0]>();
  for (const row of data || []) {
    const key = `${(row.first_name || '').trim().toLowerCase()}|${(row.last_name || '').trim().toLowerCase()}`;
    if (key === '|') continue;
    if (!seen.has(key)) {
      seen.set(key, row);
    } else {
      const existing = seen.get(key)!;
      if (!existing.emp_code && row.emp_code) {
        seen.set(key, row);
      }
    }
  }

  return NextResponse.json(Array.from(seen.values()));
}

// POST - Import employees from JSON (bulk insert to company_employees)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, employees } = body;

    if (!companyId || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'Missing companyId or employees array' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Ensure table exists (will fail silently if it doesn't — handled by setup)
    const records = employees.map((e: Record<string, string>) => ({
      company_id: companyId,
      emp_code: e.emp_code || '',
      first_name: e.first_name || '',
      last_name: e.last_name || '',
      gender: e.gender || '',
      position: e.position || '',
      department: e.department || '',
      location: e.location || '',
      employee_level: e.employee_level || '',
      is_active: true,
    }));

    // Upsert by company_id + emp_code
    const { data, error } = await supabase
      .from('company_employees')
      .upsert(records, { onConflict: 'company_id,emp_code' })
      .select();

    if (error) {
      // If table doesn't exist, return the SQL to create it
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json({
          error: 'Table company_employees does not exist. Please create it first.',
          sql: `CREATE TABLE IF NOT EXISTS company_employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  emp_code text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  gender text DEFAULT '',
  position text DEFAULT '',
  department text DEFAULT '',
  location text DEFAULT '',
  employee_level text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, emp_code)
);

CREATE INDEX idx_company_employees_company ON company_employees(company_id);
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon access" ON company_employees FOR ALL USING (true) WITH CHECK (true);`
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update a single employee
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, emp_code, first_name, last_name, gender, position, department, employment_status, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing employee id' }, { status: 400 });
    }

    const supabase = getSupabase();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (emp_code !== undefined) updateData.emp_code = emp_code;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (gender !== undefined) updateData.gender = gender;
    if (position !== undefined) updateData.position = position;
    if (department !== undefined) updateData.department = department;
    if (employment_status !== undefined) updateData.employment_status = employment_status;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('company_employees')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove an employee
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing employee id' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('company_employees')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
