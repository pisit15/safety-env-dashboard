import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// ── GET /api/nearmiss/[id] ── Get single report
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('near_miss_reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

// ── PATCH /api/nearmiss/[id] ── Coordinator / Admin update
const PATCH_WHITELIST = [
  // Coordinator fields
  'status',
  'coordinator',
  'coordinator_assigned_at',
  'last_action_at',
  'action_summary',
  'immediate_action',
  'responsible_person',
  'due_date',
  // Visibility (coordinator can hide, admin can restore)
  'is_hidden',
  // Admin-only fields
  'investigation_level',
  'safety_officer',
  'closed_date',
  'admin_notes',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    for (const key of PATCH_WHITELIST) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Auto-set last_action_at on every update (except pure visibility toggle)
    if (!('is_hidden' in body && Object.keys(updates).length === 1)) {
      updates.last_action_at = new Date().toISOString();
    }

    // Auto-set coordinator_assigned_at when coordinator is first assigned
    if (updates.coordinator && !('coordinator_assigned_at' in body)) {
      updates.coordinator_assigned_at = new Date().toISOString();
    }

    // Auto-set closed_date when status → closed
    if (updates.status === 'closed' && !updates.closed_date) {
      updates.closed_date = new Date().toISOString().slice(0, 10);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('near_miss_reports')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── DELETE /api/nearmiss/[id] ── Admin-only permanent delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('near_miss_reports')
      .delete()
      .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
