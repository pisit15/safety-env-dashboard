import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// POST — bulk import incidents
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { incidents, injured_persons } = body;

    if (!incidents || !Array.isArray(incidents)) {
      return NextResponse.json({ error: 'Missing incidents array' }, { status: 400 });
    }

    let insertedIncidents = 0;
    let insertedPersons = 0;
    let errors: string[] = [];

    // Insert incidents in batches of 100
    const batchSize = 100;
    for (let i = 0; i < incidents.length; i += batchSize) {
      const batch = incidents.slice(i, i + batchSize);
      const { error } = await supabase.from('incidents').upsert(batch, { onConflict: 'incident_no' });
      if (error) {
        errors.push(`incidents batch ${i}-${i + batch.length}: ${error.message}`);
      } else {
        insertedIncidents += batch.length;
      }
    }

    // Insert injured persons if provided
    if (injured_persons && Array.isArray(injured_persons) && injured_persons.length > 0) {
      for (let i = 0; i < injured_persons.length; i += batchSize) {
        const batch = injured_persons.slice(i, i + batchSize);
        const { error } = await supabase.from('injured_persons').insert(batch);
        if (error) {
          errors.push(`injured_persons batch ${i}-${i + batch.length}: ${error.message}`);
        } else {
          insertedPersons += batch.length;
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      insertedIncidents,
      insertedPersons,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
