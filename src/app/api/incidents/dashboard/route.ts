import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

/**
 * Consolidated dashboard endpoint — replaces 15-31 separate API calls with ONE.
 *
 * GET /api/incidents/dashboard?companyId=amt&years=2023,2024,2025
 *
 * Returns:
 *  - incidents: all incidents for selected years (all columns needed by client)
 *  - manHourRows: raw manhours per year+month for client-side rate computation
 *  - injuredPersons: person-level injured data
 *  - injuredIncidentMap: incident_no -> { year, work_related, incident_type }
 *
 * Client computes summary/liveStats/rates/charts from this data.
 * This way toggling workRelatedOnly or switching category tabs needs NO re-fetch.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const yearsParam = searchParams.get('years');

    if (!companyId || !yearsParam) {
      return NextResponse.json({ error: 'Missing companyId or years' }, { status: 400 });
    }

    const years = yearsParam.split(',').map(Number).filter(y => !isNaN(y));
    if (years.length === 0) {
      return NextResponse.json({ error: 'Invalid years' }, { status: 400 });
    }

    // Run all 3 queries in parallel
    const [incidentsResult, manHoursResult, injuredResult] = await Promise.all([
      // 1. All incidents for selected years
      supabase
        .from('incidents')
        .select('*')
        .eq('company_id', companyId)
        .in('year', years)
        .order('incident_date', { ascending: false }),

      // 2. Man-hours rows for selected years
      supabase
        .from('man_hours')
        .select('year, month, employee_manhours, contractor_manhours, employee_count, contractor_count')
        .eq('company_id', companyId)
        .in('year', years)
        .order('year', { ascending: true })
        .order('month', { ascending: true }),

      // 3. Injured persons (two-step: get incident_nos first, then persons)
      (async () => {
        const { data: incidentMeta, error: metaErr } = await supabase
          .from('incidents')
          .select('incident_no, year, work_related, incident_type')
          .eq('company_id', companyId)
          .in('year', years);

        if (metaErr || !incidentMeta || incidentMeta.length === 0) {
          return { persons: [], incidentMap: {} };
        }

        const incidentNos = incidentMeta.map(i => i.incident_no);

        // Build incident map
        const incidentMap: Record<string, { year: number; work_related: string; incident_type: string }> = {};
        for (const inc of incidentMeta) {
          incidentMap[inc.incident_no] = {
            year: inc.year,
            work_related: inc.work_related || '',
            incident_type: inc.incident_type || '',
          };
        }

        // Fetch injured persons in batches (Supabase .in() limit)
        const BATCH_SIZE = 200;
        const allPersons: Record<string, unknown>[] = [];
        for (let i = 0; i < incidentNos.length; i += BATCH_SIZE) {
          const batch = incidentNos.slice(i, i + BATCH_SIZE);
          const { data: persons } = await supabase
            .from('injured_persons')
            .select('incident_no, person_type, injury_severity, nature_of_injury, body_part, body_side, is_lti, lost_work_days')
            .in('incident_no', batch);
          if (persons) allPersons.push(...persons);
        }

        return { persons: allPersons, incidentMap };
      })(),
    ]);

    if (incidentsResult.error) {
      return NextResponse.json({ error: incidentsResult.error.message }, { status: 500 });
    }
    if (manHoursResult.error) {
      return NextResponse.json({ error: manHoursResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      incidents: incidentsResult.data || [],
      manHourRows: manHoursResult.data || [],
      injuredPersons: injuredResult.persons,
      injuredIncidentMap: injuredResult.incidentMap,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
