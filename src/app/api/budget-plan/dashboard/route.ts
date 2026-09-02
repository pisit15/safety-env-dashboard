import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET ?year= — aggregates for the executive dashboard on the budget landing page.
 * ตัวเลขทั้งหมดเป็น "งบตั้ง (แผน)" คำนวณจาก monthly_amounts (คอลัมน์ amount ไม่ได้ใช้)
 * Returns:
 *   perCompany: [{ companyId, safety, environment, total }]
 *   perCategory: [{ name, planType, total, count }]
 *   perMonth: [{ month: 1-12, safety, environment }]
 */
export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'Missing year' }, { status: 400 });
  }
  try {
    const sb = getSupabase();
    const [itemsRes, catsRes] = await Promise.all([
      sb.from('budget_items')
        .select('company_id, plan_type, category_id, monthly_amounts')
        .eq('year', year),
      sb.from('budget_categories').select('id, name'),
    ]);
    if (itemsRes.error) throw itemsRes.error;

    const catName: Record<string, string> = {};
    (catsRes.data || []).forEach((c: { id: number; name: string }) => { catName[String(c.id)] = c.name; });

    const perCompany: Record<string, { safety: number; environment: number }> = {};
    const perCategory: Record<string, { name: string; planType: string; total: number; count: number }> = {};
    const perMonth = Array.from({ length: 12 }, () => ({ safety: 0, environment: 0 }));

    (itemsRes.data || []).forEach((it: {
      company_id: string; plan_type: string | null;
      category_id: number | null; monthly_amounts: Record<string, number> | null;
    }) => {
      const isEnv = it.plan_type === 'environment';
      const cid = it.company_id;
      if (!perCompany[cid]) perCompany[cid] = { safety: 0, environment: 0 };
      let itemTotal = 0;
      if (it.monthly_amounts) {
        for (const [m, v] of Object.entries(it.monthly_amounts)) {
          const n = Number(v);
          if (!Number.isFinite(n)) continue;
          itemTotal += n;
          const mi = parseInt(m, 10) - 1;
          if (mi >= 0 && mi < 12) {
            if (isEnv) perMonth[mi].environment += n; else perMonth[mi].safety += n;
          }
        }
      }
      if (isEnv) perCompany[cid].environment += itemTotal; else perCompany[cid].safety += itemTotal;

      const cKey = `${it.category_id ?? 'none'}|${isEnv ? 'environment' : 'safety'}`;
      if (!perCategory[cKey]) {
        perCategory[cKey] = {
          name: catName[String(it.category_id)] || 'ไม่ระบุหมวด',
          planType: isEnv ? 'environment' : 'safety',
          total: 0, count: 0,
        };
      }
      perCategory[cKey].total += itemTotal;
      perCategory[cKey].count += 1;
    });

    return NextResponse.json({
      year,
      perCompany: Object.entries(perCompany).map(([companyId, v]) => ({
        companyId, safety: v.safety, environment: v.environment, total: v.safety + v.environment,
      })).sort((a, b) => b.total - a.total),
      perCategory: Object.values(perCategory).sort((a, b) => b.total - a.total),
      perMonth: perMonth.map((v, i) => ({ month: i + 1, ...v })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to build dashboard', detail: msg }, { status: 500 });
  }
}
