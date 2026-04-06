import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Check if column exists
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/company_employees?select=employment_status&limit=1`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
  });

  if (checkRes.ok) {
    return NextResponse.json({ status: 'column_exists', message: 'employment_status column already exists' });
  }

  const sqlQuery = "ALTER TABLE company_employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'active';";

  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: sqlQuery }),
  });

  if (rpcRes.ok) {
    return NextResponse.json({ status: 'success', message: 'Column added via RPC' });
  }

  return NextResponse.json({
    status: 'needs_manual_migration',
    message: 'Please run this SQL in Supabase SQL Editor',
    sql: sqlQuery,
  });
}
