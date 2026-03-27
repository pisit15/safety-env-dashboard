'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { RankingChart, StatusPieChart, BudgetChart } from '@/components/Charts';
import { getDemoDashboard } from '@/lib/demo-data';
import Link from 'next/link';

export default function HQOverview() {
  const [planType, setPlanType] = useState<'environment' | 'safety'>('environment');
  const data = getDemoDashboard();

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
              ภาพรวมกลุ่ม — 13 บริษัท | ข้อมูล ณ มีนาคม 2026
            </p>
          </div>
          <div className="flex gap-2">
            {/* Tab switcher */}
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KPICard
            label="กิจกรรมทั้งหมด"
            value={data.totalActivities}
          />
          <KPICard
            label="ดำเนินการแล้ว"
            value={data.totalDone}
            color="#4ade80"
            delta={`▲ ${data.overallPct}%`}
            deltaColor="#4ade80"
            progress={data.overallPct}
          />
          <KPICard
            label="กำลังดำเนินการ"
            value={data.totalInProgress}
            color="#fbbf24"
          />
          <KPICard
            label="ยังไม่เริ่ม"
            value={data.totalNotStarted}
            color="#fb923c"
          />
          <KPICard
            label="งบประมาณรวม"
            value={`${(data.totalBudget / 1000000).toFixed(2)}M`}
            color="#00d4ff"
            subtext="บาท"
          />
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
                inProgress={data.totalInProgress}
                notStarted={data.totalNotStarted}
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
                  <th className="text-center py-3 px-3 text-muted font-semibold">กำลังทำ</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">ยังไม่เริ่ม</th>
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
                      <td className="text-center py-3 px-3">{c.total}</td>
                      <td className="text-center py-3 px-3 text-green-400">{c.done}</td>
                      <td className="text-center py-3 px-3 text-yellow-400">{c.inProgress}</td>
                      <td className="text-center py-3 px-3 text-orange-400">{c.notStarted}</td>
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
                        {c.budget.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/company/${c.companyId}`}
                          className="text-xs text-accent hover:underline"
                        >
                          ดูรายละเอียด →
                        </Link>
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
