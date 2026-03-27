import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client for browser-side use
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
