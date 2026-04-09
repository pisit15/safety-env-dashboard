import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();
  const results: string[] = [];

  // 1. Create incident_photos table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS incident_photos (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      incident_no text NOT NULL,
      company_id text NOT NULL,
      file_name text NOT NULL,
      file_url text NOT NULL,
      storage_path text NOT NULL,
      file_size integer DEFAULT 0,
      caption text DEFAULT '',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_incident_photos_incident_no ON incident_photos(incident_no);
    CREATE INDEX IF NOT EXISTS idx_incident_photos_company_id ON incident_photos(company_id);
  `;

  const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

  if (rpcError) {
    const { error: testError } = await supabase
      .from('incident_photos')
      .select('id')
      .limit(1);

    if (testError?.message?.includes('does not exist') || testError?.code === '42P01') {
      results.push('⚠️ ตาราง incident_photos ยังไม่มี — กรุณา run SQL ใน Supabase SQL Editor');
    } else {
      results.push('✅ ตาราง incident_photos มีอยู่แล้ว');
    }
  } else {
    results.push('✅ สร้างตาราง incident_photos สำเร็จ');
  }

  // 2. Create storage bucket + policies via SQL (bypasses RLS on storage.buckets)
  const bucketSQL = `
    -- Create bucket if not exists
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'incident-photos',
      'incident-photos',
      true,
      10485760,
      ARRAY['image/jpeg','image/png','image/gif','image/webp','image/heic']::text[]
    )
    ON CONFLICT (id) DO NOTHING;

    -- Storage policies: allow public read, insert, delete
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'incident_photos_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "incident_photos_select" ON storage.objects FOR SELECT USING (bucket_id = 'incident-photos');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'incident_photos_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "incident_photos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'incident-photos');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'incident_photos_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "incident_photos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'incident-photos');
      END IF;
    END $$;
  `;

  const { error: bucketRpcError } = await supabase.rpc('exec_sql', { sql: bucketSQL });

  if (bucketRpcError) {
    results.push(`⚠️ สร้าง bucket via SQL error: ${bucketRpcError.message}`);
    results.push('กรุณา run SQL นี้ใน Supabase SQL Editor:');
    results.push(bucketSQL.trim());
  } else {
    results.push('✅ สร้าง Storage bucket "incident-photos" + policies สำเร็จ');
  }

  return NextResponse.json({ results });
}
