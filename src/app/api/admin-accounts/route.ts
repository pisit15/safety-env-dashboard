import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// POST — create new admin account
export async function POST(request: Request) {
  try {
    const { username, password, displayName, role } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก username และ password' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('admin_accounts')
      .insert({
        username,
        password,
        display_name: displayName || username,
        role: role || 'admin',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ error: 'Username นี้มีอยู่แล้ว' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
