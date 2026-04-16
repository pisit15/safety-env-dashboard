import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications?since=ISO_DATE
 *
 * Returns recent actionable items for the admin notification bell:
 * - New near miss reports (status = 'new')
 * - New edit requests (pending)
 * - New cancellation requests (pending)
 * - Recent incidents
 *
 * If `since` param is provided, only returns items after that timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since') || new Date(Date.now() - 7 * 86400000).toISOString();

    const supabase = getServiceSupabase();

    const [nmRes, editRes, cancelRes, incRes] = await Promise.all([
      // New near miss reports
      supabase
        .from('near_miss_reports')
        .select('id, report_no, company_id, location, reporter_name, risk_level, created_at')
        .eq('status', 'new')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),

      // Pending edit requests
      supabase
        .from('edit_requests')
        .select('id, company_id, activity_no, month, requested_by, reason, created_at, status')
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10),

      // Pending cancellation requests
      supabase
        .from('cancellation_requests')
        .select('id, company_id, activity_no, month, requested_by, reason, created_at, status')
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10),

      // Recent incidents (last 7 days)
      supabase
        .from('incidents')
        .select('id, incident_no, company_id, incident_type, location, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    type NotifItem = {
      id: string;
      type: 'nearmiss' | 'edit_request' | 'cancel_request' | 'incident';
      title: string;
      detail: string;
      companyId: string;
      timestamp: string;
      href: string;
      priority: 'high' | 'normal';
    };

    const items: NotifItem[] = [];

    // Near miss
    (nmRes.data || []).forEach((r) => {
      items.push({
        id: `nm-${r.id}`,
        type: 'nearmiss',
        title: 'Near Miss ใหม่',
        detail: `${r.report_no || ''} — ${r.location || ''} (${r.reporter_name || ''})`,
        companyId: r.company_id,
        timestamp: r.created_at,
        href: `/projects/nearmiss/${r.company_id}`,
        priority: r.risk_level === 'HIGH' ? 'high' : 'normal',
      });
    });

    // Edit requests
    (editRes.data || []).forEach((r) => {
      items.push({
        id: `edit-${r.id}`,
        type: 'edit_request',
        title: 'ขอแก้ไขข้อมูล',
        detail: `กิจกรรม ${r.activity_no || ''} เดือน ${r.month || ''} — ${r.requested_by || ''}`,
        companyId: r.company_id,
        timestamp: r.created_at,
        href: '/projects/settings',
        priority: 'normal',
      });
    });

    // Cancel requests
    (cancelRes.data || []).forEach((r) => {
      items.push({
        id: `cancel-${r.id}`,
        type: 'cancel_request',
        title: 'ขอยกเลิกกิจกรรม',
        detail: `กิจกรรม ${r.activity_no || ''} — ${r.requested_by || ''}`,
        companyId: r.company_id,
        timestamp: r.created_at,
        href: '/projects/settings',
        priority: 'normal',
      });
    });

    // Incidents
    (incRes.data || []).forEach((r) => {
      items.push({
        id: `inc-${r.id}`,
        type: 'incident',
        title: 'อุบัติเหตุ',
        detail: `${r.incident_no || ''} — ${r.incident_type || ''} ${r.location || ''}`.trim(),
        companyId: r.company_id,
        timestamp: r.created_at,
        href: `/projects/incidents/${r.company_id}`,
        priority: 'normal',
      });
    });

    // Sort by timestamp
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      items,
      count: items.length,
      highPriority: items.filter((i) => i.priority === 'high').length,
    });
  } catch (err) {
    console.error('Notifications error:', err);
    return NextResponse.json({ items: [], count: 0, highPriority: 0 });
  }
}
