import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// POST - Create training_change_log table
export async function POST(request: NextRequest) {
  try {
    // Note: Table creation should be done via Supabase migrations
    // This endpoint documents the expected schema
    const schema = {
      table_name: 'training_change_log',
      columns: [
        { name: 'id', type: 'uuid', default: 'gen_random_uuid()', primary_key: true },
        { name: 'session_id', type: 'uuid', references: 'training_sessions(id)' },
        { name: 'plan_id', type: 'uuid', references: 'training_plans(id)' },
        { name: 'company_id', type: 'text', not_null: true },
        { name: 'changed_by', type: 'text', not_null: true },
        { name: 'changed_at', type: 'timestamptz', default: 'now()' },
        { name: 'change_type', type: 'text', not_null: true },
        { name: 'field_name', type: 'text' },
        { name: 'old_value', type: 'text' },
        { name: 'new_value', type: 'text' },
        { name: 'hr_reviewed', type: 'boolean', default: 'false' },
        { name: 'hr_reviewed_at', type: 'timestamptz' },
        { name: 'hr_reviewed_by', type: 'text' },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      indexes: [
        'idx_training_change_log_session (session_id)',
        'idx_training_change_log_plan (plan_id)',
        'idx_training_change_log_company (company_id)',
        'idx_training_change_log_reviewed (hr_reviewed)',
      ],
    };

    return NextResponse.json({
      success: true,
      message: 'Schema documentation - please create table using Supabase migrations',
      schema,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
