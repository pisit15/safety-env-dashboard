import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET — fetch SHE personnel across ALL companies for super admin view
 * Returns: { personnel, companyStats }
 */
export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Fetch all personnel
    const { data: personnel, error: pErr } = await supabase
      .from('she_personnel')
      .select('*')
      .order('company_id')
      .order('full_name');

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // Fetch all requirements (for compliance calc)
    const { data: requirements } = await supabase
      .from('legal_requirement_types')
      .select('*')
      .eq('is_active', true);

    // Fetch all licenses
    const { data: licenses } = await supabase
      .from('personnel_licenses')
      .select('*');

    // Fetch latest employee count per company from manhours
    const currentYear = new Date().getFullYear();
    const { data: manhours } = await supabase
      .from('man_hours')
      .select('company_id, employee_count, month')
      .eq('year', currentYear)
      .order('month', { ascending: false });

    // Dedupe manhours — keep latest month per company
    const latestMH: Record<string, number> = {};
    (manhours || []).forEach((m: Record<string, unknown>) => {
      const cid = m.company_id as string;
      if (!latestMH[cid]) latestMH[cid] = (m.employee_count as number) || 0;
    });

    // Build per-company stats
    const companyIds = Array.from(new Set((personnel || []).map((p: Record<string, unknown>) => p.company_id as string)));
    const companyStats = companyIds.map(cid => {
      const pList = (personnel || []).filter((p: Record<string, unknown>) => p.company_id === cid);
      const reqList = (requirements || []).filter((r: Record<string, unknown>) => r.company_id === cid);
      const requiredReqs = reqList.filter((r: Record<string, unknown>) => r.is_required);
      const complianceMet = requiredReqs.filter((req: Record<string, unknown>) => {
        const held = (licenses || []).filter((l: Record<string, unknown>) => l.requirement_type_id === req.id && l.has_license).length;
        const needed = (req.required_count as number) || 0;
        return needed === 0 ? held > 0 : held >= needed;
      }).length;
      const complianceRate = requiredReqs.length > 0 ? Math.round((complianceMet / requiredReqs.length) * 100) : 100;

      const empCount = latestMH[cid] || 0;
      const sheCount = pList.length;
      const ratio = empCount > 0 && sheCount > 0 ? Math.round(empCount / sheCount) : 0;

      return {
        company_id: cid,
        sheCount,
        employeeCount: empCount,
        ratio,
        complianceRate,
        requiredTotal: requiredReqs.length,
        complianceMet,
      };
    });

    return NextResponse.json({
      personnel: personnel || [],
      companyStats,
      total: (personnel || []).length,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
