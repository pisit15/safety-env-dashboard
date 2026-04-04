'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, ExternalLink,
  RefreshCw, Loader2, ChevronRight, Building2,
} from 'lucide-react';

interface CompanySummary {
  total: number;
  new: number;
  open: number;
  closed: number;
  high: number;
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

const RISK_CONFIG = {
  HIGH:     { label: 'HIGH',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  emoji: '🔴' },
  'MED-HIGH': { label: 'MED-HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)', emoji: '🟠' },
  MEDIUM:   { label: 'MEDIUM',   color: '#eab308', bg: 'rgba(234,179,8,0.1)',  emoji: '🟡' },
  LOW:      { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  emoji: '🟢' },
};

const STATUS_CONFIG = {
  new:           { label: 'รายงานใหม่',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  investigating:  { label: 'กำลังสอบสวน',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  action_taken:   { label: 'ดำเนินการแล้ว', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  closed:         { label: 'ปิดแล้ว',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

function fmtDate(d: string) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
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

  const [tab, setTab] = useState<'overview' | 'all'>('overview');
  const [summary, setSummary] = useState<Record<string, CompanySummary>>({});
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
      } else {
        const res = await fetch('/api/nearmiss/admin?view=all&limit=200');
        const json = await res.json();
        setAllReports(json.data || []);
        setTotalAll(json.total || 0);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { if (auth.isAdmin) fetchData(); }, [auth.isAdmin, tab]);

  // Global KPIs across all companies
  const gTotal  = Object.values(summary).reduce((a, c) => a + c.total, 0);
  const gNew    = Object.values(summary).reduce((a, c) => a + c.new,   0);
  const gOpen   = Object.values(summary).reduce((a, c) => a + c.open,  0);
  const gHigh   = Object.values(summary).reduce((a, c) => a + c.high,  0);

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

          {/* Global KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <GKpi label="รายงานทั้งหมด" value={gTotal} icon={<AlertTriangle size={18} />} color="#6366f1" />
            <GKpi label="รายงานใหม่" value={gNew} icon={<Clock size={18} />} color="#3b82f6" />
            <GKpi label="ค้างดำเนินการ" value={gOpen} icon={<TrendingUp size={18} />} color="#f59e0b" />
            <GKpi label="ความเสี่ยงสูง" value={gHigh} icon={<AlertTriangle size={18} />} color="#ef4444" />
          </div>

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
            /* Company cards */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {COMPANIES.map(company => {
                const s = summary[company.id];
                if (!s) return null;
                return (
                  <div key={company.id}
                    onClick={() => router.push(`/company/${company.id}/nearmiss`)}
                    style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = ''; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 600 }}>{company.group || company.bu}</p>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{company.shortName || company.name}</h3>
                      </div>
                      <ChevronRight size={16} color="var(--text-secondary)" />
                    </div>
                    {/* Mini stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      <MiniStat label="ทั้งหมด" value={s.total} color="#6366f1" />
                      <MiniStat label="ใหม่" value={s.new} color="#3b82f6" />
                      <MiniStat label="HIGH" value={s.high} color="#ef4444" />
                      <MiniStat label="ปิดแล้ว" value={s.closed} color="#22c55e" />
                    </div>
                    {s.latest && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12, margin: '12px 0 0' }}>
                        ล่าสุด: {timeAgo(s.latest)}
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
          ) : (
            /* All reports table */
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
                              {risk.emoji} {risk.label}
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

function GKpi({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--bg-primary)' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
