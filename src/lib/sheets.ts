import { Activity, ActivityStatus, CompanyConfig, CompanySummary, MonthlyProgress } from './types';

// Month column mapping: G=ม.ค.(Jan), H=ก.พ.(Feb), ... R=ธ.ค.(Dec)
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_LABELS: Record<string, string> = {
  jan: 'ม.ค.', feb: 'ก.พ.', mar: 'มี.ค.', apr: 'เม.ย.',
  may: 'พ.ค.', jun: 'มิ.ย.', jul: 'ก.ค.', aug: 'ส.ค.',
  sep: 'ก.ย.', oct: 'ต.ค.', nov: 'พ.ย.', dec: 'ธ.ค.',
};

export { MONTH_KEYS, MONTH_LABELS };

// ── Method 1: Google Sheets API with Service Account ──
async function fetchViaServiceAccount(sheetId: string, sheetName: string): Promise<string[][]> {
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
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  return response.data.values || [];
}

// ── Method 2: Public CSV export (sheets must be "Anyone with link can view") ──
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

async function fetchViaCSVExport(sheetId: string, sheetName: string): Promise<string[][]> {
  const encodedName = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'text/csv' },
    next: { revalidate: 300 }, // cache 5 minutes
  });

  if (!response.ok) {
    throw new Error(`CSV export failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  if (csv.includes('<!DOCTYPE html>') || csv.includes('<html')) {
    throw new Error('Sheet is not publicly accessible');
  }

  return parseCSV(csv);
}

// ── Unified fetch: try Service Account first, then CSV export ──
async function fetchSheetRows(sheetId: string, sheetName: string): Promise<string[][]> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return await fetchViaServiceAccount(sheetId, sheetName);
    } catch (err) {
      console.warn(`Service account failed for ${sheetName}, trying CSV export...`, err);
    }
  }
  return await fetchViaCSVExport(sheetId, sheetName);
}

// ── Parse rows into Activity objects ──
// Columns layout:
// A(0) = ลำดับ  B(1) = รายละเอียด/กิจกรรม  C(2) = (merged with B)
// D(3) = ผู้รับผิดชอบ  E(4) = งบประมาณ  F(5) = Plan/Actual
// G-R(6-17) = ม.ค.-ธ.ค.  S(18) = เป้าหมาย  T(19) = ผู้ติดตาม

function findDataStartRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowText = rows[i]?.join(' ') || '';
    if (rowText.includes('ม.ค.') || rowText.includes('ม.ค')) {
      return i + 1; // Data starts after this header row
    }
  }
  return 7;
}

// Detect status from actual row content
function detectStatus(
  planMonths: Record<string, string>,
  actualMonths: Record<string, string>,
  allRowCells: string[]
): ActivityStatus {
  // Check all cells for "เลื่อน" (postponed) or "ยกเลิก" (cancelled) keywords
  const allText = allRowCells.join(' ').toLowerCase();
  if (allText.includes('ยกเลิก') || allText.includes('cancel')) {
    return 'cancelled';
  }
  if (allText.includes('เลื่อน') || allText.includes('postpone') || allText.includes('เลือน')) {
    return 'postponed';
  }

  const currentMonth = new Date().getMonth(); // 0-indexed (0=Jan)

  // Get which months had plan marks
  const plannedMonthIndices = MONTH_KEYS
    .map((k, idx) => ({ key: k, idx, val: planMonths[k] || '' }))
    .filter(m => m.val !== '' && !m.val.includes('เมื่อ'));

  // Get which months have actual marks
  const actualMonthIndices = MONTH_KEYS
    .map((k, idx) => ({ key: k, idx, val: actualMonths[k] || '' }))
    .filter(m => m.val !== '');

  if (actualMonthIndices.length > 0) {
    // Has some actual data — check if all planned months up to current are completed
    const plannedUpToCurrent = plannedMonthIndices.filter(m => m.idx <= currentMonth);
    if (plannedUpToCurrent.length === 0) {
      // No planned activities up to current month, but has actual marks → done
      return 'done';
    }
    const completedUpToCurrent = plannedUpToCurrent.filter(m => {
      const actual = actualMonths[m.key] || '';
      return actual !== '';
    });
    if (completedUpToCurrent.length >= plannedUpToCurrent.length) {
      return 'done';
    }
    // Some completed but not all — still count as done if any month done
    if (completedUpToCurrent.length > 0) {
      return 'done';
    }
  }

  // No actual data at all → not_started
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

    const no = (row[0] || '').toString().trim();
    const activityB = (row[1] || '').toString().trim();
    const activityC = (row[2] || '').toString().trim();
    const activity = activityB || activityC;
    const responsible = (row[3] || '').toString().trim();
    const budgetStr = (row[4] || '0').toString().replace(/,/g, '').replace(/[^\d.]/g, '');
    const budget = parseFloat(budgetStr) || 0;
    const planActual = (row[5] || '').toString().trim().toLowerCase();

    // Skip category headers
    if (no && !planActual && activity && !activity.match(/^\d/)) {
      i++;
      continue;
    }

    // Skip empty rows
    if (!no && !activity && !planActual) { i++; continue; }

    // We care about Plan rows that have a sub-number (like "1.1", "2.1", etc.)
    if (no && no.includes('.') && planActual.includes('plan')) {
      // Read Plan row monthly marks
      const planMonths: Record<string, string> = {};
      MONTH_KEYS.forEach((key, idx) => {
        planMonths[key] = (row[6 + idx] || '').toString().trim();
      });

      const target = (row[18] || '').toString().trim();
      const follower = (row[19] || '').toString().trim() || (row[20] || '').toString().trim();

      // Look for corresponding Actual row (next row)
      let actualMonths: Record<string, string> = {};
      let actualResponsible = responsible;
      let status: ActivityStatus = 'not_started';

      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const nextPlanActual = (nextRow?.[5] || '').toString().trim().toLowerCase();

        if (nextPlanActual.includes('actual')) {
          // Read Actual row
          MONTH_KEYS.forEach((key, idx) => {
            actualMonths[key] = (nextRow[6 + idx] || '').toString().trim();
          });
          actualResponsible = (nextRow[3] || '').toString().trim() || responsible;

          // Detect status from actual row content
          const actualRowCells = nextRow.map(c => (c || '').toString().trim());
          status = detectStatus(planMonths, actualMonths, actualRowCells);

          i += 2; // Skip both Plan and Actual rows
        } else {
          // No Actual row follows
          status = 'not_started';
          i++;
        }
      } else {
        i++;
      }

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
      return planVal !== '' && !planVal.includes('เมื่อ');
    }).length;

    const completed = activities.filter(a => {
      const actualVal = a.actualMonths[key] || '';
      return actualVal !== '' && a.status !== 'cancelled';
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
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0,
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
    const budget = activities.reduce((sum, a) => sum + a.budget, 0);
    const monthlyProgress = calculateMonthlyProgress(activities);

    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total, done, notStarted, postponed, cancelled, budget,
      pctDone: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
      monthlyProgress,
    };
  } catch (error) {
    console.error(`Error fetching data for ${company.name} (${sheetName}):`, error);
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, notStarted: 0, postponed: 0, cancelled: 0,
      budget: 0, pctDone: 0,
    };
  }
}
