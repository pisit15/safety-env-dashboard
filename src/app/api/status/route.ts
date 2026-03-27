import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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
    const { companyId, planType, activityNo, month, status, note, updatedBy } = body;

    if (!companyId || !planType || !activityNo || !month || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('status_overrides')
      .upsert(
        {
          company_id: companyId,
          plan_type: planType,
          activity_no: activityNo,
          month,
          status,
          note: note || '',
          updated_by: updatedBy || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,plan_type,activity_no,month' }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
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
