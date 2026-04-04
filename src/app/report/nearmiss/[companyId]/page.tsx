'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { COMPANIES } from '@/lib/companies';
import { CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

// ── Risk matrix helpers
const riskScore = (p: number, s: number) => p * s;
const riskLevel = (score: number) => {
  if (score >= 15) return { label: 'HIGH', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', emoji: '🔴' };
  if (score >= 9)  return { label: 'MED-HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)', emoji: '🟠' };
  if (score >= 4)  return { label: 'MEDIUM',   color: '#eab308', bg: 'rgba(234,179,8,0.1)',  emoji: '🟡' };
  return               { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  emoji: '🟢' };
};

const TOTAL_STEPS = 5;

const PROB_LABELS = ['', '1 – แทบไม่เกิด', '2 – ไม่น่าจะเกิด', '3 – อาจเกิดได้', '4 – น่าจะเกิด', '5 – เกิดแน่นอน'];
const SEV_LABELS  = ['', '1 – เล็กน้อย', '2 – พอประมาณ', '3 – ปานกลาง', '4 – รุนแรง', '5 – รุนแรงมาก'];

export default function NearMissReportPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const company = COMPANIES.find(c => c.id === companyId);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportNo, setReportNo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const startTime = useRef(Date.now());

  // Form state
  const [form, setForm] = useState({
    reporter_name: '',
    reporter_dept: '',
    incident_date: new Date().toISOString().slice(0, 10),
    location: '',
    incident_description: '',
    saving_factor: '',
    probability: 0,
    severity: 0,
    immediate_action: '',
    responsible_person: '',
    due_date: '',
    _hp: '',  // honeypot — must stay empty
  });

  const set = (key: string, val: string | number) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const score = form.probability && form.severity ? riskScore(form.probability, form.severity) : 0;
  const risk = score ? riskLevel(score) : null;

  // Step validation
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.reporter_name.trim()) errs.reporter_name = 'กรุณากรอกชื่อ-นามสกุล';
      if (!form.incident_date) errs.incident_date = 'กรุณาระบุวันที่เกิดเหตุ';
      if (!form.location.trim()) errs.location = 'กรุณาระบุสถานที่';
    }
    if (s === 2) {
      if (!form.incident_description.trim()) errs.incident_description = 'กรุณาอธิบายเหตุการณ์';
    }
    if (s === 4) {
      if (!form.probability) errs.probability = 'กรุณาเลือกโอกาสเกิดซ้ำ';
      if (!form.severity) errs.severity = 'กรุณาเลือกความรุนแรง';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/nearmiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          companyId,
          _duration_ms: Date.now() - startTime.current,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReportNo(json.report_no || '');
        setSubmitted(true);
      } else {
        setErrors({ _submit: json.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
      }
    } catch {
      setErrors({ _submit: 'เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อและลองใหม่' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!company) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>ไม่พบข้อมูลบริษัท</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>ส่งรายงานสำเร็จ</h2>
          {reportNo && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
              หมายเลขรายงาน: <span style={{ fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{reportNo}</span>
            </p>
          )}
          <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 300, margin: '0 auto 32px' }}>
            ขอบคุณที่รายงาน Near Miss เจ้าหน้าที่ความปลอดภัยจะดำเนินการตรวจสอบต่อไป
          </p>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setForm({ reporter_name: '', reporter_dept: '', incident_date: new Date().toISOString().slice(0, 10), location: '', incident_description: '', saving_factor: '', probability: 0, severity: 0, immediate_action: '', responsible_person: '', due_date: '', _hp: '' }); startTime.current = Date.now(); }}
            style={primaryBtnStyle}
          >
            รายงานอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>รายงาน Near Miss</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{company.name}</p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {['ผู้รายงาน', 'เหตุการณ์', 'ปัจจัยที่ช่วย', 'ความเสี่ยง', 'การดำเนินการ'].map((label, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#007aff' : '#e5e7eb',
                color: step >= i + 1 ? '#fff' : '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, marginBottom: 4,
                transition: 'background 0.3s',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, color: step === i + 1 ? '#007aff' : '#9ca3af', fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%`, background: '#007aff', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Card */}
      <div style={cardStyle}>
        {/* ── Step 1: Reporter info ── */}
        {step === 1 && (
          <div>
            <StepHeader icon="👤" title="ข้อมูลผู้รายงาน" sub="Section A" />
            <Field label="ชื่อ-นามสกุล *" error={errors.reporter_name}>
              <input
                style={inputStyle(!!errors.reporter_name)}
                placeholder="กรอกชื่อ-นามสกุล"
                value={form.reporter_name}
                onChange={e => set('reporter_name', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="แผนก / หน่วยงาน">
              <input
                style={inputStyle(false)}
                placeholder="เช่น แผนกผลิต, แผนกซ่อมบำรุง"
                value={form.reporter_dept}
                onChange={e => set('reporter_dept', e.target.value)}
              />
            </Field>
            <Field label="วันที่เกิดเหตุ *" error={errors.incident_date}>
              <input
                type="date"
                style={inputStyle(!!errors.incident_date)}
                value={form.incident_date}
                onChange={e => set('incident_date', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="สถานที่ / บริเวณ *" error={errors.location}>
              <input
                style={inputStyle(!!errors.location)}
                placeholder="เช่น โรงงาน A, บริเวณโกดัง 2"
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </Field>
            {/* Honeypot — hidden from real users */}
            <input
              type="text"
              name="_website"
              value={form._hp}
              onChange={e => set('_hp', e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
        )}

        {/* ── Step 2: What happened ── */}
        {step === 2 && (
          <div>
            <StepHeader icon="📋" title="เกิดอะไรขึ้น" sub="Section B" />
            <Field label="อธิบายเหตุการณ์ที่เกิดขึ้น *" error={errors.incident_description}>
              <textarea
                style={{ ...inputStyle(!!errors.incident_description), minHeight: 140, resize: 'vertical' }}
                placeholder="อธิบายสิ่งที่เกิดขึ้น เกิดขึ้นได้อย่างไร ใครเกี่ยวข้อง..."
                value={form.incident_description}
                onChange={e => set('incident_description', e.target.value)}
                autoFocus
              />
            </Field>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,122,255,0.06)', borderRadius: 10, borderLeft: '3px solid #007aff' }}>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                💡 <strong>เหตุการณ์เกือบอุบัติเหตุ (Near Miss)</strong> คือเหตุการณ์ที่เกิดขึ้นแต่โชคดีที่ไม่มีการบาดเจ็บหรือความเสียหาย การรายงานช่วยป้องกันอุบัติเหตุในอนาคต
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Saving factor ── */}
        {step === 3 && (
          <div>
            <StepHeader icon="🛡️" title="ปัจจัยที่ช่วย (Saving Factor)" sub="Section C" />
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              อะไรที่ทำให้เหตุการณ์นี้ไม่กลายเป็นอุบัติเหตุจริง? เช่น อุปกรณ์ป้องกัน, การตอบสนองที่รวดเร็ว, สภาพแวดล้อม ฯลฯ
            </p>
            <Field label="ปัจจัยที่ช่วย (ไม่บังคับ)">
              <textarea
                style={{ ...inputStyle(false), minHeight: 120, resize: 'vertical' }}
                placeholder="เช่น มีราวกันตก, สวมอุปกรณ์ PPE ครบ, เพื่อนร่วมงานช่วยทัน..."
                value={form.saving_factor}
                onChange={e => set('saving_factor', e.target.value)}
                autoFocus
              />
            </Field>
          </div>
        )}

        {/* ── Step 4: Risk assessment ── */}
        {step === 4 && (
          <div>
            <StepHeader icon="📊" title="ประเมินความเสี่ยง" sub="Section D" />
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              ประเมินว่าถ้าเกิดเหตุการณ์เดิมอีกครั้ง จะมีโอกาสและความรุนแรงมากน้อยเพียงใด
            </p>
            {/* Probability */}
            <Field label="โอกาสเกิดซ้ำ (P) *" error={errors.probability}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <label key={v} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${form.probability === v ? '#007aff' : '#e5e7eb'}`,
                    background: form.probability === v ? 'rgba(0,122,255,0.06)' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="prob" value={v} checked={form.probability === v} onChange={() => set('probability', v)} style={{ accentColor: '#007aff' }} />
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: form.probability === v ? 600 : 400 }}>{PROB_LABELS[v]}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div style={{ marginTop: 20 }} />

            {/* Severity */}
            <Field label="ความรุนแรง (S) *" error={errors.severity}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <label key={v} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${form.severity === v ? '#007aff' : '#e5e7eb'}`,
                    background: form.severity === v ? 'rgba(0,122,255,0.06)' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="sev" value={v} checked={form.severity === v} onChange={() => set('severity', v)} style={{ accentColor: '#007aff' }} />
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: form.severity === v ? 600 : 400 }}>{SEV_LABELS[v]}</span>
                  </label>
                ))}
              </div>
            </Field>

            {/* Risk result */}
            {score > 0 && risk && (
              <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 14, background: risk.bg, border: `2px solid ${risk.color}`, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>ระดับความเสี่ยง (P × S = {form.probability} × {form.severity} = {score})</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: risk.color }}>{risk.emoji} {risk.label}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Actions & Submit ── */}
        {step === 5 && (
          <div>
            <StepHeader icon="⚡" title="การดำเนินการ" sub="Section E" />
            <Field label="สิ่งที่ทำไปแล้ว / ข้อเสนอแนะ">
              <textarea
                style={{ ...inputStyle(false), minHeight: 100, resize: 'vertical' }}
                placeholder="สิ่งที่ทำไปแล้วเพื่อป้องกัน หรือข้อเสนอแนะเพื่อป้องกันในอนาคต..."
                value={form.immediate_action}
                onChange={e => set('immediate_action', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="ผู้รับผิดชอบดำเนินการ">
              <input
                style={inputStyle(false)}
                placeholder="ชื่อผู้รับผิดชอบ"
                value={form.responsible_person}
                onChange={e => set('responsible_person', e.target.value)}
              />
            </Field>
            <Field label="กำหนดแล้วเสร็จ">
              <input
                type="date"
                style={inputStyle(false)}
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>

            {/* Summary review */}
            <div style={{ marginTop: 20, padding: 16, background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>สรุปรายงาน</p>
              <SummaryRow label="ผู้รายงาน" value={form.reporter_name} />
              {form.reporter_dept && <SummaryRow label="แผนก" value={form.reporter_dept} />}
              <SummaryRow label="วันที่เกิดเหตุ" value={form.incident_date} />
              <SummaryRow label="สถานที่" value={form.location} />
              {score > 0 && risk && (
                <SummaryRow label="ระดับความเสี่ยง" value={`${risk.emoji} ${risk.label} (${score})`} />
              )}
            </div>

            {errors._submit && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{errors._submit}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          {step > 1 && (
            <button onClick={prevStep} style={secondaryBtnStyle}>
              <ChevronLeft size={16} /> ย้อนกลับ
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button onClick={nextStep} style={{ ...primaryBtnStyle, flex: 1 }}>
              ถัดไป <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtnStyle, flex: 1, background: submitting ? '#93c5fd' : '#007aff' }}>
              {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> กำลังส่ง...</> : '✓ ส่งรายงาน'}
            </button>
          )}
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 20 }}>
        รายงานที่ส่งจะถูกเก็บเป็นความลับและนำไปปรับปรุงความปลอดภัย
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Sub-components ──

function StepHeader({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{sub}</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4, margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

// ── Styles ──
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #f0f9ff 0%, #f8fafc 60%, #fef3c7 100%)',
  padding: '32px 16px 48px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  padding: '28px 24px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
  maxWidth: 480,
  margin: '0 auto',
};

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: `1.5px solid ${hasError ? '#ef4444' : '#e5e7eb'}`,
  fontSize: 14,
  color: '#111827',
  background: '#f9fafb',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
});

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '13px 24px', borderRadius: 12, border: 'none',
  background: '#007aff', color: '#fff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer', flex: 1,
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '13px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
