import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET — list projects for a company
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');       // filter by status
    const planType = searchParams.get('planType');   // filter by plan_type
    const scope = searchParams.get('scope');         // filter by project_scope

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    let query = supabase
      .from('special_projects')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (planType && planType !== 'all') {
      if (planType === 'general') {
        query = query.is('plan_type', null);
      } else {
        query = query.eq('plan_type', planType);
      }
    }
    if (scope && scope !== 'all') query = query.eq('project_scope', scope);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Attach milestone counts
    const projectIds = (data || []).map((p: { id: string }) => p.id);
    let milestoneCounts: Record<string, { total: number; done: number }> = {};
    if (projectIds.length > 0) {
      const { data: mData } = await supabase
        .from('project_milestones')
        .select('project_id, status')
        .in('project_id', projectIds);
      (mData || []).forEach((m: { project_id: string; status: string }) => {
        if (!milestoneCounts[m.project_id]) milestoneCounts[m.project_id] = { total: 0, done: 0 };
        milestoneCounts[m.project_id].total++;
        if (m.status === 'done') milestoneCounts[m.project_id].done++;
      });
    }

    const projects = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      milestone_counts: milestoneCounts[p.id as string] || { total: 0, done: 0 },
    }));

    return NextResponse.json({ projects });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — create new project
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      company_id, plan_type, project_scope = 'internal', requesting_dept,
      category, title, description, owner, status = 'planning',
      start_date, end_date, budget_planned = 0, notes, created_by,
    } = body;

    if (!company_id || !title || !owner || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields: company_id, title, owner, start_date, end_date' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('special_projects')
      .insert({
        company_id,
        plan_type: plan_type || null,
        project_scope,
        requesting_dept: requesting_dept || null,
        category: category || null,
        title,
        description: description || null,
        owner,
        status,
        start_date,
        end_date,
        budget_planned: Number(budget_planned),
        budget_actual: 0,
        completion_pct: 0,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
