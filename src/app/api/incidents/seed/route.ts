import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for this endpoint

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get('confirm');

  if (confirm !== 'yes') {
    return NextResponse.json({
      message: 'Add ?confirm=yes to actually run the import.',
      info: 'This will upsert 736 incidents and 135 injured persons from import-data.json',
      warning: 'Make sure the tables are created first via /api/setup-incidents',
    });
  }

  const supabase = getServiceSupabase();
  const results: string[] = [];

  try {
    // Check if incidents table exists
    const { error: checkErr } = await supabase.from('incidents').select('id').limit(1);
    if (checkErr) {
      return NextResponse.json({
        error: 'incidents table does not exist. Run the SQL from /api/setup-incidents first.',
        detail: checkErr.message,
      }, { status: 400 });
    }

    // Fetch import data from public folder
    const baseUrl = request.nextUrl.origin;
    const dataRes = await fetch(`${baseUrl}/import-data.json`);
    if (!dataRes.ok) {
      return NextResponse.json({ error: 'Could not fetch /import-data.json' }, { status: 500 });
    }
    const importData = await dataRes.json();
    const incidents = importData.incidents || [];
    const injuredPersons = importData.injured_persons || [];

    results.push(`Found ${incidents.length} incidents and ${injuredPersons.length} injured persons`);

    // Import incidents in batches
    const batchSize = 50;
    let insertedIncidents = 0;
    for (let i = 0; i < incidents.length; i += batchSize) {
      const batch = incidents.slice(i, i + batchSize);
      const { error } = await supabase.from('incidents').upsert(batch, { onConflict: 'incident_no' });
      if (error) {
        results.push(`Incidents batch ${i}-${i + batch.length}: ERROR - ${error.message}`);
      } else {
        insertedIncidents += batch.length;
      }
    }
    results.push(`Inserted/updated ${insertedIncidents} incidents`);

    // Delete existing injured persons to avoid duplicates, then re-insert
    if (injuredPersons.length > 0) {
      const incNos = Array.from(new Set(injuredPersons.map((p: { incident_no: string }) => p.incident_no)));
      for (const no of incNos) {
        await supabase.from('injured_persons').delete().eq('incident_no', no);
      }

      let insertedPersons = 0;
      for (let i = 0; i < injuredPersons.length; i += batchSize) {
        const batch = injuredPersons.slice(i, i + batchSize);
        const { error } = await supabase.from('injured_persons').insert(batch);
        if (error) {
          results.push(`Injured persons batch ${i}-${i + batch.length}: ERROR - ${error.message}`);
        } else {
          insertedPersons += batch.length;
        }
      }
      results.push(`Inserted ${insertedPersons} injured persons`);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage, results }, { status: 500 });
  }
}
