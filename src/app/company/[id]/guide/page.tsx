'use client';

import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { BookOpen, CheckCircle, Clock, AlertTriangle, XCircle, MinusCircle, ArrowRightCircle, Lock, ShieldCheck, HelpCircle, TrendingUp, Calendar } from 'lucide-react';

export default function GuidePage() {
  const params = useParams();
  const companyId = params.id as string;

  const sectionStyle: React.CSSProperties = {
    marginBottom: 28,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const subHeadingStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
    marginTop: 16,
  };

  const paraStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  };

  const cardStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    marginBottom: 10,
  };

  const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: bg,
    color,
    whiteSpace: 'nowrap',
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Header */}
          <div className="glass-card rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.08) 0%, rgba(88,86,214,0.08) 100%)', border: '1px solid rgba(0,122,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #007aff, #5856d6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={22} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>คู่มือการใช้งาน</h1>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>แผนงานประจำปี (Action Plan) — Safety & Environment</p>
              </div>
            </div>
            <p style={paraStyle}>
              คู่มือนี้อธิบายวิธีการใช้งานระบบแผนงานประจำปี ตั้งแต่การอัปเดตสถานะกิจกรรม การคำนวณ KPI รายไตรมาส
              กำหนดส่งข้อมูล และขั้นตอนการขออนุมัติจาก Admin
            </p>
          </div>

          {/* ─── Section 1: สถานะกิจกรรม ─── */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div style={sectionStyle}>
              <h2 style={headingStyle}>
                <TrendingUp size={18} color="#007aff" />
                1. สถานะกิจกรรม และผลต่อ KPI
              </h2>
              <p style={paraStyle}>
                แต่ละกิจกรรมในแผนงานจะมีสถานะรายเดือน ซึ่งมีผลต่อการคำนวณ KPI รายไตรมาสโดยตรง
                สูตรการคำนวณคือ:
              </p>

              {/* KPI Formula */}
              <div style={{ ...cardStyle, background: 'rgba(88,86,214,0.06)', border: '1px solid rgba(88,86,214,0.2)', textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#5856d6', marginBottom: 8 }}>
                  KPI % = เสร็จแล้ว ÷ ฐาน
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  ฐาน = รายการทั้งหมด − ยกเลิก − ไม่เข้าเงื่อนไข (N/A)
                </div>
              </div>

              <p style={subHeadingStyle}>เกณฑ์คะแนน KPI</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
                {[
                  { score: 5, label: '100%', color: '#34c759', bg: 'rgba(52,199,89,0.1)' },
                  { score: 4, label: '≥ 90%', color: '#007aff', bg: 'rgba(0,122,255,0.1)' },
                  { score: 3, label: '≥ 80%', color: '#5856d6', bg: 'rgba(88,86,214,0.1)' },
                  { score: 2, label: '≥ 70%', color: '#ff9500', bg: 'rgba(255,149,0,0.1)' },
                  { score: 1, label: '< 70%', color: '#ff3b30', bg: 'rgba(255,59,48,0.1)' },
                ].map(item => (
                  <div key={item.score} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: item.bg, border: `1px solid ${item.color}22` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.score}</div>
                    <div style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              <p style={subHeadingStyle}>รายละเอียดแต่ละสถานะ</p>

              {/* Done */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(52,199,89,0.12)', '#34c759')}>
                    <CheckCircle size={13} /> เสร็จแล้ว (Done)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมดำเนินการเสร็จสิ้นในเดือนนั้น — <strong style={{ color: 'var(--text-primary)' }}>นับเป็นตัวตั้ง (Numerator)</strong> ในสูตร KPI
                  ยิ่งมีเสร็จมาก คะแนนยิ่งสูง ควรแนบหลักฐานการทำงาน (ไฟล์/ลิงก์) เพื่อความครบถ้วน
                </p>
              </div>

              {/* Overdue */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(255,59,48,0.12)', '#ff3b30')}>
                    <AlertTriangle size={13} /> เกินกำหนด (Overdue)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมที่มีแผนในเดือนนั้น แต่ยังไม่ได้ทำเมื่อพ้นกำหนด — <strong style={{ color: 'var(--text-primary)' }}>นับเป็นตัวหาร (Denominator) แต่ไม่นับเป็นตัวตั้ง</strong>
                  ทำให้ KPI % ลดลง ควรติดตามและเปลี่ยนเป็น "เสร็จแล้ว" โดยเร็ว
                </p>
              </div>

              {/* Planned */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(0,122,255,0.12)', '#007aff')}>
                    <Clock size={13} /> แผน / ยังไม่เริ่ม (Planned)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมที่มีแผนจะทำในเดือนนั้น แต่ยังไม่ถึงกำหนด — <strong style={{ color: 'var(--text-primary)' }}>นับเป็นตัวหาร</strong> แต่ยังไม่ส่งผลเชิงลบ
                  เพราะอาจยังไม่ถึงเวลา
                </p>
              </div>

              {/* Postponed */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(255,149,0,0.12)', '#ff9500')}>
                    <ArrowRightCircle size={13} /> เลื่อน (Postponed)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมถูกเลื่อนไปเดือนอื่น — <strong style={{ color: 'var(--text-primary)' }}>ถูกย้ายออกจากเดือนเดิม</strong> และนับในเดือนใหม่แทน
                  ไม่กระทบ KPI ของเดือนเดิม แต่จะนับในเดือนปลายทาง เมื่อเลื่อน ระบบจะให้เลือกเดือนปลายทาง
                </p>
              </div>

              {/* Cancelled */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(255,59,48,0.12)', '#ff3b30')}>
                    <XCircle size={13} /> ยกเลิก (Cancelled)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมถูกยกเลิกด้วยเหตุผลที่ชัดเจน — <strong style={{ color: 'var(--text-primary)' }}>ถูกหักออกจากฐาน (Denominator)</strong> ไม่มีผลต่อ KPI
                  <span style={{ color: '#ff3b30', fontWeight: 600 }}> ต้องส่งคำขอให้ Admin อนุมัติก่อน</span> จึงจะมีผลจริง
                </p>
              </div>

              {/* Not Applicable */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={badgeStyle('rgba(142,142,147,0.15)', '#8e8e93')}>
                    <MinusCircle size={13} /> ไม่เข้าเงื่อนไข (N/A)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 0 }}>
                  กิจกรรมไม่เกี่ยวข้องกับบริษัทนี้ หรือไม่สามารถดำเนินการได้ — <strong style={{ color: 'var(--text-primary)' }}>ถูกหักออกจากฐาน (Denominator)</strong> เช่นเดียวกับยกเลิก
                  <span style={{ color: '#ff3b30', fontWeight: 600 }}> ต้องส่งคำขอให้ Admin อนุมัติก่อน</span>
                </p>
              </div>

              {/* Summary Table */}
              <p style={subHeadingStyle}>สรุปผลต่อ KPI</p>
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>สถานะ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ตัวตั้ง</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ตัวหาร (ฐาน)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ต้องขออนุมัติ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { status: 'เสร็จแล้ว', num: true, denom: 'yes' as const, approval: false, color: '#34c759' },
                      { status: 'เกินกำหนด', num: false, denom: 'yes' as const, approval: false, color: '#ff3b30' },
                      { status: 'แผน/ยังไม่เริ่ม', num: false, denom: 'yes' as const, approval: false, color: '#007aff' },
                      { status: 'เลื่อน', num: false, denom: 'move' as const, approval: false, color: '#ff9500' },
                      { status: 'ยกเลิก', num: false, denom: 'no' as const, approval: true, color: '#ff3b30' },
                      { status: 'N/A', num: false, denom: 'no' as const, approval: true, color: '#8e8e93' },
                      { status: 'มีแผน→ไม่มีแผน', num: false, denom: 'no' as const, approval: true, color: '#ff9500' },
                      { status: 'ไม่มีแผน→มีแผน', num: false, denom: 'yes' as const, approval: true, color: '#007aff' },
                    ]).map(row => (
                      <tr key={row.status} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: row.color }}>{row.status}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.num ? <span style={{ color: '#34c759', fontWeight: 700 }}>✓ นับ</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.denom === 'yes' ? <span style={{ color: '#007aff', fontWeight: 700 }}>✓ นับ</span> : row.denom === 'move' ? <span style={{ color: '#ff9500', fontWeight: 600 }}>ย้ายเดือน</span> : <span style={{ color: '#ff3b30', fontWeight: 600 }}>หักออก</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.approval ? <span style={{ color: '#ff3b30', fontWeight: 700 }}>ต้องขอ</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ ...cardStyle, marginTop: 14, background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.2)' }}>
                <p style={{ ...paraStyle, marginBottom: 0, fontSize: 12 }}>
                  <strong style={{ color: '#34c759' }}>ตัวอย่าง:</strong> ถ้าเดือน ม.ค. มีกิจกรรมทั้งหมด 10 รายการ ยกเลิก 1 N/A 2 เสร็จ 5
                  → ฐาน = 10 − 1 − 2 = <strong>7</strong> → KPI = 5/7 = <strong>71.4%</strong> → คะแนน <strong>3</strong> (≥70%)
                </p>
              </div>
            </div>
          </div>

          {/* ─── Section 2: Deadline ─── */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div style={sectionStyle}>
              <h2 style={headingStyle}>
                <Calendar size={18} color="#ff9500" />
                2. กำหนดส่งข้อมูลรายเดือน
              </h2>
              <p style={paraStyle}>
                เพื่อให้ข้อมูล KPI ถูกต้องและทันเวลา ระบบกำหนดให้แต่ละบริษัทอัปเดตสถานะกิจกรรมประจำเดือน
                ภายในกำหนดเวลาที่ชัดเจน
              </p>

              <div style={{ ...cardStyle, background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.25)', textAlign: 'center', padding: 20 }}>
                <Lock size={28} color="#ff9500" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#ff9500', marginBottom: 6 }}>
                  Deadline: วันที่ 10 ของเดือนถัดไป
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  เช่น กิจกรรมเดือน มกราคม → ต้องอัปเดตสถานะภายใน <strong>10 กุมภาพันธ์</strong>
                </div>
              </div>

              <p style={subHeadingStyle}>กฎการ Lock ข้อมูล</p>

              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Lock size={16} color="#ff3b30" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ ...paraStyle, marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>หลังวันที่ 10 ของเดือนถัดไป</strong> — ระบบจะ Lock ข้อมูลของเดือนนั้นโดยอัตโนมัติ
                      ผู้ใช้จะไม่สามารถเปลี่ยนแปลงสถานะได้อีก
                    </p>
                    <p style={{ ...paraStyle, marginBottom: 0, fontSize: 12, color: 'var(--muted)' }}>
                      หากต้องการแก้ไขหลัง Lock ให้ส่งคำขอแก้ไข (Edit Request) ให้ Admin พิจารณา
                    </p>
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Clock size={16} color="#007aff" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ ...paraStyle, marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>ก่อนวันที่ 10</strong> — ผู้ใช้สามารถอัปเดตสถานะ แนบหลักฐาน และเพิ่มบันทึกได้ตามปกติ
                    </p>
                    <p style={{ ...paraStyle, marginBottom: 0, fontSize: 12, color: 'var(--muted)' }}>
                      แนะนำให้อัปเดตทันทีที่กิจกรรมเสร็จ ไม่ต้องรอใกล้ Deadline
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.2)' }}>
                <p style={{ ...paraStyle, marginBottom: 0, fontSize: 12 }}>
                  <strong style={{ color: '#007aff' }}>ตัวอย่าง Timeline:</strong> กิจกรรมเดือน มี.ค. → แก้ไขได้ถึง <strong>10 เม.ย.</strong> → หลังจากนั้นระบบ Lock → ต้องส่ง Edit Request ถ้าจะแก้
                </p>
              </div>
            </div>
          </div>

          {/* ─── Section 3: Approval Workflow ─── */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div style={sectionStyle}>
              <h2 style={headingStyle}>
                <ShieldCheck size={18} color="#5856d6" />
                3. การขออนุมัติจาก Admin
              </h2>
              <p style={paraStyle}>
                การเปลี่ยนแปลงบางประเภทต้องได้รับอนุมัติจาก Admin ก่อนจึงจะมีผล เพื่อป้องกันการเปลี่ยนสถานะที่มีผลกระทบต่อ KPI อย่างไม่เหมาะสม
              </p>

              <p style={subHeadingStyle}>กรณีที่ต้องขออนุมัติ</p>

              {/* Case 1: Cancel / N/A */}
              <div style={{ ...cardStyle, border: '1px solid rgba(255,59,48,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ ...badgeStyle('rgba(255,59,48,0.12)', '#ff3b30'), fontSize: 13, fontWeight: 700 }}>
                    คำขอยกเลิก / N/A
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 6 }}>
                  เมื่อผู้ใช้ต้องการเปลี่ยนสถานะเป็น <strong>"ยกเลิก"</strong> หรือ <strong>"ไม่เข้าเงื่อนไข (N/A)"</strong>:
                </p>
                <div style={{ paddingLeft: 16, borderLeft: '3px solid rgba(255,59,48,0.2)', marginLeft: 4 }}>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>1. กดเลือกสถานะ "ยกเลิก" หรือ "N/A" ในช่องกิจกรรม</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>2. ระบบจะแสดงฟอร์มให้กรอก <strong style={{ color: 'var(--text-primary)' }}>เหตุผล</strong> ว่าทำไมต้องเปลี่ยนสถานะนี้</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>3. กด "ส่งคำขอ" → คำขอจะถูกส่งไปให้ Admin</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>4. ขณะรออนุมัติ จะแสดง badge <span style={badgeStyle('rgba(255,149,0,0.12)', '#ff9500')}>รออนุมัติ</span></p>
                  <p style={{ ...paraStyle, marginBottom: 0 }}>5. เมื่อ Admin <span style={{ color: '#34c759', fontWeight: 600 }}>อนุมัติ</span> → สถานะเปลี่ยนทันที / <span style={{ color: '#ff3b30', fontWeight: 600 }}>ปฏิเสธ</span> → สถานะคงเดิม</p>
                </div>
              </div>

              {/* Case 2: Edit Request (locked) */}
              <div style={{ ...cardStyle, border: '1px solid rgba(0,122,255,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ ...badgeStyle('rgba(0,122,255,0.12)', '#007aff'), fontSize: 13, fontWeight: 700 }}>
                    คำขอแก้ไขหลัง Lock
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 6 }}>
                  เมื่อข้อมูลถูก Lock แล้ว (หลังวันที่ 10 ของเดือนถัดไป) แต่ต้องการแก้ไข:
                </p>
                <div style={{ paddingLeft: 16, borderLeft: '3px solid rgba(0,122,255,0.2)', marginLeft: 4 }}>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>1. เปิด Drawer ของกิจกรรม → กดปุ่ม "ขอแก้ไข"</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>2. ระบุ <strong style={{ color: 'var(--text-primary)' }}>สถานะใหม่ที่ต้องการ</strong> และ <strong style={{ color: 'var(--text-primary)' }}>เหตุผล</strong></p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>3. กด "ส่งคำขอ" → รอ Admin ตรวจสอบ</p>
                  <p style={{ ...paraStyle, marginBottom: 0 }}>4. Admin อนุมัติ → สถานะถูกอัปเดตตามคำขอ</p>
                </div>
              </div>

              {/* Case 3: Plan scope changes */}
              <div style={{ ...cardStyle, border: '1px solid rgba(255,149,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ ...badgeStyle('rgba(255,149,0,0.12)', '#ff9500'), fontSize: 13, fontWeight: 700 }}>
                    ขอเปลี่ยนขอบเขตแผน (มีแผน ↔ ไม่มีแผน)
                  </span>
                </div>
                <p style={{ ...paraStyle, marginBottom: 6 }}>
                  แผนงานตั้งต้นคือแผนที่ได้รับ<strong style={{ color: 'var(--text-primary)' }}>อนุมัติจากผู้บริหาร</strong>แล้ว
                  การเพิ่มหรือนำกิจกรรมออกจากแผนจึงต้องขออนุมัติ:
                </p>
                <div style={{ paddingLeft: 16, borderLeft: '3px solid rgba(255,149,0,0.2)', marginLeft: 4 }}>
                  <p style={{ ...paraStyle, marginBottom: 4 }}><strong style={{ color: '#ff9500' }}>นำออกจากแผน</strong> (มีแผน → ไม่มีแผน): ลดจำนวนรายการทั้งหมด กระทบฐาน KPI</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}><strong style={{ color: '#007aff' }}>เพิ่มเข้าแผน</strong> (ไม่มีแผน → มีแผน): เพิ่มจำนวนรายการ เพิ่มฐาน KPI</p>
                  <p style={{ ...paraStyle, marginBottom: 0 }}>ทั้งสองกรณี ระบบจะแสดงฟอร์มให้กรอกเหตุผล และส่งคำขอให้ Admin พิจารณา</p>
                </div>
              </div>

              <p style={subHeadingStyle}>สถานะคำขอ</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ ...cardStyle, flex: 1, minWidth: 140, textAlign: 'center' }}>
                  <Clock size={20} color="#ff9500" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ff9500' }}>รอดำเนินการ</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Admin ยังไม่ได้ตรวจสอบ</div>
                </div>
                <div style={{ ...cardStyle, flex: 1, minWidth: 140, textAlign: 'center' }}>
                  <CheckCircle size={20} color="#34c759" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#34c759' }}>อนุมัติแล้ว</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>สถานะถูกเปลี่ยนเรียบร้อย</div>
                </div>
                <div style={{ ...cardStyle, flex: 1, minWidth: 140, textAlign: 'center' }}>
                  <XCircle size={20} color="#ff3b30" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ff3b30' }}>ปฏิเสธ</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>คำขอไม่ผ่าน สถานะคงเดิม</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 4: Tips ─── */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div style={sectionStyle}>
              <h2 style={headingStyle}>
                <HelpCircle size={18} color="#34c759" />
                4. เคล็ดลับการใช้งาน
              </h2>

              {[
                { tip: 'อัปเดตสถานะทันที', desc: 'ไม่ต้องรอใกล้ Deadline เมื่อกิจกรรมเสร็จแล้วให้อัปเดตทันที จะได้ไม่ลืม', icon: '⚡' },
                { tip: 'แนบหลักฐานทุกครั้ง', desc: 'เมื่อเปลี่ยนสถานะเป็น "เสร็จแล้ว" ควรแนบรูปภาพ ไฟล์ หรือลิงก์เป็นหลักฐาน', icon: '📎' },
                { tip: 'เขียนเหตุผลชัดเจน', desc: 'เมื่อขอยกเลิกหรือ N/A ให้เขียนเหตุผลละเอียด Admin จะอนุมัติเร็วขึ้น', icon: '✍️' },
                { tip: 'ตรวจสอบ KPI ประจำ', desc: 'ดูหน้า KPI รายไตรมาสเพื่อประเมินคะแนนปัจจุบัน และวางแผนเดือนถัดไป', icon: '📊' },
                { tip: 'ใช้ตัวกรอง (Filter)', desc: 'ใช้ปุ่มกรองด้านบน เช่น "เกินกำหนด" "เดือนนี้" เพื่อโฟกัสรายการที่ต้องจัดการก่อน', icon: '🔍' },
              ].map((item, i) => (
                <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.tip}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Section 5: KPI Quarter Mapping ─── */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <h2 style={headingStyle}>
                <Calendar size={18} color="#5ac8fa" />
                5. ไตรมาสและการคำนวณ
              </h2>
              <p style={paraStyle}>ระบบรวม KPI เป็นรายไตรมาส ตามเกณฑ์ต่อไปนี้:</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { q: 'Q1', months: 'ม.ค. — มี.ค.', color: '#007aff' },
                  { q: 'Q2', months: 'เม.ย. — มิ.ย.', color: '#34c759' },
                  { q: 'Q3', months: 'ก.ค. — ก.ย.', color: '#ff9500' },
                  { q: 'Q4', months: 'ต.ค. — ธ.ค.', color: '#5856d6' },
                ].map(item => (
                  <div key={item.q} style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.q}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.months}</div>
                  </div>
                ))}
              </div>

              <p style={{ ...paraStyle, marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                คะแนน KPI ประจำปี = ค่าเฉลี่ยของ 4 ไตรมาส (เฉพาะไตรมาสที่มีข้อมูลจริง ไม่รวมไตรมาสอนาคต)
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* ─── Section 6: Training KPI Guide ─── */}
          {/* ═══════════════════════════════════════════ */}
          <div className="glass-card rounded-xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, rgba(52,199,89,0.06) 0%, rgba(0,122,255,0.06) 100%)', border: '1px solid rgba(52,199,89,0.15)' }}>
            <div style={sectionStyle}>
              <h2 style={headingStyle}>
                <BookOpen size={18} color="#34c759" />
                6. แผนอบรมประจำปี (Training Plan KPI)
              </h2>
              <p style={paraStyle}>
                KPI แผนอบรมใช้หลักการเดียวกับ Action Plan — ติดตามว่าหลักสูตรที่ได้รับอนุมัติจากผู้บริหาร
                จัดอบรมสำเร็จครบตามแผนหรือไม่
              </p>

              {/* KPI Formula */}
              <div style={{ ...cardStyle, background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)', textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34c759', marginBottom: 8 }}>
                  KPI % = อบรมแล้ว ÷ ฐาน
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  ฐาน = หลักสูตรทั้งหมด − ยกเลิก
                </div>
              </div>

              <p style={subHeadingStyle}>สถานะหลักสูตร และผลต่อ KPI</p>

              {/* Training status table */}
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>สถานะ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ตัวตั้ง</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ตัวหาร (ฐาน)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>ต้องขออนุมัติ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { status: 'ยังไม่กำหนดวัน', num: false, denom: 'yes' as const, approval: false, color: '#6b7280' },
                      { status: 'กำหนดวันแล้ว', num: false, denom: 'yes' as const, approval: false, color: '#3b82f6' },
                      { status: 'อบรมแล้ว', num: true, denom: 'yes' as const, approval: false, color: '#16a34a' },
                      { status: 'เลื่อน', num: false, denom: 'move' as const, approval: false, color: '#f59e0b' },
                      { status: 'ยกเลิก', num: false, denom: 'no' as const, approval: true, color: '#dc2626' },
                    ]).map(row => (
                      <tr key={row.status} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: row.color }}>{row.status}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.num ? <span style={{ color: '#34c759', fontWeight: 700 }}>✓ นับ</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.denom === 'yes' ? <span style={{ color: '#007aff', fontWeight: 700 }}>✓ นับ</span> : row.denom === 'move' ? <span style={{ color: '#ff9500', fontWeight: 600 }}>ย้ายเดือน</span> : <span style={{ color: '#ff3b30', fontWeight: 600 }}>หักออก</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.approval ? <span style={{ color: '#ff3b30', fontWeight: 700 }}>ต้องขอ</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={subHeadingStyle}>ขั้นตอนการขอยกเลิกหลักสูตร</p>
              <div style={{ ...cardStyle, border: '1px solid rgba(255,59,48,0.2)' }}>
                <div style={{ paddingLeft: 16, borderLeft: '3px solid rgba(255,59,48,0.2)', marginLeft: 4 }}>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>1. เปิดหน้า Training → tab อัปเดต → เลือกหลักสูตรที่ต้องการยกเลิก</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>2. เปลี่ยนสถานะเป็น <strong style={{ color: '#dc2626' }}>"ยกเลิก"</strong></p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>3. ระบบจะแสดงฟอร์มให้กรอก <strong style={{ color: 'var(--text-primary)' }}>เหตุผล</strong> ว่าทำไมต้องยกเลิก</p>
                  <p style={{ ...paraStyle, marginBottom: 4 }}>4. กด "ส่งคำขอยกเลิก" → คำขอจะถูกส่งไปให้ Admin HQ</p>
                  <p style={{ ...paraStyle, marginBottom: 0 }}>5. เมื่อ Admin <span style={{ color: '#34c759', fontWeight: 600 }}>อนุมัติ</span> → สถานะเปลี่ยนเป็นยกเลิก + หักออกจาก KPI / <span style={{ color: '#ff3b30', fontWeight: 600 }}>ปฏิเสธ</span> → สถานะคงเดิม</p>
                </div>
              </div>

              <div style={{ ...cardStyle, marginTop: 14, background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.2)' }}>
                <p style={{ ...paraStyle, marginBottom: 0, fontSize: 12 }}>
                  <strong style={{ color: '#34c759' }}>ตัวอย่าง:</strong> ถ้า Q1 มีหลักสูตรทั้งหมด 15 รายการ ยกเลิก 2 อบรมแล้ว 10
                  → ฐาน = 15 − 2 = <strong>13</strong> → KPI = 10/13 = <strong>76.9%</strong> → คะแนน <strong>2</strong> (≥70%)
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
