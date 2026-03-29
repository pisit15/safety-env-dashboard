'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';

import { Search, Key, Download, BarChart3, Shield, Leaf, LogOut, Users, DollarSign, Calendar } from 'lucide-react';
import { MonthlyProgressChart } from '@/components/Charts';
import { Activity, CompanySummary, MonthStatus } from '@/lib/types';
import { useAuth } from '@/components/AuthContext';
import { AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from '@/lib/companies';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_OPTIONS: { value: MonthStatus; label: string; icon: string; color: string }[] = [
  { value: 'done', label: 'เสร็จแล้ว', icon: '●', color: 'var(--success)' },
  { value: 'overdue', label: 'เกินกำหนด', icon: '○', color: 'var(--danger)' },
  { value: 'planned', label: 'มีแผน', icon: '○', color: 'var(--muted)' },
  { value: 'postponed', label: 'เลื่อน', icon: '◐', color: 'var(--info)' },
  { value: 'cancelled', label: 'ยกเลิก', icon: '✕', color: 'var(--danger)' },
  { value: 'not_applicable', label: 'ไม่เข้าเงื่อนไข', icon: '⊘', color: 'var(--muted)' },
  { value: 'not_planned', label: 'ไม่มีแผน', icon: '-', color: 'var(--bg-hover)' },
];

interface StatusOverride {
  activity_no: string;
  month: string;
  status: string;
  note?: string;
}

interface ResponsibleOverride {
  activity_no: string;
  responsible: string;
}

export default function CompanyDrilldown() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const [planType, setPlanType] = useState<'safety' | 'environment' | 'total'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('company_planType');
      if (saved === 'safety' || saved === 'environment' || saved === 'total') return saved;
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
  const [statusNote, setStatusNote] = useState('');

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

  // Attachment count per cell (for indicator dots)
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  // Deadline lock state
  const [deadlineLocked, setDeadlineLocked] = useState(false);
  const [hasApproval, setHasApproval] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);

  // Edit request state
  const [showEditRequestForm, setShowEditRequestForm] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

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

  // Fetch activities
  useEffect(() => {
    setLoading(true);
    if (planType === 'total') {
      // Fetch both safety and environment, merge summaries
      Promise.all([
        fetch(`/api/company?id=${companyId}&plan=safety&year=${selectedYear}`).then(r => r.json()),
        fetch(`/api/company?id=${companyId}&plan=environment&year=${selectedYear}`).then(r => r.json()),
      ]).then(([safetyData, enviData]) => {
        const s1 = safetyData.summary;
        const s2 = enviData.summary;
        if (s1 && s2) {
          const merged: CompanySummary = {
            companyId: s1.companyId,
            companyName: s1.companyName,
            shortName: s1.shortName,
            total: (s1.total || 0) + (s2.total || 0),
            done: (s1.done || 0) + (s2.done || 0),
            notStarted: (s1.notStarted || 0) + (s2.notStarted || 0),
            postponed: (s1.postponed || 0) + (s2.postponed || 0),
            cancelled: (s1.cancelled || 0) + (s2.cancelled || 0),
            notApplicable: (s1.notApplicable || 0) + (s2.notApplicable || 0),
            budget: (s1.budget || 0) + (s2.budget || 0),
            safetyBudget: s1.budget || 0,
            enviBudget: s2.budget || 0,
            pctDone: 0,
            monthlyProgress: s1.monthlyProgress?.map((m: any, i: number) => {
              const m2 = s2.monthlyProgress?.[i] || { planned: 0, completed: 0 };
              const planned = (m.planned || 0) + (m2.planned || 0);
              const completed = (m.completed || 0) + (m2.completed || 0);
              return {
                ...m,
                planned,
                completed,
                pctComplete: planned > 0 ? Math.round((completed / planned) * 100) : 0,
              };
            }),
          };
          merged.pctDone = merged.total > 0 ? Math.round((merged.done / merged.total) * 100) : 0;
          setSummary(merged);
        } else {
          setSummary(s1 || s2 || null);
        }
        // Merge activities from both — add _planTag to prevent override key collisions
        const safetyActs = (safetyData.activities || []).map((a: Activity) => ({ ...a, _planTag: 'S' }));
        const enviActs = (enviData.activities || []).map((a: Activity) => ({ ...a, _planTag: 'E' }));
        const allActs = [...safetyActs, ...enviActs];
        setActivities(allActs);
        setLoading(false);
      }).catch(() => {
        setActivities([]);
        setSummary(null);
        setLoading(false);
      });
    } else {
      fetch(`/api/company?id=${companyId}&plan=${planType}&year=${selectedYear}`)
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
    }
  }, [companyId, planType, selectedYear]);

  // Fetch status overrides from Supabase
  const fetchOverrides = useCallback(() => {
    if (planType === 'total') {
      // Fetch both safety and environment overrides
      Promise.all([
        fetch(`/api/status?companyId=${companyId}&planType=safety`).then(r => r.json()),
        fetch(`/api/status?companyId=${companyId}&planType=environment`).then(r => r.json()),
      ]).then(([s, e]) => {
        const map: Record<string, string> = {};
        const nMap: Record<string, string> = {};
        // Prefix with S:/E: to match _planTag in Total mode
        (s.overrides || []).forEach((o: StatusOverride) => {
          map[`S:${o.activity_no}:${o.month}`] = o.status;
          if (o.note) nMap[`S:${o.activity_no}:${o.month}`] = o.note;
        });
        (e.overrides || []).forEach((o: StatusOverride) => {
          map[`E:${o.activity_no}:${o.month}`] = o.status;
          if (o.note) nMap[`E:${o.activity_no}:${o.month}`] = o.note;
        });
        setOverrides(map);
        setNoteOverrides(nMap);
      }).catch(() => {});
    } else {
      fetch(`/api/status?companyId=${companyId}&planType=${planType}`)
        .then(res => res.json())
        .then(data => {
          const map: Record<string, string> = {};
          const nMap: Record<string, string> = {};
          (data.overrides || []).forEach((o: StatusOverride) => {
            map[`${o.activity_no}:${o.month}`] = o.status;
            if (o.note) nMap[`${o.activity_no}:${o.month}`] = o.note;
          });
          setOverrides(map);
          setNoteOverrides(nMap);
        })
        .catch(() => {});
    }
  }, [companyId, planType, selectedYear]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Fetch responsible overrides from Supabase
  const fetchResponsibleOverrides = useCallback(() => {
    if (planType === 'total') {
      Promise.all([
        fetch(`/api/responsible?companyId=${companyId}&planType=safety`).then(r => r.json()),
        fetch(`/api/responsible?companyId=${companyId}&planType=environment`).then(r => r.json()),
      ]).then(([s, e]) => {
        const map: Record<string, string> = {};
        // Prefix with S:/E: to match _planTag in Total mode
        (s.overrides || []).forEach((o: ResponsibleOverride) => {
          map[`S:${o.activity_no}`] = o.responsible;
        });
        (e.overrides || []).forEach((o: ResponsibleOverride) => {
          map[`E:${o.activity_no}`] = o.responsible;
        });
        setResponsibleOverrides(map);
      }).catch(() => {});
    } else {
      fetch(`/api/responsible?companyId=${companyId}&planType=${planType}`)
        .then(res => res.json())
        .then(data => {
          const map: Record<string, string> = {};
          (data.overrides || []).forEach((o: ResponsibleOverride) => {
            map[o.activity_no] = o.responsible;
          });
          setResponsibleOverrides(map);
        })
        .catch(() => {});
    }
  }, [companyId, planType, selectedYear]);

  useEffect(() => {
    fetchResponsibleOverrides();
  }, [fetchResponsibleOverrides]);

  const companyName = summary?.companyName || companyId.toUpperCase();
  const currentMonthIdx = new Date().getMonth();

  // Get effective month status (override > auto)
  // In Total mode, activities have _planTag ('S' or 'E') and overrides use 'S:no:month' / 'E:no:month'
  const getEffectiveStatus = (act: Activity & { _planTag?: string }, monthKey: string): MonthStatus => {
    const prefix = (act as any)._planTag ? `${(act as any)._planTag}:` : '';
    const overrideKey = `${prefix}${act.no}:${monthKey}`;
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
      let doneCount = 0;
      let overdueCount = 0;
      let postponedCount = 0;
      let notApplicableCount = 0;
      activities.forEach(act => {
        const status = getEffectiveStatus(act, k);
        if (status === 'not_applicable') {
          notApplicableCount++;
          // ยกประโยชน์ให้ — นับ not_applicable เป็น planned + completed ด้วย
          planned++;
          completed++;
        } else if (status !== 'not_planned') {
          planned++;
          if (status === 'done') { completed++; doneCount++; }
          else if (status === 'overdue') { overdueCount++; }
          else if (status === 'postponed') { postponedCount++; }
        }
      });
      return {
        ...base,
        planned,
        completed,
        pctComplete: planned > 0 ? Math.round((completed / planned) * 100) : 0,
        doneCount,
        overdueCount,
        postponedCount,
        notApplicableCount,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, summary?.monthlyProgress]);

  // Filter activities by status and month
  const filteredActivities = useMemo(() => {
    let list = statusFilter === 'all'
      ? [...activities]
      : activities.filter(a => a.status === statusFilter);

    if (sortMonth !== 'none') {
      list = list.filter(act => {
        const status = getEffectiveStatus(act, sortMonth);
        return status !== 'not_planned';
      });
    }

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, statusFilter, sortMonth, overrides]);

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
        const status = getEffectiveStatus(act, k);
        if (status === 'not_planned') return;

        totalPlanned++;
        if (status === 'not_applicable') {
          totalNotApplicable++; // แยกต่างหาก ไม่รวมใน done
        } else if (status === 'done') {
          totalDone++;
        } else if (status === 'postponed') {
          totalPostponed++;
        } else if (status === 'cancelled') {
          totalCancelled++;
        }
        // else: planned, overdue → notStarted
      });
    });

    // done = เสร็จจริง, N/A = แยก, % = (done + N/A) / total → ยกประโยชน์ให้
    const totalNotStarted = Math.max(0, totalPlanned - totalDone - totalNotApplicable - totalPostponed - totalCancelled);
    const pctDone = totalPlanned > 0
      ? Math.round(((totalDone + totalNotApplicable) / totalPlanned) * 1000) / 10
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, overrides, summary, activeMonthKeys]);

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
  const handleSaveStatus = async (newStatus: MonthStatus) => {
    if (!editingCell) return;
    // Determine actual planType for total mode
    const actualPlanType = planType === 'total'
      ? (editingCell.actNo.startsWith('S:') ? 'safety' : editingCell.actNo.startsWith('E:') ? 'environment' : planType)
      : planType;
    const actualActNo = editingCell.actNo.replace(/^[SE]:/, '');
    setSavingStatus(true);
    try {
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: actualPlanType,
          activityNo: actualActNo,
          month: editingCell.month,
          status: newStatus,
          note: statusNote,
          updatedBy: loginDisplayName || loginCompanyName,
        }),
      });
      // Update local state
      const key = `${editingCell.actNo}:${editingCell.month}`;
      setOverrides(prev => ({ ...prev, [key]: newStatus }));
      setNoteOverrides(prev => ({ ...prev, [key]: statusNote }));
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
    setShowEditRequestForm(false);
    setEditRequestReason('');
    // Load existing note for this cell
    setStatusNote(noteOverrides[`${actNo}:${month}`] || '');
    // Fetch attachments and deadline lock in parallel
    fetchAttachments(actNo, month);
    checkDeadlineLock(actNo, month);
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
      await fetch('/api/responsible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType,
          activityNo: editingResponsible.actNo,
          responsible: newResponsible.trim(),
          updatedBy: loginDisplayName || loginCompanyName,
        }),
      });
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
      const res = await fetch(`/api/attachments?companyId=${companyId}&planType=${planType}&activityNo=${actNo}&month=${month}`);
      const data = await res.json();
      const atts = data.attachments || [];
      setAttachments(atts);
      // Update count for cell indicator
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
      const res = await fetch(`/api/deadlines?month=${month}&companyId=${companyId}&planType=${planType}&activityNo=${actNo}`);
      const data = await res.json();
      setDeadlineLocked(data.isLocked || false);
      setHasApproval(data.hasApproval || false);
    } catch {
      setDeadlineLocked(false);
      setHasApproval(false);
    }
    setCheckingLock(false);
  };

  // Upload evidence file
  const handleUploadFile = async (file: File) => {
    if (!editingCell) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('planType', planType);
      formData.append('activityNo', editingCell.actNo);
      formData.append('month', editingCell.month);
      formData.append('uploadedBy', loginDisplayName || loginCompanyName);

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        // Refresh attachments
        fetchAttachments(editingCell.actNo, editingCell.month);
      } else {
        alert(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    }
    setUploadingFile(false);
  };

  // Submit edit request for locked month
  const handleSubmitEditRequest = async () => {
    if (!editingCell || !editRequestReason.trim()) return;
    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType,
          activityNo: editingCell.actNo,
          month: editingCell.month,
          reason: editRequestReason.trim(),
          requestedBy: loginDisplayName || loginCompanyName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('ส่งคำขอแก้ไขเรียบร้อย รอ Admin อนุมัติ');
        setShowEditRequestForm(false);
        setEditRequestReason('');
      } else {
        alert(data.error || 'ส่งคำขอไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSubmittingRequest(false);
  };

  // ── View Gate: require login to see company data ──
  if (!isLoggedIn && !auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 w-full max-w-sm text-center" style={{ backdropFilter: 'blur(40px)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--info) 100%)' }}>
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
            {loginError && <p style={{ color: 'var(--danger)' }} className="text-xs mb-3">{loginError}</p>}
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
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
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <Search size={16} className="inline mr-1" /> {companyName} — {planType === 'total' ? 'ภาพรวมแผนงาน' : `แผนงาน${planType === 'safety' ? 'ความปลอดภัย' : 'สิ่งแวดล้อม'}`} {selectedYear}
          </h1>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Auth indicator */}
            {isLoggedIn ? (
              <span className="glass-card px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--success)' }}>
                ✓ {loginDisplayName || loginCompanyName}
              </span>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="glass-card px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--warning)' }}
              >
                <Key size={14} className="inline mr-1" /> เข้าสู่ระบบเพื่อแก้ไข
              </button>
            )}
            {/* Export button */}
            <button
              onClick={handleExport}
              className="btn-primary px-3 py-1.5 rounded-xl text-xs font-medium"
            >
              <Download size={14} className="inline mr-1" /> Export .xlsx
            </button>
            <div style={{ background: 'var(--border)' }} className="rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setPlanType('total')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'total'
                  ? { background: 'var(--accent)', color: '#ffffff' }
                  : { color: 'var(--muted)' }}
              >
                <BarChart3 size={14} className="inline mr-1" /> Total
              </button>
              <button
                onClick={() => setPlanType('safety')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'safety'
                  ? { background: 'var(--accent)', color: '#ffffff' }
                  : { color: 'var(--muted)' }}
              >
                <Shield size={14} className="inline mr-1" /> Safety
              </button>
              <button
                onClick={() => setPlanType('environment')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={planType === 'environment'
                  ? { background: 'var(--accent)', color: '#ffffff' }
                  : { color: 'var(--muted)' }}
              >
                <Leaf size={14} className="inline mr-1" /> Environment
              </button>
            </div>
            {/* Year selector */}
            <div style={{ background: 'var(--border)' }} className="rounded-xl p-1 flex gap-1">
              {AVAILABLE_YEARS.map(y => {
                const isActive = ACTIVE_YEARS.includes(y);
                return (
                  <button
                    key={y}
                    onClick={() => isActive && setSelectedYear(y)}
                    disabled={!isActive}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={selectedYear === y
                      ? { background: '#ff9500', color: '#ffffff' }
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
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 mb-5 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
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
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(10,132,255,0.3)' }
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
              background: MONTH_KEYS.includes(timeRange) ? 'var(--accent)' : 'var(--bg-tertiary)',
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
            <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,149,0,0.1)', color: '#ff9500' }}>
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
            {/* KPI Cards — use effectiveSummary which includes override data */}
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-6 animate-fade-in-up">
              <KPICard label="กิจกรรมทั้งหมด" value={effectiveSummary?.total || 0} />
              <KPICard label="เสร็จแล้ว" value={effectiveSummary?.done || 0} color="var(--success)" progress={effectiveSummary?.pctDone || 0} delta={`${effectiveSummary?.pctDone || 0}%`} />
              <KPICard label="ยังไม่เริ่ม" value={effectiveSummary?.notStarted || 0} color="var(--warning)" />
              <KPICard label="เลื่อน" value={effectiveSummary?.postponed || 0} color="var(--info)" />
              <KPICard label="ยกเลิก" value={effectiveSummary?.cancelled || 0} color="var(--danger)" />
              <KPICard label="ไม่เข้าเงื่อนไข" value={effectiveSummary?.notApplicable || 0} color="var(--muted)" />
              <KPICard label="งบประมาณ" value={effectiveSummary?.budget ? effectiveSummary.budget.toLocaleString() : '-'} color="var(--accent)" subtext="บาท" />
            </div>

            {/* Budget + Responsible moved to bottom — Total mode only */}

            {/* Monthly Progress */}
            {effectiveMonthlyProgress && effectiveMonthlyProgress.length > 0 && (
              <div className="glass-card rounded-xl p-5 mb-6 animate-fade-in-up">
                <h3 className="text-[13px] mb-4 pl-3" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)' }}>
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
                        className="text-center p-1.5 rounded-lg text-[10px]"
                        style={{
                          background: isCurrent ? 'rgba(255,215,10,0.1)' : isPast ? 'var(--bg-hover)' : 'var(--bg-hover)',
                          border: isCurrent ? '1px solid rgba(255,149,0,0.3)' : '1px solid var(--border)'
                        }}
                      >
                        <div className="font-semibold" style={{ color: isCurrent ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {mp.label}
                        </div>
                        <div className="text-sm font-bold" style={{
                          color: mp.pctComplete >= 100 ? 'var(--success)' :
                                mp.pctComplete > 0 ? 'var(--warning)' :
                                isPast ? 'var(--danger)' : 'var(--text-muted)'
                        }}>
                          {mp.planned > 0 ? `${mp.pctComplete}%` : '-'}
                        </div>
                        <div style={{ color: 'var(--muted)' }}>{mp.completed}/{mp.planned}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Filter Tabs — hide in Total mode */}
            {planType !== 'total' && <div className="flex flex-wrap gap-2 mb-4 animate-fade-in-up">
              {[
                { key: 'all', label: 'ทั้งหมด', color: 'var(--text-primary)' },
                { key: 'done', label: '✅ เสร็จแล้ว', color: 'var(--success)' },
                { key: 'not_started', label: '⏳ ยังไม่เริ่ม', color: 'var(--warning)' },
                { key: 'postponed', label: '📅 เลื่อน', color: 'var(--info)' },
                { key: 'cancelled', label: '❌ ยกเลิก', color: 'var(--danger)' },
                { key: 'not_applicable', label: '⊘ ไม่เข้าเงื่อนไข', color: 'var(--text-secondary)' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: statusFilter === f.key ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: statusFilter === f.key ? '#ffffff' : f.color,
                    border: `1px solid ${statusFilter === f.key ? 'var(--accent)' : 'var(--border)'}`
                  }}
                >
                  <span>
                    {f.label}
                  </span>
                  <span style={{ marginLeft: '0.375rem', color: 'var(--text-secondary)' }}>
                    ({statusCounts[f.key as keyof typeof statusCounts]})
                  </span>
                </button>
              ))}
            </div>}

            {/* Activity Table — hide in Total mode */}
            {planType !== 'total' && <>
            {/* Activity Table */}
            <div className="glass-card rounded-xl p-5 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[13px] pl-3" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)' }}>
                    รายละเอียดกิจกรรม ({filteredActivities.length} รายการ)
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
                </div>
                {/* Legend in header */}
                <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  <span><span style={{ color: 'var(--success)' }}>●</span> เสร็จแล้ว</span>
                  <span><span style={{ color: 'var(--danger)' }}>○</span> เกินกำหนด</span>
                  <span><span style={{ color: 'var(--muted)' }}>○</span> มีแผน</span>
                  <span><span style={{ color: 'var(--info)' }}>◐</span> เลื่อน</span>
                  <span><span style={{ color: 'var(--danger)' }}>✕</span> ยกเลิก</span>
                  <span><span style={{ color: 'var(--muted)' }}>⊘</span> ไม่เข้าเงื่อนไข</span>
                  <span><span className="inline-block w-2.5 h-2.5 ring-1 rounded-sm mr-0.5 align-middle" style={{ borderColor: 'var(--warning)' }}></span> แก้ไขจาก Dashboard</span>
                </div>
              </div>
              {filteredActivities.length > 0 ? (
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="apple-table w-full text-[13px]">
                    <thead className="sticky top-0 z-10">
                      <tr style={{ borderBottom: `1px solid var(--border)` }}>
                        <th className="text-left py-3 px-2 font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>ลำดับ</th>
                        <th className="text-left py-3 px-2 font-semibold text-[11px] min-w-[250px]" style={{ color: 'var(--text-secondary)' }}>กิจกรรม</th>
                        <th className="text-left py-3 px-2 font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>ผู้รับผิดชอบ</th>
                        {MONTH_LABELS.map((m, idx) => (
                          <th
                            key={m}
                            className="text-center py-3 px-1 font-semibold text-[10px]"
                            style={{
                              color: idx === currentMonthIdx ? '#fff' : 'var(--text-secondary)',
                              background: idx === currentMonthIdx ? 'var(--accent)' : 'transparent',
                              borderRadius: idx === currentMonthIdx ? '6px 6px 0 0' : '0'
                            }}
                          >
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((act, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid var(--border)`, transition: 'background 0.2s' }} className="hover:opacity-90">
                          <td className="py-2.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{act.no}</td>
                          <td className="py-2.5 px-2 text-xs" style={{ color: 'var(--text-primary)' }}>{act.activity}</td>
                          <td
                            className="py-2.5 px-2 text-xs cursor-pointer transition-colors"
                            style={{
                              color: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? 'var(--warning)' : 'var(--text-secondary)',
                              border: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? '1px solid rgba(255,159,10,0.3)' : 'none',
                              borderRadius: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? '4px' : '0px',
                              padding: responsibleOverrides[`${getOverridePrefix(act)}${act.no}`] ? '2px 5px' : '10px 8px'
                            }}
                            onClick={() => handleResponsibleClick(act.no, act.activity, getEffectiveResponsible(act))}
                            title="คลิกเพื่อเปลี่ยนผู้รับผิดชอบ"
                          >
                            {getEffectiveResponsible(act)}
                          </td>
                          {MONTH_KEYS.map((k, idx) => {
                            const effectiveStatus = getEffectiveStatus(act, k);
                            const hasOverride = overrides[`${getOverridePrefix(act)}${act.no}:${k}`] !== undefined;
                            const planMark = act.planMonths?.[k] || '';
                            const actualMark = act.actualMonths?.[k] || '';
                            const isCurrent = idx === currentMonthIdx;

                            const statusConfig: Record<MonthStatus, { icon: string; color: string; title: string }> = {
                              not_planned: { icon: '-', color: 'var(--bg-hover)', title: 'ไม่มีแผน' },
                              planned: { icon: '○', color: 'var(--muted)', title: `แผน: ${planMark}` },
                              done: { icon: '●', color: 'var(--success)', title: `เสร็จ: ${actualMark}` },
                              overdue: { icon: '○', color: 'var(--danger)', title: `เกินกำหนด (แผน: ${planMark})` },
                              postponed: { icon: '◐', color: 'var(--info)', title: `เลื่อน: ${actualMark}` },
                              cancelled: { icon: '✕', color: 'var(--danger)', title: `ยกเลิก: ${actualMark}` },
                              not_applicable: { icon: '⊘', color: 'var(--muted)', title: 'ไม่เข้าเงื่อนไข' },
                            };
                            const cfg = statusConfig[effectiveStatus];

                            const attCount = attachmentCounts[`${act.no}:${k}`] || 0;
                            const hasNote = !!noteOverrides[`${act.no}:${k}`];

                            return (
                              <td
                                key={k}
                                className="text-center py-2.5 px-1 cursor-pointer transition-colors relative"
                                style={{
                                  background: isCurrent ? 'rgba(0, 122, 255, 0.06)' : hasOverride ? 'rgba(255,159,10,0.08)' : 'transparent',
                                  borderLeft: isCurrent ? '1px solid rgba(0, 122, 255, 0.15)' : 'none',
                                  borderRight: isCurrent ? '1px solid rgba(0, 122, 255, 0.15)' : 'none',
                                  border: hasOverride && !isCurrent ? '1px solid rgba(255,159,10,0.3)' : undefined,
                                  borderRadius: hasOverride && !isCurrent ? '4px' : '0px'
                                }}
                                onClick={() => handleCellClick(act.no, k, act.activity)}
                              >
                                <span style={{ color: cfg.color }} className="text-sm" title={cfg.title}>{cfg.icon}</span>
                                {attCount > 0 && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} title={`${attCount} ไฟล์แนบ`}></span>
                                )}
                                {hasNote && (
                                  <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: '#ff9500' }} title="มีหมายเหตุ"></span>
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
                  <p className="text-4xl mb-3">📌</p>
                  <p>ไม่พบกิจกรรม{statusFilter !== 'all' ? 'ในสถานะที่เลือก' : ''}</p>
                  <p className="text-[11px] mt-1">ลองเปลี่ยน Filter หรือเลือก Plan Type อื่น</p>
                </div>
              )}
            </div>
            </>}
          </>
        )}

        {/* Budget + Responsible Summary — Total mode only, at bottom */}
        {planType === 'total' && effectiveSummary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-fade-in-up">
            {/* Budget Breakdown */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[13px] font-medium mb-3 pl-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)' }}>
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
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,149,0,0.8)' }}></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Safety</span>
                      </span>
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {(effectiveSummary.safetyBudget || 0).toLocaleString()} ฿
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(52,199,89,0.8)' }}></span>
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
                          <div style={{ width: `${((effectiveSummary.safetyBudget || 0) / effectiveSummary.budget) * 100}%`, background: 'rgba(255,149,0,0.8)' }} />
                          <div style={{ width: `${((effectiveSummary.enviBudget || 0) / effectiveSummary.budget) * 100}%`, background: 'rgba(52,199,89,0.8)' }} />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Responsible Summary */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[13px] font-medium mb-3 pl-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--info)' }}>
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
                            <span className="text-[11px]" style={{ color: 'var(--success)' }}>
                              {doneNA}/{total}
                            </span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                              background: pct >= 80 ? 'rgba(48,209,88,0.15)' : pct >= 50 ? 'rgba(255,149,0,0.15)' : 'rgba(255,67,54,0.1)',
                              color: pct >= 80 ? 'var(--success)' : pct >= 50 ? '#ff9500' : 'var(--danger)',
                            }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                          <div style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 50 ? '#ff9500' : 'var(--danger)', transition: 'width 0.3s' }} />
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
              {loginError && <p style={{ color: 'var(--danger)' }} className="text-xs mb-3">{loginError}</p>}
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

        {/* Status Update Modal (with attachments, deadline lock, edit request) */}
        {showStatusModal && editingCell && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto py-4" onClick={() => { setShowStatusModal(false); setEditingCell(null); setStatusNote(''); }}>
            <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4" style={{ backdropFilter: 'blur(40px)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {editingCell.actName}
              </h3>
              <p className="text-[13px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                กิจกรรม: <span style={{ color: 'var(--text-primary)' }}>{editingCell.actNo}</span>
                {' | '}
                เดือน: <span style={{ color: 'var(--text-primary)' }}>{MONTH_LABELS[MONTH_KEYS.indexOf(editingCell.month)]}</span>
              </p>

              {/* Deadline Lock Notice */}
              {checkingLock ? (
                <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>กำลังตรวจสอบกำหนดเวลา...</div>
              ) : deadlineLocked && !hasApproval && !auth.isAdmin ? (
                <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,67,54,0.1)', border: '1px solid rgba(255,67,54,0.3)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
                    เลยกำหนดเวลาแก้ไขเดือนนี้แล้ว
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                    ต้องขออนุมัติจาก Admin เพื่อแก้ไขข้อมูล
                  </p>
                </div>
              ) : deadlineLocked && auth.isAdmin ? (
                <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)' }}>
                  <p className="text-sm font-medium" style={{ color: '#ff9500' }}>
                    เลยกำหนดเวลาแล้ว — แก้ไขได้ (Admin)
                  </p>
                </div>
              ) : deadlineLocked && hasApproval ? (
                <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.3)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                    ได้รับอนุมัติให้แก้ไขแล้ว (ชั่วคราว)
                  </p>
                </div>
              ) : null}

              {/* Status Buttons - disable if locked without approval (admin bypasses) */}
              {!(deadlineLocked && !hasApproval && !auth.isAdmin) && (
                <>
                  <p className="text-xs mb-2 mt-3" style={{ color: 'var(--text-secondary)' }}>เปลี่ยนสถานะ:</p>
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
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors"
                          style={{
                            background: isActive ? 'var(--bg-hover)' : 'var(--border)',
                            border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            opacity: savingStatus ? 0.5 : 1
                          }}
                        >
                          <span style={{ color: opt.color }} className="text-lg">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Revert button */}
                  {overrides[`${editingCell.actNo}:${editingCell.month}`] && (
                    <button
                      onClick={handleRevertStatus}
                      disabled={savingStatus}
                      className="w-full px-3 py-2 rounded-lg text-xs transition-colors mb-3"
                      style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      ↩ กลับไปใช้สถานะอัตโนมัติ (จาก Sheet)
                    </button>
                  )}
                </>
              )}

              {/* Edit Request Form - show when locked and no approval (admin bypasses) */}
              {deadlineLocked && !hasApproval && !auth.isAdmin && (
                <div className="mb-4">
                  {!showEditRequestForm ? (
                    <button
                      onClick={() => setShowEditRequestForm(true)}
                      className="btn-primary w-full px-3 py-2.5 rounded-lg text-sm font-medium"
                    >
                      ขอแก้ไขข้อมูลย้อนหลัง
                    </button>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>ขอแก้ไขข้อมูลย้อนหลัง</p>
                      <textarea
                        value={editRequestReason}
                        onChange={e => setEditRequestReason(e.target.value)}
                        placeholder="เหตุผลที่ต้องการแก้ไข..."
                        className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none resize-none"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowEditRequestForm(false); setEditRequestReason(''); }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={handleSubmitEditRequest}
                          disabled={submittingRequest || !editRequestReason.trim()}
                          className="btn-primary flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                          style={{ opacity: submittingRequest || !editRequestReason.trim() ? 0.5 : 1 }}
                        >
                          {submittingRequest ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Note / Detail Section */}
              {!(deadlineLocked && !hasApproval && !auth.isAdmin) && (
                <div className="mb-3">
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>รายละเอียด / หมายเหตุ:</p>
                  <textarea
                    value={statusNote}
                    onChange={e => setStatusNote(e.target.value)}
                    placeholder="พิมพ์รายละเอียดเพิ่มเติม เช่น สิ่งที่ทำ ผลลัพธ์ หรือเหตุผล..."
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    rows={3}
                  />
                </div>
              )}
              {/* Show existing note if locked */}
              {deadlineLocked && !hasApproval && !auth.isAdmin && statusNote && (
                <div className="mb-3 rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>รายละเอียด:</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{statusNote}</p>
                </div>
              )}

              {/* Attachments Section */}
              <div style={{ borderTop: '1px solid var(--border)' }} className="pt-3 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>หลักฐาน / ไฟล์แนบ</p>
                  {!(deadlineLocked && !hasApproval && !auth.isAdmin) && (
                    <label className={`px-3 py-1.5 btn-primary rounded-lg text-xs font-medium cursor-pointer transition-opacity ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingFile ? 'กำลังอัปโหลด...' : '+ อัปโหลดไฟล์'}
                      <input
                        type="file"
                        accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFile(file);
                          e.target.value = '';
                        }}
                        disabled={uploadingFile}
                      />
                    </label>
                  )}
                </div>

                {loadingAttachments ? (
                  <div className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                ) : attachments.length === 0 ? (
                  <div className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>ยังไม่มีไฟล์แนบ</div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">
                            {att.file_type?.includes('image') ? '🖼️' :
                             att.file_type?.includes('pdf') ? '📄' :
                             att.file_type?.includes('sheet') || att.file_type?.includes('excel') ? '<BarChart3 size={14} className="inline mr-1" />' : '📎'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{att.file_name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                              {att.uploaded_by} | {new Date(att.created_at).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                        </div>
                        <a
                          href={att.file_url || att.drive_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex-shrink-0 ml-2 transition-opacity hover:opacity-80"
                          style={{ color: 'var(--accent)' }}
                        >
                          เปิด
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => { setShowStatusModal(false); setEditingCell(null); setStatusNote(''); }}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors mt-4"
                style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                ปิด
              </button>
            </div>
          </div>
        )}
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
