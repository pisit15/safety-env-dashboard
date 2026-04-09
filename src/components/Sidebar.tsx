'use client';
import { useState, useEffect, useCallback } from 'react';
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
  Menu,
  X,
  KeyRound,
  BookOpen,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

// ── Menu item type ──────────────────────────────────────────────
interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  hqHref: string;
  companyPath: string;
  ready: true | false | 'hasSheet' | 'companyOnly';
  superOnly?: boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  accentBg: string;
  defaultOpen: boolean;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'general',
    label: 'ทั่วไป',
    icon: Home,
    color: '#6b7280',
    accentBg: 'rgba(107,114,128,0.08)',
    defaultOpen: true,
    items: [
      { id: 'employees', label: 'จัดการพนักงาน', icon: Users, hqHref: '/employees', companyPath: '/employees', ready: true },
      { id: 'manhours', label: 'ชั่วโมงการทำงาน', icon: Clock, hqHref: '', companyPath: '/manhours', ready: 'companyOnly' },
      { id: 'projects', label: 'โครงการพิเศษ', icon: FolderKanban, hqHref: '', companyPath: '/projects', ready: 'companyOnly' },
      { id: 'guide', label: 'คู่มือการใช้งาน', icon: BookOpen, hqHref: '', companyPath: '/guide', ready: 'companyOnly' },
      { id: 'she-workforce', label: 'SHE Workforce', icon: Briefcase, hqHref: '/admin/she-workforce', companyPath: '/she-workforce', ready: true, superOnly: true },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    icon: Shield,
    color: '#f97316',
    accentBg: 'rgba(249,115,22,0.06)',
    defaultOpen: true,
    items: [
      { id: 'action-plan', label: 'แผนงาน Safety', icon: ClipboardList, hqHref: '/action-plan', companyPath: '/action-plan', ready: 'hasSheet' },
      { id: 'training', label: 'แผนอบรมประจำปี', icon: GraduationCap, hqHref: '/training', companyPath: '/training', ready: true },
      { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, hqHref: '/incidents', companyPath: '/incidents', ready: true },
      { id: 'nearmiss', label: 'Near Miss', icon: FileText, hqHref: '/admin/nearmiss', companyPath: '/nearmiss', ready: true },
      { id: 'safety-patrol', label: 'Safety Patrol', icon: Search, hqHref: '/safety-patrol', companyPath: '/safety-patrol', ready: false },
      { id: 'risk', label: 'ประเมินความเสี่ยง', icon: FileWarning, hqHref: '/risk', companyPath: '/risk', ready: 'companyOnly' },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: Leaf,
    color: '#22c55e',
    accentBg: 'rgba(34,197,94,0.06)',
    defaultOpen: true,
    items: [
      { id: 'action-plan-env', label: 'แผนงาน Environment', icon: ClipboardList, hqHref: '/action-plan', companyPath: '/action-plan?plan=environment', ready: 'hasSheet' },
    ],
  },
];

// ── Hook: detect mobile ────────────────────────────────────────
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

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const auth = useAuth();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // On mobile: flip parent flex container to column so spacer pushes content down
  useEffect(() => {
    if (!isMobile) return;
    const spacer = document.getElementById('sidebar-mobile-spacer');
    const parent = spacer?.parentElement;
    if (parent) {
      parent.style.flexDirection = 'column';
    }
    return () => {
      if (parent) parent.style.flexDirection = '';
    };
  }, [isMobile]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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

  // Group collapse state
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

  // Hover state
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const loggedInCompanyIds = Object.keys(auth.companyAuth);
  const companyMatch = pathname.match(/^\/company\/([^/]+)/);
  const currentCompanyId = companyMatch ? companyMatch[1] : null;
  const isAnyAuth = auth.isAdmin || loggedInCompanyIds.length > 0;
  const displayName = auth.isAdmin ? auth.adminName : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.displayName : '');
  const displayRole = auth.isAdmin ? 'Admin' : (loggedInCompanyIds.length > 0 ? auth.companyAuth[loggedInCompanyIds[0]]?.companyName : '');

  const resolveItem = useCallback((item: MenuItem) => {
    const companyForLinks = auth.isAdmin ? null : (currentCompanyId || loggedInCompanyIds[0]);
    const currentCompany = companyForLinks ? COMPANIES.find(c => c.id === companyForLinks) : null;
    const isCompanyOnly = item.ready === 'companyOnly';
    const isReady = isCompanyOnly
      ? !!currentCompanyId
      : auth.isAdmin
        ? true
        : item.ready === 'hasSheet' ? !!(currentCompany?.sheetId || (companyForLinks && dbSheetMap[companyForLinks])) : item.ready;
    const hidden = (isCompanyOnly && !currentCompanyId) || (item.superOnly && auth.adminRole !== 'super_admin');
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
  }, [auth.isAdmin, auth.adminRole, currentCompanyId, loggedInCompanyIds, dbSheetMap, pathname]);

  const isGroupActive = (group: MenuGroup) => group.items.some(item => resolveItem(item).isActive);
  const hasVisibleItems = (group: MenuGroup) => group.items.some(item => !resolveItem(item).hidden);

  const showMenus = auth.isAdmin || loggedInCompanyIds.length > 0 || currentCompanyId;

  // On mobile, never show collapsed desktop mode
  const isCollapsed = isMobile ? false : collapsed;

  // ── Shared sidebar content ─────────────────────────────────────
  const sidebarContent = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--card-solid)',
    }}>
      {/* ── Brand Header ── */}
      <div style={{ padding: isCollapsed ? '20px 12px 16px' : '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/ea-logo.svg" alt="EA" style={{ height: 38, objectFit: 'contain', flexShrink: 0 }} />
          {!isCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--text-primary)', margin: 0, lineHeight: 1.2,
              }}>Safety & Env</h1>
              <p style={{
                fontSize: 11, fontWeight: 500, color: 'var(--muted)',
                margin: '1px 0 0', letterSpacing: '0.01em',
              }}>Dashboard</p>
            </div>
          )}
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                marginLeft: 'auto', padding: 6, borderRadius: 8, border: 'none',
                background: 'var(--bg-secondary)', color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        {/* Desktop collapse toggle */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 500, color: 'var(--muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /> ย่อเมนู</>}
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: isCollapsed ? '0 8px' : '0 12px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Home / Select project */}
        <div style={{ marginBottom: 8 }}>
          <Link href={currentCompanyId ? `/company/${currentCompanyId}` : '/'}>
            <div
              onMouseEnter={() => setHoveredItem('home')}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: isCollapsed ? '10px 0' : '10px 12px',
                borderRadius: 10,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: (pathname === '/' || pathname === `/company/${currentCompanyId}`)
                  ? '#007aff' : 'var(--text-secondary)',
                fontWeight: (pathname === '/' || pathname === `/company/${currentCompanyId}`) ? 600 : 500,
                fontSize: 13,
                background: (pathname === '/' || pathname === `/company/${currentCompanyId}`)
                  ? 'rgba(0,122,255,0.08)'
                  : hoveredItem === 'home' ? 'var(--bg-secondary)' : 'transparent',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (pathname === '/' || pathname === `/company/${currentCompanyId}`)
                  ? 'rgba(0,122,255,0.12)' : 'var(--bg-secondary)',
                color: (pathname === '/' || pathname === `/company/${currentCompanyId}`)
                  ? '#007aff' : 'var(--muted)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}>
                <Home size={16} strokeWidth={2} />
              </div>
              {!isCollapsed && <span>{currentCompanyId && !auth.isAdmin ? 'เลือกโครงการ' : 'Home'}</span>}
            </div>
          </Link>
        </div>

        {/* ── Menu Groups ── */}
        {showMenus && MENU_GROUPS.map(group => {
          if (!hasVisibleItems(group)) return null;
          const groupActive = isGroupActive(group);
          const isOpen = !collapsedGroups[group.id];
          const GroupIcon = group.icon;

          return (
            <div key={group.id} style={{ marginBottom: 6 }}>
              {/* Group Header */}
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.id)}
                  onMouseEnter={() => setHoveredItem(`group-${group.id}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    cursor: 'pointer',
                    background: hoveredItem === `group-${group.id}` ? group.accentBg : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: groupActive ? `${group.color}18` : 'transparent',
                    color: groupActive ? group.color : 'var(--muted)',
                    transition: 'all 0.15s ease',
                  }}>
                    <GroupIcon size={13} strokeWidth={2.2} />
                  </div>
                  <span style={{
                    flex: 1, textAlign: 'left', fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: groupActive ? group.color : 'var(--muted)',
                    transition: 'color 0.15s ease',
                  }}>{group.label}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      color: 'var(--muted)',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>
              ) : (
                <div style={{
                  display: 'flex', justifyContent: 'center', padding: '6px 0',
                  marginBottom: 2,
                }} title={group.label}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: groupActive ? `${group.color}12` : 'transparent',
                    color: groupActive ? group.color : 'var(--muted)',
                  }}>
                    <GroupIcon size={15} strokeWidth={2} />
                  </div>
                </div>
              )}

              {/* Group Items */}
              {(isOpen || isCollapsed) && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 1,
                  marginLeft: isCollapsed ? 0 : 4,
                  paddingLeft: isCollapsed ? 0 : 0,
                  marginTop: 2,
                }}>
                  {group.items.map(item => {
                    const { href, isActive, isReady, hidden } = resolveItem(item);
                    if (hidden) return null;
                    const Icon = item.icon;

                    // Hide "เร็วๆ นี้" items on mobile
                    if (isMobile && !isReady) return null;

                    const itemKey = `${group.id}-${item.id}`;
                    const isHovered = hoveredItem === itemKey;

                    const content = (
                      <div
                        onMouseEnter={() => setHoveredItem(itemKey)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: isCollapsed ? '9px 0' : '9px 12px',
                          borderRadius: 10,
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          cursor: isReady ? 'pointer' : 'default',
                          opacity: isReady ? 1 : 0.4,
                          transition: 'all 0.15s ease',
                          position: 'relative' as const,
                          // Active: colored pill background
                          background: isActive
                            ? `${group.color}10`
                            : (isHovered && isReady) ? 'var(--bg-secondary)' : 'transparent',
                        }}
                      >
                        {/* Active indicator bar */}
                        {isActive && !isCollapsed && (
                          <div style={{
                            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                            width: 3, height: 20, borderRadius: 2,
                            background: group.color,
                          }} />
                        )}

                        {/* Icon container */}
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isActive
                            ? `${group.color}15`
                            : (isHovered && isReady) ? 'var(--bg-secondary)' : 'transparent',
                          color: isActive ? group.color : isReady ? 'var(--text-secondary)' : 'var(--muted)',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}>
                          <Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} />
                        </div>

                        {!isCollapsed && (
                          <>
                            <span style={{
                              fontSize: 13, fontWeight: isActive ? 600 : 450,
                              color: isActive ? group.color : isReady ? 'var(--text-primary)' : 'var(--muted)',
                              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              letterSpacing: '-0.005em',
                              transition: 'color 0.15s ease',
                            }}>
                              {item.label}
                            </span>
                            {!isReady && (
                              <span style={{
                                fontSize: 9, fontWeight: 600, color: 'var(--muted)',
                                padding: '2px 6px', borderRadius: 4,
                                background: 'var(--bg-secondary)',
                                letterSpacing: '0.02em',
                              }}>เร็วๆ นี้</span>
                            )}
                          </>
                        )}
                      </div>
                    );

                    return isReady ? (
                      <Link key={item.id} href={href} style={{ textDecoration: 'none' }}>{content}</Link>
                    ) : (
                      <div key={item.id}>{content}</div>
                    );
                  })}
                </div>
              )}

              {/* Subtle separator between groups */}
              {!isCollapsed && (
                <div style={{
                  margin: '6px 12px 4px',
                  height: 1,
                  background: 'var(--border)',
                  opacity: 0.5,
                }} />
              )}
            </div>
          );
        })}

        {/* HQ Overview link */}
        {currentCompanyId && isAnyAuth && !isCollapsed && (
          <div style={{ marginTop: 8, paddingTop: 4 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--muted)',
              padding: '6px 12px 6px',
            }}>ภาพรวม HQ</div>
            <Link href="/training" style={{ textDecoration: 'none' }}>
              <div
                onMouseEnter={() => setHoveredItem('hq-training')}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  color: pathname === '/training' ? '#007aff' : 'var(--text-secondary)',
                  fontWeight: pathname === '/training' ? 600 : 500,
                  fontSize: 13,
                  background: pathname === '/training'
                    ? 'rgba(0,122,255,0.08)'
                    : hoveredItem === 'hq-training' ? 'var(--bg-secondary)' : 'transparent',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pathname === '/training' ? 'rgba(0,122,255,0.12)' : 'var(--bg-secondary)',
                  color: pathname === '/training' ? '#007aff' : 'var(--muted)',
                  flexShrink: 0,
                }}>
                  <GraduationCap size={16} strokeWidth={1.8} />
                </div>
                <span>ภาพรวมแผนอบรม</span>
              </div>
            </Link>
          </div>
        )}

        {/* Admin section */}
        {auth.isAdmin && !isCollapsed && (
          <div style={{ marginTop: 8, paddingTop: 4 }}>
            <div style={{
              margin: '0 12px 6px', height: 1,
              background: 'var(--border)', opacity: 0.5,
            }} />
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--muted)',
              padding: '6px 12px 6px',
            }}>จัดการ</div>
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <div
                onMouseEnter={() => setHoveredItem('admin')}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  color: pathname === '/admin' ? '#5856d6' : 'var(--text-secondary)',
                  fontWeight: pathname === '/admin' ? 600 : 500,
                  fontSize: 13,
                  background: pathname === '/admin'
                    ? 'rgba(88,86,214,0.08)'
                    : hoveredItem === 'admin' ? 'var(--bg-secondary)' : 'transparent',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pathname === '/admin' ? 'rgba(88,86,214,0.12)' : 'var(--bg-secondary)',
                  color: pathname === '/admin' ? '#5856d6' : 'var(--muted)',
                  flexShrink: 0,
                }}>
                  <Settings size={16} strokeWidth={pathname === '/admin' ? 2.2 : 1.7} />
                </div>
                <span>Admin / ตั้งค่า</span>
              </div>
            </Link>
          </div>
        )}

        {/* Bottom spacer */}
        <div style={{ height: 16 }} />
      </div>

      {/* ── Footer: Theme + User ── */}
      {!isCollapsed && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            onMouseEnter={() => setHoveredItem('theme')}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 10, border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              color: 'var(--text-secondary)',
              background: hoveredItem === 'theme' ? 'var(--bg-secondary)' : 'transparent',
              transition: 'background 0.15s ease',
              marginBottom: 10,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', color: 'var(--muted)',
            }}>
              {theme === 'light' && <Sun size={14} />}
              {theme === 'dark' && <Moon size={14} />}
              {theme === 'system' && <Monitor size={14} />}
            </div>
            {theme === 'light' && 'Light Mode'}
            {theme === 'dark' && 'Dark Mode'}
            {theme === 'system' && 'Auto'}
          </button>

          {/* User info */}
          {isAnyAuth ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 12,
              background: 'var(--bg-secondary)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                background: auth.isAdmin
                  ? 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)'
                  : 'linear-gradient(135deg, #34c759 0%, #007aff 100%)',
                boxShadow: auth.isAdmin
                  ? '0 2px 8px rgba(0,122,255,0.3)'
                  : '0 2px 8px rgba(52,199,89,0.3)',
              }}>
                {auth.isAdmin ? 'HQ' : (displayName || '?').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                  margin: 0, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{displayName}</p>
                <p style={{
                  fontSize: 10, fontWeight: 500, color: 'var(--muted)',
                  margin: '2px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{displayRole}</p>
              </div>
              {!auth.isAdmin && loggedInCompanyIds.length > 0 && (
                <Link href="/change-password" title="เปลี่ยนรหัสผ่าน" style={{ textDecoration: 'none' }}>
                  <div
                    onMouseEnter={() => setHoveredItem('key')}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      padding: 6, borderRadius: 7, cursor: 'pointer',
                      color: 'var(--muted)',
                      background: hoveredItem === 'key' ? 'var(--card-solid)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}>
                    <KeyRound size={14} />
                  </div>
                </Link>
              )}
              <button
                onClick={() => {
                  if (auth.isAdmin) auth.adminLogout();
                  loggedInCompanyIds.forEach(id => auth.companyLogout(id));
                  window.location.href = '/';
                }}
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
                title="ออกจากระบบ"
                style={{
                  padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer',
                  color: hoveredItem === 'logout' ? '#ff3b30' : 'var(--muted)',
                  background: hoveredItem === 'logout' ? 'rgba(255,59,48,0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 12,
              background: 'var(--bg-secondary)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'var(--muted)',
                background: 'var(--card-solid)',
              }}>?</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: 0 }}>ยังไม่ได้เข้าสู่ระบบ</p>
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', margin: '1px 0 0' }}>กรุณา Login</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── MOBILE RENDER ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Fixed top bar */}
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
            height: 56,
            background: 'var(--card-solid)',
            borderBottom: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              padding: 8, marginLeft: -8, borderRadius: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Menu size={22} />
          </button>
          <img src="/ea-logo.svg" alt="EA" style={{ height: 28, objectFit: 'contain' }} />
          <span style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            Safety & Env
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={cycleTheme}
              style={{
                padding: 8, borderRadius: 8, background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--muted)',
              }}
            >
              {theme === 'light' && <Sun size={16} />}
              {theme === 'dark' && <Moon size={16} />}
              {theme === 'system' && <Monitor size={16} />}
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div id="sidebar-mobile-spacer" style={{ height: 56, flexShrink: 0, width: '100%' }} />

        {/* Overlay */}
        {mobileOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 50,
            height: '100%', width: 290,
            background: 'var(--card-solid)',
            boxShadow: mobileOpen ? '4px 0 30px rgba(0,0,0,0.15)' : 'none',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // ── DESKTOP RENDER ─────────────────────────────────────────────
  return (
    <aside
      style={{
        width: collapsed ? 68 : 260,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--card-solid)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      {sidebarContent}
    </aside>
  );
}
