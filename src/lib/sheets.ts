import { Activity, ActivityStatus, MonthStatus, CompanyConfig, CompanySummary, MonthlyProgress } from './types';
import ExcelJS from 'exceljs';

// Month column mapping: G=ม.ค.(Jan), H=ก.พ.(Feb), ... R=ธ.ค.(Dec)
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_LABELS: Record<string, string> = {
  jan: 'ม.ค.', feb: 'ก.พ.', mar: 'มี.ค.', apr: 'เม.ย.',
  may: 'พ.ค.', jun: 'มิ.ย.', jul: 'ก.ค.', aug: 'ส.ค.',
  sep: 'ก.ย.', oct: 'ต.ค.', nov: 'พ.ย.', dec: 'ธ.ค.',
};

export { MONTH_KEYS, MONTH_LABELS };

// ── Cell data with formatting info ──
interface CellData {
  value: string;
  hasBackground: boolean; // true if cell has non-white/non-default background color
}

// ── Get Google Auth token from Service Account ──
async function getServiceAccountToken(): Promise<string> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('No service account credentials');

  const { google } = await import('googleapis');
  const parsed = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Failed to get access token');
  return tokenResponse.token;
}

// ── Check if a fill color is non-white (has meaningful background) ──
function hasNonWhiteFill(cell: ExcelJS.Cell): boolean {
  try {
    const fill = cell.fill as any;
    if (!fill || fill.type !== 'pattern') return false;
    if (fill.pattern === 'none') return false;

    // Check fgColor (foreground of the pattern)
    const fg = fill.fgColor;
    if (fg) {
      // Has a theme or indexed color — likely a real background
      if (fg.theme !== undefined && fg.theme !== null) return true;
      if (fg.indexed !== undefined && fg.indexed !== null && fg.indexed !== 64) return true;
      if (fg.argb) {
        const argb = String(fg.argb).toUpperCase();
        // Check if it's white or near-white
        if (argb === 'FFFFFFFF' || argb === '00FFFFFF' || argb === 'FFFFFF') return false;
        return true;
      }
    }

    // Check bgColor as fallback
    const bg = fill.bgColor;
    if (bg) {
      if (bg.theme !== undefined && bg.theme !== null) return true;
      if (bg.indexed !== undefined && bg.indexed !== null && bg.indexed !== 64 && bg.indexed !== 65) return true;
      if (bg.argb) {
        const argb = String(bg.argb).toUpperCase();
        if (argb === 'FFFFFFFF' || argb === '00FFFFFF' || argb === 'FFFFFF') return false;
        return true;
      }
    }

    // If pattern is 'solid' with no color info, could still mean colored
    if (fill.pattern === 'solid' && !fg && !bg) return false;

    return false;
  } catch {
    return false;
  }
}

// ── Method 1: Download .xlsx via Drive API + parse with exceljs (reads colors!) ──
async function fetchViaXlsx(fileId: string, sheetName: string): Promise<CellData[][]> {
  const token = await getServiceAccountToken();

  // Download the file content via Google Drive API
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive download failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Parse with exceljs
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as any);

  // Find the worksheet by name
  let worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    // Try partial match
    worksheet = workbook.worksheets.find(ws =>
      ws.name.toLowerCase().includes(sheetName.toLowerCase().split(' ')[0])
    );
  }
  if (!worksheet) {
    // Fall back to first sheet
    console.warn(`[sheets] Sheet "${sheetName}" not found, using first sheet: "${workbook.worksheets[0]?.name}"`);
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) {
    throw new Error(`No worksheets found in workbook`);
  }

  console.log(`[sheets] Parsing sheet "${worksheet.name}" with ${worksheet.rowCount} rows`);

  const rows: CellData[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > 500) return; // safety limit
    const cells: CellData[] = [];
    // Read columns A through U (1-21)
    for (let col = 1; col <= 21; col++) {
      const cell = row.getCell(col);
      let value = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'richText' in cell.value) {
          // Handle rich text
          value = (cell.value as ExcelJS.CellRichTextValue).richText
            .map((rt: any) => rt.text || '')
            .join('');
        } else if (typeof cell.value === 'object' && 'result' in cell.value) {
          // Formula — use the result
          const result = (cell.value as ExcelJS.CellFormulaValue).result;
          value = result !== undefined && result !== null ? String(result) : '';
        } else {
          value = String(cell.value);
        }
      }

      cells.push({
        value: value.trim(),
        hasBackground: hasNonWhiteFill(cell),
      });
    }
    rows.push(cells);
  });

  return rows;
}

// ── Method 2: Public CSV export (no formatting data — Plan detection may be incomplete) ──
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(current);
      current = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(c => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

async function fetchViaCSVExport(sheetId: string, sheetName: string): Promise<CellData[][]> {
  const encodedName = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'text/csv' },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`CSV export failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  if (csv.includes('<!DOCTYPE html>') || csv.includes('<html')) {
    throw new Error('Sheet is not publicly accessible');
  }

  const rows = parseCSV(csv);
  // CSV has no formatting data — hasBackground is always false
  return rows.map(row => row.map(cell => ({ value: cell.trim(), hasBackground: false })));
}

// ── Unified fetch: try xlsx download (Drive API) → CSV export ──
async function fetchSheetRows(sheetId: string, sheetName: string): Promise<CellData[][]> {
  // Method 1: Download .xlsx via Drive API and parse with exceljs (reads cell colors!)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      console.log(`[sheets] Downloading .xlsx for ${sheetName} via Drive API + exceljs`);
      return await fetchViaXlsx(sheetId, sheetName);
    } catch (err) {
      console.warn(`[sheets] xlsx download failed for ${sheetName}:`, err);
    }
  }

  // Method 2: CSV export (fallback — no formatting, Plan detection may be incomplete)
  console.log(`[sheets] Using CSV export for ${sheetName} (no cell color data)`);
  return await fetchViaCSVExport(sheetId, sheetName);
}

// ── Parse rows into Activity objects ──
// Columns layout:
// A(0) = ลำดับ  B(1) = รายละเอียด/กิจกรรม  C(2) = (merged with B)
// D(3) = ผู้รับผิดชอบ  E(4) = งบประมาณ  F(5) = Plan/Actual
// G-R(6-17) = ม.ค.-ธ.ค.  S(18) = เป้าหมาย  T(19) = ผู้ติดตาม

function findDataStartRow(rows: CellData[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowText = rows[i]?.map(c => c.value).join(' ') || '';
    if (rowText.includes('ม.ค.') || rowText.includes('ม.ค')) {
      return i + 1;
    }
  }
  return 7;
}

// Check if a Plan month cell has a plan mark (text content OR background color)
function hasPlanMark(cell: CellData | undefined): boolean {
  if (!cell) return false;
  // Has text content (and not a "when" note)
  if (cell.value !== '' && !cell.value.includes('เมื่อ')) return true;
  // Has background color highlighting
  if (cell.hasBackground) return true;
  return false;
}

// Compute per-month status for an activity
function computeMonthStatuses(
  planMonths: Record<string, string>,
  planMonthsHighlighted: Record<string, boolean>,
  actualMonths: Record<string, string>,
  actualRowCells: string[],
): Record<string, MonthStatus> {
  const currentMonth = new Date().getMonth(); // 0-indexed
  const monthStatuses: Record<string, MonthStatus> = {};
  const actualText = actualRowCells.join(' ').toLowerCase();

  MONTH_KEYS.forEach((key, idx) => {
    const hasPlanText = planMonths[key] !== '' && !planMonths[key]?.includes('เมื่อ');
    const hasPlanColor = planMonthsHighlighted[key] || false;
    const isPlanned = hasPlanText || hasPlanColor;
    const actualVal = (actualMonths[key] || '').trim();
    const hasActual = actualVal !== '';

    if (!isPlanned) {
      monthStatuses[key] = 'not_planned';
    } else if (hasActual) {
      // Check actual cell text for special statuses
      const cellText = actualVal.toLowerCase();
      if (cellText.includes('ยกเลิก') || cellText.includes('cancel')) {
        monthStatuses[key] = 'cancelled';
      } else if (cellText.includes('เลื่อน') || cellText.includes('postpone') || cellText.includes('เลือน')) {
        monthStatuses[key] = 'postponed';
      } else if (cellText.includes('ไม่เข้าเงื่อนไข') || cellText.includes('n/a')) {
        monthStatuses[key] = 'not_applicable';
      } else {
        monthStatuses[key] = 'done';
      }
    } else if (idx < currentMonth) {
      // Planned but no actual mark and month has passed
      // Check if the whole activity was cancelled/postponed/n-a
      if (actualText.includes('ยกเลิก') || actualText.includes('cancel')) {
        monthStatuses[key] = 'cancelled';
      } else if (actualText.includes('เลื่อน') || actualText.includes('postpone')) {
        monthStatuses[key] = 'postponed';
      } else if (actualText.includes('ไม่เข้าเงื่อนไข')) {
        monthStatuses[key] = 'not_applicable';
      } else {
        monthStatuses[key] = 'overdue';
      }
    } else {
      monthStatuses[key] = 'planned';
    }
  });

  return monthStatuses;
}

// Detect status from actual row content
function detectStatus(
  planMonths: Record<string, string>,
  planMonthsHighlighted: Record<string, boolean>,
  actualMonths: Record<string, string>,
  allRowCells: string[]
): ActivityStatus {
  const allText = allRowCells.join(' ').toLowerCase();

  // Check for "ไม่เข้าเงื่อนไข" (not applicable)
  if (allText.includes('ไม่เข้าเงื่อนไข') || allText.includes('not applicable') || allText.includes('n/a')) {
    return 'not_applicable';
  }

  // Check for "ยกเลิก" (cancelled)
  if (allText.includes('ยกเลิก') || allText.includes('cancel')) {
    return 'cancelled';
  }

  // Check for "เลื่อน" (postponed)
  if (allText.includes('เลื่อน') || allText.includes('postpone') || allText.includes('เลือน')) {
    return 'postponed';
  }

  const currentMonth = new Date().getMonth(); // 0-indexed

  // Get which months had plan marks (text OR background color)
  const plannedMonthIndices = MONTH_KEYS
    .map((k, idx) => ({ key: k, idx }))
    .filter(m => {
      const hasText = planMonths[m.key] !== '' && !planMonths[m.key]?.includes('เมื่อ');
      const hasColor = planMonthsHighlighted[m.key] || false;
      return hasText || hasColor;
    });

  // Get which months have actual marks
  const actualMonthIndices = MONTH_KEYS
    .map((k, idx) => ({ key: k, idx, val: actualMonths[k] || '' }))
    .filter(m => m.val !== '');

  if (actualMonthIndices.length > 0) {
    const plannedUpToCurrent = plannedMonthIndices.filter(m => m.idx <= currentMonth);
    if (plannedUpToCurrent.length === 0) {
      return 'done';
    }
    const completedUpToCurrent = plannedUpToCurrent.filter(m => {
      const actual = actualMonths[m.key] || '';
      return actual !== '';
    });
    if (completedUpToCurrent.length >= plannedUpToCurrent.length) {
      return 'done';
    }
    if (completedUpToCurrent.length > 0) {
      return 'done';
    }
  }

  return 'not_started';
}

export async function fetchActivities(
  company: CompanyConfig,
  sheetName: string
): Promise<Activity[]> {
  const rows = await fetchSheetRows(company.sheetId, sheetName);
  if (!rows.length) return [];

  const dataStart = findDataStartRow(rows);
  const activities: Activity[] = [];

  let i = dataStart;
  while (i < rows.length) {
    const row = rows[i];
    if (!row || row.length < 6) { i++; continue; }

    const no = (row[0]?.value || '').trim();
    const activityB = (row[1]?.value || '').trim();
    const activityC = (row[2]?.value || '').trim();
    const activity = activityB || activityC;
    const responsible = (row[3]?.value || '').trim();
    const budgetStr = (row[4]?.value || '0').replace(/,/g, '').replace(/[^\d.]/g, '');
    const budget = parseFloat(budgetStr) || 0;
    const planActual = (row[5]?.value || '').trim().toLowerCase();

    // Skip category headers
    if (no && !planActual && activity && !activity.match(/^\d/)) {
      i++;
      continue;
    }

    // Skip empty rows
    if (!no && !activity && !planActual) { i++; continue; }

    // We care about Plan rows that have a sub-number (like "1.1", "2.1", etc.)
    if (no && no.includes('.') && planActual.includes('plan')) {
      // Read Plan row monthly marks (both text and color)
      const planMonths: Record<string, string> = {};
      const planMonthsHighlighted: Record<string, boolean> = {};
      MONTH_KEYS.forEach((key, idx) => {
        const cell = row[6 + idx];
        planMonths[key] = cell?.value || '';
        planMonthsHighlighted[key] = cell?.hasBackground || false;
      });

      const target = (row[18]?.value || '').trim();
      const follower = (row[19]?.value || '').trim() || (row[20]?.value || '').trim();

      // Look for corresponding Actual row (next row)
      let actualMonths: Record<string, string> = {};
      let actualResponsible = responsible;
      let status: ActivityStatus = 'not_started';
      let actualRowCells: string[] = [];

      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const nextPlanActual = (nextRow?.[5]?.value || '').trim().toLowerCase();

        if (nextPlanActual.includes('actual')) {
          // Read Actual row
          MONTH_KEYS.forEach((key, idx) => {
            actualMonths[key] = (nextRow[6 + idx]?.value || '').trim();
          });
          actualResponsible = (nextRow[3]?.value || '').trim() || responsible;

          // Detect status from actual row content
          actualRowCells = nextRow.map(c => (c?.value || '').trim());
          status = detectStatus(planMonths, planMonthsHighlighted, actualMonths, actualRowCells);

          i += 2; // Skip both Plan and Actual rows
        } else {
          status = 'not_started';
          i++;
        }
      } else {
        i++;
      }

      // Compute per-month statuses
      const monthStatuses = computeMonthStatuses(planMonths, planMonthsHighlighted, actualMonths, actualRowCells);

      // Determine if recurring (planned for 3+ months)
      const plannedMonthCount = MONTH_KEYS.filter(k => {
        const hasText = planMonths[k] !== '' && !planMonths[k]?.includes('เมื่อ');
        const hasColor = planMonthsHighlighted[k] || false;
        return hasText || hasColor;
      }).length;
      const isRecurring = plannedMonthCount >= 3;

      // For planMonths display: if cell had background color but no text, mark it with a plan indicator
      MONTH_KEYS.forEach(key => {
        if (planMonths[key] === '' && planMonthsHighlighted[key]) {
          planMonths[key] = '▪'; // Visual indicator that plan exists (from color)
        }
      });

      activities.push({
        no,
        activity,
        responsible: actualResponsible || responsible,
        budget,
        type: 'actual',
        planMonths,
        actualMonths,
        target,
        status,
        monthStatuses,
        isRecurring,
        follower,
      });
    } else {
      i++;
    }
  }

  return activities;
}

// Calculate monthly progress from activities
function calculateMonthlyProgress(activities: Activity[]): MonthlyProgress[] {
  return MONTH_KEYS.map((key, idx) => {
    const planned = activities.filter(a => {
      const planVal = a.planMonths[key] || '';
      // Count as planned if has text (not "เมื่อ") — the '▪' marker from color is included
      return planVal !== '' && !planVal.includes('เมื่อ');
    }).length;

    const completed = activities.filter(a => {
      const actualVal = a.actualMonths[key] || '';
      return actualVal !== '' && a.status !== 'cancelled' && a.status !== 'not_applicable';
    }).length;

    return {
      month: key,
      label: MONTH_LABELS[key],
      planned,
      completed,
      pctComplete: planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0,
    };
  });
}

export async function getCompanySummary(company: CompanyConfig, planType: 'safety' | 'environment'): Promise<CompanySummary> {
  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;

  if (!company.sheetId || !sheetName) {
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0, notApplicable: 0,
      budget: 0, pctDone: 0,
    };
  }

  try {
    const activities = await fetchActivities(company, sheetName);
    const total = activities.length || 0;
    const done = activities.filter(a => a.status === 'done').length;
    const notStarted = activities.filter(a => a.status === 'not_started').length;
    const postponed = activities.filter(a => a.status === 'postponed').length;
    const cancelled = activities.filter(a => a.status === 'cancelled').length;
    const notApplicable = activities.filter(a => a.status === 'not_applicable').length;
    const budget = activities.reduce((sum, a) => sum + a.budget, 0);
    const monthlyProgress = calculateMonthlyProgress(activities);

    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total, done, notStarted, postponed, cancelled, notApplicable, budget,
      pctDone: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
      monthlyProgress,
    };
  } catch (error) {
    console.error(`Error fetching data for ${company.name} (${sheetName}):`, error);
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0, notApplicable: 0,
      budget: 0, pctDone: 0,
    };
  }
}
