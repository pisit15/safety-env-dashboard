import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Phase 4: Cancellation/N/A Approval Workflow
 *
 * When a user wants to set status to 'cancelled', 'not_applicable',
 * 'not_planned', or 'planned', it creates a request that must be
 * approved by admin before the status_override is actually applied.
 *
 * Table: cancellation_requests
 * - id SERIAL PRIMARY KEY
 * - company_id TEXT NOT NULL
 * - plan_type TEXT NOT NULL
 * - activity_no TEXT NOT NULL
 * - month TEXT NOT NULL
 * - requested_status TEXT NOT NULL ('cancelled' | 'not_applicable' | 'not_planned' | 'planned')
 * - reason TEXT NOT NULL
 * - requested_by TEXT NOT NULL
 * - status TEXT DEFAULT 'pending' ('pending' | 'approved' | 'rejected')
 * - reviewed_by TEXT
 * - reviewed_at TIMESTAMPTZ
 * - created_at TIMESTAMPTZ DEFAULT NOW()
 */

// GET - Fetch cancellation requests
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const status = searchParams.get('status') || 'pending';
  const planType = searchParams.get('planType');

  let query = getServiceSupabase()
    .from('cancellation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (companyId && companyId !== 'all') {
    query = query.eq('company_id', companyId);
  }
  if (planType && planType !== 'all') {
    query = query.eq('plan_type', planType);
  }
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    // Table might not exist yet — return empty
    return NextResponse.json({ requests: [] });
  }

  return NextResponse.json({ requests: data || [] });
}

// POST - Create cancellation request (company user)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, month, requestedStatus, reason, requestedBy } = body;

    if (!companyId || !planType || !activityNo || !month || !requestedStatus || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['cancelled', 'not_applicable', 'not_planned', 'planned'].includes(requestedStatus)) {
      return NextResponse.json({ error: 'Invalid requested status' }, { status: 400 });
    }

    // Check for existing pending request for same cell
    const { data: existing } = await getServiceSupabase()
      .from('cancellation_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('plan_type', planType)
      .eq('activity_no', activityNo)
      .eq('month', month)
      .eq('status', 'pending');

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'มีคำขอที่รอการอนุมัติอยู่แล้ว' }, { status: 409 });
    }

    const { data, error } = await getServiceSupabase()
      .from('cancellation_requests')
      .insert({
        company_id: companyId,
        plan_type: planType,
        activity_no: activityNo,
        month,
        requested_status: requestedStatus,
        reason,
        requested_by: requestedBy || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await getServiceSupabase().from('audit_log').insert({
      company_id: companyId,
      plan_type: planType,
      action: 'cancellation_request',
      activity_no: activityNo,
      month,
      new_value: `${requestedStatus}: ${reason}`,
      performed_by: requestedBy || '',
    });

    return NextResponse.json({ success: true, request: data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Approve/Reject cancellation request (admin)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status: newStatus, reviewedBy } = body;

    if (!id || !['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get the request first
    const { data: req } = await getServiceSupabase()
      .from('cancellation_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Update the request status
    const { error: updateError } = await getServiceSupabase()
      .from('cancellation_requests')
      .update({
        status: newStatus,
        reviewed_by: reviewedBy || 'admin',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If approved → apply the status override
    if (newStatus === 'approved') {
      const { error: overrideError } = await getServiceSupabase()
        .from('status_overrides')
        .upsert({
          company_id: req.company_id,
          plan_type: req.plan_type,
          activity_no: req.activity_no,
          month: req.month,
          status: req.requested_status,
          note: `[อนุมัติโดย ${reviewedBy || 'admin'}] ${req.reason}`,
          updated_by: reviewedBy || 'admin',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id,plan_type,activity_no,month',
        });

      if (overrideError) {
        console.error('Failed to apply status override:', overrideError);
        // Don't fail the request — the approval is saved
      }

      // Audit log for the actual status change
      await getServiceSupabase().from('audit_log').insert({
        company_id: req.company_id,
        plan_type: req.plan_type,
        action: 'status_change',
        activity_no: req.activity_no,
        month: req.month,
        new_value: req.requested_status,
        note: `Approved cancellation request: ${req.reason}`,
        performed_by: reviewedBy || 'admin',
      });
    }

    // Audit log for the review action
    await getServiceSupabase().from('audit_log').insert({
      company_id: req.company_id,
      plan_type: req.plan_type,
      action: newStatus === 'approved' ? 'cancellation_approved' : 'cancellation_rejected',
      activity_no: req.activity_no,
      month: req.month,
      new_value: newStatus,
      performed_by: reviewedBy || 'admin',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
