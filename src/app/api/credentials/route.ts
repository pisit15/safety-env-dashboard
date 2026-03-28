import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

// GET — list all company credentials (admin only — frontend checks auth)
export async function GET() {
  const { data, error } = await getSupabase()
    .from('company_credentials')
    .select('*')
    .order('company_id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ credentials: data });
}

// POST — create new company credential
export async function POST(request: Request) {
  try {
    const { companyId, username, password } = await request.json();

    if (!companyId || !username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('company_credentials')
      .insert({
        company_id: companyId,
        username,
        password,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ error: 'บริษัทนี้มีบัญชีอยู่แล้ว' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT — update credential
export async function PUT(request: Request) {
  try {
    const { companyId, username, password, isActive } = await request.json();

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updates.username = username;
    if (password !== undefined) updates.password = password;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await getSupabase()
      .from('company_credentials')
      .update(updates)
      .eq('company_id', companyId)
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

// DELETE — remove credential
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('company_credentials')
    .delete()
    .eq('company_id', companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
