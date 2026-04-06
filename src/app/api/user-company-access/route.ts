import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * GET — List multi-company access mappings
 * ?masterUsername=xxx&masterCompanyId=yyy — get all companies this user can access
 * ?accessCompanyId=zzz — get all users who can access this company
 * (no params) — get all mappings
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const masterUsername = searchParams.get('masterUsername');
  const masterCompanyId = searchParams.get('masterCompanyId');
  const accessCompanyId = searchParams.get('accessCompanyId');

  let query = getSupabase()
    .from('user_company_access')
    .select('*')
    .eq('is_active', true)
    .order('master_username')
    .order('access_company_id');

  if (masterUsername && masterCompanyId) {
    query = query.eq('master_username', masterUsername).eq('master_company_id', masterCompanyId);
  } else if (accessCompanyId) {
    query = query.eq('access_company_id', accessCompanyId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ mappings: [], needsSetup: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mappings: data || [] });
}

/**
 * POST — Add multi-company access mapping
 * Body: { masterUsername, masterCompanyId, accessCompanyId, displayName? }
 */
export async function POST(request: NextRequest) {
  try {
    const { masterUsername, masterCompanyId, accessCompanyId, displayName } = await request.json();

    if (!masterUsername || !masterCompanyId || !accessCompanyId) {
      return NextResponse.json({ error: 'กรุณากรอก masterUsername, masterCompanyId, accessCompanyId' }, { status: 400 });
    }

    if (masterCompanyId === accessCompanyId) {
      return NextResponse.json({ error: 'ไม่ต้องเพิ่มบริษัทเดียวกันกับต้นทาง' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('user_company_access')
      .insert({
        master_username: masterUsername,
        master_company_id: masterCompanyId,
        access_company_id: accessCompanyId,
        display_name: displayName || '',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ error: 'การเข้าถึงนี้มีอยู่แล้ว' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE — Remove multi-company access mapping
 * ?id=123
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('user_company_access')
    .delete()
    .eq('id', Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
