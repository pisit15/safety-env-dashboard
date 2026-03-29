import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

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

// POST - Upload file to Google Drive and save metadata
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

    // Upload to Google Drive
    const driveResult = await uploadToGoogleDrive(file, companyId, planType, activityNo, month);

    if (!driveResult.success) {
      return NextResponse.json({ error: driveResult.error }, { status: 500 });
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
        file_url: driveResult.webViewLink,
        drive_file_id: driveResult.fileId,
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

  // Get attachment info first (for audit log)
  const { data: att } = await getSupabase()
    .from('activity_attachments')
    .select('*')
    .eq('id', id)
    .single();

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

// ── Google Drive Upload Helper ──
const EVIDENCE_FOLDER_ID = '1__YfDYMy-y06Oeh6GUzwFpex6Yc6-24q';

const MONTH_NAMES: Record<string, string> = {
  jan: '01-ม.ค.', feb: '02-ก.พ.', mar: '03-มี.ค.', apr: '04-เม.ย.',
  may: '05-พ.ค.', jun: '06-มิ.ย.', jul: '07-ก.ค.', aug: '08-ส.ค.',
  sep: '09-ก.ย.', oct: '10-ต.ค.', nov: '11-พ.ย.', dec: '12-ธ.ค.',
};

async function getServiceAccountAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('No service account credentials');
  const parsed = JSON.parse(credentials);
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

async function findOrCreateFolder(auth: any, parentId: string, folderName: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });

  // Search for existing folder
  const res = await drive.files.list({
    q: `'${parentId}' in parents AND name='${folderName}' AND mimeType='application/vnd.google-apps.folder' AND trashed=false`,
    fields: 'files(id,name)',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}

async function uploadToGoogleDrive(
  file: File,
  companyId: string,
  planType: string,
  activityNo: string,
  month: string
): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }> {
  try {
    const auth = await getServiceAccountAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Create folder structure: Evidence / CompanyId / PlanType / Month
    const companyFolder = await findOrCreateFolder(auth, EVIDENCE_FOLDER_ID, companyId.toUpperCase());
    const planFolder = await findOrCreateFolder(auth, companyFolder, planType === 'safety' ? 'Safety' : 'Environment');
    const monthFolder = await findOrCreateFolder(auth, planFolder, MONTH_NAMES[month] || month);

    // Upload file
    const buffer = Buffer.from(await file.arrayBuffer());
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileName = `${activityNo}_${file.name}`;
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [monthFolder],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id,webViewLink',
    });

    return {
      success: true,
      fileId: uploadRes.data.id!,
      webViewLink: uploadRes.data.webViewLink || `https://drive.google.com/file/d/${uploadRes.data.id}/view`,
    };
  } catch (err: any) {
    console.error('Google Drive upload error:', err);
    return { success: false, error: err.message || 'Upload failed' };
  }
}
