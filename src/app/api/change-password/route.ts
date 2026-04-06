import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * POST — Self-service change password
 * Body: { companyId, username, currentPassword, newPassword }
 * Validates current password before allowing change.
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, username, currentPassword, newPassword } = await request.json();

    if (!companyId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสเดิม' }, { status: 400 });
    }

    const supabase = getSupabase();

    // ── 1. Try company_users table first ──
    try {
      let query = supabase
        .from('company_users')
        .select('id, company_id, username, password, is_active')
        .eq('company_id', companyId);

      if (username) {
        query = query.eq('username', username);
      }

      const { data: users, error: usersErr } = await query;

      if (!usersErr && users && users.length > 0) {
        const matched = users.find((u: any) => u.password === currentPassword);
        if (!matched) {
          return NextResponse.json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 401 });
        }
        if (!matched.is_active) {
          return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
        }

        // Update password
        const { error: updateErr } = await supabase
          .from('company_users')
          .update({ password: newPassword, updated_at: new Date().toISOString() })
          .eq('id', matched.id);

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
      }
    } catch {
      // Table might not exist — fall through
    }

    // ── 2. Fallback: company_credentials (legacy) ──
    const { data: cred, error: credErr } = await supabase
      .from('company_credentials')
      .select('id, company_id, username, password, is_active')
      .eq('company_id', companyId)
      .single();

    if (!credErr && cred) {
      if (cred.password !== currentPassword) {
        return NextResponse.json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 401 });
      }
      if (!cred.is_active) {
        return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
      }

      const { error: updateErr } = await supabase
        .from('company_credentials')
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq('id', cred.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    }

    return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
