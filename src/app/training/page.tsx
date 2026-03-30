'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { Calendar, Search } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

interface PlanRaw {
  id: string;
  company_id: string;
  course_name: string;
  category: string;
  planned_month: number;
  hours_per_course: number;
  planned_participants: number;
  budget: number;
  in_house_external: string;
  dsd_eligible: boolean;
  training_sessions: {
    id: string;
    status: string;
    scheduled_date_start: string | null;
    scheduled_date_end: string | null;
    actual_cost: number;
    actual_participants: number;
    total_man_hours: number;
    hours_per_course: number;
    actual_hours: number;
    postponed_to_month: number | null;
    original_planned_month: number | null;
    instructor_name: string | null;
    training_location: string | null;
    training_method: string | null;
    note: string | null;
    training_attendees?: { count: number }[];
    dsd_submitted?: boolean;
    dsd_approved?: boolean;
    dsd_not_submitting?: boolean;
  }[];
}

interface CompanyData {
  companyId: string;
  companyName: string;
  plans: PlanRaw[];
}

export default function HQTrainingOverview() {
  const auth = useAuth();
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [allCompanyData, setAllCompanyData] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<string>('year');
  const currentMonthIdx = new Date().getMonth();

  // History search
  const [historyTab, setHistoryTab] = useState<'overview' | 'course' | 'person'>('overview');
  const [courseSearch, setCourseSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);

  // Tracking toggle: pending vs completed
  const [trackingMode, setTrackingMode] = useState<'pending' | 'completed'>('pending');

  // Course detail modal
  const [detailCourse, setDetailCourse] = useState<{ companyId: string; company: string; courseName: string; planId: string; sessionId: string | null; status: string; scheduledDate: string | null; scheduledDateEnd: string | null; dsd: boolean; plannedMonth: number; budget: number; hours: number; participants: number; inHouseExternal: string; category: string; actualCost: number; actualParticipants: number; totalManHours: number; actualHours: number; instructorName: string; trainingLocation: string; trainingMethod: string; note: string; attendeeCount: number; } | null>(null);
  const [detailAttendees, setDetailAttendees] = useState<Record<string, unknown>[]>([]);
  const [detailFiles, setDetailFiles] = useState<{ photos: string[]; signin: string[] }>({ photos: [], signin: [] });
  const [detailLoading, setDetailLoading] = useState(false);

  // Expanded month detail
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  // DSD Status update (HR PIN)
  const [dsdDropdownIdx, setDsdDropdownIdx] = useState<number | null>(null);
  const [hrPinVerified, setHrPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingDsdUpdate, setPendingDsdUpdate] = useState<{ sessionId: string; status: string; idx: number } | null>(null);
  const [dsdUpdating, setDsdUpdating] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results: CompanyData[] = [];

      const promises = COMPANIES.map(async (company) => {
        try {
          const res = await fetch(`/api/training/plans?companyId=${company.id}&year=${selectedYear}`);
          const plans = await res.json();
          if (Array.isArray(plans) && plans.length > 0) {
            return { companyId: company.id, companyName: company.name, plans };
          }
        } catch { /* skip */ }
        return null;
      });

      const allResults = await Promise.all(promises);
      for (const r of allResults) {
        if (r) results.push(r);
      }

      setAllCompanyData(results);
      setLoading(false);
    };

    fetchAll();
  }, [selectedYear]);

  const getEffectiveMonth = (p: PlanRaw) => {
    const s = p.training_sessions?.[0];
    if (s?.status === 'postponed' && s.postponed_to_month) return s.postponed_to_month;
    if (s?.postponed_to_month && s?.original_planned_month) return s.postponed_to_month;
    return p.planned_month;
  };

  // Filter plans based on time range
  const filterByTimeRange = (plans: PlanRaw[]) => {
    if (timeRange === 'year') return plans;
    return plans.filter(p => {
      const m = getEffectiveMonth(p);
      if (timeRange === 'ytd') return m >= 1 && m <= currentMonthIdx + 1;
      const idx = MONTH_KEYS.indexOf(timeRange);
      if (idx >= 0) return m === idx + 1;
      return true;
    });
  };

  // Compute summaries per company
  const companySummaries = useMemo(() => {
    const today = new Date();
    return allCompanyData.map(cd => {
      const plans = filterByTimeRange(cd.plans);
      let completed = 0, scheduled = 0, pending = 0, cancelled = 0, warnings = 0;
      let totalBudget = 0, totalActual = 0, totalParticipants = 0, totalManHours = 0;

      // Monthly breakdown
      const monthly = Array.from({ length: 12 }, () => ({ planned: 0, completed: 0, budget: 0, actual: 0 }));

      for (const p of plans) {
        const s = p.training_sessions?.[0];
        const status = s?.status || 'planned';
        if (status === 'completed') completed++;
        else if (status === 'scheduled') scheduled++;
        else if (status === 'cancelled') cancelled++;
        else pending++;

        totalBudget += p.budget || 0;
        totalActual += s?.actual_cost || 0;
        const sessPax = s?.actual_participants || s?.training_attendees?.[0]?.count || 0;
        totalParticipants += sessPax;
        totalManHours += s?.total_man_hours || 0;

        const em = getEffectiveMonth(p);
        if (em >= 1 && em <= 12) {
          monthly[em - 1].planned++;
          if (status === 'completed') monthly[em - 1].completed++;
          monthly[em - 1].budget += p.budget || 0;
          monthly[em - 1].actual += s?.actual_cost || 0;
        }

        if (status === 'planned' && p.planned_month > 0) {
          const planned = new Date(selectedYear, p.planned_month - 1, 1);
          const diff = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          if (diff <= 45 && diff > -30) warnings++;
        }
      }

      return {
        companyId: cd.companyId,
        companyName: cd.companyName,
        totalCourses: plans.length,
        completed, scheduled, pending, cancelled, warnings,
        totalBudget, totalActual, totalParticipants, totalManHours,
        monthly,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanyData, timeRange]);

  // Global monthly aggregation (across all companies, always full year for chart)
  const globalMonthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      let planned = 0, completed = 0, budget = 0, actual = 0;
      const coursesInMonth: { company: string; course: string; status: string; date: string | null; budget: number; actual: number }[] = [];
      for (const cd of allCompanyData) {
        for (const p of cd.plans) {
          const em = getEffectiveMonth(p);
          if (em !== i + 1) continue;
          const s = p.training_sessions?.[0];
          const status = s?.status || 'planned';
          planned++;
          if (status === 'completed') completed++;
          budget += p.budget || 0;
          actual += s?.actual_cost || 0;
          coursesInMonth.push({
            company: cd.companyName,
            course: p.course_name,
            status,
            date: s?.scheduled_date_start || null,
            budget: p.budget || 0,
            actual: s?.actual_cost || 0,
          });
        }
      }
      return { month: i + 1, label: MONTH_LABELS[i], planned, completed, budget, actual, courses: coursesInMonth };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanyData]);

  const totals = companySummaries.reduce((acc, s) => ({
    courses: acc.courses + s.totalCourses,
    completed: acc.completed + s.completed,
    scheduled: acc.scheduled + s.scheduled,
    pending: acc.pending + s.pending,
    budget: acc.budget + s.totalBudget,
    actual: acc.actual + s.totalActual,
    participants: acc.participants + s.totalParticipants,
    manHours: acc.manHours + s.totalManHours,
    warnings: acc.warnings + s.warnings,
  }), { courses: 0, completed: 0, scheduled: 0, pending: 0, budget: 0, actual: 0, participants: 0, manHours: 0, warnings: 0 });

  const overallPct = totals.courses > 0 ? Math.round((totals.completed / totals.courses) * 100) : 0;
  const budgetUsedPct = totals.budget > 0 ? Math.round((totals.actual / totals.budget) * 100) : 0;

  // Tracking item type
  type TrackingItem = {
    company: string;
    companyId: string;
    courseName: string;
    planId: string;
    sessionId: string | null;
    plannedMonth: number;
    status: string;
    scheduledDate: string | null;
    dsd: boolean;
    dsdStatus: 'none' | 'not_submitting' | 'submitted' | 'approved';
    daysUntil: number;
    urgency: 'overdue' | 'urgent' | 'soon' | 'future';
    budget: number;
    hours: number;
    participants: number;
    inHouseExternal: string;
    category: string;
    actualCost: number;
    actualParticipants: number;
    totalManHours: number;
    actualHours: number;
    instructorName: string;
    trainingLocation: string;
    trainingMethod: string;
    note: string;
    scheduledDateEnd: string | null;
    attendeeCount: number;
  };

  // Build ALL course items (both pending and completed)
  const allTrackingItems = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const items: TrackingItem[] = [];

    for (const cd of allCompanyData) {
      for (const p of cd.plans) {
        const s = p.training_sessions?.[0];
        const status = s?.status || 'planned';
        if (status === 'cancelled') continue;

        const em = getEffectiveMonth(p);
        if (em < 1 || em > 12) continue;

        const plannedDate = new Date(selectedYear, em - 1, 1);
        const diffDays = Math.round((plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let urgency: 'overdue' | 'urgent' | 'soon' | 'future' = 'future';
        if (status === 'completed') urgency = 'future';
        else if (em < currentMonth) urgency = 'overdue';
        else if (em === currentMonth) urgency = 'urgent';
        else if (em === currentMonth + 1) urgency = 'soon';

        items.push({
          company: cd.companyName,
          companyId: cd.companyId,
          courseName: p.course_name,
          planId: p.id,
          sessionId: s?.id || null,
          plannedMonth: em,
          status,
          scheduledDate: s?.scheduled_date_start || null,
          dsd: p.dsd_eligible,
          dsdStatus: s?.dsd_approved ? 'approved' : s?.dsd_submitted ? 'submitted' : s?.dsd_not_submitting ? 'not_submitting' : 'none',
          daysUntil: diffDays,
          urgency,
          budget: p.budget || 0,
          hours: p.hours_per_course || 0,
          participants: p.planned_participants || 0,
          inHouseExternal: p.in_house_external || '',
          category: p.category || '',
          actualCost: s?.actual_cost || 0,
          actualParticipants: s?.actual_participants || s?.training_attendees?.[0]?.count || 0,
          totalManHours: s?.total_man_hours || 0,
          actualHours: s?.actual_hours || s?.hours_per_course || 0,
          instructorName: s?.instructor_name || '',
          trainingLocation: s?.training_location || '',
          trainingMethod: s?.training_method || '',
          note: s?.note || '',
          scheduledDateEnd: s?.scheduled_date_end || null,
          attendeeCount: s?.training_attendees?.[0]?.count || 0,
        });
      }
    }

    // Sort: overdue first, then by month ascending
    items.sort((a, b) => {
      const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, future: 3 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (a.plannedMonth !== b.plannedMonth) return a.plannedMonth - b.plannedMonth;
      return a.company.localeCompare(b.company);
    });

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompanyData, selectedYear]);

  const trackingList = useMemo(() => allTrackingItems.filter(t => t.status !== 'completed'), [allTrackingItems]);
  const completedList = useMemo(() => {
    const items = allTrackingItems.filter(t => t.status === 'completed');
    items.sort((a, b) => a.plannedMonth - b.plannedMonth || a.company.localeCompare(b.company));
    return items;
  }, [allTrackingItems]);

  const filtered = searchTerm
    ? companySummaries.filter(s => s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    : companySummaries;

  const handleCourseSearch = async () => {
    if (!courseSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/training/attendees?courseName=${encodeURIComponent(courseSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handlePersonSearch = async () => {
    if (!personSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/training/attendees?empCode=${encodeURIComponent(personSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  // Check if user can access a specific company page
  const canAccessCompany = (companyId: string) => {
    if (auth.isAdmin) return true;
    return !!auth.companyAuth[companyId];
  };

  // DSD Status labels
  const DSD_STATUS_OPTIONS: { value: string; label: string; color: string; bg: string }[] = [
    { value: 'none', label: 'ไม่ระบุ', color: '#6b7280', bg: '#f3f4f6' },
    { value: 'not_submitting', label: 'ไม่ได้ยื่น', color: '#dc2626', bg: '#fee2e2' },
    { value: 'submitted', label: 'ยื่นแล้ว', color: '#ca8a04', bg: '#fef9c3' },
    { value: 'approved', label: 'อนุมัติแล้ว', color: '#16a34a', bg: '#dcfce7' },
  ];

  const getDsdLabel = (status: string) => DSD_STATUS_OPTIONS.find(o => o.value === status) || DSD_STATUS_OPTIONS[0];

  // Handle DSD status click — verify PIN first, then show dropdown
  const handleDsdClick = (idx: number, item: TrackingItem) => {
    if (!item.dsd || !item.sessionId) return;
    if (hrPinVerified) {
      setDsdDropdownIdx(dsdDropdownIdx === idx ? null : idx);
    } else {
      setPendingDsdUpdate({ sessionId: item.sessionId, status: '', idx });
      setShowPinModal(true);
      setPinInput('');
      setPinError('');
    }
  };

  // Verify PIN
  const handlePinVerify = async () => {
    if (!pinInput || pinInput.length < 4) {
      setPinError('กรุณาใส่ PIN อย่างน้อย 4 หลัก');
      return;
    }
    setDsdUpdating(true);
    try {
      // Test PIN by making a dummy request (we'll just verify)
      const res = await fetch('/api/training/dsd-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'test', dsd_status: 'none', hr_pin: pinInput }),
      });
      if (res.status === 403) {
        setPinError('รหัส PIN ไม่ถูกต้อง');
        setDsdUpdating(false);
        return;
      }
      // PIN is correct (even if session_id is wrong)
      setHrPinVerified(true);
      setShowPinModal(false);
      if (pendingDsdUpdate) {
        setDsdDropdownIdx(pendingDsdUpdate.idx);
      }
    } catch {
      setPinError('เกิดข้อผิดพลาด');
    }
    setDsdUpdating(false);
  };

  // Update DSD status
  const handleDsdStatusChange = async (sessionId: string, newStatus: string, idx: number) => {
    setDsdUpdating(true);
    try {
      const res = await fetch('/api/training/dsd-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, dsd_status: newStatus, hr_pin: pinInput || sessionStorage.getItem('hr_pin') || '' }),
      });
      if (res.ok) {
        // Store PIN in session for future use
        if (pinInput) sessionStorage.setItem('hr_pin', pinInput);
        // Update local state
        setAllCompanyData(prev => prev.map(cd => ({
          ...cd,
          plans: cd.plans.map(p => ({
            ...p,
            training_sessions: p.training_sessions.map(s => {
              if (s.id === sessionId) {
                return {
                  ...s,
                  dsd_not_submitting: newStatus === 'not_submitting',
                  dsd_submitted: newStatus === 'submitted' || newStatus === 'approved',
                  dsd_approved: newStatus === 'approved',
                };
              }
              return s;
            }),
          })),
        })));
      } else {
        const err = await res.json();
        if (res.status === 403) {
          setHrPinVerified(false);
          sessionStorage.removeItem('hr_pin');
          alert('รหัส PIN ไม่ถูกต้อง กรุณาใส่ใหม่');
        } else {
          alert(err.error || 'เกิดข้อผิดพลาด');
        }
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setDsdDropdownIdx(null);
    setDsdUpdating(false);
  };

  // Restore HR PIN from session storage on mount
  useEffect(() => {
    const savedPin = sessionStorage.getItem('hr_pin');
    if (savedPin) {
      setPinInput(savedPin);
      setHrPinVerified(true);
    }
  }, []);

  // Open course detail modal
  const openCourseDetail = async (item: TrackingItem) => {
    setDetailCourse({
      companyId: item.companyId,
      company: item.company,
      courseName: item.courseName,
      planId: item.planId,
      sessionId: item.sessionId,
      status: item.status,
      scheduledDate: item.scheduledDate,
      scheduledDateEnd: item.scheduledDateEnd,
      dsd: item.dsd,
      plannedMonth: item.plannedMonth,
      budget: item.budget,
      hours: item.hours,
      participants: item.participants,
      inHouseExternal: item.inHouseExternal,
      category: item.category,
      actualCost: item.actualCost,
      actualParticipants: item.actualParticipants,
      totalManHours: item.totalManHours,
      actualHours: item.actualHours,
      instructorName: item.instructorName,
      trainingLocation: item.trainingLocation,
      trainingMethod: item.trainingMethod,
      note: item.note,
      attendeeCount: item.attendeeCount,
    });
    setDetailLoading(true);
    setDetailAttendees([]);
    setDetailFiles({ photos: [], signin: [] });

    try {
      // Fetch attendees
      if (item.planId) {
        const res = await fetch(`/api/training/attendees?planId=${item.planId}`);
        const data = await res.json();
        if (Array.isArray(data)) setDetailAttendees(data);
      }
      // Fetch files from Supabase storage
      if (item.sessionId) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wdjhsalkmjbrujqzqllu.supabase.co';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const basePath = `${item.companyId}/${item.sessionId}`;
        const photos: string[] = [];
        const signin: string[] = [];
        for (const fileType of ['photos', 'signin'] as const) {
          try {
            const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/training-documents/${basePath}/${fileType}`, {
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
            });
            if (listRes.ok) {
              const files = await listRes.json();
              if (Array.isArray(files)) {
                for (const f of files) {
                  if (f.name) {
                    const url = `${supabaseUrl}/storage/v1/object/public/training-documents/${basePath}/${fileType}/${f.name}`;
                    if (fileType === 'photos') photos.push(url);
                    else signin.push(url);
                  }
                }
              }
            }
          } catch { /* ignore */ }
        }
        setDetailFiles({ photos, signin });
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const maxMonthlyPlanned = Math.max(...globalMonthly.map(d => d.planned), 1);

  const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'อบรมแล้ว', color: '#16a34a', bg: '#dcfce7' },
    scheduled: { label: 'กำหนดวันแล้ว', color: '#3b82f6', bg: '#dbeafe' },
    planned: { label: 'ยังไม่กำหนดวัน', color: '#6b7280', bg: '#f3f4f6' },
    cancelled: { label: 'ยกเลิก', color: '#dc2626', bg: '#fee2e2' },
    postponed: { label: 'เลื่อน', color: '#f59e0b', bg: '#fef3c7' },
  };

  // Close DSD dropdown on outside click
  useEffect(() => {
    if (dsdDropdownIdx === null) return;
    const handler = () => setDsdDropdownIdx(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [dsdDropdownIdx]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />

      {/* HR PIN Modal */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowPinModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 340, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#1a1a1a' }}>ใส่รหัส HR</h3>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>ใส่ PIN เพื่ออัปเดตสถานะกรมพัฒน์ฯ</p>
            <input
              type="password"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              placeholder="PIN 4-6 หลัก"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handlePinVerify(); }}
              style={{
                width: '100%', padding: '12px', fontSize: 20, textAlign: 'center', letterSpacing: '0.4em',
                border: `2px solid ${pinError ? '#dc2626' : '#e5e7eb'}`, borderRadius: 10, outline: 'none',
                fontFamily: 'monospace', boxSizing: 'border-box',
              }}
            />
            {pinError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, marginBottom: 0 }}>{pinError}</p>}
            <button
              onClick={handlePinVerify}
              disabled={dsdUpdating || pinInput.length < 4}
              style={{
                width: '100%', padding: '12px', marginTop: 16, borderRadius: 10, border: 'none',
                background: pinInput.length >= 4 ? '#007AFF' : '#e5e7eb',
                color: pinInput.length >= 4 ? '#fff' : '#9ca3af',
                fontWeight: 600, fontSize: 14, cursor: pinInput.length >= 4 ? 'pointer' : 'default',
                opacity: dsdUpdating ? 0.6 : 1,
              }}
            >
              {dsdUpdating ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
            </button>
            <button
              onClick={() => setShowPinModal(false)}
              style={{ marginTop: 10, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            🎓 HQ Training Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0', fontSize: 14 }}>
            ภาพรวมแผนอบรมทุกบริษัทในกลุ่ม EA • ปี {selectedYear}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)' }}>
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button style={{ padding: '6px 14px', borderRadius: 6, border: '2px solid var(--accent)',
                background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              📊 ภาพรวม
          </button>
        </div>

        {/* Time Range Selector — only in overview tab */}
        {historyTab === 'overview' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>ช่วงเวลา:</span>
            <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {[
                { key: 'year', label: 'ทั้งปี' },
                { key: 'ytd', label: `ถึง ${MONTH_LABELS[currentMonthIdx]} (YTD)` },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTimeRange(opt.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: timeRange === opt.key ? 'var(--accent)' : 'transparent',
                    color: timeRange === opt.key ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={MONTH_KEYS.includes(timeRange) ? timeRange : ''}
              onChange={(e) => e.target.value && setTimeRange(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: MONTH_KEYS.includes(timeRange) ? 'var(--accent)' : 'var(--bg-secondary)',
                color: MONTH_KEYS.includes(timeRange) ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)', outline: 'none',
              }}
            >
              <option value="" disabled>เลือกเดือน...</option>
              {MONTH_LABELS.map((name, i) => (
                <option key={MONTH_KEYS[i]} value={MONTH_KEYS[i]}>{name}</option>
              ))}
            </select>
            {timeRange !== 'year' && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,149,0,0.1)', color: '#ff9500' }}>
                {timeRange === 'ytd' ? `ม.ค. – ${MONTH_LABELS[currentMonthIdx]}` : MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]} เท่านั้น
              </span>
            )}
          </div>
        )}

        {historyTab === 'overview' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 14 }}>กำลังโหลดข้อมูลจากทุกบริษัท...</div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <KPIBox icon="📚" label="หลักสูตรรวม" value={totals.courses} />
                  <KPIBox icon="✅" label="อบรมแล้ว" value={`${totals.completed}`} sub={`${overallPct}%`} color="var(--success)" />
                  <KPIBox icon="📅" label="กำหนดวันแล้ว" value={`${totals.scheduled}`} color="#3b82f6" />
                  <KPIBox icon="⏳" label="รอดำเนินการ" value={`${totals.pending}`} color="#f59e0b" />
                  <KPIBox icon="👥" label="ผู้เข้าอบรม" value={totals.participants} />
                  {totals.warnings > 0 && <KPIBox icon="⚠️" label="ต้องเร่ง" value={totals.warnings} color="var(--danger)" />}
                </div>

                {/* Monthly Overview Chart */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        % การอบรมตามแผนรายเดือน (ทุกบริษัท)
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        คลิกแท่งกราฟเพื่อดูรายละเอียดหลักสูตรในเดือนนั้น
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? '#f59e0b' : 'var(--danger)' }}>
                        {overallPct}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ความสำเร็จรวม</div>
                    </div>
                  </div>

                  {/* Bar chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, marginBottom: 8 }}>
                    {globalMonthly.map((d, i) => {
                      const currentMonth = currentMonthIdx + 1;
                      const isPast = d.month <= currentMonth;
                      const barHeight = maxMonthlyPlanned > 0 ? (d.planned / maxMonthlyPlanned) * 150 : 0;
                      const completedHeight = d.planned > 0 ? (d.completed / d.planned) * barHeight : 0;
                      const pct = d.planned > 0 ? Math.round((d.completed / d.planned) * 100) : 0;
                      const isExpanded = expandedMonth === d.month;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: d.planned > 0 ? 'pointer' : 'default' }}
                          onClick={() => d.planned > 0 && setExpandedMonth(isExpanded ? null : d.month)}>
                          {d.planned > 0 && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? 'var(--success)' : 'var(--text-secondary)' }}>
                              {d.completed}/{d.planned}
                            </div>
                          )}
                          <div style={{
                            width: '100%', height: barHeight || 2, borderRadius: 4, position: 'relative', overflow: 'hidden',
                            background: isPast && d.planned > 0 ? '#fee2e2' : 'var(--bg-secondary)',
                            border: isExpanded ? '2px solid var(--accent)' : 'none',
                            boxSizing: 'border-box',
                          }}>
                            {completedHeight > 0 && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: completedHeight, background: '#4ade80', borderRadius: '0 0 4px 4px' }} />
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: d.month === currentMonth ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: d.month === currentMonth ? 700 : 400 }}>
                            {d.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> อบรมแล้ว
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fee2e2', display: 'inline-block' }} /> เลยกำหนด
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-secondary)', display: 'inline-block' }} /> ยังไม่ถึง
                    </span>
                  </div>

                  {/* Expanded month detail */}
                  {expandedMonth && (() => {
                    const md = globalMonthly[expandedMonth - 1];
                    if (!md || md.courses.length === 0) return null;
                    return (
                      <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                          📋 รายการอบรมเดือน{md.label} ({md.courses.length} หลักสูตร)
                        </div>
                        <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={th}>#</th>
                                <th style={{ ...th, textAlign: 'left' }}>บริษัท</th>
                                <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
                                <th style={th}>สถานะ</th>
                                <th style={th}>วันอบรม</th>
                                <th style={{ ...th, textAlign: 'right' }}>งบ (฿)</th>
                                <th style={{ ...th, textAlign: 'right' }}>จริง (฿)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {md.courses.map((c, idx) => {
                                const st = STATUS_LABELS[c.status] || STATUS_LABELS['planned'];
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={td}>{idx + 1}</td>
                                    <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{c.company}</td>
                                    <td style={{ ...td, textAlign: 'left', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.course}</td>
                                    <td style={td}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                                        {st.label}
                                      </span>
                                    </td>
                                    <td style={td}>{c.date ? formatDate(c.date) : '-'}</td>
                                    <td style={{ ...td, textAlign: 'right' }}>{c.budget.toLocaleString()}</td>
                                    <td style={{ ...td, textAlign: 'right' }}>{c.actual > 0 ? c.actual.toLocaleString() : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Company % Completion per Month — Matrix Table */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    📊 % อบรมตามแผนรายเดือน แยกตามบริษัท
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    แสดงเฉพาะเดือนที่มีแผนอบรม
                  </p>

                  <div style={{ marginBottom: 12 }}>
                    <input placeholder="ค้นหาบริษัท..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 250, fontSize: 13 }} />
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>บริษัท</th>
                          <th style={th}>รวม</th>
                          <th style={th}>✅</th>
                          {MONTH_LABELS.map((m, i) => (
                            <th key={i} style={{ ...th, color: i === currentMonthIdx ? 'var(--accent)' : undefined, fontWeight: i === currentMonthIdx ? 700 : undefined }}>
                              {m}
                            </th>
                          ))}
                          <th style={{ ...th, textAlign: 'right' }}>งบ</th>
                          <th style={{ ...th, textAlign: 'right' }}>จริง</th>
                          <th style={th}>%งบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, i) => {
                          const pct = s.totalCourses > 0 ? Math.round((s.completed / s.totalCourses) * 100) : 0;
                          const bPct = s.totalBudget > 0 ? Math.round((s.totalActual / s.totalBudget) * 100) : 0;
                          return (
                            <tr key={s.companyId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                              <td style={{ ...td, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--card-solid)' : 'var(--bg-secondary)', zIndex: 1 }}>
                                {canAccessCompany(s.companyId) ? (
                                  <Link href={`/company/${s.companyId}/training`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                    {s.companyName}
                                  </Link>
                                ) : (
                                  <span style={{ color: 'var(--text-primary)' }}>{s.companyName}</span>
                                )}
                              </td>
                              <td style={td}>{s.totalCourses}</td>
                              <td style={{ ...td, color: 'var(--success)', fontWeight: 600 }}>{pct}%</td>
                              {s.monthly.map((m, mi) => {
                                if (m.planned === 0) return <td key={mi} style={{ ...td, color: 'var(--border)' }}>-</td>;
                                const mPct = Math.round((m.completed / m.planned) * 100);
                                const bg = mPct === 100 ? '#dcfce7' : mPct > 0 ? '#fef3c7' : mi < currentMonthIdx ? '#fee2e2' : 'transparent';
                                const clr = mPct === 100 ? '#16a34a' : mPct > 0 ? '#f59e0b' : mi < currentMonthIdx ? '#dc2626' : 'var(--text-secondary)';
                                return (
                                  <td key={mi} style={{ ...td, background: bg, color: clr, fontWeight: 600, fontSize: 11 }}>
                                    {m.completed}/{m.planned}
                                  </td>
                                );
                              })}
                              <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(s.totalBudget / 1000).toFixed(0)}K</td>
                              <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(s.totalActual / 1000).toFixed(0)}K</td>
                              <td style={{ ...td, color: bPct > 100 ? '#dc2626' : 'var(--text-secondary)', fontWeight: bPct > 100 ? 700 : 400, fontSize: 11 }}>{bPct}%</td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)', fontWeight: 700 }}>
                          <td style={{ ...td, textAlign: 'left', fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>รวมทั้งหมด</td>
                          <td style={td}>{totals.courses}</td>
                          <td style={{ ...td, color: 'var(--success)' }}>{overallPct}%</td>
                          {globalMonthly.map((gm, mi) => {
                            if (gm.planned === 0) return <td key={mi} style={{ ...td, color: 'var(--border)' }}>-</td>;
                            const mPct = Math.round((gm.completed / gm.planned) * 100);
                            return (
                              <td key={mi} style={{ ...td, fontWeight: 700, color: mPct === 100 ? '#16a34a' : mPct > 0 ? '#f59e0b' : mi < currentMonthIdx ? '#dc2626' : 'var(--text-secondary)' }}>
                                {gm.completed}/{gm.planned}
                              </td>
                            );
                          })}
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(totals.budget / 1000).toFixed(0)}K</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{(totals.actual / 1000).toFixed(0)}K</td>
                          <td style={{ ...td, fontSize: 11 }}>{budgetUsedPct}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tracking: Course tracking with toggle */}
                <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        📋 ติดตามข้อมูลหลักสูตรอบรม
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {trackingMode === 'pending'
                          ? <>ยังไม่อบรม {trackingList.length} หลักสูตร — ยังไม่กำหนดวัน <b style={{ color: '#dc2626' }}>{trackingList.filter(t => !t.scheduledDate).length}</b> / กำหนดวันแล้ว <b style={{ color: '#16a34a' }}>{trackingList.filter(t => !!t.scheduledDate).length}</b></>
                          : <>จัดอบรมแล้ว {completedList.length} หลักสูตร</>
                        }
                      </p>
                    </div>
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <button
                        onClick={() => setTrackingMode('pending')}
                        style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: trackingMode === 'pending' ? 'var(--accent)' : 'var(--bg)', color: trackingMode === 'pending' ? '#fff' : 'var(--text-secondary)' }}
                      >
                        ⏳ ยังไม่อบรม ({trackingList.length})
                      </button>
                      <button
                        onClick={() => setTrackingMode('completed')}
                        style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--border)', background: trackingMode === 'completed' ? '#16a34a' : 'var(--bg)', color: trackingMode === 'completed' ? '#fff' : 'var(--text-secondary)' }}
                      >
                        ✅ อบรมแล้ว ({completedList.length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const displayList = trackingMode === 'pending' ? trackingList : completedList;
                    if (displayList.length === 0) return (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
                        {trackingMode === 'pending' ? 'ไม่มีหลักสูตรที่ต้องติดตาม' : 'ยังไม่มีหลักสูตรที่จัดอบรมแล้ว'}
                      </div>
                    );
                    return (
                      <div style={{ borderRadius: 8, border: '1px solid var(--border)', maxHeight: 500, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                              <th style={th}>#</th>
                              <th style={{ ...th, textAlign: 'left' }}>บริษัท</th>
                              <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
                              <th style={th}>เดือน</th>
                              <th style={th}>วันอบรม</th>
                              <th style={th}>DSD</th>
                              <th style={th}>สถานะ DSD</th>
                              {trackingMode === 'pending' && <th style={th}>ความเร่งด่วน</th>}
                              {trackingMode === 'completed' && <th style={th}>ค่าใช้จ่าย</th>}
                              {trackingMode === 'completed' && <th style={th}>ผู้เข้าอบรม</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {displayList.map((item, idx) => {
                              const urgencyConfig = {
                                overdue: { label: 'เลยกำหนด', color: '#dc2626', bg: '#fee2e2' },
                                urgent: { label: 'เดือนนี้', color: '#ea580c', bg: '#fff7ed' },
                                soon: { label: 'เดือนหน้า', color: '#ca8a04', bg: '#fefce8' },
                                future: { label: 'ยังไม่ถึง', color: '#16a34a', bg: '#f0fdf4' },
                              };
                              const urg = urgencyConfig[item.urgency];
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: trackingMode === 'pending' && item.urgency === 'overdue' ? '#fff5f5' : idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = trackingMode === 'pending' && item.urgency === 'overdue' ? '#fff5f5' : idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'; }}
                                >
                                  <td style={td}>{idx + 1}</td>
                                  <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>
                                    {canAccessCompany(item.companyId) ? (
                                      <Link href={`/company/${item.companyId}/training`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                        {item.company}
                                      </Link>
                                    ) : (
                                      <span style={{ color: 'var(--text-primary)' }}>{item.company}</span>
                                    )}
                                  </td>
                                  <td style={{ ...td, textAlign: 'left' }}
                                    onClick={() => openCourseDetail(item)}
                                  >
                                    <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' as const, textUnderlineOffset: '3px' }}>
                                      {item.courseName}
                                    </span>
                                  </td>
                                  <td style={{ ...td, fontWeight: 600 }}>{MONTH_LABELS[item.plannedMonth - 1]}</td>
                                  <td style={td}>
                                    {item.scheduledDate ? (
                                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                                        {formatDate(item.scheduledDate)}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
                                        ยังไม่กำหนด
                                      </span>
                                    )}
                                  </td>
                                  <td style={td}>
                                    {item.dsd && (
                                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
                                        กรมพัฒน์
                                      </span>
                                    )}
                                  </td>
                                  {/* สถานะ DSD — clickable dropdown for HR */}
                                  <td style={{ ...td, position: 'relative' }}>
                                    {item.dsd ? (
                                      <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDsdClick(idx, item); }}
                                          style={{
                                            fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 700, border: 'none',
                                            cursor: item.sessionId ? 'pointer' : 'default',
                                            background: getDsdLabel(item.dsdStatus).bg, color: getDsdLabel(item.dsdStatus).color,
                                            transition: 'all 0.15s',
                                          }}
                                          title={item.sessionId ? (hrPinVerified ? 'คลิกเพื่อเปลี่ยนสถานะ' : 'คลิกเพื่อใส่ PIN HR') : 'ยังไม่มี session'}
                                        >
                                          {getDsdLabel(item.dsdStatus).label}
                                          {hrPinVerified && item.sessionId && <span style={{ marginLeft: 2, fontSize: 8 }}>▼</span>}
                                        </button>
                                        {dsdDropdownIdx === idx && item.sessionId && (
                                          <div
                                            style={{
                                              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                              zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 4, minWidth: 130, marginTop: 4,
                                            }}
                                            onClick={e => e.stopPropagation()}
                                          >
                                            {DSD_STATUS_OPTIONS.map(opt => (
                                              <button
                                                key={opt.value}
                                                onClick={() => handleDsdStatusChange(item.sessionId!, opt.value, idx)}
                                                disabled={dsdUpdating}
                                                style={{
                                                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                                                  fontSize: 11, border: 'none', borderRadius: 4, cursor: dsdUpdating ? 'wait' : 'pointer',
                                                  background: item.dsdStatus === opt.value ? opt.bg : 'transparent',
                                                  color: opt.color, fontWeight: item.dsdStatus === opt.value ? 700 : 500,
                                                  opacity: dsdUpdating ? 0.5 : 1,
                                                }}
                                                onMouseEnter={e => { if (item.dsdStatus !== opt.value) (e.target as HTMLElement).style.background = '#f3f4f6'; }}
                                                onMouseLeave={e => { if (item.dsdStatus !== opt.value) (e.target as HTMLElement).style.background = 'transparent'; }}
                                              >
                                                {item.dsdStatus === opt.value && '✓ '}{opt.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>-</span>
                                    )}
                                  </td>
                                  {trackingMode === 'pending' && (
                                    <td style={td}>
                                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: urg.bg, color: urg.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {urg.label}
                                      </span>
                                    </td>
                                  )}
                                  {trackingMode === 'completed' && (
                                    <>
                                      <td style={{ ...td, textAlign: 'right' }}>{item.actualCost ? item.actualCost.toLocaleString() : '-'}</td>
                                      <td style={td}>{item.actualParticipants || '-'}</td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Warning */}
                {totals.warnings > 0 && (
                  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                    ⚠️ มี {totals.warnings} หลักสูตรใกล้ถึงกำหนดแต่ยังไม่กำหนดวันอบรม
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Course Search Tab */}
        {historyTab === 'course' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์ชื่อหลักสูตร..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCourseSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }} />
              <button onClick={handleCourseSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}

        {/* Person Search Tab */}
        {historyTab === 'person' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์รหัสพนักงาน..." value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePersonSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }} />
              <button onClick={handlePersonSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}

        {/* Budget Overview Chart — moved to bottom */}
        {historyTab === 'overview' && !loading && (
          <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              💰 งบประมาณ vs ค่าใช้จ่ายจริง รายเดือน
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              เปรียบเทียบงบประมาณที่วางแผนกับค่าใช้จ่ายจริงในแต่ละเดือน
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginBottom: 8 }}>
              {globalMonthly.map((d, i) => {
                const maxBudget = Math.max(...globalMonthly.map(m => Math.max(m.budget, m.actual)), 1);
                const budgetH = (d.budget / maxBudget) * 120;
                const actualH = (d.actual / maxBudget) * 120;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 120 }}>
                      <div style={{ width: '40%', height: budgetH || 1, background: '#93c5fd', borderRadius: '3px 3px 0 0' }} title={`งบ: ${d.budget.toLocaleString()}`} />
                      <div style={{ width: '40%', height: actualH || 1, background: d.actual > d.budget ? '#f87171' : '#4ade80', borderRadius: '3px 3px 0 0' }} title={`จริง: ${d.actual.toLocaleString()}`} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{d.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd', display: 'inline-block' }} /> งบประมาณ
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> ค่าใช้จ่ายจริง
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f87171', display: 'inline-block' }} /> เกินงบ
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>งบรวม: <b style={{ color: '#3b82f6' }}>{totals.budget.toLocaleString()} ฿</b></span>
              <span style={{ color: 'var(--text-secondary)' }}>ใช้จริง: <b style={{ color: totals.actual > totals.budget ? '#dc2626' : '#16a34a' }}>{totals.actual.toLocaleString()} ฿</b></span>
              <span style={{ color: 'var(--text-secondary)' }}>คงเหลือ: <b style={{ color: totals.budget - totals.actual >= 0 ? '#16a34a' : '#dc2626' }}>{(totals.budget - totals.actual).toLocaleString()} ฿</b></span>
            </div>
          </div>
        )}

        {/* Course Detail Modal */}
        {detailCourse && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, overflowY: 'auto' }}
            onClick={() => setDetailCourse(null)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 12, width: '95%', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{detailCourse.courseName}</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {detailCourse.company}
                    </span>
                    {detailCourse.category && (
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>
                        {detailCourse.category}
                      </span>
                    )}
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: detailCourse.inHouseExternal?.toLowerCase().includes('in') ? '#dbeafe' : '#f3e8ff', color: detailCourse.inHouseExternal?.toLowerCase().includes('in') ? '#1d4ed8' : '#7c3aed' }}>
                      {detailCourse.inHouseExternal?.toLowerCase().includes('in') ? 'In-House' : 'External'}
                    </span>
                    {detailCourse.dsd && (
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 10 }}>
                        ส่งกรมพัฒน์ได้
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDetailCourse(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px' }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                {/* Status bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: detailCourse.status === 'completed' ? '#f0fdf4' : detailCourse.status === 'scheduled' ? '#eff6ff' : '#f9fafb', border: `1px solid ${detailCourse.status === 'completed' ? '#bbf7d0' : detailCourse.status === 'scheduled' ? '#bfdbfe' : '#e5e7eb'}` }}>
                  <span style={{ fontSize: 20 }}>{detailCourse.status === 'completed' ? '✅' : detailCourse.status === 'scheduled' ? '📅' : '⏳'}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: detailCourse.status === 'completed' ? '#16a34a' : detailCourse.status === 'scheduled' ? '#2563eb' : '#6b7280' }}>
                      {detailCourse.status === 'completed' ? 'อบรมแล้ว' : detailCourse.status === 'scheduled' ? 'กำหนดวันแล้ว' : 'ยังไม่กำหนดวัน'}
                    </div>
                  </div>
                </div>

                {/* Comparison Table */}
                {(() => {
                  const actualPax = detailCourse.actualParticipants || detailCourse.attendeeCount || 0;
                  const plannedTotalHours = detailCourse.hours * detailCourse.participants;
                  const actualTotalManHours = detailCourse.totalManHours || (actualPax * (detailCourse.actualHours || detailCourse.hours));
                  const cmpTd: React.CSSProperties = { padding: '10px 16px', textAlign: 'right', fontWeight: 600 };
                  const labelTd: React.CSSProperties = { padding: '10px 16px', fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 };
                  return (
                <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', width: '34%' }}>รายการ</th>
                        <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', width: '33%' }}>ตามแผน</th>
                        <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', width: '33%' }}>จริง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Month / Date */}
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={labelTd}>📅 เดือน / วันที่อบรม</td>
                        <td style={{ ...cmpTd, color: 'var(--text-primary)' }}>
                          {MONTH_LABELS[detailCourse.plannedMonth - 1]}
                        </td>
                        <td style={cmpTd}>
                          {detailCourse.scheduledDate ? (
                            <span style={{ color: '#16a34a' }}>
                              {formatDate(detailCourse.scheduledDate)}
                              {detailCourse.scheduledDateEnd && detailCourse.scheduledDateEnd !== detailCourse.scheduledDate && (
                                <span> - {formatDate(detailCourse.scheduledDateEnd)}</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: '#dc2626', fontSize: 12 }}>ยังไม่กำหนด</span>
                          )}
                        </td>
                      </tr>
                      {/* Participants */}
                      <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <td style={labelTd}>👥 จำนวนผู้เข้าอบรม</td>
                        <td style={{ ...cmpTd, color: 'var(--text-primary)' }}>
                          {detailCourse.participants ? `${detailCourse.participants} คน` : '-'}
                        </td>
                        <td style={cmpTd}>
                          {actualPax > 0 ? (
                            <span style={{ color: '#16a34a' }}>
                              {actualPax} คน
                              {detailCourse.participants > 0 && (
                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                                  ({Math.round((actualPax / detailCourse.participants) * 100)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                      </tr>
                      {/* Hours per course */}
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={labelTd}>⏱️ ชั่วโมงอบรม / หลักสูตร</td>
                        <td style={{ ...cmpTd, color: 'var(--text-primary)' }}>
                          {detailCourse.hours ? `${detailCourse.hours} ชม.` : '-'}
                        </td>
                        <td style={cmpTd}>
                          {detailCourse.actualHours ? (
                            <span style={{ color: '#16a34a' }}>{detailCourse.actualHours} ชม.</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                      </tr>
                      {/* Total Man-Hours */}
                      <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <td style={labelTd}>📊 จำนวนชั่วโมงรวม (Man-hrs)</td>
                        <td style={{ ...cmpTd, color: 'var(--text-primary)' }}>
                          {plannedTotalHours ? `${plannedTotalHours.toLocaleString()} ชม.` : '-'}
                        </td>
                        <td style={cmpTd}>
                          {actualTotalManHours > 0 ? (
                            <span style={{ color: '#16a34a' }}>
                              {actualTotalManHours.toLocaleString()} ชม.
                              {plannedTotalHours > 0 && (
                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                                  ({Math.round((actualTotalManHours / plannedTotalHours) * 100)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                      </tr>
                      {/* Budget */}
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={labelTd}>💰 งบประมาณ</td>
                        <td style={{ ...cmpTd, color: 'var(--text-primary)' }}>
                          {detailCourse.budget ? `${detailCourse.budget.toLocaleString()} ฿` : '-'}
                        </td>
                        <td style={cmpTd}>
                          {detailCourse.actualCost ? (
                            <span style={{ color: detailCourse.actualCost > detailCourse.budget ? '#dc2626' : '#16a34a' }}>
                              {detailCourse.actualCost.toLocaleString()} ฿
                              {detailCourse.budget > 0 && (
                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                                  ({Math.round((detailCourse.actualCost / detailCourse.budget) * 100)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                  );
                })()}

                {/* Additional Info */}
                {(detailCourse.instructorName || detailCourse.trainingLocation || detailCourse.trainingMethod || detailCourse.note) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                    {detailCourse.instructorName && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>🎓 วิทยากร</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{detailCourse.instructorName}</div>
                      </div>
                    )}
                    {detailCourse.trainingLocation && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>📍 สถานที่อบรม</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{detailCourse.trainingLocation}</div>
                      </div>
                    )}
                    {detailCourse.trainingMethod && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>📋 รูปแบบการอบรม</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{detailCourse.trainingMethod}</div>
                      </div>
                    )}
                    {detailCourse.note && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>📝 หมายเหตุ</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{detailCourse.note}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Attendees */}
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                    👥 รายชื่อผู้เข้าอบรม ({detailLoading ? '...' : detailAttendees.length} คน)
                  </h4>
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>กำลังโหลด...</div>
                  ) : detailAttendees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12, background: 'var(--bg-secondary)', borderRadius: 6 }}>ยังไม่มีรายชื่อผู้เข้าอบรม</div>
                  ) : (
                    <div style={{ borderRadius: 6, border: '1px solid var(--border)', maxHeight: 250, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>
                          <tr>
                            <th style={{ ...th, fontSize: 11 }}>#</th>
                            <th style={{ ...th, textAlign: 'left', fontSize: 11 }}>รหัส</th>
                            <th style={{ ...th, textAlign: 'left', fontSize: 11 }}>ชื่อ-สกุล</th>
                            <th style={{ ...th, textAlign: 'left', fontSize: 11 }}>ตำแหน่ง</th>
                            <th style={{ ...th, textAlign: 'left', fontSize: 11 }}>แผนก</th>
                            <th style={{ ...th, fontSize: 11 }}>ชม.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailAttendees.map((a: Record<string, unknown>, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={td}>{i + 1}</td>
                              <td style={{ ...td, textAlign: 'left' }}>{a.emp_code as string || '-'}</td>
                              <td style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{a.first_name as string} {a.last_name as string}</td>
                              <td style={{ ...td, textAlign: 'left' }}>{a.position as string || '-'}</td>
                              <td style={{ ...td, textAlign: 'left' }}>{a.department as string || '-'}</td>
                              <td style={td}>{(a.hours_attended as number) || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Uploaded Files */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                    📎 ไฟล์ที่อัปโหลด
                  </h4>
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>กำลังโหลด...</div>
                  ) : detailFiles.photos.length === 0 && detailFiles.signin.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12, background: 'var(--bg-secondary)', borderRadius: 6 }}>ยังไม่มีไฟล์ที่อัปโหลด</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {detailFiles.photos.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>📸 รูปภาพการอบรม ({detailFiles.photos.length} ไฟล์)</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {detailFiles.photos.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ width: 80, height: 80, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', display: 'block' }}>
                                <img src={url} alt={`photo-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {detailFiles.signin.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>📝 ใบลงชื่อ ({detailFiles.signin.length} ไฟล์)</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {detailFiles.signin.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}>
                                📄 ไฟล์ {i + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Link to company training page */}
                {canAccessCompany(detailCourse.companyId) && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <Link href={`/company/${detailCourse.companyId}/training`}
                      style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                      ไปหน้าอบรมของ {detailCourse.company} →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  function renderSearchResults() {
    if (searching) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>กำลังค้นหา...</div>;
    if (searchResults.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>ไม่พบข้อมูล</div>;

    return (
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th>
              <th style={th}>รหัส</th>
              <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
              <th style={th}>บริษัท</th>
              <th style={th}>วันอบรม</th>
              <th style={th}>ชม.</th>
              <th style={th}>ประเภท</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((r: Record<string, unknown>, i: number) => {
              const plan = r.training_plans as Record<string, unknown> | null;
              const session = r.training_sessions as Record<string, unknown> | null;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{r.first_name as string} {r.last_name as string}</td>
                  <td style={td}>{r.emp_code as string || '-'}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{plan?.course_name as string || '-'}</td>
                  <td style={td}>{r.company_id as string}</td>
                  <td style={td}>{session?.scheduled_date_start ? formatDate(session.scheduled_date_start as string) : '-'}</td>
                  <td style={td}>{r.hours_attended as number || plan?.hours_per_course as number || '-'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: r.registration_type === 'attended' ? '#dcfce7' : '#dbeafe', color: r.registration_type === 'attended' ? '#16a34a' : '#3b82f6' }}>
                      {r.registration_type === 'attended' ? 'เข้าอบรม' : 'ลงทะเบียน'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--bg-secondary)' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' };

function formatDate(d: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function KPIBox({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        {sub && <span style={{ fontSize: 12, color: color || 'var(--text-secondary)', fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  );
}
