// ===== Types for Safety Dashboard =====

export interface CompanyConfig {
  id: string;
  name: string;
  shortName: string;
  sheetId: string;         // Google Spreadsheet ID
  safetySheet: string;     // Sheet name for Safety Plan
  enviSheet: string;       // Sheet name for Environment Plan
}

export type ActivityStatus = 'not_started' | 'done' | 'postponed' | 'cancelled' | 'not_applicable';

export type MonthStatus = 'not_planned' | 'planned' | 'done' | 'overdue' | 'postponed' | 'cancelled' | 'not_applicable';

export interface Activity {
  no: string;
  activity: string;
  responsible: string;
  budget: number;
  type: 'plan' | 'actual';
  planMonths: Record<string, string>;   // Plan row marks per month
  actualMonths: Record<string, string>; // Actual row marks per month
  target: string;
  status: ActivityStatus;
  monthStatuses: Record<string, MonthStatus>; // Per-month status tracking
  isRecurring: boolean; // true if activity is planned for 3+ months
  follower: string;
}

export interface MonthlyProgress {
  month: string;        // 'jan', 'feb', etc.
  label: string;        // 'ม.ค.', 'ก.พ.', etc.
  planned: number;      // activities planned for this month
  completed: number;    // activities with actual mark this month
  pctComplete: number;  // completion % for this month
  // Per-status breakdown for stacked bar chart
  doneCount?: number;
  overdueCount?: number;
  postponedCount?: number;
  notApplicableCount?: number;
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  shortName: string;
  total: number;
  done: number;
  notStarted: number;
  postponed: number;
  cancelled: number;
  notApplicable: number;
  budget: number;
  pctDone: number;
  monthlyProgress?: MonthlyProgress[];
}

export interface DashboardData {
  companies: CompanySummary[];
  totalActivities: number;
  totalDone: number;
  totalNotStarted: number;
  totalPostponed: number;
  totalCancelled: number;
  totalNotApplicable: number;
  totalBudget: number;
  overallPct: number;
  monthlyProgress: MonthlyProgress[];
}

export type PlanType = 'safety' | 'environment';
