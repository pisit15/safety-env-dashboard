'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { Search, Upload, Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, GraduationCap, BookOpen, Users, ChevronRight, Award, Image, Calendar, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  active: { label: 'ทำงาน', color: '#16a34a', bg: '#f0fdf4' },
  resigned: { label: 'ลาออก', color: '#dc2626', bg: '#fef2f2' },
};

export default function EmployeesPage() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === companyId);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [sortCol, setSortCol] = useState<string>('first_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '', employment_status: 'active' });
  const [saving, setSaving] = useState(false);

  // Training history modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyEmp, setHistoryEmp] = useState<Employee | null>(null);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);

  // Tab: 'employees' or 'courses'
  const [activeTab, setActiveTab] = useState<'employees' | 'courses'>('employees');

  // Course search
  const [courses, setCourses] = useState<CourseWithAttendees[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [coursesFetched, setCoursesFetched] = useState(false);

  // Certificates
  const [showCerts, setShowCerts] = useState(false);
  const [certsEmp, setCertsEmp] = useState<Employee | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [certForm, setCertForm] = useState({
    certificate_name: '', issued_date: '', expiry_date: '', no_expiry: false,
    certificate_number: '', issuer: '', notes: '', image_url: '',
  });
  const [savingCert, setSavingCert] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const ca = auth.getCompanyAuth(companyId);
    if (ca.isLoggedIn || auth.isAdmin) {
      setIsLoggedIn(true);
    } else {
      const saved = sessionStorage.getItem(`auth_${companyId}`);
      if (saved) setIsLoggedIn(true);
    }
  }, [companyId, auth]);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const result = await auth.companyLogin(companyId, loginUsername, loginPassword);
      if (result.success) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(result.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch { setLoginError('เกิดข้อผิดพลาด'); }
  };

  // Fetch employees
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

  // Fetch courses with attendees
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

  // Fetch courses when switching to courses tab
  useEffect(() => {
    if (activeTab === 'courses' && !coursesFetched) {
      fetchCourses();
    }
  }, [activeTab, coursesFetched, fetchCourses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    if (!courseSearch) return courses;
    const q = courseSearch.toLowerCase();
    return courses.filter(c =>
      (c.course_name || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  // Departments
  const departments = useMemo(() =>
    Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(),
    [employees]
  );

  // Filter & sort
  const filtered = useMemo(() => {
    let list = employees;

    // Status filter
    if (filterStatus === 'active') {
      list = list.filter(e => (e.employment_status || 'active') === 'active');
    } else if (filterStatus === 'resigned') {
      list = list.filter(e => e.employment_status === 'resigned');
    }

    // Department filter
    if (filterDept) list = list.filter(e => e.department === filterDept);

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.emp_code || '').toLowerCase().includes(q) ||
        (e.first_name || '').toLowerCase().includes(q) ||
        (e.last_name || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      const aVal = (a as unknown as Record<string, string>)[sortCol] || '';
      const bVal = (b as unknown as Record<string, string>)[sortCol] || '';
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return list;
  }, [employees, search, filterDept, filterStatus, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  // Save (add/edit)
  const handleSave = async () => {
    if (!form.first_name.trim()) return;
    setSaving(true);
    try {
      if (editingEmp) {
        // Update
        await fetch('/api/training/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEmp.id, ...form }),
        });
      } else {
        // Add new
        await fetch('/api/training/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            employees: [{
              emp_code: form.emp_code,
              first_name: form.first_name,
              last_name: form.last_name,
              gender: form.gender,
              position: form.position,
              department: form.department,
            }],
          }),
        });
      }
      setShowModal(false);
      setEditingEmp(null);
      fetchEmployees();
    } catch {
      alert('บันทึกไม่สำเร็จ');
    }
    setSaving(false);
  };

  // Update status
  const handleStatusToggle = async (emp: Employee) => {
    const newStatus = (emp.employment_status || 'active') === 'active' ? 'resigned' : 'active';
    try {
      await fetch('/api/training/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, employment_status: newStatus, is_active: newStatus === 'active' }),
      });
      fetchEmployees();
    } catch { alert('อัปเดตไม่สำเร็จ'); }
  };

  // Delete
  const handleDelete = async (emp: Employee) => {
    if (!confirm(`ต้องการลบ ${emp.first_name} ${emp.last_name} ออกจากระบบ?`)) return;
    try {
      await fetch(`/api/training/employees?id=${emp.id}`, { method: 'DELETE' });
      fetchEmployees();
    } catch { alert('ลบไม่สำเร็จ'); }
  };

  // Open edit
  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm({
      emp_code: emp.emp_code || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      gender: emp.gender || '',
      position: emp.position || '',
      department: emp.department || '',
      employment_status: emp.employment_status || 'active',
    });
    setShowModal(true);
  };

  // Open add
  const openAdd = () => {
    setEditingEmp(null);
    setForm({ emp_code: '', first_name: '', last_name: '', gender: '', position: '', department: '', employment_status: 'active' });
    setShowModal(true);
  };

  // Training history
  const openHistory = async (emp: Employee) => {
    setHistoryEmp(emp);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/training/attendees?companyId=${companyId}&empCode=${emp.emp_code}`);
      const data = await res.json();
      setTrainingRecords(Array.isArray(data) ? data : []);
    } catch { setTrainingRecords([]); }
    setLoadingHistory(false);
  };

  // Excel import
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const mapped = rows.map(r => ({
        emp_code: r['รหัสพนักงาน'] || r['emp_code'] || r['Employee Code'] || r['รหัส'] || '',
        first_name: r['ชื่อ'] || r['first_name'] || r['First Name'] || r['Name'] || '',
        last_name: r['นามสกุล'] || r['last_name'] || r['Last Name'] || '',
        gender: r['เพศ'] || r['gender'] || r['Gender'] || '',
        position: r['ตำแหน่ง'] || r['position'] || r['Position'] || '',
        department: r['แผนก'] || r['department'] || r['Department'] || '',
      })).filter(r => r.first_name);

      if (mapped.length === 0) {
        alert('ไม่พบข้อมูลพนักงานในไฟล์');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/training/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, employees: mapped }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`นำเข้าสำเร็จ ${result.count} คน`);
        fetchEmployees();
      } else {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
      }
    } catch (err) {
      alert('นำเข้าไม่สำเร็จ');
    }
    setImporting(false);
  };

  // Certificate functions
  const openCerts = async (emp: Employee) => {
    setCertsEmp(emp);
    setShowCerts(true);
    setLoadingCerts(true);
    setShowCertForm(false);
    setEditingCert(null);
    setPreviewImage(null);
    try {
      // Use employeeId if available, otherwise fallback to empCode
      const queryParam = emp.id ? `employeeId=${emp.id}` : `empCode=${encodeURIComponent(emp.emp_code)}`;
      const res = await fetch(`/api/certificates?companyId=${companyId}&${queryParam}`);
      const data = await res.json();
      setCertificates(Array.isArray(data) ? data : []);
    } catch { setCertificates([]); }
    setLoadingCerts(false);
  };

  const openAddCert = () => {
    setEditingCert(null);
    setCertForm({ certificate_name: '', issued_date: '', expiry_date: '', no_expiry: false, certificate_number: '', issuer: '', notes: '', image_url: '' });
    setShowCertForm(true);
  };

  const openEditCert = (cert: Certificate) => {
    setEditingCert(cert);
    setCertForm({
      certificate_name: cert.certificate_name || '',
      issued_date: cert.issued_date || '',
      expiry_date: cert.expiry_date || '',
      no_expiry: cert.no_expiry || false,
      certificate_number: cert.certificate_number || '',
      issuer: cert.issuer || '',
      notes: cert.notes || '',
      image_url: cert.image_url || '',
    });
    setShowCertForm(true);
  };

  const handleSaveCert = async () => {
    if (!certForm.certificate_name.trim() || !certsEmp) return;
    setSavingCert(true);
    try {
      const payload = {
        ...certForm,
        company_id: companyId,
        employee_id: certsEmp.id,
        emp_code: certsEmp.emp_code,
      };
      if (editingCert) {
        await fetch('/api/certificates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCert.id, ...certForm }),
        });
      } else {
        await fetch('/api/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowCertForm(false);
      setEditingCert(null);
      // Refresh certificates list
      const queryParam = certsEmp.id ? `employeeId=${certsEmp.id}` : `empCode=${encodeURIComponent(certsEmp.emp_code)}`;
      const res = await fetch(`/api/certificates?companyId=${companyId}&${queryParam}`);
      const data = await res.json();
      setCertificates(Array.isArray(data) ? data : []);
    } catch { alert('บันทึกไม่สำเร็จ'); }
    setSavingCert(false);
  };

  const handleDeleteCert = async (cert: Certificate) => {
    if (!confirm(`ต้องการลบใบ Certificate "${cert.certificate_name}" ?`)) return;
    try {
      await fetch(`/api/certificates?id=${cert.id}`, { method: 'DELETE' });
      setCertificates(prev => prev.filter(c => c.id !== cert.id));
    } catch { alert('ลบไม่สำเร็จ'); }
  };

  const handleCertImageUpload = async (file: File) => {
    if (!certsEmp) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('employeeId', certsEmp.id);
      const res = await fetch('/api/certificates/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setCertForm(f => ({ ...f, image_url: data.url }));
      } else {
        alert(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch { alert('อัปโหลดไม่สำเร็จ'); }
    setUploadingImage(false);
  };

  const getCertExpiryStatus = (cert: Certificate) => {
    if (cert.no_expiry) return { label: 'ไม่หมดอายุ', color: '#6366f1', bg: '#eef2ff' };
    if (!cert.expiry_date) return { label: 'ไม่ระบุ', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
    const now = new Date();
    const exp = new Date(cert.expiry_date);
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'หมดอายุแล้ว', color: '#dc2626', bg: '#fef2f2' };
    if (daysLeft <= 30) return { label: `เหลือ ${daysLeft} วัน`, color: '#ea580c', bg: '#fff7ed' };
    if (daysLeft <= 90) return { label: `เหลือ ${daysLeft} วัน`, color: '#d97706', bg: '#fffbeb' };
    return { label: `เหลือ ${daysLeft} วัน`, color: '#16a34a', bg: '#f0fdf4' };
  };

  // Stats
  const activeCount = employees.filter(e => (e.employment_status || 'active') === 'active').length;
  const resignedCount = employees.filter(e => e.employment_status === 'resigned').length;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  };

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

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              👥 จัดการพนักงาน — {company?.name || companyId.toUpperCase()}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              รายชื่อพนักงาน • เพิ่ม แก้ไข และดูประวัติการอบรม
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', display: 'inline-flex' }}>
            <button
              onClick={() => setActiveTab('employees')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === 'employees' ? 'var(--card-solid)' : 'transparent',
                color: activeTab === 'employees' ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'employees' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <Users size={15} /> รายชื่อพนักงาน
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === 'courses' ? 'var(--card-solid)' : 'transparent',
                color: activeTab === 'courses' ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'courses' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <BookOpen size={15} /> ค้นหาตามหลักสูตร
            </button>
          </div>

          {activeTab === 'employees' && (<>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>พนักงานทั้งหมด</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{employees.length}</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>ทำงานอยู่</div>
              <div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{activeCount}</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>ลาออก</div>
              <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{resignedCount}</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="glass-card rounded-xl p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text" placeholder="ค้นหา รหัส ชื่อ ตำแหน่ง..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pr-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
                />
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
              <div className="flex gap-2 ml-auto">
                <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-opacity ${importing ? 'opacity-50' : ''}`}
                  style={{ background: 'var(--border)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  <Upload size={14} /> นำเข้า Excel
                  <input type="file" accept=".xlsx,.xls" hidden disabled={importing}
                    onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ''; }} />
                </label>
                <button onClick={openAdd}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium">
                  <Plus size={14} /> เพิ่มพนักงาน
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card rounded-xl overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {employees.length === 0 ? 'ยังไม่มีรายชื่อพนักงาน — กด "นำเข้า Excel" หรือ "เพิ่มพนักงาน"' : 'ไม่พบข้อมูลตามเงื่อนไข'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <th className="text-left py-3 px-3 text-xs font-semibold cursor-pointer" onClick={() => handleSort('emp_code')} style={{ color: 'var(--text-secondary)' }}>
                        รหัส{sortIcon('emp_code')}
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold cursor-pointer" onClick={() => handleSort('first_name')} style={{ color: 'var(--text-secondary)' }}>
                        ชื่อ-สกุล{sortIcon('first_name')}
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold cursor-pointer" onClick={() => handleSort('position')} style={{ color: 'var(--text-secondary)' }}>
                        ตำแหน่ง{sortIcon('position')}
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold cursor-pointer" onClick={() => handleSort('department')} style={{ color: 'var(--text-secondary)' }}>
                        แผนก{sortIcon('department')}
                      </th>
                      <th className="text-center py-3 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, i) => {
                      const status = STATUS_LABELS[emp.employment_status || 'active'] || STATUS_LABELS.active;
                      return (
                        <tr key={emp.id || i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                          className="hover:opacity-90">
                          <td className="py-2.5 px-3" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emp.emp_code || '-'}</td>
                          <td className="py-2.5 px-3" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {emp.first_name} {emp.last_name}
                          </td>
                          <td className="py-2.5 px-3" style={{ color: 'var(--text-secondary)' }}>{emp.position || '-'}</td>
                          <td className="py-2.5 px-3" style={{ color: 'var(--text-secondary)' }}>{emp.department || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
                              style={{ background: status.bg, color: status.color }}>
                              {status.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openCerts(emp)} title="ใบ Certificate"
                                className="p-1.5 rounded-lg transition-colors" style={{ color: '#6366f1' }}>
                                <Award size={15} />
                              </button>
                              <button onClick={() => openHistory(emp)} title="ประวัติอบรม"
                                className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--accent)' }}>
                                <GraduationCap size={15} />
                              </button>
                              <button onClick={() => openEdit(emp)} title="แก้ไข"
                                className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--warning)' }}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleStatusToggle(emp)}
                                title={(emp.employment_status || 'active') === 'active' ? 'เปลี่ยนเป็นลาออก' : 'เปลี่ยนเป็นทำงาน'}
                                className="p-1.5 rounded-lg transition-colors text-[11px] font-medium"
                                style={{ color: (emp.employment_status || 'active') === 'active' ? '#dc2626' : '#16a34a' }}>
                                {(emp.employment_status || 'active') === 'active' ? 'ลาออก' : 'กลับมา'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              แสดง {filtered.length} / {employees.length} คน
            </div>
          </div>
          </>)}

          {/* Course Search Tab */}
          {activeTab === 'courses' && (
            <>
              {/* Course search toolbar */}
              <div className="glass-card rounded-xl p-4 mb-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[250px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text" placeholder="ค้นหาชื่อหลักสูตร หรือหมวดหมู่..."
                      value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                      className="w-full pr-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
                    />
                  </div>
                  <button onClick={() => { setCoursesFetched(false); fetchCourses(); }}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    โหลดใหม่
                  </button>
                </div>
              </div>

              {/* Course list */}
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
                        {/* Course header row */}
                        <button
                          onClick={() => setExpandedCourse(isExpanded ? null : course.course_name)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                          style={{ background: isExpanded ? 'var(--accent-glow)' : 'transparent' }}
                        >
                          <ChevronRight
                            size={16}
                            className="flex-shrink-0 transition-transform"
                            style={{ color: 'var(--accent)', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {course.course_name}
                              </span>
                              {course.category && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                  {course.category}
                                </span>
                              )}
                              {course.in_house_external && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: course.in_house_external === 'In-house' ? '#dbeafe' : '#fef3c7', color: course.in_house_external === 'In-house' ? '#1d4ed8' : '#92400e' }}>
                                  {course.in_house_external}
                                </span>
                              )}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {course.hours_per_course} ชม. • ปี {course.year}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>ผู้เข้าอบรม</div>
                              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{course.total_attendees} คน</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>อบรมแล้ว</div>
                              <div className="text-sm font-bold" style={{ color: course.completed_count > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                                {course.completed_count} คน
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Expanded attendee list */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {course.attendees.length === 0 ? (
                              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                ยังไม่มีผู้เข้าอบรม
                              </div>
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
                                      const statusLabel = att.session_status === 'completed' ? 'อบรมแล้ว' :
                                        att.session_status === 'cancelled' ? 'ยกเลิก' : 'วางแผน';
                                      const statusColor = att.session_status === 'completed' ? '#16a34a' :
                                        att.session_status === 'cancelled' ? '#dc2626' : 'var(--text-secondary)';
                                      const statusBg = att.session_status === 'completed' ? '#f0fdf4' :
                                        att.session_status === 'cancelled' ? '#fef2f2' : 'var(--bg-secondary)';
                                      return (
                                        <tr key={ai} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-muted)' }}>{ai + 1}</td>
                                          <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{att.emp_code || '-'}</td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {att.first_name} {att.last_name}
                                          </td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-secondary)' }}>{att.position || '-'}</td>
                                          <td className="py-2 px-4" style={{ color: 'var(--text-secondary)' }}>{att.department || '-'}</td>
                                          <td className="py-2 px-4 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {att.scheduled_date_start ? new Date(att.scheduled_date_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                          </td>
                                          <td className="py-2 px-4 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
                                              style={{ background: statusBg, color: statusColor }}>
                                              {statusLabel}
                                            </span>
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
                              {course.total_attendees > 0 && (
                                <span> • ({Math.round((course.completed_count / course.total_attendees) * 100)}%)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
                    แสดง {filteredCourses.length} / {courses.length} หลักสูตร
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditingEmp(null); }}>
            <div className="glass-card rounded-2xl p-6 w-full max-w-md" style={{ backdropFilter: 'blur(40px)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingEmp ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                </h3>
                <button onClick={() => { setShowModal(false); setEditingEmp(null); }} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>รหัสพนักงาน</label>
                  <input type="text" value={form.emp_code} onChange={e => setForm(f => ({ ...f, emp_code: e.target.value }))} style={inputStyle} placeholder="เช่น EMP001" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>ชื่อ *</label>
                    <input type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} placeholder="ชื่อ" />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>นามสกุล</label>
                    <input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} placeholder="นามสกุล" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>ตำแหน่ง</label>
                  <input type="text" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={inputStyle} placeholder="ตำแหน่ง" />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>แผนก</label>
                  <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={inputStyle} placeholder="แผนก" list="dept-list" />
                  <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                {editingEmp && (
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>สถานะ</label>
                    <select value={form.employment_status} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))} style={inputStyle}>
                      <option value="active">ทำงาน</option>
                      <option value="resigned">ลาออก</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowModal(false); setEditingEmp(null); }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  ยกเลิก
                </button>
                <button onClick={handleSave} disabled={saving || !form.first_name.trim()}
                  className="btn-primary flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{ opacity: saving || !form.first_name.trim() ? 0.5 : 1 }}>
                  {saving ? 'กำลังบันทึก...' : editingEmp ? 'บันทึก' : 'เพิ่มพนักงาน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Training History Modal */}
        {showHistory && historyEmp && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowHistory(false); setHistoryEmp(null); }}>
            <div className="glass-card rounded-2xl w-full max-w-2xl flex flex-col" style={{ backdropFilter: 'blur(40px)', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      ประวัติการอบรม
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {historyEmp.first_name} {historyEmp.last_name}
                      {historyEmp.emp_code && <span> ({historyEmp.emp_code})</span>}
                      {historyEmp.position && <span> • {historyEmp.position}</span>}
                    </p>
                  </div>
                  <button onClick={() => { setShowHistory(false); setHistoryEmp(null); }} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
                </div>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                {loadingHistory ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                ) : trainingRecords.length === 0 ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีประวัติการอบรม</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        <th className="text-left py-2 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>#</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>หลักสูตร</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>ชม.</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>วันที่อบรม</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingRecords.map((rec, i) => {
                        const plan = rec.training_plans as TrainingRecord['training_plans'];
                        const session = rec.training_sessions as TrainingRecord['training_sessions'];
                        const statusLabel = session?.status === 'completed' ? 'อบรมแล้ว' :
                          session?.status === 'cancelled' ? 'ยกเลิก' : 'วางแผน';
                        const statusColor = session?.status === 'completed' ? '#16a34a' :
                          session?.status === 'cancelled' ? '#dc2626' : 'var(--text-secondary)';
                        return (
                          <tr key={rec.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="py-2 px-3 text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td className="py-2 px-3" style={{ color: 'var(--text-primary)' }}>
                              {plan?.course_name || '-'}
                              {plan?.category && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{plan.category}</span>}
                            </td>
                            <td className="py-2 px-3 text-center" style={{ color: 'var(--text-secondary)' }}>{plan?.hours_per_course || '-'}</td>
                            <td className="py-2 px-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {session?.scheduled_date_start ? new Date(session.scheduled_date_start).toLocaleDateString('th-TH') : '-'}
                            </td>
                            <td className="py-2 px-3 text-center text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {!loadingHistory && trainingRecords.length > 0 && (
                  <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    รวม {trainingRecords.length} หลักสูตร •
                    ชั่วโมงอบรมรวม {trainingRecords.reduce((sum, r) => sum + ((r.training_plans as TrainingRecord['training_plans'])?.hours_per_course || 0), 0)} ชม.
                  </div>
                )}
              </div>
              <div className="px-6 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { setShowHistory(false); setHistoryEmp(null); }}
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Certificate Modal */}
        {showCerts && certsEmp && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowCerts(false); setCertsEmp(null); setShowCertForm(false); setPreviewImage(null); }}>
            <div className="glass-card rounded-2xl w-full max-w-3xl flex flex-col" style={{ backdropFilter: 'blur(40px)', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Award size={20} style={{ color: '#6366f1' }} /> ใบ Certificate
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {certsEmp.first_name} {certsEmp.last_name}
                      {certsEmp.emp_code && <span> ({certsEmp.emp_code})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!showCertForm && (
                      <button onClick={openAddCert}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium">
                        <Plus size={13} /> เพิ่ม Certificate
                      </button>
                    )}
                    <button onClick={() => { setShowCerts(false); setCertsEmp(null); setShowCertForm(false); setPreviewImage(null); }} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1">
                {/* Certificate Form */}
                {showCertForm && (
                  <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                      {editingCert ? 'แก้ไข Certificate' : 'เพิ่ม Certificate ใหม่'}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>ชื่อ Certificate *</label>
                        <input type="text" value={certForm.certificate_name}
                          onChange={e => setCertForm(f => ({ ...f, certificate_name: e.target.value }))}
                          style={inputStyle} placeholder="เช่น จป.วิชาชีพ, ISO 45001 Lead Auditor" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>เลขที่ใบ Certificate</label>
                          <input type="text" value={certForm.certificate_number}
                            onChange={e => setCertForm(f => ({ ...f, certificate_number: e.target.value }))}
                            style={inputStyle} placeholder="เลขที่ (ถ้ามี)" />
                        </div>
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>หน่วยงานที่ออก</label>
                          <input type="text" value={certForm.issuer}
                            onChange={e => setCertForm(f => ({ ...f, issuer: e.target.value }))}
                            style={inputStyle} placeholder="เช่น กรมสวัสดิการฯ" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>วันที่ออก</label>
                          <input type="date" value={certForm.issued_date}
                            onChange={e => setCertForm(f => ({ ...f, issued_date: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        <div>
                          <label className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                            วันหมดอายุ
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={certForm.no_expiry}
                                onChange={e => setCertForm(f => ({ ...f, no_expiry: e.target.checked, expiry_date: '' }))} />
                              <span className="text-[11px]" style={{ color: '#6366f1' }}>ไม่หมดอายุ</span>
                            </label>
                          </label>
                          {!certForm.no_expiry ? (
                            <input type="date" value={certForm.expiry_date}
                              onChange={e => setCertForm(f => ({ ...f, expiry_date: e.target.value }))}
                              style={inputStyle} />
                          ) : (
                            <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: '#6366f1', fontWeight: 500 }}>
                              ใช้ได้ตลอดไป (ไม่หมดอายุ)
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                        <input type="text" value={certForm.notes}
                          onChange={e => setCertForm(f => ({ ...f, notes: e.target.value }))}
                          style={inputStyle} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
                      </div>
                      {/* Image upload */}
                      <div>
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>แนบภาพใบ Certificate</label>
                        <div className="flex items-center gap-3 mt-1">
                          <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-opacity ${uploadingImage ? 'opacity-50' : ''}`}
                            style={{ background: 'var(--border)', color: 'var(--text-primary)', border: '1px dashed var(--text-muted)' }}>
                            <Image size={14} /> {uploadingImage ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ภาพ'}
                            <input type="file" accept="image/*,.pdf" hidden disabled={uploadingImage}
                              onChange={e => { if (e.target.files?.[0]) handleCertImageUpload(e.target.files[0]); e.target.value = ''; }} />
                          </label>
                          {certForm.image_url && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: '#16a34a' }}>อัปโหลดแล้ว</span>
                              <button onClick={() => setPreviewImage(certForm.image_url)}
                                className="text-[11px] underline" style={{ color: 'var(--accent)' }}>ดูภาพ</button>
                              <button onClick={() => setCertForm(f => ({ ...f, image_url: '' }))}
                                className="text-[11px]" style={{ color: '#dc2626' }}>ลบภาพ</button>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>รองรับ JPG, PNG, WebP, PDF ขนาดไม่เกิน 10MB</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => { setShowCertForm(false); setEditingCert(null); }}
                        className="flex-1 px-4 py-2 rounded-lg text-sm"
                        style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        ยกเลิก
                      </button>
                      <button onClick={handleSaveCert} disabled={savingCert || !certForm.certificate_name.trim()}
                        className="btn-primary flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ opacity: savingCert || !certForm.certificate_name.trim() ? 0.5 : 1 }}>
                        {savingCert ? 'กำลังบันทึก...' : editingCert ? 'บันทึก' : 'เพิ่ม Certificate'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Certificate List */}
                {loadingCerts ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
                ) : certificates.length === 0 && !showCertForm ? (
                  <div className="text-center py-8">
                    <Award size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีใบ Certificate</p>
                    <button onClick={openAddCert} className="mt-2 text-xs underline" style={{ color: 'var(--accent)' }}>
                      เพิ่ม Certificate ใบแรก
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {certificates.map((cert, i) => {
                      const expiry = getCertExpiryStatus(cert);
                      const isExpired = !cert.no_expiry && cert.expiry_date && new Date(cert.expiry_date) < new Date();
                      return (
                        <div key={cert.id || i} className="rounded-xl p-4 flex items-start gap-3"
                          style={{ background: 'var(--bg-secondary)', border: `1px solid ${isExpired ? '#fecaca' : 'var(--border)'}` }}>
                          {/* Cert image thumbnail */}
                          {cert.image_url ? (
                            <button onClick={() => setPreviewImage(cert.image_url)}
                              className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden"
                              style={{ border: '1px solid var(--border)', background: '#fff' }}>
                              {cert.image_url.endsWith('.pdf') ? (
                                <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: 'var(--text-muted)' }}>PDF</div>
                              ) : (
                                <img src={cert.image_url} alt="" className="w-full h-full object-cover" />
                              )}
                            </button>
                          ) : (
                            <div className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center"
                              style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
                              <Award size={20} style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {cert.certificate_name}
                              </span>
                              {isExpired && <AlertTriangle size={13} style={{ color: '#dc2626' }} />}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {cert.certificate_number && <span>เลขที่: {cert.certificate_number}</span>}
                              {cert.issuer && <span>ออกโดย: {cert.issuer}</span>}
                              {cert.issued_date && (
                                <span>วันที่ออก: {new Date(cert.issued_date).toLocaleDateString('th-TH')}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ background: expiry.bg, color: expiry.color }}>
                                {cert.no_expiry ? 'ไม่หมดอายุ (ตลอดชีพ)' :
                                  cert.expiry_date ? `หมดอายุ: ${new Date(cert.expiry_date).toLocaleDateString('th-TH')} — ${expiry.label}` :
                                  'ไม่ระบุวันหมดอายุ'}
                              </span>
                            </div>
                            {cert.notes && (
                              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>📝 {cert.notes}</p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {cert.image_url && (
                              <button onClick={() => setPreviewImage(cert.image_url)} title="ดูภาพ"
                                className="p-1.5 rounded-lg" style={{ color: 'var(--accent)' }}>
                                <Image size={14} />
                              </button>
                            )}
                            <button onClick={() => openEditCert(cert)} title="แก้ไข"
                              className="p-1.5 rounded-lg" style={{ color: 'var(--warning)' }}>
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteCert(cert)} title="ลบ"
                              className="p-1.5 rounded-lg" style={{ color: '#dc2626' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 flex-shrink-0 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  รวม {certificates.length} ใบ
                  {certificates.filter(c => {
                    if (c.no_expiry || !c.expiry_date) return false;
                    return new Date(c.expiry_date) < new Date();
                  }).length > 0 && (
                    <span style={{ color: '#dc2626' }}>
                      {' '}• หมดอายุ {certificates.filter(c => !c.no_expiry && c.expiry_date && new Date(c.expiry_date) < new Date()).length} ใบ
                    </span>
                  )}
                </span>
                <button onClick={() => { setShowCerts(false); setCertsEmp(null); setShowCertForm(false); setPreviewImage(null); }}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
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
