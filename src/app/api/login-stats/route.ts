import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface UserStat {
  username: string;
  displayName: string;
  companyId: string | null;
  role: 'admin' | 'company';
  isActive: boolean;
  loginCount: number;
  lastLogin: string | null;
}

/**
 * GET — login statistics for the admin settings page.
 *
 * No params: per-user summary across all known users (company_users + admin_accounts),
 * including users who have never logged in.
 *
 * ?username=&companyId= : last 50 events for one user — logins from login_events
 * merged with actions from audit_log (performed_by), newest first.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const username = sp.get('username');
  const sb = getSupabase();

  // ── Detail mode: recent activity for one user ──
  if (username) {
    const companyId = sp.get('companyId');

    let loginQ = sb.from('login_events')
      .select('username, display_name, company_id, role, created_at')
      .eq('username', username)
      .order('created_at', { ascending: false })
      .limit(50);
    if (companyId) loginQ = loginQ.eq('company_id', companyId);

    let auditQ = sb.from('audit_log')
      .select('company_id, plan_type, action, activity_no, month, new_value, note, performed_by, created_at')
      .eq('performed_by', username)
      .order('created_at', { ascending: false })
      .limit(50);

    const [loginRes, auditRes] = await Promise.all([loginQ, auditQ]);

    const events = [
      ...(loginRes.data || []).map(e => ({
        type: 'login' as const,
        companyId: e.company_id as string | null,
        detail: '',
        createdAt: e.created_at as string,
      })),
      ...(auditRes.data || []).map(e => ({
        type: 'action' as const,
        companyId: e.company_id as string | null,
        action: e.action as string,
        planType: (e.plan_type as string) || null,
        activityNo: (e.activity_no as string) || null,
        month: (e.month as string) || null,
        detail: (e.note as string) || (e.new_value as string) || '',
        createdAt: e.created_at as string,
      })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 50);

    return NextResponse.json({ username, events });
  }

  // ── Summary mode: all users with login counts ──
  const [usersRes, adminsRes, eventsRes] = await Promise.all([
    sb.from('company_users').select('company_id, username, display_name, is_active'),
    sb.from('admin_accounts').select('username, display_name, is_active'),
    sb.from('login_events').select('username, company_id, role, created_at'),
  ]);

  const stats: Record<string, UserStat> = {};
  const keyOf = (u: string, c: string | null) => `${u}|${c || ''}`;

  (usersRes.data || []).forEach((u: { company_id: string; username: string; display_name: string | null; is_active: boolean }) => {
    stats[keyOf(u.username, u.company_id)] = {
      username: u.username, displayName: u.display_name || u.username,
      companyId: u.company_id, role: 'company', isActive: u.is_active !== false,
      loginCount: 0, lastLogin: null,
    };
  });
  (adminsRes.data || []).forEach((a: { username: string; display_name: string | null; is_active: boolean }) => {
    stats[keyOf(a.username, null)] = {
      username: a.username, displayName: a.display_name || a.username,
      companyId: null, role: 'admin', isActive: a.is_active !== false,
      loginCount: 0, lastLogin: null,
    };
  });

  (eventsRes.data || []).forEach((e: { username: string; company_id: string | null; role: string; created_at: string }) => {
    const key = e.role === 'admin' ? keyOf(e.username, null) : keyOf(e.username, e.company_id);
    let s = stats[key];
    if (!s) {
      // Login recorded for a user no longer in the user tables — still show it
      s = stats[key] = {
        username: e.username, displayName: e.username,
        companyId: e.role === 'admin' ? null : e.company_id,
        role: e.role === 'admin' ? 'admin' : 'company', isActive: false,
        loginCount: 0, lastLogin: null,
      };
    }
    s.loginCount += 1;
    if (!s.lastLogin || e.created_at > s.lastLogin) s.lastLogin = e.created_at;
  });

  const users = Object.values(stats).sort((a, b) => {
    if (!!a.lastLogin !== !!b.lastLogin) return a.lastLogin ? -1 : 1;
    return (b.lastLogin || '').localeCompare(a.lastLogin || '');
  });

  return NextResponse.json({ users, trackingSince: '2026-07-08' });
}
