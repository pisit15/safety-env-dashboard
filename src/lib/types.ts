// ===== Types for Safety Dashboard =====

export interface CompanyConfig {
  id: string;
  name: string;
  shortName: string;
  sheetId: string;         // Google Spreadsheet ID
  safetySheet: string;     // Sheet name for Safety Plan
  enviSheet: string;       // Sheet name for Environment Plan
}

export interface Activity {
  no: string;
  activity: string;
  responsible: string;
  budget: number;
  type: 'plan' | 'actual';
  months: Record<string, string>; // { jan: '✓', feb: '', ... }
  target: string;
  status: 'done' | 'in_progress' | 'not_started';
  follower: string;
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  shortName: string;
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  budget: number;
  pctDone: number;
}

export interface DashboardData {
  companies: CompanySummary[];
  totalActivities: number;
  totalDone: number;
  totalInProgress: number;
  totalNotStarted: number;
  totalBudget: number;
  overallPct: number;
}

export type PlanType = 'safety' | 'environment';
