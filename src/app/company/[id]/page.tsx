'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { DEFAULT_YEAR } from '@/lib/companies';
import { useCompanies } from '@/hooks/useCompanies';
import { STATUS, PALETTE, CATEGORY_COLORS } from '@/lib/she-theme';
import {
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Users,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  FileText,
  Plus,
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
  const { companies: COMPANIES } = useCompanies();
  const company = COMPANIES.find(c => c.id === id);
  const year = DEFAULT_YEAR;

  // DB settings
  const [dbSheetId, setDbSheetId] = useState<string | null>(null);
  const [dbCompanyName, setDbCompanyName] = useState('');
  const [dbFullName, setDbFullName] = useState('');
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
  const fullName = dbFullName || company?.fullName || '';

  // Fetch all data in parallel
  useEffect(() => {
    setLoading(true);
    const fetches = [
      // P1: Filter company-settings to this company only
      fetch(`/api/company-settings?companyId=${id}`).then(r => r.json()).then(d => {
        const s = (d.settings || [])[0];
        if (s) { setDbSheetId(s.sheet_id || ''); setDbCompanyName(s.company_name || ''); setDbFullName(s.full_name || ''); }
      }).catch(() => {}),
      fetch(`/api/training/plans?companyId=${id}&year=${year}&mode=dashboard`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setTrainingPlans(d);
      }).catch(() => {}),
      fetch(`/api/incidents?companyId=${id}&year=${year}&mode=summary`).then(r => r.json()).then(d => {
        if (d && typeof d.total_incidents === 'number') setIncidentSummary(d);
      }).catch(() => {}),
      fetch(`/api/manhours?companyId=${id}&year=${year}`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setManhours(d);
      }).catch(() => {}),
      // P0: Pass companyId to dashboard API — fetches only this company's Google Sheets (not all)
      fetch(`/api/dashboard?plan=total&year=${year}&companyId=${id}`).then(r => r.json()).then(d => {
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
  const currentMonth = now.getMonth() + 1;

  // Training stats
  const totalCourses = trainingPlans.length;
  const completedCourses = trainingPlans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
  const thisMonthTraining = trainingPlans.filter(p => p.planned_month === currentMonth).length;
  const scheduledThisMonth = trainingPlans.filter(p => p.planned_month === currentMonth && p.training_sessions?.[0]?.status === 'scheduled').length;
  const overdueTraining = trainingPlans.filter(p => {
    const s = p.training_sessions?.[0]?.status;
    return p.planned_month < currentMonth && s !== 'completed' && s !== 'cancelled';
  }).length;
  const trainingPct = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  // Manhours stats
  const sortedManhours = [...manhours].sort((a, b) => a.month - b.month);
  const latestManhour = sortedManhours[sortedManhours.length - 1];
  const totalManhours = manhours.reduce((sum, m) => sum + (m.employee_manhours || 0) + (m.contractor_manhours || 0), 0);
  const hasAnyManhourData = manhours.length > 0;
  const currentMonthManhour = manhours.find(m => m.month === currentMonth);
  const prevMonthManhour = manhours.find(m => m.month === currentMonth - 1);

  // Manhours trend
  const currentMH = currentMonthManhour ? (currentMonthManhour.employee_manhours || 0) + (currentMonthManhour.contractor_manhours || 0) : 0;
  const prevMH = prevMonthManhour ? (prevMonthManhour.employee_manhours || 0) + (prevMonthManhour.contractor_manhours || 0) : 0;
  const mhTrend = prevMH > 0 ? Math.round(((currentMH - prevMH) / prevMH) * 100) : null;

  // Incident trend (current month vs previous month)
  const currentMonthIncidents = incidentSummary?.monthly_breakdown?.find(m => m.month === currentMonth)?.count || 0;
  const prevMonthIncidents = incidentSummary?.monthly_breakdown?.find(m => m.month === currentMonth - 1)?.count || 0;
  const incidentTrendDelta = currentMonthIncidents - prevMonthIncidents;
  const incidentTrendPct = prevMonthIncidents > 0 ? Math.round(((incidentTrendDelta / prevMonthIncidents) * 100)) : null;

  // Insight subtitles for KPI cards
  const actionPlanExpected = Math.round((currentMonth / 12) * 100);
  const actionPlanDiff = (actionPlanPct || 0) - actionPlanExpected;
  const actionPlanInsight = actionPlanDiff > 5 ? { text: `เร็วกว่าแผน +${actionPlanDiff}%`, color: STATUS.positive } : actionPlanDiff < -5 ? { text: `ช้ากว่าแผน ${actionPlanDiff}%`, color: STATUS.critical } : { text: 'ตามแผน', color: PALETTE.primary };

  const trainingExpected = Math.round((currentMonth / 12) * totalCourses);
  const trainingDiff = completedCourses - trainingExpected;
  const trainingInsight = trainingDiff > 0 ? { text: `เสร็จเร็ว +${trainingDiff} หลักสูตร`, color: STATUS.positive } : trainingDiff < -1 ? { text: `ล่าช้า ${trainingDiff} หลักสูตร`, color: STATUS.warning } : { text: 'ตามแผน', color: PALETTE.primary };

  // ── Hero: Urgent Action Items ─────────────────────────────────
  const urgentItems: { label: string; count: number; unit: string; color: string; bgColor: string; borderColor: string; href: string; icon: React.ReactNode }[] = [];
  if (actionPlanOverdue > 0) urgentItems.push({
    label: 'แผนงานเกินกำหนด',
    count: actionPlanOverdue, unit: 'กิจกรรม',
    color: `${STATUS.critical}`, bgColor: `${STATUS.critical}10`, borderColor: `${STATUS.critical}33`,
    href: `/company/${id}/action-plan`, icon: <AlertTriangle size={18} style={{ color: `${STATUS.critical}` }} />,
  });
  if (overdueTraining > 0) urgentItems.push({
    label: 'อบรมค้างจัดตามแผน',
    count: overdueTraining, unit: 'หลักสูตร',
    color: `${STATUS.warning}`, bgColor: `${STATUS.warning}10`, borderColor: `${STATUS.warning}33`,
    href: `/company/${id}/training`, icon: <GraduationCap size={18} style={{ color: `${STATUS.warning}` }} />,
  });
  if (incidentSummary && incidentSummary.total_incidents > 0) urgentItems.push({
    label: 'อุบัติเหตุสะสมปีนี้',
    count: incidentSummary.total_incidents, unit: 'ครั้ง',
    color: `${STATUS.critical}`, bgColor: `${STATUS.critical}0a`, borderColor: `${STATUS.critical}26`,
    href: `/company/${id}/incidents`, icon: <AlertCircle size={18} style={{ color: `${STATUS.critical}` }} />,
  });

  // ── Pending (non-urgent) items ─────────────────────────────────
  const infoItems: { label: string; detail: string; color: string; href: string }[] = [];
  if (scheduledThisMonth > 0) infoItems.push({ label: `อบรมกำหนดเดือน ${MONTH_LABELS[currentMonth - 1]}`, detail: `${scheduledThisMonth} หลักสูตร`, color: `${PALETTE.primary}`, href: `/company/${id}/training` });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ padding: 'clamp(16px, 3vw, 24px) clamp(12px, 3vw, 28px) 40px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                {companyName}
              </h1>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border)' }}>
                ปี {year}
              </span>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <RefreshCw size={10} /> {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {fullName && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</p>
            )}
          </div>
        </div>

        {/* ── HERO: Urgent Actions ── */}
        {!loading && urgentItems.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
              {urgentItems.map((item, i) => (
                <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '16px 18px', borderRadius: 12,
                    background: item.bgColor, border: `1.5px solid ${item.borderColor}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${item.borderColor}`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${item.color}15`, flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: item.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {item.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1 }}>
                            {item.count}
                          </span>
                          <span style={{ fontSize: 12, color: item.color, opacity: 0.7 }}>{item.unit}</span>
                        </div>
                      </div>
                      <ArrowRight size={16} style={{ color: item.color, opacity: 0.5, marginTop: 12 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Info items (non-urgent) ── */}
        {!loading && infoItems.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {infoItems.map((item, i) => (
              <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--card-solid)', cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = item.color; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.detail}</span>
                  <ArrowRight size={11} style={{ color: 'var(--muted)' }} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
          {/* Action Plan Progress */}
          <Link href={hasSheet ? `/company/${id}/action-plan` : '#'} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', cursor: hasSheet ? 'pointer' : 'default', transition: 'border-color 0.15s', height: '100%' }}
              onMouseEnter={e => { if (hasSheet) (e.currentTarget as HTMLElement).style.borderColor = `${PALETTE.primary}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>แผนงานประจำปี</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${PALETTE.primary}14` }}>
                  <ClipboardList size={14} style={{ color: `${PALETTE.primary}` }} />
                </div>
              </div>
              {loading ? (
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--muted)', lineHeight: 1 }}>—</div>
              ) : !hasSheet ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>ยังไม่ได้เชื่อมต่อ</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>ต้องตั้งค่า Google Sheet ก่อน</div>
                </>
              ) : actionPlanTotal === 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>ยังไม่มีแผนงาน</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>เพิ่มกิจกรรมในแผนงานประจำปี</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: (actionPlanPct || 0) >= 70 ? `${STATUS.positive}` : (actionPlanPct || 0) >= 40 ? `${STATUS.warning}` : `${STATUS.critical}`, lineHeight: 1 }}>
                      {actionPlanPct}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: actionPlanInsight.color, fontWeight: 600, marginTop: 2 }}>
                    {actionPlanInsight.text}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>สำเร็จ {actionPlanDone} / {actionPlanTotal}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: (actionPlanPct || 0) >= 75 ? `${STATUS.positive}1a` : (actionPlanPct || 0) >= 40 ? '#5856d614' : `${STATUS.critical}1a`, color: (actionPlanPct || 0) >= 75 ? `${STATUS.positive}` : (actionPlanPct || 0) >= 40 ? '#5856d6' : `${STATUS.critical}` }}>
                      {(actionPlanPct || 0) >= 75 ? '✓ ตามแผน' : (actionPlanPct || 0) >= 40 ? '⚠ ต้องติดตาม' : '✗ เบิกเกิน'}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${actionPlanPct || 0}%`, background: (actionPlanPct || 0) >= 70 ? `${STATUS.positive}` : (actionPlanPct || 0) >= 40 ? `${STATUS.warning}` : `${STATUS.critical}`, transition: 'width 0.5s ease' }} />
                  </div>
                </>
              )}
            </div>
          </Link>

          {/* Training */}
          <Link href={`/company/${id}/training`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s', height: '100%' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#5856d6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>อบรมประจำปี</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(88,86,214,0.08)' }}>
                  <GraduationCap size={14} style={{ color: '#5856d6' }} />
                </div>
              </div>
              {loading ? (
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--muted)', lineHeight: 1 }}>—</div>
              ) : totalCourses === 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>ยังไม่มีแผนอบรม</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>เพิ่มหลักสูตรในแผนอบรมประจำปี</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: trainingPct >= 80 ? `${STATUS.positive}` : trainingPct >= 50 ? '#5856d6' : `${STATUS.warning}`, lineHeight: 1 }}>
                      {completedCourses}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>/ {totalCourses}</span>
                  </div>
                  <div style={{ fontSize: 11, color: trainingInsight.color, fontWeight: 600, marginTop: 2 }}>
                    {trainingInsight.text}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>หลักสูตรอบรมแล้ว</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: trainingPct >= 80 ? `${STATUS.positive}1a` : trainingPct >= 50 ? '#5856d614' : `${STATUS.warning}1a`, color: trainingPct >= 80 ? `${STATUS.positive}` : trainingPct >= 50 ? '#5856d6' : `${STATUS.warning}` }}>
                      {trainingPct >= 80 ? '✓ ตามแผน' : trainingPct >= 50 ? '⚠ ต้องติดตาม' : '✗ ล่าช้า'}
                    </span>
                  </div>
                  {overdueTraining > 0 && (
                    <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${STATUS.warning}1a`, color: `${STATUS.warning}`, fontWeight: 700, marginTop: 4, display: 'inline-block' }}>
                      ค้าง {overdueTraining}
                    </div>
                  )}
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${trainingPct}%`, background: trainingPct >= 80 ? `${STATUS.positive}` : '#5856d6', transition: 'width 0.5s ease' }} />
                  </div>
                </>
              )}
            </div>
          </Link>

          {/* Incidents */}
          <Link href={`/company/${id}/incidents`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s', height: '100%' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = incidentSummary && incidentSummary.total_incidents > 0 ? `${STATUS.critical}` : `${STATUS.positive}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>อุบัติเหตุสะสม</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: incidentSummary && incidentSummary.total_incidents > 0 ? `${STATUS.critical}14` : `${STATUS.positive}14` }}>
                  {incidentSummary && incidentSummary.total_incidents > 0
                    ? <AlertTriangle size={14} style={{ color: `${STATUS.critical}` }} />
                    : <CheckCircle2 size={14} style={{ color: `${STATUS.positive}` }} />
                  }
                </div>
              </div>
              {loading ? (
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--muted)', lineHeight: 1 }}>—</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: incidentSummary && incidentSummary.total_incidents > 0 ? `${STATUS.critical}` : `${STATUS.positive}`, lineHeight: 1 }}>
                      {incidentSummary ? incidentSummary.total_incidents : 0}
                    </span>
                    {incidentTrendDelta !== 0 && incidentTrendPct !== null && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: incidentTrendDelta <= 0 ? `${STATUS.positive}` : `${STATUS.critical}` }}>
                        {incidentTrendDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {incidentTrendDelta > 0 ? '+' : ''}{incidentTrendDelta}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {incidentSummary && incidentSummary.total_incidents > 0
                      ? `บาดเจ็บ ${incidentSummary.total_injuries || 0} • LTI ${incidentSummary.total_lti || 0}`
                      : <span style={{ color: `${STATUS.positive}`, fontWeight: 600 }}>ไม่มีอุบัติเหตุ</span>
                    }
                  </div>
                  {currentMonthIncidents > 0 && (
                    <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${STATUS.warning}1a`, color: `${STATUS.warning}`, fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
                      {currentMonthIncidents} เดือนนี้
                    </div>
                  )}
                </>
              )}
            </div>
          </Link>

          {/* Manhours */}
          <Link href={`/company/${id}/manhours`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s', height: '100%' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${PALETTE.secondary}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>ชั่วโมงทำงานสะสม</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${PALETTE.secondary}14` }}>
                  <Clock size={14} style={{ color: `${PALETTE.secondary}` }} />
                </div>
              </div>
              {loading ? (
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--muted)', lineHeight: 1 }}>—</div>
              ) : !hasAnyManhourData ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.4 }}>ยังไม่มีข้อมูลนำเข้า</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: `${PALETTE.secondary}`, fontWeight: 600, marginTop: 6 }}>
                    <Plus size={11} /> บันทึกชั่วโมงทำงาน
                  </div>
                </>
              ) : !currentMonthManhour ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {totalManhours.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    ล่าสุด {MONTH_LABELS[(latestManhour?.month || 1) - 1]}
                  </div>
                  <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${STATUS.warning}14`, color: `${STATUS.warning}`, fontWeight: 600, marginTop: 6, display: 'inline-block' }}>
                    ยังไม่บันทึก {MONTH_LABELS[currentMonth - 1]}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {totalManhours.toLocaleString()}
                    </span>
                    {mhTrend !== null && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700, color: mhTrend >= 0 ? `${STATUS.positive}` : `${STATUS.critical}` }}>
                        {mhTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {mhTrend >= 0 ? '+' : ''}{mhTrend}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    พนักงาน {latestManhour?.employee_count || 0} คน
                  </div>
                </>
              )}
            </div>
          </Link>
        </div>

        {/* ── Training + Manhours Detail ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
          {/* Upcoming Training */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarCheck size={14} style={{ color: '#5856d6' }} /> อบรมที่กำลังจะมาถึง
              </h2>
              <Link href={`/company/${id}/training`} style={{ fontSize: 11, fontWeight: 600, color: '#5856d6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                ดูทั้งหมด <ArrowRight size={11} />
              </Link>
            </div>
            {(() => {
              const upcoming = trainingPlans
                .filter(p => {
                  const s = p.training_sessions?.[0]?.status;
                  return (p.planned_month >= currentMonth) && s !== 'completed' && s !== 'cancelled';
                })
                .sort((a, b) => a.planned_month - b.planned_month)
                .slice(0, 5);
              if (totalCourses === 0) return (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>ยังไม่มีแผนอบรมประจำปี</p>
                  <Link href={`/company/${id}/training`} style={{ fontSize: 11, fontWeight: 600, color: '#5856d6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} /> เพิ่มหลักสูตร
                  </Link>
                </div>
              );
              if (upcoming.length === 0) return (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CheckCircle2 size={20} style={{ color: `${STATUS.positive}`, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: `${STATUS.positive}`, fontWeight: 600, margin: 0 }}>จัดอบรมครบทุกหลักสูตรแล้ว</p>
                </div>
              );
              return upcoming.map((t, i) => {
                const status = t.training_sessions?.[0]?.status;
                const isScheduled = status === 'scheduled';
                const statusLabel = isScheduled ? 'กำหนดวันแล้ว' : 'รอกำหนดวัน';
                const statusColor = isScheduled ? `${STATUS.positive}` : `${STATUS.warning}`;
                const statusBg = isScheduled ? `${STATUS.positive}14` : `${STATUS.warning}14`;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#5856d6', background: 'rgba(88,86,214,0.08)', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                      {MONTH_LABELS[t.planned_month - 1]}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.course_name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          {/* Manhours Trend (mini) */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} style={{ color: `${PALETTE.secondary}` }} /> ชั่วโมงทำงานรายเดือน
              </h2>
              <Link href={`/company/${id}/manhours`} style={{ fontSize: 11, fontWeight: 600, color: `${PALETTE.secondary}`, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                ดูทั้งหมด <ArrowRight size={11} />
              </Link>
            </div>
            {!hasAnyManhourData ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Clock size={20} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>ยังไม่มีข้อมูลชั่วโมงทำงาน</p>
                <Link href={`/company/${id}/manhours`} style={{ fontSize: 11, fontWeight: 600, color: `${PALETTE.secondary}`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> บันทึกชั่วโมงทำงาน
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sortedManhours.slice(-6).map((m, i) => {
                  const total = (m.employee_manhours || 0) + (m.contractor_manhours || 0);
                  const maxTotal = Math.max(...manhours.map(x => (x.employee_manhours || 0) + (x.contractor_manhours || 0)), 1);
                  const pct = Math.round((total / maxTotal) * 100);
                  const isCurrentMonth = m.month === currentMonth;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: isCurrentMonth ? `${PALETTE.secondary}` : 'var(--muted)', fontWeight: isCurrentMonth ? 700 : 400, width: 32, textAlign: 'right', flexShrink: 0 }}>
                        {MONTH_LABELS[m.month - 1]}
                      </span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: isCurrentMonth ? `linear-gradient(90deg, ${PALETTE.secondary}, #ff6b00)` : `linear-gradient(90deg, ${PALETTE.secondary}, #ffb84d)`, transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, color: isCurrentMonth ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isCurrentMonth ? 600 : 400, width: 52, textAlign: 'right', flexShrink: 0 }}>
                        {total.toLocaleString()}
                      </span>
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
