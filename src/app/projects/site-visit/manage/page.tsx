'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import { Settings, ChevronDown, ChevronUp, Plus, Save, X, Pencil, Check } from 'lucide-react';

const VIZ = {
  primary: '#14b8a6',
  secondary: '#F28E2B',
  accent: '#E15759',
  positive: '#59A14F',
  neutral: '#BAB0AC',
  muted: '#D4D4D4',
  text: '#333333',
  lightText: '#666666',
};

interface Category {
  id: number;
  parent_type: string;
  name: string;
  name_th: string;
  sort_order: number;
  is_active: boolean;
}

interface Criterion {
  id: number;
  item_id: number;
  score: number;
  description: string;
}

interface Item {
  id: number;
  category_id: number;
  item_no: number;
  question: string;
  max_score: number;
  sort_order: number;
  is_active: boolean;
  site_visit_categories?: { name: string; name_th: string };
  site_visit_criteria: Criterion[];
}

export default function ManageCriteriaPage() {
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'environment' | 'safety'>('safety');

  // Add category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatNameTh, setNewCatNameTh] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Add item form (per category)
  const [addingItemForCat, setAddingItemForCat] = useState<number | null>(null);
  const [newItemQuestion, setNewItemQuestion] = useState('');
  const [newItemMaxScore, setNewItemMaxScore] = useState(4);
  const [savingItem, setSavingItem] = useState(false);

  // Add criteria form (per item)
  const [addingCriteriaForItem, setAddingCriteriaForItem] = useState<number | null>(null);
  const [newCriteria, setNewCriteria] = useState<Array<{ score: number; description: string }>>([]);
  const [savingCriteria, setSavingCriteria] = useState(false);

  // Edit item
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit category
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatNameTh, setEditingCatNameTh] = useState('');
  const [editingCatName, setEditingCatName] = useState('');
  const [savingCatEdit, setSavingCatEdit] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        fetch(`/api/site-visit/categories?parent_type=${activeTab}`),
        fetch('/api/site-visit/items'),
      ]);
      const catJson = await catRes.json();
      const itemJson = await itemRes.json();
      if (catJson.data) setCategories(catJson.data);
      if (itemJson.data) setItems(itemJson.data);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleCategory = (catId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const toggleItem = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const getItemsByCategory = (catId: number) =>
    items.filter(i => i.category_id === catId).sort((a, b) => a.sort_order - b.sort_order);

  // --- Add Category ---
  const handleAddCategory = async () => {
    if (!newCatNameTh.trim()) return;
    setSavingCat(true);
    try {
      const res = await fetch('/api/site-visit/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatNameEn.trim() || newCatNameTh.trim(),
          name_th: newCatNameTh.trim(),
          parent_type: activeTab,
          sort_order: categories.length + 1,
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', msg: 'เพิ่มหมวดหมู่สำเร็จ' });
      setShowAddCategory(false);
      setNewCatNameTh('');
      setNewCatNameEn('');
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'เพิ่มหมวดหมู่ไม่สำเร็จ' });
    } finally {
      setSavingCat(false);
    }
  };

  // --- Add Item ---
  const handleAddItem = async (catId: number) => {
    if (!newItemQuestion.trim()) return;
    setSavingItem(true);
    const catItems = getItemsByCategory(catId);
    const nextItemNo = catItems.length > 0 ? Math.max(...catItems.map(i => i.item_no)) + 1 : 1;
    const nextSortOrder = catItems.length > 0 ? Math.max(...catItems.map(i => i.sort_order)) + 1 : 1;
    try {
      const res = await fetch('/api/site-visit/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: catId,
          item_no: nextItemNo,
          question: newItemQuestion.trim(),
          max_score: newItemMaxScore,
          sort_order: nextSortOrder,
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', msg: 'เพิ่มรายการตรวจสำเร็จ' });
      setAddingItemForCat(null);
      setNewItemQuestion('');
      setNewItemMaxScore(4);
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'เพิ่มรายการตรวจไม่สำเร็จ' });
    } finally {
      setSavingItem(false);
    }
  };

  // --- Add Criteria ---
  const openAddCriteria = (itemId: number, maxScore: number) => {
    const existing = items.find(i => i.id === itemId)?.site_visit_criteria || [];
    const existingScores = new Set(existing.map(c => c.score));
    const missing: Array<{ score: number; description: string }> = [];
    for (let s = 0; s <= maxScore; s++) {
      if (!existingScores.has(s)) {
        missing.push({ score: s, description: '' });
      }
    }
    if (missing.length === 0) {
      // All scores exist, still allow adding
      missing.push({ score: maxScore, description: '' });
    }
    setNewCriteria(missing);
    setAddingCriteriaForItem(itemId);
  };

  const handleSaveCriteria = async (itemId: number) => {
    const toSave = newCriteria.filter(c => c.description.trim() !== '');
    if (toSave.length === 0) {
      setToast({ type: 'error', msg: 'กรุณากรอกคำอธิบายอย่างน้อย 1 ข้อ' });
      return;
    }
    setSavingCriteria(true);
    try {
      const res = await fetch('/api/site-visit/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: toSave.map(c => ({
            item_id: itemId,
            score: c.score,
            description: c.description.trim(),
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', msg: 'เพิ่มเกณฑ์คะแนนสำเร็จ' });
      setAddingCriteriaForItem(null);
      setNewCriteria([]);
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'เพิ่มเกณฑ์คะแนนไม่สำเร็จ' });
    } finally {
      setSavingCriteria(false);
    }
  };

  // --- Edit Item ---
  const handleEditItem = async (itemId: number) => {
    if (!editingQuestion.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/site-visit/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, question: editingQuestion.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', msg: 'แก้ไขสำเร็จ' });
      setEditingItemId(null);
      setEditingQuestion('');
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'แก้ไขไม่สำเร็จ' });
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Edit Category ---
  const handleEditCategory = async (catId: number) => {
    if (!editingCatNameTh.trim()) return;
    setSavingCatEdit(true);
    try {
      const res = await fetch('/api/site-visit/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId, name_th: editingCatNameTh.trim(), name: editingCatName.trim() || editingCatNameTh.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', msg: 'แก้ไขชื่อหมวดหมู่สำเร็จ' });
      setEditingCatId(null);
      setEditingCatNameTh('');
      setEditingCatName('');
      await loadData();
    } catch {
      setToast({ type: 'error', msg: 'แก้ไขชื่อหมวดหมู่ไม่สำเร็จ' });
    } finally {
      setSavingCatEdit(false);
    }
  };

  if (!isAdmin) return null;

  const catIds = new Set(categories.map(c => c.id));
  const filteredItems = items.filter(i => catIds.has(i.category_id));
  const totalMaxScore = filteredItems.reduce((sum, i) => sum + i.max_score, 0);

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 50,
          padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: toast.type === 'success' ? VIZ.positive : VIZ.accent,
          color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: VIZ.text, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Settings size={28} color={VIZ.primary} />
            จัดการเกณฑ์ประเมิน
          </h1>
          <p style={{ color: VIZ.lightText, fontSize: 14 }}>
            ดูและจัดการหมวดหมู่ รายการตรวจ และเกณฑ์คะแนน
          </p>
        </div>
        <button
          onClick={() => setShowAddCategory(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', background: VIZ.primary, color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          <Plus size={18} /> เพิ่มหมวดหมู่
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {([
          { key: 'safety' as const, label: 'ความปลอดภัย (CBUM)', icon: '🛡️' },
          { key: 'environment' as const, label: 'สิ่งแวดล้อม', icon: '🌿' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setExpandedCategories(new Set()); setExpandedItems(new Set()); }}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              border: '1px solid #e5e7eb', borderBottom: activeTab === tab.key ? '3px solid ' + VIZ.primary : '1px solid #e5e7eb',
              background: activeTab === tab.key ? '#fff' : '#f9fafb',
              color: activeTab === tab.key ? VIZ.primary : VIZ.lightText,
              borderRadius: tab.key === 'safety' ? '10px 0 0 0' : '0 10px 0 0',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Add Category Form */}
      {showAddCategory && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
          border: `2px dashed ${VIZ.primary}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: VIZ.text, marginBottom: 12 }}>
            เพิ่มหมวดหมู่ใหม่
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: VIZ.lightText, display: 'block', marginBottom: 4 }}>ชื่อภาษาไทย *</label>
              <input
                value={newCatNameTh}
                onChange={e => setNewCatNameTh(e.target.value)}
                placeholder="เช่น การจัดการความปลอดภัย"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: VIZ.lightText, display: 'block', marginBottom: 4 }}>ชื่อภาษาอังกฤษ</label>
              <input
                value={newCatNameEn}
                onChange={e => setNewCatNameEn(e.target.value)}
                placeholder="e.g. Safety Management"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAddCategory}
              disabled={savingCat || !newCatNameTh.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: VIZ.positive, color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                opacity: savingCat || !newCatNameTh.trim() ? 0.5 : 1,
              }}
            >
              <Save size={16} /> {savingCat ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              onClick={() => { setShowAddCategory(false); setNewCatNameTh(''); setNewCatNameEn(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: '#f3f4f6', color: VIZ.text,
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}
            >
              <X size={16} /> ยกเลิก
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: VIZ.lightText }}>กำลังโหลด...</div>
      ) : (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${VIZ.primary}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText }}>หมวดหมู่</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: VIZ.primary }}>{categories.length}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${VIZ.secondary}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText }}>รายการตรวจ</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: VIZ.secondary }}>{filteredItems.length}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${VIZ.positive}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText }}>คะแนนรวมสูงสุด</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: VIZ.positive }}>{totalMaxScore}</div>
            </div>
          </div>

          {/* Category list */}
          {categories.map(cat => {
            const catItems = getItemsByCategory(cat.id);
            const isExpanded = expandedCategories.has(cat.id);

            return (
              <div key={cat.id} style={{ marginBottom: 12 }}>
                {editingCatId === cat.id ? (
                  <div style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 20px', background: '#fffbeb', borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                    border: `2px solid ${VIZ.primary}`,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: VIZ.primary, minWidth: 28 }}>{cat.sort_order}.</span>
                    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                      <input
                        value={editingCatNameTh}
                        onChange={e => setEditingCatNameTh(e.target.value)}
                        autoFocus
                        placeholder="ชื่อภาษาไทย"
                        onKeyDown={e => { if (e.key === 'Enter') handleEditCategory(cat.id); if (e.key === 'Escape') { setEditingCatId(null); } }}
                        style={{
                          flex: 2, padding: '6px 10px', borderRadius: 6,
                          border: `1px solid ${VIZ.primary}`, fontSize: 14, outline: 'none',
                        }}
                      />
                      <input
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        placeholder="Name (EN)"
                        onKeyDown={e => { if (e.key === 'Enter') handleEditCategory(cat.id); if (e.key === 'Escape') { setEditingCatId(null); } }}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleEditCategory(cat.id)}
                      disabled={savingCatEdit || !editingCatNameTh.trim()}
                      style={{ background: VIZ.positive, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12, opacity: savingCatEdit ? 0.5 : 1 }}
                    >
                      <Check size={14} /> {savingCatEdit ? '...' : 'บันทึก'}
                    </button>
                    <button
                      onClick={() => { setEditingCatId(null); setEditingCatNameTh(''); setEditingCatName(''); }}
                      style={{ background: '#f3f4f6', color: VIZ.text, border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                <button
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', background: '#fff', borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                    border: '1px solid #e5e7eb', cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {isExpanded ? <ChevronUp size={18} color={VIZ.primary} /> : <ChevronDown size={18} color={VIZ.primary} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: VIZ.text }}>{cat.sort_order}. {cat.name_th}</span>
                    <span style={{ fontSize: 13, color: VIZ.lightText, marginLeft: 8 }}>({cat.name})</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCatId(cat.id); setEditingCatNameTh(cat.name_th); setEditingCatName(cat.name); }}
                    title="แก้ไขชื่อหมวดหมู่"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: VIZ.lightText, padding: 4, borderRadius: 4 }}
                  >
                    <Pencil size={14} />
                  </button>
                  <span style={{ fontSize: 13, color: VIZ.lightText, fontWeight: 600 }}>{catItems.length} ข้อ</span>
                </button>
                )}

                {isExpanded && (
                  <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    {catItems.map((item, idx) => {
                      const criteria = (item.site_visit_criteria || []).sort((a, b) => a.score - b.score);
                      const isItemExpanded = expandedItems.has(item.id);
                      const isAddingCriteria = addingCriteriaForItem === item.id;
                      const isEditing = editingItemId === item.id;

                      return (
                        <div key={item.id} style={{ borderBottom: idx < catItems.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#fffbeb' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: VIZ.primary, minWidth: 28 }}>{item.item_no}.</span>
                              <input
                                value={editingQuestion}
                                onChange={e => setEditingQuestion(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleEditItem(item.id); if (e.key === 'Escape') { setEditingItemId(null); setEditingQuestion(''); } }}
                                style={{
                                  flex: 1, padding: '6px 10px', borderRadius: 6,
                                  border: `1px solid ${VIZ.primary}`, fontSize: 14, outline: 'none',
                                }}
                              />
                              <button
                                onClick={() => handleEditItem(item.id)}
                                disabled={savingEdit || !editingQuestion.trim()}
                                style={{ background: VIZ.positive, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12, opacity: savingEdit ? 0.5 : 1 }}
                              >
                                <Check size={14} /> {savingEdit ? '...' : 'บันทึก'}
                              </button>
                              <button
                                onClick={() => { setEditingItemId(null); setEditingQuestion(''); }}
                                style={{ background: '#f3f4f6', color: VIZ.text, border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '12px 20px', cursor: 'pointer', background: isItemExpanded ? '#fafafa' : '#fff',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 13, color: VIZ.primary, minWidth: 28 }}>{item.item_no}.</span>
                            <span onClick={() => toggleItem(item.id)} style={{ fontSize: 14, color: VIZ.text, flex: 1, cursor: 'pointer' }}>{item.question}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingItemId(item.id); setEditingQuestion(item.question); }}
                              title="แก้ไข"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: VIZ.lightText, padding: 4, borderRadius: 4 }}
                            >
                              <Pencil size={14} />
                            </button>
                            <span style={{ fontSize: 12, color: VIZ.lightText }}>0-{item.max_score}</span>
                            <span onClick={() => toggleItem(item.id)}>{isItemExpanded ? <ChevronUp size={16} color={VIZ.neutral} /> : <ChevronDown size={16} color={VIZ.neutral} />}</span>
                          </div>
                          )}

                          {isItemExpanded && (
                            <div style={{ padding: '8px 20px 12px 56px', background: '#f8fafc' }}>
                              {criteria.length > 0 && (
                                <>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: VIZ.lightText, marginBottom: 6 }}>เกณฑ์คะแนน:</div>
                                  {criteria.map(c => (
                                    <div key={c.id} style={{
                                      display: 'flex', gap: 8, padding: '4px 0', fontSize: 13,
                                      color: c.description === '-' ? VIZ.muted : VIZ.text,
                                    }}>
                                      <span style={{
                                        fontWeight: 700, minWidth: 20, textAlign: 'center',
                                        color: c.description === '-' ? VIZ.muted :
                                          c.score === 0 ? VIZ.accent : c.score <= 2 ? VIZ.secondary : VIZ.positive,
                                      }}>
                                        {c.score}
                                      </span>
                                      <span>{c.description}</span>
                                    </div>
                                  ))}
                                </>
                              )}

                              {/* Add criteria button */}
                              {!isAddingCriteria && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAddCriteria(item.id, item.max_score); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 8,
                                    padding: '6px 12px', background: 'transparent', color: VIZ.primary,
                                    border: `1px dashed ${VIZ.primary}`, borderRadius: 6, cursor: 'pointer',
                                    fontSize: 12, fontWeight: 600,
                                  }}
                                >
                                  <Plus size={14} /> เพิ่มเกณฑ์คะแนน
                                </button>
                              )}

                              {/* Add criteria form */}
                              {isAddingCriteria && (
                                <div style={{ marginTop: 10, padding: 12, background: '#fff', borderRadius: 8, border: `1px solid ${VIZ.primary}` }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: VIZ.text, marginBottom: 8 }}>
                                    เพิ่มเกณฑ์คะแนน (คะแนน 0-{item.max_score})
                                  </div>
                                  {newCriteria.map((c, ci) => (
                                    <div key={ci} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                      <span style={{
                                        fontWeight: 700, minWidth: 24, textAlign: 'center', fontSize: 14,
                                        color: c.score === 0 ? VIZ.accent : c.score <= 2 ? VIZ.secondary : VIZ.positive,
                                      }}>
                                        {c.score}
                                      </span>
                                      <input
                                        value={c.description}
                                        onChange={e => {
                                          const upd = [...newCriteria];
                                          upd[ci].description = e.target.value;
                                          setNewCriteria(upd);
                                        }}
                                        placeholder={`คำอธิบายสำหรับคะแนน ${c.score}`}
                                        style={{
                                          flex: 1, padding: '6px 10px', borderRadius: 6,
                                          border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                                        }}
                                      />
                                      <button
                                        onClick={() => setNewCriteria(newCriteria.filter((_, i) => i !== ci))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: VIZ.accent, padding: 4 }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                    <button
                                      onClick={() => handleSaveCriteria(item.id)}
                                      disabled={savingCriteria}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '6px 14px', background: VIZ.positive, color: '#fff',
                                        border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                        opacity: savingCriteria ? 0.5 : 1,
                                      }}
                                    >
                                      <Save size={14} /> {savingCriteria ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </button>
                                    <button
                                      onClick={() => { setAddingCriteriaForItem(null); setNewCriteria([]); }}
                                      style={{
                                        padding: '6px 14px', background: '#f3f4f6', color: VIZ.text,
                                        border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                      }}
                                    >
                                      ยกเลิก
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add item button */}
                    {addingItemForCat !== cat.id ? (
                      <div
                        onClick={() => { setAddingItemForCat(cat.id); setNewItemQuestion(''); setNewItemMaxScore(4); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                          cursor: 'pointer', background: '#fafafa', color: VIZ.primary,
                          borderTop: catItems.length > 0 ? '1px solid #f0f0f0' : 'none',
                          fontSize: 13, fontWeight: 600,
                        }}
                      >
                        <Plus size={16} /> เพิ่มรายการตรวจในหมวดนี้
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 20px', background: '#fafafa',
                        borderTop: catItems.length > 0 ? '1px solid #f0f0f0' : 'none',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: VIZ.text, marginBottom: 8 }}>
                          เพิ่มรายการตรวจใหม่
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                          <input
                            value={newItemQuestion}
                            onChange={e => setNewItemQuestion(e.target.value)}
                            placeholder="ข้อความรายการตรวจ เช่น มีการจัดทำแผนฉุกเฉิน"
                            style={{
                              flex: 1, padding: '8px 12px', borderRadius: 8,
                              border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: 12, color: VIZ.lightText }}>คะแนนสูงสุด</label>
                            <select
                              value={newItemMaxScore}
                              onChange={e => setNewItemMaxScore(parseInt(e.target.value))}
                              style={{
                                padding: '8px 12px', borderRadius: 8,
                                border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                                background: '#fff',
                              }}
                            >
                              {[2, 3, 4, 5].map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleAddItem(cat.id)}
                            disabled={savingItem || !newItemQuestion.trim()}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '8px 14px', background: VIZ.positive, color: '#fff',
                              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                              opacity: savingItem || !newItemQuestion.trim() ? 0.5 : 1,
                            }}
                          >
                            <Save size={14} /> {savingItem ? 'กำลังบันทึก...' : 'บันทึก'}
                          </button>
                          <button
                            onClick={() => { setAddingItemForCat(null); setNewItemQuestion(''); }}
                            style={{
                              padding: '8px 14px', background: '#f3f4f6', color: VIZ.text,
                              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            }}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
