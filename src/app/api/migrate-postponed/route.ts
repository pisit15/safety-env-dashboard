import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = getServiceSupabase();

  // Check if column already exists by trying to select it
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/status_overrides?select=postponed_to_month&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });

  if (checkRes.ok) {
    return NextResponse.json({ status: 'column_exists', message: 'postponed_to_month column already exists' });
  }

  // Column doesn't exist — create a helper function first, then use it
  // Try approach: use supabase-js to call a raw SQL function
  const sqlQuery = 'ALTER TABLE status_overrides ADD COLUMN IF NOT EXISTS postponed_to_month TEXT;';

  // Approach 1: Try creating and calling the function via RPC
  const createFnRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: sqlQuery }),
  });

  if (createFnRes.ok) {
    return NextResponse.json({ status: 'success', message: 'Column added via RPC' });
  }

  // Approach 2: Use the Supabase Management API (requires access token, not service key)
  // This won't work from API route, so try a workaround:
  // Create a temporary table entry that forces PostgREST to refresh schema

  // Approach 3: Use pg-meta API endpoint
  const pgMetaRes = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sqlQuery }),
  });

  if (pgMetaRes.ok) {
    return NextResponse.json({ status: 'success', message: 'Column added via pg-meta' });
  }

  // Approach 4: Use raw postgres via supabase.sql (available in newer supabase-js)
  try {
    // @ts-expect-error - sql method may not exist in type defs
    const { error } = await supabase.sql`ALTER TABLE status_overrides ADD COLUMN IF NOT EXISTS postponed_to_month TEXT`;
    if (!error) {
      return NextResponse.json({ status: 'success', message: 'Column added via supabase.sql' });
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    status: 'needs_manual_migration',
    message: 'Please run this SQL in Supabase SQL Editor: ALTER TABLE status_overrides ADD COLUMN IF NOT EXISTS postponed_to_month TEXT;',
    sql: sqlQuery,
  });
}
