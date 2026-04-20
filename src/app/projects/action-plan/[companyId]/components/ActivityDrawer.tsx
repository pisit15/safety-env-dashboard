'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { X, ChevronUp, ChevronDown, Paperclip, ExternalLink, Trash2, TrendingUp, TrendingDown, Check, Circle, CircleAlert, Clock, Ban, CircleSlash, Minus, AlertTriangle, Shield, ClipboardList, Link2, Image, FileText, FileSpreadsheet, Lock } from 'lucide-react';
import { Activity, MonthStatus } from '@/lib/types';
import { STATUS, PALETTE, CATEGORY_COLORS, UI } from '@/lib/she-theme';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_OPTIONS: { value: MonthStatus; label: string; Icon: typeof Check; color: string }[] = [
  { value: 'done', label: 'เสร็จแล้ว', Icon: Check, color: STATUS.ok },
  { value: 'overdue', label: 'เกินกำหนด', Icon: CircleAlert, color: STATUS.critical },
  { value: 'planned', label: 'มีแผน', Icon: Circle, color: PALETTE.muted },
  { value: 'postponed', label: 'เลื่อน', Icon: Clock, color: STATUS.warning },
  { value: 'cancelled', label: 'ยกเลิก', Icon: Ban, color: PALETTE.textSecondary },
  { value: 'not_applicable', label: 'ไม่เข้าเงื่อนไข', Icon: CircleSlash, color: PALETTE.muted },
  { value: 'not_planned', label: 'ไม่มีแผน', Icon: Minus, color: PALETTE.border },
];

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  drive_file_id: string;
  drive_url?: string;
  file_url?: string;
  uploaded_by: string;
  created_at: string;
}

export interface DrawerProps {
  // Data
  isOpen: boolean;
  editingCell: { actNo: string; month: string; actName: string } | null;
  activity: (Activity & { _planTag?: string }) | null;
  planType: 'safety' | 'environment' | 'total';
  companyId: string;
  selectedYear: number;

  // Status state
  currentStatus: MonthStatus;
  overrideKey: string; // e.g. "S:1.1:jan"
  hasOverride: boolean;
  statusNote: string;
  noteOverride: string;
  savingStatus: boolean;
  savingNote: boolean;

  // Deadline lock
  deadlineLocked: boolean;
  hasApproval: boolean;
  checkingLock: boolean;
  isAdmin: boolean;

  // Budget
  modalBudget: number;
  modalActualCost: number;
  editingActualCost: string;
  // Monthly cost breakdown (optional per-month amounts as strings from inputs)
  editingMonthlyCosts: Record<string, string>;
  onSetEditingMonthlyCost: (monthKey: string, value: string) => void;
  savingBudget: boolean;

  // Responsible
  modalResponsible: string;

  // Attachments
  attachments: Attachment[];
  loadingAttachments: boolean;
  uploadingFile: boolean;
  deletingAttId: string | null;
  attachmentCount: number;

  // Login
  isLoggedIn: boolean;
  loginDisplayName: string;
  loginCompanyName: string;

  // Navigation
  activityList: (Activity & { _planTag?: string })[];
  currentIndex: number;

  // Callbacks
  onClose: () => void;
  onSaveStatus: (status: MonthStatus) => void;
  onRevertStatus: () => void;
  onSaveNote: (note: string) => void;
  onSaveBudget: (actNo: string, cost: number, monthlyCosts?: Record<string, number>) => void;
  onSetEditingActualCost: (v: string) => void;
  onSetStatusNote: (v: string) => void;
  onUploadFile: (file: File) => void;
  onDeleteAttachment: (id: string) => void;
  onAddExternalLink: (url: string, title: string) => void;
  onNavigate: (actNo: string, month: string, actName: string) => void;
  onClickResponsible: (actNo: string, actName: string, current: string) => void;
  onRequestEdit: (reason: string) => void;
  onRequestCancellation: (requestedStatus: 'cancelled' | 'not_applicable' | 'not_planned' | 'planned', reason: string) => Promise<boolean>;
  pendingCancellationStatus: string | null; // show pending badge if request exists
}

type DrawerTab = 'status' | 'evidence' | 'budget' | 'notes';

export default function ActivityDrawer(props: DrawerProps) {
  const {
    isOpen, editingCell, activity, planType, companyId,
    currentStatus, hasOverride, statusNote, savingStatus, savingNote,
    deadlineLocked, hasApproval, checkingLock, isAdmin,
    modalBudget, modalActualCost, editingActualCost, editingMonthlyCosts, onSetEditingMonthlyCost, savingBudget,
    modalResponsible,
    attachments, loadingAttachments, uploadingFile, deletingAttId, attachmentCount,
    isLoggedIn, loginDisplayName, loginCompanyName,
    activityList, currentIndex,
    onClose, onSaveStatus, onRevertStatus, onSaveNote, onSaveBudget,
    onSetEditingActualCost, onSetStatusNote,
    onUploadFile, onDeleteAttachment, onAddExternalLink,
    onNavigate, onClickResponsible, onRequestEdit,
    onRequestCancellation, pendingCancellationStatus,
  } = props;

  const [activeTab, setActiveTab] = useState<DrawerTab>('status');
  const [pendingPostpone, setPendingPostpone] = useState(false);
  const [postponeMonth, setPostponeMonth] = useState('');
  const [pendingDone, setPendingDone] = useState(false);
  const [completionDate, setCompletionDate] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkTitle, setExternalLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [pendingCancel, setPendingCancel] = useState<'cancelled' | 'not_applicable' | 'not_planned' | 'planned' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Reset local state when cell changes
  useEffect(() => {
    setPendingPostpone(false);
    setPostponeMonth('');
    setPendingDone(false);
    setCompletionDate('');
    setExternalLink('');
    setExternalLinkTitle('');
    setShowEditRequest(false);
    setEditRequestReason('');
    setPendingCancel(null);
    setCancelReason('');
    setSubmittingCancel(false);
    setActiveTab('status');
  }, [editingCell?.actNo, editingCell?.month]);

  // Keyboard: Escape close, J/K navigate
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Don't navigate if user is typing in input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'j' || e.key === 'ArrowDown') && currentIndex < activityList.length - 1) {
        e.preventDefault();
        const next = activityList[currentIndex + 1];
        const prefix = (next as any)._planTag ? `${(next as any)._planTag}:` : '';
        onNavigate(`${prefix}${next.no}`, editingCell?.month || 'jan', next.activity);
      }
      if ((e.key === 'k' || e.key === 'ArrowUp') && currentIndex > 0) {
        e.preventDefault();
        const prev = activityList[currentIndex - 1];
        const prefix = (prev as any)._planTag ? `${(prev as any)._planTag}:` : '';
        onNavigate(`${prefix}${prev.no}`, editingCell?.month || 'jan', prev.activity);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, currentIndex, activityList, editingCell, onClose, onNavigate]);

  if (!isOpen || !editingCell || !activity) return null;

  const planTag = (activity as any)?._planTag as string | undefined;
  const isEnvi = planType === 'environment' || planTag === 'E';
  const isSafety = planType === 'safety' || planTag === 'S';
  const canEdit = isLoggedIn && !(deadlineLocked && !hasApproval && !isAdmin);
  // Sum of monthly costs currently in the editor (live preview while typing)
  const editingMonthlyTotal = MONTH_KEYS.reduce((sum, mk) => {
    const raw = editingMonthlyCosts[mk];
    const num = raw ? parseFloat(raw) : 0;
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
  // Effective "ใช้จริง" for display: prefer monthly total, then editingActualCost, then stored modalActualCost
  const effectiveActualCost = editingMonthlyTotal > 0
    ? editingMonthlyTotal
    : (parseFloat(editingActualCost) || modalActualCost);
  const budgetPctUsed = modalBudget > 0 ? Math.round((effectiveActualCost / modalBudget) * 100) : 0;
  const isOverBudget = budgetPctUsed > 100;
  const budgetVariance = modalBudget - effectiveActualCost;

  const accentColor = isSafety ? CATEGORY_COLORS.safety : isEnvi ? CATEGORY_COLORS.environment : PALETTE.primary;
  const accentBg = `${accentColor}12`;

  const handleSaveStatusWrapped = (status: MonthStatus) => {
    if (status === 'postponed' && !pendingPostpone) {
      setPendingPostpone(true);
      const cellMonthIdx = MONTH_KEYS.indexOf(editingCell.month);
      setPostponeMonth(cellMonthIdx < 11 ? MONTH_KEYS[cellMonthIdx + 1] : MONTH_KEYS[cellMonthIdx]);
      return;
    }
    if (status === 'done' && !pendingDone) {
      setPendingDone(true);
      setCompletionDate(new Date().toISOString().split('T')[0]);
      return;
    }
    // Phase 4: Intercept cancelled/not_applicable for non-admin users → require approval
    if ((status === 'cancelled' || status === 'not_applicable') && !isAdmin) {
      setPendingCancel(status);
      setCancelReason('');
      return;
    }
    // Intercept planned↔not_planned changes for non-admin users → require approval
    // The base plan is approved by management, so changes to plan scope need admin review
    if ((status === 'not_planned' || status === 'planned') && !isAdmin) {
      const isChangingPlanScope =
        (status === 'not_planned' && currentStatus !== 'not_planned') ||
        (status === 'planned' && currentStatus === 'not_planned');
      if (isChangingPlanScope) {
        setPendingCancel(status);
        setCancelReason('');
        return;
      }
    }
    onSaveStatus(status);
  };

  const handleSubmitCancellationRequest = async () => {
    if (!pendingCancel || !cancelReason.trim()) return;
    setSubmittingCancel(true);
    const success = await onRequestCancellation(pendingCancel, cancelReason.trim());
    setSubmittingCancel(false);
    if (success) {
      setPendingCancel(null);
      setCancelReason('');
    }
  };

  const handleAddLink = async () => {
    if (!externalLink.trim()) return;
    setAddingLink(true);
    await onAddExternalLink(externalLink.trim(), externalLinkTitle.trim() || externalLink.trim());
    setExternalLink('');
    setExternalLinkTitle('');
    setAddingLink(false);
  };

  const tabs: { key: DrawerTab; label: string; badge?: number }[] = [
    { key: 'status', label: 'สถานะ' },
    { key: 'evidence', label: 'หลักฐาน', badge: attachmentCount },
    { key: 'budget', label: 'งบประมาณ' },
    { key: 'notes', label: 'หมายเหตุ' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
        onTouchEnd={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 90vw)',
          background: UI.bgWhite,
          boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.25s ease-out',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 py-4" style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
        }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-3 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {planTag && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                    {planTag === 'S' ? 'SAFETY' : 'ENVIRONMENT'}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  กิจกรรม {editingCell.actNo.replace(/^[SE]:/, '')} · {MONTH_LABELS[MONTH_KEYS.indexOf(editingCell.month)]}
                </span>
              </div>
              <h2 className="text-[15px] font-bold text-white leading-snug truncate">{editingCell.actName}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <button
                  onClick={() => onClickResponsible(editingCell.actNo, editingCell.actName, modalResponsible)}
                  className="hover:underline"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {modalResponsible}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* J/K nav */}
              <button
                onClick={() => {
                  if (currentIndex > 0) {
                    const prev = activityList[currentIndex - 1];
                    const prefix = (prev as any)._planTag ? `${(prev as any)._planTag}:` : '';
                    onNavigate(`${prefix}${prev.no}`, editingCell.month, prev.activity);
                  }
                }}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded-full transition-opacity"
                style={{ background: 'rgba(255,255,255,0.2)', opacity: currentIndex <= 0 ? 0.3 : 1 }}
                title="กิจกรรมก่อนหน้า (K)"
              >
                <ChevronUp size={14} color="#fff" />
              </button>
              <button
                onClick={() => {
                  if (currentIndex < activityList.length - 1) {
                    const next = activityList[currentIndex + 1];
                    const prefix = (next as any)._planTag ? `${(next as any)._planTag}:` : '';
                    onNavigate(`${prefix}${next.no}`, editingCell.month, next.activity);
                  }
                }}
                disabled={currentIndex >= activityList.length - 1}
                className="p-1.5 rounded-full transition-opacity"
                style={{ background: 'rgba(255,255,255,0.2)', opacity: currentIndex >= activityList.length - 1 ? 0.3 : 1 }}
                title="กิจกรรมถัดไป (J)"
              >
                <ChevronDown size={14} color="#fff" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-full transition-opacity hover:opacity-80 ml-1" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <X size={14} color="#fff" />
              </button>
            </div>
          </div>

          {/* Navigation hint */}
          <div className="mt-2 text-[10px] flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>{currentIndex + 1} / {activityList.length}</span>
            <span>·</span>
            <span>↑↓ นำทาง · Esc ปิด</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 flex border-b" style={{ borderColor: UI.borderDefault }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 text-xs font-medium transition-colors relative"
              style={{
                color: activeTab === t.key ? accentColor : UI.textLabel,
                borderBottom: activeTab === t.key ? `2px solid ${accentColor}` : '2px solid transparent',
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ background: accentColor }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Lock Notice ── */}
        {!checkingLock && deadlineLocked && !hasApproval && !isAdmin && (
          <div className="flex-shrink-0 px-5 py-2.5" style={{ background: `${STATUS.critical}08`, borderBottom: `1px solid ${STATUS.critical}30` }}>
            <p className="text-xs font-medium inline-flex items-center gap-1" style={{ color: STATUS.critical }}><Lock size={11} /> เลยกำหนดเวลาแก้ไข — ต้องขออนุมัติ</p>
          </div>
        )}
        {!checkingLock && deadlineLocked && isAdmin && (
          <div className="flex-shrink-0 px-5 py-2" style={{ background: `${STATUS.warning}0A`, borderBottom: `1px solid ${STATUS.warning}30` }}>
            <p className="text-xs font-medium" style={{ color: STATUS.warning }}><AlertTriangle size={11} className="inline mr-0.5" /> เลยกำหนด — แก้ไขได้ (Admin)</p>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* TAB: Status */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* ═══ Status Selector — Professional Redesign ═══ */}
              {canEdit && (
                <>
                  {/* Current status indicator */}
                  {!pendingCancel && !pendingDone && !pendingPostpone && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1" style={{ background: UI.bgPage }}>
                      <span className="text-[11px]" style={{ color: UI.textPlaceholder }}>สถานะปัจจุบัน:</span>
                      {(() => {
                        const cur = STATUS_OPTIONS.find(o => o.value === currentStatus);
                        if (!cur) return null;
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: `${cur.color}18`, color: cur.color }}>
                            <cur.Icon size={12} /> {cur.label}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Transition indicator — shows when changing status */}
                  {(pendingCancel || pendingDone || pendingPostpone) && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}>
                      {/* From */}
                      {(() => {
                        const cur = STATUS_OPTIONS.find(o => o.value === currentStatus);
                        if (!cur) return null;
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: `${cur.color}12`, color: cur.color, textDecoration: 'line-through', opacity: 0.6 }}>
                            <cur.Icon size={10} /> {cur.label}
                          </span>
                        );
                      })()}
                      <span className="text-[11px]" style={{ color: UI.textPlaceholder }}>→</span>
                      {/* To */}
                      {(() => {
                        const targetValue = pendingCancel || (pendingDone ? 'done' : pendingPostpone ? 'postponed' : null);
                        const target = STATUS_OPTIONS.find(o => o.value === targetValue);
                        if (!target) return null;
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold animate-pulse"
                            style={{ background: `${target.color}20`, color: target.color, border: `1.5px solid ${target.color}50` }}>
                            <target.Icon size={12} /> {target.label}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Status buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = currentStatus === opt.value;
                      const isPendingTarget = pendingCancel === opt.value || (pendingDone && opt.value === 'done') || (pendingPostpone && opt.value === 'postponed');
                      const hasPendingAction = !!pendingCancel || pendingDone || pendingPostpone;

                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSaveStatusWrapped(opt.value)}
                          disabled={savingStatus || (hasPendingAction && !isPendingTarget && opt.value !== currentStatus)}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                          style={{
                            background: isPendingTarget
                              ? `${opt.color}15`
                              : isActive && !hasPendingAction
                                ? `${accentColor}0A`
                                : UI.bgPage,
                            border: isPendingTarget
                              ? `2px dashed ${opt.color}`
                              : isActive && !hasPendingAction
                                ? `2px solid ${accentColor}`
                                : `1px solid ${UI.borderDefault}`,
                            color: isPendingTarget
                              ? opt.color
                              : isActive && !hasPendingAction
                                ? accentColor
                                : UI.textLabel,
                            opacity: savingStatus ? 0.4 : (hasPendingAction && !isPendingTarget && !isActive) ? 0.35 : 1,
                            transform: isPendingTarget ? 'scale(1.03)' : 'scale(1)',
                            boxShadow: isPendingTarget ? `0 0 0 3px ${opt.color}15` : 'none',
                          }}
                        >
                          <opt.Icon size={14} style={{ color: opt.color }} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Completion flow (เสร็จแล้ว) ── */}
                  {pendingDone && (
                    <div className="rounded-xl p-4 mt-1" style={{ background: `${STATUS.ok}08`, border: `1px solid ${STATUS.ok}30` }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: STATUS.ok }}>
                        <Check size={13} className="inline mr-1" />บันทึกการดำเนินงาน
                      </p>
                      <div className="mb-3">
                        <label className="text-[11px] block mb-1 font-medium" style={{ color: UI.textLabel }}>วันที่ดำเนินการเสร็จ</label>
                        <DateInput value={completionDate} onChange={v => setCompletionDate(v)} inputStyle={{ background: UI.bgWhite, border: `1px solid ${UI.borderStrong}`, color: UI.textStrong, borderRadius: 10 }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setPendingDone(false); setCompletionDate(''); }}
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: UI.bgHover, color: UI.textBody }}>ยกเลิก</button>
                        <button onClick={() => onSaveStatus('done')} disabled={!completionDate || savingStatus}
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                          style={{ background: STATUS.ok, color: '#fff', opacity: !completionDate || savingStatus ? 0.5 : 1, boxShadow: `0 2px 8px ${STATUS.ok}40` }}>
                          {savingStatus ? 'กำลังบันทึก...' : <><Check size={12} className="inline mr-1" />ยืนยัน</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Postpone flow (เลื่อน) ── */}
                  {pendingPostpone && (
                    <div className="rounded-xl p-4 mt-1" style={{ background: `${STATUS.warning}08`, border: `1px solid ${STATUS.warning}30` }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: STATUS.warning }}>
                        <Clock size={13} className="inline mr-1" />เลือกเดือนที่จะเลื่อนไป
                      </p>
                      <div className="grid grid-cols-6 gap-1.5 mb-3">
                        {MONTH_KEYS.map((mk, idx) => {
                          const isPast = idx < new Date().getMonth();
                          const isOriginal = mk === editingCell.month;
                          const disabled = isPast || isOriginal;
                          const isSelected = postponeMonth === mk;
                          return (
                            <button key={mk} onClick={() => !disabled && setPostponeMonth(mk)} disabled={disabled}
                              className="px-2 py-1.5 rounded-lg text-xs transition-all"
                              style={{
                                background: isSelected ? STATUS.warning : disabled ? UI.bgMuted : UI.bgHover,
                                color: isSelected ? '#fff' : disabled ? UI.textDisabled : UI.textBody,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                border: isSelected ? `2px solid ${STATUS.warning}` : `1px solid ${UI.borderDefault}`,
                                boxShadow: isSelected ? `0 2px 6px ${STATUS.warning}40` : 'none',
                              }}
                            >{MONTH_LABELS[idx]}</button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setPendingPostpone(false); setPostponeMonth(''); }}
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: UI.bgHover, color: UI.textBody }}>ยกเลิก</button>
                        <button onClick={() => onSaveStatus('postponed')} disabled={!postponeMonth || savingStatus}
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                          style={{ background: STATUS.warning, color: '#fff', opacity: !postponeMonth || savingStatus ? 0.5 : 1, boxShadow: `0 2px 8px ${STATUS.warning}40` }}>
                          {savingStatus ? '...' : `เลื่อนไป ${postponeMonth ? MONTH_LABELS[MONTH_KEYS.indexOf(postponeMonth)] : '...'}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Approval Request Form (ยกเลิก / ไม่เข้าเงื่อนไข / เปลี่ยนแผน) ── */}
                  {pendingCancel && (() => {
                    const labels: Record<string, { title: string; placeholder: string; color: string; icon: typeof Ban }> = {
                      cancelled: { title: 'ขอยกเลิกกิจกรรม', placeholder: 'ระบุเหตุผลที่ต้องการยกเลิก...', color: PALETTE.textSecondary, icon: Ban },
                      not_applicable: { title: 'ขอระบุไม่เข้าเงื่อนไข', placeholder: 'ระบุเหตุผลที่ไม่เข้าเงื่อนไข...', color: PALETTE.muted, icon: CircleSlash },
                      not_planned: { title: 'ขอนำออกจากแผน', placeholder: 'ระบุเหตุผลที่ต้องการนำออกจากแผนที่ได้รับอนุมัติแล้ว...', color: STATUS.warning, icon: Minus },
                      planned: { title: 'ขอเพิ่มเข้าแผน', placeholder: 'ระบุเหตุผลที่ต้องการเพิ่มรายการนี้เข้าแผน...', color: PALETTE.primary, icon: Circle },
                    };
                    const cfg = labels[pendingCancel] || labels.cancelled;
                    const CfgIcon = cfg.icon;
                    return (
                      <div className="rounded-xl p-4 mt-1 flex flex-col gap-3" style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}25` }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${cfg.color}18` }}>
                            <CfgIcon size={14} style={{ color: cfg.color }} />
                          </div>
                          <div>
                            <p className="text-[12px] font-semibold" style={{ color: cfg.color }}>{cfg.title}</p>
                            <p className="text-[10px]" style={{ color: UI.textPlaceholder }}>ต้องได้รับอนุมัติจาก Admin</p>
                          </div>
                        </div>
                        <textarea
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder={cfg.placeholder}
                          className="w-full px-3 py-2.5 rounded-xl text-[12px] resize-none focus:outline-none"
                          rows={2}
                          autoFocus
                          style={{ background: UI.bgWhite, border: `1px solid ${UI.borderDefault}`, color: UI.textStrong }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => { setPendingCancel(null); setCancelReason(''); }}
                            className="flex-1 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: UI.bgHover, color: UI.textBody }}>ยกเลิก</button>
                          <button onClick={handleSubmitCancellationRequest} disabled={!cancelReason.trim() || submittingCancel}
                            className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                            style={{ background: cfg.color, color: '#fff', opacity: !cancelReason.trim() || submittingCancel ? 0.5 : 1, boxShadow: `0 2px 8px ${cfg.color}40` }}>
                            {submittingCancel ? 'กำลังส่ง...' : 'ส่งคำขออนุมัติ'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pending approval badge */}
                  {pendingCancellationStatus && !pendingCancel && (
                    <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: `${STATUS.warning}10`, border: `1px solid ${STATUS.warning}25` }}>
                      <span className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: STATUS.warning }} />
                      <span className="text-[11px] font-medium" style={{ color: STATUS.warning }}>
                        คำขอ{pendingCancellationStatus === 'cancelled' ? 'ยกเลิก' : pendingCancellationStatus === 'not_applicable' ? 'ไม่เข้าเงื่อนไข' : pendingCancellationStatus === 'not_planned' ? 'นำออกจากแผน' : pendingCancellationStatus === 'planned' ? 'เพิ่มเข้าแผน' : pendingCancellationStatus}รอการอนุมัติจาก Admin
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Month overview strip */}
              <div>
                <p className="text-[11px] font-medium mb-2" style={{ color: UI.textLabel }}>สถานะรายเดือน</p>
                <div className="grid grid-cols-12 gap-1">
                  {MONTH_KEYS.map((mk, idx) => {
                    const st = activity.monthStatuses?.[mk] || 'not_planned';
                    const isCurrent = mk === editingCell.month;
                    const dotColor = st === 'done' ? STATUS.ok : st === 'overdue' ? STATUS.critical : st === 'planned' ? PALETTE.muted : st === 'postponed' ? STATUS.warning : PALETTE.border;
                    return (
                      <button
                        key={mk}
                        onClick={() => onNavigate(editingCell.actNo, mk, editingCell.actName)}
                        className="text-center py-1 rounded text-[9px] transition-all"
                        style={{
                          background: isCurrent ? accentBg : 'transparent',
                          border: isCurrent ? `1.5px solid ${accentColor}` : '1px solid transparent',
                        }}
                      >
                        <div style={{ color: isCurrent ? accentColor : UI.textPlaceholder }}>{MONTH_LABELS[idx].replace('.', '')}</div>
                        <div className="mx-auto mt-0.5 w-2 h-2 rounded-full" style={{ background: dotColor }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helper tips */}
              {isSafety && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: `${CATEGORY_COLORS.safety}0F`, border: `1px solid ${CATEGORY_COLORS.safety}33` }}>
                  <Shield size={14} className="mt-0.5 flex-shrink-0" style={{ color: CATEGORY_COLORS.safety }} />
                  <div className="text-[11px]" style={{ color: UI.textLabel }}>
                    <p className="font-semibold mb-0.5" style={{ color: CATEGORY_COLORS.safety }}>ปิดกิจกรรม Safety</p>
                    <p>1. อัปเดตสถานะ "เสร็จแล้ว" → 2. แนบหลักฐาน → 3. ระบุรายละเอียด</p>
                  </div>
                </div>
              )}
              {isEnvi && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: `${CATEGORY_COLORS.environment}0A`, border: `1px solid ${CATEGORY_COLORS.environment}30` }}>
                  <ClipboardList size={14} className="mt-0.5 flex-shrink-0" style={{ color: CATEGORY_COLORS.environment }} />
                  <div className="text-[11px]" style={{ color: UI.textLabel }}>
                    <p className="font-semibold mb-0.5" style={{ color: CATEGORY_COLORS.environment }}>Compliance — แนบหลักฐานจำเป็น</p>
                    <p>อัปเดตสถานะ → แนบหลักฐาน (ใบอนุญาต/รายงาน) → บันทึกรายละเอียด</p>
                  </div>
                </div>
              )}

              {/* Edit request */}
              {deadlineLocked && !hasApproval && !isAdmin && (
                <div>
                  {!showEditRequest ? (
                    <button onClick={() => setShowEditRequest(true)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm font-medium"
                      style={{ background: PALETTE.primary, color: '#fff' }}>
                      ขอแก้ไขข้อมูลย้อนหลัง
                    </button>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: UI.bgMuted, border: `1px solid ${UI.borderDefault}` }}>
                      <p className="text-sm font-medium mb-2" style={{ color: UI.textStrong }}>ขอแก้ไขข้อมูลย้อนหลัง</p>
                      <textarea value={editRequestReason} onChange={e => setEditRequestReason(e.target.value)}
                        placeholder="เหตุผลที่ต้องการแก้ไข..."
                        className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none resize-none"
                        style={{ background: UI.bgWhite, border: `1px solid ${UI.borderStrong}`, color: UI.textStrong }}
                        rows={3} autoFocus />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowEditRequest(false); setEditRequestReason(''); }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: UI.bgHover, color: UI.textBody }}>ยกเลิก</button>
                        <button onClick={() => { onRequestEdit(editRequestReason); setShowEditRequest(false); setEditRequestReason(''); }}
                          disabled={!editRequestReason.trim()}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: PALETTE.primary, color: '#fff', opacity: !editRequestReason.trim() ? 0.5 : 1 }}>
                          ส่งคำขอ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Evidence */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {loadingAttachments ? (
                <div className="text-xs py-8 text-center" style={{ color: UI.textLabel }}>กำลังโหลด...</div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-8 rounded-lg" style={isEnvi
                  ? { background: `${STATUS.critical}0A`, border: `2px dashed ${STATUS.critical}4D` }
                  : { background: UI.bgPage, border: `2px dashed ${UI.borderStrong}` }
                }>
                  <Paperclip size={28} className="mx-auto mb-2" style={{ color: isEnvi ? STATUS.critical : UI.textDisabled }} />
                  <p className="text-xs font-medium" style={{ color: isEnvi ? STATUS.critical : '#9ca3af' }}>
                    {isEnvi ? <><AlertTriangle size={11} className="inline mr-0.5" /> ยังไม่มีหลักฐาน — ต้องอัปโหลดเพื่อ compliance</> : 'ยังไม่มีไฟล์แนบ'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: UI.bgPage, border: `1px solid ${UI.borderDefault}` }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0" style={{ color: PALETTE.textSecondary }}>
                          {att.file_type === 'link' ? <Link2 size={14} /> : att.file_type?.includes('image') ? <Image size={14} /> : att.file_type?.includes('pdf') ? <FileText size={14} /> : att.file_type?.includes('excel') ? <FileSpreadsheet size={14} /> : <Paperclip size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs truncate" style={{ color: UI.textStrong }}>{att.file_name}</p>
                          <p className="text-[10px]" style={{ color: UI.textPlaceholder }}>
                            {att.uploaded_by} · {new Date(att.created_at).toLocaleDateString('th-TH')}
                            {att.file_size > 0 && ` · ${(att.file_size / 1024 / 1024).toFixed(1)} MB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <a href={att.file_url || att.drive_url || '#'} target="_blank" rel="noopener noreferrer"
                          className="text-xs transition-opacity hover:opacity-80" style={{ color: PALETTE.primary }}>เปิด</a>
                        {canEdit && (
                          <button onClick={() => onDeleteAttachment(att.id)} disabled={deletingAttId === att.id}
                            className="p-1 rounded transition-opacity hover:opacity-70"
                            style={{ color: STATUS.critical, opacity: deletingAttId === att.id ? 0.3 : 1 }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload */}
              {canEdit && (
                <div className="space-y-3">
                  <label className={`inline-flex items-center justify-center w-full px-4 py-3 rounded-lg text-xs font-medium cursor-pointer transition-opacity ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ background: isEnvi ? STATUS.ok : PALETTE.primary, color: '#fff' }}>
                    {uploadingFile ? 'กำลังอัปโหลด...' : '+ อัปโหลดไฟล์'}
                    <input type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx" className="hidden"
                      onChange={e => { const file = e.target.files?.[0]; if (file) onUploadFile(file); e.target.value = ''; }}
                      disabled={uploadingFile} />
                  </label>

                  <div className="rounded-lg p-3" style={{ background: UI.bgPage, border: `1px dashed ${UI.borderStrong}` }}>
                    <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: UI.textLabel }}>
                      <ExternalLink size={11} /> เพิ่มลิงก์ภายนอก
                    </p>
                    <input type="text" value={externalLinkTitle} onChange={e => setExternalLinkTitle(e.target.value)}
                      placeholder="ชื่อลิงก์ (ไม่จำเป็น)"
                      className="w-full px-2.5 py-1.5 rounded text-xs mb-1.5 focus:outline-none"
                      style={{ background: UI.bgWhite, border: `1px solid ${UI.borderStrong}`, color: UI.textStrong }} />
                    <div className="flex gap-1.5">
                      <input type="url" value={externalLink} onChange={e => setExternalLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-2.5 py-1.5 rounded text-xs focus:outline-none"
                        style={{ background: UI.bgWhite, border: `1px solid ${UI.borderStrong}`, color: UI.textStrong }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }} />
                      <button onClick={handleAddLink} disabled={addingLink || !externalLink.trim()}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-opacity"
                        style={{ background: PALETTE.primary, color: '#fff', opacity: addingLink || !externalLink.trim() ? 0.5 : 1 }}>
                        {addingLink ? '...' : '+ เพิ่ม'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Budget */}
          {activeTab === 'budget' && (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: UI.bgPage, border: `1px solid ${UI.borderDefault}` }}>
                {/* Summary: plan vs actual (derived from monthly sum if present) */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-[11px] mb-0.5" style={{ color: UI.textPlaceholder }}>งบตามแผน</p>
                    <p className="text-xl font-bold" style={{ color: UI.textStrong }}>
                      {modalBudget > 0 ? modalBudget.toLocaleString() : '-'}
                      {modalBudget > 0 && <span className="text-[11px] font-normal ml-1" style={{ color: UI.textPlaceholder }}>บาท</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] mb-0.5" style={{ color: UI.textPlaceholder }}>ใช้จริง (รวม)</p>
                    <p className="text-xl font-bold" style={{ color: isOverBudget ? STATUS.critical : STATUS.ok }}>
                      {effectiveActualCost > 0 ? effectiveActualCost.toLocaleString() : '-'}
                      {effectiveActualCost > 0 && <span className="text-[11px] font-normal ml-1" style={{ color: UI.textPlaceholder }}>บาท</span>}
                    </p>
                  </div>
                </div>
                {modalBudget > 0 && effectiveActualCost > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span style={{ color: UI.textLabel }}>ใช้ไป {budgetPctUsed}%</span>
                      <span className="flex items-center gap-1" style={{ color: isOverBudget ? STATUS.critical : STATUS.ok }}>
                        {isOverBudget ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isOverBudget ? `เกินงบ ${Math.abs(budgetVariance).toLocaleString()}` : `เหลือ ${budgetVariance.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: UI.bgHover }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(budgetPctUsed, 100)}%`,
                        background: isOverBudget ? STATUS.critical : budgetPctUsed >= 85 ? STATUS.warning : STATUS.ok,
                      }} />
                    </div>
                  </div>
                )}

                {/* Monthly cost breakdown */}
                <div className="mt-4 pt-4" style={{ borderTop: `1px dashed ${UI.borderDefault}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold" style={{ color: UI.textStrong }}>ค่าใช้จ่ายจริง รายเดือน</label>
                    <span className="text-[10px]" style={{ color: UI.textPlaceholder }}>
                      ยอดใช้จริงคำนวณจากผลรวมของทุกเดือน
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_KEYS.map((mk, idx) => {
                      const isCurrent = idx === new Date().getMonth();
                      const val = editingMonthlyCosts[mk] || '';
                      return (
                        <div key={mk} className="relative">
                          <label className="text-[10px] block mb-0.5 font-medium" style={{ color: isCurrent ? accentColor : UI.textLabel }}>
                            {MONTH_LABELS[idx]} {isCurrent && <span className="text-[9px]">(ปัจจุบัน)</span>}
                          </label>
                          <input
                            type="number"
                            value={val}
                            onChange={e => onSetEditingMonthlyCost(mk, e.target.value)}
                            placeholder="-"
                            disabled={!canEdit}
                            className="w-full px-2 py-1.5 rounded-lg text-[13px] focus:outline-none"
                            style={{
                              background: canEdit ? UI.bgWhite : UI.bgHover,
                              border: `1px solid ${isCurrent ? accentColor : UI.borderStrong}`,
                              color: UI.textStrong,
                              textAlign: 'right',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Live preview of sum */}
                  {editingMonthlyTotal > 0 && (
                    <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: `${accentColor}10`, border: `1px dashed ${accentColor}40` }}>
                      <span className="text-[11px]" style={{ color: UI.textLabel }}>ผลรวมที่กรอก</span>
                      <span className="text-[14px] font-bold" style={{ color: accentColor }}>
                        {editingMonthlyTotal.toLocaleString()} <span className="text-[10px] font-normal">บาท</span>
                      </span>
                    </div>
                  )}

                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          // Convert string record → number record (only positive numbers)
                          const numeric: Record<string, number> = {};
                          for (const k of MONTH_KEYS) {
                            const raw = editingMonthlyCosts[k];
                            if (!raw) continue;
                            const n = parseFloat(raw);
                            if (!isNaN(n) && n > 0) numeric[k] = n;
                          }
                          const hasAnyMonth = Object.keys(numeric).length > 0;
                          // If user didn't fill any month but had a legacy single value in editingActualCost, fall back
                          const fallbackTotal = parseFloat(editingActualCost) || 0;
                          onSaveBudget(
                            editingCell.actNo,
                            hasAnyMonth ? editingMonthlyTotal : fallbackTotal,
                            hasAnyMonth ? numeric : undefined,
                          );
                        }}
                        disabled={savingBudget}
                        className="flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                        style={{ background: STATUS.warning, color: '#fff', opacity: savingBudget ? 0.5 : 1 }}>
                        {savingBudget ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่ายรายเดือน'}
                      </button>
                      {editingMonthlyTotal > 0 && (
                        <button
                          onClick={() => {
                            for (const k of MONTH_KEYS) onSetEditingMonthlyCost(k, '');
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-opacity"
                          style={{ background: UI.bgHover, color: UI.textLabel, border: `1px solid ${UI.borderDefault}` }}>
                          ล้างทั้งหมด
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {canEdit ? (
                <div>
                  <RichTextEditor
                    value={statusNote}
                    onChange={onSetStatusNote}
                    placeholder="พิมพ์รายละเอียดเพิ่มเติม เช่น สิ่งที่ทำ ผลลัพธ์ หรือเหตุผล..."
                  />
                  <button onClick={() => onSaveNote(statusNote)} disabled={savingNote}
                    className="mt-2 px-4 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: PALETTE.primary, color: '#fff', opacity: savingNote ? 0.5 : 1 }}>
                    {savingNote ? 'กำลังบันทึก...' : 'บันทึกหมายเหตุ'}
                  </button>
                </div>
              ) : statusNote ? (
                <div>
                  <p className="text-xs mb-1" style={{ color: UI.textLabel }}>รายละเอียด:</p>
                  <RichTextEditor value={statusNote} onChange={() => {}} readOnly />
                </div>
              ) : (
                <p className="text-xs py-4 text-center" style={{ color: UI.textPlaceholder }}>ไม่มีหมายเหตุ</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
