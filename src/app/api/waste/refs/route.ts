import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABLES = { company: 'waste_ref_companies', type: 'waste_ref_types' } as const;
type RefKind = keyof typeof TABLES;

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

// POST { kind: 'company', name, code } | { kind: 'type', name_th, name_en }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as RefKind;
    if (!TABLES[kind]) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    const db = getSupabase();
    if (kind === 'company') {
      if (!body.name?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อบริษัท' }, { status: 400 });
      const { data, error } = await db.from('waste_ref_companies')
        .insert([{ name: String(body.name).trim(), code: String(body.code || '').trim() }]).select();
      if (error) throw error;
      return NextResponse.json({ item: data[0] }, { status: 201 });
    }
    if (!body.name_th?.trim()) return NextResponse.json({ error: 'กรุณากรอกชนิดขยะ (ไทย)' }, { status: 400 });
    const { data, error } = await db.from('waste_ref_types')
      .insert([{ name_th: String(body.name_th).trim(), name_en: String(body.name_en || '').trim() }]).select();
    if (error) throw error;
    return NextResponse.json({ item: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to add reference', detail: msg }, { status: 500 });
  }
}

// PUT { kind, id, ...fields }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as RefKind;
    if (!TABLES[kind] || !body.id) return NextResponse.json({ error: 'Invalid kind or missing id' }, { status: 400 });
    const db = getSupabase();
    const fields = kind === 'company'
      ? { name: String(body.name || '').trim(), code: String(body.code || '').trim() }
      : { name_th: String(body.name_th || '').trim(), name_en: String(body.name_en || '').trim() };
    if (!(kind === 'company' ? fields.name : (fields as { name_th?: string }).name_th)) {
      return NextResponse.json({ error: 'ชื่อห้ามว่าง' }, { status: 400 });
    }
    const { data, error } = await db.from(TABLES[kind]).update(fields).eq('id', body.id).select();
    if (error) throw error;
    return NextResponse.json({ item: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update reference', detail: msg }, { status: 500 });
  }
}

// DELETE ?kind=company|type&id=
export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const kind = sp.get('kind') as RefKind;
    const id = sp.get('id');
    if (!TABLES[kind] || !id) return NextResponse.json({ error: 'Invalid kind or missing id' }, { status: 400 });
    const db = getSupabase();
    const { error } = await db.from(TABLES[kind]).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete reference', detail: msg }, { status: 500 });
  }
}
