'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, ExternalLink,
  RefreshCw, X, Save, Loader2, Filter, Search, QrCode, ChevronDown,
} from 'lucide-react';

// ── Types ──
interface NearMissReport {
  id: string;
  report_no: string;
  company_id: string;
  reporter_name: string;
  reporter_dept: string | null;
  incident_date: string;
  location: string;
  incident_description: string;
  saving_factor: string | null;
  notified_persons: string | null;
  suggested_action: string | null;
  images: string[] | null;
  probability: number;
  severity: number;
  risk_score: number;
  risk_level: 'HIGH' | 'MED-HIGH' | 'MEDIUM' | 'LOW';
  status: 'new' | 'acknowledged' | 'in_progress' | 'pending_review' | 'closed';
  coordinator: string | null;
  coordinator_assigned_at: string | null;
  last_action_at: string | null;
  action_summary: string | null;
  investigation_level: string | null;
  safety_officer: string | null;
  immediate_action: string | null;
  responsible_person: string | null;
  due_date: string | null;
  closed_date: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Config ──
const STATUS_CFG = {
  new:            { label: 'รายงานใหม่',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  order: 0 },
  acknowledged:   { label: 'รับเรื่องแล้ว',  color: '#eab308', bg: 'rgba(234,179,8,0.1)',   order: 1 },
  in_progress:    { label: 'กำลังดำเนินการ', color: '#f97316', bg: 'rgba(249,115,22,0.1)',  order: 2 },
  pending_review: { label: 'รอตรวจสอบ',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  order: 3 },
  closed:         { label: 'ปิดรายการ',       color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   order: 4 },
} as const;

const RISK_CFG = {
  HIGH:       { emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'MED-HIGH': { emoji: '🟠', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  MEDIUM:     { emoji: '🟡', color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  LOW:        { emoji: '🟢', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
} as const;

const INV_LEVEL_OPTIONS = ['ระดับ 1 – ผู้ควบคุมงาน', 'ระดับ 2 – จป.วิชาชีพ', 'ระดับ 3 – คณะกรรมการ'];

// ── Helpers ──
function fmtDate(d: string | null) { if (!d) return '–'; return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDateTime(d: string | null) { if (!d) return '–'; return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function isOverdue(r: NearMissReport) { return !!r.due_date && r.status !== 'closed' && new Date(r.due_date) < new Date(); }
function isDueSoon(r: NearMissReport) { if (!r.due_date || r.status === 'closed') return false; const d = (new Date(r.due_date).getTime() - Date.now()) / 86400000; return d >= 0 && d <= 3; }

export default function NearMissCoordinatorPage() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const ca = auth.getCompanyAuth(companyId);
  const isLoggedIn = auth.isAdmin || ca.isLoggedIn;
  const canEdit = auth.isAdmin || ca.isLoggedIn;
  const isAdmin = auth.isAdmin;

  const [reports, setReports] = useState<NearMissReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<NearMissReport | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId });
      const res = await fetch(`/api/nearmiss?${p}`);
      const json = await res.json();
      setReports(json.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (isLoggedIn) fetchReports(); }, [isLoggedIn, fetchReports]);

  const openDrawer = (r: NearMissReport) => {
    setSelected(r);
    setEditForm({
      status: r.status,
      coordinator: r.coordinator || '',
      action_summary: r.action_summary || '',
      immediate_action: r.immediate_action || '',
      responsible_person: r.responsible_person || '',
      due_date: r.due_date || '',
      investigation_level: r.investigation_level || '',
      safety_officer: r.safety_officer || '',
      admin_notes: r.admin_notes || '',
    });
    setSaveMsg('');
  };

  const saveEdits = async () => {
    if (!selected) return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`/api/nearmiss/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg('✓ บันทึกแล้ว');
        setReports(prev => prev.map(r => r.id === json.id ? json : r));
        setSelected(json);
      } else { setSaveMsg(json.error || 'เกิดข้อผิดพลาด'); }
    } catch { setSaveMsg('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  // ── Filtered + sorted ──
  const filtered = reports
    .filter(r => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterRisk && r.risk_level !== filterRisk) return false;
      if (filterOpen && r.status === 'closed') return false;
      if (search) {
        const q = search.toLowerCase();
        return r.report_no?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q) || r.incident_description?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const ao = isOverdue(a), bo = isOverdue(b);
      if (ao && !bo) return -1;
      if (!ao && bo) return 1;
      const aNew = a.status === 'new', bNew = b.status === 'new';
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // ── KPI stats ──
  const kpiNew      = reports.filter(r => r.status === 'new').length;
  const kpiOpen     = reports.filter(r => r.status !== 'closed').length;
  const kpiOverdue  = reports.filter(r => isOverdue(r)).length;
  const kpiHigh     = reports.filter(r => r.risk_level === 'HIGH' && r.status !== 'closed').length;

  // ── Action queue (overdue + due soon + new) ──
  const actionQueue = reports.filter(r => r.status !== 'closed' && (isOverdue(r) || isDueSoon(r) || r.status === 'new')).slice(0, 5);

  const boardUrl = typeof window !== 'undefined' ? `${window.location.origin}/report/nearmiss/${companyId}/board` : '';

  // ── Auth gate ──
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>กรุณาเข้าสู่ระบบ</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>ต้องเข้าสู่ระบบก่อนจึงจะดูและจัดการรายงาน Near Miss ได้</p>
            <button
              onClick={() => { const el = document.querySelector('[data-login-btn]') as HTMLButtonElement; el?.click(); }}
              style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#007aff', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              เข้าสู่ระบบ
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

          {/* ── Page header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Near Miss</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>ติดตามและจัดการรายงานเหตุการณ์เกือบอุบัติเหตุ</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => window.open(boardUrl, '_blank')}
                style={btnOutline}><QrCode size={14} /> Employee Board</button>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={btnOutline}><ExternalLink size={14} /> ลิงก์รายงาน</button>
              <button onClick={fetchReports} style={btnPrimary}><RefreshCw size={14} /> รีเฟรช</button>
            </div>
          </div>

          {/* ── KPI Cards (action-oriented) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard label="รายงานใหม่" sub="ยังไม่รับเรื่อง" value={kpiNew} color="#3b82f6"
              urgent={kpiNew > 0} onClick={() => { setFilterStatus('new'); setFilterOpen(false); }} />
            <KpiCard label="ค้างดำเนินการ" sub="ยังไม่ปิด" value={kpiOpen} color="#f97316"
              onClick={() => { setFilterOpen(true); setFilterStatus(''); }} />
            <KpiCard label="เกินกำหนด" sub="ต้องแก้ไขทันที" value={kpiOverdue} color="#ef4444"
              urgent={kpiOverdue > 0} onClick={() => { setFilterStatus(''); setFilterOpen(true); }} />
            <KpiCard label="High Risk เปิดอยู่" sub="ยังไม่ปิด" value={kpiHigh} color="#dc2626"
              urgent={kpiHigh > 0} onClick={() => { setFilterRisk('HIGH'); setFilterOpen(true); }} />
          </div>

          {/* ── Action Queue ── */}
          {actionQueue.length > 0 && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.03)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ ต้องดำเนินการ</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actionQueue.map(r => {
                  const overdue = isOverdue(r);
                  const soon = isDueSoon(r);
                  return (
                    <div key={r.id} onClick={() => openDrawer(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', cursor: 'pointer', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12 }}>{overdue ? '🔴' : soon ? '🟠' : '🔵'}</span>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.report_no}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{r.location}</span>
                      <span style={{ fontSize: 11, color: overdue ? '#ef4444' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 400 }}>
                        {overdue ? `เกินกำหนด ${Math.abs(Math.floor((Date.now() - new Date(r.due_date!).getTime()) / 86400000))} วัน` : r.status === 'new' ? 'ยังไม่รับเรื่อง' : soon ? `ครบ ${fmtDate(r.due_date)}` : ''}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา เลขรายงาน สถานที่ เหตุการณ์..."
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            {/* Open only toggle */}
            <button onClick={() => setFilterOpen(v => !v)}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${filterOpen ? '#007aff' : 'var(--border)'}`, background: filterOpen ? 'rgba(0,122,255,0.08)' : 'var(--bg-secondary)', color: filterOpen ? '#007aff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ยังไม่ปิด
            </button>
            {/* Status filter */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
              <option value="">สถานะทั้งหมด</option>
              {(Object.entries(STATUS_CFG) as [string, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {/* Risk filter */}
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
              <option value="">ความเสี่ยงทั้งหมด</option>
              <option value="HIGH">🔴 HIGH</option>
              <option value="MED-HIGH">🟠 MED-HIGH</option>
              <option value="MEDIUM">🟡 MEDIUM</option>
              <option value="LOW">🟢 LOW</option>
            </select>
            {(search || filterStatus || filterRisk || filterOpen) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterRisk(''); setFilterOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                <X size={12} /> ล้าง
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} รายการ</span>
          </div>

          {/* ── Table ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p>กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState search={search} companyId={companyId} />
          ) : (
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    {['', 'เลขที่', 'วันที่', 'สถานที่', 'ความเสี่ยง', 'สถานะ', 'ผู้ประสาน', 'กำหนด', 'อายุ'].map(h => (
                      <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const risk  = RISK_CFG[r.risk_level] || RISK_CFG.LOW;
                    const overdue = isOverdue(r);
                    const age = daysSince(r.created_at);
                    return (
                      <tr key={r.id} onClick={() => openDrawer(r)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: overdue ? 'rgba(239,68,68,0.025)' : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = overdue ? 'rgba(239,68,68,0.025)' : 'transparent')}>
                        {/* Overdue indicator */}
                        <td style={{ padding: '0 4px 0 10px', width: 6 }}>
                          {overdue && <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
                        </td>
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.report_no || '—'}</td>
                        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(r.incident_date)}</td>
                        <td style={{ padding: '10px 10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>{r.location}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color }}>
                            {risk.emoji} {r.risk_level}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px' }}><StatusBadge status={r.status} /></td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: r.coordinator ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{r.coordinator || '–'}</td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: overdue ? '#ef4444' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {r.due_date ? fmtDate(r.due_date) : '–'}
                          {overdue && <span style={{ marginLeft: 4 }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: age > 14 ? '#f97316' : 'var(--text-secondary)', fontWeight: age > 14 ? 600 : 400 }}>
                          {age === 0 ? 'วันนี้' : `${age}ว`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Drawer ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelected(null)} />
          <div style={{ width: Math.min(540, (typeof window !== 'undefined' ? window.innerWidth : 540) - 40), background: 'var(--bg-primary)', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>

            {/* Drawer header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, fontFamily: 'monospace' }}>{selected.report_no}</p>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0' }}>{selected.location}</h3>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
              </div>
              {/* Risk + Status */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {(() => { const r = RISK_CFG[selected.risk_level]; return <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: r.bg, color: r.color }}>{r.emoji} {selected.risk_level} (P{selected.probability}×S{selected.severity}={selected.risk_score})</span>; })()}
                <StatusBadge status={selected.status} large />
                {isOverdue(selected) && <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>⏰ เกินกำหนด</span>}
              </div>
            </div>

            <div style={{ padding: '20px 22px' }}>
              {/* ── Case file sections ── */}

              {/* Incident */}
              <CaseSection title="🔍 เหตุการณ์">
                <CaseRow label="วันที่" value={fmtDate(selected.incident_date)} />
                <CaseRow label="สถานที่" value={selected.location} />
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{selected.incident_description}</p>
                {selected.saving_factor && <><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '10px 0 4px', textTransform: 'uppercase' }}>Saving Factor</p><p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>{selected.saving_factor}</p></>}
              </CaseSection>

              {/* Images */}
              {selected.images && selected.images.length > 0 && (
                <CaseSection title="📷 รูปภาพ">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                    {selected.images.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={url} alt={`รูปที่ ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </CaseSection>
              )}

              {/* Reporter info (admin only) */}
              {isAdmin && (
                <CaseSection title="👤 ผู้รายงาน (Admin only)">
                  <CaseRow label="ชื่อ" value={selected.reporter_name} />
                  <CaseRow label="แผนก" value={selected.reporter_dept} />
                  {selected.notified_persons && <CaseRow label="แจ้งให้ทราบ" value={selected.notified_persons} />}
                  {selected.suggested_action && <CaseRow label="ข้อเสนอแนะ" value={selected.suggested_action} />}
                </CaseSection>
              )}

              {/* ── Coordinator update form ── */}
              <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--border)', marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#007aff', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isAdmin ? '🔧 อัปเดตเคส' : '🔧 Coordinator — อัปเดตสถานะ'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Status */}
                  <FormRow label="สถานะ">
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      style={selectStyle}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => (
                        // Admin can close; coordinator can't
                        (k === 'closed' && !isAdmin) ? null :
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </FormRow>
                  {/* Coordinator */}
                  <FormRow label="ผู้ประสานงาน">
                    <input value={editForm.coordinator} onChange={e => setEditForm(f => ({ ...f, coordinator: e.target.value }))}
                      style={inputStyle} placeholder="ชื่อผู้ประสานงาน" />
                  </FormRow>
                  {/* Action summary */}
                  <FormRow label="สรุปการดำเนินการ">
                    <textarea value={editForm.action_summary} onChange={e => setEditForm(f => ({ ...f, action_summary: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 70, resize: 'vertical' as const }} placeholder="สรุปสั้น ๆ ว่าดำเนินการอะไรไปแล้ว..." />
                  </FormRow>
                  {/* Responsible + Due */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <FormRow label="ผู้รับผิดชอบ">
                      <input value={editForm.responsible_person} onChange={e => setEditForm(f => ({ ...f, responsible_person: e.target.value }))}
                        style={inputStyle} placeholder="ชื่อ..." />
                    </FormRow>
                    <FormRow label="กำหนดแล้วเสร็จ">
                      <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                        style={inputStyle} />
                    </FormRow>
                  </div>
                  {/* Corrective action */}
                  <FormRow label="มาตรการแก้ไข">
                    <textarea value={editForm.immediate_action} onChange={e => setEditForm(f => ({ ...f, immediate_action: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} placeholder="มาตรการที่กำหนดให้ดำเนินการ..." />
                  </FormRow>

                  {/* Admin-only fields */}
                  {isAdmin && (
                    <>
                      <FormRow label="ระดับการสอบสวน">
                        <select value={editForm.investigation_level} onChange={e => setEditForm(f => ({ ...f, investigation_level: e.target.value }))} style={selectStyle}>
                          <option value="">— เลือก —</option>
                          {INV_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormRow>
                      <FormRow label="Safety Officer">
                        <input value={editForm.safety_officer} onChange={e => setEditForm(f => ({ ...f, safety_officer: e.target.value }))}
                          style={inputStyle} placeholder="ชื่อ Safety Officer" />
                      </FormRow>
                      <FormRow label="หมายเหตุ Admin">
                        <textarea value={editForm.admin_notes} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} placeholder="หมายเหตุภายใน..." />
                      </FormRow>
                    </>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <button onClick={saveEdits} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                      {saving ? 'บันทึก...' : 'บันทึก'}
                    </button>
                    {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith('✓') ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{saveMsg}</span>}
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                รับเรื่อง: {fmtDateTime(selected.created_at)} · อัปเดตล่าสุด: {fmtDateTime(selected.updated_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ──
function StatusBadge({ status, large = false }: { status: string; large?: boolean }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] || STATUS_CFG.new;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: large ? '4px 10px' : '2px 8px', borderRadius: 20, fontSize: large ? 12 : 11, fontWeight: 600, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, sub, value, color, urgent = false, onClick }: { label: string; sub: string; value: number; color: string; urgent?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ padding: '14px', borderRadius: 12, border: `1.5px solid ${urgent && value > 0 ? color : 'var(--border)'}`, background: urgent && value > 0 ? `${color}0d` : 'var(--card-solid, var(--bg-secondary))', cursor: 'pointer', transition: 'transform 0.1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function CaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>{children}</div>
    </div>
  );
}

function CaseRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '65%' }}>{value}</span>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ search, companyId }: { search: string; companyId: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)', borderRadius: 16 }}>
      {search ? (
        <>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>ไม่พบรายการที่ตรงกับ "{search}"</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>ยังไม่มีรายงาน Near Miss</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>แชร์ลิงก์ให้พนักงานเริ่มรายงานได้เลย</p>
          <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
            style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#007aff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            เปิดลิงก์รายงาน
          </button>
        </>
      )}
    </div>
  );
}

// ── Inline styles ──
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
