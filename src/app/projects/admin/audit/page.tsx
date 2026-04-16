'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  Clock,
  User,
  FileText,
  AlertTriangle,
  GraduationCap,
  FolderKanban,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

const P = {
  light: {
    bg: '#fbfbfd', text: '#1d1d1f', muted: '#6e6e73', mutedLight: '#86868b',
    navBg: 'rgba(251,251,253,0.85)', navBorder: 'rgba(0,0,0,0.06)', divider: 'rgba(0,0,0,0.08)',
    cardBg: '#fff', cardBorder: 'rgba(0,0,0,0.06)', cardShadow: '0 1px 3px rgba(0,0,0,0.06)',
    chipBg: '#f5f5f7', chipBgActive: '#0a84ff', chipText: '#6e6e73', chipTextActive: '#fff',
    rowHover: 'rgba(0,0,0,0.02)', badge: 'rgba(0,0,0,0.05)',
  },
  dark: {
    bg: '#000', text: '#f5f5f7', muted: '#a1a1a6', mutedLight: '#86868b',
    navBg: 'rgba(20,20,22,0.85)', navBorder: 'rgba(255,255,255,0.08)', divider: 'rgba(255,255,255,0.06)',
    cardBg: '#1c1c1e', cardBorder: 'rgba(255,255,255,0.08)', cardShadow: '0 1px 3px rgba(0,0,0,0.3)',
    chipBg: 'rgba(255,255,255,0.08)', chipBgActive: '#0a84ff', chipText: '#a1a1a6', chipTextActive: '#fff',
    rowHover: 'rgba(255,255,255,0.03)', badge: 'rgba(255,255,255,0.08)',
  },
};

// Action → human-readable label + color
const ACTION_MAP: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  status_change: { label: 'เปลี่ยนสถานะ', color: '#0a84ff', icon: Shield },
  note_update: { label: 'อัปเดตหมายเหตุ', color: '#8b5cf6', icon: FileText },
  edit_request: { label: 'ขอแก้ไข', color: '#f59e0b', icon: Settings },
  edit_approved: { label: 'อนุมัติแก้ไข', color: '#34c759', icon: Shield },
  edit_rejected: { label: 'ปฏิเสธแก้ไข', color: '#ff3b30', icon: Shield },
  cancel_request: { label: 'ขอยกเลิก', color: '#ff9500', icon: AlertTriangle },
  cancel_approved: { label: 'อนุมัติยกเลิก', color: '#34c759', icon: Shield },
  cancel_rejected: { label: 'ปฏิเสธยกเลิก', color: '#ff3b30', icon: Shield },
  responsible_change: { label: 'เปลี่ยนผู้รับผิดชอบ', color: '#0a84ff', icon: User },
  upload_attachment: { label: 'อัปโหลดไฟล์', color: '#30d158', icon: FileText },
  delete_attachment: { label: 'ลบไฟล์', color: '#ff453a', icon: FileText },
  create_incident: { label: 'บันทึกอุบัติเหตุ', color: '#ef4444', icon: AlertTriangle },
  update_incident: { label: 'แก้ไขอุบัติเหตุ', color: '#f97316', icon: AlertTriangle },
  create_nearmiss: { label: 'รายงาน Near Miss', color: '#f59e0b', icon: AlertTriangle },
  update_nearmiss: { label: 'อัปเดต Near Miss', color: '#eab308', icon: AlertTriangle },
  create_training: { label: 'สร้างแผนอบรม', color: '#3b82f6', icon: GraduationCap },
  add_attendee: { label: 'เพิ่มผู้เข้าอบรม', color: '#06b6d4', icon: GraduationCap },
  create_project: { label: 'สร้างโครงการ', color: '#8b5cf6', icon: FolderKanban },
};

const MODULE_OPTIONS = [
  { value: '', label: 'ทุกโมดูล' },
  { value: 'safety', label: 'Safety Plan' },
  { value: 'environment', label: 'Environment Plan' },
  { value: 'incidents', label: 'อุบัติเหตุ' },
  { value: 'nearmiss', label: 'Near Miss' },
  { value: 'training', label: 'อบรม' },
  { value: 'special-projects', label: 'โครงการพิเศษ' },
  { value: 'admin', label: 'Admin' },
];

interface AuditEntry {
  id: string;
  created_at: string;
  company_id: string;
  plan_type: string;
  action: string;
  activity_no: string;
  month: string;
  old_value: string;
  new_value: string;
  note: string;
  performed_by: string;
}

const PAGE_SIZE = 30;

export default function AuditTrailPage() {
  const router = useRouter();
  const auth = useAuth();
  const { companies } = useCompanies();
  const { resolvedTheme } = useTheme();
  const p = resolvedTheme === 'dark' ? P.dark : P.light;
  const isDark = resolvedTheme === 'dark';

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterModule, setFilterModule] = useState('');
  const [filterPerformer, setFilterPerformer] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchEntries = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(pageNum * PAGE_SIZE));
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      if (filterModule) params.set('module', filterModule);
      if (filterPerformer) params.set('performer', filterPerformer);

      const res = await fetch(`/api/audit?${params}`);
      const json = await res.json();
      setEntries(json.entries || []);
      setTotal(json.total || 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterCompany, filterModule, filterPerformer]);

  useEffect(() => {
    if (!auth.isAdmin) { router.replace('/projects'); return; }
    setPage(0);
    fetchEntries(0);
  }, [auth.isAdmin, router, fetchEntries]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchEntries(newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Group entries by date
  const groupByDate = (items: AuditEntry[]) => {
    const groups: Record<string, AuditEntry[]> = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    items.forEach((entry) => {
      const d = new Date(entry.created_at).toDateString();
      let label = new Date(entry.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      if (d === today) label = 'วันนี้';
      else if (d === yesterday) label = 'เมื่อวาน';
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });
    return groups;
  };

  const getCompanyName = (cid: string) => companies.find((c) => c.id === cid)?.name || cid;

  const getActionInfo = (action: string) =>
    ACTION_MAP[action] || { label: action, color: p.muted, icon: FileText };

  if (!auth.isAdmin) return null;

  const grouped = groupByDate(entries);

  return (
    <div style={{ minHeight: '100vh', background: p.bg, fontFamily: APPLE_FONT, color: p.text }}>
      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: p.navBg, backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${p.navBorder}`,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/projects/admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#0a84ff', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8 }}>
              <ArrowLeft size={16} /> Admin Dashboard
            </button>
            <div style={{ height: 20, width: 1, background: p.divider }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Audit Trail</span>
            {total > 0 && <span style={{ fontSize: 12, color: p.muted, background: p.badge, padding: '2px 8px', borderRadius: 10 }}>{total.toLocaleString()}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle size="sm" />
            <button
              onClick={() => fetchEntries(page)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: p.muted, display: 'flex' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 22px 80px' }}>
        {/* Filter bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Company filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                style={{
                  appearance: 'none', padding: '7px 30px 7px 12px', borderRadius: 8,
                  border: `1px solid ${p.cardBorder}`, background: p.cardBg, color: p.text,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <option value="all">ทุกบริษัท</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: p.muted, pointerEvents: 'none' }} />
            </div>

            {/* Module filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                style={{
                  appearance: 'none', padding: '7px 30px 7px 12px', borderRadius: 8,
                  border: `1px solid ${p.cardBorder}`, background: p.cardBg, color: p.text,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: p.muted, pointerEvents: 'none' }} />
            </div>

            {/* Performer search */}
            <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: p.muted }} />
              <input
                placeholder="ค้นหาผู้กระทำ..."
                value={filterPerformer}
                onChange={(e) => setFilterPerformer(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 30px', borderRadius: 8,
                  border: `1px solid ${p.cardBorder}`, background: p.cardBg, color: p.text,
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        {loading && entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: p.muted, margin: '0 auto 12px' }} />
            <p style={{ color: p.muted, fontSize: 14 }}>กำลังโหลด...</p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Clock size={24} style={{ color: p.muted, margin: '0 auto 12px' }} />
            <p style={{ color: p.muted, fontSize: 14 }}>ยังไม่มีรายการ</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} style={{ marginBottom: 28 }}>
              {/* Date header */}
              <div style={{
                fontSize: 12, fontWeight: 700, color: p.muted, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4,
              }}>
                {dateLabel}
              </div>

              {/* Entries */}
              <div style={{
                background: p.cardBg, border: `1px solid ${p.cardBorder}`,
                borderRadius: 12, boxShadow: p.cardShadow, overflow: 'hidden',
              }}>
                {items.map((entry, idx) => {
                  const info = getActionInfo(entry.action);
                  const Icon = info.icon;
                  const time = new Date(entry.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={entry.id || idx}
                      style={{
                        padding: '12px 16px',
                        borderBottom: idx < items.length - 1 ? `1px solid ${p.divider}` : 'none',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = p.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${info.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 2,
                      }}>
                        <Icon size={15} style={{ color: info.color }} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{info.label}</span>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 4,
                            background: p.chipBg, color: p.chipText, fontWeight: 500,
                          }}>
                            {getCompanyName(entry.company_id)}
                          </span>
                          {entry.plan_type && entry.plan_type !== entry.action && (
                            <span style={{
                              fontSize: 11, padding: '1px 6px', borderRadius: 4,
                              background: p.chipBg, color: p.chipText,
                            }}>
                              {entry.plan_type}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ fontSize: 12, color: p.muted, marginTop: 3, lineHeight: 1.5 }}>
                          {entry.activity_no && <span>กิจกรรม {entry.activity_no} </span>}
                          {entry.month && <span>เดือน {entry.month} </span>}
                          {entry.old_value && entry.new_value && (
                            <span>
                              <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{entry.old_value}</span>
                              {' → '}
                              <span style={{ fontWeight: 600 }}>{entry.new_value}</span>
                            </span>
                          )}
                          {!entry.old_value && entry.new_value && <span>{entry.new_value}</span>}
                          {entry.note && <span style={{ fontStyle: 'italic' }}> · {entry.note}</span>}
                        </div>
                      </div>

                      {/* Time + performer */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: p.muted, fontWeight: 500 }}>{time}</div>
                        {entry.performed_by && (
                          <div style={{ fontSize: 11, color: p.mutedLight, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 2 }}>
                            <User size={10} /> {entry.performed_by}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${p.cardBorder}`,
                background: p.cardBg, color: page === 0 ? p.muted : p.text,
                cursor: page === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, opacity: page === 0 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} /> ก่อนหน้า
            </button>
            <span style={{ fontSize: 13, color: p.muted }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${p.cardBorder}`,
                background: p.cardBg, color: page >= totalPages - 1 ? p.muted : p.text,
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, opacity: page >= totalPages - 1 ? 0.5 : 1,
              }}
            >
              ถัดไป <ChevronRight size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
