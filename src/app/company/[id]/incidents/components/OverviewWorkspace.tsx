'use client';

import { Incident, LiveStats, ManHours, SummaryData, getTypeBadge, getTypeColor } from '../types';
import { MONTHS } from '../constants';
import { AlertTriangle, Activity, TrendingUp, TrendingDown, Clock, DollarSign, FileText } from 'lucide-react';

interface OverviewWorkspaceProps {
  categoryIncidents: Incident[];
  baseIncidents: Incident[];
  liveStats: LiveStats;
  manHours: ManHours;
  selectedYears: number[];
  tifrCombined: number | null;
  ltifrCombined: number | null;
  tifrEmployee: number | null;
  ltifrEmployee: number | null;
  tifrContractor: number | null;
  ltifrContractor: number | null;
  trendIncidents: Incident[];
  trendManhours: Record<number, number>;
  workRelatedOnly: boolean;
  dashFilter: { month?: string; type?: string };
  setDashFilter: React.Dispatch<React.SetStateAction<{ month?: string; type?: string }>>;
  filteredDashIncidents: Incident[];
  monthlyStacked: Record<string, Record<string, number>>;
  allTypes: string[];
  maxStackedMonthly: number;
  yearlyTrend: { year: number; trir: number; ltifr: number }[];
  openDrawer: (inc: Incident) => void;
}

export default function OverviewWorkspace({
  categoryIncidents,
  baseIncidents,
  liveStats,
  manHours,
  selectedYears,
  tifrCombined,
  ltifrCombined,
  tifrEmployee,
  ltifrEmployee,
  tifrContractor,
  ltifrContractor,
  trendIncidents,
  trendManhours,
  workRelatedOnly,
  dashFilter,
  setDashFilter,
  filteredDashIncidents,
  monthlyStacked,
  allTypes,
  maxStackedMonthly,
  yearlyTrend,
  openDrawer,
}: OverviewWorkspaceProps) {
  // Compute YEAR_COLORS
  const YEAR_COLORS: Record<number, string> = {
    2021: '#94a3b8',
    2022: '#64748b',
    2023: '#8b5cf6',
    2024: '#3b82f6',
    2025: '#f97316',
    2026: '#ef4444',
  };

  // Compute yearMonthCounts from baseIncidents
  const yearMonthCounts: Record<number, Record<number, number>> = {};
  baseIncidents.forEach((inc) => {
    const d = new Date(inc.incident_date as string);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11
    if (!yearMonthCounts[year]) yearMonthCounts[year] = {};
    yearMonthCounts[year][month] = (yearMonthCounts[year][month] || 0) + 1;
  });

  // Compute yearCumulative
  const yearCumulative: Record<number, Record<number, number>> = {};
  Object.entries(yearMonthCounts).forEach(([yearStr, months]) => {
    const year = parseInt(yearStr);
    let cumulative = 0;
    yearCumulative[year] = {};
    for (let m = 0; m < 12; m++) {
      cumulative += months[m] || 0;
      yearCumulative[year][m] = cumulative;
    }
  });

  // Helper to render SVG line charts
  const renderChart = (
    data: Record<number, Record<number, number>>,
    title: string
  ) => {
    const width = 400;
    const height = 200;
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    const years = Object.keys(data).map(Number).sort();
    if (years.length === 0) return null;

    const allValues = years
      .flatMap((year) => Object.values(data[year]))
      .filter((v) => v !== undefined);
    const maxVal = Math.max(...allValues, 1);
    const yScale = graphHeight / maxVal;

    const paths = years.map((year) => {
      const months = data[year];
      const points: [number, number][] = [];
      for (let m = 0; m < 12; m++) {
        const x = padding + (m / 11) * graphWidth;
        const y = height - padding - ((months[m] || 0) * yScale);
        points.push([x, y]);
      }
      const pathStr = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
      return (
        <path
          key={year}
          d={pathStr}
          stroke={YEAR_COLORS[year] || '#666'}
          strokeWidth="2"
          fill="none"
        />
      );
    });

    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <svg width={width} height={height} className="border border-gray-200 rounded">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ddd" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ddd" />
          {paths}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {(() => {
          const totalCost = liveStats.totalDirectCost + liveStats.totalIndirectCost;
          const trirVal = tifrCombined !== null ? tifrCombined.toFixed(2) : '—';
          const ltifrVal = ltifrCombined !== null ? ltifrCombined.toFixed(2) : '—';

          type KPIItem = { label: string; value: string | number; sub?: string; icon: typeof AlertTriangle; color: string };
          const kpis: KPIItem[] = [
            { label: 'อุบัติการณ์ทั้งหมด', value: liveStats.totalIncidents, icon: AlertTriangle, color: '#6366f1' },
            { label: 'บาดเจ็บ (TRC)', value: liveStats.totalInjuries, icon: Activity, color: '#f97316' },
            { label: 'หยุดงาน (LTI)', value: liveStats.ltiCases, icon: Clock, color: '#ef4444' },
            { label: 'TRIR', value: trirVal, sub: 'ต่อล้านชม.', icon: TrendingUp, color: '#8b5cf6' },
            { label: 'LTIFR', value: ltifrVal, sub: 'ต่อล้านชม.', icon: TrendingDown, color: '#ec4899' },
            { label: 'ค่าเสียหายรวม', value: totalCost >= 1000 ? `${(totalCost / 1000).toFixed(0)}K ฿` : `${totalCost.toLocaleString()} ฿`, icon: DollarSign, color: '#22c55e' },
          ];

          return kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600">{kpi.label}</p>
                  <Icon size={16} style={{ color: kpi.color }} />
                </div>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>}
              </div>
            );
          });
        })()}
      </div>

      {/* TIFR/LTIFR 3-way split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Employee TIFR', value: tifrEmployee, type: 'employee' },
          { title: 'Contractor TIFR', value: tifrContractor, type: 'contractor' },
          { title: 'Combined TIFR', value: tifrCombined, type: 'combined' },
        ].map((item) => (
          <div key={item.type} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700">{item.title}</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {item.value !== null ? item.value.toFixed(2) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Cost Summary card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Cost Summary</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600">Direct Cost</p>
            <p className="text-lg font-bold text-gray-900">{liveStats.totalDirectCost.toLocaleString()} ฿</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Indirect Cost</p>
            <p className="text-lg font-bold text-gray-900">{liveStats.totalIndirectCost.toLocaleString()} ฿</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Cost</p>
            <p className="text-lg font-bold text-green-600">{(liveStats.totalDirectCost + liveStats.totalIndirectCost).toLocaleString()} ฿</p>
          </div>
        </div>
      </div>

      {/* YTD TRIR/LTIFR trend mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {renderChart(yearMonthCounts, 'YTD Monthly Incidents')}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {renderChart(yearCumulative, 'YTD Cumulative Incidents')}
        </div>
      </div>

      {/* Incident Type Breakdown Cards */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Incident Type Breakdown</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {allTypes.map((type) => {
            const count = categoryIncidents.filter((inc) => inc.incident_type === type).length;
            const isSelected = dashFilter.type === type;
            return (
              <button
                key={type}
                onClick={() =>
                  setDashFilter((prev) => ({
                    ...prev,
                    type: isSelected ? undefined : type,
                  }))
                }
                className={`p-2 rounded text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div>{type}</div>
                <div className="text-lg font-bold">{count}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(dashFilter.month || dashFilter.type) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {dashFilter.month && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                Month: {dashFilter.month}
                <button
                  onClick={() => setDashFilter((prev) => ({ ...prev, month: undefined }))}
                  className="text-blue-500 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            )}
            {dashFilter.type && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                Type: {dashFilter.type}
                <button
                  onClick={() => setDashFilter((prev) => ({ ...prev, type: undefined }))}
                  className="text-blue-500 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Monthly Stacked Bar Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Monthly Distribution</p>
        <div className="overflow-x-auto">
          <div className="flex gap-3 h-48" style={{ minWidth: '100%' }}>
            {MONTHS.map((month, idx) => {
              const monthKey = String(idx).padStart(2, '0');
              const types = monthlyStacked[monthKey] || {};
              const total = Object.values(types).reduce((a, b) => a + b, 0);

              return (
                <div key={month} className="flex-1 flex flex-col justify-end items-center gap-1">
                  <div className="w-full flex flex-col-reverse gap-0" style={{ height: total > 0 ? `${(total / maxStackedMonthly) * 150}px` : '5px' }}>
                    {allTypes.map((type) => {
                      const count = types[type] || 0;
                      const h = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div
                          key={type}
                          style={{
                            height: `${h}%`,
                            backgroundColor: getTypeColor(type),
                            minHeight: count > 0 ? '2px' : '0px',
                          }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs font-medium text-gray-700">{month}</p>
                  <p className="text-xs text-gray-500">{total}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Incident List Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Recent Incidents (First 20)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Date</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Severity</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Person</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDashIncidents.slice(0, 20).map((inc, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">{new Date(inc.incident_date as string).toLocaleDateString('th-TH')}</td>
                  <td className="py-2 px-3">
                    {(() => { const b = getTypeBadge(inc.incident_type); return <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>{inc.incident_type}</span>; })()}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: getTypeColor(inc.incident_type), color: '#fff' }}>
                      {inc.actual_severity as string || '—'}
                    </span>
                  </td>
                  <td className="py-2 px-3">{inc.person_type as string || '—'}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => openDrawer(inc)}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Trend Comparison line chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Monthly Trend (Multi-Year)</p>
        <svg width="100%" height="300" viewBox="0 0 800 300" className="border border-gray-200 rounded">
          <line x1="60" y1="250" x2="750" y2="250" stroke="#ddd" strokeWidth="1" />
          <line x1="60" y1="50" x2="60" y2="250" stroke="#ddd" strokeWidth="1" />

          {Object.entries(yearMonthCounts).map(([yearStr, months]) => {
            const year = parseInt(yearStr);
            const points: [number, number][] = [];
            for (let m = 0; m < 12; m++) {
              const x = 60 + (m / 11) * 690;
              const maxVal = Math.max(...Object.values(yearMonthCounts).flatMap((m) => Object.values(m)), 1);
              const y = 250 - ((months[m] || 0) / maxVal) * 200;
              points.push([x, y]);
            }
            const pathStr = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
            return (
              <g key={year}>
                <path d={pathStr} stroke={YEAR_COLORS[year] || '#666'} strokeWidth="2" fill="none" />
              </g>
            );
          })}

          {/* Legend */}
          <g>
            {Object.entries(YEAR_COLORS).map(([year, color], idx) => (
              <g key={year}>
                <rect x={60 + idx * 80} y="10" width="10" height="10" fill={color} />
                <text x={75 + idx * 80} y="18" fontSize="10" fill="#666">
                  {year}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Cumulative line chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Cumulative Incidents (Multi-Year)</p>
        <svg width="100%" height="300" viewBox="0 0 800 300" className="border border-gray-200 rounded">
          <line x1="60" y1="250" x2="750" y2="250" stroke="#ddd" strokeWidth="1" />
          <line x1="60" y1="50" x2="60" y2="250" stroke="#ddd" strokeWidth="1" />

          {Object.entries(yearCumulative).map(([yearStr, months]) => {
            const year = parseInt(yearStr);
            const points: [number, number][] = [];
            for (let m = 0; m < 12; m++) {
              const x = 60 + (m / 11) * 690;
              const maxVal = Math.max(...Object.values(yearCumulative).flatMap((m) => Object.values(m)), 1);
              const y = 250 - ((months[m] || 0) / maxVal) * 200;
              points.push([x, y]);
            }
            const pathStr = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
            return (
              <g key={year}>
                <path d={pathStr} stroke={YEAR_COLORS[year] || '#666'} strokeWidth="2" fill="none" />
              </g>
            );
          })}

          {/* Legend */}
          <g>
            {Object.entries(YEAR_COLORS).map(([year, color], idx) => (
              <g key={year}>
                <rect x={60 + idx * 80} y="10" width="10" height="10" fill={color} />
                <text x={75 + idx * 80} y="18" fontSize="10" fill="#666">
                  {year}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
