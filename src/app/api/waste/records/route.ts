import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { WasteRecordInput } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?companyId=  (or 'all')  &years=2025,2026 (optional)
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = sp.get('companyId') || 'all';
    const years = (sp.get('years') || '').split(',').map(y => parseInt(y)).filter(Boolean);
    const db = getSupabase();

    let query = db.from('waste_records').select('*');
    if (companyId !== 'all') query = query.eq('company_id', companyId);
    if (years.length > 0) {
      const minY = Math.min(...years), maxY = Math.max(...years);
      query = query.gte('record_date', `${minY}-01-01`).lte('record_date', `${maxY}-12-31`);
    }
    const { data, error } = await query.order('record_date', { ascending: false }).limit(20000);
    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    console.error('Error fetching waste records:', error);
    return NextResponse.json({ error: 'Failed to fetch waste records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WasteRecordInput;
    if (!body.company_id || !body.record_date || !body.disposal_method || !body.quantity_kg) {
      return NextResponse.json({ error: 'Missing required fields (company_id, record_date, disposal_method, quantity_kg)' }, { status: 400 });
    }
    const db = getSupabase();
    const { data, error } = await db.from('waste_records').insert([body]).select();
    if (error) throw error;
    return NextResponse.json({ record: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create waste record', detail: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as WasteRecordInput & { id: number };
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { id, ...fields } = body;
    const db = getSupabase();
    const { data, error } = await db.from('waste_records')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id).select();
    if (error) throw error;
    return NextResponse.json({ record: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update waste record', detail: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getSupabase();
    const { error } = await db.from('waste_records').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete waste record', detail: msg }, { status: 500 });
  }
}
