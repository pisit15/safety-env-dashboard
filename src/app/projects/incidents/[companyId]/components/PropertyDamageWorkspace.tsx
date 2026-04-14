'use client';

import React from 'react';
import { Incident, LiveStats } from '../types';
import { MONTHS, MONTH_TH } from '../constants';
import { Shield, DollarSign, Activity, FileText, Download, AlertCircle, X, TrendingUp } from 'lucide-react';

interface PropertyDamageWorkspaceProps {
  categoryIncidents: Incident[];
  liveStats: LiveStats;
  propFilter: { field: string; value: string } | null;
  setPropFilter: (f: { field: string; value: string } | null) => void;
  openDrawer: (inc: Incident) => void;
}

export default function PropertyDamageWorkspace({
  categoryIncidents,
  liveStats,
  propFilter,
  setPropFilter,
  openDrawer,
}: PropertyDamageWorkspaceProps) {
  // Compute totalCost for the property category
  const totalCost = categoryIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0), 0);

  // Format cost function (for KPIs)
  const fmtCost = (v: number) => 
    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M ฿` : 
    v >= 1000 ? `${(v / 1000).toFixed(0)}K ฿` : 
    `${v.toLocaleString()} ฿`;

  // KPI Cards for Property variant
  const prodImpactCount = categoryIncidents.filter(i => {
    const pi = (i as Record<string, unknown>).production_impact as string || '';
    return pi && pi !== 'ไม่มีผลกระทบ';
  }).length;

  const openActions = categoryIncidents.filter(i => {
    const st = (i as Record<string, unknown>).report_status as string || '';
    return st === 'Draft' || st === 'Open' || st === 'In Progress';
  }).length;

  const kpis = [
    { label: 'เหตุการณ์ทั้งหมด', value: liveStats.totalIncidents, icon: Shield, color: '#1e40af' },
    { label: 'ค่าเสียหายรวม', value: fmtCost(totalCost), icon: DollarSign, color: '#b45309' },
    { label: 'Direct Cost', value: fmtCost(liveStats.totalDirectCost), sub: 'ค่าซ่อม/ทดแทนทรัพย์สิน', icon: DollarSign, color: '#dc2626' },
    { label: 'Indirect Cost', value: fmtCost(liveStats.totalIndirectCost), sub: 'ค่าหยุดผลิต/ค่าเสียโอกาส', icon: DollarSign, color: '#ea580c' },
    { label: 'กระทบการผลิต', value: prodImpactCount, sub: 'เหตุการณ์ที่มี production impact', icon: Activity, color: '#7c3aed' },
    { label: 'Action ค้าง', value: openActions, sub: 'รอดำเนินการ/สอบสวน', icon: FileText, color: '#0891b2' },
  ];

  // PROPERTY DAMAGE SECTION
  const YEAR_COLORS_PROP: Record<number, string> = {
    2021: '#94a3b8', 2022: '#64748b', 2023: '#8b5cf6',
    2024: '#1e40af', 2025: '#d97706', 2026: '#0891b2',
  };

  // Get active years from incidents
  const selectedYears = Array.from(new Set(categoryIncidents.map(i => i.year))).sort();
  const propActiveYears = selectedYears.sort();

  // Apply cross-filter from propFilter (including special virtual fields)
  const propFilteredIncidents = propFilter
    ? categoryIncidents.filter(inc => {
        if (propFilter.field === '_status') {
          const st = inc.report_status || 'Draft';
          return st === 'Draft' || st === 'Open' || st === 'In Progress';
        }
        if (propFilter.field === '_highcost') {
          const tc = (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0);
          const thresh = categoryIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0), 0) * 0.2 || 50000;
          return tc >= thresh;
        }
        if (propFilter.field === '_missing_type') {
          const t = (inc as Record<string, unknown>).property_damage_type as string || '';
          return !t || t === 'ไม่ระบุ';
        }
        if (propFilter.field === '_missing_cost') {
          return !Number(inc.direct_cost) && !Number(inc.indirect_cost);
        }
        // Generic field match (works for property_damage_type, area, agency_source, insurance_claim, production_impact, etc.)
        const val = (inc as Record<string, unknown>)[propFilter.field] as string || (inc[propFilter.field as keyof Incident] as string) || 'ไม่ระบุ';
        return val === propFilter.value;
      })
    : categoryIncidents;

  // Helper: get incidents for a specific chart (source chart shows all, others show filtered)
  const incidentsFor = (chartField: string) =>
    propFilter && propFilter.field !== chartField ? propFilteredIncidents : categoryIncidents;

  const fmtCostShort = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString();

  // ---- Monthly cost trend data ----
  const monthlyCostData: Record<number, { direct: number; indirect: number }[]> = {};
  selectedYears.forEach(y => { monthlyCostData[y] = Array.from({ length: 12 }, () => ({ direct: 0, indirect: 0 })); });
  propFilteredIncidents.forEach(inc => {
    const yr = inc.year;
    if (!monthlyCostData[yr]) return;
    const num = parseInt(String(inc.month));
    const mi = (num >= 1 && num <= 12) ? num - 1 : MONTHS.indexOf(String(inc.month));
    if (mi >= 0 && mi < 12) {
      monthlyCostData[yr][mi].direct += Number(inc.direct_cost) || 0;
      monthlyCostData[yr][mi].indirect += Number(inc.indirect_cost) || 0;
    }
  });
  const maxMonthlyCost = Math.max(
    ...selectedYears.flatMap(y => (monthlyCostData[y] || []).map(m => m.direct + m.indirect)),
    1
  );

  // ---- Breakdown helpers (stacked horizontal bar) ----
  const groupByField = (field: string, incs: Incident[]) => {
    const counts: Record<string, Record<number, { count: number; cost: number }>> = {};
    incs.forEach(inc => {
      const val = (inc as Record<string, unknown>)[field] as string || 'ไม่ระบุ';
      const yr = inc.year;
      if (!counts[val]) counts[val] = {};
      if (!counts[val][yr]) counts[val][yr] = { count: 0, cost: 0 };
      counts[val][yr].count += 1;
      counts[val][yr].cost += (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0);
    });
    let keys = Object.keys(counts);
    keys.sort((a, b) => {
      const totA = Object.values(counts[a]).reduce((s, v) => s + v.cost, 0);
      const totB = Object.values(counts[b]).reduce((s, v) => s + v.cost, 0);
      return totB - totA;
    });
    keys = keys.slice(0, 10);
    return { keys, counts };
  };

  // Reusable stacked bar renderer for property charts
  const renderPropStackedBar = (
    title: string,
    chartField: string,
    data: { keys: string[]; counts: Record<string, Record<number, { count: number; cost: number }>> },
    showCost = true,
  ) => {
    const { keys, counts } = data;
    if (keys.length === 0) return null;
    const maxTotal = Math.max(...keys.map(k =>
      showCost
        ? propActiveYears.reduce((s, y) => s + (counts[k]?.[y]?.cost || 0), 0)
        : propActiveYears.reduce((s, y) => s + (counts[k]?.[y]?.count || 0), 0)
    ), 1);
    const isThisChartFiltered = propFilter?.field === chartField;

    return (
      <div className="rounded-2xl p-5" style={{
        background: 'var(--card-solid)',
        border: isThisChartFiltered ? '2px solid #1e40af' : '1px solid var(--border)',
      }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {isThisChartFiltered && (
            <button
              onClick={() => setPropFilter(null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80"
              style={{ background: '#1e40af', color: '#fff' }}
            >
              {propFilter?.value} <X size={10} />
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {keys.map(k => {
            const totalVal = showCost
              ? propActiveYears.reduce((s, y) => s + (counts[k]?.[y]?.cost || 0), 0)
              : propActiveYears.reduce((s, y) => s + (counts[k]?.[y]?.count || 0), 0);
            const countVal = propActiveYears.reduce((s, y) => s + (counts[k]?.[y]?.count || 0), 0);
            const barPct = (totalVal / maxTotal) * 100;
            const isActive = isThisChartFiltered && propFilter?.value === k;
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
                  if (isActive) { setPropFilter(null); }
                  else { setPropFilter({ field: chartField, value: k }); }
                }}
              >
                <span className="text-[11px] font-medium shrink-0 text-right" style={{ color: 'var(--text-primary)', width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k}>{k}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 relative rounded-md overflow-hidden" style={{ height: 22, background: 'var(--bg-secondary)' }}>
                    <div className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden" style={{ width: `${Math.max(barPct, totalVal > 0 ? 3 : 0)}%` }}>
                      {propActiveYears.map(y => {
                        const val = showCost ? (counts[k]?.[y]?.cost || 0) : (counts[k]?.[y]?.count || 0);
                        if (val === 0) return null;
                        const segPct = (val / totalVal) * 100;
                        return (
                          <div key={y} className="h-full flex items-center justify-center" style={{ width: `${segPct}%`, background: YEAR_COLORS_PROP[y] || '#9ca3af', minWidth: val > 0 ? 14 : 0 }} title={`${y}: ${showCost ? fmtCostShort(val) + ' ฿' : val + ' ครั้ง'}`}>
                            {segPct > 25 && <span className="text-[9px] font-bold text-white/80">{showCost ? fmtCostShort(val) : val}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="shrink-0 text-right" style={{ width: 70 }}>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{showCost ? `${fmtCostShort(totalVal)} ฿` : totalVal}</span>
                    {showCost && <span className="text-[9px] ml-1" style={{ color: 'var(--muted)' }}>({countVal})</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Data for breakdown charts ----
  const dmgTypeData = groupByField('property_damage_type', incidentsFor('property_damage_type'));
  const areaData = groupByField('area', incidentsFor('area'));
  const agencyData = groupByField('agency_source', incidentsFor('agency_source'));
  const deptData = groupByField('department', incidentsFor('department'));

  // ---- Top 5 highest cost incidents ----
  const top5 = [...propFilteredIncidents]
    .map(inc => ({
      ...inc,
      totalCostVal: (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0),
    }))
    .sort((a, b) => b.totalCostVal - a.totalCostVal)
    .slice(0, 5);

  // ---- Cost driver insights ----
  const totalPropCost = propFilteredIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0), 0);
  const costByDmgType: Record<string, number> = {};
  propFilteredIncidents.forEach(inc => {
    const t = (inc as Record<string, unknown>).property_damage_type as string || 'ไม่ระบุ';
    costByDmgType[t] = (costByDmgType[t] || 0) + (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0);
  });
  const topCostDriver = Object.entries(costByDmgType).sort((a, b) => b[1] - a[1])[0];
  const topCostDriverPct = topCostDriver && totalPropCost > 0 ? Math.round((topCostDriver[1] / totalPropCost) * 100) : 0;

  const costByArea: Record<string, number> = {};
  propFilteredIncidents.forEach(inc => {
    const a = inc.area || 'ไม่ระบุ';
    costByArea[a] = (costByArea[a] || 0) + (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0);
  });
  const topAreaDriver = Object.entries(costByArea).sort((a, b) => b[1] - a[1])[0];
  const topAreaPct = topAreaDriver && totalPropCost > 0 ? Math.round((topAreaDriver[1] / totalPropCost) * 100) : 0;

  // ---- Missing data detection ----
  const missingDmgType = categoryIncidents.filter(i => {
    const t = (i as Record<string, unknown>).property_damage_type as string || '';
    return !t || t === 'ไม่ระบุ';
  });
  const missingCost = categoryIncidents.filter(i =>
    !Number(i.direct_cost) && !Number(i.indirect_cost)
  );
  const openRecords = categoryIncidents.filter(i => {
    const st = i.report_status || 'Draft';
    return st === 'Draft' || st === 'Open' || st === 'In Progress';
  });
  const highCostThreshold = totalPropCost > 0 ? totalPropCost * 0.2 : 50000;
  const highCostRecords = categoryIncidents.filter(i =>
    (Number(i.direct_cost) || 0) + (Number(i.indirect_cost) || 0) >= highCostThreshold
  );

  // ---- Claim status summary ----
  const claimCounts: Record<string, number> = {};
  categoryIncidents.forEach(inc => {
    const ic = (inc as Record<string, unknown>).insurance_claim as string || 'ไม่ระบุ';
    claimCounts[ic] = (claimCounts[ic] || 0) + 1;
  });

  // ---- Production impact summary ----
  const impactCounts: Record<string, number> = {};
  categoryIncidents.forEach(inc => {
    const pi = (inc as Record<string, unknown>).production_impact as string || 'ไม่ระบุ';
    impactCounts[pi] = (impactCounts[pi] || 0) + 1;
  });

  // ---- Quick filter chips ----
  const chipFilters: { label: string; field: string; value: string; count?: number; color?: string }[] = [
    { label: 'ทั้งหมด', field: '', value: '', count: categoryIncidents.length },
    { label: 'Open/Draft', field: '_status', value: 'open', count: openRecords.length, color: '#d97706' },
    { label: 'High Cost', field: '_highcost', value: 'high', count: highCostRecords.length, color: '#dc2626' },
    { label: 'ไม่ระบุประเภท', field: '_missing_type', value: 'missing', count: missingDmgType.length, color: '#9333ea' },
    { label: 'ไม่มี Cost', field: '_missing_cost', value: 'missing', count: missingCost.length, color: '#9333ea' },
    { label: 'เครื่องจักร/อุปกรณ์', field: 'property_damage_type', value: 'เครื่องจักร/อุปกรณ์เสียหาย' },
    { label: 'ยานพาหนะ', field: 'property_damage_type', value: 'ยานพาหนะเสียหาย' },
    { label: 'โครงสร้าง', field: 'property_damage_type', value: 'โครงสร้างอาคาร/ผนัง' },
    { label: 'เพลิงไหม้', field: 'property_damage_type', value: 'เพลิงไหม้' },
  ];

  // ---- Export CSV helper ----
  const exportCsv = () => {
    const rows = propFilteredIncidents.map(inc => ({
      incident_no: inc.incident_no,
      date: inc.incident_date,
      area: inc.area || '',
      agency_source: inc.agency_source || '',
      description: (inc.description || '').replace(/"/g, '""'),
      damage_type: (inc as Record<string, unknown>).property_damage_type as string || '',
      direct_cost: Number(inc.direct_cost) || 0,
      indirect_cost: Number(inc.indirect_cost) || 0,
      total_cost: (Number(inc.direct_cost) || 0) + (Number(inc.indirect_cost) || 0),
      production_impact: (inc as Record<string, unknown>).production_impact as string || '',
      insurance_claim: (inc as Record<string, unknown>).insurance_claim as string || '',
      status: inc.report_status || 'Draft',
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String((r as Record<string, unknown>)[h] ?? '')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-damage-incidents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Custom filter application for special chips ----
  const applyChipFilter = (chip: typeof chipFilters[number]) => {
    if (chip.field === '') { setPropFilter(null); return; }
    if (chip.field === '_status') { setPropFilter({ field: '_status', value: 'open' }); return; }
    if (chip.field === '_highcost') { setPropFilter({ field: '_highcost', value: 'high' }); return; }
    if (chip.field === '_missing_type') { setPropFilter({ field: '_missing_type', value: 'missing' }); return; }
    if (chip.field === '_missing_cost') { setPropFilter({ field: '_missing_cost', value: 'missing' }); return; }
    setPropFilter({ field: chip.field, value: chip.value });
  };

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{
                background: 'var(--card-solid)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${kpi.color}15` }}
              >
                <Icon size={20} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                <p className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
                {kpi.sub && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{kpi.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      {categoryIncidents.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
          <Shield size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>ช่วงเวลานี้ไม่มีเหตุทรัพย์สินเสียหาย</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>ลองเปลี่ยนช่วงปีหรือเปิด filter ทั้งหมด</p>
        </div>
      ) : (
        <>
          {/* Legend + filter info + quick chips */}
          <div className="flex flex-wrap items-center gap-3 mb-4 px-1">
            {propActiveYears.map(y => (
              <div key={y} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ background: YEAR_COLORS_PROP[y] || '#9ca3af' }} />
                <span className="text-[11px] font-semibold" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>{y}</span>
              </div>
            ))}
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              | แสดง {propFilteredIncidents.length} จาก {categoryIncidents.length} เหตุการณ์
            </span>
            {propFilter && (
              <button
                onClick={() => setPropFilter(null)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all hover:shadow-md"
                style={{ background: '#1e40af', color: '#fff' }}
              >
                {propFilter.value} <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-5 px-1">
            {chipFilters.map(chip => {
              const isActive = chip.field === '' ? !propFilter : (propFilter?.field === chip.field && propFilter?.value === chip.value);
              const hideIfZero = chip.field.startsWith('_') && chip.count === 0;
              if (hideIfZero) return null;
              return (
                <button
                  key={chip.label}
                  onClick={() => applyChipFilter(chip)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: isActive ? (chip.color || '#1e40af') : 'var(--bg-secondary)',
                    color: isActive ? '#fff' : (chip.color || 'var(--text-secondary)'),
                    border: `1px solid ${isActive ? (chip.color || '#1e40af') : 'var(--border)'}`,
                  }}
                >
                  {chip.label}
                  {chip.count !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0 rounded-full" style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : `${chip.color || '#1e40af'}15`,
                      color: isActive ? '#fff' : (chip.color || 'var(--text-secondary)'),
                    }}>
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
            {!propFilter && (
              <span className="text-[10px] italic self-center" style={{ color: 'var(--muted)' }}>
                คลิกที่แท่งกราฟเพื่อกรองข้อมูล
              </span>
            )}
          </div>

          {/* Cost Driver Insights */}
          {totalPropCost > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {topCostDriver && topCostDriverPct > 0 && (
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1e40af15' }}>
                    <TrendingUp size={18} style={{ color: '#1e40af' }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: '#1e3a5f' }}>
                      {topCostDriverPct}% ของความเสียหายมาจาก{topCostDriver[0]}
                    </p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>มูลค่า {fmtCostShort(topCostDriver[1])} ฿ จากทั้งหมด {fmtCostShort(totalPropCost)} ฿</p>
                  </div>
                </div>
              )}
              {topAreaDriver && topAreaPct > 0 && (
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#b4530915' }}>
                    <Activity size={18} style={{ color: '#b45309' }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: '#78350f' }}>
                      พื้นที่ {topAreaDriver[0]} มีค่าเสียหายสูงสุด ({topAreaPct}%)
                    </p>
                    <p className="text-[10px]" style={{ color: '#92400e' }}>มูลค่า {fmtCostShort(topAreaDriver[1])} ฿</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Claim Status + Impact Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {/* Claim Status */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Insurance Claim Status</h3>
              <div className="space-y-2">
                {Object.entries(claimCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                  const pct = categoryIncidents.length > 0 ? Math.round((count / categoryIncidents.length) * 100) : 0;
                  const claimColor = status === 'เคลมสำเร็จ' ? '#16a34a' : status === 'อยู่ระหว่างเคลม' ? '#2563eb' : status === 'ไม่อนุมัติ' ? '#dc2626' : '#64748b';
                  return (
                    <div key={status} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--bg-secondary)]"
                      onClick={() => setPropFilter({ field: 'insurance_claim', value: status })}
                      style={{ opacity: propFilter?.field === 'insurance_claim' && propFilter.value !== status ? 0.35 : 1 }}
                    >
                      <span className="text-[11px] shrink-0" style={{ width: 110, color: 'var(--text-secondary)' }}>{status}</span>
                      <div className="flex-1 relative rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg-secondary)' }}>
                        <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%`, background: claimColor }} />
                      </div>
                      <span className="text-[11px] font-bold shrink-0 text-right" style={{ width: 35, color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Production Impact Summary */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Production Impact</h3>
              <div className="space-y-2">
                {Object.entries(impactCounts).sort((a, b) => b[1] - a[1]).map(([impact, count]) => {
                  const pct = categoryIncidents.length > 0 ? Math.round((count / categoryIncidents.length) * 100) : 0;
                  const impactColor = impact === 'ไม่มีผลกระทบ' ? '#16a34a' : impact === 'ผลกระทบเล็กน้อย' ? '#eab308' : '#dc2626';
                  return (
                    <div key={impact} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--bg-secondary)]"
                      onClick={() => setPropFilter({ field: 'production_impact', value: impact })}
                      style={{ opacity: propFilter?.field === 'production_impact' && propFilter.value !== impact ? 0.35 : 1 }}
                    >
                      <span className="text-[11px] shrink-0" style={{ width: 110, color: 'var(--text-secondary)' }}>{impact}</span>
                      <div className="flex-1 relative rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg-secondary)' }}>
                        <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%`, background: impactColor }} />
                      </div>
                      <span className="text-[11px] font-bold shrink-0 text-right" style={{ width: 35, color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {renderPropStackedBar('Property Damage Type', 'property_damage_type', dmgTypeData)}
            {renderPropStackedBar('Area/Location', 'area', areaData)}
            {renderPropStackedBar('Agency Source', 'agency_source', agencyData)}
            {renderPropStackedBar('Department', 'department', deptData)}
          </div>

          {/* Top 5 Highest Cost */}
          {top5.length > 0 && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Top 5 Highest Cost Incidents</h3>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Incident #</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Damage Type</th>
                      <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5.map(inc => (
                      <tr
                        key={inc.incident_no}
                        onClick={() => openDrawer(inc)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        className="hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{inc.incident_no}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{inc.incident_date}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{(inc as Record<string, unknown>).property_damage_type as string || '—'}</td>
                        <td className="py-2 px-2 text-right font-bold" style={{ color: '#dc2626' }}>{fmtCostShort(inc.totalCostVal)} ฿</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Records List */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>All Records ({propFilteredIncidents.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Incident #</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Area</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Damage Type</th>
                    <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Direct Cost</th>
                    <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Indirect Cost</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {propFilteredIncidents.map(inc => {
                    const dmgType = (inc as Record<string, unknown>).property_damage_type as string || '';
                    const hasMissingType = !dmgType || dmgType === 'ไม่ระบุ';
                    const hasMissingCost = !Number(inc.direct_cost) && !Number(inc.indirect_cost);
                    return (
                      <tr
                        key={inc.incident_no}
                        onClick={() => openDrawer(inc)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        className="hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{inc.incident_no}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{inc.incident_date}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{inc.area || '—'}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex items-center gap-1.5">
                            {dmgType}
                            {hasMissingType && <AlertCircle size={12} style={{ color: '#d97706' }} />}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ color: hasMissingCost ? '#d97706' : 'var(--text-secondary)' }}>
                          {Number(inc.direct_cost) ? fmtCostShort(Number(inc.direct_cost)) + ' ฿' : (hasMissingCost ? '—' : '—')}
                        </td>
                        <td className="py-2 px-2 text-right" style={{ color: hasMissingCost ? '#d97706' : 'var(--text-secondary)' }}>
                          {Number(inc.indirect_cost) ? fmtCostShort(Number(inc.indirect_cost)) + ' ฿' : (hasMissingCost ? '—' : '—')}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{
                              background: inc.report_status === 'Closed' ? '#d1fae515' : inc.report_status === 'Open' ? '#fef08a15' : '#f3f4f615',
                              color: inc.report_status === 'Closed' ? '#16a34a' : inc.report_status === 'Open' ? '#ca8a04' : '#6b7280',
                            }}
                          >
                            {inc.report_status || 'Draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
