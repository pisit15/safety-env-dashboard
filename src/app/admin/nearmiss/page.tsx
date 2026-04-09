'use client';

import { useState, useEffect, useMemo } from 'react';
import { fmtDateDDMMMYY } from '@/components/DateInput';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import {
  AlertTriangle, Clock, TrendingUp, TrendingDown,
  RefreshCw, Loader2, ChevronRight, Building2, AlertCircle,
} from 'lucide-react';

interface CompanySummary {
  total: number;
  new: number;
  open: number;
  closed: number;
  high: number;
  overdue: number;
  latest: string | null;
}
interface AllReport {
  id: string;
  report_no: string;
  company_id: string;
  reporter_name: string;
  incident_date: string;
  location: string;
  risk_level: 'HIGH' | 'MED-HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  status: 'new' | 'investigating' | 'action_taken' | 'closed';
  created_at: string;
}
interface MonthlyTrend {
  total: number;
  high: number;
  closed: number;
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  HIGH:       { label: 'HIGH',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'MED-HIGH': { label: 'MED-HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  MEDIUM:     { label: 'MEDIUM',   color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  LOW:        { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:           { label: 'รายงานใหม่',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  investigating: { label: 'กำลังสอบสวน',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  action_taken:  { label: 'ดำเนินการแล้ว', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  closed:        { label: 'ปิดแล้ว',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

function fmtDate(d: string) { return fmtDateDDMMMYY(d, 'th'); }
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  return `${days} วันที่แล้ว`;
}

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

  const fetchData = async () => {
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
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { if (auth.isAdmin) fetchData(); }, [auth.isAdmin, tab]);

  // Global KPIs
  const gTotal  = Object.values(summary).reduce((a, c) => a + c.total, 0);
  const gNew    = Object.values(summary).reduce((a, c) => a + c.new,   0);
  const gOpen   = Object.values(summary).reduce((a, c) => a + c.open,  0);
  const gHigh   = Object.values(summary).reduce((a, c) => a + c.high,  0);
  const gClosed = Object.values(summary).reduce((a, c) => a + c.closed, 0);
  const closeRate = gTotal > 0 ? Math.round((gClosed / gTotal) * 100) : 0;

  // Monthly trend data for chart
  const trendEntries = useMemo(() => {
    return Object.entries(monthlyTrend).map(([month, d]) => ({ month: month.split(' ')[0], ...d }));
  }, [monthlyTrend]);
  const trendMax = useMemo(() => Math.max(...trendEntries.map(t => t.total), 1), [trendEntries]);

  // Companies sorted by urgency: overdue first, then open, then high
  const sortedCompanies = useMemo(() => {
    return Object.entries(summary)
      .map(([id, s]) => ({ id, ...s, company: COMPANIES.find(c => c.id === id) }))
      .sort((a, b) => {
        // Overdue first
        if (a.overdue !== b.overdue) return b.overdue - a.overdue;
        // Then open
        if (a.open !== b.open) return b.open - a.open;
        // Then high risk
        if (a.high !== b.high) return b.high - a.high;
        return b.total - a.total;
      });
  }, [summary, COMPANIES]);

  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>สิทธิ์ Admin เท่านั้น</h2>
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

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Near Miss — ภาพรวมทุกบริษัท</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>รายงานเหตุการณ์เกือบอุบัติเหตุจากทุกบริษัทในเครือ</p>
            </div>
            <button onClick={fetchData}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#007aff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <RefreshCw size={14} /> รีเฟรช
            </button>
          </div>

          {/* ── KPI Row — Gray+One Strategy ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            {/* Overdue — RED alert, most important */}
            <KpiCard
              label="เกินกำหนด (>14 วัน)"
              value={gOverdue}
              icon={<AlertCircle size={18} />}
              severity={gOverdue > 0 ? 'critical' : 'ok'}
              sub={gOverdue > 0 ? 'ต้อง action ด่วน!' : 'ไม่มี — ดี'}
            />
            {/* Open — AMBER if many */}
            <KpiCard
              label="ค้างดำเนินการ"
              value={gOpen}
              icon={<Clock size={18} />}
              severity={gOpen > gTotal * 0.5 ? 'warning' : 'muted'}
              sub={`${gTotal > 0 ? Math.round((gOpen / gTotal) * 100) : 0}% ของทั้งหมด`}
            />
            {/* High risk — RED if any */}
            <KpiCard
              label="ความเสี่ยงสูง"
              value={gHigh}
              icon={<AlertTriangle size={18} />}
              severity={gHigh > 0 ? 'critical' : 'ok'}
              sub={gHigh > 0 ? `${gHigh} จาก ${gTotal} รายการ` : 'ไม่มี'}
            />
            {/* New reports — BLUE info */}
            <KpiCard
              label="รายงานใหม่"
              value={gNew}
              icon={<TrendingUp size={18} />}
              severity={gNew > 5 ? 'warning' : 'muted'}
              sub="รอตรวจสอบ"
            />
            {/* Close rate — contextual */}
            <KpiCard
              label="อัตราปิดเรื่อง"
              value={closeRate}
              valueSuffix="%"
              icon={closeRate >= 80 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              severity={closeRate >= 80 ? 'ok' : closeRate >= 50 ? 'muted' : 'warning'}
              sub={`${gClosed}/${gTotal} ปิดแล้ว`}
            />
          </div>

          {/* ── Monthly Trend Chart (sparkline-style bar chart) ── */}
          {trendEntries.length > 0 && tab === 'overview' && (
            <div style={{ marginBottom: 24, padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>แนวโน้ม Near Miss รายเดือน</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>12 เดือนล่าสุด — แท่งสีแดงคือระดับ HIGH</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {trendEntries.map((t, i) => {
                  const barH = trendMax > 0 ? Math.max((t.total / trendMax) * 100, 4) : 4;
                  const highH = t.total > 0 ? (t.high / t.total) * barH : 0;
                  const isCurrentMonth = i === trendEntries.length - 1;
                  return (
                    <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {/* Value on top */}
                      {t.total > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: t.high > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                          {t.total}
                        </span>
                      )}
                      {/* Stacked bar */}
                      <div style={{ width: '100%', maxWidth: 36, height: barH, borderRadius: 4, overflow: 'hidden', position: 'relative', background: isCurrentMonth ? 'rgba(59,130,246,0.25)' : 'rgba(107,114,128,0.15)' }}>
                        {highH > 0 && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(highH / barH) * 100}%`, background: '#ef4444', borderRadius: '0 0 4px 4px' }} />
                        )}
                      </div>
                      {/* Month label */}
                      <span style={{ fontSize: 9, color: isCurrentMonth ? '#007aff' : 'var(--muted)', fontWeight: isCurrentMonth ? 700 : 400 }}>
                        {t.month}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(107,114,128,0.15)', display: 'inline-block' }} /> ทั้งหมด
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ef4444' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> HIGH risk
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#007aff' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(59,130,246,0.25)', display: 'inline-block' }} /> เดือนปัจจุบัน
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {(['overview', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  color: tab === t ? '#007aff' : 'var(--text-secondary)',
                  borderBottom: tab === t ? '2px solid #007aff' : '2px solid transparent',
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
            /* ── Company Cards — sorted by urgency ── */
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
                    <div key={cs.id}
                      onClick={() => router.push(`/company/${cs.id}/nearmiss`)}
                      style={{
                        padding: 18, borderRadius: 14, cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s',
                        background: 'var(--card-solid, var(--bg-secondary))',
                        border: hasUrgency ? '2px solid #ef4444' : hasWarning ? '2px solid #f59e0b' : '1px solid var(--border)',
                      }}
                      onMouseEnter={e => { const el = e.currentTarget; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                      onMouseLeave={e => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = ''; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 600 }}>{co.group || co.bu}</p>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{co.shortName || co.name}</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasUrgency && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)' }}>
                              เกินกำหนด {cs.overdue}
                            </span>
                          )}
                          <ChevronRight size={16} color="var(--text-secondary)" />
                        </div>
                      </div>

                      {/* Progress bar: closed vs open */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>ปิดแล้ว {cs.closed}/{cs.total}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cs.total > 0 ? (cs.closed / cs.total >= 0.8 ? '#22c55e' : '#f59e0b') : 'var(--muted)' }}>
                            {cs.total > 0 ? Math.round((cs.closed / cs.total) * 100) : 0}%
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(107,114,128,0.12)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${cs.total > 0 ? (cs.closed / cs.total) * 100 : 0}%`, background: cs.closed / cs.total >= 0.8 ? '#22c55e' : '#f59e0b', transition: 'width 0.3s' }} />
                        </div>
                      </div>

                      {/* Mini stats — meaningful colors */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        <MiniStat label="ทั้งหมด" value={cs.total} color="var(--text-secondary)" muted />
                        <MiniStat label="ใหม่" value={cs.new} color={cs.new > 0 ? '#3b82f6' : 'var(--text-secondary)'} muted={cs.new === 0} />
                        <MiniStat label="HIGH" value={cs.high} color={cs.high > 0 ? '#ef4444' : 'var(--text-secondary)'} muted={cs.high === 0} />
                        <MiniStat label="ปิดแล้ว" value={cs.closed} color={cs.closed > 0 ? '#22c55e' : 'var(--text-secondary)'} muted={cs.closed === 0} />
                      </div>
                      {cs.latest && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, margin: '10px 0 0' }}>
                          ล่าสุด: {timeAgo(cs.latest)}
                        </p>
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
            /* ── All reports table ── */
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>รายการทั้งหมด {totalAll} รายการ (แสดงล่าสุด 200)</p>
              <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['หมายเลข', 'บริษัท', 'วันที่', 'ผู้รายงาน', 'ความเสี่ยง', 'สถานะ', 'รับเรื่อง'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allReports.map(r => {
                      const risk = RISK_CONFIG[r.risk_level] || RISK_CONFIG.LOW;
                      const st   = STATUS_CONFIG[r.status] || STATUS_CONFIG.new;
                      const co   = COMPANIES.find(c => c.id === r.company_id);
                      return (
                        <tr key={r.id}
                          onClick={() => router.push(`/company/${r.company_id}/nearmiss`)}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{r.report_no || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{co?.shortName || r.company_id}</td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(r.incident_date)}</td>
                          <td style={{ padding: '10px 12px' }}>{r.reporter_name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: risk.bg, color: risk.color }}>
                              {risk.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── KPI Card with severity encoding (Gray+One) ── */
function KpiCard({ label, value, valueSuffix, icon, severity, sub }: {
  label: string;
  value: number;
  valueSuffix?: string;
  icon: React.ReactNode;
  severity: 'critical' | 'warning' | 'ok' | 'muted';
  sub?: string;
}) {
  const colors = {
    critical: { fg: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.3)', iconBg: 'rgba(239,68,68,0.12)' },
    warning:  { fg: '#f59e0b', bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.3)', iconBg: 'rgba(245,158,11,0.12)' },
    ok:       { fg: '#22c55e', bg: 'rgba(34,197,94,0.04)',  border: 'rgba(34,197,94,0.2)',  iconBg: 'rgba(34,197,94,0.12)' },
    muted:    { fg: 'var(--text-secondary)', bg: 'var(--card-solid, var(--bg-secondary))', border: 'var(--border)', iconBg: 'rgba(107,114,128,0.08)' },
  };
  const c = colors[severity];

  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${c.border}`, background: c.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.fg, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: c.fg, lineHeight: 1 }}>
        {value}{valueSuffix || ''}
      </div>
      {sub && (
        <p style={{ fontSize: 10, color: severity === 'critical' ? '#ef4444' : 'var(--muted)', marginTop: 4, margin: '4px 0 0', fontWeight: severity === 'critical' ? 600 : 400 }}>{sub}</p>
      )}
    </div>
  );
}

/* ── MiniStat — muted when zero ── */
function MiniStat({ label, value, color, muted }: { label: string; value: number; color: string; muted?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--bg-primary)', opacity: muted ? 0.5 : 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
