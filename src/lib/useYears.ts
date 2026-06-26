'use client';

import { useEffect, useState } from 'react';
import { AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from './companies';

export interface YearsInfo {
  /** All years known to the system (for read-only history views). */
  years: number[];
  /** Years that are selectable (active). */
  active: number[];
  /** Newest active year — sensible default selection. */
  default: number;
  /** True until the API has responded at least once. */
  loading: boolean;
}

/**
 * Client hook that loads the available/active years from /api/plan-years
 * (DB-driven via the plan_years table). Falls back to the static constants
 * from ./companies until the request resolves, so there is no hydration flash.
 */
export function useYears(): YearsInfo {
  const [info, setInfo] = useState<{ years: number[]; active: number[]; default: number }>({
    years: [...AVAILABLE_YEARS].sort((a, b) => a - b),
    active: [...ACTIVE_YEARS].sort((a, b) => a - b),
    default: DEFAULT_YEAR,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/plan-years')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d && Array.isArray(d.years) && d.years.length > 0) {
          const active = Array.isArray(d.active) && d.active.length > 0 ? d.active : d.years;
          setInfo({
            years: d.years,
            active,
            default: typeof d.default === 'number' ? d.default : DEFAULT_YEAR,
          });
        }
      })
      .catch(() => { /* keep static fallback */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { ...info, loading };
}
