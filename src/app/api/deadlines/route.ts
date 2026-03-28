import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// GET - Fetch deadlines + check if a month is locked
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // optional: check specific month
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType');
  const activityNo = searchParams.get('activityNo');

  // Fetch all deadlines
  const { data: deadlines } = await getSupabase()
    .from('edit_deadlines')
    .select('*')
    .order('month');

  // If checking a specific month, determine if it's locked
  if (month && companyId) {
    const isLocked = isMonthLocked(month, deadlines || []);

    // If locked, check for approved edit request
    let hasApproval = false;
    if (isLocked && activityNo) {
      const { data: requests } = await getSupabase()
        .from('edit_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('month', month)
        .eq('activity_no', activityNo)
        .eq('status', 'approved')
        .gte('expires_at', new Date().toISOString());

      hasApproval = (requests && requests.length > 0) || false;
    }

    return NextResponse.json({
      deadlines: deadlines || [],
      isLocked,
      hasApproval,
    });
  }

  return NextResponse.json({ deadlines: deadlines || [] });
}

// PUT - Update deadline (admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, deadlineDay, isActive } = body;

    if (!month || !deadlineDay) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from('edit_deadlines')
      .update({
        deadline_day: deadlineDay,
        is_active: isActive !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('month', month);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Helper: Check if a month is past its edit deadline
function isMonthLocked(month: string, deadlines: any[]): boolean {
  const deadline = deadlines.find(d => d.month === month);
  if (!deadline || !deadline.is_active) return false;

  const monthIdx = MONTH_KEYS.indexOf(month);
  if (monthIdx === -1) return false;

  // Deadline is day X of the NEXT month
  const now = new Date();
  const currentYear = now.getFullYear();

  // The deadline month (next month after the activity month)
  const deadlineMonthIdx = (monthIdx + 1) % 12;
  const deadlineYear = monthIdx === 11 ? currentYear + 1 : currentYear;

  const deadlineDate = new Date(deadlineYear, deadlineMonthIdx, deadline.deadline_day, 23, 59, 59);

  return now > deadlineDate;
}
