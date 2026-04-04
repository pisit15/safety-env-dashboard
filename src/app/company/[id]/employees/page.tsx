'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { Search, Upload, Plus, Edit2, Trash2, X, GraduationCap, BookOpen, Users, Award, Image, AlertTriangle, Shield, Clock, CheckCircle, ChevronRight, FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

/* ───── Interfaces ───── */
interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  position: string;
  department: string;
  employment_status?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TrainingRecord {
  id: string;
  training_plans?: { course_name: string; category: string; hours_per_course: number; planned_month: number; year: number };
  training_sessions?: { status: string; scheduled_date_start: string; scheduled_date_end: string };
  created_at: string;
}

interface CourseAttendee {
  emp_code: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  hours_attended: number;
  session_status: string;
  scheduled_date_start: string | null;
  scheduled_date_end: string | null;
}

interface CourseWithAttendees {
  course_name: string;
  category: string;
  hours_per_course: number;
  in_house_external: string;
  year: number;
  planned_month: number;
  total_attendees: number;
  completed_count: number;
  attendees: CourseAttendee[];
}

interface Certificate {
  id: string;
  company_id: string;
  employee_id: string;
  emp_code: string;
  certificate_name: string;
  issued_date: string | null;
  expiry_date: string | null;
  no_expiry: boolean;
  certificate_number: string;
  issuer: string;
  image_url: string;
  notes: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'ทำงานอยู่', color: '#16a34a', bg: '#f0fdf4' },
  resigned: { label: 'ลาออก', color: '#dc2626', bg: '#fef2f2' },
};

/* ───── Helpers ───── */
function normalize(s: string) {
  return (s || '').replace(/^(นาย|นาง|นางสาว|น\.ส\.|ม\.ร\.ว\.|ดร\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim();
}

function getCertExpiryStatus(cert: Certificate) {
  if (cert.no_expiry) return { label: 'ไม่หมดอายุ', color: '#6366f1', bg: '#eef2ff', key: 'no_expiry' as const };
  if (!cert.expiry_date) return { label: 'ไม่ระบุ', color: '#9ca3af', bg: '#f3f4f6', key: 'unknown' as const };
  const now = new Date();
  const exp = new Date(cert.expiry_date);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'หมดอายุแล้ว', color: '#dc2626', bg: '#fef2f2', key: 'expired' as const };
  if (daysLeft <= 30) return { label: `เหลือ ${daysLeft} วัน`, color: '#ea580c', bg: '#fff7ed', key: 'expiring' as const };
  if (daysLeft <= 90) return { label: `เหลือ ${daysLeft} วัน`, color: '#d97706', bg: '#fffbeb', key: 'warning' as const };
  return { label: `เหลือ ${daysLeft} วัน`, color: '#16a34a', bg: '#f0fdf4', key: 'valid' as const };
}

function getInitials(emp: Employee) {
  const f = normalize(emp.first_name).charAt(0);
  const l = normalize(emp.last_name).charAt(0);
  return (f + l).toUpperCase() || '?';
}

/* ───── Main Component ───── */
export default function EmployeesPage() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === companyId);

  /* ── Core state ── */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCert, setFilterCert] = useState<string>('');
  const [alertFilter, setAlertFilter] = useState<string>('');

  /* ── Selected employee (master-detail) ── */
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'training' | 'certs'>('info');

  /* ── Training history (for detail panel) ── */
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ── Certificates (for detail panel) ── */
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);

  /* ── Add/Edit Employee modal ── */
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '', employment_status: 'active' });
  const [saving, setSaving] = useState(false);

  /* ── Certificate form (inline in detail panel) ── */
  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [certForm, setCertForm] = useState({
    certificate_name: '', issued_date: '', expiry_date: '', no_expiry: false,
    certificate_number: '', issuer: '', notes: '', image_url: '',
  });
  const [savingCert, setSavingCert] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  /* ── Import ── */
  const [importing, setImporting] = useState(false);

  /* ── Courses tab ── */
  const [activeTab, setActiveTab] = useState<'employees' | 'courses'>('employees');
  const [courses, setCourses] = useState<CourseWithAttendees[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [coursesFetched, setCoursesFetched] = useState(false);

  /* ── Auth ── */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const ca = auth.getCompanyAuth(companyId);
    if (ca.isLoggedIn || auth.isAdmin) setIsLoggedIn(true);
    else {
      const saved = sessionStorage.getItem(`auth_${companyId}`);
      if (saved) setIsLoggedIn(true);
    }
  }, [companyId, auth]);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const result = await auth.companyLogin(companyId, loginUsername, loginPassword);
      if (result.success) { setIsLoggedIn(true); setLoginUsername(''); setLoginPassword(''); }
      else setLoginError(result.error || 'รหัสผ่านไม่ถูกต้อง');
    } catch { setLoginError('เกิดข้อผิดพลาด'); }
  };

  /* ── Fetch employees ── */
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training/employees?companyId=${companyId}&all=true`);
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  /* ── Fetch ALL certificates for KPI ── */
  const fetchAllCerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/certificates?companyId=${companyId}&all=true`);
      const data = await res.json();
      if (Array.isArray(data)) setAllCertificates(data);
    } catch { /* ignore */ }
  }, [companyId]);

  useEffect(() => { fetchAllCerts(); }, [fetchAllCerts]);

  /* ── Fetch courses ── */
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await fetch(`/api/training/courses-attendees?companyId=${companyId}`);
      const data = await res.json();
      if (data.courses) setCourses(data.courses);
    } catch { /* ignore */ }
    setLoadingCourses(false);
    setCoursesFetched(true);
  }, [companyId]);

  useEffect(() => {
    if (activeTab === 'courses' && !coursesFetched) fetchCourses();
  }, [activeTab, coursesFetched, fetchCourses]);

  /* ── Fetch training for selected employee ── */
  const fetchTraining = useCallback(async (emp: Employee) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/training/attendees?companyId=${companyId}&empCode=${emp.emp_code}`);
      const data = await res.json();
      setTrainingRecords(Array.isArray(data) ? data : []);
    } catch { setTrainingRecords([]); }
    setLoadingHistory(false);
  }, [companyId]);

  /* ── Fetch certs for selected employee ── */
  const fetchCerts = useCallback(async (emp: Employee) => {
    setLoadingCerts(true);
    try {
      const qp = emp.id ? `employeeId=${emp.id}` : `empCode=${encodeURIComponent(emp.emp_code)}`;
      const res = await fetch(`/api/certificates?companyId=${companyId}&${qp}`);
      const data = await res.json();
      setCertificates(Array.isArray(data) ? data : []);
    } catch { setCertificates([]); }
    setLoadingCerts(false);
  }, [companyId]);

  /* ── Select employee → load detail data ── */
  const selectEmployee = useCallback((emp: Employee) => {
    setSelectedEmpId(emp.id);
    setDetailTab('info');
    setShowCertForm(false);
    setEditingCert(null);
    setPreviewImage(null);
    fetchTraining(emp);
    fetchCerts(emp);
  }, [fetchTraining, fetchCerts]);

  const selectedEmp = useMemo(() => employees.find(e => e.id === selectedEmpId) || null, [employees, selectedEmpId]);

  /* ── Departments ── */
  const departments = useMemo(() =>
    Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(),
    [employees]
  );

  /* ── Per-employee cert summary (for badges on list) ── */
  const empCertSummary = useMemo(() => {
    const map: Record<string, { total: number; expired: number; expiring: number }> = {};
    for (const cert of allCertificates) {
      const key = cert.employee_id || cert.emp_code;
      if (!map[key]) map[key] = { total: 0, expired: 0, expiring: 0 };
      map[key].total++;
      const st = getCertExpiryStatus(cert);
      if (st.key === 'expired') map[key].expired++;
      else if (st.key === 'expiring') map[key].expiring++;
    }
    return map;
  }, [allCertificates]);

  /* ── Per-employee cert names (for search by cert name) ── */
  const empCertNames = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cert of allCertificates) {
      const key = cert.employee_id || cert.emp_code;
      if (!map[key]) map[key] = [];
      map[key].push((cert.certificate_name || '').toLowerCase());
    }
    return map;
  }, [allCertificates]);

  /* ── Unique certificate names (for filter dropdown) ── */
  const uniqueCertNames = useMemo(() =>
    Array.from(new Set(allCertificates.map(c => c.certificate_name).filter(Boolean))).sort(),
    [allCertificates]
  );

  /* ── KPI Alerts ── */
  const kpiAlerts = useMemo(() => {
    const activeEmps = employees.filter(e => (e.employment_status || 'active') === 'active');
    let expiredCerts = 0, expiringCerts = 0, noCerts = 0, incompleteData = 0;
    const expiredEmpIds: string[] = [];
    const expiringEmpIds: string[] = [];
    const noCertEmpIds: string[] = [];
    const incompleteEmpIds: string[] = [];

    for (const emp of activeEmps) {
      const summary = empCertSummary[emp.id] || empCertSummary[emp.emp_code];
      if (!summary || summary.total === 0) { noCerts++; noCertEmpIds.push(emp.id); }
      else {
        if (summary.expired > 0) { expiredCerts += summary.expired; expiredEmpIds.push(emp.id); }
        if (summary.expiring > 0) { expiringCerts += summary.expiring; expiringEmpIds.push(emp.id); }
      }
      if (!emp.emp_code || !emp.position || !emp.department) { incompleteData++; incompleteEmpIds.push(emp.id); }
    }
    return { expiredCerts, expiringCerts, noCerts, incompleteData, expiredEmpIds, expiringEmpIds, noCertEmpIds, incompleteEmpIds };
  }, [employees, empCertSummary]);

  /* ── Filter & search ── */
  const filtered = useMemo(() => {
    let list = employees;

    // Status filter
    if (filterStatus === 'active') list = list.filter(e => (e.employment_status || 'active') === 'active');
    else if (filterStatus === 'resigned') list = list.filter(e => e.employment_status === 'resigned');

    // Department filter
    if (filterDept) list = list.filter(e => e.department === filterDept);

    // Alert filter
    if (alertFilter === 'expired') list = list.filter(e => kpiAlerts.expiredEmpIds.includes(e.id));
    else if (alertFilter === 'expiring') list = list.filter(e => kpiAlerts.expiringEmpIds.includes(e.id));
    else if (alertFilter === 'no_cert') list = list.filter(e => kpiAlerts.noCertEmpIds.includes(e.id));
    else if (alertFilter === 'incomplete') list = list.filter(e => kpiAlerts.incompleteEmpIds.includes(e.id));

    // Certificate filter
    if (filterCert) {
      const certQ = filterCert.toLowerCase();
      list = list.filter(e => {
        const names = empCertNames[e.id] || empCertNames[e.emp_code] || [];
        return names.some(n => n.includes(certQ));
      });
    }

    // Search — normalized, searches name, department, position, emp_code, cert names
    if (search) {
      const q = normalize(search).toLowerCase();
      list = list.filter(e => {
        const full = `${normalize(e.first_name)} ${normalize(e.last_name)} ${e.first_name} ${e.last_name} ${e.emp_code} ${e.position} ${e.department}`.toLowerCase();
        if (full.includes(q)) return true;
        // Also search cert names
        const certs = empCertNames[e.id] || empCertNames[e.emp_code] || [];
        return certs.some(cn => cn.includes(q));
      });
    }

    // Sort by name
    list = [...list].sort((a, b) => {
      const an = normalize(a.first_name).toLowerCase();
      const bn = normalize(b.first_name).toLowerCase();
      return an.localeCompare(bn);
    });

    return list;
  }, [employees, search, filterDept, filterStatus, filterCert, alertFilter, kpiAlerts, empCertNames]);

  /* ── Filtered courses ── */
  const filteredCourses = useMemo(() => {
    if (!courseSearch) return courses;
    const q = courseSearch.toLowerCase();
    return courses.filter(c =>
      (c.course_name || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  /* ── Stats ── */
  const activeCount = employees.filter(e => (e.employment_status || 'active') === 'active').length;
  const resignedCount = employees.filter(e => e.employment_status === 'resigned').length;

  /* ── CRUD: Save employee ── */
  const handleSave = async () => {
    if (!form.first_name.trim()) return;
    setSaving(true);
    const cleanForm = {
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      emp_code: form.emp_code.trim(),
      position: form.position.trim(),
      department: form.department.trim(),
    };
    try {
      if (editingEmp) {
        await fetch('/api/training/employees', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEmp.id, ...cleanForm }),
        });
      } else {
        await fetch('/api/training/employees', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, employees: [cleanForm] }),
        });
      }
      setShowModal(false);
      setEditingEmp(null);
      fetchEmployees();
    } catch { alert('บันทึกไม่สำเร็จ'); }
    setSaving(false);
  };

  const handleStatusToggle = async (emp: Employee) => {
    const newStatus = (emp.employment_status || 'active') === 'active' ? 'resigned' : 'active';
    try {
      await fetch('/api/training/employees', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, employment_status: newStatus, is_active: newStatus === 'active' }),
      });
      fetchEmployees();
    } catch { alert('อัปเดตไม่สำเร็จ'); }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`ต้องการลบ ${emp.first_name} ${emp.last_name} ออกจากระบบ?`)) return;
    try {
      await fetch(`/api/training/employees?id=${emp.id}`, { method: 'DELETE' });
      if (selectedEmpId === emp.id) setSelectedEmpId(null);
      fetchEmployees();
    } catch { alert('ลบไม่สำเร็จ'); }
  };

  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm({ emp_code: emp.emp_code || '', first_name: emp.first_name || '', last_name: emp.last_name || '', gender: emp.gender || '', position: emp.position || '', department: emp.department || '', employment_status: emp.employment_status || 'active' });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingEmp(null);
    setForm({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '', employment_status: 'active' });
    setShowModal(true);
  };

  /* ── Import Excel ── */
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const mapped = rows.map(r => ({
        emp_code: (r['รหัสพนักงาน'] || r['emp_code'] || r['Employee Code'] || r['รหัส'] || '').trim(),
        first_name: (r['ชื่อ'] || r['first_name'] || r['First Name'] || r['Name'] || '').trim(),
        last_name: (r['นามสกุล'] || r['last_name'] || r['Last Name'] || '').trim(),
        gender: (r['เพศ'] || r['gender'] || r['Gender'] || '').trim(),
        position: (r['ตำแหน่ง'] || r['position'] || r['Position'] || '').trim(),
        department: (r['แผนก'] || r['department'] || r['Department'] || '').trim(),
      })).filter(r => r.first_name);

      if (mapped.length === 0) { alert('ไม่พบข้อมูลพนักงานในไฟล์'); setImporting(false); return; }

      const res = await fetch('/api/training/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, employees: mapped }),
      });
      const result = await res.json();
      if (result.success) { alert(`นำเข้าสำเร็จ ${result.count} คน`); fetchEmployees(); fetchAllCerts(); }
      else alert(`เกิดข้อผิดพลาด: ${result.error}`);
    } catch { alert('นำเข้าไม่สำเร็จ'); }
    setImporting(false);
  };

  /* ── Download template ── */
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'เพศ', 'ตำแหน่ง', 'แผนก'],
      ['EMP001', 'สมชาย', 'ใจดี', 'ชาย', 'วิศวกร', 'ฝ่ายผลิต'],
    ]);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employee-template-${companyId}.xlsx`);
  };

  /* ── Certificate CRUD ── */
  const openAddCert = () => {
    setEditingCert(null);
    setCertForm({ certificate_name: '', issued_date: '', expiry_date: '', no_expiry: false, certificate_number: '', issuer: '', notes: '', image_url: '' });
    setShowCertForm(true);
  };

  const openEditCert = (cert: Certificate) => {
    setEditingCert(cert);
    setCertForm({ certificate_name: cert.certificate_name || '', issued_date: cert.issued_date || '', expiry_date: cert.expiry_date || '', no_expiry: cert.no_expiry || false, certificate_number: cert.certificate_number || '', issuer: cert.issuer || '', notes: cert.notes || '', image_url: cert.image_url || '' });
    setShowCertForm(true);
  };

  const handleSaveCert = async () => {
    if (!certForm.certificate_name.trim() || !selectedEmp) return;
    setSavingCert(true);
    try {
      const payload = { ...certForm, company_id: companyId, employee_id: selectedEmp.id, emp_code: selectedEmp.emp_code };
      if (editingCert) {
        await fetch('/api/certificates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCert.id, ...certForm }) });
      } else {
        await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setShowCertForm(false);
      setEditingCert(null);
      fetchCerts(selectedEmp);
      fetchAllCerts();
    } catch { alert('บันทึกไม่สำเร็จ'); }
    setSavingCert(false);
  };

  const handleDeleteCert = async (cert: Certificate) => {
    if (!confirm(`ต้องการลบ "${cert.certificate_name}" ?`)) return;
    try {
      await fetch(`/api/certificates?id=${cert.id}`, { method: 'DELETE' });
      setCertificates(prev => prev.filter(c => c.id !== cert.id));
      fetchAllCerts();
    } catch { alert('ลบไม่สำเร็จ'); }
  };

  const handleCertImageUpload = async (file: File) => {
    if (!selectedEmp) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('employeeId', selectedEmp.id);
      const res = await fetch('/api/certificates/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setCertForm(f => ({ ...f, image_url: data.url }));
      else alert(data.error || 'อัปโหลดไม่สำเร็จ');
    } catch { alert('อัปโหลดไม่สำเร็จ'); }
    setUploadingImage(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  };

  /* ───── LOGIN GATE ───── */
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>เข้าสู่ระบบ</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              กรอกข้อมูลของ <strong>{company?.name || companyId.toUpperCase()}</strong> เพื่อดูข้อมูล
            </p>
            <input type="text" placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm mb-2" style={{ ...inputStyle }} />
            <input type="password" placeholder="รหัสผ่าน" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-2.5 rounded-lg text-sm mb-3" style={{ ...inputStyle }} />
            {loginError && <p className="text-xs mb-2" style={{ color: 'var(--danger)' }}>{loginError}</p>}
            <button onClick={handleLogin} className="btn-primary w-full px-4 py-2.5 rounded-lg text-sm font-medium">เข้าสู่ระบบ</button>
          </div>
        </main>
      </div>
    );
  }

  /* ───── MAIN RENDER ───── */
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {/* ── Header ── */}
          <div className="mb-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              👥 จัดการพนักงาน — {company?.name || companyId.toUpperCase()}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {employees.length} พนักงาน • {activeCount} ทำงานอยู่ • {resignedCount} ลาออก
            </p>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', display: 'inline-flex' }}>
            <button onClick={() => setActiveTab('employees')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: activeTab === 'employees' ? 'var(--card-solid)' : 'transparent', color: activeTab === 'employees' ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: activeTab === 'employees' ? 'var(--shadow-sm)' : 'none' }}>
              <Users size={15} /> รายชื่อพนักงาน
            </button>
            <button onClick={() => setActiveTab('courses')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: activeTab === 'courses' ? 'var(--card-solid)' : 'transparent', color: activeTab === 'courses' ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: activeTab === 'courses' ? 'var(--shadow-sm)' : 'none' }}>
              <BookOpen size={15} /> ค้นหาตามหลักสูตร
            </button>
          </div>

          {/* ════════════ EMPLOYEES TAB ════════════ */}
          {activeTab === 'employees' && (<>

            {/* ── KPI Alert Bar ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { key: 'expired', label: 'Cert หมดอายุ', value: kpiAlerts.expiredCerts, icon: <AlertTriangle size={16} />, color: '#dc2626', bg: '#fef2f2' },
                { key: 'expiring', label: 'ใกล้หมดอายุ 30 วัน', value: kpiAlerts.expiringCerts, icon: <Clock size={16} />, color: '#ea580c', bg: '#fff7ed' },
                { key: 'no_cert', label: 'ยังไม่มี Cert', value: kpiAlerts.noCerts, icon: <Shield size={16} />, color: '#6366f1', bg: '#eef2ff' },
                { key: 'incomplete', label: 'ข้อมูลไม่ครบ', value: kpiAlerts.incompleteData, icon: <FileText size={16} />, color: '#d97706', bg: '#fffbeb' },
              ].map(a => (
                <button key={a.key}
                  onClick={() => setAlertFilter(af => af === a.key ? '' : a.key)}
                  className="glass-card rounded-xl p-3 text-left transition-all"
                  style={{ border: alertFilter === a.key ? `2px solid ${a.color}` : '1px solid var(--border)', background: alertFilter === a.key ? a.bg : undefined }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: a.color }}>{a.icon}</span>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: a.value > 0 ? a.color : 'var(--text-muted)' }}>
                    {a.value}
                  </div>
                </button>
              ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="glass-card rounded-xl p-3 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="ค้นหา ชื่อ รหัส ตำแหน่ง แผนก ใบ Certificate..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pr-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: '100%', paddingLeft: 36 }} />
                </div>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: 'auto' }}>
                  <option value="">ทุกแผนก</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: 'auto' }}>
                  <option value="all">ทุกสถานะ</option>
                  <option value="active">ทำงานอยู่</option>
                  <option value="resigned">ลาออก</option>
                </select>
                {uniqueCertNames.length > 0 && (
                  <select value={filterCert} onChange={e => setFilterCert(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: 'auto', maxWidth: 200 }}>
                    <option value="">ทุก Certificate</option>
                    {uniqueCertNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
                  </select>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={downloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <Download size={13} /> Template
                  </button>
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-opacity ${importing ? 'opacity-50' : ''}`}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    <Upload size={13} /> นำเข้า Excel
                    <input type="file" accept=".xlsx,.xls" hidden disabled={importing}
                      onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ''; }} />
                  </label>
                  <button onClick={openAdd}
                    className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium">
                    <Plus size={13} /> เพิ่มพนักงาน
                  </button>
                </div>
              </div>
              {alertFilter && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: '#fef2f2', color: '#dc2626' }}>
                    กรองตาม: {alertFilter === 'expired' ? 'Cert หมดอายุ' : alertFilter === 'expiring' ? 'ใกล้หมดอายุ' : alertFilter === 'no_cert' ? 'ยังไม่มี Cert' : 'ข้อมูลไม่ครบ'}
                  </span>
                  <button onClick={() => setAlertFilter('')} className="text-[11px] underline" style={{ color: 'var(--accent)' }}>ล้าง</button>
                </div>
              )}
            </div>

            {/* ── Master-Detail Layout ── */}
            <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 340px)' }}>

              {/* ── LEFT: Employee List (Master) ── */}
              <div className="w-full lg:w-[380px] flex-shrink-0">
                <div className="glass-card rounded-xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 340px)', display: 'flex', flexDirection: 'column' }}>
                  {loading ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Users size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {employees.length === 0 ? 'ยังไม่มีรายชื่อพนักงาน' : 'ไม่พบตามเงื่อนไข'}
                      </p>
                      {employees.length === 0 && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>กด &quot;นำเข้า Excel&quot; หรือ &quot;เพิ่มพนักงาน&quot;</p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1">
                      {filtered.map(emp => {
                        const isSelected = emp.id === selectedEmpId;
                        const status = STATUS_LABELS[emp.employment_status || 'active'] || STATUS_LABELS.active;
                        const cs = empCertSummary[emp.id] || empCertSummary[emp.emp_code];
                        return (
                          <button key={emp.id}
                            onClick={() => selectEmployee(emp)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                            style={{
                              background: isSelected ? 'var(--accent-glow, rgba(0,122,255,0.08))' : 'transparent',
                              borderBottom: '1px solid var(--border)',
                              borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                            }}>
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                              style={{ background: (emp.employment_status || 'active') === 'active' ? 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)' : '#9ca3af' }}>
                              {getInitials(emp)}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {emp.first_name} {emp.last_name}
                                </span>
                                {emp.employment_status === 'resigned' && (
                                  <span className="text-[9px] px-1 py-0 rounded" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                                )}
                              </div>
                              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                {emp.position || '-'} • {emp.department || '-'}
                              </div>
                            </div>
                            {/* Cert badges */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {cs && cs.expired > 0 && (
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#dc2626' }}>
                                  {cs.expired}
                                </span>
                              )}
                              {cs && cs.expiring > 0 && (
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#ea580c' }}>
                                  {cs.expiring}
                                </span>
                              )}
                              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="px-4 py-2 text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                    แสดง {filtered.length} / {employees.length} คน
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Employee Detail Panel ── */}
              <div className="flex-1 hidden lg:block">
                {!selectedEmp ? (
                  <div className="glass-card rounded-xl flex items-center justify-center" style={{ minHeight: 400 }}>
                    <div className="text-center">
                      <Users size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>เลือกพนักงานจากรายชื่อด้านซ้าย</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>เพื่อดูข้อมูล ประวัติอบรม และ Certificate</p>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 340px)', display: 'flex', flexDirection: 'column' }}>
                    {/* Detail Header */}
                    <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)' }}>
                          {getInitials(selectedEmp)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                              {selectedEmp.first_name} {selectedEmp.last_name}
                            </h2>
                            {(() => {
                              const s = STATUS_LABELS[selectedEmp.employment_status || 'active'] || STATUS_LABELS.active;
                              return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
                            })()}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {selectedEmp.emp_code && <span>{selectedEmp.emp_code} • </span>}
                            {selectedEmp.position || '-'} • {selectedEmp.department || '-'}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(selectedEmp)} className="p-2 rounded-lg" style={{ color: 'var(--warning)', background: 'var(--bg-secondary)' }} title="แก้ไข">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleStatusToggle(selectedEmp)} className="p-2 rounded-lg text-[10px] font-medium"
                            style={{ color: (selectedEmp.employment_status || 'active') === 'active' ? '#dc2626' : '#16a34a', background: 'var(--bg-secondary)' }}>
                            {(selectedEmp.employment_status || 'active') === 'active' ? 'ลาออก' : 'กลับมา'}
                          </button>
                        </div>
                      </div>

                      {/* Summary cards */}
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>หลักสูตรอบรม</div>
                          <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{loadingHistory ? '...' : trainingRecords.length}</div>
                        </div>
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Certificate</div>
                          <div className="text-lg font-bold" style={{ color: '#6366f1' }}>{loadingCerts ? '...' : certificates.length}</div>
                        </div>
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cert หมดอายุ</div>
                          <div className="text-lg font-bold" style={{ color: certificates.filter(c => !c.no_expiry && c.expiry_date && new Date(c.expiry_date) < new Date()).length > 0 ? '#dc2626' : '#16a34a' }}>
                            {loadingCerts ? '...' : certificates.filter(c => !c.no_expiry && c.expiry_date && new Date(c.expiry_date) < new Date()).length}
                          </div>
                        </div>
                      </div>

                      {/* Detail Tabs */}
                      <div className="flex gap-1 mt-4 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                        {([
                          { key: 'info' as const, label: 'ข้อมูล', icon: <Users size={13} /> },
                          { key: 'training' as const, label: 'อบรม', icon: <GraduationCap size={13} /> },
                          { key: 'certs' as const, label: 'Certificate', icon: <Award size={13} /> },
                        ]).map(t => (
                          <button key={t.key} onClick={() => setDetailTab(t.key)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                            style={{ background: detailTab === t.key ? 'var(--card-solid)' : 'transparent', color: detailTab === t.key ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: detailTab === t.key ? 'var(--shadow-sm)' : 'none' }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detail Content */}
                    <div className="px-6 py-4 overflow-y-auto flex-1">
                      {/* ── Info Tab ── */}
                      {detailTab === 'info' && (
                        <div className="space-y-3">
                          {[
                            { label: 'รหัสพนักงาน', value: selectedEmp.emp_code },
                            { label: 'ชื่อ', value: selectedEmp.first_name },
                            { label: 'นามสกุล', value: selectedEmp.last_name },
                            { label: 'เพศ', value: selectedEmp.gender },
                            { label: 'ตำแหน่ง', value: selectedEmp.position },
                            { label: 'แผนก', value: selectedEmp.department },
                            { label: 'สถานะ', value: (STATUS_LABELS[selectedEmp.employment_status || 'active'] || STATUS_LABELS.active).label },
                          ].map((f, i) => (
                            <div key={i} className="flex items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                              <span className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                              <span className="text-sm font-medium" style={{ color: f.value ? 'var(--text-primary)' : '#dc2626' }}>
                                {f.value || <span className="text-[11px] italic" style={{ color: '#dc2626' }}>ยังไม่ระบุ</span>}
                              </span>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => openEdit(selectedEmp)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                              <Edit2 size={13} /> แก้ไขข้อมูล
                            </button>
                            <button onClick={() => handleDelete(selectedEmp)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                              style={{ color: '#dc2626', border: '1px solid #fecaca' }}>
                              <Trash2 size={13} /> ลบพนักงาน
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Training Tab ── */}
                      {detailTab === 'training' && (
                        <>
                          {loadingHistory ? (
                            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                          ) : trainingRecords.length === 0 ? (
                            <div className="text-center py-8">
                              <GraduationCap size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีประวัติการอบรม</p>
                            </div>
                          ) : (
                            <>
                              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                รวม {trainingRecords.length} หลักสูตร • {trainingRecords.reduce((s, r) => s + ((r.training_plans as TrainingRecord['training_plans'])?.hours_per_course || 0), 0)} ชม.
                              </div>
                              <div className="space-y-2">
                                {trainingRecords.map((rec, i) => {
                                  const plan = rec.training_plans as TrainingRecord['training_plans'];
                                  const session = rec.training_sessions as TrainingRecord['training_sessions'];
                                  const isDone = session?.status === 'completed';
                                  return (
                                    <div key={rec.id || i} className="rounded-lg p-3 flex items-center gap-3"
                                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: isDone ? '#f0fdf4' : '#f3f4f6' }}>
                                        {isDone ? <CheckCircle size={16} style={{ color: '#16a34a' }} /> : <Clock size={16} style={{ color: '#9ca3af' }} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                          {plan?.course_name || '-'}
                                        </div>
                                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                          {plan?.hours_per_course || 0} ชม.
                                          {plan?.category && <span> • {plan.category}</span>}
                                          {session?.scheduled_date_start && <span> • {new Date(session.scheduled_date_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                                        </div>
                                      </div>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                        style={{ background: isDone ? '#f0fdf4' : session?.status === 'cancelled' ? '#fef2f2' : '#f3f4f6', color: isDone ? '#16a34a' : session?.status === 'cancelled' ? '#dc2626' : '#9ca3af' }}>
                                        {isDone ? 'อบรมแล้ว' : session?.status === 'cancelled' ? 'ยกเลิก' : 'วางแผน'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {/* ── Certificates Tab ── */}
                      {detailTab === 'certs' && (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {loadingCerts ? 'กำลังโหลด...' : `${certificates.length} ใบ`}
                              {certificates.filter(c => !c.no_expiry && c.expiry_date && new Date(c.expiry_date) < new Date()).length > 0 && (
                                <span style={{ color: '#dc2626' }}> • หมดอายุ {certificates.filter(c => !c.no_expiry && c.expiry_date && new Date(c.expiry_date) < new Date()).length} ใบ</span>
                              )}
                            </span>
                            {!showCertForm && (
                              <button onClick={openAddCert}
                                className="btn-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium">
                                <Plus size={12} /> เพิ่ม Certificate
                              </button>
                            )}
                          </div>

                          {/* Cert Form */}
                          {showCertForm && (
                            <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)' }}>
                              <h4 className="text-sm font-semibold mb-3" style={{ color: '#6366f1' }}>
                                {editingCert ? 'แก้ไข Certificate' : 'เพิ่ม Certificate ใหม่'}
                              </h4>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>ชื่อ Certificate *</label>
                                  <input type="text" value={certForm.certificate_name} onChange={e => setCertForm(f => ({ ...f, certificate_name: e.target.value }))} style={inputStyle} placeholder="เช่น จป.วิชาชีพ" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>เลขที่</label>
                                    <input type="text" value={certForm.certificate_number} onChange={e => setCertForm(f => ({ ...f, certificate_number: e.target.value }))} style={inputStyle} placeholder="เลขที่ (ถ้ามี)" />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>หน่วยงานที่ออก</label>
                                    <input type="text" value={certForm.issuer} onChange={e => setCertForm(f => ({ ...f, issuer: e.target.value }))} style={inputStyle} placeholder="เช่น กรมสวัสดิการฯ" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>วันที่ออก</label>
                                    <input type="date" value={certForm.issued_date} onChange={e => setCertForm(f => ({ ...f, issued_date: e.target.value }))} style={inputStyle} />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                      วันหมดอายุ
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={certForm.no_expiry} onChange={e => setCertForm(f => ({ ...f, no_expiry: e.target.checked, expiry_date: '' }))} />
                                        <span className="text-[10px]" style={{ color: '#6366f1' }}>ไม่หมดอายุ</span>
                                      </label>
                                    </label>
                                    {!certForm.no_expiry ? (
                                      <input type="date" value={certForm.expiry_date} onChange={e => setCertForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
                                    ) : (
                                      <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: '#6366f1', fontWeight: 500 }}>ตลอดชีพ</div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                                  <input type="text" value={certForm.notes} onChange={e => setCertForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} placeholder="หมายเหตุเพิ่มเติม" />
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>แนบภาพ Certificate</label>
                                  <div className="flex items-center gap-3 mt-1">
                                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${uploadingImage ? 'opacity-50' : ''}`}
                                      style={{ background: 'var(--border)', color: 'var(--text-primary)', border: '1px dashed var(--text-muted)' }}>
                                      <Image size={13} /> {uploadingImage ? 'กำลังอัปโหลด...' : 'เลือกไฟล์'}
                                      <input type="file" accept="image/*,.pdf" hidden disabled={uploadingImage}
                                        onChange={e => { if (e.target.files?.[0]) handleCertImageUpload(e.target.files[0]); e.target.value = ''; }} />
                                    </label>
                                    {certForm.image_url && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px]" style={{ color: '#16a34a' }}>อัปโหลดแล้ว</span>
                                        <button onClick={() => setPreviewImage(certForm.image_url)} className="text-[10px] underline" style={{ color: 'var(--accent)' }}>ดูภาพ</button>
                                        <button onClick={() => setCertForm(f => ({ ...f, image_url: '' }))} className="text-[10px]" style={{ color: '#dc2626' }}>ลบ</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-4">
                                <button onClick={() => { setShowCertForm(false); setEditingCert(null); }}
                                  className="flex-1 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
                                <button onClick={handleSaveCert} disabled={savingCert || !certForm.certificate_name.trim()}
                                  className="btn-primary flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                                  style={{ opacity: savingCert || !certForm.certificate_name.trim() ? 0.5 : 1 }}>
                                  {savingCert ? 'กำลังบันทึก...' : editingCert ? 'บันทึก' : 'เพิ่ม'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Cert List */}
                          {loadingCerts ? (
                            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                          ) : certificates.length === 0 && !showCertForm ? (
                            <div className="text-center py-8">
                              <Award size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีใบ Certificate</p>
                              <button onClick={openAddCert} className="mt-2 text-xs underline" style={{ color: 'var(--accent)' }}>เพิ่ม Certificate ใบแรก</button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {certificates.map((cert, i) => {
                                const expiry = getCertExpiryStatus(cert);
                                const isExpired = expiry.key === 'expired';
                                return (
                                  <div key={cert.id || i} className="rounded-xl p-3 flex items-start gap-3"
                                    style={{ background: 'var(--bg-secondary)', border: `1px solid ${isExpired ? '#fecaca' : 'var(--border)'}` }}>
                                    {cert.image_url ? (
                                      <button onClick={() => setPreviewImage(cert.image_url)}
                                        className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                                        {cert.image_url.endsWith('.pdf') ? (
                                          <div className="w-full h-full flex items-center justify-center text-[9px]" style={{ color: 'var(--text-muted)' }}>PDF</div>
                                        ) : (
                                          <img src={cert.image_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </button>
                                    ) : (
                                      <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--border)' }}>
                                        <Award size={18} style={{ color: 'var(--text-muted)' }} />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{cert.certificate_name}</span>
                                        {isExpired && <AlertTriangle size={12} style={{ color: '#dc2626' }} />}
                                      </div>
                                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {cert.issuer && <span>{cert.issuer} • </span>}
                                        {cert.certificate_number && <span>เลขที่ {cert.certificate_number} • </span>}
                                        {cert.issued_date && <span>ออก {new Date(cert.issued_date).toLocaleDateString('th-TH')}</span>}
                                      </div>
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
                                        style={{ background: expiry.bg, color: expiry.color }}>
                                        {cert.no_expiry ? 'ไม่หมดอายุ' : cert.expiry_date ? `${new Date(cert.expiry_date).toLocaleDateString('th-TH')} — ${expiry.label}` : 'ไม่ระบุวันหมดอายุ'}
                                      </span>
                                    </div>
                                    <div className="flex gap-0.5 flex-shrink-0">
                                      {cert.image_url && <button onClick={() => setPreviewImage(cert.image_url)} className="p-1 rounded" style={{ color: 'var(--accent)' }}><Image size={13} /></button>}
                                      <button onClick={() => openEditCert(cert)} className="p-1 rounded" style={{ color: 'var(--warning)' }}><Edit2 size={13} /></button>
                                      <button onClick={() => handleDeleteCert(cert)} className="p-1 rounded" style={{ color: '#dc2626' }}><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile: Detail as bottom sheet (shown when employee selected on small screens) ── */}
            {selectedEmp && (
              <div className="lg:hidden fixed inset-0 bg-black/70 z-50 flex flex-col justify-end" onClick={() => setSelectedEmpId(null)}>
                <div className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col" style={{ background: 'var(--card-solid)' }} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                      {selectedEmp.first_name} {selectedEmp.last_name}
                    </h3>
                    <button onClick={() => setSelectedEmpId(null)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>
                  <p className="px-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {selectedEmp.emp_code && <span>{selectedEmp.emp_code} • </span>}
                    {selectedEmp.position} • {selectedEmp.department}
                  </p>
                  <div className="flex gap-1 mx-5 mt-3 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    {(['info', 'training', 'certs'] as const).map(t => (
                      <button key={t} onClick={() => setDetailTab(t)}
                        className="flex-1 py-1.5 rounded-md text-[11px] font-medium"
                        style={{ background: detailTab === t ? 'var(--card-solid)' : 'transparent', color: detailTab === t ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {t === 'info' ? 'ข้อมูล' : t === 'training' ? 'อบรม' : 'Certificate'}
                      </button>
                    ))}
                  </div>
                  <div className="px-5 py-4 overflow-y-auto flex-1">
                    {detailTab === 'info' && (
                      <div className="space-y-2 text-sm">
                        {[
                          { l: 'รหัส', v: selectedEmp.emp_code }, { l: 'ตำแหน่ง', v: selectedEmp.position },
                          { l: 'แผนก', v: selectedEmp.department }, { l: 'เพศ', v: selectedEmp.gender },
                        ].map((f, i) => (
                          <div key={i} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.l}</span>
                            <span style={{ color: f.v ? 'var(--text-primary)' : '#dc2626' }}>{f.v || 'ยังไม่ระบุ'}</span>
                          </div>
                        ))}
                        <button onClick={() => openEdit(selectedEmp)} className="mt-3 w-full px-4 py-2 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                          <Edit2 size={13} className="inline mr-1" /> แก้ไขข้อมูล
                        </button>
                      </div>
                    )}
                    {detailTab === 'training' && (
                      loadingHistory ? <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                      : trainingRecords.length === 0 ? <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีประวัติอบรม</div>
                      : <div className="space-y-2">{trainingRecords.map((rec, i) => {
                          const plan = rec.training_plans as TrainingRecord['training_plans'];
                          const session = rec.training_sessions as TrainingRecord['training_sessions'];
                          return (
                            <div key={rec.id || i} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{plan?.course_name || '-'}</div>
                              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {plan?.hours_per_course || 0} ชม.
                                {session?.scheduled_date_start && <span> • {new Date(session.scheduled_date_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
                                <span> • {session?.status === 'completed' ? 'อบรมแล้ว' : session?.status === 'cancelled' ? 'ยกเลิก' : 'วางแผน'}</span>
                              </div>
                            </div>
                          );
                        })}</div>
                    )}
                    {detailTab === 'certs' && (
                      loadingCerts ? <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                      : certificates.length === 0 ? <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มี Certificate</div>
                      : <div className="space-y-2">{certificates.map((cert, i) => {
                          const expiry = getCertExpiryStatus(cert);
                          return (
                            <div key={cert.id || i} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: `1px solid ${expiry.key === 'expired' ? '#fecaca' : 'var(--border)'}` }}>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{cert.certificate_name}</div>
                              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {cert.issuer && <span>{cert.issuer} • </span>}
                                {cert.certificate_number && <span>เลขที่ {cert.certificate_number}</span>}
                              </div>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: expiry.bg, color: expiry.color }}>
                                {cert.no_expiry ? 'ไม่หมดอายุ' : cert.expiry_date ? `${new Date(cert.expiry_date).toLocaleDateString('th-TH')} — ${expiry.label}` : 'ไม่ระบุวันหมดอายุ'}
                              </span>
                            </div>
                          );
                        })}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>)}

          {/* ════════════ COURSES TAB ════════════ */}
          {activeTab === 'courses' && (
            <>
              <div className="glass-card rounded-xl p-4 mb-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[250px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="ค้นหาชื่อหลักสูตร หรือหมวดหมู่..."
                      value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                      className="w-full pr-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: '100%', paddingLeft: 36 }} />
                  </div>
                  <button onClick={() => { setCoursesFetched(false); fetchCourses(); }}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    โหลดใหม่
                  </button>
                </div>
              </div>
              {loadingCourses ? (
                <div className="glass-card rounded-xl text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลดหลักสูตร...</div>
              ) : filteredCourses.length === 0 ? (
                <div className="glass-card rounded-xl text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {courses.length === 0 ? 'ยังไม่มีหลักสูตรในระบบ' : 'ไม่พบหลักสูตรตามคำค้นหา'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCourses.map((course, idx) => {
                    const isExpanded = expandedCourse === course.course_name;
                    return (
                      <div key={idx} className="glass-card rounded-xl overflow-hidden">
                        <button onClick={() => setExpandedCourse(isExpanded ? null : course.course_name)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                          style={{ background: isExpanded ? 'var(--accent-glow)' : 'transparent' }}>
                          <ChevronRight size={16} className="flex-shrink-0 transition-transform"
                            style={{ color: 'var(--accent)', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{course.course_name}</span>
                              {course.category && <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{course.category}</span>}
                              {course.in_house_external && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: course.in_house_external === 'In-house' ? '#dbeafe' : '#fef3c7', color: course.in_house_external === 'In-house' ? '#1d4ed8' : '#92400e' }}>
                                  {course.in_house_external}
                                </span>
                              )}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{course.hours_per_course} ชม. • ปี {course.year}</div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>ผู้เข้าอบรม</div>
                              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{course.total_attendees}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>อบรมแล้ว</div>
                              <div className="text-sm font-bold" style={{ color: course.completed_count > 0 ? '#16a34a' : 'var(--text-muted)' }}>{course.completed_count}</div>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {course.attendees.length === 0 ? (
                              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีผู้เข้าอบรม</div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>#</th>
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>รหัส</th>
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>ชื่อ-สกุล</th>
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>ตำแหน่ง</th>
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>แผนก</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>วันที่อบรม</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {course.attendees.map((att, ai) => {
                                      const sLabel = att.session_status === 'completed' ? 'อบรมแล้ว' : att.session_status === 'cancelled' ? 'ยกเลิก' : 'วางแผน';
                                      const sColor = att.session_status === 'completed' ? '#16a34a' : att.session_status === 'cancelled' ? '#dc2626' : 'var(--text-secondary)';
                                      const sBg = att.session_status === 'completed' ? '#f0fdf4' : att.session_status === 'cancelled' ? '#fef2f2' : 'var(--bg-secondary)';
                                      return (
                                        <tr key={ai} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-muted)' }}>{ai + 1}</td>
                                          <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{att.emp_code || '-'}</td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{att.first_name} {att.last_name}</td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-secondary)' }}>{att.position || '-'}</td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-secondary)' }}>{att.department || '-'}</td>
                                          <td className="py-2 px-4 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {att.scheduled_date_start ? new Date(att.scheduled_date_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                          </td>
                                          <td className="py-2 px-4 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: sBg, color: sColor }}>{sLabel}</span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                              รวม {course.total_attendees} คน • อบรมแล้ว {course.completed_count} คน
                              {course.total_attendees > 0 && <span> • ({Math.round((course.completed_count / course.total_attendees) * 100)}%)</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>แสดง {filteredCourses.length} / {courses.length} หลักสูตร</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ Add/Edit Employee Modal ═══ */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditingEmp(null); }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: '#1f2937' }}>{editingEmp ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h3>
                <button onClick={() => { setShowModal(false); setEditingEmp(null); }} style={{ color: '#9ca3af' }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: '#6b7280' }}>รหัสพนักงาน</label>
                  <input type="text" value={form.emp_code} onChange={e => setForm(f => ({ ...f, emp_code: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }} placeholder="เช่น EMP001" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#6b7280' }}>ชื่อ *</label>
                    <input type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }} placeholder="ชื่อ" />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#6b7280' }}>นามสกุล</label>
                    <input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }} placeholder="นามสกุล" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: '#6b7280' }}>ตำแหน่ง</label>
                  <input type="text" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }} placeholder="ตำแหน่ง" />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: '#6b7280' }}>แผนก</label>
                  <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }} placeholder="แผนก" list="dept-list" />
                  <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                {editingEmp && (
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#6b7280' }}>สถานะ</label>
                    <select value={form.employment_status} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))} style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#1f2937' }}>
                      <option value="active">ทำงาน</option>
                      <option value="resigned">ลาออก</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowModal(false); setEditingEmp(null); }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm" style={{ background: '#e5e7eb', color: '#4b5563' }}>ยกเลิก</button>
                <button onClick={handleSave} disabled={saving || !form.first_name.trim()}
                  className="btn-primary flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{ opacity: saving || !form.first_name.trim() ? 0.5 : 1 }}>
                  {saving ? 'กำลังบันทึก...' : editingEmp ? 'บันทึก' : 'เพิ่มพนักงาน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Image Preview Modal ═══ */}
        {previewImage && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center z-10"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                <X size={16} />
              </button>
              {previewImage.endsWith('.pdf') ? (
                <iframe src={previewImage} className="w-full rounded-xl" style={{ height: '80vh', border: 'none' }} />
              ) : (
                <img src={previewImage} alt="Certificate" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" style={{ background: '#fff' }} />
              )}
              <a href={previewImage} target="_blank" rel="noopener noreferrer"
                className="block text-center mt-2 text-xs underline" style={{ color: '#94a3b8' }}>
                เปิดในแท็บใหม่
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
