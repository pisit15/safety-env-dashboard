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

export default function AdminPage() {
  // Admin auth state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'companies' | 'audit' | 'deadlines' | 'requests' | 'credentials'>('audit');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
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

  // Check admin session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_auth');
    if (saved === 'true') setIsAdminLoggedIn(true);
  }, []);

  const handleAdminLogin = async () => {
    setAdminLoginError('');
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminLoggedIn(true);
        sessionStorage.setItem('admin_auth', 'true');
        setAdminPassword('');
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
    sessionStorage.removeItem('admin_auth');
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

  useEffect(() => {
    if (!isAdminLoggedIn) return;
    if (activeTab === 'audit') fetchAudit();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'deadlines') fetchDeadlines();
    if (activeTab === 'credentials') fetchCredentials();
  }, [activeTab, isAdminLoggedIn, fetchAudit, fetchRequests, fetchDeadlines, fetchCredentials]);

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

  const activeCompanies = COMPANIES.filter(c => c.sheetId !== '');

  // Admin Login Screen
  if (!isAdminLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm">
              <h2 className="text-xl font-bold text-white mb-2 text-center">Admin Login</h2>
              <p className="text-sm text-zinc-400 mb-6 text-center">กรอกรหัสผ่าน Admin เพื่อเข้าจัดการระบบ</p>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                placeholder="รหัสผ่าน Admin"
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-accent"
                autoFocus
              />
              {adminLoginError && <p className="text-red-400 text-xs mb-3">{adminLoginError}</p>}
              <button
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword}
                className="w-full px-4 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/80 disabled:opacity-50"
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
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>Home</span><span>/</span><span className="text-white">Admin / ตั้งค่า</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <button
            onClick={handleAdminLogout}
            className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-500"
          >
            ออกจากระบบ Admin
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-2 flex-wrap">
          {[
            { key: 'audit', label: 'ประวัติการแก้ไข' },
            { key: 'requests', label: 'คำขอแก้ไข' },
            { key: 'deadlines', label: 'กำหนด Deadline' },
            { key: 'credentials', label: 'จัดการบัญชี' },
            { key: 'companies', label: 'บริษัท' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-accent text-white' : 'text-muted hover:text-white hover:bg-zinc-800'
              }`}
            >
              {tab.label}
              {tab.key === 'requests' && editRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {editRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* AUDIT LOG TAB */}
        {activeTab === 'audit' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-muted border-l-2 border-accent pl-3">ประวัติการแก้ไขทั้งหมด</h3>
              <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)} className="bg-bg border border-border rounded px-3 py-1.5 text-xs text-white">
                <option value="all">ทุกบริษัท</option>
                {activeCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {loading ? (
              <p className="text-muted text-sm py-8 text-center">กำลังโหลด...</p>
            ) : auditEntries.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center">ยังไม่มีประวัติการแก้ไข</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted">เวลา</th>
                      <th className="text-left py-2 px-2 text-muted">บริษัท</th>
                      <th className="text-left py-2 px-2 text-muted">การดำเนินการ</th>
                      <th className="text-left py-2 px-2 text-muted">กิจกรรม</th>
                      <th className="text-left py-2 px-2 text-muted">เดือน</th>
                      <th className="text-left py-2 px-2 text-muted">ค่าเดิม → ค่าใหม่</th>
                      <th className="text-left py-2 px-2 text-muted">ผู้ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map(entry => (
                      <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">{new Date(entry.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-2 px-2 text-white font-medium">{entry.company_id.toUpperCase()}</td>
                        <td className="py-2 px-2">{ACTION_LABELS[entry.action] || entry.action}</td>
                        <td className="py-2 px-2 text-zinc-300">{entry.activity_no}</td>
                        <td className="py-2 px-2">{MONTH_LABELS[entry.month] || entry.month}</td>
                        <td className="py-2 px-2">
                          {entry.old_value && <span className="text-red-400">{entry.old_value}</span>}
                          {entry.old_value && entry.new_value && <span className="text-zinc-600"> → </span>}
                          {entry.new_value && <span className="text-green-400">{entry.new_value}</span>}
                        </td>
                        <td className="py-2 px-2 text-zinc-400">{entry.performed_by}</td>
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
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-muted border-l-2 border-accent pl-3">คำขอแก้ไขหลัง Deadline</h3>
              <select value={requestFilter} onChange={e => setRequestFilter(e.target.value)} className="bg-bg border border-border rounded px-3 py-1.5 text-xs text-white">
                <option value="pending">รอการอนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ปฏิเสธ</option>
                <option value="all">ทั้งหมด</option>
              </select>
            </div>
            {editRequests.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center">ไม่มีคำขอ</p>
            ) : (
              <div className="space-y-3">
                {editRequests.map(req => (
                  <div key={req.id} className={`border rounded-lg p-4 ${
                    req.status === 'pending' ? 'border-amber-600/50 bg-amber-900/10' :
                    req.status === 'approved' ? 'border-green-600/50 bg-green-900/10' :
                    'border-red-600/50 bg-red-900/10'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white font-medium text-sm">{req.company_id.toUpperCase()}</span>
                          <span className="text-zinc-500 text-xs">|</span>
                          <span className="text-zinc-400 text-xs">กิจกรรม {req.activity_no}</span>
                          <span className="text-zinc-500 text-xs">|</span>
                          <span className="text-zinc-400 text-xs">{MONTH_LABELS[req.month] || req.month}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            req.status === 'pending' ? 'bg-amber-800 text-amber-300' :
                            req.status === 'approved' ? 'bg-green-800 text-green-300' :
                            'bg-red-800 text-red-300'
                          }`}>
                            {req.status === 'pending' ? 'รอการอนุมัติ' : req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mb-1">เหตุผล: {req.reason}</p>
                        <p className="text-[10px] text-zinc-500">
                          โดย {req.requested_by} | {new Date(req.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          {req.reviewed_at && ` | ตรวจสอบโดย ${req.reviewed_by} เมื่อ ${new Date(req.reviewed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`}
                        </p>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => handleApproveReject(req.id, 'approved')} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg">อนุมัติ</button>
                          <button onClick={() => handleApproveReject(req.id, 'rejected')} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg">ปฏิเสธ</button>
                        </div>
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
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">กำหนดเส้นตายการแก้ไขรายเดือน</h3>
            <p className="text-xs text-zinc-500 mb-4">
              กำหนดว่าแต่ละเดือนสามารถ update สถานะได้ภายในวันที่เท่าไรของเดือนถัดไป
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {deadlines.map(d => (
                <div key={d.month} className="border border-border rounded-lg p-3 bg-bg">
                  <div className="text-sm font-medium text-white mb-2">{MONTH_LABELS[d.month]}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">วันที่</span>
                    <select value={d.deadline_day} onChange={e => handleDeadlineUpdate(d.month, parseInt(e.target.value))} className="bg-card border border-border rounded px-2 py-1 text-xs text-white flex-1">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <span className="text-[10px] text-zinc-500">ของเดือนถัดไป</span>
                  </div>
                </div>
              ))}
            </div>
            {deadlines.length === 0 && <p className="text-muted text-sm py-8 text-center">ยังไม่มีข้อมูล deadline</p>}
          </div>
        )}

        {/* CREDENTIALS TAB */}
        {activeTab === 'credentials' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-muted border-l-2 border-accent pl-3">จัดการบัญชีบริษัท</h3>
              <button
                onClick={() => setShowNewCredForm(!showNewCredForm)}
                className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent/80"
              >
                + เพิ่มบัญชีใหม่
              </button>
            </div>

            {/* New credential form */}
            {showNewCredForm && (
              <div className="bg-bg border border-border rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-white mb-3">สร้างบัญชีบริษัทใหม่</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Company ID</label>
                    <input
                      type="text" value={newCredCompanyId}
                      onChange={e => setNewCredCompanyId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="เช่น ea-kabin"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Username</label>
                    <input
                      type="text" value={newCredUsername}
                      onChange={e => setNewCredUsername(e.target.value)}
                      placeholder="ชื่อผู้ใช้"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Password</label>
                    <input
                      type="text" value={newCredPassword}
                      onChange={e => setNewCredPassword(e.target.value)}
                      placeholder="รหัสผ่าน"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateCredential} disabled={credSaving || !newCredCompanyId || !newCredUsername || !newCredPassword}
                    className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/80 disabled:opacity-50">
                    {credSaving ? 'กำลังบันทึก...' : 'สร้างบัญชี'}
                  </button>
                  <button onClick={() => setShowNewCredForm(false)} className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-600">
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {/* Credentials table */}
            {credentials.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center">ยังไม่มีบัญชีบริษัท — กรุณา run SQL migration สร้างตาราง company_credentials ก่อน</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-muted font-semibold">Company ID</th>
                      <th className="text-left py-3 px-3 text-muted font-semibold">Username</th>
                      <th className="text-left py-3 px-3 text-muted font-semibold">Password</th>
                      <th className="text-center py-3 px-3 text-muted font-semibold">สถานะ</th>
                      <th className="text-center py-3 px-3 text-muted font-semibold">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(cred => (
                      <tr key={cred.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                        <td className="py-3 px-3 font-medium text-white">{cred.company_id.toUpperCase()}</td>
                        <td className="py-3 px-3 text-zinc-300">{cred.username}</td>
                        <td className="py-3 px-3">
                          {editingCredId === cred.company_id ? (
                            <div className="flex items-center gap-2">
                              <input type="text" value={editCredPassword}
                                onChange={e => setEditCredPassword(e.target.value)}
                                className="px-2 py-1 bg-bg border border-border rounded text-white text-xs w-32 focus:outline-none focus:border-accent"
                                autoFocus
                              />
                              <button onClick={() => handleUpdatePassword(cred.company_id)} disabled={credSaving}
                                className="text-green-400 text-xs hover:text-green-300">บันทึก</button>
                              <button onClick={() => { setEditingCredId(null); setEditCredPassword(''); }}
                                className="text-zinc-500 text-xs hover:text-zinc-300">ยกเลิก</button>
                            </div>
                          ) : (
                            <code className="text-xs text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded">{cred.password}</code>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => handleToggleActive(cred.company_id, cred.is_active)}
                            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${
                              cred.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                            }`}>
                            {cred.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingCredId(cred.company_id); setEditCredPassword(cred.password); }}
                              className="text-xs text-accent hover:text-accent/80">แก้ไขรหัส</button>
                            <button onClick={() => handleDeleteCredential(cred.company_id)}
                              className="text-xs text-red-400 hover:text-red-300">ลบ</button>
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
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">รายชื่อบริษัท ({COMPANIES.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-muted font-semibold">บริษัท</th>
                    <th className="text-left py-3 px-3 text-muted font-semibold">Google Sheet ID</th>
                    <th className="text-left py-3 px-3 text-muted font-semibold">Safety Sheet</th>
                    <th className="text-left py-3 px-3 text-muted font-semibold">Envi Sheet</th>
                    <th className="text-center py-3 px-3 text-muted font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPANIES.map(c => (
                    <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                      <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                      <td className="py-3 px-3 text-xs text-zinc-400">{c.sheetId ? <code>{c.sheetId.slice(0, 20)}...</code> : <span className="text-zinc-600">-</span>}</td>
                      <td className="py-3 px-3 text-xs text-zinc-400">{c.safetySheet || '-'}</td>
                      <td className="py-3 px-3 text-xs text-zinc-400">{c.enviSheet || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.sheetId ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
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
