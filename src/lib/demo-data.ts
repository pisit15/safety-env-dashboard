// Demo data used when Google Sheets API is not configured

import { CompanySummary, DashboardData, MonthlyProgress } from './types';

export const DEMO_COMPANIES: CompanySummary[] = [
  { companyId: 'ebi', companyName: 'EBI', shortName: 'EBI', total: 45, done: 12, notStarted: 28, postponed: 3, cancelled: 2, budget: 4635710, pctDone: 26.7 },
  { companyId: 'amt', companyName: 'AMT', shortName: 'AMT', total: 52, done: 15, notStarted: 29, postponed: 5, cancelled: 3, budget: 712584, pctDone: 28.8 },
  { companyId: 'aab', companyName: 'AAB', shortName: 'AAB', total: 38, done: 10, notStarted: 25, postponed: 2, cancelled: 1, budget: 350000, pctDone: 26.3 },
  { companyId: 'esn', companyName: 'ESN', shortName: 'ESN', total: 41, done: 8, notStarted: 29, postponed: 3, cancelled: 1, budget: 520000, pctDone: 19.5 },
  { companyId: 'esm', companyName: 'ESM', shortName: 'ESM', total: 35, done: 11, notStarted: 22, postponed: 1, cancelled: 1, budget: 280000, pctDone: 31.4 },
  { companyId: 'esl', companyName: 'ESL', shortName: 'ESL', total: 40, done: 9, notStarted: 25, postponed: 4, cancelled: 2, budget: 410000, pctDone: 22.5 },
  { companyId: 'eslo', companyName: 'ESLO', shortName: 'ESLO', total: 37, done: 7, notStarted: 27, postponed: 2, cancelled: 1, budget: 290000, pctDone: 18.9 },
  { companyId: 'esp', companyName: 'ESP', shortName: 'ESP', total: 43, done: 13, notStarted: 25, postponed: 3, cancelled: 2, budget: 480000, pctDone: 30.2 },
  { companyId: 'ewhk', companyName: 'EWHK', shortName: 'EWHK', total: 36, done: 6, notStarted: 26, postponed: 3, cancelled: 1, budget: 310000, pctDone: 16.7 },
  { companyId: 'hnm', companyName: 'HNM', shortName: 'HNM', total: 39, done: 10, notStarted: 26, postponed: 2, cancelled: 1, budget: 370000, pctDone: 25.6 },
  { companyId: 'mmc', companyName: 'MMC', shortName: 'MMC', total: 44, done: 14, notStarted: 23, postponed: 4, cancelled: 3, budget: 550000, pctDone: 31.8 },
  { companyId: 'ea-hq', companyName: 'EA HQ', shortName: 'EA HQ', total: 34, done: 8, notStarted: 24, postponed: 1, cancelled: 1, budget: 200000, pctDone: 23.5 },
  { companyId: 'ea-kabin', companyName: 'EA Kabin', shortName: 'EA Kabin', total: 42, done: 11, notStarted: 26, postponed: 3, cancelled: 2, budget: 450000, pctDone: 26.2 },
];

const DEMO_MONTHLY: MonthlyProgress[] = [
  { month: 'jan', label: 'ม.ค.', planned: 120, completed: 35, pctComplete: 29.2 },
  { month: 'feb', label: 'ก.พ.', planned: 95, completed: 28, pctComplete: 29.5 },
  { month: 'mar', label: 'มี.ค.', planned: 110, completed: 30, pctComplete: 27.3 },
  { month: 'apr', label: 'เม.ย.', planned: 85, completed: 0, pctComplete: 0 },
  { month: 'may', label: 'พ.ค.', planned: 90, completed: 0, pctComplete: 0 },
  { month: 'jun', label: 'มิ.ย.', planned: 100, completed: 0, pctComplete: 0 },
  { month: 'jul', label: 'ก.ค.', planned: 95, completed: 0, pctComplete: 0 },
  { month: 'aug', label: 'ส.ค.', planned: 105, completed: 0, pctComplete: 0 },
  { month: 'sep', label: 'ก.ย.', planned: 88, completed: 0, pctComplete: 0 },
  { month: 'oct', label: 'ต.ค.', planned: 92, completed: 0, pctComplete: 0 },
  { month: 'nov', label: 'พ.ย.', planned: 98, completed: 0, pctComplete: 0 },
  { month: 'dec', label: 'ธ.ค.', planned: 115, completed: 0, pctComplete: 0 },
];

export function getDemoDashboard(): DashboardData {
  const companies = DEMO_COMPANIES;
  return {
    companies,
    totalActivities: companies.reduce((s, c) => s + c.total, 0),
    totalDone: companies.reduce((s, c) => s + c.done, 0),
    totalNotStarted: companies.reduce((s, c) => s + c.notStarted, 0),
    totalPostponed: companies.reduce((s, c) => s + c.postponed, 0),
    totalCancelled: companies.reduce((s, c) => s + c.cancelled, 0),
    totalBudget: companies.reduce((s, c) => s + c.budget, 0),
    overallPct: Math.round(
      (companies.reduce((s, c) => s + c.done, 0) /
        companies.reduce((s, c) => s + c.total, 0)) * 1000
    ) / 10,
    monthlyProgress: DEMO_MONTHLY,
  };
}
