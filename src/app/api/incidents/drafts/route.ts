import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET — fetch the most recent draft for a company
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('company_id', companyId)
      .eq('report_status', 'Draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ draft: data || null });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
