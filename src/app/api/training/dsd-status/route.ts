import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// PATCH - Update DSD status for a training session (HR only, PIN protected)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, dsd_status, hr_pin } = body;

    if (!session_id || !dsd_status) {
      return NextResponse.json({ error: 'Missing session_id or dsd_status' }, { status: 400 });
    }

    const validStatuses = ['none', 'not_submitting', 'submitted', 'approved'];
    if (!validStatuses.includes(dsd_status)) {
      return NextResponse.json({ error: 'Invalid dsd_status' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify HR PIN
    const { data: pinData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'hr_pin')
      .single();

    const storedPin = pinData?.value || '1234'; // default PIN

    if (hr_pin !== storedPin) {
      return NextResponse.json({ error: 'รหัส HR ไม่ถูกต้อง' }, { status: 403 });
    }

    // Map status to DB columns
    const updateData: Record<string, unknown> = {
      dsd_not_submitting: dsd_status === 'not_submitting',
      dsd_submitted: dsd_status === 'submitted' || dsd_status === 'approved',
      dsd_approved: dsd_status === 'approved',
    };

    if (dsd_status === 'submitted') {
      updateData.dsd_submitted_date = new Date().toISOString().split('T')[0];
    }
    if (dsd_status === 'approved') {
      updateData.dsd_approved_date = new Date().toISOString().split('T')[0];
    }
    if (dsd_status === 'none' || dsd_status === 'not_submitting') {
      updateData.dsd_submitted_date = null;
      updateData.dsd_approved_date = null;
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', session_id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      dsd_status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
