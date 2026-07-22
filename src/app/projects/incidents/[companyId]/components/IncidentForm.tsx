'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { X, Plus, Camera, Trash2, ImageIcon, Upload, Loader2, Save, CloudOff, CheckCircle2 } from 'lucide-react';
import type { Incident } from '../types';
import {
  INCIDENT_TYPES, ACTUAL_SEVERITIES, PERSON_TYPES, POTENTIAL_SEVERITIES,
  ACTIVITIES, ENVIRONMENTS, PROP_DMG_TYPES, PROD_IMPACTS, INSUR_CLAIMS,
  INV_LEVELS, RCA_METHODS, RC_CATEGORIES, BARRIER_FAILS, HOC_TYPES,
  CA_STATUSES, JUST_CULTURES, NATURE_INJURIES, BODY_PARTS, BODY_SIDES,
  INJ_SEVERITIES, TRAIN_STATUSES, CONTACT_TYPES, AGENCY_SOURCES, SHIFTS,
  NON_INJURY_TYPES, inputStyle, selectStyle,
} from '../constants';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface IncidentFormProps {
  companyId: string;
  companyName: string;
  editingIncident: Incident | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */
const SH = ({ num, label, bg, fg }: { num: string; label: string; bg: string; fg: string }) => (
  <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: bg, color: fg }}>{num}</span>
    {label}
  </h3>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function IncidentForm({ companyId, companyName, editingIncident, onClose, onSaved }: IncidentFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [injuredPersons, setInjuredPersons] = useState<Record<string, unknown>[]>([]);
  const [saving, setSaving] = useState(false);

  /* Photo attachment state */
  interface IncidentPhoto {
    id: string;
    incident_no: string;
    file_name: string;
    file_url: string;
    file_size: number;
    caption: string;
    created_at: string;
  }
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5;

  /* Document attachment state — PDF files or Drive/OneDrive links (max 2) */
  interface IncidentAttachment {
    id: string;
    kind: string;      // 'file' | 'link'
    title: string;
    file_url: string;
  }
  const [attachments, setAttachments] = useState<IncidentAttachment[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [attError, setAttError] = useState('');
  const [attLinkUrl, setAttLinkUrl] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const MAX_ATTACHMENTS = 2;

  const loadAttachments = (incidentNo: string) => {
    fetch(`/api/incidents/attachments?incident_no=${encodeURIComponent(incidentNo)}`)
      .then(r => r.json())
      .then(data => setAttachments(data.attachments || []))
      .catch(() => setAttachments([]));
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incidentNo = (formData.incident_no as string) || '';
    if (!incidentNo) { setAttError('กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบเอกสารได้'); return; }
    if (attachments.length >= MAX_ATTACHMENTS) { setAttError(`แนบเอกสารได้สูงสุด ${MAX_ATTACHMENTS} รายการ`); return; }
    setAttError('');
    setUploadingAtt(true);
    const fd = new FormData();
    fd.append('file', files[0]);
    fd.append('incident_no', incidentNo);
    fd.append('company_id', companyId);
    try {
      const res = await fetch('/api/incidents/attachments', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) setAttError(data.error);
      else if (data.attachment) setAttachments(prev => [...prev, data.attachment]);
    } catch { setAttError('อัปโหลดเอกสารล้มเหลว'); }
    setUploadingAtt(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleAddAttachmentLink = async () => {
    const incidentNo = (formData.incident_no as string) || '';
    if (!incidentNo) { setAttError('กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบเอกสารได้'); return; }
    if (!attLinkUrl.trim()) return;
    if (attachments.length >= MAX_ATTACHMENTS) { setAttError(`แนบเอกสารได้สูงสุด ${MAX_ATTACHMENTS} รายการ`); return; }
    setAttError('');
    setUploadingAtt(true);
    try {
      const res = await fetch('/api/incidents/attachments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentNo, companyId, linkUrl: attLinkUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) setAttError(data.error);
      else if (data.attachment) { setAttachments(prev => [...prev, data.attachment]); setAttLinkUrl(''); }
    } catch { setAttError('เพิ่มลิงก์ล้มเหลว'); }
    setUploadingAtt(false);
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm('ต้องการลบเอกสารแนบนี้?')) return;
    try {
      const res = await fetch(`/api/incidents/attachments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setAttachments(prev => prev.filter(a => a.id !== id));
      else setAttError(data.error || 'ลบเอกสารล้มเหลว');
    } catch { setAttError('ลบเอกสารล้มเหลว'); }
  };

  /* ── Auto-save Draft ── */
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftIncidentNo, setDraftIncidentNo] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>('');
  const isInitializing = useRef(true);

  const performAutoSave = useCallback(async (data: Record<string, unknown>, injured: Record<string, unknown>[]) => {
    // Must have at least incident_type or some meaningful data to auto-save
    const hasContent = data.incident_type || data.description || data.reporter || data.area;
    if (!hasContent) return;

    const currentJson = JSON.stringify({ data, injured });
    if (currentJson === lastSavedJson.current) return; // No changes

    setDraftStatus('saving');
    try {
      const existingNo = (data.incident_no as string) || draftIncidentNo;
      const method = existingNo ? 'PUT' : 'POST';
      const payload = {
        ...data,
        report_status: 'Draft',
        injured_persons: injured.length > 0 ? injured : undefined,
        ...(existingNo ? { incident_no: existingNo } : {}),
      };

      const res = await fetch('/api/incidents', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.error) {
        setDraftStatus('error');
      } else {
        lastSavedJson.current = currentJson;
        setDraftStatus('saved');
        // Store the incident_no from first save for subsequent updates
        const savedNo = result.incident?.incident_no || result.incident_no;
        if (savedNo && !existingNo) {
          setDraftIncidentNo(savedNo);
          setFormData(prev => ({ ...prev, incident_no: savedNo }));
        }
      }
    } catch {
      setDraftStatus('error');
    }
  }, [draftIncidentNo]);

  // Debounced auto-save: trigger 2 seconds after last change
  useEffect(() => {
    if (isInitializing.current) return;
    if (saving) return; // Don't auto-save while user is manually saving
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      performAutoSave(formData, injuredPersons);
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData, injuredPersons, performAutoSave, saving]);

  // Initialize form when editing incident changes
  useEffect(() => {
    isInitializing.current = true;
    if (editingIncident) {
      setFormData({ ...editingIncident });
      setDraftIncidentNo(editingIncident.incident_no || null);
      lastSavedJson.current = JSON.stringify({ data: editingIncident, injured: [] });
      // Fetch injured persons for this incident
      fetch(`/api/incidents/injured?incident_no=${encodeURIComponent(editingIncident.incident_no)}`)
        .then(r => r.json())
        .then(data => {
          setInjuredPersons(data.persons || []);
          lastSavedJson.current = JSON.stringify({ data: editingIncident, injured: data.persons || [] });
        })
        .catch(() => setInjuredPersons([]));
      // Fetch existing photos
      fetch(`/api/incidents/photos?incident_no=${encodeURIComponent(editingIncident.incident_no)}`)
        .then(r => r.json())
        .then(data => setPhotos(data.photos || []))
        .catch(() => setPhotos([]));
      // Fetch existing document attachments
      loadAttachments(editingIncident.incident_no);
    } else {
      // Check for existing draft
      fetch(`/api/incidents/drafts?companyId=${companyId}`)
        .then(r => r.json())
        .then(data => {
          if (data.draft) {
            setFormData({ ...data.draft });
            setDraftIncidentNo(data.draft.incident_no || null);
            lastSavedJson.current = JSON.stringify({ data: data.draft, injured: [] });
            setDraftStatus('saved');
            // Load injured persons for draft
            if (data.draft.incident_no) {
              fetch(`/api/incidents/injured?incident_no=${encodeURIComponent(data.draft.incident_no)}`)
                .then(r => r.json())
                .then(d => {
                  setInjuredPersons(d.persons || []);
                  lastSavedJson.current = JSON.stringify({ data: data.draft, injured: d.persons || [] });
                })
                .catch(() => {});
              loadAttachments(data.draft.incident_no);
            }
          } else {
            setFormData({
              company_id: companyId,
              incident_date: new Date().toISOString().split('T')[0],
              incident_type: '',
              work_related: 'ใช่',
              report_status: 'Draft',
            });
          }
          setTimeout(() => { isInitializing.current = false; }, 500);
        })
        .catch(() => {
          setFormData({
            company_id: companyId,
            incident_date: new Date().toISOString().split('T')[0],
            incident_type: '',
            work_related: 'ใช่',
            report_status: 'Draft',
          });
          setTimeout(() => { isInitializing.current = false; }, 500);
        });
      setInjuredPersons([]);
      setPhotos([]);
      setAttachments([]);
      return; // Don't set isInitializing to false yet — wait for draft check
    }
    setTimeout(() => { isInitializing.current = false; }, 500);
  }, [editingIncident, companyId]);

  const updateForm = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  /* Injured persons helpers */
  const addInjuredPerson = () => {
    setInjuredPersons(prev => [...prev, {
      person_type: '', full_name: '', position: '', department: '', years_of_service: null,
      training_status: '', injury_severity: '', nature_of_injury: '', body_part: '', body_side: '',
      injury_detail: '', is_lti: 'ไม่ใช่', lost_work_days: 0, leave_start_date: '', return_to_work_date: '',
      treatment: '', hospital: '', medical_cost: 0,
    }]);
  };

  const updateInjuredPerson = (idx: number, key: string, value: unknown) => {
    setInjuredPersons(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  };

  const removeInjuredPerson = (idx: number) => {
    setInjuredPersons(prev => prev.filter((_, i) => i !== idx));
  };

  /* Photo upload handlers */
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Must have incident_no (saved incident)
    const incidentNo = (formData.incident_no as string) || '';
    if (!incidentNo) {
      setPhotoError('กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบรูปได้');
      return;
    }

    if (photos.length >= MAX_PHOTOS) {
      setPhotoError(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`);
      return;
    }

    setPhotoError('');
    setUploadingPhoto(true);

    const remainingSlots = MAX_PHOTOS - photos.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('incident_no', incidentNo);
      fd.append('company_id', companyId);

      try {
        const res = await fetch('/api/incidents/photos', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) {
          setPhotoError(data.error);
        } else if (data.photo) {
          setPhotos(prev => [...prev, data.photo]);
        }
      } catch {
        setPhotoError('อัปโหลดรูปล้มเหลว');
      }
    }

    setUploadingPhoto(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('ต้องการลบรูปนี้?')) return;
    try {
      const res = await fetch(`/api/incidents/photos?id=${photoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      }
    } catch {
      setPhotoError('ลบรูปล้มเหลว');
    }
  };

  /* Save (finalize — changes status from Draft to Under Review) */
  const handleSave = async () => {
    if (!formData.incident_type || !formData.incident_date) {
      alert('กรุณากรอกวันที่และประเภทอุบัติการณ์');
      return;
    }
    // Cancel any pending auto-save
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaving(true);
    try {
      const existingNo = (formData.incident_no as string) || draftIncidentNo;
      const method = existingNo ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        report_status: 'Under Review', // Finalize: no longer a draft
        injured_persons: injuredPersons.length > 0 ? injuredPersons : undefined,
        ...(existingNo ? { incident_no: existingNo } : {}),
      };
      const res = await fetch('/api/incidents', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        onSaved();
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSaving(false);
  };

  /* Dynamic visibility */
  const selectedType = (formData.incident_type as string) || '';
  const showInjurySections = selectedType !== '' && !NON_INJURY_TYPES.includes(selectedType);

  /* Label helper */
  const Label = ({ text, required }: { text: string; required?: boolean }) => (
    <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
      {text}{required && ' *'}
    </label>
  );

  const SmLabel = ({ text }: { text: string }) => (
    <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>{text}</label>
  );

  const smInput = { ...inputStyle, fontSize: 12, padding: '6px 8px' };
  const smSelect = { ...selectStyle, fontSize: 12, padding: '6px 8px' };

  /* ---------------------------------------------------------------- */
  return (
    <div className="max-w-4xl">
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        {/* Form Header */}
        <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold text-white">
                {editingIncident ? `แก้ไข ${editingIncident.incident_no}` : 'บันทึกอุบัติเหตุใหม่'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[12px] text-white/70">{companyName}</p>
                {/* Draft auto-save indicator */}
                {draftStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-[10px] text-white/60">
                    <Loader2 size={10} className="animate-spin" /> กำลังบันทึกร่าง...
                  </span>
                )}
                {draftStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-[10px] text-white/80">
                    <CheckCircle2 size={10} /> บันทึกร่างแล้ว
                  </span>
                )}
                {draftStatus === 'error' && (
                  <span className="flex items-center gap-1 text-[10px] text-yellow-200">
                    <CloudOff size={10} /> บันทึกร่างไม่สำเร็จ
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Section 1: Identification */}
          <div>
            <SH num="1" label="IDENTIFICATION" bg="var(--danger, #fee2e2)" fg="#dc2626" />
            {/* Incident Type — prominent selector */}
            <div className="mb-4 p-3 rounded-lg" style={{ background: selectedType ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.08)', border: `1px solid ${selectedType ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.3)'}` }}>
              <label className="block text-[12px] font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                ประเภทอุบัติการณ์ * <span className="font-normal text-[11px]" style={{ color: 'var(--muted)' }}>(เลือกก่อนเพื่อแสดงฟอร์มที่เกี่ยวข้อง)</span>
              </label>
              <select
                value={selectedType}
                onChange={e => {
                  updateForm('incident_type', e.target.value);
                  if (NON_INJURY_TYPES.includes(e.target.value)) {
                    setInjuredPersons([]);
                    updateForm('injured_count', 0);
                  }
                }}
                style={{ ...selectStyle, fontSize: 14, padding: '10px 12px', fontWeight: 600, background: 'var(--card-solid)' }}
              >
                <option value="">— กรุณาเลือกประเภทอุบัติการณ์ —</option>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {selectedType && (
                <p className="mt-1.5 text-[11px]" style={{ color: showInjurySections ? '#16a34a' : '#d97706' }}>
                  {showInjurySections
                    ? '✓ ฟอร์มจะแสดงส่วนข้อมูลการบาดเจ็บ + Injured Person Log'
                    : '⚡ ฟอร์มจะซ่อนส่วนข้อมูลการบาดเจ็บ (ไม่เกี่ยวข้อง)'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label text="วันที่เกิดเหตุ" required />
                <DateInput value={(formData.incident_date as string) || ''} onChange={v => updateForm('incident_date', v)} inputStyle={inputStyle} />
              </div>
              <div>
                <Label text="เวลาเกิดเหตุ" />
                <input type="time" value={(formData.incident_time as string) || ''} onChange={e => updateForm('incident_time', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label text="กะการทำงาน" />
                <select value={(formData.shift as string) || ''} onChange={e => updateForm('shift', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label text="วันที่รายงาน" />
                <DateInput value={(formData.report_date as string) || ''} onChange={v => updateForm('report_date', v)} inputStyle={inputStyle} />
              </div>
              <div className="col-span-2">
                <Label text="ผู้รายงาน" />
                <input type="text" value={(formData.reporter as string) || ''} onChange={e => updateForm('reporter', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รายงาน" />
              </div>
            </div>
          </div>

          {/* Section 2: Who — only show for injury-related types */}
          {showInjurySections && (
          <div>
            <SH num="2" label="WHO" bg="rgba(59,130,246,0.1)" fg="#2563eb" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text="ประเภทบุคคล" />
                <select value={(formData.person_type as string) || ''} onChange={e => updateForm('person_type', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {PERSON_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label text="แผนก" />
                <input type="text" value={(formData.department as string) || ''} onChange={e => updateForm('department', e.target.value)} style={inputStyle} placeholder="แผนก" />
              </div>
            </div>
          </div>
          )}

          {/* Section 3: What & Where */}
          <div>
            <SH num="3" label="WHAT & WHERE" bg="rgba(249,115,22,0.1)" fg="#ea580c" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text="อุบัติเหตุเกี่ยวกับงาน" />
                <select value={(formData.work_related as string) || 'ใช่'} onChange={e => updateForm('work_related', e.target.value)} style={selectStyle}>
                  <option value="ใช่">ใช่</option>
                  <option value="ไม่ใช่">ไม่ใช่</option>
                </select>
              </div>
              <div>
                <Label text="กิจกรรมขณะเกิดเหตุ" />
                <select value={(formData.activity as string) || ''} onChange={e => updateForm('activity', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {showInjurySections && (
              <>
              <div>
                <Label text="ความรุนแรงจริง (Actual)" />
                <select value={(formData.actual_severity as string) || ''} onChange={e => updateForm('actual_severity', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {ACTUAL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label text="ความรุนแรงที่อาจเกิด (Potential)" />
                <select value={(formData.potential_severity as string) || ''} onChange={e => updateForm('potential_severity', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {POTENTIAL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label text="จำนวนผู้บาดเจ็บ" />
                <input type="number" value={(formData.injured_count as number) || 0} onChange={e => updateForm('injured_count', parseInt(e.target.value) || 0)} style={inputStyle} min={0} />
              </div>
              <div>
                <Label text="เหตุการณ์/การสัมผัส" />
                <select value={(formData.contact_type as string) || ''} onChange={e => updateForm('contact_type', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label text="แหล่งที่มาอุบัติเหตุ" />
                <select value={(formData.agency_source as string) || ''} onChange={e => updateForm('agency_source', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {AGENCY_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              </>
              )}
            </div>
            <div className="mt-3">
              <Label text="รายละเอียดเหตุการณ์" />
              <textarea value={(formData.description as string) || ''} onChange={e => updateForm('description', e.target.value)} style={{ ...inputStyle, minHeight: 80 }} placeholder="อธิบายรายละเอียดเหตุการณ์..." />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <Label text="พื้นที่เกิดเหตุ" />
                <input type="text" value={(formData.area as string) || ''} onChange={e => updateForm('area', e.target.value)} style={inputStyle} placeholder="พื้นที่/โซน" />
              </div>
              <div>
                <Label text="เครื่องจักร/อุปกรณ์" />
                <input type="text" value={(formData.equipment as string) || ''} onChange={e => updateForm('equipment', e.target.value)} style={inputStyle} placeholder="เครื่องจักรที่เกี่ยวข้อง" />
              </div>
              <div>
                <Label text="สภาพแวดล้อม" />
                <select value={(formData.environment as string) || ''} onChange={e => updateForm('environment', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {ENVIRONMENTS.map(env => <option key={env} value={env}>{env}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Property Damage */}
          <div>
            <SH num="4" label="PROPERTY DAMAGE" bg="rgba(168,85,247,0.1)" fg="#7c3aed" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text="ประเภททรัพย์สินเสียหาย" />
                <select value={(formData.property_damage_type as string) || ''} onChange={e => updateForm('property_damage_type', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {PROP_DMG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label text="อุปกรณ์ดับเพลิงที่ใช้" />
                <input type="text" value={(formData.fire_equipment_used as string) || ''} onChange={e => updateForm('fire_equipment_used', e.target.value)} style={inputStyle} placeholder="ถ้ามี" />
              </div>
            </div>
            <div className="mt-3">
              <Label text="รายละเอียดความเสียหาย" />
              <textarea value={(formData.property_damage_detail as string) || ''} onChange={e => updateForm('property_damage_detail', e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="รายละเอียดทรัพย์สินที่เสียหาย..." />
            </div>
          </div>

          {/* Section 5: Consequence */}
          <div>
            <SH num="5" label="CONSEQUENCE" bg="rgba(34,197,94,0.1)" fg="#16a34a" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text="ค่าเสียหายโดยตรง (บาท)" />
                <input type="number" value={(formData.direct_cost as number) || 0} onChange={e => updateForm('direct_cost', parseFloat(e.target.value) || 0)} style={inputStyle} min={0} />
              </div>
              <div>
                <Label text="ค่าเสียหายทางอ้อม (บาท)" />
                <input type="number" value={(formData.indirect_cost as number) || 0} onChange={e => updateForm('indirect_cost', parseFloat(e.target.value) || 0)} style={inputStyle} min={0} />
              </div>
              <div>
                <Label text="ผลกระทบต่อการผลิต" />
                <select value={(formData.production_impact as string) || ''} onChange={e => updateForm('production_impact', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {PROD_IMPACTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label text="สถานะเคลมประกัน" />
                <select value={(formData.insurance_claim as string) || ''} onChange={e => updateForm('insurance_claim', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {INSUR_CLAIMS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 6: Investigation — fields appear based on investigation level */}
          <div>
            <SH num="6" label="INVESTIGATION" bg="rgba(234,179,8,0.1)" fg="#ca8a04" />
            {(() => {
              const invLevel = (formData.investigation_level as string) || '';
              const isL0 = invLevel.startsWith('Level 0');
              const isL23 = invLevel.startsWith('Level 2') || invLevel.startsWith('Level 3');
              const showCauses = invLevel !== '' && !isL0; // L1 ขึ้นไป
              const showRca = isL23; // L2-L3 เท่านั้น
              const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--muted)', margin: '2px 0 0', lineHeight: 1.5 };
              return (
                <>
                  {/* Level selector + guide */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label text="ระดับการสอบสวน" />
                      <select value={invLevel} onChange={e => updateForm('investigation_level', e.target.value)} style={selectStyle}>
                        <option value="">เลือก</option>
                        {INV_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    {showCauses && (
                      <>
                        <div>
                          <Label text="วันที่เริ่มสอบสวน" />
                          <DateInput value={(formData.investigation_start_date as string) || ''} onChange={v => updateForm('investigation_start_date', v)} inputStyle={inputStyle} />
                        </div>
                        <div>
                          <Label text="หัวหน้าทีมสอบสวน" />
                          <input type="text" value={(formData.investigation_lead as string) || ''} onChange={e => updateForm('investigation_lead', e.target.value)} style={inputStyle} placeholder="ชื่อหัวหน้าทีม" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="rounded-lg p-2.5 mt-2" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)' }}>
                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                      💡 <b>เลือกระดับตามความรุนแรง:</b> <b>L0</b> เหตุเล็กน้อย/ไม่บาดเจ็บ — บันทึกเท่านั้น · <b>L1 ACA</b> ปฐมพยาบาล/ทรัพย์สินเสียหายเล็กน้อย — วิเคราะห์สาเหตุที่เห็นชัด · <b>L2 RCA</b> บาดเจ็บ/หยุดงาน — วิเคราะห์สาเหตุราก · <b>L3</b> เหตุร้ายแรง/เสียชีวิต — ตั้งทีมสอบสวน
                    </p>
                  </div>

                  {invLevel === '' && (
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>เลือกระดับการสอบสวนก่อน — ช่องกรอกจะแสดงตามระดับที่เลือก</p>
                  )}
                  {isL0 && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 0' }}>✓ Level 0: บันทึกเหตุการณ์เท่านั้น ไม่ต้องวิเคราะห์สาเหตุ — ข้ามไปกรอกส่วนถัดไปได้เลย</p>
                  )}

                  {/* L1+: apparent causes */}
                  {showCauses && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label text="Immediate Cause (สาเหตุโดยตรง)" />
                        <textarea value={(formData.immediate_cause as string) || ''} onChange={e => updateForm('immediate_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="เช่น พื้นเปียกลื่น, ไม่สวมถุงมือ, การ์ดเครื่องจักรถูกถอด" />
                        <p style={hintStyle}>สิ่งที่เห็นได้ทันที ณ จุดเกิดเหตุ — การกระทำ/สภาพการณ์ที่ไม่ปลอดภัย</p>
                      </div>
                      <div>
                        <Label text="Contributing Cause (ปัจจัยเสริม)" />
                        <textarea value={(formData.contributing_cause as string) || ''} onChange={e => updateForm('contributing_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="เช่น แสงสว่างไม่พอ, เร่งงานตามกำหนด, อุปกรณ์ไม่พร้อม" />
                        <p style={hintStyle}>ปัจจัยแวดล้อมที่ทำให้เหตุเกิดง่ายขึ้น (อาจมีหลายข้อ)</p>
                      </div>
                    </div>
                  )}

                  {/* L2-L3: root cause analysis */}
                  {showRca && (
                    <>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <Label text="RCA Method" />
                          <select value={(formData.rca_method as string) || ''} onChange={e => updateForm('rca_method', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {RCA_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <p style={hintStyle}>เครื่องมือที่ใช้วิเคราะห์ เช่น 5 Whys, Fishbone</p>
                        </div>
                        <div>
                          <Label text="Root Cause Category" />
                          <select value={(formData.root_cause_category as string) || ''} onChange={e => updateForm('root_cause_category', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {RC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <p style={hintStyle}>หมวดของสาเหตุราก (คน/เครื่อง/ระบบ/สภาพแวดล้อม)</p>
                        </div>
                        <div>
                          <Label text="Barrier ที่ล้มเหลว" />
                          <select value={(formData.barrier_failure as string) || ''} onChange={e => updateForm('barrier_failure', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {BARRIER_FAILS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <p style={hintStyle}>มาตรการป้องกันที่มีอยู่แต่ไม่ทำงาน</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label text="Root Cause Detail (สาเหตุราก)" />
                          <textarea value={(formData.root_cause_detail as string) || ''} onChange={e => updateForm('root_cause_detail', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="เช่น ไม่มี WI สำหรับงานนี้, การอบรมไม่ครอบคลุม, ไม่มีการตรวจสอบ PM" />
                          <p style={hintStyle}>สาเหตุเชิงระบบ — ถาม &ldquo;ทำไม&rdquo; ซ้ำจนถึงข้อบกพร่องของระบบ (ไม่ใช่โทษตัวบุคคล) ถ้าแก้ข้อนี้แล้วเหตุจะไม่เกิดซ้ำ</p>
                        </div>
                        <div>
                          <Label text="Just Culture" />
                          <select value={(formData.just_culture as string) || ''} onChange={e => updateForm('just_culture', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {JUST_CULTURES.map(j => <option key={j} value={j}>{j}</option>)}
                          </select>
                          <p style={hintStyle}>จำแนกพฤติกรรมเพื่อตอบสนองอย่างเป็นธรรม: Human Error = พลาดสุจริต → แก้ระบบ · At-Risk = เคยชินความเสี่ยง → โค้ช · Reckless = จงใจฝ่าฝืน → วินัย</p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Section 7: Corrective Action */}
          <div>
            <SH num="7" label="CORRECTIVE ACTION" bg="rgba(20,184,166,0.1)" fg="#0d9488" />
            {/* CA 1 */}
            <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Corrective Action 1</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label text="มาตรการแก้ไข" />
                  <textarea value={(formData.corrective_action_1 as string) || ''} onChange={e => updateForm('corrective_action_1', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="อธิบายมาตรการแก้ไข..." />
                </div>
                <div>
                  <Label text="ประเภท (HoC)" />
                  <select value={(formData.ca1_type as string) || ''} onChange={e => updateForm('ca1_type', e.target.value)} style={selectStyle}>
                    <option value="">เลือก</option>
                    {HOC_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <Label text="ผู้รับผิดชอบ" />
                  <input type="text" value={(formData.ca1_responsible as string) || ''} onChange={e => updateForm('ca1_responsible', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับผิดชอบ" />
                </div>
                <div>
                  <Label text="กำหนดเสร็จ" />
                  <DateInput value={(formData.ca1_due_date as string) || ''} onChange={v => updateForm('ca1_due_date', v)} inputStyle={inputStyle} />
                </div>
                <div>
                  <Label text="สถานะ" />
                  <select value={(formData.ca1_status as string) || ''} onChange={e => updateForm('ca1_status', e.target.value)} style={selectStyle}>
                    <option value="">เลือก</option>
                    {CA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {/* CA 2 */}
            <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Corrective Action 2</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label text="มาตรการแก้ไข" />
                  <textarea value={(formData.corrective_action_2 as string) || ''} onChange={e => updateForm('corrective_action_2', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="อธิบายมาตรการแก้ไข..." />
                </div>
                <div>
                  <Label text="ประเภท (HoC)" />
                  <select value={(formData.ca2_type as string) || ''} onChange={e => updateForm('ca2_type', e.target.value)} style={selectStyle}>
                    <option value="">เลือก</option>
                    {HOC_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <Label text="ผู้รับผิดชอบ" />
                  <input type="text" value={(formData.ca2_responsible as string) || ''} onChange={e => updateForm('ca2_responsible', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับผิดชอบ" />
                </div>
                <div>
                  <Label text="กำหนดเสร็จ" />
                  <DateInput value={(formData.ca2_due_date as string) || ''} onChange={v => updateForm('ca2_due_date', v)} inputStyle={inputStyle} />
                </div>
                <div>
                  <Label text="สถานะ" />
                  <select value={(formData.ca2_status as string) || ''} onChange={e => updateForm('ca2_status', e.target.value)} style={selectStyle}>
                    <option value="">เลือก</option>
                    {CA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Label text="Lessons Learned" />
              <textarea value={(formData.lessons_learned as string) || ''} onChange={e => updateForm('lessons_learned', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="บทเรียนที่ได้..." />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label text="วันที่ปิดรายงาน" />
                <DateInput value={(formData.report_closed_date as string) || ''} onChange={v => updateForm('report_closed_date', v)} inputStyle={inputStyle} />
              </div>
              <div>
                <Label text="สถานะรายงาน" />
                <select value={(formData.report_status as string) || 'Draft'} onChange={e => updateForm('report_status', e.target.value)} style={selectStyle}>
                  {['Draft', 'Under Review', 'Approved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 8: Injured Person Log — only show for injury-related types */}
          {showInjurySections && (
          <div>
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(244,63,94,0.1)', color: '#e11d48' }}>IP</span>
              INJURED PERSON LOG
              <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}>({injuredPersons.length} คน)</span>
            </h3>
            {injuredPersons.map((person, idx) => (
              <div key={idx} className="p-3 rounded-lg mb-3 relative" style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold" style={{ color: '#dc2626' }}>ผู้บาดเจ็บที่ {idx + 1}</p>
                  <button onClick={() => removeInjuredPerson(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <SmLabel text="ประเภทบุคคล" />
                    <select value={(person.person_type as string) || ''} onChange={e => updateInjuredPerson(idx, 'person_type', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {PERSON_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="ชื่อ-สกุล" />
                    <input type="text" value={(person.full_name as string) || ''} onChange={e => updateInjuredPerson(idx, 'full_name', e.target.value)} style={smInput} placeholder="ชื่อ-สกุล" />
                  </div>
                  <div>
                    <SmLabel text="ตำแหน่ง" />
                    <input type="text" value={(person.position as string) || ''} onChange={e => updateInjuredPerson(idx, 'position', e.target.value)} style={smInput} placeholder="ตำแหน่ง" />
                  </div>
                  <div>
                    <SmLabel text="แผนก" />
                    <input type="text" value={(person.department as string) || ''} onChange={e => updateInjuredPerson(idx, 'department', e.target.value)} style={smInput} placeholder="แผนก" />
                  </div>
                  <div>
                    <SmLabel text="อายุงาน (ปี)" />
                    <input type="number" value={(person.years_of_service as number) || ''} onChange={e => updateInjuredPerson(idx, 'years_of_service', parseFloat(e.target.value) || null)} style={smInput} min={0} step={0.5} />
                  </div>
                  <div>
                    <SmLabel text="ผ่านการอบรม" />
                    <select value={(person.training_status as string) || ''} onChange={e => updateInjuredPerson(idx, 'training_status', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {TRAIN_STATUSES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="ระดับการบาดเจ็บ" />
                    <select value={(person.injury_severity as string) || ''} onChange={e => updateInjuredPerson(idx, 'injury_severity', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {INJ_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="ลักษณะการบาดเจ็บ" />
                    <select value={(person.nature_of_injury as string) || ''} onChange={e => updateInjuredPerson(idx, 'nature_of_injury', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {NATURE_INJURIES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="ส่วนร่างกาย" />
                    <select value={(person.body_part as string) || ''} onChange={e => updateInjuredPerson(idx, 'body_part', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="ด้าน" />
                    <select value={(person.body_side as string) || ''} onChange={e => updateInjuredPerson(idx, 'body_side', e.target.value)} style={smSelect}>
                      <option value="">เลือก</option>
                      {BODY_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <SmLabel text="LTI?" />
                    <select value={(person.is_lti as string) || 'ไม่ใช่'} onChange={e => updateInjuredPerson(idx, 'is_lti', e.target.value)} style={smSelect}>
                      <option value="ใช่">ใช่</option>
                      <option value="ไม่ใช่">ไม่ใช่</option>
                    </select>
                  </div>
                  <div>
                    <SmLabel text="วันหยุดงาน (LWD)" />
                    <input type="number" value={(person.lost_work_days as number) || 0} onChange={e => updateInjuredPerson(idx, 'lost_work_days', parseInt(e.target.value) || 0)} style={smInput} min={0} />
                  </div>
                  <div>
                    <SmLabel text="วันที่เริ่มหยุด" />
                    <DateInput value={(person.leave_start_date as string) || ''} onChange={v => updateInjuredPerson(idx, 'leave_start_date', v)} inputStyle={smInput} />
                  </div>
                  <div>
                    <SmLabel text="วันที่กลับทำงาน" />
                    <DateInput value={(person.return_to_work_date as string) || ''} onChange={v => updateInjuredPerson(idx, 'return_to_work_date', v)} inputStyle={smInput} />
                  </div>
                  <div>
                    <SmLabel text="การรักษา" />
                    <input type="text" value={(person.treatment as string) || ''} onChange={e => updateInjuredPerson(idx, 'treatment', e.target.value)} style={smInput} placeholder="วิธีรักษา" />
                  </div>
                  <div>
                    <SmLabel text="โรงพยาบาล/คลินิก" />
                    <input type="text" value={(person.hospital as string) || ''} onChange={e => updateInjuredPerson(idx, 'hospital', e.target.value)} style={smInput} placeholder="ชื่อสถานพยาบาล" />
                  </div>
                  <div>
                    <SmLabel text="ค่ารักษา (บาท)" />
                    <input type="number" value={(person.medical_cost as number) || 0} onChange={e => updateInjuredPerson(idx, 'medical_cost', parseFloat(e.target.value) || 0)} style={smInput} min={0} />
                  </div>
                </div>
                <div className="mt-2">
                  <SmLabel text="รายละเอียดบาดเจ็บ" />
                  <textarea value={(person.injury_detail as string) || ''} onChange={e => updateInjuredPerson(idx, 'injury_detail', e.target.value)} style={{ ...smInput, minHeight: 40 }} placeholder="รายละเอียดเพิ่มเติม..." />
                </div>
              </div>
            ))}
            <button onClick={addInjuredPerson} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold hover:opacity-80" style={{ color: '#e11d48', border: '1px dashed rgba(244,63,94,0.4)' }}>
              <Plus size={14} /> เพิ่มผู้บาดเจ็บ
            </button>
          </div>
          )}

          {/* Section: Photos */}
          <div>
            <SH num="📷" label="PHOTOS / รูปภาพประกอบ" bg="rgba(59,130,246,0.1)" fg="#2563eb" />

            {/* Existing photos grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <img
                      src={photo.file_url}
                      alt={photo.file_name}
                      className="w-full h-24 object-cover cursor-pointer"
                      onClick={() => setPreviewPhoto(photo.file_url)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.9)' }}
                        title="ลบรูป"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{photo.file_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            {(formData.incident_no as string) ? (
              photos.length < MAX_PHOTOS ? (
                <div
                  className="relative rounded-lg p-4 text-center cursor-pointer transition-all hover:border-blue-400"
                  style={{
                    border: '2px dashed var(--border)',
                    background: 'var(--bg-secondary)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; handlePhotoUpload(e.dataTransfer.files); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoUpload(e.target.files)}
                  />
                  {uploadingPhoto ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span className="text-[12px]" style={{ color: 'var(--accent)' }}>กำลังอัปโหลด...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Camera size={20} style={{ color: 'var(--muted)' }} />
                        <Upload size={16} style={{ color: 'var(--muted)' }} />
                      </div>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        คลิกหรือลากรูปมาวางที่นี่
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        JPG, PNG, WebP (สูงสุด 10MB/รูป) — {photos.length}/{MAX_PHOTOS} รูป
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  <ImageIcon size={14} /> แนบรูปครบ {MAX_PHOTOS} รูปแล้ว
                </p>
              )
            ) : (
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <p className="text-[12px]" style={{ color: '#b45309' }}>
                  กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบรูปภาพได้
                </p>
              </div>
            )}

            {photoError && (
              <p className="text-[11px] mt-2" style={{ color: '#dc2626' }}>{photoError}</p>
            )}
          </div>

          {/* Section: Document attachments (PDF / Drive / OneDrive) */}
          <div>
            <SH num="📎" label="ATTACHMENTS / เอกสารแนบ (PDF หรือลิงก์ สูงสุด 2 รายการ)" bg="rgba(139,92,246,0.1)" fg="#7c3aed" />

            {/* Existing attachments list */}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <span className="text-[16px]">{att.kind === 'link' ? '🔗' : '📄'}</span>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-semibold truncate flex-1 hover:underline"
                      style={{ color: 'var(--accent)' }}
                      title={att.file_url}
                    >
                      {att.title || att.file_url}
                    </a>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>{att.kind === 'link' ? 'ลิงก์' : 'PDF'}</span>
                    <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded hover:opacity-70 shrink-0" title="ลบเอกสารแนบ">
                      <Trash2 size={13} style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(formData.incident_no as string) ? (
              attachments.length < MAX_ATTACHMENTS ? (
                <div className="flex flex-col gap-2.5">
                  {/* PDF upload */}
                  <div
                    className="rounded-lg p-3 text-center cursor-pointer transition-all hover:border-violet-400"
                    style={{ border: '2px dashed var(--border)', background: 'var(--bg-secondary)' }}
                    onClick={() => pdfInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#8b5cf6'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; handleAttachmentUpload(e.dataTransfer.files); }}
                  >
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={e => handleAttachmentUpload(e.target.files)}
                    />
                    {uploadingAtt ? (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="text-[12px]" style={{ color: 'var(--accent)' }}>กำลังบันทึก...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          📄 คลิกหรือลากไฟล์ PDF มาวางที่นี่
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          เฉพาะ PDF (สูงสุด 20MB/ไฟล์) — แนบแล้ว {attachments.length}/{MAX_ATTACHMENTS} รายการ
                        </p>
                      </>
                    )}
                  </div>
                  {/* Or paste a Drive/OneDrive link */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attLinkUrl}
                      onChange={e => setAttLinkUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttachmentLink(); } }}
                      placeholder="หรือวางลิงก์ Google Drive / OneDrive ที่นี่..."
                      className="flex-1 rounded-lg px-3 py-2 text-[12px] outline-none"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={handleAddAttachmentLink}
                      disabled={uploadingAtt || !attLinkUrl.trim()}
                      className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white shrink-0 disabled:opacity-50"
                      style={{ background: '#7c3aed' }}
                    >
                      เพิ่มลิงก์
                    </button>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    💡 อย่าลืมเปิดสิทธิ์การเข้าถึงลิงก์ (เช่น &ldquo;ทุกคนที่มีลิงก์ดูได้&rdquo;) เพื่อให้ผู้อื่นเปิดดูเอกสารได้
                  </p>
                </div>
              ) : (
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  📎 แนบเอกสารครบ {MAX_ATTACHMENTS} รายการแล้ว — ลบรายการเดิมก่อนหากต้องการเปลี่ยน
                </p>
              )
            ) : (
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <p className="text-[12px]" style={{ color: '#b45309' }}>
                  กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบเอกสารได้
                </p>
              </div>
            )}

            {attError && (
              <p className="text-[11px] mt-2" style={{ color: '#dc2626' }}>{attError}</p>
            )}
          </div>

          {/* Photo Preview Modal */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPreviewPhoto(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center z-10"
                  style={{ background: '#ef4444' }}
                >
                  <X size={16} className="text-white" />
                </button>
                <img
                  src={previewPhoto}
                  alt="Preview"
                  className="max-w-full max-h-[85vh] rounded-lg object-contain"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: saving ? 'var(--muted)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
            >
              {saving ? 'กำลังบันทึก...' : editingIncident ? 'อัปเดต' : 'บันทึก'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
