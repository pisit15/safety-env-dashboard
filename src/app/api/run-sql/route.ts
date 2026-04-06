import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Use DATABASE_URL or construct from Supabase project
  const databaseUrl = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    // Try constructing from Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!projectRef || !serviceKey) {
      return NextResponse.json({
        error: 'No DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY configured',
        hint: 'Add DATABASE_URL to Vercel env vars. Find it in Supabase → Settings → Database → Connection string (URI)',
        available_env: {
          has_DATABASE_URL: !!process.env.DATABASE_URL,
          has_POSTGRES_URL: !!process.env.POSTGRES_URL,
          has_SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL,
          has_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'not set',
        }
      }, { status: 500 });
    }

    // Try using Supabase Management API with service role key
    // POST to /pg/query endpoint
    try {
      const body = await request.json();
      const sql = body.sql;
      if (!sql) return NextResponse.json({ error: 'Missing sql in body' }, { status: 400 });

      const res = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ success: true, data, method: 'pg_query' });
      }

      const errText = await res.text();
      return NextResponse.json({
        error: 'pg/query failed',
        status: res.status,
        detail: errText
      }, { status: 500 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Use pg Pool with DATABASE_URL
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const body = await request.json();
    const sql = body.sql;
    if (!sql) return NextResponse.json({ error: 'Missing sql in body' }, { status: 400 });

    const result = await pool.query(sql);
    return NextResponse.json({ success: true, rowCount: result.rowCount, method: 'pg_direct' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, method: 'pg_direct' }, { status: 500 });
  } finally {
    await pool.end();
  }
}
