'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, Plus, BarChart3, List,
} from 'lucide-react';
import type { IncidentCategory, LiveStats, ManHours } from './types';
import { buildLiveStats, getSevColor, getTypeBadge, getTypeColor } from './types';
import type { Incident, SummaryData, InjuredPerson } from './types';
import GlobalFilters from './components/GlobalFilters';
import OverviewWorkspace from './components/OverviewWorkspace';
import InjuryWorkspace from './components/InjuryWorkspace';
import PropertyDamageWorkspace from './components/PropertyDamageWorkspace';
import IncidentDrawer from './components/IncidentDrawer';
import IncidentForm from './components/IncidentForm';
import IncidentListView from './components/IncidentListView';
import CorrectiveActionWorkspace from './components/CorrectiveActionWorkspace';
import {
  INCIDENT_TYPES,
  MONTHS,
  MONTH_TH,
  NON_INJURY_TYPES,
  INJURY_TYPES_PART,
  inputStyle,
  selectStyle,
} from './constants';

export default function IncidentsPage() {
  const { id } = useParams() as { id: string };
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);
  const companyName = company?.shortName || id.toUpperCase();

  const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'form'>('dashboard');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Dashboard data
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  // List data
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form data — simplified
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  // Man-hours data for TIFR/LTIFR
  const [manHours, setManHours] = useState<{ employee: number; contractor: number; total: number }>({ employee: 0, contractor: 0, total: 0 });

  // Dashboard filter state (for interactive clicking)
  const [dashFilter, setDashFilter] = useState<{ month?: string; type?: string }>({});
  const [dashIncidents, setDashIncidents] = useState<Incident[]>([]);

  // Dashboard new filters: work-related and multi-year
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021, 2022, 2023, 2024, 2025, 2026]);
  const [incidentCategory, setIncidentCategory] = useState<IncidentCategory>('overview');

  // Cross-filter for injury charts (click to drill down)
  const [injuryFilter, setInjuryFilter] = useState<{ field: string; value: string } | null>(null);
  // Cross-filter for property damage charts
  const [propFilter, setPropFilter] = useState<{ field: string; value: string } | null>(null);

  // Multi-year TRIR/LTIFR trend — raw data for client-side computation
  const [trendIncidents, setTrendIncidents] = useState<Incident[]>([]);
  const [trendManhours, setTrendManhours] = useState<Record<number, number>>({});

  // Injured persons data for injury-specific charts
  const [injuredPersonsData, setInjuredPersonsData] = useState<InjuredPerson[]>([]);
  const [injuredIncidentMap, setInjuredIncidentMap] = useState<Record<string, { year: number; work_related: string; incident_type: string }>>({});

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

  // Open drawer for an incident
  const openDrawer = useCallback(async (inc: Incident) => {
    setDrawerIncident(inc);
    setDrawerOpen(true);
    setDrawerTab('summary');
    setDrawerDetail(null);
    setDrawerInjured([]);
    setDrawerLoading(true);
    setDrawerError(false);
    try {
      // Fetch full detail
      const res = await fetch(`/api/incidents?companyId=${id}&search=${encodeURIComponent(inc.incident_no)}&year=${inc.year}&limit=1`);
      const data = await res.json();
      const detail = (data.incidents || [])[0] || null;
      setDrawerDetail(detail);
      // Fetch injured persons if injury type
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

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Fetch summary (handles multi-year for dashboard)
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      // For dashboard view, fetch for all selectedYears and merge
      const yearsToFetch = viewMode === 'dashboard' ? selectedYears : [year];
      const summaries = await Promise.all(
        yearsToFetch.map(y => fetch(`/api/incidents?mode=summary&companyId=${id}&year=${y}`).then(r => r.json()))
      );
      
      if (summaries.length === 0) {
        setSummaryData(null);
      } else if (summaries.length === 1) {
        setSummaryData(summaries[0]);
      } else {
        // Merge multiple years
        const merged: SummaryData = {
          summary: {
            totalIncidents: summaries.reduce((s, d) => s + (d.summary?.totalIncidents || 0), 0),
            totalInjuries: summaries.reduce((s, d) => s + (d.summary?.totalInjuries || 0), 0),
            ltiCases: summaries.reduce((s, d) => s + (d.summary?.ltiCases || 0), 0),
            nearMisses: summaries.reduce((s, d) => s + (d.summary?.nearMisses || 0), 0),
            propertyDamage: summaries.reduce((s, d) => s + (d.summary?.propertyDamage || 0), 0),
            fatalities: summaries.reduce((s, d) => s + (d.summary?.fatalities || 0), 0),
            totalDirectCost: summaries.reduce((s, d) => s + (d.summary?.totalDirectCost || 0), 0),
            totalIndirectCost: summaries.reduce((s, d) => s + (d.summary?.totalIndirectCost || 0), 0),
            employeeInjuries: summaries.reduce((s, d) => s + (d.summary?.employeeInjuries || 0), 0),
            contractorInjuries: summaries.reduce((s, d) => s + (d.summary?.contractorInjuries || 0), 0),
            employeeLti: summaries.reduce((s, d) => s + (d.summary?.employeeLti || 0), 0),
            contractorLti: summaries.reduce((s, d) => s + (d.summary?.contractorLti || 0), 0),
          },
          monthlyData: {} as Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }>,
          severityBreakdown: {} as Record<string, number>,
          typeBreakdown: {} as Record<string, number>,
        };
        
        // Merge monthly data
        summaries.forEach(d => {
          if (d.monthlyData) {
            Object.entries(d.monthlyData).forEach(([month, data]: [string, any]) => {
              if (!merged.monthlyData[month]) merged.monthlyData[month] = { injuries: 0, nearMiss: 0, propertyDamage: 0, total: 0 };
              merged.monthlyData[month].injuries += data.injuries || 0;
              merged.monthlyData[month].nearMiss += data.nearMiss || 0;
              merged.monthlyData[month].propertyDamage += data.propertyDamage || 0;
              merged.monthlyData[month].total += data.total || 0;
            });
          }
          if (d.severityBreakdown) {
            Object.entries(d.severityBreakdown).forEach(([sev, count]: [string, any]) => {
              merged.severityBreakdown[sev] = (merged.severityBreakdown[sev] || 0) + count;
            });
          }
          if (d.typeBreakdown) {
            Object.entries(d.typeBreakdown).forEach(([type, count]: [string, any]) => {
              merged.typeBreakdown[type] = (merged.typeBreakdown[type] || 0) + count;
            });
          }
        });
        
        setSummaryData(merged);
      }
    } catch { /* empty */ }

    // Fetch man-hours (multi-year for dashboard)
    try {
      const yearsToFetch = viewMode === 'dashboard' ? selectedYears : [year];
      const mhDataSets = await Promise.all(
        yearsToFetch.map(y => fetch(`/api/manhours?companyId=${id}&year=${y}`).then(r => r.json()))
      );
      
      const mh = mhDataSets.reduce(
        (acc, mhData) => {
          const rows = mhData.manHours || [];
          return {
            employee: acc.employee + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.employee_manhours) || 0), 0),
            contractor: acc.contractor + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.contractor_manhours) || 0), 0),
            total: acc.total + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.employee_manhours) || 0) + (Number(r.contractor_manhours) || 0), 0),
          };
        },
        { employee: 0, contractor: 0, total: 0 }
      );
      setManHours(mh);
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year, viewMode, selectedYears]);

  // Fetch list (multi-year support)
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const yearsToFetch = selectedYears.length > 0 ? selectedYears : [year];
      const results = await Promise.all(
        yearsToFetch.map(y => {
          const params = new URLSearchParams({ companyId: id, year: String(y), limit: '1000' });
          if (searchTerm) params.set('search', searchTerm);
          if (filterType) params.set('incidentType', filterType);
          return fetch(`/api/incidents?${params}`).then(r => r.json());
        })
      );
      let allInc: Incident[] = [];
      results.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
      // Apply work-related filter
      if (workRelatedOnly) {
        allInc = allInc.filter(i => i.work_related === 'ใช่');
      }
      // Apply category filter
      if (incidentCategory === 'injury') {
        allInc = allInc.filter(i => ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (i.incident_type || '').includes(p)));
      }
      if (incidentCategory === 'property') {
        allInc = allInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
      }
      // Sort by date descending
      allInc.sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || ''));
      setTotal(allInc.length);
      // Client-side pagination
      const start = (page - 1) * 20;
      setIncidents(allInc.slice(start, start + 20));
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year, selectedYears, page, searchTerm, filterType, workRelatedOnly, incidentCategory]);

  useEffect(() => {
    if (viewMode === 'dashboard') fetchSummary();
    else if (viewMode === 'list') fetchList();
  }, [viewMode, fetchSummary, fetchList]);

  // Fetch all incidents for dashboard table (multi-year)
  useEffect(() => {
    if (viewMode === 'dashboard') {
      Promise.all(
        selectedYears.map(y => fetch(`/api/incidents?companyId=${id}&year=${y}&limit=1000`).then(r => r.json()))
      )
        .then(results => {
          const allIncidents = results.flatMap(d => d.incidents || []);
          setDashIncidents(allIncidents);
        })
        .catch(() => setDashIncidents([]));
    }
  }, [viewMode, id, selectedYears]);

  // Fetch multi-year raw data for TRIR/LTIFR trend (incidents + manhours for 6 years)
  useEffect(() => {
    if (viewMode !== 'dashboard') return;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

    // Fetch all incidents for 6 years
    Promise.all(years.map(y => fetch(`/api/incidents?companyId=${id}&year=${y}&limit=1000`).then(r => r.json())))
      .then(results => {
        const allInc: Incident[] = [];
        results.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
        setTrendIncidents(allInc);
      })
      .catch(() => setTrendIncidents([]));

    // Fetch manhours for 6 years
    Promise.all(years.map(y => fetch(`/api/manhours?companyId=${id}&year=${y}`).then(r => r.json()).then(d => ({
      year: y,
      total: (d.manHours || []).reduce((acc: number, r: Record<string, unknown>) => acc + (Number(r.employee_manhours) || 0) + (Number(r.contractor_manhours) || 0), 0),
    }))))
      .then(results => {
        const mhMap: Record<number, number> = {};
        results.forEach(r => { mhMap[r.year] = r.total; });
        setTrendManhours(mhMap);
      })
      .catch(() => setTrendManhours({}));
  }, [viewMode, id]);

  // Fetch injured persons data when in injury category
  useEffect(() => {
    if (viewMode !== 'dashboard' || incidentCategory !== 'injury' || selectedYears.length === 0) {
      return;
    }
    fetch(`/api/incidents/injured-bulk?company_id=${id}&years=${selectedYears.join(',')}`)
      .then(r => r.json())
      .then(data => {
        setInjuredPersonsData(data.persons || []);
        setInjuredIncidentMap(data.incidentMap || {});
      })
      .catch(() => {
        setInjuredPersonsData([]);
        setInjuredIncidentMap({});
      });
  }, [viewMode, id, incidentCategory, selectedYears]);

  // Form handlers — simplified
  const openNewForm = () => {
    setEditingIncident(null);
    setViewMode('form');
  };

  const openEditForm = (incident: Incident) => {
    setEditingIncident(incident);
    setViewMode('form');
  };

  const handleDelete = async (inc: Incident) => {
    if (!confirm(`ต้องการลบ ${inc.incident_no}?`)) return;
    try {
      await fetch(`/api/incidents?id=${inc.id}`, { method: 'DELETE' });
      fetchList();
    } catch { /* empty */ }
  };

  // Base incidents filtered by workRelatedOnly (for KPIs, type cards, charts)
  const baseIncidents = workRelatedOnly ? dashIncidents.filter(i => i.work_related === 'ใช่') : dashIncidents;

  const categoryIncidents = baseIncidents.filter(inc => {
    if (incidentCategory === 'injury') {
      return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (inc.incident_type || '').includes(p));
    }
    if (incidentCategory === 'property') {
      return inc.incident_type === 'ทรัพย์สินเสียหาย';
    }
    return true;
  });

  // Compute live stats from baseIncidents (respects workRelatedOnly toggle)
  const liveStats = (() => {
    const injuryIncidents = categoryIncidents.filter(i => INJURY_TYPES_PART.some(p => (i.incident_type || '').includes(p)));
    const ltiIncidents = categoryIncidents.filter(i => {
      const t = i.incident_type || '';
      return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
    });
    const nearMisses = categoryIncidents.filter(i => i.incident_type === 'Near Miss');
    const propDamage = categoryIncidents.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
    const fatalities = categoryIncidents.filter(i => (i.incident_type || '').includes('เสียชีวิต'));
    const directCost = categoryIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0), 0);
    const indirectCost = categoryIncidents.reduce((s, i) => s + (Number(i.indirect_cost) || 0), 0);

    // Employee vs Contractor breakdown
    const empInj = injuryIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
    const conInj = injuryIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));
    const empLti = ltiIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
    const conLti = ltiIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));

    // Type breakdown
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
  })();

  // Calculate TIFR/LTIFR — Combined, Employee-only, Contractor-only (uses liveStats for toggle support)
  const tifrCombined = manHours.total > 0 ? (liveStats.totalInjuries / manHours.total) * 1000000 : null;
  const ltifrCombined = manHours.total > 0 ? (liveStats.ltiCases / manHours.total) * 1000000 : null;
  const tifrEmployee = manHours.employee > 0 ? (liveStats.employeeInjuries / manHours.employee) * 1000000 : null;
  const ltifrEmployee = manHours.employee > 0 ? (liveStats.employeeLti / manHours.employee) * 1000000 : null;
  const tifrContractor = manHours.contractor > 0 ? (liveStats.contractorInjuries / manHours.contractor) * 1000000 : null;
  const ltifrContractor = manHours.contractor > 0 ? (liveStats.contractorLti / manHours.contractor) * 1000000 : null;

  // Compute yearlyTrend from raw data — respects workRelatedOnly toggle
  const yearlyTrend = (() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);
    const filtered = workRelatedOnly ? trendIncidents.filter(i => i.work_related === 'ใช่') : trendIncidents;
    
    // Apply category filter to trend data
    const categoryFiltered = filtered.filter(inc => {
      if (incidentCategory === 'injury') {
        return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (inc.incident_type || '').includes(p));
      }
      if (incidentCategory === 'property') {
        return inc.incident_type === 'ทรัพย์สินเสียหาย';
      }
      return true;
    });
    
    return years.map(y => {
      const yInc = categoryFiltered.filter(i => i.year === y);
      const injuries = yInc.filter(i => INJURY_TYPES_PART.some(p => (i.incident_type || '').includes(p))).length;
      const lti = yInc.filter(i => {
        const t = i.incident_type || '';
        return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
      }).length;
      const mh = trendManhours[y] || 0;
      return {
        year: y,
        trir: mh > 0 ? (injuries / mh) * 1000000 : 0,
        ltifr: mh > 0 ? (lti / mh) * 1000000 : 0,
      };
    });
  })();

  // Filtered dashboard incidents based on dashFilter
  const filteredDashIncidents = categoryIncidents.filter(inc => {
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
  });

  // Compute monthly stacked data from baseIncidents (respects work-related filter)
  const monthlyStacked: Record<string, Record<string, number>> = {};
  MONTHS.forEach(m => { monthlyStacked[m] = {}; });
  categoryIncidents.forEach(inc => {
    const raw = inc.month;
    const num = parseInt(String(raw));
    const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(raw);
    if (m && monthlyStacked[m] !== undefined) {
      const t = inc.incident_type || 'อื่นๆ';
      monthlyStacked[m][t] = (monthlyStacked[m][t] || 0) + 1;
    }
  });
  const allTypes = Array.from(new Set(dashIncidents.map(i => i.incident_type || 'อื่นๆ')));
  const maxStackedMonthly = Math.max(...MONTHS.map(m => Object.values(monthlyStacked[m]).reduce((s, v) => s + v, 0)), 1);

  // Max bar value for chart
  const maxMonthly = summaryData ? Math.max(...Object.values(summaryData.monthlyData).map(m => m.total), 1) : 1;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-8 pt-6 pb-3" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — {companyName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* View mode tabs */}
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
                      background: isLoggedIn ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#d1d5db',
                      cursor: isLoggedIn ? 'pointer' : 'not-allowed',
                      opacity: isLoggedIn ? 1 : 0.7,
                    }}
                    title={isLoggedIn ? 'บันทึกอุบัติเหตุใหม่' : 'กรุณาเข้าสู่ระบบก่อนบันทึก'}
                  >
                    <Plus size={16} /> บันทึกอุบัติเหตุ
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Global Filters + Category Tabs (Extracted Component) */}
          <GlobalFilters
            selectedYears={selectedYears}
            setSelectedYears={setSelectedYears}
            workRelatedOnly={workRelatedOnly}
            setWorkRelatedOnly={setWorkRelatedOnly}
            incidentCategory={incidentCategory}
            setIncidentCategory={setIncidentCategory}
            dashFilter={dashFilter}
            setDashFilter={setDashFilter}
            viewMode={viewMode}
            setPage={setPage}
            setInjuryFilter={setInjuryFilter}
            setPropFilter={setPropFilter}
          />
        </div>

        <div className="px-8 pb-8">
          {loading && viewMode !== 'form' ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span className="text-[13px]" style={{ color: 'var(--muted)' }}>กำลังโหลดข้อมูล...</span>
            </div>
          ) : viewMode === 'dashboard' && !summaryData && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle size={32} style={{ color: 'var(--muted)' }} />
              <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>โหลดข้อมูลไม่สำเร็จ หรือไม่มีข้อมูลสำหรับปีที่เลือก</p>
              <button
                onClick={() => { fetchSummary(); }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                ลองใหม่
              </button>
            </div>
          ) : viewMode === 'dashboard' && summaryData ? (
            /* ===================== DASHBOARD VIEW — WORKSPACE COMPONENTS ===================== */
            <div>
              {incidentCategory === 'overview' && (
                <OverviewWorkspace
                  categoryIncidents={categoryIncidents}
                  baseIncidents={baseIncidents}
                  liveStats={liveStats}
                  manHours={manHours}
                  selectedYears={selectedYears}
                  tifrCombined={tifrCombined}
                  ltifrCombined={ltifrCombined}
                  tifrEmployee={tifrEmployee}
                  ltifrEmployee={ltifrEmployee}
                  tifrContractor={tifrContractor}
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
              {incidentCategory === 'injury' && (
                <InjuryWorkspace
                  categoryIncidents={categoryIncidents}
                  liveStats={liveStats}
                  tifrCombined={tifrCombined}
                  ltifrCombined={ltifrCombined}
                  injuredPersonsData={injuredPersonsData}
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
              {incidentCategory === 'actions' && (
                <CorrectiveActionWorkspace
                  baseIncidents={baseIncidents}
                  openDrawer={openDrawer}
                />
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* ===================== LIST VIEW (Extracted Component) ===================== */
            <IncidentListView
              incidents={incidents}
              total={total}
              page={page}
              setPage={setPage}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterType={filterType}
              setFilterType={setFilterType}
              openDrawer={openDrawer}
              openEditForm={openEditForm}
              handleDelete={handleDelete}
              allIncidentsForExport={categoryIncidents}
              companyId={id}
              onImported={() => { fetchList(); fetchSummary(); }}
            />
          ) : viewMode === 'form' ? (
            /* ===================== FORM VIEW — Use IncidentForm Component ===================== */
            <IncidentForm
              companyId={id}
              companyName={companyName}
              editingIncident={editingIncident}
              onClose={() => setViewMode('list')}
              onSaved={() => { setViewMode('list'); fetchList(); }}
            />
          ) : null}
        </div>
      </main>

      {/* ===================== INCIDENT DRAWER (Extracted Component) ===================== */}
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
