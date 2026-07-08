import { getSupabase } from '@/lib/supabase';

/**
 * Best-effort login event logging — never throws, never blocks login.
 */
export async function logLogin(e: {
  username: string;
  displayName?: string | null;
  companyId?: string | null;
  role: 'admin' | 'company';
  userAgent?: string | null;
}): Promise<void> {
  try {
    await getSupabase().from('login_events').insert({
      username: e.username || '(unknown)',
      display_name: e.displayName || null,
      company_id: e.companyId || null,
      role: e.role,
      user_agent: e.userAgent ? e.userAgent.slice(0, 300) : null,
    });
  } catch {
    // ignore — logging must never break authentication
  }
}
