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

    // 1 หลักสูตรอาจมีหลายแถว (จัดหลายรอบ/หลายเดือน) → เก็บเป็น array ต่อชื่อ
    const plans: Record<string, unknown[]> = {};
    (plansRes.data || []).forEach((p: { course_name: string }) => {
      const k = norm(p.course_name);
      if (!plans[k]) plans[k] = [];
      plans[k].push(p);
    });
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
  planned_months: number[]; // เลือกได้หลายเดือน → สร้างแผนแยกรายเดือน (1 รอบ = 1 แถว ในตารางปี)
  hours_per_course: number;
  planned_participants: number; // ต่อรอบ
  target_group: string;
  training_necessity: string;
  budget: number; // ต่อรอบ
  in_house_external: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, items, isAdmin } = body as { companyId?: string; year?: number; items?: BuilderItem[]; isAdmin?: boolean };
    if (!companyId || !Number.isFinite(Number(year)) || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing companyId, year or items' }, { status: 400 });
    }
    const sb = getSupabase();
    // Lock guard: แผนที่ admin ล็อกแล้ว user แก้ไม่ได้
    const { data: lockRow } = await sb.from('training_plan_locks').select('locked_by')
      .eq('company_id', companyId).eq('year', Number(year)).maybeSingle();
    if (lockRow && isAdmin !== true) {
      return NextResponse.json({ error: `แผนปี ${year} ถูกล็อกโดย Admin แล้ว — แก้ไขไม่ได้`, locked: true }, { status: 403 });
    }
    const { data: existing, error: exErr } = await sb
      .from('training_plans').select('id, course_name, planned_month').eq('company_id', companyId).eq('year', year);
    if (exErr) throw exErr;
    const existingByName: Record<string, { id: string; planned_month: number | null }[]> = {};
    (existing || []).forEach((p: { id: string; course_name: string; planned_month: number | null }) => {
      const k = norm(p.course_name);
      if (!existingByName[k]) existingByName[k] = [];
      existingByName[k].push({ id: p.id, planned_month: p.planned_month });
    });

    let inserted = 0, updated = 0, deactivated = 0;
    const errors: string[] = [];

    for (const it of items) {
      const key = norm(it.course_name);
      const rows = existingByName[key] || [];
      const months = Array.from(new Set((it.planned_months || []).map(Number).filter(m => m >= 1 && m <= 12))).sort((a, b) => a - b);
      const hours = Number(it.hours_per_course) || 0;
      const ppl = Number(it.planned_participants) || 0;
      const baseFields = {
        course_no: Number(it.sort_order) || 999,
        category: it.category || 'Mandatory (กฎหมาย / บังคับ)',
        in_house_external: it.in_house_external || 'In-House',
        hours_per_course: hours,
        planned_participants: ppl,
        total_planned_hours: hours * ppl,
        budget: Number(it.budget) || 0,
        target_group: it.target_group || '',
        training_necessity: it.training_necessity || '',
      };

      if (it.selected && months.length > 0) {
        const usedRowIds = new Set<string>();
        // จับคู่เดือนที่เลือกกับแถวเดิม: เดือนตรงกันก่อน → แถวเดิมที่เหลือ → insert ใหม่
        for (const m of months) {
          const match = rows.find(r => !usedRowIds.has(r.id) && r.planned_month === m)
            || rows.find(r => !usedRowIds.has(r.id));
          if (match) {
            usedRowIds.add(match.id);
            const { error } = await sb.from('training_plans')
              .update({ ...baseFields, planned_month: m, is_active: true }).eq('id', match.id);
            if (error) errors.push(`${key}: ${error.message}`); else updated++;
          } else {
            const { error } = await sb.from('training_plans').insert([{
              company_id: companyId, year: Number(year), course_name: it.course_name,
              ...baseFields, planned_month: m, is_active: true,
            }]);
            if (error) errors.push(`${key}: ${error.message}`); else inserted++;
          }
        }
        // แถวเดิมที่เดือนไม่ถูกเลือกแล้ว → ปิดใช้งาน
        for (const r of rows.filter(r => !usedRowIds.has(r.id))) {
          const { error } = await sb.from('training_plans').update({ is_active: false }).eq('id', r.id);
          if (error) errors.push(`${key}: ${error.message}`); else deactivated++;
        }
      } else if (rows.length > 0) {
        for (const r of rows) {
          const { error } = await sb.from('training_plans').update({ is_active: false }).eq('id', r.id);
          if (error) errors.push(`${key}: ${error.message}`); else deactivated++;
        }
      }
    }

    return NextResponse.json({ success: errors.length === 0, inserted, updated, deactivated, errors });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to save plan', detail: msg }, { status: 500 });
  }
}
