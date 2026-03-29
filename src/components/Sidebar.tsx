'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  Shield,
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Search,
  FileWarning,
  FileText,
  Settings,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  Home,
} from 'lucide-react';

const PROJECTS = [
  { id: 'action-plan', label: 'แผนงานประจำปี', icon: ClipboardList, hqHref: '/action-plan', companyPath: '' },
  { id: 'training', label: 'แผนอบรมประจำปี', icon: GraduationCap, hqHref: '/training', companyPath: '/training' },
  { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, hqHref: '/incidents', companyPath: '/incidents' },
  { id: 'safety-patrol', label: 'Safety Patrol', icon: Search, hqHref: '/safety-patrol', companyPath: '/safety-patrol' },
  { id: 'risk', label: 'ประเมินความเสี่ยง', icon: FileWarning, hqHref: '/risk', companyPath: '/risk' },
  { id: 'nearmiss', label: 'Near Miss Report', icon: FileText, hqHref: '/nearmiss', companyPath: '/nearmiss' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const auth = useAuth();

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % 3]);
  };

  // Determine which companies the user has access to
  const loggedInCompanyIds = Object.keys(auth.companyAuth);
  const activeCompanies = COMPANIES.filter(c => c.sheetId !== '');

  // Show info based on auth state
  const isAnyAuth = auth.isAdmin || loggedInCompanyIds.length > 0;
  const displayName = auth.isAdmin ? auth.adminName : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.displayName : '');
  const displayRole = auth.isAdmin ? 'Admin' : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.companyName : '');

  return (
    <aside
      className={`${collapsed ? 'w-[68px]' : 'w-[260px]'} flex-shrink-0 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] h-screen sticky top-0`}
      style={{
        background: 'var(--card-solid)',
        borderRight: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--info) 100%)' }}>
              <Shield size={18} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>Safety & Env</h1>
              <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Dashboard</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--info) 100%)' }}>
              <Shield size={18} color="white" strokeWidth={2.5} />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-3 flex items-center gap-1 text-[11px] font-medium transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> ย่อเมนู</>}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

      {/* Projects navigation */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        {/* Home link — Admin only */}
        {auth.isAdmin && (
          <div className="mb-2">
            <Link href="/">
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
                style={{
                  color: pathname === '/' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: pathname === '/' ? 600 : 400,
                  background: pathname === '/' ? 'var(--accent-glow)' : 'transparent',
                }}
              >
                <Home size={18} strokeWidth={pathname === '/' ? 2.2 : 1.8} className="flex-shrink-0" />
                {!collapsed && <span>Home</span>}
              </div>
            </Link>
          </div>
        )}

        {/* Project menus — visible to all logged-in users */}
        {(auth.isAdmin || loggedInCompanyIds.length > 0) && (
          <>
            <p className={`text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2 ${collapsed ? 'hidden' : ''}`}
              style={{ color: 'var(--muted)' }}>
              {auth.isAdmin ? 'HQ Overview' : 'เมนู'}
            </p>
            <div className="space-y-0.5">
              {PROJECTS.map((p) => {
                // Admin links to HQ pages, Company user links to their company page
                const href = auth.isAdmin
                  ? p.hqHref
                  : `/company/${loggedInCompanyIds[0]}${p.companyPath}`;
                const isActive = auth.isAdmin
                  ? (pathname === p.hqHref || pathname.startsWith(p.hqHref + '/'))
                  : pathname === `/company/${loggedInCompanyIds[0]}${p.companyPath}`;
                const Icon = p.icon;
                return (
                  <Link key={p.id} href={href}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? 'var(--accent-glow)' : 'transparent',
                      }}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{p.label}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Company links — show only for Admin and non-logged-in users */}
        {(auth.isAdmin || loggedInCompanyIds.length === 0) && (
        <div className={`${auth.isAdmin ? 'mt-4 pt-3' : ''}`}>
          {!collapsed && (
            <>
              {auth.isAdmin && <div className="mx-3 mb-3 h-px" style={{ background: 'var(--border)' }} />}
              <p className="text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2"
                style={{ color: 'var(--muted)' }}>
                บริษัท
              </p>
            </>
          )}
          <div className="space-y-0.5">
            {activeCompanies
              .map((c) => {
                const isActive = pathname === `/company/${c.id}`;
                return (
                  <Link key={c.id} href={`/company/${c.id}`}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] cursor-pointer transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? 'var(--accent-glow)' : 'transparent',
                      }}
                    >
                      <Building2 size={16} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{c.shortName}</span>}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
        )}

        {/* Management section — Admin only */}
        {auth.isAdmin && (
          <div className={`mt-5 pt-4 ${collapsed ? 'hidden' : ''}`}>
            <div className="mx-3 mb-3 h-px" style={{ background: 'var(--border)' }} />
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2"
              style={{ color: 'var(--muted)' }}>
              จัดการ
            </p>
            <Link href="/admin">
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200"
                style={{
                  color: pathname === '/admin' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: pathname === '/admin' ? 600 : 400,
                  background: pathname === '/admin' ? 'var(--accent-glow)' : 'transparent',
                }}
              >
                <Settings size={18} strokeWidth={pathname === '/admin' ? 2.2 : 1.8} />
                <span>Admin / ตั้งค่า</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Theme toggle + User info */}
      <div className={`${collapsed ? 'hidden' : ''}`} style={{ borderTop: '1px solid var(--border)' }}>
        {/* Theme toggle */}
        <div className="px-4 pt-3 pb-2">
          <button
            onClick={cycleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
            }}
          >
            {theme === 'light' && <><Sun size={14} /> Light</>}
            {theme === 'dark' && <><Moon size={14} /> Dark</>}
            {theme === 'system' && <><Monitor size={14} /> Auto</>}
          </button>
        </div>

        {/* User info */}
        <div className="px-4 pb-4 pt-1">
          {isAnyAuth ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: auth.isAdmin ? 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)' : 'linear-gradient(135deg, #34c759 0%, #007aff 100%)' }}>
                {auth.isAdmin ? 'HQ' : (displayName || '?').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                <p className="text-[10px] font-medium truncate" style={{ color: 'var(--muted)' }}>{displayRole}</p>
              </div>
              <button
                onClick={() => {
                  if (auth.isAdmin) auth.adminLogout();
                  loggedInCompanyIds.forEach(id => auth.companyLogout(id));
                  window.location.reload();
                }}
                className="text-[10px] p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--muted)' }}
                title="ออกจากระบบ"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: 'var(--bg-secondary)', color: 'var(--muted)' }}>
                ?
              </div>
              <div>
                <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--muted)' }}>ยังไม่ได้เข้าสู่ระบบ</p>
                <p className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>กรุณา Login</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
