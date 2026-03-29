import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const MONTH_NAMES_EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

interface ParsedCourse {
  course_no: number;
  category: string;
  course_name: string;
  in_house_external: string;
  planned_month: number;
  hours_per_course: number;
  planned_participants: number;
  total_planned_hours: number;
  budget: number;
  target_group: string;
  training_necessity: string;
  responsible_person: string;
  remarks: string;
}

// POST - Upload and parse Excel file, then import into training_plans
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const year = parseInt(formData.get('year') as string || '2026');
    const sheetName = formData.get('sheetName') as string;

    if (!file || !companyId) {
      return NextResponse.json({ error: 'Missing file or companyId' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(arrayBuf);

    // Get sheet names for user to choose
    const sheetNames = workbook.worksheets.map(ws => ws.name);

    if (!sheetName) {
      return NextResponse.json({ sheetNames, message: 'Please select a sheet' });
    }

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      return NextResponse.json({ error: `Sheet "${sheetName}" not found`, sheetNames }, { status: 400 });
    }

    // Parse the training plan Excel
    const courses = parseTrainingSheet(worksheet);

    if (courses.length === 0) {
      return NextResponse.json({ error: 'No training courses found in the sheet', sheetNames }, { status: 400 });
    }

    // If preview mode, just return parsed data
    const preview = formData.get('preview');
    if (preview === 'true') {
      return NextResponse.json({ courses, sheetNames, count: courses.length });
    }

    // Import into database
    const supabase = getSupabase();

    // Delete existing plans for this company/year
    await supabase
      .from('training_plans')
      .delete()
      .eq('company_id', companyId)
      .eq('year', year);

    // Insert new plans
    const planData = courses.map(c => ({
      company_id: companyId,
      year,
      course_no: c.course_no,
      category: c.category,
      course_name: c.course_name,
      in_house_external: c.in_house_external,
      planned_month: c.planned_month,
      hours_per_course: c.hours_per_course,
      planned_participants: c.planned_participants,
      total_planned_hours: c.total_planned_hours,
      budget: c.budget,
      target_group: c.target_group,
      training_necessity: c.training_necessity,
      responsible_person: c.responsible_person,
      remarks: c.remarks,
    }));

    const { data, error } = await supabase
      .from('training_plans')
      .insert(planData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getCellValue(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    return String(cell.value.result ?? '');
  }
  if (typeof cell.value === 'object' && 'text' in cell.value) {
    return String((cell.value as { text: string }).text ?? '');
  }
  return String(cell.value);
}

function getCellNumber(cell: ExcelJS.Cell | undefined): number {
  const val = getCellValue(cell);
  const num = parseFloat(val.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function parseTrainingSheet(ws: ExcelJS.Worksheet): ParsedCourse[] {
  const courses: ParsedCourse[] = [];

  // Find the header row - look for "No." or "ลำดับ" in column B
  let headerRow = 0;
  let noCol = 0;
  let categoryCol = 0;
  let inHouseCol = 0;
  let courseNameCol = 0;
  let necessityCol = 0;
  let hoursCol = 0;
  let participantsCol = 0;
  let totalHoursCol = 0;
  let targetGroupCol = 0;
  let totalCostCol = 0;
  let remarksCol = 0;
  let monthStartCol = 0; // Column where Jan starts (has sub-columns)

  // Scan first 10 rows to find header
  for (let r = 1; r <= 10; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 50; c++) {
      const val = getCellValue(row.getCell(c)).trim().toLowerCase();
      if (val === 'no.' || val === 'no' || val === 'ลำดับ') {
        headerRow = r;
        noCol = c;
        break;
      }
    }
    if (headerRow > 0) break;
  }

  if (headerRow === 0) {
    // Try alternative: look for "ชื่อหลักสูตร"
    for (let r = 1; r <= 10; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 50; c++) {
        const val = getCellValue(row.getCell(c)).trim();
        if (val.includes('ชื่อหลักสูตร')) {
          headerRow = r;
          courseNameCol = c;
          noCol = c - 3; // Usually 3 cols before
          break;
        }
      }
      if (headerRow > 0) break;
    }
  }

  if (headerRow === 0) return courses;

  // Map columns from header row
  const hRow = ws.getRow(headerRow);
  for (let c = 1; c <= 50; c++) {
    const val = getCellValue(hRow.getCell(c)).trim().toLowerCase();
    if (val.includes('หมวด') || val.includes('category')) categoryCol = c;
    if (val.includes('in-house') || val.includes('external')) inHouseCol = c;
    if (val.includes('ชื่อหลักสูตร') || val.includes('course')) courseNameCol = c;
    if (val.includes('ความจำเป็น') || val.includes('necessity')) necessityCol = c;
    if ((val.includes('ชั่วโมง') || val.includes('hour')) && !val.includes('รวม') && hoursCol === 0) hoursCol = c;
    if ((val.includes('คน') || val.includes('person')) && participantsCol === 0) participantsCol = c;
    if (val.includes('รวม') && val.includes('ชั่วโมง')) totalHoursCol = c;
    if (val.includes('กลุ่มเป้าหมาย') || val.includes('target')) targetGroupCol = c;
    if (val.includes('ค่าใช้จ่าย') || val.includes('cost') || val.includes('รวมค่า')) totalCostCol = c;
    if (val.includes('หมายเหตุ') || val.includes('remark')) remarksCol = c;
  }

  // Find month columns: look for Jan/Feb/Mar etc. in header or sub-header
  const monthRow = headerRow + 1; // Often months are one row below
  for (let r = headerRow; r <= headerRow + 2; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 50; c++) {
      const val = getCellValue(row.getCell(c)).trim().toLowerCase();
      if ((val === 'jan' || val === 'ม.ค.' || val === 'ม.ค') && monthStartCol === 0) {
        monthStartCol = c;
        break;
      }
    }
    if (monthStartCol > 0) break;
  }

  // Determine column spacing for months (usually 3 sub-columns per month)
  let monthSpacing = 3;
  if (monthStartCol > 0) {
    // Check if next month is 2 or 3 columns away
    for (let spacing = 1; spacing <= 4; spacing++) {
      const checkCol = monthStartCol + spacing;
      for (let r = headerRow; r <= headerRow + 2; r++) {
        const val = getCellValue(ws.getRow(r).getCell(checkCol)).trim().toLowerCase();
        if (val === 'feb' || val === 'ก.พ.' || val === 'ก.พ') {
          monthSpacing = spacing;
          break;
        }
      }
      if (monthSpacing !== 3) break;
    }
  }

  // Parse data rows
  let courseNo = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const noVal = getCellValue(row.getCell(noCol)).trim();
    const courseName = getCellValue(row.getCell(courseNameCol)).trim()
      .replace(/^[•·\-\s]+/, ''); // Remove bullet prefixes

    if (!courseName || courseName.length < 3) continue;

    // Skip summary/total rows
    if (courseName.includes('รวม') || courseName.includes('Total') || courseName.includes('total')) continue;

    courseNo++;
    const numNo = parseInt(noVal) || courseNo;
    const category = getCellValue(row.getCell(categoryCol)).trim();
    const inHouse = getCellValue(row.getCell(inHouseCol)).trim();
    const necessity = necessityCol > 0 ? getCellValue(row.getCell(necessityCol)).trim() : '';
    const hours = getCellNumber(row.getCell(hoursCol));
    const participants = getCellNumber(row.getCell(participantsCol));
    const totalHours = totalHoursCol > 0 ? getCellNumber(row.getCell(totalHoursCol)) : hours * participants;
    const targetGroup = targetGroupCol > 0 ? getCellValue(row.getCell(targetGroupCol)).trim() : '';
    const totalCost = totalCostCol > 0 ? getCellNumber(row.getCell(totalCostCol)) : 0;
    const remarks = remarksCol > 0 ? getCellValue(row.getCell(remarksCol)).trim() : '';

    // Determine planned month from month columns
    let plannedMonth = 0;
    if (monthStartCol > 0) {
      for (let m = 0; m < 12; m++) {
        const mCol = monthStartCol + (m * monthSpacing);
        // Check the month column and its sub-columns for any value
        for (let sub = 0; sub < monthSpacing; sub++) {
          const cellVal = getCellNumber(row.getCell(mCol + sub));
          if (cellVal > 0) {
            plannedMonth = m + 1;
            break;
          }
        }
        if (plannedMonth > 0) break;
      }
    }

    // If no month found from columns, default to 0 (unscheduled)
    courses.push({
      course_no: numNo,
      category,
      course_name: courseName,
      in_house_external: inHouse || 'External',
      planned_month: plannedMonth,
      hours_per_course: hours,
      planned_participants: participants,
      total_planned_hours: totalHours,
      budget: totalCost,
      target_group: targetGroup,
      training_necessity: necessity,
      responsible_person: '',
      remarks,
    });
  }

  return courses;
}

// POST for attendee Excel import
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const planId = formData.get('planId') as string;
    const companyId = formData.get('companyId') as string;

    if (!file || !sessionId || !planId || !companyId) {
      return NextResponse.json({ error: 'Missing file, sessionId, planId, or companyId' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(arrayBuf);
    const ws = workbook.worksheets[0];
    if (!ws) {
      return NextResponse.json({ error: 'No worksheet found' }, { status: 400 });
    }

    // Parse attendee data - flexible column detection
    const attendees = parseAttendeeSheet(ws);

    if (attendees.length === 0) {
      return NextResponse.json({ error: 'No attendees found in file' }, { status: 400 });
    }

    const preview = formData.get('preview');
    if (preview === 'true') {
      return NextResponse.json({ attendees, count: attendees.length });
    }

    // Insert into database
    const records = attendees.map(a => ({
      session_id: sessionId,
      plan_id: planId,
      company_id: companyId,
      ...a,
    }));

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('training_attendees')
      .insert(records)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update participant count
    const { count } = await supabase
      .from('training_attendees')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (count !== null) {
      await supabase.from('training_sessions')
        .update({ actual_participants: count })
        .eq('id', sessionId);
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseAttendeeSheet(ws: ExcelJS.Worksheet) {
  const attendees: Record<string, unknown>[] = [];
  let headerRow = 0;
  const colMap: Record<string, number> = {};

  // Find header row
  for (let r = 1; r <= 10; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 25; c++) {
      const val = getCellValue(row.getCell(c)).trim().toLowerCase();
      if (val.includes('emp') || val.includes('รหัส') || val === 'no.' || val === 'no') {
        headerRow = r;
        break;
      }
    }
    if (headerRow > 0) break;
  }

  if (headerRow === 0) return attendees;

  // Map columns
  const hRow = ws.getRow(headerRow);
  for (let c = 1; c <= 25; c++) {
    const val = getCellValue(hRow.getCell(c)).trim().toLowerCase();
    if (val.includes('emp') && val.includes('code')) colMap.emp_code = c;
    if (val.includes('name') || val.includes('ชื่อ')) {
      if (!colMap.first_name) colMap.first_name = c;
      else if (!colMap.last_name) colMap.last_name = c;
    }
    if (val.includes('surname') || val.includes('นามสกุล')) colMap.last_name = c;
    if (val.includes('เพศ') || val.includes('gender') || val === 'f/m' || val === 'm/f') colMap.gender = c;
    if (val.includes('position') || val.includes('ตำแหน่ง')) colMap.position = c;
    if (val.includes('department') || val.includes('แผนก')) colMap.department = c;
    if (val.includes('company') || val.includes('บริษัท')) colMap.company = c;
    if (val.includes('location') || val.includes('สถานที่')) colMap.location = c;
    if (val.includes('level') || val.includes('ระดับ')) colMap.employee_level = c;
    if (val.includes('ชั่วโมง') || val.includes('hour')) colMap.hours = c;
  }

  // Parse data rows
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const firstName = colMap.first_name ? getCellValue(row.getCell(colMap.first_name)).trim() : '';
    if (!firstName) continue;

    attendees.push({
      emp_code: colMap.emp_code ? getCellValue(row.getCell(colMap.emp_code)).trim() : '',
      title: '',
      first_name: firstName,
      last_name: colMap.last_name ? getCellValue(row.getCell(colMap.last_name)).trim() : '',
      gender: colMap.gender ? getCellValue(row.getCell(colMap.gender)).trim() : '',
      position: colMap.position ? getCellValue(row.getCell(colMap.position)).trim() : '',
      department: colMap.department ? getCellValue(row.getCell(colMap.department)).trim() : '',
      location: colMap.location ? getCellValue(row.getCell(colMap.location)).trim() : '',
      employee_level: colMap.employee_level ? getCellValue(row.getCell(colMap.employee_level)).trim() : '',
      training_type: 'Mandatory',
      onsite_online: 'Onsite',
      external_inhouse: '',
      learning_method: 'Training',
      program_type: '',
      registration_type: 'registered',
      hours_attended: colMap.hours ? getCellNumber(row.getCell(colMap.hours)) : 0,
    });
  }

  return attendees;
}
