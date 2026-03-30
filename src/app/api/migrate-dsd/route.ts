import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const statements = [
    // training_plans: DSD eligible flag
    `ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS dsd_eligible boolean DEFAULT true`,

    // training_sessions: Pre-training fields (ยป.1/ยป.2)
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS instructor_name text`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS training_location text`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS training_method text`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_submitted boolean DEFAULT false`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_submitted_date date`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_approved boolean DEFAULT false`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_approved_date date`,

    // training_sessions: Post-training fields (รง.1)
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS actual_hours numeric DEFAULT 0`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_report_submitted boolean DEFAULT false`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_report_submitted_date date`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_approved_headcount integer DEFAULT 0`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS photos_submitted boolean DEFAULT false`,
    `ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS signin_sheet_submitted boolean DEFAULT false`,
  ];

  const results = [];
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();
    if (error) {
      // Try direct approach for environments without exec_sql
      results.push({ sql: sql.substring(0, 60), error: error.message });
    } else {
      results.push({ sql: sql.substring(0, 60), success: true });
    }
  }

  return NextResponse.json({
    message: 'Please run this SQL in Supabase SQL Editor:',
    sql: statements.join(';\n') + ';',
    results,
  });
}
