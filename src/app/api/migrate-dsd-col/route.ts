import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Try to add column - if it already exists, the upsert approach won't error
  // We'll test by selecting the column first
  const { data: testData, error: testError } = await supabase
    .from('training_sessions')
    .select('id')
    .limit(1);

  // Try updating a row with dsd_not_submitting to see if column exists
  const { error: updateError } = await supabase
    .from('training_sessions')
    .update({ dsd_not_submitting: false })
    .eq('id', '00000000-0000-0000-0000-000000000000'); // non-existent ID, just testing column

  if (updateError?.message?.includes('dsd_not_submitting')) {
    // Column doesn't exist - need to create via raw SQL
    // Since we can't run DDL via PostgREST, return SQL for manual execution
    return NextResponse.json({
      exists: false,
      message: 'Column dsd_not_submitting does not exist yet',
      sql: 'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS dsd_not_submitting boolean DEFAULT false;',
      error: updateError.message,
    });
  }

  return NextResponse.json({
    exists: true,
    message: 'Column dsd_not_submitting is ready (or update had no matching rows, which is expected)',
    testRows: testData?.length,
  });
}
