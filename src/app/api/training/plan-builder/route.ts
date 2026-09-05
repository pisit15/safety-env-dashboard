import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** normalize ชื่อหลักสูตรก่อนเทียบ (กันช่องว่าง/ขึ้นบรรทัดต่างกัน) */
const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

/**
 * Plan Builder — user เลือกหลักสูตรจาก master กลางเพื่อสร้างแผนปีของบริษัท
 * GET ?companyId=&year= → { master, plans }  (plans key = ชื่อหลักสูตร normalized)
 * POST { companyId, year, items: [...] } → upsert แผนตามที่เลือก
 *   - เลือก + ยังไม่มีแผน → insert (course_no = ลำดับ master → ทุกบริษัทเรียงเหมือนกัน)
 *   - เลือก + มีแผนอยู่ → update ฟิลด์ + is_active = true
 *   - ไม่เลือก + มีแผนอยู่ → is_active = false (ซ่อน ไม่ลบ — sessions/ผู้เข้าอบรมไม่หาย)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = sp.get('companyId');
    const year = parseInt(sp.get('year') || '', 10);
    if (!companyId || !Number.isFinite(year)) {
      return NextResponse.json({ error: 'Missing companyId or year' }, { status: 400 });
    }
    const sb = getSupabase();
    const [masterRes, plansRes] = await Promise.all([
      sb.from('training_course_master').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      sb.from('training_plans').select('*, training_sessions(id)').eq('company_id', companyId).eq('year', year),
    ]);
    if (masterRes.error) throw masterRes.error;
    if (plansRes.error) throw plansRes.error;

    const plans: Record<string, unknown> = {};
    (plansRes.data || []).forEach((p: { course_name: string }) => { plans[norm(p.course_name)] = p; });
    return NextResponse.json({ master: masterRes.data || [], plans });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to load plan builder', detail: msg }, { status: 500 });
  }
}

interface BuilderItem {
  course_name: string;
  category: string;
  sort_order: number;
  selected: boolean;
  planned_month: number | null;
  hours_per_course: number;
  planned_participants: number;
  target_group: string;
  training_necessity: string;
  budget: number;
  in_house_external: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, items } = body as { companyId?: string; year?: number; items?: BuilderItem[] };
    if (!companyId || !Number.isFinite(Number(year)) || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing companyId, year or items' }, { status: 400 });
    }
    const sb = getSupabase();
    const { data: existing, error: exErr } = await sb
      .from('training_plans').select('id, course_name').eq('company_id', companyId).eq('year', year);
    if (exErr) throw exErr;
    const existingByName: Record<string, string> = {};
    (existing || []).forEach((p: { id: string; course_name: string }) => { existingByName[norm(p.course_name)] = p.id; });

    let inserted = 0, updated = 0, deactivated = 0;
    const errors: string[] = [];

    for (const it of items) {
      const key = norm(it.course_name);
      const existingId = existingByName[key];
      const hours = Number(it.hours_per_course) || 0;
      const ppl = Number(it.planned_participants) || 0;
      const fields = {
        course_no: Number(it.sort_order) || 999,
        category: it.category || 'Mandatory (กฎหมาย / บังคับ)',
        in_house_external: it.in_house_external || 'In-House',
        planned_month: it.planned_month ? Number(it.planned_month) : null,
        hours_per_course: hours,
        planned_participants: ppl,
        total_planned_hours: hours * ppl,
        budget: Number(it.budget) || 0,
        target_group: it.target_group || '',
        training_necessity: it.training_necessity || '',
      };
      if (it.selected) {
        if (existingId) {
          const { error } = await sb.from('training_plans').update({ ...fields, is_active: true }).eq('id', existingId);
          if (error) errors.push(`${key}: ${error.message}`); else updated++;
        } else {
          const { error } = await sb.from('training_plans').insert([{
            company_id: companyId, year: Number(year), course_name: it.course_name, ...fields, is_active: true,
          }]);
          if (error) errors.push(`${key}: ${error.message}`); else inserted++;
        }
      } else if (existingId) {
        const { error } = await sb.from('training_plans').update({ is_active: false }).eq('id', existingId);
        if (error) errors.push(`${key}: ${error.message}`); else deactivated++;
      }
    }

    return NextResponse.json({ success: errors.length === 0, inserted, updated, deactivated, errors });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to save plan', detail: msg }, { status: 500 });
  }
}
