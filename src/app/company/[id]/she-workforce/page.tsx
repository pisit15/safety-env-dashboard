'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { getCompanyById } from '@/lib/companies';
import {
  Users, Shield, ShieldCheck, Briefcase, Plus, Pencil, Trash2, X, Check,
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
  const apiPost = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/she-workforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  };

  const savePersonnel = async () => {
    if (!editP || !editP.full_name.trim()) return;
    setSaving(true);
    await apiPost({ action: 'upsert_personnel', data: editP });
    setSaving(false);
    setShowPModal(false);
    setEditP(null);
    fetchData();
  };

  const deletePersonnel = async (id: string) => {
    if (!confirm('ลบบุคลากรนี้?')) return;
    await apiPost({ action: 'delete_personnel', id });
    fetchData();
  };

  const saveReq = async () => {
    if (!editR || !editR.name.trim()) return;
    setSaving(true);
    await apiPost({ action: 'upsert_requirement', data: editR });
    setSaving(false);
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
    await apiPost({ action: 'upsert_workload', data: editW });
    setSaving(false);
    setShowWModal(false);
    setEditW(null);
    fetchData();
  };

  const deleteWorkload = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return;
    await apiPost({ action: 'delete_workload', id });
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
  const ratio = employeeCount > 0 && sheCount > 0 ? `1:${Math.round(employeeCount / sheCount)}` : '-';
  const totalLicensed = licenses.filter(l => l.has_license).length;
  const totalReqSlots = personnel.length * requirements.length;

  // Responsibility breakdown
  const respMap: Record<string, number> = {};
  personnel.forEach(p => { const r = p.responsibility || 'อื่นๆ'; respMap[r] = (respMap[r] || 0) + 1; });
  const maxResp = Math.max(...Object.values(respMap), 1);

  // Employment type breakdown
  const empMap: Record<string, number> = {};
  personnel.forEach(p => { const t = p.employment_type || 'permanent'; empMap[t] = (empMap[t] || 0) + 1; });

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

  // ── Styles ──────────────────────────────────────────────────
  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 13 };

  // ================================================================
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
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
                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'บุคลากร SHE', value: sheCount, sub: 'คน', icon: Users, color: '#007aff' },
                      { label: 'SHE : พนักงาน', value: ratio, sub: employeeCount > 0 ? `จาก ${employeeCount} คน` : 'ยังไม่มีข้อมูลพนักงาน', icon: Briefcase, color: '#5856d6' },
                      { label: 'ใบอนุญาตที่มี', value: totalLicensed, sub: totalReqSlots > 0 ? `จาก ${totalReqSlots} ช่อง` : 'ยังไม่มีข้อกำหนด', icon: ShieldCheck, color: '#34c759' },
                      { label: 'Functions ที่ครอบคลุม', value: Object.keys(respMap).length, sub: 'ด้าน', icon: Shield, color: '#ff9500' },
                    ].map((kpi, i) => (
                      <div key={i} className="glass-card rounded-xl" style={{ padding: 20, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <kpi.icon size={20} color={kpi.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kpi.label}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, paddingLeft: 52 }}>{kpi.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* Responsibility */}
                    <div className="glass-card rounded-xl" style={{ padding: 20, border: '1px solid var(--border)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>หน้าที่หลัก (Responsibility)</h3>
                      {Object.entries(respMap).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่มีข้อมูล</p>
                      ) : Object.entries(respMap).sort((a, b) => b[1] - a[1]).map(([resp, count]) => (
                        <div key={resp} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{resp}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{count} คน</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-secondary)' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${(count / maxResp) * 100}%`, background: RESP_COLORS[resp] || '#6b7280', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Employment Type */}
                    <div className="glass-card rounded-xl" style={{ padding: 20, border: '1px solid var(--border)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>ประเภทการจ้าง</h3>
                      {Object.entries(empMap).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่มีข้อมูล</p>
                      ) : Object.entries(empMap).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: EMP_TYPE_COLORS[type] || '#6b7280' }} />
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{EMP_TYPES[type] || type}</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{count}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>คน</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal Compliance */}
                  <div className="glass-card rounded-xl" style={{ padding: 20, border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>สถานะใบอนุญาตตามกฎหมาย</h3>
                    {requirements.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>ยังไม่ได้ตั้งค่าประเภทใบอนุญาต — ไปที่แท็บ &quot;ใบอนุญาต&quot; เพื่อเพิ่ม</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {requirements.map(req => {
                          const held = licenses.filter(l => l.requirement_type_id === req.id && l.has_license).length;
                          const needed = req.required_count || 0;
                          const ok = needed === 0 || held >= needed;
                          return (
                            <div key={req.id} style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${ok ? '#34c75930' : '#ff3b3030'}`, background: ok ? '#34c75908' : '#ff3b3008' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {ok ? <Check size={16} color="#34c759" /> : <AlertTriangle size={16} color="#ff3b30" />}
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{req.short_name}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                มี {held} คน {needed > 0 ? `/ ต้องการ ${needed} คน` : '(ไม่กำหนดจำนวน)'}
                              </div>
                              {req.category && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: req.category === 'safety' ? '#f9731615' : req.category === 'environment' ? '#22c55e15' : '#007aff15', color: req.category === 'safety' ? '#f97316' : req.category === 'environment' ? '#22c55e' : '#007aff', fontWeight: 600, marginTop: 4, display: 'inline-block' }}>{req.category}</span>}
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
                      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                              <th style={{ ...thStyle, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 3 }}>ชื่อ</th>
                              {requirements.map(r => (
                                <th key={r.id} style={{ ...thStyle, textAlign: 'center', minWidth: 80, borderBottom: r.is_required ? '3px solid #007aff' : '3px solid #d1d5db', cursor: 'pointer' }}
                                  onClick={() => { setEditR({ ...r }); setShowRModal(true); }}>
                                  <div style={{ fontSize: 11, lineHeight: 1.3 }}>{r.short_name}</div>
                                  <div style={{ fontSize: 10, color: r.is_required ? '#007aff' : 'var(--text-secondary)', fontWeight: r.is_required ? 600 : 400 }}>{r.is_required ? 'บังคับ' : 'ไม่บังคับ'}</div>
                                  <Pencil size={10} style={{ marginTop: 2, opacity: 0.4 }} />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {personnel.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ ...tdStyle, fontWeight: 600, position: 'sticky', left: 0, background: 'var(--card-solid)', zIndex: 1, color: 'var(--text-primary)' }}>
                                  {p.full_name}
                                  {p.is_she_team === false && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: '#ff950015', color: '#ff9500', fontWeight: 600, marginLeft: 4 }}>{p.department || 'แต่งตั้ง'}</span>}
                                </td>
                                {requirements.map(r => {
                                  const lic = licenses.find(l => l.personnel_id === p.id && l.requirement_type_id === r.id);
                                  const has = lic?.has_license;
                                  return (
                                    <td key={r.id} style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                                      onClick={() => p.id && r.id && toggleLicense(p.id, r.id)}>
                                      {has ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#34c75920', color: '#34c759' }}>
                                          <Check size={16} />
                                        </span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#ff3b3010', color: '#ff3b3060' }}>
                                          <X size={14} />
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {/* Summary row */}
                            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                              <td style={{ ...tdStyle, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-primary)' }}>รวม</td>
                              {requirements.map(r => {
                                const count = licenses.filter(l => l.requirement_type_id === r.id && l.has_license).length;
                                const isOk = !r.is_required || count >= (r.required_count || 1);
                                return (
                                  <td key={r.id} style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                                    <span style={{ color: r.is_required ? (isOk ? '#34c759' : '#ff3b30') : 'var(--text-secondary)' }}>{count}</span>
                                    {r.is_required && r.required_count > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>/{r.required_count}</span>}
                                    {r.is_required && r.required_count === 0 && count === 0 && <span style={{ color: '#ff3b30', fontSize: 10, display: 'block' }}>ขาด</span>}
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

                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                    <div className="glass-card rounded-xl" style={{ padding: 16, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>เวลารวมต่อปี</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{grandTotalMin.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>นาที</div>
                    </div>
                    <div className="glass-card rounded-xl" style={{ padding: 16, border: `1px solid ${manpowerNeed > sheCount ? '#ff3b3030' : '#34c75930'}` }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>จำนวนคนที่ต้องการ</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: manpowerNeed > sheCount ? '#ff3b30' : '#34c759' }}>{manpowerNeed.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>คน (ปัจจุบันมี {sheCount} คน)</div>
                    </div>
                    <div className="glass-card rounded-xl" style={{ padding: 16, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>สูตรคำนวณ</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>เวลารวม ÷ 97,440 นาที/ปี/คน</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>(ทำงาน 5 วัน/สัปดาห์ = 232 วัน × 7 ชม. × 60 นาที)</div>
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

                  {/* Function Summary */}
                  {Object.keys(workloadByFn).length > 0 && (
                    <div className="glass-card rounded-xl" style={{ padding: 20, border: '1px solid var(--border)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>สรุปตาม Function</h3>
                      {Object.entries(workloadByFn).sort((a, b) => b[1].totalMin - a[1].totalMin).map(([fn, data]) => (
                        <div key={fn} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{fn}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.entries} งาน</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 80, textAlign: 'right' }}>{data.totalMin.toLocaleString()} นาที</span>
                          <span style={{ fontSize: 12, color: '#5856d6', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{(data.totalMin / ANNUAL_MINUTES_PER_PERSON).toFixed(1)} คน</span>
                        </div>
                      ))}
                    </div>
                  )}
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
