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
  return (
    <>
      {/* KPI Cards - Injury Variant */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {(() => {
          const totalCost = liveStats.totalDirectCost + liveStats.totalIndirectCost;
          const trirVal = tifrCombined !== null ? tifrCombined.toFixed(2) : '—';
          const ltifrVal = ltifrCombined !== null ? ltifrCombined.toFixed(2) : '—';

          type KPIItem = {
            label: string;
            value: string | number;
            sub?: string;
            icon: typeof AlertTriangle;
            color: string;
          };

          const kpis: KPIItem[] = [
            { label: 'บาดเจ็บทั้งหมด', value: liveStats.totalIncidents, icon: Activity, color: '#f97316' },
            { label: 'หยุดงาน (LTI)', value: liveStats.ltiCases, icon: Clock, color: '#ef4444' },
            { label: 'เสียชีวิต', value: liveStats.fatalities, icon: AlertTriangle, color: '#991b1b' },
            { label: 'TRIR', value: trirVal, sub: 'ต่อล้านชม.', icon: TrendingUp, color: '#8b5cf6' },
            { label: 'LTIFR', value: ltifrVal, sub: 'ต่อล้านชม.', icon: TrendingDown, color: '#ec4899' },
            {
              label: 'ค่าเสียหาย',
              value: totalCost >= 1000 ? `${(totalCost / 1000).toFixed(0)}K ฿` : `${totalCost.toLocaleString()} ฿`,
              icon: DollarSign,
              color: '#22c55e',
            },
          ];

          return kpis.map((kpi, idx) => (
            <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                  <kpi.icon size={14} style={{ color: kpi.color }} />
                </div>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: kpi.color }}>
                {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
              </p>
              {kpi.sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>{kpi.sub}</p>}
            </div>
          ));
        })()}
      </div>

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

        // ---- Clickable stacked horizontal bar chart ----
        const renderStackedBarChart = (
          title: string,
          chartField: string,
          data: { keys: string[]; counts: Record<string, Record<number, number>> }
        ) => {
          const { keys, counts } = data;
          if (keys.length === 0) return null;
          const maxTotal = Math.max(
            ...keys.map(k => activeYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0)),
            1
          );
          const isThisChartFiltered = injuryFilter?.field === chartField;

          return (
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'var(--card-solid)',
                border: isThisChartFiltered ? '2px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                {isThisChartFiltered && (
                  <button
                    onClick={() => setInjuryFilter(null)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {injuryFilter?.value} <X size={10} />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {keys.map(k => {
                  const total = activeYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0);
                  const barPct = (total / maxTotal) * 100;
                  const isActive = isThisChartFiltered && injuryFilter?.value === k;
                  const isDimmed = isThisChartFiltered && !isActive;

                  return (
                    <div
                      key={k}
                      className="flex items-center gap-3 rounded-lg px-2 py-1 transition-all"
                      style={{
                        cursor: 'pointer',
                        opacity: isDimmed ? 0.3 : 1,
                        background: isActive ? 'var(--bg-secondary)' : 'transparent',
                      }}
                      onClick={() => {
                        if (isActive) {
                          setInjuryFilter(null);
                        } else {
                          setInjuryFilter({ field: chartField, value: k });
                        }
                      }}
                    >
                      <span
                        className="text-[11px] font-medium shrink-0 text-right"
                        style={{
                          color: 'var(--text-primary)',
                          width: 130,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={k}
                      >
                        {k}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className="flex-1 relative rounded-md overflow-hidden"
                          style={{ height: 22, background: 'var(--bg-secondary)' }}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden"
                            style={{ width: `${Math.max(barPct, total > 0 ? 3 : 0)}%` }}
                          >
                            {activeYears.map(y => {
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
                                  }}
                                  title={`${y}: ${val}`}
                                >
                                  {segPct > 20 && (
                                    <span className="text-[9px] font-bold text-white/80">{val}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <span
                          className="text-[12px] font-bold shrink-0"
                          style={{ color: 'var(--text-primary)', width: 26, textAlign: 'right' }}
                        >
                          {total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                // Apply current filter to incidents
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
              // For person-level filters, check if incident has matching injured person
              const persons = injuredPersonsData.filter(p => p.incident_no === inc.incident_no);
              return persons.some(p => {
                const val = (p[injuryFilter.field as keyof InjuredPerson] as string) || 'ไม่ระบุ';
                return val === injuryFilter.value;
              });
            })
          : categoryIncidents;

        return (
          <div className="mt-2">
            {allFilteredPersons.length === 0 ? (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}
              >
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                  ไม่มีข้อมูลผู้บาดเจ็บ สำหรับปีที่เลือก
                </p>
              </div>
            ) : (
              <>
                {/* Quick Filter Chips */}
                <div className="flex flex-wrap gap-2 mb-4 px-1">
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
                          background: isActive ? (chip.color || 'var(--accent)') : 'var(--bg-secondary)',
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
                </div>

                {/* Top bar: Legend + Filter indicator */}
                <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
                  {activeYears.map(y => (
                    <div key={y} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ background: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                      />
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                      >
                        {y}
                      </span>
                    </div>
                  ))}
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    | แสดง {filteredPersons.length} จาก {allFilteredPersons.length} คน
                  </span>
                  {injuryFilter && (
                    <button
                      onClick={() => setInjuryFilter(null)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all hover:shadow-md"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      {FIELD_LABELS[injuryFilter.field] || injuryFilter.field}: {injuryFilter.value}
                      <X size={12} />
                    </button>
                  )}
                  {!injuryFilter && (
                    <span className="text-[10px] italic" style={{ color: 'var(--muted)' }}>
                      คลิกที่แท่งกราฟเพื่อกรองข้อมูล
                    </span>
                  )}
                </div>

                {/* Row 1: LTI + Lost days */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {renderStackedBarChart('หยุดงานหรือไม่', 'is_lti', ltiData)}

                  {/* Chart 2: Lost work days — vertical bar */}
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
                      {activeYears.map(y => {
                        const val = lostDaysData[y] || 0;
                        const pct = maxLostDays > 0 ? (val / maxLostDays) * 100 : 0;
                        return (
                          <div key={y} className="flex flex-col items-center" style={{ flex: 1, maxWidth: 72 }}>
                            <span
                              className="text-[14px] font-bold mb-1"
                              style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                            >
                              {val}
                            </span>
                            <div
                              className="w-full rounded-t-lg"
                              style={{
                                height: `${Math.max(pct * 1.3, val > 0 ? 6 : 2)}px`,
                                background: YEAR_COLORS_INJ[y] || '#9ca3af',
                                maxHeight: 130,
                                opacity: val > 0 ? 1 : 0.15,
                              }}
                            />
                            <span
                              className="text-[12px] font-bold mt-2"
                              style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}
                            >
                              {y}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Chart 3: Injury severity */}
                <div className="mb-5">
                  {renderStackedBarChart('ระดับการบาดเจ็บ', 'injury_severity', severityData)}
                </div>

                {/* Row 2: Nature + Body part */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {renderStackedBarChart('ลักษณะการบาดเจ็บ', 'nature_of_injury', natureData)}
                  {renderStackedBarChart(
                    'ส่วนร่างกายที่ได้รับบาดเจ็บ',
                    'body_part',
                    bodyPartData
                  )}
                </div>

                {/* Row 3: Person Type + Department */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {renderStackedBarChart('ประเภทบุคคล', 'person_type', personTypeData)}
                  {renderStackedBarChart('แผนก/หน่วยงาน', 'department', deptFromIncidents)}
                </div>

                {/* Records Table */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      รายการอุบัติเหตุบาดเจ็บ ({filteredIncForTable.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                          {['Date', 'Type', 'Severity', 'Person', 'Department', 'LTI'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIncForTable.slice(0, 30).map((inc, idx) => {
                          const badge = getTypeBadge(inc.incident_type);
                          const t = inc.incident_type || '';
                          const isLti = (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
                          return (
                            <tr
                              key={idx}
                              onClick={() => openDrawer(inc)}
                              style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                              className="hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                              <td style={{ padding: '8px 10px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {inc.incident_date}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                  {inc.incident_type}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: getSevColor(inc.actual_severity || ''), color: '#fff' }}>
                                  {inc.actual_severity || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{inc.person_type || '—'}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{inc.department || '—'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {isLti ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#fef2f2', color: '#dc2626' }}>LTI</span>
                                ) : (
                                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredIncForTable.length > 30 && (
                    <p className="text-[10px] mt-2 px-1" style={{ color: 'var(--muted)' }}>
                      แสดง 30 จาก {filteredIncForTable.length} รายการ
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </>
  );
}
