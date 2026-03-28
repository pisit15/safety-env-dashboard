import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch edit requests
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const status = searchParams.get('status') || 'pending';

  let query = getSupabase()
    .from('edit_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (companyId && companyId !== 'all') {
    query = query.eq('company_id', companyId);
  }
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ requests: [] });
  }

  return NextResponse.json({ requests: data || [] });
}

// POST - Create edit request (company user)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, month, reason, requestedBy } = body;

    if (!companyId || !planType || !activityNo || !month || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for existing pending request
    const { data: existing } = await getSupabase()
      .from('edit_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('activity_no', activityNo)
      .eq('month', month)
      .eq('status', 'pending');

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'มีคำขอที่รอการอนุมัติอยู่แล้ว' }, { status: 409 });
    }

    const { data, error } = await getSupabase()
      .from('edit_requests')
      .insert({
        company_id: companyId,
        plan_type: planType,
        activity_no: activityNo,
        month,
        reason,
        requested_by: requestedBy || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await getSupabase().from('audit_log').insert({
      company_id: companyId,
      plan_type: planType,
      action: 'edit_request',
      activity_no: activityNo,
      month,
      new_value: reason,
      performed_by: requestedBy || '',
    });

    return NextResponse.json({ success: true, request: data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Approve/Reject edit request (admin)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status: newStatus, reviewedBy } = body;

    if (!id || !['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const updateData: any = {
      status: newStatus,
      reviewed_by: reviewedBy || 'admin',
      reviewed_at: new Date().toISOString(),
    };

    // If approved, set expiry to 7 days
    if (newStatus === 'approved') {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      updateData.expires_at = expires.toISOString();
    }

    const { error } = await getSupabase()
      .from('edit_requests')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
