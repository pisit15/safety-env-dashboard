'use client';

import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import YearlyTrendChart from '@/components/YearlyTrendChart';
import { TRIR_TARGET, TRIR_TARGET_LABEL, LTIFR_TARGET, LTIFR_TARGET_LABEL } from '@/lib/she-targets';
import HqInjuryAnalytics, { HqInjuredPerson, HqIncidentMeta } from './components/HqInjuryAnalytics';
import YearlyCasesChart from '@/components/YearlyCasesChart';
import { FACTORY_COMPANY_IDS, BUSINESS_UNITS } from '@/lib/companies';
import MonthlyByYearChart from '@/components/MonthlyByYearChart';
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
  const [manHoursByYearHq, setManHoursByYearHq] = useState<Record<number, Record<string, { employee: number; contractor: number }>>>({});
  const [hqInjured, setHqInjured] = useState<{ persons: HqInjuredPerson[]; map: Record<string, HqIncidentMeta> }>({ persons: [], map: {} });
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  // 'all' | 'employee' | 'contractor' — scopes counts and rates across the whole overview
  const [personFilter, setPersonFilter] = useState<'all' | 'employee' | 'contractor'>('all');
  const [monthlyCaseType, setMonthlyCaseType] = useState<'all' | 'trc' | 'lti'>('all');
  // Business Unit scope — quick modes ('all' | 'factory' | 'nonfactory')
  // + multi-select sub-BU keys (e.g. เลือก พลังงานลม + โซล่าร์ พร้อมกันได้)
  const [buFilter, setBuFilter] = useState<string>('all');
  const [buKeys, setBuKeys] = useState<string[]>([]);
  const isFactory = (cid: string) => FACTORY_COMPANY_IDS.includes(cid);
  const inBu = (cid: string) => {
    if (buKeys.length > 0) {
      return BUSINESS_UNITS.some(b => buKeys.includes(b.key) && b.companyIds.includes(cid));
    }
    if (buFilter === 'all') return true;
    if (buFilter === 'factory') return isFactory(cid);
    if (buFilter === 'nonfactory') return !isFactory(cid);
    return true;
  };
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [manHoursByCompany, setManHoursByCompany] = useState<Record<string, { employee: number; contractor: number; total: number }>>({});
  const [showAdvancedYears, setShowAdvancedYears] = useState(false);
  // Wave C: chart toggle
  const [chartMode, setChartMode] = useState<'all' | 'byCompany'>('all');
  // Property damage comparison charts (company × year)
  const [pdMetric, setPdMetric] = useState<'cost' | 'count'>('cost');
  const [pdEventMode, setPdEventMode] = useState<'select' | 'stack'>('select');
  const [pdEventSel, setPdEventSel] = useState<string>('ทั้งหมด');
  // Drill-down: click a bar → list the underlying incidents
  const [pdDrill, setPdDrill] = useState<{ title: string; items: Incident[] } | null>(null);
  // Click an incident no → read-only case detail inside the modal (+ photos fetched on open)
  const [pdCase, setPdCase] = useState<Incident | null>(null);
  const [pdCasePhotos, setPdCasePhotos] = useState<{ file_url: string; photo_type?: string; caption?: string }[] | null>(null);
  const [pdImgView, setPdImgView] = useState<string | null>(null);
  const openPdCase = (i: Incident) => {
    setPdCase(i);
    setPdCasePhotos(null);
    fetch(`/api/incidents/photos?incident_no=${encodeURIComponent(i.incident_no)}`)
      .then(r => r.json())
      .then(d => setPdCasePhotos(d.photos || []))
      .catch(() => setPdCasePhotos([]));
  };
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
      const [incResults, mhResults, injuredRes] = await Promise.all([
        Promise.all(selectedYears.map(y =>
          fetch(`/api/incidents?year=${y}&limit=5000`).then(r => r.json())
        )),
        Promise.all(selectedYears.map(y =>
          fetch(`/api/manhours?year=${y}`).then(r => r.json())
        )),
        // Group-wide injured-person details for the injury analytics section
        fetch(`/api/incidents/dashboard?companyId=all&years=${selectedYears.join(',')}`)
          .then(r => r.json())
          .catch(() => ({})),
      ]);

      setHqInjured({
        persons: injuredRes.injuredPersons || [],
        map: injuredRes.injuredIncidentMap || {},
      });

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

      // Manhours grouped by year+company (for the yearly comparison chart, BU-scopable)
      const mhYearMap: Record<number, Record<string, { employee: number; contractor: number }>> = {};
      mhResults.forEach((r, idx) => {
        const y = selectedYears[idx];
        mhYearMap[y] = {};
        (r.manHours || []).forEach((row: Record<string, unknown>) => {
          const cid = String(row.company_id || '');
          if (!cid) return;
          if (!mhYearMap[y][cid]) mhYearMap[y][cid] = { employee: 0, contractor: 0 };
          mhYearMap[y][cid].employee += Number(row.employee_manhours) || 0;
          mhYearMap[y][cid].contractor += Number(row.contractor_manhours) || 0;
        });
      });
      setManHoursByYearHq(mhYearMap);
    } catch { /* empty */ }
    setLoading(false);
  }, [selectedYears]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered by workRelatedOnly
  const INJURY_TYPES_P = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'];
  const baseInc = (workRelatedOnly ? allIncidents.filter(i => i.work_related === 'ใช่') : allIncidents)
    .filter(i => inBu(i.company_id))
    .filter(i => personFilter === 'all' ? true
      : personFilter === 'employee' ? (i.person_type || '').includes('พนักงาน')
      : (i.person_type || '').includes('ผู้รับเหมา'));

  // Manhours scoped to the selected person group
  const mhOf = (mh: { employee: number; contractor: number; total: number } | undefined) =>
    !mh ? 0 : personFilter === 'employee' ? mh.employee : personFilter === 'contractor' ? mh.contractor : mh.total;

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
    const mhY = manHoursByYearHq[y] || {};
    let emp = 0, con = 0;
    Object.entries(mhY).forEach(([cid, v]) => { if (inBu(cid)) { emp += v.employee; con += v.contractor; } });
    const mh = personFilter === 'employee' ? emp : personFilter === 'contractor' ? con : emp + con;
    return {
      year: y,
      mh,
      trir: mh > 0 ? (injuries / mh) * 1000000 : 0,
      ltifr: mh > 0 ? (lti / mh) * 1000000 : 0,
      total: yInc.length,
      injuries,
      lti,
    };
  });

  // Monthly counts per year (all companies combined)
  // Case-type filter for the monthly comparison chart (ทั้งหมด / TRC / LTI)
  const matchMonthlyCaseType = (i: { incident_type?: string }): boolean => {
    const t = i.incident_type || '';
    if (monthlyCaseType === 'trc') return INJURY_TYPES_P.some(p => t.includes(p));
    if (monthlyCaseType === 'lti') return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
    return true;
  };
  const hqMonthlyByYear = [...selectedYears].sort().map(y => {
    const counts = new Array(12).fill(0);
    baseInc.filter(i => i.year === y && matchMonthlyCaseType(i)).forEach(i => {
      let idx = -1;
      const mNum = parseInt(String(i.month));
      if (mNum >= 1 && mNum <= 12) idx = mNum - 1;
      else if (MONTHS.includes(String(i.month))) idx = MONTHS.indexOf(String(i.month));
      else if (i.incident_date) idx = new Date(i.incident_date).getMonth();
      if (idx >= 0 && idx < 12) counts[idx]++;
    });
    return { year: y, counts };
  });

  // Cumulative series per case type (TRC / LTI) — independent of the toggle above
  const monthIdxOf = (i: { month?: unknown; incident_date?: string }): number => {
    const mNum = parseInt(String(i.month));
    if (mNum >= 1 && mNum <= 12) return mNum - 1;
    if (MONTHS.includes(String(i.month))) return MONTHS.indexOf(String(i.month));
    if (i.incident_date) return new Date(i.incident_date).getMonth();
    return -1;
  };
  const cumSeriesFor = (type: 'trc' | 'lti') => [...selectedYears].sort().map(y => {
    const counts = new Array(12).fill(0);
    baseInc.filter(i => {
      if (i.year !== y) return false;
      const t = i.incident_type || '';
      return type === 'trc'
        ? INJURY_TYPES_P.some(p => t.includes(p))
        : (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
    }).forEach(i => {
      const idx = monthIdxOf(i);
      if (idx >= 0 && idx < 12) counts[idx]++;
    });
    let run = 0;
    return { year: y, counts: counts.map(c => (run += c)) };
  });
  const hqCumTrc = cumSeriesFor('trc');
  const hqCumLti = cumSeriesFor('lti');

  // Drill-down helpers for injury charts (ใช้ modal เดียวกับ property damage)
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const isTrcT = (t: string) => INJURY_TYPES_P.some(p => t.includes(p));
  const isLtiT = (t: string) => (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
  const openCaseDrill = (title: string, items: Incident[]) => {
    const sorted = [...items].sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
    setPdDrill({ title: `${title} — ${sorted.length} เหตุ`, items: sorted });
  };
  const drillMonthly = (y: number, m: number) => {
    const label = monthlyCaseType === 'all' ? 'ทุกประเภท' : monthlyCaseType === 'trc' ? 'TRC' : 'LTI';
    openCaseDrill(`${TH_M[m]} ${y} · ${label}`, baseInc.filter(i => i.year === y && monthIdxOf(i) === m && matchMonthlyCaseType(i)));
  };
  const drillCum = (kind: 'trc' | 'lti') => (y: number, m: number) => {
    const match = kind === 'trc' ? isTrcT : isLtiT;
    openCaseDrill(`สะสม ม.ค.–${TH_M[m]} ${y} · ${kind.toUpperCase()}`, baseInc.filter(i => i.year === y && monthIdxOf(i) <= m && match(i.incident_type || '')));
  };
  const drillYearly = (y: number, kind: 'trc' | 'lti') => {
    const match = kind === 'trc' ? isTrcT : isLtiT;
    openCaseDrill(`${y} · ${kind.toUpperCase()}`, baseInc.filter(i => i.year === y && match(i.incident_type || '')));
  };

  // Per-company stats (only companies in the selected BU)
  const companyStats: Record<string, CompanyStat> = {};
  COMPANIES.forEach(c => {
    if (!inBu(c.id)) return;
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
        trir: mhOf(mh) > 0 ? (injuries.length / mhOf(mh)) * 1000000 : null,
        ltifr: mhOf(mh) > 0 ? (lti.length / mhOf(mh)) * 1000000 : null,
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

  // Total man-hours (scoped to the selected person group + BU)
  const totalManHours = Object.entries(manHoursByCompany)
    .filter(([cid]) => inBu(cid))
    .reduce((sum, [, mh]) => sum + mhOf(mh), 0);
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
            <Link href="/projects/incidents/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              ⚙ ตั้งค่ารายการจำแนก
            </Link>
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

            {/* Person-type scope — employees / contractors / combined */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold mr-0.5" style={{ color: 'var(--muted)' }}>กลุ่ม:</span>
              {([['all', 'รวม'], ['employee', 'พนักงาน'], ['contractor', 'ผู้รับเหมา']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPersonFilter(k)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: personFilter === k ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: personFilter === k ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${personFilter === k ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Business Unit scope — Factory / Non-Factory + sub-BUs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold mr-0.5" style={{ color: 'var(--muted)' }}>BU:</span>
              {([['all', 'ทั้งหมด'], ['factory', 'Factory'], ['nonfactory', 'Non-Factory']] as const).map(([k, label]) => {
                const active = buKeys.length === 0 && buFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => { setBuFilter(k); setBuKeys([]); }}
                    title={k === 'factory' ? 'AMT, AAB, MMC, EA Kabin, EBI' : k === 'nonfactory' ? 'บริษัทอื่นทั้งหมดนอกเหนือจากกลุ่มโรงงาน' : undefined}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px' }} />
              {BUSINESS_UNITS.map(bu => {
                const active = buKeys.includes(bu.key);
                return (
                  <button
                    key={bu.key}
                    onClick={() => setBuKeys(prev => prev.includes(bu.key) ? prev.filter(k => k !== bu.key) : [...prev, bu.key])}
                    title={`${bu.label} — ${bu.companyIds.map(c => c.toUpperCase()).join(', ')} (กดเลือกได้หลายกลุ่ม)`}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {active ? '✓ ' : ''}{bu.shortLabel}
                  </button>
                );
              })}
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>· กลุ่มย่อยเลือกซ้อนกันได้</span>
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
                  // TRIR: no official target yet — show the value only, no target comparison
                  { label: 'TRIR', value: totalTRIR !== null ? totalTRIR.toFixed(2) : 'N/A', target: null as number | null, targetLabel: '', icon: Activity, subtitle: totalTRIR === null ? 'ไม่มี man-hours' : `MH: ${Math.round(totalManHours).toLocaleString()}` },
                  { label: 'LTIFR', value: totalLTIFR !== null ? totalLTIFR.toFixed(2) : 'N/A', target: LTIFR_TARGET as number | null, targetLabel: LTIFR_TARGET_LABEL, icon: BarChart3, subtitle: totalLTIFR === null ? 'ไม่มี man-hours' : `LTI: ${totalSummary.ltiCases}` },
                ].map((kpi, idx) => {
                  const numVal = parseFloat(String(kpi.value));
                  const aboveTarget = kpi.target !== null && !isNaN(numVal) && numVal > kpi.target;
                  const rateColor = kpi.value === 'N/A' ? '#9ca3af' : kpi.target === null ? '#4E79A7' : aboveTarget ? '#F28E2B' : '#2B8C3E';
                  return (
                    <div key={idx} className="glass-card rounded-2xl p-4" style={{ borderLeft: `3px solid ${rateColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${rateColor}18` }}>
                          <kpi.icon size={16} style={{ color: rateColor }} />
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--muted)' }}>{kpi.label}</span>
                      </div>
                      <p style={{ fontSize: 28, fontWeight: 700, color: rateColor, lineHeight: 1 }}>{kpi.value}</p>
                      {kpi.target !== null && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{kpi.targetLabel}</span>
                          {!isNaN(numVal) && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: aboveTarget ? '#F28E2B' : '#2B8C3E' }}>
                              {aboveTarget ? '↑ เกินเป้า' : '↓ ในเป้าหมาย'}
                            </span>
                          )}
                        </div>
                      )}
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
                <YearlyCasesChart data={hqYearlyTrend} title="จำนวนเคสบาดเจ็บรายปี — TRC / LTI (ทุกบริษัท)" onBarClick={drillYearly} />
                {/* Case-type chips for the monthly comparison chart */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ประเภทเคส:</span>
                  {([['all', 'ทั้งหมด'], ['trc', 'TRC (บาดเจ็บ)'], ['lti', 'LTI (หยุดงาน)']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setMonthlyCaseType(k)}
                      style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: monthlyCaseType === k ? 'var(--accent)' : 'var(--border)', background: monthlyCaseType === k ? 'var(--accent)' : 'var(--card-solid)', color: monthlyCaseType === k ? '#fff' : 'var(--text-secondary)' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <MonthlyByYearChart
                  series={hqMonthlyByYear}
                  title={`อุบัติการณ์รายเดือน — เปรียบเทียบระหว่างปี (${monthlyCaseType === 'all' ? 'ทุกบริษัท ทุกประเภท' : monthlyCaseType === 'trc' ? 'เฉพาะเคสบาดเจ็บ TRC' : 'เฉพาะเคสหยุดงาน LTI'})`}
                  onPointClick={drillMonthly}
                />
                <MonthlyByYearChart
                  series={hqCumTrc}
                  cumulative
                  title="เคสบาดเจ็บสะสมตั้งแต่ต้นปี — TRC (Cumulative)"
                  subtitle="ยอดสะสม ม.ค. → ธ.ค. · เฉพาะเคสบาดเจ็บ/เสียชีวิต/โรคจากการทำงาน · คลิกจุดเพื่อดูรายการเคส"
                  onPointClick={drillCum('trc')}
                />
                <MonthlyByYearChart
                  series={hqCumLti}
                  cumulative
                  title="เคสหยุดงานสะสมตั้งแต่ต้นปี — LTI (Cumulative)"
                  subtitle="ยอดสะสม ม.ค. → ธ.ค. · เฉพาะเคสหยุดงาน/เสียชีวิต · คลิกจุดเพื่อดูรายการเคส"
                  onPointClick={drillCum('lti')}
                />
                <HqInjuryAnalytics
                  persons={hqInjured.persons.filter(p => inBu(hqInjured.map[p.incident_no]?.company_id || ''))}
                  incidentMap={hqInjured.map}
                  workRelatedOnly={workRelatedOnly}
                  personFilter={personFilter}
                />

                {/* ═══ Property damage analytics — all companies ═══ */}
                {(() => {
                  // ความสูญเสียรวม = ทรัพย์สินเสียหาย + เหตุการณ์สูญเสียการผลิต
                  const LOSS_TYPES_HQ = ['ทรัพย์สินเสียหาย', 'เหตุการณ์สูญเสียการผลิต (Production Loss)'];
                  const propInc = baseInc.filter(i => LOSS_TYPES_HQ.includes(i.incident_type || ''));
                  const nProp = propInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย').length;
                  const nProd = propInc.length - nProp;
                  const costOf = (i: Incident) => (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0);
                  const totalCost = propInc.reduce((s, i) => s + costOf(i), 0);
                  const byType: Record<string, { count: number; cost: number }> = {};
                  const byCompany: Record<string, { count: number; cost: number }> = {};
                  const byAsset: Record<string, { count: number; cost: number }> = {};
                  const byNature: Record<string, { count: number; cost: number }> = {};
                  const animalByMonth: number[] = Array(12).fill(0);
                  const isAnimal = (i: Incident) => ((i.secondary_source as string) || '').startsWith('สัตว์') || ((i.agency_source as string) || '').startsWith('สัตว์');
                  propInc.forEach(i => {
                    // แกนที่ 1: เหตุการณ์/การสัมผัส (ครบทุกเคสหลัง backfill)
                    const t = (i.contact_type as string) || 'ไม่ระบุ';
                    byType[t] = byType[t] || { count: 0, cost: 0 };
                    byType[t].count++; byType[t].cost += costOf(i);
                    const c = i.company_id.toUpperCase();
                    byCompany[c] = byCompany[c] || { count: 0, cost: 0 };
                    byCompany[c].count++; byCompany[c].cost += costOf(i);
                    // แกนที่ 2+3 (แกนที่ 2 = แหล่งที่มา — ชี้จุดโฟกัสมาตรการป้องกัน)
                    const a = (i.agency_source as string) || '';
                    if (a && a !== 'อื่นๆ') { byAsset[a] = byAsset[a] || { count: 0, cost: 0 }; byAsset[a].count++; byAsset[a].cost += costOf(i); }
                    const n = (i.damage_nature as string) || '';
                    if (n) { byNature[n] = byNature[n] || { count: 0, cost: 0 }; byNature[n].count++; byNature[n].cost += costOf(i); }
                    // สัตว์ตามฤดูกาล
                    if (isAnimal(i)) {
                      const m = new Date(i.incident_date).getMonth();
                      if (m >= 0 && m <= 11) animalByMonth[m]++;
                    }
                  });
                  const topTypes = Object.entries(byType).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
                  const topCompanies = Object.entries(byCompany).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
                  const topAssets = Object.entries(byAsset).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
                  const topNatures = Object.entries(byNature).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
                  const topCost = [...propInc].sort((a, b) => costOf(b) - costOf(a)).slice(0, 10);
                  const maxTypeCount = Math.max(...topTypes.map(([, v]) => v.count), 1);
                  const maxCompCount = Math.max(...topCompanies.map(([, v]) => v.count), 1);
                  const maxAssetCount = Math.max(...topAssets.map(([, v]) => v.count), 1);
                  const maxNatureCount = Math.max(...topNatures.map(([, v]) => v.count), 1);
                  const animalTotal = animalByMonth.reduce((s, v) => s + v, 0);
                  const maxAnimal = Math.max(...animalByMonth, 1);
                  const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                  const reviewQueue = propInc.filter(i => (i.classification_status as string) === 'review');
                  const fmtBaht = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(2)}M ฿` : v >= 1000 ? `${Math.round(v / 1000).toLocaleString()}K ฿` : `${v.toLocaleString()} ฿`;
                  // ยังต้อง render modal แม้ไม่มีเคสทรัพย์สิน (drill-down จากกราฟบาดเจ็บใช้ modal ตัวเดียวกัน)
                  if (propInc.length === 0 && !pdDrill && !pdImgView) return null;
                  return (
                    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>วิเคราะห์ความสูญเสีย — ทรัพย์สินเสียหาย + Production Loss (ทุกบริษัท)</h3>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{propInc.length} เหตุ (ทรัพย์สิน {nProp} · Production Loss {nProd}) · ค่าเสียหายรวม {fmtBaht(totalCost)} · ตามตัวกรองด้านบน</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
                        {/* แกนที่ 1: เหตุการณ์/การสัมผัส */}
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>เหตุการณ์/การสัมผัส</p>
                          {topTypes.map(([t, v]) => (
                            <div key={t} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                <span style={{ color: 'var(--text-primary)' }}>{t}</span>
                                <span style={{ color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{v.count}</b> เหตุ · {fmtBaht(v.cost)}</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                                <div style={{ height: 6, borderRadius: 3, width: `${(v.count / maxTypeCount) * 100}%`, background: '#4E79A7' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* แกนที่ 2: แหล่งที่มา — โฟกัสมาตรการป้องกัน */}
                        {topAssets.length > 0 && (
                          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>แหล่งที่มา</p>
                            {topAssets.map(([t, v]) => (
                              <div key={t} style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{t}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{v.count}</b> เหตุ · {fmtBaht(v.cost)}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                                  <div style={{ height: 6, borderRadius: 3, width: `${(v.count / maxAssetCount) * 100}%`, background: '#59A14F' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* แกนที่ 3: ลักษณะความเสียหาย */}
                        {topNatures.length > 0 && (
                          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>ลักษณะความเสียหาย</p>
                            {topNatures.map(([t, v]) => (
                              <div key={t} style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{t}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{v.count}</b> เหตุ · {fmtBaht(v.cost)}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                                  <div style={{ height: 6, borderRadius: 3, width: `${(v.count / maxNatureCount) * 100}%`, background: '#E15759' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* By company */}
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>บริษัท</p>
                          {topCompanies.map(([c, v]) => (
                            <div key={c} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                <span style={{ color: 'var(--text-primary)' }}>{c}</span>
                                <span style={{ color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{v.count}</b> เหตุ · {fmtBaht(v.cost)}</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                                <div style={{ height: 6, borderRadius: 3, width: `${(v.count / maxCompCount) * 100}%`, background: '#F28E2B' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ═══ กราฟเปรียบเทียบ บริษัท × ปี ═══ */}
                      {(() => {
                        const YEAR_COLORS = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#B07AA1', '#76B7B2'];
                        const yrOf = (i: Incident) => new Date(i.incident_date).getFullYear();
                        const yearsSel = Array.from(new Set(propInc.map(yrOf))).sort();
                        if (yearsSel.length === 0) return null;
                        const fmtCompact = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${Math.round(v)}`;
                        // Grouped bar renderer: companies on X, one bar per year
                        // เปิด modal รายละเอียดเคสของแท่งที่คลิก
                        const openDrill = (c: string, y: number, extra?: (i: Incident) => boolean, extraLabel?: string) => {
                          const items = propInc
                            .filter(i => i.company_id.toUpperCase() === c && yrOf(i) === y && (!extra || extra(i)))
                            .sort((a, b) => costOf(b) - costOf(a));
                          setPdDrill({ title: `${c} · ${y}${extraLabel ? ` · ${extraLabel}` : ''} — ${items.length} เหตุ · รวม ${fmtBaht(items.reduce((s, i) => s + costOf(i), 0))}`, items });
                        };
                        // frac (ถ้ามี) = สัดส่วนส่วนล่างของแท่ง (direct) — ส่วนบนวาดสีอ่อน (indirect)
                        const groupedBars = (comps: string[], val: (c: string, y: number) => number, fmt: (v: number) => string, frac?: (c: string, y: number) => number, onBar?: (c: string, y: number) => void) => {
                          const bw = 22, gap = 4;
                          const gw = yearsSel.length * (bw + gap) + 26;
                          const W = 30 + comps.length * gw;
                          const maxV = Math.max(...comps.flatMap(c => yearsSel.map(y => val(c, y))), 1);
                          return (
                            <div style={{ overflowX: 'auto' }}>
                              <svg viewBox={`0 0 ${W} 205`} style={{ width: '100%', maxWidth: Math.max(W * 1.6, 620), height: 'auto', display: 'block', margin: '0 auto' }}>
                                <line x1={14} y1={168} x2={W - 10} y2={168} stroke="var(--border)" strokeWidth={1} />
                                {comps.map((c, ci) => (
                                  <g key={c}>
                                    {yearsSel.map((y, yi) => {
                                      const v = val(c, y);
                                      const h = (v / maxV) * 130;
                                      const x = 22 + ci * gw + yi * (bw + gap);
                                      const f = frac ? Math.max(0, Math.min(1, frac(c, y))) : 1;
                                      const hDirect = h * f;
                                      const clickable = onBar && v > 0;
                                      return (
                                        <g key={y} onClick={clickable ? () => onBar(c, y) : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
                                          {/* พื้นที่คลิกเต็มแท่ง */}
                                          {clickable && <rect x={x - 2} y={30} width={bw + 4} height={140} fill="transparent" />}
                                          {/* ส่วนบน = indirect (สีอ่อน) */}
                                          {f < 1 && <rect x={x} y={168 - h} width={bw} height={h - hDirect} rx={2} fill={YEAR_COLORS[yi % 6]} opacity={0.35} />}
                                          {/* ส่วนล่าง = direct (สีเข้ม) */}
                                          <rect x={x} y={168 - hDirect} width={bw} height={Math.max(hDirect, v > 0 ? 2 : 0)} rx={2} fill={YEAR_COLORS[yi % 6]} opacity={0.9} />
                                          {v > 0 && <text x={x + bw / 2} y={162 - h} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="var(--text-primary)" style={{ pointerEvents: 'none' }}>{fmt(v)}</text>}
                                        </g>
                                      );
                                    })}
                                    <text x={22 + ci * gw + (yearsSel.length * (bw + gap)) / 2 - gap} y={185} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--text-secondary)">{c}</text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          );
                        };
                        const yearLegend = (
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {yearsSel.map((y, yi) => (
                              <span key={y} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: YEAR_COLORS[yi % 6] }} /> {y}
                              </span>
                            ))}
                          </div>
                        );
                        const toggleBtn = (active: boolean, label: string, onClick: () => void) => (
                          <button key={label} onClick={onClick} style={{
                            padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: active ? '1px solid #4E79A7' : '1px solid var(--border)',
                            background: active ? 'rgba(78,121,167,0.12)' : 'var(--card-solid)',
                            color: active ? '#4E79A7' : 'var(--text-secondary)',
                          }}>{label}</button>
                        );

                        // ── Chart 1: มูลค่า/จำนวน รายบริษัท × ปี ──
                        const c1: Record<string, Record<number, { direct: number; indirect: number; count: number }>> = {};
                        const c1Tot: Record<string, { cost: number; count: number }> = {};
                        propInc.forEach(i => {
                          const c = i.company_id.toUpperCase(); const y = yrOf(i);
                          c1[c] = c1[c] || {}; c1[c][y] = c1[c][y] || { direct: 0, indirect: 0, count: 0 };
                          c1[c][y].direct += Number(i.direct_cost) || 0;
                          c1[c][y].indirect += Number(i.indirect_cost) || 0;
                          c1[c][y].count++;
                          c1Tot[c] = c1Tot[c] || { cost: 0, count: 0 };
                          c1Tot[c].cost += costOf(i); c1Tot[c].count++;
                        });
                        const c1Comps = Object.entries(c1Tot).sort((a, b) => (pdMetric === 'cost' ? b[1].cost - a[1].cost : b[1].count - a[1].count)).slice(0, 8).map(([c]) => c);
                        const c1Val = (c: string, y: number) => (c1[c]?.[y] ? (pdMetric === 'cost' ? c1[c][y].direct + c1[c][y].indirect : c1[c][y].count) : 0);
                        // สัดส่วน direct ในแท่ง (โหมดมูลค่า): ใช้วาด segment สีเข้ม/อ่อน
                        const c1DirectFrac = (c: string, y: number) => {
                          const d = c1[c]?.[y]; if (!d) return 1;
                          const tot = d.direct + d.indirect;
                          return tot > 0 ? d.direct / tot : 1;
                        };

                        // ── Chart 2: เหตุการณ์ × บริษัท × ปี ──
                        const eventChips = ['ทั้งหมด', ...topTypes.slice(0, 6).map(([t]) => t)];
                        const c2Match = (i: Incident) => pdEventSel === 'ทั้งหมด' || ((i.contact_type as string) || 'ไม่ระบุ') === pdEventSel;
                        const c2Tot: Record<string, number> = {};
                        propInc.filter(c2Match).forEach(i => { const c = i.company_id.toUpperCase(); c2Tot[c] = (c2Tot[c] || 0) + 1; });
                        const c2Comps = Object.entries(c2Tot).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
                        const c2Val = (c: string, y: number) => propInc.filter(i => c2Match(i) && i.company_id.toUpperCase() === c && yrOf(i) === y).length;

                        // Stacked mode data
                        const stackEvents = topTypes.slice(0, 5).map(([t]) => t);
                        const EV_COLORS = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#B07AA1'];
                        const evColor = (t: string) => { const idx = stackEvents.indexOf(t); return idx >= 0 ? EV_COLORS[idx] : '#BAB0AC'; };
                        const stComps = Object.entries(c1Tot).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([c]) => c);
                        const stackedChart = (() => {
                          const bw = 22, gap = 4;
                          const gw = yearsSel.length * (bw + gap) + 26;
                          const W = 30 + stComps.length * gw;
                          const totals = stComps.flatMap(c => yearsSel.map(y => propInc.filter(i => i.company_id.toUpperCase() === c && yrOf(i) === y).length));
                          const maxV = Math.max(...totals, 1);
                          return (
                            <div style={{ overflowX: 'auto' }}>
                              <svg viewBox={`0 0 ${W} 205`} style={{ width: '100%', maxWidth: Math.max(W * 1.6, 620), height: 'auto', display: 'block', margin: '0 auto' }}>
                                <line x1={14} y1={168} x2={W - 10} y2={168} stroke="var(--border)" strokeWidth={1} />
                                {stComps.map((c, ci) => (
                                  <g key={c}>
                                    {yearsSel.map((y, yi) => {
                                      const rows = propInc.filter(i => i.company_id.toUpperCase() === c && yrOf(i) === y);
                                      const segs: [string, number][] = [...stackEvents.map(e => [e, rows.filter(i => ((i.contact_type as string) || '') === e).length] as [string, number]), ['อื่นๆ', rows.filter(i => !stackEvents.includes((i.contact_type as string) || '')).length]];
                                      const total = rows.length;
                                      const x = 22 + ci * gw + yi * (bw + gap);
                                      let yCur = 168;
                                      return (
                                        <g key={y} onClick={total > 0 ? () => openDrill(c, y) : undefined} style={total > 0 ? { cursor: 'pointer' } : undefined}>
                                          {total > 0 && <rect x={x - 2} y={30} width={bw + 4} height={140} fill="transparent" />}
                                          {segs.map(([e, n]) => {
                                            if (n === 0) return null;
                                            const h = (n / maxV) * 130;
                                            yCur -= h;
                                            return <rect key={e} x={x} y={yCur} width={bw} height={h} fill={evColor(e)} opacity={0.9} />;
                                          })}
                                          {total > 0 && <text x={x + bw / 2} y={yCur - 4} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="var(--text-primary)" style={{ pointerEvents: 'none' }}>{total}</text>}
                                        </g>
                                      );
                                    })}
                                    <text x={22 + ci * gw + (yearsSel.length * (bw + gap)) / 2 - gap} y={185} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--text-secondary)">{c}</text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          );
                        })();

                        return (
                          <>
                            {/* Chart 1 */}
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                  {pdMetric === 'cost' ? 'มูลค่าความเสียหาย' : 'จำนวนเหตุ'}รายบริษัท — เทียบรายปี (Top 8) <span style={{ fontWeight: 400, fontSize: 10.5, color: 'var(--text-secondary)' }}>· คลิกแท่งเพื่อดูรายการเคส</span>
                                </p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {toggleBtn(pdMetric === 'cost', 'มูลค่า ฿', () => setPdMetric('cost'))}
                                  {toggleBtn(pdMetric === 'count', 'จำนวนเหตุ', () => setPdMetric('count'))}
                                </div>
                              </div>
                              {groupedBars(c1Comps, c1Val, pdMetric === 'cost' ? fmtCompact : v => String(v), pdMetric === 'cost' ? c1DirectFrac : undefined, (c, y) => openDrill(c, y))}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {yearLegend}
                                  {pdMetric === 'cost' && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--text-secondary)', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#4E79A7', opacity: 0.9 }} /> Direct</span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#4E79A7', opacity: 0.35 }} /> Indirect</span>
                                    </span>
                                  )}
                                </div>
                                {pdMetric === 'cost' && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>มูลค่า = Direct + Indirect · เคสเก่าบางส่วนไม่ได้กรอกค่าเสียหาย — สลับดู &ldquo;จำนวนเหตุ&rdquo; ประกอบ</span>}
                              </div>
                            </div>

                            {/* Chart 1.5: แยกประเภทความสูญเสีย */}
                              {(() => {
                                const LOSS_DEFS = [
                                  { key: 'ทรัพย์สินเสียหาย', label: 'ทรัพย์สินเสียหาย', color: '#1e40af' },
                                  { key: 'เหตุการณ์สูญเสียการผลิต (Production Loss)', label: 'Production Loss', color: '#0ea5e9' },
                                ];
                                const cell = (t: string, y: number) => {
                                  const rows = propInc.filter(i => i.incident_type === t && yrOf(i) === y);
                                  return { count: rows.length, cost: rows.reduce((s, i) => s + costOf(i), 0) };
                                };
                                const maxC = Math.max(...LOSS_DEFS.flatMap(d => yearsSel.map(y => cell(d.key, y).cost)), 1);
                                return (
                                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                                      แยกตามประเภทความสูญเสีย — เทียบรายปี <span style={{ fontWeight: 400, fontSize: 10.5, color: 'var(--text-secondary)' }}>· คลิกแถบเพื่อดูรายการเคส</span>
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                                      {LOSS_DEFS.map(d => {
                                        const tot = yearsSel.reduce((s, y) => { const c = cell(d.key, y); return { count: s.count + c.count, cost: s.cost + c.cost }; }, { count: 0, cost: 0 });
                                        return (
                                          <div key={d.key}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: d.color, margin: '0 0 4px' }}>
                                              {d.label} <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>— รวม {tot.count} เหตุ · {fmtBaht(tot.cost)}</span>
                                            </p>
                                            {yearsSel.map(y => {
                                              const c = cell(d.key, y);
                                              return (
                                                <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, cursor: c.count > 0 ? 'pointer' : 'default' }}
                                                  onClick={c.count > 0 ? () => setPdDrill({ title: `${y} · ${d.label} — ${c.count} เหตุ · รวม ${fmtBaht(c.cost)}`, items: propInc.filter(i => i.incident_type === d.key && yrOf(i) === y).sort((a, b) => costOf(b) - costOf(a)) }) : undefined}>
                                                  <span style={{ fontSize: 10, width: 30, flexShrink: 0, fontWeight: 700, color: YEAR_COLORS[yearsSel.indexOf(y) % 6] }}>{y}</span>
                                                  <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border)' }}>
                                                    <div style={{ height: 10, borderRadius: 5, width: `${(c.cost / maxC) * 100}%`, background: d.color, opacity: 0.85, minWidth: c.count > 0 ? 4 : 0 }} />
                                                  </div>
                                                  <span style={{ fontSize: 10.5, flexShrink: 0, minWidth: 110, textAlign: 'right', color: 'var(--text-primary)' }}><b>{c.count}</b> เหตุ · {fmtBaht(c.cost)}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                            {/* Chart 2 */}
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เหตุการณ์/การสัมผัส รายบริษัท — เทียบรายปี</p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {toggleBtn(pdEventMode === 'select', 'เลือกเหตุการณ์', () => setPdEventMode('select'))}
                                  {toggleBtn(pdEventMode === 'stack', 'ภาพรวม (Stacked)', () => setPdEventMode('stack'))}
                                </div>
                              </div>
                              {pdEventMode === 'select' ? (
                                <>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                    {eventChips.map(e => toggleBtn(pdEventSel === e, e, () => setPdEventSel(e)))}
                                  </div>
                                  {c2Comps.length > 0 ? groupedBars(c2Comps, c2Val, v => String(v), undefined, (c, y) => openDrill(c, y, c2Match, pdEventSel === 'ทั้งหมด' ? undefined : pdEventSel)) : <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ไม่มีข้อมูลเหตุการณ์นี้ตามตัวกรอง</p>}
                                  {yearLegend}
                                </>
                              ) : (
                                <>
                                  {stackedChart}
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                                    {[...stackEvents, 'อื่นๆ'].map(e => (
                                      <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: 2, background: evColor(e) }} /> {e}
                                      </span>
                                    ))}
                                  </div>
                                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0' }}>แท่ง = บริษัท×ปี (เรียงปีซ้าย→ขวาในแต่ละบริษัท) · สีในแท่ง = สัดส่วนเหตุการณ์ · คลิกแท่งเพื่อดูรายการเคส</p>
                                </>
                              )}
                            </div>

                            {/* Drill-down modal: รายการเคสของแท่งที่คลิก */}
                            {pdDrill && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => { setPdDrill(null); setPdCase(null); }}>
                                <div style={{ background: 'var(--card-solid)', borderRadius: 14, padding: '18px 22px', maxWidth: 900, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                                  {pdCase ? (() => {
                                    const F = (v: unknown) => (v === null || v === undefined || v === '' || v === 0 ? '—' : String(v));
                                    const row = (label: string, v: unknown) => (
                                      <div style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 12 }}>
                                        <span style={{ minWidth: 150, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{F(v)}</span>
                                      </div>
                                    );
                                    const sec = (t: string) => <p style={{ fontSize: 11.5, fontWeight: 700, color: '#4E79A7', margin: '12px 0 4px', borderBottom: '1px solid var(--border)', paddingBottom: 3 }}>{t}</p>;
                                    const c = pdCase;
                                    const incPhotos = (pdCasePhotos || []).filter(p => (p.photo_type || 'incident') === 'incident');
                                    const fixPhotos = (pdCasePhotos || []).filter(p => p.photo_type === 'after_fix');
                                    const photoGrid = (ps: typeof incPhotos) => (
                                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                        {ps.map((p, idx) => (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img key={idx} src={p.file_url} alt={p.caption || 'photo'} onClick={() => setPdImgView(p.file_url)}
                                            style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }} />
                                        ))}
                                      </div>
                                    );
                                    return (
                                      <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <button onClick={() => setPdCase(null)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>← กลับรายการ</button>
                                            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'monospace' }}>{c.incident_no}</h4>
                                            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{F(c.report_status)}</span>
                                            <Link href={`/projects/incidents/${c.company_id}`} style={{ fontSize: 11, color: '#4E79A7', fontWeight: 600 }}>เปิดหน้าบริษัท ↗</Link>
                                          </div>
                                          <button onClick={() => { setPdDrill(null); setPdCase(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: 4 }}>✕</button>
                                        </div>
                                        <div style={{ overflowY: 'auto', paddingRight: 6 }}>
                                          {sec('ข้อมูลทั่วไป')}
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 24 }}>
                                            {row('วันที่ / เวลา', `${new Date(c.incident_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}${c.incident_time ? ` · ${c.incident_time}` : ''}`)}
                                            {row('กะการทำงาน', c.shift)}
                                            {row('ผู้รายงาน', c.reporter)}
                                            {row('แผนก', c.department)}
                                            {row('พื้นที่เกิดเหตุ', c.area)}
                                            {row('กิจกรรมขณะเกิดเหตุ', c.activity)}
                                            {row('สภาพแวดล้อม', c.environment)}
                                            {row('เครื่องจักร/อุปกรณ์', c.equipment)}
                                          </div>
                                          {sec('การจำแนก')}
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 24 }}>
                                            {row('ประเภทอุบัติการณ์', c.incident_type)}
                                            {row('ความรุนแรง', c.actual_severity)}
                                            {row('เหตุการณ์/การสัมผัส', c.contact_type)}
                                            {row('แหล่งที่มา', c.agency_source)}
                                            {row('แหล่งที่มาต้นทาง', c.secondary_source)}
                                            {row('ทรัพย์สินที่เสียหาย', c.damaged_asset)}
                                            {row('ลักษณะความเสียหาย', c.damage_nature)}
                                            {row('ผลกระทบต่อการผลิต', c.production_impact)}
                                            {row('ระยะเวลาหยุดการผลิต', c.production_downtime)}
                                          </div>
                                          {sec('รายละเอียดเหตุการณ์')}
                                          <p style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: '2px 0' }}>{F(c.description)}</p>
                                          {!!(c.property_damage_detail as string) && row('รายละเอียดความเสียหาย', c.property_damage_detail)}
                                          {sec('ค่าเสียหาย')}
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 24 }}>
                                            {row('Direct (฿)', (Number(c.direct_cost) || 0).toLocaleString())}
                                            {row('Indirect (฿)', (Number(c.indirect_cost) || 0).toLocaleString())}
                                            {row('รวม (฿)', ((Number(c.direct_cost) || 0) + (Number(c.indirect_cost) || 0)).toLocaleString())}
                                            {row('สถานะเคลมประกัน', c.insurance_claim)}
                                          </div>
                                          {sec('การสอบสวน')}
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 24 }}>
                                            {row('ระดับการสอบสวน', c.investigation_level)}
                                            {row('ผู้นำการสอบสวน', c.investigation_lead)}
                                            {row('Immediate Cause', c.immediate_cause)}
                                            {row('Contributing Cause', c.contributing_cause)}
                                            {row('Root Cause', c.root_cause_detail)}
                                          </div>
                                          {sec(`รูปภาพ (${pdCasePhotos === null ? 'กำลังโหลด...' : pdCasePhotos.length})`)}
                                          {pdCasePhotos !== null && pdCasePhotos.length === 0 && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ไม่มีรูปภาพแนบ</p>}
                                          {incPhotos.length > 0 && (<><p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>รูปการเกิดอุบัติเหตุ</p>{photoGrid(incPhotos)}</>)}
                                          {fixPhotos.length > 0 && (<><p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 0' }}>รูปหลังแก้ไข</p>{photoGrid(fixPhotos)}</>)}
                                        </div>
                                      </>
                                    );
                                  })() : (
                                  <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{pdDrill.title}</h4>
                                    <button onClick={() => setPdDrill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: 4 }}>✕</button>
                                  </div>
                                  <div style={{ overflowY: 'auto', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', position: 'sticky', top: 0, background: 'var(--card-solid)' }}>
                                          <th style={{ padding: '5px 8px' }}>เลขที่เหตุการณ์</th>
                                          <th style={{ padding: '5px 8px' }}>วันที่</th>
                                          <th style={{ padding: '5px 8px' }}>เหตุการณ์</th>
                                          <th style={{ padding: '5px 8px' }}>แหล่งที่มา / ลักษณะ</th>
                                          <th style={{ padding: '5px 8px' }}>รายละเอียด</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'right' }}>Direct (฿)</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'right' }}>Indirect (฿)</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'right' }}>รวม (฿)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {pdDrill.items.map(i => (
                                          <tr key={i.incident_no} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                              <button onClick={() => openPdCase(i)} style={{ color: '#4E79A7', fontWeight: 700, fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 11 }}>{i.incident_no}</button>
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{new Date(i.incident_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 150 }}>{(i.contact_type as string) || '—'}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 150 }}>{[(i.agency_source as string), (i.damage_nature as string)].filter(Boolean).join(' · ') || '—'}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(i.property_damage_detail as string) || (i.description as string) || ''}>
                                              {(i.property_damage_detail as string) || (i.description as string) || '—'}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{(Number(i.direct_cost) || 0).toLocaleString()}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{(Number(i.indirect_cost) || 0).toLocaleString()}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: costOf(i) > 0 ? '#E15759' : 'var(--text-secondary)' }}>{costOf(i).toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '8px 0 0' }}>เรียงตามค่าเสียหายมาก→น้อย · คลิกเลขที่เหตุการณ์เพื่อดูรายละเอียดเคสทันที</p>
                                  </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ขยายรูปภาพ */}
                            {pdImgView && (
                              <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setPdImgView(null)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={pdImgView} alt="photo" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 10 }} onClick={e => e.stopPropagation()} />
                                <button onClick={() => setPdImgView(null)} style={{ position: 'absolute', top: 18, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer' }}>✕</button>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* สัตว์ทำความเสียหาย — รายเดือน (ฤดูกาล) */}
                      {animalTotal > 0 && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🐍 เหตุจากสัตว์ — แนวโน้มรายเดือน (รวมทุกปีที่เลือก)</p>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{animalTotal} เหตุ</span>
                          </div>
                          <svg viewBox="0 0 720 130" style={{ width: '100%', height: 'auto' }}>
                            {animalByMonth.map((v, m) => {
                              const bw = 44; const x = 16 + m * 58; const h = (v / maxAnimal) * 80;
                              return (
                                <g key={m}>
                                  <rect x={x} y={100 - h} width={bw} height={h} rx={3} fill={v === maxAnimal && v > 0 ? '#E15759' : '#59A14F'} opacity={0.85} />
                                  {v > 0 && <text x={x + bw / 2} y={94 - h} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-primary)">{v}</text>}
                                  <text x={x + bw / 2} y={116} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">{TH_MONTHS[m]}</text>
                                </g>
                              );
                            })}
                          </svg>
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0' }}>นับจากเคสที่แหล่งที่มาหรือต้นทางเป็นสัตว์ · เดือนสีแดง = สูงสุด ใช้วางแผนป้องกันตามฤดูกาล</p>
                        </div>
                      )}

                      {/* คิวรอตรวจสอบการจำแนก */}
                      {reviewQueue.length > 0 && (
                        <div style={{ background: 'rgba(242,142,43,0.08)', border: '1px solid rgba(242,142,43,0.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                            ⏳ รอทีมตรวจสอบการจำแนก {reviewQueue.length} เหตุ
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                            เคสที่ระบบจำแนกอัตโนมัติไม่ได้ครบ (เช่น สายส่ง Trip ไม่ทราบต้นทาง) — เปิดเหตุการณ์ในหน้าบริษัทเพื่อเติม เหตุการณ์/แหล่งที่มา/ต้นทาง/ลักษณะความเสียหาย
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {Object.entries(reviewQueue.reduce((acc: Record<string, number>, i) => { acc[i.company_id.toUpperCase()] = (acc[i.company_id.toUpperCase()] || 0) + 1; return acc; }, {}))
                              .sort((a, b) => b[1] - a[1])
                              .map(([c, n]) => (
                                <Link key={c} href={`/projects/incidents/${c.toLowerCase()}`} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', color: '#F28E2B', textDecoration: 'none' }}>
                                  {c} · {n}
                                </Link>
                              ))}
                          </div>
                        </div>
                      )}
                      {/* Top 10 by cost */}
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>ค่าเสียหายสูงสุด (Top 10)</p>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                              <th style={{ padding: '5px 8px' }}>บริษัท</th>
                              <th style={{ padding: '5px 8px' }}>เลขที่เหตุการณ์</th>
                              <th style={{ padding: '5px 8px' }}>วันที่</th>
                              <th style={{ padding: '5px 8px' }}>แหล่งที่มา / ลักษณะความเสียหาย</th>
                              <th style={{ padding: '5px 8px' }}>รายละเอียด</th>
                              <th style={{ padding: '5px 8px', textAlign: 'right' }}>ค่าเสียหาย (฿)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topCost.map(i => (
                              <tr key={i.incident_no} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '6px 8px' }}>
                                  <Link href={`/projects/incidents/${i.company_id}`} style={{ color: '#4E79A7', fontWeight: 700, textDecoration: 'none' }}>{i.company_id.toUpperCase()}</Link>
                                </td>
                                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{i.incident_no}</td>
                                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{new Date(i.incident_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{[(i.agency_source as string), (i.damage_nature as string)].filter(Boolean).join(' · ') || (i.property_damage_type as string) || '—'}</td>
                                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(i.property_damage_detail as string) || (i.description as string) || ''}>
                                  {(i.property_damage_detail as string) || (i.description as string) || '—'}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: costOf(i) > 0 ? '#E15759' : 'var(--text-secondary)' }}>{costOf(i).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
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
