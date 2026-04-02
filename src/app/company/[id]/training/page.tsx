'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { Upload, Calendar, Users, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, PauseCircle, FileSpreadsheet, Trash2, Plus, ChevronDown, ChevronRight, Edit2, Save, Bell, Eye, EyeOff, X, Filter, RotateCcw, ArrowRight } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  planned: { label: 'ยังไม่กำหนดวัน', color: '#6b7280', bg: '#f3f4f6', icon: '○' },
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
  const company = COMPANIES.find(c => c.id === companyId);

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
  const scheduledCourses = timeFilteredPlans.filter(p => p.training_sessions?.[0]?.status === 'scheduled').length;
  const pendingCourses = timeFilteredPlans.filter(p => !p.training_sessions?.[0] || p.training_sessions[0].status === 'planned').length;
  const totalBudget = timeFilteredPlans.reduce((s, p) => s + (p.budget || 0), 0);
  const totalActual = timeFilteredPlans.reduce((s, p) => s + (p.training_sessions?.[0]?.actual_cost || 0), 0);

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

  const filteredPlans = timeFilteredPlans.filter(p => {
    if (statusFilter === 'all') return true;
    const status = p.training_sessions?.[0]?.status || 'planned';
    return status === statusFilter;
  });

  const getSession = (plan: TrainingPlan): TrainingSession | undefined => plan.training_sessions?.[0];

  // ═══ Task Queue Helpers ═══
  // Determine next action for each course → drives badge + CTA label
  const getNextAction = (plan: TrainingPlan): { label: string; urgency: 'critical' | 'warning' | 'info' | 'done' | 'muted'; ctaLabel: string } => {
    const session = plan.training_sessions?.[0];
    const status = session?.status || 'planned';
    const effMonth = getEffectiveMonth(plan);
    const isHidden = plan.is_active === false;
    if (isHidden) return { label: 'นำออกจากแผน', urgency: 'muted', ctaLabel: 'ดูรายละเอียด' };
    if (status === 'cancelled') return { label: 'ยกเลิกแล้ว', urgency: 'muted', ctaLabel: 'ดูรายละเอียด' };
    if (status === 'completed') {
      // Check if post-training docs are pending
      if (plan.dsd_eligible !== false && !session?.dsd_report_submitted) return { label: 'รอส่งเอกสาร รง.1', urgency: 'warning', ctaLabel: 'ปิดเอกสาร' };
      const attCount = session?.training_attendees?.[0]?.count || session?.actual_participants || 0;
      if (attCount === 0) return { label: 'รอบันทึกผู้เข้าอบรม', urgency: 'warning', ctaLabel: 'บันทึกผล' };
      if (!session?.actual_cost && session?.actual_cost !== 0) return { label: 'รอบันทึกค่าใช้จ่าย', urgency: 'info', ctaLabel: 'บันทึกผล' };
      return { label: 'เสร็จสมบูรณ์', urgency: 'done', ctaLabel: 'ดูรายละเอียด' };
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
    critical: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
    warning: { bg: '#fefce8', color: '#b45309', border: '#fde68a' },
    info: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    done: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
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
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              📋 แผนอบรมประจำปี — {company?.name || companyId.toUpperCase()}
            </h1>
            {auth.isAdmin && unreviewedChanges.length > 0 && (
              <button
                onClick={() => { fetchUnreviewedChanges(); setShowChangeLog(!showChangeLog); }}
                style={{
                  position: "relative", padding: "6px 12px", borderRadius: 6, border: "none",
                  background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Bell size={14} /> แจ้งเตือน ({unreviewedChanges.length})
                <span style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20,
                  background: "#dc2626", borderRadius: "50%", border: "2px solid var(--card-solid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {unreviewedChanges.length}
                </span>
              </button>
            )}
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

        {/* KPI Cards — clickable to filter */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <StatCard icon="📚" label="หลักสูตรทั้งหมด" value={totalCourses}
            subtitle={`${overallPct}% สำเร็จ`}
            active={activeKpi === 'all'} onClick={() => setActiveKpi(activeKpi === 'all' ? null : 'all')} />
          <StatCard icon="✅" label="อบรมแล้ว" value={completedCourses} color="var(--success)"
            subtitle={totalCourses > 0 ? `${Math.round((completedCourses/totalCourses)*100)}% ของแผน` : undefined}
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
                <div style={{ background: '#fffbeb', borderRadius: 10, border: '1px solid #fbbf24', padding: '14px 16px' }}>
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
                <div style={{ background: '#eff6ff', borderRadius: 10, border: '1px solid #93c5fd', padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> อบรมเร็วๆ นี้ ({upcoming.length})
                  </div>
                  {upcoming.slice(0, 5).map(p => {
                    const s = p.training_sessions[0];
                    const daysLeft = Math.ceil((new Date(s.scheduled_date_start!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={p.id} onClick={() => openPlanModal(p)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: '#dbeafe', color: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.course_name}</span>
                        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 8, fontWeight: 700, color: daysLeft <= 7 ? '#dc2626' : '#2563eb' }}>
                          {daysLeft === 0 ? 'วันนี้!' : `อีก ${daysLeft} วัน`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending DSD docs */}
              {pendingDocs.length > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: 10, border: '1px solid #fca5a5', padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> เอกสารค้างส่ง ({pendingDocs.length})
                  </div>
                  {pendingDocs.slice(0, 5).map(p => {
                    const s = p.training_sessions[0];
                    const missing: string[] = [];
                    if (!s?.photos_submitted) missing.push('ภาพถ่าย');
                    if (!s?.signin_sheet_submitted) missing.push('ใบเซ็นชื่อ');
                    if (!s?.dsd_report_submitted) missing.push('รง.1');
                    return (
                      <div key={p.id} onClick={() => openPlanModal(p)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: '#fee2e2', color: '#7f1d1d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.course_name}</span>
                        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 8, color: '#dc2626' }}>ขาด: {missing.join(', ')}</span>
                      </div>
                    );
                  })}
                  {pendingDocs.length > 5 && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>...อีก {pendingDocs.length - 5} หลักสูตร</div>}
                </div>
              )}
            </div>
          );
        })()}

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
                <div style={{ fontSize: 28, fontWeight: 800, color: overallPct === 0 ? 'var(--muted)' : overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : '#fb923c' }}>
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
                    {/* Count label */}
                    {d.planned > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: d.completed === d.planned && d.planned > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {d.completed}/{d.planned}
                      </div>
                    )}
                    {/* Stacked bar */}
                    <div style={{ width: '80%', height: barHeight || 2, borderRadius: 4, position: 'relative', overflow: 'hidden', background: barBg }}>
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
                    <div style={{ fontSize: 10, color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isCurrent ? 800 : 400 }}>
                      {isCurrent ? `▶ ${d.label}` : d.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> อบรมแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd', display: 'inline-block' }} /> กำหนดวันแล้ว
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef3c7', display: 'inline-block' }} /> ยังไม่มีความคืบหน้า
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
                  { label: 'ยื่นแบบแจ้งแล้ว (ยป.1/ยป.3)', value: preSubmitted, color: '#3b82f6' },
                  { label: 'ได้รับอนุมัติแล้ว', value: preApproved, color: '#16a34a' },
                  { label: 'อบรมเสร็จแล้ว', value: completedDsd, color: '#f59e0b' },
                  { label: 'ส่ง รง.1 แล้ว', value: postSubmitted, color: '#16a34a' },
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
              <Filter size={14} style={{ color: hasFilter ? '#3b82f6' : 'var(--text-secondary)', flexShrink: 0 }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {TASK_GROUPS.map(group => {
              const groupPlans = filteredPlans.filter(group.filter);
              if (groupPlans.length === 0) return null;
              return (
                <div key={group.key}>
                  {/* Group Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
                    <span style={{ fontSize: 14 }}>{group.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{group.title}</span>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: URGENCY_COLORS[group.key].bg, color: URGENCY_COLORS[group.key].color, fontWeight: 600 }}>
                      {groupPlans.length}
                    </span>
                  </div>
                  {/* Course Cards */}
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
                      return (
                        <div
                          key={plan.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                            borderRadius: 10, border: `1px solid ${urgColors.border}`,
                            background: 'var(--card-solid)', cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-solid)'; e.currentTarget.style.boxShadow = 'none'; }}
                          onClick={() => isLoggedIn ? openPlanModal(plan) : setShowLoginDialog(true)}
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
                          </div>

                          {/* Right: Next action badge + CTA */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10, padding: '3px 10px', borderRadius: 6, fontWeight: 700,
                              background: urgColors.bg, color: urgColors.color, border: `1px solid ${urgColors.border}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {action.label}
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); isLoggedIn ? openPlanModal(plan) : setShowLoginDialog(true); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                                borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: action.urgency === 'critical' ? '#dc2626' : action.urgency === 'done' || action.urgency === 'muted' ? 'var(--bg-secondary)' : 'var(--accent)',
                                color: action.urgency === 'done' || action.urgency === 'muted' ? 'var(--text-secondary)' : '#fff',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {action.ctaLabel} <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

          </>
        )}

        {/* ═══ Detail Modal — Status-Driven Form ═══ */}
        {showModal && selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, overflowY: 'auto' }}>
            <div style={{ background: 'var(--card-solid)', borderRadius: 16, width: '95%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-secondary)', borderRadius: '16px 16px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedPlan.course_name}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {selectedPlan.dsd_eligible !== false && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>DSD</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {selectedPlan.category} • {selectedPlan.in_house_external} • {selectedPlan.planned_month ? MONTH_LABELS[selectedPlan.planned_month - 1] : 'ยังไม่กำหนดเดือน'} {selectedYear}
                        • {selectedPlan.hours_per_course} ชม. • งบ {selectedPlan.budget?.toLocaleString()} ฿
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
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

              {/* Modal Body — Status-Driven */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

                {/* Step 1: Status Selection — always visible */}
                <label style={labelStyle}>สถานะ</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 20 }}>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => setModalStatus(key)}
                      style={{ padding: '7px 4px', borderRadius: 8, border: modalStatus === key ? `2px solid ${cfg.color}` : '1px solid var(--border)',
                        background: modalStatus === key ? cfg.bg : 'transparent', color: cfg.color, fontSize: 11, cursor: 'pointer', fontWeight: modalStatus === key ? 700 : 400,
                        transition: 'all 0.15s' }}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>

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
                        <input type="date" value={modalDateStart} onChange={e => setModalDateStart(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>วันสิ้นสุด</label>
                        <input type="date" value={modalDateEnd} onChange={e => setModalDateEnd(e.target.value)} style={inputStyle} />
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
                        <input type="date" value={modalDateStart} onChange={e => setModalDateStart(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>วันสิ้นสุด</label>
                        <input type="date" value={modalDateEnd} onChange={e => setModalDateEnd(e.target.value)} style={inputStyle} />
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

                    {/* Attendees — summary card with open button */}
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

                    {/* DSD Documents */}
                    {selectedPlan.dsd_eligible !== false && (
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📋 เอกสาร DSD (รง.1)</div>
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
                    )}

                    {/* Note */}
                    <div>
                      <label style={labelStyle}>หมายเหตุ</label>
                      <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="บันทึกเพิ่มเติม" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  </div>
                )}

                {/* ─── STATUS: postponed ─── */}
                {modalStatus === 'postponed' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
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
                    <label style={labelStyle}>เหตุผลที่เลื่อน</label>
                    <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="ระบุเหตุผล..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                )}

                {/* ─── STATUS: cancelled ─── */}
                {modalStatus === 'cancelled' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px' }}>
                      <label style={{ ...labelStyle, color: '#dc2626' }}>เหตุผลที่ยกเลิก</label>
                      <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={2} placeholder="ระบุเหตุผล..." style={{ ...inputStyle, resize: 'vertical', borderColor: '#fca5a5' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer — Contextual Save Button */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Attendees shortcut for scheduled status */}
                {modalStatus === 'scheduled' && (
                  <button onClick={() => setShowAttendeePanel(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                    <Users size={13} /> ผู้เข้าอบรม ({attendees.length})
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowModal(false)}
                  style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  ปิด
                </button>
                <button onClick={handleSaveSession} disabled={saving}
                  style={{
                    padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    opacity: saving ? 0.6 : 1, transition: 'all 0.15s',
                    background: modalStatus === 'completed' ? '#16a34a' : modalStatus === 'cancelled' ? '#dc2626' : modalStatus === 'postponed' ? '#f59e0b' : 'var(--accent)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>
                  {saving ? 'กำลังบันทึก...' : (
                    modalStatus === 'planned' ? '💾 บันทึก' :
                    modalStatus === 'scheduled' ? '💾 บันทึกกำหนดการ' :
                    modalStatus === 'completed' ? '💾 บันทึกผลอบรม' :
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
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>👥 จัดการผู้เข้าอบรม</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedPlan.course_name} • เลือกแล้ว <strong style={{ color: '#16a34a' }}>{attendees.length}</strong> คน
                  </div>
                </div>
                <button onClick={() => setShowAttendeePanel(false)} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Panel Actions */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                <label style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Upload size={11} /> นำเข้า Excel
                  <input type="file" accept=".xlsx,.xls" hidden onChange={e => e.target.files?.[0] && handleImportEmployeeList(e.target.files[0])} />
                </label>
                <button onClick={() => setShowManualEntry(!showManualEntry)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${showManualEntry ? 'var(--success)' : 'var(--border)'}`, background: showManualEntry ? 'var(--success)' : 'var(--bg)', color: showManualEntry ? '#fff' : 'var(--text-primary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={11} /> เพิ่มพนักงานใหม่
                </button>
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
                  const sorted = [...filteredEmps].sort((a, b) => {
                    const aIsAtt = findAttendeeFor(a) ? 1 : 0;
                    const bIsAtt = findAttendeeFor(b) ? 1 : 0;
                    if (aIsAtt !== bIsAtt) return bIsAtt - aIsAtt;
                    return (a.first_name || '').localeCompare(b.first_name || '');
                  });

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
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>ไม่พบพนักงานตามเงื่อนไข</div>
                      ) : (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                                <th style={{ padding: '6px 8px', width: 32 }}></th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>รหัส</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>ชื่อ-สกุล</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>ตำแหน่ง</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>แผนก</th>
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
                                    background: isAttendee ? '#f0fdf4' : idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                                    cursor: isToggling ? 'wait' : 'pointer', opacity: isToggling ? 0.5 : 1, transition: 'background 0.15s',
                                  }}
                                  onClick={() => { if (!isToggling) handleToggleAttendee(emp, isAttendee, att?.id); }}>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                      <input type="checkbox" checked={isAttendee} readOnly style={{ cursor: 'pointer', accentColor: '#16a34a' }} />
                                    </td>
                                    <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>{emp.emp_code || '-'}</td>
                                    <td style={{ padding: '4px 8px', fontWeight: isAttendee ? 600 : 400 }}>
                                      {emp.first_name} {emp.last_name}
                                      {isAttendee && <span style={{ marginLeft: 6, fontSize: 9, color: '#16a34a', fontWeight: 700 }}>✓</span>}
                                    </td>
                                    <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>{emp.position || '-'}</td>
                                    <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>{emp.department || '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                        พนักงาน {filteredEmps.length} คน • เข้าอบรม <b style={{ color: '#16a34a' }}>{attendees.length}</b> คน
                        {selectedPlan.planned_participants > 0 && <span> • แผน {selectedPlan.planned_participants} คน</span>}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Panel Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, textAlign: 'right' }}>
                <button onClick={() => setShowAttendeePanel(false)}
                  style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  เสร็จสิ้น ({attendees.length} คน)
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
