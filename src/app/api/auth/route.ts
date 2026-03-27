import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const { data, error } = await getSupabase()
      .from('company_auth')
      .select('company_id, company_name, password')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Company not found' }, { status: 401 });
    }

    if (data.password !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Return a simple session token (company_id based)
    const token = Buffer.from(`${companyId}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      companyId: data.company_id,
      companyName: data.company_name,
      token,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
