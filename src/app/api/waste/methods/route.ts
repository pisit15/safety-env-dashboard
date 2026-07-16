import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { WasteMethodInput } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = getSupabase();
    const { data, error } = await db.from('waste_methods').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ methods: data || [] });
  } catch (error) {
    console.error('Error fetching waste methods:', error);
    return NextResponse.json({ error: 'Failed to fetch waste methods' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WasteMethodInput;
    if (!body.method_name?.trim()) {
      return NextResponse.json({ error: 'Missing method_name' }, { status: 400 });
    }
    const db = getSupabase();
    const { data, error } = await db.from('waste_methods').insert([{
      method_name: body.method_name.trim(),
      is_recycle: body.is_recycle ?? false,
      sort_order: body.sort_order ?? 99,
    }]).select();
    if (error) throw error;
    return NextResponse.json({ method: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create method', detail: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as WasteMethodInput & { id: number };
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { id, ...fields } = body;
    const db = getSupabase();
    const { data, error } = await db.from('waste_methods').update(fields).eq('id', id).select();
    if (error) throw error;
    return NextResponse.json({ method: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update method', detail: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getSupabase();
    // Soft-guard: block delete if records reference this method
    const { data: m } = await db.from('waste_methods').select('method_name').eq('id', id).single();
    if (m) {
      const { count } = await db.from('waste_records').select('id', { count: 'exact', head: true }).eq('disposal_method', m.method_name);
      if ((count || 0) > 0) {
        return NextResponse.json({ error: `มีบันทึก ${count} รายการใช้วิธีนี้อยู่ — ปิดการใช้งาน (inactive) แทนการลบ` }, { status: 400 });
      }
    }
    const { error } = await db.from('waste_methods').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to delete method', detail: msg }, { status: 500 });
  }
}
