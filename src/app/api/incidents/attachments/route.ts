import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = 'evidence';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_ATTACHMENTS = 2;

// GET ?incident_no= — attachments for one incident
export async function GET(request: NextRequest) {
  const incidentNo = request.nextUrl.searchParams.get('incident_no');
  if (!incidentNo) return NextResponse.json({ error: 'Missing incident_no' }, { status: 400 });
  const { data, error } = await getSupabase()
    .from('incident_attachments')
    .select('*')
    .eq('incident_no', incidentNo)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data || [] });
}

// POST: JSON { incidentNo, companyId, linkUrl, linkTitle, uploadedBy } -> Drive/OneDrive link
//       FormData { file (PDF), incident_no, company_id, uploaded_by } -> uploaded PDF
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const db = getSupabase();

    const countFor = async (incidentNo: string) => {
      const { count } = await db
        .from('incident_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('incident_no', incidentNo);
      return count || 0;
    };

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { incidentNo, companyId, linkUrl, linkTitle, uploadedBy } = body;
      if (!incidentNo || !linkUrl || !String(linkUrl).trim()) {
        return NextResponse.json({ error: 'Missing incidentNo or linkUrl' }, { status: 400 });
      }
      if (await countFor(incidentNo) >= MAX_ATTACHMENTS) {
        return NextResponse.json({ error: `แนบเอกสารได้สูงสุด ${MAX_ATTACHMENTS} รายการต่อเหตุการณ์` }, { status: 400 });
      }
      let url = String(linkUrl).trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const { data, error } = await db.from('incident_attachments').insert({
        incident_no: incidentNo, company_id: companyId || '', kind: 'link',
        title: (linkTitle || '').trim() || url, file_url: url,
        storage_path: null, uploaded_by: uploadedBy || '',
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attachment: data }, { status: 201 });
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const incidentNo = form.get('incident_no') as string;
    const companyId = (form.get('company_id') as string) || '';
    const uploadedBy = (form.get('uploaded_by') as string) || '';
    if (!file || !incidentNo) return NextResponse.json({ error: 'Missing file or incident_no' }, { status: 400 });

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PDF เท่านั้น — เอกสารอื่นให้ใช้ลิงก์ Google Drive/OneDrive' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `ไฟล์ ${(file.size / 1024 / 1024).toFixed(1)} MB เกิน 20 MB กรุณาใช้ลิงก์ภายนอกแทน` }, { status: 413 });
    }
    if (await countFor(incidentNo) >= MAX_ATTACHMENTS) {
      return NextResponse.json({ error: `แนบเอกสารได้สูงสุด ${MAX_ATTACHMENTS} รายการต่อเหตุการณ์` }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ts = Date.now();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `incidents/${companyId || 'unknown'}/${incidentNo}/${ts}-${safe}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);

    const { data, error } = await db.from('incident_attachments').insert({
      incident_no: incidentNo, company_id: companyId, kind: 'file',
      title: file.name, file_url: pub.publicUrl, storage_path: path,
      file_size: file.size, uploaded_by: uploadedBy,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attachment: data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE ?id=
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const db = getSupabase();
  const { data: att } = await db.from('incident_attachments').select('storage_path').eq('id', id).single();
  if (att?.storage_path) { try { await db.storage.from(BUCKET).remove([att.storage_path]); } catch { /* ignore */ } }
  const { error } = await db.from('incident_attachments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
