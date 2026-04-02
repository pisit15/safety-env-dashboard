'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
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

  // Initialize form when editing incident changes
  useEffect(() => {
    if (editingIncident) {
      setFormData({ ...editingIncident });
      // Fetch injured persons for this incident
      fetch(`/api/incidents/injured?incident_no=${encodeURIComponent(editingIncident.incident_no)}`)
        .then(r => r.json())
        .then(data => setInjuredPersons(data.persons || []))
        .catch(() => setInjuredPersons([]));
    } else {
      setFormData({
        company_id: companyId,
        incident_date: new Date().toISOString().split('T')[0],
        incident_type: '',
        work_related: 'ใช่',
        report_status: 'Draft',
      });
      setInjuredPersons([]);
    }
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

  /* Save */
  const handleSave = async () => {
    if (!formData.incident_type || !formData.incident_date) {
      alert('กรุณากรอกวันที่และประเภทอุบัติการณ์');
      return;
    }
    setSaving(true);
    try {
      const method = editingIncident ? 'PUT' : 'POST';
      const payload = { ...formData, injured_persons: injuredPersons.length > 0 ? injuredPersons : undefined };
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
              <p className="text-[12px] text-white/70 mt-0.5">{companyName}</p>
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
                <input type="date" value={(formData.incident_date as string) || ''} onChange={e => updateForm('incident_date', e.target.value)} style={inputStyle} />
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
                <input type="date" value={(formData.report_date as string) || ''} onChange={e => updateForm('report_date', e.target.value)} style={inputStyle} />
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

          {/* Section 6: Investigation */}
          <div>
            <SH num="6" label="INVESTIGATION" bg="rgba(234,179,8,0.1)" fg="#ca8a04" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label text="ระดับการสอบสวน" />
                <select value={(formData.investigation_level as string) || ''} onChange={e => updateForm('investigation_level', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {INV_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <Label text="วันที่เริ่มสอบสวน" />
                <input type="date" value={(formData.investigation_start_date as string) || ''} onChange={e => updateForm('investigation_start_date', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label text="หัวหน้าทีมสอบสวน" />
                <input type="text" value={(formData.investigation_lead as string) || ''} onChange={e => updateForm('investigation_lead', e.target.value)} style={inputStyle} placeholder="ชื่อหัวหน้าทีม" />
              </div>
              <div>
                <Label text="RCA Method" />
                <select value={(formData.rca_method as string) || ''} onChange={e => updateForm('rca_method', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {RCA_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label text="Root Cause Category" />
                <select value={(formData.root_cause_category as string) || ''} onChange={e => updateForm('root_cause_category', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {RC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label text="Barrier ที่ล้มเหลว" />
                <select value={(formData.barrier_failure as string) || ''} onChange={e => updateForm('barrier_failure', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {BARRIER_FAILS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label text="Immediate Cause" />
                <textarea value={(formData.immediate_cause as string) || ''} onChange={e => updateForm('immediate_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="สาเหตุโดยตรง" />
              </div>
              <div>
                <Label text="Contributing Cause" />
                <textarea value={(formData.contributing_cause as string) || ''} onChange={e => updateForm('contributing_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="สาเหตุร่วม" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label text="Root Cause Detail" />
                <textarea value={(formData.root_cause_detail as string) || ''} onChange={e => updateForm('root_cause_detail', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="รายละเอียดสาเหตุราก" />
              </div>
              <div>
                <Label text="Just Culture" />
                <select value={(formData.just_culture as string) || ''} onChange={e => updateForm('just_culture', e.target.value)} style={selectStyle}>
                  <option value="">เลือก</option>
                  {JUST_CULTURES.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
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
                  <input type="date" value={(formData.ca1_due_date as string) || ''} onChange={e => updateForm('ca1_due_date', e.target.value)} style={inputStyle} />
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
                  <input type="date" value={(formData.ca2_due_date as string) || ''} onChange={e => updateForm('ca2_due_date', e.target.value)} style={inputStyle} />
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
                <input type="date" value={(formData.report_closed_date as string) || ''} onChange={e => updateForm('report_closed_date', e.target.value)} style={inputStyle} />
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
                    <input type="date" value={(person.leave_start_date as string) || ''} onChange={e => updateInjuredPerson(idx, 'leave_start_date', e.target.value)} style={smInput} />
                  </div>
                  <div>
                    <SmLabel text="วันที่กลับทำงาน" />
                    <input type="date" value={(person.return_to_work_date as string) || ''} onChange={e => updateInjuredPerson(idx, 'return_to_work_date', e.target.value)} style={smInput} />
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
