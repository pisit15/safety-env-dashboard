import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  const results: Record<string, string> = {};

  // Test if near_miss_reports table exists
  const { error: testErr } = await supabase.from('near_miss_reports').select('id').limit(1);
  if (testErr && testErr.message.includes('does not exist')) {
    return NextResponse.json({
      status: 'table_missing',
      message: 'near_miss_reports table does not exist',
      sql: getCreateTableSQL(),
    });
  }
  results.near_miss_reports = 'exists';

  // Check each column that the API needs
  const columnsToCheck = [
    'incident_time',
    'saving_factor',
    'notified_persons',
    'suggested_action',
    'submitter_ip',
    'form_duration_ms',
    'report_no',
    'is_hidden',
  ];

  const missingColumns: string[] = [];
  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('near_miss_reports')
      .select(col)
      .limit(1);
    if (error && error.message.includes(col)) {
      missingColumns.push(col);
    }
  }

  results.missing_columns = missingColumns.length > 0 ? missingColumns.join(', ') : 'none';

  // Check nearmiss_ip_log table
  const { error: ipLogErr } = await supabase.from('nearmiss_ip_log').select('id').limit(1);
  if (ipLogErr && ipLogErr.message.includes('does not exist')) {
    results.nearmiss_ip_log = 'missing';
    missingColumns.push('__ip_log_table');
  } else {
    results.nearmiss_ip_log = 'exists';
  }

  if (missingColumns.length === 0) {
    return NextResponse.json({ status: 'ok', message: 'All columns exist', results });
  }

  // Auto-fix: run ALTER TABLE for missing columns
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'fix' || action === 'apply') {
    const sqls: string[] = [];

    for (const col of missingColumns) {
      if (col === '__ip_log_table') continue;
      let colDef = 'text';
      if (col === 'form_duration_ms') colDef = 'integer';
      if (col === 'is_hidden') colDef = 'boolean DEFAULT false';
      sqls.push(`ALTER TABLE near_miss_reports ADD COLUMN IF NOT EXISTS ${col} ${colDef};`);
    }

    if (missingColumns.includes('__ip_log_table')) {
      sqls.push(`
        CREATE TABLE IF NOT EXISTS nearmiss_ip_log (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          ip text NOT NULL,
          company_id text,
          created_at timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_nearmiss_ip_log_ip ON nearmiss_ip_log(ip, created_at);
      `);
    }

    // Check if report_no needs a sequence/trigger
    if (missingColumns.includes('report_no')) {
      sqls.push(`
        CREATE OR REPLACE FUNCTION generate_nearmiss_report_no()
        RETURNS TRIGGER AS $$
        DECLARE
          prefix text;
          seq_num integer;
        BEGIN
          prefix := 'NM-' || to_char(NOW(), 'YYYYMM') || '-';
          SELECT COALESCE(MAX(
            CAST(SUBSTRING(report_no FROM length(prefix) + 1) AS integer)
          ), 0) + 1
          INTO seq_num
          FROM near_miss_reports
          WHERE report_no LIKE prefix || '%';
          NEW.report_no := prefix || LPAD(seq_num::text, 4, '0');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_nearmiss_report_no ON near_miss_reports;
        CREATE TRIGGER trg_nearmiss_report_no
        BEFORE INSERT ON near_miss_reports
        FOR EACH ROW
        WHEN (NEW.report_no IS NULL)
        EXECUTE FUNCTION generate_nearmiss_report_no();
      `);
    }

    if (action === 'apply') {
      // Try to execute SQL directly via Supabase Management API
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json({ status: 'error', message: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
      }
      const combinedSql = sqls.join('\n');
      // Use Supabase REST RPC or direct pg endpoint
      const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ sql: combinedSql }),
      });

      if (pgRes.ok) {
        return NextResponse.json({ status: 'applied', message: 'SQL executed successfully', sql: combinedSql, results });
      }

      // If rpc not available, try using the query endpoint
      const pgText = await pgRes.text();
      return NextResponse.json({
        status: 'rpc_failed',
        message: 'exec_sql rpc not available. Run SQL manually in Supabase SQL Editor.',
        rpc_error: pgText,
        sql: combinedSql,
        results,
      });
    }

    return NextResponse.json({
      status: 'fix_required',
      message: 'Run these SQL statements in Supabase SQL Editor, or use ?action=apply to try auto-fix.',
      missing: missingColumns,
      sql: sqls.join('\n\n'),
      results,
    });
  }

  return NextResponse.json({
    status: 'columns_missing',
    message: `Missing columns: ${missingColumns.join(', ')}. Add ?action=fix to get SQL.`,
    missing: missingColumns,
    results,
  });
}

function getCreateTableSQL() {
  return `
CREATE TABLE near_miss_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  report_no text,
  reporter_name text NOT NULL,
  reporter_dept text,
  reporter_phone text,
  incident_date date NOT NULL,
  incident_time text,
  location text NOT NULL,
  incident_description text NOT NULL,
  saving_factor text,
  probability integer NOT NULL CHECK (probability BETWEEN 1 AND 5),
  severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  risk_level text,
  notified_persons text,
  suggested_action text,
  images jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'new',
  coordinator text,
  due_date date,
  admin_notes text,
  submitter_ip text,
  form_duration_ms integer,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_nearmiss_company ON near_miss_reports(company_id);
CREATE INDEX idx_nearmiss_status ON near_miss_reports(status);

CREATE TABLE nearmiss_ip_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  company_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_nearmiss_ip_log_ip ON nearmiss_ip_log(ip, created_at);
  `;
}
