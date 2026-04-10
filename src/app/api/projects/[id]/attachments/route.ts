import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'evidence'; // reuse existing bucket
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// GET — list attachments for a project (optionally by milestone_id)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');

    let query = supabase
      .from('project_attachments')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (milestoneId) {
      query = query.eq('milestone_id', milestoneId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ attachments: [] });
    return NextResponse.json({ attachments: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — upload file for project or milestone
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const projectId = params.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const milestoneId = formData.get('milestoneId') as string | null;
    const uploadedBy = (formData.get('uploadedBy') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `ไฟล์ขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB เกินขีดจำกัด 20 MB`,
      }, { status: 413 });
    }

    // Upload to Supabase Storage
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/${milestoneId || 'general'}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // Determine file type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let fileType = 'other';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) fileType = 'image';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'excel';
    else if (['doc', 'docx'].includes(ext)) fileType = 'word';

    // Save metadata
    const insertData: Record<string, unknown> = {
      project_id: projectId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      storage_path: storagePath,
      file_type: fileType,
      file_size: file.size,
      uploaded_by: uploadedBy,
    };
    if (milestoneId) insertData.milestone_id = milestoneId;

    const { data, error: dbError } = await supabase
      .from('project_attachments')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, attachment: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 });
    }

    // Get attachment for storage cleanup
    const { data: att } = await supabase
      .from('project_attachments')
      .select('*')
      .eq('id', attachmentId)
      .eq('project_id', params.id)
      .single();

    if (att?.storage_path) {
      await supabase.storage.from(BUCKET).remove([att.storage_path]);
    }

    const { error } = await supabase
      .from('project_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
