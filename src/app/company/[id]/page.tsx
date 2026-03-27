'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import { MonthlyProgressChart } from '@/components/Charts';
import { Activity, CompanySummary } from '@/lib/types';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export default function CompanyDrilldown() {
  const params = useParams();
  const companyId = params.id as string;
  const [planType, setPlanType] = useState<'safety' | 'environment'>('environment');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/company?id=${companyId}&plan=${planType}`)
      .then(res => res.json())
      .then(data => {
        setActivities(data.activities || []);
        setSummary(data.summary || null);
        setLoading(false);
      })
      .catch(() => {
        setActivities([]);
        setSummary(null);
        setLoading(false);
      });
  }, [companyId, planType]);

  const companyName = summary?.companyName || companyId.toUpperCase();
  const currentMonthIdx = new Date().getMonth();

  // Filter activities by status
  const filteredActivities = statusFilter === 'all'
    ? activities
    : activities.filter(a => a.status === statusFilter);

  // Count statuses
  const statusCounts = {
    all: activities.length,
    done: activities.filter(a => a.status === 'done').length,
    not_started: activities.filter(a => a.status === 'not_started').length,
    postponed: activities.filter(a => a.status === 'postponed').length,
    cancelled: activities.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <Link href="/" className="hover:text-white">Home</Link>
          <span>/</span>
          <Link href="/" className="hover:text-white">แผนงานประจำปี</Link>
          <span>/</span>
          <span className="text-white">{companyName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">
            🔍 {companyName} — แผนงาน{planType === 'safety' ? 'ความปลอดภัย' : 'สิ่งแวดล้อม'} 2026
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setPlanType('safety')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'safety' ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🛡️ Safety
            </button>
            <button
              onClick={() => setPlanType('environment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'environment' ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🌿 Environment
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
              <p className="text-muted">กำลังโหลดข้อมูลจาก Google Sheets...</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <KPICard label="กิจกรรมทั้งหมด" value={summary?.total || 0} />
              <KPICard label="เสร็จแล้ว" value={summary?.done || 0} color="#4ade80" progress={summary?.pctDone || 0} delta={`${summary?.pctDone || 0}%`} />
              <KPICard label="ยังไม่เริ่ม" value={summary?.notStarted || 0} color="#fb923c" />
              <KPICard label="เลื่อน" value={summary?.postponed || 0} color="#60a5fa" />
              <KPICard label="ยกเลิก" value={summary?.cancelled || 0} color="#f87171" />
              <KPICard label="งบประมาณ" value={summary?.budget ? summary.budget.toLocaleString() : '-'} color="#00d4ff" subtext="บาท" />
            </div>

            {/* Monthly Progress */}
            {summary?.monthlyProgress && summary.monthlyProgress.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 mb-6">
                <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
                  📅 ติดตามความก้าวหน้ารายเดือน
                </h3>
                <div style={{ height: 250 }}>
                  <MonthlyProgressChart monthlyProgress={summary.monthlyProgress} />
                </div>
                {/* Monthly mini cards */}
                <div className="grid grid-cols-12 gap-1 mt-4">
                  {summary.monthlyProgress.map((mp, idx) => {
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
                        <div className={`text-sm font-bold ${
                          mp.pctComplete >= 100 ? 'text-green-400' :
                          mp.pctComplete > 0 ? 'text-amber-400' :
                          isPast ? 'text-red-400' : 'text-zinc-600'
                        }`}>
                          {mp.planned > 0 ? `${mp.pctComplete}%` : '-'}
                        </div>
                        <div className="text-zinc-500">{mp.completed}/{mp.planned}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'all', label: 'ทั้งหมด', color: 'text-white' },
                { key: 'done', label: '✅ เสร็จแล้ว', color: 'text-green-400' },
                { key: 'not_started', label: '⏳ ยังไม่เริ่ม', color: 'text-orange-400' },
                { key: 'postponed', label: '📅 เลื่อน', color: 'text-blue-400' },
                { key: 'cancelled', label: '❌ ยกเลิก', color: 'text-red-400' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.key
                      ? 'bg-zinc-700 text-white'
                      : 'bg-card border border-border text-muted hover:text-white'
                  }`}
                >
                  <span className={statusFilter === f.key ? '' : f.color}>
                    {f.label}
                  </span>
                  <span className="ml-1.5 text-zinc-500">
                    ({statusCounts[f.key as keyof typeof statusCounts]})
                  </span>
                </button>
              ))}
            </div>

            {/* Activity Table */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
                รายละเอียดกิจกรรม ({filteredActivities.length} รายการ)
              </h3>
              {filteredActivities.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs">ลำดับ</th>
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs min-w-[250px]">กิจกรรม</th>
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs">ผู้รับผิดชอบ</th>
                        {MONTH_LABELS.map((m, idx) => (
                          <th
                            key={m}
                            className={`text-center py-3 px-1 font-semibold text-[10px] ${
                              idx === currentMonthIdx ? 'text-amber-400 bg-amber-900/20' : 'text-muted'
                            }`}
                          >
                            {m}
                          </th>
                        ))}
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs">เป้าหมาย</th>
                        <th className="text-center py-3 px-2 text-muted font-semibold text-xs">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((act, i) => (
                        <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-2 text-muted text-xs">{act.no}</td>
                          <td className="py-2.5 px-2 text-white text-xs">{act.activity}</td>
                          <td className="py-2.5 px-2 text-zinc-400 text-xs">{act.responsible}</td>
                          {MONTH_KEYS.map((k, idx) => {
                            const planMark = act.planMonths?.[k] || '';
                            const actualMark = act.actualMonths?.[k] || '';
                            const hasplan = planMark !== '' && !planMark.includes('เมื่อ');
                            const hasActual = actualMark !== '';
                            const isCurrent = idx === currentMonthIdx;

                            return (
                              <td
                                key={k}
                                className={`text-center py-2.5 px-1 ${isCurrent ? 'bg-amber-900/10' : ''}`}
                              >
                                {hasActual ? (
                                  <span className="text-green-400 text-sm" title={`Plan: ${planMark} | Actual: ${actualMark}`}>●</span>
                                ) : hasplan ? (
                                  <span className={`text-sm ${idx <= currentMonthIdx ? 'text-red-400' : 'text-zinc-500'}`} title={`Plan: ${planMark}`}>○</span>
                                ) : (
                                  <span className="text-zinc-800 text-sm">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-2 text-xs text-zinc-400 max-w-[120px] truncate" title={act.target}>{act.target}</td>
                          <td className="py-2.5 px-2 text-center">
                            <StatusBadge status={act.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted">
                  <p className="text-4xl mb-3">📌</p>
                  <p>ไม่พบกิจกรรม{statusFilter !== 'all' ? 'ในสถานะที่เลือก' : ''}</p>
                  <p className="text-xs mt-1">ลองเปลี่ยน Filter หรือเลือก Plan Type อื่น</p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 bg-card border border-border rounded-lg">
              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <span><span className="text-green-400">●</span> ดำเนินการแล้ว (Actual)</span>
                <span><span className="text-red-400">○</span> มีแผนแต่ยังไม่ดำเนินการ (เกินกำหนด)</span>
                <span><span className="text-zinc-500">○</span> มีแผน (ยังไม่ถึงกำหนด)</span>
                <span><span className="text-zinc-800">-</span> ไม่มีแผนในเดือนนี้</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
