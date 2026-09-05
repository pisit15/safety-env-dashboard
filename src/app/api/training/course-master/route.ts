import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Master รายชื่อหลักสูตรกลาง (Admin จัดการ) — ใช้เป็นต้นแบบให้ทุกบริษัทเลือกทำแผนปี
 * ลำดับ sort_order คือลำดับมาตรฐานที่ทุกบริษัทเรียงเหมือนกัน
 */

// GET ?all=true → รวมที่ปิดใช้งาน (สำหรับหน้า Admin) — default เฉพาะ active
export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get('all') === 'true';
    let query = getSupabase().from('training_course_master').select('*')
      .order('sort_order', { ascending: true }).order('course_name', { ascending: true });
    if (!all) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ courses: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch course master', detail: msg }, { status: 500 });
  }
}

// POST { course_name, category?, default_hours?, in_house_external?, necessity_default?, dsd_eligible?, sort_order? } (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.isAdmin !== true) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    if (!body.course_name?.trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อหลักสูตร' }, { status: 400 });
    const sb = getSupabase();
    let sortOrder = Number(body.sort_order);
    if (!Number.isFinite(sortOrder)) {
      const { data: last } = await sb.from('training_course_master').select('sort_order').order('sort_order', { ascending: false }).limit(1);
      sortOrder = ((last && last[0]?.sort_order) || 0) + 1;
    }
    const { data, error } = await sb.from('training_course_master').insert([{
      course_name: String(body.course_name).trim(),
      category: body.category || 'Mandatory (กฎหมาย / บังคับ)',
      default_hours: Number(body.default_hours) || 6,
      in_house_external: body.in_house_external || 'In-House',
      necessity_default: body.necessity_default || '',
      dsd_eligible: !!body.dsd_eligible,
      sort_order: sortOrder,
    }]).select();
    if (error) throw error;
    return NextResponse.json({ course: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to add course', detail: msg }, { status: 500 });
  }
}

// PUT { id, ...fields } (admin only) — รองรับ swapWith สำหรับสลับลำดับ
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.isAdmin !== true) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    if (!body.id && !body.bulkCategory) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const sb = getSupabase();

    // เปิด/ปิดใช้งานทั้งหมวด
    if (body.bulkCategory && body.is_active !== undefined) {
      const { error } = await sb.from('training_course_master')
        .update({ is_active: !!body.is_active }).eq('category', String(body.bulkCategory));
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // สลับลำดับกับอีกรายการ (ปุ่มเลื่อนขึ้น/ลง)
    if (body.swapWith) {
      const { data: rows, error: selErr } = await sb.from('training_course_master')
        .select('id, sort_order').in('id', [body.id, body.swapWith]);
      if (selErr) throw selErr;
      if (!rows || rows.length !== 2) return NextResponse.json({ error: 'Swap target not found' }, { status: 404 });
      const [a, b] = rows;
      await sb.from('training_course_master').update({ sort_order: b.sort_order }).eq('id', a.id);
      await sb.from('training_course_master').update({ sort_order: a.sort_order }).eq('id', b.id);
      return NextResponse.json({ success: true });
    }

    const fields: Record<string, unknown> = {};
    if (body.course_name !== undefined) fields.course_name = String(body.course_name).trim();
    if (body.category !== undefined) fields.category = String(body.category);
    if (body.default_hours !== undefined) fields.default_hours = Number(body.default_hours) || 0;
    if (body.in_house_external !== undefined) fields.in_house_external = String(body.in_house_external);
    if (body.necessity_default !== undefined) fields.necessity_default = String(body.necessity_default);
    if (body.dsd_eligible !== undefined) fields.dsd_eligible = !!body.dsd_eligible;
    if (body.is_active !== undefined) fields.is_active = !!body.is_active;
    if (body.sort_order !== undefined) fields.sort_order = Number(body.sort_order) || 0;
    const { data, error } = await sb.from('training_course_master').update(fields).eq('id', body.id).select();
    if (error) throw error;
    return NextResponse.json({ course: data[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to update course', detail: msg }, { status: 500 });
  }
}
