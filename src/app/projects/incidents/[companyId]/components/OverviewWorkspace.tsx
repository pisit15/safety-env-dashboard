'use client';

import { Incident, LiveStats, ManHours, getTypeBadge, getTypeColor, getSevColor } from '../types';
import { MONTHS } from '../constants';
import { AlertTriangle, Activity, TrendingUp, TrendingDown, Clock, DollarSign, X } from 'lucide-react';
import MonthlyByYearChart from '@/components/MonthlyByYearChart';
import { TRIR_TARGET, TRIR_TARGET_LABEL, LTIFR_TARGET, LTIFR_TARGET_LABEL } from '@/lib/she-targets';

interface OverviewWorkspaceProps {
  categoryIncidents: Incident[];
  baseIncidents: Incident[];
  liveStats: LiveStats;
  manHours: ManHours;
  selectedYears: number[];
  trirCombined: number | null;
  ltifrCombined: number | null;
  trirEmployee: number | null;
  ltifrEmployee: number | null;
  trirContractor: number | null;
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
  trirCombined,
  ltifrCombined,
  trirEmployee,
  ltifrEmployee,
  trirContractor,
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
  const fmtCost = (v: number) =>
    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M ฿` :
    v >= 1000 ? `${(v / 1000).toFixed(0)}K ฿` :
    `${v.toLocaleString()} ฿`;

  // Compute yearMonthCounts from baseIncidents
  const yearMonthCounts: Record<number, Record<number, number>> = {};
  baseIncidents.forEach((inc) => {
    const d = new Date(inc.incident_date as string);
    const year = d.getFullYear();
    const month = d.getMonth();
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

  // KPI data
  const totalCost = liveStats.totalDirectCost + liveStats.totalIndirectCost;
  const trirVal = trirCombined !== null ? trirCombined.toFixed(2) : '—';
  const ltifrVal = ltifrCombined !== null ? ltifrCombined.toFixed(2) : '—';
  const fatalityCount = liveStats.fatalities;

  // Tier 1: Hero KPI (Fatality)
  const tier1Kpi = {
    label: 'เสียชีวิต',
    value: fatalityCount,
    icon: AlertTriangle,
    isCritical: fatalityCount > 0,
  };

  // Tier 2: Key Rates (TRIR, LTIFR)
  type Tier2KPIItem = { label: string; value: string | number; target?: string; icon: typeof TrendingUp; color: string };
  const tier2Kpis: Tier2KPIItem[] = [
    { label: 'TRIR', value: trirVal, target: TRIR_TARGET_LABEL, icon: TrendingUp, color: '#8b5cf6' },
    { label: 'LTIFR', value: ltifrVal, target: LTIFR_TARGET_LABEL, icon: TrendingDown, color: '#ec4899' },
  ];

  // Tier 3: Supporting KPIs
  type Tier3KPIItem = { label: string; value: string | number; sub?: string; icon: typeof AlertTriangle; color: string };
  const tier3Kpis: Tier3KPIItem[] = [
    { label: 'อุบัติการณ์ทั้งหมด', value: liveStats.totalIncidents, icon: AlertTriangle, color: '#6366f1' },
    { label: 'บาดเจ็บ (TRC)', value: liveStats.totalInjuries, icon: Activity, color: '#f97316' },
    { label: 'หยุดงาน (LTI)', value: liveStats.ltiCases, icon: Clock, color: '#ef4444' },
    { label: 'ค่าเสียหายรวม', value: fmtCost(totalCost), icon: DollarSign, color: '#22c55e' },
  ];

  // SVG line chart renderer
  // Cumulative series for the YTD pace chart (per year, running total by month)
  const cumulativeSeries = Object.entries(yearCumulative)
    .map(([y, months]) => ({
      year: parseInt(y),
      counts: Array.from({ length: 12 }, (_, m) => months[m] || 0),
    }))
    .sort((a, b) => a.year - b.year);

  return (
    <div>
      {/* Tier 1: Hero - Fatality Card (Full Width) */}
      <div className="mb-6">
        {(() => {
          const isCritical = tier1Kpi.isCritical;
          const Icon = tier1Kpi.icon;
          const bgColor = isCritical ? 'rgba(194,59,34,0.08)' : 'rgba(43,140,62,0.08)';
          const borderColor = isCritical ? '2px solid #C23B22' : '2px solid #2B8C3E';
          const textColor = isCritical ? '#C23B22' : '#2B8C3E';
          
          return (
            <div
              className="rounded-2xl p-8 flex flex-col gap-3"
              style={{ background: bgColor, border: borderColor }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>เสียชีวิต — ความสำคัญสูงสุด</p>
                  <p className="text-[44px] font-bold" style={{ color: textColor }}>{tier1Kpi.value}</p>
                  <p className="text-[13px] mt-2" style={{ color: isCritical ? '#C23B22' : '#2B8C3E' }}>
                    {isCritical ? '⚠️ ต้องสอบสวนทันที' : '✓ ปลอดภัย — ไม่มีผู้เสียชีวิต'}
                  </p>
                </div>
                <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ background: `${textColor}20` }}>
                  <Icon size={40} style={{ color: textColor }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tier 2: Key Rates - TRIR & LTIFR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tier2Kpis.map((kpi) => {
          const Icon = kpi.icon;
          const isAboveTarget = typeof kpi.value === 'string' && parseFloat(kpi.value) > (kpi.label === 'TRIR' ? TRIR_TARGET : LTIFR_TARGET);
          const cardColor = isAboveTarget ? '#F28E2B' : '#2B8C3E';
          
          return (
            <div
              key={kpi.label}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: 'var(--card-solid)', border: `2px solid ${cardColor}30` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</p>
                  <p className="text-[28px] font-bold mt-1" style={{ color: cardColor }}>{kpi.value}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.target}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: `${cardColor}15` }}>
                  <Icon size={20} style={{ color: cardColor }} />
                </div>
              </div>
              <p className="text-[11px]" style={{ color: isAboveTarget ? '#F28E2B' : '#2B8C3E' }}>
                {isAboveTarget ? '↑ ต้องปรับปรุง' : '↓ ในเป้าหมาย'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tier 3: Supporting KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {tier3Kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-2xl p-3 flex flex-col gap-2"
              style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                  <Icon size={12} style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
              {kpi.sub && <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{kpi.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* TRIR/LTIFR 3-way split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {[
          { title: 'Employee', trir: trirEmployee, ltifr: ltifrEmployee, color: '#3b82f6' },
          { title: 'Contractor', trir: trirContractor, ltifr: ltifrContractor, color: '#f97316' },
          { title: 'Combined', trir: trirCombined, ltifr: ltifrCombined, color: '#8b5cf6' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <p className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>{item.title}</p>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>TRIR</p>
                <p className="text-[22px] font-bold" style={{ color: item.color }}>
                  {item.trir !== null ? item.trir.toFixed(2) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>LTIFR</p>
                <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {item.ltifr !== null ? item.ltifr.toFixed(2) : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cost Summary */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Cost Summary</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Direct Cost</p>
            <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{liveStats.totalDirectCost.toLocaleString()} ฿</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Indirect Cost</p>
            <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{liveStats.totalIndirectCost.toLocaleString()} ฿</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Total Cost</p>
            <p className="text-[18px] font-bold" style={{ color: '#16a34a' }}>{(liveStats.totalDirectCost + liveStats.totalIndirectCost).toLocaleString()} ฿</p>
          </div>
        </div>
      </div>

      {/* Cumulative YTD pace — month-by-month comparison lives in the chart below the workspace */}
      <div className="mb-5">
        <MonthlyByYearChart
          series={cumulativeSeries}
          title="อุบัติการณ์สะสมรายปี (YTD)"
          subtitle="ยอดสะสมตั้งแต่ต้นปีถึงแต่ละเดือน — เทียบว่าปีนี้เร็ว/ช้ากว่าปีก่อน ณ จุดเดียวกัน"
          cumulative
        />
      </div>

      {/* Incident Type Breakdown */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Incident Type Breakdown</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {allTypes.map((type) => {
            const count = categoryIncidents.filter((inc) => inc.incident_type === type).length;
            const isSelected = dashFilter.type === type;
            const badge = getTypeBadge(type);
            return (
              <button
                key={type}
                onClick={() => setDashFilter((prev) => ({ ...prev, type: isSelected ? undefined : type }))}
                className="rounded-xl p-3 text-left transition-all"
                style={{
                  background: isSelected ? badge.color : 'var(--bg-secondary)',
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${isSelected ? badge.color : 'var(--border)'}`,
                }}
              >
                <div className="text-[10px] font-medium" style={{ opacity: 0.8 }}>{type}</div>
                <div className="text-[18px] font-bold mt-1">{count}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter */}
      {(dashFilter.month || dashFilter.type) && (
        <div className="rounded-xl p-3 mb-5 flex flex-wrap items-center gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-[11px] font-semibold" style={{ color: '#1e3a5f' }}>Active Filters:</span>
          {dashFilter.month && (
            <button
              onClick={() => setDashFilter((prev) => ({ ...prev, month: undefined }))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{ background: '#1e40af', color: '#fff' }}
            >
              Month: {dashFilter.month} <X size={10} />
            </button>
          )}
          {dashFilter.type && (
            <button
              onClick={() => setDashFilter((prev) => ({ ...prev, type: undefined }))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{ background: '#1e40af', color: '#fff' }}
            >
              Type: {dashFilter.type} <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Monthly Stacked Bar Chart */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Distribution</p>
        <div className="overflow-x-auto">
          <div className="flex gap-2" style={{ minWidth: '100%', height: 200 }}>
            {MONTHS.map((month, idx) => {
              const types = monthlyStacked[month] || {};
              const total = Object.values(types).reduce((a, b) => a + b, 0);
              const barH = maxStackedMonthly > 0 ? (total / maxStackedMonthly) * 150 : 0;

              return (
                <div
                  key={month}
                  className="flex-1 flex flex-col justify-end items-center gap-1 cursor-pointer"
                  onClick={() => setDashFilter((prev) => ({ ...prev, month: prev.month === month ? undefined : month }))}
                  style={{ opacity: dashFilter.month && dashFilter.month !== month ? 0.35 : 1 }}
                >
                  <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: barH > 0 ? `${barH}px` : '3px' }}>
                    {allTypes.map((type) => {
                      const count = types[type] || 0;
                      const h = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div
                          key={type}
                          style={{ height: `${h}%`, backgroundColor: getTypeColor(type), minHeight: count > 0 ? '2px' : '0px' }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{month}</p>
                  <p className="text-[10px] font-bold" style={{ color: total > 0 ? 'var(--text-primary)' : 'var(--muted)' }}>{total || ''}</p>
                </div>
              );
            })}
          </div>
        </div>
        {/* Type legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          {allTypes.map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: getTypeColor(type) }} />
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incident List Table */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Recent Incidents ({Math.min(filteredDashIncidents.length, 20)} of {filteredDashIncidents.length})
          </p>
        </div>
        <div className="overflow-x-auto" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                {['Date', 'Type', 'Severity', 'Person', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDashIncidents.slice(0, 20).map((inc, idx) => {
                const badge = getTypeBadge(inc.incident_type);
                return (
                  <tr
                    key={idx}
                    onClick={() => openDrawer(inc)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    className="hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                      {new Date(inc.incident_date as string).toLocaleDateString('th-TH')}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {inc.incident_type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: getSevColor(inc.actual_severity || ''), color: '#fff' }}>
                        {inc.actual_severity || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{inc.person_type || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>View</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
