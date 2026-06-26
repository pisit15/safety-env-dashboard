import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = 'evidence';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function fileTypeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext)) return 'word';
  return 'other';
}

// GET ?itemId=  -> attachments for one item
// GET ?companyId=&year=  -> all attachments for the company's items that year (grouped client-side)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const itemId = sp.get('itemId');
  const companyId = sp.get('companyId');
  const year = sp.get('year');
  const db = getSupabase();

  if (itemId) {
    const { data, error } = await db.from('budget_item_attachments').select('*').eq('item_id', itemId).order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attachments: data || [] });
  }

  if (companyId && year) {
    // find item ids for this company+year, then their attachments
    const { data: itemRows, error: e1 } = await db.from('budget_items').select('id').eq('company_id', companyId).eq('year', parseInt(year, 10));
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const ids = (itemRows || []).map(r => r.id);
    if (ids.length === 0) return NextResponse.json({ attachments: [] });
    const { data, error } = await db.from('budget_item_attachments').select('*').in('item_id', ids).order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attachments: data || [] });
  }

  return NextResponse.json({ error: 'Missing itemId or companyId+year' }, { status: 400 });
}

// POST: JSON { itemId, linkUrl, linkTitle, uploadedBy } -> external link
//       FormData { itemId, file, companyId, uploadedBy } -> uploaded file
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const db = getSupabase();

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { itemId, linkUrl, linkTitle, uploadedBy } = body;
      if (!itemId || !linkUrl || !String(linkUrl).trim()) {
        return NextResponse.json({ error: 'Missing itemId or linkUrl' }, { status: 400 });
      }
      let url = String(linkUrl).trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const { data, error } = await db.from('budget_item_attachments').insert({
        item_id: itemId, kind: 'link', title: (linkTitle || '').trim() || url,
        file_url: url, storage_path: null, file_type: 'link', uploaded_by: uploadedBy || '',
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attachment: data }, { status: 201 });
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const itemId = form.get('itemId') as string;
    const companyId = (form.get('companyId') as string) || 'amt';
    const uploadedBy = (form.get('uploadedBy') as string) || '';
    if (!file || !itemId) return NextResponse.json({ error: 'Missing file or itemId' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `ไฟล์ ${(file.size / 1024 / 1024).toFixed(1)} MB เกิน 20 MB กรุณาใช้ลิงก์ภายนอกแทน` }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const ts = Date.now();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `budget/${companyId}/${itemId}/${ts}-${safe}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);

    const { data, error } = await db.from('budget_item_attachments').insert({
      item_id: itemId, kind: 'file', title: file.name, file_url: pub.publicUrl,
      storage_path: path, file_type: fileTypeOf(file.name), file_size: file.size, uploaded_by: uploadedBy,
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
  const { data: att } = await db.from('budget_item_attachments').select('storage_path').eq('id', id).single();
  if (att?.storage_path) { try { await db.storage.from(BUCKET).remove([att.storage_path]); } catch { /* ignore */ } }
  const { error } = await db.from('budget_item_attachments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
