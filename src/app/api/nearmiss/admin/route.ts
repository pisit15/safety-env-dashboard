import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// ── GET /api/nearmiss/admin ── All companies, admin-only
// Returns summary stats per company + recent reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary'; // 'summary' | 'all'
    const limit = parseInt(searchParams.get('limit') || '200');

    const supabase = getSupabase();

    if (view === 'all') {
      // Full list across all companies
      const { data, error, count } = await supabase
        .from('near_miss_reports')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data, total: count });
    }

    // Summary: aggregate by company + monthly trend
    const { data, error } = await supabase
      .from('near_miss_reports')
      .select('company_id, status, risk_level, created_at, incident_date')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const now = new Date();
    const OVERDUE_DAYS = 14; // reports open > 14 days = overdue

    // Group by company
    const companyMap: Record<string, {
      total: number;
      new: number;
      open: number;
      closed: number;
      high: number;
      overdue: number;
      latest: string | null;
    }> = {};

    // Monthly trend (last 12 months)
    const monthlyTrend: Record<string, { total: number; high: number; closed: number }> = {};
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      monthlyTrend[key] = { total: 0, high: 0, closed: 0 };
    }

    let gOverdue = 0;

    for (const row of (data || [])) {
      const cid = row.company_id;
      if (!companyMap[cid]) {
        companyMap[cid] = { total: 0, new: 0, open: 0, closed: 0, high: 0, overdue: 0, latest: null };
      }
      const c = companyMap[cid];
      c.total++;
      if (row.status === 'new') c.new++;
      if (row.status === 'closed') c.closed++;
      else c.open++;
      if (row.risk_level === 'HIGH') c.high++;
      if (!c.latest || row.created_at > c.latest) c.latest = row.created_at;

      // Check overdue: open + created > OVERDUE_DAYS ago
      if (row.status !== 'closed') {
        const daysSinceCreated = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
        if (daysSinceCreated > OVERDUE_DAYS) {
          c.overdue++;
          gOverdue++;
        }
      }

      // Monthly trend
      const incDate = new Date(row.incident_date || row.created_at);
      const mKey = `${months[incDate.getMonth()]} ${incDate.getFullYear()}`;
      if (monthlyTrend[mKey]) {
        monthlyTrend[mKey].total++;
        if (row.risk_level === 'HIGH') monthlyTrend[mKey].high++;
        if (row.status === 'closed') monthlyTrend[mKey].closed++;
      }
    }

    return NextResponse.json({
      summary: companyMap,
      total: data?.length || 0,
      overdue: gOverdue,
      monthlyTrend,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
