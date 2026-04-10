import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';
import { DEFAULT_YEAR } from '@/lib/companies';
import { getCompanyForYearWithDb } from '@/lib/company-settings';
import { fetchActivities, MONTH_KEYS, MONTH_LABELS } from '@/lib/sheets';
import { Activity } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  done: 'เสร็จแล้ว',
  postponed: 'เลื่อน',
  cancelled: 'ยกเลิก',
  not_applicable: 'ไม่เข้าเงื่อนไข',
  overdue: 'เกินกำหนด',
  planned: 'มีแผน',
  not_planned: '-',
  not_started: 'ยังไม่เริ่ม',
};

const STATUS_COLORS: Record<string, string> = {
  done: 'FF4ADE80',
  postponed: 'FF60A5FA',
  cancelled: 'FFF87171',
  not_applicable: 'FF71717A',
  overdue: 'FFFB923C',
  planned: 'FFE4E4E7',
  not_planned: 'FFFFFFFF',
};

function addPlanSheet(
  workbook: ExcelJS.Workbook,
  sheetTitle: string,
  activities: Activity[],
  overrideMap: Record<string, string>
) {
  const ws = workbook.addWorksheet(sheetTitle);

  // Header row
  const headers = ['ลำดับ', 'กิจกรรม', 'ผู้รับผิดชอบ'];
  MONTH_KEYS.forEach(k => headers.push(MONTH_LABELS[k]));
  headers.push('เป้าหมาย', 'สถานะรวม');

  const headerRow = ws.addRow(headers);
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;

  // Column widths
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 45;
  ws.getColumn(3).width = 15;
  for (let i = 4; i <= 15; i++) ws.getColumn(i).width = 10;
  ws.getColumn(16).width = 20;
  ws.getColumn(17).width = 14;

  // Data rows
  activities.forEach(act => {
    const rowData: (string | number)[] = [act.no, act.activity, act.responsible];

    MONTH_KEYS.forEach(k => {
      const overrideKey = `${act.no}:${k}`;
      const overrideStatus = overrideMap[overrideKey];
      const autoStatus = act.monthStatuses?.[k] || 'not_planned';
      const finalStatus = overrideStatus || autoStatus;
      rowData.push(STATUS_LABELS[finalStatus] || '-');
    });

    rowData.push(act.target, STATUS_LABELS[act.status] || act.status);

    const row = ws.addRow(rowData);
    row.alignment = { vertical: 'middle', wrapText: true };

    // Color the month cells
    MONTH_KEYS.forEach((k, idx) => {
      const overrideKey = `${act.no}:${k}`;
      const overrideStatus = overrideMap[overrideKey];
      const autoStatus = act.monthStatuses?.[k] || 'not_planned';
      const finalStatus = overrideStatus || autoStatus;
      const color = STATUS_COLORS[finalStatus];

      if (color && finalStatus !== 'not_planned') {
        const cell = row.getCell(4 + idx);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (finalStatus === 'done') {
          cell.font = { bold: true };
        }
      }
    });
  });

  // Add borders
  ws.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const planType = searchParams.get('planType') || 'safety';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  }

  const company = await getCompanyForYearWithDb(companyId, year);
  if (!company || !company.sheetId) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const planTypes: ('safety' | 'environment')[] = planType === 'total'
      ? ['safety', 'environment']
      : [planType as 'safety' | 'environment'];

    for (const pt of planTypes) {
      const sheetName = pt === 'safety' ? company.safetySheet : company.enviSheet;
      const activities = await fetchActivities(company, sheetName);

      // Fetch status overrides
      const { data: overrides } = await getSupabase()
        .from('status_overrides')
        .select('*')
        .eq('company_id', companyId)
        .eq('plan_type', pt);

      const overrideMap: Record<string, string> = {};
      (overrides || []).forEach((o: any) => {
        overrideMap[`${o.activity_no}:${o.month}`] = o.status;
      });

      const title = `${company.shortName} ${pt === 'safety' ? 'Safety' : 'Environment'} Plan`;
      addPlanSheet(workbook, title, activities, overrideMap);
    }

    // Legend sheet
    const legendWs = workbook.addWorksheet('สัญลักษณ์');
    legendWs.addRow(['สถานะ', 'ความหมาย']);
    legendWs.addRow(['เสร็จแล้ว', 'ดำเนินการเสร็จสิ้นในเดือนนั้น']);
    legendWs.addRow(['เกินกำหนด', 'มีแผนแต่ยังไม่ได้ดำเนินการ (เลยกำหนดแล้ว)']);
    legendWs.addRow(['มีแผน', 'มีแผนจะดำเนินการ (ยังไม่ถึงกำหนด)']);
    legendWs.addRow(['เลื่อน', 'เลื่อนออกไป']);
    legendWs.addRow(['ยกเลิก', 'ยกเลิกการดำเนินการ']);
    legendWs.addRow(['ไม่เข้าเงื่อนไข', 'ไม่เข้าเงื่อนไขที่ต้องดำเนินการ']);
    legendWs.addRow([]);
    legendWs.addRow([`ส่งออกเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`]);
    legendWs.getColumn(1).width = 20;
    legendWs.getColumn(2).width = 50;

    const buffer = await workbook.xlsx.writeBuffer();
    const label = planType === 'total' ? 'all' : planType;
    const filename = `${company.shortName}_${label}_plan_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
