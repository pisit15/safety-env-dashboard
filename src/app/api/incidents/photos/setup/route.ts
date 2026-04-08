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

  // Try using exec_sql RPC (if available)
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

  if (rpcError) {
    // Fallback: check if table exists by querying it
    const { error: testError } = await supabase
      .from('incident_photos')
      .select('id')
      .limit(1);

    if (testError?.message?.includes('does not exist') || testError?.code === '42P01') {
      results.push('⚠️ ตาราง incident_photos ยังไม่มี — กรุณา run SQL ด้านล่างใน Supabase SQL Editor:');
      results.push(createTableSQL.trim());
    } else {
      results.push('✅ ตาราง incident_photos มีอยู่แล้ว');
    }
  } else {
    results.push('✅ สร้างตาราง incident_photos สำเร็จ');
  }

  // 2. Create storage bucket
  const { error: bucketError } = await supabase.storage.createBucket('incident-photos', {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
  });

  if (bucketError) {
    if (bucketError.message?.includes('already exists')) {
      results.push('✅ Storage bucket "incident-photos" มีอยู่แล้ว');
    } else {
      results.push(`⚠️ สร้าง bucket error: ${bucketError.message}`);
    }
  } else {
    results.push('✅ สร้าง Storage bucket "incident-photos" สำเร็จ');
  }

  return NextResponse.json({ results });
}
