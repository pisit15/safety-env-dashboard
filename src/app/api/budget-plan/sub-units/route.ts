import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?companyId= — list active sub-units (subsidiaries) of a company
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('budget_sub_units')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    // Table might not exist yet on fresh environments — behave as "no sub-units"
    if (error.message.includes('does not exist')) return NextResponse.json({ subUnits: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ subUnits: data || [] });
}

// POST { companyId, code, name, isAdmin } — add a sub-unit (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const { companyId, code, name } = body;
    if (!companyId || !code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'Missing companyId / code / name' }, { status: 400 });
    }
    const { data, error } = await getSupabase()
      .from('budget_sub_units')
      .insert({ company_id: companyId, code: String(code).trim().toUpperCase(), name: String(name).trim() })
      .select()
      .single();
    if (error) {
      if (error.message.includes('duplicate')) return NextResponse.json({ error: 'รหัสนี้มีอยู่แล้ว' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ subUnit: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE ?id=&isAdmin=true — deactivate a sub-unit (items are kept)
export async function DELETE(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get('isAdmin') !== 'true') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const id = sp.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await getSupabase()
    .from('budget_sub_units')
    .update({ is_active: false })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
