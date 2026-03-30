import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  // Use service role key to bypass RLS for admin operations
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key
  );
}

// PATCH - Toggle DSD eligible or is_active for all plans with a specific course name
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { course_name, dsd_eligible, is_active } = body;

    if (!course_name) {
      return NextResponse.json({ error: 'Missing course_name' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (dsd_eligible !== undefined) updateData.dsd_eligible = dsd_eligible;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Update all training_plans with the matching course_name
    const { data, error } = await supabase
      .from('training_plans')
      .update(updateData)
      .eq('course_name', course_name)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      course_name,
      ...updateData,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
