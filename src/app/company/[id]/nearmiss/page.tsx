'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, ExternalLink,
  RefreshCw, ChevronDown, X, Save, Loader2, Filter,
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
  probability: number;
  severity: number;
  risk_score: number;
  risk_level: 'HIGH' | 'MED-HIGH' | 'MEDIUM' | 'LOW';
  immediate_action: string | null;
  responsible_person: string | null;
  due_date: string | null;
  status: 'new' | 'investigating' | 'action_taken' | 'closed';
  investigation_level: string | null;
  safety_officer: string | null;
  closed_date: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Config ──
const RISK_CONFIG = {
  HIGH:     { label: 'HIGH',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   emoji: '🔴' },
  'MED-HIGH': { label: 'MED-HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)',  emoji: '🟠' },
  MEDIUM:   { label: 'MEDIUM',   color: '#eab308', bg: 'rgba(234,179,8,0.1)',   emoji: '🟡' },
  LOW:      { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   emoji: '🟢' },
};

const STATUS_CONFIG = {
  new:          { label: 'รายงานใหม่',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  investigating: { label: 'กำลังสอบสวน',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  action_taken:  { label: 'ดำเนินการแล้ว', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  closed:        { label: 'ปิดแล้ว',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const STATUS_OPTIONS = [
  { value: 'new',          label: 'รายงานใหม่' },
  { value: 'investigating', label: 'กำลังสอบสวน' },
  { value: 'action_taken', label: 'ดำเนินการแล้ว' },
  { value: 'closed',       label: 'ปิดแล้ว' },
];

const INV_LEVEL_OPTIONS = ['ระดับ 1 – ผู้ควบคุมงาน', 'ระดับ 2 – จป.วิชาชีพ', 'ระดับ 3 – คณะกรรมการ'];

// ── Helpers ──
function fmtDate(d: string) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d: string) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NearMissCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const auth = useAuth();
  const ca = auth.getCompanyAuth(companyId);
  const isLoggedIn = auth.isAdmin || ca.isLoggedIn;

  const [reports, setReports] = useState<NearMissReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [selectedReport, setSelectedReport] = useState<NearMissReport | null>(null);

  // Admin edit state
  const [editForm, setEditForm] = useState<Partial<NearMissReport>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId });
      if (filterStatus) params.set('status', filterStatus);
      if (filterRisk) params.set('riskLevel', filterRisk);
      const res = await fetch(`/api/nearmiss?${params}`);
      const json = await res.json();
      setReports(json.data || []);
      setTotal(json.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [companyId, filterStatus, filterRisk]);

  useEffect(() => { if (isLoggedIn) fetchReports(); }, [isLoggedIn, fetchReports]);

  const openDetail = (r: NearMissReport) => {
    setSelectedReport(r);
    setEditForm({ status: r.status, investigation_level: r.investigation_level || '', safety_officer: r.safety_officer || '', admin_notes: r.admin_notes || '' });
    setSaveMsg('');
  };

  const saveAdminFields = async () => {
    if (!selectedReport) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/nearmiss/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg('บันทึกสำเร็จ');
        setReports(prev => prev.map(r => r.id === json.id ? json : r));
        setSelectedReport(json);
      } else {
        setSaveMsg(json.error || 'เกิดข้อผิดพลาด');
      }
    } catch { setSaveMsg('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  // ── KPI stats ──
  const statsNew       = reports.filter(r => r.status === 'new').length;
  const statsOpen      = reports.filter(r => r.status !== 'closed').length;
  const statsHigh      = reports.filter(r => r.risk_level === 'HIGH').length;
  const statsClosed    = reports.filter(r => r.status === 'closed').length;

  // ── Auth gate ──
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>กรุณาเข้าสู่ระบบ</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>ต้องเข้าสู่ระบบก่อนจึงจะดูรายงาน Near Miss ได้</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Near Miss Report</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>รายงานเหตุการณ์เกือบอุบัติเหตุ — {total} รายการ</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <ExternalLink size={14} /> ลิงก์แบบฟอร์ม
              </button>
              <button
                onClick={fetchReports}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> รีเฟรช
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label="รายงานใหม่" value={statsNew} icon={<AlertTriangle size={18} />} color="#3b82f6" onClick={() => { setFilterStatus('new'); setFilterRisk(''); }} />
            <KpiCard label="ค้างดำเนินการ" value={statsOpen} icon={<Clock size={18} />} color="#f59e0b" onClick={() => { setFilterStatus(''); setFilterRisk(''); }} />
            <KpiCard label="ความเสี่ยงสูง" value={statsHigh} icon={<TrendingUp size={18} />} color="#ef4444" onClick={() => { setFilterRisk('HIGH'); setFilterStatus(''); }} />
            <KpiCard label="ปิดแล้ว" value={statsClosed} icon={<CheckCircle size={18} />} color="#22c55e" onClick={() => { setFilterStatus('closed'); setFilterRisk(''); }} />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
              <option value="">สถานะทั้งหมด</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
              <option value="">ความเสี่ยงทั้งหมด</option>
              <option value="HIGH">🔴 HIGH</option>
              <option value="MED-HIGH">🟠 MED-HIGH</option>
              <option value="MEDIUM">🟡 MEDIUM</option>
              <option value="LOW">🟢 LOW</option>
            </select>
            {(filterStatus || filterRisk) && (
              <button onClick={() => { setFilterStatus(''); setFilterRisk(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                <X size={12} /> ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* Reports table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p>กำลังโหลด...</p>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 15 }}>ยังไม่มีรายงาน Near Miss</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                  style={{ color: '#007aff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  เปิดแบบฟอร์มรายงาน
                </button>
              </p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    {['หมายเลข', 'วันที่', 'ผู้รายงาน', 'สถานที่', 'ความเสี่ยง', 'สถานะ', 'รับเรื่อง'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => {
                    const risk = RISK_CONFIG[r.risk_level] || RISK_CONFIG.LOW;
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.new;
                    return (
                      <tr key={r.id}
                        onClick={() => openDetail(r)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{r.report_no || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(r.incident_date)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.reporter_name}</div>
                          {r.reporter_dept && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.reporter_dept}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.location}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color }}>
                            {risk.emoji} {risk.label}
                          </span>
                          <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-secondary)' }}>({r.risk_score})</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Detail Panel (slide-over) ── */}
      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          {/* Backdrop */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedReport(null)} />
          {/* Panel */}
          <div style={{ width: Math.min(520, window.innerWidth - 40), background: 'var(--bg-primary)', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            {/* Panel header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, fontFamily: 'monospace' }}>{selectedReport.report_no || '—'}</p>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0' }}>รายละเอียดรายงาน</h3>
              </div>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', flex: 1 }}>
              {/* Risk + Status badges */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {(() => { const r = RISK_CONFIG[selectedReport.risk_level] || RISK_CONFIG.LOW; return (
                  <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: r.bg, color: r.color }}>
                    {r.emoji} {r.label} (P{selectedReport.probability}×S{selectedReport.severity}={selectedReport.risk_score})
                  </span>
                ); })()}
                {(() => { const s = STATUS_CONFIG[selectedReport.status] || STATUS_CONFIG.new; return (
                  <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                ); })()}
              </div>

              {/* Sections */}
              <DetailSection title="A — ผู้รายงาน">
                <DetailRow label="ชื่อ-นามสกุล" value={selectedReport.reporter_name} />
                <DetailRow label="แผนก" value={selectedReport.reporter_dept} />
                <DetailRow label="วันที่เกิดเหตุ" value={fmtDate(selectedReport.incident_date)} />
                <DetailRow label="สถานที่" value={selectedReport.location} />
              </DetailSection>

              <DetailSection title="B — เหตุการณ์">
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{selectedReport.incident_description}</p>
              </DetailSection>

              {selectedReport.saving_factor && (
                <DetailSection title="C — Saving Factor">
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{selectedReport.saving_factor}</p>
                </DetailSection>
              )}

              <DetailSection title="E — การดำเนินการ">
                <DetailRow label="สิ่งที่ทำไปแล้ว" value={selectedReport.immediate_action} />
                <DetailRow label="ผู้รับผิดชอบ" value={selectedReport.responsible_person} />
                <DetailRow label="กำหนดแล้วเสร็จ" value={selectedReport.due_date ? fmtDate(selectedReport.due_date) : null} />
              </DetailSection>

              {/* Admin update section */}
              {auth.isAdmin && (
                <div style={{ marginTop: 20, padding: 16, borderRadius: 12, border: '1.5px solid var(--accent, #007aff)', background: 'rgba(0,122,255,0.04)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#007aff', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔒 Admin — อัปเดตสถานะ</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>สถานะ</label>
                      <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as NearMissReport['status'] }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ระดับการสอบสวน</label>
                      <select value={editForm.investigation_level || ''} onChange={e => setEditForm(f => ({ ...f, investigation_level: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>
                        <option value="">— เลือกระดับ —</option>
                        {INV_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Safety Officer ผู้รับผิดชอบ</label>
                      <input value={editForm.safety_officer || ''} onChange={e => setEditForm(f => ({ ...f, safety_officer: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                        placeholder="ชื่อ Safety Officer" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>หมายเหตุ Admin</label>
                      <textarea value={editForm.admin_notes || ''} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
                        placeholder="หมายเหตุภายใน..." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={saveAdminFields} disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                      {saveMsg && <span style={{ fontSize: 12, color: saveMsg.includes('สำเร็จ') ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{saveMsg}</span>}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
                รับเรื่อง: {fmtDateTime(selectedReport.created_at)} · อัปเดต: {fmtDateTime(selectedReport.updated_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ──
function KpiCard({ label, value, icon, color, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '16px', borderRadius: 12, border: '1px solid var(--border)',
      background: 'var(--card-solid, var(--bg-secondary))',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.1s, box-shadow 0.1s',
    }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
