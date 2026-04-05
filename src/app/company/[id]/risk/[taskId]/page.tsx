'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  ArrowLeft,
  FileWarning,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronDown,
  X,
  Info,
  Edit3,
  Lock,
  LogIn,
} from 'lucide-react';

// ── Types ──
interface RiskTask {
  id: string;
  company_id: string;
  ra_no: number;
  department: string | null;
  working_area: string | null;
  work_position: string | null;
  task_name: string;
  task_name_th: string | null;
  task_description: string | null;
  process_stage: string | null;
  start_point: string | null;
  end_point: string | null;
  machine: string | null;
  building_area: string | null;
  persons_at_risk: string | null;
  ra_reason: string | null;
  responsible_person: string | null;
  max_risk_level: number;
  risk_scale: string;
  status: string;
  revision_number: number;
  next_review_date: string | null;
}

interface Hazard {
  id: string;
  task_id: string;
  company_id: string;
  hazard_no: number;
  hazard_category: string | null;
  hazard_description: string;
  existing_controls: string | null;
  severity: number;
  probability: number;
  risk_level: number;
  risk_scale: string;
  new_control_measures: string | null;
  control_type: string | null;
  responsible_person: string | null;
  deadline: string | null;
  done: boolean;
  residual_severity: number | null;
  residual_probability: number | null;
  residual_risk_level: number | null;
  residual_risk_scale: string | null;
  reference_doc: string | null;
}

// ── Constants ──
const SEVERITY_OPTIONS = [
  { value: 1, label: 'S1 — ปฐมพยาบาล (FAC)', score: '(1)', desc: 'First Aid Case' },
  { value: 2, label: 'S2 — รักษาพยาบาล (MTC)', score: '(2)', desc: 'Medical Treatment' },
  { value: 4, label: 'S3/S4 — หยุดงาน (RWC/LTI)', score: '(4)', desc: 'Restricted Work / Lost Time' },
  { value: 8, label: 'S5 — พิการถาวร (Life Altering)', score: '(8)', desc: 'Permanent disability' },
  { value: 15, label: 'S6 — เสียชีวิต (Fatality)', score: '(15)', desc: 'Death' },
];

const PROBABILITY_OPTIONS = [
  { value: 1, label: 'P1 — แทบไม่เกิด (Highly Unlikely)', desc: '> 1/10,000' },
  { value: 2, label: 'P2 — ไม่น่าเกิด (Unlikely)', desc: '> 1/1,000' },
  { value: 3, label: 'P3 — อาจเกิดได้ (Possible)', desc: '> 1/100' },
  { value: 4, label: 'P4 — มีโอกาสสูง (Very Likely)', desc: '> 1/10' },
  { value: 5, label: 'P5 — คาดว่าจะเกิด (Expectable)', desc: '> 50%' },
];

const HAZARD_CATEGORIES = [
  { value: 'Mechanical', label: 'เครื่องจักร (Mechanical)' },
  { value: 'Electrical', label: 'ไฟฟ้า (Electrical)' },
  { value: 'Chemical', label: 'สารเคมี (Chemical)' },
  { value: 'Ergonomic', label: 'การยศาสตร์ (Ergonomic)' },
  { value: 'Physical', label: 'กายภาพ (Physical)' },
  { value: 'Environmental', label: 'สิ่งแวดล้อม (Environmental)' },
  { value: 'Transport', label: 'การขนส่ง (Transport)' },
  { value: 'Fire/Explosion', label: 'ไฟไหม้/ระเบิด (Fire/Explosion)' },
  { value: 'Other', label: 'อื่นๆ (Other)' },
];

const CONTROL_TYPES = [
  { value: 'Elimination', label: 'กำจัด (Elimination)', priority: 1, color: '#16a34a' },
  { value: 'Substitution', label: 'ทดแทน (Substitution)', priority: 2, color: '#22c55e' },
  { value: 'Engineering Controls', label: 'วิศวกรรม (Engineering Controls)', priority: 3, color: '#3b82f6' },
  { value: 'Administrative Controls', label: 'บริหารจัดการ (Administrative Controls)', priority: 4, color: '#f59e0b' },
  { value: 'PPE', label: 'อุปกรณ์ป้องกัน (PPE)', priority: 5, color: '#dc2626' },
];

// ── Helpers ──
function getRiskColor(scale: string): string {
  switch (scale) {
    case 'Critical': return '#dc2626';
    case 'High': return '#f59e0b';
    case 'Medium': return '#eab308';
    case 'Low': return '#16a34a';
    default: return '#94a3b8';
  }
}
function getRiskBg(scale: string): string {
  switch (scale) {
    case 'Critical': return 'rgba(220,38,38,0.08)';
    case 'High': return 'rgba(245,158,11,0.08)';
    case 'Medium': return 'rgba(234,179,8,0.08)';
    case 'Low': return 'rgba(22,163,74,0.08)';
    default: return 'rgba(148,163,184,0.08)';
  }
}
function getRiskScale(rl: number): string {
  if (rl >= 32) return 'Critical';
  if (rl >= 10) return 'High';
  if (rl >= 5) return 'Medium';
  if (rl >= 1) return 'Low';
  return 'N/A';
}

// ── Risk Matrix component ──
function RiskMatrix({ severity, probability }: { severity: number; probability: number }) {
  const sValues = [1, 2, 4, 8, 15];
  const pValues = [1, 2, 3, 4, 5];
  const sLabels = ['FAC', 'MTC', 'RWC/LTI', 'Life Alt.', 'Fatal'];
  const pLabels = ['Highly Unlikely', 'Unlikely', 'Possible', 'Very Likely', 'Expectable'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%', minWidth: 340 }}>
        <thead>
          <tr>
            <th style={{ padding: 4 }}></th>
            <th style={{ padding: 4 }}></th>
            {sValues.map((s, i) => (
              <th key={s} style={{ padding: '4px 6px', textAlign: 'center', fontSize: 9, color: '#6b7280', fontWeight: 600 }}>
                {sLabels[i]}<br />({s})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pValues.map((p, pi) => (
            <tr key={p}>
              <td style={{ padding: '4px 6px', fontSize: 9, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{p}</td>
              <td style={{ padding: '4px 6px', fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap' }}>{pLabels[pi]}</td>
              {sValues.map(s => {
                const rl = s * p;
                const scale = getRiskScale(rl);
                const isActive = s === severity && p === probability;
                return (
                  <td key={s} style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: isActive ? 13 : 10,
                    color: isActive ? '#fff' : getRiskColor(scale),
                    background: isActive ? getRiskColor(scale) : getRiskBg(scale),
                    border: isActive ? `2px solid ${getRiskColor(scale)}` : '1px solid #e5e7eb',
                    borderRadius: 4,
                  }}>
                    {rl}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RAFormPage() {
  const params = useParams();
  const router = useRouter();
  const auth = useAuth();
  const companyId = params.id as string;
  const taskId = params.taskId as string;
  const company = COMPANIES.find(c => c.id === companyId);
  const isLoggedIn = auth.isAdmin || auth.getCompanyAuth(companyId).isLoggedIn;

  // Login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [task, setTask] = useState<RiskTask | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit task info (Step 1)
  const [editingTask, setEditingTask] = useState(false);
  const [taskForm, setTaskForm] = useState<Partial<RiskTask>>({});

  // Add hazard modal
  const [showAddHazard, setShowAddHazard] = useState(false);
  const [editingHazard, setEditingHazard] = useState<Hazard | null>(null);
  const [hazardForm, setHazardForm] = useState({
    hazard_category: '',
    hazard_description: '',
    existing_controls: '',
    severity: 1,
    probability: 1,
    new_control_measures: '' as string,
    control_type: '',
    responsible_person: '',
    deadline: '',
    done: false,
    residual_severity: 0,
    residual_probability: 0,
    reference_doc: '',
  });
  const [controlMeasureItems, setControlMeasureItems] = useState<string[]>(['']);

  // Fetch task + hazards
  const fetchData = useCallback(async () => {
    try {
      const [taskRes, hazardRes] = await Promise.all([
        fetch(`/api/risk/tasks?companyId=${companyId}`),
        fetch(`/api/risk/hazards?taskId=${taskId}`),
      ]);
      if (taskRes.ok) {
        const tasks = await taskRes.json();
        const t = Array.isArray(tasks) ? tasks.find((x: RiskTask) => x.id === taskId) : null;
        if (t) { setTask(t); setTaskForm(t); }
      }
      if (hazardRes.ok) {
        const h = await hazardRes.json();
        if (Array.isArray(h)) setHazards(h);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId, taskId]);

  useEffect(() => {
    if (isLoggedIn) fetchData();
    else setLoading(false);
  }, [isLoggedIn, fetchData]);

  // Login
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const result = await auth.companyLogin(companyId, loginUser, loginPass);
      if (!result.success) setLoginError(result.error || 'รหัสผ่านไม่ถูกต้อง');
    } catch { setLoginError('เกิดข้อผิดพลาด'); }
    setLoginLoading(false);
  };

  // Save task info (Step 1)
  const saveTaskInfo = async () => {
    setSaving(true);
    try {
      await fetch('/api/risk/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, ...taskForm }),
      });
      setEditingTask(false);
      fetchData();
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Update task status
  const updateStatus = async (status: string) => {
    await fetch('/api/risk/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status }),
    });
    fetchData();
  };

  // Auto-update status based on hazards
  const autoUpdateStatus = useCallback(async (updatedHazards: Hazard[]) => {
    if (updatedHazards.length === 0) return;
    const allDone = updatedHazards.every(h => h.done);
    const anyDone = updatedHazards.some(h => h.done);
    let newStatus = 'Pending';
    if (allDone) newStatus = 'Completed';
    else if (anyDone) newStatus = 'In Progress';
    else newStatus = 'In Progress'; // has hazards but none done
    if (task && task.status !== newStatus && task.status !== 'Outdated') {
      await fetch('/api/risk/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    }
  }, [task, taskId]);

  // Reset hazard form
  const resetHazardForm = () => {
    setHazardForm({
      hazard_category: '', hazard_description: '', existing_controls: '',
      severity: 1, probability: 1, new_control_measures: '', control_type: '',
      responsible_person: '', deadline: '', done: false,
      residual_severity: 0, residual_probability: 0, reference_doc: '',
    });
    setControlMeasureItems(['']);
    setEditingHazard(null);
  };

  // Open edit hazard
  const openEditHazard = (h: Hazard) => {
    setEditingHazard(h);
    setHazardForm({
      hazard_category: h.hazard_category || '',
      hazard_description: h.hazard_description,
      existing_controls: h.existing_controls || '',
      severity: h.severity,
      probability: h.probability,
      new_control_measures: h.new_control_measures || '',
      control_type: h.control_type || '',
      responsible_person: h.responsible_person || '',
      deadline: h.deadline || '',
      done: h.done,
      residual_severity: h.residual_severity || 0,
      residual_probability: h.residual_probability || 0,
      reference_doc: h.reference_doc || '',
    });
    // Parse existing measures into items
    const items = h.new_control_measures ? h.new_control_measures.split('\n').filter(Boolean) : [''];
    setControlMeasureItems(items.length > 0 ? items : ['']);
    setShowAddHazard(true);
  };

  // Save hazard
  const saveHazard = async () => {
    if (!hazardForm.hazard_description.trim()) return;
    setSaving(true);
    // Join control measure items into newline-separated string
    const combinedMeasures = controlMeasureItems.filter(m => m.trim()).join('\n');
    try {
      if (editingHazard) {
        await fetch('/api/risk/hazards', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingHazard.id,
            taskId,
            ...hazardForm,
            new_control_measures: combinedMeasures,
            residual_severity: hazardForm.residual_severity || null,
            residual_probability: hazardForm.residual_probability || null,
          }),
        });
      } else {
        await fetch('/api/risk/hazards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            companyId,
            ...hazardForm,
            new_control_measures: combinedMeasures,
            residual_severity: hazardForm.residual_severity || null,
            residual_probability: hazardForm.residual_probability || null,
          }),
        });
      }
      setShowAddHazard(false);
      resetHazardForm();
      // Refetch hazards and auto-update status
      const hRes = await fetch(`/api/risk/hazards?taskId=${taskId}`);
      if (hRes.ok) {
        const updatedH = await hRes.json();
        if (Array.isArray(updatedH)) await autoUpdateStatus(updatedH);
      }
      fetchData();
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Delete hazard
  const deleteHazard = async (hazardId: string) => {
    if (!confirm('ยืนยันลบ Hazard นี้?')) return;
    await fetch(`/api/risk/hazards?id=${hazardId}&taskId=${taskId}`, { method: 'DELETE' });
    fetchData();
  };

  const rl = hazardForm.severity * hazardForm.probability;
  const rlScale = getRiskScale(rl);
  const rrl = (hazardForm.residual_severity || 0) * (hazardForm.residual_probability || 0);
  const rrlScale = rrl > 0 ? getRiskScale(rrl) : null;

  // ── Login screen ──
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
          <div style={{ maxWidth: 400, margin: '80px auto' }}>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
              <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <FileWarning size={20} /> ประเมินความเสี่ยง
                </h3>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4" style={{ color: '#6b7280', fontSize: 13 }}>
                  <Lock size={14} /> กรุณาเข้าสู่ระบบ
                </div>
                {loginError && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{loginError}</div>}
                <input placeholder="ชื่อผู้ใช้" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full mb-3 rounded-lg text-sm" style={{ padding: '10px 14px', background: '#f3f4f6', color: '#1f2937', border: '1px solid #e5e7eb' }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <input type="password" placeholder="รหัสผ่าน" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full mb-4 rounded-lg text-sm" style={{ padding: '10px 14px', background: '#f3f4f6', color: '#1f2937', border: '1px solid #e5e7eb' }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={handleLogin} disabled={loginLoading} className="w-full rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2" style={{ padding: '10px 0', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}>
                  <LogIn size={16} /> {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--muted)' }}>
          กำลังโหลด...
        </main>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 text-center" style={{ background: 'var(--bg-primary)' }}>
          <p style={{ color: 'var(--muted)', marginTop: 80 }}>ไม่พบ Task นี้</p>
          <Link href={`/company/${companyId}/risk`} className="text-sm mt-4 inline-flex items-center gap-1" style={{ color: '#5856d6' }}>
            <ArrowLeft size={14} /> กลับทะเบียนความเสี่ยง
          </Link>
        </main>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Back + Header */}
          <Link href={`/company/${companyId}/risk`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: '#5856d6', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> กลับทะเบียนความเสี่ยง
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-lg lg:text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="rounded px-2 py-0.5 text-white text-sm" style={{ background: '#5856d6' }}>RA #{task.ra_no}</span>
                {task.task_name}
              </h1>
              {task.task_name_th && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{task.task_name_th}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded px-3 py-1 text-xs font-bold" style={{ color: getRiskColor(task.risk_scale), background: getRiskBg(task.risk_scale) }}>
                RL: {task.max_risk_level || '—'} ({task.risk_scale})
              </span>
              <select
                value={task.status}
                onChange={e => updateStatus(e.target.value)}
                className="rounded-lg text-xs font-semibold"
                style={{ padding: '6px 28px 6px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', appearance: 'auto' as React.CSSProperties['appearance'] }}
              >
                <option value="Pending">รอดำเนินการ (Pending)</option>
                <option value="In Progress">กำลังดำเนินการ (In Progress)</option>
                <option value="Completed">เสร็จสิ้น (Completed)</option>
                <option value="Outdated">หมดอายุ (Outdated)</option>
              </select>
            </div>
          </div>

          {/* ── STEP 1: Task Limits ── */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 20, border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#5856d6' }}>1</span>
                กำหนดขอบเขตของงาน (Determine the Limits of the Task)
              </h2>
              <button onClick={() => { setEditingTask(!editingTask); setTaskForm(task); }} className="text-xs flex items-center gap-1" style={{ color: '#5856d6' }}>
                <Edit3 size={12} /> {editingTask ? 'ยกเลิก' : 'แก้ไข'}
              </button>
            </div>

            {editingTask ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                  {[
                    { key: 'department', label: 'แผนก (Department)' },
                    { key: 'working_area', label: 'พื้นที่ (Working Area)' },
                    { key: 'work_position', label: 'ตำแหน่งงาน (Work Position)' },
                    { key: 'process_stage', label: 'ขั้นตอน (Process Stage)' },
                    { key: 'machine', label: 'เครื่องจักร (Machine)' },
                    { key: 'building_area', label: 'อาคาร/พื้นที่ (Building / Area)' },
                    { key: 'persons_at_risk', label: 'ผู้ที่เสี่ยง (Persons at Risk)' },
                    { key: 'ra_reason', label: 'เหตุผลการประเมิน (RA Reason)' },
                    { key: 'start_point', label: 'จุดเริ่มต้น (Start Point)' },
                    { key: 'end_point', label: 'จุดสิ้นสุด (End Point)' },
                    { key: 'responsible_person', label: 'ผู้รับผิดชอบ (Responsible Person)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input value={(taskForm as Record<string, string>)[f.key] || ''} onChange={e => setTaskForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setEditingTask(false)} className="rounded-lg text-sm" style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>ยกเลิก</button>
                  <button onClick={saveTaskInfo} disabled={saving} className="rounded-lg text-sm text-white flex items-center gap-2" style={{ padding: '8px 16px', background: '#5856d6' }}>
                    <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 8 }}>
                {[
                  { label: 'แผนก (Department)', value: task.department },
                  { label: 'พื้นที่ (Working Area)', value: task.working_area },
                  { label: 'ตำแหน่งงาน (Work Position)', value: task.work_position },
                  { label: 'ขั้นตอน (Process Stage)', value: task.process_stage },
                  { label: 'เครื่องจักร (Machine)', value: task.machine },
                  { label: 'อาคาร/พื้นที่ (Building / Area)', value: task.building_area },
                  { label: 'ผู้ที่เสี่ยง (Persons at Risk)', value: task.persons_at_risk },
                  { label: 'เหตุผลการประเมิน (RA Reason)', value: task.ra_reason },
                  { label: 'จุดเริ่มต้น (Start Point)', value: task.start_point },
                  { label: 'จุดสิ้นสุด (End Point)', value: task.end_point },
                  { label: 'ผู้รับผิดชอบ (Responsible)', value: task.responsible_person },
                ].map((f, i) => (
                  <div key={i}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{f.label}</span>
                    <p style={{ fontSize: 13, color: f.value ? 'var(--text-primary)' : 'var(--muted)', fontWeight: f.value ? 500 : 400 }}>
                      {f.value || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── STEPS 2-4: Hazard Identification, Risk Estimation, Risk Reduction ── */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 20, border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span className="rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#dc2626' }}>2-4</span>
                ระบุอันตราย / ประเมินความเสี่ยง / ลดความเสี่ยง (Hazard ID / Risk Estimation / Reduction)
              </h2>
              <button
                onClick={() => { resetHazardForm(); setShowAddHazard(true); }}
                className="flex items-center gap-1 rounded-lg text-white text-xs font-semibold"
                style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}
              >
                <Plus size={14} /> เพิ่มอันตราย
              </button>
            </div>

            {hazards.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle size={32} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>ยังไม่มีรายการอันตราย</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>เริ่มระบุอันตรายที่เกี่ยวข้องกับ Task นี้</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['#', 'ประเภท', 'รายละเอียดอันตราย', 'มาตรการปัจจุบัน', 'S', 'P', 'RL', 'ระดับ', 'มาตรการใหม่', 'ประเภทควบคุม', 'S₂', 'P₂', 'RRL', 'เสร็จ', ''].map((h, i) => (
                        <th key={i} style={{ padding: '8px 8px', textAlign: i >= 4 && i <= 7 || i >= 10 && i <= 12 ? 'center' : 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hazards.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#5856d6' }}>{h.hazard_no}</td>
                        <td style={{ padding: '8px', fontSize: 11, color: 'var(--text-secondary)' }}>{h.hazard_category || '—'}</td>
                        <td style={{ padding: '8px', maxWidth: 180, color: 'var(--text-primary)', fontWeight: 500 }}>{h.hazard_description}</td>
                        <td style={{ padding: '8px', maxWidth: 140, fontSize: 11, color: 'var(--text-secondary)' }}>{h.existing_controls || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{h.severity}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{h.probability}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 14, color: getRiskColor(h.risk_scale) }}>{h.risk_level}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span className="rounded px-1.5 py-0.5 text-xs font-bold" style={{ color: getRiskColor(h.risk_scale), background: getRiskBg(h.risk_scale) }}>{h.risk_scale}</span>
                        </td>
                        <td style={{ padding: '8px', maxWidth: 140, fontSize: 11, color: 'var(--text-secondary)' }}>{h.new_control_measures || '—'}</td>
                        <td style={{ padding: '8px', fontSize: 10 }}>
                          {h.control_type ? (
                            <span className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ color: CONTROL_TYPES.find(c => c.value === h.control_type)?.color || '#6b7280', background: `${CONTROL_TYPES.find(c => c.value === h.control_type)?.color || '#6b7280'}14` }}>
                              {h.control_type}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: h.residual_severity ? 'var(--text-primary)' : 'var(--muted)' }}>{h.residual_severity || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: h.residual_probability ? 'var(--text-primary)' : 'var(--muted)' }}>{h.residual_probability || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {h.residual_risk_level ? (
                            <span className="rounded px-1.5 py-0.5 text-xs font-bold" style={{ color: getRiskColor(h.residual_risk_scale || 'N/A'), background: getRiskBg(h.residual_risk_scale || 'N/A') }}>
                              {h.residual_risk_level}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {h.done ? <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditHazard(h)} className="p-1 rounded hover:bg-[var(--bg-secondary)]" title="แก้ไข">
                              <Edit3 size={12} style={{ color: '#3b82f6' }} />
                            </button>
                            <button onClick={() => deleteHazard(h.id)} className="p-1 rounded hover:bg-[var(--bg-secondary)]" title="ลบ">
                              <Trash2 size={12} style={{ color: '#dc2626' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── STEPS 5-6: Monitor & Review ── */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 20, border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-sm flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
              <span className="rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#16a34a' }}>5-6</span>
              ติดตามผลและทบทวน (Monitor & Review)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>สถานะรวม (Overall Status)</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {task.status === 'Pending' ? 'รอดำเนินการ' : task.status === 'In Progress' ? 'กำลังดำเนินการ' : task.status === 'Completed' ? 'เสร็จสิ้น' : task.status === 'Outdated' ? 'หมดอายุ' : task.status}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>ระดับความเสี่ยงสูงสุด (Max Risk Level)</span>
                <p style={{ fontSize: 20, fontWeight: 700, color: getRiskColor(task.risk_scale) }}>
                  {task.max_risk_level || '—'} <span style={{ fontSize: 12 }}>({task.risk_scale})</span>
                </p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>อันตรายทั้งหมด (Total Hazards)</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{hazards.length}</p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>ดำเนินการแล้ว (Completed Actions)</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>
                  {hazards.filter(h => h.done).length} / {hazards.length}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>การแก้ไข (Revision)</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Rev. {task.revision_number}</p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>วันทบทวนถัดไป (Next Review Date)</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: task.next_review_date ? 'var(--text-primary)' : 'var(--muted)' }}>
                  {task.next_review_date ? new Date(task.next_review_date).toLocaleDateString('th-TH') : 'ยังไม่กำหนด'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Risk Matrix Reference ── */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 20, border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-sm flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
              <Info size={16} style={{ color: '#3b82f6' }} /> ตารางคะแนนความเสี่ยง (Risk Matrix) — RL = ความรุนแรง × โอกาสเกิด
            </h2>
            <RiskMatrix severity={0} probability={0} />

            <div className="mt-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>ลำดับขั้นการควบคุม (Hierarchy of Controls)</h4>
                {CONTROL_TYPES.map(c => (
                  <div key={c.value} className="flex items-center gap-2 mb-1">
                    <span className="rounded w-4 h-4 flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c.color }}>{c.priority}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Add/Edit Hazard Modal ── */}
        {showAddHazard && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setShowAddHazard(false); resetHazardForm(); }}
          >
            <div
              className="rounded-2xl w-full max-w-[900px] overflow-hidden"
              style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '92vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  {editingHazard ? <Edit3 size={18} /> : <Plus size={18} />}
                  {editingHazard ? 'แก้ไขอันตราย (Hazard)' : 'เพิ่มอันตรายใหม่ (Hazard)'}
                </h3>
                <button onClick={() => { setShowAddHazard(false); resetHazardForm(); }} className="text-white/70 hover:text-white"><X size={20} /></button>
              </div>
              <div className="px-6 py-5">
                {/* Hazard info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>ประเภทอันตราย (Hazard Category)</label>
                    <select value={hazardForm.hazard_category} onChange={e => setHazardForm(p => ({ ...p, hazard_category: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                      <option value="">— เลือก —</option>
                      {HAZARD_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>รายละเอียดอันตราย (Hazard Description) *</label>
                    <input placeholder="อธิบายอันตรายที่พบ" value={hazardForm.hazard_description} onChange={e => setHazardForm(p => ({ ...p, hazard_description: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>มาตรการควบคุมปัจจุบัน (Existing Controls)</label>
                  <input placeholder="มาตรการที่มีอยู่แล้ว" value={hazardForm.existing_controls} onChange={e => setHazardForm(p => ({ ...p, existing_controls: e.target.value }))} style={inputStyle} />
                </div>

                {/* Severity × Probability */}
                <div className="rounded-lg mb-4" style={{ padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>การประเมินความเสี่ยง (Risk Estimation) — RL = S × P</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>ความรุนแรง (Severity - S)</label>
                      <select value={hazardForm.severity} onChange={e => setHazardForm(p => ({ ...p, severity: parseInt(e.target.value) }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                        {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>โอกาสเกิด (Probability - P)</label>
                      <select value={hazardForm.probability} onChange={e => setHazardForm(p => ({ ...p, probability: parseInt(e.target.value) }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                        {PROBABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <span style={{ fontSize: 12, color: '#6b7280' }}>ระดับความเสี่ยง (Risk Level):</span>
                    <span className="rounded px-3 py-1 font-bold" style={{ fontSize: 16, color: getRiskColor(rlScale), background: getRiskBg(rlScale) }}>
                      {rl} — {rlScale}
                    </span>
                  </div>
                  <div className="mt-3">
                    <RiskMatrix severity={hazardForm.severity} probability={hazardForm.probability} />
                  </div>
                </div>

                {/* New Controls — multi-item */}
                <div className="rounded-lg mb-4" style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>มาตรการควบคุมใหม่ (New Control Measures)</label>
                    </div>
                    <div>
                      <label style={labelStyle}>ประเภทการควบคุม (Control Type)</label>
                      <select value={hazardForm.control_type} onChange={e => setHazardForm(p => ({ ...p, control_type: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                        <option value="">— เลือก —</option>
                        {CONTROL_TYPES.map(c => <option key={c.value} value={c.value}>{c.priority}. {c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {controlMeasureItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600, minWidth: 20 }}>{idx + 1}.</span>
                      <input
                        placeholder={`มาตรการข้อที่ ${idx + 1}`}
                        value={item}
                        onChange={e => {
                          const updated = [...controlMeasureItems];
                          updated[idx] = e.target.value;
                          setControlMeasureItems(updated);
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {controlMeasureItems.length > 1 && (
                        <button
                          onClick={() => setControlMeasureItems(controlMeasureItems.filter((_, i) => i !== idx))}
                          style={{ padding: '6px 8px', color: '#dc2626', background: '#fee2e2', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setControlMeasureItems([...controlMeasureItems, ''])}
                    className="flex items-center gap-1"
                    style={{ fontSize: 12, color: '#92400e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                  >
                    <Plus size={14} /> เพิ่มมาตรการอีกข้อ
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>ผู้รับผิดชอบ (Responsible Person)</label>
                    <input value={hazardForm.responsible_person} onChange={e => setHazardForm(p => ({ ...p, responsible_person: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>กำหนดเสร็จ (Deadline)</label>
                    <input type="date" value={hazardForm.deadline} onChange={e => setHazardForm(p => ({ ...p, deadline: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>เอกสารอ้างอิง (Reference SOP/SSOW)</label>
                    <input value={hazardForm.reference_doc} onChange={e => setHazardForm(p => ({ ...p, reference_doc: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                {/* Residual Risk */}
                <div className="rounded-lg mb-4" style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 12 }}>ความเสี่ยงคงเหลือ (Residual Risk) — หลังดำเนินมาตรการ</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>ความรุนแรงคงเหลือ (Residual Severity - S₂)</label>
                      <select value={hazardForm.residual_severity} onChange={e => setHazardForm(p => ({ ...p, residual_severity: parseInt(e.target.value) }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                        <option value={0}>— ยังไม่ระบุ —</option>
                        {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>โอกาสเกิดคงเหลือ (Residual Probability - P₂)</label>
                      <select value={hazardForm.residual_probability} onChange={e => setHazardForm(p => ({ ...p, residual_probability: parseInt(e.target.value) }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                        <option value={0}>— ยังไม่ระบุ —</option>
                        {PROBABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {rrl > 0 && (
                    <div className="mt-3 flex items-center gap-4">
                      <span style={{ fontSize: 12, color: '#166534' }}>ระดับความเสี่ยงคงเหลือ (Residual Risk Level):</span>
                      <span className="rounded px-3 py-1 font-bold" style={{ fontSize: 16, color: getRiskColor(rrlScale || 'N/A'), background: getRiskBg(rrlScale || 'N/A') }}>
                        {rrl} — {rrlScale}
                      </span>
                    </div>
                  )}
                </div>

                {/* Done checkbox */}
                <label className="flex items-center gap-2 mb-4" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={hazardForm.done} onChange={e => setHazardForm(p => ({ ...p, done: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>ดำเนินมาตรการเสร็จสิ้น (Done)</span>
                </label>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowAddHazard(false); resetHazardForm(); }} className="rounded-lg text-sm" style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>ยกเลิก</button>
                  <button onClick={saveHazard} disabled={saving || !hazardForm.hazard_description.trim()} className="rounded-lg text-sm text-white flex items-center gap-2" style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)', opacity: saving || !hazardForm.hazard_description.trim() ? 0.6 : 1 }}>
                    <Save size={14} /> {saving ? 'กำลังบันทึก...' : editingHazard ? 'อัปเดต' : 'เพิ่มอันตราย'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
