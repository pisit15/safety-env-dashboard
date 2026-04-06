'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { COMPANY_GROUPS, COMPANY_BUS, CompanyGroup, CompanyBU } from '@/lib/types';

const MONTH_LABELS: Record<string, string> = {
  jan: 'ม.ค.', feb: 'ก.พ.', mar: 'มี.ค.', apr: 'เม.ย.',
  may: 'พ.ค.', jun: 'มิ.ย.', jul: 'ก.ค.', aug: 'ส.ค.',
  sep: 'ก.ย.', oct: 'ต.ค.', nov: 'พ.ย.', dec: 'ธ.ค.',
};

const ACTION_LABELS: Record<string, string> = {
  status_change: '🔄 เปลี่ยนสถานะ',
  responsible_change: '👤 เปลี่ยนผู้รับผิดชอบ',
  file_upload: '📎 อัปโหลดไฟล์',
  file_delete: '🗑️ ลบไฟล์',
  edit_request: '📝 ขอแก้ไขหลัง deadline',
};

interface AuditEntry {
  id: number; company_id: string; plan_type: string; action: string;
  activity_no: string; month: string; old_value: string; new_value: string;
  note: string; performed_by: string; created_at: string;
}

interface EditRequest {
  id: number; company_id: string; plan_type: string; activity_no: string;
  month: string; reason: string; requested_by: string; status: string;
  reviewed_by: string; reviewed_at: string; expires_at: string; created_at: string;
}

interface Deadline {
  month: string; deadline_day: number; is_active: boolean;
}

interface Credential {
  id: number; company_id: string; username: string; password: string;
  is_active: boolean; created_at: string; updated_at: string;
}

interface AdminAccount {
  id: number; username: string; password: string; display_name: string;
  role: string; is_active: boolean; created_at: string; updated_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const auth = useAuth();
  // Admin auth state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState('');
  const [currentAdminRole, setCurrentAdminRole] = useState<'super_admin' | 'admin' | 'viewer'>('viewer');

  // Tab state
  const [activeTab, setActiveTab] = useState<'companies' | 'audit' | 'deadlines' | 'requests' | 'credentials' | 'users' | 'admins' | 'dsd' | 'multicompany'>('audit');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [requestFilter, setRequestFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [deadlineEnabled, setDeadlineEnabled] = useState(true);
  const [deadlineToggleLoading, setDeadlineToggleLoading] = useState(false);

  // New credential form
  const [showNewCredForm, setShowNewCredForm] = useState(false);
  const [newCredCompanyId, setNewCredCompanyId] = useState('');
  const [newCredUsername, setNewCredUsername] = useState('');
  const [newCredPassword, setNewCredPassword] = useState('');
  const [credSaving, setCredSaving] = useState(false);

  // Edit credential
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [editCredPassword, setEditCredPassword] = useState('');

  // Admin account form
  const [showNewAdminForm, setShowNewAdminForm] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');
  const [adminSaving, setAdminSaving] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);

  // Company users state
  interface CompanyUser {
    id: number; company_id: string; username: string; password: string;
    display_name: string; is_active: boolean; created_at: string; updated_at: string;
  }
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserCompanyId, setNewUserCompanyId] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [userSaving, setUserSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserDisplayName, setEditUserDisplayName] = useState('');
  const [userFilterCompany, setUserFilterCompany] = useState('all');
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // DSD course management state
  interface DsdCourse { course_name: string; dsd_eligible: boolean; is_active: boolean; company_count: number; }
  const [dsdCourses, setDsdCourses] = useState<DsdCourse[]>([]);
  const [dsdLoading, setDsdLoading] = useState(false);
  const [dsdToggling, setDsdToggling] = useState<string | null>(null);
  const [dsdActiveToggling, setDsdActiveToggling] = useState<string | null>(null);
  const [dsdSearch, setDsdSearch] = useState('');

  // Company settings (from DB)
  interface CompanySetting {
    company_id: string; company_name: string; full_name: string; group_name: string; bu: string;
    sheet_id: string; safety_sheet: string; envi_sheet: string;
  }
  const [companySettings, setCompanySettings] = useState<CompanySetting[]>([]);
  const [settingSaving, setSettingSaving] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<string | null>(null); // company_id being edited

  // HR PIN state
  const [hrPin, setHrPin] = useState('');
  const [hrPinInput, setHrPinInput] = useState('');
  const [hrPinSaving, setHrPinSaving] = useState(false);
  const [hrPinMsg, setHrPinMsg] = useState('');

  // Multi-company access state
  interface MultiCompanyMapping {
    id: number; master_username: string; master_company_id: string;
    access_company_id: string; display_name: string; is_active: boolean;
    created_at: string; updated_at: string;
  }
  const [mcMappings, setMcMappings] = useState<MultiCompanyMapping[]>([]);
  const [mcLoading, setMcLoading] = useState(false);
  const [showNewMcForm, setShowNewMcForm] = useState(false);
  const [mcMasterCompany, setMcMasterCompany] = useState('');
  const [mcMasterUsername, setMcMasterUsername] = useState('');
  const [mcAccessCompany, setMcAccessCompany] = useState('');
  const [mcDisplayName, setMcDisplayName] = useState('');
  const [mcSaving, setMcSaving] = useState(false);
  const [mcUsersForCompany, setMcUsersForCompany] = useState<CompanyUser[]>([]);

  // Check admin session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.loggedIn) {
          setIsAdminLoggedIn(true);
          setCurrentAdminName(parsed.name || 'Admin');
          setCurrentAdminRole(parsed.role || 'admin');
        }
      } catch {
        // Legacy format: just 'true'
        if (saved === 'true') {
          setIsAdminLoggedIn(true);
          setCurrentAdminName('Admin');
          setCurrentAdminRole('admin');
        }
      }
    }
  }, []);

  const handleAdminLogin = async () => {
    setAdminLoginError('');
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminLoggedIn(true);
        setCurrentAdminName(data.adminName || 'Admin');
        setCurrentAdminRole(data.role || 'admin');
        sessionStorage.setItem('admin_auth', JSON.stringify({ loggedIn: true, name: data.adminName || 'Admin', role: data.role || 'admin' }));
        setAdminUsername(''); setAdminPassword('');
        // Full page redirect so AuthContext re-reads sessionStorage
        window.location.href = '/';
        return;
      } else {
        setAdminLoginError(data.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setAdminLoginError('เกิดข้อผิดพลาด');
    }
    setAdminLoading(false);
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setCurrentAdminName('');
    setCurrentAdminRole('viewer');
    sessionStorage.removeItem('admin_auth');
  };

  // Role-based permission helpers
  const isSuperAdmin = currentAdminRole === 'super_admin';
  const isAdmin = currentAdminRole === 'admin' || isSuperAdmin;
  const isViewer = currentAdminRole === 'viewer';

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    viewer: 'Viewer',
  };

  // Data fetchers
  const fetchAudit = useCallback(() => {
    setLoading(true);
    fetch(`/api/audit?companyId=${auditFilter}&limit=100`)
      .then(r => r.json())
      .then(d => { setAuditEntries(d.entries || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auditFilter]);

  const fetchRequests = useCallback(() => {
    fetch(`/api/edit-requests?companyId=all&status=${requestFilter}`)
      .then(r => r.json())
      .then(d => setEditRequests(d.requests || []))
      .catch(() => {});
  }, [requestFilter]);

  const fetchDeadlines = useCallback(() => {
    fetch('/api/deadlines')
      .then(r => r.json())
      .then(d => {
        setDeadlines(d.deadlines || []);
        if (d.deadlineEnabled !== undefined) setDeadlineEnabled(d.deadlineEnabled);
      })
      .catch(() => {});
    // Also fetch settings for the toggle
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings?.deadline_enabled !== undefined) {
          setDeadlineEnabled(d.settings.deadline_enabled);
        }
      })
      .catch(() => {});
  }, []);

  const fetchCredentials = useCallback(() => {
    fetch('/api/credentials')
      .then(r => r.json())
      .then(d => setCredentials(d.credentials || []))
      .catch(() => {});
  }, []);

  const fetchCompanyUsers = useCallback(() => {
    fetch('/api/company-users')
      .then(r => r.json())
      .then(d => setCompanyUsers(d.users || []))
      .catch(() => {});
  }, []);

  const fetchAdminAccounts = useCallback(() => {
    fetch('/api/admin-auth')
      .then(r => r.json())
      .then(d => setAdminAccounts(d.admins || []))
      .catch(() => {});
  }, []);

  const fetchCompanySettings = useCallback(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then(d => setCompanySettings(d.settings || []))
      .catch(() => {});
  }, []);

  const handleSettingChange = async (companyId: string, field: string, value: string) => {
    // Optimistic update
    setCompanySettings(prev => {
      const existing = prev.find(s => s.company_id === companyId);
      if (existing) {
        return prev.map(s => s.company_id === companyId ? { ...s, [field]: value } : s);
      }
      const c = COMPANIES.find(co => co.id === companyId);
      const newEntry: CompanySetting = {
        company_id: companyId, company_name: c?.name || '', full_name: c?.fullName || '', group_name: c?.group || '',
        bu: c?.bu || '', sheet_id: c?.sheetId || '', safety_sheet: c?.safetySheet || '', envi_sheet: c?.enviSheet || '',
        [field]: value,
      };
      return [...prev, newEntry];
    });
    setSettingSaving(companyId);
    try {
      await fetch('/api/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, [field]: value }),
      });
    } catch { /* ignore */ }
    setSettingSaving(null);
  };

  const getSettingValue = (companyId: string, field: keyof CompanySetting, fallback: string) => {
    const s = companySettings.find(s => s.company_id === companyId);
    if (s && s[field] !== undefined && s[field] !== null) return s[field];
    return fallback;
  };

  const fetchDsdCourses = useCallback(async () => {
    setDsdLoading(true);
    try {
      const [res, pinRes] = await Promise.all([
        fetch(`/api/training/dsd-courses?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const data = await res.json();
      if (Array.isArray(data)) setDsdCourses(data);
      const pinData = await pinRes.json();
      const pin = pinData?.settings?.hr_pin || '1234';
      setHrPin(pin);
      setHrPinInput(pin);
    } catch { /* ignore */ }
    setDsdLoading(false);
  }, []);

  const handleSaveHrPin = async () => {
    if (!hrPinInput || hrPinInput.length < 4) {
      setHrPinMsg('กรุณาใส่ PIN อย่างน้อย 4 หลัก');
      return;
    }
    setHrPinSaving(true);
    setHrPinMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hr_pin', value: hrPinInput }),
      });
      if (res.ok) {
        setHrPin(hrPinInput);
        setHrPinMsg('บันทึก PIN สำเร็จ');
        setTimeout(() => setHrPinMsg(''), 3000);
      } else {
        setHrPinMsg('เกิดข้อผิดพลาด');
      }
    } catch { setHrPinMsg('เกิดข้อผิดพลาด'); }
    setHrPinSaving(false);
  };

  const handleDsdToggle = async (courseName: string, newValue: boolean) => {
    setDsdToggling(courseName);
    try {
      const res = await fetch('/api/training/dsd-toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_name: courseName, dsd_eligible: newValue }),
      });
      if (res.ok) {
        // Optimistic UI update — change state immediately
        setDsdCourses(prev => prev.map(c =>
          c.course_name === courseName ? { ...c, dsd_eligible: newValue } : c
        ));
      } else {
        alert('บันทึกไม่สำเร็จ');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setDsdToggling(null);
  };

  const handleActiveToggle = async (courseName: string, newValue: boolean) => {
    setDsdActiveToggling(courseName);
    try {
      const res = await fetch('/api/training/dsd-toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_name: courseName, is_active: newValue }),
      });
      if (res.ok) {
        setDsdCourses(prev => prev.map(c =>
          c.course_name === courseName ? { ...c, is_active: newValue } : c
        ));
      } else {
        alert('บันทึกไม่สำเร็จ');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setDsdActiveToggling(null);
  };

  // Fetch multi-company access mappings
  const fetchMcMappings = useCallback(async () => {
    setMcLoading(true);
    try {
      const res = await fetch('/api/user-company-access');
      const data = await res.json();
      setMcMappings(data.mappings || []);
    } catch { /* ignore */ }
    setMcLoading(false);
  }, []);

  // Fetch users for a specific company (for username dropdown)
  const fetchMcUsers = async (companyId: string) => {
    if (!companyId) { setMcUsersForCompany([]); return; }
    try {
      const res = await fetch(`/api/company-users?companyId=${companyId}`);
      const data = await res.json();
      setMcUsersForCompany(data.users || []);
    } catch { setMcUsersForCompany([]); }
  };

  const handleAddMcMapping = async () => {
    if (!mcMasterCompany || !mcMasterUsername || !mcAccessCompany) return;
    setMcSaving(true);
    try {
      const res = await fetch('/api/user-company-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterUsername: mcMasterUsername,
          masterCompanyId: mcMasterCompany,
          accessCompanyId: mcAccessCompany,
          displayName: mcDisplayName || mcMasterUsername,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewMcForm(false);
        setMcMasterCompany(''); setMcMasterUsername(''); setMcAccessCompany(''); setMcDisplayName('');
        fetchMcMappings();
      } else {
        alert(data.error || 'เพิ่มไม่สำเร็จ');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setMcSaving(false);
  };

  const handleDeleteMcMapping = async (id: number) => {
    if (!confirm('ลบสิทธิ์เข้าถึงนี้?')) return;
    try {
      await fetch(`/api/user-company-access?id=${id}`, { method: 'DELETE' });
      fetchMcMappings();
    } catch { alert('เกิดข้อผิดพลาด'); }
  };

  useEffect(() => {
    if (!isAdminLoggedIn) return;
    if (activeTab === 'audit') fetchAudit();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'deadlines') fetchDeadlines();
    if (activeTab === 'credentials') fetchCredentials();
    if (activeTab === 'users') fetchCompanyUsers();
    if (activeTab === 'admins') fetchAdminAccounts();
    if (activeTab === 'dsd') fetchDsdCourses();
    if (activeTab === 'companies') fetchCompanySettings();
    if (activeTab === 'multicompany') fetchMcMappings();
  }, [activeTab, isAdminLoggedIn, fetchAudit, fetchRequests, fetchDeadlines, fetchCredentials, fetchCompanyUsers, fetchAdminAccounts, fetchDsdCourses, fetchCompanySettings, fetchMcMappings]);

  const handleApproveReject = async (id: number, status: 'approved' | 'rejected') => {
    await fetch('/api/edit-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, reviewedBy: 'admin' }),
    });
    fetchRequests();
  };

  const handleDeadlineUpdate = async (month: string, day: number) => {
    await fetch('/api/deadlines', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, deadlineDay: day }),
    });
    fetchDeadlines();
  };

  const handleDeadlineToggle = async () => {
    setDeadlineToggleLoading(true);
    const newValue = !deadlineEnabled;
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'deadline_enabled', value: newValue }),
      });
      setDeadlineEnabled(newValue);
    } catch {
      // revert on error
    }
    setDeadlineToggleLoading(false);
  };

  // Credential CRUD
  const handleCreateCredential = async () => {
    if (!newCredCompanyId || !newCredUsername || !newCredPassword) return;
    setCredSaving(true);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: newCredCompanyId, username: newCredUsername, password: newCredPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewCredForm(false);
        setNewCredCompanyId(''); setNewCredUsername(''); setNewCredPassword('');
        fetchCredentials();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setCredSaving(false);
  };

  const handleUpdatePassword = async (companyId: string) => {
    if (!editCredPassword.trim()) return;
    setCredSaving(true);
    try {
      await fetch('/api/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, password: editCredPassword }),
      });
      setEditingCredId(null); setEditCredPassword('');
      fetchCredentials();
    } catch { alert('เกิดข้อผิดพลาด'); }
    setCredSaving(false);
  };

  const handleToggleActive = async (companyId: string, currentActive: boolean) => {
    await fetch('/api/credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, isActive: !currentActive }),
    });
    fetchCredentials();
  };

  const handleDeleteCredential = async (companyId: string) => {
    if (!confirm(`ลบบัญชี ${companyId.toUpperCase()} จริงหรือ?`)) return;
    await fetch(`/api/credentials?companyId=${companyId}`, { method: 'DELETE' });
    fetchCredentials();
  };

  // Admin account CRUD
  const handleCreateAdmin = async () => {
    if (!newAdminUsername || !newAdminPassword) return;
    setAdminSaving(true);
    try {
      const res = await fetch('/api/admin-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername,
          password: newAdminPassword,
          displayName: newAdminDisplayName || newAdminUsername,
          role: newAdminRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewAdminForm(false);
        setNewAdminUsername(''); setNewAdminPassword(''); setNewAdminDisplayName(''); setNewAdminRole('admin');
        fetchAdminAccounts();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch { alert('เกิดข้อผิดพลาด'); }
    setAdminSaving(false);
  };

  const handleToggleAdminActive = async (id: number, currentActive: boolean) => {
    await fetch('/api/admin-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !currentActive }),
    });
    fetchAdminAccounts();
  };

  const handleUpdateAdminPassword = async (id: number) => {
    if (!editAdminPassword.trim()) return;
    await fetch('/api/admin-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: editAdminPassword }),
    });
    setEditingAdminId(null); setEditAdminPassword('');
    fetchAdminAccounts();
  };

  const handleDeleteAdmin = async (id: number, name: string) => {
    if (!confirm(`ลบบัญชี Admin "${name}" จริงหรือ?`)) return;
    await fetch(`/api/admin-auth?id=${id}`, { method: 'DELETE' });
    fetchAdminAccounts();
  };

  const activeCompanies = COMPANIES;
  const existingCredCompanyIds = credentials.map(c => c.company_id);
  const availableCompaniesForCred = COMPANIES.filter(c => !existingCredCompanyIds.includes(c.id));

  // Password visibility & Caps Lock state
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Admin Login Screen — no sidebar, centered auth layout
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        {/* Minimal top bar */}
        <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--card-solid)' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <img src="/ea-logo.svg" alt="EA" style={{ height: 24 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Safety & Environment</span>
            </Link>
            <Link href="/" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              &larr; กลับหน้าผู้ใช้งาน
            </Link>
          </div>
        </header>

        {/* Centered login card */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            {/* Header section */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
                boxShadow: '0 4px 14px rgba(255,149,0,0.3)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                เข้าสู่ระบบผู้ดูแล
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                ดูภาพรวม จัดการข้อมูล และตั้งค่าระบบทั้งกลุ่ม EA
              </p>
            </div>

            {/* Login card */}
            <div style={{
              background: 'var(--card-solid)', borderRadius: 16, padding: 28,
              border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}>
              {/* Username field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  ชื่อผู้ใช้
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 13,
                    border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#ff9500')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  autoFocus
                />
              </div>

              {/* Password field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  รหัสผ่าน
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    onKeyDown={e => {
                      setCapsLock(e.getModifierState('CapsLock'));
                      if (e.key === 'Enter') handleAdminLogin();
                    }}
                    onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                    placeholder="กรอกรหัสผ่าน"
                    style={{
                      width: '100%', padding: '11px 42px 11px 14px', borderRadius: 10, fontSize: 13,
                      border: `1.5px solid ${adminLoginError ? '#dc2626' : 'var(--border)'}`, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { if (!adminLoginError) e.target.style.borderColor = '#ff9500'; }}
                    onBlur={e => { if (!adminLoginError) e.target.style.borderColor = 'var(--border)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowPassword(!showPassword); passwordRef.current?.focus(); }}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
                {capsLock && (
                  <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Caps Lock เปิดอยู่
                  </p>
                )}
              </div>

              {/* Error message */}
              {adminLoginError && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  {adminLoginError}
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none',
                  fontSize: 14, fontWeight: 700, cursor: adminPassword ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.2s',
                  background: adminPassword ? 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)' : 'var(--border)',
                  color: adminPassword ? '#fff' : 'var(--text-secondary)',
                  opacity: adminLoading ? 0.7 : 1,
                  boxShadow: adminPassword ? '0 4px 14px rgba(255,149,0,0.3)' : 'none',
                }}
              >
                {adminLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
                )}
                {adminLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>

            {/* Trust cues + Help */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                สำหรับผู้ดูแลระบบที่ได้รับสิทธิ์เท่านั้น
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                เข้าสู่ระบบไม่ได้? ติดต่อ <a href="mailto:pisit15@gmail.com" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>ฝ่าย Safety</a>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="flex items-center gap-2 text-[11px] mb-1">
          <span style={{ color: 'var(--text-secondary)' }}>Home</span><span style={{ color: 'var(--text-secondary)' }}>/</span><span style={{ color: 'var(--text-primary)' }}>Admin / ตั้งค่า</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
          <div className="flex items-center gap-3">
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>เข้าสู่ระบบเป็น: <span style={{ color: 'var(--text-primary)', fontWeight: 'medium' }}>{currentAdminName}</span></span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
              background: isSuperAdmin ? 'rgba(191,90,242,0.2)' :
                isViewer ? 'var(--bg-tertiary)' :
                'rgba(10,132,255,0.2)',
              color: isSuperAdmin ? '#bf5af2' :
                isViewer ? 'var(--muted)' :
                '#0a84ff'
            }}>{ROLE_LABELS[currentAdminRole] || currentAdminRole}</span>
            <button
              onClick={handleAdminLogout}
              className="px-3 py-1.5 text-[13px] rounded-[10px]" style={{ color: 'var(--text-secondary)', border: 'var(--border) 1px solid' }}
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Tabs — filtered by role */}
        <div className="flex gap-2 mb-6 flex-wrap" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '6px', width: 'fit-content' }}>
          {[
            { key: 'audit', label: 'ประวัติการแก้ไข', minRole: 'viewer' },
            { key: 'requests', label: 'คำขอแก้ไข', minRole: 'viewer' },
            { key: 'deadlines', label: 'กำหนด Deadline', minRole: 'admin' },
            { key: 'users', label: 'ผู้ใช้บริษัท', minRole: 'super_admin' },
            { key: 'admins', label: 'จัดการ Admin', minRole: 'super_admin' },
            { key: 'dsd', label: 'กรมพัฒน์ฯ', minRole: 'admin' },
            { key: 'multicompany', label: 'Multi-Company', minRole: 'super_admin' },
            { key: 'companies', label: 'บริษัท', minRole: 'viewer' },
          ].filter(tab => {
            if (tab.minRole === 'viewer') return true;
            if (tab.minRole === 'admin') return isAdmin;
            if (tab.minRole === 'super_admin') return isSuperAdmin;
            return false;
          }).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className="px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors"
              style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              {tab.label}
              {tab.key === 'requests' && editRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--danger)', color: 'var(--text-primary)' }}>
                  {editRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* AUDIT LOG TAB */}
        {activeTab === 'audit' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>ประวัติการแก้ไขทั้งหมด</h3>
              </div>
              <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)} className="bg-transparent border rounded-xl px-3 py-1.5 text-[11px]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <option value="all">ทุกบริษัท</option>
                {activeCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {loading ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</p>
            ) : auditEntries.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีประวัติการแก้ไข</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="apple-table w-full text-[11px]">
                  <thead>
                    <tr style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>เวลา</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>บริษัท</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>การดำเนินการ</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>กิจกรรม</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>เดือน</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>ค่าเดิม → ค่าใหม่</th>
                      <th className="text-left py-2 px-2" style={{ color: 'var(--text-secondary)' }}>ผู้ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map(entry => (
                      <tr key={entry.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px' }} className="hover:bg-white/5">
                        <td className="py-2 px-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{new Date(entry.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-2 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{entry.company_id.toUpperCase()}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{ACTION_LABELS[entry.action] || entry.action}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{entry.activity_no}</td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{MONTH_LABELS[entry.month] || entry.month}</td>
                        <td className="py-2 px-2">
                          {entry.old_value && <span style={{ color: 'var(--danger)' }}>{entry.old_value}</span>}
                          {entry.old_value && entry.new_value && <span style={{ color: 'var(--border)' }}> → </span>}
                          {entry.new_value && <span style={{ color: 'var(--success)' }}>{entry.new_value}</span>}
                        </td>
                        <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{entry.performed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* EDIT REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>คำขอแก้ไขหลัง Deadline</h3>
              </div>
              <select value={requestFilter} onChange={e => setRequestFilter(e.target.value)} className="bg-transparent border rounded-xl px-3 py-1.5 text-[11px]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <option value="pending">รอการอนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ปฏิเสธ</option>
                <option value="all">ทั้งหมด</option>
              </select>
            </div>
            {editRequests.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-secondary)' }}>ไม่มีคำขอ</p>
            ) : (
              <div className="space-y-3">
                {editRequests.map(req => (
                  <div key={req.id} className="rounded-xl p-4" style={{
                    border: req.status === 'pending' ? '1px solid rgba(255,159,10,0.3)' : req.status === 'approved' ? '1px solid rgba(48,209,88,0.3)' : '1px solid rgba(255,69,58,0.3)',
                    background: req.status === 'pending' ? 'rgba(255,159,10,0.05)' : req.status === 'approved' ? 'rgba(48,209,88,0.05)' : 'rgba(255,69,58,0.05)'
                  }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-[13px]" style={{ color: 'var(--text-primary)' }}>{req.company_id.toUpperCase()}</span>
                          <span style={{ color: 'var(--border)' }} className="text-[11px]">|</span>
                          <span style={{ color: 'var(--text-secondary)' }} className="text-[11px]">กิจกรรม {req.activity_no}</span>
                          <span style={{ color: 'var(--border)' }} className="text-[11px]">|</span>
                          <span style={{ color: 'var(--text-secondary)' }} className="text-[11px]">{MONTH_LABELS[req.month] || req.month}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                            background: req.status === 'pending' ? 'rgba(255,159,10,0.2)' : req.status === 'approved' ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)',
                            color: req.status === 'pending' ? '#ff9f0a' : req.status === 'approved' ? '#30d158' : '#ff453a'
                          }}>
                            {req.status === 'pending' ? 'รอการอนุมัติ' : req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                          </span>
                        </div>
                        <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>เหตุผล: {req.reason}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                          โดย {req.requested_by} | {new Date(req.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          {req.reviewed_at && ` | ตรวจสอบโดย ${req.reviewed_by} เมื่อ ${new Date(req.reviewed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`}
                        </p>
                      </div>
                      {req.status === 'pending' && isAdmin && (
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => handleApproveReject(req.id, 'approved')} className="px-3 py-1.5 text-[11px] rounded-[10px]" style={{ background: 'var(--success)', color: 'var(--text-primary)' }}>อนุมัติ</button>
                          <button onClick={() => handleApproveReject(req.id, 'rejected')} className="px-3 py-1.5 text-[11px] rounded-[10px]" style={{ background: 'var(--danger)', color: 'var(--text-primary)' }}>ปฏิเสธ</button>
                        </div>
                      )}
                      {req.status === 'pending' && isViewer && (
                        <span className="text-[10px] ml-4" style={{ color: 'var(--muted)' }}>ดูอย่างเดียว</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEADLINES TAB */}
        {activeTab === 'deadlines' && (
          <div className="glass-card p-5 animate-fade-in-up">
            {/* Global Toggle */}
            <div className="flex items-center justify-between mb-5 p-4 rounded-xl" style={{ background: deadlineEnabled ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.08)', border: `1px solid ${deadlineEnabled ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    ระบบ Deadline
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{
                    background: deadlineEnabled ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
                    color: deadlineEnabled ? '#30d158' : '#ff453a'
                  }}>
                    {deadlineEnabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                  </span>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                  {deadlineEnabled
                    ? 'ระบบ deadline ทำงานอยู่ — บริษัทไม่สามารถแก้ไขข้อมูลหลังเส้นตายได้'
                    : 'ระบบ deadline ปิดอยู่ — บริษัททุกแห่งสามารถแก้ไขข้อมูลย้อนหลังได้ทุกเดือน'}
                </p>
              </div>
              <button
                onClick={handleDeadlineToggle}
                disabled={deadlineToggleLoading}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none"
                style={{ background: deadlineEnabled ? '#30d158' : '#636366' }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300"
                  style={{ transform: deadlineEnabled ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>กำหนดเส้นตายการแก้ไขรายเดือน</h3>
            </div>
            <p className="text-[11px] mb-4" style={{ color: 'var(--muted)' }}>
              กำหนดว่าแต่ละเดือนสามารถ update สถานะได้ภายในวันที่เท่าไรของเดือนถัดไป
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" style={{ opacity: deadlineEnabled ? 1 : 0.4, pointerEvents: deadlineEnabled ? 'auto' : 'none' }}>
              {deadlines.map(d => (
                <div key={d.month} className="rounded-xl p-3" style={{ border: 'var(--border) 1px solid', background: 'var(--bg-secondary)' }}>
                  <div className="text-[13px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{MONTH_LABELS[d.month]}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>วันที่</span>
                    <select value={d.deadline_day} onChange={e => handleDeadlineUpdate(d.month, parseInt(e.target.value))} className="bg-transparent border rounded-lg px-2 py-1 text-[11px] flex-1" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>ของเดือนถัดไป</span>
                  </div>
                </div>
              ))}
            </div>
            {deadlines.length === 0 && <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีข้อมูล deadline</p>}
          </div>
        )}

        {/* CREDENTIALS TAB */}
        {activeTab === 'credentials' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>จัดการบัญชีบริษัท</h3>
              </div>
              <button
                onClick={() => setShowNewCredForm(!showNewCredForm)}
                className="px-3 py-1.5 text-[11px] rounded-[10px]"
                style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
              >
                + เพิ่มบัญชีใหม่
              </button>
            </div>

            {/* New credential form */}
            {showNewCredForm && (
              <div className="rounded-xl p-4 mb-4" style={{ border: 'var(--border) 1px solid', background: 'var(--bg-secondary)' }}>
                <h4 className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>สร้างบัญชีบริษัทใหม่</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>เลือกบริษัท</label>
                    <select
                      value={newCredCompanyId}
                      onChange={e => {
                        setNewCredCompanyId(e.target.value);
                        if (!newCredUsername) setNewCredUsername(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    >
                      <option value="">-- เลือกบริษัท --</option>
                      {availableCompaniesForCred.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Username</label>
                    <input
                      type="text" value={newCredUsername}
                      onChange={e => setNewCredUsername(e.target.value)}
                      placeholder="ชื่อผู้ใช้"
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Password</label>
                    <input
                      type="text" value={newCredPassword}
                      onChange={e => setNewCredPassword(e.target.value)}
                      placeholder="รหัสผ่าน"
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateCredential} disabled={credSaving || !newCredCompanyId || !newCredUsername || !newCredPassword}
                    className="px-4 py-2 text-[13px] rounded-[10px] disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                  >
                    {credSaving ? 'กำลังบันทึก...' : 'สร้างบัญชี'}
                  </button>
                  <button onClick={() => setShowNewCredForm(false)} className="px-4 py-2 text-[13px] rounded-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {/* Credentials table */}
            {credentials.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีบัญชีบริษัท — กรุณา run SQL migration สร้างตาราง company_credentials ก่อน</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="apple-table w-full text-[11px]">
                  <thead>
                    <tr style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Company ID</th>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Username</th>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Password</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(cred => (
                      <tr key={cred.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px' }} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-medium" style={{ color: 'var(--text-primary)' }}>{cred.company_id.toUpperCase()}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{cred.username}</td>
                        <td className="py-3 px-3">
                          {editingCredId === cred.company_id ? (
                            <div className="flex items-center gap-2">
                              <input type="text" value={editCredPassword}
                                onChange={e => setEditCredPassword(e.target.value)}
                                className="px-2 py-1 bg-transparent border rounded text-[11px] w-32 focus:outline-none" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                                autoFocus
                              />
                              <button onClick={() => handleUpdatePassword(cred.company_id)} disabled={credSaving}
                                className="text-[11px]" style={{ color: 'var(--success)' }}>บันทึก</button>
                              <button onClick={() => { setEditingCredId(null); setEditCredPassword(''); }}
                                className="text-[11px]" style={{ color: 'var(--muted)' }}>ยกเลิก</button>
                            </div>
                          ) : (
                            <code className="text-[11px]" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                              <span className="px-2 py-0.5 rounded">{cred.password}</span>
                            </code>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => handleToggleActive(cred.company_id, cred.is_active)}
                            className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer" style={{
                              background: cred.is_active ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)',
                              color: cred.is_active ? '#30d158' : '#ff453a'
                            }}>
                            {cred.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingCredId(cred.company_id); setEditCredPassword(cred.password); }}
                              className="text-[11px]" style={{ color: 'var(--accent)' }}>แก้ไขรหัส</button>
                            <button onClick={() => handleDeleteCredential(cred.company_id)}
                              className="text-[11px]" style={{ color: 'var(--danger)' }}>ลบ</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COMPANY USERS TAB */}
        {activeTab === 'users' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>จัดการผู้ใช้บริษัท (Multi-User)</h3>
              </div>
              <div className="flex items-center gap-2">
                <select value={userFilterCompany} onChange={e => setUserFilterCompany(e.target.value)}
                  className="text-[11px] px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="all">ทุกบริษัท</option>
                  {COMPANIES.map(c => (
                    <option key={c.id} value={c.id}>{c.shortName}</option>
                  ))}
                </select>
                <button onClick={() => setShowNewUserForm(!showNewUserForm)}
                  className="btn-primary text-[11px] px-3 py-1.5 rounded-lg font-medium">
                  + เพิ่มผู้ใช้
                </button>
              </div>
            </div>

            {/* New user form */}
            {showNewUserForm && (
              <div className="rounded-xl p-4 mb-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <select value={newUserCompanyId} onChange={e => setNewUserCompanyId(e.target.value)}
                    className="text-[11px] px-2 py-2 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">เลือกบริษัท...</option>
                    {COMPANIES.map(c => (
                      <option key={c.id} value={c.id}>{c.shortName}</option>
                    ))}
                  </select>
                  <input type="text" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)}
                    placeholder="Username" className="text-[11px] px-2 py-2 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <input type="text" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                    placeholder="Password" className="text-[11px] px-2 py-2 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <input type="text" value={newUserDisplayName} onChange={e => setNewUserDisplayName(e.target.value)}
                    placeholder="ชื่อแสดง (Display Name)" className="text-[11px] px-2 py-2 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <button disabled={userSaving || !newUserCompanyId || !newUserUsername || !newUserPassword}
                    onClick={async () => {
                      setUserSaving(true);
                      const res = await fetch('/api/company-users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: newUserCompanyId, username: newUserUsername, password: newUserPassword, displayName: newUserDisplayName || newUserUsername }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setShowNewUserForm(false);
                        setNewUserCompanyId(''); setNewUserUsername(''); setNewUserPassword(''); setNewUserDisplayName('');
                        fetchCompanyUsers();
                      } else {
                        alert(d.error || 'เกิดข้อผิดพลาด');
                      }
                      setUserSaving(false);
                    }}
                    className="btn-primary text-[11px] px-3 py-2 rounded-lg font-medium">
                    {userSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>
            )}

            {/* Users table */}
            {companyUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีผู้ใช้ — กรุณา run SQL migration สร้างตาราง company_users ก่อน</p>
                <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>หรือกด &quot;+ เพิ่มผู้ใช้&quot; เพื่อสร้าง</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="apple-table">
                  <thead>
                    <tr>
                      <th className="py-2 px-3 text-left text-[11px]">บริษัท</th>
                      <th className="py-2 px-3 text-left text-[11px]">Username</th>
                      <th className="py-2 px-3 text-left text-[11px]">ชื่อแสดง</th>
                      <th className="py-2 px-3 text-left text-[11px]">Password</th>
                      <th className="py-2 px-3 text-center text-[11px]">สถานะ</th>
                      <th className="py-2 px-3 text-center text-[11px]">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyUsers
                      .filter(u => userFilterCompany === 'all' || u.company_id === userFilterCompany)
                      .map(u => (
                      <tr key={u.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px' }} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-medium text-[12px]" style={{ color: 'var(--text-primary)' }}>{u.company_id.toUpperCase()}</td>
                        <td className="py-3 px-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{u.username}</td>
                        <td className="py-3 px-3 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                          {editingUserId === u.id ? (
                            <input type="text" value={editUserDisplayName} onChange={e => setEditUserDisplayName(e.target.value)}
                              className="px-2 py-1 bg-transparent border rounded text-[11px] w-28" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                          ) : u.display_name}
                        </td>
                        <td className="py-3 px-3 text-[12px]">
                          {editingUserId === u.id ? (
                            <input type="text" value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)}
                              className="px-2 py-1 bg-transparent border rounded text-[11px] w-28" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                          ) : (
                            <code className="text-[11px] px-2 py-0.5 rounded" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>{u.password}</code>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={async () => {
                            await fetch('/api/company-users', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: u.id, isActive: !u.is_active }),
                            });
                            fetchCompanyUsers();
                          }}
                            className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer" style={{
                              background: u.is_active ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)',
                              color: u.is_active ? '#30d158' : '#ff453a'
                            }}>
                            {u.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {editingUserId === u.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={async () => {
                                await fetch('/api/company-users', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: u.id, password: editUserPassword, displayName: editUserDisplayName }),
                                });
                                setEditingUserId(null);
                                fetchCompanyUsers();
                              }} className="text-[11px]" style={{ color: 'var(--success)' }}>บันทึก</button>
                              <button onClick={() => setEditingUserId(null)} className="text-[11px]" style={{ color: 'var(--muted)' }}>ยกเลิก</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => { setEditingUserId(u.id); setEditUserPassword(u.password); setEditUserDisplayName(u.display_name); }}
                                className="text-[11px]" style={{ color: 'var(--accent)' }}>แก้ไข</button>
                              <button onClick={async () => {
                                if (!confirm(`ลบผู้ใช้ "${u.display_name}" (${u.username}) จริงหรือ?`)) return;
                                await fetch(`/api/company-users?id=${u.id}`, { method: 'DELETE' });
                                fetchCompanyUsers();
                              }} className="text-[11px]" style={{ color: 'var(--danger)' }}>ลบ</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 flex gap-4 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span>รวม {companyUsers.filter(u => userFilterCompany === 'all' || u.company_id === userFilterCompany).length} ผู้ใช้</span>
              {userFilterCompany === 'all' && (
                <span>({Array.from(new Set(companyUsers.map(u => u.company_id))).length} บริษัท)</span>
              )}
            </div>
          </div>
        )}

        {/* ADMIN ACCOUNTS TAB */}
        {activeTab === 'admins' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>จัดการบัญชี Admin</h3>
              </div>
              <button
                onClick={() => setShowNewAdminForm(!showNewAdminForm)}
                className="px-3 py-1.5 text-[11px] rounded-[10px]"
                style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
              >
                + เพิ่ม Admin ใหม่
              </button>
            </div>

            {showNewAdminForm && (
              <div className="rounded-xl p-4 mb-4" style={{ border: 'var(--border) 1px solid', background: 'var(--bg-secondary)' }}>
                <h4 className="text-[13px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>สร้างบัญชี Admin ใหม่</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Username</label>
                    <input type="text" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)}
                      placeholder="ชื่อผู้ใช้"
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Password</label>
                    <input type="text" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)}
                      placeholder="รหัสผ่าน"
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>ชื่อที่แสดง</label>
                    <input type="text" value={newAdminDisplayName} onChange={e => setNewAdminDisplayName(e.target.value)}
                      placeholder="เช่น จป.วิชาชีพ สมชาย"
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>สิทธิ์</label>
                    <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent border rounded-lg text-[13px] focus:outline-none mt-1 transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="viewer">Viewer (ดูอย่างเดียว)</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateAdmin} disabled={adminSaving || !newAdminUsername || !newAdminPassword}
                    className="px-4 py-2 text-[13px] rounded-[10px] disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                  >
                    {adminSaving ? 'กำลังบันทึก...' : 'สร้างบัญชี Admin'}
                  </button>
                  <button onClick={() => setShowNewAdminForm(false)}
                    className="px-4 py-2 text-[13px] rounded-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>ยกเลิก</button>
                </div>
              </div>
            )}

            {adminAccounts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] mb-2" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีบัญชี Admin ในระบบ</p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>ระบบใช้ fallback password จาก environment variable (ADMIN_PASSWORD) อยู่</p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>เมื่อเพิ่มบัญชี Admin แรก ระบบจะเปลี่ยนไปใช้บัญชีจาก database แทน</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="apple-table w-full text-[11px]">
                  <thead>
                    <tr style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Username</th>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>ชื่อที่แสดง</th>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Password</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>สิทธิ์</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminAccounts.map(admin => (
                      <tr key={admin.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px' }} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-medium" style={{ color: 'var(--text-primary)' }}>{admin.username}</td>
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{admin.display_name}</td>
                        <td className="py-3 px-3">
                          {editingAdminId === admin.id ? (
                            <div className="flex items-center gap-2">
                              <input type="text" value={editAdminPassword}
                                onChange={e => setEditAdminPassword(e.target.value)}
                                className="px-2 py-1 bg-transparent border rounded text-[11px] w-32 focus:outline-none" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                                autoFocus />
                              <button onClick={() => handleUpdateAdminPassword(admin.id)}
                                className="text-[11px]" style={{ color: 'var(--success)' }}>บันทึก</button>
                              <button onClick={() => { setEditingAdminId(null); setEditAdminPassword(''); }}
                                className="text-[11px]" style={{ color: 'var(--muted)' }}>ยกเลิก</button>
                            </div>
                          ) : (
                            <code className="text-[11px]" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                              <span className="px-2 py-0.5 rounded">{admin.password}</span>
                            </code>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{
                            background: admin.role === 'super_admin' ? 'rgba(191,90,242,0.2)' : admin.role === 'viewer' ? 'var(--bg-tertiary)' : 'rgba(10,132,255,0.2)',
                            color: admin.role === 'super_admin' ? '#bf5af2' : admin.role === 'viewer' ? 'var(--muted)' : '#0a84ff'
                          }}>
                            {admin.role === 'super_admin' ? 'Super Admin' : admin.role === 'viewer' ? 'Viewer' : 'Admin'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => handleToggleAdminActive(admin.id, admin.is_active)}
                            className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer" style={{
                              background: admin.is_active ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)',
                              color: admin.is_active ? '#30d158' : '#ff453a'
                            }}>
                            {admin.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingAdminId(admin.id); setEditAdminPassword(admin.password); }}
                              className="text-[11px]" style={{ color: 'var(--accent)' }}>แก้ไขรหัส</button>
                            <button onClick={() => handleDeleteAdmin(admin.id, admin.display_name)}
                              className="text-[11px]" style={{ color: 'var(--danger)' }}>ลบ</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COMPANIES TAB */}
        {/* DSD COURSE MANAGEMENT TAB */}
        {activeTab === 'dsd' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>จัดการหลักสูตรที่ส่งกรมพัฒนาฝีมือแรงงานได้</h3>
            </div>
            <p className="text-[11px] mb-4" style={{ color: 'var(--text-secondary)' }}>
              จัดการหลักสูตร — เปิด/ปิด badge &quot;ส่งกรมพัฒน์ได้&quot; หรือ นำออก/นำเข้าแผนอบรมประจำปี ของทุกบริษัทพร้อมกัน
            </p>

            {/* HR PIN Setting */}
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 14 }}>🔑</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>รหัส PIN สำหรับ HR</span>
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>— HR ใช้รหัสนี้ในการอัปเดตสถานะกรมพัฒน์ฯ ในหน้าติดตามหลักสูตร</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={hrPinInput}
                  onChange={e => setHrPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="ใส่ PIN 4-6 หลัก"
                  className="px-3 py-1.5 rounded-lg text-[13px] font-mono tracking-widest"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 140, textAlign: 'center', letterSpacing: '0.3em' }}
                />
                <button
                  onClick={handleSaveHrPin}
                  disabled={hrPinSaving || hrPinInput === hrPin}
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
                  style={{
                    background: hrPinInput !== hrPin ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: hrPinInput !== hrPin ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: hrPinInput !== hrPin ? 'pointer' : 'default',
                    opacity: hrPinSaving ? 0.5 : 1,
                  }}
                >
                  {hrPinSaving ? 'กำลังบันทึก...' : 'บันทึก PIN'}
                </button>
                {hrPinMsg && (
                  <span className="text-[11px] font-medium" style={{ color: hrPinMsg.includes('สำเร็จ') ? '#16a34a' : '#dc2626' }}>
                    {hrPinMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="🔍 ค้นหาชื่อหลักสูตร..."
              value={dsdSearch}
              onChange={e => setDsdSearch(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />

            {dsdLoading ? (
              <div className="text-center py-8 text-[12px]" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="apple-table w-full text-[11px]">
                  <thead>
                    <tr style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>#</th>
                      <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)', minWidth: 300 }}>ชื่อหลักสูตร</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>จำนวนบริษัท</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>อยู่ในแผน</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>ส่งกรมพัฒน์ได้</th>
                      <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsdCourses
                      .filter(c => !dsdSearch || c.course_name.toLowerCase().includes(dsdSearch.toLowerCase()))
                      .map((course, i) => (
                      <tr key={course.course_name} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px', opacity: course.is_active === false ? 0.5 : 1, background: course.is_active === false ? '#fefce8' : undefined }} className="hover:bg-white/5">
                        <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{i + 1}</td>
                        <td className="py-3 px-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {course.course_name}
                          {course.is_active === false && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                              นำออกจากแผนแล้ว
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                          {course.company_count} บริษัท
                        </td>
                        <td className="py-3 px-3 text-center">
                          {course.is_active !== false ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#16a34a' }}>
                              อยู่ในแผน
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                              นำออกแล้ว
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {course.dsd_eligible ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                              ส่งได้
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--muted)' }}>
                              ไม่ส่ง
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleActiveToggle(course.course_name, !course.is_active)}
                              disabled={dsdActiveToggling === course.course_name}
                              className="text-[11px] px-3 py-1 rounded-lg font-medium transition-colors"
                              style={{
                                background: course.is_active !== false ? '#fef3c7' : '#dcfce7',
                                color: course.is_active !== false ? '#92400e' : '#16a34a',
                                border: 'none',
                                cursor: dsdActiveToggling === course.course_name ? 'wait' : 'pointer',
                                opacity: dsdActiveToggling === course.course_name ? 0.5 : 1,
                              }}
                            >
                              {dsdActiveToggling === course.course_name ? '...' : course.is_active !== false ? 'นำออก' : 'นำเข้า'}
                            </button>
                            <button
                              onClick={() => handleDsdToggle(course.course_name, !course.dsd_eligible)}
                              disabled={dsdToggling === course.course_name}
                              className="text-[11px] px-3 py-1 rounded-lg font-medium transition-colors"
                              style={{
                                background: course.dsd_eligible ? '#fee2e2' : '#dcfce7',
                                color: course.dsd_eligible ? '#dc2626' : '#16a34a',
                                border: 'none',
                                cursor: dsdToggling === course.course_name ? 'wait' : 'pointer',
                                opacity: dsdToggling === course.course_name ? 0.5 : 1,
                              }}
                            >
                              {dsdToggling === course.course_name ? '...' : course.dsd_eligible ? 'ปิด' : 'เปิด'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {dsdCourses.filter(c => !dsdSearch || c.course_name.toLowerCase().includes(dsdSearch.toLowerCase())).length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                          {dsdSearch ? 'ไม่พบหลักสูตรที่ค้นหา' : 'ยังไม่มีหลักสูตร'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Multi-Company Access Tab ── */}
        {activeTab === 'multicompany' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Multi-Company Access
                </h2>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  กำหนดให้ user 1 คน เข้าถึงได้หลายบริษัท — Login ครั้งเดียว เข้าได้ทุกบริษัทที่ผูกไว้
                </p>
              </div>
              <button
                onClick={() => setShowNewMcForm(!showNewMcForm)}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' }}
              >
                + เพิ่มสิทธิ์
              </button>
            </div>

            {/* New mapping form */}
            {showNewMcForm && (
              <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>เพิ่มสิทธิ์เข้าถึงข้ามบริษัท</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Master company */}
                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>บริษัทต้นทาง (Login ที่นี่)</label>
                    <select
                      value={mcMasterCompany}
                      onChange={e => { setMcMasterCompany(e.target.value); setMcMasterUsername(''); fetchMcUsers(e.target.value); }}
                      className="w-full px-3 py-2 rounded-lg text-[13px]"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">เลือกบริษัท...</option>
                      {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.shortName || c.id.toUpperCase()} — {c.name}</option>)}
                    </select>
                  </div>
                  {/* Master username */}
                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Username ของ user</label>
                    {mcUsersForCompany.length > 0 ? (
                      <select
                        value={mcMasterUsername}
                        onChange={e => setMcMasterUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[13px]"
                        style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      >
                        <option value="">เลือก user...</option>
                        {mcUsersForCompany.filter(u => u.is_active).map(u => (
                          <option key={u.id} value={u.username}>{u.username} — {u.display_name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={mcMasterUsername}
                        onChange={e => setMcMasterUsername(e.target.value)}
                        placeholder="พิมพ์ username"
                        className="w-full px-3 py-2 rounded-lg text-[13px]"
                        style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    )}
                  </div>
                  {/* Access company */}
                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>บริษัทที่ต้องการเข้าถึงเพิ่ม</label>
                    <select
                      value={mcAccessCompany}
                      onChange={e => setMcAccessCompany(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-[13px]"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">เลือกบริษัท...</option>
                      {COMPANIES.filter(c => c.id !== mcMasterCompany).map(c => (
                        <option key={c.id} value={c.id}>{c.shortName || c.id.toUpperCase()} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Display name override */}
                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>ชื่อแสดง (ไม่บังคับ)</label>
                    <input
                      value={mcDisplayName}
                      onChange={e => setMcDisplayName(e.target.value)}
                      placeholder="ใช้ชื่อ username ถ้าไม่ระบุ"
                      className="w-full px-3 py-2 rounded-lg text-[13px]"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMcMapping}
                    disabled={mcSaving || !mcMasterCompany || !mcMasterUsername || !mcAccessCompany}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
                    style={{
                      background: mcSaving || !mcMasterCompany || !mcMasterUsername || !mcAccessCompany ? '#94a3b8' : '#007aff',
                      cursor: mcSaving ? 'wait' : 'pointer',
                    }}
                  >
                    {mcSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                  <button
                    onClick={() => setShowNewMcForm(false)}
                    className="px-4 py-2 rounded-lg text-[13px]"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {/* Mappings table */}
            {mcLoading ? (
              <p className="text-center py-8 text-[13px]" style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
            ) : mcMappings.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>ยังไม่มีการตั้งค่า Multi-Company</p>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>กดปุ่ม &quot;+ เพิ่มสิทธิ์&quot; เพื่อกำหนดให้ user เข้าถึงหลายบริษัท</p>
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>User</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>บริษัทต้นทาง</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>→</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>เข้าถึงเพิ่ม</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>ชื่อแสดง</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcMappings.map((m, i) => {
                      const masterCompany = COMPANIES.find(c => c.id === m.master_company_id);
                      const accessCompany = COMPANIES.find(c => c.id === m.access_company_id);
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{i + 1}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.master_username}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: '#007aff20', color: '#007aff' }}>
                              {masterCompany?.shortName || m.master_company_id.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)' }}>→</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: '#34c75920', color: '#34c759' }}>
                              {accessCompany?.shortName || m.access_company_id.toUpperCase()}
                            </span>
                            <span className="text-[11px] ml-1.5" style={{ color: 'var(--muted)' }}>
                              {accessCompany?.name || ''}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{m.display_name || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteMcMapping(m.id)}
                              className="px-2 py-1 rounded text-[11px] font-medium"
                              style={{ color: '#ef4444', background: '#ef444410' }}
                            >
                              ลบ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Help text */}
            <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>วิธีใช้งาน:</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                1. เลือก &quot;บริษัทต้นทาง&quot; และ &quot;Username&quot; ของ user ที่ต้องการ<br/>
                2. เลือก &quot;บริษัทที่ต้องการเข้าถึงเพิ่ม&quot;<br/>
                3. เมื่อ user login ที่บริษัทต้นทาง ระบบจะ auto-login ทุกบริษัทที่ผูกไว้อัตโนมัติ<br/>
                4. สามารถเพิ่มได้หลายบริษัทต่อ 1 user (เพิ่มทีละ 1 รายการ)
              </p>
            </div>
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>รายชื่อบริษัท ({COMPANIES.length})</h3>
              <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>คลิกที่แถวเพื่อแก้ไข</span>
            </div>
            <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
              <table className="apple-table w-full text-[11px]" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '6%' }}>บริษัท</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '22%' }}>ชื่อเต็ม</th>
                    <th className="text-center py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '8%' }}>Group</th>
                    <th className="text-center py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '12%' }}>BU</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '14%' }}>Google Sheet ID</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '13%' }}>Safety Sheet</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)', width: '13%' }}>Envi Sheet</th>
                    <th className="text-center py-2 px-1 font-semibold" style={{ color: 'var(--text-secondary)', width: '7%', whiteSpace: 'nowrap' }}>สถานะ</th>
                    <th className="text-center py-2 px-1 font-semibold" style={{ color: 'var(--text-secondary)', width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Sort by BU order, then alphabetically by name within each BU
                    const buOrder = ['HQ', 'Biodiesel', 'Renewable Energy', 'EV', 'Waste Management', ''];
                    const groupColors: Record<string, { bg: string; color: string }> = {
                      'Factory': { bg: '#dbeafe', color: '#1d4ed8' },
                      'Non-Factory': { bg: '#f3e8ff', color: '#7c3aed' },
                    };
                    const buColors: Record<string, { bg: string; color: string }> = {
                      'HQ': { bg: '#fef3c7', color: '#92400e' },
                      'Biodiesel': { bg: '#dcfce7', color: '#166534' },
                      'Renewable Energy': { bg: '#dbeafe', color: '#1e40af' },
                      'EV': { bg: '#e0e7ff', color: '#3730a3' },
                      'Waste Management': { bg: '#ffedd5', color: '#9a3412' },
                    };
                    const sorted = [...COMPANIES].sort((a, b) => {
                      const aBu = getSettingValue(a.id, 'bu', a.bu || '');
                      const bBu = getSettingValue(b.id, 'bu', b.bu || '');
                      const aIdx = buOrder.indexOf(aBu);
                      const bIdx = buOrder.indexOf(bBu);
                      if (aIdx !== bIdx) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                      const aName = getSettingValue(a.id, 'company_name', a.name);
                      const bName = getSettingValue(b.id, 'company_name', b.name);
                      return aName.localeCompare(bName);
                    });
                    let lastBu = '';
                    const rows: React.ReactNode[] = [];
                    sorted.forEach(c => {
                    const currentName = getSettingValue(c.id, 'company_name', c.name);
                    const currentFullName = getSettingValue(c.id, 'full_name', c.fullName || '');
                    const currentGroup = getSettingValue(c.id, 'group_name', c.group || '');
                    const currentBu = getSettingValue(c.id, 'bu', c.bu || '');
                    const currentSheetId = getSettingValue(c.id, 'sheet_id', c.sheetId || '');
                    const currentSafetySheet = getSettingValue(c.id, 'safety_sheet', c.safetySheet || '');
                    const currentEnviSheet = getSettingValue(c.id, 'envi_sheet', c.enviSheet || '');
                    const isSavingThis = settingSaving === c.id;
                    const isEditing = editingCompany === c.id;
                    const hasSheet = !!(currentSheetId);
                    // Add BU section header when BU changes
                    if (currentBu !== lastBu) {
                      lastBu = currentBu;
                      const bStyle = currentBu ? buColors[currentBu] : null;
                      rows.push(
                        <tr key={`bu-header-${currentBu || 'none'}`} style={{ background: bStyle ? bStyle.bg + '33' : 'var(--bg-tertiary)' }}>
                          <td colSpan={9} className="py-2 px-3">
                            <span className="text-[11px] font-semibold" style={{ color: bStyle?.color || 'var(--text-muted)' }}>
                              {currentBu || 'ไม่ระบุ BU'}
                            </span>
                            <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>
                              ({sorted.filter(s => getSettingValue(s.id, 'bu', s.bu || '') === currentBu).length} บริษัท)
                            </span>
                          </td>
                        </tr>
                      );
                    }
                    rows.push(
                      <tr key={c.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px', background: isEditing ? 'var(--bg-secondary)' : undefined }} className="hover:bg-white/5">
                        {/* Company Name */}
                        <td className="py-2 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentName}
                              onChange={e => handleSettingChange(c.id, 'company_name', e.target.value)}
                              className="text-[11px] w-full px-2 py-1 rounded border font-medium"
                              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                            />
                          ) : (
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {currentName}
                              {isSavingThis && <span className="ml-2 text-[9px]" style={{ color: 'var(--accent)' }}>บันทึก...</span>}
                            </span>
                          )}
                        </td>
                        {/* Full Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={currentFullName}
                            onChange={e => handleSettingChange(c.id, 'full_name', e.target.value)}
                            placeholder="ชื่อเต็มบริษัท..."
                            className="text-[10px] w-full px-2 py-1 rounded border"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                          />
                        </td>
                        {/* Group */}
                        <td className="py-2 px-3 text-center">
                          <select
                            value={currentGroup}
                            onChange={e => handleSettingChange(c.id, 'group_name', e.target.value)}
                            className="text-[10px] px-2 py-1 rounded-lg border-0 font-medium cursor-pointer"
                            style={{
                              background: currentGroup ? (groupColors[currentGroup]?.bg || 'var(--bg-secondary)') : 'var(--bg-secondary)',
                              color: currentGroup ? (groupColors[currentGroup]?.color || 'var(--text-muted)') : 'var(--text-muted)',
                              outline: 'none',
                            }}
                          >
                            <option value="">-- ไม่ระบุ --</option>
                            {COMPANY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        {/* BU */}
                        <td className="py-2 px-3 text-center">
                          <select
                            value={currentBu}
                            onChange={e => handleSettingChange(c.id, 'bu', e.target.value)}
                            className="text-[10px] px-2 py-1 rounded-lg border-0 font-medium cursor-pointer"
                            style={{
                              background: currentBu ? (buColors[currentBu]?.bg || 'var(--bg-secondary)') : 'var(--bg-secondary)',
                              color: currentBu ? (buColors[currentBu]?.color || 'var(--text-muted)') : 'var(--text-muted)',
                              outline: 'none',
                            }}
                          >
                            <option value="">-- ไม่ระบุ --</option>
                            {COMPANY_BUS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>
                        {/* Google Sheet ID */}
                        <td className="py-2 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentSheetId}
                              onChange={e => handleSettingChange(c.id, 'sheet_id', e.target.value)}
                              placeholder="Google Spreadsheet ID..."
                              className="text-[10px] w-full px-2 py-1 rounded border font-mono"
                              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                            />
                          ) : (
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {currentSheetId ? <code>{currentSheetId.length > 20 ? currentSheetId.slice(0, 20) + '...' : currentSheetId}</code> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            </span>
                          )}
                        </td>
                        {/* Safety Sheet */}
                        <td className="py-2 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentSafetySheet}
                              onChange={e => handleSettingChange(c.id, 'safety_sheet', e.target.value)}
                              placeholder="ชื่อ Sheet Safety Plan..."
                              className="text-[10px] w-full px-2 py-1 rounded border"
                              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                            />
                          ) : (
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{currentSafetySheet || '-'}</span>
                          )}
                        </td>
                        {/* Envi Sheet */}
                        <td className="py-2 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentEnviSheet}
                              onChange={e => handleSettingChange(c.id, 'envi_sheet', e.target.value)}
                              placeholder="ชื่อ Sheet Envi Plan..."
                              className="text-[10px] w-full px-2 py-1 rounded border"
                              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                            />
                          ) : (
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{currentEnviSheet || '-'}</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="py-2 px-3 text-center">
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{
                            background: hasSheet ? 'rgba(48,209,88,0.2)' : 'var(--bg-tertiary)',
                            color: hasSheet ? '#30d158' : 'var(--text-muted)'
                          }}>
                            {hasSheet ? 'เชื่อมต่อ' : 'รอตั้งค่า'}
                          </span>
                        </td>
                        {/* Edit button */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setEditingCompany(isEditing ? null : c.id)}
                            className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                            style={{
                              background: isEditing ? 'var(--accent)' : 'var(--bg-secondary)',
                              color: isEditing ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {isEditing ? '✓ เสร็จ' : '✎ แก้ไข'}
                          </button>
                        </td>
                      </tr>
                    );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
