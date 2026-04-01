'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, AVAILABLE_YEARS, ACTIVE_YEARS, DEFAULT_YEAR } from '@/lib/companies';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Search,
  FileWarning,
  FileText,
  ArrowRight,
  Shield,
  Key,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  X,
  LogIn,
  User,
  Lock,
} from 'lucide-react';

const PROJECTS = [
  {
    id: 'action-plan',
    label: 'แผนงานประจำปี',
    description: 'ติดตามแผนงานด้านความปลอดภัยและสิ่งแวดล้อมทุกบริษัท',
    icon: ClipboardList,
    href: '/action-plan',
    color: '#007aff',
    status: 'active' as const,
  },
  {
    id: 'training',
    label: 'แผนอบรมประจำปี',
    description: 'แผนการฝึกอบรมด้าน Safety & Environment',
    icon: GraduationCap,
    href: '/training',
    color: '#5856d6',
    status: 'active' as const,
  },
  {
    id: 'incidents',
    label: 'สถิติอุบัติเหตุ',
    description: 'บันทึกและวิเคราะห์อุบัติเหตุทั้งกลุ่ม',
    icon: AlertTriangle,
    href: '/incidents',
    color: '#ff3b30',
    status: 'coming' as const,
  },
  {
    id: 'safety-patrol',
    label: 'Safety Patrol',
    description: 'ตรวจสอบความปลอดภัยภาคสนาม',
    icon: Search,
    href: '/safety-patrol',
    color: '#ff9500',
    status: 'coming' as const,
  },
  {
    id: 'risk',
    label: 'ประเมินความเสี่ยง',
    description: 'Risk Assessment & Risk Register',
    icon: FileWarning,
    href: '/risk',
    color: '#af52de',
    status: 'coming' as const,
  },
  {
    id: 'nearmiss',
    label: 'Near Miss Report',
    description: 'รายงานเหตุการณ์เกือบเกิดอุบัติเหตุ',
    icon: FileText,
    href: '/nearmiss',
    color: '#34c759',
    status: 'coming' as const,
  },
];

interface QuickStat {
  companies: number;
  totalActivities: number;
  totalDone: number;
  overallPct: number;
}

interface DbCompanySetting {
  company_id: string;
  bu: string;
}

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<QuickStat | null>(null);
  const [dbBuMap, setDbBuMap] = useState<Record<string, string>>({});

  // Login modal state
  const [loginModal, setLoginModal] = useState<{ companyId: string; companyName: string } | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const openLoginModal = (companyId: string, companyName: string) => {
    // If already logged in for this company, go straight to company page
    const ca = auth.getCompanyAuth(companyId);
    if (ca.isLoggedIn || auth.isAdmin) {
      router.push(`/company/${companyId}`);
      return;
    }
    setLoginModal({ companyId, companyName });
    setLoginUser('');
    setLoginPass('');
    setLoginError('');
  };

  const handleCompanyLogin = async () => {
    if (!loginModal || !loginPass) return;
    setLoginLoading(true);
    setLoginError('');
    const result = await auth.companyLogin(loginModal.companyId, loginUser, loginPass);
    setLoginLoading(false);
    if (result.success) {
      setLoginModal(null);
      router.push(`/company/${loginModal.companyId}`);
    } else {
      setLoginError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_year');
      if (saved) return parseInt(saved, 10);
    }
    return DEFAULT_YEAR;
  });

  useEffect(() => {
    localStorage.setItem('dashboard_year', String(selectedYear));
  }, [selectedYear]);

  // Fetch BU settings from DB so homepage stays in sync with Admin
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          const map: Record<string, string> = {};
          data.settings.forEach((s: DbCompanySetting) => {
            map[s.company_id] = s.bu ?? '';
          });
          setDbBuMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Build companies list with DB BU overrides
  const companiesWithDbBu = COMPANIES.map(c => ({
    ...c,
    bu: (c.id in dbBuMap ? dbBuMap[c.id] : c.bu) as typeof c.bu,
  }));

  // Fetch quick stats from action-plan dashboard (admin only)
  useEffect(() => {
    if (!auth.isAdmin) return;
    fetch(`/api/dashboard?plan=total&year=${selectedYear}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.companies) {
          setStats({
            companies: data.companies.length,
            totalActivities: data.totalActivities || 0,
            totalDone: data.totalDone || 0,
            overallPct: data.overallPct || 0,
          });
        }
      })
      .catch(() => {});
  }, [auth.isAdmin, selectedYear]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-[28px] font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <img src="/ea-logo.svg" alt="EA" className="h-8 object-contain inline-block" />
            Safety & Environment Dashboard
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
              ศูนย์รวมระบบบริหารจัดการความปลอดภัยและสิ่งแวดล้อม — EA Group
            </p>
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              {AVAILABLE_YEARS.map(y => {
                const isActive = ACTIVE_YEARS.includes(y);
                return (
                  <button
                    key={y}
                    onClick={() => isActive && setSelectedYear(y)}
                    disabled={!isActive}
                    className="px-3 py-1 rounded-md text-[12px] font-semibold transition-all duration-200"
                    style={selectedYear === y
                      ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(10,132,255,0.3)' }
                      : !isActive
                        ? { color: 'var(--border)', cursor: 'not-allowed', opacity: 0.5 }
                        : { color: 'var(--muted)' }}
                    title={!isActive ? `ข้อมูลปี ${y} ยังไม่พร้อม` : ''}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Admin Section: Quick Stats + Project Cards */}
        {!auth.isAdmin && (
          <Link href="/admin">
            <div className="glass-card rounded-xl p-5 mb-8 animate-fade-in-up flex items-center gap-4 cursor-pointer transition-all duration-200 hover:shadow-md"
              style={{ border: '1px solid rgba(255,149,0,0.3)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,149,0,0.1)' }}>
                <Key size={20} style={{ color: '#ff9500' }} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>เข้าสู่ระบบ Admin เพื่อดูภาพรวมโครงการทั้งหมด</p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>คลิกเพื่อเข้าสู่หน้า Admin Login</p>
              </div>
              <div className="flex-shrink-0">
                <ArrowRight size={18} style={{ color: '#ff9500' }} />
              </div>
            </div>
          </Link>
        )}

        {/* Admin: Quick Stats + Project Cards — show only after admin login */}
        {auth.isAdmin && (<>
          {/* Quick Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
              <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,122,255,0.1)' }}>
                  <Building2 size={20} style={{ color: '#007aff' }} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{stats.companies}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>บริษัท</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(88,86,214,0.1)' }}>
                  <ClipboardList size={20} style={{ color: '#5856d6' }} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{stats.totalActivities.toLocaleString()}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>กิจกรรมทั้งหมด</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,199,89,0.1)' }}>
                  <CheckCircle2 size={20} style={{ color: '#34c759' }} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{stats.totalDone.toLocaleString()}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>เสร็จแล้ว</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,149,0,0.1)' }}>
                  <TrendingUp size={20} style={{ color: '#ff9500' }} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{stats.overallPct}%</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>ความสำเร็จรวม</p>
                </div>
              </div>
            </div>
          )}

          {/* Project Cards */}
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              โครงการทั้งหมด
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-fade-in-up">
            {PROJECTS.map((project) => {
              const Icon = project.icon;
              const isActive = project.status === 'active';
              return (
                <Link key={project.id} href={isActive ? project.href : '#'}>
                  <div
                    className={`glass-card rounded-xl p-5 transition-all duration-200 ${isActive ? 'hover:shadow-md cursor-pointer' : 'opacity-60 cursor-default'}`}
                    style={{ borderLeft: `3px solid ${project.color}` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${project.color}15` }}>
                        <Icon size={20} style={{ color: project.color }} />
                      </div>
                      {isActive ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,199,89,0.15)', color: '#34c759' }}>
                          ใช้งานได้
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--bg-secondary)', color: 'var(--muted)' }}>
                          <Clock size={10} /> เร็วๆ นี้
                        </span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {project.label}
                    </h3>
                    <p className="text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
                      {project.description}
                    </p>
                    {isActive && (
                      <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color: project.color }}>
                        เข้าดูภาพรวม <ArrowRight size={14} />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>)}

        {/* Company List — visible to ALL users, grouped by BU */}
        <div className="mt-10 mb-4 animate-fade-in-up">
          <h2 className="text-[20px] font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            เข้าสู่ระบบผู้ใช้งาน คลิกชื่อบริษัทเพื่อเข้าสู่ User Login
          </h2>
          {(() => {
            // Define BU display order and colors
            const BU_ORDER = ['EV', 'Renewable Energy', 'Biodiesel', 'Waste Management', ''];
            const BU_LABELS: Record<string, string> = {
              'EV': 'EV',
              'Renewable Energy': 'Renewable Energy',
              'Biodiesel': 'Biodiesel',
              'Waste Management': 'Waste Management',
              '': 'ไม่ระบุ',
            };
            const BU_COLORS: Record<string, string> = {
              'EV': '#f59e0b',
              'Renewable Energy': '#0ea5e9',
              'Biodiesel': '#16a34a',
              'Waste Management': '#ef4444',
              '': '#9ca3af',
            };

            // Group companies by BU (uses DB overrides), sorted alphabetically within each group
            const grouped = BU_ORDER.map(bu => ({
              bu,
              label: BU_LABELS[bu] || bu || 'ไม่ระบุ',
              color: BU_COLORS[bu] || '#9ca3af',
              companies: companiesWithDbBu
                .filter(c => (c.bu || '') === bu)
                .sort((a, b) => a.shortName.localeCompare(b.shortName)),
            })).filter(g => g.companies.length > 0);

            return grouped.map(group => (
              <div key={group.bu} className="mb-5">
                <h3
                  className="text-[14px] font-semibold mb-2"
                  style={{
                    color: 'var(--text-primary)',
                    borderLeft: `3px solid ${group.color}`,
                    paddingLeft: '8px',
                  }}
                >
                  {group.label}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {group.companies.map((company) => {
                    const isActive = true;
                    const ca = auth.getCompanyAuth(company.id);
                    const isLoggedIn = ca.isLoggedIn || auth.isAdmin;
                    return (
                      <div
                        key={company.id}
                        onClick={() => openLoginModal(company.id, company.shortName)}
                        className={`glass-card rounded-xl p-4 transition-all duration-200 text-center ${isActive ? 'hover:scale-[1.03] cursor-pointer' : 'opacity-40 cursor-default'}`}
                        style={{ border: '1px solid var(--border)' }}
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-[12px] font-bold text-white"
                          style={{ background: isActive ? 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)' : 'var(--bg-secondary)' }}>
                          {isActive ? company.shortName.substring(0, 2) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: isActive ? 'var(--text-primary)' : 'var(--muted)' }}>
                          {company.shortName}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: isLoggedIn ? 'var(--success)' : 'var(--muted)' }}>
                          {isLoggedIn ? '✓ เข้าสู่ระบบแล้ว' : 'คลิกเพื่อเข้าสู่ระบบ'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Login Modal Overlay */}
        {loginModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setLoginModal(null)}
          >
            <div
              className="rounded-2xl p-0 w-full max-w-[380px] animate-fade-in-up overflow-hidden"
              style={{
                background: '#ffffff',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header — gradient banner */}
              <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                      {loginModal.companyName.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-white">
                        {loginModal.companyName}
                      </h3>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>เข้าสู่ระบบผู้ใช้งาน</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLoginModal(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    <X size={16} style={{ color: '#fff' }} />
                  </button>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 py-5">
                {/* Username */}
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>USERNAME</label>
                <div className="relative mb-4">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={loginUser}
                    onChange={e => setLoginUser(e.target.value)}
                    placeholder="Username (ถ้ามี)"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }}
                    autoFocus
                  />
                </div>

                {/* Password */}
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>PASSWORD</label>
                <div className="relative mb-4">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                  <input
                    type="password"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCompanyLogin()}
                    placeholder="รหัสผ่าน"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }}
                  />
                </div>

                {/* Error */}
                {loginError && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-[12px]" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    {loginError}
                  </div>
                )}

                {/* Login Button */}
                <button
                  onClick={handleCompanyLogin}
                  disabled={!loginPass || loginLoading}
                  className="w-full py-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  style={{
                    background: loginPass ? 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' : '#e5e7eb',
                    color: loginPass ? '#fff' : '#9ca3af',
                    cursor: loginPass ? 'pointer' : 'not-allowed',
                    opacity: loginLoading ? 0.7 : 1,
                    boxShadow: loginPass ? '0 4px 14px rgba(0,122,255,0.3)' : 'none',
                  }}
                >
                  {loginLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LogIn size={16} />
                  )}
                  {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Inline admin login form component
function AdminLoginForm() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    const result = await auth.adminLogin(username, password);
    if (!result.success) setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  return (
    <>
      <input
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Username"
        className="w-full px-3 py-2.5 rounded-lg text-sm mb-2 focus:outline-none"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        autoFocus
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        placeholder="รหัสผ่าน"
        className="w-full px-3 py-2.5 rounded-lg text-sm mb-3 focus:outline-none"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
      {error && <p style={{ color: 'var(--danger)' }} className="text-xs mb-3">{error}</p>}
      <button onClick={handleLogin} disabled={!password} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium">
        เข้าสู่ระบบ
      </button>
    </>
  );
}
