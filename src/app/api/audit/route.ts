import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET - Fetch audit log entries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = getSupabase()
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (companyId && companyId !== 'all') {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ entries: [] });
  }

  return NextResponse.json({ entries: data || [] });
}

// POST - Create audit log entry (called internally by other APIs)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, action, activityNo, month, oldValue, newValue, note, performedBy } = body;

    const { error } = await getSupabase()
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
