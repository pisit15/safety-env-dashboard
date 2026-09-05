import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { COMPANIES } from '@/lib/companies';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

/**
 * Export แผนอบรมประจำปี (จาก plan builder / training_plans)
 * GET ?year=2027&format=survey&companyId=amt → แบบสำรวจรายบริษัท (1 sheet)
 * GET ?year=2027&format=survey            → ทุกบริษัท (Summary + sheet ละบริษัท)
 * GET ?year=2027&format=matrix            → ตารางไขว้ หลักสูตร (เรียงตาม master) × บริษัท = จำนวนคน, N ถ้าไม่จัด
 */

interface MasterRow { sort_order: number; category: string; course_name: string }
interface PlanRow {
  company_id: string; course_no: number | null; category: string | null; course_name: string;
  in_house_external: string | null; planned_month: number | null; hours_per_course: number | null;
  planned_participants: number | null; total_planned_hours: number | null; budget: number | null;
  target_group: string | null; training_necessity: string | null; is_active: boolean | null;
}

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
const HEAD_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
};

function companyName(cid: string): string {
  return COMPANIES.find(c => c.id === cid)?.shortName || COMPANIES.find(c => c.id === cid)?.name || cid.toUpperCase();
}

function buildSurveySheet(wb: ExcelJS.Workbook, cid: string, year: number, master: MasterRow[], plans: PlanRow[]) {
  const sheetName = companyName(cid).replace(/[\\/*?:[\]]/g, '').slice(0, 28) || cid;
  const ws = wb.addWorksheet(sheetName);
  ws.addRow([`แบบสำรวจความจำเป็นในการฝึกอบรม ประจำปี ${year}`]);
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.addRow(['ชื่อบริษัท หรือหน่วยงาน', companyName(cid)]);
  ws.getRow(2).font = { bold: true, size: 11 };
  ws.addRow([]);
  const header = ['No.', 'หมวด', 'In-House / External', 'ชื่อหลักสูตร', 'ระบุความจำเป็นที่ต้องพัฒนา', 'จำนวน (ชั่วโมง)', 'จำนวน (คน)', 'รวม (ชั่วโมง)', 'กลุ่มเป้าหมาย', 'เดือนแผน', 'งบประมาณ (บาท)'];
  const hr = ws.addRow(header);
  hr.eachCell(c => { c.fill = HEAD_FILL; c.font = HEAD_FONT; c.border = thinBorder; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });

  // เรียงตามลำดับ master — หลักสูตรที่ไม่จัดข้ามไปแต่คงเลข No. ตาม master
  const byName: Record<string, PlanRow> = {};
  plans.filter(p => p.company_id === cid && p.is_active !== false).forEach(p => { byName[norm(p.course_name)] = p; });
  const usedNames = new Set<string>();
  master.forEach(m => {
    const p = byName[norm(m.course_name)];
    if (!p) return;
    usedNames.add(norm(m.course_name));
    const row = ws.addRow([
      m.sort_order, m.category, p.in_house_external || '', m.course_name,
      p.training_necessity || '', Number(p.hours_per_course) || 0, Number(p.planned_participants) || 0,
      Number(p.total_planned_hours) || (Number(p.hours_per_course) || 0) * (Number(p.planned_participants) || 0),
      p.target_group || '', p.planned_month ? TH_MONTHS[p.planned_month - 1] : '', Number(p.budget) || 0,
    ]);
    row.eachCell(c => { c.border = thinBorder; c.alignment = { vertical: 'top', wrapText: true }; });
  });
  // หลักสูตรนอก master (เช่น แผนปีเก่า) — ต่อท้าย
  const extras = plans.filter(p => p.company_id === cid && p.is_active !== false && !usedNames.has(norm(p.course_name)));
  extras.forEach(p => {
    const row = ws.addRow([
      p.course_no || '', p.category || '', p.in_house_external || '', p.course_name,
      p.training_necessity || '', Number(p.hours_per_course) || 0, Number(p.planned_participants) || 0,
      Number(p.total_planned_hours) || 0, p.target_group || '', p.planned_month ? TH_MONTHS[p.planned_month - 1] : '', Number(p.budget) || 0,
    ]);
    row.eachCell(c => { c.border = thinBorder; c.alignment = { vertical: 'top', wrapText: true }; });
  });

  const widths = [6, 22, 14, 46, 40, 10, 10, 10, 26, 10, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return ws;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || '', 10);
    const format = sp.get('format') || 'survey';
    const companyId = sp.get('companyId');
    if (!Number.isFinite(year)) return NextResponse.json({ error: 'Missing year' }, { status: 400 });

    const sb = getSupabase();
    const [masterRes, plansRes] = await Promise.all([
      sb.from('training_course_master').select('sort_order, category, course_name').eq('is_active', true).order('sort_order', { ascending: true }),
      sb.from('training_plans').select('company_id, course_no, category, course_name, in_house_external, planned_month, hours_per_course, planned_participants, total_planned_hours, budget, target_group, training_necessity, is_active').eq('year', year),
    ]);
    if (masterRes.error) throw masterRes.error;
    if (plansRes.error) throw plansRes.error;
    const master = (masterRes.data || []) as MasterRow[];
    const plans = (plansRes.data || []) as PlanRow[];
    const activePlans = plans.filter(p => p.is_active !== false);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'EA SHE Dashboard';

    if (format === 'matrix') {
      // ตารางไขว้: หลักสูตร (เรียง master) × บริษัท = จำนวนคน, ไม่จัด = N
      const compIds = COMPANIES.map(c => c.id).filter(cid => activePlans.some(p => p.company_id === cid));
      const ws = wb.addWorksheet(`แผนอบรม ${year}`);
      ws.addRow([`${year} EA Training Plan Summary — จำนวนผู้เข้าอบรม (คน) · N = ไม่จัด`]);
      ws.getRow(1).font = { bold: true, size: 13 };
      const hr = ws.addRow(['No', 'หมวด', 'ชื่อหลักสูตร', ...compIds.map(companyName)]);
      hr.eachCell(c => { c.fill = HEAD_FILL; c.font = HEAD_FONT; c.border = thinBorder; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });

      const byCompanyName: Record<string, Record<string, PlanRow>> = {};
      activePlans.forEach(p => {
        byCompanyName[p.company_id] = byCompanyName[p.company_id] || {};
        byCompanyName[p.company_id][norm(p.course_name)] = p;
      });
      const usedNames = new Set<string>();
      master.forEach(m => {
        usedNames.add(norm(m.course_name));
        const row = ws.addRow([
          m.sort_order, m.category, m.course_name,
          ...compIds.map(cid => {
            const p = byCompanyName[cid]?.[norm(m.course_name)];
            return p ? (Number(p.planned_participants) || 0) : 'N';
          }),
        ]);
        row.eachCell((c, col) => {
          c.border = thinBorder;
          if (col > 3) {
            c.alignment = { horizontal: 'center' };
            if (c.value === 'N') c.font = { color: { argb: 'FFBBBBBB' }, size: 10 };
          } else c.alignment = { vertical: 'top', wrapText: true };
        });
      });
      // หลักสูตรนอก master
      const extraNames = Array.from(new Set(activePlans.filter(p => !usedNames.has(norm(p.course_name))).map(p => norm(p.course_name))));
      if (extraNames.length > 0) {
        const sep = ws.addRow(['', '', `หลักสูตรนอก Master (${extraNames.length})`]);
        sep.font = { bold: true, italic: true };
        extraNames.forEach(nm => {
          const anyPlan = activePlans.find(p => norm(p.course_name) === nm);
          const row = ws.addRow(['', anyPlan?.category || '', anyPlan?.course_name || nm,
            ...compIds.map(cid => {
              const p = byCompanyName[cid]?.[nm];
              return p ? (Number(p.planned_participants) || 0) : 'N';
            })]);
          row.eachCell((c, col) => { c.border = thinBorder; if (col > 3) c.alignment = { horizontal: 'center' }; else c.alignment = { wrapText: true }; });
        });
      }
      // แถวรวม
      const totalRow = ws.addRow(['', '', 'รวมผู้เข้าอบรม (คน)',
        ...compIds.map(cid => activePlans.filter(p => p.company_id === cid).reduce((s, p) => s + (Number(p.planned_participants) || 0), 0))]);
      totalRow.font = { bold: true };
      totalRow.eachCell(c => { c.border = thinBorder; });
      ws.getColumn(1).width = 5; ws.getColumn(2).width = 20; ws.getColumn(3).width = 48;
      compIds.forEach((_, i) => { ws.getColumn(4 + i).width = 10; });
    } else {
      // format=survey
      if (companyId) {
        buildSurveySheet(wb, companyId, year, master, plans);
      } else {
        // Summary + sheet ละบริษัท
        const compIds = COMPANIES.map(c => c.id).filter(cid => activePlans.some(p => p.company_id === cid));
        const sum = wb.addWorksheet('Summary');
        sum.addRow([`สรุปข้อมูลแผนการฝึกอบรมแต่ละบริษัท ปี ${year}`]);
        sum.getRow(1).font = { bold: true, size: 13 };
        const shr = sum.addRow(['บริษัท', 'จำนวนหลักสูตร', 'ผู้เข้าอบรมรวม (คน)', 'รวม (ชม.-คน)', 'งบประมาณรวม (บาท)']);
        shr.eachCell(c => { c.fill = HEAD_FILL; c.font = HEAD_FONT; c.border = thinBorder; c.alignment = { horizontal: 'center' }; });
        compIds.forEach(cid => {
          const cp = activePlans.filter(p => p.company_id === cid);
          const row = sum.addRow([
            companyName(cid), cp.length,
            cp.reduce((s, p) => s + (Number(p.planned_participants) || 0), 0),
            cp.reduce((s, p) => s + (Number(p.total_planned_hours) || 0), 0),
            cp.reduce((s, p) => s + (Number(p.budget) || 0), 0),
          ]);
          row.eachCell(c => { c.border = thinBorder; });
        });
        [18, 14, 18, 14, 18].forEach((w, i) => { sum.getColumn(i + 1).width = w; });
        compIds.forEach(cid => buildSurveySheet(wb, cid, year, master, plans));
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const fname = format === 'matrix'
      ? `training-plan-matrix-${year}.xlsx`
      : `training-needs-survey-${year}${companyId ? '-' + companyId : ''}.xlsx`;
    return new NextResponse(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Export failed', detail: msg }, { status: 500 });
  }
}
