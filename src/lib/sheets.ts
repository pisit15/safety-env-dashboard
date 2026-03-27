import { google } from 'googleapis';
import { Activity, CompanyConfig, CompanySummary } from './types';

// Month column mapping: G=ม.ค.(Jan), H=ก.พ.(Feb), ... R=ธ.ค.(Dec)
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_LABELS: Record<string, string> = {
  jan: 'ม.ค.', feb: 'ก.พ.', mar: 'มี.ค.', apr: 'เม.ย.',
  may: 'พ.ค.', jun: 'มิ.ย.', jul: 'ก.ค.', aug: 'ส.ค.',
  sep: 'ก.ย.', oct: 'ต.ค.', nov: 'พ.ย.', dec: 'ธ.ค.',
};

export { MONTH_KEYS, MONTH_LABELS };

// Create Google Sheets client using service account
function getSheetsClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }
  const parsed = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Columns layout from the PDF analysis:
// A = ลำดับ (no)
// B-C = รายละเอียด/กิจกรรม (activity) — usually merged, we read B
// D = ผู้รับผิดชอบ (responsible)
// E = งบประมาณ (budget)
// F = Plan/Actual label
// G-R = ม.ค. - ธ.ค. (monthly marks)
// S = เป้าหมาย (target)
// T-U = ผู้ติดตาม (follower)

export async function fetchActivities(
  company: CompanyConfig,
  sheetName: string
): Promise<Activity[]> {
  const sheets = getSheetsClient();

  // Read rows starting from row 4 (skip headers) through column U
  const range = `'${sheetName}'!A4:U200`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: company.sheetId,
    range,
  });

  const rows = response.data.values || [];
  const activities: Activity[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;

    const no = (row[0] || '').toString().trim();
    const activity = (row[1] || '').toString().trim() || (row[2] || '').toString().trim();
    const responsible = (row[3] || '').toString().trim();
    const budget = parseFloat((row[4] || '0').toString().replace(/,/g, '')) || 0;
    const planActual = (row[5] || '').toString().trim().toLowerCase();

    // Skip empty rows or header rows
    if (!no && !activity) continue;
    // Only process "actual" rows for status tracking (or rows that look like data)
    const type: 'plan' | 'actual' = planActual.includes('actual') ? 'actual' : 'plan';

    // Read monthly marks (columns G-R = indices 6-17)
    const months: Record<string, string> = {};
    MONTH_KEYS.forEach((key, idx) => {
      const val = (row[6 + idx] || '').toString().trim();
      months[key] = val;
    });

    const target = (row[18] || '').toString().trim();
    const follower = (row[19] || '').toString().trim();

    // Determine status from actual row data
    let status: Activity['status'] = 'not_started';
    if (type === 'actual') {
      const filledMonths = Object.values(months).filter(v => v && v !== '');
      if (filledMonths.length > 0) {
        // Check if all planned months have actual marks
        // For simplicity: if any month is filled, it's at least in_progress
        status = 'in_progress';
        // If we have data for the current month or beyond, mark as done
        const currentMonth = new Date().getMonth(); // 0-indexed
        const lastFilledIdx = MONTH_KEYS.findLastIndex(k => months[k] && months[k] !== '');
        if (lastFilledIdx >= currentMonth) {
          status = 'done';
        }
      }
    }

    activities.push({
      no, activity, responsible, budget, type, months, target, status, follower,
    });
  }

  return activities;
}

export async function getCompanySummary(company: CompanyConfig, planType: 'safety' | 'environment'): Promise<CompanySummary> {
  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;

  if (!company.sheetId || !sheetName) {
    // Return placeholder data for unconfigured companies
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
    // Only count "actual" rows for status
    const actualRows = activities.filter(a => a.type === 'actual');
    const total = actualRows.length || 1;
    const done = actualRows.filter(a => a.status === 'done').length;
    const inProgress = actualRows.filter(a => a.status === 'in_progress').length;
    const notStarted = actualRows.filter(a => a.status === 'not_started').length;
    const budget = activities.reduce((sum, a) => sum + a.budget, 0);

    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total, done, inProgress, notStarted, budget,
      pctDone: Math.round((done / total) * 1000) / 10,
    };
  } catch (error) {
    console.error(`Error fetching data for ${company.name}:`, error);
    return {
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName,
      total: 0, done: 0, inProgress: 0, notStarted: 0,
      budget: 0, pctDone: 0,
    };
  }
}
