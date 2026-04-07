'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { X, ChevronUp, ChevronDown, Paperclip, ExternalLink, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Activity, MonthStatus } from '@/lib/types';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const STATUS_OPTIONS: { value: MonthStatus; label: string; icon: string; color: string }[] = [
  { value: 'done', label: 'เสร็จแล้ว', icon: '●', color: '#34c759' },
  { value: 'overdue', label: 'เกินกำหนด', icon: '○', color: '#ff3b30' },
  { value: 'planned', label: 'มีแผน', icon: '○', color: '#8e8e93' },
  { value: 'postponed', label: 'เลื่อน', icon: '◐', color: '#007aff' },
  { value: 'cancelled', label: 'ยกเลิก', icon: '✕', color: '#ff3b30' },
  { value: 'not_applicable', label: 'ไม่เข้าเงื่อนไข', icon: '⊘', color: '#8e8e93' },
  { value: 'not_planned', label: 'ไม่มีแผน', icon: '-', color: '#c7c7cc' },
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
  onSaveBudget: (actNo: string, cost: number) => void;
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
    modalBudget, modalActualCost, editingActualCost, savingBudget,
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
  const budgetPctUsed = modalBudget > 0 ? Math.round(((parseFloat(editingActualCost) || modalActualCost) / modalBudget) * 100) : 0;
  const isOverBudget = budgetPctUsed > 100;
  const budgetVariance = modalBudget - (parseFloat(editingActualCost) || modalActualCost);

  const accentColor = isSafety ? '#ff6b35' : isEnvi ? '#34c759' : '#007aff';
  const accentBg = isSafety ? 'rgba(255,107,53,0.08)' : isEnvi ? 'rgba(52,199,89,0.08)' : 'rgba(0,122,255,0.08)';

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
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(520px, 90vw)',
          background: '#ffffff',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 py-4" style={{
          background: isSafety
            ? 'linear-gradient(135deg, #ff6b35 0%, #e8451a 100%)'
            : isEnvi
            ? 'linear-gradient(135deg, #34c759 0%, #248a3d 100%)'
            : 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
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
                  👤 {modalResponsible}
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
        <div className="flex-shrink-0 flex border-b" style={{ borderColor: '#e5e7eb' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 text-xs font-medium transition-colors relative"
              style={{
                color: activeTab === t.key ? accentColor : '#6b7280',
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
          <div className="flex-shrink-0 px-5 py-2.5" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
            <p className="text-xs font-medium" style={{ color: '#dc2626' }}>🔒 เลยกำหนดเวลาแก้ไข — ต้องขออนุมัติ</p>
          </div>
        )}
        {!checkingLock && deadlineLocked && isAdmin && (
          <div className="flex-shrink-0 px-5 py-2" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <p className="text-xs font-medium" style={{ color: '#d97706' }}>⚠ เลยกำหนด — แก้ไขได้ (Admin)</p>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* TAB: Status */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Grid */}
              {canEdit && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSaveStatusWrapped(opt.value)}
                          disabled={savingStatus}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: isActive ? '#eef2ff' : '#f9fafb',
                            border: isActive ? `2px solid ${accentColor}` : '1px solid #e5e7eb',
                            color: isActive ? accentColor : '#6b7280',
                            opacity: savingStatus ? 0.5 : 1,
                          }}
                        >
                          <span style={{ color: opt.color }} className="text-sm">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Completion flow */}
                  {pendingDone && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.3)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#16a34a' }}>บันทึกการดำเนินงาน</p>
                      <div>
                        <label className="text-[11px] block mb-1" style={{ color: '#6b7280' }}>วันที่ดำเนินการเสร็จ</label>
                        <DateInput value={completionDate} onChange={v => setCompletionDate(v)} inputStyle={{ background: '#fff', border: '1px solid #d1d5db', color: '#1f2937' }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setPendingDone(false); setCompletionDate(''); }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#e5e7eb', color: '#374151' }}>ยกเลิก</button>
                        <button onClick={() => onSaveStatus('done')} disabled={!completionDate || savingStatus}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: '#16a34a', color: '#fff', opacity: !completionDate || savingStatus ? 0.5 : 1 }}>
                          {savingStatus ? 'กำลังบันทึก...' : '✓ ยืนยัน'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Postpone flow */}
                  {pendingPostpone && (
                    <div className="rounded-lg p-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: '#2563eb' }}>เลือกเดือนที่จะเลื่อนไป:</p>
                      <div className="grid grid-cols-6 gap-1.5 mb-2">
                        {MONTH_KEYS.map((mk, idx) => {
                          const isPast = idx < new Date().getMonth();
                          const isOriginal = mk === editingCell.month;
                          const disabled = isPast || isOriginal;
                          const isSelected = postponeMonth === mk;
                          return (
                            <button key={mk} onClick={() => !disabled && setPostponeMonth(mk)} disabled={disabled}
                              className="px-2 py-1.5 rounded text-xs transition-colors"
                              style={{
                                background: isSelected ? '#2563eb' : disabled ? '#f3f4f6' : '#e5e7eb',
                                color: isSelected ? '#fff' : disabled ? '#d1d5db' : '#374151',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                              }}
                            >{MONTH_LABELS[idx]}</button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setPendingPostpone(false); setPostponeMonth(''); }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#e5e7eb', color: '#374151' }}>ยกเลิก</button>
                        <button onClick={() => onSaveStatus('postponed')} disabled={!postponeMonth || savingStatus}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: '#2563eb', color: '#fff', opacity: !postponeMonth || savingStatus ? 0.5 : 1 }}>
                          {savingStatus ? '...' : `เลื่อนไป ${postponeMonth ? MONTH_LABELS[MONTH_KEYS.indexOf(postponeMonth)] : '...'}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Phase 4: Approval Request Form (cancel, N/A, plan changes) */}
                  {pendingCancel && (() => {
                    const labels: Record<string, { title: string; placeholder: string; color: string; bg: string; border: string }> = {
                      cancelled: { title: '⚠️ ขอยกเลิกกิจกรรม', placeholder: 'ระบุเหตุผลที่ต้องการยกเลิก...', color: '#ff3b30', bg: 'rgba(255,59,48,0.06)', border: 'rgba(255,59,48,0.2)' },
                      not_applicable: { title: '⊘ ขอระบุไม่เข้าเงื่อนไข', placeholder: 'ระบุเหตุผลที่ไม่เข้าเงื่อนไข...', color: '#636366', bg: 'rgba(142,142,147,0.08)', border: 'rgba(142,142,147,0.2)' },
                      not_planned: { title: '📋 ขอนำออกจากแผน (→ ไม่มีแผน)', placeholder: 'ระบุเหตุผลที่ต้องการนำออกจากแผนที่ได้รับอนุมัติแล้ว...', color: '#ff9500', bg: 'rgba(255,149,0,0.06)', border: 'rgba(255,149,0,0.2)' },
                      planned: { title: '📋 ขอเพิ่มเข้าแผน (→ มีแผน)', placeholder: 'ระบุเหตุผลที่ต้องการเพิ่มรายการนี้เข้าแผน...', color: '#007aff', bg: 'rgba(0,122,255,0.06)', border: 'rgba(0,122,255,0.2)' },
                    };
                    const cfg = labels[pendingCancel] || labels.cancelled;
                    return (
                      <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <p className="text-[11px] font-semibold" style={{ color: cfg.color }}>
                          {cfg.title} — ต้องได้รับอนุมัติจาก Admin
                        </p>
                        <textarea
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder={cfg.placeholder}
                          className="w-full px-3 py-2 rounded-lg text-[12px] resize-none"
                          rows={2}
                          style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827', outline: 'none' }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => { setPendingCancel(null); setCancelReason(''); }}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#e5e7eb', color: '#374151' }}>ยกเลิก</button>
                          <button onClick={handleSubmitCancellationRequest} disabled={!cancelReason.trim() || submittingCancel}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: cfg.color, color: '#fff', opacity: !cancelReason.trim() || submittingCancel ? 0.5 : 1 }}>
                            {submittingCancel ? 'กำลังส่ง...' : 'ส่งคำขออนุมัติ'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pending approval badge */}
                  {pendingCancellationStatus && !pendingCancel && (
                    <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ff9500' }} />
                      <span className="text-[11px]" style={{ color: '#ff9500' }}>
                        คำขอ{pendingCancellationStatus === 'cancelled' ? 'ยกเลิก' : pendingCancellationStatus === 'not_applicable' ? 'ไม่เข้าเงื่อนไข' : pendingCancellationStatus === 'not_planned' ? 'นำออกจากแผน' : pendingCancellationStatus === 'planned' ? 'เพิ่มเข้าแผน' : pendingCancellationStatus}รอการอนุมัติจาก Admin
                      </span>
                    </div>
                  )}

                  {/* Revert */}
                  {hasOverride && (
                    <button onClick={onRevertStatus} disabled={savingStatus}
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] transition-colors"
                      style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      ↩ กลับไปใช้สถานะอัตโนมัติ (จาก Sheet)
                    </button>
                  )}
                </>
              )}

              {/* Month overview strip */}
              <div>
                <p className="text-[11px] font-medium mb-2" style={{ color: '#6b7280' }}>สถานะรายเดือน</p>
                <div className="grid grid-cols-12 gap-1">
                  {MONTH_KEYS.map((mk, idx) => {
                    const st = activity.monthStatuses?.[mk] || 'not_planned';
                    const isCurrent = mk === editingCell.month;
                    const dotColor = st === 'done' ? '#34c759' : st === 'overdue' ? '#ff3b30' : st === 'planned' ? '#8e8e93' : st === 'postponed' ? '#007aff' : '#e5e7eb';
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
                        <div style={{ color: isCurrent ? accentColor : '#9ca3af' }}>{MONTH_LABELS[idx].replace('.', '')}</div>
                        <div className="mx-auto mt-0.5 w-2 h-2 rounded-full" style={{ background: dotColor }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helper tips */}
              {isSafety && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)' }}>
                  <span className="text-sm mt-0.5">🛡️</span>
                  <div className="text-[11px]" style={{ color: '#6b7280' }}>
                    <p className="font-semibold mb-0.5" style={{ color: '#ff6b35' }}>ปิดกิจกรรม Safety</p>
                    <p>1. อัปเดตสถานะ "เสร็จแล้ว" → 2. แนบหลักฐาน → 3. ระบุรายละเอียด</p>
                  </div>
                </div>
              )}
              {isEnvi && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)' }}>
                  <span className="text-sm mt-0.5">📋</span>
                  <div className="text-[11px]" style={{ color: '#6b7280' }}>
                    <p className="font-semibold mb-0.5" style={{ color: '#34c759' }}>Compliance — แนบหลักฐานจำเป็น</p>
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
                      style={{ background: '#4f46e5', color: '#fff' }}>
                      ขอแก้ไขข้อมูลย้อนหลัง
                    </button>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                      <p className="text-sm font-medium mb-2" style={{ color: '#1f2937' }}>ขอแก้ไขข้อมูลย้อนหลัง</p>
                      <textarea value={editRequestReason} onChange={e => setEditRequestReason(e.target.value)}
                        placeholder="เหตุผลที่ต้องการแก้ไข..."
                        className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none resize-none"
                        style={{ background: '#fff', border: '1px solid #d1d5db', color: '#1f2937' }}
                        rows={3} autoFocus />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowEditRequest(false); setEditRequestReason(''); }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#e5e7eb', color: '#374151' }}>ยกเลิก</button>
                        <button onClick={() => { onRequestEdit(editRequestReason); setShowEditRequest(false); setEditRequestReason(''); }}
                          disabled={!editRequestReason.trim()}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: '#4f46e5', color: '#fff', opacity: !editRequestReason.trim() ? 0.5 : 1 }}>
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
                <div className="text-xs py-8 text-center" style={{ color: '#6b7280' }}>กำลังโหลด...</div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-8 rounded-lg" style={isEnvi
                  ? { background: 'rgba(255,59,48,0.04)', border: '2px dashed rgba(255,59,48,0.3)' }
                  : { background: '#f9fafb', border: '2px dashed #d1d5db' }
                }>
                  <Paperclip size={28} className="mx-auto mb-2" style={{ color: isEnvi ? '#ff3b30' : '#d1d5db' }} />
                  <p className="text-xs font-medium" style={{ color: isEnvi ? '#ff3b30' : '#9ca3af' }}>
                    {isEnvi ? '⚠ ยังไม่มีหลักฐาน — ต้องอัปโหลดเพื่อ compliance' : 'ยังไม่มีไฟล์แนบ'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm flex-shrink-0">
                          {att.file_type === 'link' ? '🔗' : att.file_type?.includes('image') ? '🖼️' : att.file_type?.includes('pdf') ? '📄' : att.file_type?.includes('excel') ? '📊' : '📎'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs truncate" style={{ color: '#1f2937' }}>{att.file_name}</p>
                          <p className="text-[10px]" style={{ color: '#9ca3af' }}>
                            {att.uploaded_by} · {new Date(att.created_at).toLocaleDateString('th-TH')}
                            {att.file_size > 0 && ` · ${(att.file_size / 1024 / 1024).toFixed(1)} MB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <a href={att.file_url || att.drive_url || '#'} target="_blank" rel="noopener noreferrer"
                          className="text-xs transition-opacity hover:opacity-80" style={{ color: '#2563eb' }}>เปิด</a>
                        {canEdit && (
                          <button onClick={() => onDeleteAttachment(att.id)} disabled={deletingAttId === att.id}
                            className="p-1 rounded transition-opacity hover:opacity-70"
                            style={{ color: '#dc2626', opacity: deletingAttId === att.id ? 0.3 : 1 }}>
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
                    style={{ background: isEnvi ? '#16a34a' : '#2563eb', color: '#fff' }}>
                    {uploadingFile ? 'กำลังอัปโหลด...' : '+ อัปโหลดไฟล์'}
                    <input type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx" className="hidden"
                      onChange={e => { const file = e.target.files?.[0]; if (file) onUploadFile(file); e.target.value = ''; }}
                      disabled={uploadingFile} />
                  </label>

                  <div className="rounded-lg p-3" style={{ background: '#f9fafb', border: '1px dashed #d1d5db' }}>
                    <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: '#6b7280' }}>
                      <ExternalLink size={11} /> เพิ่มลิงก์ภายนอก
                    </p>
                    <input type="text" value={externalLinkTitle} onChange={e => setExternalLinkTitle(e.target.value)}
                      placeholder="ชื่อลิงก์ (ไม่จำเป็น)"
                      className="w-full px-2.5 py-1.5 rounded text-xs mb-1.5 focus:outline-none"
                      style={{ background: '#fff', border: '1px solid #d1d5db', color: '#1f2937' }} />
                    <div className="flex gap-1.5">
                      <input type="url" value={externalLink} onChange={e => setExternalLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-2.5 py-1.5 rounded text-xs focus:outline-none"
                        style={{ background: '#fff', border: '1px solid #d1d5db', color: '#1f2937' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }} />
                      <button onClick={handleAddLink} disabled={addingLink || !externalLink.trim()}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-opacity"
                        style={{ background: '#2563eb', color: '#fff', opacity: addingLink || !externalLink.trim() ? 0.5 : 1 }}>
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
              <div className="rounded-xl p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-[11px] mb-0.5" style={{ color: '#9ca3af' }}>งบตามแผน</p>
                    <p className="text-xl font-bold" style={{ color: '#1f2937' }}>
                      {modalBudget > 0 ? modalBudget.toLocaleString() : '-'}
                      {modalBudget > 0 && <span className="text-[11px] font-normal ml-1" style={{ color: '#9ca3af' }}>บาท</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] mb-0.5" style={{ color: '#9ca3af' }}>ใช้จริง</p>
                    <p className="text-xl font-bold" style={{ color: isOverBudget ? '#dc2626' : '#16a34a' }}>
                      {modalActualCost > 0 ? modalActualCost.toLocaleString() : '-'}
                      {modalActualCost > 0 && <span className="text-[11px] font-normal ml-1" style={{ color: '#9ca3af' }}>บาท</span>}
                    </p>
                  </div>
                </div>
                {modalBudget > 0 && modalActualCost > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span style={{ color: '#6b7280' }}>ใช้ไป {budgetPctUsed}%</span>
                      <span className="flex items-center gap-1" style={{ color: isOverBudget ? '#dc2626' : '#16a34a' }}>
                        {isOverBudget ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isOverBudget ? `เกินงบ ${Math.abs(budgetVariance).toLocaleString()}` : `เหลือ ${budgetVariance.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(budgetPctUsed, 100)}%`,
                        background: isOverBudget ? '#dc2626' : budgetPctUsed >= 85 ? '#f59e0b' : '#16a34a',
                      }} />
                    </div>
                  </div>
                )}
                {canEdit && (
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: '#6b7280' }}>บันทึกค่าใช้จ่ายจริง (บาท)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editingActualCost}
                        onChange={e => onSetEditingActualCost(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={{ background: '#fff', border: '1px solid #d1d5db', color: '#1f2937' }}
                      />
                      <button
                        onClick={() => onSaveBudget(editingCell.actNo, parseFloat(editingActualCost) || 0)}
                        disabled={savingBudget}
                        className="px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                        style={{ background: '#f59e0b', color: '#fff', opacity: savingBudget ? 0.5 : 1 }}>
                        {savingBudget ? '...' : '💾 บันทึก'}
                      </button>
                    </div>
                  </div>
                )}
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
                    style={{ background: '#8b5cf6', color: '#fff', opacity: savingNote ? 0.5 : 1 }}>
                    {savingNote ? 'กำลังบันทึก...' : '💾 บันทึกหมายเหตุ'}
                  </button>
                </div>
              ) : statusNote ? (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#6b7280' }}>รายละเอียด:</p>
                  <RichTextEditor value={statusNote} onChange={() => {}} readOnly />
                </div>
              ) : (
                <p className="text-xs py-4 text-center" style={{ color: '#9ca3af' }}>ไม่มีหมายเหตุ</p>
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
