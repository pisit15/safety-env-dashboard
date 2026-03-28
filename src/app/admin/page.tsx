'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { COMPANIES } from '@/lib/companies';

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
  // Admin auth state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState('');
  const [currentAdminRole, setCurrentAdminRole] = useState<'super_admin' | 'admin' | 'viewer'>('viewer');

  // Tab state
  const [activeTab, setActiveTab] = useState<'companies' | 'audit' | 'deadlines' | 'requests' | 'credentials' | 'admins'>('audit');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [requestFilter, setRequestFilter] = useState('pending');
  const [loading, setLoading] = useState(false);

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
  const [editAdminPassword, setEditAdminPassword] = useState('');

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
      .then(d => setDeadlines(d.deadlines || []))
      .catch(() => {});
  }, []);

  const fetchCredentials = useCallback(() => {
    fetch('/api/credentials')
      .then(r => r.json())
      .then(d => setCredentials(d.credentials || []))
      .catch(() => {});
  }, []);

  const fetchAdminAccounts = useCallback(() => {
    fetch('/api/admin-auth')
      .then(r => r.json())
      .then(d => setAdminAccounts(d.admins || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdminLoggedIn) return;
    if (activeTab === 'audit') fetchAudit();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'deadlines') fetchDeadlines();
    if (activeTab === 'credentials') fetchCredentials();
    if (activeTab === 'admins') fetchAdminAccounts();
  }, [activeTab, isAdminLoggedIn, fetchAudit, fetchRequests, fetchDeadlines, fetchCredentials, fetchAdminAccounts]);

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

  const activeCompanies = COMPANIES.filter(c => c.sheetId !== '');
  const existingCredCompanyIds = credentials.map(c => c.company_id);
  const availableCompaniesForCred = COMPANIES.filter(c => !existingCredCompanyIds.includes(c.id));

  // Admin Login Screen
  if (!isAdminLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="glass-card p-8 w-full max-w-sm animate-fade-in-up">
              <h2 className="text-[26px] font-bold mb-2 text-center tracking-tight" style={{ color: 'var(--text-primary)' }}>Admin Login</h2>
              <p className="text-[13px] mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>กรอก Username และ Password เพื่อเข้าจัดการระบบ</p>
              <input
                type="text"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-4 py-3 bg-transparent border rounded-xl text-[13px] mb-3 focus:outline-none transition-colors"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                autoFocus
              />
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Password"
                className="w-full px-4 py-3 bg-transparent border rounded-xl text-[13px] mb-3 focus:outline-none transition-colors"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              />
              {adminLoginError && <p className="text-[11px] mb-3" style={{ color: 'var(--danger)' }}>{adminLoginError}</p>}
              <button
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword}
                className="w-full px-4 py-3 rounded-[10px] text-[13px] font-medium disabled:opacity-50 transition-colors"
                style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
              >
                {adminLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
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
            { key: 'credentials', label: 'จัดการบัญชี', minRole: 'super_admin' },
            { key: 'admins', label: 'จัดการ Admin', minRole: 'super_admin' },
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
            <div className="flex items-center gap-2 mb-4">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>กำหนดเส้นตายการแก้ไขรายเดือน</h3>
            </div>
            <p className="text-[11px] mb-4" style={{ color: 'var(--muted)' }}>
              กำหนดว่าแต่ละเดือนสามารถ update สถานะได้ภายในวันที่เท่าไรของเดือนถัดไป
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
        {activeTab === 'companies' && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-0.5 h-4 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>รายชื่อบริษัท ({COMPANIES.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="apple-table w-full text-[11px]">
                <thead>
                  <tr style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>บริษัท</th>
                    <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Google Sheet ID</th>
                    <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Safety Sheet</th>
                    <th className="text-left py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Envi Sheet</th>
                    <th className="text-center py-3 px-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPANIES.map(c => (
                    <tr key={c.id} style={{ borderColor: 'var(--border)', borderBottomWidth: '1px' }} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                      <td className="py-3 px-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{c.sheetId ? <code>{c.sheetId.slice(0, 20)}...</code> : <span style={{ color: 'var(--muted)' }}>-</span>}</td>
                      <td className="py-3 px-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{c.safetySheet || '-'}</td>
                      <td className="py-3 px-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{c.enviSheet || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{
                          background: c.sheetId ? 'rgba(48,209,88,0.2)' : 'var(--bg-tertiary)',
                          color: c.sheetId ? '#30d158' : 'var(--muted)'
                        }}>
                          {c.sheetId ? 'เชื่อมต่อ' : 'รอตั้งค่า'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
