import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = 'incident-photos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per photo
const MAX_PHOTOS = 5;

// ── GET — Fetch photos for an incident ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const incidentNo = searchParams.get('incident_no');

  if (!incidentNo) {
    return NextResponse.json({ error: 'Missing incident_no' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('incident_photos')
    .select('*')
    .eq('incident_no', incidentNo)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ photos: [] });
  }

  return NextResponse.json({ photos: data || [] });
}

// ── POST — Upload photo ──
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const incidentNo = formData.get('incident_no') as string;
    const companyId = formData.get('company_id') as string;
    const caption = (formData.get('caption') as string) || '';

    if (!file || !incidentNo || !companyId) {
      return NextResponse.json({ error: 'Missing required fields (file, incident_no, company_id)' }, { status: 400 });
    }

    // Validate image type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `รูปภาพมีขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB เกินขีดจำกัด 10 MB`,
      }, { status: 413 });
    }

    const supabase = getSupabase();

    // Check existing photo count
    const { count } = await supabase
      .from('incident_photos')
      .select('id', { count: 'exact', head: true })
      .eq('incident_no', incidentNo);

    if ((count || 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: `แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ` }, { status: 400 });
    }

    // Upload to Supabase Storage
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${companyId.toUpperCase()}/${incidentNo}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // Save metadata
    const { data, error: dbError } = await supabase
      .from('incident_photos')
      .insert({
        incident_no: incidentNo,
        company_id: companyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        file_size: file.size,
        caption,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file if DB insert fails
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, photo: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    console.error('Photo upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — Remove photo ──
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Get photo info for storage cleanup
  const { data: photo } = await supabase
    .from('incident_photos')
    .select('*')
    .eq('id', id)
    .single();

  // Delete from storage
  if (photo?.storage_path) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  }

  // Delete DB record
  const { error } = await supabase
    .from('incident_photos')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
