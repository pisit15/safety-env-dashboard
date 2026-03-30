'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { Upload, Calendar, Users, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, PauseCircle, FileSpreadsheet, Trash2, Plus, ChevronDown } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  planned: { label: 'ตามแผน', color: '#6b7280', bg: '#f3f4f6', icon: '○' },
  scheduled: { label: 'กำหนดวันแล้ว', color: '#3b82f6', bg: '#dbeafe', icon: '◉' },
  completed: { label: 'อบรมแล้ว', color: '#16a34a', bg: '#dcfce7', icon: '●' },
  cancelled: { label: 'ยกเลิก', color: '#dc2626', bg: '#fee2e2', icon: '✕' },
  postponed: { label: 'เลื่อน', color: '#f59e0b', bg: '#fef3c7', icon: '◐' },
};

interface TrainingPlan {
  id: string;
  company_id: string;
  year: number;
  course_no: number;
  category: string;
  course_name: string;
  in_house_external: string;
  planned_month: number;
  hours_per_course: number;
  planned_participants: number;
  total_planned_hours: number;
  budget: number;
  target_group: string;
  training_necessity: string;
  responsible_person: string;
  remarks: string;
  dsd_eligible: boolean;
  training_sessions: TrainingSession[];
}

interface TrainingSession {
  id: string;
  plan_id: string;
  company_id: string;
  status: string;
  scheduled_date_start: string | null;
  scheduled_date_end: string | null;
  actual_cost: number;
  actual_participants: number;
  hours_per_course: number;
  total_man_hours: number;
  note: string;
  hr_submitted: boolean;
  updated_by: string;
  postponed_to_month: number | null;
  original_planned_month: number | null;
  training_attendees?: { count: number }[];
  // DSD pre-training
  instructor_name: string | null;
  training_location: string | null;
  training_method: string | null;
  dsd_submitted: boolean;
  dsd_submitted_date: string | null;
  dsd_approved: boolean;
  dsd_approved_date: string | null;
  // DSD post-training
  actual_hours: number;
  dsd_report_submitted: boolean;
  dsd_report_submitted_date: string | null;
  dsd_approved_headcount: number;
  photos_submitted: boolean;
  signin_sheet_submitted: boolean;
}

interface Attendee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  position: string;
  department: string;
  registration_type: string;
  hours_attended: number;
}

export default function CompanyTraining() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === companyId);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal form state
  const [modalStatus, setModalStatus] = useState('planned');
  const [modalDateStart, setModalDateStart] = useState('');
  const [modalDateEnd, setModalDateEnd] = useState('');
  const [modalActualCost, setModalActualCost] = useState(0);
  const [modalNote, setModalNote] = useState('');
  const [modalPostponedMonth, setModalPostponedMonth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // DSD pre-training state
  const [modalInstructor, setModalInstructor] = useState('');
  const [modalLocation, setModalLocation] = useState('');
  const [modalMethod, setModalMethod] = useState('');
  const [modalDsdSubmitted, setModalDsdSubmitted] = useState(false);
  const [modalDsdApproved, setModalDsdApproved] = useState(false);

  // DSD post-training state
  const [modalActualHours, setModalActualHours] = useState(0);
  const [modalDsdReportSubmitted, setModalDsdReportSubmitted] = useState(false);
  const [modalPhotosSubmitted, setModalPhotosSubmitted] = useState(false);
  const [modalSigninSubmitted, setModalSigninSubmitted] = useState(false);
  const [modalDsdHeadcount, setModalDsdHeadcount] = useState(0);

  // Attendee state
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [newAttendee, setNewAttendee] = useState({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '' });

  // Employee suggestion state (reuse previously added attendees)
  const [companyEmployees, setCompanyEmployees] = useState<{ emp_code: string; first_name: string; last_name: string; gender: string; position: string; department: string }[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpSuggestions, setShowEmpSuggestions] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [importSheet, setImportSheet] = useState('');
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [importing, setImporting] = useState(false);

  // Auth
  const isLoggedIn = auth.isAdmin || !!auth.companyAuth[companyId];
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError('');
    const result = await auth.companyLogin(companyId, loginUser, loginPass);
    setLoggingIn(false);
    if (result.success) {
      setShowLoginDialog(false);
      setLoginUser('');
      setLoginPass('');
    } else {
      setLoginError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training/plans?companyId=${companyId}&year=${selectedYear}`);
      const data = await res.json();
      if (Array.isArray(data)) setPlans(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, selectedYear]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const fetchAttendees = async (sessionId: string) => {
    setLoadingAttendees(true);
    try {
      const res = await fetch(`/api/training/attendees?sessionId=${sessionId}`);
      const data = await res.json();
      if (Array.isArray(data)) setAttendees(data);
    } catch { setAttendees([]); }
    setLoadingAttendees(false);
  };

  const fetchCompanyEmployees = async () => {
    if (employeesLoaded) return;
    try {
      const res = await fetch(`/api/training/employees?companyId=${companyId}`);
      const data = await res.json();
      if (Array.isArray(data)) setCompanyEmployees(data);
      setEmployeesLoaded(true);
    } catch { /* ignore */ }
  };

  const openPlanModal = (plan: TrainingPlan) => {
    setSelectedPlan(plan);
    const session = plan.training_sessions?.[0];
    setModalStatus(session?.status || 'planned');
    setModalDateStart(session?.scheduled_date_start || '');
    setModalDateEnd(session?.scheduled_date_end || '');
    setModalActualCost(session?.actual_cost || 0);
    setModalNote(session?.note || '');
    setModalPostponedMonth(session?.postponed_to_month || null);
    // DSD pre-training
    setModalInstructor(session?.instructor_name || '');
    setModalLocation(session?.training_location || '');
    setModalMethod(session?.training_method || '');
    setModalDsdSubmitted(session?.dsd_submitted || false);
    setModalDsdApproved(session?.dsd_approved || false);
    // DSD post-training
    setModalActualHours(session?.actual_hours || 0);
    setModalDsdReportSubmitted(session?.dsd_report_submitted || false);
    setModalPhotosSubmitted(session?.photos_submitted || false);
    setModalSigninSubmitted(session?.signin_sheet_submitted || false);
    setModalDsdHeadcount(session?.dsd_approved_headcount || 0);
    setShowModal(true);
    if (session?.id) fetchAttendees(session.id);
    else setAttendees([]);
  };

  const handleSaveSession = async () => {
    if (!selectedPlan) return;
    if (modalStatus === 'postponed' && !modalPostponedMonth) {
      alert('กรุณาเลือกเดือนที่จะเลื่อนไป');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          company_id: companyId,
          status: modalStatus,
          scheduled_date_start: modalDateStart || null,
          scheduled_date_end: modalDateEnd || null,
          actual_cost: modalActualCost,
          hours_per_course: selectedPlan.hours_per_course,
          total_man_hours: modalActualHours * attendees.length,
          note: modalNote,
          updated_by: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
          postponed_to_month: modalStatus === 'postponed' ? modalPostponedMonth : null,
          original_planned_month: modalStatus === 'postponed' ? (selectedPlan.training_sessions?.[0]?.original_planned_month || selectedPlan.planned_month) : null,
          // DSD pre-training
          instructor_name: modalInstructor || null,
          training_location: modalLocation || null,
          training_method: modalMethod || null,
          dsd_submitted: modalDsdSubmitted,
          dsd_approved: modalDsdApproved,
          // DSD post-training
          actual_hours: modalActualHours,
          dsd_report_submitted: modalDsdReportSubmitted,
          photos_submitted: modalPhotosSubmitted,
          signin_sheet_submitted: modalSigninSubmitted,
          dsd_approved_headcount: modalDsdHeadcount,
        }),
      });
      if (res.ok) {
        await fetchPlans();
        setShowModal(false);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleAddAttendee = async () => {
    const session = selectedPlan?.training_sessions?.[0];
    if (!session || !selectedPlan) return;
    try {
      const res = await fetch('/api/training/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          plan_id: selectedPlan.id,
          company_id: companyId,
          ...newAttendee,
          registration_type: 'registered',
        }),
      });
      if (res.ok) {
        await fetchAttendees(session.id);
        setNewAttendee({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '' });
        setEmpSearch('');
        setShowAddAttendee(false);
        setEmployeesLoaded(false); // refresh employee list on next open
      }
    } catch (e) { console.error(e); }
  };

  const selectEmployee = (emp: typeof companyEmployees[0]) => {
    setNewAttendee({
      emp_code: emp.emp_code || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      gender: emp.gender || '',
      position: emp.position || '',
      department: emp.department || '',
    });
    setEmpSearch('');
    setShowEmpSuggestions(false);
  };

  const handleDeleteAttendee = async (id: string) => {
    const session = selectedPlan?.training_sessions?.[0];
    if (!confirm('ลบผู้เข้าอบรมนี้?')) return;
    try {
      await fetch(`/api/training/attendees?id=${id}&sessionId=${session?.id || ''}`, { method: 'DELETE' });
      if (session?.id) await fetchAttendees(session.id);
    } catch (e) { console.error(e); }
  };

  const handleUploadAttendeeExcel = async (file: File) => {
    const session = selectedPlan?.training_sessions?.[0];
    if (!session || !selectedPlan) { alert('กรุณาบันทึกสถานะก่อน แล้วจึง upload รายชื่อ'); return; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', session.id);
    formData.append('planId', selectedPlan.id);
    formData.append('companyId', companyId);
    try {
      const res = await fetch('/api/training/import', { method: 'PUT', body: formData });
      const data = await res.json();
      if (data.success) {
        alert(`นำเข้ารายชื่อสำเร็จ ${data.count} คน`);
        await fetchAttendees(session.id);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
  };

  // Import training plan from Excel
  const handleImportStep1 = async () => {
    if (!importFile) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('companyId', companyId);
    formData.append('year', String(selectedYear));
    try {
      const res = await fetch('/api/training/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.sheetNames) {
        setImportSheets(data.sheetNames);
        if (data.sheetNames.length === 1) setImportSheet(data.sheetNames[0]);
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setImporting(false);
  };

  const handleImportStep2 = async () => {
    if (!importFile || !importSheet) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('companyId', companyId);
    formData.append('year', String(selectedYear));
    formData.append('sheetName', importSheet);
    formData.append('preview', 'true');
    try {
      const res = await fetch('/api/training/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.courses) setImportPreview(data.courses);
      else alert(data.error || 'ไม่พบข้อมูล');
    } catch { alert('เกิดข้อผิดพลาด'); }
    setImporting(false);
  };

  const handleImportConfirm = async () => {
    if (!importFile || !importSheet) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('companyId', companyId);
    formData.append('year', String(selectedYear));
    formData.append('sheetName', importSheet);
    try {
      const res = await fetch('/api/training/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        alert(`นำเข้าสำเร็จ ${data.count} หลักสูตร`);
        setShowImportModal(false);
        setImportFile(null);
        setImportSheets([]);
        setImportSheet('');
        setImportPreview(null);
        await fetchPlans();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setImporting(false);
  };

  // Stats
  const totalCourses = plans.length;
  const completedCourses = plans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
  const scheduledCourses = plans.filter(p => p.training_sessions?.[0]?.status === 'scheduled').length;
  const pendingCourses = plans.filter(p => !p.training_sessions?.[0] || p.training_sessions[0].status === 'planned').length;
  const totalBudget = plans.reduce((s, p) => s + (p.budget || 0), 0);
  const totalActual = plans.reduce((s, p) => s + (p.training_sessions?.[0]?.actual_cost || 0), 0);

  // Monthly chart data: planned vs completed per month
  // When postponed from month X → Y, the plan moves to month Y
  const getEffectiveMonth = (p: TrainingPlan) => {
    const s = p.training_sessions?.[0];
    if (s?.status === 'postponed' && s.postponed_to_month) return s.postponed_to_month;
    // If completed/scheduled but was postponed, use postponed_to_month
    if (s?.postponed_to_month && s?.original_planned_month) return s.postponed_to_month;
    return p.planned_month;
  };

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const planned = plans.filter(p => getEffectiveMonth(p) === month).length;
    const completed = plans.filter(p => {
      if (getEffectiveMonth(p) !== month) return false;
      const s = p.training_sessions?.[0];
      return s?.status === 'completed';
    }).length;
    const scheduled = plans.filter(p => {
      if (getEffectiveMonth(p) !== month) return false;
      const s = p.training_sessions?.[0];
      return s?.status === 'scheduled';
    }).length;
    return { month, label: MONTH_LABELS[i], planned, completed, scheduled };
  });

  // Cumulative completion %
  let cumPlanned = 0;
  let cumCompleted = 0;
  const monthlyChartData = monthlyData.map(d => {
    cumPlanned += d.planned;
    cumCompleted += d.completed;
    const pct = cumPlanned > 0 ? Math.round((cumCompleted / cumPlanned) * 100) : 0;
    return { ...d, cumPct: pct };
  });

  const overallPct = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
  const maxPlanned = Math.max(...monthlyData.map(d => d.planned), 1);

  // 30-day warning
  const today = new Date();
  const warningPlans = plans.filter(p => {
    const session = p.training_sessions?.[0];
    if (!session || session.status === 'completed' || session.status === 'cancelled') return false;
    // Check if planned month is approaching and no date set
    const effectiveMonth = getEffectiveMonth(p);
    if (!session.scheduled_date_start && effectiveMonth > 0) {
      const plannedDate = new Date(selectedYear, effectiveMonth - 1, 1);
      const diffDays = (plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 45 && diffDays > -30;
    }
    return false;
  });

  const filteredPlans = statusFilter === 'all' ? plans : plans.filter(p => {
    const status = p.training_sessions?.[0]?.status || 'planned';
    return status === statusFilter;
  });

  const getSession = (plan: TrainingPlan): TrainingSession | undefined => plan.training_sessions?.[0];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            📋 แผนอบรมประจำปี — {company?.name || companyId.toUpperCase()}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
            Training Plan {selectedYear} • จัดการแผนอบรม อัปเดตสถานะ และบันทึกผู้เข้าอบรม
          </p>
        </div>

        {/* Year selector + Import button */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 14 }}
          >
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 14 }}>
            <option value="all">ทั้งหมด</option>
            <option value="planned">ตามแผน</option>
            <option value="scheduled">กำหนดวันแล้ว</option>
            <option value="completed">อบรมแล้ว</option>
            <option value="cancelled">ยกเลิก</option>
            <option value="postponed">เลื่อน</option>
          </select>

          {auth.isAdmin && (
            <button onClick={() => setShowImportModal(true)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} /> นำเข้าแผนอบรม (Excel)
            </button>
          )}
        </div>

        {/* Warning alerts */}
        {warningPlans.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#92400e', fontSize: 14, marginBottom: 4 }}>
              ⚠️ แจ้งเตือน: {warningPlans.length} หลักสูตรใกล้ถึงกำหนดแต่ยังไม่กำหนดวันอบรม
            </div>
            {warningPlans.slice(0, 3).map(p => (
              <div key={p.id} style={{ fontSize: 13, color: '#78350f' }}>
                • {p.course_name} (กำหนด {MONTH_LABELS[p.planned_month - 1] || '?'})
              </div>
            ))}
            {warningPlans.length > 3 && <div style={{ fontSize: 12, color: '#92400e' }}>...และอีก {warningPlans.length - 3} หลักสูตร</div>}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard icon="📚" label="หลักสูตรทั้งหมด" value={totalCourses} />
          <StatCard icon="✅" label="อบรมแล้ว" value={completedCourses} color="var(--success)" />
          <StatCard icon="📅" label="กำหนดวันแล้ว" value={scheduledCourses} color="var(--info)" />
          <StatCard icon="⏳" label="รอดำเนินการ" value={pendingCourses} color="var(--warning)" />
          <StatCard icon="💰" label="งบประมาณ" value={`${(totalBudget / 1000).toFixed(0)}K`} />
          <StatCard icon="💳" label="ค่าใช้จ่ายจริง" value={`${(totalActual / 1000).toFixed(0)}K`} color={totalActual > totalBudget ? 'var(--danger)' : 'var(--success)'} />
        </div>

        {/* Monthly Chart */}
        {plans.length > 0 && (
          <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  สถานะการอบรมรายเดือน
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  เปรียบเทียบแผน vs จัดอบรมจริง ประจำปี {selectedYear}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                  {overallPct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ความสำเร็จรวม</div>
              </div>
            </div>

            {/* Bar Chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, marginBottom: 8 }}>
              {monthlyChartData.map((d, i) => {
                const currentMonth = new Date().getMonth() + 1;
                const isPast = d.month <= currentMonth;
                const barHeight = maxPlanned > 0 ? (d.planned / maxPlanned) * 130 : 0;
                const completedHeight = d.planned > 0 ? (d.completed / d.planned) * barHeight : 0;
                const scheduledHeight = d.planned > 0 ? (d.scheduled / d.planned) * barHeight : 0;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {/* Count label */}
                    {d.planned > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: d.completed === d.planned && d.planned > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {d.completed}/{d.planned}
                      </div>
                    )}
                    {/* Stacked bar */}
                    <div style={{ width: '100%', height: barHeight || 2, borderRadius: 4, position: 'relative', overflow: 'hidden', background: isPast ? '#fee2e2' : 'var(--bg-secondary)' }}>
                      {/* Scheduled (blue) */}
                      {scheduledHeight > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: scheduledHeight, background: '#93c5fd', borderRadius: '0 0 4px 4px' }} />
                      )}
                      {/* Completed (green) */}
                      {completedHeight > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: completedHeight, background: '#4ade80', borderRadius: '0 0 4px 4px' }} />
                      )}
                    </div>
                    {/* Month label */}
                    <div style={{ fontSize: 10, color: d.month === currentMonth ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: d.month === currentMonth ? 700 : 400 }}>
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> อบรมแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd', display: 'inline-block' }} /> กำหนดวันแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fee2e2', display: 'inline-block' }} /> เลยกำหนด
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-secondary)', display: 'inline-block' }} /> ยังไม่ถึง
              </span>
            </div>

            {/* Cumulative % line */}
            <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>% ความสำเร็จสะสม</div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
                {monthlyChartData.map((d, i) => {
                  const h = (d.cumPct / 100) * 36;
                  const color = d.cumPct >= 80 ? '#4ade80' : d.cumPct >= 50 ? '#fbbf24' : '#f87171';
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {d.cumPct > 0 && <div style={{ fontSize: 9, fontWeight: 600, color, marginBottom: 2 }}>{d.cumPct}%</div>}
                      <div style={{ width: '80%', height: Math.max(h, 2), borderRadius: 2, background: d.planned === 0 && d.completed === 0 ? 'var(--bg-secondary)' : color }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div>ยังไม่มีแผนอบรม</div>
            {auth.isAdmin && <div style={{ fontSize: 13, marginTop: 8 }}>กดปุ่ม &quot;นำเข้าแผนอบรม&quot; เพื่อ import จาก Excel</div>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--card-solid)', borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, minWidth: 250, textAlign: 'left' }}>ชื่อหลักสูตร</th>
                  <th style={thStyle}>ประเภท</th>
                  <th style={thStyle}>เดือน</th>
                  <th style={thStyle}>ชม.</th>
                  <th style={thStyle}>คน</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>งบ (฿)</th>
                  <th style={thStyle}>สถานะ</th>
                  <th style={thStyle}>วันอบรม</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>จริง (฿)</th>
                  <th style={thStyle}>ผู้เข้า</th>
                  <th style={thStyle}>Man-hrs</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan, i) => {
                  const session = getSession(plan);
                  const status = session?.status || 'planned';
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
                  return (
                    <tr key={plan.id}
                      onClick={() => isLoggedIn ? openPlanModal(plan) : setShowLoginDialog(true)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: i % 2 === 0 ? 'var(--bg)' : 'var(--card-solid)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--card-solid)'; }}
                    >
                      <td style={tdStyle}>{plan.course_no || i + 1}</td>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>
                        <div>{plan.course_name}</div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          {plan.category && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{plan.category}</span>}
                          {session?.original_planned_month && session?.postponed_to_month && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: session?.status === 'completed' ? '#d1fae5' : '#fef3c7', color: session?.status === 'completed' ? '#065f46' : '#92400e', fontWeight: 600 }}>
                              เลื่อนจาก {MONTH_LABELS[session.original_planned_month - 1]} → {MONTH_LABELS[session.postponed_to_month - 1]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: plan.in_house_external?.toLowerCase().includes('in') ? '#dbeafe' : '#f3e8ff', color: plan.in_house_external?.toLowerCase().includes('in') ? '#1d4ed8' : '#7c3aed' }}>
                          {plan.in_house_external?.toLowerCase().includes('in') ? 'In-House' : 'External'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {(() => {
                          const effMonth = session?.postponed_to_month || plan.planned_month;
                          return effMonth ? MONTH_LABELS[effMonth - 1] : '-';
                        })()}
                      </td>
                      <td style={tdStyle}>{plan.hours_per_course || '-'}</td>
                      <td style={tdStyle}>
                        {(() => {
                          const attCount = session?.training_attendees?.[0]?.count || 0;
                          return attCount > 0
                            ? attCount
                            : <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{plan.planned_participants || '-'}</span>;
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{plan.budget ? plan.budget.toLocaleString() : '-'}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td style={tdStyle}>{session?.scheduled_date_start ? formatDate(session.scheduled_date_start) : '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{session?.actual_cost ? session.actual_cost.toLocaleString() : '-'}</td>
                      <td style={tdStyle}>{session?.actual_participants || '-'}</td>
                      <td style={tdStyle}>{session?.total_man_hours || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Modal */}
        {showModal && selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, overflowY: 'auto' }}
            onClick={() => setShowModal(false)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 16, width: '95%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-secondary)', borderRadius: '16px 16px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)', flex: 1 }}>
                    {selectedPlan.course_name}
                  </h2>
                  {selectedPlan.dsd_eligible !== false && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                      ส่งกรมพัฒน์ได้
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                  {selectedPlan.category} • {selectedPlan.in_house_external} • {selectedPlan.planned_month ? MONTH_LABELS[selectedPlan.planned_month - 1] : 'ยังไม่กำหนดเดือน'} {selectedYear}
                  • {selectedPlan.hours_per_course} ชม. • งบ {selectedPlan.budget?.toLocaleString()} ฿
                </div>
                {/* DSD deadline warnings */}
                {selectedPlan.dsd_eligible !== false && modalDateStart && !modalDsdSubmitted && (() => {
                  const isInHouse = selectedPlan.in_house_external?.toLowerCase().includes('in');
                  const daysRequired = isInHouse ? 60 : 15;
                  const dStart = new Date(modalDateStart);
                  const diffDays = Math.ceil((dStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays > 0 && diffDays <= daysRequired + 7) {
                    return (
                      <div style={{ marginTop: 8, background: diffDays <= daysRequired ? '#fef2f2' : '#fefce8', border: `1px solid ${diffDays <= daysRequired ? '#dc2626' : '#ca8a04'}`, borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                        <strong style={{ color: diffDays <= daysRequired ? '#dc2626' : '#ca8a04' }}>
                          {diffDays <= daysRequired ? '⚠️ เลยกำหนดยื่น!' : '⏰ ใกล้กำหนดยื่น'}
                        </strong>{' '}
                        ต้องยื่น {isInHouse ? 'ยป.1' : 'ยป.3'} ล่วงหน้า {daysRequired} วัน (เหลือ {diffDays} วัน)
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Modal Body */}
              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

                {/* ═══════════════ SECTION 1: การวางแผน ═══════════════ */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📋</div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>การวางแผน</h3>
                  </div>

                  {/* Status */}
                  <label style={labelStyle}>สถานะ</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button key={key} onClick={() => setModalStatus(key)}
                        style={{ padding: '6px 4px', borderRadius: 6, border: modalStatus === key ? `2px solid ${cfg.color}` : '1px solid var(--border)',
                          background: modalStatus === key ? cfg.bg : 'transparent', color: cfg.color, fontSize: 11, cursor: 'pointer', fontWeight: modalStatus === key ? 700 : 400 }}>
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Postponed month selector */}
                  {modalStatus === 'postponed' && (
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                      <label style={{ ...labelStyle, color: '#92400e' }}>เลื่อนไปเดือนไหน? *</label>
                      <select value={modalPostponedMonth || ''} onChange={e => setModalPostponedMonth(e.target.value ? Number(e.target.value) : null)}
                        style={{ ...inputStyle, background: '#fff', borderColor: '#f59e0b' }}>
                        <option value="">-- เลือกเดือนใหม่ --</option>
                        {MONTH_LABELS.map((label, i) => (
                          <option key={i} value={i + 1}>{label} {selectedYear}</option>
                        ))}
                      </select>
                      {selectedPlan && (
                        <div style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>
                          เดิมกำหนดเดือน: {selectedPlan.planned_month ? MONTH_LABELS[selectedPlan.planned_month - 1] : 'ยังไม่กำหนด'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>วันเริ่มอบรม</label>
                      <input type="date" value={modalDateStart} onChange={e => setModalDateStart(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>วันสิ้นสุด</label>
                      <input type="date" value={modalDateEnd} onChange={e => setModalDateEnd(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  {/* Note */}
                  <label style={labelStyle}>หมายเหตุ</label>
                  <textarea value={modalNote} onChange={e => setModalNote(e.target.value)}
                    rows={2} style={{ ...inputStyle, marginBottom: 16, resize: 'vertical' }} />
                </div>

                {/* ═══════════════ SECTION 2: ก่อนอบรม — ยื่นกรมพัฒน์ฯ ═══════════════ */}
                {selectedPlan.dsd_eligible !== false && (
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📑</div>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                          ก่อนอบรม — ยื่นกรมพัฒน์ฯ ({selectedPlan.in_house_external?.toLowerCase().includes('in') ? 'ยป.1' : 'ยป.3'})
                        </h3>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          ยื่นล่วงหน้า {selectedPlan.in_house_external?.toLowerCase().includes('in') ? '60' : '15'} วันก่อนอบรม
                        </div>
                      </div>
                    </div>

                    {/* Instructor */}
                    <label style={labelStyle}>ชื่อวิทยากร</label>
                    <input value={modalInstructor} onChange={e => setModalInstructor(e.target.value)}
                      placeholder="ระบุชื่อวิทยากร (ต้องตรงกับที่ยื่น)"
                      style={{ ...inputStyle, marginBottom: 12 }} />

                    {/* Location & Method */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>สถานที่อบรม</label>
                        <input value={modalLocation} onChange={e => setModalLocation(e.target.value)}
                          placeholder="ต้องตรงกับที่แจ้ง" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>วิธีการสอน</label>
                        <select value={modalMethod} onChange={e => setModalMethod(e.target.value)} style={inputStyle}>
                          <option value="">-- เลือก --</option>
                          <option value="lecture">บรรยาย</option>
                          <option value="group_activity">กิจกรรมกลุ่ม</option>
                          <option value="workshop">ฝึกปฏิบัติ</option>
                          <option value="elearning">E-Learning</option>
                          <option value="onsite">On-site Training</option>
                          <option value="mixed">ผสมผสาน</option>
                        </select>
                      </div>
                    </div>

                    {/* Hour warning */}
                    {selectedPlan.hours_per_course > 0 && selectedPlan.hours_per_course < 6 && (
                      <div style={{ background: '#fef2f2', borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 11, color: '#991b1b', border: '1px solid #fecaca' }}>
                        ⚠️ หลักสูตรนี้มี {selectedPlan.hours_per_course} ชม. — กรมพัฒน์ฯ กำหนดไม่ต่ำกว่า 6 ชม.
                      </div>
                    )}

                    {/* DSD submission status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: modalDsdSubmitted ? '#dcfce7' : 'var(--bg)' }}>
                        <input type="checkbox" checked={modalDsdSubmitted} onChange={e => setModalDsdSubmitted(e.target.checked)} />
                        <span>ยื่นขอรับรองหลักสูตรแล้ว</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: modalDsdApproved ? '#dcfce7' : 'var(--bg)' }}>
                        <input type="checkbox" checked={modalDsdApproved} onChange={e => setModalDsdApproved(e.target.checked)} />
                        <span>กรมพัฒน์ฯ อนุมัติแล้ว</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Save button (shared) */}
                <button onClick={handleSaveSession} disabled={saving}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 20, opacity: saving ? 0.6 : 1, boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}>
                  {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                </button>

                {/* ═══════════════ SECTION 3: หลังอบรม — ผลการอบรม ═══════════════ */}
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: modalStatus === 'completed' ? '#dcfce7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {modalStatus === 'completed' ? '✅' : '📝'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: modalStatus === 'completed' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>หลังอบรม — ผลการอบรม</h3>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {modalStatus === 'completed'
                          ? 'บันทึกค่าใช้จ่ายจริง ชั่วโมงจริง รายชื่อผู้เข้าอบรม และเอกสารส่งกรมพัฒน์ฯ (รง.1)'
                          : 'เปลี่ยนสถานะเป็น "อบรมแล้ว" เพื่อกรอกข้อมูล'}
                      </div>
                    </div>
                  </div>

                  {modalStatus !== 'completed' && (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '16px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, border: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>🔒</div>
                      เปลี่ยนสถานะเป็น <strong>&quot;อบรมแล้ว&quot;</strong> เพื่อบันทึกผลการอบรม
                    </div>
                  )}

                  {modalStatus === 'completed' && (
                    <>
                      {/* Post-training deadline warning */}
                      {selectedPlan.dsd_eligible !== false && modalDateEnd && !modalDsdReportSubmitted && (() => {
                        const dEnd = new Date(modalDateEnd);
                        const deadline60 = new Date(dEnd.getTime() + 60 * 24 * 60 * 60 * 1000);
                        const jan15 = new Date(selectedYear + 1, 0, 15);
                        const deadline = deadline60 < jan15 ? deadline60 : jan15;
                        const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysLeft <= 30) {
                          return (
                            <div style={{ background: daysLeft <= 0 ? '#fef2f2' : '#fefce8', border: `1px solid ${daysLeft <= 0 ? '#dc2626' : '#ca8a04'}`, borderRadius: 6, padding: '6px 10px', marginBottom: 16, fontSize: 11 }}>
                              <strong style={{ color: daysLeft <= 0 ? '#dc2626' : '#ca8a04' }}>
                                {daysLeft <= 0 ? '⚠️ เลยกำหนดส่ง รง.1!' : `⏰ เหลือ ${daysLeft} วัน`}
                              </strong>{' '}
                              ส่ง รง.1 ภายใน 60 วันหลังอบรม (ไม่เกิน 15 ม.ค. {selectedYear + 1})
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Actual Cost & Hours */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <label style={labelStyle}>ค่าใช้จ่ายจริง (฿)</label>
                          <input type="number" value={modalActualCost} onChange={e => setModalActualCost(Number(e.target.value))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>ชั่วโมงอบรมจริง</label>
                          <input type="number" value={modalActualHours} onChange={e => setModalActualHours(Number(e.target.value))} style={inputStyle} />
                        </div>
                      </div>

                      {/* DSD post-training documents checklist */}
                      {selectedPlan.dsd_eligible !== false && (
                        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>📋 เอกสารส่งกรมพัฒน์ฯ (รง.1)</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={modalPhotosSubmitted} onChange={e => setModalPhotosSubmitted(e.target.checked)} />
                              ส่งภาพถ่ายระหว่างอบรม (ภาพหมู่ + กิจกรรม)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={modalSigninSubmitted} onChange={e => setModalSigninSubmitted(e.target.checked)} />
                              ส่งใบเซ็นชื่อลงทะเบียน
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={modalDsdReportSubmitted} onChange={e => setModalDsdReportSubmitted(e.target.checked)} />
                              ยื่น รง.1 แล้ว
                            </label>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <label style={labelStyle}>จำนวนคนที่กรมพัฒน์ฯ อนุมัติ</label>
                            <input type="number" value={modalDsdHeadcount} onChange={e => setModalDsdHeadcount(Number(e.target.value))}
                              placeholder="0" style={{ ...inputStyle, width: 120 }} />
                          </div>
                        </div>
                      )}

                      {/* Attendees Section */}
                      <div style={{ marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            👥 รายชื่อผู้เข้าอบรม ({attendees.length} คน)
                          </h4>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setShowAddAttendee(!showAddAttendee)}
                              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={12} /> เพิ่ม
                            </button>
                            <label style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Upload size={12} /> Upload Excel
                              <input type="file" accept=".xlsx,.xls" hidden onChange={e => e.target.files?.[0] && handleUploadAttendeeExcel(e.target.files[0])} />
                            </label>
                          </div>
                        </div>

                        {/* Add attendee form */}
                        {showAddAttendee && (
                          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: 12, marginBottom: 12, border: '1px dashed var(--border)' }}>
                            {/* Employee search/suggestion */}
                            <div style={{ position: 'relative', marginBottom: 8 }}>
                              <input
                                placeholder="🔍 ค้นหาพนักงาน (ชื่อ, นามสกุล, รหัส) หรือพิมพ์ใหม่..."
                                value={empSearch}
                                onChange={e => {
                                  setEmpSearch(e.target.value);
                                  setShowEmpSuggestions(true);
                                  if (!employeesLoaded) fetchCompanyEmployees();
                                }}
                                onFocus={() => {
                                  setShowEmpSuggestions(true);
                                  if (!employeesLoaded) fetchCompanyEmployees();
                                }}
                                style={{ ...inputStyle, width: '100%', fontSize: 13 }}
                              />
                              {showEmpSuggestions && companyEmployees.length > 0 && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                  background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 6,
                                  maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                }}>
                                  {companyEmployees
                                    .filter(emp => {
                                      if (!empSearch.trim()) return true;
                                      const q = empSearch.toLowerCase();
                                      return (
                                        (emp.first_name || '').toLowerCase().includes(q) ||
                                        (emp.last_name || '').toLowerCase().includes(q) ||
                                        (emp.emp_code || '').toLowerCase().includes(q) ||
                                        (`${emp.first_name} ${emp.last_name}`).toLowerCase().includes(q)
                                      );
                                    })
                                    .slice(0, 20)
                                    .map((emp, idx) => (
                                      <div key={idx}
                                        onClick={() => selectEmployee(emp)}
                                        style={{
                                          padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)',
                                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <span style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                                          {emp.emp_code ? `รหัส: ${emp.emp_code}` : ''}{emp.department ? ` • ${emp.department}` : ''}{emp.position ? ` • ${emp.position}` : ''}
                                        </span>
                                      </div>
                                    ))
                                  }
                                  {companyEmployees.filter(emp => {
                                    if (!empSearch.trim()) return true;
                                    const q = empSearch.toLowerCase();
                                    return (emp.first_name || '').toLowerCase().includes(q) || (emp.last_name || '').toLowerCase().includes(q) || (emp.emp_code || '').toLowerCase().includes(q) || (`${emp.first_name} ${emp.last_name}`).toLowerCase().includes(q);
                                  }).length === 0 && (
                                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                      ไม่พบ — กรุณากรอกข้อมูลด้านล่าง
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Click outside to close suggestions */}
                            {showEmpSuggestions && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowEmpSuggestions(false)} />}

                            {newAttendee.first_name && (
                              <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                ✓ เลือก: {newAttendee.first_name} {newAttendee.last_name} {newAttendee.emp_code ? `(${newAttendee.emp_code})` : ''}
                              </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                              <input placeholder="รหัสพนักงาน" value={newAttendee.emp_code} onChange={e => setNewAttendee({ ...newAttendee, emp_code: e.target.value })} style={inputStyle} />
                              <input placeholder="ชื่อ *" value={newAttendee.first_name} onChange={e => setNewAttendee({ ...newAttendee, first_name: e.target.value })} style={inputStyle} />
                              <input placeholder="นามสกุล *" value={newAttendee.last_name} onChange={e => setNewAttendee({ ...newAttendee, last_name: e.target.value })} style={inputStyle} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                              <input placeholder="ตำแหน่ง" value={newAttendee.position} onChange={e => setNewAttendee({ ...newAttendee, position: e.target.value })} style={inputStyle} />
                              <input placeholder="แผนก" value={newAttendee.department} onChange={e => setNewAttendee({ ...newAttendee, department: e.target.value })} style={inputStyle} />
                              <select value={newAttendee.gender} onChange={e => setNewAttendee({ ...newAttendee, gender: e.target.value })} style={inputStyle}>
                                <option value="">เพศ</option>
                                <option value="M">ชาย</option>
                                <option value="F">หญิง</option>
                              </select>
                            </div>
                            <button onClick={handleAddAttendee} disabled={!newAttendee.first_name || !newAttendee.last_name}
                              style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                              เพิ่มผู้เข้าอบรม
                            </button>
                          </div>
                        )}

                        {/* Attendee list */}
                        {loadingAttendees ? (
                          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>กำลังโหลด...</div>
                        ) : attendees.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
                            ยังไม่มีรายชื่อผู้เข้าอบรม
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>รหัส</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ชื่อ-สกุล</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>ตำแหน่ง</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>แผนก</th>
                                  <th style={{ padding: '6px 8px' }}>ประเภท</th>
                                  <th style={{ padding: '6px 8px', width: 40 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {attendees.map((a, i) => (
                                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '4px 8px' }}>{i + 1}</td>
                                    <td style={{ padding: '4px 8px' }}>{a.emp_code || '-'}</td>
                                    <td style={{ padding: '4px 8px' }}>{a.first_name} {a.last_name}</td>
                                    <td style={{ padding: '4px 8px' }}>{a.position || '-'}</td>
                                    <td style={{ padding: '4px 8px' }}>{a.department || '-'}</td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: a.registration_type === 'attended' ? '#dcfce7' : '#dbeafe', color: a.registration_type === 'attended' ? '#16a34a' : '#3b82f6' }}>
                                        {a.registration_type === 'attended' ? 'เข้าอบรม' : 'ลงทะเบียน'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAttendee(a.id); }}
                                        style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }}>
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      {/* Save post-training button */}
                      <button onClick={handleSaveSession} disabled={saving}
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1, marginTop: 12 }}>
                        {saving ? 'กำลังบันทึก...' : '💾 บันทึกผลการอบรม'}
                      </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, textAlign: 'right' }}>
                <button onClick={() => setShowModal(false)}
                  style={{ padding: '8px 24px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60 }}
            onClick={() => setShowImportModal(false)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 12, width: '95%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📥 นำเข้าแผนอบรมจาก Excel</h2>
              </div>
              <div style={{ padding: 20, overflowY: 'auto' }}>
                {/* Step 1: Upload file */}
                <label style={labelStyle}>1. เลือกไฟล์ Excel (.xlsx)</label>
                <input type="file" accept=".xlsx,.xls"
                  onChange={e => { setImportFile(e.target.files?.[0] || null); setImportSheets([]); setImportSheet(''); setImportPreview(null); }}
                  style={{ marginBottom: 12, fontSize: 13 }} />

                {importFile && importSheets.length === 0 && (
                  <button onClick={handleImportStep1} disabled={importing}
                    style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
                    {importing ? 'กำลังอ่านไฟล์...' : 'อ่านไฟล์'}
                  </button>
                )}

                {/* Step 2: Select sheet */}
                {importSheets.length > 0 && (
                  <>
                    <label style={labelStyle}>2. เลือก Sheet</label>
                    <select value={importSheet} onChange={e => { setImportSheet(e.target.value); setImportPreview(null); }}
                      style={{ ...inputStyle, marginBottom: 12 }}>
                      <option value="">-- เลือก Sheet --</option>
                      {importSheets.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {importSheet && !importPreview && (
                      <button onClick={handleImportStep2} disabled={importing}
                        style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: 'var(--info)', color: '#fff', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
                        {importing ? 'กำลังอ่าน...' : 'ดูตัวอย่างข้อมูล'}
                      </button>
                    )}
                  </>
                )}

                {/* Step 3: Preview */}
                {importPreview && (
                  <>
                    <label style={labelStyle}>3. ตรวจสอบข้อมูล ({importPreview.length} หลักสูตร)</label>
                    <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', position: 'sticky', top: 0 }}>
                            <th style={{ padding: 4 }}>#</th>
                            <th style={{ padding: 4, textAlign: 'left' }}>หลักสูตร</th>
                            <th style={{ padding: 4 }}>เดือน</th>
                            <th style={{ padding: 4 }}>ชม.</th>
                            <th style={{ padding: 4 }}>คน</th>
                            <th style={{ padding: 4 }}>งบ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((c: Record<string, unknown>, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: 4, textAlign: 'center' }}>{(c.course_no as number) || i + 1}</td>
                              <td style={{ padding: 4 }}>{c.course_name as string}</td>
                              <td style={{ padding: 4, textAlign: 'center' }}>{(c.planned_month as number) ? MONTH_LABELS[(c.planned_month as number) - 1] : '-'}</td>
                              <td style={{ padding: 4, textAlign: 'center' }}>{c.hours_per_course as number || '-'}</td>
                              <td style={{ padding: 4, textAlign: 'center' }}>{c.planned_participants as number || '-'}</td>
                              <td style={{ padding: 4, textAlign: 'right' }}>{(c.budget as number)?.toLocaleString() || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={handleImportConfirm} disabled={importing}
                      style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600, width: '100%' }}>
                      {importing ? 'กำลังนำเข้า...' : `✅ ยืนยันนำเข้า ${importPreview.length} หลักสูตร`}
                    </button>
                  </>
                )}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                <button onClick={() => setShowImportModal(false)}
                  style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Login Dialog */}
        {showLoginDialog && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setShowLoginDialog(false)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 16, padding: 32, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>เข้าสู่ระบบ</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>กรุณา Login เพื่ออัปเดตข้อมูลอบรม — {company?.name || companyId.toUpperCase()}</p>
              </div>

              {loginError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                  {loginError}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Username</label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="ชื่อผู้ใช้"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="รหัสผ่าน"
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loggingIn || !loginUser || !loginPass}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: loggingIn ? 'var(--muted)' : 'var(--accent)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: loggingIn ? 'not-allowed' : 'pointer',
                }}
              >
                {loggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>

              <button
                onClick={() => setShowLoginDialog(false)}
                style={{ width: '100%', padding: '8px', marginTop: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
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

// Helpers
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 };

function formatDate(d: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
