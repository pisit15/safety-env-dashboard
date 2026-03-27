import { Activity, ActivityStatus, CompanyConfig, CompanySummary, MonthlyProgress } from './types';

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

// Check if a backgroundColor is default (white/no color)
function isDefaultBg(bg: any): boolean {
  if (!bg) return true;
  const r = bg.red ?? 1;
  const g = bg.green ?? 1;
  const b = bg.blue ?? 1;
  // White or very close to white
  return r >= 0.95 && g >= 0.95 && b >= 0.95;
}

// ── Method 1: Google Sheets API with Service Account (includes formatting) ──
async function fetchViaServiceAccount(sheetId: string, sheetName: string): Promise<CellData[][]> {
  const { google } = await import('googleapis');
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('No service account');

  const parsed = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const range = `'${sheetName}'!A1:U500`;
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    ranges: [range],
    includeGridData: true,
    fields: 'sheets.data.rowData.values(formattedValue,effectiveFormat.backgroundColor)',
  });

  const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
  return gridData.map((row: any) => {
    const values = row.values || [];
    return values.map((cell: any) => {
      const bg = cell?.effectiveFormat?.backgroundColor;
      return {
        value: cell?.formattedValue || '',
        hasBackground: !isDefaultBg(bg),
      };
    });
  });
}

// ── Method 2: Google Sheets API with API Key (includes formatting, for public sheets) ──
async function fetchViaApiKey(sheetId: string, sheetName: string): Promise<CellData[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('No API key');

  const range = encodeURIComponent(`'${sheetName}'!A1:U500`);
  const fields = encodeURIComponent('sheets.data.rowData.values(formattedValue,effectiveFormat.backgroundColor)');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?ranges=${range}&includeGridData=true&fields=${fields}&key=${apiKey}`;

  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`API Key fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const gridData = data.sheets?.[0]?.data?.[0]?.rowData || [];
  return gridData.map((row: any) => {
    const values = row.values || [];
    return values.map((cell: any) => {
      const bg = cell?.effectiveFormat?.backgroundColor;
      return {
        value: cell?.formattedValue || '',
        hasBackground: !isDefaultBg(bg),
      };
    });
  });
}

// ── Method 3: Public CSV export (no formatting data — Plan detection may be incomplete) ──
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

// ── Unified fetch: try Service Account → API Key → CSV export ──
async function fetchSheetRows(sheetId: string, sheetName: string): Promise<CellData[][]> {
  // Method 1: Service Account (best — includes formatting)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      console.log(`[sheets] Using Service Account for ${sheetName}`);
      return await fetchViaServiceAccount(sheetId, sheetName);
    } catch (err) {
      console.warn(`Service account failed for ${sheetName}:`, err);
    }
  }

  // Method 2: API Key (good — includes formatting, public sheets only)
  if (process.env.GOOGLE_API_KEY) {
    try {
      console.log(`[sheets] Using API Key for ${sheetName}`);
      return await fetchViaApiKey(sheetId, sheetName);
    } catch (err) {
      console.warn(`API Key failed for ${sheetName}:`, err);
    }
  }

  // Method 3: CSV export (fallback — no formatting, Plan detection may be incomplete)
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

// Detect status from actual row content
function detectStatus(
  planMonths: Record<string, string>,
  planMonthsHighlighted: Record<string, boolean>, // whether plan cell had background color
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
          const actualRowCells = nextRow.map(c => (c?.value || '').trim());
          status = detectStatus(planMonths, planMonthsHighlighted, actualMonths, actualRowCells);

          i += 2; // Skip both Plan and Actual rows
        } else {
          status = 'not_started';
          i++;
        }
      } else {
        i++;
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
