import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { DEFAULT_YEAR } from '@/lib/companies';

function parseYear(v: string | null | undefined): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : DEFAULT_YEAR;
}

// GET - Fetch status overrides for a company (+ year)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const year = parseYear(searchParams.get('year'));

  if (!companyId || !planType) {
    return NextResponse.json({ error: 'Missing companyId or planType' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('status_overrides')
    .select('*')
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('year', year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: data || [] });
}

// POST - Upsert a status override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, month, status, note, updatedBy, postponedToMonth } = body;
    const year = parseYear(body.year);

    if (!companyId || !planType || !activityNo || !month || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get old value for audit log
    const { data: oldData } = await getSupabase()
      .from('status_overrides')
      .select('status')
      .eq('company_id', companyId)
      .eq('plan_type', planType)
      .eq('activity_no', activityNo)
      .eq('month', month)
      .eq('year', year)
      .single();

    const upsertData: Record<string, unknown> = {
      company_id: companyId,
      plan_type: planType,
      activity_no: activityNo,
      month,
      year,
      status,
      note: note || '',
      updated_by: updatedBy || '',
      updated_at: new Date().toISOString(),
    };

    if (status === 'postponed' && postponedToMonth) {
      upsertData.postponed_to_month = postponedToMonth;
    } else if (status !== 'postponed' && status !== 'done') {
      upsertData.postponed_to_month = null;
    }

    const { data, error } = await getSupabase()
      .from('status_overrides')
      .upsert(
        upsertData,
        { onConflict: 'company_id,plan_type,activity_no,month,year' }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await getSupabase().from('audit_log').insert({
        company_id: companyId,
        plan_type: planType,
        action: 'status_change',
        activity_no: activityNo,
        month,
        old_value: oldData?.status || '(auto)',
        new_value: status + (postponedToMonth ? ` -> ${postponedToMonth}` : ''),
        note: note || '',
        performed_by: updatedBy || '',
      });
    } catch { /* ignore audit log errors */ }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH - Save note only (without changing status)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, month, note, updatedBy } = body;
    const year = parseYear(body.year);

    if (!companyId || !planType || !activityNo || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existing } = await getSupabase()
      .from('status_overrides')
      .select('status')
      .eq('company_id', companyId)
      .eq('plan_type', planType)
      .eq('activity_no', activityNo)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (existing) {
      const { error } = await getSupabase()
        .from('status_overrides')
        .update({ note: note || '', updated_by: updatedBy || '', updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('plan_type', planType)
        .eq('activity_no', activityNo)
        .eq('month', month)
        .eq('year', year);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await getSupabase()
        .from('status_overrides')
        .insert({
          company_id: companyId,
          plan_type: planType,
          activity_no: activityNo,
          month,
          year,
          status: '__noted__',
          note: note || '',
          updated_by: updatedBy || '',
          updated_at: new Date().toISOString(),
        });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await getSupabase().from('audit_log').insert({
        company_id: companyId,
        plan_type: planType,
        action: 'note_update',
        activity_no: activityNo,
        month,
        new_value: (note || '').substring(0, 200),
        performed_by: updatedBy || '',
      });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Remove a status override (revert to auto-detected)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const activityNo = searchParams.get('activityNo');
  const month = searchParams.get('month');
  const year = parseYear(searchParams.get('year'));

  if (!companyId || !planType || !activityNo || !month) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('status_overrides')
    .delete()
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('activity_no', activityNo)
    .eq('month', month)
    .eq('year', year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
