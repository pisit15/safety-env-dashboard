import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// POST - Upload certificate image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const employeeId = formData.get('employeeId') as string;

    if (!file || !companyId) {
      return NextResponse.json({ error: 'Missing file or companyId' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'ไฟล์ต้องเป็น JPG, PNG, WebP, GIF หรือ PDF เท่านั้น' }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 10MB' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const filePath = `${companyId}/${employeeId || 'unknown'}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
