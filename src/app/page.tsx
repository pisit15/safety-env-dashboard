'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
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
    status: 'coming' as const,
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

export default function HomePage() {
  const auth = useAuth();
  const [stats, setStats] = useState<QuickStat | null>(null);

  // Fetch quick stats from action-plan dashboard
  useEffect(() => {
    if (!auth.isAdmin) return;
    fetch('/api/dashboard?plan=total')
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
  }, [auth.isAdmin]);

  // Admin login gate
  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 w-full max-w-sm text-center" style={{ backdropFilter: 'blur(40px)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--info) 100%)' }}>
              <Key size={24} color="white" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>เข้าสู่ระบบ Admin</h2>
            <p className="text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
              หน้า Home สำหรับ Admin เท่านั้น
            </p>
            <AdminLoginForm />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <Shield size={22} className="inline mr-2" style={{ color: 'var(--accent)' }} />
            Safety & Environment Dashboard
          </h1>
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--muted)' }}>
            ศูนย์รวมระบบบริหารจัดการความปลอดภัยและสิ่งแวดล้อม — EA Group 2026
          </p>
        </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
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

        {/* Company List */}
        <div className="mt-10 mb-4 animate-fade-in-up">
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            <Building2 size={16} className="inline mr-1.5" style={{ color: 'var(--accent)' }} />
            บริษัทในกลุ่ม
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {COMPANIES.map((company) => {
              const isActive = company.sheetId !== '';
              return (
                <Link key={company.id} href={isActive ? `/company/${company.id}` : '#'}>
                  <div
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
                    <p className="text-[10px] mt-0.5" style={{ color: isActive ? 'var(--success)' : 'var(--muted)' }}>
                      {isActive ? 'พร้อมใช้งาน' : 'รอเชื่อมต่อ'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
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
