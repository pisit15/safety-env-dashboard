'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  ArrowLeft,
  BookOpen,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Target,
  ClipboardList,
  Layers,
  BarChart3,
  RefreshCw,
  HardHat,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

// ── Section data ──
const SECTIONS = [
  { id: 'overview', label: 'ภาพรวม (Overview)', icon: BookOpen },
  { id: 'workflow', label: 'ขั้นตอนการใช้งาน', icon: ClipboardList },
  { id: 'step1', label: 'Step 1: กำหนดขอบเขต', icon: Target },
  { id: 'step2', label: 'Step 2: ระบุอันตราย', icon: AlertTriangle },
  { id: 'step3', label: 'Step 3: ประเมินความเสี่ยง', icon: BarChart3 },
  { id: 'step4', label: 'Step 4: ลดความเสี่ยง', icon: Shield },
  { id: 'step5', label: 'Step 5: มาตรการควบคุม', icon: Layers },
  { id: 'step6', label: 'Step 6: ติดตามและทบทวน', icon: RefreshCw },
  { id: 'matrix', label: 'ตารางความเสี่ยง (Risk Matrix)', icon: BarChart3 },
  { id: 'hierarchy', label: 'ลำดับขั้นการควบคุม', icon: HardHat },
];

// ── Risk Matrix helpers ──
function getRiskScale(rl: number): string {
  if (rl >= 32) return 'Critical';
  if (rl >= 10) return 'High';
  if (rl >= 5) return 'Medium';
  if (rl >= 1) return 'Low';
  return 'N/A';
}
function getRiskColor(scale: string): string {
  switch (scale) {
    case 'Critical': return '#dc2626';
    case 'High': return '#f59e0b';
    case 'Medium': return '#eab308';
    case 'Low': return '#16a34a';
    default: return '#94a3b8';
  }
}
function getRiskBg(scale: string): string {
  switch (scale) {
    case 'Critical': return 'rgba(220,38,38,0.1)';
    case 'High': return 'rgba(245,158,11,0.1)';
    case 'Medium': return 'rgba(234,179,8,0.1)';
    case 'Low': return 'rgba(22,163,74,0.1)';
    default: return 'rgba(148,163,184,0.1)';
  }
}

export default function RiskGuidePage() {
  const params = useParams();
  const auth = useAuth();
  const companyId = params.id as string;
  const company = COMPANIES.find(c => c.id === companyId);
  const isLoggedIn = auth.isAdmin || auth.getCompanyAuth(companyId).isLoggedIn;
  const [activeSection, setActiveSection] = useState('overview');

  const sValues = [1, 2, 4, 8, 15];
  const pValues = [1, 2, 3, 4, 5];
  const sLabels = ['FAC\n(1)', 'MTC\n(2)', 'RWC/LTI\n(4)', 'Life Alt.\n(8)', 'Fatal\n(15)'];
  const sThaiLabels = ['ปฐมพยาบาล', 'รักษาพยาบาล', 'หยุดงาน', 'พิการถาวร', 'เสียชีวิต'];
  const pLabels = ['แทบไม่เกิด', 'ไม่น่าเกิด', 'อาจเกิดได้', 'มีโอกาสสูง', 'คาดว่าจะเกิด'];

  const cardStyle: React.CSSProperties = {
    padding: 24, borderRadius: 16, border: '1px solid var(--border)',
    marginBottom: 24, background: 'var(--card-solid, #fff)',
  };
  const headingStyle: React.CSSProperties = {
    fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
  };
  const subHeadStyle: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 16,
  };
  const paraStyle: React.CSSProperties = {
    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12,
  };
  const listStyle: React.CSSProperties = {
    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, marginBottom: 12,
  };
  const stepBadge = (num: string, color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: '50%', background: color,
    color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
  });

  if (!company) {
    return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8">ไม่พบบริษัท</main></div>;
  }

  // Login gate omitted for guide page — allow viewing without login
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Back */}
          <Link href={`/company/${companyId}/risk`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: '#5856d6', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> กลับทะเบียนความเสี่ยง
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)' }}>
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                คู่มือการประเมินความเสี่ยง (Risk Assessment Guide)
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Task Risk Management — กระบวนการ 6 ขั้นตอน
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
            {/* ── Sidebar Nav ── */}
            <div className="hidden lg:block">
              <nav style={{ position: 'sticky', top: 20 }}>
                <div style={{ ...cardStyle, padding: 12, marginBottom: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px', marginBottom: 4 }}>สารบัญ</p>
                  {SECTIONS.map(s => {
                    const Icon = s.icon;
                    const isActive = activeSection === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveSection(s.id);
                          document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="w-full text-left flex items-center gap-2 rounded-lg"
                        style={{
                          padding: '8px 10px', fontSize: 12, fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#5856d6' : 'var(--text-secondary)',
                          background: isActive ? 'rgba(88,86,214,0.08)' : 'transparent',
                          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <Icon size={14} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </nav>
            </div>

            {/* ── Content ── */}
            <div>
              {/* OVERVIEW */}
              <div id="section-overview" style={cardStyle}>
                <h2 style={headingStyle}>
                  <BookOpen size={22} style={{ color: '#5856d6' }} />
                  ภาพรวมระบบการประเมินความเสี่ยง (Overview)
                </h2>
                <p style={paraStyle}>
                  ระบบการประเมินความเสี่ยงของงาน (Task Risk Management) เป็นกระบวนการที่ใช้ในการ
                  ระบุอันตราย ประเมินระดับความเสี่ยง และกำหนดมาตรการควบคุมเพื่อลดความเสี่ยงให้อยู่ในระดับที่ยอมรับได้
                  โดยใช้วิธีการ 6 ขั้นตอนตามหลักสากล
                </p>

                <div style={subHeadStyle}>วัตถุประสงค์ของการประเมินความเสี่ยง</div>
                <ul style={listStyle}>
                  <li>เพื่อระบุอันตราย (Hazards) ที่อาจเกิดขึ้นจากกิจกรรมการทำงาน</li>
                  <li>เพื่อประเมินระดับความเสี่ยง (Risk Level) จากอันตรายที่พบ</li>
                  <li>เพื่อกำหนดมาตรการควบคุม (Control Measures) ที่เหมาะสม</li>
                  <li>เพื่อลดความเสี่ยงให้อยู่ในระดับที่ยอมรับได้ (ALARP — As Low As Reasonably Practicable)</li>
                  <li>เพื่อสร้างบันทึกเป็นหลักฐานและใช้ในการทบทวนอย่างต่อเนื่อง</li>
                </ul>

                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(88,86,214,0.06)', border: '1px solid rgba(88,86,214,0.15)', marginTop: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#5856d6', marginBottom: 6 }}>สูตรคำนวณความเสี่ยง</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', padding: '8px 0' }}>
                    RL (Risk Level) = S (Severity) × P (Probability)
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    ระดับความเสี่ยง = ความรุนแรง × โอกาสที่จะเกิด
                  </p>
                </div>
              </div>

              {/* WORKFLOW */}
              <div id="section-workflow" style={cardStyle}>
                <h2 style={headingStyle}>
                  <ClipboardList size={22} style={{ color: '#5856d6' }} />
                  ขั้นตอนการใช้งานระบบ
                </h2>
                <p style={paraStyle}>ขั้นตอนการทำงานในระบบประเมินความเสี่ยง:</p>

                {[
                  { step: '1', color: '#5856d6', title: 'เพิ่มงาน (Task) ในทะเบียนความเสี่ยง', desc: 'กำหนดชื่องาน, แผนก, พื้นที่, ตำแหน่งงาน, ขั้นตอนการทำงาน, ผู้รับผิดชอบ' },
                  { step: '2', color: '#3b82f6', title: 'เข้าหน้าประเมิน (RA Form) ของแต่ละงาน', desc: 'คลิกที่รายการงานในทะเบียน จะเข้าสู่แบบฟอร์มประเมินความเสี่ยง 6 ขั้นตอน' },
                  { step: '3', color: '#dc2626', title: 'เพิ่มอันตราย (Hazard) ที่เกี่ยวข้องกับงาน', desc: 'ระบุประเภทอันตราย, รายละเอียด, มาตรการควบคุมปัจจุบัน' },
                  { step: '4', color: '#f59e0b', title: 'ประเมินความรุนแรง (S) × โอกาสเกิด (P)', desc: 'เลือกค่า S และ P จาก dropdown ระบบจะคำนวณ Risk Level อัตโนมัติ' },
                  { step: '5', color: '#16a34a', title: 'กำหนดมาตรการควบคุมใหม่', desc: 'ระบุมาตรการเพิ่มเติม เลือกประเภทการควบคุมตาม Hierarchy of Controls' },
                  { step: '6', color: '#8b5cf6', title: 'ประเมินความเสี่ยงคงเหลือ (Residual Risk)', desc: 'ระบุ S₂ × P₂ หลังดำเนินมาตรการ ตรวจสอบว่าอยู่ในระดับที่ยอมรับได้' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3" style={{ padding: '12px 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                    <span style={stepBadge(item.step, item.color)}>{item.step}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
                  <p style={{ fontSize: 12, color: '#166534' }}>
                    <strong>สถานะอัตโนมัติ:</strong> เมื่อเพิ่มอันตรายแล้ว สถานะจะเปลี่ยนเป็น &quot;กำลังดำเนินการ&quot; อัตโนมัติ
                    เมื่อทุกอันตรายถูกทำเครื่องหมาย &quot;เสร็จสิ้น&quot; สถานะจะเปลี่ยนเป็น &quot;เสร็จสิ้น (Completed)&quot;
                  </p>
                </div>
              </div>

              {/* STEP 1 */}
              <div id="section-step1" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('1', '#5856d6')}>1</span>
                  กำหนดขอบเขตของงาน (Determine the Limits of the Task)
                </h2>
                <p style={paraStyle}>
                  ขั้นตอนแรกคือการกำหนดขอบเขตของงานที่จะประเมิน โดยระบุข้อมูลพื้นฐานที่จำเป็นเพื่อให้เข้าใจบริบทของงานอย่างชัดเจน
                </p>
                <div style={subHeadStyle}>ข้อมูลที่ต้องระบุ</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'แผนก (Department)', desc: 'แผนกหรือหน่วยงานที่รับผิดชอบ' },
                    { label: 'พื้นที่ (Working Area)', desc: 'สถานที่ทำงานจริง' },
                    { label: 'ตำแหน่งงาน (Work Position)', desc: 'ตำแหน่งผู้ปฏิบัติงาน' },
                    { label: 'ขั้นตอน (Process Stage)', desc: 'ขั้นตอนในกระบวนการผลิต' },
                    { label: 'เครื่องจักร (Machine)', desc: 'เครื่องจักรที่เกี่ยวข้อง' },
                    { label: 'จุดเริ่มต้น — จุดสิ้นสุด', desc: 'ขอบเขตเริ่มต้นและสิ้นสุดของงาน' },
                    { label: 'ผู้ที่เสี่ยง (Persons at Risk)', desc: 'ผู้ที่อาจได้รับผลกระทบ' },
                    { label: 'ผู้รับผิดชอบ (Responsible)', desc: 'ผู้รับผิดชอบการประเมิน' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 2 */}
              <div id="section-step2" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('2', '#dc2626')}>2</span>
                  ระบุอันตราย (Hazard Identification)
                </h2>
                <p style={paraStyle}>
                  ขั้นตอนนี้คือการระบุอันตราย (Hazard) ทั้งหมดที่อาจเกิดขึ้นจากงานที่กำลังประเมิน
                  โดยพิจารณาจากสภาพแวดล้อม เครื่องจักร วัสดุ และพฤติกรรมการทำงาน
                </p>
                <div style={subHeadStyle}>ประเภทอันตราย (Hazard Categories)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 8, marginBottom: 16 }}>
                  {[
                    { cat: 'เครื่องจักร (Mechanical)', desc: 'ชิ้นส่วนเคลื่อนที่ จุดหนีบ การตัด การกระแทก', icon: '⚙️' },
                    { cat: 'ไฟฟ้า (Electrical)', desc: 'ไฟดูด ไฟลัดวงจร อาร์คไฟฟ้า', icon: '⚡' },
                    { cat: 'สารเคมี (Chemical)', desc: 'สารพิษ สารกัดกร่อน สารไวไฟ ฝุ่น ไอระเหย', icon: '🧪' },
                    { cat: 'การยศาสตร์ (Ergonomic)', desc: 'ท่าทางไม่เหมาะสม ยกของหนัก งานซ้ำซาก', icon: '🦴' },
                    { cat: 'กายภาพ (Physical)', desc: 'เสียงดัง ความร้อน ความเย็น แสง ความสั่นสะเทือน', icon: '🌡️' },
                    { cat: 'สิ่งแวดล้อม (Environmental)', desc: 'พื้นลื่น ที่สูง พื้นที่อับอากาศ สภาพอากาศ', icon: '🌍' },
                    { cat: 'การขนส่ง (Transport)', desc: 'รถยก รถบรรทุก การขนย้าย ทางเดินรถ', icon: '🚛' },
                    { cat: 'ไฟไหม้/ระเบิด (Fire/Explosion)', desc: 'แหล่งจุดติดไฟ สารไวไฟ ฝุ่นระเบิด', icon: '🔥' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {item.icon} {item.cat}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                  <p style={{ fontSize: 12, color: '#991b1b' }}>
                    <strong>สิ่งสำคัญ:</strong> ต้องระบุมาตรการควบคุมปัจจุบัน (Existing Controls) ที่มีอยู่แล้ว
                    ก่อนทำการประเมินความเสี่ยง เพราะค่า S × P จะประเมินภายใต้เงื่อนไขที่มีมาตรการปัจจุบันอยู่แล้ว
                  </p>
                </div>
              </div>

              {/* STEP 3 */}
              <div id="section-step3" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('3', '#f59e0b')}>3</span>
                  ประเมินความเสี่ยง (Risk Estimation & Evaluation)
                </h2>
                <p style={paraStyle}>
                  ประเมินระดับความเสี่ยงโดยพิจารณาจาก 2 ปัจจัย: ความรุนแรง (Severity) และ โอกาสที่จะเกิด (Probability)
                </p>

                <div style={subHeadStyle}>ความรุนแรง — Severity (S)</div>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                        {['ระดับ', 'ค่า', 'ความหมาย (ไทย)', 'Severity Level', 'ตัวอย่าง'].map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { level: 'S1', score: 1, th: 'ปฐมพยาบาล', en: 'First Aid Case (FAC)', ex: 'บาดแผลเล็กน้อย รอยขีดข่วน' },
                        { level: 'S2', score: 2, th: 'รักษาพยาบาล', en: 'Medical Treatment (MTC)', ex: 'ต้องพบแพทย์ เย็บแผล กระดูกร้าว' },
                        { level: 'S3/S4', score: 4, th: 'หยุดงาน', en: 'Restricted Work / Lost Time (RWC/LTI)', ex: 'บาดเจ็บต้องหยุดงาน ย้ายงาน' },
                        { level: 'S5', score: 8, th: 'พิการถาวร', en: 'Life Altering', ex: 'สูญเสียอวัยวะ สายตา การได้ยิน' },
                        { level: 'S6', score: 15, th: 'เสียชีวิต', en: 'Fatality', ex: 'เสียชีวิตจากอุบัติเหตุ' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#5856d6' }}>{row.level}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>{row.score}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.th}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{row.en}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>{row.ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={subHeadStyle}>โอกาสที่จะเกิด — Probability (P)</div>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                        {['ระดับ', 'ค่า', 'ความหมาย (ไทย)', 'Probability Level', 'ความถี่โดยประมาณ'].map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { level: 'P1', score: 1, th: 'แทบไม่เกิด', en: 'Highly Unlikely', freq: 'น้อยกว่า 1 ใน 10,000 ครั้ง' },
                        { level: 'P2', score: 2, th: 'ไม่น่าเกิด', en: 'Unlikely', freq: 'น้อยกว่า 1 ใน 1,000 ครั้ง' },
                        { level: 'P3', score: 3, th: 'อาจเกิดได้', en: 'Possible', freq: 'น้อยกว่า 1 ใน 100 ครั้ง' },
                        { level: 'P4', score: 4, th: 'มีโอกาสสูง', en: 'Very Likely', freq: 'น้อยกว่า 1 ใน 10 ครั้ง' },
                        { level: 'P5', score: 5, th: 'คาดว่าจะเกิด', en: 'Expectable', freq: 'มากกว่า 50% (เกิดบ่อย)' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#5856d6' }}>{row.level}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>{row.score}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.th}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{row.en}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>{row.freq}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* STEP 4 */}
              <div id="section-step4" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('4', '#16a34a')}>4</span>
                  ลดความเสี่ยง (Risk Reduction)
                </h2>
                <p style={paraStyle}>
                  เมื่อระดับความเสี่ยงอยู่ในระดับที่ไม่ยอมรับได้ (Medium ขึ้นไป) ต้องกำหนดมาตรการเพิ่มเติมเพื่อลดความเสี่ยง
                  โดยเลือกตามลำดับขั้นการควบคุม (Hierarchy of Controls) จากระดับที่มีประสิทธิภาพสูงสุดก่อน
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
                  {[
                    { range: '1-4', scale: 'ต่ำ (Low)', color: '#16a34a', bg: getRiskBg('Low'), action: 'ยอมรับได้ — ทบทวนตามแผนจัดการความเสี่ยงปกติ' },
                    { range: '5-8', scale: 'ปานกลาง (Medium)', color: '#eab308', bg: getRiskBg('Medium'), action: 'ต้องมีมาตรการ — ติดตามความคืบหน้าอย่างต่อเนื่อง' },
                    { range: '10-30', scale: 'สูง (High)', color: '#f59e0b', bg: getRiskBg('High'), action: 'ต้องดำเนินการทันที — ลดด้วยการกำจัด/ทดแทน/วิศวกรรม' },
                    { range: '32-75', scale: 'วิกฤต (Critical)', color: '#dc2626', bg: getRiskBg('Critical'), action: 'หยุดงานทันที — จนกว่าจะมีมาตรการที่เพียงพอ' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: item.bg, border: `1px solid ${item.color}25` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded-lg px-2 py-0.5 text-white text-xs font-bold" style={{ background: item.color }}>{item.scale}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.color }}>RL {item.range}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 5 */}
              <div id="section-step5" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('5', '#8b5cf6')}>5</span>
                  กำหนดมาตรการควบคุม (Determine Control Measures)
                </h2>
                <p style={paraStyle}>
                  กำหนดมาตรการควบคุมเพิ่มเติม โดยเลือกประเภทการควบคุมตามลำดับขั้น Hierarchy of Controls
                  สามารถเพิ่มได้หลายมาตรการต่อหนึ่งอันตราย พร้อมกำหนดผู้รับผิดชอบและกำหนดเสร็จ
                </p>
                <p style={paraStyle}>
                  หลังจากดำเนินมาตรการแล้ว ให้ประเมินความเสี่ยงคงเหลือ (Residual Risk) โดยกำหนดค่า
                  ความรุนแรงคงเหลือ (S₂) และ โอกาสเกิดคงเหลือ (P₂) เพื่อตรวจสอบว่าความเสี่ยงลดลงอยู่ในระดับที่ยอมรับได้
                </p>
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <p style={{ fontSize: 12, color: '#6d28d9' }}>
                    <strong>ความเสี่ยงคงเหลือ (Residual Risk):</strong> RRL = S₂ × P₂ — ถ้า RRL ยังอยู่ในระดับ High หรือ Critical
                    ต้องกำหนดมาตรการเพิ่มเติมจนกว่าจะอยู่ในระดับที่ยอมรับได้
                  </p>
                </div>
              </div>

              {/* STEP 6 */}
              <div id="section-step6" style={cardStyle}>
                <h2 style={headingStyle}>
                  <span style={stepBadge('6', '#16a34a')}>6</span>
                  ติดตามผลและทบทวน (Monitor Effectiveness & Review)
                </h2>
                <p style={paraStyle}>
                  ขั้นตอนสุดท้ายคือการติดตามว่ามาตรการควบคุมที่กำหนดไว้ได้ดำเนินการจริงหรือไม่
                  และทบทวนการประเมินเป็นระยะ หรือเมื่อมีเหตุการณ์เปลี่ยนแปลง
                </p>
                <div style={subHeadStyle}>ควรทบทวนการประเมินเมื่อ</div>
                <ul style={listStyle}>
                  <li>มีอุบัติเหตุ/เหตุการณ์เกือบเกิด (Near Miss) เกิดขึ้น</li>
                  <li>มีการเปลี่ยนแปลงกระบวนการ เครื่องจักร หรือวัตถุดิบ</li>
                  <li>มีข้อร้องเรียนด้านความปลอดภัย</li>
                  <li>ครบกำหนดทบทวนตามแผน (Next Review Date)</li>
                  <li>มีพนักงานใหม่หรือเปลี่ยนตำแหน่งงาน</li>
                  <li>มีกฎหมาย/มาตรฐานใหม่ที่เกี่ยวข้อง</li>
                </ul>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 8 }}>
                  {[
                    { label: 'รอดำเนินการ (Pending)', color: '#6b7280', desc: 'สร้างงานแล้ว ยังไม่เริ่มประเมิน' },
                    { label: 'กำลังดำเนินการ (In Progress)', color: '#3b82f6', desc: 'กำลังระบุอันตรายและกำหนดมาตรการ' },
                    { label: 'เสร็จสิ้น (Completed)', color: '#16a34a', desc: 'ดำเนินมาตรการครบทุกข้อแล้ว' },
                    { label: 'หมดอายุ (Outdated)', color: '#dc2626', desc: 'ครบกำหนดทบทวน ต้องประเมินใหม่' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${item.color}30`, background: `${item.color}08` }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 2 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* RISK MATRIX */}
              <div id="section-matrix" style={cardStyle}>
                <h2 style={headingStyle}>
                  <BarChart3 size={22} style={{ color: '#f59e0b' }} />
                  ตารางความเสี่ยง (Risk Matrix) — S × P
                </h2>
                <p style={paraStyle}>
                  ตารางแสดงค่าระดับความเสี่ยง (Risk Level) จากการคูณค่าความรุนแรง (S) กับ โอกาสเกิด (P):
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', minWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 6 }}></th>
                        <th style={{ padding: 6 }}></th>
                        <th colSpan={5} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', padding: '8px 0' }}>
                          ความรุนแรง — Severity (S)
                        </th>
                      </tr>
                      <tr>
                        <th style={{ padding: 6 }}></th>
                        <th style={{ padding: 6 }}></th>
                        {sValues.map((s, i) => (
                          <th key={s} style={{ padding: '6px 10px', textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.3 }}>
                            {sThaiLabels[i]}<br /><span style={{ fontSize: 9, color: 'var(--muted)' }}>{sLabels[i].replace('\n', ' ')}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pValues.map((p, pi) => (
                        <tr key={p}>
                          {pi === 0 && (
                            <td rowSpan={5} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', padding: '0 4px', whiteSpace: 'nowrap' }}>
                              โอกาส — Probability (P)
                            </td>
                          )}
                          <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            P{p} {pLabels[pi]}
                          </td>
                          {sValues.map(s => {
                            const rl = s * p;
                            const scale = getRiskScale(rl);
                            return (
                              <td key={s} style={{
                                padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 15,
                                color: '#fff', background: getRiskColor(scale),
                                borderRadius: 8, minWidth: 48,
                              }}>
                                {rl}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {[
                    { scale: 'ต่ำ (Low)', range: '1-4', color: '#16a34a' },
                    { scale: 'ปานกลาง (Medium)', range: '5-8', color: '#eab308' },
                    { scale: 'สูง (High)', range: '10-30', color: '#f59e0b' },
                    { scale: 'วิกฤต (Critical)', range: '32-75', color: '#dc2626' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: item.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.scale} ({item.range})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HIERARCHY OF CONTROLS */}
              <div id="section-hierarchy" style={cardStyle}>
                <h2 style={headingStyle}>
                  <HardHat size={22} style={{ color: '#16a34a' }} />
                  ลำดับขั้นการควบคุม (Hierarchy of Controls)
                </h2>
                <p style={paraStyle}>
                  เมื่อกำหนดมาตรการควบคุมใหม่ ให้เลือกตามลำดับจากมีประสิทธิภาพสูงสุด (กำจัด) ไปต่ำสุด (PPE):
                </p>

                {[
                  { priority: 1, value: 'กำจัด (Elimination)', color: '#16a34a', desc: 'กำจัดอันตรายออกไปทั้งหมด', example: 'เลิกใช้สารเคมีอันตราย, ออกแบบเครื่องจักรใหม่ที่ไม่มีจุดหนีบ', effectiveness: 'สูงสุด — ดีที่สุด' },
                  { priority: 2, value: 'ทดแทน (Substitution)', color: '#22c55e', desc: 'แทนที่ด้วยสิ่งที่อันตรายน้อยกว่า', example: 'เปลี่ยนจากสารเคมีพิษเป็นสารที่ปลอดภัยกว่า, ใช้เครื่องจักรที่ปลอดภัยกว่า', effectiveness: 'สูง' },
                  { priority: 3, value: 'วิศวกรรม (Engineering Controls)', color: '#3b82f6', desc: 'ออกแบบระบบเพื่อแยกคนจากอันตราย', example: 'ติดตั้งการ์ดเครื่องจักร, ระบบระบายอากาศ, ฉากกั้น, สัญญาณเตือน', effectiveness: 'ปานกลาง-สูง' },
                  { priority: 4, value: 'บริหารจัดการ (Administrative Controls)', color: '#f59e0b', desc: 'เปลี่ยนวิธีการทำงานของคน', example: 'ฝึกอบรม, ขั้นตอนปฏิบัติงาน (SOP), ป้ายเตือน, จำกัดเวลาทำงาน', effectiveness: 'ปานกลาง' },
                  { priority: 5, value: 'อุปกรณ์ป้องกัน (PPE)', color: '#dc2626', desc: 'ป้องกันเฉพาะตัวบุคคล', example: 'หมวกนิรภัย, ถุงมือ, แว่นตา, รองเท้า Safety, ที่อุดหู', effectiveness: 'ต่ำสุด — ทางเลือกสุดท้าย' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4" style={{
                    padding: '16px 20px', borderRadius: 12, marginBottom: 10,
                    background: `${item.color}08`, border: `1px solid ${item.color}20`,
                  }}>
                    <div style={{
                      minWidth: 40, height: 40, borderRadius: '50%', background: item.color,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, flexShrink: 0,
                    }}>
                      {item.priority}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: item.color, marginBottom: 4 }}>
                        {item.value}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4, fontWeight: 500 }}>{item.desc}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong>ตัวอย่าง:</strong> {item.example}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        ประสิทธิภาพ: {item.effectiveness}
                      </p>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>กำจัด</span>
                    <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>ทดแทน</span>
                    <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>วิศวกรรม</span>
                    <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>บริหาร</span>
                    <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>PPE</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    เลือกจากซ้าย (ประสิทธิภาพสูง) ไปขวา (ประสิทธิภาพต่ำ) ตามลำดับ
                  </p>
                </div>
              </div>

              {/* Quick Start Button */}
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <Link
                  href={`/company/${companyId}/risk`}
                  className="inline-flex items-center gap-2 rounded-xl text-white font-semibold"
                  style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)', textDecoration: 'none', fontSize: 14 }}
                >
                  <Eye size={18} /> เริ่มประเมินความเสี่ยง
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
