import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Check if column already exists
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/status_overrides?select=postponed_to_month&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });

  if (checkRes.ok) {
    return NextResponse.json({ status: 'column_exists', message: 'postponed_to_month column already exists' });
  }

  // Try to add via RPC
  const sqlQuery = 'ALTER TABLE status_overrides ADD COLUMN IF NOT EXISTS postponed_to_month TEXT;';

  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: sqlQuery }),
  });

  if (rpcRes.ok) {
    return NextResponse.json({ status: 'success', message: 'Column postponed_to_month added via RPC' });
  }

  return NextResponse.json({
    status: 'needs_manual_migration',
    message: 'Please run this SQL in Supabase SQL Editor',
    sql: sqlQuery,
  });
}
