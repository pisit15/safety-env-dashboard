'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { RankingChart, StatusPieChart, BudgetChart, MonthlyProgressChart } from '@/components/Charts';
import { DashboardData } from '@/lib/types';
import Link from 'next/link';

export default function HQOverview() {
  const [planType, setPlanType] = useState<'environment' | 'safety'>('environment');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?plan=${planType}`)
      .then(res => res.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [planType]);

  if (!data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted">กำลังโหลดข้อมูล...</p>
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
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>Home</span>
          <span>/</span>
          <span className="text-white">แผนงานประจำปี</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              📊 HQ Overview — แผนงาน{planType === 'safety' ? 'ความปลอดภัย' : 'สิ่งแวดล้อม'} 2026
            </h1>
            <p className="text-sm text-muted mt-1">
              ภาพรวมกลุ่ม — {data.companies.length} บริษัท | ข้อมูล ณ {currentMonth} 2026
              {loading && <span className="ml-2 text-accent animate-pulse">กำลังอัปเดต...</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPlanType('safety')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'safety'
                  ? 'bg-accent text-white'
                  : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🛡️ Safety Plan
            </button>
            <button
              onClick={() => setPlanType('environment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'environment'
                  ? 'bg-accent text-white'
                  : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🌿 Envi Plan
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
          <KPICard
            label="กิจกรรมทั้งหมด"
            value={data.totalActivities}
          />
          <KPICard
            label="เสร็จแล้ว"
            value={data.totalDone}
            color="#4ade80"
            delta={`▲ ${data.overallPct}%`}
            deltaColor="#4ade80"
            progress={data.overallPct}
          />
          <KPICard
            label="ยังไม่เริ่ม"
            value={data.totalNotStarted}
            color="#fb923c"
          />
          <KPICard
            label="เลื่อน"
            value={data.totalPostponed}
            color="#60a5fa"
          />
          <KPICard
            label="ยกเลิก"
            value={data.totalCancelled}
            color="#f87171"
          />
          <KPICard
            label="ไม่เข้าเงื่อนไข"
            value={data.totalNotApplicable || 0}
            color="#71717a"
          />
          <KPICard
            label="งบประมาณรวม"
            value={data.totalBudget > 0 ? `${(data.totalBudget / 1000000).toFixed(2)}M` : '-'}
            color="#00d4ff"
            subtext="บาท"
          />
        </div>

        {/* Monthly Progress Chart */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
            📅 ติดตามความก้าวหน้ารายเดือน — Plan vs Actual
          </h3>
          <div style={{ height: 300 }}>
            <MonthlyProgressChart monthlyProgress={data.monthlyProgress || []} />
          </div>
          {/* Monthly summary row */}
          <div className="grid grid-cols-12 gap-1 mt-4">
            {(data.monthlyProgress || []).map((mp, idx) => {
              const currentMonthIdx = new Date().getMonth();
              const isPast = idx < currentMonthIdx;
              const isCurrent = idx === currentMonthIdx;
              return (
                <div
                  key={mp.month}
                  className={`text-center p-1.5 rounded-lg text-[10px] ${
                    isCurrent ? 'bg-amber-900/30 border border-amber-600/50' :
                    isPast ? 'bg-zinc-800/50' : 'bg-zinc-900/30'
                  }`}
                >
                  <div className={`font-semibold ${isCurrent ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {mp.label}
                  </div>
                  <div className={`text-lg font-bold ${
                    mp.pctComplete >= 100 ? 'text-green-400' :
                    mp.pctComplete > 0 ? 'text-amber-400' :
                    isPast ? 'text-red-400' : 'text-zinc-600'
                  }`}>
                    {mp.planned > 0 ? `${mp.pctComplete}%` : '-'}
                  </div>
                  <div className="text-zinc-500">
                    {mp.completed}/{mp.planned}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
              Ranking % สำเร็จ รายบริษัท
            </h3>
            <div style={{ height: 420 }}>
              <RankingChart companies={data.companies} />
            </div>
          </div>
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
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
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
            สรุปรายบริษัท
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-muted font-semibold">บริษัท</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">ทั้งหมด</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">เสร็จ</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">ยังไม่เริ่ม</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">เลื่อน</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">ยกเลิก</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">N/A</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">% สำเร็จ</th>
                  <th className="text-right py-3 px-3 text-muted font-semibold">งบประมาณ</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {[...data.companies]
                  .sort((a, b) => b.pctDone - a.pctDone)
                  .map((c) => (
                    <tr key={c.companyId} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-white">{c.companyName}</td>
                      <td className="text-center py-3 px-3">{c.total || '-'}</td>
                      <td className="text-center py-3 px-3 text-green-400">{c.done || '-'}</td>
                      <td className="text-center py-3 px-3 text-orange-400">{c.notStarted || '-'}</td>
                      <td className="text-center py-3 px-3 text-blue-400">{c.postponed || '-'}</td>
                      <td className="text-center py-3 px-3 text-red-400">{c.cancelled || '-'}</td>
                      <td className="text-center py-3 px-3 text-zinc-400">{c.notApplicable || '-'}</td>
                      <td className="text-center py-3 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${Math.min(c.pctDone * 2, 100)}%`,
                                backgroundColor: c.pctDone >= 25 ? '#4ade80' : '#fb923c',
                              }}
                            />
                          </div>
                          <span className={c.pctDone >= 25 ? 'text-green-400' : 'text-orange-400'}>
                            {c.pctDone}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-3 text-zinc-300">
                        {c.budget > 0 ? c.budget.toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-3">
                        {c.total > 0 ? (
                          <Link
                            href={`/company/${c.companyId}`}
                            className="text-xs text-accent hover:underline"
                          >
                            ดูรายละเอียด →
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-600">ยังไม่เชื่อม</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
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
