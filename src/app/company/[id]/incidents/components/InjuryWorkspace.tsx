'use client';

import { useState } from 'react';
import {
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  BarChart3,
  Eye,
  Users,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Incident, InjuredPerson, LiveStats, getTypeBadge, getSevColor } from '../types';

const INJ_SEVERITIES = [
  'FA ปฐมพยาบาล', 'MTC รักษาโดยแพทย์', 'RW ทำงานอย่างจำกัด',
  'LTI หยุดงาน', 'PD ทุพพลภาพถาวร', 'Fatal เสียชีวิต',
];

interface InjuryWorkspaceProps {
  categoryIncidents: Incident[];
  liveStats: LiveStats;
  tifrCombined: number | null;
  ltifrCombined: number | null;
  injuredPersonsData: InjuredPerson[];
  injuredIncidentMap: Record<string, { year: number; work_related: string; incident_type: string }>;
  selectedYears: number[];
  workRelatedOnly: boolean;
  injuryFilter: { field: string; value: string } | null;
  setInjuryFilter: (f: { field: string; value: string } | null) => void;
  openDrawer: (inc: Incident) => void;
}

export default function InjuryWorkspace({
  categoryIncidents,
  liveStats,
  tifrCombined,
  ltifrCombined,
  injuredPersonsData,
  injuredIncidentMap,
  selectedYears,
  workRelatedOnly,
  injuryFilter,
  setInjuryFilter,
  openDrawer,
}: InjuryWorkspaceProps) {
  const [showTriageTooltip, setShowTriageTooltip] = useState<string | null>(null);
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set());
  const [tableSortKey, setTableSortKey] = useState<string>('date');
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [tableShowCount, setTableShowCount] = useState(15);
  const [hoveredBar, setHoveredBar] = useState<{ chart: string; key: string } | null>(null);
  const [hoveredLostDay, setHoveredLostDay] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState<'stacked' | 'latest'>('latest');

  const toggleChart = (chartField: string) => {
    setExpandedCharts(prev => {
      const next = new Set(prev);
      if (next.has(chartField)) next.delete(chartField); else next.add(chartField);
      return next;
    });
  };

  const toggleSort = (key: string) => {
    if (tableSortKey === key) setTableSortAsc(!tableSortAsc);
    else { setTableSortKey(key); setTableSortAsc(key === 'date'); }
  };

  return (
    <>
      {/* ═══ KPI Section — Incident vs Person metrics clearly separated ═══ */}
      {(() => {
        const totalCost = liveStats.totalDirectCost + liveStats.totalIndirectCost;
        const trirVal = tifrCombined !== null ? tifrCombined.toFixed(2) : '—';
        const ltifrVal = ltifrCombined !== null ? ltifrCombined.toFixed(2) : '—';

        // Count persons from injuredPersonsData (for person-based metrics)
        const personCountFiltered = injuredPersonsData.filter(p => {
          const incInfo = injuredIncidentMap[p.incident_no];
          if (!incInfo) return false;
          if (!selectedYears.includes(incInfo.year)) return false;
          if (workRelatedOnly && incInfo.work_related !== 'ใช่') return false;
          const t = incInfo.incident_type || '';
          return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p2 => t.includes(p2));
        });
        const personTotal = personCountFiltered.length;
        const personLtiTotal = personCountFiltered.filter(p => p.is_lti === 'ใช่').length;
        const personTotalLostDays = personCountFiltered.reduce((s, p) => s + (Number(p.lost_work_days) || 0), 0);

        type KPIItem = {
          label: string;
          value: string | number;
          sub: string;
          formula?: string;
          icon: typeof AlertTriangle;
          color: string;
        };

        const primaryKpis: KPIItem[] = [
          { label: 'จำนวนเหตุบาดเจ็บ', value: liveStats.totalIncidents, sub: 'เหตุการณ์ (incidents)', icon: FileText, color: '#f97316' },
          { label: 'จำนวนผู้บาดเจ็บ', value: personTotal, sub: 'คน (injured persons)', icon: Users, color: '#3b82f6' },
          { label: 'LTI / Fatal', value: `${personLtiTotal} / ${liveStats.fatalities}`, sub: 'หยุดงาน / เสียชีวิต', icon: AlertTriangle, color: '#ef4444' },
          { label: 'วันหยุดงานรวม', value: personTotalLostDays.toLocaleString(), sub: 'วัน (lost work days)', icon: Clock, color: '#dc2626' },
          { label: 'TRIR', value: trirVal, sub: 'ต่อ 1,000,000 ชม.ทำงาน', formula: '(Injuries × 1M) ÷ Total Hours', icon: TrendingUp, color: '#8b5cf6' },
          { label: 'LTIFR', value: ltifrVal, sub: 'ต่อ 1,000,000 ชม.ทำงาน', formula: '(LTI × 1M) ÷ Total Hours', icon: TrendingDown, color: '#ec4899' },
        ];

        return (
          <>
            {/* Primary KPIs — 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              {primaryKpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 relative group"
                  style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}
                  onMouseEnter={() => kpi.formula ? setShowTriageTooltip(kpi.label) : undefined}
                  onMouseLeave={() => setShowTriageTooltip(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                    </div>
                    <p className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                    {kpi.formula && <Info size={10} style={{ color: 'var(--muted)', cursor: 'help' }} />}
                  </div>
                  <p className="text-xl font-bold" style={{ color: kpi.color }}>
                    {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>{kpi.sub}</p>
                  {kpi.formula && showTriageTooltip === kpi.label && (
                    <div className="absolute left-0 top-full mt-1 z-20 px-3 py-2 rounded-lg shadow-lg text-[10px]"
                      style={{ background: '#1e293b', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                      {kpi.formula}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Secondary: Cost — smaller row */}
            <div className="flex items-center gap-3 mb-5 px-2 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <DollarSign size={14} style={{ color: '#22c55e' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>ค่าเสียหายรวม</span>
              <span className="text-[13px] font-bold" style={{ color: '#22c55e' }}>
                {totalCost >= 1000 ? `${(totalCost / 1000).toFixed(0)}K ฿` : `${totalCost.toLocaleString()} ฿`}
              </span>
              <span className="text-[9px]" style={{ color: 'var(--muted)' }}>(ค่าใช้จ่ายตรง {liveStats.totalDirectCost.toLocaleString()} + อ้อม {liveStats.totalIndirectCost.toLocaleString()} ฿)</span>
            </div>
          </>
        );
      })()}

      {/* INJURY-SPECIFIC CHARTS */}
      {(() => {
        // Base filter: workRelatedOnly + selected years + injury type
        const allFilteredPersons = injuredPersonsData.filter(p => {
          const incInfo = injuredIncidentMap[p.incident_no];
          if (!incInfo) return false;
          if (!selectedYears.includes(incInfo.year)) return false;
          if (workRelatedOnly && incInfo.work_related !== 'ใช่') return false;
          const t = incInfo.incident_type || '';
          return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p2 => t.includes(p2));
        });

        // Apply cross-filter
        const filteredPersons = injuryFilter
          ? allFilteredPersons.filter(p => {
              if (injuryFilter.field === 'is_lti') {
                const isLti = p.is_lti === 'ใช่';
                return injuryFilter.value === 'หยุดงาน (LTI)' ? isLti : !isLti;
              }
              return (p[injuryFilter.field as keyof InjuredPerson] as string || 'ไม่ระบุ') === injuryFilter.value;
            })
          : allFilteredPersons;

        const YEAR_COLORS_INJ: Record<number, string> = {
          2021: '#94a3b8',
          2022: '#64748b',
          2023: '#8b5cf6',
          2024: '#3b82f6',
          2025: '#f97316',
          2026: '#ef4444',
        };

        const activeYears = selectedYears
          .filter(y => allFilteredPersons.some(p => injuredIncidentMap[p.incident_no]?.year === y))
          .sort();

        // Field labels for display
        const FIELD_LABELS: Record<string, string> = {
          is_lti: 'หยุดงานหรือไม่',
          injury_severity: 'ระดับการบาดเจ็บ',
          nature_of_injury: 'ลักษณะการบาดเจ็บ',
          body_part: 'ส่วนร่างกาย',
          department: 'แผนก',
          person_type: 'ประเภทบุคคล',
        };

        // Helper: group persons by a field per year
        const groupByFieldPerYear = (
          persons: InjuredPerson[],
          field: keyof InjuredPerson,
          labels?: string[]
        ) => {
          const counts: Record<string, Record<number, number>> = {};
          persons.forEach(p => {
            const val = (p[field] as string) || 'ไม่ระบุ';
            const yr = injuredIncidentMap[p.incident_no]?.year;
            if (!yr) return;
            if (!counts[val]) counts[val] = {};
            counts[val][yr] = (counts[val][yr] || 0) + 1;
          });
          let keys = Object.keys(counts);
          if (labels) {
            keys = labels.filter(l => counts[l]);
            Object.keys(counts).forEach(k => {
              if (!keys.includes(k)) keys.push(k);
            });
          } else {
            keys.sort((a, b) => {
              const totA = Object.values(counts[a]).reduce((s, v) => s + v, 0);
              const totB = Object.values(counts[b]).reduce((s, v) => s + v, 0);
              return totB - totA;
            });
          }
          keys = keys.slice(0, 12);
          return { keys, counts };
        };

        // ---- Clickable stacked horizontal bar chart (with hover, expand/collapse, transitions, compare mode) ----
        const COLLAPSED_LIMIT = 6;
        const latestYear = activeYears.length > 0 ? activeYears[activeYears.length - 1] : null;
        const displayYears = compareMode === 'latest' && latestYear ? [latestYear] : activeYears;

        const renderStackedBarChart = (
          title: string,
          chartField: string,
          data: { keys: string[]; counts: Record<string, Record<number, number>> },
          options?: { wideLabel?: boolean }
        ) => {
          const { keys: allKeys, counts } = data;
          if (allKeys.length === 0) return null;

          const wideLabel = options?.wideLabel || false;
          const isExpanded = expandedCharts.has(chartField);
          const keys = allKeys.length > COLLAPSED_LIMIT && !isExpanded
            ? allKeys.slice(0, COLLAPSED_LIMIT)
            : allKeys;
          const hiddenCount = allKeys.length - COLLAPSED_LIMIT;

          const maxTotal = Math.max(
            ...allKeys.map(k => displayYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0)),
            1
          );
          const grandTotal = allKeys.reduce((s, k) => s + displayYears.reduce((s2, y) => s2 + (counts[k]?.[y] || 0), 0), 0);
          const isThisChartFiltered = injuryFilter?.field === chartField;
          const isHoveringThisChart = hoveredBar?.chart === chartField;

          return (
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'var(--card-solid)',
                border: isThisChartFiltered ? '2px solid var(--accent)' : '1px solid var(--border)',
                transition: 'border-color 0.2s',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                {isThisChartFiltered ? (
                  <button
                    onClick={() => setInjuryFilter(null)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {injuryFilter?.value} <X size={10} />
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ color: 'var(--accent)', background: 'var(--bg-secondary)' }}>
                    <Filter size={10} /> คลิกแท่งเพื่อกรอง
                  </span>
                )}
              </div>
              <div className={wideLabel ? 'space-y-2.5' : 'space-y-1.5'}>
                {keys.map(k => {
                  const total = displayYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0);
                  const barPct = (total / maxTotal) * 100;
                  const pctOfAll = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(0) : '0';
                  const isActive = isThisChartFiltered && injuryFilter?.value === k;
                  const isDimmed = isThisChartFiltered && !isActive;
                  const isRowHovered = isHoveringThisChart && hoveredBar?.key === k;

                  if (wideLabel) {
                    // Wide-label layout: label on top, bar below (full width)
                    return (
                      <div
                        key={k}
                        className="rounded-lg px-2 py-1.5 transition-all"
                        style={{
                          cursor: 'pointer',
                          opacity: isDimmed ? 0.3 : 1,
                          background: isActive ? 'var(--bg-secondary)' : isRowHovered ? 'var(--bg-secondary)' : 'transparent',
                          transition: 'opacity 0.2s, background 0.15s',
                        }}
                        onClick={() => {
                          if (isActive) setInjuryFilter(null);
                          else setInjuryFilter({ field: chartField, value: k });
                        }}
                        onMouseEnter={() => setHoveredBar({ chart: chartField, key: k })}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: isRowHovered ? 'var(--accent)' : 'var(--text-primary)', transition: 'color 0.15s' }}
                          >
                            {k}
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>
                            {total} <span className="text-[8px]">({pctOfAll}%)</span>
                          </span>
                        </div>
                        <div className="relative rounded-md overflow-hidden" style={{ height: isRowHovered ? 24 : 20, background: 'var(--bg-secondary)', transition: 'height 0.15s' }}>
                          <div
                            className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden"
                            style={{ width: `${Math.max(barPct, total > 0 ? 3 : 0)}%`, transition: 'width 0.4s ease' }}
                          >
                            {displayYears.map(y => {
                              const val = counts[k]?.[y] || 0;
                              if (val === 0) return null;
                              const segPct = (val / total) * 100;
                              return (
                                <div
                                  key={y}
                                  className="h-full flex items-center justify-center"
                                  style={{ width: `${segPct}%`, background: YEAR_COLORS_INJ[y] || '#9ca3af', minWidth: val > 0 ? 14 : 0, transition: 'width 0.3s ease' }}
                                >
                                  {segPct > 15 && <span className="text-[9px] font-bold text-white/80">{val}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Standard side-label layout
                  return (
                    <div
                      key={k}
                      className="flex items-center gap-3 rounded-lg px-2 py-1 transition-all"
                      style={{
                        cursor: 'pointer',
                        opacity: isDimmed ? 0.3 : 1,
                        background: isActive ? 'var(--bg-secondary)' : isRowHovered ? 'var(--bg-secondary)' : 'transparent',
                        transition: 'opacity 0.2s, background 0.15s',
                      }}
                      onClick={() => {
                        if (isActive) setInjuryFilter(null);
                        else setInjuryFilter({ field: chartField, value: k });
                      }}
                      onMouseEnter={() => setHoveredBar({ chart: chartField, key: k })}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <span
                        className="text-[11px] font-medium shrink-0 text-right"
                        style={{
                          color: isRowHovered ? 'var(--accent)' : 'var(--text-primary)',
                          width: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'color 0.15s',
                        }}
                        title={k}
                      >
                        {k}
                      </span>
                      <div className="flex-1 flex items-center gap-2 relative">
                        <div
                          className="flex-1 relative rounded-md overflow-hidden"
                          style={{ height: isRowHovered ? 26 : 22, background: 'var(--bg-secondary)', transition: 'height 0.15s' }}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden"
                            style={{ width: `${Math.max(barPct, total > 0 ? 3 : 0)}%`, transition: 'width 0.4s ease' }}
                          >
                            {displayYears.map(y => {
                              const val = counts[k]?.[y] || 0;
                              if (val === 0) return null;
                              const segPct = (val / total) * 100;
                              return (
                                <div
                                  key={y}
                                  className="h-full flex items-center justify-center"
                                  style={{
                                    width: `${segPct}%`,
                                    background: YEAR_COLORS_INJ[y] || '#9ca3af',
                                    minWidth: val > 0 ? 14 : 0,
                                    transition: 'width 0.3s ease',
                                  }}
                                >
                                  {segPct > 20 && (
                                    <span className="text-[9px] font-bold text-white/80">{val}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)', width: 32, textAlign: 'right' }}>
                          {pctOfAll}%
                        </span>
                        <span
                          className="text-[12px] font-bold shrink-0"
                          style={{ color: 'var(--text-primary)', width: 26, textAlign: 'right' }}
                        >
                          {total}
                        </span>
                        {/* Hover tooltip showing year breakdown */}
                        {isRowHovered && displayYears.length > 1 && (
                          <div className="absolute right-0 -top-8 z-20 px-2.5 py-1.5 rounded-lg shadow-lg flex items-center gap-2"
                            style={{ background: '#1e293b', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {displayYears.map(y => {
                              const val = counts[k]?.[y] || 0;
                              return (
                                <span key={y} className="flex items-center gap-1 text-[9px]" style={{ color: '#e2e8f0' }}>
                                  <span className="w-1.5 h-1.5 rounded-sm" style={{ background: YEAR_COLORS_INJ[y] || '#9ca3af' }} />
                                  {y}: <b>{val}</b>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Expand / Collapse toggle */}
              {allKeys.length > COLLAPSED_LIMIT && (
                <button
                  onClick={() => toggleChart(chartField)}
                  className="flex items-center gap-1 mt-2 px-3 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--accent)' }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={12} /> ย่อ
                    </>
                  ) : (
                    <>
                      <ChevronDown size={12} /> แสดงเพิ่ม {hiddenCount} รายการ
                    </>
                  )}
                </button>
              )}
            </div>
          );
        };

        // ---- Data computations ----
        const personsFor = (chartField: string) =>
          injuryFilter && injuryFilter.field !== chartField ? filteredPersons : allFilteredPersons;

        // Chart 1: LTI vs non-LTI
        const ltiData = (() => {
          const src = personsFor('is_lti');
          const counts: Record<string, Record<number, number>> = {
            'หยุดงาน (LTI)': {},
            'ไม่หยุดงาน': {},
          };
          src.forEach(p => {
            const yr = injuredIncidentMap[p.incident_no]?.year;
            if (!yr) return;
            const key = p.is_lti === 'ใช่' ? 'หยุดงาน (LTI)' : 'ไม่หยุดงาน';
            counts[key][yr] = (counts[key][yr] || 0) + 1;
          });
          return { keys: ['หยุดงาน (LTI)', 'ไม่หยุดงาน'], counts };
        })();

        // Chart 2: Lost work days per year
        const lostDaysData: Record<number, number> = {};
        filteredPersons.forEach(p => {
          const yr = injuredIncidentMap[p.incident_no]?.year;
          if (!yr) return;
          lostDaysData[yr] = (lostDaysData[yr] || 0) + (Number(p.lost_work_days) || 0);
        });
        const maxLostDays = Math.max(...activeYears.map(y => lostDaysData[y] || 0), 1);
        const totalLostDays = activeYears.reduce((s, y) => s + (lostDaysData[y] || 0), 0);

        // Charts 3-7
        const severityData = groupByFieldPerYear(personsFor('injury_severity'), 'injury_severity', INJ_SEVERITIES);
        const natureData = groupByFieldPerYear(personsFor('nature_of_injury'), 'nature_of_injury');
        const bodyPartData = groupByFieldPerYear(personsFor('body_part'), 'body_part');
        const personTypeData = groupByFieldPerYear(personsFor('person_type'), 'person_type');

        // Department breakdown from incidents (not persons)
        const deptFromIncidents = (() => {
          const src = injuryFilter && injuryFilter.field !== 'department'
            ? categoryIncidents.filter(inc => {
                if (injuryFilter.field === 'is_lti') {
                  const t = inc.incident_type || '';
                  const isLti = (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
                  return injuryFilter.value === 'หยุดงาน (LTI)' ? isLti : !isLti;
                }
                return true;
              })
            : categoryIncidents;
          const counts: Record<string, Record<number, number>> = {};
          src.forEach(inc => {
            const dept = inc.department || 'ไม่ระบุ';
            const yr = inc.year;
            if (!counts[dept]) counts[dept] = {};
            counts[dept][yr] = (counts[dept][yr] || 0) + 1;
          });
          let keys = Object.keys(counts);
          keys.sort((a, b) => {
            const totA = Object.values(counts[a]).reduce((s, v) => s + v, 0);
            const totB = Object.values(counts[b]).reduce((s, v) => s + v, 0);
            return totB - totA;
          });
          keys = keys.slice(0, 12);
          return { keys, counts };
        })();

        // Quick filter chips
        const ltiCount = allFilteredPersons.filter(p => p.is_lti === 'ใช่').length;
        const fatalCount = allFilteredPersons.filter(p => {
          const inc = injuredIncidentMap[p.incident_no];
          return inc && (inc.incident_type || '').includes('เสียชีวิต');
        }).length;
        const rwCount = allFilteredPersons.filter(p => (p.injury_severity || '').includes('RW')).length;

        const chipFilters: { label: string; field: string; value: string; count: number; color?: string }[] = [
          { label: 'ทั้งหมด', field: '', value: '', count: allFilteredPersons.length },
          { label: 'LTI หยุดงาน', field: 'is_lti', value: 'หยุดงาน (LTI)', count: ltiCount, color: '#ef4444' },
          { label: 'ทำงานจำกัด (RW)', field: 'injury_severity', value: 'RW ทำงานอย่างจำกัด', count: rwCount, color: '#eab308' },
          { label: 'เสียชีวิต', field: 'injury_severity', value: 'Fatal เสียชีวิต', count: fatalCount, color: '#991b1b' },
        ];

        // Filtered incidents for records table
        const filteredIncForTable = injuryFilter
          ? categoryIncidents.filter(inc => {
              if (injuryFilter.field === 'is_lti') {
                const t = inc.incident_type || '';
                const isLti = (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
                return injuryFilter.value === 'หยุดงาน (LTI)' ? isLti : !isLti;
              }
              if (injuryFilter.field === 'department') {
                return (inc.department || 'ไม่ระบุ') === injuryFilter.value;
              }
              const persons = injuredPersonsData.filter(p => p.incident_no === inc.incident_no);
              return persons.some(p => {
                const val = (p[injuryFilter.field as keyof InjuredPerson] as string) || 'ไม่ระบุ';
                return val === injuryFilter.value;
              });
            })
          : categoryIncidents;

        // ═══ TRIAGE DATA: Build "ต้องตรวจทันที" ═══
        // 1. Recent serious cases (LTI/Fatal, sorted by date desc)
        const seriousCases = categoryIncidents
          .filter(inc => {
            const t = inc.incident_type || '';
            return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t.includes('เสียชีวิต') || (inc.actual_severity || '').includes('Major');
          })
          .sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || ''))
          .slice(0, 5);

        // 2. Incidents missing injured person data
        const incidentNosWithPersons = new Set(injuredPersonsData.map(p => p.incident_no));
        const missingPersonData = categoryIncidents
          .filter(inc => !incidentNosWithPersons.has(inc.incident_no))
          .slice(0, 5);

        // 3. Top lost-days cases
        const personLostDays = injuredPersonsData
          .filter(p => {
            const incInfo = injuredIncidentMap[p.incident_no];
            return incInfo && selectedYears.includes(incInfo.year) && (Number(p.lost_work_days) || 0) > 0;
          })
          .sort((a, b) => (Number(b.lost_work_days) || 0) - (Number(a.lost_work_days) || 0))
          .slice(0, 5);

        const hasTriageData = seriousCases.length > 0 || missingPersonData.length > 0 || personLostDays.length > 0;

        return (
          <div className="mt-2">
            {/* ═══ "ต้องตรวจทันที" Triage Section ═══ */}
            {hasTriageData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
                {/* Serious cases */}
                {seriousCases.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                      <span className="text-[12px] font-bold" style={{ color: '#991b1b' }}>
                        เคสรุนแรงล่าสุด ({seriousCases.length})
                      </span>
                    </div>
                    {seriousCases.map((inc, i) => {
                      const t = inc.incident_type || '';
                      const isFatal = t.includes('เสียชีวิต');
                      const persons = injuredPersonsData.filter(p => p.incident_no === inc.incident_no);
                      const maxDays = Math.max(...persons.map(p => Number(p.lost_work_days) || 0), 0);
                      return (
                        <div key={i} onClick={() => openDrawer(inc)}
                          className="flex items-center gap-2 py-2 rounded-lg px-2 mb-1 transition-colors hover:bg-red-100"
                          style={{ cursor: 'pointer', borderBottom: i < seriousCases.length - 1 ? '1px solid #fecaca' : 'none' }}>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                            background: isFatal ? '#991b1b' : '#dc2626', color: '#fff',
                          }}>
                            {isFatal ? 'FATAL' : 'LTI'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate" style={{ color: '#7f1d1d' }}>
                              {inc.incident_date} — {inc.department || 'ไม่ระบุแผนก'}
                            </div>
                            <div className="text-[10px] truncate" style={{ color: '#991b1b' }}>
                              {inc.description || inc.incident_type}
                            </div>
                          </div>
                          {maxDays > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{ background: '#fecaca', color: '#991b1b' }}>
                              {maxDays} วัน
                            </span>
                          )}
                          <ChevronRight size={12} style={{ color: '#dc2626', flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Missing person data */}
                {missingPersonData.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#fffbeb', border: '1px solid #fbbf24' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={14} style={{ color: '#d97706' }} />
                      <span className="text-[12px] font-bold" style={{ color: '#92400e' }}>
                        ยังไม่กรอกผู้บาดเจ็บ ({missingPersonData.length})
                      </span>
                    </div>
                    {missingPersonData.map((inc, i) => (
                      <div key={i} onClick={() => openDrawer(inc)}
                        className="flex items-center gap-2 py-2 rounded-lg px-2 mb-1 transition-colors hover:bg-amber-100"
                        style={{ cursor: 'pointer', borderBottom: i < missingPersonData.length - 1 ? '1px solid #fde68a' : 'none' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium truncate" style={{ color: '#78350f' }}>
                            {inc.incident_no} — {inc.incident_date}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: '#92400e' }}>
                            {inc.incident_type} • {inc.department || '-'}
                          </div>
                        </div>
                        <ChevronRight size={12} style={{ color: '#d97706', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Top lost days */}
                {personLostDays.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#f0f9ff', border: '1px solid #93c5fd' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={14} style={{ color: '#2563eb' }} />
                      <span className="text-[12px] font-bold" style={{ color: '#1e40af' }}>
                        วันหยุดงานสูงสุด
                      </span>
                    </div>
                    {personLostDays.map((p, i) => {
                      const inc = categoryIncidents.find(inc2 => inc2.incident_no === p.incident_no);
                      return (
                        <div key={i}
                          onClick={() => inc && openDrawer(inc)}
                          className="flex items-center gap-2 py-2 rounded-lg px-2 mb-1 transition-colors hover:bg-blue-100"
                          style={{ cursor: inc ? 'pointer' : 'default', borderBottom: i < personLostDays.length - 1 ? '1px solid #bfdbfe' : 'none' }}>
                          <span className="text-[14px] font-extrabold shrink-0" style={{ color: '#1d4ed8', width: 36, textAlign: 'right' }}>
                            {Number(p.lost_work_days)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate" style={{ color: '#1e3a5f' }}>
                              {p.incident_no} — {p.body_part || 'ไม่ระบุส่วนร่างกาย'}
                            </div>
                            <div className="text-[10px] truncate" style={{ color: '#3b82f6' }}>
                              {p.nature_of_injury || p.injury_severity || '-'}
                            </div>
                          </div>
                          <span className="text-[9px] font-semibold shrink-0" style={{ color: '#6b7280' }}>วัน</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {allFilteredPersons.length === 0 ? (
              /* ═══ ACTIONABLE EMPTY STATE ═══ */
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}
              >
                <div className="text-[32px] mb-3 opacity-40">📊</div>
                <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  ไม่มีข้อมูลผู้บาดเจ็บ สำหรับปีที่เลือก
                </p>
                <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
                  ลองเปลี่ยนปี หรือตรวจสอบว่า incident ถูกบันทึกข้อมูลผู้บาดเจ็บ (Injured Person) ครบหรือไม่
                </p>
                <div className="flex items-center justify-center gap-3">
                  {injuryFilter && (
                    <button
                      onClick={() => setInjuryFilter(null)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all hover:shadow-md"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      <X size={12} /> ล้างตัวกรอง
                    </button>
                  )}
                  {missingPersonData.length > 0 && (
                    <button
                      onClick={() => missingPersonData[0] && openDrawer(missingPersonData[0])}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all hover:shadow-md"
                      style={{ background: '#f59e0b', color: '#fff' }}
                    >
                      <AlertTriangle size={12} /> ดู incident ที่ยังไม่กรอกผู้บาดเจ็บ
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* ═══ Filter Summary Bar — all active filters + master reset ═══ */}
                <div className="rounded-xl px-3 py-2.5 mb-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  {/* Row 1: Filter status + count + controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Result count — prominent */}
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      กำลังแสดง {filteredPersons.length} คน
                      {filteredPersons.length !== allFilteredPersons.length && (
                        <span className="font-normal" style={{ color: 'var(--muted)' }}> จาก {allFilteredPersons.length} คน</span>
                      )}
                    </span>

                    <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

                    {/* Quick Filter Chips */}
                    {chipFilters.map(chip => {
                      const isActive = chip.field === '' ? !injuryFilter : (injuryFilter?.field === chip.field && injuryFilter?.value === chip.value);
                      if (chip.field !== '' && chip.count === 0) return null;
                      return (
                        <button
                          key={chip.label}
                          onClick={() => {
                            if (chip.field === '') { setInjuryFilter(null); return; }
                            if (isActive) { setInjuryFilter(null); return; }
                            setInjuryFilter({ field: chip.field, value: chip.value });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                          style={{
                            background: isActive ? (chip.color || 'var(--accent)') : 'var(--card-solid)',
                            color: isActive ? '#fff' : (chip.color || 'var(--text-secondary)'),
                            border: `1px solid ${isActive ? (chip.color || 'var(--accent)') : 'var(--border)'}`,
                          }}
                        >
                          {chip.label}
                          <span className="text-[10px] font-bold px-1.5 py-0 rounded-full" style={{
                            background: isActive ? 'rgba(255,255,255,0.25)' : `${chip.color || 'var(--accent)'}15`,
                            color: isActive ? '#fff' : (chip.color || 'var(--text-secondary)'),
                          }}>
                            {chip.count}
                          </span>
                        </button>
                      );
                    })}

                    <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

                    {/* Year legend */}
                    {displayYears.map(y => (
                      <div key={y} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded" style={{ background: YEAR_COLORS_INJ[y] || '#9ca3af' }} />
                        <span className="text-[10px] font-semibold" style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}>{y}</span>
                      </div>
                    ))}

                    {/* Compare mode toggle */}
                    {activeYears.length > 1 && (
                      <button
                        onClick={() => setCompareMode(prev => prev === 'stacked' ? 'latest' : 'stacked')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all hover:shadow-sm"
                        style={{
                          background: compareMode === 'stacked' ? 'var(--accent)' : 'var(--card-solid)',
                          color: compareMode === 'stacked' ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${compareMode === 'stacked' ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        {compareMode === 'stacked' ? <Layers size={10} /> : <BarChart3 size={10} />}
                        {compareMode === 'stacked' ? 'เทียบทุกปี' : `เฉพาะ ${latestYear}`}
                      </button>
                    )}

                    {/* Active chart filter chip — large */}
                    {injuryFilter && (
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          <Filter size={10} />
                          {FIELD_LABELS[injuryFilter.field] || injuryFilter.field}: {injuryFilter.value}
                          <button onClick={() => setInjuryFilter(null)} className="ml-1 hover:opacity-70"><X size={12} /></button>
                        </span>
                        <button
                          onClick={() => setInjuryFilter(null)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:shadow-sm"
                          style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5' }}
                        >
                          <RotateCcw size={10} /> ล้างตัวกรองทั้งหมด
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ Trend Row: LTI + Lost days ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {renderStackedBarChart('หยุดงานหรือไม่', 'is_lti', ltiData)}

                  {/* Chart 2: Lost work days — vertical bar with YoY comparison */}
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        จำนวนวันหยุดงาน
                      </h3>
                      <span
                        className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      >
                        รวม {totalLostDays.toLocaleString()} วัน
                      </span>
                    </div>
                    <div className="flex items-end gap-4 justify-center" style={{ height: 170 }}>
                      {activeYears.map((y, yi) => {
                        const val = lostDaysData[y] || 0;
                        const pct = maxLostDays > 0 ? (val / maxLostDays) * 100 : 0;
                        const prevYear = activeYears[yi - 1];
                        const prevVal = prevYear ? (lostDaysData[prevYear] || 0) : null;
                        const diff = prevVal !== null && prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : null;
                        const isHovered = hoveredLostDay === y;
                        return (
                          <div
                            key={y}
                            className="flex flex-col items-center relative"
                            style={{ flex: 1, maxWidth: 72 }}
                            onMouseEnter={() => setHoveredLostDay(y)}
                            onMouseLeave={() => setHoveredLostDay(null)}
                          >
                            <span
                              className="text-[14px] font-bold mb-1"
                              style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                            >
                              {val.toLocaleString()}
                            </span>
                            {/* YoY comparison arrow */}
                            {diff !== null && (
                              <div className="flex items-center gap-0.5 mb-1">
                                {diff > 0 ? (
                                  <ArrowUpRight size={10} style={{ color: '#ef4444' }} />
                                ) : diff < 0 ? (
                                  <ArrowDownRight size={10} style={{ color: '#22c55e' }} />
                                ) : null}
                                <span className="text-[8px] font-bold" style={{ color: diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : 'var(--muted)' }}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                                </span>
                              </div>
                            )}
                            <div
                              className="w-full rounded-t-lg"
                              style={{
                                height: `${Math.max(pct * 1.3, val > 0 ? 6 : 2)}px`,
                                background: YEAR_COLORS_INJ[y] || '#9ca3af',
                                maxHeight: 130,
                                opacity: val > 0 ? (isHovered ? 1 : 0.85) : 0.15,
                                transition: 'height 0.4s ease, opacity 0.2s',
                                transform: isHovered ? 'scaleX(1.08)' : 'scaleX(1)',
                              }}
                            />
                            <span
                              className="text-[12px] font-bold mt-2"
                              style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                            >
                              {y}
                            </span>
                            {/* Hover tooltip */}
                            {isHovered && (
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded shadow-lg text-[9px] font-semibold"
                                style={{ background: '#1e293b', color: '#e2e8f0', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                                {val.toLocaleString()} วัน
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ═══ Where to Focus — 3 priority charts ═══ */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
                    <h2 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>จุดที่ต้องโฟกัส</h2>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>— คลิกแท่งกราฟเพื่อกรองข้อมูลทั้งหน้า</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {renderStackedBarChart('ระดับการบาดเจ็บ', 'injury_severity', severityData)}
                    {renderStackedBarChart('ส่วนร่างกาย', 'body_part', bodyPartData, { wideLabel: true })}
                    {renderStackedBarChart('แผนก/หน่วยงาน', 'department', deptFromIncidents)}
                  </div>
                </div>

                {/* ═══ Detail Charts — Nature + Person Type ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {renderStackedBarChart('ลักษณะการบาดเจ็บ', 'nature_of_injury', natureData, { wideLabel: true })}
                  {renderStackedBarChart('ประเภทบุคคล', 'person_type', personTypeData)}
                </div>

                {/* ═══ ENHANCED Records Table — sortable + paginated ═══ */}
                {(() => {
                  // Enrich & sort
                  const enriched = filteredIncForTable.map(inc => {
                    const t = inc.incident_type || '';
                    const isLti = (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
                    const persons = injuredPersonsData.filter(p => p.incident_no === inc.incident_no);
                    const totalDays = persons.reduce((s, p) => s + (Number(p.lost_work_days) || 0), 0);
                    return { inc, isLti, persons, totalDays, isMissingPerson: persons.length === 0 };
                  });

                  enriched.sort((a, b) => {
                    let cmp = 0;
                    switch (tableSortKey) {
                      case 'date': cmp = (a.inc.incident_date || '').localeCompare(b.inc.incident_date || ''); break;
                      case 'severity': cmp = (a.inc.actual_severity || '').localeCompare(b.inc.actual_severity || ''); break;
                      case 'dept': cmp = (a.inc.department || '').localeCompare(b.inc.department || ''); break;
                      case 'lostDays': cmp = a.totalDays - b.totalDays; break;
                      case 'lti': cmp = (a.isLti ? 1 : 0) - (b.isLti ? 1 : 0); break;
                      case 'injured': cmp = a.persons.length - b.persons.length; break;
                      default: cmp = 0;
                    }
                    return tableSortAsc ? cmp : -cmp;
                  });

                  const displayed = enriched.slice(0, tableShowCount);

                  const columns: { key: string; label: string; sortable: boolean }[] = [
                    { key: 'date', label: 'วันที่', sortable: true },
                    { key: 'type', label: 'ประเภท', sortable: false },
                    { key: 'severity', label: 'ความรุนแรง', sortable: true },
                    { key: 'dept', label: 'แผนก', sortable: true },
                    { key: 'person', label: 'ประเภทบุคคล', sortable: false },
                    { key: 'injured', label: 'ผู้บาดเจ็บ', sortable: true },
                    { key: 'bodyPart', label: 'ส่วนร่างกาย', sortable: false },
                    { key: 'lostDays', label: 'วันหยุดงาน', sortable: true },
                    { key: 'lti', label: 'LTI', sortable: true },
                    { key: 'action', label: '', sortable: false },
                  ];

                  const SortIcon = ({ col }: { col: string }) => {
                    if (tableSortKey !== col) return <ChevronDown size={8} style={{ opacity: 0.3 }} />;
                    return tableSortAsc ? <ChevronUp size={9} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={9} style={{ color: 'var(--accent)' }} />;
                  };

                  return (
                    <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
                          <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                            รายการตรวจสอบ
                          </h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            {filteredIncForTable.length} รายการ
                          </span>
                        </div>
                        {injuryFilter && (
                          <button onClick={() => setInjuryFilter(null)} className="text-[11px] underline" style={{ color: 'var(--accent)' }}>
                            ล้างตัวกรอง
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                              {columns.map(col => (
                                <th
                                  key={col.key}
                                  onClick={() => col.sortable && toggleSort(col.key)}
                                  style={{
                                    padding: '8px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                    color: tableSortKey === col.key ? 'var(--accent)' : 'var(--text-secondary)',
                                    whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default',
                                    userSelect: 'none',
                                  }}
                                >
                                  <span className="inline-flex items-center gap-0.5">
                                    {col.label}
                                    {col.sortable && <SortIcon col={col.key} />}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {displayed.map(({ inc, isLti, persons, totalDays, isMissingPerson }, idx) => {
                              const badge = getTypeBadge(inc.incident_type);
                              const topPerson = persons[0];
                              return (
                                <tr
                                  key={idx}
                                  onClick={() => openDrawer(inc)}
                                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isMissingPerson ? '#fffbeb' : 'transparent' }}
                                  className="hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                  <td style={{ padding: '7px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: 11 }}>
                                    {inc.incident_date}
                                  </td>
                                  <td style={{ padding: '7px 8px' }}>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                      {inc.incident_type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '7px 8px' }}>
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{ backgroundColor: getSevColor(inc.actual_severity || ''), color: '#fff' }}>
                                      {inc.actual_severity || '—'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>{inc.department || '—'}</td>
                                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>{inc.person_type || '—'}</td>
                                  <td style={{ padding: '7px 8px', fontSize: 11 }}>
                                    {isMissingPerson ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>ยังไม่กรอก</span>
                                    ) : (
                                      <span style={{ color: 'var(--text-primary)' }}>{persons.length} คน</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={topPerson?.body_part || ''}>
                                    {topPerson?.body_part || '—'}
                                  </td>
                                  <td style={{ padding: '7px 8px', fontWeight: totalDays > 0 ? 700 : 400, color: totalDays > 0 ? '#dc2626' : 'var(--muted)', fontSize: 11 }}>
                                    {totalDays > 0 ? totalDays : '—'}
                                  </td>
                                  <td style={{ padding: '7px 8px' }}>
                                    {isLti ? (
                                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#fef2f2', color: '#dc2626' }}>LTI</span>
                                    ) : (
                                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                                    <Eye size={13} style={{ color: 'var(--accent)', opacity: 0.6 }} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination: load more */}
                      {filteredIncForTable.length > tableShowCount ? (
                        <div className="flex items-center justify-between mt-3 px-1">
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                            แสดง {Math.min(tableShowCount, filteredIncForTable.length)} จาก {filteredIncForTable.length} รายการ
                          </p>
                          <button
                            onClick={() => setTableShowCount(prev => prev + 15)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:shadow-md"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                          >
                            <ChevronDown size={12} /> แสดงเพิ่ม
                          </button>
                        </div>
                      ) : filteredIncForTable.length > 15 ? (
                        <div className="flex items-center justify-between mt-3 px-1">
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                            แสดงทั้งหมด {filteredIncForTable.length} รายการ
                          </p>
                          <button
                            onClick={() => setTableShowCount(15)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:shadow-md"
                            style={{ color: 'var(--muted)' }}
                          >
                            <ChevronUp size={12} /> ย่อ
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        );
      })()}
    </>
  );
}
