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

export default function HQIncidentsPage() {
  const auth = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStat>>({});
  const [manHoursByCompany, setManHoursByCompany] = useState<Record<string, { employee: number; contractor: number; total: number }>>({});

  // Also fetch summary for total KPIs
  const [totalSummary, setTotalSummary] = useState<{
    totalIncidents: number; totalInjuries: number; ltiCases: number;
    nearMisses: number; propertyDamage: number; fatalities: number;
    totalDirectCost: number; totalIndirectCost: number;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // HQ mode
      const hqRes = await fetch(`/api/incidents?mode=hq&year=${year}`);
      const hqData = await hqRes.json();
      setCompanyStats(hqData.companyStats || {});
      setManHoursByCompany(hqData.manHoursByCompany || {});

      // Also get summary for total aggregates
      const sumRes = await fetch(`/api/incidents?mode=summary&year=${year}`);
      const sumData = await sumRes.json();
      setTotalSummary(sumData.summary);
      setMonthlyData(sumData.monthlyData || {});
    } catch { /* empty */ }
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sort companies by total incidents desc
  const sortedCompanies = Object.entries(companyStats)
    .sort((a, b) => b[1].total - a[1].total);

  // Total man-hours
  const totalManHours = Object.values(manHoursByCompany).reduce((sum, mh) => sum + mh.total, 0);
  const totalTIFR = totalManHours > 0 && totalSummary ? (totalSummary.totalInjuries / totalManHours) * 1000000 : null;
  const totalLTIFR = totalManHours > 0 && totalSummary ? (totalSummary.ltiCases / totalManHours) * 1000000 : null;

  const maxMonthly = Math.max(...Object.values(monthlyData).map(m => m.total), 1);

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
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — HQ Overview
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Incident Statistics across all companies
              </p>
            </div>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...selectStyle, width: 100 }}>
              {[2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted)' }}>
              <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mr-3" />
              กำลังโหลดข้อมูล...
            </div>
          ) : totalSummary ? (
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
                  อุบัติการณ์รายเดือน — ทุกบริษัท ({year})
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
                    เปรียบเทียบรายบริษัท — {year}
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
                            ไม่พบข้อมูลอุบัติเหตุในปี {year}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20" style={{ color: 'var(--muted)' }}>ไม่พบข้อมูล</div>
          )}
        </div>
      </main>
    </div>
  );
}
