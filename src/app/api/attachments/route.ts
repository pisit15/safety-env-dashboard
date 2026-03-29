import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch attachments for an activity/month
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const activityNo = searchParams.get('activityNo');
  const month = searchParams.get('month');

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  let query = getSupabase()
    .from('activity_attachments')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (planType) query = query.eq('plan_type', planType);
  if (activityNo) query = query.eq('activity_no', activityNo);
  if (month) query = query.eq('month', month);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ attachments: [] });
  }

  return NextResponse.json({ attachments: data || [] });
}

// POST - Upload file to Supabase Storage and save metadata
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const planType = formData.get('planType') as string;
    const activityNo = formData.get('activityNo') as string;
    const month = formData.get('month') as string;
    const uploadedBy = formData.get('uploadedBy') as string;

    if (!file || !companyId || !planType || !activityNo || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadToSupabaseStorage(file, companyId, planType, activityNo, month);

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 500 });
    }

    // Determine file type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let fileType = 'other';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) fileType = 'image';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'excel';
    else if (['doc', 'docx'].includes(ext)) fileType = 'word';

    // Save metadata to Supabase
    const { data, error } = await getSupabase()
      .from('activity_attachments')
      .insert({
        company_id: companyId,
        plan_type: planType,
        activity_no: activityNo,
        month,
        file_name: file.name,
        file_url: uploadResult.publicUrl,
        drive_file_id: uploadResult.storagePath,
        file_type: fileType,
        file_size: file.size,
        uploaded_by: uploadedBy || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log to audit
    await getSupabase().from('audit_log').insert({
      company_id: companyId,
      plan_type: planType,
      action: 'file_upload',
      activity_no: activityNo,
      month,
      new_value: file.name,
      performed_by: uploadedBy || '',
    });

    return NextResponse.json({ success: true, attachment: data });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE - Remove attachment
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // Get attachment info first (for audit log and storage cleanup)
  const { data: att } = await getSupabase()
    .from('activity_attachments')
    .select('*')
    .eq('id', id)
    .single();

  // Delete from Supabase Storage if path exists
  if (att?.drive_file_id) {
    await getSupabase().storage.from('evidence').remove([att.drive_file_id]);
  }

  const { error } = await getSupabase()
    .from('activity_attachments')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to audit
  if (att) {
    await getSupabase().from('audit_log').insert({
      company_id: att.company_id,
      plan_type: att.plan_type,
      action: 'file_delete',
      activity_no: att.activity_no,
      month: att.month,
      old_value: att.file_name,
      performed_by: 'user',
    });
  }

  return NextResponse.json({ success: true });
}

// ── Supabase Storage Upload Helper ──
const MONTH_NAMES: Record<string, string> = {
  jan: '01-jan', feb: '02-feb', mar: '03-mar', apr: '04-apr',
  may: '05-may', jun: '06-jun', jul: '07-jul', aug: '08-aug',
  sep: '09-sep', oct: '10-oct', nov: '11-nov', dec: '12-dec',
};

async function uploadToSupabaseStorage(
  file: File,
  companyId: string,
  planType: string,
  activityNo: string,
  month: string
): Promise<{ success: boolean; storagePath?: string; publicUrl?: string; error?: string }> {
  try {
    const supabase = getSupabase();
    const bucket = 'evidence';

    // Build path: companyId/planType/month/activityNo_filename
    const monthDir = MONTH_NAMES[month] || month;
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u0E00-\u0E7F]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${companyId.toUpperCase()}/${planType}/${monthDir}/${activityNo}_${timestamp}_${safeName}`;

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return {
      success: true,
      storagePath,
      publicUrl: urlData.publicUrl,
    };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { success: false, error: err.message || 'Upload failed' };
  }
}
