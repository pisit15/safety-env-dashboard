'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { getCompanyById } from '@/lib/companies';
import {
  Users, ShieldCheck, Briefcase, Plus, Pencil, Trash2, X, Check,
  Search, AlertTriangle, FileText, ChevronDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface Personnel {
  id?: string;
  company_id: string;
  bu: string;
  full_name: string;
  nick_name: string;
  position: string;
  responsibility: string;
  department: string;
  employment_type: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_she_team: boolean;
}

interface LegalReq {
  id?: string;
  company_id: string;
  name: string;
  short_name: string;
  category: string;
  required_count: number;
  description: string;
  law_reference: string;
  sort_order: number;
  is_active: boolean;
  is_required: boolean;
}

interface License {
  id?: string;
  personnel_id: string;
  requirement_type_id: string;
  has_license: boolean;
}

interface Workload {
  id?: string;
  company_id: string;
  personnel_id?: string;
  function_name: string;
  job_level1: string;
  job_level2: string;
  job_level3: string;
  job_rank: string;
  job_type: string;
  time_usage_min: number;
  frequency: string;
  frequency_count: number;
}

// ── Constants ──────────────────────────────────────────────────
const TABS = ['ภาพรวม', 'บุคลากร', 'ใบอนุญาต', 'วิเคราะห์ภาระงาน'];
const POSITIONS = ['HSE Manager', 'จป.วิชาชีพ', 'จป.เทคนิค', 'Safety Supervisor', 'พนักงานปฏิบัติการ', 'เจ้าหน้าที่สิ่งแวดล้อม', 'ผู้ควบคุมมลพิษ', 'อื่นๆ'];
const RESPONSIBILITIES = ['Safety', 'Environment', 'Occupational Health', 'Admin', 'อื่นๆ'];
const EMP_TYPES: Record<string, string> = {
  permanent: 'พนักงานประจำ', subcontract: 'ผู้รับเหมา', outsource: 'Outsource',
  part_time: 'Part-time', dvt: 'ทวิภาคี',
};
const EMP_TYPE_COLORS: Record<string, string> = {
  permanent: '#007aff', subcontract: '#ff9500', outsource: '#af52de',
  part_time: '#5ac8fa', dvt: '#ff3b30',
};
const RESP_COLORS: Record<string, string> = {
  Safety: '#f97316', Environment: '#22c55e', 'Occupational Health': '#007aff', Admin: '#6b7280',
};
const FREQ_LABELS: Record<string, string> = { daily: 'รายวัน', weekly: 'รายสัปดาห์', monthly: 'รายเดือน', yearly: 'รายปี' };
const FREQ_MULTIPLIER: Record<string, number> = { daily: 232, weekly: 48, monthly: 12, yearly: 1 };
const ANNUAL_MINUTES_PER_PERSON = 97440;

// ── Shared styles (outside component to avoid re-creation) ────
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f3f4f6', fontSize: 14, color: '#111', outline: 'none' };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' as const, cursor: 'pointer' };
const _btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' };
const _btnSecondary: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, background: '#e5e7eb', color: '#374151', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' };

// ── Modal (outside component to prevent re-mount on state change) ──
function Modal({ show, title, onClose, onSave, saving, children }: { show: boolean; title: string; onClose: () => void; onSave: () => void; saving?: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl w-full max-w-[500px] overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0f3460 0%, #533483 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} color="#fff" /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={_btnSecondary} onClick={onClose}>ยกเลิก</button>
          <button style={{ ..._btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={onSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{children}</label>;
}

// ── Helper ─────────────────────────────────────────────────────
function emptyPersonnel(companyId: string): Personnel {
  return { company_id: companyId, bu: '', full_name: '', nick_name: '', position: '', responsibility: '', department: 'HSE', employment_type: 'permanent', phone: '', email: '', is_active: true, is_she_team: true };
}
function emptyReq(companyId: string): LegalReq {
  return { company_id: companyId, name: '', short_name: '', category: 'safety', required_count: 0, description: '', law_reference: '', sort_order: 0, is_active: true, is_required: true };
}
function emptyWorkload(companyId: string): Workload {
  return { company_id: companyId, function_name: '', job_level1: '', job_level2: '', job_level3: '', job_rank: 'B', job_type: 'fixed', time_usage_min: 0, frequency: 'daily', frequency_count: 1 };
}

// ================================================================
export default function SHEWorkforcePage() {
  const params = useParams();
  const companyId = params.id as string;
  const auth = useAuth();
  const company = getCompanyById(companyId);
  const companyName = company?.name || companyId.toUpperCase();

  // Data
  const [activeTab, setActiveTab] = useState(0);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [requirements, setRequirements] = useState<LegalReq[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [workload, setWorkload] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showPModal, setShowPModal] = useState(false);
  const [editP, setEditP] = useState<Personnel | null>(null);
  const [showRModal, setShowRModal] = useState(false);
  const [editR, setEditR] = useState<LegalReq | null>(null);
  const [showWModal, setShowWModal] = useState(false);
  const [editW, setEditW] = useState<Workload | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Fetch ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/she-workforce?companyId=${companyId}`);
      const d = await res.json();
      setPersonnel(d.personnel || []);
      setRequirements(d.requirements || []);
      setLicenses(d.licenses || []);
      setWorkload(d.workload || []);
      if (d.latestManHours) setEmployeeCount(d.latestManHours.employee_count || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (auth.isAdmin && auth.adminRole === 'super_admin') fetchData();
  }, [auth.isAdmin, auth.adminRole, fetchData]);

  // ── API helpers ──────────────────────────────────────────────
  const apiPost = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/she-workforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return { ok: false, error: d.error || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const savePersonnel = async () => {
    if (!editP || !editP.full_name.trim()) return;
    setSaving(true);
    const result = await apiPost({ action: 'upsert_personnel', data: editP });
    setSaving(false);
    if (!result.ok) {
      showError(`บันทึกไม่สำเร็จ: ${result.error}`);
      return;
    }
    setShowPModal(false);
    setEditP(null);
    fetchData();
  };

  const deletePersonnel = async (id: string) => {
    if (!confirm('ลบบุคลากรนี้?')) return;
    const result = await apiPost({ action: 'delete_personnel', id });
    if (!result.ok) { showError(`ลบไม่สำเร็จ: ${result.error}`); return; }
    fetchData();
  };

  const saveReq = async () => {
    if (!editR || !editR.name.trim()) return;
    setSaving(true);
    const result = await apiPost({ action: 'upsert_requirement', data: editR });
    setSaving(false);
    if (!result.ok) {
      showError(`บันทึกไม่สำเร็จ: ${result.error}`);
      return;
    }
    setShowRModal(false);
    setEditR(null);
    fetchData();
  };

  const toggleLicense = async (personnelId: string, reqId: string) => {
    const existing = licenses.find(l => l.personnel_id === personnelId && l.requirement_type_id === reqId);
    const newVal = !(existing?.has_license);
    await apiPost({ action: 'upsert_license', data: { personnel_id: personnelId, requirement_type_id: reqId, has_license: newVal } });
    // Optimistic update
    setLicenses(prev => {
      const idx = prev.findIndex(l => l.personnel_id === personnelId && l.requirement_type_id === reqId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], has_license: newVal };
        return copy;
      }
      return [...prev, { personnel_id: personnelId, requirement_type_id: reqId, has_license: newVal }];
    });
  };

  const saveWorkload = async () => {
    if (!editW) return;
    setSaving(true);
    const result = await apiPost({ action: 'upsert_workload', data: editW });
    setSaving(false);
    if (!result.ok) {
      showError(`บันทึกไม่สำเร็จ: ${result.error}`);
      return;
    }
    setShowWModal(false);
    setEditW(null);
    fetchData();
  };

  const deleteWorkload = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return;
    const result = await apiPost({ action: 'delete_workload', id });
    if (!result.ok) { showError(`ลบไม่สำเร็จ: ${result.error}`); return; }
    fetchData();
  };

  // ── Auth Gate ────────────────────────────────────────────────
  if (!auth.isAdmin || auth.adminRole !== 'super_admin') {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8" style={{ color: 'var(--text-primary)' }}>
          <div style={{ textAlign: 'center', marginTop: 100 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>เฉพาะ Super Admin</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>หน้านี้สำหรับ Super Admin เท่านั้น</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Computed ─────────────────────────────────────────────────
  const sheCount = personnel.length;
  const ratioNum = employeeCount > 0 && sheCount > 0 ? Math.round(employeeCount / sheCount) : 0;
  const ratio = ratioNum > 0 ? `1:${ratioNum}` : '-';
  const totalLicensed = licenses.filter(l => l.has_license).length;
  const totalReqSlots = personnel.length * requirements.length;

  // Compliance: count required reqs that are met vs not
  const requiredReqs = requirements.filter(r => r.is_required);
  const complianceMet = requiredReqs.filter(req => {
    const held = licenses.filter(l => l.requirement_type_id === req.id && l.has_license).length;
    return req.required_count === 0 ? held > 0 : held >= req.required_count;
  }).length;
  const complianceRate = requiredReqs.length > 0 ? Math.round((complianceMet / requiredReqs.length) * 100) : 100;

  // Responsibility breakdown
  const respMap: Record<string, number> = {};
  personnel.forEach(p => { const r = p.responsibility || 'อื่นๆ'; respMap[r] = (respMap[r] || 0) + 1; });
  const maxResp = Math.max(...Object.values(respMap), 1);

  // Employment type breakdown
  const empMap: Record<string, number> = {};
  personnel.forEach(p => { const t = p.employment_type || 'permanent'; empMap[t] = (empMap[t] || 0) + 1; });
  const maxEmp = Math.max(...Object.values(empMap), 1);

  // Filtered personnel
  const filteredP = personnel.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.nick_name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q);
  });

  // Workload totals
  const workloadByFn: Record<string, { totalMin: number; entries: number }> = {};
  let grandTotalMin = 0;
  workload.forEach(w => {
    const annual = w.time_usage_min * w.frequency_count * (FREQ_MULTIPLIER[w.frequency] || 1);
    grandTotalMin += annual;
    const fn = w.function_name || 'ไม่ระบุ';
    if (!workloadByFn[fn]) workloadByFn[fn] = { totalMin: 0, entries: 0 };
    workloadByFn[fn].totalMin += annual;
    workloadByFn[fn].entries++;
  });
  const manpowerNeed = grandTotalMin / ANNUAL_MINUTES_PER_PERSON;
  const manpowerGap = sheCount - manpowerNeed; // positive = surplus

  // ── Styles ──────────────────────────────────────────────────
  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 13 };

  // ================================================================
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        {/* ── Error Toast ──────────────────────────────────────── */}
        {errorMsg && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 20px', maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span style={{ fontSize: 14, color: '#991b1b', fontWeight: 500 }}>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={14} color="#991b1b" /></button>
          </div>
        )}
        {/* ── Hero ────────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: '40px 32px 60px', position: 'relative' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>SHE Workforce</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginLeft: 54 }}>
              {companyName} — บุคลากรด้านความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม
            </p>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div className="glass-card" style={{ display: 'inline-flex', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {TABS.map((tab, i) => (
              <button key={i} onClick={() => setActiveTab(i)} style={{
                padding: '12px 22px', fontSize: 14, fontWeight: activeTab === i ? 700 : 500, border: 'none', cursor: 'pointer',
                background: activeTab === i ? 'var(--card-solid)' : 'transparent',
                color: activeTab === i ? '#007aff' : 'var(--text-secondary)',
                borderBottom: activeTab === i ? '3px solid #007aff' : '3px solid transparent',
                transition: 'all 0.15s ease',
              }}>{tab}</button>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: '20px auto 40px', padding: '0 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 12px' }} />
              กำลังโหลดข้อมูล...
            </div>
          ) : (
            <>
              {/* ═══════ TAB 0: ภาพรวม ═══════ */}
              {activeTab === 0 && (
                <div>
                  {/* ── KPI Cards: Gray+One severity encoding ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {/* Compliance Rate — most important */}
                    <div style={{ padding: 16, borderRadius: 12, border: `1.5px solid ${complianceRate === 100 ? '#BAB0AC44' : complianceRate >= 80 ? '#F28E2B44' : '#E1575966'}`, background: complianceRate === 100 ? 'var(--bg-secondary, #fff)' : complianceRate >= 80 ? '#F28E2B08' : '#E1575908' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Compliance กฎหมาย</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: complianceRate === 100 ? '#59A14F' : complianceRate >= 80 ? '#F28E2B' : '#E15759', lineHeight: 1 }}>{complianceRate}<span style={{ fontSize: 16, fontWeight: 700 }}>%</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{complianceMet}/{requiredReqs.length} ประเภทผ่าน</div>
                    </div>
                    {/* SHE : พนักงาน — with benchmark */}
                    <div style={{ padding: 16, borderRadius: 12, border: `1.5px solid ${ratioNum > 200 ? '#E1575966' : ratioNum > 100 ? '#F28E2B44' : '#BAB0AC44'}`, background: ratioNum > 200 ? '#E1575908' : 'var(--bg-secondary, #fff)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>SHE : พนักงาน</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: ratioNum > 200 ? '#E15759' : ratioNum > 100 ? '#F28E2B' : '#59A14F', lineHeight: 1 }}>{ratio}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{employeeCount > 0 ? `${sheCount} SHE / ${employeeCount} คน` : 'ยังไม่มีข้อมูลพนักงาน'}</div>
                      {ratioNum > 0 && <div style={{ fontSize: 10, color: ratioNum > 100 ? '#E15759' : '#59A14F', fontWeight: 600, marginTop: 2 }}>{ratioNum <= 100 ? 'ตามเกณฑ์กฎหมาย' : 'เกินเกณฑ์ 1:100'}</div>}
                    </div>
                    {/* บุคลากร SHE */}
                    <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-secondary, #fff)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>บุคลากร SHE</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: '#4E79A7', lineHeight: 1 }}>{sheCount}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{Object.keys(respMap).length} Functions ครอบคลุม</div>
                    </div>
                    {/* Workload Gap */}
                    <div style={{ padding: 16, borderRadius: 12, border: `1.5px solid ${manpowerGap < 0 ? '#E1575966' : '#BAB0AC44'}`, background: manpowerGap < 0 ? '#E1575908' : 'var(--bg-secondary, #fff)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>กำลังคน</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: workload.length === 0 ? '#BAB0AC' : manpowerGap < 0 ? '#E15759' : '#59A14F', lineHeight: 1 }}>
                        {workload.length === 0 ? '-' : manpowerGap >= 0 ? `+${manpowerGap.toFixed(1)}` : manpowerGap.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {workload.length === 0 ? 'ยังไม่มีข้อมูลภาระงาน' : `ต้องการ ${manpowerNeed.toFixed(1)} / มี ${sheCount} คน`}
                      </div>
                      {workload.length > 0 && <div style={{ fontSize: 10, color: manpowerGap < 0 ? '#E15759' : '#59A14F', fontWeight: 600, marginTop: 2 }}>{manpowerGap >= 0 ? 'เพียงพอ' : 'ขาดกำลังคน'}</div>}
                    </div>
                  </div>

                  {/* ── Charts Row: Responsibility + Employment Type (matching horizontal bars) ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                    {/* Responsibility */}
                    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>หน้าที่หลัก (Responsibility)</p>
                      {Object.entries(respMap).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่มีข้อมูล</p>
                      ) : Object.entries(respMap).sort((a, b) => b[1] - a[1]).map(([resp, count]) => (
                        <div key={resp} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{resp}</span>
                            <span style={{ fontWeight: 700, color: RESP_COLORS[resp] || '#6b7280' }}>{count} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>คน</span></span>
                          </div>
                          <div style={{ height: 7, borderRadius: 4, background: 'rgba(107,114,128,0.08)' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${(count / maxResp) * 100}%`, background: RESP_COLORS[resp] || '#6b7280', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Employment Type — now matching bar format */}
                    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>ประเภทการจ้าง</p>
                      {Object.entries(empMap).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่มีข้อมูล</p>
                      ) : Object.entries(empMap).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                        <div key={type} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{EMP_TYPES[type] || type}</span>
                            <span style={{ fontWeight: 700, color: EMP_TYPE_COLORS[type] || '#6b7280' }}>{count} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>คน</span></span>
                          </div>
                          <div style={{ height: 7, borderRadius: 4, background: 'rgba(107,114,128,0.08)' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${(count / maxEmp) * 100}%`, background: EMP_TYPE_COLORS[type] || '#6b7280', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Compliance: Bullet chart bars (actual vs required) ── */}
                  <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ใบอนุญาตตามกฎหมาย</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 6, borderRadius: 3, background: '#4E79A7', display: 'inline-block' }} /> มี</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 1, height: 14, background: '#E15759', display: 'inline-block' }} /> ต้องการ</span>
                      </div>
                    </div>
                    {requirements.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่ได้ตั้งค่าประเภทใบอนุญาต — ไปที่แท็บ &quot;ใบอนุญาต&quot; เพื่อเพิ่ม</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {requirements.map(req => {
                          const held = licenses.filter(l => l.requirement_type_id === req.id && l.has_license).length;
                          const needed = req.required_count || 0;
                          const maxBar = Math.max(held, needed, 1);
                          const ok = needed === 0 ? held > 0 : held >= needed;
                          const catColor = req.category === 'safety' ? '#f97316' : req.category === 'environment' ? '#22c55e' : '#007aff';
                          return (
                            <div key={req.id}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 120 }}>{req.short_name}</span>
                                {req.category && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${catColor}15`, color: catColor, fontWeight: 600 }}>{req.category}</span>}
                                {!req.is_required && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#BAB0AC20', color: '#BAB0AC', fontWeight: 600 }}>ไม่บังคับ</span>}
                                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: ok ? '#59A14F' : '#E15759' }}>{held}{needed > 0 ? `/${needed}` : ''}</span>
                              </div>
                              <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'rgba(107,114,128,0.06)' }}>
                                {/* Actual bar */}
                                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(held / maxBar) * 100}%`, borderRadius: 5, background: ok ? '#59A14F' : '#4E79A7', opacity: ok ? 0.7 : 1, transition: 'width 0.3s' }} />
                                {/* Target marker line */}
                                {needed > 0 && (
                                  <div style={{ position: 'absolute', top: -2, left: `${(needed / maxBar) * 100}%`, width: 2, height: 14, background: held >= needed ? '#59A14F' : '#E15759', borderRadius: 1 }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════ TAB 1: บุคลากร ═══════ */}
              {activeTab === 1 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 250px' }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input placeholder="ค้นหาชื่อ, ตำแหน่ง..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, paddingLeft: 36, background: 'var(--card-solid)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditP({ ...emptyPersonnel(companyId), is_she_team: false, department: '' }); setShowPModal(true); }} style={{ ..._btnSecondary, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13 }}>
                        <Plus size={14} /> ผู้ได้รับแต่งตั้ง
                      </button>
                      <button onClick={() => { setEditP(emptyPersonnel(companyId)); setShowPModal(true); }} style={{ ..._btnPrimary, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <Plus size={16} /> เพิ่มบุคลากร SHE
                      </button>
                    </div>
                  </div>

                  <div className="glass-card rounded-xl" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                            {['#', 'ชื่อ-นามสกุล', 'ประเภท', 'แผนก', 'ตำแหน่ง', 'หน้าที่', 'การจ้าง', 'โทร', ''].map((h, i) => (
                              <th key={i} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredP.length === 0 ? (
                            <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                              <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                              <div>ยังไม่มีข้อมูลบุคลากร</div>
                            </td></tr>
                          ) : filteredP.map((p, i) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: p.is_she_team === false ? '#fef3c710' : undefined }}>
                              <td style={{ ...tdStyle, color: 'var(--text-secondary)', width: 40 }}>{i + 1}</td>
                              <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {p.full_name}
                                {p.nick_name ? <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}> ({p.nick_name})</span> : null}
                              </td>
                              <td style={tdStyle}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: p.is_she_team !== false ? '#34c75915' : '#ff950015', color: p.is_she_team !== false ? '#34c759' : '#ff9500' }}>
                                  {p.is_she_team !== false ? 'ทีม SHE' : 'แต่งตั้ง'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.department || '-'}</td>
                              <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{p.position || '-'}</span></td>
                              <td style={tdStyle}>
                                {p.responsibility && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${RESP_COLORS[p.responsibility] || '#6b7280'}15`, color: RESP_COLORS[p.responsibility] || '#6b7280', fontWeight: 600 }}>{p.responsibility}</span>}
                              </td>
                              <td style={tdStyle}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${EMP_TYPE_COLORS[p.employment_type] || '#6b7280'}15`, color: EMP_TYPE_COLORS[p.employment_type] || '#6b7280', fontWeight: 600 }}>{EMP_TYPES[p.employment_type] || p.employment_type}</span></td>
                              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.phone || '-'}</td>
                              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                <button onClick={() => { setEditP({ ...p }); setShowPModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Pencil size={14} color="var(--accent)" /></button>
                                <button onClick={() => p.id && deletePersonnel(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={14} color="#ff3b30" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════ TAB 2: ใบอนุญาต ═══════ */}
              {activeTab === 2 && (
                <div>
                  {/* ── KPI Strip ── */}
                  {requirements.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                      {(() => {
                        const totalHeld = licenses.filter(l => l.has_license).length;
                        const failReqs = requiredReqs.filter(req => {
                          const h = licenses.filter(l => l.requirement_type_id === req.id && l.has_license).length;
                          return req.required_count === 0 ? h === 0 : h < req.required_count;
                        });
                        return (
                          <>
                            <div style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${complianceRate === 100 ? '#59A14F44' : '#E1575944'}`, background: complianceRate === 100 ? '#59A14F08' : '#E1575908', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18, fontWeight: 800, color: complianceRate === 100 ? '#59A14F' : '#E15759' }}>{complianceRate}%</span>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Compliance ({complianceMet}/{requiredReqs.length})</span>
                            </div>
                            <div style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18, fontWeight: 800, color: '#4E79A7' }}>{totalHeld}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ใบอนุญาตที่มี</span>
                            </div>
                            {failReqs.length > 0 && (
                              <div style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #E1575944', background: '#E1575908', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={14} color="#E15759" />
                                <span style={{ fontSize: 11, color: '#E15759', fontWeight: 600 }}>ขาด: {failReqs.map(r => r.short_name).join(', ')}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span>คลิกที่ช่องเพื่อเปลี่ยนสถานะใบอนุญาต</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#007aff', display: 'inline-block' }} /> บริษัทต้องมี</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#d1d5db', display: 'inline-block' }} /> บุคลากรมี (ไม่บังคับ)</span>
                    </div>
                    <button onClick={() => { setEditR(emptyReq(companyId)); setShowRModal(true); }} style={{ ..._btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={16} /> เพิ่มประเภทใบอนุญาต
                    </button>
                  </div>

                  {requirements.length === 0 ? (
                    <div className="glass-card rounded-xl" style={{ padding: 60, textAlign: 'center', border: '1px solid var(--border)' }}>
                      <ShieldCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.3, color: 'var(--text-secondary)' }} />
                      <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>ยังไม่มีประเภทใบอนุญาต</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>กดปุ่ม &quot;เพิ่มประเภทใบอนุญาต&quot; เพื่อเริ่มต้น</div>
                    </div>
                  ) : (
                    <div className="glass-card rounded-xl" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: 120 }} />
                            {requirements.map(r => <col key={r.id} style={{ width: `${Math.max(100 / requirements.length, 5)}%` }} />)}
                          </colgroup>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 3, verticalAlign: 'bottom' }}>ชื่อ</th>
                              {requirements.map(r => (
                                <th key={r.id} style={{ padding: '6px 2px', textAlign: 'center', borderBottom: r.is_required ? '3px solid #007aff' : '3px solid #d1d5db', cursor: 'pointer', verticalAlign: 'bottom', height: 80 }}
                                  onClick={() => { setEditR({ ...r }); setShowRModal(true); }}>
                                  <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: 11, lineHeight: 1.2, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'inline-block', maxHeight: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.short_name}
                                  </div>
                                  <div style={{ fontSize: 8, color: r.is_required ? '#007aff' : '#aaa', marginTop: 2 }}>{r.is_required ? '●' : '○'}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {personnel.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '5px 8px', fontWeight: 600, fontSize: 12, position: 'sticky', left: 0, background: 'var(--card-solid)', zIndex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.full_name}
                                  {p.is_she_team === false && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 8, background: '#ff950015', color: '#ff9500', fontWeight: 600, marginLeft: 3 }}>{p.department || 'แต่งตั้ง'}</span>}
                                </td>
                                {requirements.map(r => {
                                  const lic = licenses.find(l => l.personnel_id === p.id && l.requirement_type_id === r.id);
                                  const has = lic?.has_license;
                                  return (
                                    <td key={r.id} style={{ padding: '4px 2px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                                      onClick={() => p.id && r.id && toggleLicense(p.id, r.id)}>
                                      {has ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: '#34c75920', color: '#34c759' }}>
                                          <Check size={13} />
                                        </span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: '#ff3b3010', color: '#ff3b3060' }}>
                                          <X size={11} />
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {/* Summary row */}
                            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: 12, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-primary)' }}>รวม</td>
                              {requirements.map(r => {
                                const count = licenses.filter(l => l.requirement_type_id === r.id && l.has_license).length;
                                const isOk = !r.is_required || count >= (r.required_count || 1);
                                return (
                                  <td key={r.id} style={{ padding: '6px 2px', textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
                                    <span style={{ color: r.is_required ? (isOk ? '#34c759' : '#ff3b30') : 'var(--text-secondary)' }}>{count}</span>
                                    {r.is_required && r.required_count > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 10 }}>/{r.required_count}</span>}
                                    {r.is_required && r.required_count === 0 && count === 0 && <div style={{ color: '#ff3b30', fontSize: 9 }}>ขาด</div>}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════ TAB 3: วิเคราะห์ภาระงาน ═══════ */}
              {activeTab === 3 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>วิเคราะห์ภาระงานและคำนวณจำนวนคนที่ต้องการ</p>
                    <button onClick={() => { setEditW(emptyWorkload(companyId)); setShowWModal(true); }} style={{ ..._btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={16} /> เพิ่มรายการ
                    </button>
                  </div>

                  {/* ── Summary: Capacity vs Demand visual ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
                    {/* Capacity bar */}
                    <div style={{ padding: 16, borderRadius: 12, border: `1.5px solid ${manpowerGap < 0 ? '#E1575944' : 'var(--border)'}`, background: manpowerGap < 0 ? '#E1575906' : 'var(--card-solid, var(--bg-secondary))' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>กำลังคน: ความต้องการ vs ปัจจุบัน</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                        ต้องการ <b style={{ color: '#4E79A7' }}>{manpowerNeed.toFixed(1)}</b> คน · มี <b style={{ color: '#59A14F' }}>{sheCount}</b> คน · {manpowerGap >= 0 ? <span style={{ color: '#59A14F' }}>เหลือ {manpowerGap.toFixed(1)}</span> : <span style={{ color: '#E15759', fontWeight: 700 }}>ขาด {Math.abs(manpowerGap).toFixed(1)}</span>}
                      </p>
                      {workload.length > 0 ? (
                        <div style={{ position: 'relative', height: 28, borderRadius: 8, background: 'rgba(107,114,128,0.06)', overflow: 'hidden' }}>
                          {/* Demand bar */}
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min((manpowerNeed / Math.max(sheCount, manpowerNeed)) * 100, 100)}%`, borderRadius: 8, background: '#4E79A7', opacity: 0.25 }} />
                          {/* Capacity bar */}
                          <div style={{ position: 'absolute', top: 4, left: 0, height: 20, width: `${Math.min((sheCount / Math.max(sheCount, manpowerNeed)) * 100, 100)}%`, borderRadius: 6, background: manpowerGap >= 0 ? '#59A14F' : '#E15759', transition: 'width 0.3s' }} />
                          {/* Target line at demand */}
                          <div style={{ position: 'absolute', top: 0, left: `${(manpowerNeed / Math.max(sheCount, manpowerNeed)) * 100}%`, width: 2, height: '100%', background: '#4E79A7', borderRadius: 1 }} />
                          {/* Labels */}
                          <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 700, color: '#fff' }}>มี {sheCount}</div>
                        </div>
                      ) : (
                        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, background: 'rgba(107,114,128,0.04)', borderRadius: 8 }}>เพิ่มข้อมูลภาระงานเพื่อคำนวณ</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 6, borderRadius: 3, background: manpowerGap >= 0 ? '#59A14F' : '#E15759', display: 'inline-block' }} /> กำลังคนปัจจุบัน</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 6, borderRadius: 3, background: '#4E79A7', opacity: 0.25, display: 'inline-block' }} /> ความต้องการ</span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted, #999)' }}>สูตร: เวลารวม ÷ 97,440 นาที/ปี/คน</span>
                      </div>
                    </div>
                    {/* Mini KPI */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>เวลารวม/ปี</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{grandTotalMin > 0 ? `${(grandTotalMin / 60).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : '0'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>ชั่วโมง ({grandTotalMin.toLocaleString()} นาที)</div>
                      </div>
                      <div style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>รายการงาน</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{workload.length}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{Object.keys(workloadByFn).length} Functions</div>
                      </div>
                    </div>
                  </div>

                  {/* Workload Table */}
                  <div className="glass-card rounded-xl" style={{ border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 480px)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                            {['#', 'Function', 'Level 1', 'Level 2', 'Level 3', 'Rank', 'Type', 'เวลา(นาที)', 'ความถี่', 'รวม/ปี', ''].map((h, i) => (
                              <th key={i} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {workload.length === 0 ? (
                            <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                              <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                              <div>ยังไม่มีข้อมูลภาระงาน</div>
                            </td></tr>
                          ) : workload.map((w, i) => {
                            const annual = w.time_usage_min * w.frequency_count * (FREQ_MULTIPLIER[w.frequency] || 1);
                            return (
                              <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ ...tdStyle, color: 'var(--text-secondary)', width: 40 }}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{w.function_name || '-'}</td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{w.job_level1 || '-'}</td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{w.job_level2 || '-'}</td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{w.job_level3 || '-'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: w.job_rank === 'A' ? '#ff3b3015' : w.job_rank === 'B' ? '#ff950015' : '#007aff15', color: w.job_rank === 'A' ? '#ff3b30' : w.job_rank === 'B' ? '#ff9500' : '#007aff', fontWeight: 700 }}>{w.job_rank}</span></td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{w.job_type === 'fixed' ? 'Fixed' : 'Variable'}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{w.time_usage_min.toLocaleString()}</td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{FREQ_LABELS[w.frequency] || w.frequency} ×{w.frequency_count}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{annual.toLocaleString()}</td>
                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                  <button onClick={() => { setEditW({ ...w }); setShowWModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Pencil size={14} color="var(--accent)" /></button>
                                  <button onClick={() => w.id && deleteWorkload(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={14} color="#ff3b30" /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Function Summary with horizontal bars */}
                  {Object.keys(workloadByFn).length > 0 && (() => {
                    const fnEntries = Object.entries(workloadByFn).sort((a, b) => b[1].totalMin - a[1].totalMin);
                    const fnMax = fnEntries[0]?.[1].totalMin || 1;
                    return (
                      <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>สรุปตาม Function</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {fnEntries.map(([fn, data], i) => {
                            const manpower = data.totalMin / ANNUAL_MINUTES_PER_PERSON;
                            return (
                              <div key={fn}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{fn}</span>
                                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{data.entries} งาน</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4E79A7', minWidth: 45, textAlign: 'right' }}>{manpower.toFixed(1)} คน</span>
                                </div>
                                <div style={{ height: 7, borderRadius: 4, background: 'rgba(107,114,128,0.08)' }}>
                                  <div style={{ height: '100%', borderRadius: 4, width: `${(data.totalMin / fnMax) * 100}%`, background: i === 0 ? '#4E79A7' : '#BAB0AC', opacity: i === 0 ? 1 : 0.6, transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══════ MODALS ═══════ */}

        {/* Personnel Modal */}
        <Modal show={showPModal} title={editP?.id ? 'แก้ไขบุคลากร' : 'เพิ่มบุคลากร'} onClose={() => { setShowPModal(false); setEditP(null); }} onSave={savePersonnel} saving={saving}>
          {editP && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: editP.is_she_team !== false ? '#34c75910' : '#ff950010', border: `1px solid ${editP.is_she_team !== false ? '#34c75930' : '#ff950030'}`, cursor: 'pointer' }} onClick={() => setEditP({ ...editP, is_she_team: !editP.is_she_team, department: !editP.is_she_team ? 'HSE' : editP.department })}>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: editP.is_she_team !== false ? '#34c759' : '#ff9500', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: editP.is_she_team !== false ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{editP.is_she_team !== false ? 'บุคลากรทีม SHE' : 'ผู้ได้รับแต่งตั้ง (นอกแผนก SHE)'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{editP.is_she_team !== false ? 'สังกัดแผนกความปลอดภัยและสิ่งแวดล้อม' : 'สังกัดแผนกอื่น แต่ได้รับแต่งตั้งตามกฎหมาย'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>ชื่อ-นามสกุล *</FieldLabel><input style={inputStyle} value={editP.full_name} onChange={e => setEditP({ ...editP, full_name: e.target.value })} /></div>
                <div><FieldLabel>ชื่อเล่น</FieldLabel><input style={inputStyle} value={editP.nick_name} onChange={e => setEditP({ ...editP, nick_name: e.target.value })} /></div>
              </div>
              {editP.is_she_team === false && (
                <div><FieldLabel>แผนกที่สังกัด *</FieldLabel><input style={inputStyle} placeholder="เช่น Production, Engineering, QA" value={editP.department} onChange={e => setEditP({ ...editP, department: e.target.value })} /></div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>ตำแหน่ง</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editP.position} onChange={e => setEditP({ ...editP, position: e.target.value })}>
                      <option value="">เลือก...</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
                <div><FieldLabel>หน้าที่หลัก</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editP.responsibility} onChange={e => setEditP({ ...editP, responsibility: e.target.value })}>
                      <option value="">เลือก...</option>
                      {RESPONSIBILITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
              </div>
              <div><FieldLabel>ประเภทการจ้าง</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <select style={selectStyle} value={editP.employment_type} onChange={e => setEditP({ ...editP, employment_type: e.target.value })}>
                    {Object.entries(EMP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>โทรศัพท์</FieldLabel><input style={inputStyle} value={editP.phone} onChange={e => setEditP({ ...editP, phone: e.target.value })} /></div>
                <div><FieldLabel>อีเมล</FieldLabel><input style={inputStyle} type="email" value={editP.email} onChange={e => setEditP({ ...editP, email: e.target.value })} /></div>
              </div>
            </div>
          )}
        </Modal>

        {/* Requirement Modal */}
        <Modal show={showRModal} title={editR?.id ? 'แก้ไขประเภทใบอนุญาต' : 'เพิ่มประเภทใบอนุญาต'} onClose={() => { setShowRModal(false); setEditR(null); }} onSave={saveReq} saving={saving}>
          {editR && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><FieldLabel>ชื่อเต็ม *</FieldLabel><input style={inputStyle} placeholder="เจ้าหน้าที่ความปลอดภัยระดับวิชาชีพ" value={editR.name} onChange={e => setEditR({ ...editR, name: e.target.value })} /></div>
              <div><FieldLabel>ชื่อย่อ *</FieldLabel><input style={inputStyle} placeholder="จป.วิชาชีพ" value={editR.short_name} onChange={e => setEditR({ ...editR, short_name: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>หมวด</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editR.category} onChange={e => setEditR({ ...editR, category: e.target.value })}>
                      <option value="safety">Safety</option>
                      <option value="environment">Environment</option>
                      <option value="health">Occupational Health</option>
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
                <div><FieldLabel>จำนวนที่กฎหมายกำหนด</FieldLabel><input style={inputStyle} type="number" min="0" value={editR.required_count} onChange={e => setEditR({ ...editR, required_count: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: editR.is_required ? '#007aff10' : '#f3f4f6', border: `1px solid ${editR.is_required ? '#007aff30' : '#e5e7eb'}`, cursor: 'pointer' }} onClick={() => setEditR({ ...editR, is_required: !editR.is_required })}>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: editR.is_required ? '#007aff' : '#d1d5db', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: editR.is_required ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{editR.is_required ? 'บริษัทต้องมี (บังคับ)' : 'บุคลากรมี (ไม่บังคับ)'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{editR.is_required ? 'นับเข้า compliance ตามกฎหมาย' : 'บุคลากรมีใบอนุญาตนี้ แต่บริษัทไม่จำเป็นต้องมี'}</div>
                </div>
              </div>
              <div><FieldLabel>อ้างอิงกฎหมาย</FieldLabel><input style={inputStyle} placeholder="พ.ร.บ. ความปลอดภัยฯ พ.ศ. 2554" value={editR.law_reference} onChange={e => setEditR({ ...editR, law_reference: e.target.value })} /></div>
              <div><FieldLabel>คำอธิบาย</FieldLabel><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={editR.description} onChange={e => setEditR({ ...editR, description: e.target.value })} /></div>
            </div>
          )}
        </Modal>

        {/* Workload Modal */}
        <Modal show={showWModal} title={editW?.id ? 'แก้ไขรายการ' : 'เพิ่มรายการภาระงาน'} onClose={() => { setShowWModal(false); setEditW(null); }} onSave={saveWorkload} saving={saving}>
          {editW && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><FieldLabel>Function</FieldLabel><input style={inputStyle} placeholder="Safety & Health" value={editW.function_name} onChange={e => setEditW({ ...editW, function_name: e.target.value })} /></div>
              <div><FieldLabel>Level 1 (หัวข้องานหลัก)</FieldLabel><input style={inputStyle} value={editW.job_level1} onChange={e => setEditW({ ...editW, job_level1: e.target.value })} /></div>
              <div><FieldLabel>Level 2 (ฟังก์ชั่นย่อย)</FieldLabel><input style={inputStyle} value={editW.job_level2} onChange={e => setEditW({ ...editW, job_level2: e.target.value })} /></div>
              <div><FieldLabel>Level 3 (รายละเอียด)</FieldLabel><input style={inputStyle} value={editW.job_level3} onChange={e => setEditW({ ...editW, job_level3: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><FieldLabel>Job Rank</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editW.job_rank} onChange={e => setEditW({ ...editW, job_rank: e.target.value })}>
                      <option value="A">A (ทักษะสูง)</option>
                      <option value="B">B (ซับซ้อน)</option>
                      <option value="C">C (ทั่วไป)</option>
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
                <div><FieldLabel>Job Type</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editW.job_type} onChange={e => setEditW({ ...editW, job_type: e.target.value })}>
                      <option value="fixed">Fixed</option>
                      <option value="variable">Variable</option>
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
                <div><FieldLabel>เวลา (นาที)</FieldLabel><input style={inputStyle} type="number" min="0" value={editW.time_usage_min} onChange={e => setEditW({ ...editW, time_usage_min: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>ความถี่</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select style={selectStyle} value={editW.frequency} onChange={e => setEditW({ ...editW, frequency: e.target.value })}>
                      <option value="daily">รายวัน</option>
                      <option value="weekly">รายสัปดาห์</option>
                      <option value="monthly">รายเดือน</option>
                      <option value="yearly">รายปี</option>
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
                  </div>
                </div>
                <div><FieldLabel>จำนวนครั้ง</FieldLabel><input style={inputStyle} type="number" min="1" value={editW.frequency_count} onChange={e => setEditW({ ...editW, frequency_count: parseInt(e.target.value) || 1 })} /></div>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
