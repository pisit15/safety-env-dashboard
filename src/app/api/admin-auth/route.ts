import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback admin password (used when no admin_accounts table or no accounts exist)
const FALLBACK_PASSWORD = process.env.ADMIN_PASSWORD || 'eaadmin2026';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Try admin_accounts table first
    try {
      const { data: admins, error } = await getSupabase()
        .from('admin_accounts')
        .select('*')
        .eq('is_active', true);

      if (!error && admins && admins.length > 0) {
        // Find matching admin by username+password
        const matched = admins.find(
          (a: { username: string; password: string }) =>
            a.username === (username || '') && a.password === password
        );
        if (matched) {
          return NextResponse.json({
            success: true,
            role: matched.role || 'admin',
            adminName: matched.display_name || matched.username,
          });
        }

        // Also allow login with password-only (for backward compatibility)
        // Only if username is empty and password matches any admin
        if (!username) {
          const pwMatch = admins.find(
            (a: { password: string }) => a.password === password
          );
          if (pwMatch) {
            return NextResponse.json({
              success: true,
              role: pwMatch.role || 'admin',
              adminName: pwMatch.display_name || pwMatch.username,
            });
          }
        }

        return NextResponse.json({ success: false, error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
      }
    } catch {
      // Table doesn't exist yet — fall through to fallback
    }

    // Fallback: single password mode
    if (password === FALLBACK_PASSWORD) {
      return NextResponse.json({ success: true, role: 'admin', adminName: 'Super Admin' });
    }

    return NextResponse.json({ success: false, error: 'รหัสผ่าน Admin ไม่ถูกต้อง' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET — list all admin accounts
export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('admin_accounts')
      .select('*')
      .order('created_at');

    if (error) {
      return NextResponse.json({ admins: [] });
    }
    return NextResponse.json({ admins: data || [] });
  } catch {
    return NextResponse.json({ admins: [] });
  }
}

// PUT — update admin account
export async function PUT(request: Request) {
  try {
    const { id, username, password, displayName, role, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updates.username = username;
    if (password !== undefined) updates.password = password;
    if (displayName !== undefined) updates.display_name = displayName;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive;

    const { error } = await getSupabase()
      .from('admin_accounts')
      .update(updates)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — remove admin account
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await getSupabase()
    .from('admin_accounts')
    .delete()
    .eq('id', parseInt(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
