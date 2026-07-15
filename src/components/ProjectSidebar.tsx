'use client';

// Project-scoped sidebar — one sidebar per project, not mixed together
// Mobile: slides in as a drawer overlay with backdrop
// Desktop: persistent sticky sidebar
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import type { ProjectConfig } from '@/lib/projects';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';

interface Props {
  project: ProjectConfig;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

export default function ProjectSidebar({ project }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { companies } = useCompanies();
  const isMobile = useIsMobile();

  // Desktop: sidebar open/collapsed. Mobile: drawer open/closed.
  const [isOpen, setIsOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isMobile && drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, drawerOpen]);

  const isAdmin = auth.isAdmin;
  const urlCompany = searchParams.get('company');
  const companyAuthIds = Object.keys(auth.companyAuth);

  // Company can come from the path segment (/projects/<proj>/<cid>/...) —
  // previously only ?company= was read, so the selector showed "ทุกบริษัท"
  // on company pages and selecting it again did nothing.
  const pathCompany = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean); // ['projects', '<proj>', '<cid>', ...]
    const cand = parts[2];
    if (!cand) return null;
    return companies.some((c) => c.id === cand) ? cand : null;
  }, [pathname, companies]);

  const defaultCompany = pathCompany || urlCompany || (isAdmin ? 'all' : companyAuthIds[0] || 'all');

  const [companyId, setCompanyId] = useState(defaultCompany);
  useEffect(() => { setCompanyId(defaultCompany); }, [defaultCompany]);

  const availableCompanies = isAdmin
    ? companies
    : companies.filter((c) => companyAuthIds.includes(c.id));

  const handleCompanyChange = (cid: string) => {
    setCompanyId(cid);
    const currentItem =
      project.nav.find((item) => {
        const h = item.href(companyId).split('?')[0];
        return h === pathname;
      }) || project.nav.find((item) => !item.adminOnly && !(item.companyRequired && cid === 'all')) || project.nav[0];

    const params = new URLSearchParams(searchParams.toString());
    params.delete('company');
    const queryStr = params.toString();
    const baseHref = currentItem.href(cid);
    const [base, existingQuery] = baseHref.split('?');
    const mergedQuery = [existingQuery, queryStr].filter(Boolean).join('&');
    const finalUrl = mergedQuery ? `${base}?${mergedQuery}` : base;
    router.push(finalUrl);
  };

  const handleLogout = () => {
    if (auth.isAdmin) auth.adminLogout();
    companyAuthIds.forEach((cid) => auth.companyLogout(cid));
    router.push('/projects');
  };

  // Active nav detection
  const currentPlan = searchParams.get('plan');
  const pathMatches = project.nav.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.companyRequired && companyId === 'all') return false;
    return item.href(companyId).split('?')[0] === pathname;
  });
  const activeItemId = (() => {
    if (pathMatches.length === 0) return null;
    if (pathMatches.length === 1) return pathMatches[0].id;
    for (const item of pathMatches) {
      const qs = item.href(companyId).split('?')[1] || '';
      if (new URLSearchParams(qs).get('plan') === currentPlan) return item.id;
    }
    for (const item of pathMatches) {
      const qs = item.href(companyId).split('?')[1] || '';
      if (!new URLSearchParams(qs).get('plan')) return item.id;
    }
    return pathMatches[0].id;
  })();

  const ProjectIcon = project.icon;
  const sidebarWidth = isOpen ? 256 : 80;

  // ─── Sidebar content (shared between mobile drawer and desktop aside) ───
  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {isOpen && (
          <div className="flex items-center gap-2">
            <ProjectIcon size={20} />
            <div>
              <div className="text-xs text-white/60">Project</div>
              <div className="text-sm font-bold">{project.shortName}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => isMobile ? setDrawerOpen(false) : setIsOpen(!isOpen)}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          {(isMobile || isOpen) ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Company Selector */}
      {isOpen && (
        <div className="p-4 border-b border-white/10">
          <label className="text-xs text-white/60 block mb-1">
            {isAdmin ? 'เลือกบริษัท (Admin)' : 'บริษัท'}
          </label>
          <div className="relative">
            <select
              value={companyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              disabled={!isAdmin && availableCompanies.length < 2}
              className="w-full bg-black/30 border border-white/20 text-white text-sm rounded-lg pl-8 pr-8 py-2 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAdmin && <option value="all">ทุกบริษัท (ภาพรวม)</option>}
              {availableCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.fullName || ''}
                </option>
              ))}
            </select>
            <Building2 size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
          </div>
          {isAdmin && (
            <p className="text-[10px] text-yellow-200 mt-2">
              <span className="bg-yellow-400/20 px-1.5 py-0.5 rounded">ADMIN</span>{' '}
              {auth.adminName}
            </p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {project.nav.map((item) => {
          const ItemIcon = item.icon;
          if (item.adminOnly && !isAdmin) return null;
          if (item.companyRequired && companyId === 'all') return null;
          const href = item.href(companyId);
          const isActive = activeItemId === item.id;
          return (
            <Link
              key={item.id}
              href={href}
              title={!isOpen ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                isActive ? 'bg-white/25 text-white font-semibold shadow-sm' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <ItemIcon size={18} />
              {isOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {isAdmin && (
          <Link
            href="/projects/admin"
            title={!isOpen ? 'ภาพรวม KPI' : undefined}
            className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
          >
            <BarChart3 size={16} />
            {isOpen && <span>ภาพรวม KPI</span>}
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/projects/admin/analytics"
            title={!isOpen ? 'วิเคราะห์เชิงลึก' : undefined}
            className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
          >
            <TrendingUp size={16} />
            {isOpen && <span>วิเคราะห์เชิงลึก</span>}
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/projects/settings"
            title={!isOpen ? 'ตั้งค่า Admin' : undefined}
            className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
          >
            <Settings size={16} />
            {isOpen && <span>ตั้งค่า Admin</span>}
          </Link>
        )}
        {(Object.keys(auth.companyAuth).length > 0 || auth.isAdmin) && (
          <Link
            href="/change-password"
            title={!isOpen ? 'เปลี่ยนรหัสผ่าน' : undefined}
            className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
          >
            <KeyRound size={16} />
            {isOpen && <span>เปลี่ยนรหัสผ่าน</span>}
          </Link>
        )}
        <Link
          href="/projects"
          title={!isOpen ? 'เลือกโครงการอื่น' : undefined}
          className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
        >
          <ArrowLeft size={16} />
          {isOpen && <span>เลือกโครงการอื่น</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={!isOpen ? 'ออกจากระบบ' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
        >
          <LogOut size={16} />
          {isOpen && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </>
  );

  // ─── MOBILE: hamburger + drawer overlay ───
  if (isMobile) {
    return (
      <>
        {/* Floating hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 40,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: project.accentColor,
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Menu size={22} />
        </button>

        {/* Backdrop */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
        )}

        {/* Drawer */}
        <aside
          className="text-white flex flex-col"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 50,
            width: 280,
            height: '100vh',
            background: `linear-gradient(180deg, ${project.accentColor}, #0f172a)`,
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: drawerOpen ? '10px 0 40px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // ─── DESKTOP: sticky persistent sidebar ───
  return (
    <aside
      className="text-white transition-all duration-300 flex flex-col flex-shrink-0"
      style={{
        width: sidebarWidth,
        background: `linear-gradient(180deg, ${project.accentColor}, #0f172a)`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        maxHeight: '100vh',
        alignSelf: 'flex-start',
      }}
    >
      {sidebarContent}
    </aside>
  );
}
