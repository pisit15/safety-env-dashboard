'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { COMPANIES } from '@/lib/companies';

const PALETTE = {
  primary: '#2563eb',
  positive: '#16a34a',
  warning: '#ca8a04',
  critical: '#dc2626',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  textSecondary: '#64748b',
};

type OpenSeatData = {
  id: string;
  share_token: string;
  total_seats: number;
  is_active: boolean;
  audience: string;
  company_id: string;
  registered_count: number;
  remaining_seats: number;
  training_sessions: {
    id: string;
    status: string;
    scheduled_date_start: string;
    scheduled_date_end: string;
    instructor_name: string;
    training_location: string;
    training_method: string;
    training_plans: {
      id: string;
      course_name: string;
      category: string;
      in_house_external: string;
      hours_per_course: number;
      planned_participants: number;
      company_id: string;
    };
  };
};

type Participant = {
  company_name: string;
  company_id: string;
  first_name: string;
  last_name: string;
  emp_code: string;
  position: string;
  department: string;
  phone: string;
  registered_by: string;
};

const emptyParticipant = (): Participant => ({
  company_name: '', company_id: '', first_name: '', last_name: '',
  emp_code: '', position: '', department: '', phone: '', registered_by: '',
});

const METHOD_LABELS: Record<string, string> = {
  lecture: 'บรรยาย', group_activity: 'กิจกรรมกลุ่ม', workshop: 'ฝึกปฏิบัติ',
  elearning: 'E-Learning', onsite: 'On-site Training', mixed: 'ผสมผสาน',
};

function formatDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function JoinTrainingPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<OpenSeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([emptyParticipant()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/training/open-seats?token=${token}`);
      if (!res.ok) { setError('ไม่พบลิงก์นี้หรือลิงก์หมดอายุแล้ว'); return; }
      const json = await res.json();
      setData(json);
    } catch { setError('เกิดข้อผิดพลาด'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateParticipant = (idx: number, field: keyof Participant, value: string) => {
    setParticipants(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-fill company name when company_id is selected
      if (field === 'company_id') {
        const c = COMPANIES.find(c => c.id === value);
        if (c) next[idx].company_name = c.name;
      }
      return next;
    });
  };

  const addRow = () => {
    // Copy company from last row
    const last = participants[participants.length - 1];
    const newP = emptyParticipant();
    newP.company_id = last.company_id;
    newP.company_name = last.company_name;
    newP.registered_by = last.registered_by;
    setParticipants(prev => [...prev, newP]);
  };

  const removeRow = (idx: number) => {
    if (participants.length <= 1) return;
    setParticipants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const isInternal = data?.audience === 'internal';
    // Validate — internal only needs name; external needs company too
    const valid = participants.every(p => p.first_name && p.last_name && (isInternal || p.company_name));
    if (!valid) { setSubmitMsg(isInternal ? 'กรุณากรอก ชื่อ และนามสกุล ให้ครบทุกคน' : 'กรุณากรอก ชื่อ นามสกุล และบริษัท ให้ครบทุกคน'); return; }

    setSubmitting(true);
    setSubmitMsg('');
    try {
      // For internal: auto-fill company from host
      const hostName = COMPANIES.find(c => c.id === data?.company_id)?.name || data?.company_id || '';
      const finalParticipants = isInternal
        ? participants.map(p => ({ ...p, company_name: hostName, company_id: data?.company_id || '' }))
        : participants;
      const res = await fetch('/api/training/external-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, participants: finalParticipants }),
      });
      const json = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setSubmitMsg(json.message);
        fetchData(); // Refresh counts
      } else {
        setSubmitMsg(json.error || 'เกิดข้อผิดพลาด');
      }
    } catch { setSubmitMsg('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setSubmitting(false);
  };

  // ── Loading / Error states ──
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PALETTE.bg }}>
      <div style={{ textAlign: 'center', color: PALETTE.textSecondary }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div>กำลังโหลด...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PALETTE.bg }}>
      <div style={{ textAlign: 'center', background: PALETTE.card, padding: 40, borderRadius: 16, border: `1px solid ${PALETTE.border}`, maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: PALETTE.text }}>ลิงก์ไม่ถูกต้อง</h2>
        <p style={{ color: PALETTE.textSecondary, fontSize: 14 }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const session = data.training_sessions;
  const plan = session?.training_plans;
  const hostCompany = COMPANIES.find(c => c.id === data.company_id);
  const isInternal = data.audience === 'internal';
  const isClosed = !data.is_active || session?.status === 'completed' || session?.status === 'cancelled';
  const isFull = data.remaining_seats <= 0;

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: PALETTE.textSecondary, marginBottom: 4, display: 'block' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${PALETTE.border}`,
    fontSize: 13, color: PALETTE.text, background: PALETTE.card, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: PALETTE.primary, color: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 28px' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
            EA SHE Training — {isInternal ? 'สำรวจผู้เข้าอบรมภายในบริษัท' : 'ลงทะเบียนอบรมข้ามบริษัท'}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px', lineHeight: 1.4 }}>
            {plan?.course_name || 'หลักสูตรอบรม'}
          </h1>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            จัดโดย <strong>{hostCompany?.fullName || hostCompany?.name || data.company_id}</strong>
          </div>
        </div>

        {/* Course Info */}
        <div style={{ background: PALETTE.card, padding: '20px 28px', border: `1px solid ${PALETTE.border}`, borderTop: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
            <div>
              <span style={{ color: PALETTE.textSecondary }}>📅 วันที่:</span>{' '}
              <strong>{formatDate(session?.scheduled_date_start)}</strong>
              {session?.scheduled_date_end && session.scheduled_date_end !== session.scheduled_date_start && (
                <> — <strong>{formatDate(session.scheduled_date_end)}</strong></>
              )}
            </div>
            <div>
              <span style={{ color: PALETTE.textSecondary }}>⏱ ชั่วโมง:</span>{' '}
              <strong>{plan?.hours_per_course || '—'} ชม.</strong>
            </div>
            {session?.training_location && (
              <div>
                <span style={{ color: PALETTE.textSecondary }}>📍 สถานที่:</span>{' '}
                <strong>{session.training_location}</strong>
              </div>
            )}
            {session?.training_method && (
              <div>
                <span style={{ color: PALETTE.textSecondary }}>📖 วิธีการสอน:</span>{' '}
                <strong>{METHOD_LABELS[session.training_method] || session.training_method}</strong>
              </div>
            )}
            {session?.instructor_name && (
              <div>
                <span style={{ color: PALETTE.textSecondary }}>👨‍🏫 วิทยากร:</span>{' '}
                <strong>{session.instructor_name}</strong>
              </div>
            )}
            {plan?.category && (
              <div>
                <span style={{ color: PALETTE.textSecondary }}>📋 ประเภท:</span>{' '}
                <strong>{plan.category}</strong>
              </div>
            )}
          </div>

          {/* Seat Status */}
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 10,
            background: isClosed ? '#fef2f2' : isFull ? '#fefce8' : '#f0fdf4',
            border: `1px solid ${isClosed ? '#fecaca' : isFull ? '#fef08a' : '#bbf7d0'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: isClosed ? PALETTE.critical : isFull ? PALETTE.warning : PALETTE.positive }}>
                {isClosed ? '🔒 การลงทะเบียนปิดแล้ว' : isFull ? '⚠️ ที่นั่งเต็มแล้ว' : '✅ เปิดรับลงทะเบียน'}
              </div>
              {!isClosed && (
                <div style={{ fontSize: 12, color: PALETTE.textSecondary, marginTop: 2 }}>
                  ลงทะเบียนแล้ว <strong>{data.registered_count}</strong> / <strong>{data.total_seats}</strong> ที่นั่ง
                </div>
              )}
            </div>
            {!isClosed && !isFull && (
              <div style={{
                fontSize: 22, fontWeight: 800, color: PALETTE.positive,
                background: '#dcfce7', padding: '6px 16px', borderRadius: 8,
              }}>
                เหลือ {data.remaining_seats} ที่
              </div>
            )}
          </div>
        </div>

        {/* Registration Form */}
        {!isClosed && !isFull && !submitted && (
          <div style={{ background: PALETTE.card, padding: '24px 28px', border: `1px solid ${PALETTE.border}`, borderTop: 'none', borderRadius: '0 0 16px 16px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: PALETTE.text }}>
              📝 ลงทะเบียนผู้เข้าร่วมอบรม
            </h2>

            {participants.map((p, idx) => (
              <div key={idx} style={{
                background: '#f8fafc', border: `1px solid ${PALETTE.border}`, borderRadius: 10,
                padding: 16, marginBottom: 12, position: 'relative',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.primary }}>
                    👤 คนที่ {idx + 1}
                  </div>
                  {participants.length > 1 && (
                    <button onClick={() => removeRow(idx)} style={{
                      fontSize: 11, color: PALETTE.critical, background: 'transparent',
                      border: 'none', cursor: 'pointer', padding: '2px 8px',
                    }}>✕ ลบ</button>
                  )}
                </div>

                {/* Company selector — only for external */}
                {!isInternal && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>บริษัท *</label>
                    <select
                      value={p.company_id}
                      onChange={e => updateParticipant(idx, 'company_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- เลือกบริษัท --</option>
                      {COMPANIES.filter(c => c.id !== data.company_id).map(c => (
                        <option key={c.id} value={c.id}>{c.name} — {c.fullName}</option>
                      ))}
                      <option value="__other">อื่นๆ (พิมพ์เอง)</option>
                    </select>
                    {p.company_id === '__other' && (
                      <input
                        value={p.company_name} placeholder="ชื่อบริษัท"
                        onChange={e => updateParticipant(idx, 'company_name', e.target.value)}
                        style={{ ...inputStyle, marginTop: 6 }}
                      />
                    )}
                  </div>
                )}

                {/* Name row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>ชื่อ *</label>
                    <input value={p.first_name} onChange={e => updateParticipant(idx, 'first_name', e.target.value)} placeholder="ชื่อ" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>นามสกุล *</label>
                    <input value={p.last_name} onChange={e => updateParticipant(idx, 'last_name', e.target.value)} placeholder="นามสกุล" style={inputStyle} />
                  </div>
                </div>

                {/* Internal: แผนก + เบอร์โทร only */}
                {isInternal ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>แผนก</label>
                      <input value={p.department} onChange={e => updateParticipant(idx, 'department', e.target.value)} placeholder="แผนก" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>เบอร์โทร</label>
                      <input value={p.phone} onChange={e => updateParticipant(idx, 'phone', e.target.value)} placeholder="0xx-xxx-xxxx" style={inputStyle} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>รหัสพนักงาน</label>
                        <input value={p.emp_code} onChange={e => updateParticipant(idx, 'emp_code', e.target.value)} placeholder="รหัส" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ตำแหน่ง</label>
                        <input value={p.position} onChange={e => updateParticipant(idx, 'position', e.target.value)} placeholder="ตำแหน่ง" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>แผนก</label>
                        <input value={p.department} onChange={e => updateParticipant(idx, 'department', e.target.value)} placeholder="แผนก" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>เบอร์โทร</label>
                        <input value={p.phone} onChange={e => updateParticipant(idx, 'phone', e.target.value)} placeholder="0xx-xxx-xxxx" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ผู้ลงทะเบียน</label>
                        <input value={p.registered_by} onChange={e => updateParticipant(idx, 'registered_by', e.target.value)} placeholder="ชื่อผู้กรอก" style={inputStyle} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add more / Submit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <button onClick={addRow} disabled={participants.length >= data.remaining_seats}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${PALETTE.border}`,
                  background: PALETTE.card, color: PALETTE.primary, fontSize: 13, fontWeight: 600,
                  cursor: participants.length >= data.remaining_seats ? 'not-allowed' : 'pointer',
                  opacity: participants.length >= data.remaining_seats ? 0.5 : 1,
                }}>
                + เพิ่มคน
              </button>

              <button onClick={handleSubmit} disabled={submitting}
                style={{
                  padding: '10px 28px', borderRadius: 8, border: 'none',
                  background: PALETTE.positive, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}>
                {submitting ? 'กำลังส่ง...' : `✅ ลงทะเบียน ${participants.length} คน`}
              </button>
            </div>

            {submitMsg && !submitted && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: PALETTE.critical, fontSize: 13 }}>
                {submitMsg}
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div style={{
            background: PALETTE.card, padding: '32px 28px', border: `1px solid ${PALETTE.border}`,
            borderTop: 'none', borderRadius: '0 0 16px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: PALETTE.positive, marginBottom: 8 }}>
              ลงทะเบียนสำเร็จ!
            </h2>
            <p style={{ color: PALETTE.textSecondary, fontSize: 14, marginBottom: 20 }}>
              {submitMsg}
            </p>
            <button onClick={() => { setSubmitted(false); setParticipants([emptyParticipant()]); fetchData(); }}
              style={{
                padding: '8px 20px', borderRadius: 8, border: `1px solid ${PALETTE.border}`,
                background: PALETTE.card, color: PALETTE.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              ลงทะเบียนเพิ่ม
            </button>
          </div>
        )}

        {/* Closed/Full state bottom */}
        {(isClosed || isFull) && !submitted && (
          <div style={{
            background: PALETTE.card, padding: '32px 28px', border: `1px solid ${PALETTE.border}`,
            borderTop: 'none', borderRadius: '0 0 16px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{isClosed ? '🔒' : '📋'}</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: PALETTE.textSecondary }}>
              {isClosed ? 'การลงทะเบียนปิดแล้ว' : 'ที่นั่งเต็มแล้ว'}
            </h2>
            <p style={{ color: PALETTE.textSecondary, fontSize: 13, marginTop: 8 }}>
              {isClosed ? 'หลักสูตรนี้ดำเนินการเสร็จสิ้นหรือถูกยกเลิกแล้ว' : 'กรุณาติดต่อผู้จัดอบรมหากต้องการเพิ่มที่นั่ง'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: PALETTE.textSecondary }}>
          EA SHE — Safety, Health & Environment
        </div>
      </div>
    </div>
  );
}
