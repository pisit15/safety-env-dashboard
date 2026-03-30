import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// PATCH - Update a training plan's planned_month
export async function PATCH(request: NextRequest) {
  try {
    const { plan_id, planned_month } = await request.json();

    if (!plan_id || !planned_month) {
      return NextResponse.json({ error: 'Missing plan_id or planned_month' }, { status: 400 });
    }

    if (planned_month < 1 || planned_month > 12) {
      return NextResponse.json({ error: 'planned_month must be between 1 and 12' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('training_plans')
      .update({ planned_month })
      .eq('id', plan_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
