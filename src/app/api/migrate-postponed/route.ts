import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Use Supabase's pg endpoint to run raw SQL
    const sql = `
      ALTER TABLE training_sessions
      ADD COLUMN IF NOT EXISTS postponed_to_month integer DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS original_planned_month integer DEFAULT NULL;
    `;

    const res = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // If rpc doesn't work, try the pg query endpoint
    if (!res.ok) {
      const pgRes = await fetch(`${url}/pg/query`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (pgRes.ok) {
        const data = await pgRes.json();
        return NextResponse.json({ success: true, method: 'pg', data });
      }

      // Last resort: try via supabase management
      return NextResponse.json({
        success: false,
        message: 'Could not run migration automatically. Please run this SQL manually in Supabase SQL Editor:',
        sql: sql.trim(),
      });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, method: 'rpc', data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
