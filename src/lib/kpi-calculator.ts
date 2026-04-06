/**
 * KPI Calculator for Action Plan — Quarterly Score Engine
 *
 * Business Logic:
 * - Each activity has monthly sub-items (cells). Each cell = 1 unit for KPI.
 * - Quarter mapping: Q1=jan-mar, Q2=apr-jun, Q3=jul-sep, Q4=oct-dec
 * - Numerator (success): done
 * - Denominator (base): all planned items MINUS cancelled & not_applicable
 * - NOT success: overdue, planned (past due), postponed
 * - Excluded from base: cancelled, not_applicable, not_planned
 *
 * Score: 100%=5, ≥90%=4, ≥80%=3, ≥70%=2, <70%=1
 *
 * Special: if denominator = 0 → 100% (score 5) but flagged
 */

import { MonthStatus } from './types';

// ── Quarter definitions ──────────────────────────────────────────
export const QUARTERS = [
  { key: 'Q1', label: 'Q1 (ม.ค.–มี.ค.)', months: ['jan', 'feb', 'mar'] },
  { key: 'Q2', label: 'Q2 (เม.ย.–มิ.ย.)', months: ['apr', 'may', 'jun'] },
  { key: 'Q3', label: 'Q3 (ก.ค.–ก.ย.)', months: ['jul', 'aug', 'sep'] },
  { key: 'Q4', label: 'Q4 (ต.ค.–ธ.ค.)', months: ['oct', 'nov', 'dec'] },
] as const;

export type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4';

// ── Score rating ─────────────────────────────────────────────────
export function getKPIScore(pct: number): number {
  if (pct >= 100) return 5;
  if (pct >= 90) return 4;
  if (pct >= 80) return 3;
  if (pct >= 70) return 2;
  return 1;
}

export function getScoreColor(score: number): string {
  switch (score) {
    case 5: return '#34c759'; // green
    case 4: return '#30d158'; // light green
    case 3: return '#ff9f0a'; // orange
    case 2: return '#ff6b35'; // dark orange
    case 1: return '#ff3b30'; // red
    default: return '#8e8e93'; // gray
  }
}

export function getScoreLabel(score: number): string {
  switch (score) {
    case 5: return 'ดีเยี่ยม';
    case 4: return 'ดี';
    case 3: return 'พอใช้';
    case 2: return 'ต้องปรับปรุง';
    case 1: return 'วิกฤต';
    default: return '-';
  }
}

// ── Quarterly KPI result interface ───────────────────────────────
export interface QuarterlyKPI {
  quarter: QuarterKey;
  label: string;
  months: string[];
  // Counts
  totalItems: number;        // All non-not_planned items in quarter
  doneCount: number;         // เสร็จแล้ว
  overdueCount: number;      // เกินกำหนด (past-due planned/overdue)
  postponedCount: number;    // เลื่อน
  cancelledCount: number;    // ยกเลิก (excluded from base)
  notApplicableCount: number;// ไม่เข้าเงื่อนไข (excluded from base)
  plannedCount: number;      // มีแผน (future months in quarter)
  // KPI calculation
  numerator: number;         // done
  denominator: number;       // totalItems - cancelled - notApplicable
  percentage: number;        // numerator / denominator * 100
  score: number;             // 1-5 rating
  scoreLabel: string;
  scoreColor: string;
  // Flags
  isEmptyBase: boolean;      // denominator = 0
  isFutureQuarter: boolean;  // quarter hasn't started yet
  postponedFromOther: number;// items postponed TO this quarter from others
  highCancelledRate: boolean;// cancelled > 20% of total
  highPostponedRate: boolean;// postponed > 30% of denominator
  consecutiveLow: boolean;   // placeholder for cross-quarter check
}

export interface YearlyKPISummary {
  year: number;
  companyId: string;
  planType: 'safety' | 'environment' | 'total';
  quarters: QuarterlyKPI[];
  yearlyAvgPct: number;
  yearlyAvgScore: number;
  yearlyScoreLabel: string;
  yearlyScoreColor: string;
}

// ── Types for input data ─────────────────────────────────────────
interface ActivityWithStatus {
  no: string;
  monthStatuses: Record<string, MonthStatus>;
}

interface StatusOverride {
  activity_no: string;
  month: string;
  status: string;
  postponed_to_month?: string;
  plan_type?: string;
}

// ── Main calculation function ────────────────────────────────────
/**
 * Calculate quarterly KPI from activities and their effective month statuses.
 *
 * @param activities - Array of activities with monthStatuses already resolved
 *                     (base from sheets + overrides applied)
 * @param statusOverrides - Raw override rows (for postponed_to_month tracking)
 * @param currentDate - Current date (for future quarter detection)
 */
export function calculateQuarterlyKPI(
  activities: ActivityWithStatus[],
  statusOverrides?: StatusOverride[],
  currentDate?: Date,
): QuarterlyKPI[] {
  const now = currentDate || new Date();
  const currentMonthIdx = now.getMonth(); // 0-based
  const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  // Build postponed-to map: which items were postponed TO which month
  const postponedToMap = new Map<string, number>(); // month -> count
  if (statusOverrides) {
    statusOverrides.forEach(ov => {
      if (ov.status === 'postponed' && ov.postponed_to_month) {
        const target = ov.postponed_to_month;
        postponedToMap.set(target, (postponedToMap.get(target) || 0) + 1);
      }
    });
  }

  return QUARTERS.map(q => {
    const quarterMonthIndices = q.months.map(m => MONTH_KEYS.indexOf(m));
    const firstMonthIdx = quarterMonthIndices[0];
    const isFutureQuarter = firstMonthIdx > currentMonthIdx;

    let doneCount = 0;
    let overdueCount = 0;
    let postponedCount = 0;
    let cancelledCount = 0;
    let notApplicableCount = 0;
    let plannedCount = 0;
    let totalItems = 0;

    // Count each activity's monthly sub-items in this quarter
    activities.forEach(act => {
      q.months.forEach((monthKey, mi) => {
        const status = act.monthStatuses?.[monthKey];
        if (!status || status === 'not_planned') return;

        totalItems++;
        const monthIdx = quarterMonthIndices[mi];

        switch (status) {
          case 'done':
            doneCount++;
            break;
          case 'cancelled':
            cancelledCount++;
            break;
          case 'not_applicable':
            notApplicableCount++;
            break;
          case 'postponed':
            postponedCount++;
            break;
          case 'overdue':
            overdueCount++;
            break;
          case 'planned':
            // If month is past, it's effectively overdue for KPI purposes
            if (monthIdx < currentMonthIdx) {
              overdueCount++;
            } else {
              plannedCount++;
            }
            break;
        }
      });
    });

    // Count items postponed FROM other quarters TO this quarter
    let postponedFromOther = 0;
    q.months.forEach(m => {
      postponedFromOther += postponedToMap.get(m) || 0;
    });

    // KPI Calculation
    // Denominator: total items minus excluded (cancelled + not_applicable)
    const denominator = totalItems - cancelledCount - notApplicableCount;
    // Numerator: only done items count as success
    const numerator = doneCount;

    // Percentage
    let percentage: number;
    const isEmptyBase = denominator === 0;
    if (isEmptyBase) {
      percentage = totalItems === 0 ? 100 : 100; // All excluded → 100% (flagged)
    } else {
      percentage = Math.round((numerator / denominator) * 1000) / 10;
    }

    const score = getKPIScore(percentage);

    // Flags
    const highCancelledRate = totalItems > 0 && (cancelledCount / totalItems) > 0.2;
    const highPostponedRate = denominator > 0 && (postponedCount / denominator) > 0.3;

    return {
      quarter: q.key as QuarterKey,
      label: q.label,
      months: [...q.months],
      totalItems,
      doneCount,
      overdueCount,
      postponedCount,
      cancelledCount,
      notApplicableCount,
      plannedCount,
      numerator,
      denominator,
      percentage,
      score,
      scoreLabel: getScoreLabel(score),
      scoreColor: getScoreColor(score),
      isEmptyBase,
      isFutureQuarter,
      postponedFromOther,
      highCancelledRate,
      highPostponedRate,
      consecutiveLow: false, // Set after all quarters computed
    };
  });
}

/**
 * Calculate yearly KPI summary from quarterly results.
 * Only includes quarters that have started (not future).
 */
export function calculateYearlyKPI(
  companyId: string,
  planType: 'safety' | 'environment' | 'total',
  year: number,
  activities: ActivityWithStatus[],
  statusOverrides?: StatusOverride[],
  currentDate?: Date,
): YearlyKPISummary {
  const quarters = calculateQuarterlyKPI(activities, statusOverrides, currentDate);

  // Check consecutive low scores (score 1 for 2+ quarters)
  for (let i = 1; i < quarters.length; i++) {
    if (quarters[i].score === 1 && quarters[i - 1].score === 1 && !quarters[i].isFutureQuarter) {
      quarters[i].consecutiveLow = true;
    }
  }

  // Yearly average — only from non-future quarters with items
  const activeQuarters = quarters.filter(q => !q.isFutureQuarter && q.totalItems > 0);
  const yearlyAvgPct = activeQuarters.length > 0
    ? Math.round(activeQuarters.reduce((sum, q) => sum + q.percentage, 0) / activeQuarters.length * 10) / 10
    : 0;
  const yearlyAvgScore = getKPIScore(yearlyAvgPct);

  return {
    year,
    companyId,
    planType,
    quarters,
    yearlyAvgPct,
    yearlyAvgScore,
    yearlyScoreLabel: getScoreLabel(yearlyAvgScore),
    yearlyScoreColor: getScoreColor(yearlyAvgScore),
  };
}
