'use client';

// Project-scoped sidebar — one sidebar per project, not mixed together
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import type { ProjectConfig } from '@/lib/projects';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface Props {
  project: ProjectConfig;
}

export default function ProjectSidebar({ project }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { companies } = useCompanies();

  const isAdmin = auth.isAdmin;
  const urlCompany = searchParams.get('company');
  const companyAuthIds = Object.keys(auth.companyAuth);
  const defaultCompany =
    urlCompany ||
    (isAdmin ? 'all' : companyAuthIds[0] || 'all');

  const [companyId, setCompanyId] = useState(defaultCompany);
  useEffect(() => {
    setCompanyId(defaultCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCompany]);

  // Available companies for dropdown
  const availableCompanies = isAdmin
    ? companies
    : companies.filter((c) => companyAuthIds.includes(c.id));

  const handleCompanyChange = (cid: string) => {
    setCompanyId(cid);
    // Navigate to a company-aware URL. Try to preserve the current nav item
    // by finding which nav item matches the current pathname; otherwise fall
    // back to the project's first nav item.
    const currentItem =
      project.nav.find((item) => {
        const h = item.href(companyId).split('?')[0];
        return h === pathname;
      }) || project.nav.find((item) => !item.adminOnly && !(item.companyRequired && cid === 'all')) || project.nav[0];

    // Preserve existing query params (e.g. ?plan=safety) except 'company'
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

  const ProjectIcon = project.icon;

  return (
    <aside
      className={`${isOpen ? 'w-64' : 'w-20'} text-white transition-all duration-300 flex flex-col flex-shrink-0`}
      style={{
        background: `linear-gradient(180deg, ${project.accentColor}, #0f172a)`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        maxHeight: '100vh',
        alignSelf: 'flex-start',
      }}
    >
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
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
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
        {(() => {
          // Determine which nav item is currently active. Strategy:
          // 1. Find all items whose pathname matches the current pathname
          // 2. Among those, prefer item whose ?plan= query param matches current ?plan=
          // 3. If no plan match, pick the one with no plan query (default/overview)
          const currentPlan = searchParams.get('plan');
          const pathMatches = project.nav.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.companyRequired && companyId === 'all') return false;
            const baseHref = item.href(companyId).split('?')[0];
            return baseHref === pathname;
          });

          const activeItemId = (() => {
            if (pathMatches.length === 0) return null;
            if (pathMatches.length === 1) return pathMatches[0].id;
            // Multiple items share path — disambiguate by ?plan=
            for (const item of pathMatches) {
              const qs = item.href(companyId).split('?')[1] || '';
              const itemPlan = new URLSearchParams(qs).get('plan');
              if (itemPlan === currentPlan) return item.id;
            }
            // No plan match — prefer the one with no plan query (e.g. overview)
            for (const item of pathMatches) {
              const qs = item.href(companyId).split('?')[1] || '';
              if (!new URLSearchParams(qs).get('plan')) return item.id;
            }
            return pathMatches[0].id;
          })();

          return project.nav.map((item) => {
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
          });
        })()}
      </nav>

      {/* Footer actions */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/projects"
          className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
        >
          <ArrowLeft size={16} />
          {isOpen && <span>เลือกโครงการอื่น</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg text-sm"
        >
          <LogOut size={16} />
          {isOpen && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  );
}
