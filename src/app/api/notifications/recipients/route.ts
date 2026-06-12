import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/notifications/recipients?companyId=amt — list recipients
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  let query = getSupabase()
    .from('notification_recipients')
    .select('*')
    .order('company_id')
    .order('responsible_name');

  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipients: data || [] });
}

// POST — add a recipient { companyId, responsibleName, email }
export async function POST(request: NextRequest) {
  try {
    const { companyId, responsibleName, email } = await request.json();
    if (!companyId || !responsibleName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอก บริษัท / ชื่อผู้รับผิดชอบ / อีเมล ให้ครบ' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('notification_recipients')
      .insert({
        company_id: companyId,
        responsible_name: responsibleName.trim(),
        email: email.trim().toLowerCase(),
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'รายชื่อนี้มีอยู่แล้ว' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ recipient: data }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — update { id, responsibleName?, email?, isActive? }
export async function PUT(request: NextRequest) {
  try {
    const { id, responsibleName, email, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (responsibleName !== undefined) updates.responsible_name = String(responsibleName).trim();
    if (email !== undefined) updates.email = String(email).trim().toLowerCase();
    if (isActive !== undefined) updates.is_active = !!isActive;

    const { data, error } = await getSupabase()
      .from('notification_recipients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ recipient: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/notifications/recipients?id=uuid
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await getSupabase()
    .from('notification_recipients')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
