import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// PATCH - Toggle DSD eligible for all plans with a specific course name
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { course_name, dsd_eligible } = body;

    if (!course_name || dsd_eligible === undefined) {
      return NextResponse.json({ error: 'Missing course_name or dsd_eligible' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Update all training_plans with the matching course_name
    const { data, error } = await supabase
      .from('training_plans')
      .update({ dsd_eligible })
      .eq('course_name', course_name)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      course_name,
      dsd_eligible,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
