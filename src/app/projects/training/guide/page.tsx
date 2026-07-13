'use client';
export const dynamic = 'force-dynamic';

import { BookOpen, CheckCircle2, CalendarCheck, Circle, XCircle, Clock } from 'lucide-react';

/**
 * คู่มือการใช้งานแผนอบรมประจำปี — อธิบายความหมายของสถานะ
 * และผลต่อการคำนวณ KPI (อิงสูตรจริงในหน้าแผนอบรม)
 */

const STATUSES = [
  {
    Icon: CheckCircle2, color: '#59A14F', name: 'อบรมแล้ว',
    meaning: 'จัดอบรมเสร็จและบันทึกผล (วันอบรม ผู้เข้าอบรม ค่าใช้จ่าย)',
    kpiBase: true, kpiSuccess: true,
    effect: 'นับเป็นผลงาน — เพิ่ม % KPI โดยตรง',
    effectColor: '#59A14F',
  },
  {
    Icon: CalendarCheck, color: '#4E79A7', name: 'กำหนดวันแล้ว',
    meaning: 'ระบุวันอบรมแล้ว รอถึงวันจัดจริง',
    kpiBase: true, kpiSuccess: false,
    effect: 'อยู่ในฐานคำนวณ — % จะขึ้นเมื่อบันทึก "อบรมแล้ว" หลังจัดเสร็จเท่านั้น',
    effectColor: '#666666',
  },
  {
    Icon: Circle, color: '#BAB0AC', name: 'ยังไม่กำหนดวัน',
    meaning: 'มีแผนในเดือนนั้นแต่ยังไม่ระบุวันอบรม',
    kpiBase: true, kpiSuccess: false,
    effect: 'อยู่ในฐานคำนวณ — ถ้าใกล้ถึง/เลยเดือนตามแผนจะติดชิป "ต้องทำ" ขอบแดงในตารางปี และฉุด % จนกว่าจะอบรมเสร็จ',
    effectColor: '#E15759',
  },
  {
    Icon: Clock, color: '#F28E2B', name: 'เลื่อน',
    meaning: 'เลื่อนหลักสูตรไปจัดเดือนอื่น (ระบุเดือนปลายทาง)',
    kpiBase: true, kpiSuccess: false,
    effect: 'ยังอยู่ในฐานคำนวณ — ย้ายไปนับในเดือน/ไตรมาสใหม่ % จะขึ้นเมื่ออบรมเสร็จจริง การเลื่อนไม่ทำให้พ้นฐาน',
    effectColor: '#F28E2B',
  },
  {
    Icon: XCircle, color: '#C23B22', name: 'ยกเลิก',
    meaning: 'ยกเลิกหลักสูตรนั้นถาวร',
    kpiBase: false, kpiSuccess: false,
    effect: 'ถูกหักออกจากฐานคำนวณ — ไม่ฉุด % (แต่จำนวนที่ยกเลิกจะแสดงกำกับไว้ให้เห็นเสมอ)',
    effectColor: '#666666',
  },
];

const SCORE_BANDS = [
  { score: 5, range: '100%', label: 'ดีเยี่ยม', color: '#34c759' },
  { score: 4, range: '90 – 99.9%', label: 'ดี', color: '#007aff' },
  { score: 3, range: '80 – 89.9%', label: 'พอใช้', color: '#5856d6' },
  { score: 2, range: '70 – 79.9%', label: 'ต้องปรับปรุง', color: '#ff9500' },
  { score: 1, range: 'ต่ำกว่า 70%', label: 'วิกฤต', color: '#ff3b30' },
];

export default function TrainingGuidePage() {
  return (
    <div style={{ padding: '28px 28px 60px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <BookOpen size={24} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>คู่มือการใช้งาน — แผนอบรมประจำปี</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        ความหมายของสถานะแต่ละแบบ และผลต่อการคำนวณ KPI รายไตรมาส
      </p>

      {/* ── 1. สูตรคำนวณ ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>1. สูตรคำนวณ % KPI</h2>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 18px', textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
            % KPI = อบรมแล้ว ÷ (หลักสูตรทั้งหมด − ยกเลิก) × 100
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          นับตามเดือนที่หลักสูตรถูกกำหนดไว้ (ถ้าเลื่อน จะนับตามเดือนใหม่)
          แต่ละไตรมาสคำนวณจากหลักสูตรของ 3 เดือนในไตรมาสนั้น แล้วแปลงเป็นคะแนน 1–5
          คะแนนเฉลี่ยปีคิดจาก<b style={{ color: 'var(--text-primary)' }}>เฉพาะไตรมาสที่วัดผลได้</b> —
          ไตรมาสที่ยังไม่ถึงจะแสดง &ldquo;ยังไม่ถึง&rdquo; และไตรมาสที่ไม่มีหลักสูตรถึงกำหนดจะแสดง &ldquo;—&rdquo; โดยไม่ถูกนำมาเฉลี่ย
        </p>
      </div>

      {/* ── 2. สถานะและผลต่อ KPI ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>2. สถานะแต่ละแบบมีผลอย่างไร</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>สถานะ</th>
                <th style={{ padding: '8px 10px' }}>ความหมาย</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>อยู่ในฐานคำนวณ</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>นับเป็นผลงาน</th>
                <th style={{ padding: '8px 10px' }}>ผลต่อ KPI</th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map(s => (
                <tr key={s.name} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: s.color }}>
                      <s.Icon size={16} /> {s.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)', minWidth: 180 }}>{s.meaning}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: s.kpiBase ? '#4E79A7' : '#BAB0AC' }}>{s.kpiBase ? '✓' : '✕'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: s.kpiSuccess ? '#59A14F' : '#BAB0AC' }}>{s.kpiSuccess ? '✓' : '—'}</td>
                  <td style={{ padding: '10px', color: s.effectColor, minWidth: 220 }}>{s.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. เกณฑ์คะแนน ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>3. เกณฑ์คะแนน (1–5)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {SCORE_BANDS.map(b => (
            <div key={b.score} style={{ textAlign: 'center', padding: '14px 10px', borderRadius: 10, background: `${b.color}10`, border: `1px solid ${b.color}40` }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: b.color }}>{b.score}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: b.color, marginTop: 2 }}>{b.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{b.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. ตัวอย่าง ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>4. ตัวอย่างการคำนวณ</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.8 }}>
          ไตรมาสหนึ่งมีหลักสูตร 10 หลักสูตร: อบรมแล้ว 7 · กำหนดวันแล้ว 1 · ยังไม่กำหนดวัน 1 · ยกเลิก 1
        </p>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 18px', fontSize: 13, lineHeight: 2, color: 'var(--text-primary)' }}>
          ฐานคำนวณ = 10 − 1 (ยกเลิก) = <b>9</b><br />
          % KPI = 7 ÷ 9 × 100 = <b>77.8%</b> → คะแนน <b style={{ color: '#ff9500' }}>2 (ต้องปรับปรุง)</b><br />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            ถ้าจัดอบรมอีก 2 หลักสูตรที่เหลือให้เสร็จ → 9 ÷ 9 = 100% → คะแนน 5 ดีเยี่ยม
          </span>
        </div>
      </div>

      {/* ── 5. ข้อควรรู้ ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>5. ข้อควรรู้เพิ่มเติม</h2>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 20, lineHeight: 2 }}>
          <li>แค่ <b style={{ color: '#4E79A7' }}>กำหนดวันแล้ว</b> ยังไม่เพิ่ม % — ต้องกลับมาบันทึก <b style={{ color: '#59A14F' }}>อบรมแล้ว</b> พร้อมผลการอบรมหลังจัดเสร็จ % จึงจะขึ้น</li>
          <li>หลักสูตรที่<b style={{ color: '#E15759' }}>ยังไม่กำหนดวัน</b>และใกล้ถึงเดือนตามแผน จะขึ้นชิป &ldquo;ต้องทำ&rdquo; ขอบแดงในตารางปี และมีแจ้งเตือนเมื่อเหลือเวลาไม่ถึง 45 วัน</li>
          <li><b style={{ color: '#F28E2B' }}>เลื่อน</b> ไม่ได้ทำให้พ้นฐานคำนวณ — หลักสูตรจะย้ายไปนับในเดือนใหม่ ต้องจัดให้เสร็จ % จึงขึ้น</li>
          <li>ตัวเลข &ldquo;รอดำเนินการ&rdquo; ในภาพรวม = หลักสูตรที่ยังไม่กำหนดวันทั้งปี ส่วนชิป &ldquo;ต้องทำ&rdquo; ในตารางปี = เฉพาะที่เร่งด่วน (เลยกำหนด/ใกล้ถึงกำหนด) — นิยามต่างกัน</li>
          <li>งบประมาณและค่าใช้จ่ายจริงไม่มีผลต่อคะแนน KPI — แสดงเพื่อติดตามการใช้งบเท่านั้น</li>
        </ul>
      </div>
    </div>
  );
}
