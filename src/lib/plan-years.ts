import { getServiceSupabase } from './supabase';
import { AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from './companies';

/**
 * DB-driven year configuration.
 *
 * The list of available/active years lives in the `plan_years` table so that
 * Admins can add a new year (2027, 2028, ...) without a code deploy.
 * Falls back to the static constants in ./companies when the table is empty
 * or unreachable.
 */

export interface PlanYearRow {
  year: number;
  is_active: boolean;
  label?: string | null;
}

let cached: PlanYearRow[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30s

async function fetchPlanYears(): Promise<PlanYearRow[]> {
  const now = Date.now();
  if (cached && now - cacheTime < CACHE_TTL) return cached;

  try {
    const { data, error } = await getServiceSupabase()
      .from('plan_years')
      .select('year, is_active, label')
      .order('year', { ascending: true });

    if (!error && data && data.length > 0) {
      cached = data as PlanYearRow[];
      cacheTime = now;
      return cached;
    }
  } catch (e) {
    console.warn('[plan-years] fetch failed, using static fallback:', e);
  }
  return [];
}

/** All years known to the system (active or not), ascending. */
export async function getAllYears(): Promise<number[]> {
  const rows = await fetchPlanYears();
  if (rows.length === 0) return [...AVAILABLE_YEARS].sort((a, b) => a - b);
  return rows.map((r) => r.year).sort((a, b) => a - b);
}

/** Years that are active (selectable / have data), ascending. */
export async function getActiveYears(): Promise<number[]> {
  const rows = await fetchPlanYears();
  if (rows.length === 0) return [...ACTIVE_YEARS].sort((a, b) => a - b);
  return rows.filter((r) => r.is_active).map((r) => r.year).sort((a, b) => a - b);
}

/** Default selected year = newest active year (fallback to static DEFAULT_YEAR). */
export async function getDefaultYear(): Promise<number> {
  const active = await getActiveYears();
  if (active.length === 0) return DEFAULT_YEAR;
  return Math.max(...active);
}

/** Invalidate the in-memory cache (call after mutating plan_years). */
export function invalidatePlanYearsCache(): void {
  cached = null;
  cacheTime = 0;
}
