import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client for browser-side use
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Server-side helpers (cache-safe for Next.js App Router) ──────────
// Next.js Data Cache can cache fetch() calls made by Supabase client.
// These helpers set cache:'no-store' to always read fresh from DB.

const noStoreFetch = (url: RequestInfo | URL, options?: RequestInit) =>
  fetch(url, { ...options, cache: 'no-store' as RequestCache });

/** Anon-key Supabase client — respects RLS, no caching */
export function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: noStoreFetch },
  });
}

/** Service-role Supabase client — bypasses RLS, no caching */
export function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    global: { fetch: noStoreFetch },
  });
}

// Types for our tables
export interface CompanyAuth {
  company_id: string;
  company_name: string;
  password: string;
}

export interface StatusOverride {
  id?: number;
  company_id: string;
  plan_type: 'safety' | 'environment';
  activity_no: string;
  month: string;
  status: string;
  note: string;
  updated_by: string;
  updated_at?: string;
}
