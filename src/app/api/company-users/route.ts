import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET — list users, optionally filtered by companyId
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  let query = getSupabase()
    .from('company_users')
    .select('*')
    .order('company_id')
    .order('display_name');

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;

  if (error) {
    // Table might not exist yet
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ users: [], needsMigration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

// POST — create new company user
export async function POST(request: NextRequest) {
  try {
    const { companyId, username, password, displayName } = await request.json();

    if (!companyId || !username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ (companyId, username, password)' }, { status: 400 });
    }

    // Check for duplicate username within same company
    const { data: existing } = await getSupabase()
      .from('company_users')
      .select('id')
      .eq('company_id', companyId)
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: `Username "${username}" มีอยู่แล้วในบริษัทนี้` }, { status: 409 });
    }

    const { data, error } = await getSupabase()
      .from('company_users')
      .insert({
        company_id: companyId,
        username,
        password,
        display_name: displayName || username,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT — update user
export async function PUT(request: NextRequest) {
  try {
    const { id, username, password, displayName, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updates.username = username;
    if (password !== undefined) updates.password = password;
    if (displayName !== undefined) updates.display_name = displayName;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await getSupabase()
      .from('company_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — remove user
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('company_users')
    .delete()
    .eq('id', Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
