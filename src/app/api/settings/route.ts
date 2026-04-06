import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch app settings
export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('app_settings')
      .select('*');

    if (error) {
      // Table might not exist yet — return defaults
      return NextResponse.json({
        settings: { deadline_enabled: true },
      });
    }

    // Convert rows to key-value object
    const settings: Record<string, any> = { deadline_enabled: true };
    (data || []).forEach((row: any) => {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else settings[row.key] = row.value;
    });

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: { deadline_enabled: true } });
  }
}

// PUT - Update a setting (admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Upsert the setting
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key, value: String(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
