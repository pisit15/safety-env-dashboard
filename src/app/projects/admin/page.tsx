'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import ExportPdfButton from '@/components/ExportPdfButton';
import { PROJECTS } from '@/lib/projects';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  GraduationCap,
  ClipboardList,
  FolderKanban,
  FileWarning,
  Users,
  Clock,
  TrendingUp,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  Activity,
  BarChart3,
} from 'lucide-react';

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

const P = {
  light: {
    bg: '#fbfbfd', text: '#1d1d1f', muted: '#6e6e73', mutedLight: '#86868b',
    navBg: 'rgba(251,251,253,0.85)', navBorder: 'rgba(0,0,0,0.06)', divider: 'rgba(0,0,0,0.15)',
    cardBg: '#fff', cardBorder: 'rgba(0,0,0,0.06)', cardShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cardHoverShadow: '0 8px 24px rgba(0,0,0,0.1)',
    sectionBg: '#f5f5f7', greenBg: 'rgba(52,199,89,0.08)', greenText: '#248a3d',
    redBg: 'rgba(255,59,48,0.08)', redText: '#d70015',
    yellowBg: 'rgba(255,204,0,0.08)', yellowText: '#a05a00',
    blueBg: 'rgba(0,122,255,0.08)', blueText: '#0a84ff',
  },
  dark: {
    bg: '#000', text: '#f5f5f7', muted: '#a1a1a6', mutedLight: '#86868b',
    navBg: 'rgba(20,20,22,0.85)', navBorder: 'rgba(255,255,255,0.08)', divider: 'rgba(255,255,255,0.15)',
    cardBg: '#1c1c1e', cardBorder: 'rgba(255,255,255,0.08)', cardShadow: '0 1px 3px rgba(0,0,0,0.3)',
    cardHoverShadow: '0 8px 24px rgba(0,0,0,0.5)',
    sectionBg: '#1c1c1e', greenBg: 'rgba(48,209,88,0.12)', greenText: '#30d158',
    redBg: 'rgba(255,69,58,0.12)', redText: '#ff453a',
    yellowBg: 'rgba(255,214,10,0.12)', yellowText: '#ffd60a',
    blueBg: 'rgba(10,132,255,0.12)', blueText: '#0a84ff',
  },
};

interface DashboardData {
  year: number;
  nearMiss: { total: number; new: number; open: number; closed: number; high: number; overdue: number; byCompany: Record<string, number>; trend: { month: string; total: number; high: number }[] };
  incidents: { total: number; workRelated: number; byCompany: Record<string, number> };
  training: { plans: number; attendees: number; byCategory: Record<string, number> };
  risk: { total: number; high: number };
  specialProjects: { total: number; completed: number; inProgress: number };
  employees: { total: number };
  manhours: { total: number; totalWorkers: number };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const auth = useAuth();
  const { companies } = useCompanies();
  const { resolvedTheme } = useTheme();
  const p = resolvedTheme === 'dark' ? P.dark : P.light;
  const isDark = resolvedTheme === 'dark';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      setData(json);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.isAdmin) {
      router.replace('/projects');
      return;
    }
    fetchData();
  }, [auth.isAdmin, router, fetchData]);

  if (!auth.isAdmin) return null;

  // ── KPI Card component ──
  const KPICard = ({
    title, value, subtitle, icon: Icon, color, bg, onClick,
  }: {
    title: string; value: string | number; subtitle?: string;
    icon: typeof AlertTriangle; color: string; bg: string; onClick?: () => void;
  }) => (
    <div
      onClick={onClick}
      style={{
        background: p.cardBg,
        border: `1px solid ${p.cardBorder}`,
        borderRadius: 16,
        padding: '20px 22px',
        boxShadow: p.cardShadow,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 200ms, transform 200ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = p.cardHoverShadow;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = p.cardShadow;
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color }} />
        </div>
        {onClick && <ExternalLink size={14} style={{ color: p.muted, opacity: 0.5 }} />}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: p.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: p.muted, marginTop: 2, fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: p.mutedLight, marginTop: 4 }}>{subtitle}</div>}
      </div>
    </div>
  );

  // ── Mini bar chart (for near miss trend) ──
  const MiniBarChart = ({ data: chartData }: { data: { month: string; total: number; high: number }[] }) => {
    const maxVal = Math.max(...chartData.map((d) => d.total), 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {chartData.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 10, color: p.muted, fontWeight: 600 }}>{d.total || ''}</div>
            <div style={{ position: 'relative', width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max((d.total / maxVal) * 100, 4)}%`,
                  background: d.high > 0
                    ? `linear-gradient(180deg, ${isDark ? '#ff453a' : '#ff3b30'} 0%, ${isDark ? '#ff6961' : '#ff6b6b'} 100%)`
                    : `linear-gradient(180deg, ${isDark ? '#0a84ff' : '#007aff'} 0%, ${isDark ? '#5ac8fa' : '#64d2ff'} 100%)`,
                  borderRadius: 4,
                  minHeight: 3,
                }}
              />
            </div>
            <div style={{ fontSize: 9, color: p.mutedLight }}>{d.month}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── Project quick-link card ──
  const ProjectLink = ({ projectId, label, icon: Icon, stat, color }: {
    projectId: string; label: string; icon: typeof AlertTriangle; stat?: string; color: string;
  }) => (
    <button
      onClick={() => {
        const project = PROJECTS.find((p) => p.id === projectId);
        if (project) {
          const href = project.nav[0]?.href('all') || `/projects/${projectId}`;
          router.push(href);
        }
      }}
      style={{
        background: p.cardBg,
        border: `1px solid ${p.cardBorder}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'box-shadow 200ms, transform 200ms',
        boxShadow: p.cardShadow,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = p.cardHoverShadow;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = p.cardShadow;
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{label}</div>
        {stat && <div style={{ fontSize: 12, color: p.muted }}>{stat}</div>}
      </div>
      <ExternalLink size={14} style={{ color: p.muted, opacity: 0.4 }} />
    </button>
  );

  // ── Company table row for near miss ──
  const CompanyRow = ({ companyId, count, total }: { companyId: string; count: number; total: number }) => {
    const company = companies.find((c) => c.id === companyId);
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
        <div style={{ flex: 1, fontSize: 13, color: p.text, fontWeight: 500 }}>
          {company?.name || companyId}
        </div>
        <div style={{ width: 100, height: 6, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 13, color: p.muted, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{count}</div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: p.bg, fontFamily: APPLE_FONT, color: p.text, transition: 'background 200ms' }}>
      {/* ── Top nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: p.navBg, backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${p.navBorder}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/projects')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#0a84ff', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <ArrowLeft size={16} /> เลือกโครงการ
            </button>
            <div style={{ height: 20, width: 1, background: p.divider }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: p.text }}>
              Admin Dashboard
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle size="sm" />
            <span style={{ fontSize: 13, color: p.muted }}>Admin · {auth.adminName}</span>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: p.muted, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {data && (
              <ExportPdfButton
                targetId="admin-dashboard-content"
                filename={`EA-SHE-Admin-Dashboard-${data.year}`}
                title="EA SHE Admin Dashboard"
                subtitle={`ภาพรวมทุกโครงการ ปี ${data.year} · ${companies.length} บริษัท`}
                orientation="portrait"
                compact
              />
            )}
          </div>
        </div>
      </header>

      <main id="admin-dashboard-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 22px 80px' }}>
        {/* ── Hero ── */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 8 }}>
            ภาพรวมทุกโครงการ
            <br />
            <span style={{
              background: isDark ? 'linear-gradient(90deg, #0a84ff, #30d158)' : 'linear-gradient(90deg, #0071e3, #34c759)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              EA SHE {data?.year || ''}
            </span>
          </h1>
          <p style={{ fontSize: 16, color: p.muted, maxWidth: 520 }}>
            สรุป KPI ครอบคลุม {companies.length} บริษัท · {PROJECTS.length} โครงการ
          </p>
        </div>

        {/* ── Loading / Error ── */}
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: p.muted, margin: '0 auto 16px' }} />
            <p style={{ color: p.muted }}>กำลังโหลดข้อมูล…</p>
          </div>
        )}
        {error && !data && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <AlertTriangle size={24} style={{ color: '#ff3b30', margin: '0 auto 16px' }} />
            <p style={{ color: '#ff3b30' }}>{error}</p>
            <button onClick={fetchData} style={{ marginTop: 12, color: '#0a84ff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {data && (
          <>
            {/* ── KPI Grid ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 40,
            }}>
              <KPICard
                title="Near Miss ทั้งหมด"
                value={data.nearMiss.total}
                subtitle={`${data.nearMiss.overdue} เกินกำหนด · ${data.nearMiss.high} ความเสี่ยงสูง`}
                icon={FileText}
                color={p.yellowText}
                bg={p.yellowBg}
                onClick={() => router.push('/projects/nearmiss')}
              />
              <KPICard
                title={`อุบัติเหตุ ${data.year}`}
                value={data.incidents.total}
                subtitle={`${data.incidents.workRelated} เกี่ยวข้องกับงาน`}
                icon={AlertTriangle}
                color={p.redText}
                bg={p.redBg}
                onClick={() => router.push('/projects/incidents')}
              />
              <KPICard
                title={`หลักสูตรอบรม ${data.year}`}
                value={data.training.plans}
                subtitle={`${data.training.attendees.toLocaleString()} คนเข้าอบรม`}
                icon={GraduationCap}
                color={p.blueText}
                bg={p.blueBg}
                onClick={() => router.push('/projects/training')}
              />
              <KPICard
                title="ความเสี่ยงที่ประเมิน"
                value={data.risk.total}
                subtitle={`${data.risk.high} ระดับสูง`}
                icon={FileWarning}
                color={p.redText}
                bg={p.redBg}
              />
              <KPICard
                title="Manhours รวม"
                value={data.manhours.total > 0 ? `${(data.manhours.total / 1000).toFixed(0)}K` : '0'}
                subtitle={`${data.manhours.totalWorkers.toLocaleString()} คน (ชม.ทำงาน)`}
                icon={Clock}
                color={p.greenText}
                bg={p.greenBg}
              />
              <KPICard
                title="โครงการพิเศษ"
                value={data.specialProjects.total}
                subtitle={`${data.specialProjects.completed} เสร็จ · ${data.specialProjects.inProgress} กำลังดำเนินการ`}
                icon={FolderKanban}
                color={p.blueText}
                bg={p.blueBg}
              />
              <KPICard
                title="พนักงานในระบบ"
                value={data.employees.total.toLocaleString()}
                subtitle={`${companies.length} บริษัท`}
                icon={Users}
                color={p.greenText}
                bg={p.greenBg}
              />
              <KPICard
                title="Near Miss ค้างดำเนินการ"
                value={data.nearMiss.open}
                subtitle={`${data.nearMiss.new} ใหม่ · ${data.nearMiss.closed} ปิดแล้ว`}
                icon={ShieldAlert}
                color={data.nearMiss.overdue > 5 ? p.redText : p.yellowText}
                bg={data.nearMiss.overdue > 5 ? p.redBg : p.yellowBg}
                onClick={() => router.push('/projects/nearmiss')}
              />
            </div>

            {/* ── Two column: Trend chart + Company breakdown ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 40 }}>
              {/* Near Miss Trend */}
              <div style={{
                background: p.cardBg, border: `1px solid ${p.cardBorder}`,
                borderRadius: 16, padding: 24, boxShadow: p.cardShadow,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Activity size={16} style={{ color: p.blueText }} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Near Miss Trend (6 เดือน)</span>
                </div>
                <MiniBarChart data={data.nearMiss.trend} />
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: isDark ? '#0a84ff' : '#007aff' }} />
                    <span style={{ fontSize: 11, color: p.muted }}>ปกติ</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: isDark ? '#ff453a' : '#ff3b30' }} />
                    <span style={{ fontSize: 11, color: p.muted }}>มีความเสี่ยงสูง</span>
                  </div>
                </div>
              </div>

              {/* Near Miss by Company */}
              <div style={{
                background: p.cardBg, border: `1px solid ${p.cardBorder}`,
                borderRadius: 16, padding: 24, boxShadow: p.cardShadow,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <BarChart3 size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Near Miss แยกบริษัท</span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {Object.entries(data.nearMiss.byCompany)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cid, count]) => (
                      <CompanyRow key={cid} companyId={cid} count={count} total={data.nearMiss.total} />
                    ))}
                  {Object.keys(data.nearMiss.byCompany).length === 0 && (
                    <p style={{ fontSize: 13, color: p.muted, textAlign: 'center', padding: 20 }}>ยังไม่มีข้อมูล</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Quick links to all projects ── */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TrendingUp size={16} style={{ color: p.muted }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>เข้าถึงโครงการ</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                <ProjectLink projectId="action-plan" label="แผนงานประจำปี" icon={ClipboardList} stat={`${data.year}`} color="#f97316" />
                <ProjectLink projectId="special" label="โครงการพิเศษ" icon={FolderKanban} stat={`${data.specialProjects.total} โครงการ`} color="#8b5cf6" />
                <ProjectLink projectId="training" label="แผนอบรมประจำปี" icon={GraduationCap} stat={`${data.training.plans} หลักสูตร`} color="#3b82f6" />
                <ProjectLink projectId="incidents" label="สถิติอุบัติเหตุ + Manhours" icon={AlertTriangle} stat={`${data.incidents.total} เหตุการณ์`} color="#ef4444" />
                <ProjectLink projectId="nearmiss" label="Near Miss" icon={FileText} stat={`${data.nearMiss.total} รายงาน`} color="#f59e0b" />
                <ProjectLink projectId="risk" label="ประเมินความเสี่ยง" icon={FileWarning} stat={`${data.risk.total} hazards`} color="#ec4899" />
                <ProjectLink projectId="employees" label="จัดการพนักงาน" icon={Users} stat={`${data.employees.total.toLocaleString()} คน`} color="#64748b" />
              </div>
            </div>

            {/* ── Incidents by Company ── */}
            {data.incidents.total > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  background: p.cardBg, border: `1px solid ${p.cardBorder}`,
                  borderRadius: 16, padding: 24, boxShadow: p.cardShadow,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <AlertTriangle size={16} style={{ color: p.redText }} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>อุบัติเหตุ {data.year} แยกบริษัท</span>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {Object.entries(data.incidents.byCompany)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cid, count]) => {
                        const company = companies.find((c) => c.id === cid);
                        const pct = data.incidents.total > 0 ? (count / data.incidents.total) * 100 : 0;
                        return (
                          <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                            <div style={{ flex: 1, fontSize: 13, color: p.text, fontWeight: 500 }}>{company?.name || cid}</div>
                            <div style={{ width: 100, height: 6, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 13, color: p.muted, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{count}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ textAlign: 'center', padding: '20px 0 40px', borderTop: `1px solid ${p.cardBorder}` }}>
              <p style={{ fontSize: 12, color: p.mutedLight }}>
                EA SHE Dashboard · Admin Overview · ข้อมูล ณ วันที่โหลด
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
