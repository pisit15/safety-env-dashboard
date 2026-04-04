'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  FolderKanban, Plus, X, ChevronRight, Search,
  Calendar, User, Building2, TrendingUp, Wallet,
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
  planning:  { label: 'วางแผน',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: '📋' },
  active:    { label: 'ดำเนินการ',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: '🟢' },
  on_hold:   { label: 'พักชั่วคราว',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏸️' },
  completed: { label: 'เสร็จสิ้น',    color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '✅' },
  cancelled: { label: 'ยกเลิก',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '❌' },
};

const PLAN_TYPE_CONFIG = {
  safety:      { label: 'Safety',      color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', icon: '🛡️' },
  environment: { label: 'Environment', color: '#34c759', bg: 'rgba(52,199,89,0.12)',  icon: '🌿' },
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
            <input style={inputStyle} value={form.title} placeholder="เช่น ก่อสร้างโรงเก็บขยะ Solar Power Plant B3"
              onChange={e => set('title', e.target.value)} />
          </div>

          {/* Owner */}
          <div>
            <label style={labelStyle}>ผู้รับผิดชอบหลัก *</label>
            <input style={inputStyle} value={form.owner} placeholder="ชื่อผู้รับผิดชอบ"
              onChange={e => set('owner', e.target.value)} />
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

  return (
    <div onClick={onClick} className="rounded-2xl p-5 cursor-pointer transition-all hover:translate-y-[-2px]"
      style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>

      {/* Top badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {pt && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: pt.bg, color: pt.color }}>
            {pt.icon} {pt.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: st.bg, color: st.color }}>
          {st.icon} {st.label}
        </span>
        {project.project_scope === 'cross_dept' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
            🔗 ข้ามแผนก
          </span>
        )}
        {project.category && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {CATEGORY_LABELS[project.category] || project.category}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-bold mb-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
        {project.title}
      </h3>

      {/* Owner + dept */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <User size={12} /> {project.owner}
        </span>
        {project.requesting_dept && (
          <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--muted)' }}>
            <Building2 size={12} /> {project.requesting_dept}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
        <Calendar size={12} />
        <span>{formatDate(project.start_date)}</span>
        <span>→</span>
        <span>{formatDate(project.end_date)}</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            <TrendingUp size={10} className="inline mr-1" />ความคืบหน้า
          </span>
          <span className="text-[11px] font-bold" style={{ color: barColor }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }} />
        </div>
        {project.milestone_counts.total > 0 && (
          <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
            Milestone: {project.milestone_counts.done}/{project.milestone_counts.total} เสร็จ
          </div>
        )}
      </div>

      {/* Budget */}
      {(project.budget_planned > 0 || project.budget_actual > 0) && (
        <div className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <Wallet size={12} />
            <span>งบ: <strong>{formatBudget(project.budget_actual)}</strong> / {formatBudget(project.budget_planned)} บาท</span>
          </div>
          {project.budget_planned > 0 && (
            <span className="text-[11px] font-semibold"
              style={{ color: overBudget ? '#ef4444' : '#22c55e' }}>
              {overBudget ? `⚠ เกิน ${budgetPct - 100}%` : `${budgetPct}%`}
            </span>
          )}
        </div>
      )}

      {/* Arrow */}
      <div className="flex justify-end mt-3">
        <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
          ดูรายละเอียด <ChevronRight size={14} />
        </span>
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

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

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

  // Filter logic
  const filtered = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterType === 'safety' && p.plan_type !== 'safety') return false;
    if (filterType === 'environment' && p.plan_type !== 'environment') return false;
    if (filterType === 'general' && p.plan_type !== null) return false;
    if (filterType === 'cross_dept' && p.project_scope !== 'cross_dept') return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.owner.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Summary stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    onHold: projects.filter(p => p.status === 'on_hold').length,
    totalBudget: projects.reduce((s, p) => s + p.budget_planned, 0),
    usedBudget: projects.reduce((s, p) => s + p.budget_actual, 0),
  };

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderKanban size={48} className="mx-auto mb-4" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>กรุณาเข้าสู่ระบบก่อน</p>
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
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FolderKanban size={24} style={{ color: '#6366f1' }} />
                <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  โครงการพิเศษ
                </h1>
              </div>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {company?.name || id.toUpperCase()} — Special Projects &amp; Cross-department Initiatives
              </p>
            </div>
            {(auth.isAdmin || auth.companyAuth[id]) && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                <Plus size={16} /> สร้างโครงการ
              </button>
            )}
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'ทั้งหมด', value: stats.total, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
              { label: 'ดำเนินการ', value: stats.active, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
              { label: 'เสร็จสิ้น', value: stats.completed, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
              { label: 'พักชั่วคราว', value: stats.onHold, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              { label: 'งบรวม (M)', value: `${(stats.totalBudget / 1_000_000).toFixed(1)}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
              { label: 'ใช้แล้ว (M)', value: `${(stats.usedBudget / 1_000_000).toFixed(1)}`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-3 text-center" style={{ background: k.bg, border: `1px solid ${k.color}22` }}>
                <div className="text-[20px] font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาโครงการ / เจ้าของ..."
                className="w-full rounded-xl text-[13px]"
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            {/* Status filter */}
            <div className="flex gap-1.5 flex-wrap">
              {[{ k: 'all', label: 'ทั้งหมด' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ k, label: v.label }))].map(f => (
                <button key={f.k} onClick={() => setFilterStatus(f.k)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: filterStatus === f.k ? '#6366f1' : 'var(--bg-secondary)',
                    color: filterStatus === f.k ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${filterStatus === f.k ? '#6366f1' : 'var(--border)'}`,
                  }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { k: 'all', label: 'ทุกประเภท' },
                { k: 'safety', label: '🛡️ Safety' },
                { k: 'environment', label: '🌿 Envi' },
                { k: 'general', label: '📁 ทั่วไป' },
                { k: 'cross_dept', label: '🔗 ข้ามแผนก' },
              ].map(f => (
                <button key={f.k} onClick={() => setFilterType(f.k)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: filterType === f.k ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: filterType === f.k ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${filterType === f.k ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-t-indigo-500 rounded-full animate-spin mb-4"
                style={{ borderColor: 'var(--border)', borderTopColor: '#6366f1' }} />
              <p style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FolderKanban size={48} className="mx-auto mb-4" style={{ color: 'var(--muted)' }} />
              <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                {projects.length === 0 ? 'ยังไม่มีโครงการพิเศษ' : 'ไม่พบโครงการที่ตรงกับ filter'}
              </p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                {projects.length === 0 ? 'คลิก "สร้างโครงการ" เพื่อเริ่มต้น' : 'ลองเปลี่ยน filter หรือลบคำค้นหา'}
              </p>
              {projects.length === 0 && (
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  <Plus size={14} className="inline mr-1.5" />สร้างโครงการแรก
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProjectCard key={p.id} project={p}
                  onClick={() => router.push(`/company/${id}/projects/${p.id}`)} />
              ))}
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
