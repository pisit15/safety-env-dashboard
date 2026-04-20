import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { COMPANIES } from '@/lib/companies';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/training/master-export?year=2026&group=Factory&bu=EV&status=completed&dsd=done
 *
 * Export master training plan across ALL companies to Excel (.xlsx)
 * Used by HR for filing with กรมพัฒนาฝีมือแรงงาน (DSD)
 *
 * Returns multi-sheet workbook:
 *   Sheet 1: แผนอบรมรวม — one row per course, all companies
 *   Sheet 2: DSD Tracker — DSD submission status
 *   Sheet 3: สรุปรายบริษัท — per-company KPIs
 */

interface PlanRow {
  id: string;
  company_id: string;
  course_no?: string | number | null;
  course_name: string;
  category: string | null;
  planned_month: number;
  hours_per_course: number | null;
  planned_participants: number | null;
  budget: number | null;
  in_house_external: string | null;
  dsd_eligible: boolean | null;
  is_active?: boolean;
  training_sessions: SessionRow[];
}

interface SessionRow {
  id: string;
  status: string | null;
  scheduled_date_start: string | null;
  scheduled_date_end: string | null;
  actual_cost: number | null;
  actual_participants: number | null;
  actual_hours: number | null;
  instructor_name: string | null;
  training_location: string | null;
  training_method: string | null;
  note: string | null;
  postponed_to_month: number | null;
  original_planned_month: number | null;
  dsd_submitted: boolean | null;
  dsd_submitted_date: string | null;
  dsd_approved: boolean | null;
  dsd_approved_date: string | null;
  dsd_report_submitted: boolean | null;
  dsd_report_submitted_date: string | null;
  dsd_not_submitting: boolean | null;
  dsd_approved_headcount: number | null;
  photos_submitted: boolean | null;
  signin_sheet_submitted: boolean | null;
}

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ''; }
}

function statusLabel(p: PlanRow, currentMonth: number): string {
  const s = p.training_sessions?.[0];
  const rawStatus = s?.status || 'planned';
  const effMonth = s?.postponed_to_month || p.planned_month;
  if (rawStatus === 'completed') return 'อบรมแล้ว';
  if (rawStatus === 'cancelled') return 'ยกเลิก';
  if (s?.scheduled_date_start || rawStatus === 'scheduled') {
    return effMonth < currentMonth ? 'เลยกำหนด' : 'กำหนดวันแล้ว';
  }
  return effMonth < currentMonth ? 'เลยกำหนด' : effMonth === currentMonth ? 'รอดำเนินการ' : 'ยังไม่ถึง';
}

function dsdStageLabel(p: PlanRow): string {
  if (p.dsd_eligible === false) return 'ไม่ต้องยื่น';
  const s = p.training_sessions?.[0];
  if (!s) return 'ยังไม่ยื่น';
  if (s.dsd_not_submitting) return 'เลือกไม่ยื่น';
  if (s.dsd_report_submitted) return 'ยื่น รง.1 แล้ว';
  if (s.dsd_approved) return 'ได้รับอนุมัติ ยป.3';
  if (s.dsd_submitted) return 'ยื่น ยป.1 แล้ว';
  return 'ยังไม่ยื่น';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const groupFilter = searchParams.get('group') || 'all';
    const buFilter = searchParams.get('bu') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const dsdFilter = searchParams.get('dsd') || 'all';

    // Fetch plans for all companies in one query (with sessions joined)
    const { data: allPlans, error: plansErr } = await supabase
      .from('training_plans')
      .select('id, company_id, course_no, course_name, category, planned_month, hours_per_course, planned_participants, budget, in_house_external, dsd_eligible, is_active, training_sessions(*)')
      .eq('year', year)
      .order('company_id', { ascending: true })
      .order('planned_month', { ascending: true });

    if (plansErr) {
      return NextResponse.json({ error: plansErr.message }, { status: 500 });
    }

    const currentMonth = new Date().getMonth() + 1;

    // Build company lookup
    const companyMap = new Map(COMPANIES.map(c => [c.id, c]));

    // Filter & enrich
    type Enriched = PlanRow & {
      companyName: string;
      companyShort: string;
      group: string;
      bu: string;
      session: SessionRow | null;
      effectiveMonth: number;
      statusStr: string;
      dsdStage: string;
      dsdKey: string;
    };

    const enriched: Enriched[] = [];
    for (const rawPlan of (allPlans || [])) {
      const p = rawPlan as unknown as PlanRow;
      const company = companyMap.get(p.company_id);
      if (!company) continue;

      // Group / BU filter
      if (groupFilter !== 'all' && (company.group || '') !== groupFilter) continue;
      if (buFilter !== 'all' && (company.bu || '') !== buFilter) continue;

      const s = p.training_sessions?.[0] || null;
      const effMonth = s?.postponed_to_month || p.planned_month;
      const statusStr = statusLabel(p, currentMonth);
      const dsdStage = dsdStageLabel(p);

      // Status filter
      if (statusFilter !== 'all') {
        const cmp =
          statusFilter === 'completed' ? 'อบรมแล้ว' :
          statusFilter === 'scheduled' ? 'กำหนดวันแล้ว' :
          statusFilter === 'pending' ? ['รอดำเนินการ', 'ยังไม่ถึง'] :
          statusFilter === 'overdue' ? 'เลยกำหนด' : '';
        if (Array.isArray(cmp)) {
          if (!cmp.includes(statusStr)) continue;
        } else if (cmp && statusStr !== cmp) {
          continue;
        }
      }

      // DSD filter (short keys)
      let dsdKey = 'not_started';
      if (p.dsd_eligible === false) dsdKey = 'not_eligible';
      else if (s?.dsd_not_submitting) dsdKey = 'not_submitting';
      else if (s?.dsd_report_submitted) dsdKey = 'reported';
      else if (s?.dsd_approved) dsdKey = 'approved';
      else if (s?.dsd_submitted) dsdKey = 'submitted';

      if (dsdFilter !== 'all') {
        if (p.dsd_eligible === false) continue;
        if (dsdFilter === 'need_submit' && dsdKey !== 'not_started') continue;
        if (dsdFilter === 'need_approve' && dsdKey !== 'submitted') continue;
        if (dsdFilter === 'need_report' && dsdKey !== 'approved') continue;
        if (dsdFilter === 'done' && dsdKey !== 'reported') continue;
      }

      enriched.push({
        ...p,
        companyName: company.name,
        companyShort: company.shortName,
        group: company.group || '',
        bu: company.bu || '',
        session: s,
        effectiveMonth: effMonth,
        statusStr,
        dsdStage,
        dsdKey,
      });
    }

    // Sort: group → company → month → course
    enriched.sort((a, b) => {
      if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
      if (a.companyShort !== b.companyShort) return a.companyShort.localeCompare(b.companyShort);
      if (a.effectiveMonth !== b.effectiveMonth) return a.effectiveMonth - b.effectiveMonth;
      return a.course_name.localeCompare(b.course_name);
    });

    // ── Build workbook ─────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EA SHE Dashboard';
    wb.created = new Date();

    const navy = 'FF0A2540';
    const purple = 'FF635BFF';
    const softBlue = 'FFE6EEF7';
    const softGreen = 'FFE8F3EA';
    const softRed = 'FFF7E1DD';
    const softGray = 'FFF6F7F9';
    const white = 'FFFFFFFF';

    const headerStyle = (color = navy): Partial<ExcelJS.Style> => ({
      font: { bold: true, color: { argb: white }, size: 11, name: 'Calibri' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      },
    });

    const zebraFill: Partial<ExcelJS.Style> = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softGray } },
    };

    // ═══════════ Sheet 1: แผนอบรมรวม ═══════════
    const ws1 = wb.addWorksheet('แผนอบรมรวม', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    });

    ws1.columns = [
      { header: 'บริษัท', key: 'company', width: 14 },
      { header: 'BU', key: 'bu', width: 14 },
      { header: 'หลักสูตร', key: 'course', width: 38 },
      { header: 'หมวดหมู่', key: 'category', width: 14 },
      { header: 'In/Ext', key: 'in_house_external', width: 12 },
      { header: 'เดือนแผน', key: 'month', width: 10 },
      { header: 'วันที่อบรม', key: 'date', width: 14 },
      { header: 'ชม.', key: 'hours', width: 7 },
      { header: 'แผน (คน)', key: 'planned_pax', width: 10 },
      { header: 'จริง (คน)', key: 'actual_pax', width: 10 },
      { header: 'งบประมาณ', key: 'budget', width: 13 },
      { header: 'ใช้จริง', key: 'actual_cost', width: 13 },
      { header: 'สถานะ', key: 'status', width: 14 },
      { header: 'DSD', key: 'dsd', width: 20 },
      { header: 'วิทยากร', key: 'instructor', width: 22 },
      { header: 'สถานที่', key: 'location', width: 20 },
    ];

    ws1.getRow(1).height = 32;
    ws1.getRow(1).eachCell((cell) => { cell.style = headerStyle(navy) as ExcelJS.Style; });

    enriched.forEach((p, idx) => {
      const s = p.session;
      const row = ws1.addRow({
        company: p.companyShort,
        bu: p.bu,
        course: p.course_name,
        category: p.category || '',
        in_house_external: p.in_house_external || '',
        month: MONTH_LABELS[p.effectiveMonth - 1] || '',
        date: s?.scheduled_date_start ? fmtDate(s.scheduled_date_start) : '',
        hours: p.hours_per_course || 0,
        planned_pax: p.planned_participants || 0,
        actual_pax: s?.actual_participants || '',
        budget: p.budget || 0,
        actual_cost: s?.actual_cost || '',
        status: p.statusStr,
        dsd: p.dsdStage,
        instructor: s?.instructor_name || '',
        location: s?.training_location || '',
      });

      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = 22;

      if (idx % 2 === 1) {
        row.eachCell((cell) => { cell.fill = zebraFill.fill as ExcelJS.Fill; });
      }

      // Status cell colored background
      const statusCell = row.getCell('status');
      const statusColors: Record<string, string> = {
        'อบรมแล้ว': softGreen,
        'กำหนดวันแล้ว': softBlue,
        'เลยกำหนด': softRed,
      };
      const sc = statusColors[p.statusStr];
      if (sc) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } };
        statusCell.font = { bold: true, color: { argb: navy } };
      }

      // Number formats
      row.getCell('budget').numFmt = '#,##0';
      row.getCell('actual_cost').numFmt = '#,##0';
      row.getCell('hours').numFmt = '0.0';

      // Highlight company column
      row.getCell('company').font = { bold: true, color: { argb: navy } };
    });

    // Bottom border line
    ws1.eachRow((row) => {
      row.eachCell((cell) => {
        if (!cell.border) {
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
        }
      });
    });

    // ═══════════ Sheet 2: DSD Tracker ═══════════
    const ws2 = wb.addWorksheet('DSD Tracker', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    });

    ws2.columns = [
      { header: 'บริษัท', key: 'company', width: 14 },
      { header: 'BU', key: 'bu', width: 14 },
      { header: 'หลักสูตร', key: 'course', width: 38 },
      { header: 'วันที่อบรม', key: 'date', width: 14 },
      { header: 'จำนวน (คน)', key: 'pax', width: 12 },
      { header: 'ยื่น ยป.1', key: 'submitted', width: 14 },
      { header: 'วันที่ ยป.1', key: 'submitted_date', width: 14 },
      { header: 'ได้รับ ยป.3', key: 'approved', width: 14 },
      { header: 'วันที่ ยป.3', key: 'approved_date', width: 14 },
      { header: 'จำนวนอนุมัติ', key: 'approved_headcount', width: 13 },
      { header: 'ยื่น รง.1', key: 'report_submitted', width: 14 },
      { header: 'วันที่ รง.1', key: 'report_date', width: 14 },
      { header: 'รูปถ่าย', key: 'photos', width: 10 },
      { header: 'ใบลงชื่อ', key: 'signin', width: 10 },
      { header: 'สถานะ DSD', key: 'stage', width: 22 },
    ];

    ws2.getRow(1).height = 32;
    ws2.getRow(1).eachCell((cell) => { cell.style = headerStyle(purple) as ExcelJS.Style; });

    const dsdEligible = enriched.filter(p => p.dsd_eligible !== false && !p.session?.dsd_not_submitting);
    dsdEligible.forEach((p, idx) => {
      const s = p.session;
      const row = ws2.addRow({
        company: p.companyShort,
        bu: p.bu,
        course: p.course_name,
        date: s?.scheduled_date_start ? fmtDate(s.scheduled_date_start) : '',
        pax: p.planned_participants || 0,
        submitted: s?.dsd_submitted ? '✓' : '',
        submitted_date: s?.dsd_submitted_date ? fmtDate(s.dsd_submitted_date) : '',
        approved: s?.dsd_approved ? '✓' : '',
        approved_date: s?.dsd_approved_date ? fmtDate(s.dsd_approved_date) : '',
        approved_headcount: s?.dsd_approved_headcount || '',
        report_submitted: s?.dsd_report_submitted ? '✓' : '',
        report_date: s?.dsd_report_submitted_date ? fmtDate(s.dsd_report_submitted_date) : '',
        photos: s?.photos_submitted ? '✓' : '',
        signin: s?.signin_sheet_submitted ? '✓' : '',
        stage: p.dsdStage,
      });

      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = 20;

      if (idx % 2 === 1) {
        row.eachCell((cell) => { cell.fill = zebraFill.fill as ExcelJS.Fill; });
      }

      // Check marks centered + colored
      ['submitted', 'approved', 'report_submitted', 'photos', 'signin'].forEach((key) => {
        const cell = row.getCell(key);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (cell.value === '✓') {
          cell.font = { bold: true, color: { argb: 'FF2B8C3E' } };
        }
      });

      row.getCell('company').font = { bold: true, color: { argb: navy } };
    });

    // ═══════════ Sheet 3: สรุปรายบริษัท ═══════════
    const ws3 = wb.addWorksheet('สรุปรายบริษัท');
    ws3.columns = [
      { header: 'บริษัท', key: 'company', width: 14 },
      { header: 'กลุ่ม', key: 'group', width: 14 },
      { header: 'BU', key: 'bu', width: 14 },
      { header: 'หลักสูตรทั้งหมด', key: 'total', width: 14 },
      { header: 'อบรมแล้ว', key: 'completed', width: 12 },
      { header: 'กำหนดวัน', key: 'scheduled', width: 12 },
      { header: 'เลยกำหนด', key: 'overdue', width: 12 },
      { header: 'ยังไม่ถึง', key: 'upcoming', width: 12 },
      { header: '% สำเร็จ', key: 'pct', width: 10 },
      { header: 'DSD: ยื่น ยป.1', key: 'dsd_submitted', width: 14 },
      { header: 'DSD: อนุมัติ', key: 'dsd_approved', width: 14 },
      { header: 'DSD: ยื่น รง.1', key: 'dsd_reported', width: 14 },
    ];

    ws3.getRow(1).height = 32;
    ws3.getRow(1).eachCell((cell) => { cell.style = headerStyle(navy) as ExcelJS.Style; });

    // Group by company
    const byCompany = new Map<string, Enriched[]>();
    for (const p of enriched) {
      const list = byCompany.get(p.company_id) || [];
      list.push(p);
      byCompany.set(p.company_id, list);
    }

    const summary: {
      company: string; group: string; bu: string;
      total: number; completed: number; scheduled: number; overdue: number; upcoming: number;
      pct: number;
      dsd_submitted: number; dsd_approved: number; dsd_reported: number;
    }[] = [];

    Array.from(byCompany.values()).forEach((plans: Enriched[]) => {
      const first = plans[0];
      const total = plans.length;
      const completed = plans.filter((p: Enriched) => p.statusStr === 'อบรมแล้ว').length;
      const scheduled = plans.filter((p: Enriched) => p.statusStr === 'กำหนดวันแล้ว').length;
      const overdue = plans.filter((p: Enriched) => p.statusStr === 'เลยกำหนด').length;
      const upcoming = plans.filter((p: Enriched) => p.statusStr === 'ยังไม่ถึง' || p.statusStr === 'รอดำเนินการ').length;
      const eligible = plans.filter((p: Enriched) => p.dsd_eligible !== false && !p.session?.dsd_not_submitting);
      const dsd_submitted = eligible.filter((p: Enriched) => ['submitted', 'approved', 'reported'].includes(p.dsdKey)).length;
      const dsd_approved = eligible.filter((p: Enriched) => ['approved', 'reported'].includes(p.dsdKey)).length;
      const dsd_reported = eligible.filter((p: Enriched) => p.dsdKey === 'reported').length;
      summary.push({
        company: first.companyShort,
        group: first.group,
        bu: first.bu,
        total, completed, scheduled, overdue, upcoming,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
        dsd_submitted, dsd_approved, dsd_reported,
      });
    });
    summary.sort((a, b) => (a.group !== b.group ? a.group.localeCompare(b.group) : a.company.localeCompare(b.company)));

    summary.forEach((r, idx) => {
      const row = ws3.addRow({
        company: r.company, group: r.group, bu: r.bu,
        total: r.total, completed: r.completed, scheduled: r.scheduled,
        overdue: r.overdue, upcoming: r.upcoming,
        pct: r.pct / 100,
        dsd_submitted: r.dsd_submitted, dsd_approved: r.dsd_approved, dsd_reported: r.dsd_reported,
      });
      row.alignment = { vertical: 'middle' };
      row.height = 22;
      if (idx % 2 === 1) {
        row.eachCell((cell) => { cell.fill = zebraFill.fill as ExcelJS.Fill; });
      }
      row.getCell('company').font = { bold: true, color: { argb: navy } };
      row.getCell('pct').numFmt = '0%';
      if (r.overdue > 0) {
        row.getCell('overdue').font = { bold: true, color: { argb: 'FFC23B22' } };
      }
    });

    // Grand total row
    if (summary.length > 0) {
      const tot = summary.reduce((acc, r) => ({
        total: acc.total + r.total,
        completed: acc.completed + r.completed,
        scheduled: acc.scheduled + r.scheduled,
        overdue: acc.overdue + r.overdue,
        upcoming: acc.upcoming + r.upcoming,
        dsd_submitted: acc.dsd_submitted + r.dsd_submitted,
        dsd_approved: acc.dsd_approved + r.dsd_approved,
        dsd_reported: acc.dsd_reported + r.dsd_reported,
      }), { total: 0, completed: 0, scheduled: 0, overdue: 0, upcoming: 0, dsd_submitted: 0, dsd_approved: 0, dsd_reported: 0 });
      const totalRow = ws3.addRow({
        company: 'รวมทั้งหมด',
        group: '', bu: '',
        total: tot.total,
        completed: tot.completed,
        scheduled: tot.scheduled,
        overdue: tot.overdue,
        upcoming: tot.upcoming,
        pct: tot.total > 0 ? tot.completed / tot.total : 0,
        dsd_submitted: tot.dsd_submitted,
        dsd_approved: tot.dsd_approved,
        dsd_reported: tot.dsd_reported,
      });
      totalRow.font = { bold: true, color: { argb: white } };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } };
      totalRow.height = 26;
      totalRow.getCell('pct').numFmt = '0%';
    }

    // ── Output ──
    const buffer = await wb.xlsx.writeBuffer();

    const filterHint = [
      groupFilter !== 'all' && groupFilter,
      buFilter !== 'all' && buFilter,
      statusFilter !== 'all' && statusFilter,
      dsdFilter !== 'all' && dsdFilter,
    ].filter(Boolean).join('-');
    const fname = `training-master-${year}${filterHint ? '-' + filterHint : ''}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Master export error:', err);
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
