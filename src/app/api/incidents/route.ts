import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export const dynamic = 'force-dynamic';

// GET — fetch incidents with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const companyId = searchParams.get('companyId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const incidentType = searchParams.get('incidentType');
    const mode = searchParams.get('mode') || 'list'; // list | summary | hq
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (mode === 'summary') {
      // Summary stats for a company or all companies
      let query = supabase.from('incidents').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      if (year) query = query.eq('year', parseInt(year));

      const { data, error } = await query.order('incident_date', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const incidents = data || [];

      // Calculate summary stats
      const totalIncidents = incidents.length;
      const injuries = incidents.filter(i =>
        i.incident_type?.includes('บาดเจ็บ') || i.incident_type?.includes('เสียชีวิต')
      );
      const ltiCases = incidents.filter(i => {
        const t = i.incident_type as string || '';
        // LTI = lost time injury: หยุดงาน but NOT ไม่หยุดงาน
        return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
      });
      const nearMisses = incidents.filter(i => i.incident_type === 'Near Miss');
      const propertyDamage = incidents.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
      const fatalities = incidents.filter(i =>
        i.incident_type === 'เสียชีวิต (Fatality)' || i.actual_severity === 'S6 เสียชีวิต'
      );
      const totalDirectCost = incidents.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.direct_cost) || 0), 0);
      const totalIndirectCost = incidents.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.indirect_cost) || 0), 0);

      // Monthly breakdown
      const monthlyData: Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }> = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach(m => { monthlyData[m] = { injuries: 0, nearMiss: 0, propertyDamage: 0, total: 0 }; });
      // Normalize month: support both number ("1"-"12") and text ("Jan"-"Dec")
      const normalizeMonth = (raw: unknown): string | null => {
        if (!raw) return null;
        const s = String(raw).trim();
        // If it's already a valid month name
        if (months.includes(s)) return s;
        // If it's a number (1-12), convert to month name
        const num = parseInt(s);
        if (num >= 1 && num <= 12) return months[num - 1];
        return null;
      };
      incidents.forEach((i: Record<string, unknown>) => {
        const m = normalizeMonth(i.month);
        if (m && monthlyData[m]) {
          monthlyData[m].total++;
          if ((i.incident_type as string)?.includes('บาดเจ็บ') || i.incident_type === 'เสียชีวิต (Fatality)') monthlyData[m].injuries++;
          if (i.incident_type === 'Near Miss') monthlyData[m].nearMiss++;
          if (i.incident_type === 'ทรัพย์สินเสียหาย') monthlyData[m].propertyDamage++;
        }
      });

      // Severity breakdown
      const severityBreakdown: Record<string, number> = {};
      incidents.forEach((i: Record<string, unknown>) => {
        const sev = (i.actual_severity as string) || 'ไม่ระบุ';
        severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
      });

      // Incident type breakdown
      const typeBreakdown: Record<string, number> = {};
      incidents.forEach((i: Record<string, unknown>) => {
        const t = (i.incident_type as string) || 'ไม่ระบุ';
        typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
      });

      // By company (for HQ)
      const byCompany: Record<string, { total: number; injuries: number; lti: number; nearMiss: number; fatality: number }> = {};
      incidents.forEach((i: Record<string, unknown>) => {
        const c = (i.company_id as string) || 'unknown';
        if (!byCompany[c]) byCompany[c] = { total: 0, injuries: 0, lti: 0, nearMiss: 0, fatality: 0 };
        byCompany[c].total++;
        if ((i.incident_type as string)?.includes('บาดเจ็บ') || i.incident_type === 'เสียชีวิต (Fatality)') byCompany[c].injuries++;
        const lt = (i.incident_type as string) || '';
        if ((lt.includes('หยุดงาน') && !lt.includes('ไม่หยุดงาน')) || lt === 'เสียชีวิต (Fatality)') byCompany[c].lti++;
        if (i.incident_type === 'Near Miss') byCompany[c].nearMiss++;
        if (i.incident_type === 'เสียชีวิต (Fatality)' || i.actual_severity === 'S6 เสียชีวิต') byCompany[c].fatality++;
      });

      // Split injuries by person_type: employee vs contractor
      const isContractor = (pt: string | null | undefined) => pt === 'ผู้รับเหมา';
      const isEmployee = (pt: string | null | undefined) => pt !== 'ผู้รับเหมา' && pt !== null && pt !== undefined && pt !== '';

      const employeeInjuries = injuries.filter(i => isEmployee(i.person_type));
      const contractorInjuries = injuries.filter(i => isContractor(i.person_type));
      const employeeLti = ltiCases.filter(i => isEmployee(i.person_type));
      const contractorLti = ltiCases.filter(i => isContractor(i.person_type));

      return NextResponse.json({
        summary: {
          totalIncidents,
          totalInjuries: injuries.length,
          ltiCases: ltiCases.length,
          nearMisses: nearMisses.length,
          propertyDamage: propertyDamage.length,
          fatalities: fatalities.length,
          totalDirectCost,
          totalIndirectCost,
          // Split by person type
          employeeInjuries: employeeInjuries.length,
          contractorInjuries: contractorInjuries.length,
          employeeLti: employeeLti.length,
          contractorLti: contractorLti.length,
        },
        monthlyData,
        severityBreakdown,
        typeBreakdown,
        byCompany,
      });
    }

    if (mode === 'hq') {
      // HQ overview: all companies summary
      let query = supabase.from('incidents').select('company_id, incident_type, actual_severity, year, month, direct_cost, indirect_cost');
      if (year) query = query.eq('year', parseInt(year));

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const incidents = data || [];

      // Get man-hours for TRIR/LTIFR
      let mhQuery = supabase.from('man_hours').select('*');
      if (year) mhQuery = mhQuery.eq('year', parseInt(year));

      const { data: manHoursData } = await mhQuery;
      const manHours = manHoursData || [];

      // Aggregate man-hours by company
      const manHoursByCompany: Record<string, { employee: number; contractor: number; total: number }> = {};
      manHours.forEach((mh: Record<string, unknown>) => {
        const c = mh.company_id as string;
        if (!manHoursByCompany[c]) manHoursByCompany[c] = { employee: 0, contractor: 0, total: 0 };
        manHoursByCompany[c].employee += Number(mh.employee_manhours) || 0;
        manHoursByCompany[c].contractor += Number(mh.contractor_manhours) || 0;
        manHoursByCompany[c].total += (Number(mh.employee_manhours) || 0) + (Number(mh.contractor_manhours) || 0);
      });

      // Build company stats
      const companyStats: Record<string, {
        total: number; injuries: number; lti: number; nearMiss: number;
        propertyDamage: number; fatality: number; directCost: number; indirectCost: number;
        trir: number | null; ltifr: number | null;
      }> = {};

      incidents.forEach((i: Record<string, unknown>) => {
        const c = (i.company_id as string) || 'unknown';
        if (!companyStats[c]) companyStats[c] = {
          total: 0, injuries: 0, lti: 0, nearMiss: 0, propertyDamage: 0, fatality: 0,
          directCost: 0, indirectCost: 0, trir: null, ltifr: null,
        };
        companyStats[c].total++;
        companyStats[c].directCost += Number(i.direct_cost) || 0;
        companyStats[c].indirectCost += Number(i.indirect_cost) || 0;

        const type = i.incident_type as string;
        if (type?.includes('บาดเจ็บ') || type === 'เสียชีวิต (Fatality)') companyStats[c].injuries++;
        if ((type?.includes('หยุดงาน') && !type?.includes('ไม่หยุดงาน')) || type === 'เสียชีวิต (Fatality)') companyStats[c].lti++;
        if (type === 'Near Miss') companyStats[c].nearMiss++;
        if (type === 'ทรัพย์สินเสียหาย') companyStats[c].propertyDamage++;
        if (type === 'เสียชีวิต (Fatality)' || i.actual_severity === 'S6 เสียชีวิต') companyStats[c].fatality++;
      });

      // Calculate TRIR & LTIFR
      Object.keys(companyStats).forEach(c => {
        const mh = manHoursByCompany[c];
        if (mh && mh.total > 0) {
          companyStats[c].trir = (companyStats[c].injuries / mh.total) * 1000000;
          companyStats[c].ltifr = (companyStats[c].lti / mh.total) * 1000000;
        }
      });

      return NextResponse.json({ companyStats, manHoursByCompany });
    }

    // Default: list mode
    let query = supabase.from('incidents').select('*', { count: 'exact' });

    if (companyId) query = query.eq('company_id', companyId);
    if (year) query = query.eq('year', parseInt(year));
    if (month) query = query.eq('month', month);
    if (incidentType) query = query.eq('incident_type', incidentType);
    if (search) {
      query = query.or(`incident_no.ilike.%${search}%,description.ilike.%${search}%,area.ilike.%${search}%`);
    }

    const offset = (page - 1) * limit;
    query = query.order('incident_date', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      incidents: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — create a new incident
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Generate incident_no if not provided
    if (!body.incident_no) {
      const companyId = (body.company_id || '').toUpperCase();
      const date = new Date(body.incident_date);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);

      // Get count for this company/month/year
      const { count } = await supabase
        .from('incidents')
        .select('id', { count: 'exact' })
        .eq('company_id', body.company_id)
        .gte('incident_date', `${date.getFullYear()}-${mm}-01`)
        .lt('incident_date', `${date.getFullYear()}-${String(date.getMonth() + 2).padStart(2, '0')}-01`);

      const seq = String((count || 0) + 1).padStart(3, '0');
      body.incident_no = `${companyId}-${mm}-${yy}-${seq}`;
    }

    // Set computed fields
    if (body.incident_date) {
      const d = new Date(body.incident_date);
      body.year = d.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      body.month = monthNames[d.getMonth()];
      const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
      body.day_of_week = dayNames[d.getDay()];
    }

    body.updated_at = new Date().toISOString();

    // Separate injured persons if included
    const injuredPersons = body.injured_persons;
    delete body.injured_persons;

    const { data, error } = await supabase.from('incidents').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Insert injured persons if any
    if (injuredPersons && Array.isArray(injuredPersons) && injuredPersons.length > 0) {
      const persons = injuredPersons.map((p: Record<string, unknown>, idx: number) => ({
        ...p,
        incident_no: data.incident_no,
        person_order: idx + 1,
      }));
      await supabase.from('injured_persons').insert(persons);
    }

    return NextResponse.json({ incident: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT — update an incident
export async function PUT(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { id, incident_no, ...fields } = body;

    if (!id && !incident_no) {
      return NextResponse.json({ error: 'Missing id or incident_no' }, { status: 400 });
    }

    fields.updated_at = new Date().toISOString();

    // Separate injured persons
    const injuredPersons = fields.injured_persons;
    delete fields.injured_persons;

    let query = supabase.from('incidents').update(fields);
    if (id) query = query.eq('id', id);
    else query = query.eq('incident_no', incident_no);

    const { data, error } = await query.select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update injured persons if provided
    if (injuredPersons && Array.isArray(injuredPersons)) {
      // Delete existing and re-insert
      await supabase.from('injured_persons').delete().eq('incident_no', data.incident_no);
      if (injuredPersons.length > 0) {
        const persons = injuredPersons.map((p: Record<string, unknown>, idx: number) => ({
          ...p,
          incident_no: data.incident_no,
          person_order: idx + 1,
        }));
        await supabase.from('injured_persons').insert(persons);
      }
    }

    return NextResponse.json({ incident: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — delete an incident
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const incidentNo = searchParams.get('incident_no');

    if (!id && !incidentNo) {
      return NextResponse.json({ error: 'Missing id or incident_no' }, { status: 400 });
    }

    let query = supabase.from('incidents').delete();
    if (id) query = query.eq('id', id);
    else query = query.eq('incident_no', incidentNo);

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
