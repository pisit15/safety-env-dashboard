import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { DEFAULT_YEAR } from '@/lib/companies';

function parseYear(v: string | null | undefined): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : DEFAULT_YEAR;
}

// GET - Fetch responsible overrides for a company (+ year)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const year = parseYear(searchParams.get('year'));

  if (!companyId || !planType) {
    return NextResponse.json({ error: 'Missing companyId or planType' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('responsible_overrides')
    .select('*')
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('year', year);

  if (error) {
    return NextResponse.json({ overrides: [] });
  }

  return NextResponse.json({ overrides: data || [] });
}

// POST - Upsert a responsible override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, responsible, updatedBy } = body;
    const year = parseYear(body.year);

    if (!companyId || !planType || !activityNo || !responsible) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: oldData } = await getSupabase()
      .from('responsible_overrides')
      .select('responsible')
      .eq('company_id', companyId)
      .eq('plan_type', planType)
      .eq('activity_no', activityNo)
      .eq('year', year)
      .single();

    const { data, error } = await getSupabase()
      .from('responsible_overrides')
      .upsert(
        {
          company_id: companyId,
          plan_type: planType,
          activity_no: activityNo,
          responsible,
          year,
          updated_by: updatedBy || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,plan_type,activity_no,year' }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await getSupabase().from('audit_log').insert({
        company_id: companyId,
        plan_type: planType,
        action: 'responsible_change',
        activity_no: activityNo,
        old_value: oldData?.responsible || '(from sheet)',
        new_value: responsible,
        performed_by: updatedBy || '',
      });
    } catch { /* ignore audit log errors */ }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Remove a responsible override (revert to sheet value)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const activityNo = searchParams.get('activityNo');
  const year = parseYear(searchParams.get('year'));

  if (!companyId || !planType || !activityNo) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('responsible_overrides')
    .delete()
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('activity_no', activityNo)
    .eq('year', year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
