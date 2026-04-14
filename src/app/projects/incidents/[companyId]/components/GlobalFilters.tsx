'use client';

import { X } from 'lucide-react';
import { IncidentCategory, getTypeColor } from '../types';
import { getYearOptions, MONTH_TH } from '../constants';

interface GlobalFiltersProps {
  selectedYears: number[];
  setSelectedYears: (years: number[]) => void;
  workRelatedOnly: boolean;
  setWorkRelatedOnly: (v: boolean) => void;
  incidentCategory: IncidentCategory;
  setIncidentCategory: (cat: IncidentCategory) => void;
  dashFilter: { month?: string; type?: string };
  setDashFilter: React.Dispatch<React.SetStateAction<{ month?: string; type?: string }>>;
  viewMode: string;
  setPage: (p: number) => void;
  setInjuryFilter: (f: null) => void;
  setPropFilter: (f: null) => void;
}

export default function GlobalFilters({
  selectedYears, setSelectedYears,
  workRelatedOnly, setWorkRelatedOnly,
  incidentCategory, setIncidentCategory,
  dashFilter, setDashFilter,
  viewMode, setPage,
  setInjuryFilter, setPropFilter,
}: GlobalFiltersProps) {
  if (viewMode !== 'dashboard' && viewMode !== 'list') return null;

  const currentYear = new Date().getFullYear();
  const allYears = getYearOptions();
  const presets: { label: string; years: number[] }[] = [
    { label: 'YTD', years: [currentYear] },
    { label: `${currentYear - 1}–${currentYear}`, years: [currentYear - 1, currentYear] },
    { label: '3 ปีล่าสุด', years: allYears.filter(y => y >= currentYear - 2) },
    { label: 'ทั้งหมด', years: [...allYears] },
  ];
  const isPresetActive = (p: { years: number[] }) =>
    p.years.length === selectedYears.length && p.years.every(y => selectedYears.includes(y));

  return (
    <>
      {/* Year / Work-Related / Active Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Year Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold mr-0.5" style={{ color: 'var(--muted)' }}>ช่วงปี:</span>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setSelectedYears(p.years); setPage(1); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: isPresetActive(p) ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isPresetActive(p) ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isPresetActive(p) ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Individual year toggles */}
        <div className="flex items-center gap-1">
          {allYears.map(yr => (
            <button
              key={yr}
              onClick={() => {
                const next = selectedYears.includes(yr)
                  ? selectedYears.filter(y => y !== yr)
                  : [...selectedYears, yr].sort();
                if (next.length > 0) { setSelectedYears(next); setPage(1); }
              }}
              className="w-8 h-6 rounded text-[10px] font-semibold transition-all"
              style={{
                background: selectedYears.includes(yr) ? 'var(--accent)' : 'transparent',
                color: selectedYears.includes(yr) ? '#fff' : 'var(--muted)',
                border: `1px solid ${selectedYears.includes(yr) ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {String(yr).slice(-2)}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Work-Related Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWorkRelatedOnly(!workRelatedOnly); setPage(1); }}
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

        {/* Active chart filter indicator */}
        {viewMode === 'dashboard' && (dashFilter.month || dashFilter.type) && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
            <div className="flex items-center gap-2">
              {dashFilter.month && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
                  {MONTH_TH[dashFilter.month] || dashFilter.month}
                  <button onClick={() => setDashFilter(f => ({ ...f, month: undefined }))} className="ml-1 opacity-70 hover:opacity-100">×</button>
                </span>
              )}
              {dashFilter.type && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: getTypeColor(dashFilter.type), color: '#fff' }}>
                  {dashFilter.type}
                  <button onClick={() => setDashFilter(f => ({ ...f, type: undefined }))} className="ml-1 opacity-70 hover:opacity-100">×</button>
                </span>
              )}
              <button onClick={() => setDashFilter({})} className="text-[11px] underline" style={{ color: 'var(--muted)' }}>ล้าง</button>
            </div>
          </>
        )}
      </div>

      {/* Category Workspace Tabs */}
      <div className="flex items-center gap-1 mt-2 p-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {([
          { key: 'overview' as IncidentCategory, label: 'Overview' },
          { key: 'injury' as IncidentCategory, label: 'อุบัติเหตุบาดเจ็บ' },
          { key: 'property' as IncidentCategory, label: 'Property Damage' },
          { key: 'rates' as IncidentCategory, label: 'TRIR / LTIFR' },
          { key: 'actions' as IncidentCategory, label: 'Corrective Actions' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setIncidentCategory(tab.key); setPage(1); setInjuryFilter(null); setPropFilter(null); }}
            className="px-4 py-1.5 rounded-md text-[12px] font-medium transition-all"
            style={{
              background: incidentCategory === tab.key ? 'var(--accent)' : 'transparent',
              color: incidentCategory === tab.key ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
