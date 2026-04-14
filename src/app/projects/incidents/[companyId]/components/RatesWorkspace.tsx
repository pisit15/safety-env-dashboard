'use client';

import { useState, useMemo } from 'react';
import type { Incident, InjuredPerson } from '../types';
import { MONTHS, INJURY_TYPES_PART } from '../constants';
import { STATUS, PALETTE } from '@/lib/she-theme';

/* ─── helpers ─── */
const isInjuryType = (t: string) => INJURY_TYPES_PART.some(p => t.includes(p));
const isLtiType = (t: string) =>
  (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';

// Year colors palette - using theme tokens where possible, keeping distinct metrics separate
const YEAR_PALETTE = ['#8b5cf6', PALETTE.primary, PALETTE.secondary, '#ef4444', '#22c55e', '#ec4899', PALETTE.textSecondary, '#14b8a6'];
const getYearColor = (year: number, idx: number) => YEAR_PALETTE[idx % YEAR_PALETTE.length];

interface ManHourRow {
  year: number;
  month: number;
  employee_manhours: number;
  contractor_manhours: number;
}

interface RatesWorkspaceProps {
  dashIncidents: Incident[];
  manHourRows: ManHourRow[];
  selectedYears: number[];
  workRelatedOnly: boolean;
  injuredPersonsData: InjuredPerson[];
}

type PersonScope = 'combined' | 'employee' | 'contractor';
type RateMetric = 'trir' | 'ltifr';
type TrendMode = 'monthly' | 'ytd';

export default function RatesWorkspace({
  dashIncidents,
  manHourRows,
  selectedYears,
  workRelatedOnly,
  injuredPersonsData,
}: RatesWorkspaceProps) {
  const [personScope, setPersonScope] = useState<PersonScope>('combined');
  const [rateMetric, setRateMetric] = useState<RateMetric>('trir');
  const [trendMode, setTrendMode] = useState<TrendMode>('monthly');

  const sortedYears = useMemo(() => [...selectedYears].sort(), [selectedYears]);

  // Build person type map from injured persons
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

  const hasPersonType = (inc: Incident, keyword: string): boolean => {
    const pts = incidentPersonTypes.get(inc.incident_no);
    if (pts && pts.size > 0) return Array.from(pts).some(pt => pt.includes(keyword));
    return (inc.person_type || '').includes(keyword);
  };

  // Filtered incidents by work-related
  const filtered = useMemo(() =>
    workRelatedOnly ? dashIncidents.filter(i => i.work_related === 'ใช่') : dashIncidents,
    [dashIncidents, workRelatedOnly]
  );

  // Manhours by year
  const mhByYear = useMemo(() => {
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

  // Manhours by year+month
  const mhByYearMonth = useMemo(() => {
    const map: Record<string, { emp: number; con: number; total: number }> = {};
    for (const r of manHourRows) {
      const key = `${r.year}-${r.month}`;
      const emp = Number(r.employee_manhours) || 0;
      const con = Number(r.contractor_manhours) || 0;
      map[key] = { emp, con, total: emp + con };
    }
    return map;
  }, [manHourRows]);

  /* ═══ 1. Annual Comparison (ratesByYear) ═══ */
  const ratesByYear = useMemo(() => {
    return sortedYears.map(y => {
      const yInc = filtered.filter(i => i.year === y);

      const scopeFilter = (inc: Incident) => {
        if (personScope === 'employee') return hasPersonType(inc, 'พนักงาน');
        if (personScope === 'contractor') return hasPersonType(inc, 'ผู้รับเหมา');
        return true;
      };

      const trc = yInc.filter(i => isInjuryType(i.incident_type || '')).filter(scopeFilter).length;
      const lti = yInc.filter(i => isLtiType(i.incident_type || '')).filter(scopeFilter).length;
      const mhData = mhByYear[y] || { emp: 0, con: 0, total: 0 };
      const mh = personScope === 'employee' ? mhData.emp
        : personScope === 'contractor' ? mhData.con
        : mhData.total;
      const trir = mh > 0 ? (trc / mh) * 1000000 : 0;
      const ltifr = mh > 0 ? (lti / mh) * 1000000 : 0;

      return { year: y, trc, lti, manhours: mh, trir, ltifr };
    });
  }, [sortedYears, filtered, personScope, mhByYear]);

  /* ═══ 2. YTD Trend (ratesByMonth) ═══ */
  const ratesByMonth = useMemo(() => {
    const normalizeMonth = (raw: unknown): number => {
      if (!raw) return 0;
      const s = String(raw).trim();
      const idx = MONTHS.indexOf(s);
      if (idx >= 0) return idx + 1;
      const num = parseInt(s);
      return (num >= 1 && num <= 12) ? num : 0;
    };

    const result: { year: number; month: number; trir: number; ltifr: number; trirYtd: number; ltifrYtd: number }[] = [];

    for (const y of sortedYears) {
      const yInc = filtered.filter(i => i.year === y);
      let cumTrc = 0, cumLti = 0, cumMh = 0;

      for (let m = 1; m <= 12; m++) {
        const mInc = yInc.filter(i => normalizeMonth(i.month) === m);

        const scopeFilter = (inc: Incident) => {
          if (personScope === 'employee') return hasPersonType(inc, 'พนักงาน');
          if (personScope === 'contractor') return hasPersonType(inc, 'ผู้รับเหมา');
          return true;
        };

        const trc = mInc.filter(i => isInjuryType(i.incident_type || '')).filter(scopeFilter).length;
        const lti = mInc.filter(i => isLtiType(i.incident_type || '')).filter(scopeFilter).length;
        const mhData = mhByYearMonth[`${y}-${m}`] || { emp: 0, con: 0, total: 0 };
        const mh = personScope === 'employee' ? mhData.emp
          : personScope === 'contractor' ? mhData.con
          : mhData.total;

        const trir = mh > 0 ? (trc / mh) * 1000000 : 0;
        const ltifr = mh > 0 ? (lti / mh) * 1000000 : 0;

        cumTrc += trc;
        cumLti += lti;
        cumMh += mh;

        const trirYtd = cumMh > 0 ? (cumTrc / cumMh) * 1000000 : 0;
        const ltifrYtd = cumMh > 0 ? (cumLti / cumMh) * 1000000 : 0;

        result.push({ year: y, month: m, trir, ltifr, trirYtd, ltifrYtd });
      }
    }
    return result;
  }, [sortedYears, filtered, personScope, mhByYearMonth]);

  /* ═══ Rendering ═══ */

  const maxAnnualRate = Math.max(
    ...ratesByYear.map(r => Math.max(r.trir, r.ltifr)),
    0.1
  );

  // SVG constants
  const W = 560, H = 280;
  const PAD = { top: 30, right: 20, bottom: 40, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Grid helpers
  const niceMax = (v: number) => {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    if (norm <= 1.2) return 1.2 * mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  };

  /* ─── Annual Comparison Bar Chart ─── */
  const renderAnnualChart = () => {
    const maxRate = niceMax(maxAnnualRate);
    const barGroupW = plotW / Math.max(sortedYears.length, 1);
    const barW = Math.min(barGroupW * 0.35, 40);
    const gap = 4;
    const trirColor = '#8b5cf6';  // Distinct metric color
    const ltifrColor = '#ec4899'; // Distinct metric color

    const gridLines = 5;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 8 }}>
        {/* Grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = PAD.top + (i / gridLines) * plotH;
          const val = maxRate * (1 - i / gridLines);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth={i === gridLines ? 1 : 0.5} strokeDasharray={i === gridLines ? '' : '4'} />
              <text x={PAD.left - 8} y={y + 3} fontSize="9" fill="var(--muted)" textAnchor="end">{val.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Bars */}
        {ratesByYear.map((d, i) => {
          const x = PAD.left + i * barGroupW + barGroupW / 2;
          const trirH = maxRate > 0 ? (d.trir / maxRate) * plotH : 0;
          const ltifrH = maxRate > 0 ? (d.ltifr / maxRate) * plotH : 0;

          return (
            <g key={d.year}>
              {/* TRIR bar */}
              <rect
                x={x - barW - gap / 2}
                y={PAD.top + plotH - trirH}
                width={barW}
                height={trirH}
                rx={3}
                fill={trirColor}
                opacity={0.85}
              />
              {trirH > 15 && (
                <text x={x - barW / 2 - gap / 2} y={PAD.top + plotH - trirH - 4} fontSize="9" fill={trirColor} textAnchor="middle" fontWeight="600">
                  {d.trir.toFixed(2)}
                </text>
              )}
              {/* LTIFR bar */}
              <rect
                x={x + gap / 2}
                y={PAD.top + plotH - ltifrH}
                width={barW}
                height={ltifrH}
                rx={3}
                fill={ltifrColor}
                opacity={0.85}
              />
              {ltifrH > 15 && (
                <text x={x + barW / 2 + gap / 2} y={PAD.top + plotH - ltifrH - 4} fontSize="9" fill={ltifrColor} textAnchor="middle" fontWeight="600">
                  {d.ltifr.toFixed(2)}
                </text>
              )}
              {/* Year label */}
              <text x={x} y={H - PAD.bottom + 16} fontSize="11" fill="var(--text-secondary)" textAnchor="middle" fontWeight="600">
                {d.year}
              </text>
            </g>
          );
        })}
        {/* Legend removed - labels now shown at end of bars in renderAnnualChart */}
      </svg>
    );
  };

  /* ─── YTD Trend Line Chart ─── */
  const renderTrendChart = () => {
    const metricKey = trendMode === 'ytd'
      ? (rateMetric === 'trir' ? 'trirYtd' : 'ltifrYtd')
      : (rateMetric === 'trir' ? 'trir' : 'ltifr');

    // Get all values for y-axis scale
    const allVals = ratesByMonth.map(r => r[metricKey as keyof typeof r] as number).filter(v => v > 0);
    const maxVal = niceMax(allVals.length > 0 ? Math.max(...allVals) : 1);

    const gridLines = 5;
    const xScale = (m: number) => PAD.left + ((m - 1) / 11) * plotW;
    const yScale = (v: number) => PAD.top + plotH - (v / maxVal) * plotH;

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 8 }}>
        {/* Grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = PAD.top + (i / gridLines) * plotH;
          const val = maxVal * (1 - i / gridLines);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth={i === gridLines ? 1 : 0.5} strokeDasharray={i === gridLines ? '' : '4'} />
              <text x={PAD.left - 8} y={y + 3} fontSize="9" fill="var(--muted)" textAnchor="end">{val.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Month labels */}
        {MONTHS.map((m, i) => (
          <text key={m} x={xScale(i + 1)} y={H - PAD.bottom + 16} fontSize="9" fill="var(--muted)" textAnchor="middle">{m}</text>
        ))}
        {/* Lines per year with end-of-line labels */}
        {sortedYears.map((y, yIdx) => {
          const yearData = ratesByMonth.filter(r => r.year === y);
          const color = getYearColor(y, yIdx);
          const points: [number, number][] = yearData.map(r => [
            xScale(r.month),
            yScale(r[metricKey as keyof typeof r] as number),
          ]);
          if (points.length === 0) return null;
          const pathStr = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

          // Get the last point for label placement
          const lastPoint = points[points.length - 1];

          return (
            <g key={y}>
              <path d={pathStr} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
              {/* Dots */}
              {points.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color} />
              ))}
              {/* Year label at end of line */}
              <text x={lastPoint[0] + 8} y={lastPoint[1] + 4} fontSize="10" fill={color} fontWeight="600" textAnchor="start">
                {y}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  /* ─── Toggle buttons helper ─── */
  const renderToggle = <T extends string>(
    options: { key: T; label: string }[],
    active: T,
    setActive: (v: T) => void,
  ) => (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => setActive(opt.key)}
          className="px-3 py-1.5 text-[11px] font-semibold transition-all"
          style={{
            background: active === opt.key ? 'var(--accent)' : 'transparent',
            color: active === opt.key ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Scope Toggle */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>กลุ่ม:</span>
        {renderToggle(
          [
            { key: 'combined' as PersonScope, label: 'Combined' },
            { key: 'employee' as PersonScope, label: 'Employee' },
            { key: 'contractor' as PersonScope, label: 'Contractor' },
          ],
          personScope,
          setPersonScope,
        )}
      </div>

      {/* ═══ Section 1: Annual Comparison ═══ */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Annual Comparison — TRIR & LTIFR ({personScope === 'combined' ? 'Combined' : personScope === 'employee' ? 'Employee' : 'Contractor'})
        </p>
        {sortedYears.length === 0 ? (
          <p className="text-[12px] py-8 text-center" style={{ color: 'var(--muted)' }}>กรุณาเลือกปี</p>
        ) : (
          renderAnnualChart()
        )}

        {/* Summary Table */}
        <div className="mt-4 overflow-x-auto" style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                {['Year', 'TRC', 'LTI', 'Man-Hours', 'TRIR', 'LTIFR'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Year' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ratesByYear.map(r => (
                <tr key={r.year} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.year}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{r.trc}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{r.lti}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.manhours.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>{/* Distinct metric color */}{r.trir.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>{/* Distinct metric color */}{r.ltifr.toFixed(2)}</td>
                </tr>
              ))}
              {/* Total row */}
              {ratesByYear.length > 1 && (() => {
                const totalTrc = ratesByYear.reduce((s, r) => s + r.trc, 0);
                const totalLti = ratesByYear.reduce((s, r) => s + r.lti, 0);
                const totalMh = ratesByYear.reduce((s, r) => s + r.manhours, 0);
                const totalTrir = totalMh > 0 ? (totalTrc / totalMh) * 1000000 : 0;
                const totalLtifr = totalMh > 0 ? (totalLti / totalMh) * 1000000 : 0;
                return (
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{totalTrc}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{totalLti}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{totalMh.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>{/* Distinct metric color */}{totalTrir.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>{/* Distinct metric color */}{totalLtifr.toFixed(2)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Section 2: YTD Trend Comparison ═══ */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
            {trendMode === 'ytd' ? 'Cumulative YTD' : 'Monthly'} — {rateMetric.toUpperCase()} ({personScope === 'combined' ? 'Combined' : personScope === 'employee' ? 'Employee' : 'Contractor'})
          </p>
          <div className="flex items-center gap-2">
            {renderToggle(
              [
                { key: 'trir' as RateMetric, label: 'TRIR' },
                { key: 'ltifr' as RateMetric, label: 'LTIFR' },
              ],
              rateMetric,
              setRateMetric,
            )}
            {renderToggle(
              [
                { key: 'monthly' as TrendMode, label: 'Monthly' },
                { key: 'ytd' as TrendMode, label: 'Cumulative YTD' },
              ],
              trendMode,
              setTrendMode,
            )}
          </div>
        </div>
        {sortedYears.length === 0 ? (
          <p className="text-[12px] py-8 text-center" style={{ color: 'var(--muted)' }}>กรุณาเลือกปี</p>
        ) : (
          renderTrendChart()
        )}
      </div>
    </div>
  );
}
