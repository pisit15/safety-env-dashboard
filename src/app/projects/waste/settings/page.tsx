'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import type { WasteMethod, WasteTarget } from '@/lib/types';

const C_RECYCLE = '#59A14F';
const C_DISPOSAL = '#E15759';
const C_PRIMARY = '#4E79A7';

const emptyTarget = (companyId: string): WasteTarget => ({
  id: 0,
  company_id: companyId,
  base_year: 2023,
  base_recycle_nonhaz_ton: 0,
  base_recycle_haz_ton: 0,
  base_disposal_nonhaz_ton: 0,
  base_disposal_haz_ton: 0,
  recycle_step_pct: 5,
  disposal_step_pct: 3,
  target_end_year: 2030,
});

export default function WasteSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const { companies } = useCompanies();

  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) router.replace('/projects/waste');
  }, [auth.isHydrated, auth.isAdmin, router]);

  const [methods, setMethods] = useState<WasteMethod[]>([]);
  const [targets, setTargets] = useState<WasteTarget[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const loadAll = () => {
    Promise.all([
      fetch('/api/waste/methods').then(r => r.json()),
      fetch('/api/waste/targets').then(r => r.json()),
    ]).then(([met, tar]) => {
      setMethods(met.methods || []);
      setTargets(tar.targets || []);
    }).catch(() => setToast({ type: 'error', msg: 'โหลดข้อมูลล้มเหลว' }));
  };
  useEffect(() => { if (auth.isAdmin) loadAll(); }, [auth.isAdmin]);

  // ── Methods management ──
  const [newMethod, setNewMethod] = useState('');
  const [newIsRecycle, setNewIsRecycle] = useState(true);

  const addMethod = async () => {
    if (!newMethod.trim()) return;
    const res = await fetch('/api/waste/methods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method_name: newMethod.trim(), is_recycle: newIsRecycle, sort_order: methods.length + 1 }),
    });
    const data = await res.json();
    if (data.error) setToast({ type: 'error', msg: data.error });
    else { setToast({ type: 'success', msg: 'เพิ่มวิธีกำจัดแล้ว' }); setNewMethod(''); loadAll(); }
  };

  const updateMethod = async (m: WasteMethod, fields: Partial<WasteMethod>) => {
    const res = await fetch('/api/waste/methods', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, ...fields }),
    });
    const data = await res.json();
    if (data.error) setToast({ type: 'error', msg: data.error });
    else { setMethods(prev => prev.map(x => x.id === m.id ? { ...x, ...fields } : x)); }
  };

  const [confirmDeleteMethod, setConfirmDeleteMethod] = useState<WasteMethod | null>(null);
  const deleteMethod = async () => {
    if (!confirmDeleteMethod) return;
    const res = await fetch(`/api/waste/methods?id=${confirmDeleteMethod.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { setToast({ type: 'success', msg: 'ลบวิธีกำจัดแล้ว' }); loadAll(); }
    else setToast({ type: 'error', msg: data.error || 'ลบล้มเหลว' });
    setConfirmDeleteMethod(null);
  };

  // ── Targets management ──
  const [selCompany, setSelCompany] = useState('all');
  const currentTarget = useMemo(() =>
    targets.find(t => t.company_id === selCompany) || emptyTarget(selCompany),
  [targets, selCompany]);
  const [draft, setDraft] = useState<WasteTarget>(currentTarget);
  useEffect(() => { setDraft(currentTarget); }, [currentTarget]);
  const [savingTarget, setSavingTarget] = useState(false);

  const saveTarget = async () => {
    setSavingTarget(true);
    try {
      const { id: _id, updated_at: _ua, ...body } = draft;
      const res = await fetch('/api/waste/targets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, company_id: selCompany }),
      });
      const data = await res.json();
      if (data.error) setToast({ type: 'error', msg: data.error });
      else { setToast({ type: 'success', msg: 'บันทึกเป้าหมายแล้ว' }); loadAll(); }
    } catch { setToast({ type: 'error', msg: 'บันทึกล้มเหลว' }); }
    setSavingTarget(false);
  };

  if (!auth.isHydrated || !auth.isAdmin) return null;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' };
  const numField = (label: string, key: keyof WasteTarget, step = '0.01') => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" step={step} value={Number(draft[key]) || 0}
        onChange={e => setDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
    </div>
  );

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Settings size={22} style={{ color: C_PRIMARY }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ตั้งค่าการจัดการขยะ</h1>
      </div>

      {/* Methods */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>วิธีกำจัด (Disposal Methods)</h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          กำหนดว่าแต่ละวิธีนับเป็น &ldquo;รีไซเคิล/ใช้ซ้ำ&rdquo; (เป้าเพิ่ม) หรือ &ldquo;กำจัด&rdquo; (เป้าลด) — มีผลกับการคำนวณทุกหน้าทันที
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {methods.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', opacity: m.is_active ? 1 : 0.5 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.method_name}</span>
              <button onClick={() => updateMethod(m, { is_recycle: !m.is_recycle })}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: m.is_recycle ? '#59A14F18' : '#E1575918', color: m.is_recycle ? C_RECYCLE : C_DISPOSAL }}>
                {m.is_recycle ? '♻ รีไซเคิล/ใช้ซ้ำ' : '🗑 กำจัด'}
              </button>
              <button onClick={() => updateMethod(m, { is_active: !m.is_active })}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--card-solid)', color: 'var(--text-secondary)' }}>
                {m.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </button>
              <button onClick={() => setConfirmDeleteMethod(m)} title="ลบ" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={14} style={{ color: C_DISPOSAL }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input value={newMethod} onChange={e => setNewMethod(e.target.value)} placeholder="ชื่อวิธีกำจัดใหม่ (อังกฤษ) เช่น Composting"
            onKeyDown={e => { if (e.key === 'Enter') addMethod(); }}
            style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <select value={newIsRecycle ? 'r' : 'd'} onChange={e => setNewIsRecycle(e.target.value === 'r')} style={{ ...inputStyle, width: 160 }}>
            <option value="r">♻ รีไซเคิล/ใช้ซ้ำ</option>
            <option value="d">🗑 กำจัด</option>
          </select>
          <button onClick={addMethod} className="flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: C_PRIMARY }}>
            <Plus size={13} /> เพิ่ม
          </button>
        </div>
      </div>

      {/* Targets */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>เป้าหมาย (ฐานปี → 2030)</h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          กรอกค่าฐานปี {draft.base_year} (ตัน) — เป้ารายปี = ฐาน × (1 ± %สะสม) เช่น รีไซเคิล 2026 = ฐาน × (1 + {draft.recycle_step_pct}%×3)
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>ระดับเป้าหมาย</label>
          <select value={selCompany} onChange={e => setSelCompany(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
            <option value="all">🏢 ภาพรวมกลุ่ม (ทุกบริษัท)</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {numField('ปีฐาน (Base Year)', 'base_year', '1')}
          {numField('ปีเป้าหมายสิ้นสุด', 'target_end_year', '1')}
          {numField('รีไซเคิลเพิ่ม %/ปี', 'recycle_step_pct', '0.5')}
          {numField('กำจัดลด %/ปี', 'disposal_step_pct', '0.5')}
          {numField('ฐานรีไซเคิล Non-Haz (ตัน)', 'base_recycle_nonhaz_ton')}
          {numField('ฐานรีไซเคิล Haz (ตัน)', 'base_recycle_haz_ton')}
          {numField('ฐานกำจัด Non-Haz (ตัน)', 'base_disposal_nonhaz_ton')}
          {numField('ฐานกำจัด Haz (ตัน)', 'base_disposal_haz_ton')}
        </div>
        <button onClick={saveTarget} disabled={savingTarget} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold text-white mt-4" style={{ background: savingTarget ? 'var(--muted)' : C_RECYCLE }}>
          <Save size={14} /> {savingTarget ? 'กำลังบันทึก...' : `บันทึกเป้าหมาย ${selCompany === 'all' ? 'กลุ่ม' : companies.find(c => c.id === selCompany)?.name || selCompany}`}
        </button>
      </div>

      {/* Delete method confirm */}
      {confirmDeleteMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmDeleteMethod(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 14, padding: '20px 24px', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>ยืนยันการลบ</h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px' }}>ลบวิธีกำจัด &ldquo;{confirmDeleteMethod.method_name}&rdquo;? (ลบไม่ได้ถ้ามีบันทึกใช้อยู่ — ใช้ปิดใช้งานแทน)</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={deleteMethod} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: C_DISPOSAL }}>ลบ</button>
              <button onClick={() => setConfirmDeleteMethod(null)} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl text-[13px] font-semibold text-white shadow-lg" style={{ background: toast.type === 'success' ? C_RECYCLE : C_DISPOSAL }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
