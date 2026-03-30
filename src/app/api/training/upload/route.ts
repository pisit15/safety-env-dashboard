import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// POST - Upload file to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const sessionId = formData.get('sessionId') as string;
    const fileType = formData.get('fileType') as string; // 'photos' or 'signin'

    if (!file || !companyId || !sessionId || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['photos', 'signin'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid fileType' }, { status: 400 });
    }

    const supabase = getSupabase();
    const fileBuffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const path = `${companyId}/${sessionId}/${fileType}/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('training-documents')
      .upload(path, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('training-documents')
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path: data.path,
      url: publicUrl.publicUrl,
      filename: file.name,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
