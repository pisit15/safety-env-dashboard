import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Case lock API — จัดการล็อกเคสอุบัติเหตุ
 * POST { id, action, isAdmin, by }
 *   action: 'lock'           — admin ล็อกเคส (ห้าม user แก้/ลบ)
 *           'unlock'         — admin ปลดล็อก (ล้างคำขอด้วย)
 *           'request_unlock' — user ส่งคำขอให้ admin ปลดล็อก
 *           'reject_request' — admin ปฏิเสธคำขอ (คงล็อกไว้ ล้างคำขอ)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, isAdmin, by } = body as { id?: string; action?: string; isAdmin?: boolean; by?: string };
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }
    const adminOnly = ['lock', 'unlock', 'reject_request'];
    if (adminOnly.includes(action) && isAdmin !== true) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    let db;
    try { db = getServiceSupabase(); } catch { db = supabase; }

    const { data: inc, error: incErr } = await db
      .from('incidents')
      .select('id, incident_no, company_id, locked, unlock_request')
      .eq('id', id)
      .maybeSingle();
    if (incErr) throw incErr;
    if (!inc) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

    const actor = (by || (isAdmin ? 'admin' : 'user')).trim();
    const now = new Date().toISOString();
    let fields: Record<string, unknown> = {};
    let note = '';

    switch (action) {
      case 'lock':
        fields = { locked: true, locked_by: actor, locked_at: now, unlock_request: '', unlock_requested_at: null };
        note = `ล็อกเคส ${inc.incident_no}`;
        break;
      case 'unlock':
        fields = { locked: false, locked_by: '', locked_at: null, unlock_request: '', unlock_requested_at: null };
        note = `ปลดล็อกเคส ${inc.incident_no}`;
        break;
      case 'request_unlock':
        if (!inc.locked) return NextResponse.json({ error: 'เคสนี้ไม่ได้ถูกล็อก' }, { status: 400 });
        fields = { unlock_request: actor, unlock_requested_at: now };
        note = `ขอปลดล็อกเคส ${inc.incident_no}`;
        break;
      case 'reject_request':
        fields = { unlock_request: '', unlock_requested_at: null };
        note = `ปฏิเสธคำขอปลดล็อกเคส ${inc.incident_no} (ผู้ขอ: ${inc.unlock_request || '-'})`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data, error } = await db.from('incidents').update(fields).eq('id', id).select('id, locked, locked_by, locked_at, unlock_request, unlock_requested_at');
    if (error) throw error;

    // Best-effort audit trail
    try {
      await db.from('audit_log').insert({
        company_id: inc.company_id,
        action: `incident_${action}`,
        activity_no: inc.incident_no,
        note,
        performed_by: actor,
      });
    } catch { /* audit best-effort */ }

    return NextResponse.json({ incident: data?.[0] || null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Lock action failed', detail: msg }, { status: 500 });
  }
}
