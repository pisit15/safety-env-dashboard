'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { useCompanies } from '@/hooks/useCompanies';
import { STATUS, PALETTE } from '@/lib/she-theme';
import {
  FileWarning,
  Plus,
  Search,
  Filter,
  BookOpen,
  ChevronDown,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Eye,
  X,
  Lock,
  LogIn,
} from 'lucide-react';
import ExportPdfButton from '@/components/ExportPdfButton';

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
  actions_pending: boolean;
  revision_number: number;
  last_update: string | null;
  next_review_date: string | null;
  hazard_count: number;
  created_at: string;
}

// ── Risk scale helpers ──
function getRiskColor(scale: string): string {
  switch (scale) {
    case 'Critical': return STATUS.critical;
    case 'High': return STATUS.warning;
    case 'Medium': return '#eab308';
    case 'Low': return STATUS.positive;
    default: return PALETTE.muted;
  }
}
function getRiskBg(scale: string): string {
  switch (scale) {
    case 'Critical': return STATUS.criticalBg;
    case 'High': return STATUS.warningBg;
    case 'Medium': return 'rgba(234,179,8,0.08)';
    case 'Low': return STATUS.positiveBg;
    default: return STATUS.neutralBg;
  }
}
function getStatusColor(status: string): string {
  switch (status) {
    case 'Completed': return STATUS.positive;
    case 'In Progress': return PALETTE.primary;
    case 'Outdated': return STATUS.critical;
    default: return PALETTE.muted;
  }
}

// ── Risk Matrix helpers ──
function getRiskLevelCell(riskLevel: number): { likelihood: number; severity: number } {
  // Risk level = likelihood × severity
  // Try to find factors: iterate from 5 down to 1
  for (let likelihood = 5; likelihood >= 1; likelihood--) {
    if (riskLevel % likelihood === 0) {
      const severity = riskLevel / likelihood;
      if (severity >= 1 && severity <= 5) {
        return { likelihood, severity };
      }
    }
  }
  // Fallback: approximate
  const likelihood = Math.min(5, Math.ceil(Math.sqrt(riskLevel)));
  const severity = Math.min(5, Math.ceil(riskLevel / likelihood));
  return { likelihood, severity };
}

function getRiskMatrixColor(riskLevel: number, intensity: number): string {
  // intensity: 0 = no cells, 1-4 = 1-4 cells, 5+ = 5+ cells
  if (intensity === 0) return 'transparent';

  const opacityMap: { [key: number]: number } = { 1: 0.25, 2: 0.5, 3: 0.7, 4: 0.85, 5: 1 };
  const opacity = opacityMap[Math.min(intensity, 5)] || 1;

  if (riskLevel >= 1 && riskLevel <= 4) {
    // LOW
    return `rgba(34, 197, 94, ${opacity})`;
  } else if (riskLevel >= 5 && riskLevel <= 9) {
    // MEDIUM
    return `rgba(234, 179, 8, ${opacity})`;
  } else if (riskLevel >= 10 && riskLevel <= 16) {
    // HIGH
    return `rgba(245, 158, 11, ${opacity})`;
  } else {
    // CRITICAL (17-25)
    return `rgba(220, 38, 38, ${opacity})`;
  }
}

// ── Severity & Probability options ──
const SEVERITY_OPTIONS = [
  { value: 1, label: 'S1 — FAC (1)', desc: 'First Aid Case' },
  { value: 2, label: 'S2 — MTC (2)', desc: 'Medical Treatment' },
  { value: 4, label: 'S3/S4 — RWC/LTI (4)', desc: 'Restricted Work / Lost Time' },
  { value: 8, label: 'S5 — Life Altering (8)', desc: 'Permanent disability' },
  { value: 15, label: 'S6 — Fatality (15)', desc: 'Death' },
];

const PROBABILITY_OPTIONS = [
  { value: 1, label: 'P1 — Highly Unlikely', desc: '> 1/10,000' },
  { value: 2, label: 'P2 — Unlikely', desc: '> 1/1,000' },
  { value: 3, label: 'P3 — Possible', desc: '> 1/100' },
  { value: 4, label: 'P4 — Very Likely', desc: '> 1/10' },
  { value: 5, label: 'P5 — Expectable', desc: '> 50%' },
];

export default function RiskRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const auth = useAuth();
  const companyId = params.id as string;
  const { getCompanyById } = useCompanies();
  const company = getCompanyById(companyId);

  // Auth
  const isLoggedIn = auth.isAdmin || auth.getCompanyAuth(companyId).isLoggedIn;

  // Login state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [tasks, setTasks] = useState<RiskTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Add task modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({
    department: '',
    working_area: '',
    work_position: '',
    task_name: '',
    task_name_th: '',
    process_stage: '',
    responsible_person: '',
  });

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/risk/tasks?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTasks(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (isLoggedIn) fetchTasks();
    else setLoading(false);
  }, [isLoggedIn, fetchTasks]);

  // Login handler
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const result = await auth.companyLogin(companyId, loginUser, loginPass);
      if (!result.success) setLoginError(result.error || 'รหัสผ่านไม่ถูกต้อง');
    } catch {
      setLoginError('เกิดข้อผิดพลาด');
    }
    setLoginLoading(false);
  };

  // Add task
  const handleAddTask = async () => {
    if (!newTask.task_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/risk/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...newTask }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewTask({ department: '', working_area: '', work_position: '', task_name: '', task_name_th: '', process_stage: '', responsible_person: '' });
        fetchTasks();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('ยืนยันลบ Task นี้? (รวมถึง Hazard ทั้งหมดที่เชื่อมอยู่)')) return;
    await fetch(`/api/risk/tasks?id=${taskId}`, { method: 'DELETE' });
    fetchTasks();
  };

  // Filter tasks
  const filtered = tasks.filter(t => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!(t.task_name?.toLowerCase().includes(s) ||
        t.task_name_th?.toLowerCase().includes(s) ||
        t.department?.toLowerCase().includes(s) ||
        t.working_area?.toLowerCase().includes(s) ||
        t.work_position?.toLowerCase().includes(s) ||
        t.responsible_person?.toLowerCase().includes(s))) return false;
    }
    if (filterRisk !== 'all' && t.risk_scale !== filterRisk) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  // Summary stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const criticalTasks = tasks.filter(t => t.risk_scale === 'Critical').length;
  const highTasks = tasks.filter(t => t.risk_scale === 'High').length;
  const pendingActions = tasks.filter(t => t.actions_pending).length;
  const outdatedTasks = tasks.filter(t => t.status === 'Outdated').length;

  // ── Login screen ──
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
          <div style={{ maxWidth: 400, margin: '80px auto' }}>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
              <div className="px-6 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${STATUS.critical} 0%, ${STATUS.warning} 100%)` }}>
                <div className="flex items-center gap-3">
                  <FileWarning size={24} className="text-white" />
                  <div>
                    <h3 className="text-white font-bold text-lg">ประเมินความเสี่ยง</h3>
                    <p className="text-white/80 text-sm">{company?.name}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4" style={{ color: '#6b7280', fontSize: 13 }}>
                  <Lock size={14} /> กรุณาเข้าสู่ระบบเพื่อจัดการความเสี่ยง
                </div>
                {loginError && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: STATUS.criticalBg, color: STATUS.critical }}>
                    {loginError}
                  </div>
                )}
                <input
                  placeholder="ชื่อผู้ใช้"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  className="w-full mb-3 rounded-lg border-0 text-sm"
                  style={{ padding: '10px 14px', background: '#f3f4f6', color: '#1f2937', border: '1px solid #e5e7eb' }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <input
                  type="password"
                  placeholder="รหัสผ่าน"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  className="w-full mb-4 rounded-lg border-0 text-sm"
                  style={{ padding: '10px 14px', background: '#f3f4f6', color: '#1f2937', border: '1px solid #e5e7eb' }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className="w-full rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2"
                  style={{ padding: '10px 0', background: `linear-gradient(135deg, ${STATUS.critical} 0%, ${STATUS.warning} 100%)`, opacity: loginLoading ? 0.7 : 1 }}
                >
                  <LogIn size={16} /> {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }} id="pdf-content">
        {/* Header */}
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FileWarning size={24} style={{ color: '#dc2626' }} />
                ทะเบียนประเมินความเสี่ยง (Risk Register)
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                การจัดการความเสี่ยงของงาน | RL = ความรุนแรง (S) × โอกาสเกิด (P)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/company/${companyId}/risk/guide`}
                className="flex items-center gap-2 rounded-lg font-semibold text-sm"
                style={{ padding: '10px 16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                <BookOpen size={16} /> คู่มือ
              </Link>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 rounded-lg text-white font-semibold text-sm"
                style={{ padding: '10px 20px', background: `linear-gradient(135deg, ${STATUS.critical} 0%, ${STATUS.warning} 100%)`, whiteSpace: 'nowrap' }}
              >
                <Plus size={16} /> เพิ่มงาน
              </button>
              <ExportPdfButton
                targetId="pdf-content"
                filename={`${companyId}-RiskAssessment`}
                title={`Risk Register — ${companyId.toUpperCase()}`}
                subtitle="Safety & Environment Dashboard — ทะเบียนประเมินความเสี่ยง"
                orientation="landscape"
                compact
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'งานทั้งหมด (Total)', value: totalTasks, color: PALETTE.primary, icon: FileWarning },
              { label: 'เสร็จสิ้น (Completed)', value: completedTasks, color: STATUS.positive, icon: CheckCircle2 },
              { label: 'วิกฤต (Critical)', value: criticalTasks, color: STATUS.critical, icon: AlertTriangle },
              { label: 'สูง (High)', value: highTasks, color: STATUS.warning, icon: Shield },
              { label: 'รอดำเนินการ (Pending)', value: pendingActions, color: '#8b5cf6', icon: Clock },
              { label: 'หมดอายุ (Outdated)', value: outdatedTasks, color: PALETTE.muted, icon: Clock },
            ].map((card, i) => (
              <div key={i} className="glass-card rounded-xl" style={{ padding: '16px', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <card.icon size={14} style={{ color: card.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Risk Level Classification */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 16, border: '1px solid var(--border)' }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>การจำแนกระดับความเสี่ยง (Risk Level Classification)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 8 }}>
              {[
                { range: '1 ≤ RL ≤ 4', scale: 'ต่ำ (Low)', color: STATUS.positive, bg: STATUS.positiveBg, action: 'ยอมรับได้ ทบทวนตามแผนจัดการความเสี่ยง' },
                { range: '5 ≤ RL ≤ 8', scale: 'ปานกลาง (Medium)', color: '#eab308', bg: 'rgba(234,179,8,0.08)', action: 'ต้องมีมาตรการ ติดตามความคืบหน้า' },
                { range: '10 ≤ RL ≤ 30', scale: 'สูง (High)', color: STATUS.warning, bg: STATUS.warningBg, action: 'ต้องดำเนินการทันที ลดด้วยการกำจัด/ทดแทน/วิศวกรรม' },
                { range: '32 ≤ RL ≤ 75', scale: 'วิกฤต (Critical)', color: STATUS.critical, bg: STATUS.criticalBg, action: 'หยุดงานจนกว่าจะมีมาตรการเพียงพอ' },
              ].map((level, i) => (
                <div key={i} className="rounded-lg" style={{ padding: '10px 14px', background: level.bg, border: `1px solid ${level.color}20` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded px-2 py-0.5 text-white text-xs font-bold" style={{ background: level.color }}>{level.scale}</span>
                    <span style={{ fontSize: 11, color: level.color, fontWeight: 600 }}>{level.range}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{level.action}</p>
                </div>
              ))}
            </div>
          </div>


          {/* Risk Matrix Heatmap */}
          <div className="glass-card rounded-xl mb-6" style={{ padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 16 }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Risk Matrix</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Task distribution across Likelihood x Severity (Total: {totalTasks})
              </p>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13 }}>
                No tasks in the system
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-block', minWidth: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', gap: 1, background: 'var(--border)', padding: 1, borderRadius: 8 }}>
                    <div style={{ background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>S/L</span>
                    </div>

                    {[1, 2, 3, 4, 5].map((severity) => {
                      const severityLabels = ['น้อยมาก', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'];
                      return (
                        <div key={severity} style={{ background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40, padding: '4px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>S{severity}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{severityLabels[severity - 1]}</div>
                          </div>
                        </div>
                      );
                    })}

                    {[5, 4, 3, 2, 1].map((likelihood) => {
                      const likelihoodLabels = ['น้อยมาก', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'];
                      const idx = 5 - likelihood;
                      return (
                        <div key={likelihood} style={{ display: 'contents' }}>
                          <div style={{ background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>P{likelihood}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{likelihoodLabels[idx]}</div>
                            </div>
                          </div>

                          {[1, 2, 3, 4, 5].map((severity) => {
                            const riskLevel = likelihood * severity;
                            const cellTasks = tasks.filter((t) => {
                              const cell = getRiskLevelCell(t.max_risk_level);
                              return cell.likelihood === likelihood && cell.severity === severity;
                            });
                            const count = cellTasks.length;
                            const intensity = count > 0 ? Math.min(count, 5) : 0;

                            return (
                              <div
                                key={`${likelihood}-${severity}`}
                                style={{
                                  background: getRiskMatrixColor(riskLevel, intensity),
                                  border: intensity > 0 ? `1px solid ${getRiskMatrixColor(riskLevel, 5).replace(/[0-9.]+\)/, '1)')}` : '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minHeight: 60,
                                  aspectRatio: '1',
                                  borderRadius: 6,
                                  cursor: count > 0 ? 'pointer' : 'default',
                                  transition: 'all 0.2s ease',
                                }}
                                title={`Risk Level ${riskLevel}: ${count} task(s)`}
                              >
                                {count > 0 && (
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: intensity >= 3 ? 'white' : 'inherit' }}>
                                      {count}
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: intensity >= 3 ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                                      RL{riskLevel}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
                    {[
                      { range: 'RL 1-4', label: 'ต่ำ (Low)', color: 'rgba(34, 197, 94, 1)' },
                      { range: 'RL 5-9', label: 'ปานกลาง (Medium)', color: 'rgba(234, 179, 8, 1)' },
                      { range: 'RL 10-16', label: 'สูง (High)', color: 'rgba(245, 158, 11, 1)' },
                      { range: 'RL 17-25', label: 'วิกฤต (Critical)', color: 'rgba(220, 38, 38, 1)' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: item.color }} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{item.range}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                placeholder="ค้นหา Task, Department, ผู้รับผิดชอบ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-lg text-sm"
                style={{ padding: '10px 14px', paddingLeft: 36, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={filterRisk}
                  onChange={e => setFilterRisk(e.target.value)}
                  className="rounded-lg text-sm appearance-none"
                  style={{ padding: '10px 32px 10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  <option value="all">ทุกระดับความเสี่ยง</option>
                  <option value="Critical">วิกฤต (Critical)</option>
                  <option value="High">สูง (High)</option>
                  <option value="Medium">ปานกลาง (Medium)</option>
                  <option value="Low">ต่ำ (Low)</option>
                  <option value="N/A">ยังไม่ประเมิน</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
              </div>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="rounded-lg text-sm appearance-none"
                  style={{ padding: '10px 32px 10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="Pending">รอดำเนินการ (Pending)</option>
                  <option value="In Progress">กำลังดำเนินการ (In Progress)</option>
                  <option value="Completed">เสร็จสิ้น (Completed)</option>
                  <option value="Outdated">หมดอายุ (Outdated)</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
              </div>
            </div>
          </div>

          {/* Task Table */}
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-xl text-center py-12" style={{ border: '1px solid var(--border)' }}>
              {totalTasks === 0 ? (
                <>
                  <FileWarning size={40} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>ยังไม่มีงานในทะเบียนความเสี่ยง</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>เริ่มต้นโดยการเพิ่มงานที่ต้องประเมินความเสี่ยง</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-semibold"
                    style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}
                  >
                    <Plus size={16} /> เพิ่มงานแรก
                  </button>
                </>
              ) : (
                <>
                  <Search size={32} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ไม่พบรายการที่ตรงกับเงื่อนไข</p>
                </>
              )}
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    {['RA#', 'แผนก', 'ตำแหน่ง', 'ชื่องาน', 'RL', 'ระดับ', 'สถานะ', 'อันตราย', 'ผู้รับผิดชอบ', 'อัปเดต', ''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => (
                    <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}
                      className="hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                      onClick={() => router.push(`/company/${companyId}/risk/${task.id}`)}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#5856d6', fontSize: 12 }}>{task.ra_no}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{task.department || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{task.work_position || '—'}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 250 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.task_name}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: getRiskColor(task.risk_scale) }}>
                          {task.max_risk_level || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ color: getRiskColor(task.risk_scale), background: getRiskBg(task.risk_scale) }}>
                          {task.risk_scale}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ color: getStatusColor(task.status), background: `${getStatusColor(task.status)}14` }}>
                          {task.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {task.hazard_count}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {task.responsible_person || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {task.last_update ? new Date(task.last_update).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/company/${companyId}/risk/${task.id}`)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]"
                            title="ประเมินความเสี่ยง"
                          >
                            <Eye size={14} style={{ color: '#3b82f6' }} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]"
                            title="ลบ"
                          >
                            <Trash2 size={14} style={{ color: '#dc2626' }} />
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

        {/* ── Add Task Modal ── */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="rounded-2xl w-full max-w-[520px] overflow-hidden"
              style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}>
                <div className="flex items-center gap-3">
                  <Plus size={20} className="text-white" />
                  <h3 className="text-white font-bold text-lg">เพิ่มงานใหม่ (New Task)</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              {/* Body */}
              <div className="px-6 py-5">
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                  ขั้นตอนที่ 1: กำหนดขอบเขตของงาน — ข้อมูลพื้นฐานที่ต้องระบุก่อนประเมินความเสี่ยง
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>แผนก (Department) *</label>
                    <input
                      placeholder="เช่น Pouch Making"
                      value={newTask.department}
                      onChange={e => setNewTask(p => ({ ...p, department: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>พื้นที่ (Working Area)</label>
                    <input
                      placeholder="เช่น Production Floor"
                      value={newTask.working_area}
                      onChange={e => setNewTask(p => ({ ...p, working_area: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ตำแหน่งงาน (Work Position)</label>
                    <input
                      placeholder="เช่น Technician"
                      value={newTask.work_position}
                      onChange={e => setNewTask(p => ({ ...p, work_position: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ขั้นตอน (Process Stage)</label>
                    <input
                      placeholder="เช่น Material handling"
                      value={newTask.process_stage}
                      onChange={e => setNewTask(p => ({ ...p, process_stage: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ชื่องาน (Task Name) *</label>
                  <input
                    placeholder="เช่น งานย้ายม้วนฟิล์มจากพาเลทไปยังหน้าเครื่องจักร"
                    value={newTask.task_name}
                    onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ผู้รับผิดชอบ</label>
                  <input
                    placeholder="ชื่อผู้รับผิดชอบ"
                    value={newTask.responsible_person}
                    onChange={e => setNewTask(p => ({ ...p, responsible_person: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1f2937' }}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="rounded-lg text-sm font-semibold"
                    style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={saving || !newTask.task_name.trim()}
                    className="rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                    style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)', opacity: saving || !newTask.task_name.trim() ? 0.6 : 1 }}
                  >
                    <Plus size={14} /> {saving ? 'กำลังบันทึก...' : 'เพิ่มงาน'}
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
