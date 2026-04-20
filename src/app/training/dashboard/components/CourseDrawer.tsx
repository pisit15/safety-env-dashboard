'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, ArrowUpRight, Calendar, Users, Clock, Wallet, MapPin,
  CheckCircle2, Circle, AlertCircle, FileText, FileCheck, Award,
  ChevronRight, ExternalLink, GraduationCap, Building2,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────
export interface SessionRaw {
  id: string;
  status: string | null;
  scheduled_date_start: string | null;
  scheduled_date_end: string | null;
  actual_cost: number | null;
  actual_participants: number | null;
  actual_hours: number | null;
  instructor_name: string | null;
  training_location: string | null;
  training_method: string | null;
  note: string | null;
  postponed_to_month: number | null;
  original_planned_month: number | null;
  dsd_submitted: boolean | null;
  dsd_submitted_date: string | null;
  dsd_approved: boolean | null;
  dsd_approved_date: string | null;
  dsd_report_submitted: boolean | null;
  dsd_report_submitted_date: string | null;
  dsd_not_submitting: boolean | null;
  dsd_approved_headcount: number | null;
  photos_submitted: boolean | null;
  signin_sheet_submitted: boolean | null;
}

export type CourseDetail = {
  planId: string;
  sessionId: string | null;
  companyId: string;
  companyName: string;
  companyShort: string;
  courseName: string;
  category: string;
  plannedMonth: number;
  effectiveMonth: number;
  hours: number;
  participants: number;
  budget: number;
  inHouseExternal: string;
  dsdEligible: boolean;
  status: 'completed' | 'scheduled' | 'overdue' | 'pending' | 'upcoming' | 'cancelled';
  session: SessionRaw | null;
  year: number;
};

interface Attendee {
  id: string;
  emp_code: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  hours_attended: number | null;
  registration_type: string | null;
}

// ── Design tokens (mirror page.tsx) ─────────────────────────────
const T = {
  bg: '#fafbfc',
  surface: '#ffffff',
  surfaceAlt: '#f6f7f9',
  line: '#e5e7eb',
  lineSoft: '#eef0f3',
  ink: '#0a2540',
  textPrimary: '#1a1f36',
  textSecondary: '#425466',
  textMuted: '#697386',
  textLight: '#8792a2',
  accent: '#635bff',
  accentHover: '#524bd6',
  accentSoft: '#efefff',
  done: '#2B8C3E',
  doneSoft: '#E8F3EA',
  scheduled: '#4E79A7',
  scheduledSoft: '#E6EEF7',
  pending: '#BAB0AC',
  pendingSoft: '#F2F0EF',
  overdue: '#C23B22',
  overdueSoft: '#F7E1DD',
  upcoming: '#F28E2B',
  upcomingSoft: '#FCEFDF',
};

const MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function statusMeta(k: CourseDetail['status']): { label: string; fg: string; bg: string } {
  switch (k) {
    case 'completed': return { label: 'อบรมแล้ว', fg: T.done, bg: T.doneSoft };
    case 'scheduled': return { label: 'กำหนดวันแล้ว', fg: T.scheduled, bg: T.scheduledSoft };
    case 'overdue': return { label: 'เลยกำหนด', fg: T.overdue, bg: T.overdueSoft };
    case 'pending': return { label: 'รอดำเนินการ', fg: T.pending, bg: T.pendingSoft };
    case 'upcoming': return { label: 'ยังไม่ถึง', fg: T.upcoming, bg: T.upcomingSoft };
    case 'cancelled': return { label: 'ยกเลิก', fg: T.textLight, bg: T.surfaceAlt };
  }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function fmtDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—';
  const s = new Date(start);
  if (!end || end === start) return s.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()}–${e.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })} – ${e.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (!n || n === 0) return '—';
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿';
}

// ── Component ───────────────────────────────────────────────────
export default function CourseDrawer({ detail, onClose }: { detail: CourseDetail; onClose: () => void }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [tab, setTab] = useState<'overview' | 'dsd' | 'attendees'>('overview');

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Fetch attendees when switching to Attendees tab (lazy)
  useEffect(() => {
    if (tab !== 'attendees') return;
    if (!detail.sessionId && !detail.planId) return;
    let cancelled = false;
    (async () => {
      setLoadingAttendees(true);
      try {
        const params = new URLSearchParams();
        if (detail.sessionId) params.set('sessionId', detail.sessionId);
        else params.set('planId', detail.planId);
        const res = await fetch(`/api/training/attendees?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAttendees(Array.isArray(data) ? data : []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingAttendees(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, detail.sessionId, detail.planId]);

  const s = detail.session;
  const meta = statusMeta(detail.status);
  const scheduledDate = s?.scheduled_date_start;
  const isCompleted = detail.status === 'completed';
  const participantsShown = isCompleted && s?.actual_participants ? s.actual_participants : detail.participants;

  // DSD milestone states
  const dsdEligible = detail.dsdEligible && !s?.dsd_not_submitting;
  const milestones = [
    {
      key: 'submitted',
      title: 'ยื่น ยป.1 (แจ้งจัดอบรม)',
      desc: 'แจ้งให้กรมพัฒนาฝีมือแรงงานทราบก่อนการอบรม',
      done: !!s?.dsd_submitted,
      date: s?.dsd_submitted_date,
      icon: FileText,
    },
    {
      key: 'approved',
      title: 'ได้รับอนุมัติ ยป.3 / ยป.2',
      desc: 'หลักสูตรได้รับการอนุมัติจากกรมฯ',
      done: !!s?.dsd_approved,
      date: s?.dsd_approved_date,
      icon: FileCheck,
    },
    {
      key: 'training',
      title: 'ดำเนินการอบรม',
      desc: s?.training_location ? `ณ ${s.training_location}` : 'จัดอบรมตามแผน',
      done: isCompleted,
      date: isCompleted ? scheduledDate : null,
      icon: GraduationCap,
    },
    {
      key: 'reported',
      title: 'ยื่น รง.1 / สท.2 (รายงานผล)',
      desc: 'รายงานผลการอบรมให้กรมฯ ภายใน 30 วัน',
      done: !!s?.dsd_report_submitted,
      date: s?.dsd_report_submitted_date,
      icon: Award,
    },
  ];
  const dsdProgress = milestones.filter(m => m.done).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(10, 37, 64, 0.32)',
          backdropFilter: 'blur(2px)',
          animation: 'cd-fade-in 0.2s ease-out',
        }}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="รายละเอียดหลักสูตร"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 96vw)',
          zIndex: 71,
          background: T.surface,
          boxShadow: '-24px 0 48px rgba(16, 24, 40, 0.12)',
          display: 'flex', flexDirection: 'column',
          animation: 'cd-slide-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'Inter, "Noto Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif',
          color: T.textPrimary,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 16px', borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: T.textSecondary }}>
              <Building2 size={11} />
              {detail.companyShort}
              <span style={{ color: T.textLight, fontWeight: 500 }}>· {detail.companyName}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="ปิด"
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: T.textMuted, cursor: 'pointer', flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceAlt; e.currentTarget.style.color = T.textPrimary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted; }}
            >
              <X size={16} />
            </button>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', color: T.ink, margin: '4px 0 8px', lineHeight: 1.3 }}>
            {detail.courseName}
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', background: meta.bg, color: meta.fg,
              borderRadius: 6, fontSize: 11.5, fontWeight: 600,
              border: `1px solid ${meta.fg}30`,
            }}>
              {meta.label}
            </span>
            {detail.category && (
              <span style={{ fontSize: 11.5, color: T.textMuted, padding: '4px 10px', background: T.surfaceAlt, borderRadius: 6, fontWeight: 500 }}>
                {detail.category}
              </span>
            )}
            {detail.inHouseExternal && (
              <span style={{ fontSize: 11.5, color: T.textMuted, padding: '4px 10px', background: T.surfaceAlt, borderRadius: 6, fontWeight: 500 }}>
                {detail.inHouseExternal}
              </span>
            )}
            {dsdEligible && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: T.accentSoft, color: T.accent,
                borderRadius: 6, fontSize: 11.5, fontWeight: 600,
              }}>
                <Award size={11} /> DSD
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, background: T.surface, padding: '0 14px' }}>
          {([
            { k: 'overview', l: 'ภาพรวม' },
            { k: 'dsd', l: `DSD ${dsdEligible ? `(${dsdProgress}/4)` : ''}` },
            { k: 'attendees', l: 'ผู้เข้าอบรม' },
          ] as const).map(t => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                style={{
                  padding: '12px 14px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.ink : T.textMuted,
                  cursor: 'pointer',
                  borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {t.l}
              </button>
            );
          })}
        </div>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', background: T.bg }}>
          {tab === 'overview' && (
            <OverviewTab
              detail={detail}
              session={s}
              participantsShown={participantsShown}
              scheduledDate={scheduledDate}
            />
          )}
          {tab === 'dsd' && (
            <DsdTab
              eligible={detail.dsdEligible}
              notSubmitting={!!s?.dsd_not_submitting}
              milestones={milestones}
              approvedHeadcount={s?.dsd_approved_headcount}
              photosSubmitted={!!s?.photos_submitted}
              signInSubmitted={!!s?.signin_sheet_submitted}
            />
          )}
          {tab === 'attendees' && (
            <AttendeesTab attendees={attendees} loading={loadingAttendees} />
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '12px 22px', background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 11.5, color: T.textMuted }}>
            เดือน {MONTH_LONG[detail.effectiveMonth - 1]} · ปี {detail.year}
          </div>
          <Link
            href={`/projects/training/${detail.companyId}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: T.accent, color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(99, 91, 255, 0.2)',
            }}
          >
            เปิดหน้าแผนอบรม {detail.companyShort}
            <ExternalLink size={13} />
          </Link>
        </div>
      </aside>

      <style jsx global>{`
        @keyframes cd-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cd-slide-in {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Overview Tab ────────────────────────────────────────────────
function OverviewTab({
  detail, session, participantsShown, scheduledDate,
}: {
  detail: CourseDetail;
  session: SessionRaw | null;
  participantsShown: number;
  scheduledDate: string | null | undefined;
}) {
  const s = session;
  const dateRange = s ? fmtDateRange(s.scheduled_date_start, s.scheduled_date_end) : '—';
  const plannedMonth = MONTH_LONG[detail.plannedMonth - 1];
  const effMonth = MONTH_LONG[detail.effectiveMonth - 1];
  const isPostponed = detail.plannedMonth !== detail.effectiveMonth;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatCard icon={Calendar} label="เดือนที่วางแผน" value={plannedMonth} note={isPostponed ? `เลื่อนเป็น ${effMonth}` : undefined} noteColor={T.upcoming} />
        <StatCard icon={Clock} label="ชั่วโมงอบรม" value={`${detail.hours || 0} ชม.`} />
        <StatCard icon={Users} label={detail.status === 'completed' ? 'ผู้เข้าอบรมจริง' : 'ผู้เข้าอบรม (แผน)'} value={`${participantsShown} คน`} note={detail.status === 'completed' && detail.participants ? `แผน ${detail.participants} คน` : undefined} />
        <StatCard icon={Wallet} label={detail.status === 'completed' && s?.actual_cost ? 'ค่าใช้จ่ายจริง' : 'งบประมาณ'} value={fmtMoney(detail.status === 'completed' ? s?.actual_cost : detail.budget)} />
      </div>

      {/* Session info */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          ข้อมูลการอบรม
        </div>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: 0, fontSize: 13 }}>
          <DlRow label="วันที่อบรม" value={dateRange} icon={Calendar} />
          <DlRow label="วิทยากร" value={s?.instructor_name || '—'} />
          <DlRow label="สถานที่" value={s?.training_location || '—'} icon={MapPin} />
          <DlRow label="รูปแบบ" value={s?.training_method || '—'} />
        </dl>
        {s?.note && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: T.surfaceAlt, borderRadius: 6, fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5 }}>
            <strong style={{ color: T.textPrimary, fontWeight: 600 }}>หมายเหตุ: </strong>
            {s.note}
          </div>
        )}
      </div>

      {/* Quick summary */}
      {s && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            เอกสารการอบรม
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <DocChip done={!!s.photos_submitted} label="รูปถ่าย" />
            <DocChip done={!!s.signin_sheet_submitted} label="ใบลงชื่อ" />
            <DocChip done={!!s.dsd_submitted} label="ยป.1" />
            <DocChip done={!!s.dsd_approved} label="ยป.3" />
            <DocChip done={!!s.dsd_report_submitted} label="รง.1" />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, noteColor }: { icon: React.ElementType; label: string; value: string; note?: string; noteColor?: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 }}>
        <Icon size={12} />
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: noteColor || T.textLight, marginTop: 3, fontWeight: 500 }}>{note}</div>}
    </div>
  );
}

function DlRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'baseline', gap: 10 }}>
      <dt style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {Icon && <Icon size={11} />}
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}

function DocChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: done ? T.doneSoft : T.surfaceAlt,
      color: done ? T.done : T.textMuted,
      border: `1px solid ${done ? T.done + '30' : T.line}`,
      fontSize: 11.5, fontWeight: 600,
    }}>
      {done ? <CheckCircle2 size={11} /> : <Circle size={11} />}
      {label}
    </span>
  );
}

// ── DSD Tab ─────────────────────────────────────────────────────
function DsdTab({
  eligible, notSubmitting, milestones, approvedHeadcount, photosSubmitted, signInSubmitted,
}: {
  eligible: boolean;
  notSubmitting: boolean;
  milestones: {
    key: string;
    title: string;
    desc: string;
    done: boolean;
    date: string | null | undefined;
    icon: React.ElementType;
  }[];
  approvedHeadcount: number | null | undefined;
  photosSubmitted: boolean;
  signInSubmitted: boolean;
}) {
  if (!eligible) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 22, background: T.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Award size={20} color={T.textLight} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>ไม่ต้องยื่น DSD</p>
        <p style={{ fontSize: 12.5, color: T.textMuted, margin: '4px 0 0' }}>หลักสูตรนี้ไม่เข้าข่ายยื่นกรมพัฒนาฝีมือแรงงาน</p>
      </div>
    );
  }
  if (notSubmitting) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.upcoming}30`, borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 22, background: T.upcomingSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <AlertCircle size={20} color={T.upcoming} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>เลือกไม่ยื่น DSD</p>
        <p style={{ fontSize: 12.5, color: T.textMuted, margin: '4px 0 0' }}>ผู้ดูแลระบุว่าจะไม่ยื่นกรมฯ สำหรับหลักสูตรนี้</p>
      </div>
    );
  }

  const doneCount = milestones.filter(m => m.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Progress bar */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>ความคืบหน้าเอกสาร DSD</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{doneCount}/4</div>
        </div>
        <div style={{ height: 6, background: T.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(doneCount / 4) * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.done})`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
          ขั้นตอน DSD
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {milestones.map((m, i) => {
            const Icon = m.icon;
            const last = i === milestones.length - 1;
            return (
              <li key={m.key} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, paddingBottom: last ? 0 : 14 }}>
                {/* Icon + connector line */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: m.done ? T.done : T.surfaceAlt,
                    color: m.done ? '#fff' : T.textLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: m.done ? 'none' : `1.5px dashed ${T.line}`,
                    flexShrink: 0, zIndex: 1,
                  }}>
                    {m.done ? <CheckCircle2 size={14} /> : <Icon size={13} />}
                  </div>
                  {!last && (
                    <div style={{
                      width: 2, flex: 1,
                      background: m.done ? T.done : T.line,
                      marginTop: 2,
                      minHeight: 20,
                    }} />
                  )}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: m.done ? T.ink : T.textPrimary, letterSpacing: '-0.005em' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.45 }}>
                    {m.desc}
                  </div>
                  {m.date && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11.5, color: T.done, fontWeight: 600 }}>
                      <Calendar size={11} />
                      {fmtDate(m.date)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Supporting docs */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
          เอกสารประกอบ
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <DocRow done={photosSubmitted} label="รูปถ่ายการอบรม" />
          <DocRow done={signInSubmitted} label="ใบลงชื่อผู้เข้าอบรม" />
          {typeof approvedHeadcount === 'number' && approvedHeadcount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '6px 0', borderTop: `1px solid ${T.lineSoft}`, marginTop: 4, paddingTop: 10 }}>
              <span style={{ color: T.textMuted, fontWeight: 500 }}>จำนวนที่ได้รับอนุมัติ</span>
              <span style={{ color: T.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{approvedHeadcount} คน</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
      {done ? (
        <CheckCircle2 size={14} color={T.done} />
      ) : (
        <Circle size={14} color={T.textLight} />
      )}
      <span style={{ color: done ? T.textPrimary : T.textMuted, fontWeight: done ? 600 : 500 }}>{label}</span>
      {done && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.done, fontWeight: 600 }}>ส่งแล้ว</span>}
    </div>
  );
}

// ── Attendees Tab ───────────────────────────────────────────────
function AttendeesTab({ attendees, loading }: { attendees: Attendee[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        กำลังโหลดรายชื่อ...
      </div>
    );
  }
  if (attendees.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 22, background: T.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Users size={20} color={T.textLight} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>ยังไม่มีผู้เข้าอบรม</p>
        <p style={{ fontSize: 12.5, color: T.textMuted, margin: '4px 0 0' }}>เพิ่มรายชื่อได้จากหน้าแผนอบรมของบริษัท</p>
      </div>
    );
  }

  const totalHours = attendees.reduce((s, a) => s + (a.hours_attended || 0), 0);
  const deptCount = new Set(attendees.map(a => a.department).filter(Boolean)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MiniStat label="จำนวน" value={String(attendees.length)} unit="คน" />
        <MiniStat label="แผนก" value={String(deptCount)} unit="แผนก" />
        <MiniStat label="ชั่วโมงรวม" value={String(Math.round(totalHours))} unit="ชม." />
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: T.surfaceAlt, borderBottom: `1px solid ${T.line}`, fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          รายชื่อ ({attendees.length})
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 'none' }}>
          {attendees.map((a, idx) => (
            <li
              key={a.id}
              style={{
                padding: '10px 14px',
                borderBottom: idx < attendees.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 12.5,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 15,
                background: T.accentSoft, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                flexShrink: 0,
              }}>
                {(a.first_name?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.emp_code && <span>{a.emp_code} · </span>}
                  {a.position || '—'}
                  {a.department && <span> · {a.department}</span>}
                </div>
              </div>
              {typeof a.hours_attended === 'number' && a.hours_attended > 0 && (
                <div style={{ fontSize: 11, color: T.textSecondary, fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>
                  {a.hours_attended} ชม.
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}
