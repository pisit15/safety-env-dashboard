'use client';

import { useState, useEffect, useMemo } from 'react';
import { Shield, Leaf, BarChart3, Calendar, Key, LogOut, AlertTriangle, ChevronUp, ChevronDown, RotateCcw, Info } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { RankingChart, StatusPieChart, BudgetChart, MonthlyProgressChart } from '@/components/Charts';
import { DashboardData } from '@/lib/types';
import { useAuth } from '@/components/AuthContext';
import { AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from '@/lib/companies';
import Link from 'next/link';

export default function HQOverview() {
  const auth = useAuth();

  // Admin login form state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAdminLogin = async () => {
    setAdminError('');
    setAdminLoading(true);
    const result = await auth.adminLogin(adminUser, adminPass);
    if (!result.success) {
      setAdminError(result.error || 'รหัสผ่านไม่ถูกต้อง');
    } else {
      setAdminUser('');
      setAdminPass('');
    }
    setAdminLoading(false);
  };
  const [planType, setPlanType] = useState<'environment' | 'safety' | 'total'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hq_planType');
      if (saved === 'safety' || saved === 'environment' || saved === 'total') return saved;
    }
    return 'total';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_year');
      if (saved) return parseInt(saved, 10);
    }
    return DEFAULT_YEAR;
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Time range: 'year' = full year, 'ytd' = up to current month, 'jan'...'dec' = specific month
  const [timeRange, setTimeRange] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hq_timeRange') || 'year';
    }
    return 'year';
  });

  // Wave 1.4: Table sort state
  const [sortCol, setSortCol] = useState<'pctDone' | 'total' | 'done' | 'notStarted' | 'postponed' | 'budget'>('pctDone');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Wave 2.7: Alert filtering state
  const [tableFilter, setTableFilter] = useState<'all' | 'lowPct' | 'highNotStarted' | 'highPostponed' | 'highBudget'>('all');

  // Wave 3.11: Monthly chart toggle
  const [monthlyChartMode, setMonthlyChartMode] = useState<'hq' | 'top5'>('hq');

  // Persist planType, timeRange, and selectedYear to localStorage
  useEffect(() => {
    localStorage.setItem('hq_planType', planType);
  }, [planType]);
  useEffect(() => {
    localStorage.setItem('hq_timeRange', timeRange);
  }, [timeRange]);
  useEffect(() => {
    localStorage.setItem('dashboard_year', String(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    if (planType === 'total') {
      // Fetch both safety and environment, merge
      Promise.all([
        fetch(`/api/dashboard?plan=safety&year=${selectedYear}`).then(r => r.json()),
        fetch(`/api/dashboard?plan=environment&year=${selectedYear}`).then(r => r.json()),
      ]).then(([s, e]: [DashboardData, DashboardData]) => {
        // Merge companies — combine same company's data, keep safety/envi budgets separate
        const companyMap = new Map<string, any>();
        // First pass: safety companies
        s.companies.forEach(c => {
          companyMap.set(c.companyId, { ...c, notApplicable: c.notApplicable || 0, safetyBudget: c.budget, enviBudget: 0 });
        });
        // Second pass: envi companies — merge into existing or create new
        e.companies.forEach(c => {
          const existing = companyMap.get(c.companyId);
          if (existing) {
            existing.total += c.total;
            existing.done += c.done;
            existing.notStarted += c.notStarted;
            existing.postponed += c.postponed;
            existing.cancelled += c.cancelled;
            existing.notApplicable += (c.notApplicable || 0);
            existing.budget += c.budget;
            existing.enviBudget = c.budget;
            existing.pctDone = existing.total > 0 ? Math.round(((existing.done + existing.notApplicable) / existing.total) * 1000) / 10 : 0;
          } else {
            companyMap.set(c.companyId, { ...c, notApplicable: c.notApplicable || 0, safetyBudget: 0, enviBudget: c.budget });
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
        const totalNA = mergedCompanies.reduce((sum: number, c: any) => sum + (c.notApplicable || 0), 0);
        setData({
          companies: mergedCompanies,
          totalActivities: totalActs,
          totalDone,
          totalNotStarted: mergedCompanies.reduce((sum: number, c: any) => sum + c.notStarted, 0),
          totalPostponed: mergedCompanies.reduce((sum: number, c: any) => sum + c.postponed, 0),
          totalCancelled: mergedCompanies.reduce((sum: number, c: any) => sum + c.cancelled, 0),
          totalNotApplicable: totalNA,
          totalBudget: mergedCompanies.reduce((sum: number, c: any) => sum + c.budget, 0),
          // % = (done + N/A) / total → ยกประโยชน์ให้
          overallPct: totalActs > 0 ? Math.round(((totalDone + totalNA) / totalActs) * 1000) / 10 : 0,
          monthlyProgress,
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      fetch(`/api/dashboard?plan=${planType}&year=${selectedYear}`)
        .then(res => res.json())
        .then((d: DashboardData) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [planType, selectedYear]);

  // ── Compute filtered KPI data based on timeRange ──
  const MONTH_KEYS_ARR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const currentMonthIdx = new Date().getMonth();

  const filtered = useMemo(() => {
    if (!data) return null;
    const mp = data.monthlyProgress || [];
    if (mp.length === 0) return data;

    // Determine which month indices to include
    let indices: number[];
    if (timeRange === 'year') {
      return data; // No filtering
    } else if (timeRange === 'ytd') {
      indices = Array.from({ length: currentMonthIdx + 1 }, (_, i) => i);
    } else {
      // Specific month key like 'jan', 'feb', etc.
      const idx = MONTH_KEYS_ARR.indexOf(timeRange);
      indices = idx >= 0 ? [idx] : [];
    }

    if (indices.length === 0) return data;

    // Sum from monthlyProgress for selected months
    let totalPlanned = 0, totalDone = 0, totalNA = 0, totalCompleted = 0;
    indices.forEach(i => {
      const m = mp[i];
      if (!m) return;
      totalPlanned += m.planned;
      totalDone += (m.doneCount ?? m.completed);
      totalNA += (m.notApplicableCount ?? 0);
      totalCompleted += m.completed;
    });
    const totalNotStartedEtc = totalPlanned - totalCompleted;

    // Recalc per-company from their monthlyProgress
    const filteredCompanies = data.companies.map((c: any) => {
      const cmp = c.monthlyProgress || [];
      let cPlanned = 0, cDone = 0, cNA = 0, cCompleted = 0;
      indices.forEach(i => {
        const m = cmp[i];
        if (!m) return;
        cPlanned += m.planned;
        cDone += (m.doneCount ?? m.completed);
        cNA += (m.notApplicableCount ?? 0);
        cCompleted += m.completed;
      });
      const cNotStarted = Math.max(0, cPlanned - cCompleted);
      const pctDone = cPlanned > 0 ? Math.round(((cDone + cNA) / cPlanned) * 1000) / 10 : 0;
      return {
        ...c,
        total: cPlanned,
        done: cDone,
        notApplicable: cNA,
        notStarted: cNotStarted,
        postponed: 0, // Not tracked per-month granularly
        cancelled: 0,
        pctDone,
      };
    });

    const overallPct = totalPlanned > 0 ? Math.round(((totalDone + totalNA) / totalPlanned) * 1000) / 10 : 0;

    return {
      ...data,
      companies: filteredCompanies,
      totalActivities: totalPlanned,
      totalDone,
      totalNotApplicable: totalNA,
      totalNotStarted: Math.max(0, totalPlanned - totalCompleted),
      totalPostponed: 0,
      totalCancelled: 0,
      overallPct,
    };
  }, [data, timeRange, currentMonthIdx]);

  // Wave 2.7: Compute alert data and table filtering
  const alertData = useMemo(() => {
    if (!filtered || !filtered.companies || filtered.companies.length === 0) {
      return { lowPctCompany: null, highNotStartedCompany: null, highPostponedCompany: null, highBudgetCompany: null };
    }

    const companies = filtered.companies;
    
    // 1. Lowest pctDone
    let lowPctCompany = companies[0];
    for (const c of companies) {
      if (c.pctDone < lowPctCompany.pctDone) {
        lowPctCompany = c;
      }
    }
    if (lowPctCompany.pctDone >= 20) {
      lowPctCompany = null;
    }

    // 2. Highest notStarted
    let highNotStartedCompany = companies[0];
    for (const c of companies) {
      if ((c.notStarted || 0) > (highNotStartedCompany.notStarted || 0)) {
        highNotStartedCompany = c;
      }
    }
    if ((highNotStartedCompany.notStarted || 0) === 0) {
      highNotStartedCompany = null;
    }

    // 3. Highest postponed
    let highPostponedCompany = companies[0];
    for (const c of companies) {
      if ((c.postponed || 0) > (highPostponedCompany.postponed || 0)) {
        highPostponedCompany = c;
      }
    }
    if ((highPostponedCompany.postponed || 0) === 0) {
      highPostponedCompany = null;
    }

    // 4. Highest budget
    const medianBudget = companies
      .map(c => c.budget || 0)
      .sort((a, b) => a - b)[Math.floor(companies.length / 2)] || 0;
    let highBudgetCompany = companies[0];
    for (const c of companies) {
      if ((c.budget || 0) > (highBudgetCompany.budget || 0)) {
        highBudgetCompany = c;
      }
    }
    if ((highBudgetCompany.budget || 0) <= medianBudget) {
      highBudgetCompany = null;
    }

    return { lowPctCompany, highNotStartedCompany, highPostponedCompany, highBudgetCompany };
  }, [filtered]);

  const filteredTableCompanies = useMemo(() => {
    if (!filtered || !filtered.companies) return [];
    let companies = [...filtered.companies];

    // Apply table filter
    if (tableFilter === 'lowPct') {
      companies = companies.filter(c => c.pctDone < 20);
    } else if (tableFilter === 'highNotStarted') {
      companies = companies.filter(c => (c.notStarted || 0) > 0);
      companies.sort((a, b) => (b.notStarted || 0) - (a.notStarted || 0));
    } else if (tableFilter === 'highPostponed') {
      companies = companies.filter(c => (c.postponed || 0) > 0);
    } else if (tableFilter === 'highBudget') {
      const medianBudget = filtered.companies
        .map(c => c.budget || 0)
        .sort((a, b) => a - b)[Math.floor(filtered.companies.length / 2)] || 0;
      companies = companies.filter(c => (c.budget || 0) > medianBudget);
    }

    // Apply sorting
    companies.sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      if (typeof aVal === 'string') aVal = parseFloat(aVal);
      if (typeof bVal === 'string') bVal = parseFloat(bVal);
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

    return companies;
  }, [filtered, tableFilter, sortCol, sortDir]);

  // Wave 3.11: Top 5 companies for monthly chart toggle
  const top5Companies = useMemo(() => {
    if (!filtered || !filtered.companies) return [];
    return [...filtered.companies]
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 5);
  }, [filtered]);

  // ── Admin Login Gate ──
  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 w-full max-w-sm text-center" style={{ backdropFilter: 'blur(40px)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)' }}>
              <Key size={24} color="white" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>เข้าสู่ระบบ Admin</h2>
            <p className="text-[13px] mb-5" style={{ color: 'var(--muted)' }}>หน้า HQ Overview สำหรับ Admin เท่านั้น</p>
            <input
              type="text"
              value={adminUser}
              onChange={e => setAdminUser(e.target.value)}
              placeholder="Username"
              className="w-full px-3 py-2.5 rounded-lg text-sm mb-2 focus:outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              autoFocus
            />
            <input
              type="password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Password"
              className="w-full px-3 py-2.5 rounded-lg text-sm mb-3 focus:outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            {adminError && <p style={{ color: 'var(--danger)' }} className="text-xs mb-3">{adminError}</p>}
            <button
              onClick={handleAdminLogin}
              disabled={adminLoading || !adminPass}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium"
            >
              {adminLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </main>
      </div>
    );
  }

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
  const monthFullNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const currentMonth = monthNames[currentMonthIdx];
  const planTypeLabel = planType === 'total' ? 'แผนงานรวม' : planType === 'safety' ? 'แผนงานความปลอดภัย' : 'แผนงานสิ่งแวดล้อม';

  // Helper function: Get time range label
  const getTimeRangeLabel = () => {
    if (timeRange === 'year') return 'ทั้งปี';
    if (timeRange === 'ytd') return `ถึง ${monthNames[currentMonthIdx]} (YTD)`;
    const idx = MONTH_KEYS_ARR.indexOf(timeRange);
    if (idx >= 0) return monthFullNames[idx];
    return 'ไม่ระบุ';
  };

  // Wave 1.1: Check if any filter is non-default
  const isFilterNonDefault = planType !== 'total' || selectedYear !== DEFAULT_YEAR || timeRange !== 'year';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] mb-2">
          <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-70">Home</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>แผนงานประจำปี</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              HQ Overview — {planTypeLabel} {selectedYear}
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--muted)' }}>
              ภาพรวมกลุ่ม — {data.companies.length} บริษัท | ข้อมูล ณ {currentMonth} {selectedYear}
              {loading && <span className="ml-2 animate-pulse" style={{ color: 'var(--accent)' }}>กำลังอัปเดต...</span>}
              <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]" style={{ background: 'rgba(48,209,88,0.15)', color: '#30d158' }}>
                ✓ {auth.adminName}
              </span>
              <button onClick={auth.adminLogout} className="ml-1 inline-flex items-center gap-1 text-[11px] transition-colors" style={{ color: 'var(--muted)' }} title="ออกจากระบบ">
                <LogOut size={11} /> ออก
              </button>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              {AVAILABLE_YEARS.map(y => {
                const isActive = ACTIVE_YEARS.includes(y);
                return (
                <button
                  key={y}
                  onClick={() => isActive && setSelectedYear(y)}
                  disabled={!isActive}
                  className="px-3 py-2 rounded-md text-[12px] font-semibold transition-all duration-200"
                  style={selectedYear === y
                    ? { background: '#ff9500', color: '#fff', boxShadow: '0 2px 8px rgba(255,149,0,0.3)' }
                    : !isActive
                      ? { color: 'var(--border)', cursor: 'not-allowed', opacity: 0.5 }
                      : { color: 'var(--muted)' }}
                  title={!isActive ? `ข้อมูลปี ${y} ยังไม่พร้อม` : ''}
                >
                  {y}
                </button>
                );
              })}
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
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 mb-5 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <Calendar size={14} style={{ color: 'var(--muted)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>ช่วงเวลา:</span>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            {[
              { key: 'year', label: 'ทั้งปี' },
              { key: 'ytd', label: `ถึง ${monthNames[currentMonthIdx]} (YTD)` },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200"
                style={timeRange === opt.key
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(10,132,255,0.3)' }
                  : { color: 'var(--muted)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={MONTH_KEYS_ARR.includes(timeRange) ? timeRange : ''}
            onChange={(e) => e.target.value && setTimeRange(e.target.value)}
            className="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: MONTH_KEYS_ARR.includes(timeRange) ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: MONTH_KEYS_ARR.includes(timeRange) ? '#fff' : 'var(--muted)',
              border: '1px solid var(--border)',
              outline: 'none',
            }}
          >
            <option value="" disabled>เลือกเดือน...</option>
            {monthNames.map((name, i) => (
              <option key={MONTH_KEYS_ARR[i]} value={MONTH_KEYS_ARR[i]}>{name}</option>
            ))}
          </select>
          {timeRange !== 'year' && (
            <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,149,0,0.1)', color: '#ff9500' }}>
              {timeRange === 'ytd' ? `ม.ค. – ${monthNames[currentMonthIdx]}` : monthNames[MONTH_KEYS_ARR.indexOf(timeRange)]} เท่านั้น
            </span>
          )}
        </div>

        {/* Wave 1.1: Filter Summary Bar */}
        <div className="px-4 py-2.5 rounded-lg mb-6 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--muted)' }}>กำลังดู:</span>
            {' '}
            <span className="inline-flex items-center gap-1.5 ml-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(255, 149, 0, 0.2)', color: '#ff9500' }}>
                {planTypeLabel}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(10, 132, 255, 0.2)', color: 'var(--accent)' }}>
                {selectedYear}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(88, 86, 214, 0.2)', color: '#5856d6' }}>
                {getTimeRangeLabel()}
              </span>
            </span>
          </span>
          {isFilterNonDefault && (
            <button
              onClick={() => {
                setPlanType('total');
                setSelectedYear(DEFAULT_YEAR);
                setTimeRange('year');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200"
              style={{ color: 'var(--accent)', background: 'rgba(10, 132, 255, 0.15)' }}
              title="รีเซ็ตตัวกรองทั้งหมด"
            >
              <RotateCcw size={12} /> รีเซ็ต
            </button>
          )}
        </div>

        {/* Wave 1.2: KPI Cards — Tier 1 (larger) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5 animate-fade-in-up" style={{ animationDelay: '0.1s', alignItems: 'stretch' }}>
          {/* Total */}
          <KPICard
            label="กิจกรรมทั้งหมด"
            value={filtered!.totalActivities}
          />

          {/* Completed with progress */}
          <div style={{ display: 'flex' }}>
            <KPICard
              label="เสร็จแล้ว"
              value={filtered!.totalDone}
              color="#30d158"
              progress={filtered!.totalActivities > 0 ? (filtered!.totalDone / filtered!.totalActivities * 100) : 0}
            />
          </div>

          {/* Overall % (done + NA) / total */}
          <div style={{ display: 'flex' }}>
            <KPICard
              label="% ปิดงาน"
              value={`${filtered!.overallPct}%`}
              color="#30d158"
              subtext={`รวม ${filtered!.totalNotApplicable || 0} รายการ N/A`}
            />
          </div>

          {/* Not Started */}
          <div style={{ display: 'flex' }}>
            <KPICard
              label="ยังไม่เริ่ม"
              value={filtered!.totalNotStarted}
              color="#ff9f0a"
            />
          </div>
        </div>

        {/* Wave 1.2: KPI Cards — Tier 2 (smaller) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.15s', alignItems: 'stretch' }}>
          {/* Postponed */}
          <KPICard
            label="เลื่อน"
            value={filtered!.totalPostponed}
            color="#5ac8fa"
          />

          {/* Cancelled */}
          <KPICard
            label="ยกเลิก"
            value={filtered!.totalCancelled}
            color="#ff453a"
          />

          {/* Not Applicable */}
          <KPICard
            label="ไม่เข้าเงื่อนไข"
            value={filtered!.totalNotApplicable || 0}
            color="#8e8e93"
          />

          {/* Actual % (done only, NOT including NA) */}
          <div style={{ display: 'flex' }}>
            <KPICard
              label="% ทำเสร็จจริง"
              value={filtered!.totalActivities > 0 ? `${Math.round((filtered!.totalDone / filtered!.totalActivities) * 1000) / 10}%` : '-'}
              color="#5ac8fa"
              subtext="ไม่รวม N/A"
            />
          </div>

          {/* Budget */}
          <div style={{ display: 'flex' }}>
            <KPICard
              label="งบประมาณรวม"
              value={data.totalBudget > 0 ? `${(data.totalBudget / 1000000).toFixed(2)}M` : '-'}
              color="#5ac8fa"
              subtext="บาท"
            />
          </div>
        </div>

        {/* Monthly Progress Chart with Wave 3.11 toggle */}
        <div className="glass-card p-6 mb-6 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              ติดตามความก้าวหน้ารายเดือน — Plan vs Actual
            </h3>
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setMonthlyChartMode('hq')}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200"
                style={monthlyChartMode === 'hq'
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(10,132,255,0.3)' }
                  : { color: 'var(--muted)' }}
              >
                HQ รวม
              </button>
              <button
                onClick={() => setMonthlyChartMode('top5')}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200"
                style={monthlyChartMode === 'top5'
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(10,132,255,0.3)' }
                  : { color: 'var(--muted)' }}
              >
                Top 5 บริษัท
              </button>
            </div>
          </div>

          {monthlyChartMode === 'hq' ? (
            <>
              <div style={{ height: 300 }}>
                <MonthlyProgressChart monthlyProgress={data.monthlyProgress || []} />
              </div>
              {/* Monthly summary row */}
              <div className="grid grid-cols-12 gap-1.5 mt-5">
                {(data.monthlyProgress || []).map((mp, idx) => {
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
            </>
          ) : (
            /* Top 5 heatmap grid */
            <div>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  {/* Header row with months */}
                  <div className="flex">
                    <div className="w-24 px-2 py-2 text-[11px] font-semibold text-right" style={{ color: 'var(--text-secondary)' }}>บริษัท</div>
                    {monthNames.map((name, i) => (
                      <div key={i} className="w-8 text-center px-1 py-2 text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                        {name}
                      </div>
                    ))}
                  </div>

                  {/* Data rows */}
                  {top5Companies.map((company) => (
                    <div key={company.companyId} className="flex">
                      <div className="w-24 px-2 py-2 text-[10px] font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                        {company.shortName || company.companyName}
                      </div>
                      {monthNames.map((_, i) => {
                        const mp = (company.monthlyProgress || [])[i];
                        const pct = mp ? mp.pctComplete : 0;
                        let bgColor = '#f5f5f5';
                        if (mp && mp.planned > 0) {
                          bgColor = pct >= 80 ? '#34c759' : pct >= 40 ? '#ff9500' : '#ff453a';
                        }
                        return (
                          <div
                            key={i}
                            className="w-8 px-1 py-2 text-center text-[9px] font-semibold"
                            style={{
                              background: bgColor,
                              color: pct >= 80 || pct < 40 ? '#fff' : '#000',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {mp && mp.planned > 0 ? `${pct}%` : '-'}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <div className="lg:col-span-3 glass-card p-6">
            <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              Ranking % สำเร็จ รายบริษัท
            </h3>
            <div style={{ height: 420 }}>
              <RankingChart companies={filtered!.companies} />
            </div>
          </div>
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: '#34c759' }}></span>
              สัดส่วนสถานะกิจกรรม
            </h3>
            <div style={{ height: 320 }}>
              <StatusPieChart
                done={filtered!.totalDone}
                notStarted={filtered!.totalNotStarted}
                postponed={filtered!.totalPostponed}
                cancelled={filtered!.totalCancelled}
                notApplicable={filtered!.totalNotApplicable || 0}
              />
            </div>
          </div>
        </div>

        {/* Wave 2.7: Alert Section "ต้องติดตาม" */}
        {(alertData.lowPctCompany || alertData.highNotStartedCompany || alertData.highPostponedCompany || alertData.highBudgetCompany) && (
          <div className="mb-6">
            <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <AlertTriangle size={14} style={{ color: '#ff453a' }} />
              ต้องติดตาม
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {alertData.lowPctCompany && (
                <button
                  onClick={() => setTableFilter(tableFilter === 'lowPct' ? 'all' : 'lowPct')}
                  className="p-3.5 rounded-lg text-left transition-all duration-200"
                  style={{
                    background: tableFilter === 'lowPct' ? 'rgba(255, 59, 48, 0.15)' : 'var(--bg-tertiary)',
                    border: '1px solid ' + (tableFilter === 'lowPct' ? '#ff3b30' : 'var(--border)'),
                  }}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: '#ff3b30' }}>
                    <span>🔴</span> % สำเร็จต่ำสุด
                  </div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {alertData.lowPctCompany.companyName}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {alertData.lowPctCompany.pctDone}%
                  </div>
                </button>
              )}

              {alertData.highNotStartedCompany && (
                <button
                  onClick={() => setTableFilter(tableFilter === 'highNotStarted' ? 'all' : 'highNotStarted')}
                  className="p-3.5 rounded-lg text-left transition-all duration-200"
                  style={{
                    background: tableFilter === 'highNotStarted' ? 'rgba(255, 159, 10, 0.15)' : 'var(--bg-tertiary)',
                    border: '1px solid ' + (tableFilter === 'highNotStarted' ? '#ff9f0a' : 'var(--border)'),
                  }}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: '#ff9f0a' }}>
                    <span>🟠</span> ยังไม่เริ่มมากสุด
                  </div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {alertData.highNotStartedCompany.companyName}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {alertData.highNotStartedCompany.notStarted} รายการ
                  </div>
                </button>
              )}

              {alertData.highPostponedCompany && (
                <button
                  onClick={() => setTableFilter(tableFilter === 'highPostponed' ? 'all' : 'highPostponed')}
                  className="p-3.5 rounded-lg text-left transition-all duration-200"
                  style={{
                    background: tableFilter === 'highPostponed' ? 'rgba(90, 200, 250, 0.15)' : 'var(--bg-tertiary)',
                    border: '1px solid ' + (tableFilter === 'highPostponed' ? '#5ac8fa' : 'var(--border)'),
                  }}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: '#5ac8fa' }}>
                    <span>🔵</span> เลื่อนมากสุด
                  </div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {alertData.highPostponedCompany.companyName}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {alertData.highPostponedCompany.postponed} รายการ
                  </div>
                </button>
              )}

              {alertData.highBudgetCompany && (
                <button
                  onClick={() => setTableFilter(tableFilter === 'highBudget' ? 'all' : 'highBudget')}
                  className="p-3.5 rounded-lg text-left transition-all duration-200"
                  style={{
                    background: tableFilter === 'highBudget' ? 'rgba(255, 214, 10, 0.15)' : 'var(--bg-tertiary)',
                    border: '1px solid ' + (tableFilter === 'highBudget' ? '#ffd60a' : 'var(--border)'),
                  }}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: '#ffd60a' }}>
                    <span>💰</span> งบสูงสุด
                  </div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {alertData.highBudgetCompany.companyName}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {(alertData.highBudgetCompany.budget / 1000000).toFixed(2)}M บาท
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Company Table with Wave 1.4 sorting and Wave 1.5 badges */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-0.5 h-4 rounded-full" style={{ background: '#5ac8fa' }}></span>
              สรุปรายบริษัท
              {tableFilter !== 'all' && (
                <span className="ml-2 px-2 py-0.5 rounded-md text-[11px]" style={{ background: 'rgba(10, 132, 255, 0.2)', color: 'var(--accent)' }}>
                  {tableFilter === 'lowPct' ? 'ต่ำสุด' : tableFilter === 'highNotStarted' ? 'ยังไม่เริ่ม' : tableFilter === 'highPostponed' ? 'เลื่อน' : 'งบสูง'}
                </span>
              )}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="apple-table">
              <thead>
                <tr>
                  <th>บริษัท</th>
                  <th
                    className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'total') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('total');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      ทั้งหมด
                      {sortCol === 'total' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th
                    className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'done') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('done');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      เสร็จ
                      {sortCol === 'done' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th
                    className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'notStarted') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('notStarted');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      ยังไม่เริ่ม
                      {sortCol === 'notStarted' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th
                    className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'postponed') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('postponed');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      เลื่อน
                      {sortCol === 'postponed' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th className="text-center">ยกเลิก</th>
                  <th className="text-center">N/A</th>
                  <th
                    className="text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'pctDone') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('pctDone');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      % สำเร็จ
                      {sortCol === 'pctDone' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th
                    className="text-right cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      if (sortCol === 'budget') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortCol('budget');
                        setSortDir('desc');
                      }
                    }}
                  >
                    <span className="flex items-center justify-end gap-1">
                      งบประมาณ
                      {sortCol === 'budget' && (
                        sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                      )}
                    </span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTableCompanies.map((c, idx) => {
                  // Wave 1.5: Compute badges
                  const highNotStartedRatio = c.total > 0 ? c.notStarted / c.total : 0;
                  const highNARatio = c.total > 0 ? c.notApplicable / c.total : 0;

                  // Wave 2.9: Row highlights
                  let rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)';
                  if (c.pctDone < 10) {
                    rowBg = 'rgba(255, 59, 48, 0.08)';
                  } else if (highNotStartedRatio > 0.5) {
                    rowBg = 'rgba(255, 159, 10, 0.08)';
                  }

                  // Wave 2.10: Compute real done only %
                  const doneOnlyPct = c.total > 0 ? Math.round((c.done / c.total) * 1000) / 10 : 0;

                  return (
                    <tr key={c.companyId} style={{ background: rowBg }}>
                      <td className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        {c.companyName}
                        {highNotStartedRatio > 0.5 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#ff9f0a', color: '#fff' }}>
                            ค้างมาก
                          </span>
                        )}
                        {(c.postponed || 0) >= 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#5ac8fa', color: '#fff' }}>
                            เลื่อนเยอะ
                          </span>
                        )}
                        {highNARatio > 0.3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#8e8e93', color: '#fff' }}>
                            N/A สูง
                          </span>
                        )}
                      </td>
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
                                width: `${Math.min(c.pctDone, 100)}%`,
                                backgroundColor: c.pctDone >= 25 ? '#34c759' : '#ff9500',
                              }}
                            />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[13px] font-semibold" style={{ color: c.pctDone >= 25 ? '#34c759' : '#ff9500' }}>
                              {c.pctDone}%
                            </span>
                            <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                              จริง {doneOnlyPct}%
                            </span>
                          </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget Chart with Wave 3.12 note */}
        <div className="glass-card p-6">
          <h3 className="text-[13px] font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-0.5 h-4 rounded-full" style={{ background: '#ffd60a' }}></span>
            งบประมาณรายบริษัท (บาท)
            {planType === 'total' && (
              <span className="ml-2 text-[11px] font-normal inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <Info size={11} /> แยก Safety (🟠) และ Environment (🟢)
              </span>
            )}
            <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-tertiary)' }}>* ไม่รวมงบประมาณอบรม</span>
          </h3>
          <div style={{ height: 400 }}>
            <BudgetChart companies={data.companies} />
          </div>
        </div>
      </main>
    </div>
  );
}
