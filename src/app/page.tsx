'use client';

import { useState, useEffect } from 'react';
import { Shield, Leaf, BarChart3 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { RankingChart, StatusPieChart, BudgetChart, MonthlyProgressChart } from '@/components/Charts';
import { DashboardData } from '@/lib/types';
import Link from 'next/link';

export default function HQOverview() {
  const [planType, setPlanType] = useState<'environment' | 'safety' | 'total'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hq_planType');
      if (saved === 'safety' || saved === 'environment' || saved === 'total') return saved;
    }
    return 'total';
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist planType to localStorage
  useEffect(() => {
    localStorage.setItem('hq_planType', planType);
  }, [planType]);

  useEffect(() => {
    setLoading(true);
    if (planType === 'total') {
      // Fetch both safety and environment, merge
      Promise.all([
        fetch('/api/dashboard?plan=safety').then(r => r.json()),
        fetch('/api/dashboard?plan=environment').then(r => r.json()),
      ]).then(([s, e]: [DashboardData, DashboardData]) => {
        // Merge companies — combine same company's data
        const companyMap = new Map<string, any>();
        [...s.companies, ...e.companies].forEach(c => {
          const existing = companyMap.get(c.companyId);
          if (existing) {
            existing.total += c.total;
            existing.done += c.done;
            existing.notStarted += c.notStarted;
            existing.postponed += c.postponed;
            existing.cancelled += c.cancelled;
            existing.notApplicable += (c.notApplicable || 0);
            existing.budget += c.budget;
            existing.pctDone = existing.total > 0 ? Math.round((existing.done / existing.total) * 1000) / 10 : 0;
          } else {
            companyMap.set(c.companyId, { ...c, notApplicable: c.notApplicable || 0 });
          }
        });
        const mergedCompanies = Array.from(companyMap.values());

        // Merge monthly progress
        const monthlyProgress = (s.monthlyProgress || []).map((m, i) => {
          const m2 = (e.monthlyProgress || [])[i] || { planned: 0, completed: 0, doneCount: 0, notApplicableCount: 0 };
          const planned = m.planned + m2.planned;
          const completed = m.completed + m2.completed;
          return {
            ...m,
            planned,
            completed,
            pctComplete: planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0,
            doneCount: (m.doneCount ?? 0) + (m2.doneCount ?? 0),
            notApplicableCount: (m.notApplicableCount ?? 0) + (m2.notApplicableCount ?? 0),
          };
        });

        const totalActs = mergedCompanies.reduce((sum: number, c: any) => sum + c.total, 0);
        const totalDone = mergedCompanies.reduce((sum: number, c: any) => sum + c.done, 0);
        setData({
          companies: mergedCompanies,
          totalActivities: totalActs,
          totalDone,
          totalNotStarted: mergedCompanies.reduce((sum: number, c: any) => sum + c.notStarted, 0),
          totalPostponed: mergedCompanies.reduce((sum: number, c: any) => sum + c.postponed, 0),
          totalCancelled: mergedCompanies.reduce((sum: number, c: any) => sum + c.cancelled, 0),
          totalNotApplicable: mergedCompanies.reduce((sum: number, c: any) => sum + c.notApplicable, 0),
          totalBudget: mergedCompanies.reduce((sum: number, c: any) => sum + c.budget, 0),
          overallPct: totalActs > 0 ? Math.round((totalDone / totalActs) * 1000) / 10 : 0,
          monthlyProgress,
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      fetch(`/api/dashboard?plan=${planType}`)
        .then(res => res.json())
        .then((d: DashboardData) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [planType]);

  if (!data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div>
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    );
  }

  const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const currentMonth = monthNames[new Date().getMonth()];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] mb-2">
          <span style={{ color: 'var(--muted)' }}>Home</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>แผนงานประจำปี</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              HQ Overview — {planType === 'total' ? 'แผนงานรวม' : planType === 'safety' ? 'แผนงานความปลอดภัย' : 'แผนงานสิ่งแวดล้อม'} 2026
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--muted)' }}>
              ภาพรวมกลุ่ม — {data.companies.length} บริษัท | ข้อมูล ณ {currentMonth} 2026
              {loading && <span className="ml-2 animate-pulse" style={{ color: 'var(--accent)' }}>กำลังอัปเดต...</span>}
            </p>
          </div>
          <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--border)' }}>
            <button
              onClick={() => setPlanType('total')}
              className="px-5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5"
              style={planType === 'total'
                ? { background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 20px rgba(10, 132, 255, 0.4), 0 0 0 1px rgba(10, 132, 255, 0.3)' }
                : { color: 'var(--muted)' }}
            >
              <BarChart3 size={14} /> Total
            </button>
            <button
              onClick={() => setPlanType('safety')}
              className="px-5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5"
              style={planType === 'safety'
                ? { background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 20px rgba(10, 132, 255, 0.4), 0 0 0 1px rgba(10, 132, 255, 0.3)' }
                : { color: 'var(--muted)' }}
            >
              <Shield size={14} /> Safety Plan
            </button>
            <button
              onClick={() => setPlanType('environment')}
              className="px-5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5"
              style={planType === 'environment'
                ? { background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 20px rgba(10, 132, 255, 0.4), 0 0 0 1px rgba(10, 132, 255, 0.3)' }
                : { color: 'var(--muted)' }}
            >
              <Leaf size={14} /> Envi Plan
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-8" style={{ alignItems: 'stretch' }}>
          {[
            { label: 'กิจกรรมทั้งหมด', value: data.totalActivities },
            { label: 'เสร็จแล้ว', value: data.totalDone, color: '#30d158', delta: `▲ ${data.overallPct}%`, deltaColor: '#30d158', progress: data.overallPct },
            { label: 'ยังไม่เริ่ม', value: data.totalNotStarted, color: '#ff9f0a' },
            { label: 'เลื่อน', value: data.totalPostponed, color: '#5ac8fa' },
            { label: 'ยกเลิก', value: data.totalCancelled, color: '#ff453a' },
            { label: 'ไม่เข้าเงื่อนไข', value: data.totalNotApplicable || 0, color: '#8e8e93' },
            { label: 'งบประมาณรวม', value: data.totalBudget > 0 ? `${(data.totalBudget / 1000000).toFixed(2)}M` : '-', color: '#5ac8fa', subtext: 'บาท' },
          ].map((kpi, i) => (
            <div key={kpi.label} className={`animate-fade-in-up stagger-${i + 1}`} style={{ opacity: 0, display: 'flex' }}>
              <KPICard {...kpi} />
            </div>
          ))}
        </div>

        {/* Monthly Progress Chart */}
        <div className="glass-card p-6 mb-6 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.2s' }}>
          <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
            ติดตามความก้าวหน้ารายเดือน — Plan vs Actual
          </h3>
          <div style={{ height: 300 }}>
            <MonthlyProgressChart monthlyProgress={data.monthlyProgress || []} />
          </div>
          {/* Monthly summary row */}
          <div className="grid grid-cols-12 gap-1.5 mt-5">
            {(data.monthlyProgress || []).map((mp, idx) => {
              const currentMonthIdx = new Date().getMonth();
              const isPast = idx < currentMonthIdx;
              const isCurrent = idx === currentMonthIdx;
              return (
                <div
                  key={mp.month}
                  className="text-center p-2 rounded-xl text-[10px] transition-all duration-200"
                  style={{
                    background: isCurrent ? 'rgba(255, 149, 0, 0.1)' :
                      isPast ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
                    border: isCurrent ? '1px solid rgba(255, 149, 0, 0.3)' : '1px solid var(--border)',
                  }}
                >
                  <div className="font-semibold" style={{
                    color: isCurrent ? '#ff9500' : 'var(--muted)'
                  }}>
                    {mp.label}
                  </div>
                  <div className="text-lg font-bold" style={{
                    color: mp.pctComplete >= 100 ? '#34c759' :
                      mp.pctComplete > 0 ? '#ff9500' :
                      isPast ? '#ff3b30' : 'var(--muted)'
                  }}>
                    {mp.planned > 0 ? `${mp.pctComplete}%` : '-'}
                  </div>
                  <div style={{ color: 'var(--muted)' }}>
                    {mp.completed}/{mp.planned}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <div className="lg:col-span-3 glass-card p-6">
            <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              Ranking % สำเร็จ รายบริษัท
            </h3>
            <div style={{ height: 420 }}>
              <RankingChart companies={data.companies} />
            </div>
          </div>
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: '#34c759' }}></span>
              สัดส่วนสถานะกิจกรรม
            </h3>
            <div style={{ height: 320 }}>
              <StatusPieChart
                done={data.totalDone}
                notStarted={data.totalNotStarted}
                postponed={data.totalPostponed}
                cancelled={data.totalCancelled}
                notApplicable={data.totalNotApplicable || 0}
              />
            </div>
          </div>
        </div>

        {/* Company Table */}
        <div className="glass-card p-6 mb-6">
          <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-0.5 h-4 rounded-full" style={{ background: '#5ac8fa' }}></span>
            สรุปรายบริษัท
          </h3>
          <div className="overflow-x-auto">
            <table className="apple-table">
              <thead>
                <tr>
                  <th>บริษัท</th>
                  <th className="text-center">ทั้งหมด</th>
                  <th className="text-center">เสร็จ</th>
                  <th className="text-center">ยังไม่เริ่ม</th>
                  <th className="text-center">เลื่อน</th>
                  <th className="text-center">ยกเลิก</th>
                  <th className="text-center">N/A</th>
                  <th className="text-center">% สำเร็จ</th>
                  <th className="text-right">งบประมาณ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...data.companies]
                  .sort((a, b) => b.pctDone - a.pctDone)
                  .map((c) => (
                    <tr key={c.companyId}>
                      <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.companyName}</td>
                      <td className="text-center">{c.total || '-'}</td>
                      <td className="text-center" style={{ color: '#34c759' }}>{c.done || '-'}</td>
                      <td className="text-center" style={{ color: '#ff9500' }}>{c.notStarted || '-'}</td>
                      <td className="text-center" style={{ color: '#5ac8fa' }}>{c.postponed || '-'}</td>
                      <td className="text-center" style={{ color: '#ff3b30' }}>{c.cancelled || '-'}</td>
                      <td className="text-center" style={{ color: 'var(--muted)' }}>{c.notApplicable || '-'}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-[5px] rounded-full" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-[5px] rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(c.pctDone * 2, 100)}%`,
                                backgroundColor: c.pctDone >= 25 ? '#34c759' : '#ff9500',
                              }}
                            />
                          </div>
                          <span className="text-[13px] font-semibold" style={{ color: c.pctDone >= 25 ? '#34c759' : '#ff9500' }}>
                            {c.pctDone}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                        {c.budget > 0 ? c.budget.toLocaleString() : '-'}
                      </td>
                      <td className="text-right">
                        {c.total > 0 ? (
                          <Link
                            href={`/company/${c.companyId}`}
                            className="text-[12px] font-medium transition-colors"
                            style={{ color: 'var(--accent)' }}
                          >
                            ดูรายละเอียด →
                          </Link>
                        ) : (
                          <span className="text-[12px]" style={{ color: 'var(--border)' }}>ยังไม่เชื่อม</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget Chart */}
        <div className="glass-card p-6">
          <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-0.5 h-4 rounded-full" style={{ background: '#ffd60a' }}></span>
            งบประมาณรายบริษัท (บาท)
          </h3>
          <div style={{ height: 400 }}>
            <BudgetChart companies={data.companies} />
          </div>
        </div>
      </main>
    </div>
  );
}
