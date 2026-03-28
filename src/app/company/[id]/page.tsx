'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';

import { MonthlyProgressChart } from '@/components/Charts';
import { Activity, CompanySummary, MonthStatus } from '@/lib/types';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_OPTIONS: { value: MonthStatus; label: string; icon: string; color: string }[] = [
  { value: 'done', label: 'เสร็จแล้ว', icon: '●', color: 'text-green-400' },
  { value: 'overdue', label: 'เกินกำหนด', icon: '○', color: 'text-red-400' },
  { value: 'planned', label: 'มีแผน', icon: '○', color: 'text-zinc-500' },
  { value: 'postponed', label: 'เลื่อน', icon: '◐', color: 'text-blue-400' },
  { value: 'cancelled', label: 'ยกเลิก', icon: '✕', color: 'text-red-400' },
  { value: 'not_applicable', label: 'ไม่เข้าเงื่อนไข', icon: '⊘', color: 'text-zinc-500' },
  { value: 'not_planned', label: 'ไม่มีแผน', icon: '-', color: 'text-zinc-700' },
];

interface StatusOverride {
  activity_no: string;
  month: string;
  status: string;
}

export default function CompanyDrilldown() {
  const params = useParams();
  const companyId = params.id as string;
  const [planType, setPlanType] = useState<'safety' | 'environment'>('environment');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginCompanyName, setLoginCompanyName] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Status update state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{ actNo: string; month: string; actName: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState(false);

  // Check if already logged in from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(`auth_${companyId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setIsLoggedIn(true);
      setLoginCompanyName(parsed.companyName);
    }
  }, [companyId]);

  // Fetch activities
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

  // Fetch status overrides from Supabase
  const fetchOverrides = useCallback(() => {
    fetch(`/api/status?companyId=${companyId}&planType=${planType}`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, string> = {};
        (data.overrides || []).forEach((o: StatusOverride) => {
          map[`${o.activity_no}:${o.month}`] = o.status;
        });
        setOverrides(map);
      })
      .catch(() => {});
  }, [companyId, planType]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const companyName = summary?.companyName || companyId.toUpperCase();
  const currentMonthIdx = new Date().getMonth();

  // Get effective month status (override > auto)
  const getEffectiveStatus = (act: Activity, monthKey: string): MonthStatus => {
    const overrideKey = `${act.no}:${monthKey}`;
    const override = overrides[overrideKey];
    if (override) return override as MonthStatus;
    return act.monthStatuses?.[monthKey] || 'not_planned';
  };

  // Recalculate monthly progress including overrides
  const effectiveMonthlyProgress = useMemo(() => {
    if (!summary?.monthlyProgress || activities.length === 0) return summary?.monthlyProgress || [];
    return MONTH_KEYS.map((k, idx) => {
      const base = summary.monthlyProgress![idx];
      let planned = 0;
      let completed = 0;
      activities.forEach(act => {
        const status = getEffectiveStatus(act, k);
        if (status !== 'not_planned' && status !== 'not_applicable') {
          planned++;
          if (status === 'done') completed++;
        }
      });
      return {
        ...base,
        planned,
        completed,
        pctComplete: planned > 0 ? Math.round((completed / planned) * 100) : 0,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, summary?.monthlyProgress]);

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
    not_applicable: activities.filter(a => a.status === 'not_applicable').length,
  };

  // Login handler
  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setLoginCompanyName(data.companyName);
        sessionStorage.setItem(`auth_${companyId}`, JSON.stringify(data));
        setShowLoginModal(false);
        setLoginPassword('');
      } else {
        setLoginError(data.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setLoginError('เกิดข้อผิดพลาด');
    }
  };

  // Save status override
  const handleSaveStatus = async (newStatus: MonthStatus) => {
    if (!editingCell) return;
    setSavingStatus(true);
    try {
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType,
          activityNo: editingCell.actNo,
          month: editingCell.month,
          status: newStatus,
          updatedBy: loginCompanyName,
        }),
      });
      // Update local state
      setOverrides(prev => ({
        ...prev,
        [`${editingCell.actNo}:${editingCell.month}`]: newStatus,
      }));
      setShowStatusModal(false);
      setEditingCell(null);
    } catch {
      alert('บันทึกไม่สำเร็จ');
    }
    setSavingStatus(false);
  };

  // Revert to auto-detected status
  const handleRevertStatus = async () => {
    if (!editingCell) return;
    setSavingStatus(true);
    try {
      await fetch(`/api/status?companyId=${companyId}&planType=${planType}&activityNo=${editingCell.actNo}&month=${editingCell.month}`, {
        method: 'DELETE',
      });
      setOverrides(prev => {
        const copy = { ...prev };
        delete copy[`${editingCell.actNo}:${editingCell.month}`];
        return copy;
      });
      setShowStatusModal(false);
      setEditingCell(null);
    } catch {
      alert('ลบไม่สำเร็จ');
    }
    setSavingStatus(false);
  };

  // Cell click handler
  const handleCellClick = (actNo: string, month: string, actName: string) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setEditingCell({ actNo, month, actName });
    setShowStatusModal(true);
  };

  // Export handler
  const handleExport = () => {
    window.open(`/api/export?companyId=${companyId}&planType=${planType}`, '_blank');
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
          <div className="flex gap-2 items-center">
            {/* Auth indicator */}
            {isLoggedIn ? (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                ✓ {loginCompanyName}
              </span>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded hover:bg-amber-900/50"
              >
                🔑 เข้าสู่ระบบเพื่อแก้ไข
              </button>
            )}
            {/* Export button */}
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-600 transition-colors"
            >
              📥 Export .xlsx
            </button>
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
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
              <KPICard label="กิจกรรมทั้งหมด" value={summary?.total || 0} />
              <KPICard label="เสร็จแล้ว" value={summary?.done || 0} color="#4ade80" progress={summary?.pctDone || 0} delta={`${summary?.pctDone || 0}%`} />
              <KPICard label="ยังไม่เริ่ม" value={summary?.notStarted || 0} color="#fb923c" />
              <KPICard label="เลื่อน" value={summary?.postponed || 0} color="#60a5fa" />
              <KPICard label="ยกเลิก" value={summary?.cancelled || 0} color="#f87171" />
              <KPICard label="ไม่เข้าเงื่อนไข" value={summary?.notApplicable || 0} color="#71717a" />
              <KPICard label="งบประมาณ" value={summary?.budget ? summary.budget.toLocaleString() : '-'} color="#00d4ff" subtext="บาท" />
            </div>

            {/* Monthly Progress */}
            {effectiveMonthlyProgress && effectiveMonthlyProgress.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 mb-6">
                <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
                  📅 ติดตามความก้าวหน้ารายเดือน
                </h3>
                <div style={{ height: 250 }}>
                  <MonthlyProgressChart monthlyProgress={effectiveMonthlyProgress} />
                </div>
                <div className="grid grid-cols-12 gap-1 mt-4">
                  {effectiveMonthlyProgress.map((mp, idx) => {
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
                { key: 'not_applicable', label: '⊘ ไม่เข้าเงื่อนไข', color: 'text-zinc-400' },
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h3 className="text-sm text-muted border-l-2 border-accent pl-3">
                  รายละเอียดกิจกรรม ({filteredActivities.length} รายการ)
                </h3>
                {/* Legend in header */}
                <div className="flex flex-wrap gap-3 text-[10px] text-muted">
                  <span><span className="text-green-400">●</span> เสร็จแล้ว</span>
                  <span><span className="text-red-400">○</span> เกินกำหนด</span>
                  <span><span className="text-zinc-400">○</span> มีแผน</span>
                  <span><span className="text-blue-400">◐</span> เลื่อน</span>
                  <span><span className="text-red-400">✕</span> ยกเลิก</span>
                  <span><span className="text-zinc-500">⊘</span> ไม่เข้าเงื่อนไข</span>
                  <span><span className="inline-block w-2.5 h-2.5 ring-1 ring-amber-500/50 rounded-sm mr-0.5 align-middle"></span> แก้ไขจาก Dashboard</span>
                </div>
              </div>
              {filteredActivities.length > 0 ? (
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs bg-card">ลำดับ</th>
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs min-w-[250px] bg-card">กิจกรรม</th>
                        <th className="text-left py-3 px-2 text-muted font-semibold text-xs bg-card">ผู้รับผิดชอบ</th>
                        {MONTH_LABELS.map((m, idx) => (
                          <th
                            key={m}
                            className={`text-center py-3 px-1 font-semibold text-[10px] bg-card ${
                              idx === currentMonthIdx ? 'text-amber-400 bg-amber-900/20' : 'text-muted'
                            }`}
                          >
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((act, i) => (
                        <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-2 text-muted text-xs">{act.no}</td>
                          <td className="py-2.5 px-2 text-white text-xs">{act.activity}</td>
                          <td className="py-2.5 px-2 text-zinc-400 text-xs">{act.responsible}</td>
                          {MONTH_KEYS.map((k, idx) => {
                            const effectiveStatus = getEffectiveStatus(act, k);
                            const hasOverride = overrides[`${act.no}:${k}`] !== undefined;
                            const planMark = act.planMonths?.[k] || '';
                            const actualMark = act.actualMonths?.[k] || '';
                            const isCurrent = idx === currentMonthIdx;

                            const statusConfig: Record<MonthStatus, { icon: string; color: string; title: string }> = {
                              not_planned: { icon: '-', color: 'text-zinc-800', title: 'ไม่มีแผน' },
                              planned: { icon: '○', color: 'text-zinc-500', title: `แผน: ${planMark}` },
                              done: { icon: '●', color: 'text-green-400', title: `เสร็จ: ${actualMark}` },
                              overdue: { icon: '○', color: 'text-red-400', title: `เกินกำหนด (แผน: ${planMark})` },
                              postponed: { icon: '◐', color: 'text-blue-400', title: `เลื่อน: ${actualMark}` },
                              cancelled: { icon: '✕', color: 'text-red-400', title: `ยกเลิก: ${actualMark}` },
                              not_applicable: { icon: '⊘', color: 'text-zinc-500', title: 'ไม่เข้าเงื่อนไข' },
                            };
                            const cfg = statusConfig[effectiveStatus];

                            return (
                              <td
                                key={k}
                                className={`text-center py-2.5 px-1 cursor-pointer hover:bg-zinc-700/50 transition-colors ${isCurrent ? 'bg-amber-900/10' : ''} ${hasOverride ? 'ring-1 ring-amber-500/30' : ''}`}
                                onClick={() => handleCellClick(act.no, k, act.activity)}
                              >
                                <span className={`${cfg.color} text-sm`} title={cfg.title}>{cfg.icon}</span>
                              </td>
                            );
                          })}
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
          </>
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLoginModal(false)}>
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-4">🔑 เข้าสู่ระบบ</h3>
              <p className="text-sm text-zinc-400 mb-4">กรอกรหัสผ่านของ <span className="text-white font-semibold">{companyName}</span> เพื่อแก้ไขสถานะ</p>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="รหัสผ่าน"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-accent"
                autoFocus
              />
              {loginError && <p className="text-red-400 text-xs mb-3">{loginError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleLogin}
                  className="flex-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/80"
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Update Modal */}
        {showStatusModal && editingCell && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowStatusModal(false); setEditingCell(null); }}>
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-2">เปลี่ยนสถานะ</h3>
              <p className="text-sm text-zinc-400 mb-1">
                กิจกรรม: <span className="text-white">{editingCell.actNo}</span>
              </p>
              <p className="text-sm text-zinc-400 mb-4">
                เดือน: <span className="text-white">{MONTH_LABELS[MONTH_KEYS.indexOf(editingCell.month)]}</span>
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {STATUS_OPTIONS.map(opt => {
                  const currentStatus = getEffectiveStatus(
                    activities.find(a => a.no === editingCell.actNo)!,
                    editingCell.month
                  );
                  const isActive = currentStatus === opt.value;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSaveStatus(opt.value)}
                      disabled={savingStatus}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-accent/20 border border-accent text-white'
                          : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                      } ${savingStatus ? 'opacity-50' : ''}`}
                    >
                      <span className={`${opt.color} text-lg`}>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Revert button - only show if there's an override */}
              {overrides[`${editingCell.actNo}:${editingCell.month}`] && (
                <button
                  onClick={handleRevertStatus}
                  disabled={savingStatus}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 text-zinc-400 rounded-lg text-xs hover:bg-zinc-700 mb-3"
                >
                  ↩ กลับไปใช้สถานะอัตโนมัติ (จาก Sheet)
                </button>
              )}

              <button
                onClick={() => { setShowStatusModal(false); setEditingCell(null); }}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
