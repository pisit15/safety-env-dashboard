'use client';

import { useState, useEffect, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { useCompanies } from '@/hooks/useCompanies';
import { Upload, Calendar, Users, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, PauseCircle, FileSpreadsheet, Trash2, Plus, ChevronDown, ChevronRight, Edit2, Save, Bell, Eye, EyeOff, X, Filter, RotateCcw, ArrowRight } from 'lucide-react';
import ExportPdfButton from '@/components/ExportPdfButton';
import { STATUS, PALETTE } from '@/lib/she-theme';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  planned: { label: 'ยังไม่กำหนดวัน', color: PALETTE.muted, bg: `${PALETTE.muted}10`, icon: '○' },
  scheduled: { label: 'กำหนดวันแล้ว', color: PALETTE.primary, bg: `${PALETTE.primary}10`, icon: '◉' },
  completed: { label: 'อบรมแล้ว', color: STATUS.positive, bg: STATUS.positiveBg, icon: '●' },
  cancelled: { label: 'ยกเลิก', color: STATUS.critical, bg: STATUS.criticalBg, icon: '✕' },
  postponed: { label: 'เลื่อน', color: STATUS.warning, bg: STATUS.warningBg, icon: '◐' },
};

const getStatusGradient = (status: string): string => {
  const status2 = status || 'planned';
  if (status2 === 'completed') return `linear-gradient(135deg, ${STATUS.positive} 0%, ${STATUS.positive}dd 100%)`;
  if (status2 === 'cancelled') return `linear-gradient(135deg, ${STATUS.critical} 0%, ${STATUS.critical}dd 100%)`;
  if (status2 === 'postponed') return `linear-gradient(135deg, ${STATUS.warning} 0%, ${STATUS.warning}dd 100%)`;
  if (status2 === 'scheduled') return `linear-gradient(135deg, ${PALETTE.primary} 0%, ${PALETTE.primary}dd 100%)`;
  return `linear-gradient(135deg, ${PALETTE.muted} 0%, ${PALETTE.muted}dd 100%)`;
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
  is_active: boolean;
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
  dsd_not_submitting: boolean;
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
  const { getCompanyById } = useCompanies();
  const company = getCompanyById(companyId);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<string>('year');
  const [viewMode, setViewMode] = useState<'overview' | 'update'>('overview');
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const currentMonthIdx = new Date().getMonth();

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
  const [modalDsdNotSubmitting, setModalDsdNotSubmitting] = useState(false);

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

  // Bulk add: department/position filter + checkbox selection
  const [bulkFilterDept, setBulkFilterDept] = useState('');
  const [bulkFilterPos, setBulkFilterPos] = useState('');
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  // Manual employee entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEmp, setManualEmp] = useState({ emp_code: '', first_name: '', last_name: '', position: '', department: '' });
  const [manualSaving, setManualSaving] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [importSheet, setImportSheet] = useState('');
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [importing, setImporting] = useState(false);

  // Feature 1: DSD toggle per course
  const [showDsdToggleModal, setShowDsdToggleModal] = useState(false);
  const [dsdToggleCourseName, setDsdToggleCourseName] = useState("");
  const [dsdToggleValue, setDsdToggleValue] = useState(false);

  // Feature 2: File upload state
  const [photoFiles, setPhotoFiles] = useState<{ id: string; urls: string[] }>({ id: "", urls: [] });
  const [signinFiles, setSigninFiles] = useState<{ id: string; urls: string[] }>({ id: "", urls: [] });
  const [uploading, setUploading] = useState(false);

  // Feature 3: Attendee edit state
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);
  const [editingAttendee, setEditingAttendee] = useState<Record<string, string>>({});

  // Feature 4: Change log and HR notification
  const [unreviewedChanges, setUnreviewedChanges] = useState<Record<string, unknown>[]>([]);
  const [showChangeLog, setShowChangeLog] = useState(false);

  // Feature 5: Inline month selector for plans without a month
  const [editingMonthPlanId, setEditingMonthPlanId] = useState<string | null>(null);
  const [loadingChanges, setLoadingChanges] = useState(false);

  // Feature 7: Attendee sub-panel (separated from main modal)
  const [showAttendeePanel, setShowAttendeePanel] = useState(false);
  const [attendeeViewTab, setAttendeeViewTab] = useState<'all' | 'selected'>('all');
  const [attendeeSortKey, setAttendeeSortKey] = useState<'name' | 'dept' | 'position'>('name');
  const [attendeeSortAsc, setAttendeeSortAsc] = useState(true);

  // ═══ Cancellation Approval State ═══
  const [pendingCancelStatus, setPendingCancelStatus] = useState<'cancelled' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [pendingCancelRequests, setPendingCancelRequests] = useState<Record<string, string>>({});

  // Fetch pending cancellation requests for this company
  const fetchPendingCancelRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/cancellation-requests?companyId=${companyId}&status=pending&planType=training`);
      const data = await res.json();
      if (data.requests) {
        const map: Record<string, string> = {};
        data.requests.forEach((r: { activity_no: string; requested_status: string }) => {
          map[r.activity_no] = r.requested_status;
        });
        setPendingCancelRequests(map);
      }
    } catch { /* ignore */ }
  }, [companyId]);

  useEffect(() => { fetchPendingCancelRequests(); }, [fetchPendingCancelRequests]);

  const handleCancelRequest = async () => {
    if (!selectedPlan || !pendingCancelStatus || !cancelReason.trim()) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch('/api/cancellation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planType: 'training',
          activityNo: selectedPlan.id,
          month: String(getEffectiveMonth(selectedPlan)),
          requestedStatus: pendingCancelStatus,
          reason: cancelReason.trim(),
          requestedBy: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
        }),
      });
      if (res.ok) {
        setPendingCancelStatus(null);
        setCancelReason('');
        await fetchPendingCancelRequests();
        alert('ส่งคำขอยกเลิกเรียบร้อย — รอ Admin อนุมัติ');
      } else {
        const err = await res.json();
        alert(err.error || 'ส่งคำขอไม่สำเร็จ');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setCancelSubmitting(false);
  };

  // Feature 8: Collapsible task queue groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['done', 'muted']));
  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Feature 9: Quick status change from task queue (without opening modal)
  const [quickChangingPlanId, setQuickChangingPlanId] = useState<string | null>(null);
  const handleQuickStatusChange = async (plan: TrainingPlan, newStatus: string) => {
    setQuickChangingPlanId(plan.id);
    try {
      const session = plan.training_sessions?.[0];
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          company_id: companyId,
          status: newStatus,
          scheduled_date_start: session?.scheduled_date_start || null,
          scheduled_date_end: session?.scheduled_date_end || null,
          actual_cost: session?.actual_cost || 0,
          actual_participants: session?.actual_participants || 0,
          hours_per_course: plan.hours_per_course,
          total_man_hours: session?.total_man_hours || 0,
          note: session?.note || '',
          updated_by: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
          postponed_to_month: session?.postponed_to_month || undefined,
          original_planned_month: session?.original_planned_month || undefined,
          instructor_name: session?.instructor_name || null,
          training_location: session?.training_location || null,
          training_method: session?.training_method || null,
          dsd_submitted: session?.dsd_submitted || false,
          dsd_approved: session?.dsd_approved || false,
          dsd_not_submitting: session?.dsd_not_submitting || false,
          actual_hours: session?.actual_hours || 0,
          dsd_report_submitted: session?.dsd_report_submitted || false,
          photos_submitted: session?.photos_submitted || false,
          signin_sheet_submitted: session?.signin_sheet_submitted || false,
          dsd_approved_headcount: session?.dsd_approved_headcount || 0,
        }),
      });
      if (res.ok) await fetchPlans();
    } catch (e) { console.error(e); }
    setQuickChangingPlanId(null);
  };

  // Feature 6: Show/hide inactive plans
  const [showHiddenPlans, setShowHiddenPlans] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);

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
  useEffect(() => { if (auth.isAdmin) fetchUnreviewedChanges(); }, [companyId]);

  const fetchAttendees = async (sessionId: string) => {
    setLoadingAttendees(true);
    try {
      const res = await fetch(`/api/training/attendees?sessionId=${sessionId}`);
      const data = await res.json();
      if (Array.isArray(data)) setAttendees(data);
    } catch { setAttendees([]); }
    setLoadingAttendees(false);
  };

  const fetchCompanyEmployees = async (force = false) => {
    if (employeesLoaded && !force) return;
    try {
      const res = await fetch(`/api/training/employees?companyId=${companyId}`);
      const data = await res.json();
      if (Array.isArray(data)) setCompanyEmployees(data);
      setEmployeesLoaded(true);
    } catch { /* ignore */ }
  };

  // Load employees when add attendee panel opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (showAddAttendee && !employeesLoaded) fetchCompanyEmployees(); }, [showAddAttendee]);

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
    setModalDsdNotSubmitting(session?.dsd_not_submitting || false);
    // DSD post-training
    setModalActualHours(session?.actual_hours || 0);
    setModalDsdReportSubmitted(session?.dsd_report_submitted || false);
    setModalPhotosSubmitted(session?.photos_submitted || false);
    setModalSigninSubmitted(session?.signin_sheet_submitted || false);
    setModalDsdHeadcount(session?.dsd_approved_headcount || 0);
    setShowModal(true);
    setShowAttendeePanel(false);
    if (session?.id) fetchAttendees(session.id);
    else setAttendees([]);
    // Load employee list for attendee checklist
    fetchCompanyEmployees();
  };

  const handleSaveSession = async () => {
    if (!selectedPlan) return;
    if (modalStatus === 'postponed' && !modalPostponedMonth) {
      alert('กรุณาเลือกเดือนที่จะเลื่อนไป');
      return;
    }
    // Intercept: non-admin trying to cancel → show approval form
    if (modalStatus === 'cancelled' && !auth.isAdmin) {
      setPendingCancelStatus('cancelled');
      setCancelReason('');
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
          actual_participants: attendees.length,
          hours_per_course: selectedPlan.hours_per_course,
          total_man_hours: modalActualHours * attendees.length,
          note: modalNote,
          updated_by: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
          postponed_to_month: modalStatus === 'postponed'
            ? modalPostponedMonth
            : (selectedPlan.training_sessions?.[0]?.postponed_to_month || undefined),
          original_planned_month: modalStatus === 'postponed'
            ? (selectedPlan.training_sessions?.[0]?.original_planned_month || selectedPlan.planned_month)
            : (selectedPlan.training_sessions?.[0]?.original_planned_month || undefined),
          // DSD pre-training
          instructor_name: modalInstructor || null,
          training_location: modalLocation || null,
          training_method: modalMethod || null,
          dsd_submitted: modalDsdNotSubmitting ? false : modalDsdSubmitted,
          dsd_approved: modalDsdNotSubmitting ? false : modalDsdApproved,
          dsd_not_submitting: modalDsdNotSubmitting,
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

  // Bulk add selected employees
  const handleBulkAddAttendees = async () => {
    const session = selectedPlan?.training_sessions?.[0];
    if (!session || !selectedPlan || bulkSelected.size === 0) return;
    setBulkAdding(true);
    try {
      for (const key of Array.from(bulkSelected)) {
        const emp = companyEmployees.find(e => `${e.emp_code}_${e.first_name}_${e.last_name}` === key);
        if (!emp) continue;
        await fetch('/api/training/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            plan_id: selectedPlan.id,
            company_id: companyId,
            emp_code: emp.emp_code || '',
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            gender: emp.gender || '',
            position: emp.position || '',
            department: emp.department || '',
            registration_type: 'registered',
          }),
        });
      }
      await fetchAttendees(session.id);
      setBulkSelected(new Set());
      setEmployeesLoaded(false);
    } catch (e) { console.error(e); }
    setBulkAdding(false);
  };

  const handleDeleteAttendee = async (id: string) => {
    const session = selectedPlan?.training_sessions?.[0];
    try {
      await fetch(`/api/training/attendees?id=${id}&sessionId=${session?.id || ''}`, { method: 'DELETE' });
      if (session?.id) await fetchAttendees(session.id);
    } catch (e) { console.error(e); }
  };

  // Toggle attendee: check = add, uncheck = remove (instant)
  const [togglingEmp, setTogglingEmp] = useState<Set<string>>(new Set());

  // Helper: ensure a training_session exists for a plan, auto-create if needed
  const ensureSession = async (plan: TrainingPlan): Promise<string | null> => {
    const existing = plan.training_sessions?.[0];
    if (existing?.id) return existing.id;
    // Auto-create session with 'planned' status
    try {
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          company_id: companyId,
          status: modalStatus || 'planned',
          scheduled_date_start: null,
          scheduled_date_end: null,
          actual_cost: 0,
          actual_participants: 0,
          hours_per_course: plan.hours_per_course,
          total_man_hours: 0,
          note: '',
          updated_by: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh plans to get the new session
        await fetchPlans();
        return data?.session?.id || data?.id || null;
      }
    } catch (e) { console.error('Failed to create session:', e); }
    return null;
  };

  const handleToggleAttendee = async (emp: typeof companyEmployees[0], isCurrentlyAttendee: boolean, attendeeId?: string) => {
    if (!selectedPlan) return;
    const empKey = `${emp.emp_code}_${emp.first_name}_${emp.last_name}`;
    setTogglingEmp(prev => new Set(prev).add(empKey));
    try {
      // Get or create session
      let sessionId: string | null = selectedPlan.training_sessions?.[0]?.id || null;
      if (!sessionId) {
        sessionId = await ensureSession(selectedPlan);
        if (!sessionId) {
          alert('ไม่สามารถสร้าง session ได้ กรุณาบันทึกสถานะก่อน');
          setTogglingEmp(prev => { const n = new Set(prev); n.delete(empKey); return n; });
          return;
        }
      }

      if (isCurrentlyAttendee && attendeeId) {
        await fetch(`/api/training/attendees?id=${attendeeId}&sessionId=${sessionId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/training/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId, plan_id: selectedPlan.id, company_id: companyId,
            emp_code: emp.emp_code || '', first_name: emp.first_name || '', last_name: emp.last_name || '',
            gender: emp.gender || '', position: emp.position || '', department: emp.department || '',
            registration_type: 'registered',
          }),
        });
      }
      await fetchAttendees(sessionId);
    } catch (e) { console.error(e); }
    setTogglingEmp(prev => { const n = new Set(prev); n.delete(empKey); return n; });
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

  // Import employee master list from Excel
  const handleImportEmployeeList = async (file: File) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const data = await file.arrayBuffer();
      await wb.xlsx.load(data);
      const ws = wb.worksheets[0];
      if (!ws) { alert('ไม่พบ sheet ใน Excel'); return; }

      // Read headers from row 1
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value || '').trim(); });

      // Read data rows
      const rows: Record<string, unknown>[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const obj: Record<string, unknown> = {};
        row.eachCell((cell, colNumber) => {
          if (headers[colNumber]) obj[headers[colNumber]] = cell.value || '';
        });
        rows.push(obj);
      });

      if (rows.length === 0) { alert('ไม่พบข้อมูลใน Excel'); return; }

      // Map common Thai/English headers
      const headerMap: Record<string, string> = {
        'รหัสพนักงาน': 'emp_code', 'รหัส': 'emp_code', 'emp_code': 'emp_code', 'employee_code': 'emp_code', 'code': 'emp_code',
        'ชื่อ': 'first_name', 'first_name': 'first_name', 'firstname': 'first_name', 'name': 'first_name',
        'นามสกุล': 'last_name', 'last_name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name',
        'เพศ': 'gender', 'gender': 'gender',
        'ตำแหน่ง': 'position', 'position': 'position', 'title': 'position',
        'แผนก': 'department', 'department': 'department', 'dept': 'department',
        'หน่วยงาน': 'location', 'location': 'location', 'site': 'location',
        'ระดับ': 'employee_level', 'level': 'employee_level', 'employee_level': 'employee_level',
      };

      const employees = rows.map(row => {
        const mapped: Record<string, string> = {};
        for (const [key, val] of Object.entries(row)) {
          const normalKey = key.trim().toLowerCase();
          for (const [pattern, field] of Object.entries(headerMap)) {
            if (normalKey === pattern.toLowerCase() || normalKey.includes(pattern.toLowerCase())) {
              mapped[field] = String(val || '').trim();
              break;
            }
          }
        }
        return mapped;
      }).filter(e => e.first_name || e.emp_code);

      if (employees.length === 0) { alert('ไม่พบข้อมูลพนักงาน (ต้องมีคอลัมน์ ชื่อ หรือ รหัสพนักงาน)'); return; }

      const res = await fetch('/api/training/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, employees }),
      });
      const result = await res.json();

      if (result.success) {
        alert(`นำเข้ารายชื่อพนักงานสำเร็จ ${result.count} คน`);
        fetchCompanyEmployees(true);
      } else if (result.sql) {
        alert('กรุณาสร้างตาราง company_employees ก่อน — ดู Console สำหรับ SQL');
        console.log('SQL to create table:', result.sql);
      } else {
        alert(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel');
    }
  };

  // Manual single employee entry
  const handleManualAddEmployee = async () => {
    if (!manualEmp.first_name.trim()) { alert('กรุณากรอกชื่อพนักงาน'); return; }
    setManualSaving(true);
    try {
      const res = await fetch('/api/training/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, employees: [manualEmp] }),
      });
      const result = await res.json();
      if (result.success) {
        setManualEmp({ emp_code: '', first_name: '', last_name: '', position: '', department: '' });
        fetchCompanyEmployees(true);
      } else {
        alert(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setManualSaving(false);
    }
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

  // Feature 1: DSD toggle handler
  const handleDsdToggle = async () => {
    if (!selectedPlan || !dsdToggleCourseName) return;
    try {
      const res = await fetch('/api/training/dsd-toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_name: dsdToggleCourseName, dsd_eligible: dsdToggleValue }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`อัปเดตสถานะ DSD สำเร็จ (${data.updated_count} หลักสูตร)`);
        await fetchPlans();
        setShowDsdToggleModal(false);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    }
  };

  // Feature 2: File upload handler
  const handleFileUpload = async (file: File, fileType: 'photos' | 'signin') => {
    const session = selectedPlan?.training_sessions?.[0];
    if (!session || !selectedPlan) {
      alert('กรุณาบันทึกสถานะก่อน');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('sessionId', session.id);
      formData.append('fileType', fileType);

      const res = await fetch('/api/training/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        if (fileType === 'photos') {
          setPhotoFiles({ id: session.id, urls: [...(photoFiles.urls || []), data.url] });
        } else {
          setSigninFiles({ id: session.id, urls: [...(signinFiles.urls || []), data.url] });
        }
        alert('อัปโหลดไฟล์สำเร็จ');
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setUploading(false);
    }
  };

  // Feature 3: Attendee edit handlers
  const startEditAttendee = (attendee: Attendee) => {
    setEditingAttendeeId(attendee.id);
    setEditingAttendee({
      emp_code: attendee.emp_code,
      first_name: attendee.first_name,
      last_name: attendee.last_name,
      position: attendee.position,
      department: attendee.department,
    });
  };

  const handleSaveAttendee = async () => {
    if (!editingAttendeeId) return;
    try {
      const res = await fetch('/api/training/attendees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingAttendeeId, ...editingAttendee }),
      });
      const data = await res.json();
      if (data.id) {
        setAttendees(attendees.map(a => a.id === editingAttendeeId ? data : a));
        setEditingAttendeeId(null);
        alert('บันทึกข้อมูลสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    }
  };

  // Feature 5: Update planned month for a training plan
  const handleUpdatePlannedMonth = async (planId: string, month: number) => {
    try {
      const res = await fetch('/api/training/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, planned_month: month }),
      });
      if (res.ok) {
        await fetchPlans();
      } else {
        const err = await res.json();
        alert('บันทึกไม่สำเร็จ: ' + (err.error || 'Unknown error'));
      }
    } catch (e) { console.error(e); }
    setEditingMonthPlanId(null);
  };

  // Feature 6: Toggle plan active/hidden
  const handleTogglePlanActive = async (planId: string, currentActive: boolean) => {
    setTogglingPlanId(planId);
    try {
      const res = await fetch('/api/training/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, is_active: !currentActive }),
      });
      if (res.ok) await fetchPlans();
    } catch (e) { console.error(e); }
    setTogglingPlanId(null);
  };

  // Feature 4: Change log handlers
  const fetchUnreviewedChanges = async () => {
    setLoadingChanges(true);
    try {
      const res = await fetch(`/api/training/changelog?companyId=${companyId}&isAdmin=${auth.isAdmin}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setUnreviewedChanges(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChanges(false);
    }
  };

  const handleMarkChangesAsReviewed = async (changeIds: string[]) => {
    try {
      const res = await fetch('/api/training/changelog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeIds,
          hrReviewedBy: auth.isAdmin ? auth.adminName : (auth.companyAuth[companyId]?.displayName || ''),
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchUnreviewedChanges();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Monthly chart data helper: when postponed from month X → Y, the plan moves to month Y
  const getEffectiveMonth = (p: TrainingPlan) => {
    const s = p.training_sessions?.[0];
    if (s?.status === 'postponed' && s.postponed_to_month) return s.postponed_to_month;
    if (s?.postponed_to_month && s?.original_planned_month) return s.postponed_to_month;
    return p.planned_month;
  };

  // Filter plans by time range
  const hiddenCount = plans.filter(p => p.is_active === false).length;
  const activePlans = showHiddenPlans ? plans : plans.filter(p => p.is_active !== false);
  const timeFilteredPlans = activePlans.filter(p => {
    if (timeRange === 'year') return true;
    const effectiveM = getEffectiveMonth(p);
    if (timeRange === 'ytd') return effectiveM >= 1 && effectiveM <= currentMonthIdx + 1;
    const monthIdx = MONTH_KEYS.indexOf(timeRange);
    if (monthIdx >= 0) return effectiveM === monthIdx + 1;
    return true;
  });

  const totalCourses = timeFilteredPlans.length;
  const completedCourses = timeFilteredPlans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
  const cancelledCourses = timeFilteredPlans.filter(p => p.training_sessions?.[0]?.status === 'cancelled').length;
  const scheduledCourses = timeFilteredPlans.filter(p => p.training_sessions?.[0]?.status === 'scheduled').length;
  const pendingCourses = timeFilteredPlans.filter(p => !p.training_sessions?.[0] || p.training_sessions[0].status === 'planned').length;
  const totalBudget = timeFilteredPlans.reduce((s, p) => s + (p.budget || 0), 0);
  const totalActual = timeFilteredPlans.reduce((s, p) => s + (p.training_sessions?.[0]?.actual_cost || 0), 0);

  // KPI formula: denominator = total - cancelled
  const kpiDenominator = totalCourses - cancelledCourses;
  const overallPct = kpiDenominator > 0 ? Math.round((completedCourses / kpiDenominator) * 100) : 0;

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthPlans = plans.filter(p => getEffectiveMonth(p) === month);
    const total = monthPlans.length;
    const completed = monthPlans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
    const cancelled = monthPlans.filter(p => p.training_sessions?.[0]?.status === 'cancelled').length;
    const scheduled = monthPlans.filter(p => p.training_sessions?.[0]?.status === 'scheduled').length;
    const denominator = total - cancelled;
    const pctComplete = denominator > 0 ? Math.round((completed / denominator) * 100) : 0;
    return { month, label: MONTH_LABELS[i], planned: total, completed, cancelled, scheduled, denominator, pctComplete };
  });

  // Cumulative completion % (KPI-based: exclude cancelled from denominator)
  let cumDenominator = 0;
  let cumCompleted = 0;
  const monthlyChartData = monthlyData.map(d => {
    cumDenominator += d.denominator;
    cumCompleted += d.completed;
    const pct = cumDenominator > 0 ? Math.round((cumCompleted / cumDenominator) * 100) : 0;
    return { ...d, cumPct: pct };
  });

  // Quarterly KPI
  const QUARTERS = [
    { label: 'Q1', months: [1, 2, 3], color: '#007aff' },
    { label: 'Q2', months: [4, 5, 6], color: '#34c759' },
    { label: 'Q3', months: [7, 8, 9], color: '#ff9500' },
    { label: 'Q4', months: [10, 11, 12], color: '#5856d6' },
  ];
  const getKpiScore = (pct: number) => pct >= 100 ? 5 : pct >= 90 ? 4 : pct >= 80 ? 3 : pct >= 70 ? 2 : 1;
  const getScoreColor = (s: number) => s >= 5 ? '#34c759' : s >= 4 ? '#007aff' : s >= 3 ? '#5856d6' : s >= 2 ? '#ff9500' : '#ff3b30';
  const currentQuarterIdx = Math.floor(new Date().getMonth() / 3);
  const quarterlyKpi = QUARTERS.map((q, qi) => {
    const qMonths = monthlyData.filter(m => q.months.includes(m.month));
    const totalItems = qMonths.reduce((s, m) => s + m.planned, 0);
    const completedItems = qMonths.reduce((s, m) => s + m.completed, 0);
    const cancelledItems = qMonths.reduce((s, m) => s + m.cancelled, 0);
    const denom = totalItems - cancelledItems;
    const isFuture = qi > currentQuarterIdx;
    const pct = denom > 0 ? Math.round((completedItems / denom) * 1000) / 10 : (isFuture ? 0 : (totalItems === 0 ? 0 : 100));
    const score = isFuture ? 0 : getKpiScore(pct);
    return { ...q, totalItems, completedItems, cancelledItems, denominator: denom, pct, score, isFuture };
  });
  const activeQuarters = quarterlyKpi.filter(q => !q.isFuture && q.totalItems > 0);
  const yearlyAvgScore = activeQuarters.length > 0 ? Math.round((activeQuarters.reduce((s, q) => s + q.score, 0) / activeQuarters.length) * 10) / 10 : 0;
  const yearlyAvgPct = activeQuarters.length > 0 ? Math.round((activeQuarters.reduce((s, q) => s + q.pct, 0) / activeQuarters.length) * 10) / 10 : 0;
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

  const filteredPlans = timeFilteredPlans.filter(p => {
    if (statusFilter === 'all') return true;
    const status = p.training_sessions?.[0]?.status || 'planned';
    return status === statusFilter;
  });

  const getSession = (plan: TrainingPlan): TrainingSession | undefined => plan.training_sessions?.[0];

  // ═══ Task Queue Helpers ═══
  // Determine next action for each course → drives badge + CTA label
  const getNextAction = (plan: TrainingPlan): { label: string; urgency: 'critical' | 'warning' | 'info' | 'done' | 'muted'; ctaLabel: string; costBadge?: { label: string; color: string; bg: string } } => {
    const session = plan.training_sessions?.[0];
    const status = session?.status || 'planned';
    const effMonth = getEffectiveMonth(plan);
    const isHidden = plan.is_active === false;
    // Budget helper
    const budget = plan.budget || 0;
    const actual = session?.actual_cost || 0;
    const costOverBudget = budget > 0 && actual > budget;
    const costNearLimit = budget > 0 && actual > 0 && !costOverBudget && Math.round((actual / budget) * 100) >= 85;
    const costBadgeOverBudget = costOverBudget ? { label: 'เกินงบ', color: STATUS.critical, bg: STATUS.criticalBg } : undefined;
    const costBadgeNear = costNearLimit ? { label: `ใช้งบ ${Math.round((actual / budget) * 100)}%`, color: '#b45309', bg: '#fefce8' } : undefined;
    if (isHidden) return { label: 'นำออกจากแผน', urgency: 'muted', ctaLabel: 'ดูรายละเอียด' };
    if (status === 'cancelled') return { label: 'ยกเลิกแล้ว', urgency: 'muted', ctaLabel: 'ดูรายละเอียด' };
    if (status === 'completed') {
      // Check DSD post-training deadline (critical if overdue)
      if (plan.dsd_eligible !== false && !session?.dsd_report_submitted && session?.scheduled_date_end) {
        const dEnd = new Date(session.scheduled_date_end);
        const deadline60 = new Date(dEnd.getTime() + 60 * 24 * 60 * 60 * 1000);
        const jan15 = new Date(selectedYear + 1, 0, 15);
        const deadline = deadline60 < jan15 ? deadline60 : jan15;
        const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) return { label: 'เลยกำหนดส่ง รง.1!', urgency: 'critical', ctaLabel: 'ปิดเอกสาร', costBadge: costBadgeOverBudget || costBadgeNear };
        if (daysLeft <= 14) return { label: `ส่ง รง.1 อีก ${daysLeft} วัน`, urgency: 'warning', ctaLabel: 'ปิดเอกสาร', costBadge: costBadgeOverBudget || costBadgeNear };
        return { label: 'รอส่งเอกสาร รง.1', urgency: 'warning', ctaLabel: 'ปิดเอกสาร', costBadge: costBadgeOverBudget || costBadgeNear };
      }
      const attCount = session?.training_attendees?.[0]?.count || session?.actual_participants || 0;
      if (attCount === 0) return { label: 'รอบันทึกผู้เข้าอบรม', urgency: 'warning', ctaLabel: 'บันทึกผล', costBadge: costBadgeOverBudget || costBadgeNear };
      if (!session?.actual_cost && session?.actual_cost !== 0) return { label: 'รอบันทึกค่าใช้จ่าย', urgency: 'info', ctaLabel: 'บันทึกผล' };
      // Completed with cost = 0 — show noCostRecorded badge
      if (actual === 0 && budget > 0) return { label: 'เสร็จสมบูรณ์', urgency: 'done', ctaLabel: 'ดูรายละเอียด', costBadge: { label: 'ยังไม่บันทึกค่าใช้จ่าย', color: '#c2410c', bg: '#fff7ed' } };
      return { label: 'เสร็จสมบูรณ์', urgency: 'done', ctaLabel: 'ดูรายละเอียด', costBadge: costBadgeOverBudget || costBadgeNear };
    }
    if (status === 'postponed') return { label: 'เลื่อน — รอกำหนดใหม่', urgency: 'warning', ctaLabel: 'กำหนดวัน' };
    if (status === 'scheduled') {
      // Check DSD pre-training deadline
      if (plan.dsd_eligible !== false && session?.scheduled_date_start && !session?.dsd_submitted && !session?.dsd_not_submitting) {
        const isInHouse = plan.in_house_external?.toLowerCase().includes('in');
        const daysReq = isInHouse ? 60 : 15;
        const dStart = new Date(session.scheduled_date_start);
        const diffDays = Math.ceil((dStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= daysReq) return { label: 'เลยกำหนดยื่น DSD!', urgency: 'critical', ctaLabel: 'ยื่น DSD' };
        if (diffDays <= daysReq + 7) return { label: `ยื่น DSD ภายใน ${diffDays} วัน`, urgency: 'warning', ctaLabel: 'ยื่น DSD' };
      }
      return { label: 'รออบรม', urgency: 'info', ctaLabel: 'อัปเดตผล' };
    }
    // status === 'planned'
    if (!effMonth) return { label: 'ยังไม่กำหนดเดือน', urgency: 'warning', ctaLabel: 'กำหนดเดือน' };
    const plannedDate = new Date(selectedYear, effMonth - 1, 1);
    const daysUntil = Math.ceil((plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { label: 'เลยกำหนดแล้ว!', urgency: 'critical', ctaLabel: 'กำหนดวัน' };
    if (daysUntil <= 30) return { label: `อีก ${daysUntil} วันถึงกำหนด`, urgency: 'warning', ctaLabel: 'กำหนดวัน' };
    if (daysUntil <= 60) return { label: `กำหนด ${MONTH_LABELS[effMonth - 1]}`, urgency: 'info', ctaLabel: 'กำหนดวัน' };
    return { label: `กำหนด ${MONTH_LABELS[effMonth - 1]}`, urgency: 'info', ctaLabel: 'กำหนดวัน' };
  };

  // Task queue group definitions — ordered by priority
  const TASK_GROUPS: { key: string; title: string; icon: string; filter: (p: TrainingPlan) => boolean }[] = [
    { key: 'critical', title: 'ต้องดำเนินการด่วน', icon: '🔴', filter: p => getNextAction(p).urgency === 'critical' },
    { key: 'warning', title: 'รอดำเนินการ', icon: '🟡', filter: p => getNextAction(p).urgency === 'warning' },
    { key: 'info', title: 'กำลังดำเนินการ', icon: '🔵', filter: p => getNextAction(p).urgency === 'info' },
    { key: 'done', title: 'เสร็จสมบูรณ์', icon: '🟢', filter: p => getNextAction(p).urgency === 'done' },
    { key: 'muted', title: 'ยกเลิก / นำออก', icon: '⚪', filter: p => getNextAction(p).urgency === 'muted' },
  ];

  const URGENCY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    critical: { bg: STATUS.criticalBg, color: STATUS.critical, border: `${STATUS.critical}40` },
    warning: { bg: STATUS.warningBg, color: STATUS.warning, border: `${STATUS.warning}40` },
    info: { bg: `${PALETTE.primary}10`, color: PALETTE.primary, border: `${PALETTE.primary}40` },
    done: { bg: STATUS.positiveBg, color: STATUS.positive, border: `${STATUS.positive}40` },
    muted: { bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
  };

  // Login gate — require login to view training page
  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ borderRadius: 16, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>เข้าสู่ระบบ</h2>
            <p style={{ fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
              กรอกข้อมูลของ <strong>{company?.name || companyId.toUpperCase()}</strong> เพื่อดูแผนอบรม
            </p>
            <input type="text" placeholder="Username" value={loginUser} onChange={e => setLoginUser(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
            <input type="password" placeholder="รหัสผ่าน" value={loginPass} onChange={e => setLoginPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
            {loginError && <p style={{ fontSize: 12, marginBottom: 8, color: 'var(--danger)' }}>{loginError}</p>}
            <button onClick={handleLogin} disabled={loggingIn} className="btn-primary"
              style={{ width: '100%', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loggingIn ? 0.6 : 1 }}>
              {loggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }} id="pdf-content">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              📋 แผนอบรมประจำปี — {company?.name || companyId.toUpperCase()}
            </h1>
            {auth.isAdmin && unreviewedChanges.length > 0 && (
              <button
                onClick={() => { fetchUnreviewedChanges(); setShowChangeLog(!showChangeLog); }}
                style={{
                  position: "relative", padding: "6px 12px", borderRadius: 6, border: "none",
                  background: STATUS.critical, color: "#fff", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Bell size={14} /> แจ้งเตือน ({unreviewedChanges.length})
                <span style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20,
                  background: STATUS.critical, borderRadius: "50%", border: "2px solid var(--card-solid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {unreviewedChanges.length}
                </span>
              </button>
            )}
            {/* Spacer to push right items */}
            <div style={{ flex: 1 }} />
            {/* View mode toggle */}
            <div style={{ display: 'flex', padding: 2, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {[
                { key: 'overview' as const, label: '📊 ภาพรวม' },
                { key: 'update' as const, label: '📝 อัปเดต' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setViewMode(opt.key); setActiveKpi(null); }}
                  style={{
                    padding: '4px 14px', borderRadius: 5, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: viewMode === opt.key ? 'var(--accent)' : 'transparent',
                    color: viewMode === opt.key ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Export PDF — icon only */}
            <ExportPdfButton
              targetId="pdf-content"
              filename={`${company?.shortName || companyId}-Training-${selectedYear}`}
              title={`${company?.name || companyId.toUpperCase()} — Training Plan ${selectedYear}`}
              subtitle="Safety & Environment Dashboard — รายงานแผนอบรมประจำปี"
              orientation="landscape"
              compact
            />
          </div>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0", fontSize: 14 }}>
            Training Plan {selectedYear} • จัดการแผนอบรม อัปเดตสถานะ และบันทึกผู้เข้าอบรม
          </p>
        </div>

        {/* ═══ Unified Control Bar ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
          {/* Year */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}
          >
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Time range */}
          <Calendar size={13} style={{ color: 'var(--text-secondary)' }} />
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {[
              { key: 'year', label: 'ทั้งปี' },
              { key: 'ytd', label: `YTD (${MONTH_LABELS[currentMonthIdx]})` },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
            <option value="" disabled>เดือน...</option>
            {MONTH_LABELS.map((name, i) => (
              <option key={MONTH_KEYS[i]} value={MONTH_KEYS[i]}>{name}</option>
            ))}
          </select>
          {timeRange !== 'year' && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,149,0,0.1)', color: '#ff9500' }}>
              {timeRange === 'ytd' ? `ม.ค. – ${MONTH_LABELS[currentMonthIdx]}` : MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]}
            </span>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Update mode specific controls */}
          {viewMode === 'update' && (
            <>
              {auth.isAdmin && (
                <button onClick={() => setShowImportModal(true)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Upload size={13} /> นำเข้า Excel
                </button>
              )}
              {hiddenCount > 0 && (
                <button onClick={() => setShowHiddenPlans(!showHiddenPlans)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${showHiddenPlans ? '#f59e0b' : 'var(--border)'}`, background: showHiddenPlans ? '#fef3c7' : 'var(--bg-secondary)', color: showHiddenPlans ? '#92400e' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {showHiddenPlans ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showHiddenPlans ? `ซ่อน (${hiddenCount})` : `ซ่อนอยู่ (${hiddenCount})`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ===== OVERVIEW MODE ===== */}
        {viewMode === 'overview' && (
          <>
        {/* Warning alerts */}
        {warningPlans.length > 0 && (
          <div style={{ background: STATUS.warningBg, border: `1px solid ${STATUS.warning}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: STATUS.warning, fontSize: 14, marginBottom: 4 }}>
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

        {/* KPI Cards — clickable to filter */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <StatCard icon="📚" label="หลักสูตรทั้งหมด" value={totalCourses}
            subtitle={`ฐาน KPI: ${kpiDenominator}${cancelledCourses > 0 ? ` (ยกเลิก ${cancelledCourses})` : ''}`}
            active={activeKpi === 'all'} onClick={() => setActiveKpi(activeKpi === 'all' ? null : 'all')} />
          <StatCard icon="✅" label="อบรมแล้ว" value={completedCourses} color="var(--success)"
            subtitle={kpiDenominator > 0 ? `KPI: ${overallPct}% (${completedCourses}/${kpiDenominator})` : undefined}
            active={activeKpi === 'completed'} onClick={() => setActiveKpi(activeKpi === 'completed' ? null : 'completed')} />
          <StatCard icon="📅" label="กำหนดวันแล้ว" value={scheduledCourses} color="var(--info)"
            active={activeKpi === 'scheduled'} onClick={() => setActiveKpi(activeKpi === 'scheduled' ? null : 'scheduled')} />
          <StatCard icon="⏳" label="รอดำเนินการ" value={pendingCourses} color="var(--warning)"
            subtitle={pendingCourses > 0 ? 'คลิกดูรายชื่อ' : undefined}
            active={activeKpi === 'planned'} onClick={() => setActiveKpi(activeKpi === 'planned' ? null : 'planned')} />
          <StatCard icon="💰" label="งบประมาณ" value={`${(totalBudget / 1000).toFixed(0)}K`}
            subtitle={`ใช้ไป ${totalBudget > 0 ? Math.round((totalActual/totalBudget)*100) : 0}%`} />
          <StatCard icon="💳" label="ค่าใช้จ่ายจริง" value={`${(totalActual / 1000).toFixed(0)}K`}
            color={totalActual > totalBudget ? 'var(--danger)' : 'var(--success)'}
            subtitle={totalActual > totalBudget ? '⚠ เกินงบ' : `เหลือ ${((totalBudget - totalActual) / 1000).toFixed(0)}K`} />
        </div>

        {/* KPI drill-down list — shows when a KPI card is clicked */}
        {activeKpi && (() => {
          const kpiPlans = timeFilteredPlans.filter(p => {
            if (activeKpi === 'all') return true;
            const status = p.training_sessions?.[0]?.status || 'planned';
            return status === activeKpi;
          });
          const kpiLabel = activeKpi === 'all' ? 'ทั้งหมด' : activeKpi === 'completed' ? 'อบรมแล้ว' : activeKpi === 'scheduled' ? 'กำหนดวันแล้ว' : 'รอดำเนินการ';
          return (
            <div style={{ background: 'var(--card-solid)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  📋 {kpiLabel} ({kpiPlans.length} หลักสูตร)
                </div>
                <button onClick={() => setActiveKpi(null)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                  ✕ ปิด
                </button>
              </div>
              {kpiPlans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>ไม่มีรายการ</div>
              ) : (
                <div style={{ maxHeight: 250, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>#</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>ชื่อหลักสูตร</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>เดือน</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>สถานะ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>วันอบรม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiPlans.map((plan, i) => {
                        const session = plan.training_sessions?.[0];
                        const status = session?.status || 'planned';
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
                        const effMonth = session?.postponed_to_month || plan.planned_month;
                        return (
                          <tr key={plan.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => { openPlanModal(plan); }}>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                            <td style={{ padding: '6px 10px', fontWeight: 500 }}>{plan.course_name}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{effMonth ? MONTH_LABELS[effMonth - 1] : '-'}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11 }}>{session?.scheduled_date_start ? formatDate(session.scheduled_date_start) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ "ต้องทำวันนี้" Action Items Section ═══ */}
        {(() => {
          // 1. Courses needing date assignment (planned month is this or next month, no date)
          const needDates = plans.filter(p => {
            const s = p.training_sessions?.[0];
            if (s?.status === 'completed' || s?.status === 'cancelled') return false;
            const effMonth = getEffectiveMonth(p);
            if (!effMonth) return true; // no month at all
            return !s?.scheduled_date_start && effMonth >= currentMonthIdx + 1 && effMonth <= currentMonthIdx + 3;
          });
          // 2. Upcoming training (within next 30 days)
          const upcoming = plans.filter(p => {
            const s = p.training_sessions?.[0];
            if (!s?.scheduled_date_start || s.status === 'completed' || s.status === 'cancelled') return false;
            const diff = (new Date(s.scheduled_date_start).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 30;
          }).sort((a, b) => new Date(a.training_sessions[0].scheduled_date_start!).getTime() - new Date(b.training_sessions[0].scheduled_date_start!).getTime());
          // 3. Pending DSD documents (completed but missing docs)
          const pendingDocs = plans.filter(p => {
            const s = p.training_sessions?.[0];
            if (s?.status !== 'completed' || p.dsd_eligible === false) return false;
            return !s?.photos_submitted || !s?.signin_sheet_submitted || !s?.dsd_report_submitted;
          });

          const hasActions = needDates.length > 0 || upcoming.length > 0 || pendingDocs.length > 0;
          if (!hasActions) return null;

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
              {/* Need dates */}
              {needDates.length > 0 && (
                <div style={{ background: STATUS.warningBg, borderRadius: 10, border: `1px solid ${STATUS.warning}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> ยังไม่กำหนดวัน ({needDates.length})
                  </div>
                  {needDates.slice(0, 5).map(p => (
                    <div key={p.id} onClick={() => openPlanModal(p)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: '#fef3c7', color: '#78350f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.course_name}</span>
                      <span style={{ fontSize: 10, color: '#92400e', flexShrink: 0, marginLeft: 8 }}>
                        {p.planned_month ? MONTH_LABELS[p.planned_month - 1] : 'ไม่มีเดือน'}
                      </span>
                    </div>
                  ))}
                  {needDates.length > 5 && <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>...อีก {needDates.length - 5} หลักสูตร</div>}
                </div>
              )}

              {/* Upcoming training */}
              {upcoming.length > 0 && (
                <div style={{ background: `${PALETTE.primary}10`, borderRadius: 10, border: `1px solid ${PALETTE.primary}40`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> อบรมเร็วๆ นี้ ({upcoming.length})
                  </div>
                  {upcoming.slice(0, 5).map(p => {
                    const s = p.training_sessions[0];
                    const daysLeft = Math.ceil((new Date(s.scheduled_date_start!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={p.id} onClick={() => openPlanModal(p)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: '#dbeafe', color: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.course_name}</span>
                        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 8, fontWeight: 700, color: daysLeft <= 7 ? STATUS.critical : PALETTE.primary }}>
                          {daysLeft === 0 ? 'วันนี้!' : `อีก ${daysLeft} วัน`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending DSD docs */}
              {pendingDocs.length > 0 && (
                <div style={{ background: STATUS.criticalBg, borderRadius: 10, border: `1px solid ${STATUS.critical}40`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: STATUS.critical, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> เอกสารค้างส่ง ({pendingDocs.length})
                  </div>
                  {pendingDocs.slice(0, 5).map(p => {
                    const s = p.training_sessions[0];
                    const missing: string[] = [];
                    if (!s?.photos_submitted) missing.push('ภาพถ่าย');
                    if (!s?.signin_sheet_submitted) missing.push('ใบเซ็นชื่อ');
                    if (!s?.dsd_report_submitted) missing.push('รง.1');
                    return (
                      <div key={p.id} onClick={() => openPlanModal(p)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: STATUS.criticalBg, color: STATUS.critical, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.course_name}</span>
                        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 8, color: STATUS.critical }}>ขาด: {missing.join(', ')}</span>
                      </div>
                    );
                  })}
                  {pendingDocs.length > 5 && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>...อีก {pendingDocs.length - 5} หลักสูตร</div>}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ Quarterly KPI Section ═══ */}
        {plans.length > 0 && (
          <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  🎯 KPI รายไตรมาส — แผนอบรม
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  สูตร: อบรมแล้ว ÷ (ทั้งหมด − ยกเลิก) × 100
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: getScoreColor(Math.round(yearlyAvgScore)) }}>
                  {yearlyAvgScore > 0 ? yearlyAvgScore.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>คะแนนเฉลี่ยปี ({yearlyAvgPct}%)</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {quarterlyKpi.map(q => (
                <div key={q.label} style={{
                  padding: 16, borderRadius: 12, textAlign: 'center',
                  background: q.isFuture ? 'var(--bg-secondary)' : `${q.color}08`,
                  border: `1px solid ${q.isFuture ? 'var(--border)' : q.color + '25'}`,
                  opacity: q.isFuture ? 0.5 : 1,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: q.color, marginBottom: 6 }}>{q.label}</div>
                  {q.isFuture ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่ถึง</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 32, fontWeight: 800, color: getScoreColor(q.score), lineHeight: 1.1 }}>
                        {q.score}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: q.color, marginTop: 4 }}>
                        {q.pct}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {q.completedItems}/{q.denominator}
                        {q.cancelledItems > 0 && <span style={{ color: '#ff3b30' }}> (ยกเลิก {q.cancelledItems})</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* Score legend */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              {[
                { s: 5, label: '100%', color: '#34c759' },
                { s: 4, label: '≥90%', color: '#007aff' },
                { s: 3, label: '≥80%', color: '#5856d6' },
                { s: 2, label: '≥70%', color: '#ff9500' },
                { s: 1, label: '<70%', color: '#ff3b30' },
              ].map(item => (
                <span key={item.s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: item.color + '18', color: item.color, fontSize: 10, fontWeight: 800 }}>{item.s}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Chart */}
        {plans.length > 0 && (
          <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  สถานะการอบรมรายเดือน
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  ฐาน KPI (หักยกเลิก) vs อบรมจริง ประจำปี {selectedYear}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: overallPct === 0 ? 'var(--muted)' : overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : '#fb923c' }}>
                  {overallPct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>KPI ({completedCourses}/{kpiDenominator})</div>
              </div>
            </div>

            {/* Bar Chart with Y-axis */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Y-axis labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 40, height: 160, paddingRight: 4 }}>
                <div style={{ fontSize: 10, color: PALETTE.textSecondary, textAlign: 'right', fontWeight: 400 }}>{maxPlanned}</div>
                <div style={{ fontSize: 10, color: PALETTE.textSecondary, textAlign: 'right', fontWeight: 400, flex: 1 }}>{Math.round(maxPlanned / 2)}</div>
                <div style={{ fontSize: 10, color: PALETTE.textSecondary, textAlign: 'right', fontWeight: 400 }}>0</div>
              </div>

              {/* Chart container with gridlines */}
              <div style={{ flex: 1, position: 'relative', height: 160 }}>
                {/* Horizontal gridlines */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: PALETTE.grid }} />
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: PALETTE.grid, transform: 'translateY(-0.5px)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: PALETTE.grid }} />
                </div>

                {/* Bar Chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
              {monthlyChartData.map((d, i) => {
                const currentMonth = new Date().getMonth() + 1;
                const isPast = d.month <= currentMonth;
                const isCurrent = d.month === currentMonth;
                const barHeight = maxPlanned > 0 ? (d.planned / maxPlanned) * 130 : 0;
                const completedHeight = d.planned > 0 ? (d.completed / d.planned) * barHeight : 0;
                const scheduledHeight = d.planned > 0 ? (d.scheduled / d.planned) * barHeight : 0;
                // Determine bar background: past with no completion = amber warning, not red
                const barBg = isPast && d.planned > 0 && d.completed === 0 && d.scheduled === 0
                  ? '#fef3c7'  // amber/warning instead of red
                  : isPast && d.planned > 0
                    ? '#fee2e2'
                    : 'var(--bg-secondary)';
                return (
                  <div key={i} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: isCurrent ? '4px 0' : 0,
                    background: isCurrent ? 'rgba(0,122,255,0.06)' : 'transparent',
                    borderRadius: isCurrent ? 6 : 0,
                    border: isCurrent ? '1px dashed var(--accent)' : 'none',
                  }}>
                    {/* Count label: done/denominator (KPI base) */}
                    {d.planned > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: d.completed === d.denominator && d.denominator > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {d.completed}/{d.denominator}
                        {d.cancelled > 0 && <span style={{ color: STATUS.critical, fontSize: 8 }}> ✕{d.cancelled}</span>}
                      </div>
                    )}
                    {/* Stacked bar */}
                    <div style={{ width: '80%', height: barHeight || 2, borderRadius: 4, position: 'relative', overflow: 'hidden', background: barBg }}>
                      {/* Scheduled (blue) */}
                      {scheduledHeight > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: scheduledHeight, background: `${PALETTE.primary}60`, borderRadius: '0 0 4px 4px' }} />
                      )}
                      {/* Completed (green) */}
                      {completedHeight > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: completedHeight, background: STATUS.positive, borderRadius: '0 0 4px 4px' }} />
                      )}
                    </div>
                    {/* Month label */}
                    <div style={{ fontSize: 10, color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isCurrent ? 800 : 400 }}>
                      {isCurrent ? `▶ ${d.label}` : d.label}
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS.positive, display: 'inline-block' }} /> อบรมแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: `${PALETTE.primary}60`, display: 'inline-block' }} /> กำหนดวันแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS.warningBg, display: 'inline-block' }} /> ยังไม่มีความคืบหน้า
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS.criticalBg, display: 'inline-block' }} /> เลยกำหนด
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
                  // 0% = neutral gray, not red; only use red for below 50% with actual plans
                  const color = d.cumPct === 0 && d.planned === 0 ? 'var(--bg-secondary)'
                    : d.cumPct === 0 ? '#d1d5db'  // neutral gray for 0%
                    : d.cumPct >= 80 ? '#4ade80' : d.cumPct >= 50 ? '#fbbf24' : '#fb923c';
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {d.cumPct > 0 && <div style={{ fontSize: 9, fontWeight: 600, color, marginBottom: 2 }}>{d.cumPct}%</div>}
                      {d.cumPct === 0 && d.planned > 0 && <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 2 }}>0%</div>}
                      <div style={{ width: '80%', height: Math.max(h, 2), borderRadius: 2, background: color }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Lower Section: Category Breakdown + DSD Summary ═══ */}
        {plans.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* Category Breakdown */}
            <div style={{ background: 'var(--card-solid)', borderRadius: 10, border: '1px solid var(--border)', padding: '16px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>📂 สรุปตามหมวดหมู่</h3>
              {(() => {
                const cats: Record<string, { total: number; completed: number }> = {};
                timeFilteredPlans.forEach(p => {
                  const cat = p.category || 'ไม่ระบุ';
                  if (!cats[cat]) cats[cat] = { total: 0, completed: 0 };
                  cats[cat].total++;
                  if (p.training_sessions?.[0]?.status === 'completed') cats[cat].completed++;
                });
                const sorted = Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
                return sorted.map(([cat, v]) => {
                  const pct = v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0;
                  return (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cat}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{v.completed}/{v.total} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : pct === 0 ? '#d1d5db' : '#fb923c', width: `${pct}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* DSD Document Status */}
            <div style={{ background: 'var(--card-solid)', borderRadius: 10, border: '1px solid var(--border)', padding: '16px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>📋 สถานะเอกสาร DSD</h3>
              {(() => {
                const dsdPlans = timeFilteredPlans.filter(p => p.dsd_eligible !== false);
                const preSubmitted = dsdPlans.filter(p => p.training_sessions?.[0]?.dsd_submitted).length;
                const preApproved = dsdPlans.filter(p => p.training_sessions?.[0]?.dsd_approved).length;
                const postSubmitted = dsdPlans.filter(p => p.training_sessions?.[0]?.dsd_report_submitted).length;
                const completedDsd = dsdPlans.filter(p => p.training_sessions?.[0]?.status === 'completed').length;
                const items = [
                  { label: 'หลักสูตร DSD ทั้งหมด', value: dsdPlans.length, color: 'var(--text-primary)' },
                  { label: 'ยื่นแบบแจ้งแล้ว (ยป.1/ยป.3)', value: preSubmitted, color: PALETTE.primary },
                  { label: 'ได้รับอนุมัติแล้ว', value: preApproved, color: STATUS.positive },
                  { label: 'อบรมเสร็จแล้ว', value: completedDsd, color: STATUS.warning },
                  { label: 'ส่ง รง.1 แล้ว', value: postSubmitted, color: STATUS.positive },
                ];
                return items.map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
          </>
        )}

        {/* ===== UPDATE MODE — Task Queue ===== */}
        {viewMode === 'update' && (
          <>
        {/* Filter Summary Bar */}
        {(() => {
          const activeFilters: string[] = [];
          if (statusFilter !== 'all') activeFilters.push(STATUS_CONFIG[statusFilter]?.label || statusFilter);
          if (timeRange !== 'year') activeFilters.push(timeRange === 'ytd' ? `YTD (${MONTH_LABELS[currentMonthIdx]})` : MONTH_LABELS[MONTH_KEYS.indexOf(timeRange)]);
          const hasFilter = activeFilters.length > 0;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, marginBottom: 14,
              background: hasFilter ? 'rgba(59,130,246,0.06)' : 'var(--card-solid)',
              border: `1px solid ${hasFilter ? 'rgba(59,130,246,0.2)' : 'var(--border)'}`,
            }}>
              <Filter size={14} style={{ color: hasFilter ? PALETTE.primary : 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                กำลังแสดง <strong style={{ color: 'var(--accent)' }}>{filteredPlans.length}</strong> หลักสูตร
                {filteredPlans.length !== timeFilteredPlans.length && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> จาก {timeFilteredPlans.length}</span>}
              </span>
              {hasFilter && (
                <>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>•</span>
                  {activeFilters.map((f, fi) => (
                    <span key={fi} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>{f}</span>
                  ))}
                  <button
                    onClick={() => { setStatusFilter('all'); setTimeRange('year'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}
                  >
                    <RotateCcw size={10} /> ล้างตัวกรอง
                  </button>
                </>
              )}
              {!hasFilter && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• ปี {selectedYear} • ทั้งหมด</span>
              )}
            </div>
          );
        })()}

        {/* Progress Summary + Status Chips */}
        {!loading && filteredPlans.length > 0 && (() => {
          const doneCount = filteredPlans.filter(p => getNextAction(p).urgency === 'done').length;
          const actionCount = filteredPlans.filter(p => ['critical', 'warning'].includes(getNextAction(p).urgency)).length;
          const pct = filteredPlans.length > 0 ? Math.round((doneCount / filteredPlans.length) * 100) : 0;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              {/* Progress bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ความคืบหน้า: {doneCount}/{filteredPlans.length} เสร็จสมบูรณ์
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 80 ? STATUS.positive : pct >= 50 ? STATUS.warning : 'var(--text-secondary)' }}>{pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: pct >= 80 ? STATUS.positive : pct >= 50 ? STATUS.warning : 'var(--accent)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              {actionCount > 0 && (
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: STATUS.criticalBg, color: STATUS.critical, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ต้องดำเนินการ {actionCount} รายการ
                </span>
              )}
            </div>
          );
        })()}

        {/* Status Quick-Filter Chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'ทั้งหมด', count: timeFilteredPlans.length },
            ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
              key,
              label: `${cfg.icon} ${cfg.label}`,
              count: timeFilteredPlans.filter(p => {
                const s = p.training_sessions?.[0]?.status || 'planned';
                return s === key;
              }).length,
            })),
          ].filter(c => c.count > 0).map(chip => (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(chip.key)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: statusFilter === chip.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: statusFilter === chip.key ? 'rgba(59,130,246,0.08)' : 'var(--card-solid)',
                color: statusFilter === chip.key ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {chip.label} <span style={{ opacity: 0.7 }}>({chip.count})</span>
            </button>
          ))}
        </div>

        {/* Task Queue Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div>ยังไม่มีแผนอบรม</div>
            {auth.isAdmin && <div style={{ fontSize: 13, marginTop: 8 }}>กดปุ่ม &quot;นำเข้าแผนอบรม&quot; เพื่อ import จาก Excel</div>}
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>ไม่มีหลักสูตรตรงกับตัวกรอง</div>
            <button onClick={() => { setStatusFilter('all'); setTimeRange('year'); }}
              style={{ marginTop: 8, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TASK_GROUPS.map(group => {
              const groupPlans = filteredPlans.filter(group.filter);
              if (groupPlans.length === 0) return null;
              const isCollapsed = collapsedGroups.has(group.key);
              const groupBudget = groupPlans.reduce((s, p) => s + (p.budget || 0), 0);
              const groupActual = groupPlans.reduce((s, p) => s + (p.training_sessions?.[0]?.actual_cost || 0), 0);
              const groupVariance = groupBudget - groupActual;
              const groupOverBudget = groupActual > 0 && groupBudget > 0 && groupActual > groupBudget;
              return (
                <div key={group.key}>
                  {/* Group Header — clickable to collapse */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isCollapsed ? 0 : 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' }}
                    onClick={() => toggleGroupCollapse(group.key)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', color: 'var(--text-secondary)', display: 'flex' }}>
                      <ChevronRight size={14} />
                    </span>
                    <span style={{ fontSize: 14 }}>{group.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{group.title}</span>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: URGENCY_COLORS[group.key].bg, color: URGENCY_COLORS[group.key].color, fontWeight: 600 }}>
                      {groupPlans.length}
                    </span>
                    {groupBudget > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 10 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          งบ {groupBudget.toLocaleString()} ฿
                        </span>
                        {groupActual > 0 && (
                          <>
                            <span style={{ color: 'var(--border)' }}>→</span>
                            <span style={{ fontWeight: 600, color: groupOverBudget ? STATUS.critical : STATUS.positive }}>
                              ใช้จริง {groupActual.toLocaleString()} ฿
                            </span>
                            <span style={{ fontWeight: 600, color: groupOverBudget ? STATUS.critical : STATUS.positive }}>
                              ({groupOverBudget ? '+' : 'เหลือ '}{groupOverBudget ? (groupActual - groupBudget).toLocaleString() : groupVariance.toLocaleString()})
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Course Cards — collapsible */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {groupPlans.map(plan => {
                        const session = getSession(plan);
                        const status = session?.status || 'planned';
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
                        const action = getNextAction(plan);
                        const urgColors = URGENCY_COLORS[action.urgency];
                        const effMonth = getEffectiveMonth(plan);
                        const attCount = session?.training_attendees?.[0]?.count || session?.actual_participants || 0;
                        const isInHouse = plan.in_house_external?.toLowerCase().includes('in');
                        const isQuickChanging = quickChangingPlanId === plan.id;
                        return (
                          <div
                            key={plan.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                              borderRadius: 10, border: `1px solid ${urgColors.border}`,
                              background: 'var(--card-solid)', cursor: 'pointer',
                              transition: 'all 0.15s', opacity: isQuickChanging ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { if (!isQuickChanging) { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; } }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-solid)'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={() => !isQuickChanging && (isLoggedIn ? openPlanModal(plan) : setShowLoginDialog(true))}
                          >
                            {/* Left: Status dot */}
                            <div style={{
                              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                              background: cfg.color, boxShadow: `0 0 0 3px ${cfg.bg}`,
                            }} />

                            {/* Middle: Course info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{plan.course_name}</span>
                                {plan.dsd_eligible !== false && (
                                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, flexShrink: 0 }}>DSD</span>
                                )}
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: isInHouse ? '#dbeafe' : '#f3e8ff', color: isInHouse ? '#1d4ed8' : '#7c3aed', fontWeight: 600, flexShrink: 0 }}>
                                  {isInHouse ? 'In-House' : 'External'}
                                </span>
                              </div>
                              {/* Info chips row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)' }}>
                                <span>{cfg.icon} {cfg.label}</span>
                                <span style={{ color: 'var(--border)' }}>•</span>
                                <span>{effMonth ? `${MONTH_LABELS[effMonth - 1]} ${selectedYear}` : 'ยังไม่กำหนดเดือน'}</span>
                                {session?.scheduled_date_start && (
                                  <>
                                    <span style={{ color: 'var(--border)' }}>•</span>
                                    <span>📅 {formatDate(session.scheduled_date_start)}</span>
                                  </>
                                )}
                                <span style={{ color: 'var(--border)' }}>•</span>
                                <span>{plan.hours_per_course || '?'} ชม.</span>
                                {attCount > 0 && (
                                  <>
                                    <span style={{ color: 'var(--border)' }}>•</span>
                                    <span>👥 {attCount} คน</span>
                                  </>
                                )}
                                {!attCount && plan.planned_participants > 0 && (
                                  <>
                                    <span style={{ color: 'var(--border)' }}>•</span>
                                    <span style={{ opacity: 0.6 }}>แผน {plan.planned_participants} คน</span>
                                  </>
                                )}
                                {session?.original_planned_month && session?.postponed_to_month && (
                                  <>
                                    <span style={{ color: 'var(--border)' }}>•</span>
                                    <span style={{ color: '#b45309' }}>เลื่อนจาก {MONTH_LABELS[session.original_planned_month - 1]} → {MONTH_LABELS[session.postponed_to_month - 1]}</span>
                                  </>
                                )}
                              </div>
                              {/* Budget vs Actual Cost */}
                              {(() => {
                                const budget = plan.budget || 0;
                                const actual = session?.actual_cost || 0;
                                const isCompleted = status === 'completed';
                                const hasActual = isCompleted && actual > 0;
                                const overBudget = hasActual && budget > 0 && actual > budget;
                                const pctUsed = budget > 0 ? Math.round((actual / budget) * 100) : 0;
                                const nearLimit = hasActual && budget > 0 && pctUsed >= 85 && !overBudget;
                                const noCostRecorded = isCompleted && actual === 0;
                                if (budget <= 0 && !noCostRecorded) return null;
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11 }}>
                                    <DollarSign size={11} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                    {budget > 0 && (
                                      <span style={{ color: 'var(--text-secondary)' }}>
                                        งบ {budget.toLocaleString()}
                                      </span>
                                    )}
                                    {hasActual && budget > 0 && (
                                      <>
                                        <span style={{ color: 'var(--border)' }}>→</span>
                                        <span style={{ fontWeight: 600, color: overBudget ? STATUS.critical : nearLimit ? STATUS.warning : STATUS.positive }}>
                                          จ่ายจริง {actual.toLocaleString()}
                                        </span>
                                        <span style={{ color: overBudget ? STATUS.critical : STATUS.positive, fontWeight: 600 }}>
                                          ({overBudget ? '+' : '-'}{Math.abs(actual - budget).toLocaleString()})
                                        </span>
                                      </>
                                    )}
                                    {hasActual && budget === 0 && (
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        จ่ายจริง {actual.toLocaleString()}
                                      </span>
                                    )}
                                    {!isCompleted && budget > 0 && (
                                      <span style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                                        (ยังไม่อบรม)
                                      </span>
                                    )}
                                    {overBudget && (
                                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: STATUS.criticalBg, color: STATUS.critical, fontWeight: 700 }}>เกินงบ</span>
                                    )}
                                    {nearLimit && (
                                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#fefce8', color: '#b45309', fontWeight: 700 }}>ใช้งบ {pctUsed}%</span>
                                    )}
                                    {noCostRecorded && (
                                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#fff7ed', color: '#c2410c', fontWeight: 700 }}>ยังไม่บันทึกค่าใช้จ่าย</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Right: Badge + Quick action + CTA */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <span style={{
                                fontSize: 10, padding: '3px 10px', borderRadius: 6, fontWeight: 700,
                                background: urgColors.bg, color: urgColors.color, border: `1px solid ${urgColors.border}`,
                                whiteSpace: 'nowrap',
                              }}>
                                {action.label}
                              </span>
                              {/* Cost badge */}
                              {action.costBadge && (
                                <span style={{
                                  fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                                  background: action.costBadge.bg, color: action.costBadge.color,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {action.costBadge.label}
                                </span>
                              )}
                              {/* Inline quick action: mark scheduled as completed */}
                              {isLoggedIn && status === 'scheduled' && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleQuickStatusChange(plan, 'completed'); }}
                                  title="เปลี่ยนเป็น อบรมแล้ว"
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, border: `1px solid ${STATUS.positive}40`, background: STATUS.positiveBg, color: STATUS.positive, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  <CheckCircle size={12} /> อบรมแล้ว
                                </button>
                              )}
                              {/* Inline quick action: assign month for planned without month */}
                              {isLoggedIn && status === 'planned' && !effMonth && (
                                (() => {
                                  if (editingMonthPlanId === plan.id) {
                                    return (
                                      <select
                                        autoFocus
                                        defaultValue=""
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => { if (e.target.value) handleUpdatePlannedMonth(plan.id, Number(e.target.value)); }}
                                        onBlur={() => setEditingMonthPlanId(null)}
                                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg)', cursor: 'pointer' }}
                                      >
                                        <option value="">เลือกเดือน...</option>
                                        {MONTH_LABELS.map((label, mi) => (
                                          <option key={mi} value={mi + 1}>{label}</option>
                                        ))}
                                      </select>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditingMonthPlanId(plan.id); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      <Calendar size={11} /> กำหนดเดือน
                                    </button>
                                  );
                                })()
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); isLoggedIn ? openPlanModal(plan) : setShowLoginDialog(true); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                                  borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  background: action.urgency === 'critical' ? STATUS.critical : action.urgency === 'done' || action.urgency === 'muted' ? 'var(--bg-secondary)' : 'var(--accent)',
                                  color: action.urgency === 'done' || action.urgency === 'muted' ? 'var(--text-secondary)' : '#fff',
                                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                                }}
                              >
                                {action.ctaLabel} <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

          </>
        )}

        {/* ═══ Detail Modal — Status-Driven Form ═══ */}
        {showModal && selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 24, overflowY: 'auto' }}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 16, width: '95%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
              {/* Modal Header — Gradient like IncidentForm */}
              <div style={{ padding: '16px 24px', flexShrink: 0, borderRadius: '16px 16px 0 0', background: getStatusGradient(selectedPlan.training_sessions?.[0]?.status) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {selectedPlan.dsd_eligible !== false && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700 }}>DSD</span>
                      )}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                        {selectedPlan.category}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                        {selectedPlan.in_house_external}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#fff', lineHeight: 1.4 }}>
                      {selectedPlan.course_name}
                    </h2>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                      <span>เดือน: <strong style={{ color: '#fff' }}>{selectedPlan.planned_month ? MONTH_LABELS[selectedPlan.planned_month - 1] : 'ยังไม่กำหนด'} {selectedYear}</strong></span>
                      <span>ชั่วโมง: <strong style={{ color: '#fff' }}>{selectedPlan.hours_per_course} ชม.</strong></span>
                      <span>งบ: <strong style={{ color: '#fff' }}>{selectedPlan.budget?.toLocaleString()} ฿</strong></span>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)} style={{ padding: 8, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', cursor: 'pointer', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                </div>
                {/* DSD pre-training deadline warning */}
                {selectedPlan.dsd_eligible !== false && modalDateStart && !modalDsdSubmitted && (() => {
                  const isInHouse = selectedPlan.in_house_external?.toLowerCase().includes('in');
                  const daysRequired = isInHouse ? 60 : 15;
                  const dStart = new Date(modalDateStart);
                  const diffDays = Math.ceil((dStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays > 0 && diffDays <= daysRequired + 7) {
                    return (
                      <div style={{ marginTop: 8, background: diffDays <= daysRequired ? STATUS.criticalBg : STATUS.warningBg, border: `1px solid ${diffDays <= daysRequired ? STATUS.critical : STATUS.warning}`, borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                        <strong style={{ color: diffDays <= daysRequired ? STATUS.critical : STATUS.warning }}>
                          {diffDays <= daysRequired ? '⚠️ เลยกำหนดยื่น!' : '⏰ ใกล้กำหนดยื่น'}
                        </strong>{' '}
                        ต้องยื่น {isInHouse ? 'ยป.1' : 'ยป.3'} ล่วงหน้า {daysRequired} วัน (เหลือ {diffDays} วัน)
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Modal Body — Status-Driven with Numbered Sections */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 200px)' }}>

                {/* Cost Summary Card — always visible */}
                {(() => {
                  const budget = selectedPlan.budget || 0;
                  const actual = modalActualCost || 0;
                  const session = selectedPlan.training_sessions?.[0];
                  const currentStatus = session?.status || 'planned';
                  const isCompleted = currentStatus === 'completed';
                  const pctUsed = budget > 0 ? Math.round((actual / budget) * 100) : 0;
                  const overBudget = actual > 0 && budget > 0 && actual > budget;
                  const noCostRecorded = isCompleted && actual === 0;
                  if (budget <= 0 && !noCostRecorded) return null;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                      background: overBudget ? STATUS.criticalBg : noCostRecorded ? STATUS.warningBg : 'var(--bg-secondary)',
                      border: `1px solid ${overBudget ? STATUS.critical : noCostRecorded ? STATUS.warning : 'var(--border)'}`,
                    }}>
                      <DollarSign size={16} style={{ color: overBudget ? STATUS.critical : noCostRecorded ? STATUS.warning : 'var(--text-secondary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {budget > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              งบ <strong style={{ color: 'var(--text-primary)' }}>{budget.toLocaleString()} ฿</strong>
                            </span>
                          )}
                          {actual > 0 && budget > 0 && (
                            <>
                              <span style={{ color: 'var(--border)' }}>→</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: overBudget ? STATUS.critical : STATUS.positive }}>
                                จ่ายจริง {actual.toLocaleString()} ฿
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: overBudget ? STATUS.critical : STATUS.positive }}>
                                ({overBudget ? `เกิน +${(actual - budget).toLocaleString()}` : `เหลือ ${(budget - actual).toLocaleString()}`})
                              </span>
                            </>
                          )}
                          {actual > 0 && budget === 0 && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                              จ่ายจริง {actual.toLocaleString()} ฿
                            </span>
                          )}
                          {noCostRecorded && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS.warning }}>
                              ⚠ อบรมแล้วแต่ยังไม่บันทึกค่าใช้จ่ายจริง
                            </span>
                          )}
                          {!isCompleted && budget > 0 && actual === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(baseline — ยังไม่มีค่าใช้จ่ายจริง)</span>
                          )}
                        </div>
                        {budget > 0 && actual > 0 && (
                          <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: PALETTE.grid, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2, width: `${Math.min(pctUsed, 100)}%`,
                              background: overBudget ? STATUS.critical : pctUsed >= 85 ? STATUS.warning : STATUS.positive,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        )}
                      </div>
                      {budget > 0 && actual > 0 && (
                        <span style={{
                          fontSize: 13, fontWeight: 700, flexShrink: 0,
                          color: overBudget ? '#dc2626' : pctUsed >= 85 ? '#b45309' : '#16a34a',
                        }}>
                          {pctUsed}%
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Section 1: Status Selection */}
                <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>1</span>
                  สถานะการอบรม
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => setModalStatus(key)}
                      style={{ padding: '7px 4px', borderRadius: 8, border: modalStatus === key ? `2px solid ${cfg.color}` : '1px solid var(--border)',
                        background: modalStatus === key ? cfg.bg : 'transparent', color: cfg.color, fontSize: 11, cursor: 'pointer', fontWeight: modalStatus === key ? 700 : 400,
                        transition: 'all 0.15s' }}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
                </div>

                {/* Section 2: Status Details */}
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: (() => { const s = modalStatus; return s === 'completed' ? `${STATUS.positive}20` : s === 'cancelled' ? `${STATUS.critical}20` : s === 'postponed' ? `${STATUS.warning}20` : s === 'scheduled' ? `${PALETTE.primary}20` : `${PALETTE.muted}20`; })(), color: (() => { const s = modalStatus; return s === 'completed' ? STATUS.positive : s === 'cancelled' ? STATUS.critical : s === 'postponed' ? STATUS.warning : s === 'scheduled' ? PALETTE.primary : PALETTE.muted; })() }}>2</span>
                  {modalStatus === 'planned' ? 'รายละเอียด' : modalStatus === 'scheduled' ? 'กำหนดการอบรม' : modalStatus === 'completed' ? 'ผลการอบรม' : modalStatus === 'postponed' ? 'รายละเอียดการเลื่อน' : modalStatus === 'cancelled' ? 'รายละเอียดการยกเลิก' : 'รายละเอียด'}
                </h3>

                {/* ─── STATUS: planned ─── */}
                {modalStatus === 'planned' && (
                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                      <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>📋</span>
                      หลักสูตรนี้ยังไม่กำหนดวัน — เปลี่ยนสถานะเป็น <strong>&quot;กำหนดวันแล้ว&quot;</strong> เพื่อเริ่มวางแผน
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>หมายเหตุ</label>
                      <textarea value={modalNote} onChange={e => setModalNote(e.target.value)}
                        rows={2} placeholder="บันทึกเพิ่มเติม (ถ้ามี)" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  </div>
                )}

                {/* ─── STATUS: scheduled ─── */}
                {modalStatus === 'scheduled' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>วันเริ่มอบรม</label>
                        <DateInput value={modalDateStart} onChange={v => setModalDateStart(v)} inputStyle={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>วันสิ้นสุด</label>
                        <DateInput value={modalDateEnd} onChange={v => setModalDateEnd(v)} inputStyle={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>ชื่อวิทยากร</label>
                      <input value={modalInstructor} onChange={e => setModalInstructor(e.target.value)} placeholder="ระบุชื่อวิทยากร" style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>สถานที่อบรม</label>
                        <input value={modalLocation} onChange={e => setModalLocation(e.target.value)} placeholder="ระบุสถานที่" style={inputStyle} />
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
                    <div>
                      <label style={labelStyle}>หมายเหตุ</label>
                      <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="บันทึกเพิ่มเติม" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  </div>
                )}

                {/* ─── STATUS: completed ─── */}
                {modalStatus === 'completed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                    {/* Post-training deadline warning */}
                    {selectedPlan.dsd_eligible !== false && modalDateEnd && !modalDsdReportSubmitted && (() => {
                      const dEnd = new Date(modalDateEnd);
                      const deadline60 = new Date(dEnd.getTime() + 60 * 24 * 60 * 60 * 1000);
                      const jan15 = new Date(selectedYear + 1, 0, 15);
                      const deadline = deadline60 < jan15 ? deadline60 : jan15;
                      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysLeft <= 30) {
                        return (
                          <div style={{ background: daysLeft <= 0 ? '#fef2f2' : '#fefce8', border: `1px solid ${daysLeft <= 0 ? '#dc2626' : '#ca8a04'}`, borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                            <strong style={{ color: daysLeft <= 0 ? '#dc2626' : '#ca8a04' }}>
                              {daysLeft <= 0 ? '⚠️ เลยกำหนดส่ง รง.1!' : `⏰ เหลือ ${daysLeft} วัน`}
                            </strong>{' '}
                            ส่ง รง.1 ภายใน 60 วันหลังอบรม (ไม่เกิน 15 ม.ค. {selectedYear + 1})
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Dates (editable even after completion for corrections) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>วันเริ่มอบรม</label>
                        <DateInput value={modalDateStart} onChange={v => setModalDateStart(v)} inputStyle={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>วันสิ้นสุด</label>
                        <DateInput value={modalDateEnd} onChange={v => setModalDateEnd(v)} inputStyle={inputStyle} />
                      </div>
                    </div>

                    {/* Instructor/Location/Method */}
                    <div>
                      <label style={labelStyle}>ชื่อวิทยากร</label>
                      <input value={modalInstructor} onChange={e => setModalInstructor(e.target.value)} placeholder="ระบุชื่อวิทยากร" style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>สถานที่อบรม</label>
                        <input value={modalLocation} onChange={e => setModalLocation(e.target.value)} placeholder="ระบุสถานที่" style={inputStyle} />
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

                    {/* Actual Cost & Hours */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>ค่าใช้จ่ายจริง (฿)</label>
                        <input type="number" value={modalActualCost || ''} placeholder="ใส่ตัวเลข" onChange={e => setModalActualCost(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ชั่วโมงอบรมจริง</label>
                        <input type="number" value={modalActualHours || ''} placeholder="ใส่ตัวเลข" onChange={e => setModalActualHours(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle} />
                      </div>
                    </div>

                    {/* Section 3: Attendees */}
                    <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: 'rgba(168,85,247,0.1)', color: '#9333ea' }}>3</span>
                      ผู้เข้าอบรม
                    </h3>
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>👥 ผู้เข้าอบรม</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            เลือกแล้ว <strong style={{ color: '#16a34a' }}>{attendees.length}</strong> คน
                            {selectedPlan.planned_participants > 0 && <span> จากแผน {selectedPlan.planned_participants} คน</span>}
                          </div>
                        </div>
                        <button onClick={() => setShowAttendeePanel(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <Users size={13} /> จัดการรายชื่อ <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Section 4: DSD Documents */}
                    {selectedPlan.dsd_eligible !== false && (
                      <div>
                      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: 'rgba(249,115,22,0.1)', color: '#ea580c' }}>4</span>
                        เอกสาร DSD (รง.1)
                      </h3>
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📋 รายการเอกสาร</div>
                          {auth.isAdmin && (
                            <button onClick={() => { setShowDsdToggleModal(true); setDsdToggleCourseName(selectedPlan.course_name); setDsdToggleValue(!selectedPlan.dsd_eligible); }}
                              style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Eye size={10} /> {selectedPlan?.dsd_eligible ? 'เปิด' : 'ปิด'}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <input type="checkbox" checked={modalPhotosSubmitted} onChange={e => setModalPhotosSubmitted(e.target.checked)} style={{ marginTop: 3 }} />
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, cursor: 'pointer' }}>ส่งภาพถ่ายระหว่างอบรม</label>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, cursor: 'pointer' }}>
                                <Upload size={11} style={{ display: 'inline', marginRight: 4 }} />
                                <input type="file" accept="image/*" multiple onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'photos')} style={{ cursor: 'pointer' }} disabled={uploading} />
                              </label>
                              {photoFiles.id === selectedPlan.training_sessions?.[0]?.id && photoFiles.urls.length > 0 && (
                                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {photoFiles.urls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}>ไฟล์ {i + 1}</a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <input type="checkbox" checked={modalSigninSubmitted} onChange={e => setModalSigninSubmitted(e.target.checked)} style={{ marginTop: 3 }} />
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, cursor: 'pointer' }}>ส่งใบเซ็นชื่อลงทะเบียน</label>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, cursor: 'pointer' }}>
                                <Upload size={11} style={{ display: 'inline', marginRight: 4 }} />
                                <input type="file" accept=".pdf,.jpg,.png" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'signin')} style={{ cursor: 'pointer' }} disabled={uploading} />
                              </label>
                              {signinFiles.id === selectedPlan.training_sessions?.[0]?.id && signinFiles.urls.length > 0 && (
                                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {signinFiles.urls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}>ไฟล์ {i + 1}</a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                    )}

                    {/* Section 5: Note */}
                    <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>{selectedPlan.dsd_eligible !== false ? '5' : '4'}</span>
                      หมายเหตุ
                    </h3>
                    <div>
                      <label style={labelStyle}>หมายเหตุ</label>
                      <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="บันทึกเพิ่มเติม" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  </div>
                )}

                {/* ─── STATUS: postponed ─── */}
                {modalStatus === 'postponed' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: STATUS.warningBg, border: `1px solid ${STATUS.warning}`, borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                      <label style={{ ...labelStyle, color: STATUS.warning }}>เลื่อนไปเดือนไหน? *</label>
                      <select value={modalPostponedMonth || ''} onChange={e => setModalPostponedMonth(e.target.value ? Number(e.target.value) : null)}
                        style={{ ...inputStyle, background: '#fff', borderColor: STATUS.warning }}>
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
                    <label style={labelStyle}>เหตุผลที่เลื่อน</label>
                    <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="ระบุเหตุผล..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                )}

                {/* ─── STATUS: cancelled ─── */}
                {modalStatus === 'cancelled' && (
                  <div style={{ marginBottom: 16 }}>
                    {/* Pending badge if request exists */}
                    {selectedPlan && pendingCancelRequests[selectedPlan.id] === 'cancelled' && (
                      <div style={{ background: STATUS.warningBg, border: `1px solid ${STATUS.warning}`, borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <Clock size={14} color={STATUS.warning} />
                        <span style={{ color: STATUS.warning, fontWeight: 600 }}>คำขอยกเลิกรอ Admin อนุมัติ</span>
                      </div>
                    )}
                    {/* Approval form for non-admin */}
                    {pendingCancelStatus === 'cancelled' && !auth.isAdmin ? (
                      <div style={{ background: STATUS.criticalBg, border: `1px solid ${STATUS.critical}40`, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: STATUS.critical, marginBottom: 8 }}>⚠️ ขอยกเลิกหลักสูตร</div>
                        <p style={{ fontSize: 12, color: STATUS.critical, marginBottom: 10 }}>
                          การยกเลิกจะหักรายการออกจากฐาน KPI — ต้องได้รับอนุมัติจาก Admin ก่อน
                        </p>
                        <label style={{ ...labelStyle, color: STATUS.critical }}>เหตุผลที่ยกเลิก *</label>
                        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="ระบุเหตุผลที่ต้องยกเลิกหลักสูตรนี้..." style={{ ...inputStyle, resize: 'vertical', borderColor: STATUS.critical }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button onClick={() => { setPendingCancelStatus(null); setModalStatus(selectedPlan?.training_sessions?.[0]?.status || 'planned'); }}
                            style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                            ยกเลิก
                          </button>
                          <button onClick={handleCancelRequest} disabled={cancelSubmitting || !cancelReason.trim()}
                            style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: cancelReason.trim() ? STATUS.critical : '#d1d5db', color: '#fff', fontSize: 12, cursor: cancelReason.trim() ? 'pointer' : 'default', fontWeight: 600, opacity: cancelSubmitting ? 0.6 : 1 }}>
                            {cancelSubmitting ? 'กำลังส่ง...' : '📨 ส่งคำขอยกเลิก'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: STATUS.criticalBg, border: `1px solid ${STATUS.critical}40`, borderRadius: 8, padding: '12px 16px' }}>
                        <label style={{ ...labelStyle, color: STATUS.critical }}>เหตุผลที่ยกเลิก</label>
                        <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="ระบุเหตุผล..." style={{ ...inputStyle, resize: 'vertical', borderColor: STATUS.critical }} />
                        {!auth.isAdmin && (
                          <p style={{ fontSize: 11, color: STATUS.critical, marginTop: 6 }}>* การยกเลิกต้องได้รับอนุมัติจาก Admin</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer — Styled like IncidentForm */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-secondary)' }}>
                {/* Attendees shortcut for scheduled status */}
                {modalStatus === 'scheduled' && (
                  <button onClick={() => setShowAttendeePanel(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                    <Users size={14} /> ผู้เข้าอบรม ({attendees.length})
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowModal(false)}
                  style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
                  ยกเลิก
                </button>
                <button onClick={handleSaveSession} disabled={saving}
                  style={{
                    padding: '9px 28px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    opacity: saving ? 0.6 : 1, transition: 'all 0.15s',
                    background: getStatusGradient(modalStatus),
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>
                  {saving ? 'กำลังบันทึก...' : (
                    modalStatus === 'planned' ? '💾 บันทึก' :
                    modalStatus === 'scheduled' ? '💾 บันทึกกำหนดการ' :
                    modalStatus === 'completed' ? '✓ บันทึกผลอบรม' :
                    modalStatus === 'postponed' ? '💾 บันทึกการเลื่อน' :
                    modalStatus === 'cancelled' ? '💾 บันทึกการยกเลิก' :
                    '💾 บันทึก'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Attendee Sub-Panel (Drawer) ═══ */}
        {showAttendeePanel && selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
            onClick={() => setShowAttendeePanel(false)}>
            <div style={{ background: 'var(--card-solid)', width: '95%', maxWidth: 520, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 30px rgba(0,0,0,0.15)' }}
              onClick={e => e.stopPropagation()}>
              {/* Panel Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#fff' }}>👥 จัดการผู้เข้าอบรม</h3>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {selectedPlan.course_name} • เลือกแล้ว <strong style={{ color: '#fff' }}>{attendees.length}</strong> คน
                      {selectedPlan.planned_participants > 0 && <span> / แผน {selectedPlan.planned_participants} คน</span>}
                    </div>
                  </div>
                  <button onClick={() => setShowAttendeePanel(false)} style={{ padding: 6, border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Panel Actions + Tabs */}
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <label style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Upload size={11} /> นำเข้า Excel
                    <input type="file" accept=".xlsx,.xls" hidden onChange={e => e.target.files?.[0] && handleImportEmployeeList(e.target.files[0])} />
                  </label>
                  <button onClick={() => setShowManualEntry(!showManualEntry)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${showManualEntry ? 'var(--success)' : 'var(--border)'}`, background: showManualEntry ? 'var(--success)' : 'var(--bg)', color: showManualEntry ? '#fff' : 'var(--text-primary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={11} /> เพิ่มพนักงานใหม่
                  </button>
                </div>
                {/* Tabs: All / Selected */}
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button onClick={() => setAttendeeViewTab('all')}
                    style={{ flex: 1, padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: attendeeViewTab === 'all' ? 700 : 400, cursor: 'pointer', background: attendeeViewTab === 'all' ? 'var(--accent)' : 'var(--bg)', color: attendeeViewTab === 'all' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                    ทั้งหมด ({companyEmployees.length})
                  </button>
                  <button onClick={() => setAttendeeViewTab('selected')}
                    style={{ flex: 1, padding: '6px 12px', border: 'none', borderLeft: '1px solid var(--border)', fontSize: 11, fontWeight: attendeeViewTab === 'selected' ? 700 : 400, cursor: 'pointer', background: attendeeViewTab === 'selected' ? STATUS.positive : 'var(--bg)', color: attendeeViewTab === 'selected' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                    เลือกแล้ว ({attendees.length})
                  </button>
                </div>
              </div>

              {/* Panel Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {/* Manual entry */}
                {showManualEntry && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, border: '1px solid var(--border)', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>เพิ่มพนักงานใหม่เข้าระบบ</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <input placeholder="รหัส" value={manualEmp.emp_code} onChange={e => setManualEmp(p => ({ ...p, emp_code: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 80px', minWidth: 60 }} />
                      <input placeholder="ชื่อ *" value={manualEmp.first_name} onChange={e => setManualEmp(p => ({ ...p, first_name: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 100px', minWidth: 80 }} />
                      <input placeholder="นามสกุล" value={manualEmp.last_name} onChange={e => setManualEmp(p => ({ ...p, last_name: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 100px', minWidth: 80 }} />
                      <input placeholder="ตำแหน่ง" value={manualEmp.position} onChange={e => setManualEmp(p => ({ ...p, position: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 80px', minWidth: 60 }} />
                      <input placeholder="แผนก" value={manualEmp.department} onChange={e => setManualEmp(p => ({ ...p, department: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 80px', minWidth: 60 }} />
                      <button onClick={handleManualAddEmployee} disabled={manualSaving || !manualEmp.first_name.trim()}
                        style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: manualEmp.first_name.trim() ? 'pointer' : 'not-allowed', background: manualEmp.first_name.trim() ? 'var(--success)' : 'var(--border)', color: '#fff', whiteSpace: 'nowrap' }}>
                        {manualSaving ? '...' : '✓ เพิ่ม'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Filters */}
                {(() => {
                  const departments = Array.from(new Set(companyEmployees.map(e => e.department).filter(Boolean))).sort();
                  const positions = Array.from(new Set(
                    companyEmployees.filter(e => !bulkFilterDept || e.department === bulkFilterDept).map(e => e.position).filter(Boolean)
                  )).sort();
                  const attendeeByCode = new Map<string, Attendee>();
                  const attendeeByName = new Map<string, Attendee>();
                  attendees.forEach(a => {
                    if (a.emp_code) attendeeByCode.set(a.emp_code, a);
                    attendeeByName.set(`${a.first_name}_${a.last_name}`, a);
                  });
                  const findAttendeeFor = (emp: typeof companyEmployees[0]): Attendee | undefined => {
                    if (emp.emp_code && attendeeByCode.has(emp.emp_code)) return attendeeByCode.get(emp.emp_code);
                    return attendeeByName.get(`${emp.first_name}_${emp.last_name}`);
                  };
                  const filteredEmps = companyEmployees.filter(emp => {
                    if (bulkFilterDept && emp.department !== bulkFilterDept) return false;
                    if (bulkFilterPos && emp.position !== bulkFilterPos) return false;
                    if (empSearch.trim()) {
                      const q = empSearch.toLowerCase();
                      if (!(emp.first_name || '').toLowerCase().includes(q) && !(emp.last_name || '').toLowerCase().includes(q) && !(emp.emp_code || '').toLowerCase().includes(q)) return false;
                    }
                    return true;
                  });
                  // Apply tab filter
                  const tabFiltered = attendeeViewTab === 'selected'
                    ? filteredEmps.filter(emp => !!findAttendeeFor(emp))
                    : filteredEmps;

                  // Apply sorting
                  const sorted = [...tabFiltered].sort((a, b) => {
                    const aIsAtt = findAttendeeFor(a) ? 1 : 0;
                    const bIsAtt = findAttendeeFor(b) ? 1 : 0;
                    if (attendeeViewTab === 'all' && aIsAtt !== bIsAtt) return bIsAtt - aIsAtt;
                    let cmp = 0;
                    if (attendeeSortKey === 'name') cmp = (a.first_name || '').localeCompare(b.first_name || '');
                    else if (attendeeSortKey === 'dept') cmp = (a.department || '').localeCompare(b.department || '');
                    else if (attendeeSortKey === 'position') cmp = (a.position || '').localeCompare(b.position || '');
                    return attendeeSortAsc ? cmp : -cmp;
                  });

                  // Select-all helpers
                  const allFilteredSelected = sorted.length > 0 && sorted.every(emp => !!findAttendeeFor(emp));
                  const someFilteredSelected = sorted.some(emp => !!findAttendeeFor(emp));
                  const handleSelectAll = async () => {
                    for (const emp of sorted) {
                      const att = findAttendeeFor(emp);
                      if (!att) {
                        await handleToggleAttendee(emp, false, undefined);
                      }
                    }
                  };
                  const handleDeselectAll = async () => {
                    for (const emp of sorted) {
                      const att = findAttendeeFor(emp);
                      if (att) {
                        await handleToggleAttendee(emp, true, att.id);
                      }
                    }
                  };

                  // Sort header helper
                  const SortTh = ({ label, sortKey, style: thSt }: { label: string; sortKey: 'name' | 'dept' | 'position'; style?: React.CSSProperties }) => (
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...thSt }}
                      onClick={() => { if (attendeeSortKey === sortKey) setAttendeeSortAsc(!attendeeSortAsc); else { setAttendeeSortKey(sortKey); setAttendeeSortAsc(true); } }}>
                      {label} {attendeeSortKey === sortKey ? (attendeeSortAsc ? '▲' : '▼') : <span style={{ color: 'var(--border)' }}>⇅</span>}
                    </th>
                  );

                  return (
                    <>
                      {companyEmployees.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          <select value={bulkFilterDept} onChange={e => { setBulkFilterDept(e.target.value); setBulkFilterPos(''); }}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 120px', minWidth: 100 }}>
                            <option value="">ทุกแผนก</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <select value={bulkFilterPos} onChange={e => setBulkFilterPos(e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 120px', minWidth: 100 }}>
                            <option value="">ทุกตำแหน่ง</option>
                            {positions.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input placeholder="🔍 ค้นหาชื่อ/รหัส..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', flex: '1 1 150px', minWidth: 120 }} />
                        </div>
                      )}

                      {companyEmployees.length === 0 && employeesLoaded ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>
                          ยังไม่มีรายชื่อพนักงาน — กด &quot;นำเข้า Excel&quot; หรือ &quot;เพิ่มพนักงานใหม่&quot;
                        </div>
                      ) : companyEmployees.length === 0 && !employeesLoaded ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>กำลังโหลดรายชื่อพนักงาน...</div>
                      ) : loadingAttendees ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>กำลังโหลด...</div>
                      ) : sorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>
                          {attendeeViewTab === 'selected' ? 'ยังไม่มีผู้เข้าอบรมที่เลือก' : 'ไม่พบพนักงานตามเงื่อนไข'}
                        </div>
                      ) : (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: 36 }} />
                              <col style={{ width: 80 }} />
                              <col />
                              <col style={{ width: '25%' }} />
                              <col style={{ width: '22%' }} />
                            </colgroup>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                                <th style={{ padding: '7px 8px', width: 36, textAlign: 'center' }}>
                                  <input type="checkbox"
                                    checked={allFilteredSelected}
                                    ref={el => { if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected; }}
                                    onChange={() => allFilteredSelected ? handleDeselectAll() : handleSelectAll()}
                                    style={{ cursor: 'pointer', accentColor: '#16a34a' }}
                                    title={allFilteredSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                                  />
                                </th>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>รหัส</th>
                                <SortTh label="ชื่อ-สกุล" sortKey="name" />
                                <SortTh label="ตำแหน่ง" sortKey="position" />
                                <SortTh label="แผนก" sortKey="dept" />
                              </tr>
                            </thead>
                            <tbody>
                              {sorted.map((emp, idx) => {
                                const att = findAttendeeFor(emp);
                                const isAttendee = !!att;
                                const empK = `${emp.emp_code}_${emp.first_name}_${emp.last_name}`;
                                const isToggling = togglingEmp.has(empK);
                                return (
                                  <tr key={idx} style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: isAttendee ? 'rgba(22,163,74,0.08)' : idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                                    cursor: isToggling ? 'wait' : 'pointer', opacity: isToggling ? 0.5 : 1, transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={e => { if (!isAttendee) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; }}
                                  onMouseLeave={e => { if (!isAttendee) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'; }}
                                  onClick={() => { if (!isToggling) handleToggleAttendee(emp, isAttendee, att?.id); }}>
                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                      <input type="checkbox" checked={isAttendee} readOnly style={{ cursor: 'pointer', accentColor: STATUS.positive }} />
                                    </td>
                                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.emp_code || '-'}</td>
                                    <td style={{ padding: '5px 8px', fontWeight: isAttendee ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {isAttendee && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: STATUS.positive, marginRight: 6, verticalAlign: 'middle' }} />}
                                      {emp.first_name} {emp.last_name}
                                    </td>
                                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.position || ''}>{emp.position || '-'}</td>
                                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.department || ''}>{emp.department || '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          แสดง {sorted.length} คน • เข้าอบรม <b style={{ color: STATUS.positive }}>{attendees.length}</b> คน
                          {selectedPlan.planned_participants > 0 && <span> • แผน {selectedPlan.planned_participants} คน</span>}
                        </span>
                        {attendees.length > 0 && selectedPlan.planned_participants > 0 && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                            background: attendees.length >= selectedPlan.planned_participants ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)',
                            color: attendees.length >= selectedPlan.planned_participants ? STATUS.positive : STATUS.warning,
                          }}>
                            {attendees.length >= selectedPlan.planned_participants ? '✓ ครบตามแผน' : `ขาดอีก ${selectedPlan.planned_participants - attendees.length} คน`}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Panel Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                <button onClick={() => setShowAttendeePanel(false)}
                  style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  ยกเลิก
                </button>
                <button onClick={() => setShowAttendeePanel(false)}
                  disabled={attendees.length === 0}
                  style={{
                    padding: '8px 24px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                    background: attendees.length > 0 ? getStatusGradient('completed') : 'var(--border)',
                    color: attendees.length > 0 ? '#fff' : 'var(--text-secondary)',
                    cursor: attendees.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: attendees.length > 0 ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
                  }}>
                  ✓ เสร็จสิ้น ({attendees.length} คน)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}

        {/* DSD Toggle Modal - Feature 1 */}
        {showDsdToggleModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}
            onClick={() => setShowDsdToggleModal(false)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 12, width: '95%', maxWidth: 400, display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔧 ตั้งค่าสถานะ DSD Eligible</h2>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  หลักสูตร: <strong>{dsdToggleCourseName}</strong>
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  การเปลี่ยนแปลงจะสะท้อนไปยังหลักสูตรทั้งหมดที่มีชื่อเดียวกัน
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
                  <input type="checkbox" checked={dsdToggleValue} onChange={e => setDsdToggleValue(e.target.checked)} />
                  <span>{dsdToggleValue ? 'เปิด (ให้ส่งเอกสาร)' : 'ปิด (ไม่ต้องส่งเอกสาร)'}</span>
                </label>
                <button onClick={handleDsdToggle}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  ยืนยันการเปลี่ยนแปลง
                </button>
                <button onClick={() => setShowDsdToggleModal(false)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Log Panel - Feature 4 */}
        {showChangeLog && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60 }}
            onClick={() => setShowChangeLog(false)}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 12, width: '95%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-solid)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📝 บันทึกการเปลี่ยนแปลง</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  {unreviewedChanges.length} รายการที่รอการตรวจสอบ
                </p>
              </div>
              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                {loadingChanges ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>กำลังโหลด...</div>
                ) : unreviewedChanges.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>ไม่มีรายการที่ยังไม่ได้ตรวจสอบ</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {unreviewedChanges.slice(0, 10).map((change: any, i: number) => (
                      <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 2 }}>
                              {change.change_type}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                              โดย {change.changed_by} • {new Date(change.changed_at as string).toLocaleString('th-TH')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleMarkChangesAsReviewed([(change.id as string)])}
                            style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer' }}
                          >
                            ✓ ตรวจสอบแล้ว
                          </button>
                        </div>
                        {change.field_name && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            <strong>{change.field_name}</strong>: {change.old_value} → {change.new_value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                <button onClick={() => setShowChangeLog(false)}
                  style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
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
                <div style={{ background: STATUS.criticalBg, color: STATUS.critical, padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
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
const thStyle: React.CSSProperties = { padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--card-solid)' };
const tdStyle: React.CSSProperties = { padding: '8px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 };

function formatDate(d: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function StatCard({ icon, label, value, color, onClick, active, subtitle }: { icon: string; label: string; value: string | number; color?: string; onClick?: () => void; active?: boolean; subtitle?: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--card-solid)',
        borderRadius: 10, padding: '14px 16px',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        transform: active ? 'scale(1.02)' : 'none',
        boxShadow: active ? '0 4px 12px rgba(0,122,255,0.2)' : 'none',
      }}
    >
      <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: active ? '#fff' : (color || 'var(--text-primary)') }}>{value}</div>
      {subtitle && <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}
