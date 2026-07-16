import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { WasteTargetInput } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?companyId= (optional; omit = all rows)
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    const db = getSupabase();
    let query = db.from('waste_targets').select('*');
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query.order('company_id', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ targets: data || [] });
  } catch (error) {
    console.error('Error fetching waste targets:', error);
    return NextResponse.json({ error: 'Failed to fetch waste targets' }, { status: 500 });
  }
}

// PUT (upsert by company_id)
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as WasteTargetInput;
    if (!body.company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    const db = getSupabase();
    const { data, error } = await db.from('waste_targets')
      .upsert([{ ...body, updated_at: new Date().toISOString() }], { onConflict: 'company_id' })
      .select();
    if (error) throw error;
    return NextResponse.json({ target: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to save waste target', detail: msg }, { status: 500 });
  }
}
