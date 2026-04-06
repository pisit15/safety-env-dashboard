import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Use Supabase REST API to run SQL via pg_catalog approach
  // First try: query the column to see if it exists
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/training_plans?select=is_active&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });

  if (checkRes.ok) {
    return NextResponse.json({ status: 'column_exists', message: 'is_active column already exists' });
  }

  // Column doesn't exist - try to add it via PostgREST RPC or raw SQL
  // Use the Supabase Management API
  const projectRef = 'wdjhsalkmjbrujqzqllu';

  // Try via supabase management API with access token from dashboard
  const sqlQuery = 'ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;';

  // Try direct SQL via PostgREST rpc
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
    return NextResponse.json({ status: 'success', message: 'Column added via RPC' });
  }

  return NextResponse.json({
    status: 'needs_manual_migration',
    message: 'Please run this SQL in Supabase SQL Editor',
    sql: sqlQuery,
    checkStatus: checkRes.status,
    checkBody: await checkRes.text().catch(() => 'n/a'),
  });
}
