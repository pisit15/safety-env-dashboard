'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, Activity, Clock, Shield, Users, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Building2,
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
  tifr: number | null;
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

export default function HQIncidentsPage() {
  const auth = useAuth();
  const [selectedYears, setSelectedYears] = useState<number[]>([2021, 2022, 2023, 2024, 2025, 2026]);
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [manHoursByCompany, setManHoursByCompany] = useState<Record<string, { employee: number; contractor: number; total: number }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch incidents and manhours for all selected years
      const [incResults, mhResults] = await Promise.all([
        Promise.all(selectedYears.map(y =>
          Promise.all(COMPANIES.map(c =>
            fetch(`/api/incidents?companyId=${c.id}&year=${y}&limit=1000`).then(r => r.json())
          ))
        )),
        Promise.all(selectedYears.map(y =>
          Promise.all(COMPANIES.map(c =>
            fetch(`/api/manhours?companyId=${c.id}&year=${y}`).then(r => r.json()).then(d => ({
              companyId: c.id, year: y,
              employee: (d.manHours || []).reduce((a: number, r: Record<string, unknown>) => a + (Number(r.employee_manhours) || 0), 0),
              contractor: (d.manHours || []).reduce((a: number, r: Record<string, unknown>) => a + (Number(r.contractor_manhours) || 0), 0),
            }))
          ))
        )),
      ]);

      // Merge incidents
      const allInc: Incident[] = [];
      incResults.forEach(yearResults => yearResults.forEach(r => { if (r.incidents) allInc.push(...r.incidents); }));
      setAllIncidents(allInc);

      // Merge manhours by company
      const mhMap: Record<string, { employee: number; contractor: number; total: number }> = {};
      mhResults.forEach(yearResults => yearResults.forEach(r => {
        if (!mhMap[r.companyId]) mhMap[r.companyId] = { employee: 0, contractor: 0, total: 0 };
        mhMap[r.companyId].employee += r.employee;
        mhMap[r.companyId].contractor += r.contractor;
        mhMap[r.companyId].total += r.employee + r.contractor;
      }));
      setManHoursByCompany(mhMap);
    } catch { /* empty */ }
    setLoading(false);
  }, [selectedYears]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered by workRelatedOnly
  const INJURY_TYPES_P = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'];
  const baseInc = workRelatedOnly ? allIncidents.filter(i => i.work_related === 'ใช่') : allIncidents;

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

  // Per-company stats
  const companyStats: Record<string, CompanyStat> = {};
  COMPANIES.forEach(c => {
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
        tifr: mh && mh.total > 0 ? (injuries.length / mh.total) * 1000000 : null,
        ltifr: mh && mh.total > 0 ? (lti.length / mh.total) * 1000000 : null,
      };
    }
  });

  // Monthly data
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

  // Sort companies by total incidents desc
  const sortedCompanies = Object.entries(companyStats).sort((a, b) => b[1].total - a[1].total);

  // Total man-hours
  const totalManHours = Object.values(manHoursByCompany).reduce((sum, mh) => sum + mh.total, 0);
  const totalTIFR = totalManHours > 0 ? (totalSummary.totalInjuries / totalManHours) * 1000000 : null;
  const totalLTIFR = totalManHours > 0 ? (totalSummary.ltiCases / totalManHours) * 1000000 : null;

  const maxMonthly = Math.max(...Object.values(monthlyData).map(m => m.total), 1);
  const yearLabel = selectedYears.length === 1 ? String(selectedYears[0]) : `${selectedYears[0]}-${selectedYears[selectedYears.length - 1]}`;

  if (!auth.isAdmin) {
    return (
      <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: 'var(--muted)' }}>Admin only</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-8 pt-6 pb-3" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              สถิติอุบัติเหตุ — HQ Overview
            </h1>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            {/* Year Checkboxes */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>ปี:</span>
              {[2021, 2022, 2023, 2024, 2025, 2026].map(yr => (
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
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'อุบัติการณ์ทั้งหมด', value: totalSummary.totalIncidents, icon: AlertTriangle, color: '#6366f1' },
                  { label: 'บาดเจ็บ', value: totalSummary.totalInjuries, icon: Activity, color: '#f97316' },
                  { label: 'LTI Cases', value: totalSummary.ltiCases, icon: Clock, color: '#ef4444' },
                  { label: 'Near Miss', value: totalSummary.nearMisses, icon: Shield, color: '#8b5cf6' },
                  { label: 'ทรัพย์สินเสียหาย', value: totalSummary.propertyDamage, icon: DollarSign, color: '#22c55e' },
                  { label: 'เสียชีวิต', value: totalSummary.fatalities, icon: Users, color: totalSummary.fatalities > 0 ? '#ef4444' : '#9ca3af' },
                ].map((kpi, idx) => (
                  <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                        <kpi.icon size={16} style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* TIFR / LTIFR / Cost */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>TIFR (All Companies)</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: totalTIFR !== null ? '#f97316' : 'var(--muted)' }}>
                    {totalTIFR !== null ? totalTIFR.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                    Man-hours: {totalManHours > 0 ? totalManHours.toLocaleString() : 'ยังไม่มีข้อมูล'}
                  </p>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>LTIFR (All Companies)</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: totalLTIFR !== null ? '#ef4444' : 'var(--muted)' }}>
                    {totalLTIFR !== null ? totalLTIFR.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                    LTI Cases: {totalSummary.ltiCases}
                  </p>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>ค่าเสียหายรวม</p>
                  <p className="text-2xl font-bold mt-2" style={{ color: '#22c55e' }}>
                    {(totalSummary.totalDirectCost + totalSummary.totalIndirectCost).toLocaleString()} ฿
                  </p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>ตรง: {totalSummary.totalDirectCost.toLocaleString()}</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>อ้อม: {totalSummary.totalIndirectCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Monthly Chart */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  อุบัติการณ์รายเดือน — ทุกบริษัท ({yearLabel})
                </h3>
                <div className="flex items-end gap-2" style={{ height: 180 }}>
                  {MONTHS.map(m => {
                    const d = monthlyData[m] || { total: 0, injuries: 0, nearMiss: 0, propertyDamage: 0 };
                    const h = d.total > 0 ? (d.total / maxMonthly) * 150 : 0;
                    return (
                      <div key={m} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{d.total || ''}</span>
                        <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: Math.max(h, 2) }}>
                          {d.injuries > 0 && <div style={{ height: `${(d.injuries / d.total) * 100}%`, background: '#f97316', minHeight: 2 }} />}
                          {d.nearMiss > 0 && <div style={{ height: `${(d.nearMiss / d.total) * 100}%`, background: '#8b5cf6', minHeight: 2 }} />}
                          {d.propertyDamage > 0 && <div style={{ height: `${(d.propertyDamage / d.total) * 100}%`, background: '#22c55e', minHeight: 2 }} />}
                          {d.total === 0 && <div style={{ height: 2, background: 'var(--border)' }} />}
                        </div>
                        <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-6 mt-4 justify-center">
                  {[
                    { label: 'บาดเจ็บ', color: '#f97316' },
                    { label: 'Near Miss', color: '#8b5cf6' },
                    { label: 'ทรัพย์สิน', color: '#22c55e' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Comparison Table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    เปรียบเทียบรายบริษัท — {yearLabel}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        {['บริษัท', 'รวม', 'บาดเจ็บ', 'LTI', 'Near Miss', 'ทรัพย์สิน', 'เสียชีวิต', 'TIFR', 'LTIFR', 'ค่าเสียหาย'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompanies.map(([companyId, stats], idx) => {
                        const companyName = COMPANIES.find(c => c.id === companyId)?.shortName || companyId.toUpperCase();
                        return (
                          <tr key={companyId} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>{companyName}</td>
                            <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</td>
                            <td className="px-4 py-3" style={{ color: '#f97316' }}>{stats.injuries}</td>
                            <td className="px-4 py-3 font-semibold" style={{ color: stats.lti > 0 ? '#ef4444' : 'var(--muted)' }}>{stats.lti}</td>
                            <td className="px-4 py-3" style={{ color: '#8b5cf6' }}>{stats.nearMiss}</td>
                            <td className="px-4 py-3" style={{ color: '#22c55e' }}>{stats.propertyDamage}</td>
                            <td className="px-4 py-3 font-bold" style={{ color: stats.fatality > 0 ? '#ef4444' : 'var(--muted)' }}>{stats.fatality}</td>
                            <td className="px-4 py-3 font-mono" style={{ color: stats.tifr !== null ? '#f97316' : 'var(--muted)' }}>
                              {stats.tifr !== null ? stats.tifr.toFixed(2) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-mono" style={{ color: stats.ltifr !== null ? '#ef4444' : 'var(--muted)' }}>
                              {stats.ltifr !== null ? stats.ltifr.toFixed(2) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                              {(stats.directCost + stats.indirectCost).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedCompanies.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                            ไม่พบข้อมูลอุบัติเหตุในปี {yearLabel}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
