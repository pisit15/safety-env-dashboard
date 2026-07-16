import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Reference lists for waste entry form: disposal companies + waste types (seeded from Amita DATA sheet)
export async function GET() {
  try {
    const db = getSupabase();
    const [comps, types] = await Promise.all([
      db.from('waste_ref_companies').select('*').order('name', { ascending: true }),
      db.from('waste_ref_types').select('*').order('name_th', { ascending: true }),
    ]);
    if (comps.error) throw comps.error;
    if (types.error) throw types.error;
    return NextResponse.json({ companies: comps.data || [], types: types.data || [] });
  } catch (error) {
    console.error('Error fetching waste refs:', error);
    return NextResponse.json({ error: 'Failed to fetch waste references' }, { status: 500 });
  }
}
