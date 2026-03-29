import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch unique employees from a company's training attendees
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Get all attendees for the company
  const { data, error } = await supabase
    .from('training_attendees')
    .select('emp_code, first_name, last_name, gender, position, department')
    .eq('company_id', companyId)
    .order('first_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate by first_name + last_name (case-insensitive)
  const seen = new Map<string, typeof data[0]>();
  for (const row of data || []) {
    const key = `${(row.first_name || '').trim().toLowerCase()}|${(row.last_name || '').trim().toLowerCase()}`;
    if (key === '|') continue; // skip empty names
    if (!seen.has(key)) {
      seen.set(key, row);
    } else {
      // Prefer the record with emp_code filled in
      const existing = seen.get(key)!;
      if (!existing.emp_code && row.emp_code) {
        seen.set(key, row);
      }
    }
  }

  const employees = Array.from(seen.values());

  return NextResponse.json(employees);
}
