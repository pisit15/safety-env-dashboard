import { Activity, CompanyConfig, CompanySummary } from './types';

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
  // Try service account first
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return await fetchViaServiceAccount(sheetId, sheetName);
    } catch (err) {
      console.warn(`Service account failed for ${sheetName}, trying CSV export...`, err);
    }
  }

  // Try public CSV export
  return await fetchViaCSVExport(sheetId, sheetName);
}

// ── Parse rows into Activity objects ──
// Columns layout:
// A(0) = ลำดับ  B(1) = รายละเอียด/กิจกรรม  C(2) = (merged with B)
// D(3) = ผู้รับผิดชอบ  E(4) = งบประมาณ  F(5) = Plan/Actual
// G-R(6-17) = ม.ค.-ธ.ค.  S(18) = เป้าหมาย  T(19) = ผู้ติดตาม

function findDataStartRow(rows: string[][]): number {
  // Find the row that contains "ม.ค." or "ลำดับ" header
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowText = rows[i]?.join(' ') || '';
    if (rowText.includes('ม.ค.') || rowText.includes('ม.ค')) {
      return i + 1; // Data starts after this header row
    }
  }
  // Default: data starts at row index 7 (row 8 in sheet)
  return 7;
}

export async function fetchActivities(
  company: CompanyConfig,
  sheetName: string
): Promise<Activity[]> {
  const rows = await fetchSheetRows(company.sheetId, sheetName);
  if (!rows.length) return [];

  const dataStart = findDataStartRow(rows);
  const activities: Activity[] = [];

  // Process rows in pairs (Plan row + Actual row)
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

    // Skip category headers (rows with number like "1", "2", etc. with bold text but no Plan/Actual)
    if (no && !planActual && activity && !activity.match(/^\d/)) {
      // This is a section header, skip it
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
      let status: Activity['status'] = 'not_started';

      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const nextPlanActual = (nextRow?.[5] || '').toString().trim().toLowerCase();

        if (nextPlanActual.includes('actual')) {
          // Read Actual row
          MONTH_KEYS.forEach((key, idx) => {
            actualMonths[key] = (nextRow[6 + idx] || '').toString().trim();
          });
          actualResponsible = (nextRow[3] || '').toString().trim() || responsible;

          // Determine status
          const currentMonth = new Date().getMonth(); // 0-indexed
          const filledActual = MONTH_KEYS.filter((k, idx) => actualMonths[k] && actualMonths[k] !== '');
          const plannedMonths = MONTH_KEYS.filter((k, idx) => planMonths[k] && planMonths[k] !== '');

          if (filledActual.length > 0) {
            // Check if all planned months up to current month have actual data
            const plannedUpToCurrent = plannedMonths.filter((k) => MONTH_KEYS.indexOf(k) <= currentMonth);
            const actualUpToCurrent = plannedUpToCurrent.filter(k => actualMonths[k] && actualMonths[k] !== '');

            if (plannedUpToCurrent.length > 0 && actualUpToCurrent.length >= plannedUpToCurrent.length) {
              status = 'done';
            } else {
              status = 'in_progress';
            }
          } else {
            // No actual data yet — check if any plan month is <= current month
            const shouldHaveStarted = plannedMonths.some(k => MONTH_KEYS.indexOf(k) <= currentMonth);
            status = shouldHaveStarted ? 'not_started' : 'not_started';
          }

          i += 2; // Skip both Plan and Actual rows
        } else {
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
        months: Object.keys(actualMonths).length > 0 ? actualMonths : planMonths,
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

export async function getCompanySummary(company: CompanyConfig, planType: 'safety' | 'environment'): Promise<CompanySummary> {
  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;

  if (!company.sheetId || !sheetName) {
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, inProgress: 0, notStarted: 0,
      budget: 0, pctDone: 0,
    };
  }

  try {
    const activities = await fetchActivities(company, sheetName);
    const total = activities.length || 0;
    const done = activities.filter(a => a.status === 'done').length;
    const inProgress = activities.filter(a => a.status === 'in_progress').length;
    const notStarted = activities.filter(a => a.status === 'not_started').length;
    const budget = activities.reduce((sum, a) => sum + a.budget, 0);

    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total, done, inProgress, notStarted, budget,
      pctDone: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
    };
  } catch (error) {
    console.error(`Error fetching data for ${company.name} (${sheetName}):`, error);
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, inProgress: 0, notStarted: 0,
      budget: 0, pctDone: 0,
    };
  }
}
