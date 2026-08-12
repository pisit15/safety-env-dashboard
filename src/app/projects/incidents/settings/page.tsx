'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { Settings, Plus, Trash2, Pencil, Search, Check, X } from 'lucide-react';

const C_PRIMARY = '#4E79A7';
const C_POSITIVE = '#59A14F';
const C_DANGER = '#E15759';

interface RefItem { id: number; name: string; grp: string; sort_order: number; is_active: boolean }
type RefKind = 'event' | 'source' | 'damage_nature';

const refInputStyle: React.CSSProperties = { width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 12 };

// Manager for one classification master list (search + add + inline edit + active toggle + delete)
function RefSection({ title, hint, rows, onAdd, onSave, onToggle, onDelete }: {
  title: string;
  hint: string;
  rows: RefItem[];
  onAdd: (name: string, grp: string) => Promise<boolean>;
  onSave: (id: number, name: string, grp: string) => Promise<boolean>;
  onToggle: (item: RefItem) => void;
  onDelete: (item: RefItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newGrp, setNewGrp] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftGrp, setDraftGrp] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter(r => r.name.toLowerCase().includes(q) || r.grp.toLowerCase().includes(q)) : rows;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (await onAdd(newName, newGrp)) { setNewName(''); setNewGrp(''); }
  };

  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title} ({rows.length})</h3>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." style={{ ...refInputStyle, width: 200, paddingLeft: 25 }} />
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 10px' }}>{hint}</p>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="+ ชื่อรายการใหม่..."
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} style={{ ...refInputStyle, flex: 2, minWidth: 200 }} />
        <input value={newGrp} onChange={e => setNewGrp(e.target.value)} placeholder="กลุ่ม (เช่น ยานพาหนะ, ธรรมชาติ)"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} style={{ ...refInputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={handleAdd} disabled={!newName.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: C_PRIMARY }}>
          <Plus size={13} /> เพิ่ม
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>ไม่พบรายการ</div>
        ) : filtered.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--border)', opacity: r.is_active ? 1 : 0.45 }}>
            {editId === r.id ? (
              <>
                <input value={draftName} onChange={e => setDraftName(e.target.value)} style={{ ...refInputStyle, flex: 2 }} />
                <input value={draftGrp} onChange={e => setDraftGrp(e.target.value)} style={{ ...refInputStyle, flex: 1 }} />
                <button onClick={async () => { if (await onSave(r.id, draftName, draftGrp)) setEditId(null); }} title="บันทึก" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Check size={15} style={{ color: C_POSITIVE }} /></button>
                <button onClick={() => setEditId(null)} title="ยกเลิก" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} style={{ color: 'var(--text-secondary)' }} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 2, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{r.grp || '—'}</span>
                <button onClick={() => onToggle(r)}
                  style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--card-solid)', color: r.is_active ? C_POSITIVE : 'var(--text-secondary)' }}>
                  {r.is_active ? 'ใช้งาน' : 'ปิด'}
                </button>
                <button onClick={() => { setEditId(r.id); setDraftName(r.name); setDraftGrp(r.grp); }} title="แก้ไข" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Pencil size={13} style={{ color: C_PRIMARY }} /></button>
                <button onClick={() => onDelete(r)} title="ลบ" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} style={{ color: C_DANGER }} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncidentSettingsPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) router.replace('/projects/incidents');
  }, [auth.isHydrated, auth.isAdmin, router]);

  const [events, setEvents] = useState<RefItem[]>([]);
  const [sources, setSources] = useState<RefItem[]>([]);
  const [natures, setNatures] = useState<RefItem[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const loadAll = () => {
    fetch('/api/incidents/refs').then(r => r.json()).then(d => {
      setEvents(d.events || []);
      setSources(d.sources || []);
      setNatures(d.damage_natures || []);
    }).catch(() => setToast({ type: 'error', msg: 'โหลดข้อมูลล้มเหลว' }));
  };
  useEffect(() => { if (auth.isAdmin) loadAll(); }, [auth.isAdmin]);

  const addRef = async (kind: RefKind, name: string, grp: string): Promise<boolean> => {
    const res = await fetch('/api/incidents/refs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, grp }) });
    const data = await res.json();
    if (data.error) { setToast({ type: 'error', msg: data.error }); return false; }
    setToast({ type: 'success', msg: 'เพิ่มรายการแล้ว' }); loadAll(); return true;
  };
  const saveRef = async (kind: RefKind, id: number, name: string, grp: string): Promise<boolean> => {
    const res = await fetch('/api/incidents/refs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, name, grp }) });
    const data = await res.json();
    if (data.error) { setToast({ type: 'error', msg: data.error }); return false; }
    setToast({ type: 'success', msg: 'บันทึกการแก้ไขแล้ว' }); loadAll(); return true;
  };
  const toggleRef = async (kind: RefKind, item: RefItem) => {
    const res = await fetch('/api/incidents/refs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: item.id, is_active: !item.is_active }) });
    const data = await res.json();
    if (data.error) setToast({ type: 'error', msg: data.error });
    else loadAll();
  };
  const [confirmDelete, setConfirmDelete] = useState<{ kind: RefKind; item: RefItem } | null>(null);
  const deleteRef = async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/incidents/refs?kind=${confirmDelete.kind}&id=${confirmDelete.item.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { setToast({ type: 'success', msg: 'ลบรายการแล้ว' }); loadAll(); }
    else setToast({ type: 'error', msg: data.error || 'ลบล้มเหลว' });
    setConfirmDelete(null);
  };

  if (!auth.isHydrated || !auth.isAdmin) return null;

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Settings size={22} style={{ color: C_PRIMARY }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ตั้งค่ารายการจำแนกอุบัติการณ์</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
        รายการเหล่านี้ใช้ในฟอร์มบันทึกอุบัติการณ์ (เหตุการณ์/การสัมผัส, แหล่งที่มา, ทรัพย์สินที่เสียหาย, ลักษณะความเสียหาย) —
        แก้ไขแล้วมีผลทันทีกับทุกบริษัท • ปิดใช้งาน = ซ่อนจากรายการให้เลือก โดยข้อมูลเก่าไม่ได้รับผลกระทบ
      </p>

      <RefSection
        title="เหตุการณ์/การสัมผัส (Event/Exposure)"
        hint="แกนที่ 1: เกิดอะไรขึ้น เช่น ตกจากที่สูง, ไฟไหม้, ชน/กระแทก — อิงมาตรฐาน OIICS"
        rows={events}
        onAdd={(n, g) => addRef('event', n, g)}
        onSave={(id, n, g) => saveRef('event', id, n, g)}
        onToggle={item => toggleRef('event', item)}
        onDelete={item => setConfirmDelete({ kind: 'event', item })}
      />

      <RefSection
        title="แหล่งที่มา / ทรัพย์สิน (Source)"
        hint="แกนที่ 2: สิ่งที่ทำให้เกิดเหตุหรือทรัพย์สินที่เสียหาย — ใช้รายการเดียวกันทั้งช่อง แหล่งที่มา, แหล่งที่มาต้นทาง และ ทรัพย์สินที่เสียหาย"
        rows={sources}
        onAdd={(n, g) => addRef('source', n, g)}
        onSave={(id, n, g) => saveRef('source', id, n, g)}
        onToggle={item => toggleRef('source', item)}
        onDelete={item => setConfirmDelete({ kind: 'source', item })}
      />

      <RefSection
        title="ลักษณะความเสียหาย (Nature of Damage)"
        hint="แกนที่ 3: ความเสียหายเป็นแบบไหน เช่น ไหม้, แตกหัก, บุบ/ยุบ, น้ำท่วมเสียหาย"
        rows={natures}
        onAdd={(n, g) => addRef('damage_nature', n, g)}
        onSave={(id, n, g) => saveRef('damage_nature', id, n, g)}
        onToggle={item => toggleRef('damage_nature', item)}
        onDelete={item => setConfirmDelete({ kind: 'damage_nature', item })}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 14, padding: '20px 24px', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>ยืนยันการลบ</h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              ลบ &ldquo;{confirmDelete.item.name}&rdquo; ออกจากรายการให้เลือก? ข้อมูลอุบัติการณ์ที่บันทึกด้วยค่านี้ไปแล้วไม่ได้รับผลกระทบ
              (ถ้าเพียงต้องการซ่อน แนะนำใช้ &ldquo;ปิดใช้งาน&rdquo; แทน)
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={deleteRef} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: C_DANGER }}>ลบ</button>
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl text-[13px] font-semibold text-white shadow-lg" style={{ background: toast.type === 'success' ? C_POSITIVE : C_DANGER }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
