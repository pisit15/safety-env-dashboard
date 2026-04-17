import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET - List registrations for an open_seat
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const openSeatId = searchParams.get('open_seat_id');
  const sessionId = searchParams.get('session_id');

  if (!openSeatId && !sessionId) {
    return NextResponse.json({ error: 'Missing open_seat_id or session_id' }, { status: 400 });
  }

  const supabase = getSupabase();

  let query = supabase
    .from('training_external_registrations')
    .select('*')
    .order('created_at', { ascending: true });

  if (openSeatId) query = query.eq('open_seat_id', openSeatId);
  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST - Register external participants (public — no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, participants } = body;

    if (!token || !participants || !Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุ token และข้อมูลผู้เข้าร่วม' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Lookup open seat by token
    const { data: openSeat, error: lookupError } = await supabase
      .from('training_open_seats')
      .select('id, session_id, total_seats, is_active')
      .eq('share_token', token)
      .single();

    if (lookupError || !openSeat) {
      return NextResponse.json({ error: 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' }, { status: 404 });
    }

    if (!openSeat.is_active) {
      return NextResponse.json({ error: 'การลงทะเบียนถูกปิดแล้ว' }, { status: 403 });
    }

    // Check remaining seats
    const { count: currentCount } = await supabase
      .from('training_external_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('open_seat_id', openSeat.id)
      .eq('status', 'registered');

    const remaining = openSeat.total_seats - (currentCount || 0);
    if (participants.length > remaining) {
      return NextResponse.json({
        error: `ที่นั่งเหลือ ${remaining} ที่ แต่ลงทะเบียน ${participants.length} คน`,
      }, { status: 400 });
    }

    // Insert all participants
    const rows = participants.map((p: Record<string, string>) => ({
      open_seat_id: openSeat.id,
      session_id: openSeat.session_id,
      company_name: p.company_name,
      company_id: p.company_id || null,
      emp_code: p.emp_code || null,
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position || null,
      department: p.department || null,
      phone: p.phone || null,
      email: p.email || null,
      registered_by: p.registered_by || null,
      status: 'registered',
    }));

    const { data, error } = await supabase
      .from('training_external_registrations')
      .insert(rows)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      message: `ลงทะเบียนสำเร็จ ${data.length} คน`,
      data,
    }, { status: 201 });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Remove a registration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await getSupabase()
      .from('training_external_registrations')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
