import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

// GET — fetch all injured persons for a company across selected years
// Query params: company_id, years (comma-separated)
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const yearsParam = searchParams.get('years');

    if (!companyId || !yearsParam) {
      return NextResponse.json({ error: 'Missing company_id or years' }, { status: 400 });
    }

    const years = yearsParam.split(',').map(Number).filter(y => !isNaN(y));
    if (years.length === 0) {
      return NextResponse.json({ error: 'Invalid years' }, { status: 400 });
    }

    // First get all incident_no for this company and years
    const { data: incidents, error: incErr } = await supabase
      .from('incidents')
      .select('incident_no, year, work_related, incident_type')
      .eq('company_id', companyId)
      .in('year', years);

    if (incErr) return NextResponse.json({ error: incErr.message }, { status: 500 });

    if (!incidents || incidents.length === 0) {
      return NextResponse.json({ persons: [], incidentMap: {} });
    }

    const incidentNos = incidents.map(i => i.incident_no);

    // Build a map of incident_no -> { year, work_related, incident_type }
    const incidentMap: Record<string, { year: number; work_related: string; incident_type: string }> = {};
    for (const inc of incidents) {
      incidentMap[inc.incident_no] = {
        year: inc.year,
        work_related: inc.work_related || '',
        incident_type: inc.incident_type || '',
      };
    }

    // Fetch all injured_persons for these incidents in batches (Supabase has .in() limit)
    const BATCH_SIZE = 200;
    const allPersons: Record<string, unknown>[] = [];

    for (let i = 0; i < incidentNos.length; i += BATCH_SIZE) {
      const batch = incidentNos.slice(i, i + BATCH_SIZE);
      const { data: persons, error: pErr } = await supabase
        .from('injured_persons')
        .select('incident_no, person_type, injury_severity, nature_of_injury, body_part, body_side, is_lti, lost_work_days')
        .in('incident_no', batch);

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      if (persons) allPersons.push(...persons);
    }

    return NextResponse.json({ persons: allPersons, incidentMap });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
