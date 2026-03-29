import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCompanyById } from '@/lib/companies';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, password, username } = await request.json();

    if (!companyId || !password) {
      return NextResponse.json({ error: 'Missing companyId or password' }, { status: 400 });
    }

    const company = getCompanyById(companyId);

    // ── 1. Try company_users table first (multi-user system) ──
    try {
      let query = getSupabase()
        .from('company_users')
        .select('id, company_id, username, password, display_name, is_active')
        .eq('company_id', companyId);

      // If username provided, match by username + password
      // If not, match by password only (backward compatible)
      if (username) {
        query = query.eq('username', username);
      }

      const { data: users, error: usersErr } = await query;

      if (!usersErr && users && users.length > 0) {
        // Find matching user by password
        const matched = users.find((u: any) => u.password === password);
        if (matched) {
          if (!matched.is_active) {
            return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
          }
          const token = Buffer.from(`${companyId}:${matched.username}:${Date.now()}`).toString('base64');
          return NextResponse.json({
            success: true,
            companyId: matched.company_id,
            companyName: company?.name || matched.company_id.toUpperCase(),
            username: matched.username,
            displayName: matched.display_name || matched.username,
            token,
          });
        }
        // Users exist for this company but password didn't match
        return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }
    } catch {
      // Table might not exist — fall through
    }

    // ── 2. Fallback: company_credentials (legacy single-user) ──
    const { data: cred, error: credErr } = await getSupabase()
      .from('company_credentials')
      .select('company_id, username, password, is_active')
      .eq('company_id', companyId)
      .single();

    if (!credErr && cred) {
      if (!cred.is_active) {
        return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
      }
      if (cred.password !== password) {
        return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }
      const token = Buffer.from(`${companyId}:${cred.username}:${Date.now()}`).toString('base64');
      return NextResponse.json({
        success: true,
        companyId: cred.company_id,
        companyName: company?.name || cred.username.toUpperCase(),
        username: cred.username,
        displayName: cred.username,
        token,
      });
    }

    // ── 3. Fallback: old company_auth table ──
    const { data, error } = await getSupabase()
      .from('company_auth')
      .select('company_id, company_name, password')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'ไม่พบบริษัท หรือยังไม่ได้ตั้งค่าบัญชี' }, { status: 401 });
    }

    if (data.password !== password) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const token = Buffer.from(`${companyId}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      companyId: data.company_id,
      companyName: data.company_name,
      username: '',
      displayName: data.company_name,
      token,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
