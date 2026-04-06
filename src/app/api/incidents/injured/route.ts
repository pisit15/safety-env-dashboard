import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET — fetch injured persons by incident_no
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const incidentNo = searchParams.get('incident_no');

    if (!incidentNo) {
      return NextResponse.json({ error: 'Missing incident_no' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('injured_persons')
      .select('*')
      .eq('incident_no', incidentNo)
      .order('person_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ persons: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
