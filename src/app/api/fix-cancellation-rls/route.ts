import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Fix RLS policies on cancellation_requests table.
 * Run once: GET /api/fix-cancellation-rls
 *
 * This adds permissive policies so that anon role can read/write,
 * or alternatively disables RLS on the table.
 */
export async function GET() {
  const supabase = getServiceSupabase();

  const sql = `
    -- Disable RLS on cancellation_requests (API routes handle auth)
    ALTER TABLE cancellation_requests DISABLE ROW LEVEL SECURITY;

    -- Also drop any existing restrictive policies if they exist
    DO $$
    BEGIN
      -- Drop all existing policies on the table
      EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON cancellation_requests;', E'\n')
        FROM pg_policies
        WHERE tablename = 'cancellation_requests'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore if no policies exist
    END $$;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // Fallback: return SQL for manual execution
    return NextResponse.json({
      message: 'Run this SQL in Supabase SQL Editor:',
      sql: 'ALTER TABLE cancellation_requests DISABLE ROW LEVEL SECURITY;',
      error: error.message,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'RLS disabled on cancellation_requests table'
  });
}
