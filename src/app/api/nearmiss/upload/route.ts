import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'nearmiss-images';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// ── POST /api/nearmiss/upload ── Public image upload (no login required)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const companyId = (formData.get('companyId') as string) || 'unknown';

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์รูปภาพ' }, { status: 400 });
    }

    // Validate type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.some(t => mimeType.includes(t.split('/')[1]))) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, HEIC)' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const fileName = `${companyId}/${timestamp}-${random}.${ext}`;

    // Upload to Supabase Storage
    const supabase = getSupabase();
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrl, fileName });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// App Router handles multipart/form-data natively — no config needed
