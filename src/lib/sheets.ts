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
  bgColor: string; // extracted ARGB hex e.g. 'FF00B050' or '' if none
  isMergeSlave: boolean; // true if this cell is part of a merged range but NOT the master cell
}

// ── Get Google Auth token from Service Account ──
async function getServiceAccountToken(): Promise<string> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('No service account credentials');

  const { google } = await import('googleapis');
  const parsed = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Failed to get access token');
  return tokenResponse.token;
}

// ── Extract fill color info from a cell ──
function extractFillInfo(cell: ExcelJS.Cell): { hasBackground: boolean; bgColor: string } {
  try {
    const fill = cell.fill as any;
    if (!fill || fill.type !== 'pattern') return { hasBackground: false, bgColor: '' };
    if (fill.pattern === 'none') return { hasBackground: false, bgColor: '' };

    // Check fgColor (foreground of the pattern)
    const fg = fill.fgColor;
    if (fg) {
      if (fg.argb) {
        const argb = String(fg.argb).toUpperCase();
        if (argb === 'FFFFFFFF' || argb === '00FFFFFF' || argb === 'FFFFFF') {
          return { hasBackground: false, bgColor: '' };
        }
        return { hasBackground: true, bgColor: argb };
      }
      if (fg.theme !== undefined && fg.theme !== null) {
        // Theme colors: map common themes to approximate ARGB
        // theme 0=white, 1=black, 2-3=gray, 4=blue, 5=orange, 6=gray-blue, 7=gold, 8=teal, 9=red
        const themeMap: Record<number, string> = {
          4: 'FF4472C4', 5: 'FFED7D31', 6: 'FFA5A5A5', 7: 'FFFFC000',
          8: 'FF5B9BD5', 9: 'FF70AD47',
        };
        const tint = fg.tint || 0;
        const approx = themeMap[fg.theme] || '';
        return { hasBackground: true, bgColor: approx || `THEME${fg.theme}_${Math.round(tint * 100)}` };
      }
      if (fg.indexed !== undefined && fg.indexed !== null && fg.indexed !== 64) {
        return { hasBackground: true, bgColor: `IDX${fg.indexed}` };
      }
    }

    // Check bgColor as fallback
    const bg = fill.bgColor;
    if (bg) {
      if (bg.argb) {
        const argb = String(bg.argb).toUpperCase();
        if (argb === 'FFFFFFFF' || argb === '00FFFFFF' || argb === 'FFFFFF') {
          return { hasBackground: false, bgColor: '' };
        }
        return { hasBackground: true, bgColor: argb };
      }
      if (bg.theme !== undefined && bg.theme !== null) return { hasBackground: true, bgColor: '' };
      if (bg.indexed !== undefined && bg.indexed !== null && bg.indexed !== 64 && bg.indexed !== 65) {
        return { hasBackground: true, bgColor: `IDX${bg.indexed}` };
      }
    }

    if (fill.pattern === 'solid' && !fg && !bg) return { hasBackground: false, bgColor: '' };

    return { hasBackground: false, bgColor: '' };
  } catch {
    return { hasBackground: false, bgColor: '' };
  }
}

// ── Detect status from cell background color ──
// Color mapping (common Excel fill colors):
//   Green shades → done (เสร็จแล้ว)
//   Blue shades  → postponed (เลื่อน)
//   Red shades   → cancelled (ยกเลิก)
//   Gray shades  → not_applicable (ไม่เข้าเงื่อนไข)
//   Yellow/Orange → overdue (เกินกำหนด) — optional
function detectStatusFromColor(argb: string): MonthStatus | null {
  if (!argb) return null;
  const hex = argb.replace(/^FF/, ''); // strip alpha prefix

  // Parse RGB components
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  // Green: g is dominant → done
  if (g > 120 && g > r * 1.2 && g > b * 1.2) return 'done';

  // Blue: b is dominant → postponed
  if (b > 120 && b > r * 1.2 && b > g * 1.0) return 'postponed';

  // Red: r is dominant → cancelled
  if (r > 150 && r > g * 1.5 && r > b * 1.5) return 'cancelled';

  // Gray: all channels similar and mid-range → not_applicable
  if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && r > 100 && r < 220) return 'not_applicable';

  // Yellow/Orange: r and g are high, b is low → treat as done (common "completed" color)
  if (r > 180 && g > 150 && b < 100) return 'done';

  // Has color but can't classify → treat as done (has an actual mark)
  return 'done';
}

// ── Method 1: Download .xlsx via Drive API + parse with exceljs (reads colors!) ──
async function fetchViaXlsx(fileId: string, sheetName: string): Promise<CellData[][]> {
  const token = await getServiceAccountToken();

  // Download the file content via Google Drive API
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-store',
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

      // Detect merge-slave: cell.isMerged is true AND cell.master is a different cell
      let isMergeSlave = false;
      try {
        const master = (cell as any).master;
        if (master && (master.row !== cell.row || master.col !== cell.col)) {
          isMergeSlave = true;
        } else if ((cell as any).isMerged && master && master.address !== cell.address) {
          isMergeSlave = true;
        }
      } catch { /* ignore */ }

      const fillInfo = extractFillInfo(cell);
      cells.push({
        value: value.trim(),
        hasBackground: fillInfo.hasBackground,
        bgColor: fillInfo.bgColor,
        isMergeSlave,
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
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`CSV export failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  if (csv.includes('<!DOCTYPE html>') || csv.includes('<html')) {
    throw new Error('Sheet is not publicly accessible');
  }

  const rows = parseCSV(csv);
  // CSV has no formatting data — hasBackground is always false, no merge info
  return rows.map(row => row.map(cell => ({ value: cell.trim(), hasBackground: false, bgColor: '', isMergeSlave: false })));
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
  actualMonthColors: Record<string, string>,
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
    const actualColor = actualMonthColors[key] || '';

    // 1. Check color-based status first (fill color in Actual row)
    const colorStatus = detectStatusFromColor(actualColor);

    if (!isPlanned && !hasActual && !actualColor) {
      monthStatuses[key] = 'not_planned';
    } else if (colorStatus && actualColor) {
      // Color fill detected → use color-mapped status
      monthStatuses[key] = colorStatus;
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
    } else if (isPlanned && idx < currentMonth) {
      // Planned but no actual mark and month has passed
      if (actualText.includes('ยกเลิก') || actualText.includes('cancel')) {
        monthStatuses[key] = 'cancelled';
      } else if (actualText.includes('เลื่อน') || actualText.includes('postpone')) {
        monthStatuses[key] = 'postponed';
      } else if (actualText.includes('ไม่เข้าเงื่อนไข')) {
        monthStatuses[key] = 'not_applicable';
      } else {
        monthStatuses[key] = 'overdue';
      }
    } else if (isPlanned) {
      monthStatuses[key] = 'planned';
    } else {
      monthStatuses[key] = 'not_planned';
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

  // Track current category header for grouping
  let currentCategoryGroup = '';
  let currentCategoryNo = '';

  let i = dataStart;
  while (i < rows.length) {
    const row = rows[i];
    if (!row || row.length < 6) { i++; continue; }

    const no = (row[0]?.value || '').trim();
    const activityB = (row[1]?.value || '').trim();
    const activityC = (row[2]?.value || '').trim();
    const activity = activityB || activityC;
    const responsible = (row[3]?.value || '').trim();
    // Skip budget if this cell is a merge-slave (value inherited from merged master cell)
    const budgetIsMergeSlave = row[4]?.isMergeSlave || false;
    const budgetStr = budgetIsMergeSlave ? '0' : (row[4]?.value || '0').replace(/,/g, '').replace(/[^\d.]/g, '');
    const budget = parseFloat(budgetStr) || 0;
    const planActual = (row[5]?.value || '').trim().toLowerCase();

    // Capture category headers for grouping (e.g. "1" + "การฝึกอบรม")
    if (no && !planActual && activity && !activity.match(/^\d/)) {
      currentCategoryGroup = activity;
      currentCategoryNo = no;
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
      let actualMonthColors: Record<string, string> = {};
      let actualResponsible = responsible;
      let status: ActivityStatus = 'not_started';
      let actualRowCells: string[] = [];

      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const nextPlanActual = (nextRow?.[5]?.value || '').trim().toLowerCase();

        if (nextPlanActual.includes('actual')) {
          // Read Actual row (text + color)
          MONTH_KEYS.forEach((key, idx) => {
            const cell = nextRow[6 + idx];
            actualMonths[key] = (cell?.value || '').trim();
            actualMonthColors[key] = cell?.bgColor || '';
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

      // Compute per-month statuses (now includes color detection)
      const monthStatuses = computeMonthStatuses(planMonths, planMonthsHighlighted, actualMonths, actualMonthColors, actualRowCells);

      // Determine if recurring (planned for 3+ months)
      const plannedMonthCount = MONTH_KEYS.filter(k => {
        const hasText = planMonths[k] !== '' && !planMonths[k]?.includes('เมื่อ');
        const hasColor = planMonthsHighlighted[k] || false;
        return hasText || hasColor;
      }).length;
      const isRecurring = plannedMonthCount >= 3;

      // Detect conditional/trigger-based activities
      // These should NOT auto-mark as overdue when past months have no actual
      const conditionalPatterns = ['เมื่อเกิด', 'เมื่อมี', 'กรณีหาก', 'กรณีมี', 'กรณีเกิด', 'หากมี', 'หากเกิด', 'เมื่อพบ', 'ตามแผนฝึกอบรม', 'ดำเนินการตามแผน'];
      const actLower = activity.toLowerCase();
      const isConditional = conditionalPatterns.some(p => actLower.includes(p.toLowerCase())) ||
        MONTH_KEYS.some(k => (planMonths[k] || '').includes('เมื่อ'));

      // For conditional activities: change overdue → planned (they're not late, just not triggered)
      if (isConditional) {
        MONTH_KEYS.forEach(key => {
          if (monthStatuses[key] === 'overdue') {
            monthStatuses[key] = 'planned';
          }
        });
      }

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
        isConditional,
        follower,
        categoryGroup: currentCategoryGroup || undefined,
        categoryNo: currentCategoryNo || undefined,
      });
    } else {
      i++;
    }
  }

  return activities;
}

// Calculate monthly progress from activities — uses monthStatuses directly
function calculateMonthlyProgress(activities: Activity[]): MonthlyProgress[] {
  return MONTH_KEYS.map((key, idx) => {
    let planned = 0;
    let doneCount = 0;
    let notApplicableCount = 0;

    activities.forEach(a => {
      const status = a.monthStatuses?.[key];
      if (!status || status === 'not_planned') return;

      planned++;
      if (status === 'not_applicable') {
        notApplicableCount++;
      } else if (status === 'done') {
        doneCount++;
      }
    });

    const completed = doneCount + notApplicableCount; // ยกประโยชน์ให้

    return {
      month: key,
      label: MONTH_LABELS[key],
      planned,
      completed,
      pctComplete: planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0,
      doneCount,
      notApplicableCount,
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
    const budget = activities.reduce((sum, a) => sum + a.budget, 0);
    const monthlyProgress = calculateMonthlyProgress(activities);

    // KPI uses month-slot counting (same as chart)
    let totalPlanned = 0, totalDone = 0, totalNotApplicable = 0, totalPostponed = 0, totalCancelled = 0;
    MONTH_KEYS.forEach(key => {
      activities.forEach(a => {
        const monthStatus = a.monthStatuses?.[key];
        if (!monthStatus || monthStatus === 'not_planned') return;
        totalPlanned++;
        if (monthStatus === 'not_applicable') {
          totalNotApplicable++; // แยกต่างหาก ไม่รวมใน done
        } else if (monthStatus === 'done') {
          totalDone++;
        } else if (monthStatus === 'postponed') {
          totalPostponed++;
        } else if (monthStatus === 'cancelled') {
          totalCancelled++;
        }
      });
    });
    // done = เสร็จจริง, N/A = แยก, % = (done + N/A) / total → ยกประโยชน์ให้
    const totalNotStarted = Math.max(0, totalPlanned - totalDone - totalNotApplicable - totalPostponed - totalCancelled);

    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: totalPlanned,
      done: totalDone,
      notStarted: totalNotStarted,
      postponed: totalPostponed,
      cancelled: totalCancelled,
      notApplicable: totalNotApplicable,
      budget,
      pctDone: totalPlanned > 0 ? Math.round(((totalDone + totalNotApplicable) / totalPlanned) * 1000) / 10 : 0,
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
