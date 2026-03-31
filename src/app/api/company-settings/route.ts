import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch all company settings (group & BU)
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*');

    if (error) {
      // Table might not exist yet — return empty
      return NextResponse.json({ settings: [] });
    }

    return NextResponse.json({ settings: data || [] });
  } catch {
    return NextResponse.json({ settings: [] });
  }
}

// PUT - Update group/BU for a company
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, group_name, bu } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Upsert the setting
    const { error } = await supabase
      .from('company_settings')
      .upsert(
        {
          company_id,
          group_name: group_name || '',
          bu: bu || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
