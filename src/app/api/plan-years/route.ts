import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { COMPANIES } from '@/lib/companies';
import { getAllYears, getActiveYears, getDefaultYear, invalidatePlanYearsCache } from '@/lib/plan-years';
import { invalidateCompanySettingsCache } from '@/lib/company-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - list years for the selector: { years, active, default }
export async function GET() {
  try {
    const [years, active, def] = await Promise.all([
      getAllYears(),
      getActiveYears(),
      getDefaultYear(),
    ]);
    return NextResponse.json({ years, active, default: def });
  } catch {
    return NextResponse.json({ years: [], active: [], default: null }, { status: 500 });
  }
}

// POST - add a new year. Body: { year, isActive? }
// Also seeds an (empty) company_year_sheets row for every known company.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseInt(String(body.year), 10);
    const isActive = body.isActive === true;

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { error: insErr } = await supabase
      .from('plan_years')
      .upsert({ year, is_active: isActive }, { onConflict: 'year' });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Seed empty per-company sheet rows for this year (from existing settings, fallback to static)
    const { data: settings } = await supabase.from('company_settings').select('company_id');
    const ids = (settings && settings.length > 0)
      ? settings.map((s: { company_id: string }) => s.company_id)
      : COMPANIES.map((c) => c.id);
    const seed = ids.map((company_id) => ({
      company_id, year, sheet_id: '', safety_sheet: '', envi_sheet: '',
    }));
    if (seed.length > 0) {
      await supabase.from('company_year_sheets').upsert(seed, { onConflict: 'company_id,year' });
    }

    invalidatePlanYearsCache();
    invalidateCompanySettingsCache();
    return NextResponse.json({ success: true, year, isActive }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH - toggle active state. Body: { year, isActive }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseInt(String(body.year), 10);
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }
    const { error } = await getServiceSupabase()
      .from('plan_years')
      .update({ is_active: body.isActive === true })
      .eq('year', year);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    invalidatePlanYearsCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - remove a year's configuration (?year=2027).
// Removes plan_years + company_year_sheets rows only; status/attachment history is left intact.
export async function DELETE(request: NextRequest) {
  try {
    const year = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }
    const supabase = getServiceSupabase();
    await supabase.from('company_year_sheets').delete().eq('year', year);
    const { error } = await supabase.from('plan_years').delete().eq('year', year);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    invalidatePlanYearsCache();
    invalidateCompanySettingsCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
