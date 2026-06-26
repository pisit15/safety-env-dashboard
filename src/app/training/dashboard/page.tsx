'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useCompanies } from '@/hooks/useCompanies';
import { DEFAULT_YEAR } from '@/lib/companies';
import { useYears } from '@/lib/useYears';
import {
  Search, Filter, Download, Calendar, ChevronDown, ChevronRight,
  CheckCircle2, CalendarCheck, Clock, AlertCircle, X, ArrowUpRight,
  FileText, FileCheck, Building2, ArrowUp, ArrowDown,
  GraduationCap, ChevronLeft,
} from 'lucide-react';
import CourseDrawer, { type CourseDetail } from './components/CourseDrawer';

// ───────────────────────── Design tokens (Light Premium / Stripe-like) ─────────────────────────
const T = {
  // Surfaces
  bg: '#fafbfc',          // page bg (slight warm off-white)
  surface: '#ffffff',     // cards
  surfaceAlt: '#f6f7f9',  // subtle grouping
  line: '#e5e7eb',        // borders
  lineSoft: '#eef0f3',    // subtle dividers
  // Text
  ink: '#0a2540',         // deep navy — Stripe-style primary ink
  textPrimary: '#1a1f36',
  textSecondary: '#425466',
  textMuted: '#697386',
  textLight: '#8792a2',
  // Accent
  accent: '#635bff',       // Stripe purple for interactive
  accentHover: '#524bd6',
  accentSoft: '#efefff',
  brand: '#0a2540',
  // Status (VIZ palette)
  done: '#2B8C3E',         // completed (deep green)
  doneSoft: '#E8F3EA',
  scheduled: '#4E79A7',    // date set (blue)
  scheduledSoft: '#E6EEF7',
  pending: '#BAB0AC',      // no progress (gray)
  pendingSoft: '#F2F0EF',
  overdue: '#C23B22',      // overdue (red)
  overdueSoft: '#F7E1DD',
  upcoming: '#F28E2B',     // future (orange)
  upcomingSoft: '#FCEFDF',
  cancelled: '#9ca3af',
  cancelledSoft: '#f3f4f6',
  // DSD specific
  dsdYes: '#2B8C3E',
  dsdYesSoft: '#E8F3EA',
  dsdNo: '#E15759',
  dsdNoSoft: '#fbeae9',
  dsdNA: '#BAB0AC',
  dsdNASoft: '#F2F0EF',
  // Shadows
  shadowSm: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 1px rgba(16, 24, 40, 0.02)',
  shadowMd: '0 2px 4px rgba(16, 24, 40, 0.05), 0 4px 12px rgba(16, 24, 40, 0.04)',
  shadowLg: '0 12px 32px rgba(16, 24, 40, 0.08), 0 4px 12px rgba(16, 24, 40, 0.04)',
  shadowDrawer: '-24px 0 48px rgba(16, 24, 40, 0.12)',
};

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// ───────────────────────── Types ─────────────────────────
interface SessionRaw {
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
  training_attendees?: { count: number }[];
}

interface PlanRaw {
  id: string;
  company_id: string;
  course_name: string;
  course_no?: number | string | null;
  category: string | null;
  planned_month: number;
  hours_per_course: number | null;
  planned_participants: number | null;
  budget: number | null;
  in_house_external: string | null;
  dsd_eligible: boolean | null;
  is_active?: boolean;
  training_sessions: SessionRaw[];
}

interface PlanEnriched extends PlanRaw {
  companyName: string;
  companyShort: string;
  group: string;
  bu: string;
  session: SessionRaw | null;
  effectiveMonth: number;
  statusKey: 'completed' | 'scheduled' | 'overdue' | 'pending' | 'upcoming' | 'cancelled';
  dsdKey: 'not_eligible' | 'not_submitting' | 'not_started' | 'submitted' | 'approved' | 'reported';
}

type FilterStatus = 'all' | 'completed' | 'scheduled' | 'pending' | 'overdue';
type FilterDSD = 'all' | 'need_submit' | 'need_approve' | 'need_report' | 'done';

// ───────────────────────── Status helpers ─────────────────────────
function getStatusKey(p: PlanRaw, effectiveMonth: number, currentMonth: number): PlanEnriched['statusKey'] {
  const s = p.training_sessions?.[0];
  const rawStatus = s?.status || 'planned';
  if (rawStatus === 'completed') return 'completed';
  if (rawStatus === 'cancelled') return 'cancelled';
  if (s?.scheduled_date_start || rawStatus === 'scheduled') {
    return effectiveMonth < currentMonth ? 'overdue' : 'scheduled';
  }
  return effectiveMonth < currentMonth ? 'overdue' : effectiveMonth === currentMonth ? 'pending' : 'upcoming';
}

function getDSDKey(p: PlanRaw): PlanEnriched['dsdKey'] {
  if (p.dsd_eligible === false) return 'not_eligible';
  const s = p.training_sessions?.[0];
  if (!s) return 'not_started';
  if (s.dsd_not_submitting) return 'not_submitting';
  if (s.dsd_report_submitted) return 'reported';
  if (s.dsd_approved) return 'approved';
  if (s.dsd_submitted) return 'submitted';
  return 'not_started';
}

function statusLabel(k: PlanEnriched['statusKey']): string {
  switch (k) {
    case 'completed': return 'อบรมแล้ว';
    case 'scheduled': return 'กำหนดวันแล้ว';
    case 'overdue': return 'เลยกำหนด';
    case 'pending': return 'รอดำเนินการ';
    case 'upcoming': return 'ยังไม่ถึง';
    case 'cancelled': return 'ยกเลิก';
  }
}
function statusColor(k: PlanEnriched['statusKey']): { fg: string; bg: string } {
  switch (k) {
    case 'completed': return { fg: T.done, bg: T.doneSoft };
    case 'scheduled': return { fg: T.scheduled, bg: T.scheduledSoft };
    case 'overdue': return { fg: T.overdue, bg: T.overdueSoft };
    case 'pending': return { fg: T.pending, bg: T.pendingSoft };
    case 'upcoming': return { fg: T.upcoming, bg: T.upcomingSoft };
    case 'cancelled': return { fg: T.cancelled, bg: T.cancelledSoft };
  }
}

// ───────────────────────── Page ─────────────────────────
export default function TrainingMasterDashboard() {
  const { companies: COMPANIES } = useCompanies();

  const [selectedYear, setSelectedYear] = useState<number>(DEFAULT_YEAR);
  const { active: activeYears } = useYears();
  const [rawPlans, setRawPlans] = useState<PlanEnriched[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [buFilter, setBuFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [dsdFilter, setDsdFilter] = useState<FilterDSD>('all');

  // Drawer
  const [detail, setDetail] = useState<CourseDetail | null>(null);

  // Table sort
  const [sortKey, setSortKey] = useState<'company' | 'month' | 'course' | 'status'>('month');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const currentMonthIdx = new Date().getMonth(); // 0-11
  const currentMonth = currentMonthIdx + 1;

  // Public page — no auth gate (HR can view without logging in)

  // Data fetch — all companies in parallel
  useEffect(() => {
    if (COMPANIES.length === 0) return;
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      const promises = COMPANIES.map(async (company) => {
        try {
          const res = await fetch(`/api/training/plans?companyId=${company.id}&year=${selectedYear}`);
          if (!res.ok) return [];
          const plans = await res.json();
          if (!Array.isArray(plans)) return [];
          return plans.map((p: PlanRaw) => {
            const s = p.training_sessions?.[0] || null;
            const effMonth =
              s?.status === 'postponed' && s.postponed_to_month ? s.postponed_to_month :
              s?.postponed_to_month && s?.original_planned_month ? s.postponed_to_month :
              p.planned_month;
            const enriched: PlanEnriched = {
              ...p,
              companyName: company.name,
              companyShort: company.shortName,
              group: company.group || '',
              bu: company.bu || '',
              session: s,
              effectiveMonth: effMonth,
              statusKey: getStatusKey(p, effMonth, currentMonth),
              dsdKey: getDSDKey(p),
            };
            return enriched;
          });
        } catch {
          return [];
        }
      });
      const results = (await Promise.all(promises)).flat();
      if (!cancelled) {
        setRawPlans(results);
        setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [COMPANIES, selectedYear, currentMonth]);

  // Filtered list
  const plans = useMemo(() => {
    return rawPlans.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.course_name.toLowerCase().includes(q) &&
            !p.companyName.toLowerCase().includes(q) &&
            !p.companyShort.toLowerCase().includes(q)) return false;
      }
      if (groupFilter !== 'all' && p.group !== groupFilter) return false;
      if (buFilter !== 'all' && p.bu !== buFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && p.statusKey !== 'completed') return false;
        if (statusFilter === 'scheduled' && p.statusKey !== 'scheduled') return false;
        if (statusFilter === 'pending' && !(p.statusKey === 'pending' || p.statusKey === 'upcoming')) return false;
        if (statusFilter === 'overdue' && p.statusKey !== 'overdue') return false;
      }
      if (dsdFilter !== 'all') {
        if (p.dsd_eligible === false) return false;
        if (dsdFilter === 'need_submit' && p.dsdKey !== 'not_started') return false;
        if (dsdFilter === 'need_approve' && p.dsdKey !== 'submitted') return false;
        if (dsdFilter === 'need_report' && p.dsdKey !== 'approved') return false;
        if (dsdFilter === 'done' && p.dsdKey !== 'reported') return false;
      }
      return true;
    });
  }, [rawPlans, search, groupFilter, buFilter, statusFilter, dsdFilter]);

  // KPI
  const kpi = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter(p => p.statusKey === 'completed').length;
    const scheduled = plans.filter(p => p.statusKey === 'scheduled').length;
    const overdue = plans.filter(p => p.statusKey === 'overdue').length;
    const pending = plans.filter(p => p.statusKey === 'pending' || p.statusKey === 'upcoming').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    // DSD KPI
    const dsdEligible = plans.filter(p => p.dsd_eligible !== false).length;
    const dsdSubmitted = plans.filter(p => p.dsd_eligible !== false && ['submitted', 'approved', 'reported'].includes(p.dsdKey)).length;
    const dsdApproved = plans.filter(p => p.dsd_eligible !== false && ['approved', 'reported'].includes(p.dsdKey)).length;
    const dsdReported = plans.filter(p => p.dsd_eligible !== false && p.dsdKey === 'reported').length;
    return { total, completed, scheduled, overdue, pending, pct, dsdEligible, dsdSubmitted, dsdApproved, dsdReported };
  }, [plans]);

  // Master timeline data: rows = companies, cells = plans per month
  const timelineData = useMemo(() => {
    const byCompany: Record<string, { company: string; short: string; group: string; bu: string; months: PlanEnriched[][] }> = {};
    for (const p of plans) {
      if (!byCompany[p.company_id]) {
        byCompany[p.company_id] = {
          company: p.companyName,
          short: p.companyShort,
          group: p.group,
          bu: p.bu,
          months: Array.from({ length: 12 }, () => []),
        };
      }
      const mIdx = (p.effectiveMonth - 1) % 12;
      if (mIdx >= 0 && mIdx < 12) byCompany[p.company_id].months[mIdx].push(p);
    }
    // Sort by group then name
    return Object.entries(byCompany)
      .map(([companyId, row]) => ({ companyId, ...row }))
      .sort((a, b) => {
        if (a.group !== b.group) return (a.group || '').localeCompare(b.group || '');
        return a.short.localeCompare(b.short);
      });
  }, [plans]);

  // Sorted table rows (with tiebreakers for stable grouping)
  const tableRows = useMemo(() => {
    const rows = [...plans];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'company') cmp = a.companyShort.localeCompare(b.companyShort);
      else if (sortKey === 'month') cmp = (a.effectiveMonth || 0) - (b.effectiveMonth || 0);
      else if (sortKey === 'course') cmp = a.course_name.localeCompare(b.course_name);
      else if (sortKey === 'status') cmp = a.statusKey.localeCompare(b.statusKey);
      if (sortDir === 'desc') cmp = -cmp;
      // Tiebreakers — keep timeline readable within the same month/company
      if (cmp === 0) {
        if (sortKey === 'month') {
          // within same month: by actual/scheduled date (asc), then company, then course
          const da = a.session?.scheduled_date_start || '';
          const db = b.session?.scheduled_date_start || '';
          if (da !== db) return da.localeCompare(db);
          cmp = a.companyShort.localeCompare(b.companyShort);
          if (cmp !== 0) return cmp;
          return a.course_name.localeCompare(b.course_name);
        }
        if (sortKey === 'company') {
          cmp = (a.effectiveMonth || 0) - (b.effectiveMonth || 0);
          if (cmp !== 0) return cmp;
          return a.course_name.localeCompare(b.course_name);
        }
      }
      return cmp;
    });
    return rows;
  }, [plans, sortKey, sortDir]);

  // Month counts for group headers
  const monthCounts = useMemo(() => {
    const m: Record<number, number> = {};
    tableRows.forEach((p) => { m[p.effectiveMonth] = (m[p.effectiveMonth] || 0) + 1; });
    return m;
  }, [tableRows]);

  // Available filter values
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    rawPlans.forEach(p => { if (p.group) set.add(p.group); });
    return Array.from(set);
  }, [rawPlans]);
  const availableBUs = useMemo(() => {
    const set = new Set<string>();
    rawPlans.forEach(p => { if (p.bu) set.add(p.bu); });
    return Array.from(set).sort();
  }, [rawPlans]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const handleOpenDetail = (p: PlanEnriched) => {
    setDetail({
      planId: p.id,
      sessionId: p.session?.id || null,
      companyId: p.company_id,
      companyName: p.companyName,
      companyShort: p.companyShort,
      courseName: p.course_name,
      category: p.category || '',
      plannedMonth: p.planned_month,
      effectiveMonth: p.effectiveMonth,
      hours: p.hours_per_course || 0,
      participants: p.planned_participants || 0,
      budget: p.budget || 0,
      inHouseExternal: p.in_house_external || '',
      dsdEligible: p.dsd_eligible !== false,
      status: p.statusKey,
      session: p.session,
      year: selectedYear,
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams({ year: String(selectedYear) });
    if (groupFilter !== 'all') params.set('group', groupFilter);
    if (buFilter !== 'all') params.set('bu', buFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (dsdFilter !== 'all') params.set('dsd', dsdFilter);
    window.open(`/api/training/master-export?${params.toString()}`, '_blank');
  };

  // Public page — no auth gate

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.textPrimary, fontFamily: 'Inter, "Noto Sans Thai", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      {/* ═══════════ Top Bar ═══════════ */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textMuted, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
              <ChevronLeft size={16} /> โครงการ
            </Link>
            <div style={{ width: 1, height: 20, background: T.line }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.brand}, ${T.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={18} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: T.ink, margin: 0, lineHeight: 1.2 }}>Training Master</h1>
                <p style={{ fontSize: 11.5, color: T.textMuted, margin: 0, lineHeight: 1.3 }}>แผนอบรมรวมทุกบริษัท · DSD Tracker</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: T.surfaceAlt, borderRadius: 8, border: `1px solid ${T.line}` }}>
              <Calendar size={14} color={T.textMuted} />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: T.textPrimary, outline: 'none', cursor: 'pointer' }}
              >
                {activeYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
              </select>
            </div>
            <button
              onClick={handleExport}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.ink, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: T.shadowSm }}
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════ Hero / KPI ═══════════ */}
      <section style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 28px 20px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink, margin: 0, lineHeight: 1.15 }}>
            ภาพรวมแผนอบรม <span style={{ color: T.textLight }}>ปี {selectedYear}</span>
          </h2>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
            ติดตามสถานะการอบรมและการยื่นเอกสารกับกรมพัฒนาฝีมือแรงงาน (DSD) ของทุกบริษัทในเครือ
          </p>
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard
            label="หลักสูตรทั้งหมด"
            value={kpi.total}
            caption={`${timelineData.length} บริษัท`}
            accent={T.ink}
          />
          <KpiCard
            label="อบรมเสร็จแล้ว"
            value={kpi.completed}
            caption={`${kpi.pct}% ของแผน`}
            accent={T.done}
            progress={kpi.pct}
          />
          <KpiCard
            label="กำหนดวันแล้ว"
            value={kpi.scheduled}
            caption="พร้อมอบรม"
            accent={T.scheduled}
          />
          <KpiCard
            label="เลยกำหนด"
            value={kpi.overdue}
            caption={kpi.overdue > 0 ? 'ต้องติดตาม' : 'ไม่มี'}
            accent={kpi.overdue > 0 ? T.overdue : T.textLight}
            emphasize={kpi.overdue > 0}
          />
          <KpiCard
            label="ยื่น รง.1 แล้ว"
            value={kpi.dsdReported}
            caption={`/ ${kpi.dsdEligible} หลักสูตร DSD`}
            accent={T.accent}
          />
        </div>
      </section>

      {/* ═══════════ Filter Bar ═══════════ */}
      <section style={{ maxWidth: 1600, margin: '0 auto', padding: '4px 28px 20px' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
            <Search size={15} color={T.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="ค้นหาหลักสูตร / บริษัท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 36px', border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, color: T.textPrimary, background: T.surfaceAlt, outline: 'none' }}
            />
          </div>

          <FilterSelect label="Group" value={groupFilter} onChange={setGroupFilter} options={[
            { v: 'all', l: 'ทั้งหมด' },
            ...availableGroups.map(g => ({ v: g, l: g })),
          ]} />

          <FilterSelect label="Business Unit" value={buFilter} onChange={setBuFilter} options={[
            { v: 'all', l: 'ทั้งหมด' },
            ...availableBUs.map(b => ({ v: b, l: b })),
          ]} />

          <FilterSelect label="สถานะ" value={statusFilter} onChange={(v) => setStatusFilter(v as FilterStatus)} options={[
            { v: 'all', l: 'ทั้งหมด' },
            { v: 'completed', l: 'อบรมแล้ว' },
            { v: 'scheduled', l: 'กำหนดวันแล้ว' },
            { v: 'pending', l: 'รอดำเนินการ' },
            { v: 'overdue', l: 'เลยกำหนด' },
          ]} />

          <FilterSelect label="DSD" value={dsdFilter} onChange={(v) => setDsdFilter(v as FilterDSD)} options={[
            { v: 'all', l: 'ทั้งหมด' },
            { v: 'need_submit', l: 'รอยื่น ยป.1' },
            { v: 'need_approve', l: 'รออนุมัติ' },
            { v: 'need_report', l: 'รอยื่น รง.1' },
            { v: 'done', l: 'ครบถ้วน' },
          ]} />

          {(search || groupFilter !== 'all' || buFilter !== 'all' || statusFilter !== 'all' || dsdFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setGroupFilter('all'); setBuFilter('all'); setStatusFilter('all'); setDsdFilter('all'); }}
              style={{ padding: '8px 12px', background: 'transparent', border: 'none', color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} /> ล้างตัวกรอง
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: T.textMuted, fontWeight: 500 }}>
            {loading ? 'กำลังโหลด...' : `${plans.length} หลักสูตร`}
          </div>
        </div>
      </section>

      {/* ═══════════ Master Timeline ═══════════ */}
      <section style={{ maxWidth: 1600, margin: '0 auto', padding: '0 28px 20px' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: T.shadowSm, overflow: 'hidden' }}>
          <SectionHeader
            title="ไทม์ไลน์ 12 เดือน"
            subtitle="หลักสูตรทั้งหมดของทุกบริษัท จัดเรียงตามเดือนที่วางแผน · คลิกเพื่อดูรายละเอียด"
            accent={T.ink}
          />

          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>กำลังโหลดข้อมูลทุกบริษัท...</div>
            ) : timelineData.length === 0 ? (
              <EmptyState />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: T.surfaceAlt }}>
                  <tr>
                    <th style={{ ...thSticky, left: 0, zIndex: 3, width: 180, minWidth: 180, background: T.surfaceAlt, borderRight: `1px solid ${T.line}` }}>บริษัท</th>
                    {MONTH_LABELS.map((m, i) => (
                      <th key={m} style={{ ...thSticky,
                        width: 112, minWidth: 112,
                        background: i === currentMonthIdx ? '#eef2ff' : T.surfaceAlt,
                        color: i === currentMonthIdx ? T.accent : T.textSecondary,
                        fontWeight: i === currentMonthIdx ? 700 : 600,
                      }}>
                        {m}
                        {i === currentMonthIdx && <span style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>ปัจจุบัน</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timelineData.map((row, rowIdx) => {
                    const rowTotal = row.months.reduce((s, m) => s + m.length, 0);
                    if (rowTotal === 0) return null;
                    return (
                      <tr key={row.companyId} style={{ background: rowIdx % 2 === 0 ? T.surface : T.surfaceAlt + '40' }}>
                        <td style={{ ...tdSticky, left: 0, zIndex: 1, background: rowIdx % 2 === 0 ? T.surface : '#f9fafb', borderRight: `1px solid ${T.line}` }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px' }}>
                            <Link
                              href={`/projects/training/${row.companyId}`}
                              style={{ fontWeight: 700, fontSize: 13.5, color: T.ink, textDecoration: 'none', letterSpacing: '-0.005em', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              {row.short}
                              <ArrowUpRight size={12} style={{ color: T.textLight, opacity: 0.7 }} />
                            </Link>
                            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, lineHeight: 1.3 }}>
                              {row.company !== row.short ? row.company : ''}
                              {row.bu && <span style={{ display: 'block', fontSize: 10, color: T.textLight, marginTop: 1 }}>{row.bu}</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                              {rowTotal} หลักสูตร
                            </div>
                          </div>
                        </td>
                        {row.months.map((cellPlans, mIdx) => (
                          <td
                            key={mIdx}
                            style={{ padding: 4, verticalAlign: 'top',
                              background: mIdx === currentMonthIdx ? '#f5f6ff' : 'transparent',
                              borderRight: mIdx < 11 ? `1px solid ${T.lineSoft}` : 'none',
                            }}
                          >
                            <TimelineCell plans={cellPlans} onOpen={handleOpenDetail} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Legend */}
          <div style={{ borderTop: `1px solid ${T.line}`, padding: '12px 20px', background: T.surfaceAlt, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11.5, color: T.textSecondary, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: T.textPrimary, marginRight: 4 }}>คำอธิบาย:</span>
            <LegendSwatch color={T.done} label="อบรมแล้ว" />
            <LegendSwatch color={T.scheduled} label="กำหนดวันแล้ว" />
            <LegendSwatch color={T.pending} label="ยังไม่มีความคืบหน้า" />
            <LegendSwatch color={T.overdue} label="เลยกำหนด" />
            <LegendSwatch color={T.upcoming} label="ยังไม่ถึง" />
          </div>
        </div>
      </section>

      {/* ═══════════ DSD Table ═══════════ */}
      <section style={{ maxWidth: 1600, margin: '0 auto', padding: '0 28px 40px' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: T.shadowSm, overflow: 'hidden' }}>
          <SectionHeader
            title="รายการอบรม & สถานะ DSD"
            subtitle="พร้อมใช้สำหรับยื่นกรมพัฒนาฝีมือแรงงาน · คลิกหัวคอลัมน์เพื่อเรียงลำดับ"
            accent={T.accent}
            action={
              <button
                onClick={handleExport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                <Download size={13} /> ส่งออก Excel
              </button>
            }
          />

          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: T.surfaceAlt }}>
                <tr>
                  <SortableTh label="บริษัท" sortKey="company" cur={sortKey} dir={sortDir} onClick={() => toggleSort('company')} width={110} />
                  <SortableTh label="หลักสูตร" sortKey="course" cur={sortKey} dir={sortDir} onClick={() => toggleSort('course')} width={260} />
                  <SortableTh label="เดือน" sortKey="month" cur={sortKey} dir={sortDir} onClick={() => toggleSort('month')} width={90} />
                  <th style={thStyle}>วันที่อบรม</th>
                  <SortableTh label="สถานะ" sortKey="status" cur={sortKey} dir={sortDir} onClick={() => toggleSort('status')} width={130} />
                  <th style={thStyle}>ยป.1 (แจ้ง)</th>
                  <th style={thStyle}>ยป.3 (อนุมัติ)</th>
                  <th style={thStyle}>รง.1 (รายงาน)</th>
                  <th style={{ ...thStyle, width: 48, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>กำลังโหลด...</td></tr>
                ) : tableRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>ไม่พบข้อมูลตามตัวกรอง</td></tr>
                ) : (
                  tableRows.map((p, idx) => {
                    const prev = idx > 0 ? tableRows[idx - 1] : null;
                    const showMonthHeader = sortKey === 'month' && (!prev || prev.effectiveMonth !== p.effectiveMonth);
                    return (
                      <React.Fragment key={p.id}>
                        {showMonthHeader && (
                          <MonthHeaderRow month={p.effectiveMonth} year={selectedYear} count={monthCounts[p.effectiveMonth] || 0} isCurrent={p.effectiveMonth === currentMonth} />
                        )}
                        <DSDTableRow plan={p} idx={idx} year={selectedYear} onOpen={() => handleOpenDetail(p)} />
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════ Drawer ═══════════ */}
      {detail && <CourseDrawer detail={detail} onClose={() => setDetail(null)} />}

      <footer style={{ borderTop: `1px solid ${T.line}`, padding: '16px 28px', background: T.surface, textAlign: 'center', fontSize: 11.5, color: T.textLight }}>
        EA SHE · Training Master Dashboard · HR View
      </footer>
    </div>
  );
}

// ───────────────────────── Sub components ─────────────────────────

function KpiCard({ label, value, caption, accent, progress, emphasize }: { label: string; value: number | string; caption: string; accent: string; progress?: number; emphasize?: boolean }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${emphasize ? accent + '40' : T.line}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: emphasize ? `0 0 0 3px ${accent}12, ${T.shadowSm}` : T.shadowSm,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{caption}</div>
      {typeof progress === 'number' && (
        <div style={{ marginTop: 10, height: 4, background: T.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, background: accent, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 12px', background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 8 }}>
      <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: T.textPrimary, outline: 'none', cursor: 'pointer' }}
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ title, subtitle, accent, action }: { title: string; subtitle?: string; accent: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, height: 28, background: accent, borderRadius: 2 }} />
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12.5, color: T.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, border: '1px solid rgba(0,0,0,0.06)' }} />
      {label}
    </span>
  );
}

function TimelineCell({ plans, onOpen }: { plans: PlanEnriched[]; onOpen: (p: PlanEnriched) => void }) {
  if (plans.length === 0) return <div style={{ height: 28 }} />;
  const maxShow = 4;
  const shown = plans.slice(0, maxShow);
  const rest = plans.length - maxShow;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 4px' }}>
      {shown.map(p => {
        const c = statusColor(p.statusKey);
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p)}
            title={`${p.course_name} · ${statusLabel(p.statusKey)}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 7px',
              background: c.bg,
              border: `1px solid ${c.fg}30`,
              borderLeft: `3px solid ${c.fg}`,
              borderRadius: 5,
              fontSize: 11,
              color: T.textPrimary,
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
              fontWeight: 500,
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(1px)'; e.currentTarget.style.boxShadow = T.shadowSm; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.course_name}</span>
          </button>
        );
      })}
      {rest > 0 && (
        <button
          onClick={() => onOpen(plans[0])}
          style={{ fontSize: 10.5, color: T.accent, background: 'transparent', border: 'none', padding: '2px 7px', textAlign: 'left', cursor: 'pointer', fontWeight: 600 }}
        >+{rest} เพิ่มเติม</button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 22, background: T.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Filter size={18} color={T.textMuted} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>ไม่พบแผนอบรมตามเงื่อนไข</p>
      <p style={{ fontSize: 12.5, color: T.textMuted, margin: '4px 0 0' }}>ลองปรับตัวกรองหรือเลือกปีอื่น</p>
    </div>
  );
}

function SortableTh({ label, sortKey, cur, dir, onClick, width }: { label: string; sortKey: 'company' | 'month' | 'course' | 'status'; cur: string; dir: 'asc' | 'desc'; onClick: () => void; width?: number }) {
  const active = cur === sortKey;
  return (
    <th
      onClick={onClick}
      style={{
        ...thStyle,
        width,
        cursor: 'pointer',
        color: active ? T.accent : T.textSecondary,
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}

function DSDTableRow({ plan, idx, year, onOpen }: { plan: PlanEnriched; idx: number; year: number; onOpen: () => void }) {
  const c = statusColor(plan.statusKey);
  const s = plan.session;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
  const fmtDay = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) : '';
  const hasMonth = plan.effectiveMonth >= 1 && plan.effectiveMonth <= 12;
  const monthLabel = hasMonth ? MONTH_LABELS[plan.effectiveMonth - 1] : '—';
  // Date display: single day vs range
  let dateDisplay: React.ReactNode = <span style={{ color: T.textLight }}>ยังไม่กำหนด</span>;
  if (s?.scheduled_date_start) {
    const start = s.scheduled_date_start;
    const end = s.scheduled_date_end;
    if (end && end !== start) {
      dateDisplay = (
        <span style={{ color: T.textPrimary, fontWeight: 500 }}>
          {fmtDay(start)} – {fmtDate(end)}
        </span>
      );
    } else {
      dateDisplay = <span style={{ color: T.textPrimary, fontWeight: 500 }}>{fmtDate(start)}</span>;
    }
  }
  return (
    <tr
      onClick={onOpen}
      style={{ background: idx % 2 === 0 ? T.surface : '#fafbfc', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.accentSoft; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? T.surface : '#fafbfc'; }}
    >
      <td style={tdStyle}>
        <div style={{ fontWeight: 700, color: T.ink }}>{plan.companyShort}</div>
        {plan.bu && <div style={{ fontSize: 10.5, color: T.textLight }}>{plan.bu}</div>}
      </td>
      <td style={tdStyle}>
        <div style={{ fontWeight: 500, color: T.textPrimary, lineHeight: 1.35 }}>{plan.course_name}</div>
        {plan.category && <div style={{ fontSize: 10.5, color: T.textLight, marginTop: 2 }}>{plan.category}</div>}
      </td>
      <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 600, color: T.ink }}>{monthLabel}</div>
        <div style={{ fontSize: 10.5, color: T.textLight }}>{year}</div>
      </td>
      <td style={{ ...tdStyle, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {dateDisplay}
      </td>
      <td style={tdStyle}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 4,
          background: c.bg, color: c.fg,
          fontSize: 11, fontWeight: 600,
          border: `1px solid ${c.fg}30`,
        }}>{statusLabel(plan.statusKey)}</span>
      </td>
      <td style={tdStyle}><DSDCell submitted={!!s?.dsd_submitted} date={s?.dsd_submitted_date || null} eligible={plan.dsd_eligible !== false} notSubmitting={!!s?.dsd_not_submitting} /></td>
      <td style={tdStyle}><DSDCell submitted={!!s?.dsd_approved} date={s?.dsd_approved_date || null} eligible={plan.dsd_eligible !== false} notSubmitting={!!s?.dsd_not_submitting} /></td>
      <td style={tdStyle}><DSDCell submitted={!!s?.dsd_report_submitted} date={s?.dsd_report_submitted_date || null} eligible={plan.dsd_eligible !== false} notSubmitting={!!s?.dsd_not_submitting} /></td>
      <td style={{ ...tdStyle, textAlign: 'center', color: T.textLight }}>
        <ChevronRight size={15} />
      </td>
    </tr>
  );
}

function MonthHeaderRow({ month, year, count, isCurrent }: { month: number; year: number; count: number; isCurrent: boolean }) {
  const hasMonth = month >= 1 && month <= 12;
  const monthName = hasMonth ? MONTH_LONG[month - 1] : 'ยังไม่ระบุเดือน';
  return (
    <tr style={{ background: isCurrent ? T.accentSoft : T.surfaceAlt }}>
      <td colSpan={9} style={{
        padding: '10px 16px',
        borderTop: `1px solid ${T.line}`,
        borderBottom: `1px solid ${T.line}`,
        position: 'sticky',
        left: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: isCurrent ? T.accent : T.ink,
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {hasMonth ? String(month).padStart(2, '0') : '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{monthName}</span>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{year}</span>
          </div>
          <span style={{
            marginLeft: 4,
            padding: '2px 8px', borderRadius: 10,
            background: isCurrent ? '#fff' : T.surface,
            border: `1px solid ${T.line}`,
            fontSize: 11, fontWeight: 600, color: T.textSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {count} หลักสูตร
          </span>
          {isCurrent && (
            <span style={{
              padding: '2px 8px', borderRadius: 10,
              background: T.accent, color: '#fff',
              fontSize: 10.5, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              เดือนนี้
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function DSDCell({ submitted, date, eligible, notSubmitting }: { submitted: boolean; date: string | null; eligible: boolean; notSubmitting: boolean }) {
  if (!eligible || notSubmitting) {
    return <span style={{ fontSize: 11, color: T.textLight }}>—</span>;
  }
  if (submitted) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.done, fontWeight: 600 }}>
        <CheckCircle2 size={13} />
        {date ? new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : 'ยื่นแล้ว'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
      <Clock size={13} />
      รอดำเนินการ
    </span>
  );
}

// ───────────────────────── Shared styles ─────────────────────────
const thStyle: React.CSSProperties = {
  padding: '11px 14px',
  textAlign: 'left',
  fontSize: 11.5,
  fontWeight: 600,
  color: T.textSecondary,
  borderBottom: `1px solid ${T.line}`,
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
const thSticky: React.CSSProperties = {
  ...thStyle,
  position: 'sticky',
  top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderBottom: `1px solid ${T.lineSoft}`,
  fontSize: 12.5,
  color: T.textPrimary,
  verticalAlign: 'top',
};
const tdSticky: React.CSSProperties = {
  ...tdStyle,
  position: 'sticky',
  padding: 0,
};
