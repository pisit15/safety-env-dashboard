'use client';

import { useState, useEffect, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { fmtDateDDMMMYY } from '@/components/DateInput';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, ExternalLink,
  RefreshCw, X, Save, Loader2, Search, QrCode, ChevronRight,
  User, Users, FileText, Image as ImageIcon, Settings, EyeOff, Eye, Trash2, Lock, LogIn,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
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
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

// ── Config ─────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:            { label: 'รายงานใหม่',      color: '#3b82f6', bg: '#eff6ff',  dot: '#3b82f6' },
  acknowledged:   { label: 'รับเรื่องแล้ว',  color: '#d97706', bg: '#fffbeb',  dot: '#f59e0b' },
  in_progress:    { label: 'กำลังดำเนินการ', color: '#ea580c', bg: '#fff7ed',  dot: '#f97316' },
  pending_review: { label: 'รอตรวจสอบ',      color: '#7c3aed', bg: '#f5f3ff',  dot: '#8b5cf6' },
  closed:         { label: 'ปิดรายการ',       color: '#16a34a', bg: '#f0fdf4',  dot: '#22c55e' },
} as const;

const RISK_CFG = {
  HIGH:       { label: 'HIGH',     color: '#dc2626', bg: '#fef2f2',  border: '#fca5a5' },
  'MED-HIGH': { label: 'MED-HIGH', color: '#ea580c', bg: '#fff7ed',  border: '#fdba74' },
  MEDIUM:     { label: 'MEDIUM',   color: '#ca8a04', bg: '#fefce8',  border: '#fde047' },
  LOW:        { label: 'LOW',      color: '#16a34a', bg: '#f0fdf4',  border: '#86efac' },
} as const;

const INV_LEVEL_OPTIONS = [
  'ระดับ 1 – ผู้ควบคุมงาน',
  'ระดับ 2 – จป.วิชาชีพ',
  'ระดับ 3 – คปอ.',
  'ระดับ 4 – ผู้จัดการแผนกที่เกี่ยวข้อง',
  'ระดับ 5 – ผู้บริหารหน่วยงาน',
];

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) { return fmtDateDDMMMYY(d || '', 'th'); }
function fmtDateTime(d: string | null) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function isOverdue(r: NearMissReport) { return !!r.due_date && r.status !== 'closed' && new Date(r.due_date) < new Date(); }
function isDueSoon(r: NearMissReport) {
  if (!r.due_date || r.status === 'closed') return false;
  const d = (new Date(r.due_date).getTime() - Date.now()) / 86400000;
  return d >= 0 && d <= 3;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function NearMissCoordinatorPage() {
  const params = useParams();
  const companyId = params.id as string;
  const company = COMPANIES.find(c => c.id === companyId);
  const auth = useAuth();
  const ca = auth.getCompanyAuth(companyId);
  const isLoggedIn = auth.isAdmin || ca.isLoggedIn;
  const isAdmin = auth.isAdmin;

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginPass) return;
    setLoginLoading(true);
    setLoginError('');
    const result = await auth.companyLogin(companyId, loginUser, loginPass);
    setLoginLoading(false);
    if (!result.success) setLoginError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  const [reports, setReports]     = useState<NearMissReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk]     = useState('');
  const [filterOpen, setFilterOpen]     = useState(false);
  const [showHidden, setShowHidden]     = useState(false);
  const [selected, setSelected]   = useState<NearMissReport | null>(null);
  const [editForm, setEditForm]   = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [activeTab, setActiveTab] = useState<'incident' | 'action'>('incident');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [closingImages, setClosingImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg]   = useState(false);

  const fetchReports = useCallback(async (includeHidden = false) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId });
      if (includeHidden) p.set('show_hidden', 'true');
      const res = await fetch(`/api/nearmiss?${p}`);
      const json = await res.json();
      setReports(json.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (isLoggedIn) fetchReports(showHidden); }, [isLoggedIn, fetchReports, showHidden]);

  const openDrawer = (r: NearMissReport) => {
    setSelected(r);
    setActiveTab('incident');
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
    setClosingImages(r.images || []);
    setConfirmDelete(false);
  };

  const uploadClosingImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companyId', companyId);
      const res = await fetch('/api/nearmiss/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok && json.url) {
        setClosingImages(prev => [...prev, json.url as string]);
      } else {
        alert(json.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch { alert('เกิดข้อผิดพลาดขณะอัปโหลด'); } finally { setUploadingImg(false); }
  };

  const saveEdits = async () => {
    if (!selected) return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`/api/nearmiss/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, images: closingImages }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg('บันทึกแล้ว');
        setReports(prev => prev.map(r => r.id === json.id ? json : r));
        setSelected(json);
      } else { setSaveMsg(json.error || 'เกิดข้อผิดพลาด'); }
    } catch { setSaveMsg('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  const toggleHidden = async () => {
    if (!selected) return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`/api/nearmiss/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: !selected.is_hidden }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg(json.is_hidden ? 'ซ่อนรายการแล้ว' : 'แสดงรายการแล้ว');
        setReports(prev => prev.map(r => r.id === json.id ? json : r));
        setSelected(json);
      } else { setSaveMsg(json.error || 'เกิดข้อผิดพลาด'); }
    } catch { setSaveMsg('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  const deleteReport = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/nearmiss/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== selected.id));
        setSelected(null);
        setConfirmDelete(false);
      } else { setSaveMsg('ลบไม่สำเร็จ'); }
    } catch { setSaveMsg('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  // ── Filtered + sorted ──
  const filtered = reports
    .filter(r => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterRisk   && r.risk_level !== filterRisk) return false;
      if (filterOpen   && r.status === 'closed') return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.report_no?.toLowerCase().includes(q) ||
                r.location?.toLowerCase().includes(q) ||
                r.incident_description?.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      const ao = isOverdue(a), bo = isOverdue(b);
      if (ao && !bo) return -1;
      if (!ao && bo) return 1;
      const an = a.status === 'new', bn = b.status === 'new';
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // ── KPIs ──
  const kpiNew     = reports.filter(r => r.status === 'new').length;
  const kpiOpen    = reports.filter(r => r.status !== 'closed').length;
  const kpiOverdue = reports.filter(r => isOverdue(r)).length;
  const kpiHigh    = reports.filter(r => r.risk_level === 'HIGH' && r.status !== 'closed').length;

  // ── Action queue ──
  const actionQueue = reports
    .filter(r => r.status !== 'closed' && (isOverdue(r) || isDueSoon(r) || r.status === 'new'))
    .slice(0, 5);

  const boardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/report/nearmiss/${companyId}/board`
    : '';

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main style={{ flex: 1, background: 'var(--bg-primary)', padding: '32px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Public Quick Links — accessible without login */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Near Miss Report</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
              {/* Card: Report Near Miss */}
              <a
                href={`/report/nearmiss/${companyId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderRadius: 16,
                  background: 'var(--card-solid)', border: '1px solid var(--border)',
                  textDecoration: 'none', transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                }}>
                  <FileText size={22} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>รายงาน Near Miss</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>แจ้งเหตุการณ์เกือบเกิดอุบัติเหตุ สำหรับพนักงานทุกคน ไม่ต้องเข้าสู่ระบบ</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#ef4444' }}>
                  <ExternalLink size={11} /> เปิดแบบฟอร์มรายงาน
                </span>
              </a>

              {/* Card: Employee Board */}
              <a
                href={boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderRadius: 16,
                  background: 'var(--card-solid)', border: '1px solid var(--border)',
                  textDecoration: 'none', transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                }}>
                  <Users size={22} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Employee Near Miss Board</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>ดูสถิติและรายงาน Near Miss ของพนักงาน ไม่ต้องเข้าสู่ระบบ</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                  <ExternalLink size={11} /> เปิด Dashboard
                </span>
              </a>
            </div>

            {/* Login Form */}
            <div
              className="rounded-2xl w-full overflow-hidden"
              style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)' }}>
                    <AlertTriangle size={20} color="#fff" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-white">ระบบจัดการ Near Miss (Admin)</h3>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{company?.fullName || company?.name || ''}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px' }}>เข้าสู่ระบบเพื่อจัดการและวิเคราะห์ข้อมูล Near Miss</p>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>ชื่อผู้ใช้</label>
                <div className="relative mb-4">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                  <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                    placeholder="ชื่อผู้ใช้ (ถ้ามี)" autoFocus
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }} />
                </div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>รหัสผ่าน</label>
                <div className="relative mb-4">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                  <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="รหัสผ่าน"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }} />
                </div>
                {loginError && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-[12px]" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{loginError}</div>
                )}
                <button onClick={handleLogin} disabled={!loginPass || loginLoading}
                  className="w-full py-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  style={{
                    background: loginPass ? 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' : '#e5e7eb',
                    color: loginPass ? '#fff' : '#9ca3af', cursor: loginPass ? 'pointer' : 'not-allowed',
                    opacity: loginLoading ? 0.7 : 1, border: 'none',
                    boxShadow: loginPass ? '0 4px 14px rgba(0,122,255,0.3)' : 'none',
                  }}>
                  {loginLoading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn size={16} />}
                  {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Near Miss</h1>
                {company && (
                  <span style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {company.shortName}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                {company?.fullName || company?.name || companyId} · ติดตามและจัดการรายงานเหตุการณ์เกือบอุบัติเหตุ
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.open(boardUrl, '_blank')} style={btnOutline}>
                <QrCode size={14} /> Employee Board
              </button>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')} style={btnOutline}>
                <ExternalLink size={14} /> ลิงก์รายงาน
              </button>
              <button onClick={() => fetchReports(showHidden)} style={btnPrimary}>
                <RefreshCw size={14} /> รีเฟรช
              </button>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="รายงานใหม่" sub="ยังไม่รับเรื่อง" value={kpiNew} accent="#3b82f6" urgent={kpiNew > 0}
              onClick={() => { setFilterStatus('new'); setFilterOpen(false); }} />
            <KpiCard label="ค้างดำเนินการ" sub="ยังไม่ปิด" value={kpiOpen} accent="#f97316"
              onClick={() => { setFilterOpen(true); setFilterStatus(''); }} />
            <KpiCard label="เกินกำหนด" sub="ต้องแก้ไขทันที" value={kpiOverdue} accent="#ef4444" urgent={kpiOverdue > 0}
              onClick={() => { setFilterStatus(''); setFilterOpen(true); }} />
            <KpiCard label="High Risk" sub="ยังไม่ปิด" value={kpiHigh} accent="#dc2626" urgent={kpiHigh > 0}
              onClick={() => { setFilterRisk('HIGH'); setFilterOpen(true); }} />
          </div>

          {/* ── Action Queue ── */}
          {actionQueue.length > 0 && (
            <div style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #fca5a5', background: '#fff5f5', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ต้องดำเนินการ</span>
              </div>
              <div style={{ padding: '8px 8px' }}>
                {actionQueue.map(r => {
                  const overdue = isOverdue(r); const soon = isDueSoon(r);
                  const risk = RISK_CFG[r.risk_level];
                  return (
                    <div key={r.id} onClick={() => openDrawer(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? '#ef4444' : soon ? '#f97316' : '#3b82f6', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', minWidth: 110 }}>{r.report_no}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1 }}>{r.location}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: risk.bg, color: risk.color, fontWeight: 600, border: `1px solid ${risk.border}` }}>{risk.label}</span>
                      <span style={{ fontSize: 11, color: overdue ? '#ef4444' : '#64748b', fontWeight: overdue ? 700 : 400, minWidth: 100, textAlign: 'right' }}>
                        {overdue ? `เกินกำหนด ${Math.abs(Math.floor((Date.now() - new Date(r.due_date!).getTime()) / 86400000))} วัน`
                          : r.status === 'new' ? 'ยังไม่รับเรื่อง'
                          : soon ? `ครบ ${fmtDate(r.due_date)}` : ''}
                      </span>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา เลขรายงาน สถานที่ เหตุการณ์..."
                style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            <button onClick={() => setFilterOpen(v => !v)}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${filterOpen ? '#3b82f6' : 'var(--border)'}`, background: filterOpen ? '#eff6ff' : 'var(--bg-secondary)', color: filterOpen ? '#3b82f6' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ยังไม่ปิด
            </button>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...selectStyle, width: 'auto', minWidth: 120 }}>
              <option value="">สถานะทั้งหมด</option>
              {(Object.entries(STATUS_CFG) as [string, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
              style={{ ...selectStyle, width: 'auto', minWidth: 120 }}>
              <option value="">ความเสี่ยงทั้งหมด</option>
              <option value="HIGH">HIGH</option>
              <option value="MED-HIGH">MED-HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            {(search || filterStatus || filterRisk || filterOpen) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterRisk(''); setFilterOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                <X size={12} /> ล้าง
              </button>
            )}
            {isLoggedIn && (
              <button onClick={() => { setShowHidden(v => !v); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: `1.5px solid ${showHidden ? '#f97316' : 'var(--border)'}`, background: showHidden ? 'rgba(249,115,22,0.08)' : 'var(--bg-secondary)', color: showHidden ? '#f97316' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                {showHidden ? 'ซ่อนอยู่' : 'ซ่อนอยู่'}
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} รายการ</span>
          </div>

          {/* ── Table ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14 }}>กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState search={search} companyId={companyId} />
          ) : (
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-secondary, #fff)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['', 'เลขที่', 'วันที่', 'สถานที่', 'ความเสี่ยง', 'สถานะ', 'ผู้ประสาน', 'กำหนด', 'อายุ'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const risk = RISK_CFG[r.risk_level] || RISK_CFG.LOW;
                    const overdue = isOverdue(r);
                    const age = daysSince(r.created_at);
                    const isLast = i === filtered.length - 1;
                    return (
                      <tr key={r.id} onClick={() => openDrawer(r)}
                        style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '0 6px 0 12px', width: 8 }}>
                          {overdue && <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />}
                        </td>
                        <td style={{ padding: '12px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.report_no || '—'}</td>
                        <td style={{ padding: '12px 12px', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(r.incident_date)}</td>
                        <td style={{ padding: '12px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>{r.location}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
                            {risk.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <StatusPill status={r.status} />
                            {r.is_hidden && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74', fontWeight: 600 }}>ซ่อน</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px', fontSize: 12, color: r.coordinator ? 'var(--text-primary)' : '#94a3b8' }}>{r.coordinator || '–'}</td>
                        <td style={{ padding: '12px 12px', fontSize: 12, whiteSpace: 'nowrap', color: overdue ? '#ef4444' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                          {r.due_date ? fmtDate(r.due_date) : '–'}
                          {overdue && <span style={{ marginLeft: 4 }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '12px 12px', fontSize: 12, color: age > 14 ? '#f97316' : 'var(--text-secondary)', fontWeight: age > 14 ? 600 : 400 }}>
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

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelected(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)' }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
            width: 520, maxWidth: '100vw',
            background: '#ffffff',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 32px rgba(15,23,42,0.12)',
          }}>

            {/* ── Drawer header ── */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', margin: '0 0 4px', letterSpacing: '0.05em' }}>{selected.report_no}</p>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>{selected.location}</h3>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ marginLeft: 12, flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(() => { const r = RISK_CFG[selected.risk_level]; return (
                  <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>
                    {r.label} (P{selected.probability}×S{selected.severity}={selected.risk_score})
                  </span>
                );})()}
                <StatusPill status={selected.status} />
                {isOverdue(selected) && (
                  <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                    ⏰ เกินกำหนด
                  </span>
                )}
              </div>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#f8fafc' }}>
              {([
                { key: 'incident', icon: <FileText size={13} />, label: 'เหตุการณ์' },
                { key: 'action',   icon: <Settings size={13} />, label: 'อัปเดต' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? '#007aff' : '#64748b', borderBottom: activeTab === tab.key ? '2px solid #007aff' : '2px solid transparent', transition: 'all 0.15s' }}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* ── TAB: Incident ── */}
              {activeTab === 'incident' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Meta info */}
                  <InfoCard>
                    <InfoRow label="วันที่เกิดเหตุ" value={fmtDate(selected.incident_date)} />
                    <InfoRow label="รายงานเมื่อ"    value={fmtDateTime(selected.created_at)} />
                    {selected.coordinator && <InfoRow label="ผู้ประสานงาน" value={selected.coordinator} />}
                    {selected.due_date    && <InfoRow label="กำหนดเสร็จ" value={fmtDate(selected.due_date)} overdue={isOverdue(selected)} />}
                  </InfoCard>

                  {/* Description */}
                  <Section title="รายละเอียดเหตุการณ์">
                    <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{selected.incident_description}</p>
                  </Section>

                  {/* Saving factor */}
                  {selected.saving_factor && (
                    <Section title="ปัจจัยที่ช่วย (Saving Factor)">
                      <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.75, margin: 0 }}>{selected.saving_factor}</p>
                    </Section>
                  )}

                  {/* Images */}
                  {selected.images && selected.images.length > 0 && (
                    <Section title={`รูปภาพ (${selected.images.length})`} icon={<ImageIcon size={13} />}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {selected.images.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <img src={url} alt={`รูปที่ ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </a>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Action taken */}
                  {selected.action_summary && (
                    <Section title="สรุปการดำเนินการล่าสุด">
                      <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.75, margin: 0 }}>{selected.action_summary}</p>
                    </Section>
                  )}

                  {/* Reporter info */}
                  {isLoggedIn && (
                    <Section title="ข้อมูลผู้รายงาน" icon={<User size={13} />}>
                      <InfoCard>
                        <InfoRow label="ชื่อ"    value={selected.reporter_name} />
                        <InfoRow label="แผนก"   value={selected.reporter_dept} />
                        {selected.notified_persons && <InfoRow label="แจ้งให้ทราบ" value={selected.notified_persons} />}
                      </InfoCard>
                      {selected.suggested_action && (
                        <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.7, margin: '10px 0 0' }}><strong>ข้อเสนอแนะ:</strong> {selected.suggested_action}</p>
                      )}
                    </Section>
                  )}
                </div>
              )}

              {/* ── TAB: Action — Progressive disclosure by status ── */}
              {activeTab === 'action' && (() => {
                const s = editForm.status;
                // Which field groups to show based on chosen status
                const showSummary    = s !== 'new';
                const showWorkFields = s === 'in_progress' || s === 'pending_review';
                const showAdminClose = isLoggedIn && s === 'closed';

                // Step order for the visual stepper
                const STEPS: Array<keyof typeof STATUS_CFG> = ['new', 'acknowledged', 'in_progress', 'pending_review', 'closed'];
                const currentIdx = STEPS.indexOf(s as keyof typeof STATUS_CFG);

                // Contextual hint per status
                const STATUS_HINT: Record<string, string> = {
                  new:            'รายงานถูกส่งเข้ามา — มอบหมายผู้ประสานงานแล้วเปลี่ยนสถานะ',
                  acknowledged:   'รับทราบแล้ว — กำลังประเมินก่อนลงมือแก้ไข',
                  in_progress:    'กำลังดำเนินการ — ระบุผู้รับผิดชอบ กำหนดวันแล้วเสร็จ และมาตรการแก้ไข',
                  pending_review: 'ดำเนินการแล้ว — รอ จป. ตรวจสอบก่อนปิดเคส',
                  closed:         'ปิดเคสแล้ว — บันทึกเพื่อการอ้างอิงและสถิติ',
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── Workflow stepper ── */}
                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>ขั้นตอนการดำเนินการ</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        {STEPS.map((st, idx) => {
                          const cfg = STATUS_CFG[st];
                          const isPast    = idx < currentIdx;
                          const isCurrent = idx === currentIdx;
                          const isFuture  = idx > currentIdx;
                          // Admin-only step
                          if (st === 'closed' && !isLoggedIn) return null;
                          return (
                            <div key={st} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                                  background: isCurrent ? cfg.color : isPast ? '#22c55e' : '#e2e8f0',
                                  color: isCurrent || isPast ? '#fff' : '#94a3b8',
                                  border: isCurrent ? `2px solid ${cfg.color}` : 'none',
                                  boxShadow: isCurrent ? `0 0 0 3px ${cfg.color}22` : 'none',
                                  flexShrink: 0,
                                }}>
                                  {isPast ? '✓' : idx + 1}
                                </div>
                                <span style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? cfg.color : isFuture ? '#cbd5e1' : '#64748b', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                                  {cfg.label.replace('รายงานใหม่','ใหม่').replace('รับเรื่องแล้ว','รับเรื่อง').replace('กำลังดำเนินการ','ดำเนินการ').replace('รอตรวจสอบ','รอตรวจ').replace('ปิดรายการ','ปิด')}
                                </span>
                              </div>
                              {idx < STEPS.length - 1 && (st !== 'pending_review' || isLoggedIn) && (
                                <div style={{ flex: 1, height: 2, background: isPast ? '#22c55e' : '#e2e8f0', margin: '0 4px 16px' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Status hint */}
                      <p style={{ fontSize: 12, color: '#64748b', margin: '10px 0 0', lineHeight: 1.5 }}>
                        💡 {STATUS_HINT[s] || ''}
                      </p>
                    </div>

                    {/* ── Status selector ── */}
                    <div>
                      <label style={labelStyle}>เปลี่ยนสถานะเป็น</label>
                      <select value={editForm.status}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                        style={{ ...fieldStyle, borderColor: STATUS_CFG[s as keyof typeof STATUS_CFG]?.color + '66' } as React.CSSProperties}>
                        {Object.entries(STATUS_CFG).map(([k, v]) =>
                          (k === 'closed' && !isLoggedIn) ? null : <option key={k} value={k}>{v.label}</option>
                        )}
                      </select>
                    </div>

                    {/* ── Coordinator — always shown ── */}
                    <div>
                      <label style={labelStyle}>ผู้ประสานงาน</label>
                      <input value={editForm.coordinator}
                        onChange={e => setEditForm(f => ({ ...f, coordinator: e.target.value }))}
                        style={fieldStyle as React.CSSProperties}
                        placeholder="ชื่อผู้รับผิดชอบดูแลเคสนี้" />
                    </div>

                    {/* ── Action summary — shown when started ── */}
                    {showSummary && (
                      <div>
                        <label style={labelStyle}>
                          {s === 'pending_review' ? 'สรุปสิ่งที่ดำเนินการแล้ว' : 'บันทึกการดำเนินการ'}
                        </label>
                        <textarea value={editForm.action_summary}
                          onChange={e => setEditForm(f => ({ ...f, action_summary: e.target.value }))}
                          style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                          placeholder={s === 'pending_review'
                            ? 'สรุปว่าได้ดำเนินการอะไรไปแล้วบ้าง เพื่อส่งให้ จป. ตรวจสอบ...'
                            : 'ความคืบหน้าล่าสุด สิ่งที่ได้ดำเนินการ...'} />
                      </div>
                    )}

                    {/* ── Work fields — in_progress / pending_review only ── */}
                    {showWorkFields && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>ผู้รับผิดชอบ</label>
                            <input value={editForm.responsible_person}
                              onChange={e => setEditForm(f => ({ ...f, responsible_person: e.target.value }))}
                              style={fieldStyle as React.CSSProperties} placeholder="ชื่อ..." />
                          </div>
                          <div>
                            <label style={labelStyle}>
                              กำหนดเสร็จ
                              <span style={{ fontSize: 10, color: '#f97316', marginLeft: 4 }}>*จำเป็น</span>
                            </label>
                            <DateInput value={editForm.due_date} onChange={v => setEditForm(f => ({ ...f, due_date: v }))} inputStyle={{ ...fieldStyle, borderColor: !editForm.due_date ? '#fbbf24' : '#e2e8f0' } as React.CSSProperties} />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>มาตรการแก้ไข / ป้องกัน</label>
                          <textarea value={editForm.immediate_action}
                            onChange={e => setEditForm(f => ({ ...f, immediate_action: e.target.value }))}
                            style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                            placeholder="ระบุมาตรการที่กำหนดให้ดำเนินการเพื่อป้องกันไม่ให้เกิดซ้ำ..." />
                        </div>
                      </>
                    )}

                    {/* ── Admin / Coordinator section ── */}
                    {isLoggedIn && (
                      <div style={{ padding: '16px', borderRadius: 10, background: '#fafafa', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>รายละเอียดเพิ่มเติม</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>ระดับการสอบสวน</label>
                            <select value={editForm.investigation_level}
                              onChange={e => setEditForm(f => ({ ...f, investigation_level: e.target.value }))}
                              style={fieldStyle as React.CSSProperties}>
                              <option value="">— เลือกระดับ —</option>
                              {INV_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Safety Officer</label>
                            <input value={editForm.safety_officer}
                              onChange={e => setEditForm(f => ({ ...f, safety_officer: e.target.value }))}
                              style={fieldStyle as React.CSSProperties} placeholder="ชื่อ Safety Officer" />
                          </div>
                          <div>
                            <label style={labelStyle}>หมายเหตุภายใน</label>
                            <textarea value={editForm.admin_notes}
                              onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                              style={{ ...fieldStyle, minHeight: 64, resize: 'vertical' } as React.CSSProperties}
                              placeholder="บันทึกที่ไม่แสดงต่อสาธารณะ..." />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Closing image attachment — shown when status = closed ── */}
                    {s === 'closed' && (
                      <div style={{ padding: '16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                          📎 แนบรูปภาพ / หลักฐานการแก้ไข
                        </p>

                        {/* Thumbnails */}
                        {closingImages.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {closingImages.map((url, i) => (
                              <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`img-${i}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #bbf7d0' }} />
                                <button
                                  onClick={() => setClosingImages(prev => prev.filter((_, idx) => idx !== i))}
                                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload buttons */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {/* Camera (mobile) */}
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontSize: 13, fontWeight: 600, cursor: uploadingImg ? 'not-allowed' : 'pointer', opacity: uploadingImg ? 0.6 : 1 }}>
                            📷 ถ่ายรูป
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                              disabled={uploadingImg}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadClosingImage(f); e.target.value = ''; }} />
                          </label>
                          {/* Gallery */}
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontSize: 13, fontWeight: 600, cursor: uploadingImg ? 'not-allowed' : 'pointer', opacity: uploadingImg ? 0.6 : 1 }}>
                            🖼️ เลือกรูป
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                              disabled={uploadingImg}
                              onChange={async e => {
                                const files = Array.from(e.target.files || []);
                                for (const f of files) await uploadClosingImage(f);
                                e.target.value = '';
                              }} />
                          </label>
                          {uploadingImg && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> กำลังอัปโหลด...
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: '#4ade80', margin: '8px 0 0', lineHeight: 1.4 }}>
                          รองรับ JPG, PNG — รูปจะถูกบันทึกพร้อมกันเมื่อกด "บันทึก"
                        </p>
                      </div>
                    )}

                    {/* ── Save button ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={saveEdits} disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 9, border: 'none', background: '#007aff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                      {saveMsg && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: ['บันทึกแล้ว','ซ่อนรายการแล้ว','แสดงรายการแล้ว'].includes(saveMsg) ? '#16a34a' : '#dc2626' }}>
                          {['บันทึกแล้ว','ซ่อนรายการแล้ว','แสดงรายการแล้ว'].includes(saveMsg) ? '✓ ' : '✕ '}{saveMsg}
                        </span>
                      )}
                    </div>

                    {/* ── Hide / Delete ── */}
                    <div style={{ paddingTop: 4, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={toggleHidden} disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1.5px solid ${selected.is_hidden ? '#f97316' : '#e2e8f0'}`, background: selected.is_hidden ? '#fff7ed' : '#f8fafc', color: selected.is_hidden ? '#ea580c' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {selected.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        {selected.is_hidden ? 'แสดงรายการ' : 'ซ่อนรายการ'}
                      </button>
                      {isAdmin && !confirmDelete && (
                        <button onClick={() => setConfirmDelete(true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fff5f5', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          <Trash2 size={14} /> ลบถาวร
                        </button>
                      )}
                      {isAdmin && confirmDelete && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
                          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>ยืนยันลบถาวร?</span>
                          <button onClick={deleteReport} disabled={saving}
                            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {saving ? 'ลบ...' : 'ยืนยัน'}
                          </button>
                          <button onClick={() => setConfirmDelete(false)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                            ยกเลิก
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Timestamps */}
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                      รับเรื่อง: {fmtDateTime(selected.created_at)} · อัปเดต: {fmtDateTime(selected.updated_at)}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] || STATUS_CFG.new;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, sub, value, accent, urgent = false, onClick }: { label: string; sub: string; value: number; accent: string; urgent?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      style={{ padding: '16px', borderRadius: 12, border: `1.5px solid ${urgent && value > 0 ? accent + '66' : 'var(--border)'}`, background: urgent && value > 0 ? accent + '0d' : 'var(--bg-secondary, #fff)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 5 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Section({ title, icon, children, adminOnly = false }: { title: string; icon?: React.ReactNode; children: React.ReactNode; adminOnly?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: '#94a3b8' }}>{icon}</span>}
        <span style={{ fontSize: 11, fontWeight: 700, color: adminOnly ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        {adminOnly && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#94a3b8', fontWeight: 600 }}>ADMIN</span>}
      </div>
      <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', background: '#fafafa' }}>{children}</div>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fafafa' }}>{children}</div>;
}

function InfoRow({ label, value, overdue = false }: { label: string; value: string | null | undefined; overdue?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: overdue ? '#dc2626' : '#1e293b', textAlign: 'right', maxWidth: '60%' }}>{value}{overdue ? ' ⚠️' : ''}</span>
    </div>
  );
}

function EmptyState({ search, companyId }: { search: string; companyId: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '70px 20px', border: '1.5px dashed #e2e8f0', borderRadius: 14 }}>
      {search ? (
        <>
          <p style={{ fontSize: 36, marginBottom: 10 }}>🔍</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ไม่พบรายการที่ตรงกับ "{search}"</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 36, marginBottom: 10 }}>📋</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>ยังไม่มีรายงาน Near Miss</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 22px' }}>แชร์ลิงก์ให้พนักงานเริ่มรายงานได้เลย</p>
          <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
            style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#007aff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            เปิดลิงก์รายงาน
          </button>
        </>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, letterSpacing: '0.02em' };
const fieldStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s', lineHeight: 1.5 };
