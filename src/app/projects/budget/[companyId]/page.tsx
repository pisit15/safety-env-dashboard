'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useYears } from '@/lib/useYears';
import { DEFAULT_YEAR } from '@/lib/companies';
import { STATUS, PALETTE } from '@/lib/she-theme';
import { Wallet, Plus, Trash2, X, Pencil, Check, Paperclip, Link2, FileText, Upload, ExternalLink } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const PLAN_LABELS: Record<string, string> = { safety: 'ความปลอดภัย', environment: 'สิ่งแวดล้อม' };

interface BudgetCategory { id: number; name: string; sort_order: number; }
interface BudgetItem { id: number; category_id: number; name: string; monthly_amounts: Record<string, number>; created_by?: string; sub_unit?: string | null; }
interface SubUnit { id: number; code: string; name: string; sort_order: number; }
interface Attachment { id: number; item_id: number; kind: string; title: string; file_url: string; file_type: string; uploaded_by?: string; }

const fmt = (n: number) => n ? n.toLocaleString('en-US') : '';
const fmtFull = (n: number) => (n || 0).toLocaleString('en-US');

export default function CompanyBudgetPage() {
  const params = useParams();
  const companyId = String(params.companyId || '');
  const auth = useAuth();
  const { companies } = useCompanies();
  const { years: allYears, active: activeYears, loading: yearsLoading } = useYears();
  const company = companies.find(c => c.id === companyId);
  const companyName = company?.name || companyId.toUpperCase();

  const isAdmin = auth.isAdmin;
  const isLoggedIn = auth.isAdmin || !!auth.companyAuth[companyId];
  const updatedBy = auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || '');

  const [planType, setPlanType] = useState<'safety' | 'environment'>(() => {
    if (typeof window !== 'undefined') {
      const sp = localStorage.getItem('budget_plan_type');
      if (sp === 'environment' || sp === 'safety') return sp;
    }
    return 'safety';
  });
  useEffect(() => { localStorage.setItem('budget_plan_type', planType); }, [planType]);

  // Budget planning is done a year ahead — default to NEXT year's budget
  // (e.g. in 2026 the team prepares the 2027 budget). The user's last choice
  // is remembered under a versioned key so this new default applies once.
  const BUDGET_DEFAULT_YEAR = DEFAULT_YEAR + 1;
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('budget_year_v3');
      if (saved) return parseInt(saved, 10);
    }
    return BUDGET_DEFAULT_YEAR;
  });
  // Validate the selection only AFTER the year list has loaded from the API —
  // the static fallback may not contain next year yet, which would wrongly
  // reset the default before /api/plan-years responds.
  useEffect(() => {
    if (yearsLoading) return;
    if (allYears.length > 0 && !allYears.includes(selectedYear)) {
      setSelectedYear(allYears.includes(BUDGET_DEFAULT_YEAR) ? BUDGET_DEFAULT_YEAR
        : activeYears.length > 0 ? Math.max(...activeYears) : Math.max(...allYears));
    }
  }, [yearsLoading, allYears, activeYears]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('budget_year_v3', String(selectedYear)); }, [selectedYear]);

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  // Sub-units (subsidiaries): separate budgets that roll up to the parent company
  const [subUnits, setSubUnits] = useState<SubUnit[]>([]);
  // 'ALL' = ภาพรวม (rollup), 'MAIN' = parent-company items (sub_unit null), else sub-unit code
  const [activeSubTab, setActiveSubTab] = useState<string>('ALL');
  const [attByItem, setAttByItem] = useState<Record<number, Attachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  // Category management (admin)
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Item editor drawer
  const [editor, setEditor] = useState<{ id: number | null; name: string; categoryId: number | ''; monthly: Record<string, string>; createdBy?: string; subUnit?: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = useCallback(async () => {
    try { const r = await fetch(`/api/budget-plan/categories?planType=${planType}`, { cache: 'no-store' }); const d = await r.json(); setCategories(d.categories || []); } catch { /* ignore */ }
  }, [planType]);
  const fetchItems = useCallback(async () => {
    try { const r = await fetch(`/api/budget-plan/items?companyId=${companyId}&year=${selectedYear}&planType=${planType}`, { cache: 'no-store' }); const d = await r.json(); setItems(d.items || []); } catch { /* ignore */ }
  }, [companyId, selectedYear, planType]);
  const fetchAttachments = useCallback(async () => {
    try {
      const r = await fetch(`/api/budget-plan/attachments?companyId=${companyId}&year=${selectedYear}`, { cache: 'no-store' });
      const d = await r.json();
      const map: Record<number, Attachment[]> = {};
      (d.attachments || []).forEach((a: Attachment) => { (map[a.item_id] = map[a.item_id] || []).push(a); });
      setAttByItem(map);
    } catch { /* ignore */ }
  }, [companyId, selectedYear]);
  const fetchSubUnits = useCallback(async () => {
    try { const r = await fetch(`/api/budget-plan/sub-units?companyId=${companyId}`, { cache: 'no-store' }); const d = await r.json(); setSubUnits(d.subUnits || []); } catch { /* ignore */ }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchItems(), fetchAttachments(), fetchSubUnits()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchItems, fetchAttachments, fetchSubUnits]);

  const hasSubUnits = subUnits.length > 0;
  const isRollup = hasSubUnits && activeSubTab === 'ALL';
  const subUnitName = (code: string | null | undefined) => subUnits.find(s => s.code === code)?.name || code || '';

  // Items visible in the current tab
  const scopedItems = !hasSubUnits ? items
    : activeSubTab === 'ALL' ? items
    : activeSubTab === 'MAIN' ? items.filter(i => !i.sub_unit)
    : items.filter(i => i.sub_unit === activeSubTab);

  // ── Derived sums (m: 1..12, or 0 = ไม่ระบุ) ──
  const amtOf = (it: BudgetItem, m: number) => Number((it.monthly_amounts || {})[String(m)] || 0);
  const itemTotal = (it: BudgetItem) => { let t = 0; for (let m = 1; m <= 12; m++) t += amtOf(it, m); return t; };
  const sumFor = (catId: number, m: number) => scopedItems.filter(i => i.category_id === catId).reduce((s, i) => s + amtOf(i, m), 0);
  const catTotal = (catId: number) => scopedItems.filter(i => i.category_id === catId).reduce((s, i) => s + itemTotal(i), 0);
  const monthTotal = (m: number) => scopedItems.reduce((s, i) => s + amtOf(i, m), 0);
  const grandTotal = scopedItems.reduce((s, i) => s + itemTotal(i), 0);
  // Rollup summary: total per sub-unit (incl. parent bucket)
  const subUnitTotal = (code: string | null) => items
    .filter(i => (code === null ? !i.sub_unit : i.sub_unit === code))
    .reduce((s, i) => s + itemTotal(i), 0);

  // ── Category handlers (admin) ──
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch('/api/budget-plan/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName.trim(), isAdmin, planType }) });
    if (res.ok) { setNewCatName(''); setToast({ type: 'success', msg: 'เพิ่มหมวดหมู่แล้ว' }); fetchCategories(); }
    else setToast({ type: 'error', msg: 'เพิ่มไม่สำเร็จ' });
  };
  const saveCategoryName = async (id: number) => {
    if (!editingCatName.trim()) { setEditingCatId(null); return; }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editingCatName.trim() } : c));
    setEditingCatId(null);
    await fetch('/api/budget-plan/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editingCatName.trim(), isAdmin }) });
  };
  const deleteCategory = async (id: number, name: string) => {
    if (!confirm(`ลบหมวด "${name}"? เป็นหมวดกลางของทุกบริษัท — รายการงบในหมวดนี้ของทุกบริษัทจะถูกลบทั้งหมด`)) return;
    const res = await fetch(`/api/budget-plan/categories?id=${id}&isAdmin=${isAdmin}`, { method: 'DELETE' });
    if (res.ok) { setToast({ type: 'success', msg: 'ลบหมวดแล้ว' }); fetchCategories(); fetchItems(); }
    else setToast({ type: 'error', msg: 'ลบไม่สำเร็จ' });
  };

  // ── Item editor ──
  const openAdd = (categoryId?: number) => {
    if (!isLoggedIn) return;
    setLinkUrl(''); setLinkTitle('');
    // New items belong to the sub-unit tab currently open ('MAIN'/no sub-units → parent company)
    const subUnit = hasSubUnits && activeSubTab !== 'ALL' && activeSubTab !== 'MAIN' ? activeSubTab : null;
    setEditor({ id: null, name: '', categoryId: categoryId ?? '', monthly: {}, subUnit });
  };
  const openEdit = (it: BudgetItem) => {
    if (!isLoggedIn) return;
    const monthly: Record<string, string> = {};
    Object.entries(it.monthly_amounts || {}).forEach(([k, v]) => { const m = parseInt(k, 10); if (m >= 1 && m <= 12) monthly[k] = String(v); });
    setLinkUrl(''); setLinkTitle('');
    setEditor({ id: it.id, name: it.name, categoryId: it.category_id, monthly, createdBy: it.created_by, subUnit: it.sub_unit || null });
  };
  const setEditorMonth = (key: string, val: string) => setEditor(e => e ? { ...e, monthly: { ...e.monthly, [key]: val } } : e);
  const editorTotal = editor ? Object.values(editor.monthly).reduce((s, v) => s + (Number(v) || 0), 0) : 0;

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.name.trim()) { setToast({ type: 'error', msg: 'กรุณากรอกชื่อรายการ' }); return; }
    if (!editor.categoryId) { setToast({ type: 'error', msg: 'กรุณาเลือกหมวดหมู่' }); return; }
    const monthlyAmounts: Record<string, number> = {};
    Object.entries(editor.monthly).forEach(([k, v]) => { const n = Number(v); if (v !== '' && Number.isFinite(n) && n !== 0) monthlyAmounts[k] = n; });
    setSaving(true);
    try {
      if (editor.id) {
        await fetch('/api/budget-plan/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editor.id, name: editor.name.trim(), categoryId: editor.categoryId, monthlyAmounts }) });
        await fetchItems();
        setEditor(null);
      } else {
        const res = await fetch('/api/budget-plan/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, year: selectedYear, categoryId: editor.categoryId, name: editor.name.trim(), monthlyAmounts, planType, createdBy: updatedBy, subUnit: editor.subUnit || null }) });
        const d = await res.json();
        await fetchItems();
        // Keep drawer open in edit mode so the user can attach files/links
        if (d?.item?.id) { setEditor(ed => ed ? { ...ed, id: d.item.id, createdBy: d.item.created_by } : ed); setToast({ type: 'success', msg: 'บันทึกแล้ว — แนบไฟล์/ลิงก์ได้เลย' }); }
        else setEditor(null);
      }
    } catch { setToast({ type: 'error', msg: 'บันทึกไม่สำเร็จ' }); }
    setSaving(false);
  };
  const deleteEditorItem = async () => {
    if (!editor?.id) return;
    if (!confirm('ลบรายการนี้? (เอกสารแนบจะถูกลบด้วย)')) return;
    await fetch(`/api/budget-plan/items?id=${editor.id}`, { method: 'DELETE' });
    await Promise.all([fetchItems(), fetchAttachments()]);
    setEditor(null);
  };

  // ── Attachments ──
  const addLink = async () => {
    if (!editor?.id || !linkUrl.trim()) return;
    setUploadingAtt(true);
    try {
      const res = await fetch('/api/budget-plan/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: editor.id, linkUrl: linkUrl.trim(), linkTitle: linkTitle.trim(), uploadedBy: updatedBy }) });
      if (res.ok) { setLinkUrl(''); setLinkTitle(''); await fetchAttachments(); }
      else { const d = await res.json(); setToast({ type: 'error', msg: d.error || 'เพิ่มลิงก์ไม่สำเร็จ' }); }
    } catch { setToast({ type: 'error', msg: 'เพิ่มลิงก์ไม่สำเร็จ' }); }
    setUploadingAtt(false);
  };
  const uploadFile = async (file: File) => {
    if (!editor?.id) return;
    setUploadingAtt(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('itemId', String(editor.id)); fd.append('companyId', companyId); fd.append('uploadedBy', updatedBy);
      const res = await fetch('/api/budget-plan/attachments', { method: 'POST', body: fd });
      if (res.ok) await fetchAttachments();
      else { const d = await res.json(); setToast({ type: 'error', msg: d.error || 'อัปโหลดไม่สำเร็จ' }); }
    } catch { setToast({ type: 'error', msg: 'อัปโหลดไม่สำเร็จ' }); }
    setUploadingAtt(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const deleteAttachment = async (id: number) => {
    await fetch(`/api/budget-plan/attachments?id=${id}`, { method: 'DELETE' });
    await fetchAttachments();
  };

  const editorAtts = editor?.id ? (attByItem[editor.id] || []) : [];
  const cellStyle: React.CSSProperties = { padding: 3, textAlign: 'right', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontSize: 11, minWidth: 64 };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Wallet size={24} style={{ color: '#f59e0b' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>แผนงบประมาณ{PLAN_LABELS[planType]} — {companyName}</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>วางแผนงบประมาณรายปี แยกตามหมวดหมู่และเดือน • ปี {selectedYear}</p>

      {/* Plan tabs: Safety vs Environment (each has its own categories) */}
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 16 }}>
        {(['safety', 'environment'] as const).map(pt => (
          <button key={pt} onClick={() => setPlanType(pt)}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: planType === pt ? '#f59e0b' : 'transparent', color: planType === pt ? '#fff' : 'var(--text-secondary)' }}>
            แผนงบประมาณ{PLAN_LABELS[pt]}
          </button>
        ))}
      </div>

      {/* Sub-unit tabs (subsidiaries) — shown only for companies that have them */}
      {hasSubUnits && (
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap', width: 'fit-content' }}>
          {[{ code: 'ALL', label: `ภาพรวม ${companyName}` }, { code: 'MAIN', label: `${companyName} (ส่วนกลาง)` }, ...subUnits.map(s => ({ code: s.code, label: s.code }))].map(t => (
            <button key={t.code} onClick={() => setActiveSubTab(t.code)}
              title={t.code !== 'ALL' && t.code !== 'MAIN' ? subUnitName(t.code) : undefined}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: activeSubTab === t.code ? PALETTE.primary : 'transparent', color: activeSubTab === t.code ? '#fff' : 'var(--text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Rollup summary cards (overview tab only) */}
      {isRollup && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[{ code: null as string | null, label: `${companyName} (ส่วนกลาง)` }, ...subUnits.map(s => ({ code: s.code as string | null, label: `${s.code} — ${s.name}` }))].map(c => (
            <div key={c.code ?? '_main'} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.label}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.primary }}>{fmtFull(subUnitTotal(c.code))} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
          {(allYears.length ? allYears : [DEFAULT_YEAR]).map(y => <option key={y} value={y}>ปี {y}{activeYears.includes(y) ? '' : ' · เตรียม'}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          งบรวมทั้งปี{hasSubUnits ? (isRollup ? ` (รวมทุกบริษัทย่อย)` : ` (${activeSubTab === 'MAIN' ? 'ส่วนกลาง' : activeSubTab})`) : ''}:{' '}
          <strong style={{ color: PALETTE.primary, fontSize: 15 }}>{fmtFull(grandTotal)}</strong> บาท
        </span>
        {isLoggedIn && categories.length > 0 && !isRollup && (
          <button onClick={() => openAdd()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> เพิ่มรายการ{hasSubUnits && activeSubTab !== 'MAIN' ? ` (${activeSubTab})` : ''}
          </button>
        )}
        {isRollup && isLoggedIn && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>เลือกแท็บบริษัทย่อยเพื่อเพิ่ม/แก้ไขรายการ</span>
        )}
      </div>

      {toast && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13, background: toast.type === 'success' ? STATUS.positiveBg : STATUS.criticalBg, color: toast.type === 'success' ? STATUS.positive : STATUS.critical }}>{toast.msg}</div>
      )}

      {/* Admin: add category */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
            placeholder="ชื่อหมวดหมู่ใหม่..." style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13, width: 260 }} />
          <button onClick={addCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Plus size={14} /> เพิ่มหมวดหมู่</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : categories.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {isAdmin ? 'ยังไม่มีหมวดหมู่ — เพิ่มหมวดหมู่ด้านบนเพื่อเริ่มต้น' : 'ยังไม่มีหมวดหมู่ กรุณาให้ Admin สร้างหมวดหมู่ก่อน'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-tertiary)', textAlign: 'left', padding: '8px 10px', minWidth: 240, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}>หมวดหมู่ / รายการ</th>
                {MONTH_LABELS.map(m => (
                  <th key={m} style={{ padding: '8px 4px', textAlign: 'center', minWidth: 64, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>{m}</th>
                ))}
                <th style={{ padding: '8px 6px', textAlign: 'right', minWidth: 90, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--bg-tertiary)' }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {categories.flatMap(cat => {
                const catItems = items.filter(i => i.category_id === cat.id).sort((a, b) => a.name.localeCompare(b.name));
                const headerRow = (
                  <tr key={`cat-${cat.id}`} style={{ background: 'var(--bg-secondary)' }}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-secondary)', padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      {editingCatId === cat.id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCategoryName(cat.id); }}
                            style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text-primary)', width: 150 }} />
                          <button onClick={() => saveCategoryName(cat.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.positive }}><Check size={14} /></button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700 }}>{cat.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({catItems.length})</span>
                          {isAdmin && (
                            <>
                              <button title="แก้ชื่อ" onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><Pencil size={12} /></button>
                              <button title="ลบหมวด" onClick={() => deleteCategory(cat.id, cat.name)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.critical }}><Trash2 size={12} /></button>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    {MONTH_LABELS.map((_, i) => (
                      <td key={i} style={{ ...cellStyle, fontWeight: 700, background: 'var(--bg-secondary)' }}>{fmt(sumFor(cat.id, i + 1))}</td>
                    ))}
                    <td style={{ padding: '6px 6px', textAlign: 'right', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 800, color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}>{fmtFull(catTotal(cat.id))}</td>
                  </tr>
                );
                const itemRows = catItems.map(it => {
                  const nAtt = (attByItem[it.id] || []).length;
                  return (
                    <tr key={`it-${it.id}`} onClick={() => openEdit(it)} style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-solid)', padding: '5px 10px 5px 28px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, maxWidth: 250, overflow: 'hidden' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.name}>• {it.name}</span>
                          {isRollup && (
                            <span title={it.sub_unit ? subUnitName(it.sub_unit) : `${companyName} (ส่วนกลาง)`}
                              style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${PALETTE.primary}18`, color: PALETTE.primary }}>
                              {it.sub_unit || 'ส่วนกลาง'}
                            </span>
                          )}
                          {nAtt > 0 && <span title={`${nAtt} เอกสารแนบ`} style={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: PALETTE.primary, fontSize: 10, flexShrink: 0 }}><Paperclip size={10} />{nAtt}</span>}
                          {it.created_by && <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>· {it.created_by}</span>}
                        </span>
                      </td>
                      {MONTH_LABELS.map((_, i) => (
                        <td key={i} style={{ ...cellStyle, color: 'var(--text-primary)' }}>{fmt(amtOf(it, i + 1))}</td>
                      ))}
                      <td style={{ padding: '5px 6px', textAlign: 'right', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>{fmtFull(itemTotal(it))}</td>
                    </tr>
                  );
                });
                return [headerRow, ...itemRows];
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-tertiary)', padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', borderTop: '2px solid var(--border)' }}>รวมรายเดือน</td>
                {MONTH_LABELS.map((_, i) => (
                  <td key={i} style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>{fmt(monthTotal(i + 1))}</td>
                ))}
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: PALETTE.primary, borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>{fmtFull(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>กด “เพิ่มรายการ” มุมขวาบน เพื่อสร้างรายการ เลือกหมวดหมู่ ใส่งบของแต่ละเดือน แนบไฟล์/ลิงก์เอกสารได้ • คลิกที่รายการเพื่อแก้ไข</p>
      )}

      {/* ── Item editor drawer (top-level so position:fixed references the viewport) ── */}
      {editor && (
        <>
          <div onClick={() => setEditor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 96vw)', zIndex: 1201, background: 'var(--card-solid)', borderLeft: '1px solid var(--border)', boxShadow: '-12px 0 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease-out' }}>
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                  รายการงบประมาณ · ปี {selectedYear}
                  {hasSubUnits ? ` · ${editor.subUnit ? `${editor.subUnit} — ${subUnitName(editor.subUnit)}` : `${companyName} (ส่วนกลาง)`}` : ''}
                  {editor.createdBy ? ` · ผู้สร้าง: ${editor.createdBy}` : ''}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{editor.id ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</div>
              </div>
              <button onClick={() => setEditor(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>1. ชื่อรายการ</label>
              <input autoFocus value={editor.name} onChange={e => setEditor(ed => ed ? { ...ed, name: e.target.value } : ed)} placeholder="เช่น ค่าตรวจวัดคุณภาพอากาศ"
                style={{ width: '100%', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginBottom: 14 }} />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>2. หมวดหมู่</label>
              <select value={editor.categoryId} onChange={e => setEditor(ed => ed ? { ...ed, categoryId: e.target.value === '' ? '' : Number(e.target.value) } : ed)}
                style={{ width: '100%', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginBottom: 14 }}>
                <option value="">— เลือกหมวดหมู่ —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>3. งบประมาณรายเดือน (ใส่เฉพาะเดือนที่ใช้ • แต่ละเดือนไม่เท่ากันได้)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MONTH_LABELS.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m}</div>
                    <input type="number" value={editor.monthly[String(i + 1)] ?? ''} onChange={e => setEditorMonth(String(i + 1), e.target.value)} placeholder="0"
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', textAlign: 'right' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>รวมรายการ: <strong style={{ color: PALETTE.primary, fontSize: 15 }}>{fmtFull(editorTotal)}</strong> บาท</div>

              {/* 4. Attachments */}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>4. เอกสารแนบ / ลิงก์ (Google Drive, OneDrive, ไฟล์)</label>
                {!editor.id ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>กด “บันทึก” ด้านล่างก่อน จึงจะแนบไฟล์หรือลิงก์ได้</div>
                ) : (
                  <>
                    {editorAtts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {editorAtts.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                            {a.kind === 'link' ? <Link2 size={14} style={{ color: PALETTE.primary, flexShrink: 0 }} /> : <FileText size={14} style={{ color: PALETTE.primary, flexShrink: 0 }} />}
                            <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.title}>{a.title}</a>
                            <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><ExternalLink size={13} /></a>
                            <button onClick={() => deleteAttachment(a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.critical, flexShrink: 0 }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* paste link */}
                    <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="วางลิงก์ Google Drive / OneDrive..."
                      style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} placeholder="ชื่อลิงก์ (ไม่บังคับ)"
                        style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }} />
                      <button onClick={addLink} disabled={uploadingAtt || !linkUrl.trim()} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: linkUrl.trim() ? PALETTE.primary : 'var(--border)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: linkUrl.trim() ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Link2 size={13} /> เพิ่มลิงก์</button>
                    </div>
                    {/* upload file */}
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAtt} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Upload size={14} /> {uploadingAtt ? 'กำลังอัปโหลด...' : 'อัปโหลดไฟล์ (สูงสุด 20 MB)'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: 8 }}>
              {editor.id && <button onClick={deleteEditorItem} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${STATUS.critical}`, background: 'transparent', color: STATUS.critical, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Trash2 size={14} /> ลบ</button>}
              <button onClick={saveEditor} disabled={saving} style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'กำลังบันทึก...' : (editor.id ? 'บันทึกการแก้ไข' : 'บันทึก')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
