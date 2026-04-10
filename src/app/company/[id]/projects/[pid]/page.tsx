'use client';

import { useState, useEffect, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import {
  ArrowLeft, FolderKanban, Plus, Pencil, Trash2,
  Calendar, User, Building2, Wallet, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Save, X,
} from 'lucide-react';
import { STATUS, PALETTE, CATEGORY_COLORS, UI } from '@/lib/she-theme';
import {
  ProjectAttachment, AttachmentList, InlineUploader,
  FileDropZone, uploadPendingFiles,
} from '@/components/ProjectFileUpload';

// ─── Types ───────────────────────────────────────────────────
interface SpecialProject {
  id: string; company_id: string;
  plan_type: 'safety' | 'environment' | null;
  project_scope: 'internal' | 'cross_dept';
  requesting_dept: string | null;
  category: string | null;
  title: string; description: string | null; owner: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date: string; end_date: string;
  completion_pct: number;
  budget_planned: number; budget_actual: number;
  notes: string | null; created_at: string;
}

interface Milestone {
  id: string; project_id: string;
  title: string; description: string | null;
  order_no: number;
  planned_start: string | null; planned_end: string | null; actual_end: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'delayed' | 'cancelled';
  completion_pct: number; note: string | null;
  updated_at: string;
}

// ─── Config ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  planning:  { label: 'วางแผน',      color: PALETTE.primary,   bg: `${PALETTE.primary}18`,  icon: '📋' },
  active:    { label: 'ดำเนินการ',   color: STATUS.ok,         bg: STATUS.okBg,             icon: '🟢' },
  on_hold:   { label: 'พักชั่วคราว', color: STATUS.warning,    bg: STATUS.warningBg,        icon: '⏸️' },
  completed: { label: 'เสร็จสิ้น',   color: STATUS.positive,   bg: STATUS.positiveBg,       icon: '✅' },
  cancelled: { label: 'ยกเลิก',      color: STATUS.neutral,    bg: STATUS.neutralBg,        icon: '❌' },
};
const MILESTONE_STATUS_CONFIG = {
  pending:     { label: 'รอดำเนินการ', color: STATUS.neutral,   bg: STATUS.neutralBg,     icon: '○' },
  in_progress: { label: 'กำลังทำ',    color: PALETTE.primary,  bg: `${PALETTE.primary}18`, icon: '◑' },
  done:        { label: 'เสร็จ',       color: STATUS.positive,  bg: STATUS.positiveBg,     icon: '●' },
  delayed:     { label: 'ล่าช้า',     color: STATUS.warning,   bg: STATUS.warningBg,      icon: '⚠' },
  cancelled:   { label: 'ยกเลิก',     color: STATUS.critical,  bg: STATUS.criticalBg,     icon: '✕' },
};

const PLAN_TYPE_LABEL: Record<string, string> = { safety: '🛡️ Safety', environment: '🌿 Environment' };
const CATEGORY_LABELS: Record<string, string> = {
  compliance: 'การปฏิบัติตามกฎหมาย', infrastructure: 'โครงสร้างพื้นฐาน',
  csr: 'ความรับผิดชอบต่อสังคม (CSR)', capex: 'งบลงทุน (CAPEX)', training: 'การฝึกอบรม', other: 'อื่นๆ',
};

function fmt(d: string | null) {
  if (!d) return '-';
  const dt = new Date(d);
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}
function fmtB(n: number) {
  if (!n) return '0';
  return n.toLocaleString('th-TH');
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', borderRadius: 8, fontSize: 13,
  background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827', outline: 'none',
};

// ─── Milestone Row ────────────────────────────────────────────
function MilestoneRow({ ms, projectId, onUpdated, onDeleted, onProjectSync, isAdmin }: {
  ms: Milestone; projectId: string;
  onUpdated: (m: Milestone) => void;
  onDeleted: (id: string) => void;
  onProjectSync: (p: SpecialProject) => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: ms.status, completion_pct: String(ms.completion_pct),
    actual_end: ms.actual_end || '', note: ms.note || '',
  });
  const [saving, setSaving] = useState(false);

  const st = MILESTONE_STATUS_CONFIG[ms.status];

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/milestones/${ms.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: form.status,
        completion_pct: Math.min(100, Math.max(0, parseInt(form.completion_pct) || 0)),
        actual_end: form.actual_end || null,
        note: form.note || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onUpdated(data.milestone);
      if (data.project) onProjectSync(data.project);
      setEditing(false);
    }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm(`ลบ Milestone "${ms.title}" ใช่ไหม?`)) return;
    const res = await fetch(`/api/projects/${projectId}/milestones/${ms.id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      onDeleted(ms.id);
      if (data.project) onProjectSync(data.project);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${editing ? '#6366f1' : 'var(--border)'}`, background: 'var(--bg-secondary)' }}>

      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => { setExpanded(!expanded); setEditing(false); }}>
        <span className="text-[16px] flex-shrink-0">{st.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ms.title}</span>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {ms.planned_end && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                <Calendar size={10} className="inline mr-1" />กำหนด {fmt(ms.planned_end)}
              </span>
            )}
            {ms.actual_end && (
              <span className="text-[11px]" style={{ color: STATUS.positive }}>
                ✓ เสร็จ {fmt(ms.actual_end)}
              </span>
            )}
          </div>
        </div>

        {/* Mini progress */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full" style={{
              width: `${ms.completion_pct}%`,
              background: ms.completion_pct >= 75 ? PALETTE.primary : ms.completion_pct >= 25 ? STATUS.warning : STATUS.critical,
            }} />
          </div>
          <span className="text-[11px] font-medium w-8 text-right" style={{ color: 'var(--text-secondary)' }}>
            {ms.completion_pct}%
          </span>
        </div>

        {isAdmin && (
          <button onClick={e => { e.stopPropagation(); setEditing(!editing); setExpanded(true); }}
            className="p-1.5 rounded-lg transition-all hover:opacity-70" style={{ color: '#6366f1' }}>
            <Pencil size={14} />
          </button>
        )}
        {expanded ? <ChevronUp size={14} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--muted)' }} />}
      </div>

      {/* Expanded detail / edit */}
      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          {ms.description && (
            <p className="text-[12px] mb-3 mt-2" style={{ color: 'var(--text-secondary)' }}>{ms.description}</p>
          )}

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#374151' }}>สถานะ</label>
                  <select style={inputStyle} value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Milestone['status'] }))}>
                    {Object.entries(MILESTONE_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#374151' }}>ความคืบหน้า (%)</label>
                  <input type="number" min={0} max={100} style={inputStyle} value={form.completion_pct}
                    onChange={e => setForm(f => ({ ...f, completion_pct: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#374151' }}>วันที่เสร็จจริง</label>
                <DateInput style={inputStyle} value={form.actual_end} onChange={v => setForm(f => ({ ...f, actual_end: v }))} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#374151' }}>หมายเหตุ</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="บันทึกความก้าวหน้า ปัญหา หรือหมายเหตุ..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px]"
                  style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  <X size={12} /> ยกเลิก
                </button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                  style={{ background: saving ? '#9ca3af' : '#6366f1' }}>
                  <Save size={12} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={del} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] ml-auto"
                  style={{ background: STATUS.criticalBg, color: STATUS.critical }}>
                  <Trash2 size={12} /> ลบ
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 mt-2">
              {ms.note && (
                <div className="rounded-lg p-3 text-[12px]" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                  <span className="font-medium mr-1">📝</span>{ms.note}
                </div>
              )}
              {ms.planned_start && (
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  เริ่มแผน: {fmt(ms.planned_start)} — สิ้นสุดแผน: {fmt(ms.planned_end)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Milestone Modal ──────────────────────────────────────
function AddMilestoneModal({ projectId, onClose, onAdded, onProjectSync }: {
  projectId: string;
  onClose: () => void;
  onAdded: (m: Milestone) => void;
  onProjectSync: (p: SpecialProject) => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', planned_start: '', planned_end: '' });
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.title) { setError('กรุณากรอกชื่อ Milestone'); return; }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); setSaving(false); return; }

    // Upload pending files if any
    if (pendingFiles.length > 0 && data.milestone?.id) {
      await uploadPendingFiles(projectId, data.milestone.id, pendingFiles, '');
    }

    onAdded(data.milestone);
    if (data.project) onProjectSync(data.project);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <h3 className="text-white font-bold">➕ เพิ่ม Milestone</h3>
          <button onClick={onClose} className="text-white opacity-70"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="p-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>{error}</div>}
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: '#374151' }}>ชื่อ Milestone *</label>
            <input style={inputStyle} placeholder="เช่น Phase 1: เตรียมพื้นที่" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: '#374151' }}>รายละเอียด</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: '#374151' }}>วันเริ่ม (แผน)</label>
              <DateInput style={inputStyle} value={form.planned_start} onChange={v => setForm(f => ({ ...f, planned_start: v }))} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: '#374151' }}>วันสิ้นสุด (แผน)</label>
              <DateInput style={inputStyle} value={form.planned_end} onChange={v => setForm(f => ({ ...f, planned_end: v }))} />
            </div>
          </div>
          {/* File Attachments */}
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: '#374151' }}>แนบไฟล์ / รูปภาพ</label>
            <FileDropZone files={pendingFiles} setFiles={setPendingFiles} maxFiles={5} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px]"
              style={{ background: '#f3f4f6', color: '#6b7280' }}>ยกเลิก</button>
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: saving ? '#9ca3af' : '#6366f1' }}>
              {saving ? 'กำลังเพิ่ม...' : '✓ เพิ่ม Milestone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Project Modal ──────────────────────────────────────
const CATEGORY_OPTIONS = ['compliance', 'infrastructure', 'csr', 'capex', 'training', 'other'];

function EditProjectModal({ project, companyId, onClose, onSaved }: {
  project: SpecialProject;
  companyId: string;
  onClose: () => void;
  onSaved: (p: SpecialProject) => void;
}) {
  const [form, setForm] = useState({
    title: project.title,
    description: project.description || '',
    owner: project.owner,
    plan_type: project.plan_type || '',
    project_scope: project.project_scope,
    requesting_dept: project.requesting_dept || '',
    category: project.category || '',
    start_date: project.start_date,
    end_date: project.end_date,
    budget_planned: String(project.budget_planned || ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [companyUsers, setCompanyUsers] = useState<{ username: string; display_name?: string }[]>([]);
  useEffect(() => {
    fetch(`/api/company-users?companyId=${companyId}`)
      .then(r => r.json())
      .then(data => { if (data?.users) setCompanyUsers(data.users); })
      .catch(() => {});
  }, [companyId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.owner || !form.start_date || !form.end_date) {
      setError('กรุณากรอก ชื่อโครงการ, เจ้าของ, วันเริ่ม, วันสิ้นสุด');
      return;
    }
    setSaving(true); setError('');
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        owner: form.owner,
        plan_type: form.plan_type || null,
        project_scope: form.project_scope,
        requesting_dept: form.requesting_dept || null,
        category: form.category || null,
        start_date: form.start_date,
        end_date: form.end_date,
        budget_planned: parseFloat(form.budget_planned) || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); setSaving(false); return; }
    onSaved(data.project);
  };

  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-5 pb-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div>
            <h3 className="text-white font-bold text-[16px]">✏️ แก้ไขโครงการ</h3>
            <p className="text-indigo-200 text-[12px] mt-0.5">Edit Project</p>
          </div>
          <button onClick={onClose} className="text-white opacity-70 hover:opacity-100"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>{error}</div>
          )}

          <div>
            <label style={lbl}>ชื่อโครงการ *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div>
            <label style={lbl}>ผู้รับผิดชอบหลัก *</label>
            <select style={inputStyle} value={form.owner} onChange={e => set('owner', e.target.value)}>
              <option value="">— เลือก —</option>
              {companyUsers.map(u => (
                <option key={u.username} value={u.display_name || u.username}>{u.display_name || u.username}</option>
              ))}
              {/* Keep current owner if not in list */}
              {form.owner && !companyUsers.find(u => (u.display_name || u.username) === form.owner) && (
                <option value={form.owner}>{form.owner}</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>ประเภทงาน</label>
              <select style={inputStyle} value={form.plan_type} onChange={e => set('plan_type', e.target.value)}>
                <option value="">ทั่วไป</option>
                <option value="safety">Safety</option>
                <option value="environment">Environment</option>
              </select>
            </div>
            <div>
              <label style={lbl}>ขอบเขต</label>
              <select style={inputStyle} value={form.project_scope} onChange={e => set('project_scope', e.target.value)}>
                <option value="internal">ภายในฝ่าย</option>
                <option value="cross_dept">ข้ามแผนก</option>
              </select>
            </div>
          </div>

          {form.project_scope === 'cross_dept' && (
            <div>
              <label style={lbl}>แผนกที่ขอ</label>
              <input style={inputStyle} value={form.requesting_dept} onChange={e => set('requesting_dept', e.target.value)} />
            </div>
          )}

          <div>
            <label style={lbl}>หมวดหมู่</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>วันเริ่มต้น *</label>
              <DateInput value={form.start_date} onChange={v => set('start_date', v)} inputStyle={inputStyle} />
            </div>
            <div>
              <label style={lbl}>วันสิ้นสุด *</label>
              <DateInput value={form.end_date} onChange={v => set('end_date', v)} inputStyle={inputStyle} />
            </div>
          </div>

          <div>
            <label style={lbl}>งบประมาณตามแผน (บาท)</label>
            <input type="number" style={inputStyle} value={form.budget_planned} onChange={e => set('budget_planned', e.target.value)} />
          </div>

          <div>
            <label style={lbl}>รายละเอียด</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ background: '#f3f4f6', color: '#6b7280' }}>ยกเลิก</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: saving ? '#9ca3af' : 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {saving ? 'กำลังบันทึก...' : '✓ บันทึกการแก้ไข'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id, pid } = useParams() as { id: string; pid: string };
  const router = useRouter();
  const auth = useAuth();
  const isAdmin = auth.isAdmin || !!auth.companyAuth[id];

  const [project, setProject] = useState<SpecialProject | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!confirm(`ลบโครงการ "${project.title}" ใช่ไหม?\n\nการลบจะลบ Milestone ทั้งหมดด้วย และไม่สามารถกู้คืนได้`)) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${pid}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(`/company/${id}/projects`);
    } else {
      alert('เกิดข้อผิดพลาดในการลบ');
      setDeleting(false);
    }
  };

  // Inline edit states
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetActual, setBudgetActual] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPct, setEditingPct] = useState(false);
  const [pctVal, setPctVal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [res, attRes] = await Promise.all([
      fetch(`/api/projects/${pid}`),
      fetch(`/api/projects/${pid}/attachments`),
    ]);
    const data = await res.json();
    if (res.ok) {
      setProject(data.project);
      setMilestones(data.milestones || []);
      setBudgetActual(String(data.project.budget_actual || 0));
      setNotesVal(data.project.notes || '');
      setPctVal(String(data.project.completion_pct || 0));
    }
    const attData = await attRes.json();
    setAttachments(attData.attachments || []);
    setLoading(false);
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  const updateProject = async (fields: Partial<SpecialProject>) => {
    const res = await fetch(`/api/projects/${pid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (res.ok) setProject(data.project);
    return res.ok;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-t-indigo-500 rounded-full animate-spin mb-4"
              style={{ borderColor: 'var(--border)', borderTopColor: '#6366f1' }} />
            <p style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p style={{ color: 'var(--text-secondary)' }}>ไม่พบโครงการนี้</p>
            <button onClick={() => router.push(`/company/${id}/projects`)} className="mt-4 text-indigo-500 underline text-sm">
              กลับหน้ารายการโครงการ
            </button>
          </div>
        </main>
      </div>
    );
  }

  const st = STATUS_CONFIG[project.status];
  const pct = project.completion_pct;
  const barColor = pct >= 75 ? PALETTE.primary : pct >= 25 ? STATUS.warning : STATUS.critical;
  const overBudget = project.budget_actual > project.budget_planned && project.budget_planned > 0;
  const doneMilestones = milestones.filter(m => m.status === 'done').length;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">

          {/* Back button row */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => router.push(`/company/${id}/projects`)}
              className="flex items-center gap-2 text-[13px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-secondary)' }}>
              <ArrowLeft size={16} /> กลับหน้ารายการโครงการ
            </button>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEditProject(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:opacity-80"
                  style={{ background: `${PALETTE.primary}15`, color: PALETTE.primary, border: `1px solid ${PALETTE.primary}40` }}>
                  <Pencil size={13} /> แก้ไขโครงการ
                </button>
                <button onClick={handleDeleteProject} disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:opacity-80"
                  style={{ background: STATUS.criticalBg, color: STATUS.critical, border: `1px solid ${STATUS.critical}40` }}>
                  <Trash2 size={13} /> {deleting ? 'กำลังลบ...' : 'ลบโครงการ'}
                </button>
              </div>
            )}
          </div>

          {/* Project Header Card */}
          <div className="rounded-2xl p-6 mb-5"
            style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>

            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {project.plan_type && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${CATEGORY_COLORS[project.plan_type === 'safety' ? 'safety' : 'environment']}18`, color: CATEGORY_COLORS[project.plan_type === 'safety' ? 'safety' : 'environment'] }}>
                      {PLAN_TYPE_LABEL[project.plan_type]}
                    </span>
                  )}
                  {project.category && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                      {CATEGORY_LABELS[project.category] || project.category}
                    </span>
                  )}
                  {project.project_scope === 'cross_dept' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
                      🔗 ข้ามแผนก
                    </span>
                  )}
                </div>

                <h1 className="text-[20px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {project.title}
                </h1>

                {project.description && (
                  <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
                )}

                <div className="flex flex-wrap gap-4">
                  <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    <User size={14} /> {project.owner}
                  </span>
                  {project.requesting_dept && (
                    <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                      <Building2 size={14} /> {project.requesting_dept}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                    <Calendar size={14} /> {fmt(project.start_date)} → {fmt(project.end_date)}
                  </span>
                </div>
              </div>

              {/* Status badge + edit */}
              <div className="flex flex-col items-end gap-2">
                {editingStatus && isAdmin ? (
                  <select
                    className="rounded-lg text-[12px] font-semibold px-2 py-1"
                    style={{ border: '1px solid #6366f1', color: '#6366f1', background: '#eef2ff' }}
                    value={project.status}
                    onChange={async e => {
                      await updateProject({ status: e.target.value as SpecialProject['status'] });
                      setEditingStatus(false);
                    }}
                    onBlur={() => setEditingStatus(false)}
                    autoFocus>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                ) : (
                  <button onClick={() => isAdmin && setEditingStatus(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold"
                    style={{ background: st.bg, color: st.color }}>
                    {st.icon} {st.label}
                    {isAdmin && <Pencil size={11} className="opacity-60" />}
                  </button>
                )}
              </div>
            </div>

            {/* Progress + Budget + Timeline row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
              style={{ borderTop: '1px solid var(--border)' }}>

              {/* Progress */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[12px] font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={13} /> ความคืบหน้า
                  </span>
                  {editingPct && isAdmin ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100}
                        style={{ width: 56, padding: '2px 6px', borderRadius: 6, border: `1px solid ${PALETTE.primary}`, fontSize: 12, textAlign: 'center', background: `${PALETTE.primary}10`, color: PALETTE.primary }}
                        value={pctVal} onChange={e => setPctVal(e.target.value)} autoFocus />
                      <button onClick={async () => {
                        const v = Math.min(100, Math.max(0, parseInt(pctVal) || 0));
                        await updateProject({ completion_pct: v });
                        setEditingPct(false);
                      }} className="p-1 rounded text-white text-[11px]" style={{ background: PALETTE.primary }}><Save size={11} /></button>
                      <button onClick={() => setEditingPct(false)} className="p-1 rounded text-[11px]" style={{ color: 'var(--muted)' }}><X size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => isAdmin && setEditingPct(true)}
                      className="flex items-center gap-1 text-[13px] font-bold"
                      style={{ color: barColor }}>
                      {pct}% {isAdmin && <Pencil size={10} className="opacity-50" />}
                    </button>
                  )}
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                  {milestones.length > 0 ? `Milestone: ${doneMilestones}/${milestones.length} เสร็จ` : 'ยังไม่มี Milestone'}
                </div>
              </div>

              {/* Budget */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[12px] font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <Wallet size={13} /> งบประมาณ
                  </span>
                  {editingBudget && isAdmin ? (
                    <div className="flex items-center gap-1">
                      <input type="number" style={{ width: 90, padding: '2px 6px', borderRadius: 6, border: `1px solid ${PALETTE.primary}`, fontSize: 12, background: `${PALETTE.primary}10`, color: PALETTE.primary }}
                        value={budgetActual} onChange={e => setBudgetActual(e.target.value)} autoFocus />
                      <button onClick={async () => {
                        await updateProject({ budget_actual: parseFloat(budgetActual) || 0 });
                        setEditingBudget(false);
                      }} className="p-1 rounded text-white" style={{ background: PALETTE.primary }}><Save size={11} /></button>
                      <button onClick={() => setEditingBudget(false)} className="p-1 rounded" style={{ color: 'var(--muted)' }}><X size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => isAdmin && setEditingBudget(true)}
                      className="flex items-center gap-1 text-[13px] font-bold"
                      style={{ color: overBudget ? STATUS.critical : PALETTE.primary }}>
                      {overBudget ? '⚠' : '✓'} ใช้แล้ว {fmtB(project.budget_actual)} บาท
                      {isAdmin && <Pencil size={10} className="opacity-50" />}
                    </button>
                  )}
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  {project.budget_planned > 0 && (
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((project.budget_actual / project.budget_planned) * 100))}%`, background: overBudget ? STATUS.critical : PALETTE.primary }} />
                  )}
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                  แผน: {fmtB(project.budget_planned)} บาท
                  {project.budget_planned > 0 && ` · ใช้ ${Math.round((project.budget_actual / project.budget_planned) * 100)}%`}
                </div>
              </div>

              {/* Timeline indicator */}
              {(() => {
                const start = new Date(project.start_date).getTime();
                const end = new Date(project.end_date).getTime();
                const now = Date.now();
                const totalDuration = end - start;
                const elapsed = now - start;
                const timeProgress = totalDuration > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100))) : 0;
                const daysRemaining = Math.ceil((end - now) / 86400000);
                const isOverdue = now > end && !['completed', 'cancelled'].includes(project.status);
                const timeColor = isOverdue ? STATUS.critical : timeProgress > 80 ? STATUS.warning : PALETTE.muted;
                return (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[12px] font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                        <Calendar size={13} /> ระยะเวลา
                      </span>
                      <span className="text-[13px] font-bold" style={{ color: timeColor }}>
                        {isOverdue ? `เกิน ${Math.abs(daysRemaining)} วัน` : project.status === 'completed' ? 'เสร็จแล้ว' : `เหลือ ${daysRemaining} วัน`}
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--border)' }}>
                      {/* Time elapsed bar (light gray) */}
                      <div className="h-full rounded-full transition-all absolute inset-0"
                        style={{ width: `${timeProgress}%`, background: isOverdue ? `${STATUS.critical}30` : `${PALETTE.muted}60` }} />
                      {/* Completion overlay (shows how completion tracks vs time) */}
                      <div className="h-full rounded-full transition-all absolute inset-0"
                        style={{ width: `${pct}%`, background: barColor, opacity: 0.7 }} />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                      เวลาผ่าน {timeProgress}% · งานเสร็จ {pct}%
                      {timeProgress > 0 && pct > 0 && pct < timeProgress - 20 && (
                        <span style={{ color: STATUS.warning }}> · ช้ากว่าแผน</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Milestones Section */}
          <div className="rounded-2xl p-6 mb-5"
            style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Clock size={18} style={{ color: '#6366f1' }} />
                Milestones
                <span className="text-[13px] font-normal" style={{ color: 'var(--muted)' }}>
                  ({doneMilestones}/{milestones.length})
                </span>
              </h2>
              {isAdmin && (
                <button onClick={() => setShowAddMilestone(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: '#6366f1' }}>
                  <Plus size={14} /> เพิ่ม Milestone
                </button>
              )}
            </div>

            {/* Timeline removed — milestone list below already shows all info clearly */}

            {milestones.length === 0 ? (
              <div className="text-center py-10">
                <FolderKanban size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>ยังไม่มี Milestone</p>
                {isAdmin && (
                  <button onClick={() => setShowAddMilestone(true)}
                    className="mt-3 px-4 py-2 rounded-xl text-[12px] font-semibold text-white"
                    style={{ background: '#6366f1' }}>
                    <Plus size={13} className="inline mr-1" />เพิ่ม Milestone แรก
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {milestones.map(ms => (
                  <MilestoneRow
                    key={ms.id} ms={ms} projectId={pid} isAdmin={isAdmin}
                    onUpdated={updated => setMilestones(prev => prev.map(m => m.id === updated.id ? updated : m))}
                    onDeleted={deletedId => setMilestones(prev => prev.filter(m => m.id !== deletedId))}
                    onProjectSync={p => {
                      setProject(p);
                      setPctVal(String(p.completion_pct || 0));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="rounded-2xl p-6 mb-5"
            style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                📎 ไฟล์แนบ
                {attachments.length > 0 && (
                  <span className="text-[13px] font-normal" style={{ color: 'var(--muted)' }}>
                    ({attachments.length})
                  </span>
                )}
              </h2>
              {isAdmin && (
                <InlineUploader
                  projectId={pid}
                  uploadedBy={auth.isAdmin ? 'admin' : ''}
                  onUploaded={att => setAttachments(prev => [att, ...prev])}
                />
              )}
            </div>
            {attachments.length > 0 ? (
              <AttachmentList
                attachments={attachments}
                canDelete={isAdmin}
                onDelete={async (attId) => {
                  const res = await fetch(`/api/projects/${pid}/attachments?attachmentId=${attId}`, { method: 'DELETE' });
                  if (res.ok) setAttachments(prev => prev.filter(a => a.id !== attId));
                }}
              />
            ) : (
              <div className="text-center py-6">
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                  ยังไม่มีไฟล์แนบ
                  {isAdmin && ' — คลิก "แนบไฟล์" เพื่อเพิ่ม'}
                </p>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="rounded-2xl p-6"
            style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>📝 บันทึกโครงการ</h2>
              {isAdmin && !editingNotes && (
                <button onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 text-[12px]" style={{ color: '#6366f1' }}>
                  <Pencil size={13} /> แก้ไข
                </button>
              )}
            </div>

            {editingNotes ? (
              <div>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                  value={notesVal} onChange={e => setNotesVal(e.target.value)}
                  placeholder="บันทึกความเสี่ยง, ปัญหา, ผู้เกี่ยวข้อง, หรือข้อมูลสำคัญอื่นๆ..."
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setNotesVal(project.notes || ''); setEditingNotes(false); }}
                    className="px-4 py-2 rounded-xl text-[13px]" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                    ยกเลิก
                  </button>
                  <button onClick={async () => {
                    await updateProject({ notes: notesVal || null });
                    setEditingNotes(false);
                  }} className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white" style={{ background: '#6366f1' }}>
                    บันทึก
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-4 text-[13px]"
                style={{ background: 'var(--bg-secondary)', color: project.notes ? 'var(--text-primary)' : 'var(--muted)', minHeight: 80, whiteSpace: 'pre-wrap' }}>
                {project.notes || 'ยังไม่มีบันทึก — คลิก "แก้ไข" เพื่อเพิ่ม'}
              </div>
            )}
          </div>
        </div>
      </main>

      {showAddMilestone && (
        <AddMilestoneModal
          projectId={pid}
          onClose={() => setShowAddMilestone(false)}
          onAdded={m => { setMilestones(prev => [...prev, m]); setShowAddMilestone(false); }}
          onProjectSync={p => {
            setProject(p);
            setPctVal(String(p.completion_pct || 0));
          }}
        />
      )}

      {showEditProject && project && (
        <EditProjectModal
          project={project}
          companyId={id}
          onClose={() => setShowEditProject(false)}
          onSaved={p => {
            setProject(p);
            setBudgetActual(String(p.budget_actual || 0));
            setNotesVal(p.notes || '');
            setPctVal(String(p.completion_pct || 0));
            setShowEditProject(false);
          }}
        />
      )}
    </div>
  );
}
