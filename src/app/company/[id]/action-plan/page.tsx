'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';

import { Search, Key, Download, BarChart3, Shield, Leaf, LogOut, Users, DollarSign, Calendar, Trash2, ExternalLink, AlertTriangle, FileText, Paperclip, StickyNote, X, ChevronRight, TrendingUp, TrendingDown, Check, Circle, CircleDot, Clock, Ban, CircleSlash, Minus, CalendarClock, FolderOpen, Folder, CircleAlert, CircleDashed, Wallet, Pencil, ClipboardList, CircleCheckBig, Image, FileSpreadsheet } from 'lucide-react';
import { MonthlyProgressChart, BudgetTrackingChart, MonthlyBudget } from '@/components/Charts';
import { Activity, ActivityStatus, CompanySummary, MonthStatus } from '@/lib/types';
import { YearlyKPISummary, QuarterlyKPI, getKPIScore, getScoreColor, getScoreLabel, QUARTERS } from '@/lib/kpi-calculator';
import { STATUS, PALETTE, CATEGORY_COLORS } from '@/lib/she-theme';
import { useAuth } from '@/components/AuthContext';
import ExportPdfButton from '@/components/ExportPdfButton';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });
import ActivityDrawer from './components/ActivityDrawer';
import { AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from '@/lib/companies';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_ICONS: Record<MonthStatus, typeof Check> = {
  done: Check,
  overdue: CircleAlert,
  planned: Circle,
  postponed: Clock,
  cancelled: Ban,
  not_applicable: CircleSlash,
  not_planned: Minus,
};

const STATUS_OPTIONS: { value: MonthStatus; label: string; Icon: typeof Check; color: string }[] = [
  { value: 'done', label: 'เสร็จแล้ว', Icon: Check, color: STATUS.ok },
  { value: 'overdue', label: 'เกินกำหนด', Icon: CircleAlert, color: STATUS.critical },
  { value: 'planned', label: 'มีแผน', Icon: Circle, color: PALETTE.muted },
  { value: 'postponed', label: 'เลื่อน', Icon: Clock, color: STATUS.warning },
  { value: 'cancelled', label: 'ยกเลิก', Icon: Ban, color: PALETTE.textSecondary },
  { value: 'not_applicable', label: 'ไม่เข้าเงื่อนไข', Icon: CircleSlash, color: PALETTE.muted },
  { value: 'not_planned', label: 'ไม่มีแผน', Icon: Minus, color: PALETTE.border },
];

interface StatusOverride {
  activity_no: string;
  month: string;
  status: string;
  note?: string;
  postponed_to_month?: string;
}

interface ResponsibleOverride {
  activity_no: string;
  responsible: string;
}

export default function CompanyDrilldown() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const [planType, setPlanType] = useState<'safety' | 'environment' | 'total'>(() => {
    // Read ?plan=environment from URL (e.g. from sidebar Environment link)
    if (typeof window !== 'undefined') {
      const urlPlan = new URLSearchParams(window.location.search).get('plan');
      if (urlPlan === 'environment') return 'environment';
      if (urlPlan === 'safety') return 'safety';
    }
    return 'total';
  });
  const [timeRange, setTimeRange] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('company_timeRange') || 'year';
    }
    return 'year';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_year');
      if (saved) return parseInt(saved, 10);
    }
    return DEFAULT_YEAR;
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // KPI quarterly state
  const [kpiData, setKpiData] = useState<YearlyKPISummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [showKpiDetail, setShowKpiDetail] = useState(false);

  // Sync planType from URL search params (for sidebar navigation)
  useEffect(() => {
    const urlPlan = searchParams.get('plan');
    if (urlPlan === 'environment') setPlanType('environment');
    else if (urlPlan === 'safety') setPlanType('safety');
  }, [searchParams]);

  // Persist planType, timeRange, and year to localStorage
  useEffect(() => {
    localStorage.setItem('company_planType', planType);
  }, [planType]);
  useEffect(() => {
    localStorage.setItem('company_timeRange', timeRange);
  }, [timeRange]);
  useEffect(() => {
    localStorage.setItem('dashboard_year', String(selectedYear));
  }, [selectedYear]);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginCompanyName, setLoginCompanyName] = useState('');
  const [loginDisplayName, setLoginDisplayName] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Status update state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{ actNo: string; month: string; actName: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const [postponedOverrides, setPostponedOverrides] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Sort state
  const [sortMonth, setSortMonth] = useState<string>('none');
  const [savingStatus, setSavingStatus] = useState(false);

  // Responsible override state
  const [responsibleOverrides, setResponsibleOverrides] = useState<Record<string, string>>({});
  const [showResponsibleModal, setShowResponsibleModal] = useState(false);
  const [editingResponsible, setEditingResponsible] = useState<{ actNo: string; actName: string; current: string } | null>(null);
  const [newResponsible, setNewResponsible] = useState('');

  // Attachment state
  interface Attachment {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    drive_file_id: string;
    drive_url?: string;
    file_url?: string;
    uploaded_by: string;
    created_at: string;
  }
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkTitle, setExternalLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Attachment count per cell (for indicator dots)
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  // Deadline lock state
  const [deadlineLocked, setDeadlineLocked] = useState(false);
  const [hasApproval, setHasApproval] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);

  // Edit request state (submittingRequest used by handleSubmitEditRequest)
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Phase 4: Cancellation request state
  const [pendingCancellations, setPendingCancellations] = useState<Record<string, string>>({});

  // Budget state
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, { actual_cost: number; note?: string }>>({});
  const [editingActualCost, setEditingActualCost] = useState<string>('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Check if already logged in from sessionStorage or AuthContext
  useEffect(() => {
    const ca = auth.getCompanyAuth(companyId);
    if (ca.isLoggedIn) {
      setIsLoggedIn(true);
      setLoginCompanyName(ca.companyName);
      setLoginDisplayName(ca.displayName);
    } else if (auth.isAdmin) {
      // Admin can view any company
      setIsLoggedIn(true);
      setLoginCompanyName(auth.adminName);
      setLoginDisplayName(auth.adminName);
    } else {
      const saved = sessionStorage.getItem(`auth_${companyId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsLoggedIn(true);
        setLoginCompanyName(parsed.companyName);
        setLoginDisplayName(parsed.displayName || parsed.companyName);
      }
    }
  }, [companyId, auth]);

  // ── Consolidated workspace fetch (replaces 7-10 separate API calls with 1) ──
  const fetchWorkspace = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/action-plan/workspace?companyId=${companyId}&planType=${planType}&year=${selectedYear}`,
        { signal }
      );
      if (signal?.aborted) return;
      const data = await res.json();
      if (signal?.aborted) return;

      // 1. Activities + summary (already merged for total mode on server)
      setActivities(data.activities || []);
      setSummary(data.summary || null);

      // 2. Status overrides → build maps
      const isTotal = planType === 'total';
      const statusMap: Record<string, string> = {};
      const noteMap: Record<string, string> = {};
      const postponedMap: Record<string, string> = {};
      (data.statusOverrides || []).forEach((o: StatusOverride & { plan_type?: string }) => {
        const prefix = isTotal ? `${o.plan_type === 'safety' ? 'S' : 'E'}:` : '';
        if (o.status !== '__noted__') statusMap[`${prefix}${o.activity_no}:${o.month}`] = o.status;
        if (o.note) noteMap[`${prefix}${o.activity_no}:${o.month}`] = o.note;
        if (o.postponed_to_month) postponedMap[`${prefix}${o.activity_no}:${o.month}`] = o.postponed_to_month;
      });
      setOverrides(statusMap);
      setNoteOverrides(noteMap);
      setPostponedOverrides(postponedMap);

      // 3. Responsible overrides → build map
      const respMap: Record<string, string> = {};
      (data.responsibleOverrides || []).forEach((o: ResponsibleOverride & { plan_type?: string }) => {
        const prefix = isTotal ? `${o.plan_type === 'safety' ? 'S' : 'E'}:` : '';
        respMap[`${prefix}${o.activity_no}`] = o.responsible;
      });
      setResponsibleOverrides(respMap);

      // 4. Budget overrides → build map
      const budgetMap: Record<string, { actual_cost: number; note?: string }> = {};
      (data.budgetOverrides || []).forEach((o: { plan_type: string; activity_no: string; actual_cost: number; note?: string }) => {
        const prefix = isTotal ? `${o.plan_type === 'safety' ? 'S' : 'E'}:` : '';
        budgetMap[`${prefix}${o.activity_no}`] = { actual_cost: o.actual_cost || 0, note: o.note || undefined };
      });
      setBudgetOverrides(budgetMap);

      // 5. Attachment counts → build map
      const attMap: Record<string, number> = {};
      (data.attachmentCounts || []).forEach((o: { plan_type: string; activity_no: string; month: string; count: number }) => {
        const prefix = isTotal ? `${o.plan_type === 'safety' ? 'S' : 'E'}:` : '';
        attMap[`${prefix}${o.activity_no}:${o.month}`] = o.count;
      });
      setAttachmentCounts(attMap);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      setActivities([]);
      setSummary(null);
    }
    setLoading(false);
  }, [companyId, planType, selectedYear]);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkspace(controller.signal);
    return () => controller.abort();
  }, [fetchWorkspace]);


  // Save actual cost for an activity
  const handleSaveBudget = async (actNo: string, actualCost: number) => {
    if (!editingCell) return;
    setSavingBudget(true);
    try {
      const effectivePlanType = planType === 'total'
        ? (actNo.startsWith('S:') ? 'safety' : actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const cleanActNo = actNo.replace(/^[SE]:/, '');

      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: effectivePlanType,
          activityNo: cleanActNo,
          year: selectedYear,
          actualCost,
          updatedBy: loginDisplayName || 'admin',
        }),
      });

      // Update local state
      setBudgetOverrides(prev => ({
        ...prev,
        [actNo]: { actual_cost: actualCost },
      }));
    } catch {
      alert('บันทึกไม่สำเร็จ');
    }
    setSavingBudget(false);
  };

  const companyName = summary?.companyName || companyId.toUpperCase();
  const currentMonthIdx = new Date().getMonth();

  // Get effective month status (override > auto)
  // In Total mode, activities have _planTag ('S' or 'E') and overrides use 'S:no:month' / 'E:no:month'
  const getEffectiveStatus = (act: Activity & { _planTag?: string }, monthKey: string): MonthStatus => {
    const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
    const overrideKey = `${prefix}${act.no}:${monthKey}`;
    const override = overrides[overrideKey];
    if (override) return override as MonthStatus;
    const baseStatus = act.monthStatuses?.[monthKey] || 'not_planned';
    // Conditional/trigger-based activities: overdue → planned (not late, just not triggered)
    if (baseStatus === 'overdue' && act.isConditional) return 'planned';
    return baseStatus;
  };

  // Recalculate monthly progress including overrides
  const effectiveMonthlyProgress = useMemo(() => {
    if (!summary?.monthlyProgress || activities.length === 0) return summary?.monthlyProgress || [];
    return MONTH_KEYS.map((k, idx) => {
      const base = summary.monthlyProgress![idx];
      let planned = 0;
      let completed = 0;
      let doneCount = 0;
      let overdueCount = 0;
      let postponedCount = 0;
      let cancelledCount = 0;
      let notApplicableCount = 0;
      activities.forEach(act => {
        const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
        const status = getEffectiveStatus(act, k);

        // Check if this activity was postponed FROM this month to another month
        const overrideKey = `${prefix}${act.no}:${k}`;
        const postponedTo = postponedOverrides[overrideKey];
        if (status === 'postponed' && postponedTo && postponedTo !== k) {
          // This activity moved away from this month — don't count it as planned here
          // It will be counted in the target month instead
          postponedCount++;
          return;
        }

        // Check if any other month has a postponed activity that moves TO this month
        // We need to count those as planned in this month
        const isTargetOfPostpone = MONTH_KEYS.some(fromMonth => {
          if (fromMonth === k) return false;
          const fromKey = `${prefix}${act.no}:${fromMonth}`;
          return postponedOverrides[fromKey] === k &&
            (overrides[fromKey] === 'postponed' || overrides[fromKey] === 'done');
        });

        if (isTargetOfPostpone) {
          planned++;
          // Check the status at the target — if done at target month, count as completed
          const fromEntry = MONTH_KEYS.find(fromMonth => {
            const fromKey = `${prefix}${act.no}:${fromMonth}`;
            return postponedOverrides[fromKey] === k &&
              (overrides[fromKey] === 'postponed' || overrides[fromKey] === 'done');
          });
          if (fromEntry) {
            const fromKey = `${prefix}${act.no}:${fromEntry}`;
            if (overrides[fromKey] === 'done') {
              completed++;
              doneCount++;
            }
          }
        }

        // KPI Logic: cancelled and not_applicable are excluded from denominator
        if (status === 'not_applicable') {
          notApplicableCount++;
          planned++; // count in total but excluded from KPI denominator
        } else if (status === 'cancelled') {
          cancelledCount++;
          planned++; // count in total but excluded from KPI denominator
        } else if (status !== 'not_planned') {
          // Normal status — but skip if this is a postponed activity already handled
          if (!(status === 'postponed' && postponedTo)) {
            planned++;
            if (status === 'done') { completed++; doneCount++; }
            else if (status === 'overdue') { overdueCount++; }
            else if (status === 'postponed') { postponedCount++; }
          }
        }
      });
      // KPI formula: denominator = total - cancelled - not_applicable
      const denominator = planned - cancelledCount - notApplicableCount;
      return {
        ...base,
        planned,
        completed,
        pctComplete: denominator > 0 ? Math.round((doneCount / denominator) * 100) : 0,
        doneCount,
        overdueCount,
        postponedCount,
        cancelledCount,
        notApplicableCount,
        denominator,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, postponedOverrides, summary?.monthlyProgress]);

  // ── Derive KPI quarterly from effectiveMonthlyProgress (same data as chart) ──
  useEffect(() => {
    if (!effectiveMonthlyProgress || effectiveMonthlyProgress.length === 0) {
      setKpiData(null);
      return;
    }
    const MK = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const cmIdx = new Date().getMonth();

    const quarters: QuarterlyKPI[] = QUARTERS.map(q => {
      const firstIdx = MK.indexOf(q.months[0]);
      const isFutureQuarter = firstIdx > cmIdx;

      let totalItems = 0, doneCount = 0, overdueCount = 0, postponedCount = 0;
      let cancelledCount = 0, notApplicableCount = 0, plannedCount = 0;

      q.months.forEach(mk => {
        const mp = effectiveMonthlyProgress[MK.indexOf(mk)];
        if (!mp) return;
        totalItems += mp.planned || 0;
        doneCount += mp.doneCount ?? 0;
        overdueCount += mp.overdueCount ?? 0;
        postponedCount += mp.postponedCount ?? 0;
        cancelledCount += mp.cancelledCount ?? 0;
        notApplicableCount += mp.notApplicableCount ?? 0;
      });

      const denominator = totalItems - cancelledCount - notApplicableCount;
      const numerator = doneCount;
      const isEmptyBase = denominator === 0;
      const percentage = isEmptyBase
        ? (totalItems === 0 ? 0 : 100)
        : Math.round((numerator / denominator) * 1000) / 10;
      const score = getKPIScore(percentage);
      plannedCount = totalItems - doneCount - overdueCount - postponedCount - cancelledCount - notApplicableCount;
      if (plannedCount < 0) plannedCount = 0;

      return {
        quarter: q.key as QuarterlyKPI['quarter'],
        label: q.label, months: [...q.months],
        totalItems, doneCount, overdueCount, postponedCount,
        cancelledCount, notApplicableCount, plannedCount,
        numerator, denominator, percentage, score,
        scoreLabel: getScoreLabel(score), scoreColor: getScoreColor(score),
        isEmptyBase, isFutureQuarter, postponedFromOther: 0,
        highCancelledRate: totalItems > 0 && (cancelledCount / totalItems) > 0.2,
        highPostponedRate: denominator > 0 && (postponedCount / denominator) > 0.3,
        consecutiveLow: false,
      } as QuarterlyKPI;
    });

    const activeQ = quarters.filter(q => !q.isFutureQuarter && q.totalItems > 0);
    const yearlyAvgPct = activeQ.length > 0
      ? Math.round(activeQ.reduce((s, q) => s + q.percentage, 0) / activeQ.length * 10) / 10 : 0;
    const yearlyAvgScore = activeQ.length > 0
      ? Math.round(activeQ.reduce((s, q) => s + q.score, 0) / activeQ.length * 10) / 10 : 0;

    setKpiData({
      year: selectedYear, companyId: companyId || '', planType: planType as any,
      quarters, yearlyAvgPct, yearlyAvgScore,
      yearlyScoreLabel: getScoreLabel(Math.round(yearlyAvgScore)),
      yearlyScoreColor: getScoreColor(Math.round(yearlyAvgScore)),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMonthlyProgress, companyId, planType, selectedYear]);

  // Compute effective overall status considering overrides
  // Logic: count all planned months (excluding not_planned/cancelled/not_applicable)
  // If ALL done → 'done'. If some done but work remains → 'not_started'. If none done → fallback.
  const getEffectiveOverallStatus = useCallback((act: Activity & { _planTag?: string }): ActivityStatus => {
    const mStatuses = MONTH_KEYS.map(mk => getEffectiveStatus(act, mk));

    // Check if ALL months are not_applicable or cancelled
    const allNotApplicable = mStatuses.every(s => s === 'not_applicable' || s === 'not_planned');
    if (allNotApplicable && mStatuses.some(s => s === 'not_applicable')) return 'not_applicable';
    const allCancelled = mStatuses.every(s => s === 'cancelled' || s === 'not_planned');
    if (allCancelled && mStatuses.some(s => s === 'cancelled')) return 'cancelled';

    // Count active planned months (excludes not_planned, cancelled, not_applicable)
    const activePlannedMonths = MONTH_KEYS.filter(mk => {
      const s = getEffectiveStatus(act, mk);
      return s !== 'not_planned' && s !== 'cancelled' && s !== 'not_applicable';
    });
    if (activePlannedMonths.length === 0) return act.status; // no active plan

    // Count done months out of all active planned months
    const doneMonths = activePlannedMonths.filter(mk => getEffectiveStatus(act, mk) === 'done');

    // ALL active planned months are done → truly done
    if (doneMonths.length >= activePlannedMonths.length) return 'done';

    // Has any postponed month → postponed
    const hasPostponed = activePlannedMonths.some(mk => getEffectiveStatus(act, mk) === 'postponed');
    if (hasPostponed) return 'postponed';

    // Some done but NOT all → still has work, keep as not_started
    // (even with partial progress, activity is not finished)
    return 'not_started';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, currentMonthIdx]);

  // Filter activities by status and month
  const filteredActivities = useMemo(() => {
    let list = statusFilter === 'all'
      ? [...activities]
      : activities.filter(a => getEffectiveOverallStatus(a) === statusFilter);

    if (sortMonth !== 'none') {
      list = list.filter(act => {
        const status = getEffectiveStatus(act, sortMonth);
        if (status !== 'not_planned') return true;
        // For recurring activities: keep them even if THIS month is not_planned
        // Only hide if the activity has NO planned months at all
        const hasAnyPlannedMonth = MONTH_KEYS.some(mk => {
          const ms = getEffectiveStatus(act, mk);
          return ms !== 'not_planned';
        });
        return hasAnyPlannedMonth;
      });
    }

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, statusFilter, sortMonth, overrides, currentMonthIdx]);

  // Determine which months to include based on timeRange
  const activeMonthKeys = useMemo(() => {
    if (timeRange === 'year') return MONTH_KEYS;
    if (timeRange === 'ytd') return MONTH_KEYS.slice(0, currentMonthIdx + 1);
    const idx = MONTH_KEYS.indexOf(timeRange);
    return idx >= 0 ? [MONTH_KEYS[idx]] : MONTH_KEYS;
  }, [timeRange, currentMonthIdx]);

  // Recalculate KPI summary including overrides, filtered by timeRange
  // KPI uses month-slot counting (same as chart) — NOT unique activity counting
  const effectiveSummary = useMemo(() => {
    if (!summary || activities.length === 0) return summary;

    let totalPlanned = 0, totalDone = 0, totalNotApplicable = 0, totalPostponed = 0, totalCancelled = 0;

    // Sum month-slots across selected months
    activeMonthKeys.forEach(k => {
      activities.forEach(act => {
        const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
        const status = getEffectiveStatus(act, k);
        const overrideKey = `${prefix}${act.no}:${k}`;
        const postponedTo = postponedOverrides[overrideKey];

        // Skip postponed activities that moved to another month
        if (status === 'postponed' && postponedTo && postponedTo !== k) {
          totalPostponed++;
          return;
        }

        if (status === 'not_planned') return;

        totalPlanned++;
        if (status === 'not_applicable') {
          totalNotApplicable++;
        } else if (status === 'done') {
          totalDone++;
        } else if (status === 'postponed') {
          totalPostponed++;
        } else if (status === 'cancelled') {
          totalCancelled++;
        }
      });
    });

    // done = เสร็จจริง, N/A = แยก, % = (done + N/A) / total → ยกประโยชน์ให้
    const totalNotStarted = Math.max(0, totalPlanned - totalDone - totalNotApplicable - totalPostponed - totalCancelled);
    const pctDone = totalPlanned > 0
      ? Math.round(((totalDone + totalNotApplicable) / totalPlanned) * 1000) / 10
      : 0;
    // Pure done % (excluding N/A from numerator)
    const pctPureDone = totalPlanned > 0
      ? Math.round((totalDone / totalPlanned) * 1000) / 10
      : 0;

    return {
      ...summary,
      total: totalPlanned,
      done: totalDone,
      notStarted: totalNotStarted,
      postponed: totalPostponed,
      cancelled: totalCancelled,
      notApplicable: totalNotApplicable,
      pctDone,
      pctPureDone,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, postponedOverrides, summary, activeMonthKeys]);

  // Count statuses using effective overall status
  const statusCounts = useMemo(() => {
    const counts = { all: activities.length, done: 0, not_started: 0, postponed: 0, cancelled: 0, not_applicable: 0 };
    activities.forEach(act => {
      const effectiveStatus = getEffectiveOverallStatus(act);
      if (effectiveStatus in counts) {
        counts[effectiveStatus as keyof typeof counts]++;
      }
    });
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, currentMonthIdx]);

  // Login handler
  const handleLogin = async () => {
    setLoginError('');
    try {
      const result = await auth.companyLogin(companyId, loginUsername, loginPassword);
      if (result.success) {
        setIsLoggedIn(true);
        setLoginCompanyName(result.data.companyName);
        setLoginDisplayName(result.data.displayName || result.data.companyName);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(result.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setLoginError('เกิดข้อผิดพลาด');
    }
  };

  // Save status override
  // Save status — called directly from drawer (sub-flows like postpone/done handled there)
  const handleSaveStatus = async (newStatus: MonthStatus) => {
    if (!editingCell) return;
    const actualPlanType = planType === 'total'
      ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
      : planType;
    const actualActNo = editingCell.actNo.replace(/^[SE]:/, '');
    const finalNote = statusNote;
    setSavingStatus(true);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        planType: actualPlanType,
        activityNo: actualActNo,
        month: editingCell.month,
        status: newStatus,
        note: finalNote,
        updatedBy: loginDisplayName || loginCompanyName,
      };

      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('บันทึกสถานะไม่สำเร็จ');
      const key = `${editingCell.actNo}:${editingCell.month}`;
      setOverrides(prev => ({ ...prev, [key]: newStatus }));
      setNoteOverrides(prev => ({ ...prev, [key]: finalNote }));

      if (newStatus !== 'done' && newStatus !== 'postponed') {
        setPostponedOverrides(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }

      setShowStatusModal(false);
      setEditingCell(null);
      setStatusNote('');
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
      // In Total mode, derive actual planType from the S:/E: prefix
      const actualPlanType = planType === 'total'
        ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const actualActNo = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
      const res = await fetch(`/api/status?companyId=${companyId}&planType=${actualPlanType}&activityNo=${actualActNo}&month=${editingCell.month}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('ลบสถานะไม่สำเร็จ');
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

  // Cell click handler — opens the drawer
  const handleCellClick = (actNo: string, month: string, actName: string) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setEditingCell({ actNo, month, actName });
    setShowStatusModal(true);
    // Load existing note for this cell
    setStatusNote(noteOverrides[`${actNo}:${month}`] || '');
    // Load actual cost for this activity
    const budgetEntry = budgetOverrides[actNo];
    setEditingActualCost(budgetEntry ? String(budgetEntry.actual_cost) : '');
    // Fetch attachments and deadline lock in parallel
    fetchAttachments(actNo, month);
    checkDeadlineLock(actNo, month);
  };

  // Drawer navigation — switch to different activity while drawer stays open
  const handleDrawerNavigate = (actNo: string, month: string, actName: string) => {
    setEditingCell({ actNo, month, actName });
    setStatusNote(noteOverrides[`${actNo}:${month}`] || '');
    const budgetEntry = budgetOverrides[actNo];
    setEditingActualCost(budgetEntry ? String(budgetEntry.actual_cost) : '');
    fetchAttachments(actNo, month);
    checkDeadlineLock(actNo, month);
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setShowStatusModal(false);
    setEditingCell(null);
    setStatusNote('');
    setEditingActualCost('');
  };

  // Get effective responsible (override > sheet)
  const getEffectiveResponsible = (act: Activity & { _planTag?: string }): string => {
    const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
    return responsibleOverrides[`${prefix}${act.no}`] || act.responsible;
  };

  // Get override key prefix for an activity (handles Total mode S:/E: prefixes)
  const getOverridePrefix = (act: Activity & { _planTag?: string }): string => {
    return (act as any)._planTag ? `${(act as any)._planTag}:` : '';
  };

  // Responsible click handler
  const handleResponsibleClick = (actNo: string, actName: string, current: string) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setEditingResponsible({ actNo, actName, current });
    setNewResponsible(current);
    setShowResponsibleModal(true);
  };

  // Save responsible override
  const handleSaveResponsible = async () => {
    if (!editingResponsible || !newResponsible.trim()) return;
    setSavingStatus(true);
    try {
      // In Total mode, derive actual planType from S:/E: prefix
      const actualPlanType = planType === 'total'
        ? (editingResponsible.actNo.startsWith('S:') ? 'safety' : editingResponsible.actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const actualActNo = planType === 'total' ? editingResponsible.actNo.replace(/^[SE]:/, '') : editingResponsible.actNo;
      const res = await fetch('/api/responsible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPlanType,
          activityNo: actualActNo,
          responsible: newResponsible.trim(),
          updatedBy: loginDisplayName || loginCompanyName,
        }),
      });
      if (!res.ok) throw new Error('บันทึกผู้รับผิดชอบไม่สำเร็จ');
      setResponsibleOverrides(prev => ({
        ...prev,
        [editingResponsible.actNo]: newResponsible.trim(),
      }));
      setShowResponsibleModal(false);
      setEditingResponsible(null);
    } catch {
      alert('บันทึกไม่สำเร็จ');
    }
    setSavingStatus(false);
  };

  // Revert responsible to sheet value
  const handleRevertResponsible = async () => {
    if (!editingResponsible) return;
    setSavingStatus(true);
    try {
      await fetch(`/api/responsible?companyId=${companyId}&planType=${planType}&activityNo=${editingResponsible.actNo}`, {
        method: 'DELETE',
      });
      setResponsibleOverrides(prev => {
        const copy = { ...prev };
        delete copy[editingResponsible.actNo];
        return copy;
      });
      setShowResponsibleModal(false);
      setEditingResponsible(null);
    } catch {
      alert('ลบไม่สำเร็จ');
    }
    setSavingStatus(false);
  };

  // Export handler
  const handleExport = () => {
    window.open(`/api/export?companyId=${companyId}&planType=${planType}&year=${selectedYear}`, '_blank');
  };

  // Fetch attachments for a cell
  const fetchAttachments = async (actNo: string, month: string) => {
    setLoadingAttachments(true);
    try {
      // In Total mode, derive actual planType from S:/E: prefix
      const pt = planType === 'total'
        ? (actNo.startsWith('S:') ? 'safety' : actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const an = planType === 'total' ? actNo.replace(/^[SE]:/, '') : actNo;
      const res = await fetch(`/api/attachments?companyId=${companyId}&planType=${pt}&activityNo=${an}&month=${month}`);
      const data = await res.json();
      const atts = data.attachments || [];
      setAttachments(atts);
      // Update count for cell indicator (keep prefixed key for matching)
      setAttachmentCounts(prev => ({
        ...prev,
        [`${actNo}:${month}`]: atts.length,
      }));
    } catch {
      setAttachments([]);
    }
    setLoadingAttachments(false);
  };

  // Check deadline lock for a month
  const checkDeadlineLock = async (actNo: string, month: string) => {
    setCheckingLock(true);
    try {
      // In Total mode, derive actual planType
      const dlPt = planType === 'total'
        ? (actNo.startsWith('S:') ? 'safety' : actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const dlAn = planType === 'total' ? actNo.replace(/^[SE]:/, '') : actNo;
      const res = await fetch(`/api/deadlines?month=${month}&companyId=${companyId}&planType=${dlPt}&activityNo=${dlAn}`);
      const data = await res.json();
      setDeadlineLocked(data.isLocked || false);
      setHasApproval(data.hasApproval || false);
    } catch {
      setDeadlineLocked(false);
      setHasApproval(false);
    }
    setCheckingLock(false);
  };

  // Save note independently (without changing status)
  const handleSaveNote = async () => {
    if (!editingCell) return;
    const actualPlanType = planType === 'total'
      ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
      : planType;
    const actualActNo = editingCell.actNo.replace(/^[SE]:/, '');
    setSavingNote(true);
    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPlanType,
          activityNo: actualActNo,
          month: editingCell.month,
          note: statusNote,
          updatedBy: loginDisplayName || loginCompanyName,
        }),
      });
      if (!res.ok) throw new Error('บันทึกหมายเหตุไม่สำเร็จ');
      const key = `${editingCell.actNo}:${editingCell.month}`;
      setNoteOverrides(prev => ({ ...prev, [key]: statusNote }));
    } catch {
      alert('บันทึกหมายเหตุไม่สำเร็จ');
    }
    setSavingNote(false);
  };

  // Upload evidence file (with 20MB limit)
  const MAX_FILE_SIZE_MB = 20;
  const handleUploadFile = async (file: File) => {
    if (!editingCell) return;
    // Client-side file size check
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB เกินขีดจำกัด ${MAX_FILE_SIZE_MB} MB\nกรุณาลดขนาดไฟล์หรือใช้ลิงก์ภายนอกแทน`);
      return;
    }
    setUploadingFile(true);
    try {
      const formData = new FormData();
      // In Total mode, derive actual planType from S:/E: prefix
      const actualPT = planType === 'total'
        ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const actualAN = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('planType', actualPT);
      formData.append('activityNo', actualAN);
      formData.append('month', editingCell.month);
      formData.append('uploadedBy', loginDisplayName || loginCompanyName);

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchAttachments(editingCell.actNo, editingCell.month);
      } else {
        alert(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    }
    setUploadingFile(false);
  };

  // Delete attachment
  // Bulk: mark all planned/overdue activities as done for current month
  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('ต้องการลบไฟล์นี้หรือไม่?')) return;
    setDeletingAttId(attId);
    try {
      const res = await fetch(`/api/attachments?id=${attId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attId));
        // Update count
        if (editingCell) {
          const key = `${editingCell.actNo}:${editingCell.month}`;
          setAttachmentCounts(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }));
        }
      } else {
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการลบ');
    }
    setDeletingAttId(null);
  };

  // Add external link as attachment
  const handleAddExternalLink = async () => {
    if (!editingCell || !externalLink.trim()) return;
    // Basic URL validation
    if (!externalLink.startsWith('http://') && !externalLink.startsWith('https://')) {
      alert('กรุณาใส่ URL ที่เริ่มต้นด้วย http:// หรือ https://');
      return;
    }
    setAddingLink(true);
    try {
      // In Total mode, derive actual planType from S:/E: prefix
      const actualPT2 = planType === 'total'
        ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const actualAN2 = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPT2,
          activityNo: actualAN2,
          month: editingCell.month,
          uploadedBy: loginDisplayName || loginCompanyName,
          linkUrl: externalLink.trim(),
          linkTitle: externalLinkTitle.trim() || externalLink.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAttachments(editingCell.actNo, editingCell.month);
        setExternalLink('');
        setExternalLinkTitle('');
      } else {
        alert(data.error || 'เพิ่มลิงก์ไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setAddingLink(false);
  };

  // Submit edit request for locked month
  const handleSubmitEditRequest = async (reason: string) => {
    if (!editingCell || !reason.trim()) return;
    setSubmittingRequest(true);
    try {
      const actualPT3 = planType === 'total'
        ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
        : planType;
      const actualAN3 = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPT3,
          activityNo: actualAN3,
          month: editingCell.month,
          reason: reason.trim(),
          requestedBy: loginDisplayName || loginCompanyName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('ส่งคำขอแก้ไขเรียบร้อย รอ Admin อนุมัติ');
      } else {
        alert(data.error || 'ส่งคำขอไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSubmittingRequest(false);
  };

  // Phase 4: Fetch pending cancellation requests for this company
  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/cancellation-requests?companyId=${companyId}&status=pending`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, string> = {};
        (d.requests || []).forEach((req: any) => {
          // Key format: "planType:activityNo:month"
          map[`${req.plan_type}:${req.activity_no}:${req.month}`] = req.requested_status;
        });
        setPendingCancellations(map);
      })
      .catch(() => {});
  }, [companyId]);

  // Phase 4: Submit cancellation request
  const handleRequestCancellation = async (requestedStatus: 'cancelled' | 'not_applicable' | 'not_planned' | 'planned', reason: string): Promise<boolean> => {
    if (!editingCell || !reason.trim()) return false;
    const actualPT = planType === 'total'
      ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
      : planType;
    const actualAN = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
    try {
      const res = await fetch('/api/cancellation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPT,
          activityNo: actualAN,
          month: editingCell.month,
          requestedStatus,
          reason: reason.trim(),
          requestedBy: loginDisplayName || loginCompanyName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('ส่งคำขออนุมัติเรียบร้อย รอ Admin อนุมัติ');
        // Update local pending state
        setPendingCancellations(prev => ({
          ...prev,
          [`${actualPT}:${actualAN}:${editingCell.month}`]: requestedStatus,
        }));
        return true;
      } else {
        alert(data.error || 'ส่งคำขอไม่สำเร็จ');
        return false;
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
      return false;
    }
  };

  // ── Tab personality config — MUST be before early returns (React Rules of Hooks) ──
  const planConfig = useMemo(() => {
    if (planType === 'safety') {
      return {
        headline: `Safety Action Plan ${selectedYear}`,
        subtitle: 'ขับเคลื่อนงานลดความเสี่ยง — ติดตาม ปิดงาน ป้องกันอุบัติเหตุ',
        accentColor: CATEGORY_COLORS.safety,
        accentBg: `${CATEGORY_COLORS.safety}20`,
        kpi: { total: 'รายการรายเดือน', done: 'ปิดงานแล้ว', notStarted: 'เสี่ยงสูง — ยังไม่เริ่ม', postponed: 'เลื่อน (ติดตาม)', cancelled: 'ยกเลิก', na: 'ไม่เข้าเงื่อนไข', budget: 'งบ Safety' },
        quickFilters: [
          { key: 'thisMonth', label: `เดือนนี้ (${MONTH_LABELS[currentMonthIdx]})`, Icon: CalendarClock },
          { key: 'overdue', label: 'เกินกำหนด', Icon: CircleAlert },
          { key: 'notStarted', label: 'ยังไม่เริ่ม', Icon: Clock },
          { key: 'noEvidence', label: 'หลักฐานไม่ครบ', Icon: Paperclip },
          { key: 'atRisk', label: 'เสี่ยงสูง', Icon: AlertTriangle },
          { key: 'hasProgress', label: 'กำลังดำเนินการ', Icon: CircleDashed },
        ],
        defaultSort: 'overdue-first' as const,
        chartTitle: 'Safety Execution — ความก้าวหน้ารายเดือน',
        tableTitle: 'รายละเอียดกิจกรรม Safety',
        EmptyIcon: Shield,
        filterSummaryLabel: 'Safety',
        statusLabels: {
          done: 'ปิดงานแล้ว',
          not_started: 'ยังไม่เริ่ม',
          postponed: 'เลื่อน',
          cancelled: 'ยกเลิก',
          not_applicable: 'ไม่เข้าเงื่อนไข',
        },
      };
    } else if (planType === 'environment') {
      return {
        headline: `Environment Action Plan ${selectedYear}`,
        subtitle: 'ควบคุม compliance — ติดตามใบอนุญาต รายงาน หลักฐาน',
        accentColor: CATEGORY_COLORS.environment,
        accentBg: `${CATEGORY_COLORS.environment}20`,
        kpi: { total: 'รายการรายเดือน', done: 'ดำเนินการแล้ว', notStarted: 'รอดำเนินการ', postponed: 'เลื่อน', cancelled: 'ยกเลิก', na: 'ไม่เข้าเงื่อนไข', budget: 'งบ Envi' },
        quickFilters: [
          { key: 'thisMonth', label: `ถึงกำหนด ${MONTH_LABELS[currentMonthIdx]}`, Icon: CalendarClock },
          { key: 'overdue', label: 'เกินกำหนด', Icon: CircleAlert },
          { key: 'noEvidence', label: 'ยังไม่แนบหลักฐาน', Icon: Paperclip },
          { key: 'postponed', label: 'เลื่อน', Icon: Clock },
          { key: 'atRisk', label: 'เสี่ยง', Icon: AlertTriangle },
          { key: 'hasProgress', label: 'กำลังดำเนินการ', Icon: CircleDashed },
        ],
        defaultSort: 'due-this-month' as const,
        chartTitle: 'Compliance Calendar — สถานะรายเดือน',
        tableTitle: 'รายละเอียดกิจกรรม Environment',
        EmptyIcon: Leaf,
        filterSummaryLabel: 'Environment',
        statusLabels: {
          done: 'ดำเนินการแล้ว',
          not_started: 'รอดำเนินการ',
          postponed: 'เลื่อน',
          cancelled: 'ยกเลิก',
          not_applicable: 'ไม่เข้าเงื่อนไข',
        },
      };
    } else {
      return {
        headline: `ภาพรวมแผนงาน ${selectedYear}`,
        subtitle: 'บริหารจัดลำดับระหว่าง Safety + Environment',
        accentColor: PALETTE.primary,
        accentBg: `${PALETTE.primary}20`,
        kpi: { total: 'รายการรายเดือน', done: 'เสร็จแล้ว', notStarted: 'ยังไม่เริ่ม', postponed: 'เลื่อน', cancelled: 'ยกเลิก', na: 'ไม่เข้าเงื่อนไข', budget: 'งบรวม' },
        quickFilters: [
          { key: 'thisMonth', label: `เดือนนี้ (${MONTH_LABELS[currentMonthIdx]})`, Icon: CalendarClock },
          { key: 'overdue', label: 'เกินกำหนดรวม', Icon: CircleAlert },
          { key: 'safetyOnly', label: 'เฉพาะ Safety', Icon: Shield },
          { key: 'enviOnly', label: 'เฉพาะ Envi', Icon: Leaf },
          { key: 'atRisk', label: 'เสี่ยง', Icon: AlertTriangle },
          { key: 'hasProgress', label: 'กำลังดำเนินการ', Icon: CircleDashed },
        ],
        defaultSort: 'overdue-first' as const,
        chartTitle: 'Timeline — ความก้าวหน้ารายเดือน',
        tableTitle: 'รายละเอียดกิจกรรมทั้งหมด',
        EmptyIcon: BarChart3,
        filterSummaryLabel: 'Total',
        statusLabels: {
          done: 'เสร็จแล้ว',
          not_started: 'ยังไม่เริ่ม',
          postponed: 'เลื่อน',
          cancelled: 'ยกเลิก',
          not_applicable: 'ไม่เข้าเงื่อนไข',
        },
      };
    }
  }, [planType, selectedYear, currentMonthIdx]);

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState<string>('none');

  // Compute overdue/thisMonth/noEvidence/postponed/plan counts for quick filters
  const quickFilterCounts = useMemo(() => {
    let overdueCount = 0;
    let thisMonthCount = 0;
    let noEvidenceCount = 0;
    let postponedCount = 0;
    let safetyOnlyCount = 0;
    let enviOnlyCount = 0;
    let atRiskCount = 0;
    let hasProgressCount = 0;
    const curMK = MONTH_KEYS[currentMonthIdx];
    activities.forEach(act => {
      const curStatus = getEffectiveStatus(act, curMK);
      if (curStatus !== 'not_planned' && curStatus !== 'done' && curStatus !== 'not_applicable' && curStatus !== 'cancelled') {
        thisMonthCount++;
      }
      // Check overdue: count UNIQUE activities that have any overdue month (not month-slots)
      const hasOverdueMonth = MONTH_KEYS.some((mk, idx) => {
        if (idx >= currentMonthIdx) return false;
        const st = getEffectiveStatus(act, mk);
        return st === 'overdue' || st === 'planned';
      });
      if (hasOverdueMonth) overdueCount++;
      // Postponed: use effective status
      if (getEffectiveOverallStatus(act) === 'postponed' || MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'postponed')) {
        postponedCount++;
      }
      // No evidence: has done status but no attachment
      const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
      const hasDoneMonth = MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'done');
      const hasAnyAttachment = MONTH_KEYS.some(mk => (attachmentCounts[`${prefix}${act.no}:${mk}`] || 0) > 0);
      if (hasDoneMonth && !hasAnyAttachment) noEvidenceCount++;
      // Plan tag counts
      if ((act as any)._planTag === 'S') safetyOnlyCount++;
      if ((act as any)._planTag === 'E') enviOnlyCount++;
      // At-risk: not fully done AND has at least 1 past month that is active but incomplete
      const overallSt = getEffectiveOverallStatus(act);
      if (overallSt !== 'done' && overallSt !== 'cancelled' && overallSt !== 'not_applicable' && hasOverdueMonth) {
        atRiskCount++;
      }
      // Has progress: partially done — at least 1 done month but NOT all done
      const activePlannedMonths = MONTH_KEYS.filter(mk => {
        const s = getEffectiveStatus(act, mk);
        return s !== 'not_planned' && s !== 'cancelled' && s !== 'not_applicable';
      });
      const doneMonths = activePlannedMonths.filter(mk => getEffectiveStatus(act, mk) === 'done');
      if (doneMonths.length > 0 && doneMonths.length < activePlannedMonths.length) {
        hasProgressCount++;
      }
    });
    return { overdue: overdueCount, thisMonth: thisMonthCount, noEvidence: noEvidenceCount, postponed: postponedCount, safetyOnly: safetyOnlyCount, enviOnly: enviOnlyCount, atRisk: atRiskCount, hasProgress: hasProgressCount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, currentMonthIdx, attachmentCounts]);

  // Enhanced filtered activities with quick filter + default sort per tab
  const enhancedFilteredActivities = useMemo(() => {
    let list = [...filteredActivities];

    // Apply quick filter
    if (quickFilter === 'thisMonth') {
      const curMK = MONTH_KEYS[currentMonthIdx];
      // Don't hide recurring activities — sort them to the bottom instead
      // Only hide activities that have NO plan in ANY month
      list = list.filter(act => {
        const st = getEffectiveStatus(act, curMK);
        if (st !== 'not_planned') return true;
        // Keep if activity has plans in other months (recurring)
        return MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) !== 'not_planned');
      });
      // Sort: activities with plan this month first, not_planned this month at bottom
      list.sort((a, b) => {
        const aHasPlan = getEffectiveStatus(a, curMK) !== 'not_planned' ? 1 : 0;
        const bHasPlan = getEffectiveStatus(b, curMK) !== 'not_planned' ? 1 : 0;
        return bHasPlan - aHasPlan;
      });
    } else if (quickFilter === 'overdue') {
      list = list.filter(act => {
        return MONTH_KEYS.some((mk, idx) => {
          if (idx >= currentMonthIdx) return false;
          const st = getEffectiveStatus(act, mk);
          return st === 'overdue' || st === 'planned';
        });
      });
    } else if (quickFilter === 'notStarted') {
      list = list.filter(act => getEffectiveOverallStatus(act) === 'not_started');
    } else if (quickFilter === 'noEvidence') {
      list = list.filter(act => {
        const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
        const hasDoneMonth = MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'done');
        const hasAnyAttachment = MONTH_KEYS.some(mk => (attachmentCounts[`${prefix}${act.no}:${mk}`] || 0) > 0);
        return hasDoneMonth && !hasAnyAttachment;
      });
    } else if (quickFilter === 'postponed') {
      list = list.filter(act => {
        return getEffectiveOverallStatus(act) === 'postponed' || MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'postponed');
      });
    } else if (quickFilter === 'safetyOnly') {
      list = list.filter(act => (act as any)._planTag === 'S');
    } else if (quickFilter === 'enviOnly') {
      list = list.filter(act => (act as any)._planTag === 'E');
    } else if (quickFilter === 'atRisk') {
      list = list.filter(act => {
        const overallSt = getEffectiveOverallStatus(act as Activity & { _planTag?: string });
        if (overallSt === 'done' || overallSt === 'cancelled' || overallSt === 'not_applicable') return false;
        return MONTH_KEYS.some((mk, idx) => {
          if (idx >= currentMonthIdx) return false;
          const st = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
          return st === 'overdue' || st === 'planned';
        });
      });
    } else if (quickFilter === 'hasProgress') {
      list = list.filter(act => {
        const activePlannedMonths = MONTH_KEYS.filter(mk => {
          const s = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
          return s !== 'not_planned' && s !== 'cancelled' && s !== 'not_applicable';
        });
        const doneMonths = activePlannedMonths.filter(mk => getEffectiveStatus(act as Activity & { _planTag?: string }, mk) === 'done');
        return doneMonths.length > 0 && doneMonths.length < activePlannedMonths.length;
      });
    }

    // Keep original order by activity number (no auto-resorting when status changes)
    // This prevents the confusing behavior where marking an activity as "done"
    // causes it to jump to the bottom of the list
    list.sort((a, b) => {
      // Sort by activity number naturally: "1.1" < "1.2" < "2.1" etc.
      const aParts = a.no.split('.').map(Number);
      const bParts = b.no.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    });

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredActivities, quickFilter, planConfig.defaultSort, currentMonthIdx, overrides, attachmentCounts]);

  // Compute current activity index in the filtered list for drawer navigation
  const drawerActivityIndex = useMemo(() => {
    if (!editingCell) return -1;
    return enhancedFilteredActivities.findIndex(a => {
      const prefix = (a as any)._planTag ? `${(a as any)._planTag}:` : '';
      return `${prefix}${a.no}` === editingCell.actNo;
    });
  }, [editingCell, enhancedFilteredActivities]);

  // Cross-plan stats for Total tab attention section
  const crossPlanStats = useMemo(() => {
    if (planType !== 'total') return null;
    const safetyActs = activities.filter((a: any) => a._planTag === 'S');
    const enviActs = activities.filter((a: any) => a._planTag === 'E');
    const countOpen = (acts: Activity[]) => {
      let open = 0;
      acts.forEach(act => {
        const hasOpenMonth = MONTH_KEYS.some((mk, idx) => {
          if (idx > currentMonthIdx) return false;
          const st = getEffectiveStatus(act, mk);
          return st !== 'not_planned' && st !== 'done' && st !== 'not_applicable' && st !== 'cancelled';
        });
        if (hasOpenMonth) open++;
      });
      return open;
    };
    const countOverdue = (acts: Activity[]) => {
      let count = 0;
      acts.forEach(act => {
        MONTH_KEYS.forEach((mk, idx) => {
          if (idx < currentMonthIdx) {
            const st = getEffectiveStatus(act, mk);
            if (st === 'overdue' || st === 'planned') count++;
          }
        });
      });
      return count;
    };
    return {
      safetyOpen: countOpen(safetyActs),
      enviOpen: countOpen(enviActs),
      safetyOverdue: countOverdue(safetyActs),
      enviOverdue: countOverdue(enviActs),
      safetyTotal: safetyActs.length,
      enviTotal: enviActs.length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, planType, currentMonthIdx]);

  // Compute total actual cost from budget overrides
  const totalActualCost = useMemo(() => {
    let total = 0;
    Object.values(budgetOverrides).forEach(b => { total += b.actual_cost || 0; });
    return total;
  }, [budgetOverrides]);

  // Budget tracking: cumulative planned vs actual by month
  const budgetTrackingData = useMemo<MonthlyBudget[]>(() => {
    // For each activity, distribute its planned budget across its planned months
    // Actual: if activity has actual_cost in budget_overrides, distribute across done months
    const monthlyPlanned = new Array(12).fill(0);
    const monthlyActual = new Array(12).fill(0);

    activities.forEach(act => {
      const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
      const actKey = `${prefix}${act.no}`;
      const budget = act.budget || 0;
      if (budget <= 0 && !budgetOverrides[actKey]) return;

      // Find planned months for this activity
      const plannedMonthIndices: number[] = [];
      const doneMonthIndices: number[] = [];
      MONTH_KEYS.forEach((mk, i) => {
        const st = getEffectiveStatus(act, mk);
        if (st !== 'not_planned') plannedMonthIndices.push(i);
        if (st === 'done') doneMonthIndices.push(i);
      });

      // Distribute planned budget evenly across planned months
      if (budget > 0 && plannedMonthIndices.length > 0) {
        const perMonth = budget / plannedMonthIndices.length;
        plannedMonthIndices.forEach(i => { monthlyPlanned[i] += perMonth; });
      }

      // Actual cost: use budget_overrides actual_cost, distributed across done months
      const actualCost = budgetOverrides[actKey]?.actual_cost || 0;
      if (actualCost > 0 && doneMonthIndices.length > 0) {
        const perMonth = actualCost / doneMonthIndices.length;
        doneMonthIndices.forEach(i => { monthlyActual[i] += perMonth; });
      }
    });

    // Build cumulative data
    let cumPlanned = 0;
    let cumActual = 0;
    return MONTH_LABELS.map((label, i) => {
      cumPlanned += monthlyPlanned[i];
      cumActual += monthlyActual[i];
      return { month: label, planned: Math.round(cumPlanned), actual: Math.round(cumActual) };
    });
  }, [activities, budgetOverrides, overrides]);

  // Evidence indicator per activity: 'required' | 'attached' | 'missing' | 'na'
  // For Environment tab: evidence is expected for any month with status 'done'
  const evidenceIndicators = useMemo(() => {
    const result: Record<string, 'required' | 'attached' | 'missing' | 'na'> = {};
    activities.forEach(act => {
      const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
      const actKey = `${prefix}${act.no}`;
      const hasDoneMonth = MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'done');
      const hasPlannedMonth = MONTH_KEYS.some(mk => {
        const st = getEffectiveStatus(act, mk);
        return st !== 'not_planned' && st !== 'not_applicable' && st !== 'cancelled';
      });
      if (!hasPlannedMonth) {
        result[actKey] = 'na';
        return;
      }
      const hasAnyAttachment = MONTH_KEYS.some(mk => (attachmentCounts[`${prefix}${act.no}:${mk}`] || 0) > 0);
      if (hasDoneMonth && hasAnyAttachment) {
        result[actKey] = 'attached';
      } else if (hasDoneMonth && !hasAnyAttachment) {
        result[actKey] = 'missing';
      } else {
        result[actKey] = 'required'; // planned but not done yet — evidence will be needed
      }
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, attachmentCounts, overrides]);

  // Activity progress per row: how many months done / total planned months
  const activityProgress = useMemo(() => {
    const result: Record<string, { done: number; total: number; pct: number }> = {};
    activities.forEach(act => {
      const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
      const actKey = `${prefix}${act.no}`;
      let done = 0, total = 0;
      MONTH_KEYS.forEach(mk => {
        const st = getEffectiveStatus(act, mk);
        if (st !== 'not_planned') {
          total++;
          if (st === 'done' || st === 'not_applicable') done++;
        }
      });
      result[actKey] = { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides]);

  // Evidence tiers per activity: none | basic (note only) | standard (note + attachment) | full (note + attachment + date)
  const evidenceTiers = useMemo(() => {
    const result: Record<string, { tier: 'none' | 'basic' | 'standard' | 'full'; details: string }> = {};
    activities.forEach(act => {
      const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
      const actKey = `${prefix}${act.no}`;
      const doneMonths = MONTH_KEYS.filter(mk => getEffectiveStatus(act, mk) === 'done');
      if (doneMonths.length === 0) { result[actKey] = { tier: 'none', details: 'ยังไม่มีเดือนที่เสร็จ' }; return; }
      const hasAttachment = MONTH_KEYS.some(mk => (attachmentCounts[`${prefix}${act.no}:${mk}`] || 0) > 0);
      const hasNote = MONTH_KEYS.some(mk => !!noteOverrides[`${prefix}${act.no}:${mk}`]);
      const hasDateInNote = MONTH_KEYS.some(mk => {
        const note = noteOverrides[`${prefix}${act.no}:${mk}`] || '';
        return note.includes('[ดำเนินการ:') || note.includes('[Bulk close:');
      });
      if (hasAttachment && hasNote && hasDateInNote) {
        result[actKey] = { tier: 'full', details: 'ครบถ้วน: หลักฐาน + หมายเหตุ + วันที่' };
      } else if (hasAttachment && (hasNote || hasDateInNote)) {
        result[actKey] = { tier: 'standard', details: 'มีหลักฐานแนบ + ' + (hasNote ? 'หมายเหตุ' : 'วันที่') };
      } else if (hasNote || hasDateInNote || hasAttachment) {
        result[actKey] = { tier: 'basic', details: hasAttachment ? 'มีหลักฐานแนบ' : 'มีหมายเหตุ' };
      } else {
        result[actKey] = { tier: 'none', details: 'เสร็จแล้วแต่ยังไม่มีหลักฐาน' };
      }
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, attachmentCounts, noteOverrides, overrides]);

  // Category groups for grouping view
  const categoryGroups = useMemo(() => {
    const groups: { categoryNo: string; categoryGroup: string; activities: (Activity & { _planTag?: string })[] }[] = [];
    const groupMap = new Map<string, (Activity & { _planTag?: string })[]>();
    const groupNames = new Map<string, string>();
    enhancedFilteredActivities.forEach((act: Activity & { _planTag?: string }) => {
      const catNo = act.categoryNo || act.no.split('.')[0] || '?';
      const catName = act.categoryGroup || `หมวด ${catNo}`;
      if (!groupMap.has(catNo)) {
        groupMap.set(catNo, []);
        groupNames.set(catNo, catName);
      }
      groupMap.get(catNo)!.push(act);
    });
    // Sort by category number
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      const numA = parseInt(a) || 999;
      const numB = parseInt(b) || 999;
      return numA - numB;
    });
    sortedKeys.forEach(catNo => {
      groups.push({ categoryNo: catNo, categoryGroup: groupNames.get(catNo) || '', activities: groupMap.get(catNo) || [] });
    });
    return groups;
  }, [enhancedFilteredActivities]);

  // Responsible person stats: activities count, overdue count, done count
  const responsibleStats = useMemo(() => {
    const stats: Record<string, { name: string; total: number; done: number; overdue: number; open: number }> = {};
    activities.forEach(act => {
      const name = getEffectiveResponsible(act) || 'ไม่ระบุ';
      if (!stats[name]) stats[name] = { name, total: 0, done: 0, overdue: 0, open: 0 };
      stats[name].total++;
      const hasDoneAll = MONTH_KEYS.every(mk => {
        const st = getEffectiveStatus(act, mk);
        return st === 'not_planned' || st === 'done' || st === 'not_applicable' || st === 'cancelled';
      });
      if (hasDoneAll && MONTH_KEYS.some(mk => getEffectiveStatus(act, mk) === 'done')) {
        stats[name].done++;
      } else {
        const hasOverdue = MONTH_KEYS.some((mk, idx) => idx < currentMonthIdx && ['overdue', 'planned'].includes(getEffectiveStatus(act, mk)));
        if (hasOverdue) stats[name].overdue++;
        else stats[name].open++;
      }
    });
    return Object.values(stats).sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, responsibleOverrides, currentMonthIdx]);

  // ── View Gate: require login to see company data ──
  if (!isLoggedIn && !auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 w-full max-w-sm text-center" style={{ backdropFilter: 'blur(40px)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: `linear-gradient(135deg, ${PALETTE.primary} 0%, ${PALETTE.primary}CC 100%)` }}>
              <Key size={24} color="white" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>เข้าสู่ระบบ</h2>
            <p className="text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
              กรอกข้อมูลของ <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{companyName}</span> เพื่อดูข้อมูล
            </p>
            <input
              type="text"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-3 py-2.5 rounded-lg text-sm mb-2 focus:outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              autoFocus
            />
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="รหัสผ่าน"
              className="w-full px-3 py-2.5 rounded-lg text-sm mb-3 focus:outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            {loginError && <p style={{ color: STATUS.critical }} className="text-xs mb-3">{loginError}</p>}
            <button
              onClick={handleLogin}
              disabled={!loginPassword}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto" id="pdf-content">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs mb-1">
          <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-70">Home</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <Link href="/action-plan" style={{ color: 'var(--muted)' }} className="hover:opacity-70">แผนงานประจำปี</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{companyName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {companyName} — {planConfig.headline}
            </h1>
            <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
              {planConfig.subtitle}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Auth indicator */}
            {isLoggedIn ? (
              <span className="glass-card px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1" style={{ color: STATUS.ok }}>
                <Check size={12} /> {loginDisplayName || loginCompanyName}
              </span>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="glass-card px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: STATUS.warning }}
              >
                <Key size={14} className="inline mr-1" /> เข้าสู่ระบบเพื่อแก้ไข
              </button>
            )}
            <div style={{ background: 'var(--border)' }} className="rounded-xl p-1 flex gap-1">
              <button
                onClick={() => { setPlanType('total'); setQuickFilter('none'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'total'
                  ? { background: PALETTE.primary, color: '#ffffff' }
                  : { color: 'var(--muted)' }}
              >
                <BarChart3 size={14} className="inline mr-1" /> Total
              </button>
              <button
                onClick={() => { setPlanType('safety'); setQuickFilter('none'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'safety'
                  ? { background: CATEGORY_COLORS.safety, color: '#ffffff', boxShadow: `0 2px 10px ${CATEGORY_COLORS.safety}50` }
                  : { color: 'var(--muted)' }}
              >
                <Shield size={14} className="inline mr-1" /> Safety
              </button>
              <button
                onClick={() => { setPlanType('environment'); setQuickFilter('none'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'environment'
                  ? { background: CATEGORY_COLORS.environment, color: '#ffffff', boxShadow: `0 2px 10px ${CATEGORY_COLORS.environment}50` }
                  : { color: 'var(--muted)' }}
              >
                <Leaf size={14} className="inline mr-1" /> Environment
              </button>
            </div>
            {/* Export icon buttons */}
            <button
              onClick={handleExport}
              title="Export .xlsx"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, border: 'none',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${PALETTE.primary}18`; e.currentTarget.style.color = PALETTE.primary; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Download size={16} />
            </button>
            <ExportPdfButton
              targetId="pdf-content"
              filename={`${companyName}-ActionPlan-${selectedYear}`}
              title={`${companyName} — ${planType === 'environment' ? 'Environment' : 'Safety'} Action Plan ${selectedYear}`}
              subtitle={`Safety & Environment Dashboard — รายงานแผนงานประจำปี`}
              orientation="landscape"
              compact
            />
          </div>
        </div>
        {/* Time Range Selector + Export buttons */}
        <div className="flex items-center gap-2 mb-5 flex-wrap animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          >
            {AVAILABLE_YEARS.map(y => {
              const isActive = ACTIVE_YEARS.includes(y);
              return <option key={y} value={y} disabled={!isActive}>{y}</option>;
            })}
          </select>
          <Calendar size={14} style={{ color: 'var(--muted)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>ช่วงเวลา:</span>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            {[
              { key: 'year', label: 'ทั้งปี' },
              { key: 'ytd', label: `ถึง ${MONTH_LABELS[currentMonthIdx]} (YTD)` },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200"
                style={timeRange === opt.key
                  ? { background: PALETTE.primary, color: '#fff', boxShadow: `0 2px 8px ${PALETTE.primary}4D` }
                  : { color: 'var(--muted)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={MONTH_KEYS.includes(timeRange) ? timeRange : ''}
            onChange={(e) => e.target.value && setTimeRange(e.target.value)}
            className="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: MONTH_KEYS.includes(timeRange) ? PALETTE.primary : 'var(--bg-tertiary)',
              color: MONTH_KEYS.includes(timeRange) ? '#fff' : 'var(--muted)',
              border: '1px solid var(--border)',
              outline: 'none',
            }}
          >
            <option value="" disabled>เลือกเดือน...</option>
            {MONTH_LABELS.map((name, i) => (
              <option key={MONTH_KEYS[i]} value={MONTH_KEYS[i]}>{name}</option>
            ))}
          </select>
          {timeRange !== 'year' && (
            <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: `${STATUS.warning}15`, color: STATUS.warning }}>
              {timeRange === 'ytd' ? `ม.ค. – ${MONTH_LABELS[currentMonthIdx]}` : MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]} เท่านั้น
            </span>
          )}
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
            {/* Filter Summary Bar */}
            <div className="px-4 py-2.5 rounded-lg mb-5 flex items-center justify-between animate-fade-in-up" style={{ background: 'var(--bg-tertiary)', border: `1px solid var(--border)`, borderLeft: `3px solid ${planConfig.accentColor}` }}>
              <span className="text-[12px] flex items-center flex-wrap gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: planConfig.accentBg, color: planConfig.accentColor }}>
                  {planConfig.filterSummaryLabel}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `${STATUS.warning}15`, color: STATUS.warning }}>
                  {selectedYear}
                </span>
                <span style={{ color: 'var(--muted)' }}>•</span>
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  ถึง {MONTH_LABELS[currentMonthIdx]} (YTD)
                </span>
                {timeRange !== 'year' && timeRange !== 'ytd' && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `${PALETTE.primary}15`, color: PALETTE.primary }}>
                      {MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]}
                    </span>
                  </>
                )}
                {quickFilter !== 'none' && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `${STATUS.critical}15`, color: STATUS.critical }}>
                      {planConfig.quickFilters.find(f => f.key === quickFilter)?.label || quickFilter}
                    </span>
                  </>
                )}
                {statusFilter !== 'all' && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `${PALETTE.primary}18`, color: PALETTE.primary }}>
                      {statusFilter}
                    </span>
                  </>
                )}
                <span style={{ color: 'var(--muted)' }}>→</span>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {enhancedFilteredActivities.length} กิจกรรม
                </span>
              </span>
            </div>

            {/* KPI Cards — use effectiveSummary which includes override data */}
            {planType === 'total' && crossPlanStats ? (
              /* Total tab: cross-plan KPIs + view toggle */
              <>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-3 animate-fade-in-up">
                <KPICard label={planConfig.kpi.total} value={effectiveSummary?.total || 0} />
                <div title={`สำเร็จจริง ${(effectiveSummary as any)?.pctPureDone || 0}% (${effectiveSummary?.done || 0} รายการ)\nรวม N/A ${effectiveSummary?.pctDone || 0}% (+${effectiveSummary?.notApplicable || 0} ไม่เข้าเงื่อนไข)`}>
                  <KPICard label={planConfig.kpi.done} value={effectiveSummary?.done || 0} color={STATUS.ok} progress={effectiveSummary?.pctDone || 0} delta={`${(effectiveSummary as any)?.pctPureDone || 0}%`} subtext={effectiveSummary?.notApplicable ? `+${effectiveSummary.notApplicable} N/A = ${effectiveSummary?.pctDone || 0}%` : undefined} />
                </div>
                <KPICard label="Safety ยังเปิด" value={crossPlanStats.safetyOpen} color={CATEGORY_COLORS.safety} subtext={`จาก ${crossPlanStats.safetyTotal} กิจกรรม`} />
                <KPICard label="Envi ยังเปิด" value={crossPlanStats.enviOpen} color={CATEGORY_COLORS.environment} subtext={`จาก ${crossPlanStats.enviTotal} กิจกรรม`} />
                <KPICard label="Overdue รวม" value={(crossPlanStats.safetyOverdue + crossPlanStats.enviOverdue)} color={STATUS.critical} subtext={`S:${crossPlanStats.safetyOverdue} / E:${crossPlanStats.enviOverdue}`} />
                <KPICard label={planConfig.kpi.budget} value={effectiveSummary?.budget ? effectiveSummary.budget.toLocaleString() : '-'} color={PALETTE.primary} subtext={totalActualCost > 0 ? `ใช้จริง ${totalActualCost.toLocaleString()}` : effectiveSummary?.safetyBudget !== undefined ? `S:${(effectiveSummary.safetyBudget || 0).toLocaleString()} / E:${(effectiveSummary.enviBudget || 0).toLocaleString()}` : 'บาท'} />
              </div>
              {/* View toggle removed — Total tab always shows combined view with S/E badges */}
              </>
            ) : (
              /* Safety / Environment KPIs — two rows */
              <>
              {/* Row 1: Activity-level overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2 animate-fade-in-up">
                <KPICard label={planType === 'safety' ? 'กิจกรรม Safety' : 'กิจกรรม Envi'} value={activities.length} subtext={`${activities.filter(a => a.isConditional).length} งาน trigger-based`} />
                <KPICard label={planConfig.kpi.done} value={effectiveSummary?.done || 0} color={STATUS.ok} progress={effectiveSummary?.pctDone || 0} delta={`${(effectiveSummary as any)?.pctPureDone || 0}%`} subtext={`จาก ${effectiveSummary?.total || 0} รายการรายเดือน`} />
                <KPICard label={planConfig.kpi.notStarted} value={effectiveSummary?.notStarted || 0} color={planType === 'safety' ? STATUS.critical : STATUS.warning} subtext="รายการรายเดือน" />
                <KPICard label={planConfig.kpi.budget} value={effectiveSummary?.budget ? effectiveSummary.budget.toLocaleString() : '-'} color={planConfig.accentColor} subtext={totalActualCost > 0 ? `ใช้จริง ${totalActualCost.toLocaleString()}` : 'บาท'} />
              </div>
              {/* Row 2: Detailed breakdown */}
              <div className="grid grid-cols-4 lg:grid-cols-4 gap-3 mb-5 animate-fade-in-up">
                <KPICard label={planConfig.kpi.postponed} value={effectiveSummary?.postponed || 0} color={PALETTE.primary} />
                <KPICard label={planConfig.kpi.cancelled} value={effectiveSummary?.cancelled || 0} color={STATUS.critical} />
                <KPICard label={planConfig.kpi.na} value={effectiveSummary?.notApplicable || 0} color="var(--muted)" />
                <KPICard label="Conditional / ยังไม่เกิดเหตุ" value={activities.filter(a => a.isConditional).length} color="var(--muted)" subtext="ไม่นับ overdue" />
              </div>
              </>
            )}

            {/* ── KPI Quarterly Score Section ──────────────────── */}
            {kpiData && kpiData.quarters && (
              <div className="mb-5 animate-fade-in-up">
                <div
                  className="flex items-center justify-between cursor-pointer select-none mb-3"
                  onClick={() => setShowKpiDetail(!showKpiDetail)}
                >
                  <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <TrendingUp size={14} style={{ color: PALETTE.primary }} />
                    KPI รายไตรมาส
                    <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}>
                      — เฉลี่ย {kpiData.yearlyAvgPct}% (คะแนน {kpiData.yearlyAvgScore}/5 {kpiData.yearlyScoreLabel})
                    </span>
                  </h3>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    {showKpiDetail ? '▲ ซ่อน' : '▼ ดูรายละเอียด'}
                  </span>
                </div>

                {/* Compact quarter score bars */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {kpiData.quarters.map((q: QuarterlyKPI) => {
                    const isActive = !q.isFutureQuarter && q.totalItems > 0;
                    return (
                      <div
                        key={q.quarter}
                        className="rounded-lg p-3 relative overflow-hidden"
                        style={{
                          background: isActive ? 'var(--card-solid)' : 'var(--bg-secondary)',
                          border: `1px solid ${isActive ? q.scoreColor + '40' : 'var(--border)'}`,
                          opacity: isActive ? 1 : 0.5,
                        }}
                      >
                        {/* Progress bar background */}
                        {isActive && (
                          <div
                            style={{
                              position: 'absolute', left: 0, bottom: 0,
                              width: `${Math.min(q.percentage, 100)}%`, height: 3,
                              background: q.scoreColor,
                              borderRadius: '0 2px 0 0',
                              transition: 'width 0.5s ease',
                            }}
                          />
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
                            {q.quarter}
                          </span>
                          {isActive && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: q.scoreColor + '20', color: q.scoreColor }}
                            >
                              {q.score}/5
                            </span>
                          )}
                        </div>
                        <div className="text-[18px] font-bold" style={{ color: isActive ? q.scoreColor : 'var(--muted)' }}>
                          {isActive ? `${q.percentage}%` : '—'}
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {isActive
                            ? `${q.doneCount}/${q.denominator} สำเร็จ`
                            : q.isFutureQuarter ? 'ยังไม่ถึงกำหนด' : 'ไม่มีข้อมูล'
                          }
                        </div>
                        {/* Alert badges */}
                        {isActive && (q.highPostponedRate || q.highCancelledRate || q.consecutiveLow) && (
                          <div className="flex gap-1 mt-1">
                            {q.highPostponedRate && (
                              <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: `${STATUS.warning}15`, color: STATUS.warning }}>
                                เลื่อนมาก
                              </span>
                            )}
                            {q.highCancelledRate && (
                              <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: `${STATUS.critical}15`, color: STATUS.critical }}>
                                ยกเลิกมาก
                              </span>
                            )}
                            {q.consecutiveLow && (
                              <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: `${STATUS.critical}15`, color: STATUS.critical }}>
                                ต่ำติดต่อกัน
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Expandable detail section */}
                {showKpiDetail && (
                  <div className="rounded-lg p-4 mt-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>ไตรมาส</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>รายการ</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: STATUS.ok, fontWeight: 600 }}>สำเร็จ</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: STATUS.critical, fontWeight: 600 }}>เกินกำหนด</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: STATUS.warning, fontWeight: 600 }}>เลื่อน</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: PALETTE.textSecondary, fontWeight: 600 }}>ยกเลิก</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: PALETTE.muted, fontWeight: 600 }}>N/A</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>ฐาน</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>%</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>คะแนน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiData.quarters.map((q: QuarterlyKPI) => {
                          const isActive = !q.isFutureQuarter && q.totalItems > 0;
                          return (
                            <tr key={q.quarter} style={{ borderBottom: '1px solid var(--border)', opacity: isActive ? 1 : 0.4 }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{q.label}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{q.totalItems}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: STATUS.ok, fontWeight: 600 }}>{q.doneCount}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: q.overdueCount > 0 ? STATUS.critical : 'var(--muted)' }}>{q.overdueCount}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: q.postponedCount > 0 ? STATUS.warning : 'var(--muted)' }}>{q.postponedCount}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: q.cancelledCount > 0 ? PALETTE.textSecondary : 'var(--muted)' }}>{q.cancelledCount}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: 'var(--muted)' }}>{q.notApplicableCount}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 500 }}>{q.denominator}{q.isEmptyBase && <AlertTriangle size={10} style={{ display: 'inline', marginLeft: 2, color: STATUS.warning }} />}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: isActive ? q.scoreColor : 'var(--muted)' }}>{isActive ? `${q.percentage}%` : '—'}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                {isActive ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[11px] font-bold"
                                    style={{ background: q.scoreColor + '20', color: q.scoreColor }}
                                  >
                                    {q.score} — {q.scoreLabel}
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Yearly average row */}
                        <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>เฉลี่ยทั้งปี</td>
                          <td colSpan={7}></td>
                          <td style={{ padding: '8px', textAlign: 'center', color: kpiData.yearlyScoreColor }}>{kpiData.yearlyAvgPct}%</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-bold"
                              style={{ background: kpiData.yearlyScoreColor + '20', color: kpiData.yearlyScoreColor }}
                            >
                              {kpiData.yearlyAvgScore} — {kpiData.yearlyScoreLabel}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Scoring legend */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>เกณฑ์:</span>
                      {[
                        { s: 5, l: '100%', c: STATUS.ok },
                        { s: 4, l: '≥90%', c: '#76B7B2' },
                        { s: 3, l: '≥80%', c: STATUS.warning },
                        { s: 2, l: '≥70%', c: '#E15759' },
                        { s: 1, l: '<70%', c: STATUS.critical },
                      ].map(x => (
                        <span key={x.s} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: x.c + '15', color: x.c }}>
                          {x.s} = {x.l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Total tab: Attention section — ต้องติดตามก่อน */}
            {planType === 'total' && crossPlanStats && (crossPlanStats.safetyOverdue > 0 || crossPlanStats.enviOverdue > 0) && (
              <div className="mb-5 animate-fade-in-up">
                <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <AlertTriangle size={14} style={{ color: STATUS.critical }} />
                  ต้องติดตามก่อน
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {crossPlanStats.safetyOverdue > 0 && (
                    <div className="p-3.5 rounded-lg" style={{ background: `${CATEGORY_COLORS.safety}12`, border: `1px solid ${CATEGORY_COLORS.safety}40` }}>
                      <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: CATEGORY_COLORS.safety }}>
                        <Shield size={12} /> งานค้าง Safety
                      </div>
                      <div className="text-[20px] font-bold mt-1" style={{ color: CATEGORY_COLORS.safety }}>{crossPlanStats.safetyOverdue}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>เดือน-กิจกรรมที่เกินกำหนด</div>
                    </div>
                  )}
                  {crossPlanStats.enviOverdue > 0 && (
                    <div className="p-3.5 rounded-lg" style={{ background: `${CATEGORY_COLORS.environment}12`, border: `1px solid ${CATEGORY_COLORS.environment}40` }}>
                      <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: CATEGORY_COLORS.environment }}>
                        <Leaf size={12} /> งานค้าง Environment
                      </div>
                      <div className="text-[20px] font-bold mt-1" style={{ color: CATEGORY_COLORS.environment }}>{crossPlanStats.enviOverdue}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>เดือน-กิจกรรมที่เกินกำหนด</div>
                    </div>
                  )}
                  {/* Month clash indicator */}
                  {(() => {
                    const curMK = MONTH_KEYS[currentMonthIdx];
                    const safetyThisMonth = activities.filter((a: any) => a._planTag === 'S' && getEffectiveStatus(a, curMK) !== 'not_planned' && getEffectiveStatus(a, curMK) !== 'done' && getEffectiveStatus(a, curMK) !== 'not_applicable').length;
                    const enviThisMonth = activities.filter((a: any) => a._planTag === 'E' && getEffectiveStatus(a, curMK) !== 'not_planned' && getEffectiveStatus(a, curMK) !== 'done' && getEffectiveStatus(a, curMK) !== 'not_applicable').length;
                    if (safetyThisMonth > 0 && enviThisMonth > 0) {
                      return (
                        <div className="p-3.5 rounded-lg" style={{ background: `${PALETTE.primary}12`, border: `1px solid ${PALETTE.primary}40` }}>
                          <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: PALETTE.primary }}>
                            <Calendar size={12} /> สองแผนชนกัน {MONTH_LABELS[currentMonthIdx]}
                          </div>
                          <div className="text-[12px] font-bold mt-1" style={{ color: PALETTE.primary }}>
                            S:{safetyThisMonth} + E:{enviThisMonth}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>กิจกรรมที่ยังเปิดเดือนนี้</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* Budget + Responsible moved to bottom — Total mode only */}

            {/* Monthly Progress */}
            {effectiveMonthlyProgress && effectiveMonthlyProgress.length > 0 && (
              <div className="glass-card rounded-xl p-5 mb-6 animate-fade-in-up">
                <h3 className="text-[13px] mb-4 pl-3" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${planConfig.accentColor}` }}>
                  {planConfig.chartTitle}
                </h3>
                <div style={{ height: 250 }}>
                  <MonthlyProgressChart monthlyProgress={effectiveMonthlyProgress} />
                </div>
                <div className="grid grid-cols-12 gap-1 mt-4">
                  {effectiveMonthlyProgress.map((mp, idx) => {
                    const isPast = idx < currentMonthIdx;
                    const isCurrent = idx === currentMonthIdx;
                    const isFuture = idx > currentMonthIdx;
                    const hasPlanned = (mp.denominator ?? mp.planned) > 0;
                    const pct = mp.pctComplete;
                    // Past month differentiation: failed past months stand out
                    const pastFailed = isPast && hasPlanned && pct < 100;
                    const pastDone = isPast && hasPlanned && pct >= 100;
                    return (
                      <div
                        key={mp.month}
                        className="text-center p-1.5 rounded-lg text-[10px]"
                        style={{
                          background: isCurrent ? `${STATUS.warning}14`
                            : pastDone ? `${STATUS.ok}0A`
                            : pastFailed ? `${STATUS.critical}08`
                            : 'var(--bg-hover)',
                          border: isCurrent ? `1.5px solid ${STATUS.warning}`
                            : pastFailed ? `1px solid ${STATUS.critical}25`
                            : '1px solid var(--border)',
                        }}
                      >
                        <div className="font-semibold" style={{
                          color: isCurrent ? STATUS.warning : isPast ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>
                          {mp.label}
                          {isCurrent && <span className="block text-[7px] font-normal" style={{ color: STATUS.warning }}>ปัจจุบัน</span>}
                        </div>
                        <div className="text-sm font-bold" style={{
                          color: !hasPlanned ? 'var(--text-muted)'
                            : pct >= 100 ? STATUS.ok
                            : pct > 0 ? STATUS.warning
                            : isPast ? STATUS.critical
                            : PALETTE.muted,
                        }}>
                          {hasPlanned ? `${pct}%` : '-'}
                        </div>
                        <div style={{ color: 'var(--muted)' }}>{mp.doneCount ?? mp.completed}/{mp.denominator ?? mp.planned}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Budget Tracking Chart — Planned vs Actual (cumulative) */}
            {effectiveSummary && effectiveSummary.budget > 0 && (
              <div className="glass-card rounded-xl p-5 mb-6 animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] pl-3" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${STATUS.warning}` }}>
                    <Wallet size={14} className="inline mr-1.5" style={{ color: STATUS.warning }} />
                    งบประมาณ — วางแผน vs ใช้จริง (สะสม)
                  </h3>
                  <div className="flex gap-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <span>แผน <strong style={{ color: PALETTE.primary }}>{effectiveSummary.budget.toLocaleString()}</strong> ฿</span>
                    <span>ใช้จริง <strong style={{ color: STATUS.warning }}>{totalActualCost.toLocaleString()}</strong> ฿</span>
                    {effectiveSummary.budget > 0 && (
                      <span style={{ color: totalActualCost > effectiveSummary.budget ? STATUS.critical : STATUS.positive }}>
                        ({Math.round((totalActualCost / effectiveSummary.budget) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: 220 }}>
                  <BudgetTrackingChart data={budgetTrackingData} totalPlanned={effectiveSummary.budget} />
                </div>
              </div>
            )}

            {/* Quick Filters per tab */}
            {planConfig.quickFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 animate-fade-in-up">
                <span className="text-[11px] font-medium self-center mr-1" style={{ color: 'var(--muted)' }}>โฟกัส:</span>
                {planConfig.quickFilters.map(f => {
                  const count = f.key === 'overdue' ? quickFilterCounts.overdue
                    : f.key === 'thisMonth' ? quickFilterCounts.thisMonth
                    : f.key === 'notStarted' ? statusCounts.not_started
                    : f.key === 'noEvidence' ? quickFilterCounts.noEvidence
                    : f.key === 'postponed' ? quickFilterCounts.postponed
                    : f.key === 'safetyOnly' ? quickFilterCounts.safetyOnly
                    : f.key === 'enviOnly' ? quickFilterCounts.enviOnly
                    : f.key === 'atRisk' ? quickFilterCounts.atRisk
                    : f.key === 'hasProgress' ? quickFilterCounts.hasProgress
                    : 0;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setQuickFilter(quickFilter === f.key ? 'none' : f.key)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                      style={{
                        background: quickFilter === f.key ? planConfig.accentBg : 'var(--bg-tertiary)',
                        color: quickFilter === f.key ? planConfig.accentColor : 'var(--text-secondary)',
                        border: `1px solid ${quickFilter === f.key ? planConfig.accentColor : 'var(--border)'}`,
                      }}
                    >
                      <f.Icon size={12} className="inline mr-1" />
                      {f.label}
                      <span className="ml-1 opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status Filter Tabs — labels change per tab personality */}
            <div className="flex flex-wrap gap-2 mb-4 animate-fade-in-up">
              {[
                { key: 'all', label: 'ทั้งหมด', color: 'var(--text-primary)', Icon: null as typeof Check | null },
                { key: 'done', label: planConfig.statusLabels.done, color: STATUS.ok, Icon: Check },
                { key: 'not_started', label: planConfig.statusLabels.not_started, color: planType === 'safety' ? STATUS.critical : STATUS.warning, Icon: Clock },
                { key: 'postponed', label: planConfig.statusLabels.postponed, color: STATUS.warning, Icon: Clock },
                { key: 'cancelled', label: planConfig.statusLabels.cancelled, color: PALETTE.textSecondary, Icon: Ban },
                { key: 'not_applicable', label: planConfig.statusLabels.not_applicable, color: PALETTE.muted, Icon: CircleSlash },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1"
                  style={{
                    background: statusFilter === f.key ? planConfig.accentColor : 'var(--bg-tertiary)',
                    color: statusFilter === f.key ? '#ffffff' : f.color,
                    border: `1px solid ${statusFilter === f.key ? planConfig.accentColor : 'var(--border)'}`
                  }}
                >
                  {f.Icon && <f.Icon size={12} />}
                  <span>{f.label}</span>
                  <span style={{ marginLeft: '0.375rem', opacity: 0.7 }}>
                    ({statusCounts[f.key as keyof typeof statusCounts]})
                  </span>
                </button>
              ))}
            </div>

            {/* Activity Table */}
            <div className="glass-card rounded-xl p-5 animate-fade-in-up" style={{ overflow: 'visible' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[13px] pl-3" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${planConfig.accentColor}` }}>
                    รายละเอียดกิจกรรม ({enhancedFilteredActivities.length} รายการ)
                  </h3>
                  {/* Filter by month */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>แสดงเดือน:</span>
                    <select
                      value={sortMonth}
                      onChange={e => setSortMonth(e.target.value)}
                      className="text-xs rounded px-2 py-1 focus:outline-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="none">ทั้งหมด</option>
                      {MONTH_KEYS.map((k, idx) => (
                        <option key={k} value={k}>{MONTH_LABELS[idx]}</option>
                      ))}
                    </select>
                  </div>
                  {/* Group by category toggle */}
                  <button
                    onClick={() => setGroupByCategory(!groupByCategory)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{ background: groupByCategory ? `${STATUS.warning}15` : 'var(--bg-hover)', color: groupByCategory ? STATUS.warning : 'var(--text-secondary)', border: groupByCategory ? `1px solid ${STATUS.warning}40` : '1px solid var(--border)' }}
                  >
                    {groupByCategory ? <FolderOpen size={11} className="inline" /> : <Folder size={11} className="inline" />} จัดกลุ่มตามหมวด
                  </button>
                </div>
                {/* Legend + Export */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="inline-flex items-center gap-0.5"><Check size={10} style={{ color: STATUS.ok }} /> เสร็จแล้ว</span>
                    <span className="inline-flex items-center gap-0.5"><CircleAlert size={10} style={{ color: STATUS.critical }} /> เกินกำหนด</span>
                    <span className="inline-flex items-center gap-0.5"><Circle size={10} style={{ color: PALETTE.muted }} /> มีแผน</span>
                    <span className="inline-flex items-center gap-0.5"><Clock size={10} style={{ color: STATUS.warning }} /> เลื่อน</span>
                    <span className="inline-flex items-center gap-0.5"><Ban size={10} style={{ color: PALETTE.textSecondary }} /> ยกเลิก</span>
                    <span className="inline-flex items-center gap-0.5"><CircleSlash size={10} style={{ color: PALETTE.muted }} /> ไม่เข้าเงื่อนไข</span>
                    <span><span className="inline-block w-2.5 h-2.5 ring-1 rounded-sm mr-0.5 align-middle" style={{ borderColor: STATUS.warning }}></span> แก้ไขจาก Dashboard</span>
                  </div>
                  <button
                    onClick={() => {
                      const statusMap: Record<string, string> = { done: 'เสร็จแล้ว', planned: 'มีแผน', overdue: 'เกินกำหนด', postponed: 'เลื่อน', cancelled: 'ยกเลิก', not_applicable: 'ไม่เข้าเงื่อนไข', not_planned: '-' };
                      const header = ['ลำดับ', planType === 'total' ? 'แผน' : '', 'กิจกรรม', 'ผู้รับผิดชอบ', ...MONTH_LABELS, 'ความก้าวหน้า'].filter(Boolean);
                      const rows = enhancedFilteredActivities.map(act => {
                        const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
                        const prog = activityProgress[`${prefix}${act.no}`];
                        const monthStatuses = MONTH_KEYS.map(mk => statusMap[getEffectiveStatus(act, mk)] || '-');
                        return [act.no, planType === 'total' ? ((act as any)._planTag === 'S' ? 'Safety' : 'Environment') : '', act.activity, getEffectiveResponsible(act), ...monthStatuses, prog ? `${prog.done}/${prog.total} (${prog.pct}%)` : '-'].filter((_, idx) => planType === 'total' || idx !== 1);
                      });
                      const csv = '\uFEFF' + [header.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `${companyId}-${planConfig.filterSummaryLabel}-${selectedYear}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80 flex-shrink-0"
                    style={{ background: planConfig.accentBg, color: planConfig.accentColor, border: `1px solid ${planConfig.accentColor}` }}
                    title="ดาวน์โหลด CSV"
                  >
                    <Download size={11} /> Export
                  </button>
                </div>
              </div>
              {enhancedFilteredActivities.length > 0 ? (
                <div>
                  <table className="apple-table w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 48 }} />{/* ลำดับ */}
                      {planType === 'total' && <col style={{ width: 30 }} />}{/* แผน S/E */}
                      <col style={{ width: '35%' }} />{/* กิจกรรม — 35% of table width */}
                      <col style={{ width: 52 }} />{/* ผู้รับผิดชอบ */}
                      {MONTH_KEYS.map(k => <col key={k} />)}{/* 12 months — share remaining space equally */}
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: `2px solid var(--border)` }}>
                        {/* sticky on each <th> for cross-browser support */}
                        <th className="text-left py-2 px-1 font-semibold text-[10px]" style={{ position: 'sticky', top: 0, zIndex: 20, color: 'var(--text-secondary)', background: 'var(--card-solid, #fff)', boxShadow: '0 -200px 0 200px var(--card-solid, #fff)', clipPath: 'inset(-200px -1px 0 -1px)' }}>ลำดับ</th>
                        {planType === 'total' && (
                          <th className="text-center py-2 px-0.5 font-semibold text-[10px]" style={{ position: 'sticky', top: 0, zIndex: 20, color: 'var(--text-secondary)', background: 'var(--card-solid, #fff)', boxShadow: '0 -200px 0 200px var(--card-solid, #fff)', clipPath: 'inset(-200px -1px 0 -1px)' }}>แผน</th>
                        )}
                        <th className="text-left py-2 px-1.5 font-semibold text-[10px]" style={{ position: 'sticky', top: 0, zIndex: 20, color: 'var(--text-secondary)', background: 'var(--card-solid, #fff)', boxShadow: '0 -200px 0 200px var(--card-solid, #fff)', clipPath: 'inset(-200px -1px 0 -1px)' }}>กิจกรรม</th>
                        <th className="text-left py-2 px-1 font-semibold text-[10px]" style={{ position: 'sticky', top: 0, zIndex: 20, color: 'var(--text-secondary)', background: 'var(--card-solid, #fff)', boxShadow: '0 -200px 0 200px var(--card-solid, #fff)', clipPath: 'inset(-200px -1px 0 -1px)' }}>ผู้รับ</th>
                        {MONTH_LABELS.map((m, idx) => (
                          <th
                            key={m}
                            className="text-center py-2 px-0 font-semibold text-[10px]"
                            style={{
                              position: 'sticky', top: 0, zIndex: 20,
                              color: idx === currentMonthIdx ? '#fff' : 'var(--text-secondary)',
                              background: idx === currentMonthIdx ? planConfig.accentColor : 'var(--card-solid, #fff)',
                              borderRadius: idx === currentMonthIdx ? '6px 6px 0 0' : '0',
                              boxShadow: `0 -200px 0 200px ${idx === currentMonthIdx ? planConfig.accentColor : 'var(--card-solid, #fff)'}`,
                              clipPath: 'inset(-200px -1px 0 -1px)'
                            }}
                          >
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Activity rows — with optional category grouping */}
                      {groupByCategory ? categoryGroups.flatMap(group => [
                        <tr key={`cat-header-${group.categoryNo}`}>
                          <td colSpan={planType === 'total' ? 16 : 15} className="py-2 px-3 text-[12px] font-bold" style={{ background: `${STATUS.warning}10`, color: STATUS.warning, borderBottom: `2px solid ${STATUS.warning}40` }}>
                            <span className="inline-flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: STATUS.warning }}>{group.categoryNo}</span>
                              {group.categoryGroup}
                              <span className="text-[10px] font-normal" style={{ color: PALETTE.muted }}>({group.activities.length} กิจกรรม)</span>
                            </span>
                          </td>
                        </tr>,
                        ...group.activities.map((act, i) => (
                        <tr key={`${(act as any)._planTag || ''}${act.no}-${i}`} style={{ borderBottom: `1px solid var(--border)`, transition: 'background 0.2s' }} className="hover:opacity-90">
                          <td className="py-2.5 px-1.5 text-xs" style={{ color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                            <div>{act.no}</div>
                            {(() => {
                              const overallSt = getEffectiveOverallStatus(act as Activity & { _planTag?: string });
                              const hasOverdueM = !act.isConditional && MONTH_KEYS.some((mk, idx) => {
                                if (idx >= currentMonthIdx) return false;
                                const s = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
                                return s === 'overdue' || s === 'planned';
                              });
                              const badgeCfg: Record<string, { label: string; Icon: typeof Check; bg: string; color: string }> = {
                                done: { label: 'เสร็จ', Icon: Check, bg: `${STATUS.ok}20`, color: STATUS.ok },
                                not_started: hasOverdueM
                                  ? { label: 'เสี่ยง', Icon: AlertTriangle, bg: `${STATUS.warning}25`, color: STATUS.warning }
                                  : { label: 'ดำเนินการ', Icon: Clock, bg: `${PALETTE.muted}20`, color: PALETTE.muted },
                                postponed: { label: 'เลื่อน', Icon: Clock, bg: `${STATUS.warning}20`, color: STATUS.warning },
                                cancelled: { label: 'ยกเลิก', Icon: Ban, bg: `${PALETTE.textSecondary}15`, color: PALETTE.textSecondary },
                                not_applicable: { label: 'N/A', Icon: CircleSlash, bg: `${PALETTE.muted}15`, color: PALETTE.muted },
                              };
                              const cfg = badgeCfg[overallSt];
                              if (!cfg) return null;
                              return (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[8px] font-semibold mt-0.5 whitespace-nowrap"
                                  style={{ background: cfg.bg, color: cfg.color }}>
                                  <cfg.Icon size={9} /> {cfg.label}
                                </span>
                              );
                            })()}
                          </td>
                          {planType === 'total' && (
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                                style={{
                                  background: (act as any)._planTag === 'S' ? `${CATEGORY_COLORS.safety}20` : `${CATEGORY_COLORS.environment}20`,
                                  color: (act as any)._planTag === 'S' ? CATEGORY_COLORS.safety : CATEGORY_COLORS.environment,
                                }}
                              >
                                {(act as any)._planTag === 'S' ? 'S' : 'E'}
                              </span>
                            </td>
                          )}
                          <td className="py-2 px-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            <div>{act.activity}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {(() => {
                                if (act.isConditional) return null;
                                const overdueMonths = MONTH_KEYS.filter(mk => getEffectiveStatus(act as Activity & { _planTag?: string }, mk) === 'overdue');
                                if (overdueMonths.length === 0) return null;
                                const labels = overdueMonths.map(mk => MONTH_LABELS[MONTH_KEYS.indexOf(mk)]).join(', ');
                                return (<span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium" style={{ background: `${STATUS.critical}15`, color: STATUS.critical }} title={`เกินกำหนด: ${labels}`}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: STATUS.critical }} />เกินกำหนด: {labels}</span>);
                              })()}
                            </div>
                            {(() => {
                              const activePMg = MONTH_KEYS.filter(mk => {
                                const s = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
                                return s !== 'not_planned' && s !== 'cancelled' && s !== 'not_applicable';
                              });
                              if (activePMg.length === 0) return null;
                              const donePMg = activePMg.filter(mk => getEffectiveStatus(act as Activity & { _planTag?: string }, mk) === 'done');
                              const pctG = Math.round((donePMg.length / activePMg.length) * 100);
                              const barColorG = pctG >= 75 ? STATUS.ok : pctG >= 25 ? STATUS.warning : STATUS.critical;
                              return (<div className="flex items-center gap-1.5 mt-1.5" title={`${donePMg.length}/${activePMg.length} เดือนเสร็จ (${pctG}%)`}><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)', maxWidth: 80 }}><div className="h-full rounded-full transition-all" style={{ width: `${pctG}%`, background: barColorG }} /></div><span className="text-[9px] font-medium" style={{ color: pctG >= 100 ? STATUS.ok : 'var(--muted)' }}>{donePMg.length}/{activePMg.length}</span></div>);
                            })()}
                          </td>
                          <td className="py-2.5 px-1.5 text-[11px] cursor-pointer truncate" style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => handleResponsibleClick(`${getOverridePrefix(act as Activity & { _planTag?: string })}${act.no}`, act.activity, getEffectiveResponsible(act))} title={getEffectiveResponsible(act)}>{getEffectiveResponsible(act)}</td>
                          {MONTH_KEYS.map((k, idx) => {
                            const effectiveStatus = getEffectiveStatus(act, k);
                            const hasOverride = overrides[`${getOverridePrefix(act)}${act.no}:${k}`] !== undefined;
                            const planMark = act.planMonths?.[k] || '';
                            const actualMark = act.actualMonths?.[k] || '';
                            const isCurrent = idx === currentMonthIdx;
                            const statusConfig: Record<MonthStatus, { Icon: typeof Check; color: string; title: string }> = {
                              not_planned: { Icon: Minus, color: 'var(--bg-hover)', title: 'ไม่มีแผน' },
                              planned: { Icon: Circle, color: PALETTE.muted, title: `แผน: ${planMark}` },
                              done: { Icon: Check, color: STATUS.ok, title: `เสร็จ: ${actualMark}` },
                              overdue: { Icon: CircleAlert, color: STATUS.critical, title: `เกินกำหนด (แผน: ${planMark})` },
                              postponed: { Icon: Clock, color: STATUS.warning, title: `เลื่อน: ${actualMark}` },
                              cancelled: { Icon: Ban, color: PALETTE.textSecondary, title: `ยกเลิก: ${actualMark}` },
                              not_applicable: { Icon: CircleSlash, color: PALETTE.muted, title: 'ไม่เข้าเงื่อนไข' },
                            };
                            const cfg = statusConfig[effectiveStatus];
                            const cellPrefix = getOverridePrefix(act as Activity & { _planTag?: string });
                            const attCount = attachmentCounts[`${cellPrefix}${act.no}:${k}`] || 0;
                            const hasNote = !!noteOverrides[`${cellPrefix}${act.no}:${k}`];
                            return (<td key={k} className="text-center py-2.5 px-0 cursor-pointer transition-colors relative" style={{ background: isCurrent ? `${PALETTE.primary}0F` : hasOverride ? `${STATUS.warning}12` : 'transparent', borderLeft: isCurrent ? `1px solid ${PALETTE.primary}25` : 'none', borderRight: isCurrent ? `1px solid ${PALETTE.primary}25` : 'none' }} onClick={() => handleCellClick(`${cellPrefix}${act.no}`, k, act.activity)}><span title={cfg.title}><cfg.Icon size={14} style={{ color: cfg.color, margin: '0 auto' }} /></span>{attCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold leading-none px-1" style={{ background: PALETTE.primary, color: '#fff' }}>{attCount}</span>}{hasNote && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 flex items-center justify-center rounded-full text-[8px] leading-none" style={{ background: STATUS.warning, color: '#fff' }}><Pencil size={7} /></span>}</td>);
                          })}
                        </tr>
                        ))
                      ]) : enhancedFilteredActivities.map((act, i) => (
                        <tr key={`${(act as any)._planTag || ''}${act.no}-${i}`} style={{ borderBottom: `1px solid var(--border)`, transition: 'background 0.2s' }} className="hover:opacity-90">
                          <td className="py-2.5 px-1.5 text-xs" style={{ color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                            <div>{act.no}</div>
                            {(() => {
                              const overallSt = getEffectiveOverallStatus(act as Activity & { _planTag?: string });
                              const hasOverdueM = !act.isConditional && MONTH_KEYS.some((mk, idx) => {
                                if (idx >= currentMonthIdx) return false;
                                const s = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
                                return s === 'overdue' || s === 'planned';
                              });
                              const badgeCfg: Record<string, { label: string; Icon: typeof Check; bg: string; color: string }> = {
                                done: { label: 'เสร็จ', Icon: Check, bg: `${STATUS.ok}20`, color: STATUS.ok },
                                not_started: hasOverdueM
                                  ? { label: 'เสี่ยง', Icon: AlertTriangle, bg: `${STATUS.warning}25`, color: STATUS.warning }
                                  : { label: 'ดำเนินการ', Icon: Clock, bg: `${PALETTE.muted}20`, color: PALETTE.muted },
                                postponed: { label: 'เลื่อน', Icon: Clock, bg: `${STATUS.warning}20`, color: STATUS.warning },
                                cancelled: { label: 'ยกเลิก', Icon: Ban, bg: `${PALETTE.textSecondary}15`, color: PALETTE.textSecondary },
                                not_applicable: { label: 'N/A', Icon: CircleSlash, bg: `${PALETTE.muted}15`, color: PALETTE.muted },
                              };
                              const cfg = badgeCfg[overallSt];
                              if (!cfg) return null;
                              return (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[8px] font-semibold mt-0.5 whitespace-nowrap"
                                  style={{ background: cfg.bg, color: cfg.color }}>
                                  <cfg.Icon size={9} /> {cfg.label}
                                </span>
                              );
                            })()}
                          </td>
                          {planType === 'total' && (
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                                style={{
                                  background: (act as any)._planTag === 'S' ? `${CATEGORY_COLORS.safety}20` : `${CATEGORY_COLORS.environment}20`,
                                  color: (act as any)._planTag === 'S' ? CATEGORY_COLORS.safety : CATEGORY_COLORS.environment,
                                }}
                              >
                                {(act as any)._planTag === 'S' ? 'S' : 'E'}
                              </span>
                            </td>
                          )}
                          <td className="py-2 px-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            <div>{act.activity}</div>
                            {/* Badges row: overdue + postponed + budget */}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {/* Overdue explanation badge */}
                              {(() => {
                                if (act.isConditional) return null;
                                const overdueMonths = MONTH_KEYS.filter(mk => getEffectiveStatus(act as Activity & { _planTag?: string }, mk) === 'overdue');
                                if (overdueMonths.length === 0) return null;
                                const labels = overdueMonths.map(mk => MONTH_LABELS[MONTH_KEYS.indexOf(mk)]).join(', ');
                                return (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium"
                                    style={{ background: `${STATUS.critical}15`, color: STATUS.critical }}
                                    title={`เกินกำหนด: ${labels} — ยังไม่มีผลดำเนินการ`}>
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: STATUS.critical }} />
                                    เกินกำหนด: {labels}
                                  </span>
                                );
                              })()}
                              {/* Postponed badge */}
                              {(() => {
                                const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
                                const postponedEntry = MONTH_KEYS.find(mk => {
                                  const key = `${prefix}${act.no}:${mk}`;
                                  return postponedOverrides[key] && (overrides[key] === 'postponed' || overrides[key] === 'done');
                                });
                                if (postponedEntry) {
                                  const key = `${prefix}${act.no}:${postponedEntry}`;
                                  const targetMonth = postponedOverrides[key];
                                  const fromLabel = MONTH_LABELS[MONTH_KEYS.indexOf(postponedEntry)];
                                  const toLabel = MONTH_LABELS[MONTH_KEYS.indexOf(targetMonth)];
                                  return (
                                    <span
                                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{ background: `${STATUS.warning}20`, color: STATUS.warning }}
                                      title={`เลื่อนจาก ${fromLabel} → ${toLabel}`}
                                    >
                                      เลื่อน → {toLabel}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {/* Budget badges */}
                              {(() => {
                                const bKey = `${getOverridePrefix(act as Activity & { _planTag?: string })}${act.no}`;
                                const actBudget = act.budget || 0;
                                const actActual = budgetOverrides[bKey]?.actual_cost || 0;
                                const overBudget = actActual > 0 && actBudget > 0 && actActual > actBudget;
                                if (actBudget <= 0 && actActual <= 0) return null;
                                return (
                                  <>
                                    {actBudget > 0 && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
                                        title="งบตามแผน"
                                      >
                                        <Wallet size={10} /> {actBudget.toLocaleString()}
                                      </span>
                                    )}
                                    {actActual > 0 && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                        style={{
                                          background: overBudget ? `${STATUS.critical}18` : `${STATUS.ok}18`,
                                          color: overBudget ? STATUS.critical : STATUS.ok,
                                        }}
                                        title={overBudget ? `ใช้จริง (เกินงบ ${Math.abs(actActual - actBudget).toLocaleString()})` : 'ใช้จริง'}
                                      >
                                        {overBudget ? <AlertTriangle size={10} /> : <Check size={10} />} ใช้จริง {actActual.toLocaleString()}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {/* Evidence indicator for Environment tab */}
                              {(planType === 'environment' || (planType === 'total' && (act as any)._planTag === 'E')) && (() => {
                                const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
                                const actKey = `${prefix}${act.no}`;
                                const indicator = evidenceIndicators[actKey];
                                if (indicator === 'attached') return (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                    style={{ background: `${STATUS.ok}18`, color: STATUS.ok }} title="แนบหลักฐานแล้ว">
                                    <Check size={10} /> แนบแล้ว
                                  </span>
                                );
                                if (indicator === 'missing') return (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold animate-pulse"
                                    style={{ background: `${STATUS.critical}18`, color: STATUS.critical }} title="ดำเนินการแล้วแต่ยังไม่แนบหลักฐาน">
                                    <AlertTriangle size={10} /> รอหลักฐาน
                                  </span>
                                );
                                if (indicator === 'required') return (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                    style={{ background: `${STATUS.warning}15`, color: STATUS.warning }} title="ต้องใช้หลักฐานเมื่อดำเนินการเสร็จ">
                                    <ClipboardList size={10} /> ต้องใช้หลักฐาน
                                  </span>
                                );
                                return null;
                              })()}
                              {/* Attachment & note summary badges */}
                              {(() => {
                                const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
                                let totalAtt = 0;
                                let totalNotes = 0;
                                MONTH_KEYS.forEach(mk => {
                                  totalAtt += attachmentCounts[`${prefix}${act.no}:${mk}`] || 0;
                                  if (noteOverrides[`${prefix}${act.no}:${mk}`]) totalNotes++;
                                });
                                return (
                                  <>
                                    {totalAtt > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ background: `${PALETTE.primary}15`, color: PALETTE.primary }}
                                        title={`${totalAtt} ไฟล์แนบ`}
                                      >
                                        <Paperclip size={10} /> {totalAtt}
                                      </span>
                                    )}
                                    {totalNotes > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ background: `${STATUS.warning}15`, color: STATUS.warning }}
                                        title={`${totalNotes} เดือนมีหมายเหตุ`}
                                      >
                                        <Pencil size={10} /> {totalNotes}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {/* Evidence tier badge */}
                              {(() => {
                                const prefix = getOverridePrefix(act as Activity & { _planTag?: string });
                                const actKey = `${prefix}${act.no}`;
                                const tier = evidenceTiers[actKey];
                                if (!tier || tier.tier === 'none') return null;
                                const tierConfig = {
                                  basic: { label: 'Basic', Icon: CircleDashed, bg: `${STATUS.warning}15`, color: STATUS.warning },
                                  standard: { label: 'Standard', Icon: CircleDot, bg: `${PALETTE.primary}15`, color: PALETTE.primary },
                                  full: { label: 'Full', Icon: CircleCheckBig, bg: `${STATUS.ok}15`, color: STATUS.ok },
                                };
                                const cfg = tierConfig[tier.tier];
                                return (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                    style={{ background: cfg.bg, color: cfg.color }} title={tier.details}>
                                    <cfg.Icon size={10} /> {cfg.label}
                                  </span>
                                );
                              })()}
                            </div>
                            {/* Mini progress bar */}
                            {(() => {
                              const activePM = MONTH_KEYS.filter(mk => {
                                const s = getEffectiveStatus(act as Activity & { _planTag?: string }, mk);
                                return s !== 'not_planned' && s !== 'cancelled' && s !== 'not_applicable';
                              });
                              if (activePM.length === 0) return null;
                              const donePM = activePM.filter(mk => getEffectiveStatus(act as Activity & { _planTag?: string }, mk) === 'done');
                              const pct = Math.round((donePM.length / activePM.length) * 100);
                              const barColor = pct >= 75 ? STATUS.ok : pct >= 25 ? STATUS.warning : STATUS.critical;
                              return (
                                <div className="flex items-center gap-1.5 mt-1.5" title={`${donePM.length}/${activePM.length} เดือนเสร็จ (${pct}%)`}>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)', maxWidth: 80 }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                                  </div>
                                  <span className="text-[9px] font-medium" style={{ color: pct >= 100 ? STATUS.ok : 'var(--muted)' }}>{donePM.length}/{activePM.length}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td
                            className="py-2.5 px-2 text-xs cursor-pointer transition-colors"
                            style={{
                              color: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? STATUS.warning : 'var(--text-secondary)',
                              border: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? `1px solid ${STATUS.warning}4D` : 'none',
                              borderRadius: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? '4px' : '0px',
                              padding: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? '2px 5px' : '10px 8px'
                            }}
                            onClick={() => handleResponsibleClick(`${getOverridePrefix(act as Activity & { _planTag?: string })}${act.no}`, act.activity, getEffectiveResponsible(act))}
                            title="คลิกเพื่อเปลี่ยนผู้รับผิดชอบ"
                          >
                            {getEffectiveResponsible(act)}
                          </td>
                          {/* Budget info moved to badges under activity name */}
                          {MONTH_KEYS.map((k, idx) => {
                            const effectiveStatus = getEffectiveStatus(act, k);
                            const hasOverride = overrides[`${getOverridePrefix(act)}${act.no}:${k}`] !== undefined;
                            const planMark = act.planMonths?.[k] || '';
                            const actualMark = act.actualMonths?.[k] || '';
                            const isCurrent = idx === currentMonthIdx;

                            const statusConfig: Record<MonthStatus, { Icon: typeof Check; color: string; title: string }> = {
                              not_planned: { Icon: Minus, color: 'var(--bg-hover)', title: 'ไม่มีแผน' },
                              planned: { Icon: Circle, color: PALETTE.muted, title: `แผน: ${planMark}` },
                              done: { Icon: Check, color: STATUS.ok, title: `เสร็จ: ${actualMark}` },
                              overdue: { Icon: CircleAlert, color: STATUS.critical, title: `เกินกำหนด (แผน: ${planMark})` },
                              postponed: { Icon: Clock, color: STATUS.warning, title: `เลื่อน: ${actualMark}` },
                              cancelled: { Icon: Ban, color: PALETTE.textSecondary, title: `ยกเลิก: ${actualMark}` },
                              not_applicable: { Icon: CircleSlash, color: PALETTE.muted, title: 'ไม่เข้าเงื่อนไข' },
                            };
                            const cfg = statusConfig[effectiveStatus];

                            const cellPrefix = getOverridePrefix(act as Activity & { _planTag?: string });
                            const attCount = attachmentCounts[`${cellPrefix}${act.no}:${k}`] || 0;
                            const hasNote = !!noteOverrides[`${cellPrefix}${act.no}:${k}`];

                            return (
                              <td
                                key={k}
                                className="text-center py-2.5 px-0 cursor-pointer transition-colors relative"
                                style={{
                                  background: isCurrent ? `${PALETTE.primary}0F` : hasOverride ? `${STATUS.warning}12` : 'transparent',
                                  borderLeft: isCurrent ? `1px solid ${PALETTE.primary}25` : 'none',
                                  borderRight: isCurrent ? `1px solid ${PALETTE.primary}25` : 'none',
                                  border: hasOverride && !isCurrent ? `1px solid ${STATUS.warning}4D` : undefined,
                                  borderRadius: hasOverride && !isCurrent ? '4px' : '0px'
                                }}
                                onClick={() => handleCellClick(`${cellPrefix}${act.no}`, k, act.activity)}
                              >
                                <span title={cfg.title}><cfg.Icon size={14} style={{ color: cfg.color, margin: '0 auto' }} /></span>
                                {attCount > 0 && (
                                  <span
                                    className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold leading-none px-1"
                                    style={{ background: PALETTE.primary, color: '#fff' }}
                                    title={`${attCount} ไฟล์แนบ`}
                                  >
                                    {attCount}
                                  </span>
                                )}
                                {hasNote && (
                                  <span
                                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 flex items-center justify-center rounded-full text-[8px] leading-none"
                                    style={{ background: STATUS.warning, color: '#fff' }}
                                    title="มีหมายเหตุ"
                                  >
                                    <Pencil size={7} />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
                  <ClipboardList size={36} className="mx-auto mb-3" style={{ color: PALETTE.muted }} />
                  <p>ไม่พบกิจกรรม{statusFilter !== 'all' ? 'ในสถานะที่เลือก' : ''}</p>
                  <p className="text-[11px] mt-1">ลองเปลี่ยน Filter หรือเลือก Plan Type อื่น</p>
                </div>
              )}
            </div>
            {/* Responsible Summary — workload per person */}
            {responsibleStats.length > 0 && (
              <div className="glass-card rounded-xl p-5 mt-5 animate-fade-in-up">
                <h3 className="text-[13px] font-medium mb-3 pl-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${planConfig.accentColor}` }}>
                  <Users size={14} /> ภาระงานตามผู้รับผิดชอบ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {responsibleStats.map(person => {
                    const pctDone = person.total > 0 ? Math.round((person.done / person.total) * 100) : 0;
                    return (
                      <div key={person.name} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: person.overdue > 0 ? `linear-gradient(135deg, ${STATUS.critical}, ${CATEGORY_COLORS.safety})` : pctDone >= 100 ? `linear-gradient(135deg, ${STATUS.ok}, #76B7B2)` : `linear-gradient(135deg, ${PALETTE.primary}, #76B7B2)` }}>
                          {person.name.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{person.name}</div>
                          <div className="flex items-center gap-2 text-[10px] mt-0.5">
                            <span style={{ color: 'var(--muted)' }}>{person.total} งาน</span>
                            {person.done > 0 && <span className="inline-flex items-center gap-0.5" style={{ color: STATUS.ok }}><Check size={9} /> {person.done}</span>}
                            {person.overdue > 0 && <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: STATUS.critical }}><AlertTriangle size={9} /> ค้าง {person.overdue}</span>}
                            {person.open > 0 && <span style={{ color: 'var(--muted)' }}>เปิด {person.open}</span>}
                          </div>
                          <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pctDone}%`, background: pctDone >= 100 ? STATUS.ok : pctDone >= 50 ? STATUS.warning : STATUS.critical }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Budget + Responsible Summary — Total mode only, at bottom */}
        {planType === 'total' && effectiveSummary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-fade-in-up">
            {/* Budget Breakdown */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[13px] font-medium mb-3 pl-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${PALETTE.primary}` }}>
                <DollarSign size={14} /> งบประมาณ
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--muted)' }}>รวมทั้งหมด</span>
                  <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {(effectiveSummary.budget || 0).toLocaleString()} ฿
                  </span>
                </div>
                {effectiveSummary.safetyBudget !== undefined && (
                  <>
                    <div className="h-px" style={{ background: 'var(--border)' }} />
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS.safety }}></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Safety</span>
                      </span>
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {(effectiveSummary.safetyBudget || 0).toLocaleString()} ฿
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS.environment }}></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Environment</span>
                      </span>
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {(effectiveSummary.enviBudget || 0).toLocaleString()} ฿
                      </span>
                    </div>
                    {/* Stacked bar */}
                    <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      {effectiveSummary.budget > 0 && (
                        <>
                          <div style={{ width: `${((effectiveSummary.safetyBudget || 0) / effectiveSummary.budget) * 100}%`, background: CATEGORY_COLORS.safety }} />
                          <div style={{ width: `${((effectiveSummary.enviBudget || 0) / effectiveSummary.budget) * 100}%`, background: CATEGORY_COLORS.environment }} />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Responsible Summary */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[13px] font-medium mb-3 pl-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderLeft: `2px solid ${PALETTE.primary}` }}>
                <Users size={14} /> ผู้รับผิดชอบกิจกรรม
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {(() => {
                  const respMap: Record<string, { total: number; doneNA: number }> = {};
                  activities.forEach(act => {
                    const name = getEffectiveResponsible(act as Activity & { _planTag?: string }).trim() || 'ไม่ระบุ';
                    if (!respMap[name]) respMap[name] = { total: 0, doneNA: 0 };
                    // Count month-slots for this person within active time range
                    activeMonthKeys.forEach(k => {
                      const status = getEffectiveStatus(act, k);
                      if (status === 'not_planned') return;
                      respMap[name].total++;
                      if (status === 'done' || status === 'not_applicable') {
                        respMap[name].doneNA++;
                      }
                    });
                  });
                  const sorted = Object.entries(respMap).sort((a, b) => b[1].total - a[1].total);
                  if (sorted.length === 0) return <p className="text-[12px]" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูล</p>;
                  return sorted.map(([name, { total, doneNA }]) => {
                    const pct = total > 0 ? Math.round((doneNA / total) * 100) : 0;
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] truncate flex-1 mr-2" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px]" style={{ color: STATUS.ok }}>
                              {doneNA}/{total}
                            </span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                              background: pct >= 80 ? `${STATUS.ok}20` : pct >= 50 ? `${STATUS.warning}20` : `${STATUS.critical}15`,
                              color: pct >= 80 ? STATUS.ok : pct >= 50 ? STATUS.warning : STATUS.critical,
                            }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                          <div style={{ width: `${pct}%`, background: pct >= 80 ? STATUS.ok : pct >= 50 ? STATUS.warning : STATUS.critical, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowLoginModal(false)}>
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm" style={{ backdropFilter: 'blur(40px)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}><Key size={14} className="inline mr-1" /> เข้าสู่ระบบ</h3>
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>กรอกรหัสผ่านของ <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{companyName}</span> เพื่อแก้ไขสถานะ</p>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                autoFocus
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="รหัสผ่าน"
                className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              {loginError && <p style={{ color: STATUS.critical }} className="text-xs mb-3">{loginError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleLogin}
                  className="btn-primary flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activity Drawer — Right-Side Sheet */}
        {(() => {
          const modalAct = editingCell ? activities.find(a => a.no === editingCell.actNo || `${(a as any)._planTag}:${a.no}` === editingCell.actNo) : null;
          const modalBudget = modalAct?.budget || 0;
          const budgetKey = editingCell?.actNo || '';
          const modalActualCost = budgetOverrides[budgetKey]?.actual_cost || 0;
          const modalResponsible = modalAct ? getEffectiveResponsible(modalAct as Activity & { _planTag?: string }) : '-';
          const overrideKey = editingCell ? `${editingCell.actNo}:${editingCell.month}` : '';
          const currentCellStatus = editingCell && modalAct ? getEffectiveStatus(modalAct, editingCell.month) : ('not_planned' as MonthStatus);
          const prefix = editingCell ? ((modalAct as any)?._planTag ? `${(modalAct as any)._planTag}:` : '') : '';
          const cellAttCount = editingCell ? (attachmentCounts[`${prefix}${(modalAct?.no || '')}:${editingCell.month}`] || 0) : 0;

          return (
            <ActivityDrawer
              isOpen={showStatusModal}
              editingCell={editingCell}
              activity={modalAct as (Activity & { _planTag?: string }) | null}
              planType={planType === 'total' ? 'total' : planType}
              companyId={companyId}
              selectedYear={selectedYear}
              currentStatus={currentCellStatus}
              overrideKey={overrideKey}
              hasOverride={!!overrides[overrideKey]}
              statusNote={statusNote}
              noteOverride={noteOverrides[overrideKey] || ''}
              savingStatus={savingStatus}
              savingNote={savingNote}
              deadlineLocked={deadlineLocked}
              hasApproval={hasApproval}
              checkingLock={checkingLock}
              isAdmin={auth.isAdmin}
              modalBudget={modalBudget}
              modalActualCost={modalActualCost}
              editingActualCost={editingActualCost}
              savingBudget={savingBudget}
              modalResponsible={modalResponsible}
              attachments={attachments}
              loadingAttachments={loadingAttachments}
              uploadingFile={uploadingFile}
              deletingAttId={deletingAttId}
              attachmentCount={cellAttCount}
              isLoggedIn={isLoggedIn}
              loginDisplayName={loginDisplayName}
              loginCompanyName={loginCompanyName}
              activityList={enhancedFilteredActivities as (Activity & { _planTag?: string })[]}
              currentIndex={drawerActivityIndex}
              onClose={handleCloseDrawer}
              onSaveStatus={handleSaveStatus}
              onRevertStatus={handleRevertStatus}
              onSaveNote={handleSaveNote}
              onSaveBudget={handleSaveBudget}
              onSetEditingActualCost={setEditingActualCost}
              onSetStatusNote={setStatusNote}
              onUploadFile={handleUploadFile}
              onDeleteAttachment={handleDeleteAttachment}
              onAddExternalLink={async (url, title) => {
                if (!editingCell) return;
                const actualPT2 = planType === 'total'
                  ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
                  : planType;
                const actualAN2 = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
                await fetch('/api/attachments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ companyId, planType: actualPT2, activityNo: actualAN2, month: editingCell.month, uploadedBy: loginDisplayName || loginCompanyName, linkUrl: url, linkTitle: title }),
                });
                fetchAttachments(editingCell.actNo, editingCell.month);
              }}
              onNavigate={handleDrawerNavigate}
              onClickResponsible={handleResponsibleClick}
              onRequestEdit={handleSubmitEditRequest}
              onRequestCancellation={handleRequestCancellation}
              pendingCancellationStatus={(() => {
                if (!editingCell) return null;
                const actualPT = planType === 'total' ? (editingCell.actNo.startsWith('S:') ? 'safety' : 'environment') : planType;
                const actualAN = planType === 'total' ? editingCell.actNo.replace(/^[SE]:/, '') : editingCell.actNo;
                return pendingCancellations[`${actualPT}:${actualAN}:${editingCell.month}`] || null;
              })()}
            />
          );
        })()}

        {/* Responsible Edit Modal */}
        {showResponsibleModal && editingResponsible && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowResponsibleModal(false); setEditingResponsible(null); }}>
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm" style={{ backdropFilter: 'blur(40px)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>เปลี่ยนผู้รับผิดชอบ</h3>
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>
                กิจกรรม: <span style={{ color: 'var(--text-primary)' }}>{editingResponsible.actNo}</span>
              </p>
              <input
                type="text"
                value={newResponsible}
                onChange={e => setNewResponsible(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveResponsible()}
                placeholder="ชื่อผู้รับผิดชอบ"
                className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                autoFocus
              />

              {responsibleOverrides[editingResponsible.actNo] && (
                <button
                  onClick={handleRevertResponsible}
                  disabled={savingStatus}
                  className="w-full px-3 py-2 rounded-lg text-xs transition-colors mb-3"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  ↩ กลับไปใช้ค่าจาก Sheet ({activities.find(a => a.no === editingResponsible.actNo)?.responsible})
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowResponsibleModal(false); setEditingResponsible(null); }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveResponsible}
                  disabled={savingStatus || !newResponsible.trim()}
                  className="btn-primary flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ opacity: savingStatus || !newResponsible.trim() ? 0.5 : 1 }}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
