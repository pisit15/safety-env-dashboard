'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { useCompanies } from '@/hooks/useCompanies';
import {
  AlertTriangle, Plus, BarChart3, List, Download,
} from 'lucide-react';
import ExportPdfButton from '@/components/ExportPdfButton';
import YearlyTrendChart from '@/components/YearlyTrendChart';
import MonthlyByYearChart from '@/components/MonthlyByYearChart';
import { STATUS, PALETTE } from '@/lib/she-theme';
import type { IncidentCategory, LiveStats, ManHours } from './types';
import type { Incident, SummaryData, InjuredPerson } from './types';
import GlobalFilters from './components/GlobalFilters';
import OverviewWorkspace from './components/OverviewWorkspace';
import InjuryWorkspace from './components/InjuryWorkspace';
import PropertyDamageWorkspace from './components/PropertyDamageWorkspace';
import IncidentDrawer from './components/IncidentDrawer';
import IncidentForm from './components/IncidentForm';
import IncidentListView from './components/IncidentListView';
import CorrectiveActionWorkspace from './components/CorrectiveActionWorkspace';
import RatesWorkspace from './components/RatesWorkspace';
import {
  INCIDENT_TYPES,
  MONTHS,
  MONTH_TH,
  NON_INJURY_TYPES,
  INJURY_TYPES_PART,
  inputStyle,
  selectStyle,
} from './constants';

/* ─── helpers (pure functions, no state) ─── */

const isInjuryType = (t: string) => INJURY_TYPES_PART.some(p => t.includes(p));
const isLtiType = (t: string) =>
  (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';

interface ManHourRow {
  year: number;
  month: number;
  employee_manhours: number;
  contractor_manhours: number;
  employee_count?: number;
  contractor_count?: number;
}

/* ─── Component ─── */

export default function IncidentsPage() {
  const { companyId: id } = useParams() as { companyId: string };
  const auth = useAuth();
  const { getCompanyById } = useCompanies();
  const company = getCompanyById(id);
  const companyName = company?.shortName || id.toUpperCase();

  const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'form'>('dashboard');
  const [year, setYear] = useState(new Date().getFullYear());

  // Loading — block-level (not full-page spinner)
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // ---- Consolidated dashboard data (from single API call) ----
  const [dashIncidents, setDashIncidents] = useState<Incident[]>([]);
  const [manHourRows, setManHourRows] = useState<ManHourRow[]>([]);
  const [injuredPersonsData, setInjuredPersonsData] = useState<InjuredPerson[]>([]);
  const [injuredIncidentMap, setInjuredIncidentMap] = useState<Record<string, { year: number; work_related: string; incident_type: string }>>({});

  // List view data (separate from dashboard)
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  // Debounced search — avoid refetching on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Form data
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  // Dashboard filter state
  const [dashFilter, setDashFilter] = useState<{ month?: string; type?: string }>({});
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  // 'all' | 'employee' | 'contractor' — scopes the entire dashboard (counts + rates)
  const [personFilter, setPersonFilter] = useState<'all' | 'employee' | 'contractor'>('all');

  // Dynamic years: default to current year (YTD) so TRIR/LTIFR read as annual
  // rates — matches the HQ overview default. The user's last choice is remembered.
  const currentYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('incidents_selectedYears');
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(y => typeof y === 'number')) {
            return parsed as number[];
          }
        }
      } catch { /* corrupted value — fall through to default */ }
    }
    return [new Date().getFullYear()];
  });
  useEffect(() => {
    localStorage.setItem('incidents_selectedYears', JSON.stringify(selectedYears));
  }, [selectedYears]);
  const [incidentCategory, setIncidentCategory] = useState<IncidentCategory>('overview');

  // Cross-filter for injury/property charts
  const [injuryFilter, setInjuryFilter] = useState<{ field: string; value: string } | null>(null);
  const [propFilter, setPropFilter] = useState<{ field: string; value: string } | null>(null);

  // ---- Incident Drawer State ----
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIncident, setDrawerIncident] = useState<Incident | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<Record<string, unknown> | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'summary' | 'investigation' | 'cost' | 'actions'>('summary');
  const [drawerInjured, setDrawerInjured] = useState<Record<string, unknown>[]>([]);
  const drawerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && drawerOpen) node.focus();
  }, [drawerOpen]);

  // AbortController ref for cancelling stale requests
  const abortRef = useRef<AbortController | null>(null);

  /* ═══════════════════════════════════════════════════════════════
     SINGLE consolidated fetch — replaces 15-31 API calls with ONE
     ═══════════════════════════════════════════════════════════════ */
  const fetchDashboard = useCallback(async () => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDashLoading(true);
    setDashError(false);

    try {
      const res = await fetch(
        `/api/incidents/dashboard?companyId=${id}&years=${selectedYears.join(',')}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      // Guard against stale response
      if (controller.signal.aborted) return;

      setDashIncidents(data.incidents || []);
      setManHourRows(data.manHourRows || []);
      setInjuredPersonsData(data.injuredPersons || []);
      setInjuredIncidentMap(data.injuredIncidentMap || {});
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!controller.signal.aborted) setDashError(true);
    } finally {
      if (!controller.signal.aborted) setDashLoading(false);
    }
  }, [id, selectedYears]);

  // Trigger fetch when dashboard view or selectedYears change
  useEffect(() => {
    if (viewMode === 'dashboard' && selectedYears.length > 0) {
      fetchDashboard();
    }
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [viewMode, fetchDashboard, selectedYears]);

  /* ═══ Derived data — all computed client-side, no extra API calls ═══ */

  // Aggregated manhours
  const manHours = useMemo<ManHours>(() => {
    let employee = 0, contractor = 0;
    for (const r of manHourRows) {
      employee += Number(r.employee_manhours) || 0;
      contractor += Number(r.contractor_manhours) || 0;
    }
    return { employee, contractor, total: employee + contractor };
  }, [manHourRows]);

  // Manhours by year (for ratesByYear)
  const manHoursByYear = useMemo(() => {
    const map: Record<number, { emp: number; con: number; total: number }> = {};
    for (const r of manHourRows) {
      if (!map[r.year]) map[r.year] = { emp: 0, con: 0, total: 0 };
      const emp = Number(r.employee_manhours) || 0;
      const con = Number(r.contractor_manhours) || 0;
      map[r.year].emp += emp;
      map[r.year].con += con;
      map[r.year].total += emp + con;
    }
    return map;
  }, [manHourRows]);

  // Manhours by year+month (for ratesByMonth)
  const manHoursByYearMonth = useMemo(() => {
    const map: Record<string, { emp: number; con: number; total: number }> = {};
    for (const r of manHourRows) {
      const key = `${r.year}-${r.month}`;
      const emp = Number(r.employee_manhours) || 0;
      const con = Number(r.contractor_manhours) || 0;
      map[key] = { emp, con, total: emp + con };
    }
    return map;
  }, [manHourRows]);

  // ---- Person-type helpers using injured persons data ----
  const incidentPersonTypes = useMemo(() => {
    const map = new Map<string, Set<string>>();
    injuredPersonsData.forEach(p => {
      const pt = (p.person_type || '').trim();
      if (pt && p.incident_no) {
        if (!map.has(p.incident_no)) map.set(p.incident_no, new Set());
        map.get(p.incident_no)!.add(pt);
      }
    });
    return map;
  }, [injuredPersonsData]);

  const hasPersonType = useCallback((inc: Incident, keyword: string): boolean => {
    const personTypes = incidentPersonTypes.get(inc.incident_no);
    if (personTypes && personTypes.size > 0) {
      return Array.from(personTypes).some(pt => pt.includes(keyword));
    }
    return (inc.person_type || '').includes(keyword);
  }, [incidentPersonTypes]);

  // Injured persons scoped by the SAME global filters as the top cards
  // (year via incident map, work-related via incident map, person group via the person's own type)
  const scopedInjuredPersons = useMemo(() => {
    return injuredPersonsData.filter(p => {
      const meta = injuredIncidentMap[p.incident_no];
      if (meta) {
        if (!selectedYears.includes(meta.year)) return false;
        if (workRelatedOnly && meta.work_related !== 'ใช่') return false;
      }
      if (personFilter === 'employee') return (p.person_type || '').includes('พนักงาน');
      if (personFilter === 'contractor') return (p.person_type || '').includes('ผู้รับเหมา');
      return true;
    });
  }, [injuredPersonsData, injuredIncidentMap, selectedYears, workRelatedOnly, personFilter]);

  // Base incidents filtered by workRelatedOnly + person type
  const baseIncidents = useMemo(() => {
    let list = workRelatedOnly ? dashIncidents.filter(i => i.work_related === 'ใช่') : dashIncidents;
    if (personFilter === 'employee') list = list.filter(i => hasPersonType(i, 'พนักงาน'));
    if (personFilter === 'contractor') list = list.filter(i => hasPersonType(i, 'ผู้รับเหมา'));
    return list;
  }, [dashIncidents, workRelatedOnly, personFilter, hasPersonType]);

  // Category-filtered incidents
  const categoryIncidents = useMemo(() =>
    baseIncidents.filter(inc => {
      if (incidentCategory === 'injury') return isInjuryType(inc.incident_type || '');
      if (incidentCategory === 'property') return inc.incident_type === 'ทรัพย์สินเสียหาย';
      return true;
    }),
    [baseIncidents, incidentCategory]
  );

  // Live stats — computed from categoryIncidents (respects all filters)
  const liveStats = useMemo<LiveStats>(() => {
    const injuryIncidents = categoryIncidents.filter(i => isInjuryType(i.incident_type || ''));
    const ltiIncidents = categoryIncidents.filter(i => isLtiType(i.incident_type || ''));
    const nearMisses = categoryIncidents.filter(i => i.incident_type === 'Near Miss');
    const propDamage = categoryIncidents.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
    const fatalities = categoryIncidents.filter(i => (i.incident_type || '').includes('เสียชีวิต'));
    const directCost = categoryIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0), 0);
    const indirectCost = categoryIncidents.reduce((s, i) => s + (Number(i.indirect_cost) || 0), 0);

    const empInj = injuryIncidents.filter(i => hasPersonType(i, 'พนักงาน'));
    const conInj = injuryIncidents.filter(i => hasPersonType(i, 'ผู้รับเหมา'));
    const empLti = ltiIncidents.filter(i => hasPersonType(i, 'พนักงาน'));
    const conLti = ltiIncidents.filter(i => hasPersonType(i, 'ผู้รับเหมา'));

    const typeBreakdown: Record<string, number> = {};
    categoryIncidents.forEach(i => { const t = i.incident_type || 'อื่นๆ'; typeBreakdown[t] = (typeBreakdown[t] || 0) + 1; });

    return {
      totalIncidents: categoryIncidents.length,
      totalInjuries: injuryIncidents.length,
      ltiCases: ltiIncidents.length,
      nearMisses: nearMisses.length,
      propertyDamage: propDamage.length,
      fatalities: fatalities.length,
      totalDirectCost: directCost,
      totalIndirectCost: indirectCost,
      employeeInjuries: empInj.length,
      contractorInjuries: conInj.length,
      employeeLti: empLti.length,
      contractorLti: conLti.length,
      typeBreakdown,
    };
  }, [categoryIncidents, hasPersonType]);

  // SummaryData (for backward compat with components that still use it)
  const summaryData = useMemo<SummaryData | null>(() => {
    if (dashIncidents.length === 0 && !dashLoading) return null;
    if (dashIncidents.length === 0) return null;

    const monthlyData: Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }> = {};
    MONTHS.forEach(m => { monthlyData[m] = { injuries: 0, nearMiss: 0, propertyDamage: 0, total: 0 }; });

    const normalizeMonth = (raw: unknown): string | null => {
      if (!raw) return null;
      const s = String(raw).trim();
      if (MONTHS.includes(s)) return s;
      const num = parseInt(s);
      if (num >= 1 && num <= 12) return MONTHS[num - 1];
      return null;
    };

    categoryIncidents.forEach(i => {
      const m = normalizeMonth(i.month);
      if (m && monthlyData[m]) {
        monthlyData[m].total++;
        if (isInjuryType(i.incident_type || '')) monthlyData[m].injuries++;
        if (i.incident_type === 'Near Miss') monthlyData[m].nearMiss++;
        if (i.incident_type === 'ทรัพย์สินเสียหาย') monthlyData[m].propertyDamage++;
      }
    });

    const severityBreakdown: Record<string, number> = {};
    categoryIncidents.forEach(i => {
      const sev = (i.actual_severity as string) || 'ไม่ระบุ';
      severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
    });

    const typeBreakdown: Record<string, number> = {};
    categoryIncidents.forEach(i => {
      const t = (i.incident_type as string) || 'ไม่ระบุ';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    });

    return {
      summary: { ...liveStats },
      monthlyData,
      severityBreakdown,
      typeBreakdown,
    };
  }, [categoryIncidents, dashIncidents.length, dashLoading, liveStats]);

  // TRIR / LTIFR — Combined, Employee, Contractor
  // When a person-type filter is active, the "combined" rate uses only that group's manhours
  const mhScoped = personFilter === 'employee' ? manHours.employee
    : personFilter === 'contractor' ? manHours.contractor
    : manHours.total;
  const trirCombined = mhScoped > 0 ? (liveStats.totalInjuries / mhScoped) * 1000000 : null;
  const ltifrCombined = mhScoped > 0 ? (liveStats.ltiCases / mhScoped) * 1000000 : null;
  const trirEmployee = manHours.employee > 0 ? (liveStats.employeeInjuries / manHours.employee) * 1000000 : null;
  const ltifrEmployee = manHours.employee > 0 ? (liveStats.employeeLti / manHours.employee) * 1000000 : null;
  const trirContractor = manHours.contractor > 0 ? (liveStats.contractorInjuries / manHours.contractor) * 1000000 : null;
  const ltifrContractor = manHours.contractor > 0 ? (liveStats.contractorLti / manHours.contractor) * 1000000 : null;

  // Yearly trend — now driven by selectedYears (not fixed 6 years)
  const yearlyTrend = useMemo(() => {
    const catFiltered = baseIncidents.filter(inc => {
      if (incidentCategory === 'injury') return isInjuryType(inc.incident_type || '');
      if (incidentCategory === 'property') return inc.incident_type === 'ทรัพย์สินเสียหาย';
      return true;
    });

    return [...selectedYears].sort().map(y => {
      const yInc = catFiltered.filter(i => i.year === y);
      const injuries = yInc.filter(i => isInjuryType(i.incident_type || '')).length;
      const lti = yInc.filter(i => isLtiType(i.incident_type || '')).length;
      const mhY = manHoursByYear[y];
      const mh = personFilter === 'employee' ? (mhY?.emp || 0)
        : personFilter === 'contractor' ? (mhY?.con || 0)
        : (mhY?.total || 0);
      return {
        year: y,
        mh,
        trir: mh > 0 ? (injuries / mh) * 1000000 : 0,
        ltifr: mh > 0 ? (lti / mh) * 1000000 : 0,
      };
    });
  }, [baseIncidents, incidentCategory, selectedYears, manHoursByYear, personFilter]);

  // Monthly counts per year (for the month-by-month year comparison chart)
  const monthlyByYear = useMemo(() => {
    const catFiltered = baseIncidents.filter(inc => {
      if (incidentCategory === 'injury') return isInjuryType(inc.incident_type || '');
      if (incidentCategory === 'property') return inc.incident_type === 'ทรัพย์สินเสียหาย';
      return true;
    });
    return [...selectedYears].sort().map(y => {
      const counts = new Array(12).fill(0);
      catFiltered.filter(i => i.year === y).forEach(i => {
        let idx = -1;
        const mNum = parseInt(String(i.month));
        if (mNum >= 1 && mNum <= 12) idx = mNum - 1;
        else if (MONTHS.includes(String(i.month))) idx = MONTHS.indexOf(String(i.month));
        else if (i.incident_date) idx = new Date(i.incident_date).getMonth();
        if (idx >= 0 && idx < 12) counts[idx]++;
      });
      return { year: y, counts };
    });
  }, [baseIncidents, incidentCategory, selectedYears]);

  // trendIncidents & trendManhours — kept for backward compat with OverviewWorkspace
  const trendIncidents = dashIncidents;
  const trendManhours = useMemo(() => {
    const map: Record<number, number> = {};
    for (const y of selectedYears) {
      map[y] = manHoursByYear[y]?.total || 0;
    }
    return map;
  }, [selectedYears, manHoursByYear]);

  // Filtered dashboard incidents based on dashFilter
  const filteredDashIncidents = useMemo(() =>
    categoryIncidents.filter(inc => {
      if (dashFilter.month) {
        const incMonth = inc.month;
        const monthNum = parseInt(String(incMonth));
        const normalizedMonth = (monthNum >= 1 && monthNum <= 12) ? MONTHS[monthNum - 1] : String(incMonth);
        if (normalizedMonth !== dashFilter.month) return false;
      }
      if (dashFilter.type) {
        if (inc.incident_type !== dashFilter.type) return false;
      }
      return true;
    }),
    [categoryIncidents, dashFilter]
  );

  // Monthly stacked data
  const monthlyStacked = useMemo(() => {
    const stacked: Record<string, Record<string, number>> = {};
    MONTHS.forEach(m => { stacked[m] = {}; });
    categoryIncidents.forEach(inc => {
      const raw = inc.month;
      const num = parseInt(String(raw));
      const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(raw);
      if (m && stacked[m] !== undefined) {
        const t = inc.incident_type || 'อื่นๆ';
        stacked[m][t] = (stacked[m][t] || 0) + 1;
      }
    });
    return stacked;
  }, [categoryIncidents]);

  const allTypes = useMemo(() =>
    Array.from(new Set(dashIncidents.map(i => i.incident_type || 'อื่นๆ'))),
    [dashIncidents]
  );
  const maxStackedMonthly = Math.max(...MONTHS.map(m => Object.values(monthlyStacked[m]).reduce((s, v) => s + v, 0)), 1);
  const maxMonthly = summaryData ? Math.max(...Object.values(summaryData.monthlyData).map(m => m.total), 1) : 1;

  /* ═══ Drawer ═══ */

  const openDrawer = useCallback(async (inc: Incident) => {
    setDrawerIncident(inc);
    setDrawerOpen(true);
    setDrawerTab('summary');
    setDrawerDetail(null);
    setDrawerInjured([]);
    setDrawerLoading(true);
    setDrawerError(false);
    try {
      const res = await fetch(`/api/incidents?companyId=${id}&search=${encodeURIComponent(inc.incident_no)}&year=${inc.year}&limit=1`);
      const data = await res.json();
      const detail = (data.incidents || [])[0] || null;
      setDrawerDetail(detail);
      const isInjury = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (inc.incident_type || '').includes(p));
      if (isInjury) {
        try {
          const res2 = await fetch(`/api/incidents/injured?incident_no=${encodeURIComponent(inc.incident_no)}`);
          const data2 = await res2.json();
          setDrawerInjured(data2.persons || []);
        } catch { setDrawerInjured([]); }
      }
    } catch {
      setDrawerError(true);
    }
    setDrawerLoading(false);
  }, [id]);

  const closeDrawer = useCallback(() => { setDrawerOpen(false); }, []);

  /* ═══ List view fetch ═══ */

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const yearsToFetch = selectedYears.length > 0 ? selectedYears : [year];
      const results = await Promise.all(
        yearsToFetch.map(y => {
          const params = new URLSearchParams({ companyId: id, year: String(y), limit: '1000' });
          if (debouncedSearch) params.set('search', debouncedSearch);
          if (filterType) params.set('incidentType', filterType);
          return fetch(`/api/incidents?${params}`).then(r => r.json());
        })
      );
      let allInc: Incident[] = [];
      results.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
      if (workRelatedOnly) allInc = allInc.filter(i => i.work_related === 'ใช่');
      if (incidentCategory === 'injury') allInc = allInc.filter(i => isInjuryType(i.incident_type || ''));
      if (incidentCategory === 'property') allInc = allInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
      // List-view filters (client-side — rows for the selected years are already loaded)
      if (filterSeverity) allInc = allInc.filter(i => ((i.actual_severity as string) || '').startsWith(filterSeverity));
      if (filterStatus) allInc = allInc.filter(i => ((i.report_status as string) || 'Draft') === filterStatus);
      if (filterDateFrom) allInc = allInc.filter(i => (i.incident_date || '').slice(0, 10) >= filterDateFrom);
      if (filterDateTo) allInc = allInc.filter(i => (i.incident_date || '').slice(0, 10) <= filterDateTo);
      allInc.sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || ''));
      setTotal(allInc.length);
      const start = (page - 1) * 20;
      setIncidents(allInc.slice(start, start + 20));
    } catch { /* empty */ }
    setListLoading(false);
  }, [id, year, selectedYears, page, debouncedSearch, filterType, filterSeverity, filterStatus, filterDateFrom, filterDateTo, workRelatedOnly, incidentCategory]);

  useEffect(() => {
    if (viewMode === 'list') fetchList();
  }, [viewMode, fetchList]);

  /* ═══ Form handlers ═══ */

  const openNewForm = () => { setEditingIncident(null); setViewMode('form'); };
  const openEditForm = (incident: Incident) => { setEditingIncident(incident); setViewMode('form'); };
  const handleDelete = async (inc: Incident) => {
    if (!confirm(`ต้องการลบ ${inc.incident_no}?`)) return;
    try {
      await fetch(`/api/incidents?id=${inc.id}`, { method: 'DELETE' });
      fetchList();
    } catch { /* empty */ }
  };

  /* ═══ Loading state ═══ */
  const loading = viewMode === 'dashboard' ? dashLoading : listLoading;

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100%' }} id="pdf-content">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-8 pt-6 pb-3" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — {companyName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {[
                  { mode: 'dashboard' as const, icon: BarChart3, label: 'Dashboard' },
                  { mode: 'list' as const, icon: List, label: 'รายการ' },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-colors"
                    style={{
                      background: viewMode === mode ? 'var(--accent)' : 'transparent',
                      color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>

              {(() => {
                const companyAuthState = auth ? (auth as unknown as { getCompanyAuth: (id: string) => { isLoggedIn: boolean } }).getCompanyAuth(id) : null;
                const isLoggedIn = companyAuthState?.isLoggedIn || (auth as unknown as { isAdmin: boolean })?.isAdmin;
                return (
                  <button
                    onClick={isLoggedIn ? openNewForm : undefined}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
                    style={{
                      background: isLoggedIn ? `linear-gradient(135deg, ${STATUS.critical} 0%, #c23b22 100%)` : '#d1d5db',
                      cursor: isLoggedIn ? 'pointer' : 'not-allowed',
                      opacity: isLoggedIn ? 1 : 0.7,
                    }}
                    title={isLoggedIn ? 'บันทึกอุบัติเหตุใหม่' : 'กรุณาเข้าสู่ระบบก่อนบันทึก'}
                  >
                    <Plus size={16} /> บันทึกอุบัติเหตุ
                  </button>
                );
              })()}
              <ExportPdfButton
                targetId="pdf-content"
                filename={`${companyName}-Incidents-${selectedYears.join('-')}`}
                title={`${companyName} — สถิติอุบัติเหตุ ${selectedYears.join(', ')}`}
                subtitle="Safety & Environment Dashboard — รายงานสถิติอุบัติเหตุ"
                orientation="landscape"
                compact
              />
              <button
                onClick={() => {
                  const year = selectedYears[0] || new Date().getFullYear();
                  window.open(`/api/incidents/export?companyId=${id}&year=${year}`, '_blank');
                }}
                title="Export Excel"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 10, border: 'none',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          <GlobalFilters
            selectedYears={selectedYears}
            setSelectedYears={setSelectedYears}
            workRelatedOnly={workRelatedOnly}
            setWorkRelatedOnly={setWorkRelatedOnly}
            personFilter={personFilter}
            setPersonFilter={setPersonFilter}
            incidentCategory={incidentCategory}
            setIncidentCategory={setIncidentCategory}
            dashFilter={dashFilter}
            setDashFilter={setDashFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setPage={setPage}
            setInjuryFilter={setInjuryFilter}
            setPropFilter={setPropFilter}
          />
        </div>

        <div className="px-8 pb-8" style={{ opacity: loading && viewMode !== 'form' ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          {/* Error state */}
          {dashError && viewMode === 'dashboard' ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle size={32} style={{ color: 'var(--muted)' }} />
              <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>โหลดข้อมูลไม่สำเร็จ</p>
              <button
                onClick={fetchDashboard}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                ลองใหม่
              </button>
            </div>
          ) : viewMode === 'dashboard' ? (
            <div>
              {/* Zero-incident banner — 0 cases is a good result, not missing data */}
              {!dashLoading && dashIncidents.length === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                  padding: '12px 18px', borderRadius: 12,
                  background: '#59A14F14', border: '1px solid #59A14F40',
                }}>
                  <span style={{ fontSize: 20 }}>🎉</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#59A14F' }}>ไม่มีอุบัติเหตุในช่วงปีที่เลือก — 0 เคส</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>สถิติด้านล่างแสดงค่า 0 และคำนวณอัตรา TRIR/LTIFR จากชั่วโมงการทำงานตามปกติ</div>
                  </div>
                </div>
              )}
              {incidentCategory === 'overview' && (
                <OverviewWorkspace
                  categoryIncidents={categoryIncidents}
                  baseIncidents={baseIncidents}
                  liveStats={liveStats}
                  manHours={manHours}
                  selectedYears={selectedYears}
                  trirCombined={trirCombined}
                  ltifrCombined={ltifrCombined}
                  trirEmployee={trirEmployee}
                  ltifrEmployee={ltifrEmployee}
                  trirContractor={trirContractor}
                  ltifrContractor={ltifrContractor}
                  trendIncidents={trendIncidents}
                  trendManhours={trendManhours}
                  workRelatedOnly={workRelatedOnly}
                  dashFilter={dashFilter}
                  setDashFilter={setDashFilter}
                  filteredDashIncidents={filteredDashIncidents}
                  monthlyStacked={monthlyStacked}
                  allTypes={allTypes}
                  maxStackedMonthly={maxStackedMonthly}
                  yearlyTrend={yearlyTrend}
                  openDrawer={openDrawer}
                />
              )}
              {incidentCategory === 'overview' && (
                <>
                  <YearlyTrendChart data={yearlyTrend} />
                  <MonthlyByYearChart series={monthlyByYear} />
                </>
              )}
              {incidentCategory === 'injury' && (
                <InjuryWorkspace
                  categoryIncidents={categoryIncidents}
                  liveStats={liveStats}
                  trirCombined={trirCombined}
                  ltifrCombined={ltifrCombined}
                  injuredPersonsData={scopedInjuredPersons}
                  injuredIncidentMap={injuredIncidentMap}
                  selectedYears={selectedYears}
                  workRelatedOnly={workRelatedOnly}
                  injuryFilter={injuryFilter}
                  setInjuryFilter={setInjuryFilter}
                  openDrawer={openDrawer}
                />
              )}
              {incidentCategory === 'property' && (
                <PropertyDamageWorkspace
                  categoryIncidents={categoryIncidents}
                  liveStats={liveStats}
                  propFilter={propFilter}
                  setPropFilter={setPropFilter}
                  openDrawer={openDrawer}
                />
              )}
              {incidentCategory === 'rates' && (
                <RatesWorkspace
                  dashIncidents={dashIncidents}
                  manHourRows={manHourRows}
                  selectedYears={selectedYears}
                  workRelatedOnly={workRelatedOnly}
                  injuredPersonsData={scopedInjuredPersons}
                />
              )}
              {incidentCategory === 'actions' && (
                <CorrectiveActionWorkspace
                  baseIncidents={baseIncidents}
                  openDrawer={openDrawer}
                />
              )}
            </div>
          ) : viewMode === 'list' ? (
            <IncidentListView
              incidents={incidents}
              total={total}
              page={page}
              setPage={setPage}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterType={filterType}
              setFilterType={setFilterType}
              filterSeverity={filterSeverity}
              setFilterSeverity={setFilterSeverity}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterDateFrom={filterDateFrom}
              setFilterDateFrom={setFilterDateFrom}
              filterDateTo={filterDateTo}
              setFilterDateTo={setFilterDateTo}
              openDrawer={openDrawer}
              openEditForm={openEditForm}
              handleDelete={handleDelete}
              allIncidentsForExport={categoryIncidents}
              companyId={id}
              onImported={() => { fetchList(); fetchDashboard(); }}
              isLoggedIn={(() => {
                const ca = auth ? (auth as unknown as { getCompanyAuth: (id: string) => { isLoggedIn: boolean } }).getCompanyAuth(id) : null;
                return ca?.isLoggedIn || (auth as unknown as { isAdmin: boolean })?.isAdmin || false;
              })()}
            />
          ) : viewMode === 'form' ? (
            <IncidentForm
              companyId={id}
              companyName={companyName}
              editingIncident={editingIncident}
              onClose={() => setViewMode('list')}
              onSaved={() => { setViewMode('list'); fetchList(); }}
            />
          ) : null}
        </div>

      <IncidentDrawer
        open={drawerOpen}
        incident={drawerIncident}
        detail={drawerDetail}
        loading={drawerLoading}
        error={drawerError}
        tab={drawerTab}
        setTab={setDrawerTab}
        injured={drawerInjured}
        onClose={closeDrawer}
        onNavigate={openDrawer}
        onEdit={(inc) => openEditForm(inc)}
        sourceList={(() => {
          if (viewMode === 'dashboard') {
            if (incidentCategory === 'property') return categoryIncidents;
            return filteredDashIncidents;
          }
          return incidents;
        })()}
      />
    </div>
  );
}
