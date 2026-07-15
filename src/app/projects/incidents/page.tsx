'use client';

import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import YearlyTrendChart from '@/components/YearlyTrendChart';
import { useCompanies } from '@/hooks/useCompanies';
import { trimEmptyMonths, MONTH_LABELS_TH } from '@/lib/chart-utils';
import { STATUS, PALETTE } from '@/lib/she-theme';
import {
  AlertTriangle, Activity, Clock, Shield, Users, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Building2, ChevronRight, ChevronDown,
  Skull, Hospital, Wallet, Circle, ArrowUpDown, ChevronUp,
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
  trir: number | null;
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
// Chart company colors — derived from theme palette for consistency
const COMPANY_COLORS = [PALETTE.primary, PALETTE.secondary, STATUS.positive, PALETTE.accent, '#8b5cf6', '#14b8a6', '#ec4899', STATUS.neutral, '#6366f1', '#84cc16'];

export default function HQIncidentsPage() {
  const auth = useAuth();
  const router = useRouter();
  const { companies: COMPANIES } = useCompanies();
  const [selectedYears, setSelectedYears] = useState<number[]>([CURRENT_YEAR]);
  const [manHoursByYearHq, setManHoursByYearHq] = useState<Record<number, number>>({});
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [manHoursByCompany, setManHoursByCompany] = useState<Record<string, { employee: number; contractor: number; total: number }>>({});
  const [showAdvancedYears, setShowAdvancedYears] = useState(false);
  // Wave C: chart toggle
  const [chartMode, setChartMode] = useState<'all' | 'byCompany'>('all');
  // Table filter from alert clicks
  const [tableFilter, setTableFilter] = useState<'all' | 'fatality' | 'lti' | 'highRate' | 'highCost' | 'noMH'>('all');
  // Column sorting
  const [sortCol, setSortCol] = useState<string>('risk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch incidents and manhours for all selected years — ONE bulk request
      // per year per endpoint (the APIs return all companies when companyId is
      // omitted). Previously this looped per company: 17 companies × years × 2
      // endpoints = 34-102 requests per page view.
      const [incResults, mhResults] = await Promise.all([
        Promise.all(selectedYears.map(y =>
          fetch(`/api/incidents?year=${y}&limit=5000`).then(r => r.json())
        )),
        Promise.all(selectedYears.map(y =>
          fetch(`/api/manhours?year=${y}`).then(r => r.json())
        )),
      ]);

      // Merge incidents
      const allInc: Incident[] = [];
      incResults.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
      setAllIncidents(allInc);

      // Merge manhours by company (group client-side)
      const mhMap: Record<string, { employee: number; contractor: number; total: number }> = {};
      mhResults.forEach(r => (r.manHours || []).forEach((row: Record<string, unknown>) => {
        const cid = String(row.company_id || '');
        if (!cid) return;
        if (!mhMap[cid]) mhMap[cid] = { employee: 0, contractor: 0, total: 0 };
        const emp = Number(row.employee_manhours) || 0;
        const con = Number(row.contractor_manhours) || 0;
        mhMap[cid].employee += emp;
        mhMap[cid].contractor += con;
        mhMap[cid].total += emp + con;
      }));
      setManHoursByCompany(mhMap);

      // Manhours grouped by year (for the yearly comparison chart)
      const mhYearMap: Record<number, number> = {};
      mhResults.forEach((r, idx) => {
        const y = selectedYears[idx];
        let t = 0;
        (r.manHours || []).forEach((row: Record<string, unknown>) => {
          t += (Number(row.employee_manhours) || 0) + (Number(row.contractor_manhours) || 0);
        });
        mhYearMap[y] = t;
      });
      setManHoursByYearHq(mhYearMap);
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

  // Yearly comparison trend (all companies combined)
  const hqYearlyTrend = [...selectedYears].sort().map(y => {
    const yInc = baseInc.filter(i => i.year === y);
    const injuries = yInc.filter(i => INJURY_TYPES_P.some(p => (i.incident_type || '').includes(p))).length;
    const lti = yInc.filter(i => { const t = i.incident_type || ''; return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)'; }).length;
    const mh = manHoursByYearHq[y] || 0;
    return {
      year: y,
      mh,
      trir: mh > 0 ? (injuries / mh) * 1000000 : 0,
      ltifr: mh > 0 ? (lti / mh) * 1000000 : 0,
    };
  });

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
        trir: mh && mh.total > 0 ? (injuries.length / mh.total) * 1000000 : null,
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

  // Extended monthly data for sparklines
  const monthlyExt: Record<string, { lti: number; fatality: number; cost: number }> = {};
  MONTHS.forEach(m => { monthlyExt[m] = { lti: 0, fatality: 0, cost: 0 }; });
  baseInc.forEach(inc => {
    const num = parseInt(String(inc.month));
    const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(inc.month);
    if (monthlyExt[m]) {
      if ((inc.incident_type || '').includes('เสียชีวิต') || (inc.incident_type || '').includes('Fatal')) monthlyExt[m].fatality++;
      if ((inc.incident_type || '').includes('LTI') || (inc.incident_type || '').includes('หยุดงาน')) monthlyExt[m].lti++;
      monthlyExt[m].cost += (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0);
    }
  });

  // Convert monthlyData to array and trim empty months
  const monthlyDataArray = MONTHS.map(m => monthlyData[m]);
  const trimmedMonthlyArray = trimEmptyMonths(monthlyDataArray, ['total', 'injuries', 'nearMiss', 'propertyDamage']);
  const trimmedMonthIndices = trimmedMonthlyArray.map((_, idx) => monthlyDataArray.indexOf(_));
  const displayMonths = trimmedMonthIndices.map(idx => MONTHS[idx]);

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

  // Convert monthlyByCompany to array format for trimming
  const monthlyByCompanyArray = MONTHS.map(m =>
    Object.fromEntries(top5Companies.map(cId => [cId, monthlyByCompany[cId][m]]))
  );
  const trimmedByCompanyArray = trimEmptyMonths(monthlyByCompanyArray, top5Companies);
  const displayMonthsByCompany = trimmedByCompanyArray.map((_, idx) => MONTHS[monthlyByCompanyArray.indexOf(_)]);

  const maxMonthlyByCompany = Math.max(
    ...displayMonthsByCompany.map(m => top5Companies.reduce((s, cId) => s + (monthlyByCompany[cId]?.[m] || 0), 0)),
    1
  );

  // Sort companies by risk score (fatality first, then LTI, then LTIFR, then total)
  const getRiskScore = (s: CompanyStat): number => {
    let score = 0;
    score += s.fatality * 100000;
    score += s.lti * 10000;
    score += (s.ltifr || 0) * 100;
    score += s.total;
    return score;
  };
  const sortedCompanies = Object.entries(companyStats).sort((a, b) => getRiskScore(b[1]) - getRiskScore(a[1]));

  // Top 3 LTIFR for table highlights
  const ltifrValues = sortedCompanies
    .map(([id, s]) => ({ id, ltifr: s.ltifr }))
    .filter(x => x.ltifr !== null && x.ltifr! > 0)
    .sort((a, b) => (b.ltifr || 0) - (a.ltifr || 0));
  const top3LtifrIds = new Set(ltifrValues.slice(0, 3).map(x => x.id));

  // Filter table by alert selection
  const tableFiltered = sortedCompanies.filter(([cId, s]) => {
    if (tableFilter === 'all') return true;
    if (tableFilter === 'fatality') return s.fatality > 0;
    if (tableFilter === 'lti') return s.lti > 0;
    if (tableFilter === 'highRate') return top3LtifrIds.has(cId);
    if (tableFilter === 'highCost') return (s.directCost + s.indirectCost) > 0;
    if (tableFilter === 'noMH') return s.trir === null && s.total > 0;
    return true;
  });

  // Column sort
  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const filteredCompanies = useMemo(() => {
    if (sortCol === 'risk') return tableFiltered; // default risk-score order
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...tableFiltered].sort((a, b) => {
      const sa = a[1], sb = b[1];
      const colVal = (s: CompanyStat): number => {
        switch (sortCol) {
          case 'total': return s.total;
          case 'injuries': return s.injuries;
          case 'lti': return s.lti;
          case 'nearMiss': return s.nearMiss;
          case 'propertyDamage': return s.propertyDamage;
          case 'fatality': return s.fatality;
          case 'trir': return s.trir ?? -1;
          case 'ltifr': return s.ltifr ?? -1;
          case 'cost': return s.directCost + s.indirectCost;
          default: return 0;
        }
      };
      return (colVal(sa) - colVal(sb)) * dir;
    });
  }, [tableFiltered, sortCol, sortDir]);

  // Total man-hours
  const totalManHours = Object.values(manHoursByCompany).reduce((sum, mh) => sum + mh.total, 0);
  const totalTRIR = totalManHours > 0 ? (totalSummary.totalInjuries / totalManHours) * 1000000 : null;
  const totalLTIFR = totalManHours > 0 ? (totalSummary.ltiCases / totalManHours) * 1000000 : null;

  const maxMonthly = Math.max(...displayMonths.map(m => monthlyData[m]?.total || 0), 1);
  const yearLabel = selectedYears.length === 1 ? String(selectedYears[0]) : `${selectedYears[0]}-${selectedYears[selectedYears.length - 1]}`;

  // "ต้องดูวันนี้" alerts — with table filter key
  type AlertFilterKey = 'fatality' | 'lti' | 'highRate' | 'highCost' | 'noMH';
  const alerts: { icon: ReactNode; label: string; detail: string; severity: 'critical' | 'warning' | 'info'; companyId?: string; filterKey: AlertFilterKey }[] = [];

  // 1. Fatality > 0
  const fatalCompanies = sortedCompanies.filter(([, s]) => s.fatality > 0);
  if (fatalCompanies.length > 0) {
    const totalFatal = fatalCompanies.reduce((s, [, st]) => s + st.fatality, 0);
    const names = fatalCompanies.map(([cId]) => COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase()).join(', ');
    alerts.push({ icon: <Skull size={16} />, label: `มีผู้เสียชีวิต ${totalFatal} ราย`, detail: names, severity: 'critical', filterKey: 'fatality' });
  }
  // 2. Companies with LTI > 0
  const ltiCompanies = sortedCompanies.filter(([, s]) => s.lti > 0);
  if (ltiCompanies.length > 0) {
    const totalLti = ltiCompanies.reduce((s, [, st]) => s + st.lti, 0);
    alerts.push({ icon: <Hospital size={16} />, label: `LTI ${totalLti} ราย (${ltiCompanies.length} บริษัท)`, detail: ltiCompanies.slice(0, 3).map(([cId]) => COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase()).join(', ') + (ltiCompanies.length > 3 ? ` +${ltiCompanies.length - 3}` : ''), severity: 'critical', filterKey: 'lti' });
  }
  // 3. Highest LTIFR
  if (ltifrValues.length > 0 && ltifrValues[0].ltifr! > 0) {
    const topId = ltifrValues[0].id;
    const name = COMPANIES.find(c => c.id === topId)?.shortName || topId.toUpperCase();
    alerts.push({ icon: <TrendingUp size={16} />, label: `LTIFR สูงสุด: ${ltifrValues[0].ltifr!.toFixed(2)}`, detail: name, severity: 'warning', filterKey: 'highRate' });
  }
  // 4. No man-hours but has incidents
  const noMHCompanies = sortedCompanies.filter(([cId, s]) => s.total > 0 && (!manHoursByCompany[cId] || manHoursByCompany[cId].total === 0));
  if (noMHCompanies.length > 0) {
    const names = noMHCompanies.map(([cId]) => COMPANIES.find(c => c.id === cId)?.shortName || cId.toUpperCase()).join(', ');
    alerts.push({ icon: <AlertTriangle size={16} />, label: `ไม่มี man-hours (${noMHCompanies.length} บริษัท)`, detail: `${names} — TRIR/LTIFR คำนวณไม่ได้`, severity: 'warning', filterKey: 'noMH' });
  }
  // 5. Highest cost company
  const costSorted = sortedCompanies
    .map(([cId, s]) => ({ cId, cost: s.directCost + s.indirectCost }))
    .filter(x => x.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  if (costSorted.length > 0) {
    const top = costSorted[0];
    const name = COMPANIES.find(c => c.id === top.cId)?.shortName || top.cId.toUpperCase();
    alerts.push({ icon: <Wallet size={16} />, label: `ค่าเสียหายสูงสุด: ${top.cost.toLocaleString()} ฿`, detail: name, severity: 'info', filterKey: 'highCost' });
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

  // Per-company previous year stats for delta comparison
  const prevCompanyStats: Record<string, { total: number; lti: number; cost: number }> = {};
  if (hasPrevYear) {
    const pInc = workRelatedOnly ? prevYearInc.filter(i => i.work_related === 'ใช่') : prevYearInc;
    COMPANIES.forEach(c => {
      const cInc = pInc.filter(i => i.company_id === c.id);
      if (cInc.length > 0) {
        const lti = cInc.filter(i => { const t = i.incident_type || ''; return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)'; });
        prevCompanyStats[c.id] = {
          total: cInc.length,
          lti: lti.length,
          cost: cInc.reduce((s, i) => s + (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0), 0),
        };
      }
    });
  }

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

  /* ── Auth gate: company users → redirect to their company page ── */
  const companyKeys = Object.keys(auth.companyAuth);
  if (!auth.isAdmin && companyKeys.length > 0) {
    router.push(`/projects/incidents/${companyKeys[0]}`);
    return null;
  }
  if (!auth.isAdmin) {
    return (
      <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: 'var(--muted)' }}>กรุณาเข้าสู่ระบบ</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
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
                <div style={{ marginBottom: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ color: '#dc2626' }} /> ต้องดูวันนี้
                    {tableFilter !== 'all' && (
                      <button onClick={() => setTableFilter('all')} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer', marginLeft: 8 }}>
                        ล้าง filter ตาราง
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                    {alerts.map((alert, idx) => {
                      const severityStyle = {
                        critical: { bg: `${STATUS.critical}10`, border: `${STATUS.critical}40`, color: STATUS.critical },
                        warning: { bg: `${STATUS.warning}10`, border: `${STATUS.warning}40`, color: STATUS.warning },
                        info: { bg: `${PALETTE.primary}10`, border: `${PALETTE.primary}40`, color: PALETTE.primary },
                      }[alert.severity];
                      const isActive = tableFilter === alert.filterKey;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            borderRadius: 10, background: isActive ? severityStyle.color : severityStyle.bg,
                            border: `2px solid ${isActive ? severityStyle.color : severityStyle.border}`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onClick={() => setTableFilter(isActive ? 'all' : alert.filterKey)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', color: isActive ? '#fff' : severityStyle.color, flexShrink: 0 }}>{alert.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#fff' : severityStyle.color }}>{alert.label}</div>
                            <div style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.8)' : severityStyle.color, opacity: isActive ? 1 : 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.detail}</div>
                          </div>
                          <ChevronRight size={14} style={{ color: isActive ? '#fff' : severityStyle.color, opacity: 0.5, flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══ Tier 1: Hero — Fatality (most critical metric) ═══ */}
              <div className="mb-4" style={{ marginTop: alerts.length > 0 ? 0 : 16 }}>
                <div className="glass-card rounded-2xl p-5" style={{
                  background: totalSummary.fatalities > 0 ? 'rgba(194,59,34,0.08)' : 'rgba(43,140,62,0.08)',
                  border: `2px solid ${totalSummary.fatalities > 0 ? '#C23B22' : '#2B8C3E'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: totalSummary.fatalities > 0 ? 'rgba(194,59,34,0.15)' : 'rgba(43,140,62,0.15)' }}>
                      <Users size={24} style={{ color: totalSummary.fatalities > 0 ? '#C23B22' : '#2B8C3E' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="text-[11px] uppercase tracking-[0.08em] font-semibold" style={{ color: 'var(--muted)' }}>ผู้เสียชีวิตจากการทำงาน</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <span style={{ fontSize: 40, fontWeight: 700, color: totalSummary.fatalities > 0 ? '#C23B22' : '#2B8C3E', lineHeight: 1.1 }}>{totalSummary.fatalities}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: totalSummary.fatalities > 0 ? '#C23B22' : '#2B8C3E' }}>
                          {totalSummary.fatalities > 0 ? 'ราย — ต้องสอบสวนทันที' : 'ราย — ปลอดภัย ไม่มีผู้เสียชีวิต'}
                        </span>
                        {prevSummary && trendBadge(totalSummary.fatalities, prevSummary.fatalities)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ Tier 2: Key Safety Rates — TRIR + LTIFR with targets ═══ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {[
                  { label: 'TRIR', value: totalTRIR !== null ? totalTRIR.toFixed(2) : 'N/A', target: 3.0, icon: Activity, subtitle: totalTRIR === null ? 'ไม่มี man-hours' : `MH: ${Math.round(totalManHours).toLocaleString()}` },
                  { label: 'LTIFR', value: totalLTIFR !== null ? totalLTIFR.toFixed(2) : 'N/A', target: 1.0, icon: BarChart3, subtitle: totalLTIFR === null ? 'ไม่มี man-hours' : `LTI: ${totalSummary.ltiCases}` },
                ].map((kpi, idx) => {
                  const numVal = parseFloat(String(kpi.value));
                  const aboveTarget = !isNaN(numVal) && numVal > kpi.target;
                  const rateColor = kpi.value === 'N/A' ? '#9ca3af' : aboveTarget ? '#F28E2B' : '#2B8C3E';
                  return (
                    <div key={idx} className="glass-card rounded-2xl p-4" style={{ borderLeft: `3px solid ${rateColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${rateColor}18` }}>
                          <kpi.icon size={16} style={{ color: rateColor }} />
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--muted)' }}>{kpi.label}</span>
                      </div>
                      <p style={{ fontSize: 28, fontWeight: 700, color: rateColor, lineHeight: 1 }}>{kpi.value}</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>เป้า: &lt;{kpi.target.toFixed(1)}</span>
                        {!isNaN(numVal) && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: aboveTarget ? '#F28E2B' : '#2B8C3E' }}>
                            {aboveTarget ? '↑ เกินเป้า' : '↓ ในเป้าหมาย'}
                          </span>
                        )}
                      </div>
                      {kpi.subtitle && <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{kpi.subtitle}</p>}
                    </div>
                  );
                })}
              </div>

              {/* ═══ Tier 3: Supporting KPIs (compact row) with sparklines ═══ */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                  { label: 'LTI Cases', value: totalSummary.ltiCases, icon: Clock, color: STATUS.critical, trend: prevSummary ? trendBadge(totalSummary.ltiCases, prevSummary.ltiCases) : null, spark: displayMonths.map(m => monthlyExt[m]?.lti || 0) },
                  { label: 'ค่าเสียหายรวม', value: `${((totalSummary.totalDirectCost + totalSummary.totalIndirectCost) / 1000).toFixed(0)}K`, icon: DollarSign, color: STATUS.warning, trend: prevSummary ? trendBadge(totalSummary.totalDirectCost + totalSummary.totalIndirectCost, prevSummary.totalCost) : null, spark: displayMonths.map(m => monthlyExt[m]?.cost || 0) },
                  { label: 'Near Miss', value: totalSummary.nearMisses, icon: Shield, color: PALETTE.primary, trend: prevSummary ? trendBadge(totalSummary.nearMisses, prevSummary.nearMisses) : null, spark: displayMonths.map(m => monthlyData[m]?.nearMiss || 0) },
                  { label: 'Man-hours', value: totalManHours > 0 ? Math.round(totalManHours).toLocaleString() : 'N/A', icon: Activity, color: totalManHours > 0 ? 'var(--text-primary)' : STATUS.neutral, trend: null, spark: [] as number[] },
                  { label: 'บาดเจ็บทั้งหมด', value: totalSummary.totalInjuries, icon: Users, color: STATUS.warning, trend: prevSummary ? trendBadge(totalSummary.totalInjuries, prevSummary.totalInjuries) : null, spark: displayMonths.map(m => monthlyData[m]?.injuries || 0) },
                  { label: 'ทรัพย์สินเสียหาย', value: totalSummary.propertyDamage, icon: Building2, color: STATUS.positive, trend: null, spark: displayMonths.map(m => monthlyData[m]?.propertyDamage || 0) },
                ].map((kpi, idx) => {
                  const sparkMax = Math.max(...kpi.spark, 1);
                  return (
                    <div key={idx} className="glass-card rounded-2xl p-3">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <kpi.icon size={12} style={{ color: kpi.color }} />
                        <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--muted)' }}>{kpi.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                        {kpi.trend}
                      </div>
                      {kpi.spark.length > 0 && kpi.spark.some(v => v > 0) && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 20, marginTop: 6 }}>
                          {kpi.spark.map((v, si) => (
                            <div key={si} style={{
                              flex: 1, minWidth: 2,
                              height: v > 0 ? Math.max((v / sparkMax) * 18, 2) : 0,
                              background: v > 0 ? `${kpi.color}60` : 'transparent',
                              borderRadius: '1px 1px 0 0',
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ═══ Yearly comparison — TRIR / LTIFR / Manhours ═══ */}
              <div className="mb-6">
                <YearlyTrendChart data={hqYearlyTrend} />
              </div>

              {/* ═══ Quick Manhours Entry (Admin) ═══ */}
              <div className="glass-card rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)', padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(10,132,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={14} color="#0a84ff" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>บันทึก Manhours</div>
                      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>คลิกบริษัทเพื่อเปิดตารางบันทึก</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {COMPANIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/projects/incidents/${c.id}/manhours`)}
                        className="text-[11px] font-semibold transition-all"
                        style={{
                          padding: '5px 11px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(10,132,255,0.1)';
                          e.currentTarget.style.borderColor = '#0a84ff';
                          e.currentTarget.style.color = '#0a84ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                      >
                        {c.shortName || c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ═══ Company Comparison Table — Triage-First ═══ */}
              <div className="glass-card rounded-2xl overflow-hidden mb-6">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    เปรียบเทียบรายบริษัท — {yearLabel}
                    {tableFilter !== 'all' && (
                      <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
                        {tableFilter === 'fatality' ? 'มีผู้เสียชีวิต' : tableFilter === 'lti' ? 'มี LTI' : tableFilter === 'highRate' ? 'Rate สูง' : tableFilter === 'highCost' ? 'ค่าเสียหาย' : 'ไม่มี MH'}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      เรียงตาม {sortCol === 'risk' ? 'Risk Score' : sortCol.toUpperCase()} {sortCol !== 'risk' && (sortDir === 'asc' ? '↑' : '↓')}
                    </span>
                    {sortCol !== 'risk' && (
                      <button onClick={() => { setSortCol('risk'); setSortDir('desc'); }} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer', marginLeft: 4 }}>
                        Reset
                      </button>
                    )}
                    {tableFilter !== 'all' && (
                      <button onClick={() => setTableFilter('all')} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer' }}>
                        แสดงทั้งหมด
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {([
                          { key: '', label: '' },
                          { key: 'company', label: 'บริษัท' },
                          { key: 'total', label: 'รวม' },
                          { key: 'injuries', label: 'บาดเจ็บ' },
                          { key: 'lti', label: 'LTI' },
                          { key: 'nearMiss', label: 'Near Miss' },
                          { key: 'propertyDamage', label: 'ทรัพย์สิน' },
                          { key: 'fatality', label: 'เสียชีวิต' },
                          { key: 'trir', label: 'TRIR' },
                          { key: 'ltifr', label: 'LTIFR' },
                          { key: 'cost', label: 'ค่าเสียหาย' },
                          ...(hasPrevYear ? [{ key: 'delta', label: 'Δ ปีก่อน' }] : []),
                        ] as { key: string; label: string }[]).map(h => {
                          const sortable = !['', 'company', 'delta'].includes(h.key);
                          const isActive = sortCol === h.key;
                          return (
                            <th
                              key={h.key || h.label}
                              className="text-left px-3 py-3 font-semibold whitespace-nowrap"
                              style={{ color: isActive ? 'var(--accent)' : 'var(--muted)', fontSize: 11, cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }}
                              onClick={() => sortable && handleSort(h.key)}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                {h.label}
                                {sortable && (
                                  isActive
                                    ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                                    : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />
                                )}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map(([companyId, stats], idx) => {
                        const companyName = COMPANIES.find(c => c.id === companyId)?.shortName || companyId.toUpperCase();
                        const hasFatality = stats.fatality > 0;
                        const isTopLtifr = top3LtifrIds.has(companyId);
                        const noManHours = stats.trir === null && stats.total > 0;
                        // Row highlight logic
                        const rowBg = hasFatality ? '#fef2f2' : isTopLtifr ? '#fefce8' : noManHours ? '#fff7ed' : undefined;
                        const rowBorder = hasFatality ? '#fca5a5' : isTopLtifr ? '#fde68a' : noManHours ? '#fed7aa' : 'var(--border)';
                        // Risk indicator
                        const riskDot = hasFatality
                          ? <Circle size={10} fill={STATUS.critical} color={STATUS.critical} />
                          : isTopLtifr
                            ? <Circle size={10} fill={STATUS.warning} color={STATUS.warning} />
                            : noManHours
                              ? <Circle size={10} fill="#f97316" color="#f97316" />
                              : null;
                        // Per-company delta
                        const prev = prevCompanyStats[companyId];
                        const deltaTotal = prev ? stats.total - prev.total : null;
                        const deltaLti = prev ? stats.lti - prev.lti : null;
                        return (
                          <tr
                            key={companyId}
                            style={{
                              borderTop: idx > 0 ? `1px solid ${rowBorder}` : undefined,
                              background: rowBg,
                              cursor: 'pointer',
                            }}
                            onClick={() => router.push(`/projects/incidents/${companyId}`)}
                            onMouseEnter={e => { if (!rowBg) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            onMouseLeave={e => { if (!rowBg) e.currentTarget.style.background = ''; else e.currentTarget.style.background = rowBg; }}
                          >
                            <td className="px-3 py-3 text-center" style={{ width: 30 }}>{riskDot}</td>
                            <td className="px-3 py-3 font-semibold" style={{ color: 'var(--accent)' }}>
                              {companyName}
                              {noManHours && <span style={{ fontSize: 9, marginLeft: 4, padding: '1px 4px', borderRadius: 3, background: '#fff7ed', color: '#c2410c', fontWeight: 700 }}>ไม่มี MH</span>}
                            </td>
                            <td className="px-3 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</td>
                            <td className="px-3 py-3" style={{ color: STATUS.warning }}>{stats.injuries}</td>
                            <td className="px-3 py-3 font-semibold" style={{ color: stats.lti > 0 ? STATUS.critical : 'var(--muted)' }}>{stats.lti}</td>
                            <td className="px-3 py-3" style={{ color: PALETTE.primary }}>{stats.nearMiss}</td>
                            <td className="px-3 py-3" style={{ color: STATUS.positive }}>{stats.propertyDamage}</td>
                            <td className="px-3 py-3 font-bold" style={{ color: hasFatality ? STATUS.critical : 'var(--muted)' }}>{stats.fatality}</td>
                            <td className="px-3 py-3 font-mono" style={{ color: stats.trir !== null ? STATUS.warning : 'var(--muted)' }}>
                              {stats.trir !== null ? stats.trir.toFixed(2) : (
                                <span title="ไม่มีข้อมูล man-hours จึงคำนวณไม่ได้" style={{ cursor: 'help', borderBottom: '1px dashed var(--muted)' }}>N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono" style={{ color: stats.ltifr !== null ? (isTopLtifr ? STATUS.critical : STATUS.warning) : 'var(--muted)', fontWeight: isTopLtifr ? 700 : undefined }}>
                              {stats.ltifr !== null ? stats.ltifr.toFixed(2) : (
                                <span title="ไม่มีข้อมูล man-hours จึงคำนวณไม่ได้" style={{ cursor: 'help', borderBottom: '1px dashed var(--muted)' }}>N/A</span>
                              )}
                              {isTopLtifr && <span style={{ fontSize: 9, marginLeft: 3 }}>▲</span>}
                            </td>
                            <td className="px-3 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                              {(stats.directCost + stats.indirectCost).toLocaleString()}
                            </td>
                            {hasPrevYear && (
                              <td className="px-3 py-3" style={{ fontSize: 10 }}>
                                {prev ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <span style={{ color: deltaTotal !== null && deltaTotal > 0 ? '#dc2626' : deltaTotal !== null && deltaTotal < 0 ? '#16a34a' : 'var(--muted)', fontWeight: 600 }}>
                                      {deltaTotal !== null ? (deltaTotal > 0 ? `+${deltaTotal}` : deltaTotal === 0 ? '=' : `${deltaTotal}`) : '-'} เหตุ
                                    </span>
                                    {deltaLti !== null && deltaLti !== 0 && (
                                      <span style={{ color: deltaLti > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                        {deltaLti > 0 ? `+${deltaLti}` : `${deltaLti}`} LTI
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลปีก่อน</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {filteredCompanies.length === 0 && (
                        <tr>
                          <td colSpan={hasPrevYear ? 12 : 11} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                            {tableFilter !== 'all' ? 'ไม่มีบริษัทตรงกับเงื่อนไข' : `ไม่พบข้อมูลอุบัติเหตุในปี ${yearLabel}`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Table legend */}
                {filteredCompanies.length > 0 && (
                  <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Circle size={8} fill={STATUS.critical} color={STATUS.critical} /> มีผู้เสียชีวิต</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Circle size={8} fill={STATUS.warning} color={STATUS.warning} /> LTIFR สูงสุด 3 อันดับ</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Circle size={8} fill="#f97316" color="#f97316" /> ไม่มี man-hours</span>
                    <span>N/A = ไม่มีข้อมูล man-hours</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.7 }}>คลิก row เพื่อดูรายละเอียดบริษัท</span>
                  </div>
                )}
              </div>

              {/* ═══ Wave C: Monthly Chart with Toggle ═══ */}
              <div className="glass-card rounded-2xl p-5 mb-6">
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

                {/* Chart: Combined mode — Grouped bar with y-axis gridlines */}
                {chartMode === 'all' && (
                  <>
                    {(() => {
                      const chartH = 160;
                      // Compute nice y-axis ticks
                      const rawMax = Math.max(...displayMonths.map(m => {
                        const d = monthlyData[m] || { injuries: 0, nearMiss: 0, propertyDamage: 0 };
                        return Math.max(d.injuries, d.nearMiss, d.propertyDamage);
                      }), 1);
                      const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : 10;
                      const yMax = Math.ceil(rawMax / step) * step || step;
                      const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

                      return (
                        <div style={{ display: 'flex', height: chartH + 28 }}>
                          {/* Y-axis labels */}
                          <div style={{ width: 28, position: 'relative', marginRight: 4, flexShrink: 0 }}>
                            {ticks.map(t => (
                              <span key={t} style={{
                                position: 'absolute', right: 2,
                                bottom: (t / yMax) * chartH + 20,
                                fontSize: 9, color: 'var(--muted)', lineHeight: 1, transform: 'translateY(50%)',
                              }}>{t}</span>
                            ))}
                          </div>
                          {/* Chart area */}
                          <div style={{ flex: 1, position: 'relative' }}>
                            {/* Gridlines */}
                            {ticks.map(t => (
                              <div key={t} style={{
                                position: 'absolute', left: 0, right: 0,
                                bottom: (t / yMax) * chartH + 20,
                                height: 1, background: PALETTE.grid,
                              }} />
                            ))}
                            {/* Grouped bars */}
                            <div style={{ display: 'flex', gap: 6, height: chartH + 28, alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
                              {displayMonths.map(m => {
                                const d = monthlyData[m] || { total: 0, injuries: 0, nearMiss: 0, propertyDamage: 0 };
                                const categories = [
                                  { val: d.injuries, color: STATUS.warning },
                                  { val: d.nearMiss, color: PALETTE.primary },
                                  { val: d.propertyDamage, color: STATUS.positive },
                                ];
                                return (
                                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {/* Grouped bars for this month */}
                                    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: chartH }}>
                                      {categories.map((cat, ci) => {
                                        const h = cat.val > 0 ? (cat.val / yMax) * chartH : 0;
                                        return (
                                          <div key={ci} style={{
                                            flex: 1, maxWidth: 18, minWidth: 4,
                                            height: Math.max(h, cat.val > 0 ? 3 : 0),
                                            background: cat.color, borderRadius: '3px 3px 0 0',
                                            position: 'relative',
                                          }}
                                            title={`${['บาดเจ็บ', 'Near Miss', 'ทรัพย์สิน'][ci]}: ${cat.val}`}
                                          >
                                            {cat.val > 0 && (
                                              <span style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {cat.val}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <span style={{ fontSize: 10, marginTop: 4, color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex gap-6 mt-4 justify-center">
                      {[
                        { label: 'บาดเจ็บ', color: STATUS.warning },
                        { label: 'Near Miss', color: PALETTE.primary },
                        { label: 'ทรัพย์สิน', color: STATUS.positive },
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
                      {displayMonthsByCompany.map(m => {
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
