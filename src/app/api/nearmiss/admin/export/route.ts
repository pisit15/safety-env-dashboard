import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';

// ── GET /api/nearmiss/admin/export ── Export all Near Miss reports to Excel
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('near_miss_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EASHE Safety Dashboard';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Near Miss Reports', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // ── Columns ──
    ws.columns = [
      { header: 'หมายเลข', key: 'report_no', width: 22 },
      { header: 'บริษัท', key: 'company_id', width: 14 },
      { header: 'วันที่เกิดเหตุ', key: 'incident_date', width: 16 },
      { header: 'สถานที่', key: 'location', width: 20 },
      { header: 'ผู้รายงาน', key: 'reporter_name', width: 18 },
      { header: 'แผนก', key: 'reporter_dept', width: 14 },
      { header: 'รายละเอียด', key: 'incident_description', width: 40 },
      { header: 'ปัจจัยป้องกัน', key: 'saving_factor', width: 25 },
      { header: 'การดำเนินการทันที', key: 'immediate_action', width: 30 },
      { header: 'โอกาสเกิด', key: 'probability', width: 12 },
      { header: 'ความรุนแรง', key: 'severity', width: 12 },
      { header: 'คะแนนเสี่ยง', key: 'risk_score', width: 12 },
      { header: 'ระดับเสี่ยง', key: 'risk_level', width: 12 },
      { header: 'สถานะ', key: 'status', width: 14 },
      { header: 'ผู้รับผิดชอบ', key: 'responsible_person', width: 18 },
      { header: 'กำหนดเสร็จ', key: 'due_date', width: 14 },
      { header: 'ผู้ตรวจสอบ', key: 'safety_officer', width: 18 },
      { header: 'รับเรื่อง', key: 'created_at', width: 16 },
    ];

    // ── Header style ──
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4E79A7' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // ── Status & risk label mappings ──
    const statusLabels: Record<string, string> = {
      new: 'รายงานใหม่', investigating: 'กำลังสอบสวน',
      action_taken: 'ดำเนินการแล้ว', closed: 'ปิดแล้ว',
    };
    const riskColors: Record<string, string> = {
      HIGH: 'FFC23B22', 'MED-HIGH': 'FFF28E2B', MEDIUM: 'FFF28E2B', LOW: 'FF2B8C3E',
    };

    // ── Data rows ──
    for (const r of (data || [])) {
      const row = ws.addRow({
        report_no: r.report_no || '',
        company_id: (r.company_id || '').toUpperCase(),
        incident_date: r.incident_date ? new Date(r.incident_date).toLocaleDateString('th-TH') : '',
        location: r.location || '',
        reporter_name: r.reporter_name || '',
        reporter_dept: r.reporter_dept || '',
        incident_description: r.incident_description || '',
        saving_factor: r.saving_factor || '',
        immediate_action: r.immediate_action || '',
        probability: r.probability || '',
        severity: r.severity || '',
        risk_score: r.risk_score || '',
        risk_level: r.risk_level || '',
        status: statusLabels[r.status] || r.status || '',
        responsible_person: r.responsible_person || '',
        due_date: r.due_date ? new Date(r.due_date).toLocaleDateString('th-TH') : '',
        safety_officer: r.safety_officer || '',
        created_at: r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '',
      });

      // Color risk level cell
      const riskCol = 13; // risk_level column index
      const riskCell = row.getCell(riskCol);
      const rColor = riskColors[r.risk_level];
      if (rColor) {
        riskCell.font = { bold: true, color: { argb: rColor } };
      }

      // Zebra striping
      if (row.number % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F7' } };
      }

      row.alignment = { vertical: 'top', wrapText: true };
    }

    // ── Generate buffer ──
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="near-miss-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Near miss export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
