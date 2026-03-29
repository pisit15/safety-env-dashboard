import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);

    // First check if columns already exist
    const { error: checkError } = await supabase
      .from('training_sessions')
      .select('postponed_to_month')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({ success: true, message: 'Columns already exist' });
    }

    // Try adding columns via Supabase Management API
    // Extract project ref from URL
    const ref = url.replace('https://', '').replace('.supabase.co', '');

    // Try the database query endpoint (requires service_role)
    const endpoints = [
      `${url}/pg/query`,
      `${url}/rest/v1/rpc/exec_sql`,
    ];

    const sql = `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS postponed_to_month integer DEFAULT NULL, ADD COLUMN IF NOT EXISTS original_planned_month integer DEFAULT NULL;`;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        });
        if (res.ok) {
          return NextResponse.json({ success: true, method: endpoint, ref });
        }
      } catch {
        continue;
      }
    }

    // If none worked, return SQL for manual execution
    return NextResponse.json({
      success: false,
      message: 'Auto-migration failed. Please run SQL manually in Supabase SQL Editor.',
      sql,
      ref,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
