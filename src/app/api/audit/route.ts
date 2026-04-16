import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit — Fetch audit log entries with advanced filtering
 *
 * Query params:
 *   companyId  — filter by company (skip or 'all' for all)
 *   module     — filter by plan_type/module (e.g. 'nearmiss', 'incidents')
 *   action     — filter by action type
 *   performer  — filter by performed_by
 *   from       — ISO date, entries after this date
 *   to         — ISO date, entries before this date
 *   limit      — max entries (default 50, max 200)
 *   offset     — pagination offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const module = searchParams.get('module');
  const action = searchParams.get('action');
  const performer = searchParams.get('performer');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = getServiceSupabase();

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (companyId && companyId !== 'all') {
    query = query.eq('company_id', companyId);
  }
  if (module) {
    query = query.eq('plan_type', module);
  }
  if (action) {
    query = query.eq('action', action);
  }
  if (performer) {
    query = query.ilike('performed_by', `%${performer}%`);
  }
  if (from) {
    query = query.gte('created_at', from);
  }
  if (to) {
    query = query.lte('created_at', to);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ entries: [], total: 0 });
  }

  return NextResponse.json({ entries: data || [], total: count || 0 });
}

// POST - Create audit log entry (called internally by other APIs)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, action, activityNo, month, oldValue, newValue, note, performedBy } = body;

    const { error } = await getServiceSupabase()
      .from('audit_log')
      .insert({
        company_id: companyId,
        plan_type: planType,
        action,
        activity_no: activityNo || '',
        month: month || '',
        old_value: oldValue || '',
        new_value: newValue || '',
        note: note || '',
        performed_by: performedBy || '',
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
