'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { Calendar, Search } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

interface PlanRaw {
  id: string;
  company_id: string;
  course_name: string;
  category: string;
  planned_month: number;
  hours_per_course: number;
  planned_participants: number;
  budget: number;
  in_house_external: string;
  dsd_eligible: boolean;
  training_sessions: {
    id: string;
    status: string;
    scheduled_date_start: string | null;
    actual_cost: number;
    actual_participants: number;
    total_man_hours: number;
    postponed_to_month: number | null;
    original_planned_month: number | null;
  }[];
}

interface CompanyData {
  companyId: string;
  companyName: string;
  plans: PlanRaw[];
}

export default function HQTrainingOverview() {
  const auth = useAuth();
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [allCompanyData, setAllCompanyData] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<string>('year');
  const currentMonthIdx = new Date().getMonth();

  // History search
  const [historyTab, setHistoryTab] = useState<'overview' | 'course' | 'person'>('overview');
  const [courseSearch, setCourseSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);

  // Expanded month detail
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results: CompanyData[] = [];

      const promises = COMPANIES.map(async (company) => {
        try {
          const res = await fetch(`/api/training/plans?companyId=${company.id}&year=${selectedYear}`);
          const plans = await res.json();
          if (Array.isArray(plans) && plans.length > 0) {
            return { companyId: company.id, companyName: company.name, plans };
          }
        } catch { /* skip */ }
        return null;
      });

      const allResults = await Promise.all(promises);
      for (const r of allResults) {
        if (r) results.push(r);
      }

      setAllCompanyData(results);
      setLoading(false);
    };

    fetchAll();
  }, [selectedYear]);

  const getEffectiveMonth = (p: PlanRaw) => {
    const s = p.training_sessions?.[0];
    if (s?.status === 'postponed' && s.postponed_to_month) return s.postponed_to_month;
    if (s?.postponed_to_month && s?.original_planned_month) return s.postponed_to_month;
    return p.planned_month;
  };

  // Filter plans based on time range
  const filterByTimeRange = (plans: PlanRaw[]) => {
    if (timeRange === 'year') return plans;
    return plans.filter(p => {
      const m = getEffectiveMonth(p);
      if (timeRange === 'ytd') return m >= 1 && m <= currentMonthIdx + 1;
      const idx = MONTH_KEYS.indexOf(timeRange);
      if (idx >= 0) return m === idx + 1;
      return true;
    });
  };

  // Compute summaries per company
  const companySummaries = useMemo(() => {
    const today = new Date();
    return allCompanyData.map(cd => {
      const plans = filterByTimeRange(cd.plans);
      let completed = 0, scheduled = 0, pending = 0, cancelled = 0, warnings = 0;
      let totalBudget = 0, totalActual = 0, totalParticipants = 0, totalManHours = 0;

      // Monthly breakdown
      const monthly = Array.from({ length: 12 }, () => ({ planned: 0, completed: 0, budget: 0, actual: 0 }));

      for (const p of plans) {
        const s = p.training_sessions?.[0];
        const status = s?.status || 'planned';
        if (status === 'completed') completed++;
        else if (status === 'scheduled') scheduled++;
        else if (status === 'cancelled') cancelled++;
        else pending++;

        totalBudget += p.budget || 0;
        totalActual += s?.actual_cost || 0;
        totalParticipants += s?.actual_participants || 0;
        totalManHours += s?.total_man_hours || 0;

        const em = getEffectiveMonth(p);
        if (em >= 1 && em <= 12) {
          monthly[em - 1].planned++;
          if (status === 'completed') monthly[em - 1].completed++;
          monthly[em - 1].budget += p.budget || 0;
          monthly[em - 1].actual += s?.actual_cost || 0;
        }

        if (status === 'planned' && p.planned_month > 0) {
          const planned = new Date(selectedYear, p.planned_month - 1, 1);
          const diff = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          if (diff <= 45 && diff > -30) warnings++;
        }
      }

      return {
        companyId: cd.companyId,
        companyName: cd.companyName,
        totalCourses: plans.length,
        completed, scheduled, pending, cancelled, warnings,
        totalBudget, totalActual, totalParticipants, totalManHours,
        monthly,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanyData, timeRange]);

  // Global monthly aggregation (across all companies, always full year for chart)
  const globalMonthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      let planned = 0, completed = 0, budget = 0, actual = 0;
      const coursesInMonth: { company: string; course: string; status: string; date: string | null; budget: number; actual: number }[] = [];
      for (const cd of allCompanyData) {
        for (const p of cd.plans) {
          const em = getEffectiveMonth(p);
          if (em !== i + 1) continue;
          const s = p.training_sessions?.[0];
          const status = s?.status || 'planned';
          planned++;
          if (status === 'completed') completed++;
          budget += p.budget || 0;
          actual += s?.actual_cost || 0;
          coursesInMonth.push({
            company: cd.companyName,
            course: p.course_name,
            status,
            date: s?.scheduled_date_start || null,
            budget: p.budget || 0,
            actual: s?.actual_cost || 0,
          });
        }
      }
      return { month: i + 1, label: MONTH_LABELS[i], planned, completed, budget, actual, courses: coursesInMonth };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanyData]);

  const totals = companySummaries.reduce((acc, s) => ({
    courses: acc.courses + s.totalCourses,
    completed: acc.completed + s.completed,
    scheduled: acc.scheduled + s.scheduled,
    pending: acc.pending + s.pending,
    budget: acc.budget + s.totalBudget,
    actual: acc.actual + s.totalActual,
    participants: acc.participants + s.totalParticipants,
    manHours: acc.manHours + s.totalManHours,
    warnings: acc.warnings + s.warnings,
  }), { courses: 0, completed: 0, scheduled: 0, pending: 0, budget: 0, actual: 0, participants: 0, manHours: 0, warnings: 0 });

  const overallPct = totals.courses > 0 ? Math.round((totals.completed / totals.courses) * 100) : 0;
  const budgetUsedPct = totals.budget > 0 ? Math.round((totals.actual / totals.budget) * 100) : 0;

  const filtered = searchTerm
    ? companySummaries.filter(s => s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    : companySummaries;

  const handleCourseSearch = async () => {
    if (!courseSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/training/attendees?courseName=${encodeURIComponent(courseSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handlePersonSearch = async () => {
    if (!personSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/training/attendees?empCode=${encodeURIComponent(personSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const maxMonthlyPlanned = Math.max(...globalMonthly.map(d => d.planned), 1);

  const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'อบรมแล้ว', color: '#16a34a', bg: '#dcfce7' },
    scheduled: { label: 'กำหนดวันแล้ว', color: '#3b82f6', bg: '#dbeafe' },
    planned: { label: 'ตามแผน', color: '#6b7280', bg: '#f3f4f6' },
    cancelled: { label: 'ยกเลิก', color: '#dc2626', bg: '#fee2e2' },
    postponed: { label: 'เลื่อน', color: '#f59e0b', bg: '#fef3c7' },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            🎓 HQ Training Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0', fontSize: 14 }}>
            ภาพรวมแผนอบรมทุกบริษัทในกลุ่ม EA • ปี {selectedYear}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }}>
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {['overview', 'course', 'person'].map(tab => (
            <button key={tab} onClick={() => { setHistoryTab(tab as typeof historyTab); setSearchResults([]); }}
              style={{ padding: '6px 14px', borderRadius: 6, border: historyTab === tab ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: historyTab === tab ? 'var(--accent)' : 'var(--card-solid)', color: historyTab === tab ? '#fff' : 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {tab === 'overview' ? '📊 ภาพรวม' : tab === 'course' ? '📚 ค้นหาหลักสูตร' : '👤 ค้นหารายบุคคล'}
            </button>
          ))}
        </div>

        {/* Time Range Selector — only in overview tab */}
        {historyTab === 'overview' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>ช่วงเวลา:</span>
            <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {[
                { key: 'year', label: 'ทั้งปี' },
                { key: 'ytd', label: `ถึง ${MONTH_LABELS[currentMonthIdx]} (YTD)` },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTimeRange(opt.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: timeRange === opt.key ? 'var(--accent)' : 'transparent',
                    color: timeRange === opt.key ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={MONTH_KEYS.includes(timeRange) ? timeRange : ''}
              onChange={(e) => e.target.value && setTimeRange(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: MONTH_KEYS.includes(timeRange) ? 'var(--accent)' : 'var(--bg-secondary)',
                color: MONTH_KEYS.includes(timeRange) ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)', outline: 'none',
              }}
            >
              <option value="" disabled>เลือกเดือน...</option>
              {MONTH_LABELS.map((name, i) => (
                <option key={MONTH_KEYS[i]} value={MONTH_KEYS[i]}>{name}</option>
              ))}
            </select>
            {timeRange !== 'year' && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,149,0,0.1)', color: '#ff9500' }}>
                {timeRange === 'ytd' ? `ม.ค. – ${MONTH_LABELS[currentMonthIdx]}` : MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]} เท่านั้น
              </span>
            )}
          </div>
        )}

        {historyTab === 'overview' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 14 }}>กำลังโหลดข้อมูลจากทุกบริษัท...</div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <KPIBox icon="📚" label="หลักสูตรรวม" value={totals.courses} />
                  <KPIBox icon="✅" label="อบรมแล้ว" value={`${totals.completed}`} sub={`${overallPct}%`} color="var(--success)" />
                  <KPIBox icon="📅" label="กำหนดวันแล้ว" value={`${totals.scheduled}`} color="#3b82f6" />
                  <KPIBox icon="⏳" label="รอดำเนินการ" value={`${totals.pending}`} color="#f59e0b" />
                  <KPIBox icon="💰" label="งบประมาณ" value={`${(totals.budget / 1000).toFixed(0)}K`} />
                  <KPIBox icon="💳" label="ใช้จริง" value={`${(totals.actual / 1000).toFixed(0)}K`} sub={`${budgetUsedPct}%`}
                    color={totals.actual > totals.budget ? 'var(--danger)' : 'var(--success)'} />
                  <KPIBox icon="👥" label="ผู้เข้าอบรม" value={totals.participants} />
                  {totals.warnings > 0 && <KPIBox icon="⚠️" label="ต้องเร่ง" value={totals.warnings} color="var(--danger)" />}
                </div>

                {/* Monthly Overview Chart */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        % การอบรมตามแผนรายเดือน (ทุกบริษัท)
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        คลิกแท่งกราฟเพื่อดูรายละเอียดหลักสูตรในเดือนนั้น
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? '#f59e0b' : 'var(--danger)' }}>
                        {overallPct}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ความสำเร็จรวม</div>
                    </div>
                  </div>

                  {/* Bar chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, marginBottom: 8 }}>
                    {globalMonthly.map((d, i) => {
                      const currentMonth = currentMonthIdx + 1;
                      const isPast = d.month <= currentMonth;
                      const barHeight = maxMonthlyPlanned > 0 ? (d.planned / maxMonthlyPlanned) * 150 : 0;
                      const completedHeight = d.planned > 0 ? (d.completed / d.planned) * barHeight : 0;
                      const pct = d.planned > 0 ? Math.round((d.completed / d.planned) * 100) : 0;
                      const isExpanded = expandedMonth === d.month;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: d.planned > 0 ? 'pointer' : 'default' }}
                          onClick={() => d.planned > 0 && setExpandedMonth(isExpanded ? null : d.month)}>
                          {d.planned > 0 && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? 'var(--success)' : 'var(--text-secondary)' }}>
                              {d.completed}/{d.planned}
                            </div>
                          )}
                          <div style={{
                            width: '100%', height: barHeight || 2, borderRadius: 4, position: 'relative', overflow: 'hidden',
                            background: isPast && d.planned > 0 ? '#fee2e2' : 'var(--bg-secondary)',
                            border: isExpanded ? '2px solid var(--accent)' : 'none',
                            boxSizing: 'border-box',
                          }}>
                            {completedHeight > 0 && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: completedHeight, background: '#4ade80', borderRadius: '0 0 4px 4px' }} />
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: d.month === currentMonth ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: d.month === currentMonth ? 700 : 400 }}>
                            {d.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> อบรมแล้ว
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fee2e2', display: 'inline-block' }} /> เลยกำหนด
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-secondary)', display: 'inline-block' }} /> ยังไม่ถึง
                    </span>
                  </div>

                  {/* Expanded month detail */}
                  {expandedMonth && (() => {
                    const md = globalMonthly[expandedMonth - 1];
                    if (!md || md.courses.length === 0) return null;
                    return (
                      <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                          📋 รายการอบรมเดือน{md.label} ({md.courses.length} หลักสูตร)
                        </div>
                        <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={th}>#</th>
                                <th style={{ ...th, textAlign: 'left' }}>บริษัท</th>
                                <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
                                <th style={th}>สถานะ</th>
                                <th style={th}>วันอบรม</th>
                                <th style={{ ...th, textAlign: 'right' }}>งบ (฿)</th>
                                <th style={{ ...th, textAlign: 'right' }}>จริง (฿)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {md.courses.map((c, idx) => {
                                const st = STATUS_LABELS[c.status] || STATUS_LABELS['planned'];
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={td}>{idx + 1}</td>
                                    <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{c.company}</td>
                                    <td style={{ ...td, textAlign: 'left', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.course}</td>
                                    <td style={td}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                                        {st.label}
                                      </span>
                                    </td>
                                    <td style={td}>{c.date ? formatDate(c.date) : '-'}</td>
                                    <td style={{ ...td, textAlign: 'right' }}>{c.budget.toLocaleString()}</td>
                                    <td style={{ ...td, textAlign: 'right' }}>{c.actual > 0 ? c.actual.toLocaleString() : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Budget Overview Chart */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    💰 งบประมาณ vs ค่าใช้จ่ายจริง รายเดือน
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    เปรียบเทียบงบประมาณที่วางแผนกับค่าใช้จ่ายจริงในแต่ละเดือน
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginBottom: 8 }}>
                    {globalMonthly.map((d, i) => {
                      const maxBudget = Math.max(...globalMonthly.map(m => Math.max(m.budget, m.actual)), 1);
                      const budgetH = (d.budget / maxBudget) * 120;
                      const actualH = (d.actual / maxBudget) * 120;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 120 }}>
                            <div style={{ width: '40%', height: budgetH || 1, background: '#93c5fd', borderRadius: '3px 3px 0 0' }} title={`งบ: ${d.budget.toLocaleString()}`} />
                            <div style={{ width: '40%', height: actualH || 1, background: d.actual > d.budget ? '#f87171' : '#4ade80', borderRadius: '3px 3px 0 0' }} title={`จริง: ${d.actual.toLocaleString()}`} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{d.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd', display: 'inline-block' }} /> งบประมาณ
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> ค่าใช้จ่ายจริง
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f87171', display: 'inline-block' }} /> เกินงบ
                    </span>
                  </div>
                  {/* Budget summary row */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>งบรวม: <b style={{ color: '#3b82f6' }}>{totals.budget.toLocaleString()} ฿</b></span>
                    <span style={{ color: 'var(--text-secondary)' }}>ใช้จริง: <b style={{ color: totals.actual > totals.budget ? '#dc2626' : '#16a34a' }}>{totals.actual.toLocaleString()} ฿</b></span>
                    <span style={{ color: 'var(--text-secondary)' }}>คงเหลือ: <b style={{ color: totals.budget - totals.actual >= 0 ? '#16a34a' : '#dc2626' }}>{(totals.budget - totals.actual).toLocaleString()} ฿</b></span>
                  </div>
                </div>

                {/* Company % Completion per Month — Matrix Table */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    📊 % อบรมตามแผนรายเดือน แยกตามบริษัท
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    แสดงเฉพาะเดือนที่มีแผนอบรม
                  </p>

                  <div style={{ marginBottom: 12 }}>
                    <input placeholder="ค้นหาบริษัท..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 250, fontSize: 13 }} />
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>บริษัท</th>
                          <th style={th}>รวม</th>
                          <th style={th}>✅</th>
                          {MONTH_LABELS.map((m, i) => (
                            <th key={i} style={{ ...th, color: i === currentMonthIdx ? 'var(--accent)' : undefined, fontWeight: i === currentMonthIdx ? 700 : undefined }}>
                              {m}
                            </th>
                          ))}
                          <th style={{ ...th, textAlign: 'right' }}>งบ</th>
                          <th style={{ ...th, textAlign: 'right' }}>จริง</th>
                          <th style={th}>%งบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, i) => {
                          const pct = s.totalCourses > 0 ? Math.round((s.completed / s.totalCourses) * 100) : 0;
                          const bPct = s.totalBudget > 0 ? Math.round((s.totalActual / s.totalBudget) * 100) : 0;
                          return (
                            <tr key={s.companyId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                              <td style={{ ...td, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--card-solid)' : 'var(--bg-secondary)', zIndex: 1 }}>
                                <Link href={`/company/${s.companyId}/training`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                  {s.companyName}
                                </Link>
                              </td>
                              <td style={td}>{s.totalCourses}</td>
                              <td style={{ ...td, color: 'var(--success)', fontWeight: 600 }}>{pct}%</td>
                              {s.monthly.map((m, mi) => {
                                if (m.planned === 0) return <td key={mi} style={{ ...td, color: 'var(--border)' }}>-</td>;
                                const mPct = Math.round((m.completed / m.planned) * 100);
                                const bg = mPct === 100 ? '#dcfce7' : mPct > 0 ? '#fef3c7' : mi < currentMonthIdx ? '#fee2e2' : 'transparent';
                                const clr = mPct === 100 ? '#16a34a' : mPct > 0 ? '#f59e0b' : mi < currentMonthIdx ? '#dc2626' : 'var(--text-secondary)';
                                return (
                                  <td key={mi} style={{ ...td, background: bg, color: clr, fontWeight: 600, fontSize: 11 }}>
                                    {m.completed}/{m.planned}
                                  </td>
                                );
                              })}
                              <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(s.totalBudget / 1000).toFixed(0)}K</td>
                              <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(s.totalActual / 1000).toFixed(0)}K</td>
                              <td style={{ ...td, color: bPct > 100 ? '#dc2626' : 'var(--text-secondary)', fontWeight: bPct > 100 ? 700 : 400, fontSize: 11 }}>{bPct}%</td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)', fontWeight: 700 }}>
                          <td style={{ ...td, textAlign: 'left', fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>รวมทั้งหมด</td>
                          <td style={td}>{totals.courses}</td>
                          <td style={{ ...td, color: 'var(--success)' }}>{overallPct}%</td>
                          {globalMonthly.map((gm, mi) => {
                            if (gm.planned === 0) return <td key={mi} style={{ ...td, color: 'var(--border)' }}>-</td>;
                            const mPct = Math.round((gm.completed / gm.planned) * 100);
                            return (
                              <td key={mi} style={{ ...td, fontWeight: 700, color: mPct === 100 ? '#16a34a' : mPct > 0 ? '#f59e0b' : mi < currentMonthIdx ? '#dc2626' : 'var(--text-secondary)' }}>
                                {gm.completed}/{gm.planned}
                              </td>
                            );
                          })}
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(totals.budget / 1000).toFixed(0)}K</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(totals.actual / 1000).toFixed(0)}K</td>
                          <td style={{ ...td, fontSize: 11 }}>{budgetUsedPct}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warning */}
                {totals.warnings > 0 && (
                  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                    ⚠️ มี {totals.warnings} หลักสูตรใกล้ถึงกำหนดแต่ยังไม่กำหนดวันอบรม
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Course Search Tab */}
        {historyTab === 'course' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์ชื่อหลักสูตร..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCourseSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }} />
              <button onClick={handleCourseSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}

        {/* Person Search Tab */}
        {historyTab === 'person' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์รหัสพนักงาน..." value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePersonSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }} />
              <button onClick={handlePersonSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}
      </main>
    </div>
  );

  function renderSearchResults() {
    if (searching) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>กำลังค้นหา...</div>;
    if (searchResults.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>ไม่พบข้อมูล</div>;

    return (
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th>
              <th style={th}>รหัส</th>
              <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
              <th style={th}>บริษัท</th>
              <th style={th}>วันอบรม</th>
              <th style={th}>ชม.</th>
              <th style={th}>ประเภท</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((r: Record<string, unknown>, i: number) => {
              const plan = r.training_plans as Record<string, unknown> | null;
              const session = r.training_sessions as Record<string, unknown> | null;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{r.first_name as string} {r.last_name as string}</td>
                  <td style={td}>{r.emp_code as string || '-'}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{plan?.course_name as string || '-'}</td>
                  <td style={td}>{r.company_id as string}</td>
                  <td style={td}>{session?.scheduled_date_start ? formatDate(session.scheduled_date_start as string) : '-'}</td>
                  <td style={td}>{r.hours_attended as number || plan?.hours_per_course as number || '-'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: r.registration_type === 'attended' ? '#dcfce7' : '#dbeafe', color: r.registration_type === 'attended' ? '#16a34a' : '#3b82f6' }}>
                      {r.registration_type === 'attended' ? 'เข้าอบรม' : 'ลงทะเบียน'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' };

function formatDate(d: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function KPIBox({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        {sub && <span style={{ fontSize: 12, color: color || 'var(--text-secondary)', fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  );
}
