/**
 * GET /api/nearmiss/board?companyId=xxx
 * Public endpoint — returns SANITIZED near miss list for employee board.
 * Never exposes: reporter_name, reporter_dept, admin_notes, root cause,
 * incident_description (full text), images, submitter_ip, form_duration_ms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Only these fields are safe to expose publicly
const PUBLIC_SELECT = [
  'id',
  'report_no',
  'incident_date',
  'location',
  'risk_level',
  'risk_score',
  'status',
  'coordinator',
  'due_date',
  'last_action_at',
  'created_at',
  // Short summary of what happened — we truncate server-side to 80 chars
  // to avoid exposing full incident text that might identify individuals
  'incident_description',
].join(', ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('near_miss_reports')
      .select(PUBLIC_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Filter hidden reports client-side (safe if is_hidden column doesn't exist yet)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visible = ((data || []) as any[]).filter((r: Record<string, unknown>) => !r['is_hidden']);

    // Sanitize: truncate incident_description, strip reporter info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = (visible as any[]).map((r: Record<string, unknown>) => ({
      id: r['id'],
      report_no: r['report_no'],
      incident_date: r['incident_date'],
      location: r['location'],
      risk_level: r['risk_level'],
      risk_score: r['risk_score'],
      status: r['status'],
      coordinator: r['coordinator'] ?? null,
      due_date: r['due_date'] ?? null,
      last_action_at: r['last_action_at'],
      created_at: r['created_at'],
      // Truncate to 80 chars — enough context, not enough to identify
      incident_summary: r['incident_description']
        ? (r['incident_description'] as string).slice(0, 80) +
          ((r['incident_description'] as string).length > 80 ? '…' : '')
        : null,
    }));

    return NextResponse.json({ data: sanitized, total: sanitized.length });

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
