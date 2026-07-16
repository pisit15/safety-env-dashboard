'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { Recycle, Plus, Trash2, X, Pencil, Search } from 'lucide-react';
import type { WasteRecord, WasteMethod, WasteTarget, WasteCategory } from '@/lib/types';
import { aggregateByYear, recycleMethodSet, targetForYear, fmtTon, KG_PER_TON } from '@/lib/waste';

const C_RECYCLE = '#59A14F';
const C_DISPOSAL = '#E15759';
const C_HAZ = '#F28E2B';
const C_PRIMARY = '#4E79A7';
const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const PAGE_SIZE = 30;

const emptyForm = (companyId: string): Partial<WasteRecord> => ({
  company_id: companyId,
  record_date: new Date().toISOString().split('T')[0],
  waste_category: 'Non-Hazardous',
  disposal_method: '',
  waste_type: '',
  waste_type_th: '',
  disposal_company: '',
  disposal_company_code: '',
  waste_code: '',
  quantity_kg: 0,
  cost: 0,
  remark: '',
});

export default function CompanyWastePage() {
  const params = useParams();
  const companyId = String(params.companyId || '');
  const auth = useAuth();
  const { companies } = useCompanies();
  const company = companies.find(c => c.id === companyId);
  const companyName = company?.name || companyId.toUpperCase();
  const canEdit = auth.isAdmin || !!auth.companyAuth[companyId];
  const editorName = auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || '');

  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [methods, setMethods] = useState<WasteMethod[]>([]);
  const [target, setTarget] = useState<WasteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [catFilter, setCatFilter] = useState<'all' | WasteCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WasteRecord | null>(null);
  const [form, setForm] = useState<Partial<WasteRecord>>(emptyForm(companyId));
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/waste/records?companyId=${companyId}`).then(r => r.json()),
      fetch('/api/waste/methods').then(r => r.json()),
      fetch(`/api/waste/targets?companyId=${companyId}`).then(r => r.json()),
    ]).then(([rec, met, tar]) => {
      setRecords(rec.records || []);
      setMethods(met.methods || []);
      setTarget((tar.targets || [])[0] || null);
    }).catch(() => setToast({ type: 'error', msg: 'โหลดข้อมูลล้มเหลว' }))
      .finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const recycleSet = useMemo(() => recycleMethodSet(methods), [methods]);
  const activeMethods = useMemo(() => methods.filter(m => m.is_active), [methods]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>(records.map(r => parseInt(String(r.record_date).slice(0, 4))).filter(Boolean));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [records, currentYear]);

  const yearRecords = useMemo(() =>
    records.filter(r => parseInt(String(r.record_date).slice(0, 4)) === selectedYear),
  [records, selectedYear]);

  const filtered = useMemo(() => {
    let list = yearRecords;
    if (catFilter !== 'all') list = list.filter(r => r.waste_category === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.waste_type || '').toLowerCase().includes(q) ||
        (r.waste_type_th || '').toLowerCase().includes(q) ||
        (r.disposal_method || '').toLowerCase().includes(q) ||
        (r.disposal_company || '').toLowerCase().includes(q) ||
        (r.waste_code || '').toLowerCase().includes(q));
    }
    return list;
  }, [yearRecords, catFilter, search]);
  useEffect(() => { setPage(1); }, [selectedYear, catFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPIs for selected year
  const kpi = useMemo(() => {
    let recycleTon = 0, disposalTon = 0, hazTon = 0, cost = 0;
    for (const r of yearRecords) {
      const ton = (Number(r.quantity_kg) || 0) / KG_PER_TON;
      if (recycleSet.has(r.disposal_method)) recycleTon += ton; else disposalTon += ton;
      if (r.waste_category === 'Hazardous') hazTon += ton;
      cost += Number(r.cost) || 0;
    }
    const total = recycleTon + disposalTon;
    return { total, recycleTon, disposalTon, hazTon, cost, recyclePct: total > 0 ? (recycleTon / total) * 100 : 0 };
  }, [yearRecords, recycleSet]);

  // Monthly chart data (selected year)
  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ recycle: 0, disposal: 0 }));
    for (const r of yearRecords) {
      const m = parseInt(String(r.record_date).slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const ton = (Number(r.quantity_kg) || 0) / KG_PER_TON;
      if (recycleSet.has(r.disposal_method)) arr[m].recycle += ton; else arr[m].disposal += ton;
    }
    return arr;
  }, [yearRecords, recycleSet]);

  // Target comparison for selected year
  const yearAgg = useMemo(() => {
    const aggs = aggregateByYear(yearRecords, recycleSet);
    return aggs.find(a => a.year === selectedYear) || null;
  }, [yearRecords, recycleSet, selectedYear]);
  const yearTarget = useMemo(() => target ? targetForYear(target, selectedYear) : null, [target, selectedYear]);

  const openAdd = () => { setEditing(null); setForm(emptyForm(companyId)); setShowForm(true); };
  const openEdit = (r: WasteRecord) => { setEditing(r); setForm({ ...r }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.record_date || !form.disposal_method || !form.quantity_kg) {
      setToast({ type: 'error', msg: 'กรุณากรอก วันที่ / วิธีกำจัด / น้ำหนัก ให้ครบ' }); return;
    }
    setSaving(true);
    try {
      const body = { ...form, company_id: companyId, created_by: editorName };
      const res = await fetch('/api/waste/records', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...body, id: editing.id } : body),
      });
      const data = await res.json();
      if (data.error) setToast({ type: 'error', msg: data.error });
      else {
        setToast({ type: 'success', msg: editing ? 'อัปเดตรายการแล้ว' : 'เพิ่มรายการแล้ว' });
        setShowForm(false);
        loadAll();
      }
    } catch { setToast({ type: 'error', msg: 'บันทึกล้มเหลว' }); }
    setSaving(false);
  };

  const [confirmDelete, setConfirmDelete] = useState<WasteRecord | null>(null);
  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/waste/records?id=${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { setToast({ type: 'success', msg: 'ลบรายการแล้ว' }); loadAll(); }
      else setToast({ type: 'error', msg: data.error || 'ลบล้มเหลว' });
    } catch { setToast({ type: 'error', msg: 'ลบล้มเหลว' }); }
    setConfirmDelete(null);
  };

  const maxMonthTon = Math.max(...monthly.map(m => m.recycle + m.disposal), 0.001);

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' };

  const statusChip = (actual: number, targetVal: number, higherIsBetter: boolean) => {
    if (targetVal <= 0) return null;
    const ok = higherIsBetter ? actual >= targetVal : actual <= targetVal;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: ok ? '#59A14F18' : '#E1575918', color: ok ? C_RECYCLE : C_DISPOSAL }}>
        {ok ? 'ตามเป้า' : 'ไม่ตามเป้า'}
      </span>
    );
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Recycle size={24} style={{ color: C_RECYCLE }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>การจัดการขยะ — {companyName}</h1>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${C_RECYCLE} 0%, #3d7a36 100%)` }}>
            <Plus size={15} /> บันทึกรายการขยะ
          </button>
        )}
      </div>

      {/* Year + category filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>ปี:</span>
        {availableYears.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)}
            style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: selectedYear === y ? C_PRIMARY : 'var(--border)', background: selectedYear === y ? C_PRIMARY : 'var(--card-solid)', color: selectedYear === y ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
            {y}
          </button>
        ))}
        <span style={{ color: 'var(--text-secondary)', marginLeft: 10 }}>ประเภท:</span>
        {(['all', 'Hazardous', 'Non-Hazardous'] as const).map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: catFilter === c ? C_HAZ : 'var(--border)', background: catFilter === c ? C_HAZ : 'var(--card-solid)', color: catFilter === c ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
            {c === 'all' ? 'ทั้งหมด' : c === 'Hazardous' ? 'อันตราย' : 'ไม่อันตราย'}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: `ขยะรวมปี ${selectedYear}`, value: `${fmtTon(kpi.total)} ตัน`, color: C_PRIMARY },
          { label: 'รีไซเคิล/ใช้ซ้ำ', value: `${fmtTon(kpi.recycleTon)} ตัน`, sub: `${kpi.recyclePct.toFixed(1)}%`, color: C_RECYCLE },
          { label: 'กำจัด (ฝังกลบ/เผา)', value: `${fmtTon(kpi.disposalTon)} ตัน`, color: C_DISPOSAL },
          { label: 'ขยะอันตราย', value: `${fmtTon(kpi.hazTon)} ตัน`, color: C_HAZ },
          { label: 'รายได้/ค่าใช้จ่ายสุทธิ', value: `${kpi.cost.toLocaleString('en-US', { maximumFractionDigits: 0 })} ฿`, color: kpi.cost >= 0 ? C_RECYCLE : C_DISPOSAL },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', borderLeft: `4px solid ${card.color}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>สัดส่วน {card.sub} ของขยะรวม</div>}
          </div>
        ))}
      </div>

      {/* Target comparison (needs waste_targets row for this company) */}
      {yearTarget && (
        <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            เทียบเป้าหมายปี {selectedYear} (ฐานปี {target?.base_year}: รีไซเคิล +{yearTarget.cumPctRecycle}% · กำจัด −{yearTarget.cumPctDisposal}%)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>ตัวชี้วัด (ตัน)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>ผลจริง</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>เป้าหมาย</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'รีไซเคิล Non-Hazardous', actual: yearAgg?.recycleNonhazTon || 0, target: yearTarget.recycleNonhazTon, up: true },
                  { label: 'รีไซเคิล Hazardous', actual: yearAgg?.recycleHazTon || 0, target: yearTarget.recycleHazTon, up: true },
                  { label: 'กำจัด Non-Hazardous', actual: yearAgg?.disposalNonhazTon || 0, target: yearTarget.disposalNonhazTon, up: false },
                  { label: 'กำจัด Hazardous', actual: yearAgg?.disposalHazTon || 0, target: yearTarget.disposalHazTon, up: false },
                ].map(row => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: row.up ? C_RECYCLE : C_DISPOSAL }}>{fmtTon(row.actual)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.target > 0 ? `${row.up ? '≥' : '≤'} ${fmtTon(row.target)}` : '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{statusChip(row.actual, row.target, row.up)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly stacked bar chart */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ปริมาณขยะรายเดือน ปี {selectedYear} (ตัน)</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C_RECYCLE, display: 'inline-block' }} /> รีไซเคิล/ใช้ซ้ำ</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C_DISPOSAL, display: 'inline-block' }} /> กำจัด</span>
          </div>
        </div>
        <svg viewBox="0 0 720 200" style={{ width: '100%', height: 'auto', marginTop: 8 }}>
          {monthly.map((m, i) => {
            const x = 20 + i * 58;
            const hR = (m.recycle / maxMonthTon) * 140;
            const hD = (m.disposal / maxMonthTon) * 140;
            const total = m.recycle + m.disposal;
            return (
              <g key={i}>
                <rect x={x} y={160 - hD} width={34} height={Math.max(hD, 0)} fill={C_DISPOSAL} opacity={0.85} rx={2} />
                <rect x={x} y={160 - hD - hR} width={34} height={Math.max(hR, 0)} fill={C_RECYCLE} opacity={0.85} rx={2} />
                {total > 0 && (
                  <text x={x + 17} y={152 - hD - hR} fontSize={9} fontWeight={700} textAnchor="middle" fill="var(--text-primary)">{total >= 100 ? Math.round(total) : total.toFixed(1)}</text>
                )}
                <text x={x + 17} y={178} fontSize={10} textAnchor="middle" fill="var(--text-secondary)">{MONTH_LABELS[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Records table */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>รายการบันทึก ({filtered.length})</h3>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชนิดขยะ/วิธี/บริษัทกำจัด..."
              style={{ ...inputStyle, width: 240, paddingLeft: 26 }} />
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : pageRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>ยังไม่มีรายการในปี {selectedYear}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>วันที่</th>
                  <th style={{ padding: '6px 8px' }}>ชนิดขยะ</th>
                  <th style={{ padding: '6px 8px' }}>ประเภท</th>
                  <th style={{ padding: '6px 8px' }}>วิธีกำจัด</th>
                  <th style={{ padding: '6px 8px' }}>บริษัทรับกำจัด</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>น้ำหนัก (kg)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>รายได้/ค่าใช้จ่าย (฿)</th>
                  {canEdit && <th style={{ padding: '6px 8px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const isRec = recycleSet.has(r.disposal_method);
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{String(r.record_date).slice(0, 10)}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 600 }}>{r.waste_type_th || r.waste_type || '—'}</div>
                        {r.waste_type && r.waste_type_th && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{r.waste_type}</div>}
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.waste_category === 'Hazardous' ? '#F28E2B18' : '#4E79A718', color: r.waste_category === 'Hazardous' ? C_HAZ : C_PRIMARY }}>
                          {r.waste_category === 'Hazardous' ? 'อันตราย' : 'ไม่อันตราย'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ color: isRec ? C_RECYCLE : C_DISPOSAL, fontWeight: 600 }}>{r.disposal_method}</span>
                        <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--text-secondary)' }}>{isRec ? '♻' : ''}</span>
                      </td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.disposal_company}>{r.disposal_company || '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{Number(r.quantity_kg).toLocaleString()}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: (Number(r.cost) || 0) >= 0 ? C_RECYCLE : C_DISPOSAL }}>{Number(r.cost || 0).toLocaleString()}</td>
                      {canEdit && (
                        <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => openEdit(r)} title="แก้ไข" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Pencil size={13} style={{ color: C_PRIMARY }} /></button>
                          <button onClick={() => setConfirmDelete(r)} title="ลบ" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} style={{ color: C_DISPOSAL }} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 12 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{ padding: '3px 10px', borderRadius: 8, border: '1px solid', borderColor: page === p ? C_PRIMARY : 'var(--border)', background: page === p ? C_PRIMARY : 'var(--card-solid)', color: page === p ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setShowForm(false)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 16, width: '100%', maxWidth: 640, marginTop: 30 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{editing ? `แก้ไขรายการ #${editing.id}` : 'บันทึกรายการขยะใหม่'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>วันที่ *</label>
                <input type="date" value={String(form.record_date || '')} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ประเภทขยะ *</label>
                <select value={form.waste_category} onChange={e => setForm(f => ({ ...f, waste_category: e.target.value as WasteCategory }))} style={inputStyle}>
                  <option value="Non-Hazardous">Non-Hazardous (ไม่อันตราย)</option>
                  <option value="Hazardous">Hazardous (อันตราย)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>วิธีกำจัด *</label>
                <select value={form.disposal_method || ''} onChange={e => setForm(f => ({ ...f, disposal_method: e.target.value }))} style={inputStyle}>
                  <option value="">เลือกวิธีกำจัด</option>
                  {activeMethods.map(m => (
                    <option key={m.id} value={m.method_name}>{m.method_name} {m.is_recycle ? '♻ (รีไซเคิล)' : '(กำจัด)'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>น้ำหนัก (kg) *</label>
                <input type="number" min={0} step="0.01" value={form.quantity_kg || ''} onChange={e => setForm(f => ({ ...f, quantity_kg: parseFloat(e.target.value) || 0 }))} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>ชนิดขยะ (ไทย)</label>
                <input value={form.waste_type_th || ''} onChange={e => setForm(f => ({ ...f, waste_type_th: e.target.value }))} style={inputStyle} placeholder="เช่น เศษฟอยล์อลูมิเนียม" />
              </div>
              <div>
                <label style={labelStyle}>Waste Type (EN)</label>
                <input value={form.waste_type || ''} onChange={e => setForm(f => ({ ...f, waste_type: e.target.value }))} style={inputStyle} placeholder="e.g. Aluminum Foil" />
              </div>
              <div>
                <label style={labelStyle}>บริษัทรับกำจัด</label>
                <input value={form.disposal_company || ''} onChange={e => setForm(f => ({ ...f, disposal_company: e.target.value }))} style={inputStyle} placeholder="ชื่อบริษัทผู้รับกำจัด" />
              </div>
              <div>
                <label style={labelStyle}>เลขที่ใบอนุญาต (Code)</label>
                <input value={form.disposal_company_code || ''} onChange={e => setForm(f => ({ ...f, disposal_company_code: e.target.value }))} style={inputStyle} placeholder="เช่น DIWD056100019" />
              </div>
              <div>
                <label style={labelStyle}>Waste Code</label>
                <input value={form.waste_code || ''} onChange={e => setForm(f => ({ ...f, waste_code: e.target.value }))} style={inputStyle} placeholder="เช่น 16 05 08" />
              </div>
              <div>
                <label style={labelStyle}>รายได้ (+) / ค่าใช้จ่าย (−) บาท</label>
                <input type="number" step="0.01" value={form.cost ?? ''} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} style={inputStyle} placeholder="ขายได้ = บวก, จ่ายค่ากำจัด = ลบ" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>หมายเหตุ</label>
                <input value={form.remark || ''} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} style={inputStyle} placeholder="หมายเหตุเพิ่มเติม..." />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white" style={{ background: saving ? 'var(--muted)' : C_RECYCLE }}>
                {saving ? 'กำลังบันทึก...' : editing ? 'อัปเดต' : 'บันทึก'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl text-[13px] font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 14, padding: '20px 24px', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>ยืนยันการลบ</h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              ลบรายการ {confirmDelete.waste_type_th || confirmDelete.waste_type} วันที่ {String(confirmDelete.record_date).slice(0, 10)} ({Number(confirmDelete.quantity_kg).toLocaleString()} kg)?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: C_DISPOSAL }}>ลบรายการ</button>
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl text-[13px] font-semibold text-white shadow-lg" style={{ background: toast.type === 'success' ? C_RECYCLE : C_DISPOSAL }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
