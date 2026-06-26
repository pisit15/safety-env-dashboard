'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useYears } from '@/lib/useYears';
import { DEFAULT_YEAR } from '@/lib/companies';
import { STATUS, PALETTE } from '@/lib/she-theme';
import { Wallet, Plus, Trash2, X, Pencil, Check } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

interface BudgetCategory { id: number; name: string; sort_order: number; }
interface BudgetItem { id: number; category_id: number; name: string; amount: number; month: number | null; created_by?: string; }

const fmt = (n: number) => n ? n.toLocaleString('en-US') : '';
const fmtFull = (n: number) => (n || 0).toLocaleString('en-US');

export default function CompanyBudgetPage() {
  const params = useParams();
  const companyId = String(params.companyId || '');
  const auth = useAuth();
  const { companies } = useCompanies();
  const { years: allYears, active: activeYears } = useYears();
  const company = companies.find(c => c.id === companyId);
  const companyName = company?.name || companyId.toUpperCase();

  const isAdmin = auth.isAdmin;
  const isLoggedIn = auth.isAdmin || !!auth.companyAuth[companyId];
  const updatedBy = auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || '');

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('budget_year');
      if (saved) return parseInt(saved, 10);
    }
    return DEFAULT_YEAR;
  });
  useEffect(() => {
    if (allYears.length > 0 && !allYears.includes(selectedYear)) {
      setSelectedYear(activeYears.length > 0 ? Math.max(...activeYears) : Math.max(...allYears));
    }
  }, [allYears, activeYears]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('budget_year', String(selectedYear)); }, [selectedYear]);

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Item drawer (per category)
  const [drawer, setDrawer] = useState<{ categoryId: number; presetMonth: number | null } | null>(null);
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addMonth, setAddMonth] = useState<string>('');

  const fetchCategories = useCallback(async () => {
    try {
      const r = await fetch(`/api/budget-plan/categories?companyId=${companyId}`, { cache: 'no-store' });
      const d = await r.json();
      setCategories(d.categories || []);
    } catch { /* ignore */ }
  }, [companyId]);

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch(`/api/budget-plan/items?companyId=${companyId}&year=${selectedYear}`, { cache: 'no-store' });
      const d = await r.json();
      setItems(d.items || []);
    } catch { /* ignore */ }
  }, [companyId, selectedYear]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchItems()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchItems]);

  // ── Derived sums ──
  const sumFor = (catId: number, month: number) => items.filter(i => i.category_id === catId && (i.month ?? 0) === month).reduce((s, i) => s + Number(i.amount || 0), 0);
  const catTotal = (catId: number) => items.filter(i => i.category_id === catId).reduce((s, i) => s + Number(i.amount || 0), 0);
  const monthTotal = (month: number) => items.filter(i => (i.month ?? 0) === month).reduce((s, i) => s + Number(i.amount || 0), 0);
  const grandTotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);

  // ── Category handlers (admin) ──
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch('/api/budget-plan/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, name: newCatName.trim() }) });
    if (res.ok) { setNewCatName(''); setToast({ type: 'success', msg: 'เพิ่มหมวดหมู่แล้ว' }); fetchCategories(); }
    else setToast({ type: 'error', msg: 'เพิ่มไม่สำเร็จ' });
  };
  const saveCategoryName = async (id: number) => {
    if (!editingCatName.trim()) { setEditingCatId(null); return; }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editingCatName.trim() } : c));
    setEditingCatId(null);
    await fetch('/api/budget-plan/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editingCatName.trim() }) });
  };
  const deleteCategory = async (id: number, name: string) => {
    if (!confirm(`ลบหมวด "${name}"? รายการงบในหมวดนี้จะถูกลบทั้งหมด`)) return;
    const res = await fetch(`/api/budget-plan/categories?id=${id}`, { method: 'DELETE' });
    if (res.ok) { setToast({ type: 'success', msg: 'ลบหมวดแล้ว' }); fetchCategories(); fetchItems(); }
    else setToast({ type: 'error', msg: 'ลบไม่สำเร็จ' });
  };

  // ── Item handlers ──
  const addItem = async () => {
    if (!drawer || !addName.trim()) return;
    const month = addMonth === '' ? null : parseInt(addMonth, 10);
    const res = await fetch('/api/budget-plan/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, year: selectedYear, categoryId: drawer.categoryId, name: addName.trim(), amount: Number(addAmount) || 0, month, createdBy: updatedBy }) });
    if (res.ok) { setAddName(''); setAddAmount(''); fetchItems(); }
    else setToast({ type: 'error', msg: 'เพิ่มรายการไม่สำเร็จ' });
  };
  const updateItem = async (id: number, patch: Partial<BudgetItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await fetch('/api/budget-plan/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch, categoryId: patch.category_id }) });
  };
  const deleteItem = async (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/budget-plan/items?id=${id}`, { method: 'DELETE' });
  };

  const openCell = (categoryId: number, month: number) => {
    if (!isLoggedIn) return;
    setDrawer({ categoryId, presetMonth: month === 0 ? null : month });
    setAddName(''); setAddAmount(''); setAddMonth(month === 0 ? '' : String(month));
  };

  const drawerCat = drawer ? categories.find(c => c.id === drawer.categoryId) : null;
  const drawerItems = drawer ? items.filter(i => i.category_id === drawer.categoryId) : [];

  const cellStyle: React.CSSProperties = { padding: 3, textAlign: 'right', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontSize: 11, minWidth: 64, cursor: isLoggedIn ? 'pointer' : 'default' };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Wallet size={24} style={{ color: '#f59e0b' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>แผนงบประมาณประจำปี — {companyName}</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>วางแผนงบประมาณรายปี แยกตามหมวดหมู่และเดือน • ปี {selectedYear}</p>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
          {(allYears.length ? allYears : [DEFAULT_YEAR]).map(y => <option key={y} value={y}>ปี {y}{activeYears.includes(y) ? '' : ' · เตรียม'}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>งบรวมทั้งปี: <strong style={{ color: PALETTE.primary, fontSize: 15 }}>{fmtFull(grandTotal)}</strong> บาท</span>
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
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-tertiary)', textAlign: 'left', padding: '8px 10px', minWidth: 200, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}>หมวดหมู่</th>
                {MONTH_LABELS.map(m => (
                  <th key={m} style={{ padding: '8px 4px', textAlign: 'center', minWidth: 64, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>{m}</th>
                ))}
                <th style={{ padding: '8px 6px', textAlign: 'center', minWidth: 70, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>ไม่ระบุ</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', minWidth: 90, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--bg-tertiary)' }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-solid)', padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    {editingCatId === cat.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCategoryName(cat.id); }}
                          style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text-primary)', width: 150 }} />
                        <button onClick={() => saveCategoryName(cat.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.positive }}><Check size={14} /></button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        {isAdmin && (
                          <>
                            <button title="แก้ชื่อ" onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><Pencil size={12} /></button>
                            <button title="ลบหมวด" onClick={() => deleteCategory(cat.id, cat.name)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.critical }}><Trash2 size={12} /></button>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                  {MONTH_LABELS.map((_, i) => {
                    const v = sumFor(cat.id, i + 1);
                    return <td key={i} onClick={() => openCell(cat.id, i + 1)} style={cellStyle}>{fmt(v)}</td>;
                  })}
                  <td onClick={() => openCell(cat.id, 0)} style={cellStyle}>{fmt(sumFor(cat.id, 0))}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}>{fmtFull(catTotal(cat.id))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-tertiary)', padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', borderTop: '2px solid var(--border)' }}>รวมรายเดือน</td>
                {MONTH_LABELS.map((_, i) => (
                  <td key={i} style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>{fmt(monthTotal(i + 1))}</td>
                ))}
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>{fmt(monthTotal(0))}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: PALETTE.primary, borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>{fmtFull(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>คลิกที่ช่องเพื่อเพิ่ม/แก้ไขรายการงบประมาณของหมวดนั้นในเดือนที่เลือก</p>
      )}

      {/* ── Item drawer (top-level so position:fixed references the viewport) ── */}
      {drawer && drawerCat && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 96vw)', zIndex: 1201, background: 'var(--card-solid)', borderLeft: '1px solid var(--border)', boxShadow: '-12px 0 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease-out' }}>
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>รายการงบประมาณ · ปี {selectedYear}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{drawerCat.name}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {drawerItems.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>ยังไม่มีรายการในหมวดนี้</div>}
              {drawerItems.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <input value={it.name} onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))} onBlur={e => updateItem(it.id, { name: e.target.value })}
                    disabled={!isLoggedIn} style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }} />
                  <input type="number" value={it.amount || ''} onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, amount: Number(e.target.value) } : x))} onBlur={e => updateItem(it.id, { amount: Number(e.target.value) || 0 })}
                    disabled={!isLoggedIn} placeholder="0" style={{ width: 90, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', textAlign: 'right' }} />
                  <select value={it.month ?? ''} onChange={e => updateItem(it.id, { month: e.target.value === '' ? null : parseInt(e.target.value, 10) })} disabled={!isLoggedIn}
                    style={{ width: 64, fontSize: 11, padding: '5px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }}>
                    <option value="">ไม่ระบุ</option>
                    {MONTH_LABELS.map((m, mi) => <option key={mi} value={mi + 1}>{m}</option>)}
                  </select>
                  {isLoggedIn && <button title="ลบ" onClick={() => deleteItem(it.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: STATUS.critical, flexShrink: 0 }}><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>

            {isLoggedIn && (
              <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>เพิ่มรายการใหม่</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="ชื่อรายการ" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }} />
                  <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="จำนวนเงิน" style={{ width: 100, fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={addMonth} onChange={e => setAddMonth(e.target.value)} style={{ width: 120, fontSize: 12, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }}>
                    <option value="">ไม่ระบุเดือน</option>
                    {MONTH_LABELS.map((m, mi) => <option key={mi} value={mi + 1}>{m}</option>)}
                  </select>
                  <button onClick={addItem} disabled={!addName.trim()} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', background: addName.trim() ? '#f59e0b' : 'var(--border)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: addName.trim() ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Plus size={14} /> เพิ่มรายการ</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
