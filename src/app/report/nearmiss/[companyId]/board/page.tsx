'use client';

/**
 * Public Employee Board — /report/nearmiss/[companyId]/board
 * - No login required
 * - Read-only, sanitized data only
 * - noindex (added via meta tags)
 * - Shows: report_no, date, location, risk, status, coordinator, due date
 * - Hides: reporter name/dept, incident detail, admin notes, images
 */

import { useState, useEffect } from 'react';
import { fmtDateDDMMMYY } from '@/components/DateInput';
import { useParams } from 'next/navigation';
import { COMPANIES } from '@/lib/companies';
import { RefreshCw, Loader2, AlertTriangle, Link2, ClipboardList, BookOpen } from 'lucide-react';

// ── Status config (5-step) ──
const STATUS = {
  new:            { label: 'รายงานใหม่',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  dot: '#3b82f6' },
  acknowledged:   { label: 'รับเรื่องแล้ว',   color: '#eab308', bg: 'rgba(234,179,8,0.1)',   dot: '#eab308' },
  in_progress:    { label: 'กำลังดำเนินการ',  color: '#f97316', bg: 'rgba(249,115,22,0.1)',  dot: '#f97316' },
  pending_review: { label: 'รอตรวจสอบ',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  dot: '#8b5cf6' },
  closed:         { label: 'ปิดรายการ',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   dot: '#22c55e' },
} as const;

const RISK = {
  HIGH:     { emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'MED-HIGH': { emoji: '🟠', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  MEDIUM:   { emoji: '🟡', color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  LOW:      { emoji: '🟢', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
} as const;

interface BoardReport {
  id: string;
  report_no: string;
  incident_date: string;
  location: string;
  risk_level: keyof typeof RISK;
  risk_score: number;
  status: keyof typeof STATUS;
  coordinator: string | null;
  due_date: string | null;
  last_action_at: string;
  created_at: string;
  incident_summary: string | null;
}

function fmtDate(d: string) { return fmtDateDDMMMYY(d, 'th'); }

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'closed') return false;
  return new Date(due) < new Date();
}

export default function EmployeeBoardPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const company = COMPANIES.find(c => c.id === companyId);

  const [reports, setReports] = useState<BoardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [copied, setCopied] = useState(false);

  const fetchBoard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nearmiss/board?companyId=${companyId}`);
      const json = await res.json();
      setReports(json.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchBoard(); }, [companyId]);

  const filtered = reports.filter(r => {
    if (filterStatus === 'open') return r.status !== 'closed';
    if (filterStatus === 'closed') return r.status === 'closed';
    if (filterStatus === 'overdue') return isOverdue(r.due_date, r.status);
    return true;
  });

  const countOpen     = reports.filter(r => r.status !== 'closed').length;
  const countNew      = reports.filter(r => r.status === 'new').length;
  const countOverdue  = reports.filter(r => isOverdue(r.due_date, r.status)).length;
  const countClosed   = reports.filter(r => r.status === 'closed').length;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!company) {
    return (
      <div style={pageWrap}>
        <p style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>ไม่พบข้อมูลบริษัท</p>
      </div>
    );
  }

  return (
    <>
      {/* noindex */}
      <meta name="robots" content="noindex,nofollow" />

      <div style={pageWrap}>
        {/* ── Header ── */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>Near Miss Board</h1>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{company.name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: '#007aff', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}>
                <ClipboardList size={14} /> รายงาน Near Miss
              </button>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}/handbook`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, color: '#6366f1', cursor: 'pointer' }}>
                <BookOpen size={13} /> คู่มือ
              </button>
              <button onClick={copyLink}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <Link2 size={13} /> {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
              </button>
              <button onClick={fetchBoard}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#f1f5f9', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(0,122,255,0.06)', borderRadius: 10, borderLeft: '3px solid #007aff' }}>
            <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
              📋 หน้านี้แสดงสถานะรายงาน Near Miss ของ{company.name} — ข้อมูลผู้รายงานถูกปกปิดเพื่อความปลอดภัย
            </p>
          </div>

          {/* ── KPI strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'ค้างดำเนินการ', value: countOpen,   color: '#f97316', active: filterStatus === 'open',    key: 'open' },
              { label: 'รายงานใหม่',   value: countNew,    color: '#3b82f6', active: filterStatus === 'new',     key: 'new' },
              { label: 'เกินกำหนด',   value: countOverdue, color: '#ef4444', active: filterStatus === 'overdue', key: 'overdue' },
              { label: 'ปิดแล้ว',      value: countClosed, color: '#22c55e', active: filterStatus === 'closed',  key: 'closed' },
            ].map(k => (
              <button key={k.key} onClick={() => setFilterStatus(prev => prev === k.key ? '' : k.key)}
                style={{ padding: '12px 10px', borderRadius: 12, border: `2px solid ${k.active ? k.color : '#e5e7eb'}`, background: k.active ? `${k.color}12` : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: k.active ? k.color : '#6b7280', fontWeight: k.active ? 700 : 400, marginTop: 2 }}>{k.label}</div>
              </button>
            ))}
          </div>

          {/* ── Status pill filters ── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilterStatus('')}
              style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterStatus === '' ? '#111827' : '#e5e7eb'}`, background: filterStatus === '' ? '#111827' : '#fff', color: filterStatus === '' ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ทั้งหมด ({reports.length})
            </button>
            {(Object.entries(STATUS) as [keyof typeof STATUS, typeof STATUS[keyof typeof STATUS]][]).map(([key, cfg]) => {
              const count = reports.filter(r => r.status === key).length;
              if (count === 0) return null;
              return (
                <button key={key} onClick={() => setFilterStatus(prev => prev === key ? '' : key)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterStatus === key ? cfg.color : '#e5e7eb'}`, background: filterStatus === key ? cfg.bg : '#fff', color: filterStatus === key ? cfg.color : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: cfg.dot, marginRight: 5 }} />
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Report list ── */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 88px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14 }}>กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                {filterStatus === 'open' ? 'ไม่มีรายการค้างดำเนินการ' : filterStatus === 'overdue' ? 'ไม่มีรายการเกินกำหนด' : 'ไม่มีรายการ'}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                {filterStatus === 'open' ? 'ทุกรายการได้รับการดูแลแล้ว' : 'ลองเปลี่ยนตัวกรอง'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(r => {
                const st  = STATUS[r.status] || STATUS.new;
                const rsk = RISK[r.risk_level] || RISK.LOW;
                const overdue = isOverdue(r.due_date, r.status);
                const age = daysSince(r.created_at);
                return (
                  <div key={r.id} style={{
                    padding: '14px 16px', borderRadius: 14,
                    border: `1.5px solid ${overdue ? 'rgba(239,68,68,0.35)' : '#e5e7eb'}`,
                    background: overdue ? 'rgba(239,68,68,0.03)' : '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>{r.report_no}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: rsk.bg, color: rsk.color }}>
                          {rsk.emoji} {r.risk_level} ({r.risk_score})
                        </span>
                        {overdue && (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            ⏰ เกินกำหนด
                          </span>
                        )}
                      </div>
                      {/* Status pill */}
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: st.dot, marginRight: 5 }} />
                        {st.label}
                      </span>
                    </div>

                    {/* Location + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: r.incident_summary ? 8 : 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>📍 {r.location}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.incident_date)}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{age === 0 ? 'วันนี้' : `${age} วันที่แล้ว`}</span>
                    </div>

                    {/* Summary (truncated) */}
                    {r.incident_summary && (
                      <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 8px', lineHeight: 1.5 }}>{r.incident_summary}</p>
                    )}

                    {/* Bottom meta row */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                      {r.coordinator && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          👤 <strong style={{ color: '#374151' }}>{r.coordinator}</strong>
                        </span>
                      )}
                      {r.due_date && (
                        <span style={{ fontSize: 12, color: overdue ? '#ef4444' : '#6b7280', fontWeight: overdue ? 700 : 400 }}>
                          📅 กำหนด: {fmtDate(r.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '0 20px 24px', fontSize: 11, color: '#d1d5db' }}>
          รายงานฉบับนี้เป็นข้อมูลภายในองค์กรเท่านั้น • ข้อมูลผู้รายงานถูกปกปิดทั้งหมด
        </div>
      </div>

      {/* ── Sticky CTA bar for mobile ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: '#007aff', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,122,255,0.3)', width: '100%', maxWidth: 400, justifyContent: 'center' }}>
          <ClipboardList size={16} /> แจ้ง Near Miss ใหม่
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
};
