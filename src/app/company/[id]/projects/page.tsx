'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  FolderKanban, Plus, X, ChevronRight, Search,
  Calendar, User, Wallet, Lock, LogIn,
  LayoutGrid, LayoutList, AlertTriangle, Clock3,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface SpecialProject {
  id: string;
  company_id: string;
  plan_type: 'safety' | 'environment' | null;
  project_scope: 'internal' | 'cross_dept';
  requesting_dept: string | null;
  category: string | null;
  title: string;
  description: string | null;
  owner: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  completion_pct: number;
  budget_planned: number;
  budget_actual: number;
  notes: string | null;
  created_at: string;
  milestone_counts: { total: number; done: number };
}

// ─── Config ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  planning:  { label: 'วางแผน',      color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  active:    { label: 'ดำเนินการ',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  on_hold:   { label: 'พักชั่วคราว', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  completed: { label: 'เสร็จสิ้น',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { label: 'ยกเลิก',      color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
};

const PLAN_TYPE_CONFIG = {
  safety:      { label: 'Safety',      color: '#ff6b35', bg: 'rgba(255,107,53,0.1)' },
  environment: { label: 'Environment', color: '#34c759', bg: 'rgba(52,199,89,0.1)'  },
};

const CATEGORY_OPTIONS = ['compliance', 'infrastructure', 'csr', 'capex', 'training', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  compliance: 'Compliance', infrastructure: 'โครงสร้างพื้นฐาน',
  csr: 'CSR', capex: 'CAPEX', training: 'Training', other: 'อื่นๆ',
};

function formatDate(d: string) {
  if (!d) return '-';
  const dt = new Date(d);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}
function formatBudget(n: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// ─── Create Project Modal ─────────────────────────────────────
function CreateProjectModal({ companyId, onClose, onCreated }: {
  companyId: string;
  onClose: () => void;
  onCreated: (p: SpecialProject) => void;
}) {
  const [form, setForm] = useState({
    title: '', description: '', owner: '', plan_type: '',
    project_scope: 'internal', requesting_dept: '', category: '',
    start_date: '', end_date: '', budget_planned: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<{ name: string; position?: string }[]>([]);

  useEffect(() => {
    fetch(`/api/training/employees?companyId=${companyId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEmployees(data); })
      .catch(() => {});
  }, [companyId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.owner || !form.start_date || !form.end_date) {
      setError('กรุณากรอก ชื่อโครงการ, เจ้าของ, วันเริ่ม, วันสิ้นสุด');
      return;
    }
    setSaving(true); setError('');
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        plan_type: form.plan_type || null,
        project_scope: form.project_scope,
        requesting_dept: form.requesting_dept || null,
        category: form.category || null,
        title: form.title,
        description: form.description || null,
        owner: form.owner,
        status: 'planning',
        start_date: form.start_date,
        end_date: form.end_date,
        budget_planned: parseFloat(form.budget_planned) || 0,
        notes: form.notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); setSaving(false); return; }
    onCreated({ ...data.project, milestone_counts: { total: 0, done: 0 } });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div>
            <h3 className="text-white font-bold text-[16px]">🏗️ สร้างโครงการใหม่</h3>
            <p className="text-indigo-200 text-[12px] mt-0.5">Special Project</p>
          </div>
          <button onClick={onClose} className="text-white opacity-70 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={labelStyle}>ชื่อโครงการ *</label>
            <input style={inputStyle} value={form.title}
              onChange={e => set('title', e.target.value)} />
          </div>

          {/* Owner */}
          <div>
            <label style={labelStyle}>ผู้รับผิดชอบหลัก *</label>
            {employees.length > 0 ? (
              <select style={inputStyle} value={form.owner} onChange={e => set('owner', e.target.value)}>
                <option value="">— เลือกผู้รับผิดชอบ —</option>
                {employees.map(emp => (
                  <option key={emp.name} value={emp.name}>{emp.name}{emp.position ? ` (${emp.position})` : ''}</option>
                ))}
              </select>
            ) : (
              <input style={inputStyle} value={form.owner} placeholder="ชื่อผู้รับผิดชอบ"
                onChange={e => set('owner', e.target.value)} />
            )}
          </div>

          {/* Plan type + Scope */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>ประเภทงาน</label>
              <select style={inputStyle} value={form.plan_type} onChange={e => set('plan_type', e.target.value)}>
                <option value="">ทั่วไป (ไม่ระบุ)</option>
                <option value="safety">🛡️ Safety</option>
                <option value="environment">🌿 Environment</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ขอบเขต</label>
              <select style={inputStyle} value={form.project_scope} onChange={e => set('project_scope', e.target.value)}>
                <option value="internal">ภายในฝ่าย</option>
                <option value="cross_dept">ข้ามแผนก</option>
              </select>
            </div>
          </div>

          {/* Requesting dept (if cross_dept) */}
          {form.project_scope === 'cross_dept' && (
            <div>
              <label style={labelStyle}>แผนกที่ขอ</label>
              <input style={inputStyle} value={form.requesting_dept} placeholder="เช่น Engineering, HR"
                onChange={e => set('requesting_dept', e.target.value)} />
            </div>
          )}

          {/* Category */}
          <div>
            <label style={labelStyle}>หมวดหมู่</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>วันเริ่มต้น *</label>
              <input type="date" style={inputStyle} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>วันสิ้นสุด *</label>
              <input type="date" style={inputStyle} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label style={labelStyle}>งบประมาณตามแผน (บาท)</label>
            <input type="number" style={inputStyle} value={form.budget_planned} placeholder="0"
              onChange={e => set('budget_planned', e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>รายละเอียด</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              value={form.description} placeholder="อธิบายวัตถุประสงค์และขอบเขตของโครงการ"
              onChange={e => set('description', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{ background: '#f3f4f6', color: '#6b7280' }}>
              ยกเลิก
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
              style={{ background: saving ? '#9ca3af' : 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {saving ? 'กำลังสร้าง...' : '✓ สร้างโครงการ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: SpecialProject; onClick: () => void }) {
  const st = STATUS_CONFIG[project.status];
  const pt = project.plan_type ? PLAN_TYPE_CONFIG[project.plan_type] : null;
  const pct = project.completion_pct;
  const barColor = pct >= 75 ? '#22c55e' : pct >= 25 ? '#f59e0b' : '#ef4444';
  const budgetPct = project.budget_planned > 0 ? Math.round((project.budget_actual / project.budget_planned) * 100) : 0;
  const overBudget = project.budget_actual > project.budget_planned && project.budget_planned > 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endDate = new Date(project.end_date);
  const isOverdue = endDate < today && !['completed', 'cancelled'].includes(project.status);
  const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  const dueSoon = !isOverdue && daysLeft <= 14 && !['completed', 'cancelled'].includes(project.status);

  return (
    <div onClick={onClick} className="rounded-2xl p-5 cursor-pointer transition-all hover:translate-y-[-2px]"
      style={{
        background: 'var(--card-solid)',
        border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}>

      {/* Top row: status badge + due risk */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{ background: st.bg, color: st.color }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: st.color }} />
            {st.label}
          </span>
          {pt && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
              style={{ background: pt.bg, color: pt.color }}>{pt.label}</span>
          )}
          {project.project_scope === 'cross_dept' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
              style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}>ข้ามแผนก</span>
          )}
        </div>
        {isOverdue && (
          <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <AlertTriangle size={10} /> เกินกำหนด
          </span>
        )}
        {dueSoon && (
          <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
            <Clock3 size={10} /> {daysLeft} วัน
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-bold mb-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
        {project.title}
      </h3>

      {/* Owner + timeline */}
      <div className="flex items-center gap-3 mb-3 flex-wrap text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1"><User size={11} /> {project.owner}</span>
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {formatDate(project.start_date)} – {formatDate(project.end_date)}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {project.milestone_counts.total > 0
              ? `Milestone ${project.milestone_counts.done}/${project.milestone_counts.total}`
              : 'ความคืบหน้า'}
          </span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: barColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>

      {/* Budget + arrow */}
      <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <Wallet size={11} />
          {project.budget_planned > 0
            ? <>
                <strong style={{ color: overBudget ? '#ef4444' : 'var(--text-primary)' }}>
                  ฿{formatBudget(project.budget_actual)}
                </strong>
                <span style={{ color: 'var(--muted)' }}> / ฿{formatBudget(project.budget_planned)}</span>
                {overBudget && <span className="ml-1 font-semibold text-[10px]" style={{ color: '#ef4444' }}>เกิน {budgetPct - 100}%</span>}
              </>
            : <span style={{ color: 'var(--muted)' }}>–</span>
          }
        </div>
        <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProjectsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);

  const [projects, setProjects] = useState<SpecialProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Filters + view
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'due' | 'progress' | 'name'>('newest');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const isLoggedIn = auth.isAdmin || !!auth.companyAuth[id];

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ companyId: id });
    const res = await fetch(`/api/projects?${params}`);
    const data = await res.json();
    setProjects(data.projects || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Computed values
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    overdue: projects.filter(p => {
      const d = new Date(p.end_date);
      return d < today && !['completed', 'cancelled'].includes(p.status);
    }).length,
    dueThisMonth: projects.filter(p => {
      const d = new Date(p.end_date);
      return d >= today && d <= thisMonthEnd && !['completed', 'cancelled'].includes(p.status);
    }).length,
    budgetAtRisk: projects.filter(p =>
      p.budget_planned > 0 && p.budget_actual > p.budget_planned * 0.85
    ).length,
    totalBudget: projects.reduce((s, p) => s + p.budget_planned, 0),
  };

  // Filter + sort logic
  const filtered = projects
    .filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterType === 'safety' && p.plan_type !== 'safety') return false;
      if (filterType === 'environment' && p.plan_type !== 'environment') return false;
      if (filterType === 'general' && p.plan_type !== null) return false;
      if (filterType === 'cross_dept' && p.project_scope !== 'cross_dept') return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
          !p.owner.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'due') return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      if (sortBy === 'progress') return b.completion_pct - a.completion_pct;
      if (sortBy === 'name') return a.title.localeCompare(b.title, 'th');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Login form state (for auth gate)
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginPass) return;
    setLoginLoading(true);
    setLoginError('');
    const result = await auth.companyLogin(id, loginUser, loginPass);
    setLoginLoading(false);
    if (!result.success) setLoginError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div
            className="rounded-2xl w-full max-w-[400px] overflow-hidden"
            style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' }}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)' }}>
                  <FolderKanban size={20} color="#fff" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-white">โครงการพิเศษ</h3>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>กรุณาเข้าสู่ระบบเพื่อดูข้อมูล</p>
                </div>
              </div>
            </div>
            {/* Form */}
            <div className="px-6 py-5">
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>ชื่อผู้ใช้</label>
              <div className="relative mb-4">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                  placeholder="ชื่อผู้ใช้ (ถ้ามี)" autoFocus
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                  style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }} />
              </div>
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>รหัสผ่าน</label>
              <div className="relative mb-4">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="รหัสผ่าน"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                  style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }} />
              </div>
              {loginError && (
                <div className="mb-4 px-3 py-2 rounded-lg text-[12px]" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{loginError}</div>
              )}
              <button onClick={handleLogin} disabled={!loginPass || loginLoading}
                className="w-full py-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  background: loginPass ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#e5e7eb',
                  color: loginPass ? '#fff' : '#9ca3af', cursor: loginPass ? 'pointer' : 'not-allowed',
                  opacity: loginLoading ? 0.7 : 1, border: 'none',
                  boxShadow: loginPass ? '0 4px 14px rgba(139,92,246,0.3)' : 'none',
                }}>
                {loginLoading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn size={16} />}
                {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.12)' }}>
                <FolderKanban size={18} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h1 className="text-[18px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  โครงการพิเศษ
                </h1>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  {company?.name || id.toUpperCase()} · โครงการนอกแผนงานประจำปี
                </p>
              </div>
            </div>
            {(auth.isAdmin || auth.companyAuth[id]) && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                <Plus size={15} /> สร้างโครงการ
              </button>
            )}
          </div>

          {/* KPI — actionable */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'โครงการทั้งหมด', value: stats.total, sub: `${stats.active} กำลังดำเนินการ`, color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
              { label: 'เกินกำหนด', value: stats.overdue, sub: stats.overdue > 0 ? 'ต้องติดตาม' : 'ปกติดี', color: stats.overdue > 0 ? '#ef4444' : '#22c55e', bg: stats.overdue > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)', border: stats.overdue > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)' },
              { label: 'ครบกำหนดเดือนนี้', value: stats.dueThisMonth, sub: 'ต้องติดตามความคืบหน้า', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
              { label: 'งบเกินเส้น 85%', value: stats.budgetAtRisk, sub: stats.budgetAtRisk > 0 ? `งบรวม ฿${(stats.totalBudget/1_000_000).toFixed(1)}M` : `งบรวม ฿${stats.totalBudget > 0 ? (stats.totalBudget/1_000_000).toFixed(1)+'M' : '–'}`, color: stats.budgetAtRisk > 0 ? '#ef4444' : '#3b82f6', bg: stats.budgetAtRisk > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.06)', border: stats.budgetAtRisk > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.15)' },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
                <div className="text-[24px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[12px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{k.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Toolbar: Search | Status | Type | Sort | View */}
          <div className="flex flex-wrap items-center gap-2 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-[260px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาโครงการ / เจ้าของ..."
                className="w-full rounded-lg text-[12px]"
                style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            {/* Status */}
            <div className="flex gap-1 flex-wrap">
              {[{ k: 'all', label: 'สถานะ: ทั้งหมด' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ k, label: v.label }))].map(f => (
                <button key={f.k} onClick={() => setFilterStatus(f.k)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: filterStatus === f.k ? '#6366f1' : 'var(--bg-secondary)',
                    color: filterStatus === f.k ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${filterStatus === f.k ? '#6366f1' : 'var(--border)'}`,
                  }}>{f.label}
                </button>
              ))}
            </div>

            {/* Type */}
            <div className="flex gap-1 flex-wrap">
              {[
                { k: 'all', label: 'ทุกประเภท' },
                { k: 'safety', label: 'Safety' },
                { k: 'environment', label: 'Environment' },
                { k: 'general', label: 'ทั่วไป' },
                { k: 'cross_dept', label: 'ข้ามแผนก' },
              ].map(f => (
                <button key={f.k} onClick={() => setFilterType(f.k)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: filterType === f.k ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: filterType === f.k ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${filterType === f.k ? 'var(--accent)' : 'var(--border)'}`,
                  }}>{f.label}
                </button>
              ))}
            </div>

            {/* Sort + View — pushed right */}
            <div className="ml-auto flex items-center gap-1.5">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg text-[11px] font-medium cursor-pointer"
                style={{ padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                <option value="newest">เรียง: ล่าสุด</option>
                <option value="due">เรียง: ใกล้ครบกำหนด</option>
                <option value="progress">เรียง: ความคืบหน้า</option>
                <option value="name">เรียง: ชื่อ A-Z</option>
              </select>
              <button onClick={() => setViewMode('card')}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: viewMode === 'card' ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', color: viewMode === 'card' ? '#6366f1' : 'var(--muted)', border: '1px solid var(--border)' }}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setViewMode('table')}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: viewMode === 'table' ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', color: viewMode === 'table' ? '#6366f1' : 'var(--muted)', border: '1px solid var(--border)' }}>
                <LayoutList size={14} />
              </button>
            </div>
          </div>

          {/* Result count */}
          {!loading && projects.length > 0 && (
            <p className="text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
              แสดง {filtered.length} จาก {projects.length} โครงการ
            </p>
          )}

          {/* Projects */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-7 h-7 border-[3px] border-t-indigo-500 rounded-full animate-spin mb-3"
                style={{ borderColor: 'var(--border)', borderTopColor: '#6366f1' }} />
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FolderKanban size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
              <p className="text-[14px] font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                {projects.length === 0 ? 'ยังไม่มีโครงการพิเศษ' : 'ไม่พบโครงการที่ตรงกับเงื่อนไข'}
              </p>
              <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
                {projects.length === 0 ? 'กดปุ่มสร้างโครงการเพื่อเริ่มต้น' : 'ลองเปลี่ยน filter หรือล้างคำค้นหา'}
              </p>
              {projects.length === 0 && isLoggedIn && (
                <button onClick={() => setShowCreate(true)}
                  className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  <Plus size={13} className="inline mr-1.5" />สร้างโครงการแรก
                </button>
              )}
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProjectCard key={p.id} project={p}
                  onClick={() => router.push(`/company/${id}/projects/${p.id}`)} />
              ))}
            </div>
          ) : (
            /* Table view */
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['โครงการ', 'สถานะ', 'เจ้าของ', 'กำหนดเสร็จ', 'คืบหน้า', 'งบประมาณ'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold"
                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const st = STATUS_CONFIG[p.status];
                    const endD = new Date(p.end_date);
                    const isOv = endD < today && !['completed','cancelled'].includes(p.status);
                    const barC = p.completion_pct >= 75 ? '#22c55e' : p.completion_pct >= 25 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={p.id} onClick={() => router.push(`/company/${id}/projects/${p.id}`)}
                        className="cursor-pointer transition-colors hover:bg-opacity-50"
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                          background: 'var(--card-solid)',
                        }}>
                        <td className="px-4 py-3">
                          <div className="font-semibold leading-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>{p.title}</div>
                          {p.plan_type && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{PLAN_TYPE_CONFIG[p.plan_type].label}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                            style={{ background: st.bg, color: st.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.owner}</td>
                        <td className="px-4 py-3">
                          <span style={{ color: isOv ? '#ef4444' : 'var(--text-secondary)', fontWeight: isOv ? 600 : 400 }}>
                            {formatDate(p.end_date)}{isOv && ' ⚠'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)', minWidth: 60 }}>
                              <div className="h-full rounded-full" style={{ width: `${p.completion_pct}%`, background: barC }} />
                            </div>
                            <span className="tabular-nums font-semibold text-[11px]" style={{ color: barC }}>{p.completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                          {p.budget_planned > 0
                            ? `฿${formatBudget(p.budget_planned)}`
                            : <span style={{ color: 'var(--muted)' }}>–</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateProjectModal
          companyId={id}
          onClose={() => setShowCreate(false)}
          onCreated={p => { setProjects(prev => [p, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
