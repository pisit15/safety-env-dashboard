import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Incident classification masters (admin-editable):
 *   events         — เหตุการณ์/การสัมผัส (แกน 1)
 *   sources        — แหล่งที่มา / แหล่งที่มาต้นทาง / ทรัพย์สินที่เสียหาย (แกน 2+4 ใช้ master เดียวกัน)
 *   damage_natures — ลักษณะความเสียหาย (แกน 3)
 */
const TABLES = {
  event: 'incident_ref_events',
  source: 'incident_ref_sources',
  damage_nature: 'incident_ref_damage_natures',
} as const;
type RefKind = keyof typeof TABLES;

export async function GET() {
  try {
    const db = getServiceSupabase();
    const [ev, src, dn] = await Promise.all([
      db.from('incident_ref_events').select('*').order('sort_order', { ascending: true }),
      db.from('incident_ref_sources').select('*').order('sort_order', { ascending: true }),
      db.from('incident_ref_damage_natures').select('*').order('sort_order', { ascending: true }),
    ]);
    if (ev.error) throw ev.error;
    if (src.error) throw src.error;
    if (dn.error) throw dn.error;
    return NextResponse.json({ events: ev.data || [], sources: src.data || [], damage_natures: dn.data || [] });
  } catch (error) {
    console.error('Error fetching incident refs:', error);
    return NextResponse.json({ error: 'Failed to fetch incident references' }, { status: 500 });
  }
}

// POST { kind, name, grp?, sort_order? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as RefKind;
    if (!TABLES[kind]) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: 'กรุณากรอกชื่อรายการ' }, { status: 400 });
    const db = getServiceSupabase();
    const { data, error } = await db.from(TABLES[kind]).insert([{
      name: String(body.name).trim(),
      grp: String(body.grp || '').trim(),
      sort_order: Number(body.sort_order) || 50,
    }]).select();
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
    const db = getServiceSupabase();
    const fields: Record<string, unknown> = {};
    if (body.name !== undefined) fields.name = String(body.name).trim();
    if (body.grp !== undefined) fields.grp = String(body.grp).trim();
    if (body.sort_order !== undefined) fields.sort_order = Number(body.sort_order) || 0;
    if (body.is_active !== undefined) fields.is_active = !!body.is_active;
    const { data, error } = await db.from(TABLES[kind]).update(fields).eq('id', body.id).select();
    if (error) throw error;
    return NextResponse.json({ item: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update reference', detail: msg }, { status: 500 });
  }
}

// DELETE ?kind=&id=
export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const kind = sp.get('kind') as RefKind;
    const id = sp.get('id');
    if (!TABLES[kind] || !id) return NextResponse.json({ error: 'Invalid kind or missing id' }, { status: 400 });
    const { error } = await getServiceSupabase().from(TABLES[kind]).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete reference', detail: msg }, { status: 500 });
  }
}
