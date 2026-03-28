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
    const { companyId, password } = await request.json();

    if (!companyId || !password) {
      return NextResponse.json({ error: 'Missing companyId or password' }, { status: 400 });
    }

    // Try new company_credentials table first
    const { data: cred, error: credErr } = await getSupabase()
      .from('company_credentials')
      .select('company_id, username, password, is_active')
      .eq('company_id', companyId)
      .single();

    if (!credErr && cred) {
      // Found in new table
      if (!cred.is_active) {
        return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
      }
      if (cred.password !== password) {
        return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }
      const company = getCompanyById(companyId);
      const token = Buffer.from(`${companyId}:${Date.now()}`).toString('base64');
      return NextResponse.json({
        success: true,
        companyId: cred.company_id,
        companyName: company?.name || cred.username.toUpperCase(),
        token,
      });
    }

    // Fallback: try old company_auth table
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
      token,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
