import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/incidents/export?companyId=amt&year=2026
 *
 * Export incidents + injured persons to Excel (.xlsx)
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

    // Fetch incidents
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .order('incident_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch injured persons for these incidents
    const incidentNos = (incidents || []).map((i) => i.incident_no).filter(Boolean);
    let injuredPersons: Record<string, unknown>[] = [];
    if (incidentNos.length > 0) {
      const BATCH = 200;
      for (let i = 0; i < incidentNos.length; i += BATCH) {
        const batch = incidentNos.slice(i, i + BATCH);
        const { data } = await supabase
          .from('injured_persons')
          .select('*')
          .in('incident_no', batch);
        if (data) injuredPersons.push(...data);
      }
    }

    // Build Excel workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EA SHE Dashboard';
    wb.created = new Date();

    // ── Sheet 1: Incidents ──
    const ws = wb.addWorksheet('Incidents', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      },
    };

    ws.columns = [
      { header: 'Incident No.', key: 'incident_no', width: 15 },
      { header: 'วันที่เกิดเหตุ', key: 'incident_date', width: 14 },
      { header: 'เวลา', key: 'incident_time', width: 8 },
      { header: 'ประเภท', key: 'incident_type', width: 14 },
      { header: 'เกี่ยวข้องกับงาน', key: 'work_related', width: 14 },
      { header: 'สถานที่', key: 'location', width: 20 },
      { header: 'รายละเอียด', key: 'description', width: 40 },
      { header: 'สาเหตุ', key: 'cause', width: 30 },
      { header: 'การแก้ไข', key: 'corrective_action', width: 30 },
      { header: 'สถานะ', key: 'status', width: 12 },
      { header: 'ผู้บาดเจ็บ', key: 'injured_count', width: 10 },
    ];

    // Apply header style
    ws.getRow(1).eachCell((cell) => {
      cell.style = headerStyle as ExcelJS.Style;
    });
    ws.getRow(1).height = 28;

    // Data rows
    (incidents || []).forEach((inc, idx) => {
      const injuredCount = injuredPersons.filter(
        (p: Record<string, unknown>) => p.incident_no === inc.incident_no
      ).length;

      const row = ws.addRow({
        incident_no: inc.incident_no,
        incident_date: inc.incident_date,
        incident_time: inc.incident_time || '',
        incident_type: inc.incident_type || '',
        work_related: inc.work_related || '',
        location: inc.location || '',
        description: inc.description || '',
        cause: inc.cause || '',
        corrective_action: inc.corrective_action || '',
        status: inc.status || '',
        injured_count: injuredCount,
      });

      // Zebra stripe
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        });
      }
    });

    // ── Sheet 2: Injured Persons ──
    if (injuredPersons.length > 0) {
      const ws2 = wb.addWorksheet('Injured Persons', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      ws2.columns = [
        { header: 'Incident No.', key: 'incident_no', width: 15 },
        { header: 'ประเภทบุคคล', key: 'person_type', width: 14 },
        { header: 'ความรุนแรง', key: 'injury_severity', width: 14 },
        { header: 'ลักษณะการบาดเจ็บ', key: 'nature_of_injury', width: 20 },
        { header: 'อวัยวะ', key: 'body_part', width: 14 },
        { header: 'ด้าน', key: 'body_side', width: 10 },
        { header: 'LTI', key: 'is_lti', width: 8 },
        { header: 'วันหยุดงาน', key: 'lost_work_days', width: 12 },
      ];

      const headerStyle2: Partial<ExcelJS.Style> = {
        ...headerStyle,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
      };

      ws2.getRow(1).eachCell((cell) => {
        cell.style = headerStyle2 as ExcelJS.Style;
      });
      ws2.getRow(1).height = 28;

      injuredPersons.forEach((person: Record<string, unknown>, idx) => {
        const row = ws2.addRow({
          incident_no: person.incident_no,
          person_type: person.person_type || '',
          injury_severity: person.injury_severity || '',
          nature_of_injury: person.nature_of_injury || '',
          body_part: person.body_part || '',
          body_side: person.body_side || '',
          is_lti: person.is_lti ? 'Yes' : 'No',
          lost_work_days: person.lost_work_days || 0,
        });

        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern', pattern: 'solid',
              fgColor: { argb: 'FFF9FAFB' },
            };
          });
        }
      });
    }

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="incidents-${companyId}-${year}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Incidents export error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
