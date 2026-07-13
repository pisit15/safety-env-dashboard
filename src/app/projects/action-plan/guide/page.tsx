'use client';
export const dynamic = 'force-dynamic';

import { BookOpen, CheckCircle2, Clock, XCircle, CircleSlash, AlertTriangle, Circle, MinusCircle } from 'lucide-react';

/**
 * คู่มือการใช้งานแผนงานประจำปี — อธิบายความหมายของสถานะ
 * และผลของแต่ละสถานะต่อการคำนวณ KPI (อิงสูตรจริงใน src/lib/kpi-calculator.ts)
 */

const STATUSES = [
  {
    Icon: CheckCircle2, color: '#59A14F', name: 'เสร็จแล้ว',
    meaning: 'ดำเนินกิจกรรมของเดือนนั้นเสร็จสมบูรณ์',
    kpiBase: true, kpiSuccess: true,
    effect: 'นับเป็นผลงาน — เพิ่ม % KPI โดยตรง',
    effectColor: '#59A14F',
  },
  {
    Icon: Circle, color: '#4E79A7', name: 'ตามแผน (ยังไม่เริ่ม)',
    meaning: 'มีแผนในเดือนนั้นและยังไม่ถึงกำหนด/กำลังรอดำเนินการ',
    kpiBase: true, kpiSuccess: false,
    effect: 'อยู่ในฐานคำนวณ — ถ้าเดือนผ่านไปแล้วยังไม่เสร็จ จะกลายเป็น "เลยกำหนด" และฉุด % ลง',
    effectColor: '#666666',
  },
  {
    Icon: AlertTriangle, color: '#E15759', name: 'เลยกำหนด',
    meaning: 'ถึงกำหนดแล้วแต่ยังไม่เสร็จ',
    kpiBase: true, kpiSuccess: false,
    effect: 'ฉุด % KPI ลงเต็มๆ จนกว่าจะทำเสร็จ — ควรเร่งปิดงานหรือขอเลื่อนอย่างเป็นทางการ',
    effectColor: '#E15759',
  },
  {
    Icon: Clock, color: '#F28E2B', name: 'เลื่อน',
    meaning: 'เลื่อนกิจกรรมไปทำเดือนอื่น (ระบุเดือนปลายทาง)',
    kpiBase: true, kpiSuccess: false,
    effect: 'ยังอยู่ในฐานคำนวณ — ไม่ถูกตัดออก % จะยังต่ำจนกว่างานจะเสร็จจริงในเดือนใหม่ และถ้าเลื่อนเกิน 30% ของงานในไตรมาส ระบบจะติดธงเตือน',
    effectColor: '#F28E2B',
  },
  {
    Icon: XCircle, color: '#C23B22', name: 'ยกเลิก',
    meaning: 'ยกเลิกกิจกรรมนั้นถาวร (ต้องให้ Admin อนุมัติ)',
    kpiBase: false, kpiSuccess: false,
    effect: 'ถูกตัดออกจากฐานคำนวณ — ไม่ฉุด % แต่ถ้ายกเลิกเกิน 20% ของงานทั้งหมด ระบบจะติดธงเตือนว่ายกเลิกผิดปกติ',
    effectColor: '#666666',
  },
  {
    Icon: CircleSlash, color: '#BAB0AC', name: 'ไม่เข้าเงื่อนไข (N/A)',
    meaning: 'กิจกรรมไม่เกิดขึ้นตามเงื่อนไข เช่น "อบรมเมื่อมีพนักงานใหม่" แต่เดือนนั้นไม่มีพนักงานใหม่ (ต้องให้ Admin อนุมัติ)',
    kpiBase: false, kpiSuccess: false,
    effect: 'ถูกตัดออกจากฐานคำนวณ — ไม่ฉุด % (ในหน้าภาพรวมบริษัท % ความสำเร็จจะนับ N/A เป็นผลงานให้ด้วย)',
    effectColor: '#666666',
  },
  {
    Icon: MinusCircle, color: '#D4D4D4', name: 'ไม่มีแผน',
    meaning: 'เดือนนั้นไม่มีแผนกิจกรรมตั้งแต่แรก',
    kpiBase: false, kpiSuccess: false,
    effect: 'ไม่ถูกนับในการคำนวณใดๆ ทั้งสิ้น',
    effectColor: '#999999',
  },
];

const SCORE_BANDS = [
  { score: 5, range: '100%', label: 'ดีเยี่ยม', color: '#4E79A7' },
  { score: 4, range: '90 – 99.9%', label: 'ดี', color: '#76B7B2' },
  { score: 3, range: '80 – 89.9%', label: 'พอใช้', color: '#F28E2B' },
  { score: 2, range: '70 – 79.9%', label: 'ต้องปรับปรุง', color: '#E15759' },
  { score: 1, range: 'ต่ำกว่า 70%', label: 'วิกฤต', color: '#C23B22' },
];

export default function ActionPlanGuidePage() {
  return (
    <div style={{ padding: '28px 28px 60px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <BookOpen size={24} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>คู่มือการใช้งาน — แผนงานประจำปี</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        ความหมายของสถานะแต่ละแบบ และผลต่อการคำนวณ KPI รายไตรมาส
      </p>

      {/* ── 1. สูตรคำนวณ ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>1. สูตรคำนวณ % KPI</h2>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 18px', textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
            % KPI = เสร็จแล้ว ÷ (งานทั้งหมด − ยกเลิก − ไม่เข้าเงื่อนไข) × 100
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          นับเป็น <b style={{ color: 'var(--text-primary)' }}>&ldquo;รายการรายเดือน&rdquo;</b> — กิจกรรมเดียวที่มีแผน 3 เดือน นับเป็น 3 รายการ
          แต่ละไตรมาสคำนวณจากงานของ 3 เดือนในไตรมาสนั้น แล้วแปลงเป็นคะแนน 1–5
          ส่วนคะแนนเฉลี่ยปีคือค่าเฉลี่ยของไตรมาสที่ผ่านมาแล้ว
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
          ไตรมาสหนึ่งมีงาน 10 รายการ: เสร็จแล้ว 6 · เลยกำหนด 1 · เลื่อน 1 · ยกเลิก 1 · ไม่เข้าเงื่อนไข 1
        </p>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 18px', fontSize: 13, lineHeight: 2, color: 'var(--text-primary)' }}>
          ฐานคำนวณ = 10 − 1 (ยกเลิก) − 1 (ไม่เข้าเงื่อนไข) = <b>8</b><br />
          % KPI = 6 ÷ 8 × 100 = <b>75%</b> → คะแนน <b style={{ color: '#E15759' }}>2 (ต้องปรับปรุง)</b><br />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            ถ้าปิดงานที่เลยกำหนดกับที่เลื่อนได้ทั้ง 2 รายการ → 8 ÷ 8 = 100% → คะแนน 5 ดีเยี่ยม
          </span>
        </div>
      </div>

      {/* ── 5. ข้อควรรู้ ── */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>5. ข้อควรรู้เพิ่มเติม</h2>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 20, lineHeight: 2 }}>
          <li>การขอเปลี่ยนสถานะเป็น <b style={{ color: '#C23B22' }}>ยกเลิก</b> หรือ <b style={{ color: '#888' }}>ไม่เข้าเงื่อนไข</b> ต้องส่งคำขอพร้อมเหตุผล และมีผลเมื่อ <b style={{ color: 'var(--text-primary)' }}>Admin อนุมัติ</b> เท่านั้น (ระหว่างรอ สถานะเดิมยังคงอยู่)</li>
          <li><b style={{ color: '#F28E2B' }}>เลื่อน</b> ไม่ได้ทำให้พ้นผิด — งานยังอยู่ในฐานคำนวณ ต้องทำให้เสร็จในเดือนที่เลื่อนไป % จึงจะขึ้น</li>
          <li>กิจกรรมแบบมีเงื่อนไข (เช่น &ldquo;เมื่อเกิดเหตุ...&rdquo;, &ldquo;กรณีมี...&rdquo;) ระบบจะไม่นับเป็นเลยกำหนดโดยอัตโนมัติ เพราะขึ้นกับว่าเหตุการณ์เกิดหรือไม่</li>
          <li>% ความสำเร็จใน<b style={{ color: 'var(--text-primary)' }}>หน้าภาพรวมบริษัท</b> จะนับไม่เข้าเงื่อนไข (N/A) เป็นผลงานให้ด้วย จึงอาจสูงกว่า % KPI รายไตรมาสเล็กน้อย</li>
          <li>ถ้าคะแนนเป็น 1 (วิกฤต) ติดกัน 2 ไตรมาสขึ้นไป ระบบจะติดธงเตือนพิเศษ</li>
        </ul>
      </div>
    </div>
  );
}
