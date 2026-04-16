'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  FileText,
  Shield,
  User,
  GraduationCap,
  FolderKanban,
  Settings,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface FeedItem {
  id: string;
  type: 'audit' | 'nearmiss' | 'incident';
  timestamp: string;
  companyId: string;
  action: string;
  title: string;
  detail: string;
  performer: string;
  meta?: Record<string, string>;
}

interface Props {
  companyId?: string; // 'all' or specific company
  limit?: number;
  palette: {
    text: string;
    muted: string;
    mutedLight: string;
    cardBg: string;
    cardBorder: string;
    cardShadow: string;
    divider: string;
    chipBg: string;
  };
  companyNames?: Record<string, string>; // id → name map
}

const ACTION_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  status_change: { icon: Shield, color: '#0a84ff' },
  note_update: { icon: FileText, color: '#8b5cf6' },
  edit_request: { icon: Settings, color: '#f59e0b' },
  edit_approved: { icon: Shield, color: '#34c759' },
  cancel_request: { icon: AlertTriangle, color: '#ff9500' },
  responsible_change: { icon: User, color: '#0a84ff' },
  upload_attachment: { icon: FileText, color: '#30d158' },
  delete_attachment: { icon: FileText, color: '#ff453a' },
  create_incident: { icon: AlertTriangle, color: '#ef4444' },
  update_incident: { icon: AlertTriangle, color: '#f97316' },
  create_nearmiss: { icon: AlertTriangle, color: '#f59e0b' },
  update_nearmiss: { icon: AlertTriangle, color: '#eab308' },
  create_training: { icon: GraduationCap, color: '#3b82f6' },
  add_attendee: { icon: GraduationCap, color: '#06b6d4' },
  create_project: { icon: FolderKanban, color: '#8b5cf6' },
  nearmiss_report: { icon: AlertTriangle, color: '#f59e0b' },
  incident_report: { icon: AlertTriangle, color: '#ef4444' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export default function ActivityFeed({ companyId = 'all', limit = 15, palette: p, companyNames = {} }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (companyId !== 'all') params.set('companyId', companyId);
    params.set('limit', String(limit));

    fetch(`/api/activity?${params}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [companyId, limit]);

  const getIcon = (action: string) =>
    ACTION_ICONS[action] || { icon: Clock, color: p.muted };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <RefreshCw size={16} className="animate-spin" style={{ color: p.muted, margin: '0 auto' }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: p.muted }}>ยังไม่มีกิจกรรม</p>
      </div>
    );
  }

  return (
    <div style={{
      background: p.cardBg, border: `1px solid ${p.cardBorder}`,
      borderRadius: 16, boxShadow: p.cardShadow, overflow: 'hidden',
    }}>
      {items.map((item, idx) => {
        const { icon: Icon, color } = getIcon(item.action);
        const cName = companyNames[item.companyId] || item.companyId;

        return (
          <div
            key={item.id}
            style={{
              padding: '10px 16px',
              borderBottom: idx < items.length - 1 ? `1px solid ${p.divider}` : 'none',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            {/* Icon dot */}
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: `${color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              <Icon size={13} style={{ color }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.text }}>{item.title}</span>
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 3,
                  background: p.chipBg, color: p.muted,
                }}>
                  {cName}
                </span>
              </div>
              {item.detail && (
                <div style={{
                  fontSize: 11, color: p.muted, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.detail}
                </div>
              )}
            </div>

            {/* Time */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: p.mutedLight, whiteSpace: 'nowrap' }}>
                {timeAgo(item.timestamp)}
              </div>
              {item.performer && (
                <div style={{ fontSize: 10, color: p.mutedLight, marginTop: 1 }}>
                  {item.performer}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
