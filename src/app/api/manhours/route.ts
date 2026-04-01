import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

// GET — fetch man-hours
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const companyId = searchParams.get('companyId');
    const year = searchParams.get('year');

    let query = supabase.from('man_hours').select('*');
    if (companyId) query = query.eq('company_id', companyId);
    if (year) query = query.eq('year', parseInt(year));

    query = query.order('month', { ascending: true });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ manHours: data || [] });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — upsert man-hours (create or update)
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Can accept single object or array
    const records = Array.isArray(body) ? body : [body];

    const upsertData = records.map(r => ({
      company_id: r.company_id,
      year: r.year,
      month: r.month,
      employee_count: r.employee_count || 0,
      employee_manhours: r.employee_manhours || 0,
      contractor_count: r.contractor_count || 0,
      contractor_manhours: r.contractor_manhours || 0,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('man_hours')
      .upsert(upsertData, { onConflict: 'company_id,year,month' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ manHours: data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
