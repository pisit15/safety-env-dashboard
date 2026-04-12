'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fmtDateDDMMMYY } from '@/components/DateInput';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import {
  AlertTriangle, Clock, TrendingUp, TrendingDown,
  RefreshCw, Loader2, ChevronRight, Building2, AlertCircle,
  Search, Download, X, ChevronDown, ChevronUp, CheckSquare, Square,
  FileText, MapPin, Calendar,
} from 'lucide-react';

/* ── Types ── */
interface CompanySummary {
  total: number; new: number; open: number; closed: number;
  high: number; overdue: number; latest: string | null;
}
interface AllReport {
  id: string; report_no: string; company_id: string;
  reporter_name: string; reporter_dept: string;
  incident_date: string; location: string;
  incident_description: string; immediate_action: string;
  risk_level: 'HIGH' | 'MED-HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  status: 'new' | 'investigating' | 'action_taken' | 'closed';
  created_at: string;
  probability: number; severity: number;
  saving_factor: string; responsible_person: string; due_date: string;
  investigation_level: string; safety_officer: string;
}
interface MonthlyTrend { total: number; high: number; closed: number; }

/* ── Config ── */
const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  HIGH:       { label: 'HIGH',     color: '#C23B22', bg: 'rgba(194,59,34,0.1)' },
  'MED-HIGH': { label: 'MED-HIGH', color: '#F28E2B', bg: 'rgba(242,142,43,0.1)' },
  MEDIUM:     { label: 'MEDIUM',   color: '#F28E2B', bg: 'rgba(242,142,43,0.08)' },
  LOW:        { label: 'LOW',      color: '#2B8C3E', bg: 'rgba(43,140,62,0.1)' },
};
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:           { label: 'รายงานใหม่',     color: '#4E79A7', bg: 'rgba(78,121,167,0.1)' },
  investigating: { label: 'กำลังสอบสวน',   color: '#F28E2B', bg: 'rgba(242,142,43,0.1)' },
  action_taken:  { label: 'ดำเนินการแล้ว', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  closed:        { label: 'ปิดแล้ว',       color: '#BAB0AC', bg: 'rgba(186,176,172,0.1)' },
};

function fmtDate(d: string) { return fmtDateDDMMMYY(d, 'th'); }
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  return `${days} วันที่แล้ว`;
}

/* ══════════════════════════════════════════════════════ */
export default function AdminNearMissPage() {
  const auth = useAuth();
  const router = useRouter();
  const { companies: COMPANIES } = useCompanies();

  const [tab, setTab] = useState<'overview' | 'all'>('overview');
  const [summary, setSummary] = useState<Record<string, CompanySummary>>({});
  const [monthlyTrend, setMonthlyTrend] = useState<Record<string, MonthlyTrend>>({});
  const [gOverdue, setGOverdue] = useState(0);
  const [allReports, setAllReports] = useState<AllReport[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Filter & search state (Improvement #1) ──
  const [searchText, setSearchText] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Chart collapsible (Improvement #2) ──
  const [chartOpen, setChartOpen] = useState(true);

  // ── Report detail drawer (Improvement #4) ──
  const [selectedReport, setSelectedReport] = useState<AllReport | null>(null);

  // ── Bulk selection (Improvement #6) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  /* ── Data fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await fetch('/api/nearmiss/admin?view=summary');
        const json = await res.json();
        setSummary(json.summary || {});
        setMonthlyTrend(json.monthlyTrend || {});
        setGOverdue(json.overdue || 0);
      } else {
        const res = await fetch('/api/nearmiss/admin?view=all&limit=200');
        const json = await res.json();
        setAllReports(json.data || []);
        setTotalAll(json.total || 0);
        setSelectedIds(new Set());
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { if (auth.isAdmin) fetchData(); }, [auth.isAdmin, fetchData]);

  /* ── Global KPIs ── */
  const gTotal  = Object.values(summary).reduce((a, c) => a + c.total, 0);
  const gNew    = Object.values(summary).reduce((a, c) => a + c.new,   0);
  const gOpen   = Object.values(summary).reduce((a, c) => a + c.open,  0);
  const gHigh   = Object.values(summary).reduce((a, c) => a + c.high,  0);
  const gClosed = Object.values(summary).reduce((a, c) => a + c.closed, 0);
  const closeRate = gTotal > 0 ? Math.round((gClosed / gTotal) * 100) : 0;

  /* ── Monthly trend ── */
  const trendEntries = useMemo(() => {
    return Object.entries(monthlyTrend).map(([month, d]) => ({ month: month.split(' ')[0], ...d }));
  }, [monthlyTrend]);
  const trendMax = useMemo(() => Math.max(...trendEntries.map(t => t.total), 1), [trendEntries]);

  /* ── Sorted companies ── */
  const sortedCompanies = useMemo(() => {
    return Object.entries(summary)
      .map(([id, s]) => ({ id, ...s, company: COMPANIES.find(c => c.id === id) }))
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return b.overdue - a.overdue;
        if (a.open !== b.open) return b.open - a.open;
        if (a.high !== b.high) return b.high - a.high;
        return b.total - a.total;
      });
  }, [summary, COMPANIES]);

  /* ── Filtered reports (Improvement #1) ── */
  const filteredReports = useMemo(() => {
    let reports = allReports;
    if (searchText) {
      const q = searchText.toLowerCase();
      reports = reports.filter(r =>
        (r.report_no || '').toLowerCase().includes(q) ||
        (r.reporter_name || '').toLowerCase().includes(q) ||
        (r.company_id || '').toLowerCase().includes(q) ||
        (COMPANIES.find(c => c.id === r.company_id)?.shortName || '').toLowerCase().includes(q)
      );
    }
    if (filterCompany) reports = reports.filter(r => r.company_id === filterCompany);
    if (filterRisk) reports = reports.filter(r => r.risk_level === filterRisk);
    if (filterStatus) reports = reports.filter(r => r.status === filterStatus);
    return reports;
  }, [allReports, searchText, filterCompany, filterRisk, filterStatus, COMPANIES]);

  /* ── Unique companies in reports for filter dropdown ── */
  const reportCompanyIds = useMemo(() => Array.from(new Set(allReports.map(r => r.company_id))).sort(), [allReports]);

  /* ── Bulk select helpers (Improvement #6) ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map(r => r.id)));
    }
  };
  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id =>
        fetch(`/api/nearmiss/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bulkStatus }),
        })
      ));
      setSelectedIds(new Set());
      setBulkStatus('');
      fetchData();
    } catch { /* ignore */ } finally { setBulkUpdating(false); }
  };

  /* ── Export Excel (Improvement #5) ── */
  const handleExport = async () => {
    try {
      const res = await fetch('/api/nearmiss/admin/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `near-miss-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  /* ── Auth gate ── */
  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={48} color="#F28E2B" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>สิทธิ์ Admin เท่านั้น</h2>
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

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Near Miss — ภาพรวมทุกบริษัท</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>รายงานเหตุการณ์เกือบอุบัติเหตุจากทุกบริษัทในเครือ</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleExport}
                className="glass-card"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={14} /> Export Excel
              </button>
              <button onClick={fetchData}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <RefreshCw size={14} /> รีเฟรช
              </button>
            </div>
          </div>

          {/* ── KPI Row — glass-card style (Improvement #3) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label="เกินกำหนด (>14 วัน)" value={gOverdue} icon={<AlertCircle size={18} />}
              severity={gOverdue > 0 ? 'critical' : 'ok'} sub={gOverdue > 0 ? 'ต้อง action ด่วน!' : 'ไม่มี — ดี'} />
            <KpiCard label="ค้างดำเนินการ" value={gOpen} icon={<Clock size={18} />}
              severity={gOpen > gTotal * 0.5 ? 'warning' : 'muted'} sub={`${gTotal > 0 ? Math.round((gOpen / gTotal) * 100) : 0}% ของทั้งหมด`} />
            <KpiCard label="ความเสี่ยงสูง" value={gHigh} icon={<AlertTriangle size={18} />}
              severity={gHigh > 0 ? 'critical' : 'ok'} sub={gHigh > 0 ? `${gHigh} จาก ${gTotal} รายการ` : 'ไม่มี'} />
            <KpiCard label="รายงานใหม่" value={gNew} icon={<TrendingUp size={18} />}
              severity={gNew > 5 ? 'warning' : 'muted'} sub="รอตรวจสอบ" />
            <KpiCard label="อัตราปิดเรื่อง" value={closeRate} valueSuffix="%" icon={closeRate >= 80 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              severity={closeRate >= 80 ? 'ok' : closeRate >= 50 ? 'muted' : 'warning'} sub={`${gClosed}/${gTotal} ปิดแล้ว`} />
          </div>

          {/* ── Monthly Trend Chart — Collapsible (Improvement #2) ── */}
          {trendEntries.length > 0 && tab === 'overview' && (
            <div className="glass-card" style={{ marginBottom: 24, borderRadius: 20, border: '1px solid var(--border)' }}>
              <button onClick={() => setChartOpen(!chartOpen)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: chartOpen ? '1px solid var(--border)' : 'none' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>แนวโน้ม Near Miss รายเดือน</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>12 เดือนล่าสุด — แท่งสีแดงคือระดับ HIGH</p>
                </div>
                {chartOpen ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
              </button>
              {chartOpen && (
                <div style={{ padding: '16px 20px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
                    {trendEntries.map((t, i) => {
                      const barH = trendMax > 0 ? Math.max((t.total / trendMax) * 100, 4) : 4;
                      const highH = t.total > 0 ? (t.high / t.total) * barH : 0;
                      const isCurrentMonth = i === trendEntries.length - 1;
                      return (
                        <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                          title={`${t.month}: ทั้งหมด ${t.total}, HIGH ${t.high}, ปิดแล้ว ${t.closed}`}>
                          {t.total > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: t.high > 0 ? '#C23B22' : 'var(--text-secondary)' }}>{t.total}</span>
                          )}
                          <div style={{ width: '100%', maxWidth: 36, height: barH, borderRadius: 4, overflow: 'hidden', position: 'relative',
                            background: isCurrentMonth ? 'rgba(78,121,167,0.25)' : 'rgba(186,176,172,0.2)' }}>
                            {highH > 0 && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(highH / barH) * 100}%`, background: '#C23B22', borderRadius: '0 0 4px 4px' }} />
                            )}
                          </div>
                          <span style={{ fontSize: 9, color: isCurrentMonth ? 'var(--accent)' : 'var(--muted)', fontWeight: isCurrentMonth ? 700 : 400 }}>{t.month}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(186,176,172,0.2)', display: 'inline-block' }} /> ทั้งหมด
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#C23B22' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#C23B22', display: 'inline-block' }} /> HIGH risk
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(78,121,167,0.25)', display: 'inline-block' }} /> เดือนปัจจุบัน
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {(['overview', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s' }}>
                {t === 'overview' ? '📊 ภาพรวมรายบริษัท' : '📋 รายการทั้งหมด'}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p>กำลังโหลด...</p>
            </div>
          ) : tab === 'overview' ? (
            /* ══ OVERVIEW TAB — Company Cards ══ */
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                เรียงตามความเร่งด่วน — เกินกำหนด &gt; ค้างดำเนินการ &gt; ความเสี่ยงสูง
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {sortedCompanies.map(cs => {
                  const co = cs.company;
                  if (!co) return null;
                  const hasUrgency = cs.overdue > 0;
                  const hasWarning = cs.high > 0 || cs.open > cs.total * 0.6;
                  return (
                    <div key={cs.id} className="glass-card"
                      onClick={() => router.push(`/company/${cs.id}/nearmiss`)}
                      style={{
                        padding: 18, borderRadius: 20, cursor: 'pointer', transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s',
                        border: hasUrgency ? '2px solid #C23B22' : hasWarning ? '2px solid #F28E2B' : '1px solid var(--border)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{co.group || co.bu}</p>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{co.shortName || co.name}</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasUrgency && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#C23B22', padding: '2px 8px', borderRadius: 9999, background: 'rgba(194,59,34,0.1)' }}>
                              เกินกำหนด {cs.overdue}
                            </span>
                          )}
                          <ChevronRight size={16} color="var(--text-secondary)" />
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>ปิดแล้ว {cs.closed}/{cs.total}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cs.total > 0 ? (cs.closed / cs.total >= 0.8 ? '#2B8C3E' : '#F28E2B') : 'var(--muted)' }}>
                            {cs.total > 0 ? Math.round((cs.closed / cs.total) * 100) : 0}%
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(186,176,172,0.15)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${cs.total > 0 ? (cs.closed / cs.total) * 100 : 0}%`,
                            background: cs.closed / cs.total >= 0.8 ? '#2B8C3E' : '#F28E2B', transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
                        </div>
                      </div>
                      {/* Mini stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        <MiniStat label="ทั้งหมด" value={cs.total} color="var(--text-secondary)" muted />
                        <MiniStat label="ใหม่" value={cs.new} color={cs.new > 0 ? '#4E79A7' : 'var(--text-secondary)'} muted={cs.new === 0} />
                        <MiniStat label="HIGH" value={cs.high} color={cs.high > 0 ? '#C23B22' : 'var(--text-secondary)'} muted={cs.high === 0} />
                        <MiniStat label="ปิดแล้ว" value={cs.closed} color={cs.closed > 0 ? '#2B8C3E' : 'var(--text-secondary)'} muted={cs.closed === 0} />
                      </div>
                      {cs.latest && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '10px 0 0' }}>ล่าสุด: {timeAgo(cs.latest)}</p>
                      )}
                    </div>
                  );
                })}
                {Object.keys(summary).length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                    <Building2 size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p>ยังไม่มีรายงาน Near Miss จากบริษัทใด</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ══ ALL TAB — Table with Search/Filter/Bulk (Improvements #1, #4, #6) ══ */
            <div>
              {/* ── Search & Filters Bar ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                {/* Search box */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text" placeholder="ค้นหา: หมายเลข, ชื่อผู้รายงาน, บริษัท..."
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  {searchText && (
                    <button onClick={() => setSearchText('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                {/* Company filter */}
                <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">ทุกบริษัท</option>
                  {reportCompanyIds.map(id => {
                    const co = COMPANIES.find(c => c.id === id);
                    return <option key={id} value={id}>{co?.shortName || id}</option>;
                  })}
                </select>
                {/* Risk filter */}
                <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">ทุกระดับเสี่ยง</option>
                  {Object.entries(RISK_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {/* Status filter */}
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">ทุกสถานะ</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {/* ── Bulk Action Bar (Improvement #6) ── */}
              {selectedIds.size > 0 && (
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 12, marginBottom: 12, border: '1px solid var(--accent)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    เลือก {selectedIds.size} รายการ
                  </span>
                  <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 12, color: 'var(--text-primary)' }}>
                    <option value="">เปลี่ยนสถานะเป็น...</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={handleBulkUpdate} disabled={!bulkStatus || bulkUpdating}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: bulkStatus ? 'var(--accent)' : 'var(--bg-tertiary)', color: bulkStatus ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: bulkStatus ? 'pointer' : 'default' }}>
                    {bulkUpdating ? 'กำลังอัปเดต...' : 'อัปเดต'}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
                    ยกเลิก
                  </button>
                </div>
              )}

              {/* ── Result count ── */}
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {filteredReports.length === totalAll
                  ? `รายการทั้งหมด ${totalAll} รายการ`
                  : `แสดง ${filteredReports.length} จาก ${totalAll} รายการ`
                }
              </p>

              {/* ── Table ── */}
              <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>
                        <th style={{ padding: '10px 8px', width: 36 }}>
                          <button onClick={toggleSelectAll} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                            {selectedIds.size === filteredReports.length && filteredReports.length > 0 ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} />}
                          </button>
                        </th>
                        {['หมายเลข', 'บริษัท', 'วันที่', 'ผู้รายงาน', 'ความเสี่ยง', 'สถานะ', 'รับเรื่อง'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map(r => {
                        const risk = RISK_CONFIG[r.risk_level] || RISK_CONFIG.LOW;
                        const st   = STATUS_CONFIG[r.status] || STATUS_CONFIG.new;
                        const co   = COMPANIES.find(c => c.id === r.company_id);
                        const isSelected = selectedIds.has(r.id);
                        return (
                          <tr key={r.id}
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s',
                              background: isSelected ? 'rgba(78,121,167,0.06)' : 'transparent' }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '10px 8px' }} onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                              {isSelected ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} color="var(--muted)" />}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}
                              onClick={() => setSelectedReport(r)}>{r.report_no || '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                              onClick={() => setSelectedReport(r)}>{co?.shortName || r.company_id}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}
                              onClick={() => setSelectedReport(r)}>{fmtDate(r.incident_date)}</td>
                            <td style={{ padding: '10px 12px' }}
                              onClick={() => setSelectedReport(r)}>{r.reporter_name}</td>
                            <td style={{ padding: '10px 12px' }} onClick={() => setSelectedReport(r)}>
                              <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color }}>{risk.label}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }} onClick={() => setSelectedReport(r)}>
                              <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                              onClick={() => setSelectedReport(r)}>{fmtDate(r.created_at)}</td>
                          </tr>
                        );
                      })}
                      {filteredReports.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                            <Search size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                            <p style={{ margin: 0 }}>ไม่พบรายการที่ตรงกับเงื่อนไข</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ Report Detail Drawer (Improvement #4) ══ */}
      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setSelectedReport(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100%', overflowY: 'auto',
            background: 'var(--card-solid)', boxShadow: 'var(--shadow-xl)', animation: 'slideInRight 0.2s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <ReportDrawer report={selectedReport} companies={COMPANIES} onClose={() => setSelectedReport(null)} onUpdate={() => { setSelectedReport(null); fetchData(); }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/* ── Report Detail Drawer (Improvement #4) ── */
/* ══════════════════════════════════════════════════════ */
function ReportDrawer({ report, companies, onClose, onUpdate }: {
  report: AllReport;
  companies: { id: string; shortName?: string; name: string }[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [status, setStatus] = useState(report.status);
  const [saving, setSaving] = useState(false);
  const co = companies.find(c => c.id === report.company_id);
  const risk = RISK_CONFIG[report.risk_level] || RISK_CONFIG.LOW;
  const st = STATUS_CONFIG[report.status] || STATUS_CONFIG.new;

  const handleSave = async () => {
    if (status === report.status) return;
    setSaving(true);
    try {
      await fetch(`/api/nearmiss/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onUpdate();
    } catch { alert('อัปเดตไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const Field = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    value ? (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <span style={{ flexShrink: 0, color: 'var(--muted)', marginTop: 2 }}>{icon}</span>
        <div>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{value}</p>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px', fontFamily: 'monospace' }}>{report.report_no}</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{co?.shortName || report.company_id}</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color }}>
              {risk.label} ({report.risk_score})
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
              {st.label}
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        <Field icon={<Calendar size={14} />} label="วันที่เกิดเหตุ" value={fmtDate(report.incident_date)} />
        <Field icon={<MapPin size={14} />} label="สถานที่" value={report.location || ''} />
        <Field icon={<FileText size={14} />} label="รายละเอียดเหตุการณ์" value={report.incident_description || ''} />
        <Field icon={<AlertTriangle size={14} />} label="ปัจจัยป้องกัน (Saving Factor)" value={report.saving_factor || ''} />
        <Field icon={<CheckSquare size={14} />} label="การดำเนินการทันที" value={report.immediate_action || ''} />

        {/* Risk matrix info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, padding: 12, borderRadius: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px', textTransform: 'uppercase' }}>โอกาสเกิด</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{report.probability || '—'}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px', textTransform: 'uppercase' }}>ความรุนแรง</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{report.severity || '—'}</p>
          </div>
        </div>

        <Field icon={<Building2 size={14} />} label="ผู้รับผิดชอบ" value={report.responsible_person || ''} />
        <Field icon={<Clock size={14} />} label="กำหนดเสร็จ" value={report.due_date ? fmtDate(report.due_date) : ''} />
        <Field icon={<Search size={14} />} label="ผู้ตรวจสอบ / Safety Officer" value={report.safety_officer || ''} />

        {/* ── Status changer ── */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>เปลี่ยนสถานะ</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={status} onChange={e => setStatus(e.target.value as AllReport['status'])}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', fontSize: 13, color: 'var(--text-primary)' }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={handleSave} disabled={status === report.status || saving}
              style={{ padding: '8px 18px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600, cursor: status !== report.status ? 'pointer' : 'default',
                background: status !== report.status ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: status !== report.status ? '#fff' : 'var(--muted)' }}>
              {saving ? '...' : 'บันทึก'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>
          รับเรื่อง: {fmtDate(report.created_at)} &middot; ผู้รายงาน: {report.reporter_name} ({report.reporter_dept || '—'})
        </p>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════ */
/* ── KPI Card — glass-card aligned (Improvement #3) ── */
/* ══════════════════════════════════════════════════════ */
function KpiCard({ label, value, valueSuffix, icon, severity, sub }: {
  label: string; value: number; valueSuffix?: string;
  icon: React.ReactNode; severity: 'critical' | 'warning' | 'ok' | 'muted'; sub?: string;
}) {
  const colors = {
    critical: { fg: '#C23B22', bg: 'rgba(194,59,34,0.05)', border: 'rgba(194,59,34,0.25)', iconBg: 'rgba(194,59,34,0.12)' },
    warning:  { fg: '#F28E2B', bg: 'rgba(242,142,43,0.04)', border: 'rgba(242,142,43,0.25)', iconBg: 'rgba(242,142,43,0.12)' },
    ok:       { fg: '#2B8C3E', bg: 'rgba(43,140,62,0.04)',  border: 'rgba(43,140,62,0.2)',  iconBg: 'rgba(43,140,62,0.12)' },
    muted:    { fg: 'var(--text-secondary)', bg: 'var(--card-solid, var(--bg-secondary))', border: 'var(--border)', iconBg: 'rgba(186,176,172,0.1)' },
  };
  const c = colors[severity];

  return (
    <div className="glass-card" style={{ padding: 16, borderRadius: 20, border: `1px solid ${c.border}`, background: c.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.fg, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c.fg, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}{valueSuffix || ''}
      </div>
      {sub && (
        <p style={{ fontSize: 10, color: severity === 'critical' ? '#C23B22' : 'var(--muted)', margin: '4px 0 0', fontWeight: severity === 'critical' ? 600 : 400 }}>{sub}</p>
      )}
    </div>
  );
}

/* ── MiniStat ── */
function MiniStat({ label, value, color, muted }: { label: string; value: number; color: string; muted?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 10, background: 'var(--bg-primary)', opacity: muted ? 0.5 : 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
