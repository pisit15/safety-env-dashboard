import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/activity — Unified activity feed
 *
 * Merges recent audit_log entries + near_miss_reports + incidents
 * into a single chronological feed.
 *
 * Query params:
 *   companyId — filter by company (optional, 'all' = all)
 *   limit     — max items (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const supabase = getServiceSupabase();

    // Fetch 3 sources in parallel
    const [auditRes, nearmissRes, incidentsRes] = await Promise.all([
      // Recent audit entries
      (() => {
        let q = supabase
          .from('audit_log')
          .select('id, created_at, company_id, plan_type, action, activity_no, old_value, new_value, note, performed_by')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (companyId && companyId !== 'all') q = q.eq('company_id', companyId);
        return q;
      })(),

      // Recent near miss reports (last 30 days)
      (() => {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        let q = supabase
          .from('near_miss_reports')
          .select('id, report_no, company_id, location, reporter_name, status, risk_level, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (companyId && companyId !== 'all') q = q.eq('company_id', companyId);
        return q;
      })(),

      // Recent incidents (last 90 days)
      (() => {
        const since = new Date(Date.now() - 90 * 86400000).toISOString();
        let q = supabase
          .from('incidents')
          .select('id, incident_no, company_id, incident_type, location, description, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (companyId && companyId !== 'all') q = q.eq('company_id', companyId);
        return q;
      })(),
    ]);

    // Normalize into unified feed items
    type FeedItem = {
      id: string;
      type: 'audit' | 'nearmiss' | 'incident';
      timestamp: string;
      companyId: string;
      action: string;
      title: string;
      detail: string;
      performer: string;
      meta?: Record<string, string>;
    };

    const items: FeedItem[] = [];

    // Audit entries
    (auditRes.data || []).forEach((a) => {
      items.push({
        id: `audit-${a.id}`,
        type: 'audit',
        timestamp: a.created_at,
        companyId: a.company_id,
        action: a.action,
        title: a.action.replace(/_/g, ' '),
        detail: [
          a.activity_no && `กิจกรรม ${a.activity_no}`,
          a.old_value && a.new_value && `${a.old_value} → ${a.new_value}`,
          !a.old_value && a.new_value && a.new_value,
          a.note,
        ].filter(Boolean).join(' · ') || a.plan_type || '',
        performer: a.performed_by || '',
        meta: { module: a.plan_type || '' },
      });
    });

    // Near miss reports → feed items
    (nearmissRes.data || []).forEach((nm) => {
      items.push({
        id: `nm-${nm.id}`,
        type: 'nearmiss',
        timestamp: nm.created_at,
        companyId: nm.company_id,
        action: 'nearmiss_report',
        title: 'Near Miss Report',
        detail: `${nm.report_no || ''} — ${nm.location || ''}`.trim(),
        performer: nm.reporter_name || '',
        meta: { status: nm.status || '', risk: nm.risk_level || '' },
      });
    });

    // Incidents → feed items
    (incidentsRes.data || []).forEach((inc) => {
      items.push({
        id: `inc-${inc.id}`,
        type: 'incident',
        timestamp: inc.created_at,
        companyId: inc.company_id,
        action: 'incident_report',
        title: `อุบัติเหตุ ${inc.incident_type || ''}`.trim(),
        detail: `${inc.incident_no || ''} — ${inc.location || ''}`.trim(),
        performer: '',
        meta: { type: inc.incident_type || '' },
      });
    });

    // Sort by timestamp descending, deduplicate by checking audit entries that match
    // near miss / incident creation (to avoid double-showing)
    const auditNmIds = new Set(
      items
        .filter((i) => i.type === 'audit' && i.action === 'create_nearmiss')
        .map((i) => i.detail.split(' — ')[0].trim())
    );
    const auditIncIds = new Set(
      items
        .filter((i) => i.type === 'audit' && i.action === 'create_incident')
        .map((i) => i.detail.split(' — ')[0].trim())
    );

    const deduped = items.filter((item) => {
      // Remove near miss feed items that already have an audit entry
      if (item.type === 'nearmiss' && auditNmIds.has(item.detail.split(' — ')[0].trim())) return false;
      // Remove incident feed items that already have an audit entry
      if (item.type === 'incident' && auditIncIds.has(item.detail.split(' — ')[0].trim())) return false;
      return true;
    });

    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ items: deduped.slice(0, limit) });
  } catch (err) {
    console.error('Activity feed error:', err);
    return NextResponse.json({ items: [] });
  }
}
