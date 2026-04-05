'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR } from '@/lib/companies';
import {
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───
interface TrainingPlan {
  id: string;
  course_name: string;
  planned_month: number;
  status?: string;
  training_sessions?: { status: string; scheduled_date_start?: string }[];
}

interface IncidentSummary {
  total_incidents: number;
  total_injuries: number;
  total_lti: number;
  total_near_misses: number;
  monthly_breakdown?: { month: number; count: number }[];
}

interface ManhourRow {
  month: number;
  employee_manhours: number;
  contractor_manhours: number;
  employee_count: number;
  contractor_count: number;
}

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function CompanyDashboard() {
  const { id } = useParams() as { id: string };
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);
  const year = DEFAULT_YEAR;

  // DB settings
  const [dbSheetId, setDbSheetId] = useState<string | null>(null);
  const [dbCompanyName, setDbCompanyName] = useState('');
  // KPI data
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary | null>(null);
  const [manhours, setManhours] = useState<ManhourRow[]>([]);
  const [actionPlanPct, setActionPlanPct] = useState<number | null>(null);
  const [actionPlanTotal, setActionPlanTotal] = useState(0);
  const [actionPlanDone, setActionPlanDone] = useState(0);
  const [actionPlanOverdue, setActionPlanOverdue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const hasSheet = !!(dbSheetId || company?.sheetId);
  const companyName = dbCompanyName || company?.shortName || id.toUpperCase();
  const fullName = company?.fullName || '';

  // Fetch all data in parallel
  useEffect(() => {
    setLoading(true);
    const fetches = [
      // Company settings
      fetch('/api/company-settings').then(r => r.json()).then(d => {
        const s = (d.settings || []).find((s: { company_id: string }) => s.company_id === id);
        if (s) { setDbSheetId(s.sheet_id || ''); setDbCompanyName(s.company_name || ''); }
      }).catch(() => {}),
      // Training plans
      fetch(`/api/training/plans?companyId=${id}&year=${year}`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setTrainingPlans(d);
      }).catch(() => {}),
      // Incidents summary
      fetch(`/api/incidents?companyId=${id}&year=${year}&mode=summary`).then(r => r.json()).then(d => {
        if (d && typeof d.total_incidents === 'number') setIncidentSummary(d);
      }).catch(() => {}),
      // Manhours
      fetch(`/api/manhours?companyId=${id}&year=${year}`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setManhours(d);
      }).catch(() => {}),
      // Action plan (dashboard API for this company)
      fetch(`/api/dashboard?plan=total&year=${year}`).then(r => r.json()).then(d => {
        if (d?.companies) {
          const comp = d.companies.find((c: { companyId: string }) => c.companyId === id);
          if (comp) {
            setActionPlanPct(comp.pctDone || 0);
            setActionPlanTotal(comp.total || 0);
            setActionPlanDone(comp.done || 0);
            setActionPlanOverdue(comp.overdueCount || 0);
          }
        }
      }).catch(() => {}),
    ];
    Promise.allSettled(fetches).then(() => {
      setLoading(false);
      setLastUpdated(new Date());
    });
  }, [id, year]);

  // Computed KPIs
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Training stats
  const totalCourses = trainingPlans.length;
  const completedCourses = trainingPlans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
  const thisMonthTraining = trainingPlans.filter(p => p.planned_month === currentMonth).length;
  const scheduledThisMonth = trainingPlans.filter(p => p.planned_month === currentMonth && p.training_sessions?.[0]?.status === 'scheduled').length;
  const overdueTraining = trainingPlans.filter(p => {
    const s = p.training_sessions?.[0]?.status;
    return p.planned_month < currentMonth && s !== 'completed' && s !== 'cancelled';
  }).length;

  // Manhours stats
  const latestManhour = manhours.sort((a, b) => b.month - a.month)[0];
  const totalManhours = manhours.reduce((sum, m) => sum + (m.employee_manhours || 0) + (m.contractor_manhours || 0), 0);

  // Pending actions
  const pendingItems: { label: string; detail: string; color: string; href: string; priority: number }[] = [];
  if (actionPlanOverdue > 0) pendingItems.push({ label: 'แผนงานเกินกำหนด', detail: `${actionPlanOverdue} กิจกรรม`, color: '#dc2626', href: `/company/${id}/action-plan`, priority: 1 });
  if (overdueTraining > 0) pendingItems.push({ label: 'อบรมค้างจัดตามแผน', detail: `${overdueTraining} หลักสูตร`, color: '#f59e0b', href: `/company/${id}/training`, priority: 2 });
  if (scheduledThisMonth > 0) pendingItems.push({ label: `อบรมที่กำหนดเดือน ${MONTH_LABELS[currentMonth - 1]}`, detail: `${scheduledThisMonth} หลักสูตร`, color: '#3b82f6', href: `/company/${id}/training`, priority: 3 });
  if (incidentSummary && incidentSummary.total_incidents > 0) pendingItems.push({ label: 'อุบัติเหตุสะสมปีนี้', detail: `${incidentSummary.total_incidents} ครั้ง`, color: '#dc2626', href: `/company/${id}/incidents`, priority: 4 });
  pendingItems.sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ padding: 'clamp(16px, 3vw, 24px) clamp(12px, 3vw, 28px) 40px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              {companyName}
            </h1>
            {fullName && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {lastUpdated && (
              <span style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={10} /> {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ปี {year}
            </span>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
          {/* Action Plan Progress */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>แผนงานประจำปี</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,122,255,0.08)' }}>
                <ClipboardList size={14} style={{ color: '#007aff' }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {loading ? '—' : actionPlanPct !== null ? `${actionPlanPct}%` : 'ไม่มีข้อมูล'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {actionPlanTotal > 0 ? `สำเร็จ ${actionPlanDone} / ${actionPlanTotal} กิจกรรม` : 'ยังไม่มีแผนงาน'}
            </div>
            {actionPlanTotal > 0 && (
              <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${actionPlanPct || 0}%`, background: (actionPlanPct || 0) >= 70 ? '#16a34a' : (actionPlanPct || 0) >= 40 ? '#f59e0b' : '#dc2626', transition: 'width 0.5s ease' }} />
              </div>
            )}
          </div>

          {/* Training */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>อบรมประจำปี</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(88,86,214,0.08)' }}>
                <GraduationCap size={14} style={{ color: '#5856d6' }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {loading ? '—' : `${completedCourses}/${totalCourses}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              หลักสูตรอบรมแล้ว{thisMonthTraining > 0 ? ` • เดือนนี้ ${thisMonthTraining} หลักสูตร` : ''}
            </div>
            {totalCourses > 0 && (
              <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.round((completedCourses / totalCourses) * 100)}%`, background: '#5856d6', transition: 'width 0.5s ease' }} />
              </div>
            )}
          </div>

          {/* Incidents */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>อุบัติเหตุสะสม</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: incidentSummary && incidentSummary.total_incidents > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' }}>
                {incidentSummary && incidentSummary.total_incidents > 0
                  ? <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                  : <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                }
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: incidentSummary && incidentSummary.total_incidents > 0 ? '#dc2626' : 'var(--text-primary)', lineHeight: 1 }}>
              {loading ? '—' : incidentSummary ? incidentSummary.total_incidents : 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {incidentSummary ? `บาดเจ็บ ${incidentSummary.total_injuries || 0} • LTI ${incidentSummary.total_lti || 0}` : 'ไม่มีอุบัติเหตุ'}
            </div>
          </div>

          {/* Manhours */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>ชั่วโมงทำงานสะสม</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,149,0,0.08)' }}>
                <Clock size={14} style={{ color: '#ff9500' }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {loading ? '—' : totalManhours > 0 ? totalManhours.toLocaleString() : '0'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {latestManhour ? `ล่าสุด ${MONTH_LABELS[latestManhour.month - 1]} • พนักงาน ${latestManhour.employee_count || 0} คน` : 'ยังไม่มีข้อมูล'}
            </div>
          </div>
        </div>

        {/* ── Pending Actions (full width) ── */}
        {pendingItems.length > 0 && (
          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} style={{ color: '#f59e0b' }} /> งานที่ต้องติดตาม
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 8 }}>
              {pendingItems.map((item, i) => (
                <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = item.color; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.detail}</span>
                      <ArrowRight size={12} style={{ color: 'var(--muted)' }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Activity / Training Schedule ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
          {/* Upcoming Training */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarCheck size={14} style={{ color: '#5856d6' }} /> อบรมที่กำลังจะมาถึง
            </h2>
            {(() => {
              const upcoming = trainingPlans
                .filter(p => {
                  const s = p.training_sessions?.[0]?.status;
                  return (p.planned_month >= currentMonth) && s !== 'completed' && s !== 'cancelled';
                })
                .sort((a, b) => a.planned_month - b.planned_month)
                .slice(0, 5);
              if (upcoming.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted)' }}>ไม่มีการอบรมที่รอจัด</p>;
              return upcoming.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#5856d6', background: 'rgba(88,86,214,0.08)', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
                    {MONTH_LABELS[t.planned_month - 1]}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.course_name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                    {t.training_sessions?.[0]?.status === 'scheduled' ? 'กำหนดวันแล้ว' : 'รอกำหนดวัน'}
                  </span>
                </div>
              ));
            })()}
          </div>

          {/* Manhours Trend (mini) */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} style={{ color: '#ff9500' }} /> ชั่วโมงทำงานรายเดือน
            </h2>
            {manhours.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีข้อมูลชั่วโมงทำงาน</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {manhours.sort((a, b) => a.month - b.month).slice(-6).map((m, i) => {
                  const total = (m.employee_manhours || 0) + (m.contractor_manhours || 0);
                  const maxTotal = Math.max(...manhours.map(x => (x.employee_manhours || 0) + (x.contractor_manhours || 0)), 1);
                  const pct = Math.round((total / maxTotal) * 100);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)', width: 32, textAlign: 'right', flexShrink: 0 }}>{MONTH_LABELS[m.month - 1]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #ff9500, #ffb84d)', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', width: 52, textAlign: 'right', flexShrink: 0 }}>{total.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
