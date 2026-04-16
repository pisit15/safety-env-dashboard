'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import {
  Bell,
  AlertTriangle,
  FileText,
  Settings,
  X,
} from 'lucide-react';

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

interface NotifItem {
  id: string;
  type: 'nearmiss' | 'edit_request' | 'cancel_request' | 'incident';
  title: string;
  detail: string;
  companyId: string;
  timestamp: string;
  href: string;
  priority: 'high' | 'normal';
}

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  nearmiss: { icon: AlertTriangle, color: '#f59e0b' },
  incident: { icon: AlertTriangle, color: '#ef4444' },
  edit_request: { icon: Settings, color: '#0a84ff' },
  cancel_request: { icon: FileText, color: '#ff9500' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.`;
  const days = Math.floor(hrs / 24);
  return `${days} วัน`;
}

const POLL_INTERVAL = 120_000; // 2 minutes

export default function NotificationBell() {
  const router = useRouter();
  const auth = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [items, setItems] = useState<NotifItem[]>([]);
  const [count, setCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!auth.isAdmin) return;
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const res = await fetch(`/api/notifications?since=${since}`);
      const data = await res.json();
      setItems(data.items || []);
      setCount(data.count || 0);
      setHighCount(data.highPriority || 0);
    } catch { /* ignore */ }
  }, [auth.isAdmin]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Don't render if not admin
  if (!auth.isAdmin) return null;

  const unseen = lastSeen
    ? items.filter((i) => new Date(i.timestamp) > new Date(lastSeen)).length
    : count;

  const handleOpen = () => {
    setOpen(!open);
    if (!open) {
      // Mark current time as last seen
      setLastSeen(new Date().toISOString());
    }
  };

  const bg = isDark ? '#1c1c1e' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const text = isDark ? '#f5f5f7' : '#1d1d1f';
  const muted = isDark ? '#a1a1a6' : '#6e6e73';
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <div ref={dropdownRef} data-tour="notification-bell" style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 8,
          border: 'none', cursor: 'pointer',
          background: open ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
          color: muted, transition: 'background 100ms',
        }}
      >
        <Bell size={17} />
        {unseen > 0 && (
          <div style={{
            position: 'absolute', top: 3, right: 3,
            minWidth: 16, height: 16, borderRadius: 8,
            background: highCount > 0 ? '#ff3b30' : '#0a84ff',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            border: `2px solid ${isDark ? '#1c1c1e' : '#fff'}`,
          }}>
            {unseen > 9 ? '9+' : unseen}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0,
          width: 360, maxHeight: 440,
          background: bg, border: `1px solid ${border}`,
          borderRadius: 14,
          boxShadow: isDark
            ? '0 20px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 20px 60px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden', fontFamily: APPLE_FONT, zIndex: 50,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${divider}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: text }}>การแจ้งเตือน</span>
            <span style={{ fontSize: 12, color: muted }}>{count} รายการ</span>
          </div>

          {/* Items */}
          <div style={{ maxHeight: 370, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: muted, fontSize: 13 }}>
                ไม่มีการแจ้งเตือนใหม่
              </div>
            ) : (
              items.slice(0, 15).map((item, idx) => {
                const { icon: Icon, color } = TYPE_ICONS[item.type] || { icon: Bell, color: muted };
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                    style={{
                      width: '100%', display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: 'transparent', textAlign: 'left',
                      borderBottom: idx < Math.min(items.length, 15) - 1 ? `1px solid ${divider}` : 'none',
                      fontFamily: APPLE_FONT, transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: `${color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{item.title}</span>
                        {item.priority === 'high' && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                            background: 'rgba(255,59,48,0.12)', color: '#ff3b30', fontWeight: 700,
                          }}>
                            HIGH
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, color: muted, marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.detail}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: muted, flexShrink: 0, marginTop: 2 }}>
                      {timeAgo(item.timestamp)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
