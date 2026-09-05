'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { BookOpen, Plus, ChevronUp, ChevronDown, Pencil, X, Check } from 'lucide-react';

interface MasterCourse {
  id: string;
  sort_order: number;
  category: string;
  course_name: string;
  default_hours: number;
  in_house_external: string;
  necessity_default: string;
  dsd_eligible: boolean;
  is_active: boolean;
}

const CATEGORIES = ['Mandatory (กฎหมาย / บังคับ)', 'ISO / Compliance Requirement', 'Functional Competency', 'Upskills'];

export default function TrainingCourseMasterPage() {
  const auth = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<MasterCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const emptyForm = { course_name: '', category: CATEGORIES[0], default_hours: 6, in_house_external: 'In-House', necessity_default: '', dsd_eligible: false };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  // Category filter
  const [catFilter, setCatFilter] = useState<string>('');
  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) router.replace('/projects/training');
  }, [auth.isHydrated, auth.isAdmin, router]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/training/course-master?all=true');
      const data = await res.json();
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch { setCourses([]); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const api = async (method: 'POST' | 'PUT', body: Record<string, unknown>) => {
    const res = await fetch('/api/training/course-master', {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, isAdmin: true }),
    });
    return res.json();
  };

  const handleAdd = async () => {
    if (!addForm.course_name.trim()) { setToast({ type: 'error', msg: 'กรุณาระบุชื่อหลักสูตร' }); return; }
    setSaving(true);
    const d = await api('POST', addForm);
    setSaving(false);
    if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
    setToast({ type: 'success', msg: 'เพิ่มหลักสูตรแล้ว' });
    setShowAdd(false); setAddForm({ ...emptyForm });
    fetchCourses();
  };

  const startEdit = (c: MasterCourse) => {
    setEditId(c.id);
    setEditForm({ course_name: c.course_name, category: c.category, default_hours: c.default_hours, in_house_external: c.in_house_external, necessity_default: c.necessity_default || '', dsd_eligible: c.dsd_eligible });
  };
  const handleSaveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const d = await api('PUT', { id: editId, ...editForm });
    setSaving(false);
    if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
    setToast({ type: 'success', msg: 'บันทึกแล้ว' });
    setEditId(null);
    fetchCourses();
  };

  const move = async (c: MasterCourse, dir: -1 | 1) => {
    const activeSorted = catFilter ? courses.filter(x => x.category === catFilter) : courses;
    const idx = activeSorted.findIndex(x => x.id === c.id);
    const target = activeSorted[idx + dir];
    if (!target) return;
    const d = await api('PUT', { id: c.id, swapWith: target.id });
    if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
    fetchCourses();
  };

  const bulkToggleCategory = async (cat: string, active: boolean) => {
    const d = await api('PUT', { bulkCategory: cat, is_active: active });
    if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
    setToast({ type: 'success', msg: `${active ? 'เปิด' : 'ปิด'}ใช้งานทั้งหมวด "${cat}" แล้ว` });
    fetchCourses();
  };

  const toggleActive = async (c: MasterCourse) => {
    const d = await api('PUT', { id: c.id, is_active: !c.is_active });
    if (d.error) { setToast({ type: 'error', msg: d.error }); return; }
    setToast({ type: 'success', msg: c.is_active ? `ปิดใช้งาน "${c.course_name}" แล้ว` : `เปิดใช้งาน "${c.course_name}" แล้ว` });
    fetchCourses();
  };

  if (!auth.isHydrated || !auth.isAdmin) return null;

  const inputSt: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, background: 'var(--card-solid)', color: 'var(--text-primary)', width: '100%' };

  return (
    <div style={{ padding: '28px 26px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={22} style={{ color: '#2563eb' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Master รายชื่อหลักสูตรกลาง</h1>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> เพิ่มหลักสูตร
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        รายชื่อและลำดับมาตรฐานที่ทุกบริษัทใช้ร่วมกันตอนทำแผนอบรมประจำปี — ลำดับในหน้านี้คือลำดับที่แผนทุกบริษัทจะเรียงเหมือนกัน · ปิดใช้งานแทนการลบ (แผนเดิมไม่กระทบ)
      </p>

      {showAdd && (
        <div style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>ชื่อหลักสูตร *</label>
              <input value={addForm.course_name} onChange={e => setAddForm(f => ({ ...f, course_name: e.target.value }))} style={inputSt} placeholder="ชื่อหลักสูตร" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>หมวด</label>
              <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={inputSt}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>ชั่วโมง (default)</label>
              <input type="number" min={0} value={addForm.default_hours} onChange={e => setAddForm(f => ({ ...f, default_hours: parseFloat(e.target.value) || 0 }))} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>In-House / External</label>
              <select value={addForm.in_house_external} onChange={e => setAddForm(f => ({ ...f, in_house_external: e.target.value }))} style={inputSt}>
                <option value="In-House">In-House</option>
                <option value="External">External</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>ความจำเป็น / กฎหมายอ้างอิง (default)</label>
              <input value={addForm.necessity_default} onChange={e => setAddForm(f => ({ ...f, necessity_default: e.target.value }))} style={inputSt} placeholder="เช่น กฎกระทรวง..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer' }}>ยกเลิก</button>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
              <input type="checkbox" checked={addForm.dsd_eligible} onChange={e => setAddForm(f => ({ ...f, dsd_eligible: e.target.checked }))} /> เข้าข่ายยื่น DSD
            </label>
          </div>
        </div>
      )}

      {/* Category filter + bulk enable/disable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['', ...CATEGORIES].map(cat => {
          const active = catFilter === cat;
          const count = cat === '' ? courses.length : courses.filter(c => c.category === cat).length;
          return (
            <button key={cat || 'all'} onClick={() => setCatFilter(cat)}
              style={{ padding: '5px 13px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: active ? '2px solid #2563eb' : '1px solid var(--border)', background: active ? 'rgba(37,99,235,0.08)' : 'var(--card-solid)', color: active ? '#2563eb' : 'var(--text-secondary)' }}>
              {cat === '' ? 'ทุกหมวด' : cat.split(' ')[0]} ({count})
            </button>
          );
        })}
        {catFilter && (() => {
          const inCat = courses.filter(c => c.category === catFilter);
          const nActive = inCat.filter(c => c.is_active).length;
          return (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ใช้งาน {nActive}/{inCat.length}</span>
              <button onClick={() => bulkToggleCategory(catFilter, true)}
                style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #16a34a', background: 'rgba(34,197,94,0.08)', color: '#16a34a' }}>
                เปิดทั้งหมวด
              </button>
              <button onClick={() => bulkToggleCategory(catFilter, false)}
                style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #dc2626', background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                ปิดทั้งหมวด
              </button>
            </span>
          );
        })()}
      </div>

      <div style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : (
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['ลำดับ', 'หลักสูตร', 'หมวด', 'ชม.', 'In/Ex', 'DSD', 'สถานะ', ''].map(h => (
                  <th key={h || '_a'} style={{ textAlign: 'left', padding: '9px 10px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(catFilter ? courses.filter(c => c.category === catFilter) : courses).map((c, idx, arr) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)', opacity: c.is_active ? 1 : 0.45 }}>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, marginRight: 4 }}>{idx + 1}</span>
                    <button onClick={() => move(c, -1)} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: idx === 0 ? 0.25 : 1, padding: 1 }}><ChevronUp size={13} /></button>
                    <button onClick={() => move(c, 1)} disabled={idx === arr.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: idx === arr.length - 1 ? 0.25 : 1, padding: 1 }}><ChevronDown size={13} /></button>
                  </td>
                  {editId === c.id ? (
                    <>
                      <td style={{ padding: '7px 10px' }}>
                        <input value={editForm.course_name} onChange={e => setEditForm(f => ({ ...f, course_name: e.target.value }))} style={inputSt} />
                        <input value={editForm.necessity_default} onChange={e => setEditForm(f => ({ ...f, necessity_default: e.target.value }))} style={{ ...inputSt, marginTop: 4, fontSize: 11 }} placeholder="ความจำเป็น/กฎหมายอ้างอิง" />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputSt, width: 130 }}>
                          {CATEGORIES.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <input type="number" min={0} value={editForm.default_hours} onChange={e => setEditForm(f => ({ ...f, default_hours: parseFloat(e.target.value) || 0 }))} style={{ ...inputSt, width: 58 }} />
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <select value={editForm.in_house_external} onChange={e => setEditForm(f => ({ ...f, in_house_external: e.target.value }))} style={{ ...inputSt, width: 96 }}>
                          <option value="In-House">In-House</option>
                          <option value="External">External</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <input type="checkbox" checked={editForm.dsd_eligible} onChange={e => setEditForm(f => ({ ...f, dsd_eligible: e.target.checked }))} />
                      </td>
                      <td style={{ padding: '7px 10px' }} />
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                        <button onClick={handleSaveEdit} disabled={saving} title="บันทึก" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#16a34a', padding: 3 }}><Check size={15} /></button>
                        <button onClick={() => setEditId(null)} title="ยกเลิก" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 3 }}><X size={15} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.course_name}</div>
                        {c.necessity_default && <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>{c.necessity_default}</div>}
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{c.category.split(' ')[0]}</td>
                      <td style={{ padding: '7px 10px' }}>{c.default_hours}</td>
                      <td style={{ padding: '7px 10px', fontSize: 11.5 }}>{c.in_house_external}</td>
                      <td style={{ padding: '7px 10px' }}>{c.dsd_eligible ? '✓' : ''}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => toggleActive(c)}
                          style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 10, border: 'none', cursor: 'pointer', background: c.is_active ? '#dcfce7' : 'var(--bg-secondary)', color: c.is_active ? '#16a34a' : 'var(--text-secondary)' }}>
                          {c.is_active ? 'ใช้งาน' : 'ปิด'}
                        </button>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => startEdit(c)} title="แก้ไข" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', padding: 3 }}><Pencil size={13} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: toast.type === 'success' ? '#dcfce7' : '#fee2e2', color: toast.type === 'success' ? '#15803d' : '#b91c1c', border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
