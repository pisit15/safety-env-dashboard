'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, Activity, Clock, Shield, Users, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Building2, ChevronRight, ChevronDown,
} from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH: Record<string, string> = {
  Jan: 'ม.ค.', Feb: 'ก.พ.', Mar: 'มี.ค.', Apr: 'เม.ย.', May: 'พ.ค.', Jun: 'มิ.ย.',
  Jul: 'ก.ค.', Aug: 'ส.ค.', Sep: 'ก.ย.', Oct: 'ต.ค.', Nov: 'พ.ย.', Dec: 'ธ.ค.',
};

interface CompanyStat {
  total: number;
  injuries: number;
  lti: number;
  nearMiss: number;
  propertyDamage: number;
  fatality: number;
  directCost: number;
  indirectCost: number;
  tifr: number | null;
  ltifr: number | null;
}

const selectStyle = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10,
  padding: '8px 12px', fontSize: 13, color: '#1a1a1a', appearance: 'none' as const,
};

interface Incident {
  id: string;
  incident_no: string;
  company_id: string;
  incident_date: string;
  year: number;
  month: string;
  incident_type: string;
  work_related?: string;
  person_type?: string;
  direct_cost?: number;
  indirect_cost?: number;
  [key: string]: unknown;
}

// Year filter presets
const ALL_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_PRESETS: { label: string; years: number[] }[] = [
  { label: 'YTD', years: [CURRENT_YEAR] },
  { label: `${CURRENT_YEAR}`, years: [CURRENT_YEAR] },
  { label: '3 ปีล่าสุด', years: ALL_YEARS.filter(y => y >= CURRENT_YEAR - 2) },
  { label: 'ทั้งหมด', years: [...ALL_YEARS] },
];

// Chart company colors
const COMPANY_COLORS = ['#3b82f6', '#f97316', '#16a34a', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16'];

export default function HQIncidentsPage() {
  const auth = useAuth();
  const [selectedYears, setSelectedYears] = useState<number[]>([CURRENT_YEAR]);
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [manHoursByCompany, setManHoursByCompany] = useState<Record<string, { employee: number; contractor: number; total: number }>>({});
  const [showAdvancedYears, setShowAdvancedYears] = useState(false);
  // Wave C: chart toggle
  const [chartMode, setChartMode] = useState<'all' | 'byCompany'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch incidents and manhours for all selected years
      const [incResults, mhResults] = await Promise.all([
        Promise.all(selectedYears.map(y =>
          Promise.all(COMPANIES.map(c =>
            fetch(`/api/incidents?companyId=${c.id}&year=${y}&limit=1000`).then(r => r.json())
          ))
        )),
        Promise.all(selectedYears.map(y =>
          Promise.all(COMPANIES.map(c =>
            fetch(`/api/manhours?companyId=${c.id}&year=${y}`).then(r => r.json()).then(d => ({
              companyId: c.id, year: y,
              employee: (d.manHours || []).reduce((a: number, r: Record<string, unknown>) => a + (Number(r.employee_manhours) || 0), 0),
              contractor: (d.manHours || []).reduce((a: number, r: Record<string, unknown>) => a + (Number(r.contractor_manhours) || 0), 0),
            }))
          ))
        )),
      ]);

      // Merge incidents
      const allInc: Incident[] = [];
      incResults.forEach(yearResults => yearResults.forEach(r => { if (r.incidents) allInc.push(...r.incidents); }));
      setAllIncidents(allInc);

      // Merge manhours by company
      const mhMap: Record<string, { employee: number; contractor: number; total: number }> = {};
      mhResults.forEach(yearResults => yearResults.forEach(r => {
        if (!mhMap[r.companyId]) mhMap[r.companyId] = { employee: 0, contractor: 0, total: 0 };
        mhMap[r.companyId].employee += r.employee;
        mhMap[r.companyId].contractor += r.contractor;
        mhMap[r.companyId].total += r.employee + r.contractor;
      }));
      setManHoursByCompany(mhMap);
    } catch { /* empty */ }
    setLoading(false);
  }, [selectedYears]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered by workRelatedOnly
  const INJURY_TYPES_P = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'];
  const baseInc = workRelatedOnly ? allIncidents.filter(i => i.work_related === 'ใช่') : allIncidents;

  // Total summary computed client-side
  const totalSummary = (() => {
    const injuries = baseInc.filter(i => INJURY_TYPES_P.some(p => (i.incident_type || '').includes(p)));
    const lti = baseInc.filter(i => { const t = i.incident_type || ''; return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)'; });
    return {
      totalIncidents: baseInc.length,
      totalInjuries: injuries.length,
      ltiCases: lti.length,
      nearMisses: baseInc.filter(i => i.incident_type === 'Near Miss').length,
      propertyDamage: baseInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย').length,
      fatalities: baseInc.filter(i => (i.incident_type || '').includes('เสียชีวิต')).length,
      totalDirectCost: baseInc.reduce((s, i) => s + (Number(i.direct_cost) || 0), 0),
      totalIndirectCost: baseInc.reduce((s, i) => s + (Number(i.indirect_cost) || 0), 0),
    };
  })();

  // Per-company stats
  const companyStats: Record<string, CompanyStat> = {};
  COMPANIES.forEach(c => {
    const cInc = baseInc.filter(i => i.company_id === c.id);
    const injuries = cInc.filter(i => INJURY_TYPES_P.some(p => (i.incident_type || '').includes(p)));
    const lti = cInc.filter(i => { const t = i.incident_type || ''; return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)'; });
    const mh = manHoursByCompany[c.id];
    if (cInc.length > 0 || (mh && mh.total > 0)) {
      companyStats[c.id] = {
        total: cInc.length,
        injuries: injuries.length,
        lti: lti.length,
        nearMiss: cInc.filter(i => i.incident_type === 'Near Miss').length,
        propertyDamage: cInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย').length,
        fatality: cInc.filter(i => (i.incident_type || '').includes('เสียชีวิต')).length,
        directCost: cInc.reduce((s, i) => s + (Number(i.direct_cost) || 0), 0),
        indirectCost: cInc.reduce((s, i) => s + (Number(i.indirect_cost) || 0), 0),
        tifr: mh && mh.total > 0 ? (injuries.length / mh.total) * 1000000 : null,
        ltifr: mh && mh.total > 0 ? (lti.length / mh.total) * 1000000 : null,
      };
    }
  });

  // Monthly data — all combined
  const monthlyData: Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }> = {};
  MONTHS.forEach(m => { monthlyData[m] = { injuries: 0, nearMiss: 0, propertyDamage: 0, total: 0 }; });
  baseInc.forEach(inc => {
    const num = parseInt(String(inc.month));
    const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(inc.month);
    if (monthlyData[m]) {
      monthlyData[m].total++;
      if (INJURY_TYPES_P.some(p => (inc.incident_type || '').includes(p))) monthlyData[m].injuries++;
      if (inc.incident_type === 'Near Miss') monthlyData[m].nearMiss++;
      if (inc.incident_type === 'ทรัพย์สินเสียหาย') monthlyData[m].propertyDamage++;
    }
  });

  // Wave C: Monthly data by company (top 5 by total incidents)
  const top5Companies = Object.entries(companyStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([id]) => id);

  const monthlyByCompany: Record<string, Record<string, number>> = {};
  top5Companies.forEach(cId => {
    monthlyByCompany[cId] = {};
    MONTHS.forEach(m => { monthlyByCompany[cId][m] = 0; });
  });
  baseInc.forEach(inc => {
    if (!top5Companies.includes(inc.company_id)) return;
    const num = parseInt(String(inc.month));
    const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(inc.month);
    if (monthlyByCompany[inc.company_id]?.[m] !== undefined) {
      monthlyByCompany[inc.company_id][m]++;
    }
  });
  const maxMonthlyByCompany = Math.max(
    ...MONTHS.map(m => top5Companies.reduce((s, cId) => s + (monthlyByCompany[cId]?.[m] || 0), 0)),
    1
  );

  // Sort companies by total incidents desc
  const sortedCompanies = Object.entries(companyStats).sort((a, b) => b[1].total - a[1].total);

  // Wave B: Top 3 LTIFR for table highlights
  const ltifrValues = sortedCompanies
    .map(([id, s]) => ({ id, ltifr: s.ltifr }))
    .filter(x => x.ltifr !== null && x.ltifr! > 0)
    .sort((a, b) => (b.ltifr || 0) - (a.ltifr || 0));
  const top3LtifrIds = new Set(ltifrValues.slice(0, 3).map(x => x.id));

  // Total man-hours
  const totalManHours = Object.values(manHoursByCompany).reduce((sum, mh) => sum + mh.total, 0);
  const totalTIFR = totalManHours > 0 ? (totalSummary.totalInjuries / totalManHours) * 1000000 : null;
  const totalLTIFR = totalManHours > 0 ? (totalSummary.ltiCases / totalManHours) * 1000000 : null;

  const maxMonthly = Math.max(...Object.values(monthlyData).map(m => m.total), 1);
  const yearLabel = selectedYears.length === 1 ? String(selectedYears[0]) : `${selectedYears[0]}-${selectedYears[selectedYears.length - 1]}`;

  // Wave A: "ต้องดูวันนี้" alerts
  const alerts: { icon: string; label: string; detail: string; severity: 'critical' | 'warning' | 'info'; companyId?: string }[] = [];

  // 1. Fatality > 0
  sortedCompanies.forEach(([cId, s]) => {
    if (s.fatality > 0) {
      const name = COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase();
      alerts.push({ icon: '💀', label: `มีผู้เสียชีวิต ${s.fatality} ราย`, detail: name, severity: 'critical', companyId: cId });
    }
  });
  // 2. Highest LTI
  if (ltifrValues.length > 0 && ltifrValues[0].ltifr! > 0) {
    const topId = ltifrValues[0].id;
    const name = COMPANIES.find(c => c.id === topId)?.shortName || topId.toUpperCase();
    alerts.push({ icon: '🔺', label: `LTIFR สูงสุด: ${ltifrValues[0].ltifr!.toFixed(2)}`, detail: name, severity: 'warning', companyId: topId });
  }
  // 3. No man-hours but has incidents
  sortedCompanies.forEach(([cId, s]) => {
    const mh = manHoursByCompany[cId];
    if (s.total > 0 && (!mh || mh.total === 0)) {
      const name = COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase();
      alerts.push({ icon: '⚠️', label: 'ไม่มี man-hours แต่มีอุบัติเหตุ', detail: `${name} (${s.total} เหตุ) — TIFR/LTIFR คำนวณไม่ได้`, severity: 'warning', companyId: cId });
    }
  });
  // 4. Highest cost company
  const costSorted = sortedCompanies
    .map(([cId, s]) => ({ cId, cost: s.directCost + s.indirectCost }))
    .filter(x => x.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  if (costSorted.length > 0) {
    const top = costSorted[0];
    const name = COMPANIES.find(c => c.id === top.cId)?.shortName || top.cId.toUpperCase();
    alerts.push({ icon: '💰', label: `ค่าเสียหายสูงสุด: ${top.cost.toLocaleString()} ฿`, detail: name, severity: 'info', companyId: top.cId });
  }

  // Wave B: Previous year data for trend comparison
  const prevYearInc = allIncidents.filter(i => {
    if (selectedYears.length !== 1) return false;
    return i.year === selectedYears[0] - 1;
  });
  const hasPrevYear = selectedYears.length === 1 && prevYearInc.length > 0;
  const prevSummary = hasPrevYear ? (() => {
    const pInc = workRelatedOnly ? prevYearInc.filter(i => i.work_related === 'ใช่') : prevYearInc;
    const injuries = pInc.filter(i => INJURY_TYPES_P.some(p => (i.incident_type || '').includes(p)));
    const lti = pInc.filter(i => { const t = i.incident_type || ''; return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)'; });
    return {
      fatalities: pInc.filter(i => (i.incident_type || '').includes('เสียชีวิต')).length,
      ltiCases: lti.length,
      totalInjuries: injuries.length,
      nearMisses: pInc.filter(i => i.incident_type === 'Near Miss').length,
      totalCost: pInc.reduce((s, i) => s + (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0), 0),
    };
  })() : null;

  // Helper: year preset match check
  const isPresetActive = (preset: number[]) => {
    if (selectedYears.length !== preset.length) return false;
    return preset.every(y => selectedYears.includes(y));
  };

  // Helper: trend arrow
  const trendBadge = (current: number, prev: number | undefined) => {
    if (prev === undefined || prev === null) return null;
    if (current === prev) return <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>→ เท่าเดิม</span>;
    const up = current > prev;
    const diff = Math.abs(current - prev);
    return (
      <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4, color: up ? '#dc2626' : '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {up ? '+' : '-'}{diff} vs ปีก่อน
      </span>
    );
  };

  if (!auth.isAdmin) {
    return (
      <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: 'var(--muted)' }}>Admin only</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-8 pt-6 pb-3" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — HQ Overview
              </h1>
              {/* Secondary: total incidents as subtitle */}
              {!loading && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  อุบัติการณ์ทั้งหมด <strong style={{ color: 'var(--text-primary)' }}>{totalSummary.totalIncidents}</strong> เหตุ • {yearLabel}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Wave A: Year Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>ช่วงเวลา:</span>
              {YEAR_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => { setSelectedYears(preset.years); setShowAdvancedYears(false); }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: isPresetActive(preset.years) ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isPresetActive(preset.years) ? 'rgba(59,130,246,0.08)' : 'transparent',
                    color: isPresetActive(preset.years) ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setShowAdvancedYears(!showAdvancedYears)}
                style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  border: showAdvancedYears ? '1px solid var(--accent)' : '1px dashed var(--border)',
                  background: 'transparent', color: showAdvancedYears ? 'var(--accent)' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {showAdvancedYears ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                เลือกเอง
              </button>
            </div>
            {/* Advanced: individual year checkboxes */}
            {showAdvancedYears && (
              <>
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <div className="flex items-center gap-2">
                  {ALL_YEARS.map(yr => (
                    <label key={yr} className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(yr)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedYears([...selectedYears, yr].sort());
                          } else {
                            const next = selectedYears.filter(y => y !== yr);
                            if (next.length > 0) setSelectedYears(next);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-[12px]" style={{ color: selectedYears.includes(yr) ? 'var(--text-primary)' : 'var(--muted)' }}>{yr}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
            {/* Work-Related Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWorkRelatedOnly(!workRelatedOnly)}
                className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                style={{ background: workRelatedOnly ? 'var(--accent)' : 'var(--border)' }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  style={{ transform: workRelatedOnly ? 'translateX(17px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                />
              </button>
              <span className="text-[12px]" style={{ color: workRelatedOnly ? 'var(--accent)' : 'var(--muted)' }}>เฉพาะจากการทำงาน</span>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted)' }}>
              <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mr-3" />
              กำลังโหลดข้อมูล...
            </div>
          ) : (
            <div>
              {/* ═══ Wave A: "ต้องดูวันนี้" Alert Section ═══ */}
              {alerts.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 16, marginTop: 16 }}>
                  {alerts.map((alert, idx) => {
                    const severityStyle = {
                      critical: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
                      warning: { bg: '#fefce8', border: '#fde68a', color: '#92400e' },
                      info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
                    }[alert.severity];
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderRadius: 10, background: severityStyle.bg, border: `1px solid ${severityStyle.border}`,
                          cursor: alert.companyId ? 'pointer' : 'default',
                        }}
                        onClick={() => { if (alert.companyId) window.open(`/company/${alert.companyId}/incidents`, '_blank'); }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{alert.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: severityStyle.color }}>{alert.label}</div>
                          <div style={{ fontSize: 11, color: severityStyle.color, opacity: 0.8 }}>{alert.detail}</div>
                        </div>
                        {alert.companyId && (
                          <ChevronRight size={14} style={{ color: severityStyle.color, opacity: 0.5, flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ═══ Wave A: Reordered KPI Cards — Severity Priority ═══ */}
              {/* Fatality → LTI → TIFR → LTIFR → ค่าเสียหาย → Near Miss */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" style={{ marginTop: alerts.length > 0 ? 0 : 16 }}>
                {[
                  { label: 'เสียชีวิต', value: totalSummary.fatalities, icon: Users, color: totalSummary.fatalities > 0 ? '#ef4444' : '#9ca3af', emphasis: totalSummary.fatalities > 0, trend: prevSummary ? trendBadge(totalSummary.fatalities, prevSummary.fatalities) : null },
                  { label: 'LTI Cases', value: totalSummary.ltiCases, icon: Clock, color: '#ef4444', emphasis: false, trend: prevSummary ? trendBadge(totalSummary.ltiCases, prevSummary.ltiCases) : null },
                  { label: 'TIFR', value: totalTIFR !== null ? totalTIFR.toFixed(2) : 'N/A', icon: Activity, color: totalTIFR !== null ? '#f97316' : '#9ca3af', emphasis: false, trend: null },
                  { label: 'LTIFR', value: totalLTIFR !== null ? totalLTIFR.toFixed(2) : 'N/A', icon: BarChart3, color: totalLTIFR !== null ? '#ef4444' : '#9ca3af', emphasis: false, trend: null },
                  { label: 'ค่าเสียหายรวม', value: `${((totalSummary.totalDirectCost + totalSummary.totalIndirectCost) / 1000).toFixed(0)}K`, icon: DollarSign, color: '#22c55e', emphasis: false, trend: prevSummary ? trendBadge(totalSummary.totalDirectCost + totalSummary.totalIndirectCost, prevSummary.totalCost) : null },
                  { label: 'Near Miss', value: totalSummary.nearMisses, icon: Shield, color: '#8b5cf6', emphasis: false, trend: prevSummary ? trendBadge(totalSummary.nearMisses, prevSummary.nearMisses) : null },
                ].map((kpi, idx) => (
                  <div key={idx} className="rounded-2xl p-4" style={{
                    background: kpi.emphasis ? '#fef2f2' : 'var(--card-solid)',
                    border: kpi.emphasis ? '2px solid #ef4444' : '1px solid var(--border)',
                    boxShadow: kpi.emphasis ? '0 0 0 3px rgba(239,68,68,0.1)' : undefined,
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                        <kpi.icon size={16} style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{kpi.label}</span>
                      {kpi.trend}
                    </div>
                  </div>
                ))}
              </div>

              {/* Supplementary: Man-hours + Injury count (secondary row) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Man-hours รวม</p>
                  <p className="text-xl font-bold" style={{ color: totalManHours > 0 ? 'var(--text-primary)' : 'var(--muted)' }}>
                    {totalManHours > 0 ? totalManHours.toLocaleString() : 'ยังไม่มีข้อมูล'}
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>บาดเจ็บทั้งหมด</p>
                  <p className="text-xl font-bold" style={{ color: '#f97316' }}>
                    {totalSummary.totalInjuries}
                    {prevSummary && trendBadge(totalSummary.totalInjuries, prevSummary.totalInjuries)}
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>ทรัพย์สินเสียหาย</p>
                  <p className="text-xl font-bold" style={{ color: '#22c55e' }}>
                    {totalSummary.propertyDamage}
                  </p>
                </div>
              </div>

              {/* ═══ Wave B+C: Company Comparison Table — Moved Up ═══ */}
              <div className="rounded-2xl overflow-hidden mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    เปรียบเทียบรายบริษัท — {yearLabel}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {['', 'บริษัท', 'รวม', 'บาดเจ็บ', 'LTI', 'Near Miss', 'ทรัพย์สิน', 'เสียชีวิต', 'TIFR', 'LTIFR', 'ค่าเสียหาย'].map(h => (
                          <th key={h} className="text-left px-3 py-3 font-semibold whitespace-nowrap" style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompanies.map(([companyId, stats], idx) => {
                        const companyName = COMPANIES.find(c => c.id === companyId)?.shortName || companyId.toUpperCase();
                        const hasFatality = stats.fatality > 0;
                        const isTopLtifr = top3LtifrIds.has(companyId);
                        const noManHours = stats.tifr === null && stats.total > 0;
                        // Row highlight logic
                        const rowBg = hasFatality ? '#fef2f2' : isTopLtifr ? '#fefce8' : noManHours ? '#fff7ed' : undefined;
                        const rowBorder = hasFatality ? '#fca5a5' : isTopLtifr ? '#fde68a' : noManHours ? '#fed7aa' : 'var(--border)';
                        // Risk indicator
                        const riskDot = hasFatality ? '🔴' : isTopLtifr ? '🟡' : noManHours ? '🟠' : '';
                        return (
                          <tr
                            key={companyId}
                            style={{
                              borderTop: idx > 0 ? `1px solid ${rowBorder}` : undefined,
                              background: rowBg,
                              cursor: 'pointer',
                            }}
                            onClick={() => window.open(`/company/${companyId}/incidents`, '_blank')}
                            onMouseEnter={e => { if (!rowBg) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            onMouseLeave={e => { if (!rowBg) e.currentTarget.style.background = ''; else e.currentTarget.style.background = rowBg; }}
                          >
                            <td className="px-3 py-3 text-center" style={{ width: 30 }}>{riskDot}</td>
                            <td className="px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>
                              {companyName}
                              {noManHours && <span style={{ fontSize: 9, marginLeft: 4, padding: '1px 4px', borderRadius: 3, background: '#fff7ed', color: '#c2410c', fontWeight: 700 }}>ไม่มี MH</span>}
                            </td>
                            <td className="px-3 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</td>
                            <td className="px-3 py-3" style={{ color: '#f97316' }}>{stats.injuries}</td>
                            <td className="px-3 py-3 font-semibold" style={{ color: stats.lti > 0 ? '#ef4444' : 'var(--muted)' }}>{stats.lti}</td>
                            <td className="px-3 py-3" style={{ color: '#8b5cf6' }}>{stats.nearMiss}</td>
                            <td className="px-3 py-3" style={{ color: '#22c55e' }}>{stats.propertyDamage}</td>
                            <td className="px-3 py-3 font-bold" style={{ color: hasFatality ? '#ef4444' : 'var(--muted)' }}>{stats.fatality}</td>
                            <td className="px-3 py-3 font-mono" style={{ color: stats.tifr !== null ? '#f97316' : 'var(--muted)' }}>
                              {stats.tifr !== null ? stats.tifr.toFixed(2) : 'N/A'}
                            </td>
                            <td className="px-3 py-3 font-mono" style={{ color: stats.ltifr !== null ? (isTopLtifr ? '#dc2626' : '#ef4444') : 'var(--muted)', fontWeight: isTopLtifr ? 700 : undefined }}>
                              {stats.ltifr !== null ? stats.ltifr.toFixed(2) : 'N/A'}
                              {isTopLtifr && <span style={{ fontSize: 9, marginLeft: 3 }}>▲</span>}
                            </td>
                            <td className="px-3 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                              {(stats.directCost + stats.indirectCost).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedCompanies.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                            ไม่พบข้อมูลอุบัติเหตุในปี {yearLabel}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Table legend */}
                {sortedCompanies.length > 0 && (
                  <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 10, color: 'var(--muted)' }}>
                    <span>🔴 มีผู้เสียชีวิต</span>
                    <span>🟡 LTIFR สูงสุด 3 อันดับ</span>
                    <span>🟠 ไม่มี man-hours</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.7 }}>คลิก row เพื่อดูรายละเอียดบริษัท</span>
                  </div>
                )}
              </div>

              {/* ═══ Wave C: Monthly Chart with Toggle ═══ */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    อุบัติการณ์รายเดือน — {chartMode === 'all' ? 'ทุกบริษัท' : `Top 5 บริษัท`} ({yearLabel})
                  </h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[
                      { key: 'all' as const, label: 'รวมทั้งหมด' },
                      { key: 'byCompany' as const, label: 'แยก Top 5' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setChartMode(opt.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: chartMode === opt.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: chartMode === opt.key ? 'rgba(59,130,246,0.08)' : 'transparent',
                          color: chartMode === opt.key ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart: Combined mode */}
                {chartMode === 'all' && (
                  <>
                    <div className="flex items-end gap-2" style={{ height: 180 }}>
                      {MONTHS.map(m => {
                        const d = monthlyData[m] || { total: 0, injuries: 0, nearMiss: 0, propertyDamage: 0 };
                        const h = d.total > 0 ? (d.total / maxMonthly) * 150 : 0;
                        return (
                          <div key={m} className="flex-1 flex flex-col items-center">
                            <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{d.total || ''}</span>
                            <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: Math.max(h, 2) }}>
                              {d.injuries > 0 && <div style={{ height: `${(d.injuries / d.total) * 100}%`, background: '#f97316', minHeight: 2 }} />}
                              {d.nearMiss > 0 && <div style={{ height: `${(d.nearMiss / d.total) * 100}%`, background: '#8b5cf6', minHeight: 2 }} />}
                              {d.propertyDamage > 0 && <div style={{ height: `${(d.propertyDamage / d.total) * 100}%`, background: '#22c55e', minHeight: 2 }} />}
                              {d.total === 0 && <div style={{ height: 2, background: 'var(--border)' }} />}
                            </div>
                            <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-6 mt-4 justify-center">
                      {[
                        { label: 'บาดเจ็บ', color: '#f97316' },
                        { label: 'Near Miss', color: '#8b5cf6' },
                        { label: 'ทรัพย์สิน', color: '#22c55e' },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Chart: By Company (Top 5 stacked) */}
                {chartMode === 'byCompany' && (
                  <>
                    <div className="flex items-end gap-2" style={{ height: 180 }}>
                      {MONTHS.map(m => {
                        const monthTotal = top5Companies.reduce((s, cId) => s + (monthlyByCompany[cId]?.[m] || 0), 0);
                        const h = monthTotal > 0 ? (monthTotal / maxMonthlyByCompany) * 150 : 0;
                        return (
                          <div key={m} className="flex-1 flex flex-col items-center">
                            <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{monthTotal || ''}</span>
                            <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: Math.max(h, 2) }}>
                              {top5Companies.map((cId, ci) => {
                                const val = monthlyByCompany[cId]?.[m] || 0;
                                if (val === 0 || monthTotal === 0) return null;
                                return <div key={cId} style={{ height: `${(val / monthTotal) * 100}%`, background: COMPANY_COLORS[ci], minHeight: 2 }} />;
                              })}
                              {monthTotal === 0 && <div style={{ height: 2, background: 'var(--border)' }} />}
                            </div>
                            <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-4 justify-center flex-wrap">
                      {top5Companies.map((cId, ci) => {
                        const name = COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase();
                        return (
                          <div key={cId} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ background: COMPANY_COLORS[ci] }} />
                            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
