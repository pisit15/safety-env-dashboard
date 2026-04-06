'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import Sidebar from '@/components/Sidebar';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const auth = useAuth();
  const loggedInCompanyIds = Object.keys(auth.companyAuth);

  // Determine current user context
  const isCompanyUser = loggedInCompanyIds.length > 0;
  const firstCompanyId = loggedInCompanyIds[0] || '';
  const firstCompanyAuth = auth.companyAuth[firstCompanyId];

  const [selectedCompanyId, setSelectedCompanyId] = useState(firstCompanyId);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedAuth = auth.companyAuth[selectedCompanyId];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!newPassword || !currentPassword) {
      setResult({ type: 'error', message: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }
    if (newPassword.length < 4) {
      setResult({ type: 'error', message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResult({ type: 'error', message: 'ยืนยันรหัสผ่านไม่ตรงกัน' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          username: selectedAuth?.username || '',
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: 'success', message: 'เปลี่ยนรหัสผ่านสำเร็จ!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResult({ type: 'error', message: data.error || 'เกิดข้อผิดพลาด' });
      }
    } catch {
      setResult({ type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    }
    setLoading(false);
  };

  // Gate: must be logged in
  if (!isCompanyUser && !auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
            <KeyRound size={48} className="mx-auto mb-4" style={{ color: 'var(--muted)' }} />
            <p className="text-lg font-semibold mb-2">กรุณาเข้าสู่ระบบก่อน</p>
            <Link href="/" className="text-sm underline" style={{ color: 'var(--accent)' }}>
              กลับหน้าหลัก
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    paddingRight: 44,
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] mb-6"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> กลับหน้าหลัก
        </Link>

        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' }}>
              <KeyRound size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              เปลี่ยนรหัสผ่าน
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              กรอกรหัสผ่านเดิมและรหัสผ่านใหม่
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-6" style={{
            background: 'var(--card-solid)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Company selector (if logged in to multiple) */}
              {loggedInCompanyIds.length > 1 && (
                <div>
                  <label style={labelStyle}>เลือกบริษัท</label>
                  <select
                    value={selectedCompanyId}
                    onChange={e => { setSelectedCompanyId(e.target.value); setResult(null); }}
                    style={{ ...inputStyle, paddingRight: 14, cursor: 'pointer' }}
                  >
                    {loggedInCompanyIds.map(id => (
                      <option key={id} value={id}>
                        {auth.companyAuth[id]?.companyName || id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* User info */}
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #34c759 0%, #007aff 100%)' }}>
                    {(selectedAuth?.displayName || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selectedAuth?.displayName || selectedAuth?.username || '-'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {selectedAuth?.companyName || selectedCompanyId.toUpperCase()}
                      {selectedAuth?.username ? ` · @${selectedAuth.username}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current password */}
              <div>
                <label style={labelStyle}>รหัสผ่านเดิม</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านเดิม"
                    style={inputStyle}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}>
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label style={labelStyle}>รหัสผ่านใหม่</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                    style={inputStyle}
                    required
                    minLength={4}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}>
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label style={labelStyle}>ยืนยันรหัสผ่านใหม่</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    style={inputStyle}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[12px] mt-1.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <AlertCircle size={12} /> รหัสผ่านไม่ตรงกัน
                  </p>
                )}
              </div>

              {/* Result message */}
              {result && (
                <div className="rounded-xl p-3 flex items-center gap-2 text-[13px]" style={{
                  background: result.type === 'success' ? '#dcfce7' : '#fef2f2',
                  color: result.type === 'success' ? '#166534' : '#991b1b',
                  border: `1px solid ${result.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                }}>
                  {result.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {result.message}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all duration-200"
                style={{
                  background: loading || !currentPassword || !newPassword || newPassword !== confirmPassword
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
                  cursor: loading ? 'wait' : (currentPassword && newPassword && newPassword === confirmPassword) ? 'pointer' : 'not-allowed',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
