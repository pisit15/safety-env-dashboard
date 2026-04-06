import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET - Fetch status overrides for a company
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');

  if (!companyId || !planType) {
    return NextResponse.json({ error: 'Missing companyId or planType' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('status_overrides')
    .select('*')
    .eq('company_id', companyId)
    .eq('plan_type', planType);

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
      .single();

    const upsertData: Record<string, unknown> = {
      company_id: companyId,
      plan_type: planType,
      activity_no: activityNo,
      month,
      status,
      note: note || '',
      updated_by: updatedBy || '',
      updated_at: new Date().toISOString(),
    };

    // Save postponed_to_month when status is 'postponed'
    if (status === 'postponed' && postponedToMonth) {
      upsertData.postponed_to_month = postponedToMonth;
    } else if (status !== 'postponed' && status !== 'done') {
      // Clear postponed_to_month if not postponed and not done (done preserves it)
      upsertData.postponed_to_month = null;
    }
    // When status is 'done', we keep existing postponed_to_month (don't overwrite)

    const { data, error } = await getSupabase()
      .from('status_overrides')
      .upsert(
        upsertData,
        { onConflict: 'company_id,plan_type,activity_no,month' }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    try {
      await getSupabase().from('audit_log').insert({
        company_id: companyId,
        plan_type: planType,
        action: 'status_change',
        activity_no: activityNo,
        month,
        old_value: oldData?.status || '(auto)',
        new_value: status + (postponedToMonth ? ` → ${postponedToMonth}` : ''),
        note: note || '',
        performed_by: updatedBy || '',
      });
    } catch { /* ignore audit log errors */ }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH - Save note only (without changing status)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, month, note, updatedBy } = body;

    if (!companyId || !planType || !activityNo || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if override exists
    const { data: existing } = await getSupabase()
      .from('status_overrides')
      .select('status')
      .eq('company_id', companyId)
      .eq('plan_type', planType)
      .eq('activity_no', activityNo)
      .eq('month', month)
      .single();

    if (existing) {
      // Update note on existing override
      const { error } = await getSupabase()
        .from('status_overrides')
        .update({ note: note || '', updated_by: updatedBy || '', updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('plan_type', planType)
        .eq('activity_no', activityNo)
        .eq('month', month);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Create new override with status 'noted' (note-only, no status change)
      const { error } = await getSupabase()
        .from('status_overrides')
        .insert({
          company_id: companyId,
          plan_type: planType,
          activity_no: activityNo,
          month,
          status: '__noted__',
          note: note || '',
          updated_by: updatedBy || '',
          updated_at: new Date().toISOString(),
        });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
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

  if (!companyId || !planType || !activityNo || !month) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('status_overrides')
    .delete()
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('activity_no', activityNo)
    .eq('month', month);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
