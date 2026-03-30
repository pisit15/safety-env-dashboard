import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch unreviewed changes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const isAdmin = searchParams.get('isAdmin') === 'true';

    const supabase = getSupabase();
    let query = supabase
      .from('training_change_log')
      .select('*, training_sessions(id, training_plans(course_name))')
      .eq('hr_reviewed', false)
      .order('changed_at', { ascending: false });

    if (companyId && !isAdmin) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Mark changes as reviewed
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { changeIds, hrReviewedBy } = body;

    if (!changeIds || !Array.isArray(changeIds) || !hrReviewedBy) {
      return NextResponse.json({ error: 'Missing changeIds array or hrReviewedBy' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('training_change_log')
      .update({
        hr_reviewed: true,
        hr_reviewed_at: new Date().toISOString(),
        hr_reviewed_by: hrReviewedBy,
      })
      .in('id', changeIds)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Log a change
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, planId, companyId, changedBy, changeType, fieldName, oldValue, newValue } = body;

    if (!sessionId || !companyId || !changedBy || !changeType) {
      return NextResponse.json({
        error: 'Missing required fields: sessionId, companyId, changedBy, changeType',
      }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('training_change_log')
      .insert({
        session_id: sessionId,
        plan_id: planId,
        company_id: companyId,
        changed_by: changedBy,
        change_type: changeType,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
