import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Setup endpoint to create the cancellation_requests table.
 * Run once: GET /api/setup-cancellation-requests
 */
export async function GET() {
  const supabase = getServiceSupabase();

  // Try creating the table using raw SQL via rpc
  const sql = `
    CREATE TABLE IF NOT EXISTS cancellation_requests (
      id SERIAL PRIMARY KEY,
      company_id TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      activity_no TEXT NOT NULL,
      month TEXT NOT NULL,
      requested_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_by TEXT NOT NULL DEFAULT '',
      status TEXT DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cancel_req_company ON cancellation_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_cancel_req_status ON cancellation_requests(status);
    CREATE INDEX IF NOT EXISTS idx_cancel_req_pending ON cancellation_requests(status) WHERE status = 'pending';
  `;

  // Try via rpc first
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // rpc might not exist — return SQL for manual execution
    return NextResponse.json({
      message: 'Run this SQL in Supabase SQL Editor:',
      sql,
      error: error.message,
    });
  }

  return NextResponse.json({ success: true, message: 'cancellation_requests table created' });
}
