'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DateInput from '@/components/DateInput';
import { BUSINESS_UNITS } from '@/lib/companies';
import { useAuth } from '@/components/AuthContext';
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
  readOnly?: boolean; // เคสถูก admin ล็อก — เปิดดูได้ทุกช่อง แต่แก้/บันทึกไม่ได้
}

/* ------------------------------------------------------------------ */
/*  Classification master item + searchable single-select             */
/* ------------------------------------------------------------------ */
export interface RefItem { id: number; name: string; grp: string; sort_order: number; is_active: boolean; bu_scope?: string }

// Searchable dropdown for long classification lists (่>20 รายการห้ามใช้ select ธรรมดา)
// — พิมพ์ค้นหาได้ทั้งชื่อและกลุ่ม เลือกจากรายการ หรือพิมพ์ค่าเองก็ได้
function RefSelect({ value, placeholder, options, onChange, style }: {
  value: string;
  placeholder?: string;
  options: { name: string; grp?: string }[];
  onChange: (v: string) => void;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<string | null>(null); // null = ยังไม่พิมพ์ค้นหา (แสดงทั้งหมด)
  const shown = value;
  const query = (q ?? '').trim().toLowerCase();
  const filtered = (query
    ? options.filter(o => o.name.toLowerCase().includes(query) || (o.grp || '').toLowerCase().includes(query))
    : options
  ).slice(0, 60);
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q ?? shown}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setQ(null); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQ(null); }, 150)}
        placeholder={placeholder || 'พิมพ์ค้นหา/เลือกจากรายการ...'}
        style={style}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2, background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 230, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          {filtered.map(o => (
            <button
              key={o.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(o.name); setQ(null); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, background: o.name === value ? 'var(--bg-secondary)' : 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <span style={{ fontWeight: 600 }}>{o.name}</span>
              {o.grp && <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 10 }}>{o.grp}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DOWNTIMES = ['ไม่กระทบ', '< 1 ชม.', '1–8 ชม.', '1–3 วัน', '> 3 วัน'];

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
export default function IncidentForm({ companyId, companyName, editingIncident, onClose, onSaved, readOnly = false }: IncidentFormProps) {
  const auth = useAuth();
  // Display name of the logged-in user — sent with saves so the audit log shows who did it
  const editorName = auth.isAdmin
    ? (auth.adminName || 'Admin')
    : (auth.companyAuth[companyId]?.displayName || '');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [injuredPersons, setInjuredPersons] = useState<Record<string, unknown>[]>([]);
  const [saving, setSaving] = useState(false);

  /* Classification masters (แกน 1-3) — โหลดจาก DB, fallback เป็นค่าคงที่เดิม */
  const [refEvents, setRefEvents] = useState<RefItem[]>([]);
  const [refSources, setRefSources] = useState<RefItem[]>([]);
  const [refNatures, setRefNatures] = useState<RefItem[]>([]);
  const [refEquipment, setRefEquipment] = useState<RefItem[]>([]);
  useEffect(() => {
    fetch('/api/incidents/refs')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { events?: RefItem[]; sources?: RefItem[]; damage_natures?: RefItem[]; equipment?: RefItem[] }) => {
        setRefEvents((d.events || []).filter(x => x.is_active));
        setRefSources((d.sources || []).filter(x => x.is_active));
        setRefNatures((d.damage_natures || []).filter(x => x.is_active));
        setRefEquipment((d.equipment || []).filter(x => x.is_active));
      })
      .catch(() => { /* fallback to constants below */ });
  }, []);
  // กรองอุปกรณ์ตาม BU ของบริษัท (bu_scope ว่าง = ทุกบริษัท / บริษัทไม่มี BU = เห็นทั้งหมด)
  const myBuKeys = BUSINESS_UNITS.filter(b => b.companyIds.includes(companyId)).map(b => b.key);
  const equipmentForBu = refEquipment.filter(x => {
    const scope = (x.bu_scope || '').split(',').map(s => s.trim()).filter(Boolean);
    if (scope.length === 0 || myBuKeys.length === 0) return true;
    return scope.some(k => myBuKeys.includes(k));
  });
  const eventOptions = refEvents.length > 0 ? refEvents.map(x => ({ name: x.name, grp: x.grp })) : CONTACT_TYPES.map(n => ({ name: n }));
  const sourceOptions = refSources.length > 0 ? refSources.map(x => ({ name: x.name, grp: x.grp })) : AGENCY_SOURCES.map(n => ({ name: n }));
  const natureOptions = refNatures.map(x => ({ name: x.name, grp: x.grp }));

  /* Photo attachment state — two groups: 'incident' (ขณะเกิดเหตุ) and 'after_fix' (หลังแก้ไข) */
  interface IncidentPhoto {
    id: string;
    incident_no: string;
    file_name: string;
    file_url: string;
    file_size: number;
    caption: string;
    photo_type?: string; // 'incident' | 'after_fix'
    created_at: string;
  }
  type PhotoType = 'incident' | 'after_fix';
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<PhotoType | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5; // ต่อประเภท

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
    // ไม่ auto-save ขณะข้อมูลอยู่ในสภาพต้องห้าม (แหล่งที่มา = ต้นเหตุอีกขั้น)
    const _src = ((data.agency_source as string) || '').trim();
    const _sec = ((data.secondary_source as string) || '').trim();
    if (_src && _sec && _src === _sec) return;

    const currentJson = JSON.stringify({ data, injured });
    if (currentJson === lastSavedJson.current) return; // No changes

    setDraftStatus('saving');
    try {
      const existingNo = (data.incident_no as string) || draftIncidentNo;
      const method = existingNo ? 'PUT' : 'POST';
      const payload = {
        ...data,
        // Keep the existing status — auto-save must never downgrade a finalized
        // report back to Draft (that hides it from the list view)
        report_status: (data.report_status as string) || 'Draft',
        performed_by: editorName,
        __is_admin: auth.isAdmin === true,
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
  }, [draftIncidentNo, editorName]);

  // Debounced auto-save: trigger 2 seconds after last change
  useEffect(() => {
    if (readOnly) return; // เคสล็อก — ห้าม auto-save
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

  /* True when the selected incident type implies lost time (หยุดงาน/เสียชีวิต) */
  const isLtiIncidentType = (t: unknown): boolean => {
    const s = String(t || '');
    return (s.includes('หยุดงาน') && !s.includes('ไม่หยุดงาน')) || s === 'เสียชีวิต (Fatality)';
  };

  const updateForm = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Auto-tick LTI on every injured person when the incident type is a lost-time type
    if (key === 'incident_type' && isLtiIncidentType(value)) {
      setInjuredPersons(prev => prev.map(p => ({ ...p, is_lti: 'ใช่' })));
    }
  };

  /* Injured persons helpers */
  const addInjuredPerson = () => {
    setInjuredPersons(prev => [...prev, {
      person_type: '', full_name: '', position: '', department: '', years_of_service: null,
      training_status: '', injury_severity: '', nature_of_injury: '', body_part: '', body_side: '',
      injury_detail: '', is_lti: isLtiIncidentType(formData.incident_type) ? 'ใช่' : 'ไม่ใช่',
      lost_work_days: 0, leave_start_date: '', return_to_work_date: '',
      treatment: '', hospital: '', medical_cost: 0,
    }]);
  };

  const updateInjuredPerson = (idx: number, key: string, value: unknown) => {
    setInjuredPersons(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  };

  const removeInjuredPerson = (idx: number) => {
    setInjuredPersons(prev => prev.filter((_, i) => i !== idx));
  };

  /* Photo upload handlers — per photo type */
  const handlePhotoUpload = async (files: FileList | null, photoType: PhotoType) => {
    if (!files || files.length === 0) return;

    // Must have incident_no (saved incident)
    const incidentNo = (formData.incident_no as string) || '';
    if (!incidentNo) {
      setPhotoError('กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบรูปได้');
      return;
    }

    const typePhotos = photos.filter(p => (p.photo_type || 'incident') === photoType);
    if (typePhotos.length >= MAX_PHOTOS) {
      setPhotoError(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อประเภท`);
      return;
    }

    setPhotoError('');
    setUploadingPhoto(photoType);

    const remainingSlots = MAX_PHOTOS - typePhotos.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('incident_no', incidentNo);
      fd.append('company_id', companyId);
      fd.append('photo_type', photoType);

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

    setUploadingPhoto(null);
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileInputAfterRef.current) fileInputAfterRef.current.value = '';
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
  /* ---- Validation: ตรวจความสอดคล้องของการจำแนก/ค่าเสียหายก่อนบันทึก ---- */
  const validateForm = (): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const src = ((formData.agency_source as string) || '').trim();
    const sec = ((formData.secondary_source as string) || '').trim();
    const type = (formData.incident_type as string) || '';
    const dc = Number(formData.direct_cost) || 0;
    const ic = Number(formData.indirect_cost) || 0;
    const nature = ((formData.damage_nature as string) || '').trim();
    const assets = ((formData.damaged_asset as string) || '').trim();
    const desc = `${(formData.description as string) || ''} ${(formData.property_damage_detail as string) || ''}`;

    if (src && sec && src === sec) {
      errors.push('"สิ่งที่ทำให้เกิดความเสียหาย" กับ "ต้นเหตุอีกขั้น" ต้องไม่ใช่ค่าเดียวกัน — ถ้าตัวการทำให้เสียหายโดยตรง ให้เว้นช่องต้นเหตุอีกขั้นว่าง');
    }
    if (type === 'Near Miss' && (dc > 0 || ic > 0)) {
      warnings.push('Near Miss ตามนิยามต้องไม่มีค่าเสียหาย — ตรวจสอบประเภทเหตุการณ์อีกครั้ง');
    }
    if (type === 'เหตุการณ์สูญเสียการผลิต (Production Loss)' && dc > 0) {
      warnings.push('Production Loss หมายถึงไม่มีอุปกรณ์เสียหาย — ถ้ามีของต้องซ่อม ควรเป็น "ทรัพย์สินเสียหาย"');
    }
    if (dc > 0 && ic > 0 && dc === ic) {
      warnings.push('ค่าเสียหายทางตรงและทางอ้อมเท่ากันพอดี มักเกิดจากกรอกซ้ำ — ทางตรง = ค่าซ่อม/เปลี่ยนอุปกรณ์ · ทางอ้อม = มูลค่าไฟที่ผลิตไม่ได้');
    }
    if (nature === 'ระบบทำงานผิดพลาด/หยุดชะงัก (ไม่เสียหายกายภาพ)' && (dc > 0 || assets)) {
      warnings.push('เลือกว่า "ไม่เสียหายกายภาพ" แต่มีค่าซ่อม/มีอุปกรณ์เสียหาย — ข้อมูลขัดกัน');
    }
    if (assets && !nature) {
      warnings.push('มีอุปกรณ์ที่เสียหาย — กรุณาระบุ "ลักษณะความเสียหาย" ด้วย');
    }
    if (/คาดว่า|คาดการณ์/.test(desc) && (/^สัตว์/.test(src) || /^สัตว์/.test(sec))) {
      warnings.push('รายงานระบุว่าเป็นการคาดการณ์ — ใส่หมวดสัตว์ได้เฉพาะเมื่อเห็นตัว พบซาก หรือมีรอยไหม้เท่านั้น ถ้าไม่ยืนยัน ให้ใช้ "ไม่สามารถระบุสาเหตุได้ (ตรวจแล้วไม่พบ)" หรือ "(เข้าตรวจสอบไม่ถึง)"');
    }
    return { errors, warnings };
  };
  const [validation, setValidation] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [warnAcknowledged, setWarnAcknowledged] = useState(false);
  // แก้ข้อมูลใดๆ → ต้องยืนยันคำเตือนใหม่
  useEffect(() => { setWarnAcknowledged(false); }, [formData]);

  const handleSave = async () => {
    if (readOnly) return; // เคสล็อก — ห้ามบันทึก
    const v = validateForm();
    setValidation(v);
    if (v.errors.length > 0) return; // error → บล็อกบันทึก
    if (v.warnings.length > 0 && !warnAcknowledged) { setWarnAcknowledged(true); return; } // ครั้งแรกแสดงคำเตือน กดซ้ำเพื่อยืนยัน
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
        // Finalize: Draft ยกระดับเป็น Under Review แต่ถ้าผู้ใช้เลือกสถานะสูงกว่าไว้ (Approved/Closed) ต้องคงตามนั้น
        report_status: (formData.report_status as string) && (formData.report_status as string) !== 'Draft'
          ? (formData.report_status as string)
          : 'Under Review',
        performed_by: editorName,
        __is_admin: auth.isAdmin === true,
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
        <div className="px-6 py-4" style={{ background: readOnly ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold text-white">
                {readOnly ? `🔒 ${editingIncident?.incident_no || ''} (ดูอย่างเดียว)` : editingIncident ? `แก้ไข ${editingIncident.incident_no}` : 'บันทึกอุบัติเหตุใหม่'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[12px] text-white/70">{companyName}</p>
                {readOnly && (
                  <span className="text-[10px] text-white/80">
                    เคสถูกล็อกโดย Admin{editingIncident?.locked_by ? ` (${editingIncident.locked_by})` : ''} — แก้ไขไม่ได้ กด "ขอปลดล็อก" ที่หน้ารายการหากต้องการแก้ไข
                  </span>
                )}
                {/* Draft auto-save indicator */}
                {!readOnly && draftStatus === 'saving' && (
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
        <fieldset disabled={readOnly} className="space-y-5" style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, ...(readOnly ? { opacity: 0.85 } : {}) }}>
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
              {/* เฟส 2: ผลกระทบเพิ่มเติม — เหตุเดียวกระทบหลายด้าน (ไม่เปลี่ยนประเภทหลัก/ไม่กระทบ TRIR) */}
              {selectedType && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--border)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>ผลกระทบเพิ่มเติม (ถ้ามี — เลือกได้หลายข้อ):</span>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {['บาดเจ็บ', 'ทรัพย์สินเสียหาย', 'สูญเสียการผลิต', 'สิ่งแวดล้อม'].map(o => {
                      const cur = ((formData.additional_outcomes as string) || '').split(',').filter(Boolean);
                      const checked = cur.includes(o);
                      return (
                        <label key={o} className="flex items-center gap-1.5 text-[12px] cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => {
                              const next = checked ? cur.filter(x => x !== o) : [...cur, o];
                              updateForm('additional_outcomes', next.join(','));
                            }} />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                </div>
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
              </>
              )}
              {/* การจำแนก 3 แกน — แสดงทุกประเภทอุบัติการณ์ (รวม ทรัพย์สินเสียหาย / Production Loss) */}
              <div>
                <Label text="เหตุการณ์" />
                <RefSelect value={(formData.contact_type as string) || ''} options={eventOptions} onChange={v => updateForm('contact_type', v)} style={inputStyle} placeholder="พิมพ์ค้นหา เช่น ตกจากที่สูง, ไฟไหม้..." />
              </div>
              <div>
                <Label text="สิ่งที่ทำให้เกิดความเสียหาย (ตัวที่ปะทะโดยตรง)" />
                <RefSelect value={(formData.agency_source as string) || ''} options={sourceOptions} onChange={v => updateForm('agency_source', v)} style={inputStyle} placeholder="พิมพ์ค้นหา เช่น ระบบไฟฟ้า, หม้อแปลง..." />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
                  ถามว่า <b>อะไรมาโดน</b> — ถ้าไม่มีตัวกลาง ให้ใส่ตัวการตรงนี้แล้วเว้นช่อง &ldquo;ต้นเหตุอีกขั้น&rdquo; ไว้ว่าง<br />
                  อุปกรณ์บนเสา/แนวสาย → โครงสร้าง : ระบบไฟฟ้า · อุปกรณ์ในสถานีไฟฟ้า (เบรกเกอร์ SWGR RMU หม้อแปลง) → หม้อแปลง/สถานีไฟฟ้า<br />
                  อาคาร Inverter / แผง PV → Inverter/แผงโซล่าร์ · ตัวกังหันลม → กังหันลม (WTG)
                </div>
              </div>
              <div>
                <Label text="ต้นเหตุอีกขั้น (ถ้ามี)" />
                <RefSelect value={(formData.secondary_source as string) || ''} options={sourceOptions} onChange={v => updateForm('secondary_source', v)} style={inputStyle} placeholder="เช่น งูทำให้ไฟลัดวงจร → สัตว์ : เลื้อยคลาน" />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
                  ใส่เฉพาะเมื่อมีตัวการอีกขั้นก่อนหน้า เช่น งูทำให้ไฟลัดวงจรจนฟิวส์ขาด → ใส่ สัตว์ : เลื้อยคลาน<br />
                  ถ้าตัวการทำให้เสียหายโดยตรงอยู่แล้ว ให้เว้นว่าง
                </div>
                {/* เตือนเมื่อค่าดูเหมือนใส่สลับช่อง (สิ่งมีชีวิตควรอยู่ฝั่งต้นทาง) */}
                {(() => {
                  const srcV = (formData.agency_source as string) || '';
                  const secV = (formData.secondary_source as string) || '';
                  const living = (s: string) => /^(สัตว์|บุคคล|พืช)/.test(s);
                  if (srcV && secV && living(srcV) && !living(secV)) {
                    return (
                      <div style={{ fontSize: 10.5, color: '#d97706', marginTop: 4, padding: '4px 8px', background: 'rgba(242,142,43,0.1)', borderRadius: 6 }}>
                        ⚠ ค่าอาจสลับช่องกัน — ปกติ สิ่งมีชีวิต (สัตว์/บุคคล/พืช) ควรอยู่ช่อง &ldquo;ต้นทาง&rdquo; และสิ่งที่เกิดเหตุ (เช่น ระบบไฟฟ้า) อยู่ช่อง &ldquo;แหล่งที่มา&rdquo;
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <div className="mt-3">
              <Label text="รายละเอียดเหตุการณ์" />
              <textarea
                value={(formData.description as string) || ''}
                onChange={e => {
                  updateForm('description', e.target.value);
                  // Auto-grow to fit content
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.max(e.target.scrollHeight, 160)}px`;
                }}
                ref={el => {
                  if (el) { el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, 160)}px`; }
                }}
                style={{ ...inputStyle, minHeight: 160, fontSize: 14, lineHeight: 1.7, resize: 'vertical', overflow: 'hidden' }}
                placeholder="อธิบายรายละเอียดเหตุการณ์..."
              />
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

          {/* Section 4: Property Damage — ซ่อนสำหรับ Fatality / หยุดงาน > 3 วัน (ทุกเคสกลุ่มนี้เว้นว่างเสมอ) */}
          {!['เสียชีวิต (Fatality)', 'บาดเจ็บ - หยุดงาน > 3 วัน'].includes(selectedType) && (
          <div>
            <SH num="4" label="PROPERTY DAMAGE" bg="rgba(168,85,247,0.1)" fg="#7c3aed" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text="ลักษณะความเสียหาย" />
                <RefSelect value={(formData.damage_nature as string) || ''} options={natureOptions} onChange={v => updateForm('damage_nature', v)} style={inputStyle} placeholder="พิมพ์ค้นหา เช่น ไหม้, แตกหัก, บุบ..." />
              </div>
              <div className="col-span-2">
                <Label text="อุปกรณ์ที่เสียหาย (ของที่พังจริง)" />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>ถามว่า <b>อะไรโดน</b> — ถ้าไม่มีของพัง ให้เว้นว่าง · เลือกได้หลายชิ้น</div>
                {/* chips ของที่เลือกแล้ว */}
                {(() => {
                  const sel = ((formData.damaged_asset as string) || '').split(',').map(s => s.trim()).filter(Boolean);
                  return (
                    <>
                      {sel.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          {sel.map(eq => (
                            <span key={eq} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: 'rgba(78,121,167,0.12)', color: '#4E79A7' }}>
                              {eq}
                              <button type="button" onClick={() => updateForm('damaged_asset', sel.filter(x => x !== eq).join(', '))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4E79A7', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <RefSelect value="" options={equipmentForBu.filter(x => !sel.includes(x.name)).map(x => ({ name: x.name, grp: x.grp }))}
                        onChange={v => { if (v && equipmentForBu.some(x => x.name === v) && !sel.includes(v)) updateForm('damaged_asset', [...sel, v].join(', ')); }}
                        style={inputStyle} placeholder="พิมพ์ค้นหาแล้วเลือกเพิ่ม เช่น Termination kit, สาย TAC..." />
                    </>
                  );
                })()}
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
          )}

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
                <Label text="ระยะเวลาหยุดการผลิต" />
                <select value={(formData.production_downtime as string) || ''} onChange={e => updateForm('production_downtime', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {DOWNTIMES.map(d => <option key={d} value={d}>{d}</option>)}
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
            {(() => {
              const dmgCost = (Number(formData.direct_cost) || 0) + (Number(formData.indirect_cost) || 0);
              if (dmgCost <= 0) return null;
              const band = dmgCost < 10000 ? { n: 1, t: 'น้อยกว่า 10,000 บาท', c: '#59A14F' }
                : dmgCost < 100000 ? { n: 2, t: '10,000 – 100,000 บาท', c: '#F28E2B' }
                : dmgCost < 1000000 ? { n: 3, t: '100,000 – 1,000,000 บาท', c: '#E15759' }
                : { n: 4, t: 'มากกว่า 1,000,000 บาท', c: '#B22222' };
              return (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: `1px solid ${band.c}`, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.c }} />
                  ระดับความรุนแรงมูลค่าความเสียหาย: <b style={{ color: band.c }}>ระดับ {band.n}</b> ({band.t}) — คำนวณอัตโนมัติจากค่าเสียหายรวม {dmgCost.toLocaleString()} บาท
                </div>
              );
            })()}
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

          {/* Section: Photos — two groups: incident vs after fix */}
          <div>
            <SH num="📷" label="PHOTOS / รูปภาพประกอบ" bg="rgba(59,130,246,0.1)" fg="#2563eb" />

            {!(formData.incident_no as string) ? (
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <p className="text-[12px]" style={{ color: '#b45309' }}>
                  กรุณาบันทึกอุบัติเหตุก่อน จึงจะแนบรูปภาพได้
                </p>
              </div>
            ) : (
              ([
                { type: 'incident' as PhotoType, title: '🔴 รูปภาพการเกิดอุบัติเหตุ', hint: 'สภาพจุดเกิดเหตุ ความเสียหาย ขณะ/หลังเกิดเหตุทันที', ref: fileInputRef, accent: '#dc2626' },
                { type: 'after_fix' as PhotoType, title: '🟢 รูปภาพหลังแก้ไข', hint: 'สภาพหลังดำเนินการแก้ไข/ปรับปรุงตาม Corrective Action', ref: fileInputAfterRef, accent: '#16a34a' },
              ]).map(sec => {
                const secPhotos = photos.filter(p => (p.photo_type || 'incident') === sec.type);
                return (
                  <div key={sec.type} className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{sec.title}</span>
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{sec.hint} — {secPhotos.length}/{MAX_PHOTOS} รูป</span>
                    </div>

                    {secPhotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-2">
                        {secPhotos.map((photo) => (
                          <div key={photo.id} className="relative group rounded-lg overflow-hidden" style={{ border: `1px solid ${sec.accent}44`, background: 'var(--bg-secondary)' }}>
                            <img
                              src={photo.file_url}
                              alt={photo.file_name}
                              className="w-full h-24 object-cover cursor-pointer"
                              onClick={() => setPreviewPhoto(photo.file_url)}
                            />
                            {/* Hover overlay — clicking it opens the preview (it covers the img, so it must forward the click) */}
                            <div
                              className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                              style={{ height: '6rem', top: 0 }}
                              onClick={() => setPreviewPhoto(photo.file_url)}
                              title="คลิกเพื่อขยายดูรูป"
                            >
                              <button
                                onClick={e => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
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

                    {secPhotos.length < MAX_PHOTOS ? (
                      <div
                        className="relative rounded-lg p-3 text-center cursor-pointer transition-all"
                        style={{ border: '2px dashed var(--border)', background: 'var(--bg-secondary)' }}
                        onClick={() => sec.ref.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = sec.accent; }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; handlePhotoUpload(e.dataTransfer.files, sec.type); }}
                      >
                        <input
                          ref={sec.ref}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => handlePhotoUpload(e.target.files, sec.type)}
                        />
                        {uploadingPhoto === sec.type ? (
                          <div className="flex items-center justify-center gap-2 py-1">
                            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            <span className="text-[12px]" style={{ color: 'var(--accent)' }}>กำลังอัปโหลด...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Camera size={16} style={{ color: 'var(--muted)' }} />
                            <Upload size={13} style={{ color: 'var(--muted)' }} />
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>คลิกหรือลากรูปมาวางที่นี่</span>
                            <span className="text-[9px]" style={{ color: 'var(--muted)' }}>JPG, PNG, WebP ≤10MB/รูป</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                        <ImageIcon size={14} /> แนบรูปครบ {MAX_PHOTOS} รูปแล้ว
                      </p>
                    )}
                  </div>
                );
              })
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

          </fieldset>
          {/* Validation results */}
          {validation && validation.errors.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-[12px] font-bold mb-1" style={{ color: '#dc2626' }}>บันทึกไม่ได้ — กรุณาแก้ไขก่อน:</p>
              {validation.errors.map((e, i) => (
                <p key={i} className="text-[11.5px]" style={{ color: '#b91c1c', lineHeight: 1.6 }}>• {e}</p>
              ))}
            </div>
          )}
          {validation && validation.errors.length === 0 && validation.warnings.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)' }}>
              <p className="text-[12px] font-bold mb-1" style={{ color: '#b45309' }}>คำเตือน — ตรวจสอบก่อนบันทึก:</p>
              {validation.warnings.map((w, i) => (
                <p key={i} className="text-[11.5px]" style={{ color: '#92400e', lineHeight: 1.6 }}>• {w}</p>
              ))}
              {warnAcknowledged && (
                <p className="text-[11.5px] font-semibold mt-1.5" style={{ color: '#b45309' }}>
                  ถ้าตรวจสอบแล้วข้อมูลถูกต้อง กด &ldquo;{editingIncident ? 'อัปเดต' : 'บันทึก'}&rdquo; อีกครั้งเพื่อยืนยัน
                </p>
              )}
            </div>
          )}
          {/* Actions — อยู่นอก fieldset เพื่อให้ปุ่มปิดกดได้เสมอ */}
          <div className="flex gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: saving ? 'var(--muted)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                {saving ? 'กำลังบันทึก...' : editingIncident ? 'อัปเดต' : 'บันทึก'}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={false}
              className="px-6 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)', pointerEvents: 'auto' }}
            >
              {readOnly ? 'ปิด' : 'ยกเลิก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
