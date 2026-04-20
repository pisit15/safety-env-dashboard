import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET — fetch budget overrides for a company+planType+year
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const year = searchParams.get('year') || String(new Date().getFullYear());

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const supabase = getSupabase();

  let query = supabase
    .from('budget_overrides')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', parseInt(year));

  if (planType && planType !== 'total') {
    query = query.eq('plan_type', planType);
  }

  const { data, error } = await query;

  if (error) {
    // Table might not exist yet
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json({ overrides: [], needsSetup: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: data || [] });
}

// POST — upsert a budget override (actual_cost for an activity)
// Accepts either:
//   - actualCost: number (legacy single-value mode)
//   - monthlyCosts: Record<string, number> where keys are 'jan'..'dec';
//       actual_cost is auto-computed as the sum of numeric values.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, planType, activityNo, year, actualCost, monthlyCosts, note, updatedBy } = body;

    if (!companyId || !planType || !activityNo || !year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize monthly_costs: keep only valid month keys with numeric values
    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    let cleanMonthly: Record<string, number> | null = null;
    if (monthlyCosts && typeof monthlyCosts === 'object') {
      cleanMonthly = {};
      for (const k of MONTH_KEYS) {
        const raw = (monthlyCosts as Record<string, unknown>)[k];
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
        if (!isNaN(num) && num > 0) cleanMonthly[k] = num;
      }
      if (Object.keys(cleanMonthly).length === 0) cleanMonthly = null;
    }

    // If monthly breakdown is provided, actual_cost is the sum.
    // Otherwise fall back to explicit actualCost value.
    const computedActualCost = cleanMonthly
      ? Object.values(cleanMonthly).reduce((s, v) => s + (v || 0), 0)
      : (parseFloat(actualCost) || 0);

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('budget_overrides')
      .upsert(
        {
          company_id: companyId,
          plan_type: planType,
          activity_no: activityNo,
          year: parseInt(year),
          actual_cost: computedActualCost,
          monthly_costs: cleanMonthly,
          note: note || null,
          updated_by: updatedBy || 'admin',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,plan_type,activity_no,year' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — remove a budget override
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const activityNo = searchParams.get('activityNo');
  const year = searchParams.get('year');

  if (!companyId || !planType || !activityNo || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from('budget_overrides')
    .delete()
    .eq('company_id', companyId)
    .eq('plan_type', planType)
    .eq('activity_no', activityNo)
    .eq('year', parseInt(year));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
