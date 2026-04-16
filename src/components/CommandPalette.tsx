'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import {
  Search,
  AlertTriangle,
  FileText,
  Users,
  GraduationCap,
  FolderKanban,
  ArrowRight,
  Command,
  X,
  ClipboardList,
  FileWarning,
  Settings,
  BarChart3,
  Loader2,
} from 'lucide-react';

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

interface SearchResult {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  companyId: string;
  href: string;
}

// Quick actions (always available)
const QUICK_ACTIONS = [
  { id: 'qa-projects', label: 'เลือกโครงการ', icon: ClipboardList, href: '/projects' },
  { id: 'qa-admin', label: 'Admin Dashboard', icon: BarChart3, href: '/projects/admin' },
  { id: 'qa-audit', label: 'Audit Trail', icon: FileText, href: '/projects/admin/audit' },
  { id: 'qa-nearmiss', label: 'Near Miss (Admin)', icon: AlertTriangle, href: '/projects/nearmiss' },
  { id: 'qa-incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, href: '/projects/incidents' },
  { id: 'qa-training', label: 'แผนอบรม', icon: GraduationCap, href: '/projects/training' },
  { id: 'qa-risk', label: 'ประเมินความเสี่ยง', icon: FileWarning, href: '/projects/risk' },
  { id: 'qa-employees', label: 'จัดการพนักงาน', icon: Users, href: '/projects/employees' },
  { id: 'qa-settings', label: 'ตั้งค่า Admin', icon: Settings, href: '/projects/settings' },
];

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  'Near Miss': AlertTriangle,
  'อุบัติเหตุ': AlertTriangle,
  'พนักงาน': Users,
  'อบรม': GraduationCap,
  'โครงการพิเศษ': FolderKanban,
};

export default function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Items to display
  const filteredQuickActions = query.length === 0
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      );

  const allItems = [
    ...results.map((r) => ({ id: r.id, label: r.title, subtitle: r.subtitle, icon: CATEGORY_ICONS[r.category] || FileText, href: r.href, category: r.category })),
    ...(query.length < 2 ? filteredQuickActions.map((a) => ({ ...a, subtitle: '', category: 'Quick Actions' })) : []),
  ];

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex].href);
    }
  };

  if (!open) return null;

  // Theme colors
  const bg = isDark ? '#1c1c1e' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const text = isDark ? '#f5f5f7' : '#1d1d1f';
  const muted = isDark ? '#a1a1a6' : '#6e6e73';
  const inputBg = isDark ? '#2c2c2e' : '#f5f5f7';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const activeBg = isDark ? 'rgba(10,132,255,0.15)' : 'rgba(0,122,255,0.08)';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Palette */}
      <div
        style={{
          position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 101,
          width: 'min(580px, calc(100vw - 32px))',
          background: bg,
          borderRadius: 16,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 40px 100px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 40px 100px -20px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          fontFamily: APPLE_FONT,
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
          <Search size={18} style={{ color: muted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา Near Miss, อุบัติเหตุ, พนักงาน, หลักสูตร..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, fontWeight: 400, color: text,
              background: 'transparent',
              fontFamily: APPLE_FONT,
            }}
          />
          {loading && <Loader2 size={16} className="animate-spin" style={{ color: muted }} />}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 6px', borderRadius: 5,
            background: inputBg, fontSize: 11, color: muted, fontWeight: 500,
          }}>
            ESC
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
          {query.length >= 2 && results.length === 0 && !loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: muted, fontSize: 13 }}>
              ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Category headers + items */}
          {(() => {
            let lastCategory = '';
            return allItems.map((item, idx) => {
              const showHeader = item.category !== lastCategory;
              lastCategory = item.category;
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div key={item.id}>
                  {showHeader && (
                    <div style={{
                      padding: '8px 16px 4px', fontSize: 11, fontWeight: 600,
                      color: muted, letterSpacing: '0.03em', textTransform: 'uppercase',
                    }}>
                      {item.category}
                    </div>
                  )}
                  <button
                    onClick={() => handleSelect(item.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px', border: 'none', cursor: 'pointer',
                      background: isSelected ? activeBg : 'transparent',
                      color: text, textAlign: 'left',
                      fontFamily: APPLE_FONT, transition: 'background 80ms',
                    }}
                  >
                    <Icon size={16} style={{ color: muted, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.label}
                      </div>
                      {item.subtitle && (
                        <div style={{
                          fontSize: 11, color: muted, marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && <ArrowRight size={14} style={{ color: muted, opacity: 0.5 }} />}
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 11, color: muted,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: inputBg, fontSize: 10 }}>↑↓</kbd> เลือก
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: inputBg, fontSize: 10 }}>↵</kbd> เปิด
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <kbd style={{ padding: '1px 4px', borderRadius: 3, background: inputBg, fontSize: 10 }}>esc</kbd> ปิด
          </span>
        </div>
      </div>
    </>
  );
}
