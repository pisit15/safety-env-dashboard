import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// ── POST /api/nearmiss ── Public submission (no login required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      reporter_name,
      reporter_dept,
      incident_date,
      location,
      incident_description,
      saving_factor,
      probability,
      severity,
      notified_persons,
      suggested_action,
      images,
      // bot protection fields
      _hp,          // honeypot — must be empty
      _duration_ms, // form fill duration
    } = body;

    // ── Bot Protection 1: Honeypot
    if (_hp && _hp !== '') {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
    }

    // ── Bot Protection 2: Time gate (must spend ≥ 8 seconds)
    if (typeof _duration_ms === 'number' && _duration_ms < 8000) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 429 });
    }

    // ── Basic validation
    if (!companyId || !reporter_name || !incident_date || !location || !incident_description) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 });
    }

    const prob = Number(probability);
    const sev = Number(severity);
    if (!prob || !sev || prob < 1 || prob > 5 || sev < 1 || sev > 5) {
      return NextResponse.json({ error: 'กรุณาระบุโอกาสและความรุนแรงให้ถูกต้อง (1-5)' }, { status: 400 });
    }

    // ── Bot Protection 3: IP Rate Limiting (max 10 per IP per hour)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const supabase = getSupabase();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('nearmiss_ip_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: 'ส่งรายงานได้ไม่เกิน 10 ครั้งต่อชั่วโมง กรุณาลองใหม่ในภายหลัง' },
        { status: 429 }
      );
    }

    // ── Insert report
    const { data, error } = await supabase
      .from('near_miss_reports')
      .insert({
        company_id: companyId,
        reporter_name,
        reporter_dept: reporter_dept || null,
        incident_date,
        location,
        incident_description,
        saving_factor: saving_factor || null,
        probability: prob,
        severity: sev,
        notified_persons: notified_persons || null,
        suggested_action: suggested_action || null,
        images: Array.isArray(images) ? images.filter((u: string) => typeof u === 'string' && u.startsWith('https://')) : [],
        submitter_ip: ip,
        form_duration_ms: typeof _duration_ms === 'number' ? _duration_ms : null,
        status: 'new',
      })
      .select('id, report_no')
      .single();

    if (error) {
      console.error('Near miss insert error:', error);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
    }

    // Log IP
    await supabase.from('nearmiss_ip_log').insert({ ip, company_id: companyId });

    return NextResponse.json({ success: true, id: data.id, report_no: data.report_no });
  } catch (err) {
    console.error('Near miss POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── GET /api/nearmiss?companyId=xxx ── Requires company auth (checked client-side via token)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const riskLevel = searchParams.get('riskLevel');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase
      .from('near_miss_reports')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (riskLevel) query = query.eq('risk_level', riskLevel);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, total: count });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
