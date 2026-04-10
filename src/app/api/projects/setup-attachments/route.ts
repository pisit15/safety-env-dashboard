import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/setup-attachments
 * One-time migration: creates project_attachments table and storage bucket
 */
export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Create project_attachments table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS project_attachments (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          project_id uuid NOT NULL REFERENCES special_projects(id) ON DELETE CASCADE,
          milestone_id uuid REFERENCES project_milestones(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          file_url text NOT NULL,
          storage_path text,
          file_type text DEFAULT 'other',
          file_size bigint DEFAULT 0,
          uploaded_by text DEFAULT '',
          created_at timestamptz DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_project_att_project ON project_attachments(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_att_milestone ON project_attachments(milestone_id);

        -- Enable RLS but allow all (public dashboard)
        ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "project_attachments_public" ON project_attachments;
        CREATE POLICY "project_attachments_public" ON project_attachments FOR ALL USING (true) WITH CHECK (true);
      `,
    });

    if (tableError) {
      return NextResponse.json({
        message: 'Could not auto-run migration. Run this SQL manually in Supabase SQL editor:',
        sql: `
CREATE TABLE IF NOT EXISTS project_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES special_projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES project_milestones(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  storage_path text,
  file_type text DEFAULT 'other',
  file_size bigint DEFAULT 0,
  uploaded_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_att_project ON project_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_att_milestone ON project_attachments(milestone_id);
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_attachments_public" ON project_attachments FOR ALL USING (true) WITH CHECK (true);
        `,
        error: tableError.message,
      });
    }

    return NextResponse.json({ success: true, message: 'project_attachments table created' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
