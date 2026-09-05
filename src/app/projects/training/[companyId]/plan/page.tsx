'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { ClipboardList, ArrowLeft, Save, Lock, Unlock, Download } from 'lucide-react';

interface MasterCourse {
  id: string; sort_order: number; category: string; course_name: string;
  default_hours: number; in_house_external: string; necessity_default: string;
}
interface PlanRow {
  id: string; planned_month: number | null; hours_per_course: number; planned_participants: number;
  target_group: string; training_necessity: string; budget: number; in_house_external: string;
  is_active: boolean; training_sessions?: { id: string }[];
}
interface RowState {
  selected: boolean; planned_month: number | ''; hours: number; participants: number;
  target_group: string; necessity: string; budget: number; in_ex: string;
  hasSessions: boolean; existed: boolean;
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

export default function TrainingPlanBuilderPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const router = useRouter();
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === companyId);

  const [year, setYear] = useState<number>(new Date().getFullYear() + 1);
  const [master, setMaster] = useState<MasterCourse[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({}); // key = master.id
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  /* Lock (pattern เดียวกับแผนงบประมาณ) */
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lockedBy: string | null }>({ locked: false, lockedBy: null });
  const fetchLock = useCallback(async () => {
    try {
      const res = await fetch(`/api/training/plan-locks?companyId=${companyId}&year=${year}`);
      const d = await res.json();
      setLockInfo({ locked: !!d.locked, lockedBy: d.lock?.locked_by || null });
    } catch { setLockInfo({ locked: false, lockedBy: null }); }
  }, [companyId, year]);
  useEffect(() => { fetchLock(); }, [fetchLock]);
  const readOnly = lockInfo.locked && !auth.isAdmin;

  const toggleLock = async () => {
    if (!auth.isAdmin) return;
    try {
      if (lockInfo.locked) {
        const res = await fetch(`/api/training/plan-locks?companyId=${companyId}&year=${year}&isAdmin=true&by=${encodeURIComponent((auth as unknown as { adminName?: string }).adminName || 'admin')}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
        setToast({ type: 'success', msg: `ปลดล็อกแผนปี ${year} แล้ว — user แก้ไขได้` });
      } else {
        const res = await fetch('/api/training/plan-locks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, year, isAdmin: true, lockedBy: (auth as unknown as { adminName?: string }).adminName || 'admin' }),
        });
        const d = await res.json();
        if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
        setToast({ type: 'success', msg: `ล็อกแผนปี ${year} แล้ว — user แก้ไขไม่ได้` });
      }
      fetchLock();
    } catch { setToast({ type: 'error', msg: 'ดำเนินการไม่สำเร็จ' }); }
  };

  const isLoggedIn = auth.isAdmin || auth.getCompanyAuth(companyId).isLoggedIn;
  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!isLoggedIn) router.replace(`/projects/training/${companyId}`);
  }, [auth.isHydrated, isLoggedIn, router, companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training/plan-builder?companyId=${companyId}&year=${year}`);
      const data = await res.json();
      const m: MasterCourse[] = data.master || [];
      const plans: Record<string, PlanRow> = data.plans || {};
      setMaster(m);
      const next: Record<string, RowState> = {};
      m.forEach(c => {
        const p = plans[norm(c.course_name)];
        next[c.id] = p ? {
          selected: p.is_active !== false,
          planned_month: p.planned_month || '',
          hours: Number(p.hours_per_course) || Number(c.default_hours) || 0,
          participants: Number(p.planned_participants) || 0,
          target_group: p.target_group || '',
          necessity: p.training_necessity || c.necessity_default || '',
          budget: Number(p.budget) || 0,
          in_ex: p.in_house_external || c.in_house_external || 'In-House',
          hasSessions: (p.training_sessions || []).length > 0,
          existed: true,
        } : {
          selected: false, planned_month: '', hours: Number(c.default_hours) || 0, participants: 0,
          target_group: '', necessity: c.necessity_default || '', budget: 0,
          in_ex: c.in_house_external || 'In-House', hasSessions: false, existed: false,
        };
      });
      setRows(next);
    } catch { setMaster([]); setRows({}); }
    setLoading(false);
  }, [companyId, year]);
  useEffect(() => { if (isLoggedIn) load(); }, [load, isLoggedIn]);

  const upd = (id: string, patch: Partial<RowState>) => setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const summary = useMemo(() => {
    const sel = master.filter(c => rows[c.id]?.selected);
    return {
      count: sel.length,
      people: sel.reduce((s, c) => s + (rows[c.id].participants || 0), 0),
      hours: sel.reduce((s, c) => s + (rows[c.id].hours || 0) * (rows[c.id].participants || 0), 0),
      budget: sel.reduce((s, c) => s + (rows[c.id].budget || 0), 0),
    };
  }, [master, rows]);

  const handleSave = async () => {
    if (readOnly) return;
    const missingMonth = master.filter(c => rows[c.id]?.selected && !rows[c.id].planned_month);
    if (missingMonth.length > 0) {
      setToast({ type: 'error', msg: `กรุณาระบุเดือนแผนของ: ${missingMonth.slice(0, 3).map(c => c.course_name).join(', ')}${missingMonth.length > 3 ? ` และอีก ${missingMonth.length - 3} หลักสูตร` : ''}` });
      return;
    }
    setSaving(true);
    try {
      const items = master.map(c => {
        const r = rows[c.id];
        return {
          course_name: c.course_name, category: c.category, sort_order: c.sort_order,
          selected: !!r?.selected, planned_month: r?.planned_month || null,
          hours_per_course: r?.hours || 0, planned_participants: r?.participants || 0,
          target_group: r?.target_group || '', training_necessity: r?.necessity || '',
          budget: r?.budget || 0, in_house_external: r?.in_ex || 'In-House',
        };
      });
      const res = await fetch('/api/training/plan-builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, year, items, isAdmin: auth.isAdmin === true }),
      });
      const d = await res.json();
      if (d.error || (d.errors && d.errors.length > 0)) {
        setToast({ type: 'error', msg: d.error || `บันทึกบางส่วนไม่สำเร็จ: ${(d.errors || []).slice(0, 2).join('; ')}` });
      } else {
        setToast({ type: 'success', msg: `บันทึกแผนปี ${year} แล้ว — เพิ่ม ${d.inserted} · แก้ไข ${d.updated}${d.deactivated ? ` · เอาออก ${d.deactivated}` : ''}` });
        load();
      }
    } catch { setToast({ type: 'error', msg: 'บันทึกไม่สำเร็จ' }); }
    setSaving(false);
  };

  if (!auth.isHydrated || !isLoggedIn) return null;

  const inputSt: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', fontSize: 12, background: 'var(--card-solid)', color: 'var(--text-primary)' };
  let lastCategory = '';

  return (
    <div style={{ padding: '26px 24px', maxWidth: 1250, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={`/projects/training/${companyId}`} style={{ color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={18} /></Link>
          <ClipboardList size={22} style={{ color: '#2563eb' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            ทำแผนอบรมปี {year} — {company?.name || companyId.toUpperCase()}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.open(`/api/training/plan-export?year=${year}&format=survey&companyId=${companyId}`, '_blank')}
            title="Export แบบสำรวจของบริษัทนี้เป็น Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={13} /> Export บริษัทนี้
          </button>
          {auth.isAdmin && (
            <>
              <button onClick={() => window.open(`/api/training/plan-export?year=${year}&format=survey`, '_blank')}
                title="Export แบบสำรวจทุกบริษัท (Summary + sheet ละบริษัท)"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={13} /> ทุกบริษัท
              </button>
              <button onClick={() => window.open(`/api/training/plan-export?year=${year}&format=matrix`, '_blank')}
                title="Export ตารางไขว้ หลักสูตร × บริษัท (จำนวนคน, N = ไม่จัด)"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={13} /> ตารางไขว้
              </button>
            </>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ ...inputSt, fontWeight: 600, cursor: 'pointer', padding: '7px 12px' }}>
            {[0, 1, 2].map(d => { const y = new Date().getFullYear() + 1 - d; return <option key={y} value={y}>ปี {y}</option>; })}
          </select>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        ติ๊กเลือกหลักสูตรที่จะจัดในปี {year} แล้วกรอกรายละเอียด — รายชื่อและลำดับมาจาก Master กลาง ทุกบริษัทเรียงเหมือนกัน · หลักสูตรที่ไม่จัดให้เว้นว่าง
      </p>

      {/* Lock banner (user เมื่อแผนถูกล็อก) */}
      {readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 12.5, color: '#475569', fontWeight: 600 }}>
          <Lock size={14} /> แผนปี {year} ถูกล็อกโดย Admin{lockInfo.lockedBy ? ` (${lockInfo.lockedBy})` : ''} — ดูได้อย่างเดียว หากต้องการแก้ไขกรุณาติดต่อ Admin
        </div>
      )}

      {/* Summary + Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12, padding: '10px 14px', background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>เลือกแล้ว <b style={{ color: '#2563eb' }}>{summary.count}</b> หลักสูตร</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ผู้เข้าอบรมรวม <b style={{ color: 'var(--text-primary)' }}>{summary.people.toLocaleString()}</b> คน</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>รวม <b style={{ color: 'var(--text-primary)' }}>{summary.hours.toLocaleString()}</b> ชม.-คน</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>งบรวม <b style={{ color: 'var(--text-primary)' }}>{summary.budget.toLocaleString()}</b> ฿</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {auth.isAdmin && (
            <button onClick={toggleLock}
              title={lockInfo.locked ? 'ปลดล็อกให้ user แก้ไขได้' : 'ล็อกแผน — user จะแก้ไขไม่ได้'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${lockInfo.locked ? '#16a34a' : '#64748b'}`, background: lockInfo.locked ? 'rgba(34,197,94,0.1)' : 'var(--bg-secondary)', color: lockInfo.locked ? '#16a34a' : '#475569' }}>
              {lockInfo.locked ? <><Unlock size={14} /> ปลดล็อก</> : <><Lock size={14} /> ล็อกแผน</>}
            </button>
          )}
          {lockInfo.locked && !auth.isAdmin ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#475569' }}><Lock size={14} /> ล็อกแล้ว</span>
          ) : (
            <button onClick={handleSave} disabled={saving || loading || readOnly}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Save size={14} /> {saving ? 'กำลังบันทึก...' : `บันทึกแผนปี ${year}`}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
      ) : (
        <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, opacity: readOnly ? 0.8 : 1 }}>
        <div style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['จัด', 'No.', 'หลักสูตร', 'In/Ex', 'เดือน', 'ชม.', 'คน', 'รวม ชม.', 'กลุ่มเป้าหมาย', 'งบ (฿)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 8px', fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {master.map(c => {
                const r = rows[c.id];
                if (!r) return null;
                const showCat = c.category !== lastCategory;
                lastCategory = c.category;
                return (
                  <>
                    {showCat && (
                      <tr key={`cat-${c.category}`} style={{ background: 'rgba(37,99,235,0.06)' }}>
                        <td colSpan={10} style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#2563eb' }}>{c.category}</td>
                      </tr>
                    )}
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)', opacity: r.selected ? 1 : 0.55, background: r.selected ? 'transparent' : undefined }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="checkbox" checked={r.selected} onChange={e => upd(c.id, { selected: e.target.checked })}
                          style={{ width: 15, height: 15, cursor: 'pointer' }}
                          title={r.hasSessions && r.existed && r.selected ? 'หลักสูตรนี้มีรอบอบรมแล้ว — เอาออกจะซ่อนจากตารางปี (ข้อมูลไม่หาย)' : undefined} />
                      </td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{c.sort_order}</td>
                      <td style={{ padding: '6px 8px', minWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>{c.course_name}</div>
                        {r.selected && (
                          <input value={r.necessity} onChange={e => upd(c.id, { necessity: e.target.value })}
                            style={{ ...inputSt, width: '100%', marginTop: 4, fontSize: 10.5 }} placeholder="ความจำเป็น / กฎหมายอ้างอิง" />
                        )}
                        {r.hasSessions && <span style={{ fontSize: 9.5, color: '#16a34a', fontWeight: 700 }}>● มีรอบอบรมแล้ว</span>}
                      </td>
                      {r.selected ? (
                        <>
                          <td style={{ padding: '6px 4px' }}>
                            <select value={r.in_ex} onChange={e => upd(c.id, { in_ex: e.target.value })} style={{ ...inputSt, width: 86 }}>
                              <option value="In-House">In-House</option>
                              <option value="External">External</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <select value={r.planned_month} onChange={e => upd(c.id, { planned_month: e.target.value ? Number(e.target.value) : '' })}
                              style={{ ...inputSt, width: 76, borderColor: r.planned_month ? undefined : '#f59e0b' }}>
                              <option value="">เดือน*</option>
                              {TH_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" min={0} value={r.hours} onChange={e => upd(c.id, { hours: parseFloat(e.target.value) || 0 })} style={{ ...inputSt, width: 52 }} />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" min={0} value={r.participants} onChange={e => upd(c.id, { participants: parseInt(e.target.value) || 0 })} style={{ ...inputSt, width: 56 }} />
                          </td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {(r.hours * r.participants).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input value={r.target_group} onChange={e => upd(c.id, { target_group: e.target.value })} style={{ ...inputSt, width: 150 }} placeholder="เช่น พนักงานใหม่" />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" min={0} value={r.budget} onChange={e => upd(c.id, { budget: parseFloat(e.target.value) || 0 })} style={{ ...inputSt, width: 92 }} />
                          </td>
                        </>
                      ) : (
                        <td colSpan={7} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>— ไม่จัดในปีนี้ —</td>
                      )}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        </fieldset>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, maxWidth: 420, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: toast.type === 'success' ? '#dcfce7' : '#fee2e2', color: toast.type === 'success' ? '#15803d' : '#b91c1c', border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
