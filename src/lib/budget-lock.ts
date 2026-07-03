import { getSupabase } from './supabase';

export interface BudgetLock {
  id: number;
  company_id: string;
  year: number;
  locked_by: string;
  note?: string | null;
  created_at: string;
}

/** Returns the lock row if the company's budget for that year is locked, else null. */
export async function getBudgetLock(companyId: string, year: number): Promise<BudgetLock | null> {
  try {
    const { data } = await getSupabase()
      .from('budget_locks')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .maybeSingle();
    return (data as BudgetLock) || null;
  } catch {
    return null; // table missing or transient error — fail open
  }
}

/** Look up an item's company/year, then check its lock. Used by PUT/DELETE guards. */
export async function getLockForItem(itemId: number | string): Promise<BudgetLock | null> {
  try {
    const { data: item } = await getSupabase()
      .from('budget_items')
      .select('company_id, year')
      .eq('id', itemId)
      .maybeSingle();
    if (!item) return null;
    return getBudgetLock(item.company_id as string, item.year as number);
  } catch {
    return null;
  }
}

export const LOCKED_MSG = 'งบประมาณปีนี้ถูกปิดการแก้ไขแล้ว — ติดต่อ Admin หากต้องการแก้ไข';
