// Waste management shared helpers — target glide path + aggregation
import type { WasteRecord, WasteMethod, WasteTarget } from './types';

export const KG_PER_TON = 1000;

export interface WasteYearAgg {
  year: number;
  recycleNonhazTon: number;
  recycleHazTon: number;
  disposalNonhazTon: number;
  disposalHazTon: number;
  totalTon: number;
  cost: number; // net: positive = revenue
}

/** Build a set of method names that count as recycled/reused */
export function recycleMethodSet(methods: WasteMethod[]): Set<string> {
  return new Set(methods.filter(m => m.is_recycle).map(m => m.method_name));
}

/** Aggregate records into per-year buckets (ton) */
export function aggregateByYear(records: WasteRecord[], recycleSet: Set<string>): WasteYearAgg[] {
  const map = new Map<number, WasteYearAgg>();
  for (const r of records) {
    const year = parseInt(String(r.record_date).slice(0, 4));
    if (!year) continue;
    let agg = map.get(year);
    if (!agg) {
      agg = { year, recycleNonhazTon: 0, recycleHazTon: 0, disposalNonhazTon: 0, disposalHazTon: 0, totalTon: 0, cost: 0 };
      map.set(year, agg);
    }
    const ton = (Number(r.quantity_kg) || 0) / KG_PER_TON;
    const isRecycle = recycleSet.has(r.disposal_method);
    const isHaz = r.waste_category === 'Hazardous';
    if (isRecycle && isHaz) agg.recycleHazTon += ton;
    else if (isRecycle) agg.recycleNonhazTon += ton;
    else if (isHaz) agg.disposalHazTon += ton;
    else agg.disposalNonhazTon += ton;
    agg.totalTon += ton;
    agg.cost += Number(r.cost) || 0;
  }
  return Array.from(map.values()).sort((a, b) => a.year - b.year);
}

export interface WasteTargetForYear {
  year: number;
  cumPctRecycle: number;   // e.g. 15 (means +15% vs base)
  cumPctDisposal: number;  // e.g. 9  (means -9% vs base)
  recycleNonhazTon: number;
  recycleHazTon: number;
  disposalNonhazTon: number;
  disposalHazTon: number;
}

/** Glide-path target for a given year: recycle = base*(1 + step*n/100), disposal = base*(1 - step*n/100), n = year - base_year */
export function targetForYear(t: WasteTarget, year: number): WasteTargetForYear | null {
  const n = year - t.base_year;
  if (n <= 0) return null;
  const up = 1 + (t.recycle_step_pct * n) / 100;
  const down = 1 - (t.disposal_step_pct * n) / 100;
  return {
    year,
    cumPctRecycle: t.recycle_step_pct * n,
    cumPctDisposal: t.disposal_step_pct * n,
    recycleNonhazTon: (Number(t.base_recycle_nonhaz_ton) || 0) * up,
    recycleHazTon: (Number(t.base_recycle_haz_ton) || 0) * up,
    disposalNonhazTon: (Number(t.base_disposal_nonhaz_ton) || 0) * down,
    disposalHazTon: (Number(t.base_disposal_haz_ton) || 0) * down,
  };
}

export const fmtTon = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
