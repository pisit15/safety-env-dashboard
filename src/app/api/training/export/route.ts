import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/training/export?companyId=amt&year=2026
 *
 * Export training plans + attendees to Excel (.xlsx)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Fetch training plans
    const { data: plans, error: plansErr } = await supabase
      .from('training_plans')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .order('planned_month', { ascending: true });

    if (plansErr) {
      return NextResponse.json({ error: plansErr.message }, { status: 500 });
    }

    // Fetch all attendees for this company+year
    const planIds = (plans || []).map((p) => p.id);
    let attendees: Record<string, unknown>[] = [];
    if (planIds.length > 0) {
      const BATCH = 200;
      for (let i = 0; i < planIds.length; i += BATCH) {
        const batch = planIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from('training_attendees')
          .select('*')
          .in('plan_id', batch);
        if (data) attendees.push(...data);
      }
    }

    // Build workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EA SHE Dashboard';
    wb.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      },
    };

    // ── Sheet 1: Training Plans ──
    const ws = wb.addWorksheet('Training Plans', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'ลำดับ', key: 'no', width: 8 },
      { header: 'หลักสูตร', key: 'course_name', width: 40 },
      { header: 'หมวดหมู่', key: 'category', width: 16 },
      { header: 'ชั่วโมง/หลักสูตร', key: 'hours_per_course', width: 14 },
      { header: 'In-house/External', key: 'in_house_external', width: 16 },
      { header: 'เดือนที่กำหนด', key: 'planned_month', width: 14 },
      { header: 'จำนวนผู้เข้าอบรม', key: 'attendee_count', width: 16 },
      { header: 'สถานะ', key: 'status', width: 12 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.style = headerStyle as ExcelJS.Style;
    });
    ws.getRow(1).height = 28;

    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    (plans || []).forEach((plan, idx) => {
      const attendeeCount = attendees.filter(
        (a: Record<string, unknown>) => a.plan_id === plan.id
      ).length;

      const monthStr = plan.planned_month
        ? monthNames[(parseInt(plan.planned_month) || 1) - 1] || plan.planned_month
        : '';

      const row = ws.addRow({
        no: idx + 1,
        course_name: plan.course_name || '',
        category: plan.category || '',
        hours_per_course: plan.hours_per_course || 0,
        in_house_external: plan.in_house_external || '',
        planned_month: monthStr,
        attendee_count: attendeeCount,
        status: attendeeCount > 0 ? 'มีผู้เข้าอบรม' : 'ยังไม่มี',
      });

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: 'FFF0F9FF' },
          };
        });
      }
    });

    // Summary row
    const totalRow = ws.addRow({
      no: '',
      course_name: `รวม ${(plans || []).length} หลักสูตร`,
      category: '',
      hours_per_course: '',
      in_house_external: '',
      planned_month: '',
      attendee_count: attendees.length,
      status: '',
    });
    totalRow.font = { bold: true };

    // ── Sheet 2: Attendees ──
    if (attendees.length > 0) {
      const ws2 = wb.addWorksheet('Attendees', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      // Build plan lookup
      const planMap: Record<string, string> = {};
      (plans || []).forEach((p) => { planMap[p.id] = p.course_name || ''; });

      ws2.columns = [
        { header: 'หลักสูตร', key: 'course_name', width: 35 },
        { header: 'รหัสพนักงาน', key: 'emp_code', width: 14 },
        { header: 'ชื่อ', key: 'first_name', width: 16 },
        { header: 'นามสกุล', key: 'last_name', width: 16 },
        { header: 'ตำแหน่ง', key: 'position', width: 18 },
        { header: 'แผนก', key: 'department', width: 18 },
        { header: 'ชั่วโมงเข้าอบรม', key: 'hours_attended', width: 14 },
      ];

      const headerStyle2: Partial<ExcelJS.Style> = {
        ...headerStyle,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06B6D4' } },
      };
      ws2.getRow(1).eachCell((cell) => {
        cell.style = headerStyle2 as ExcelJS.Style;
      });
      ws2.getRow(1).height = 28;

      attendees.forEach((att: Record<string, unknown>, idx) => {
        const row = ws2.addRow({
          course_name: planMap[att.plan_id as string] || '',
          emp_code: att.emp_code || '',
          first_name: att.first_name || '',
          last_name: att.last_name || '',
          position: att.position || '',
          department: att.department || '',
          hours_attended: att.hours_attended || 0,
        });

        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern', pattern: 'solid',
              fgColor: { argb: 'FFF0FDFA' },
            };
          });
        }
      });
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="training-${companyId}-${year}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Training export error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
