import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET - Fetch open seats for a session (or by token for public page)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const token = searchParams.get('token');

  const supabase = getSupabase();

  if (token) {
    // Public lookup by token — include session + plan info
    const { data, error } = await supabase
      .from('training_open_seats')
      .select(`
        *,
        training_sessions (
          id, status, scheduled_date_start, scheduled_date_end,
          instructor_name, training_location, training_method,
          training_plans (
            id, course_name, category, in_house_external,
            hours_per_course, planned_participants, company_id
          )
        )
      `)
      .eq('share_token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'ไม่พบลิงก์นี้' }, { status: 404 });
    }

    // Count current registrations
    const { count } = await supabase
      .from('training_external_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('open_seat_id', data.id)
      .eq('status', 'registered');

    return NextResponse.json({
      ...data,
      registered_count: count || 0,
      remaining_seats: data.total_seats - (count || 0),
    });
  }

  if (sessionId) {
    const { data, error } = await supabase
      .from('training_open_seats')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      // Count registrations
      const { count } = await supabase
        .from('training_external_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('open_seat_id', data.id)
        .eq('status', 'registered');

      return NextResponse.json({
        ...data,
        registered_count: count || 0,
        remaining_seats: data.total_seats - (count || 0),
      });
    }

    return NextResponse.json(null);
  }

  return NextResponse.json({ error: 'Missing session_id or token' }, { status: 400 });
}

// POST - Create or update open seats
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, plan_id, company_id, total_seats, created_by } = body;

    if (!session_id || !plan_id || !company_id || !total_seats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if already exists
    const { data: existing } = await supabase
      .from('training_open_seats')
      .select('id, share_token')
      .eq('session_id', session_id)
      .single();

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('training_open_seats')
        .update({ total_seats, is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // Create new
    const { data, error } = await supabase
      .from('training_open_seats')
      .insert({ session_id, plan_id, company_id, total_seats, created_by })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH - Toggle active status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data, error } = await getSupabase()
      .from('training_open_seats')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
