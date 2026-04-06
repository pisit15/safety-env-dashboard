import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { ActivityMetadata } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET: Fetch metadata for activities
// ?company_id=xxx&plan_type=safety&year=2025
// or ?plan_type=safety&year=2025 (all companies)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const planType = searchParams.get('plan_type');
  const year = parseInt(searchParams.get('year') || '2025', 10);

  const sb = getSupabase();
  let query = sb.from('activity_metadata').select('*').eq('year', year);

  if (companyId) query = query.eq('company_id', companyId);
  if (planType) query = query.eq('plan_type', planType);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: Upsert activity metadata
export async function POST(request: Request) {
  try {
    const body: ActivityMetadata = await request.json();
    const { company_id, plan_type, activity_no, year, category, priority, due_date, notes, updated_by } = body;

    if (!company_id || !plan_type || !activity_no) {
      return NextResponse.json({ error: 'Missing required fields: company_id, plan_type, activity_no' }, { status: 400 });
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from('activity_metadata')
      .upsert({
        company_id,
        plan_type,
        activity_no,
        year: year || 2025,
        category: category || 'other',
        priority: priority || 'medium',
        due_date: due_date || null,
        notes: notes || '',
        updated_by: updated_by || '',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'company_id,plan_type,activity_no,year',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove activity metadata
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const sb = getSupabase();
  const { error } = await sb.from('activity_metadata').delete().eq('id', parseInt(id, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
