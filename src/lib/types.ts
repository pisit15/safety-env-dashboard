// ===== Types for Safety Dashboard =====

export interface YearSheetConfig {
  sheetId: string;         // Google Spreadsheet ID for this year
  safetySheet: string;     // Sheet name for Safety Plan
  enviSheet: string;       // Sheet name for Environment Plan
}

export type CompanyGroup = 'Factory' | 'Non-Factory' | '';
export type CompanyBU = 'HQ' | 'Biodiesel' | 'Renewable Energy' | 'EV' | 'Waste Management' | '';

export const COMPANY_GROUPS: CompanyGroup[] = ['Factory', 'Non-Factory'];
export const COMPANY_BUS: CompanyBU[] = ['HQ', 'Biodiesel', 'Renewable Energy', 'EV', 'Waste Management'];

export interface CompanyConfig {
  id: string;
  name: string;
  shortName: string;
  fullName?: string;         // Full company name in Thai for search/display
  sheetId: string;         // Default Google Spreadsheet ID (current year)
  safetySheet: string;     // Default Sheet name for Safety Plan
  enviSheet: string;       // Default Sheet name for Environment Plan
  years?: Record<number, YearSheetConfig>; // Per-year sheet configs (e.g. { 2026: {...}, 2027: {...} })
  group?: CompanyGroup;    // Factory or Non-Factory
  bu?: CompanyBU;          // Business Unit
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
  safetyBudget?: number;
  enviBudget?: number;
  pctDone: number;
  monthlyProgress?: MonthlyProgress[];
  // Phase B: overdue count (activities past plan month but incomplete)
  overdueCount?: number;
}

// Phase B: Activity metadata overlay (stored in Supabase)
export type ActivityCategory =
  | 'training' | 'inspection' | 'audit' | 'ppe' | 'emergency_drill'
  | 'risk_assessment' | 'permit' | 'compliance' | 'monitoring'
  | 'reporting' | 'waste' | 'emission' | 'water' | 'other';

export type ActivityPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActivityMetadata {
  id?: number;
  company_id: string;
  plan_type: string;
  activity_no: string;
  year: number;
  category: ActivityCategory;
  priority: ActivityPriority;
  due_date?: string;
  notes?: string;
  updated_by?: string;
  updated_at?: string;
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
  // Phase B: aggregate overdue + priority breakdown
  totalOverdue?: number;
  priorityBreakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export type PlanType = 'safety' | 'environment';
