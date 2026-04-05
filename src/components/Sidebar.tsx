'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  Shield,
  Leaf,
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
  ChevronDown,
  Users,
  LogOut,
  Home,
  Clock,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';

// ── Menu item type ──────────────────────────────────────────────
interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  hqHref: string;          // HQ-level path (empty = companyOnly)
  companyPath: string;      // appended to /company/{id}
  ready: true | false | 'hasSheet' | 'companyOnly';
}

// ── Grouped menu structure ──────────────────────────────────────
interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;            // accent color for the group header
  defaultOpen: boolean;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'general',
    label: 'ทั่วไป',
    icon: Home,
    color: 'var(--text-secondary)',
    defaultOpen: true,
    items: [
      { id: 'employees', label: 'จัดการพนักงาน', icon: Users, hqHref: '/employees', companyPath: '/employees', ready: true },
      { id: 'manhours', label: 'ชั่วโมงการทำงาน', icon: Clock, hqHref: '', companyPath: '/manhours', ready: 'companyOnly' },
      { id: 'projects', label: 'โครงการพิเศษ', icon: FolderKanban, hqHref: '', companyPath: '/projects', ready: 'companyOnly' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    icon: Shield,
    color: '#ff6b35',
    defaultOpen: true,
    items: [
      { id: 'action-plan', label: 'แผนงาน Safety', icon: ClipboardList, hqHref: '/action-plan', companyPath: '/action-plan', ready: 'hasSheet' },
      { id: 'training', label: 'แผนอบรมประจำปี', icon: GraduationCap, hqHref: '/training', companyPath: '/training', ready: true },
      { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, hqHref: '/incidents', companyPath: '/incidents', ready: true },
      { id: 'nearmiss', label: 'Near Miss', icon: FileText, hqHref: '/admin/nearmiss', companyPath: '/nearmiss', ready: true },
      { id: 'safety-patrol', label: 'Safety Patrol', icon: Search, hqHref: '/safety-patrol', companyPath: '/safety-patrol', ready: false },
      { id: 'risk', label: 'ประเมินความเสี่ยง', icon: FileWarning, hqHref: '/risk', companyPath: '/risk', ready: false },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: Leaf,
    color: '#34c759',
    defaultOpen: true,
    items: [
      { id: 'action-plan-env', label: 'แผนงาน Environment', icon: ClipboardList, hqHref: '/action-plan', companyPath: '/action-plan?plan=environment', ready: 'hasSheet' },
      // Future items:
      // { id: 'env-audit', label: 'ตรวจสอบสิ่งแวดล้อม', icon: Search, hqHref: '', companyPath: '/env-audit', ready: false },
      // { id: 'env-compliance', label: 'ใบอนุญาต / Compliance', icon: FileText, hqHref: '', companyPath: '/env-compliance', ready: false },
    ],
  },
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

  // Fetch DB company settings (for sheetId overrides)
  const [dbSheetMap, setDbSheetMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          const map: Record<string, string> = {};
          data.settings.forEach((s: { company_id: string; sheet_id?: string }) => {
            if (s.sheet_id) map[s.company_id] = s.sheet_id;
          });
          setDbSheetMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Group collapse state — persisted in localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed_groups');
      if (saved) setCollapsedGroups(JSON.parse(saved));
    } catch {}
  }, []);
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem('sidebar_collapsed_groups', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Determine which companies the user has access to
  const loggedInCompanyIds = Object.keys(auth.companyAuth);

  // Detect if we're on a company page
  const companyMatch = pathname.match(/^\/company\/([^/]+)/);
  const currentCompanyId = companyMatch ? companyMatch[1] : null;

  // Show info based on auth state
  const isAnyAuth = auth.isAdmin || loggedInCompanyIds.length > 0;
  const displayName = auth.isAdmin ? auth.adminName : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.displayName : '');
  const displayRole = auth.isAdmin ? 'Admin' : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.companyName : '');

  // Helper: resolve menu item → href, isActive, isReady
  const resolveItem = (item: MenuItem) => {
    const companyForLinks = auth.isAdmin ? null : (currentCompanyId || loggedInCompanyIds[0]);
    const currentCompany = companyForLinks ? COMPANIES.find(c => c.id === companyForLinks) : null;

    const isCompanyOnly = item.ready === 'companyOnly';
    const isReady = isCompanyOnly
      ? !!currentCompanyId
      : auth.isAdmin
        ? true
        : item.ready === 'hasSheet' ? !!(currentCompany?.sheetId || (companyForLinks && dbSheetMap[companyForLinks])) : item.ready;

    // Skip companyOnly items when admin is on HQ page
    const hidden = isCompanyOnly && !currentCompanyId;

    // Build href — strip query params for path matching
    const companyPathBase = item.companyPath.split('?')[0];
    const href = isReady
      ? (isCompanyOnly
        ? `/company/${currentCompanyId}${item.companyPath}`
        : auth.isAdmin ? (item.hqHref || '#') : companyForLinks ? `/company/${companyForLinks}${item.companyPath}` : '#')
      : '#';

    const isActive = isCompanyOnly
      ? pathname === `/company/${currentCompanyId}${companyPathBase}`
      : auth.isAdmin
        ? (item.hqHref ? (pathname === item.hqHref || pathname.startsWith(item.hqHref + '/')) : false)
        : companyForLinks ? pathname === `/company/${companyForLinks}${companyPathBase}` : false;

    return { href, isActive, isReady: !!isReady, hidden };
  };

  // Check if any item in a group is active (to auto-highlight group header)
  const isGroupActive = (group: MenuGroup) => {
    return group.items.some(item => {
      const { isActive } = resolveItem(item);
      return isActive;
    });
  };

  // Check if group has any visible items
  const hasVisibleItems = (group: MenuGroup) => {
    return group.items.some(item => {
      const { hidden, isReady } = resolveItem(item);
      return !hidden;
    });
  };

  const showMenus = auth.isAdmin || loggedInCompanyIds.length > 0 || currentCompanyId;

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
            <img src="/ea-logo.svg" alt="EA" className="h-8 object-contain" />
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>Safety & Env</h1>
              <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Dashboard</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src="/ea-logo.svg" alt="EA" className="h-8 object-contain" />
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

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        {/* Home link — always visible */}
        <div className="mb-3">
          <Link href={currentCompanyId ? `/company/${currentCompanyId}` : '/'}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
              style={{
                color: (pathname === '/' || pathname === `/company/${currentCompanyId}`) ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: (pathname === '/' || pathname === `/company/${currentCompanyId}`) ? 600 : 400,
                background: (pathname === '/' || pathname === `/company/${currentCompanyId}`) ? 'var(--accent-glow)' : 'transparent',
              }}
            >
              <Home size={18} strokeWidth={(pathname === '/' || pathname === `/company/${currentCompanyId}`) ? 2.2 : 1.8} className="flex-shrink-0" />
              {!collapsed && <span>{currentCompanyId && !auth.isAdmin ? 'เลือกโครงการ' : 'Home'}</span>}
            </div>
          </Link>
        </div>

        {/* Grouped menus */}
        {showMenus && MENU_GROUPS.map(group => {
          if (!hasVisibleItems(group)) return null;
          const groupActive = isGroupActive(group);
          const isOpen = !collapsedGroups[group.id];
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-1">
              {/* Group header — clickable to collapse/expand */}
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-[0.08em] font-bold transition-colors"
                  style={{ color: groupActive ? group.color : 'var(--muted)' }}
                >
                  <GroupIcon size={13} strokeWidth={2.2} />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    size={12}
                    className="transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  />
                </button>
              ) : (
                <div className="flex justify-center py-1.5 mb-0.5" title={group.label}>
                  <GroupIcon size={14} style={{ color: groupActive ? group.color : 'var(--muted)' }} />
                </div>
              )}

              {/* Group items */}
              {(isOpen || collapsed) && (
                <div className={`space-y-0.5 ${!collapsed ? 'ml-1' : ''}`}>
                  {group.items.map(item => {
                    const { href, isActive, isReady, hidden } = resolveItem(item);
                    if (hidden) return null;
                    const Icon = item.icon;

                    const content = (
                      <div
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
                        style={{
                          color: !isReady ? 'var(--muted)' : isActive ? group.color : 'var(--text-secondary)',
                          fontWeight: isActive ? 600 : 400,
                          background: isActive ? `${group.color}12` : 'transparent',
                          cursor: isReady ? 'pointer' : 'default',
                          opacity: isReady ? 1 : 0.5,
                        }}
                      >
                        <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                        {!collapsed && !isReady && (
                          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>เร็วๆ นี้</span>
                        )}
                      </div>
                    );

                    return isReady ? (
                      <Link key={item.id} href={href}>{content}</Link>
                    ) : (
                      <div key={item.id}>{content}</div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* HQ Overview link — visible when on a company page (for any logged-in user) */}
        {currentCompanyId && isAnyAuth && !collapsed && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2"
              style={{ color: 'var(--muted)' }}>
              ภาพรวม HQ
            </p>
            <div className="space-y-0.5">
              <Link href="/training">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200"
                  style={{
                    color: pathname === '/training' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: pathname === '/training' ? 600 : 400,
                    background: pathname === '/training' ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <GraduationCap size={18} strokeWidth={1.8} className="flex-shrink-0" />
                  <span>ภาพรวมแผนอบรม</span>
                </div>
              </Link>
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
                  window.location.href = '/';
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
