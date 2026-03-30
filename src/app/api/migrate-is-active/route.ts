import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Try to add is_active column — if it already exists, this will fail silently
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;`
  });

  if (error) {
    // Try direct approach
    const { error: error2 } = await supabase
      .from('training_plans')
      .update({ is_active: true })
      .eq('is_active', true);

    if (error2 && error2.message.includes('is_active')) {
      return NextResponse.json({
        status: 'needs_manual_migration',
        message: 'Please run this SQL in Supabase Dashboard: ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;',
        error: error.message,
      });
    }

    return NextResponse.json({ status: 'column_likely_exists', note: error2?.message || 'OK' });
  }

  return NextResponse.json({ status: 'success', message: 'is_active column added' });
}
