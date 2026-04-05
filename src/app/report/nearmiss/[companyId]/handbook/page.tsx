'use client';

/**
 * Near Miss Handbook — /report/nearmiss/[companyId]/handbook
 * คู่มือ Near Miss สำหรับพนักงาน
 * - ไม่ต้อง login
 * - เนื้อหาวิเคราะห์จากตำราอ้างอิง 4 เล่ม
 * - แบ่ง sections: ความหมาย, ทำไมต้องรายงาน, ประเภท, ขั้นตอน, สิ่งที่ต้องรายงาน, FAQ
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { COMPANIES } from '@/lib/companies';
import {
  BookOpen, AlertTriangle, ClipboardList, ShieldCheck, HelpCircle,
  ChevronDown, ChevronRight, Eye, Target, Users, Layers,
  ArrowRight, CheckCircle, XCircle, Lightbulb, FileText, Link2
} from 'lucide-react';

/* ── Section IDs ── */
const SECTIONS = [
  { id: 'definition', label: 'Near Miss คืออะไร', icon: BookOpen },
  { id: 'why', label: 'ทำไมต้องรายงาน', icon: Target },
  { id: 'types', label: 'ประเภทของ Near Miss', icon: Layers },
  { id: 'process', label: 'ขั้นตอนการรายงาน', icon: ClipboardList },
  { id: 'roles', label: 'บทบาทหน้าที่', icon: Users },
  { id: 'risk', label: 'การประเมินความเสี่ยง', icon: AlertTriangle },
  { id: 'culture', label: 'วัฒนธรรมการรายงาน', icon: ShieldCheck },
  { id: 'faq', label: 'คำถามที่พบบ่อย', icon: HelpCircle },
] as const;

/* ── Style constants ── */
const pageWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 50%, #f0f9ff 100%)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  padding: '24px',
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#111827',
  margin: '0 0 16px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const bodyText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.8,
  color: '#374151',
  margin: '0 0 12px 0',
};

const highlightBox = (color: string, bgColor: string): React.CSSProperties => ({
  padding: '14px 18px',
  borderRadius: 12,
  background: bgColor,
  borderLeft: `4px solid ${color}`,
  marginBottom: 14,
});

const stepCircle = (color: string): React.CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: color,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 15,
  flexShrink: 0,
});

/* ── FAQ data ── */
const FAQ_DATA = [
  {
    q: 'Near Miss กับอุบัติเหตุต่างกันอย่างไร?',
    a: 'Near Miss คือเหตุการณ์ที่เกือบจะเกิดการบาดเจ็บหรือความเสียหาย แต่ "โชคดี" ที่ไม่เกิดขึ้น ขณะที่อุบัติเหตุ (Accident) คือเหตุการณ์ที่ส่งผลให้เกิดการบาดเจ็บ เจ็บป่วย หรือความเสียหายต่อทรัพย์สินจริง สาเหตุพื้นฐานของทั้งสองมักเหมือนกัน',
  },
  {
    q: 'เห็นพื้นเปียกลื่นไม่มีป้ายเตือน ถือเป็น Near Miss ไหม?',
    a: 'ยังไม่ใช่ Near Miss ครับ — "พื้นเปียกไม่มีป้ายเตือน" เป็น Unsafe Condition (สภาพไม่ปลอดภัย) จะกลายเป็น Near Miss ต่อเมื่อมี "เหตุการณ์" เกิดขึ้น เช่น มีคนเดินผ่านแล้วลื่นเกือบล้มแต่ทรงตัวได้ทัน อย่างไรก็ตาม พบ Unsafe Condition ก็ควรรายงานเช่นกัน อย่ารอให้มีคนเกือบเจ็บก่อน',
  },
  {
    q: 'ใครมีหน้าที่รายงาน Near Miss?',
    a: 'พนักงานทุกคนมีหน้าที่รายงาน Near Miss เมื่อพบเห็น ไม่ว่าจะเป็นพนักงานประจำ พนักงานชั่วคราว หรือผู้รับเหมา การรายงานไม่ได้จำกัดเฉพาะเจ้าหน้าที่ความปลอดภัยเท่านั้น',
  },
  {
    q: 'รายงานแล้วจะโดนลงโทษไหม?',
    a: 'ไม่ การรายงาน Near Miss เป็นนโยบาย "ไม่ลงโทษ" (No-Blame / Just Culture) บริษัทสนับสนุนให้รายงานเพื่อป้องกันอุบัติเหตุ ไม่ใช่เพื่อหาคนผิด ผู้ที่รายงานคือผู้ที่ช่วยให้องค์กรปลอดภัยขึ้น',
  },
  {
    q: 'ต้องรายงานภายในเวลาเท่าไร?',
    a: 'ควรรายงานโดยเร็วที่สุดหลังจากเกิดเหตุการณ์ เพื่อให้ข้อมูลครบถ้วนและแม่นยำ แนะนำให้รายงานภายใน 24 ชั่วโมง',
  },
  {
    q: 'รายงานยากไหม? ต้องเขียนอะไรบ้าง?',
    a: 'ไม่ยาก แบบฟอร์มออกแบบให้ง่าย ใช้เวลาไม่ถึง 5 นาที ข้อมูลหลักที่ต้องกรอกคือ: วันเวลาเกิดเหตุ, สถานที่, เหตุการณ์ที่เกิดขึ้น, สาเหตุที่ "รอดมาได้" และถ้าเป็นไปได้ ให้ถ่ายภาพประกอบ',
  },
  {
    q: 'หลังจากรายงานแล้ว จะเกิดอะไรขึ้น?',
    a: 'ผู้ประสานงานด้านความปลอดภัยจะรับเรื่อง → ประเมินระดับความเสี่ยง → กำหนดผู้รับผิดชอบ → สอบสวนหาสาเหตุราก → ดำเนินมาตรการแก้ไข → ปิดรายการและแจ้งผลลัพธ์',
  },
  {
    q: 'สามารถรายงานแบบไม่เปิดเผยชื่อได้ไหม?',
    a: 'ได้ ช่องชื่อผู้รายงานไม่บังคับกรอก อย่างไรก็ตาม การระบุชื่อจะช่วยให้ผู้ประสานงานสามารถสอบถามข้อมูลเพิ่มเติมได้ ข้อมูลผู้รายงานจะถูกเก็บเป็นความลับ ไม่แสดงใน Board สาธารณะ',
  },
];

/* ── Near Miss Examples ── */
const NM_EXAMPLES = [
  { category: 'เหตุการณ์จากการกระทำที่ไม่ปลอดภัย (Unsafe Acts → Near Miss)', examples: ['คนขับรถโฟล์คลิฟท์เลี้ยวเร็วเกินไป เกือบชนคนเดินข้ามทาง', 'ยกของหนักด้วยมือโดยไม่ใช้อุปกรณ์ ของเกือบหล่นทับเท้า', 'ปีนบันไดโดยไม่มีผู้จับ บันไดเอียงเกือบล้ม แต่จับราวไว้ทัน'], color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  { category: 'เหตุการณ์จากสภาพไม่ปลอดภัย (Unsafe Condition → Near Miss)', examples: ['พื้นเปียกลื่น มีพนักงานเดินผ่านแล้วลื่นเกือบล้ม แต่ทรงตัวได้', 'แสงสว่างไม่พอ มีคนสะดุดสิ่งกีดขวางเกือบล้ม', 'ราวกันตกหัก มีคนพิงแล้วเกือบตกแต่ดึงตัวกลับทัน'], color: '#f97316', bg: 'rgba(249,115,22,0.06)' },
  { category: 'ความผิดพลาดของกระบวนการ (Process Failures)', examples: ['ลืมปิดวาล์วหลังเสร็จงาน แรงดันเพิ่มขึ้นเกือบระเบิดแต่ระบบนิรภัยตัดก่อน', 'ข้ามขั้นตอน Lockout/Tagout เครื่องจักรเกือบหมุนขณะมีคนซ่อม', 'ใช้เครื่องมือผิดประเภท ชิ้นงานหลุดเกือบกระเด็นโดนคน'], color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
  { category: 'เหตุการณ์อันตราย (Dangerous Occurrences)', examples: ['ของตกจากที่สูงกระแทกพื้นแต่ไม่มีคนอยู่ตรงนั้น', 'ไฟฟ้าลัดวงจรมีประกายไฟแต่ดับเองก่อนลุกลาม', 'สารเคมีรั่วซึมจากท่อ แต่ถูกพบและปิดกั้นก่อนใครสัมผัส'], color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
  { category: 'พฤติกรรมเสี่ยง (Non-Conformance / At-Risk Behavior)', examples: ['ทำงานโดยไม่สวม PPE ที่กำหนด เกือบโดนเศษชิ้นงานกระเด็นเข้าตา', 'ทำงานบนที่สูงโดยไม่คาดเข็มขัดนิรภัย เกือบเสียหลัก', 'ใช้โทรศัพท์ขณะขับรถในโรงงาน เกือบชนเสาแต่เบรกทัน'], color: '#059669', bg: 'rgba(5,150,105,0.06)' },
];

/* ── Risk Matrix data ── */
const RISK_MATRIX = {
  probLabels: ['1 – แทบไม่เกิด', '2 – ไม่น่าจะเกิด', '3 – อาจเกิดได้', '4 – น่าจะเกิด', '5 – เกิดแน่นอน'],
  sevLabels:  ['1 – เล็กน้อย', '2 – พอประมาณ', '3 – ปานกลาง', '4 – รุนแรง', '5 – รุนแรงมาก'],
};

function riskColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 15) return { bg: '#ef4444', text: '#fff', label: 'สูง (HIGH)' };
  if (score >= 9)  return { bg: '#f97316', text: '#fff', label: 'ค่อนข้างสูง (MED-HIGH)' };
  if (score >= 4)  return { bg: '#eab308', text: '#000', label: 'ปานกลาง (MEDIUM)' };
  return { bg: '#22c55e', text: '#fff', label: 'ต่ำ (LOW)' };
}

/* ── Component ── */
export default function NearMissHandbookPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const company = COMPANIES.find(c => c.id === companyId);
  const [activeSection, setActiveSection] = useState('definition');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!company) {
    return (
      <div style={pageWrap}>
        <p style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>ไม่พบข้อมูลบริษัท</p>
      </div>
    );
  }

  return (
    <>
      <meta name="robots" content="noindex,nofollow" />
      <div style={pageWrap}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 60px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                <BookOpen size={22} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>คู่มือ Near Miss</h1>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{company.name} — คู่มือสำหรับพนักงาน</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: '#007aff', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}>
                <FileText size={14} /> รายงาน Near Miss
              </button>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}/board`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <Eye size={14} /> ดู Board
              </button>
              <button onClick={copyLink}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <Link2 size={13} /> {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </div>

          {/* ── Navigation pills ── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '20px 0', padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${isActive ? '#6366f1' : '#e5e7eb'}`, background: isActive ? 'rgba(99,102,241,0.08)' : '#fff', color: isActive ? '#6366f1' : '#6b7280', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <Icon size={13} /> {s.label}
                </button>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 1 — Near Miss คืออะไร
             ═══════════════════════════════════════════════════════ */}
          <div id="definition" style={cardStyle}>
            <h2 style={sectionTitle}>
              <BookOpen size={20} color="#6366f1" /> Near Miss คืออะไร?
            </h2>

            <div style={highlightBox('#6366f1', 'rgba(99,102,241,0.06)')}>
              <p style={{ ...bodyText, fontWeight: 700, color: '#4338ca', margin: 0 }}>
                Near Miss (เหตุการณ์เฉียดอันตราย) คือ เหตุการณ์ที่ไม่ได้ก่อให้เกิดการบาดเจ็บ เจ็บป่วย หรือความเสียหายต่อทรัพย์สิน
                แต่มีศักยภาพที่จะทำให้เกิดได้ หากสถานการณ์เปลี่ยนแปลงเพียงเล็กน้อย
              </p>
            </div>

            <p style={bodyText}>
              พูดง่ายๆ คือ &quot;เกือบเกิดอุบัติเหตุ&quot; — สถานการณ์ที่ &quot;โชคดี&quot; ที่ไม่มีใครเจ็บ ไม่มีอะไรเสียหาย
              แต่ถ้าเกิดซ้ำอีกครั้ง อาจไม่ได้โชคดีเสมอไป
            </p>

            {/* ── Pyramid ── */}
            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textAlign: 'center' }}>
                🔺 สามเหลี่ยมอุบัติเหตุ (Accident Triangle) โดย Frank E. Bird
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {[
                  { label: 'เสียชีวิต / บาดเจ็บรุนแรง', ratio: '1', w: 100, bg: '#ef4444' },
                  { label: 'บาดเจ็บเล็กน้อย', ratio: '10', w: 180, bg: '#f97316' },
                  { label: 'ความเสียหายต่อทรัพย์สิน', ratio: '30', w: 260, bg: '#eab308' },
                  { label: 'Near Miss / เหตุการณ์เฉียดอันตราย', ratio: '600', w: 360, bg: '#6366f1' },
                ].map((tier, i) => (
                  <div key={i} style={{ width: Math.min(tier.w, 340), maxWidth: '100%', padding: '10px 16px', background: tier.bg, borderRadius: 8, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>
                    <span>{tier.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{tier.ratio}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                สัดส่วนโดยประมาณ — ทุก 1 อุบัติเหตุรุนแรง มี Near Miss สูงถึง 600 ครั้งที่ซ่อนอยู่
              </p>
            </div>

            <div style={highlightBox('#059669', 'rgba(5,150,105,0.06)')}>
              <p style={{ ...bodyText, margin: 0 }}>
                <strong>💡 สิ่งสำคัญ:</strong> Near Miss มีสาเหตุพื้นฐานเดียวกับอุบัติเหตุ — การรู้จักสังเกตและรายงานจึงเป็น
                โอกาสในการเรียนรู้ที่ &quot;ไม่ต้องจ่ายด้วยการบาดเจ็บ&quot;
              </p>
            </div>

            {/* ── Near Miss vs Unsafe Condition vs Hazard ── */}
            <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 14, padding: '20px', marginTop: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#92400e', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ Near Miss ≠ สภาพไม่ปลอดภัย — อย่าสับสน!
              </p>
              <p style={{ ...bodyText, marginBottom: 16 }}>
                พนักงานหลายคนมักสับสนระหว่าง 3 คำนี้ ซึ่งมีความหมายแตกต่างกัน:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Hazard */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🔶</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#92400e', margin: '0 0 4px' }}>Hazard / อันตรายแอบแฝง</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', lineHeight: 1.6 }}>
                      สิ่งที่มีศักยภาพก่อให้เกิดอันตรายซึ่ง <strong>&quot;มีอยู่แล้ว&quot;</strong> ในสภาพแวดล้อม ยังไม่มีเหตุการณ์เกิดขึ้น
                    </p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
                      ตัวอย่าง: สายไฟชำรุดที่ยังไม่มีใครสัมผัส, บันไดผุแต่ยังไม่มีใครใช้, สารเคมีเก็บผิดที่แต่ยังไม่มีใครเปิด
                    </p>
                  </div>
                </div>

                {/* Unsafe Condition */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🟠</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', margin: '0 0 4px' }}>Unsafe Condition / สภาพการณ์ที่ไม่ปลอดภัย</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', lineHeight: 1.6 }}>
                      <strong>&quot;สถานะ&quot;</strong> ของสภาพแวดล้อมที่เบี่ยงเบนไปจากมาตรฐานความปลอดภัย เป็นเงื่อนไขที่อาจนำไปสู่อุบัติเหตุ
                      แต่ยังไม่มี &quot;เหตุการณ์&quot; ที่เกือบทำให้เกิดอันตรายเกิดขึ้น
                    </p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
                      ตัวอย่าง: พื้นเปียกลื่นไม่มีป้ายเตือน (แต่ยังไม่มีใครลื่น), ราวกันตกหัก (แต่ยังไม่มีใครเดินมา), แสงสว่างไม่พอ (แต่ยังไม่มีใครสะดุด)
                    </p>
                  </div>
                </div>

                {/* Near Miss */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '2px solid #6366f1' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🔴</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#4338ca', margin: '0 0 4px' }}>Near Miss / เหตุการณ์เฉียดอันตราย ✅</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', lineHeight: 1.6 }}>
                      ต้องมี <strong>&quot;เหตุการณ์&quot; เกิดขึ้นจริง</strong> — มีลำดับเหตุการณ์ (sequence of events) ที่กำลังพัฒนาไปสู่อันตราย
                      แต่ถูกหยุดยั้งก่อนจะเกิดการบาดเจ็บหรือความเสียหาย ไม่ว่าจะด้วยโชค หรือการแก้ไขของคนหรือระบบ
                    </p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
                      ตัวอย่าง: พื้นเปียก + <strong>มีคนลื่นเกือบล้ม</strong>แต่ทรงตัวได้, ของตกจากที่สูง + <strong>ตกลงมาถึงพื้น</strong>แต่ไม่มีคนอยู่ตรงนั้น, รถโฟล์คลิฟท์ <strong>เกือบชนคนเดินข้ามทาง</strong>แต่เบรกทัน
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual flow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef3c7', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Hazard (สิ่งอันตราย)</div>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>→</span>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#ffedd5', fontSize: 12, fontWeight: 700, color: '#c2410c' }}>Unsafe Condition (สภาพไม่ปลอดภัย)</div>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>→</span>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#e0e7ff', fontSize: 12, fontWeight: 700, color: '#4338ca', border: '2px solid #6366f1' }}>Near Miss (เกือบเกิดเหตุ)</div>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>→</span>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef2f2', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Accident (อุบัติเหตุ)</div>
              </div>

              <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>
                  <strong>🔑 จำง่ายๆ:</strong> Near Miss ต้องมี <strong>&quot;เหตุการณ์&quot;</strong> เกิดขึ้น ไม่ใช่แค่ &quot;สภาพ&quot; ที่มีอยู่
                  — แต่ถ้าพบ Unsafe Condition ก็ควรรายงานเช่นกัน เพราะรอไว้อาจกลายเป็น Near Miss หรืออุบัติเหตุได้
                </p>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 2 — ทำไมต้องรายงาน
             ═══════════════════════════════════════════════════════ */}
          <div id="why" style={cardStyle}>
            <h2 style={sectionTitle}>
              <Target size={20} color="#f97316" /> ทำไมต้องรายงาน Near Miss?
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              {[
                { icon: '🛡️', title: 'ป้องกันอุบัติเหตุล่วงหน้า', desc: 'Near Miss คือสัญญาณเตือนก่อนเกิดเหตุร้ายแรง เราแก้ไขได้ก่อนที่ใครจะเจ็บตัว' },
                { icon: '📊', title: 'ข้อมูลเชิงรุก (Proactive Data)', desc: 'แทนที่จะรอให้เกิดอุบัติเหตุแล้วค่อยสอบสวน เราวิเคราะห์จากเหตุการณ์ Near Miss ได้ทันที' },
                { icon: '🎯', title: 'ค้นหาสาเหตุราก (Root Cause)', desc: 'Near Miss หลายครั้งมีสาเหตุพื้นฐานเดียวกัน — ช่วยชี้ให้เห็นจุดอ่อนของระบบ' },
                { icon: '💰', title: 'ลดต้นทุนความสูญเสีย', desc: 'ป้องกัน 1 อุบัติเหตุ ประหยัดค่าใช้จ่ายได้มหาศาล ทั้งค่ารักษา ค่าซ่อม และเวลาที่เสียไป' },
                { icon: '🌱', title: 'สร้างวัฒนธรรมความปลอดภัย', desc: 'เมื่อทุกคนมีส่วนร่วมรายงาน แสดงว่าองค์กรใส่ใจและให้ความสำคัญกับความปลอดภัย' },
                { icon: '📈', title: 'ปรับปรุงอย่างต่อเนื่อง', desc: 'ข้อมูล Near Miss ช่วยให้เราติดตามประสิทธิภาพของมาตรการป้องกันได้ชัดเจน' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '16px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            <div style={highlightBox('#f97316', 'rgba(249,115,22,0.06)')}>
              <p style={{ ...bodyText, margin: 0, fontWeight: 600 }}>
                ⚠️ การเพิกเฉยต่อ Near Miss เท่ากับเสียโอกาสสำคัญในการป้องกันอุบัติเหตุ —
                จากสถิติ ทุก 600 Near Miss จะนำไปสู่ 1 อุบัติเหตุรุนแรง
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 3 — ประเภทของ Near Miss
             ═══════════════════════════════════════════════════════ */}
          <div id="types" style={cardStyle}>
            <h2 style={sectionTitle}>
              <Layers size={20} color="#8b5cf6" /> ประเภทของ Near Miss พร้อมตัวอย่าง
            </h2>
            <p style={bodyText}>Near Miss มีหลากหลายรูปแบบ ต่อไปนี้คือประเภทหลักและตัวอย่างที่อาจเกิดขึ้นในที่ทำงาน:</p>

            {NM_EXAMPLES.map((cat, i) => (
              <div key={i} style={{ borderRadius: 12, border: `1px solid ${cat.color}20`, background: cat.bg, padding: '16px 18px', marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: cat.color, margin: '0 0 10px' }}>
                  {i + 1}. {cat.category}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.examples.map((ex, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                      <ArrowRight size={14} color={cat.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* ── What is / is NOT Near Miss — 3 columns ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 18 }}>
              <div style={{ borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={16} /> ไม่ใช่ Near Miss
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#6b7280' }}>
                  <span>• มีผู้บาดเจ็บจริง → เป็น <strong>อุบัติเหตุ</strong></span>
                  <span>• ทรัพย์สินเสียหายจริง → เป็น <strong>อุบัติเหตุ</strong></span>
                  <span>• สภาพปกติ ไม่มีความเสี่ยง</span>
                  <span>• ข้อร้องเรียนทั่วไปที่ไม่เกี่ยวกับความปลอดภัย</span>
                </div>
              </div>
              <div style={{ borderRadius: 12, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)', padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f97316', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> ไม่ใช่ Near Miss แต่ควรรายงาน
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#6b7280' }}>
                  <span>• พบสภาพไม่ปลอดภัยแต่ <strong>ยังไม่มีเหตุการณ์เกิดขึ้น</strong></span>
                  <span>• อุปกรณ์ชำรุดแต่ยังไม่มีใครใช้</span>
                  <span>• ป้ายเตือนหายไปแต่ยังไม่มีคนเข้าพื้นที่</span>
                  <span style={{ fontSize: 12, fontStyle: 'italic', color: '#f97316' }}>→ จัดเป็น Unsafe Condition / Hazard</span>
                </div>
              </div>
              <div style={{ borderRadius: 12, border: '2px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.04)', padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={16} /> ใช่ Near Miss ✅
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#6b7280' }}>
                  <span>• มี<strong>เหตุการณ์เกิดขึ้นจริง</strong>แต่ไม่เกิดอันตราย</span>
                  <span>• ของตก/หล่น/ลื่น/เฉี่ยว แต่ไม่โดนคน</span>
                  <span>• มีคนเกือบได้รับอันตรายแต่รอดมาได้</span>
                  <span>• ระบบ/อุปกรณ์ทำงานผิดพลาดขณะใช้งาน แต่ยังไม่เกิดความเสียหาย</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 4 — ขั้นตอนการรายงาน
             ═══════════════════════════════════════════════════════ */}
          <div id="process" style={cardStyle}>
            <h2 style={sectionTitle}>
              <ClipboardList size={20} color="#3b82f6" /> ขั้นตอนการรายงาน Near Miss
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { step: 1, title: 'พบเหตุการณ์', desc: 'สังเกตเหตุการณ์ที่เกือบก่อให้เกิดอันตราย หรือสภาพการณ์ที่ไม่ปลอดภัย', color: '#3b82f6', tip: 'ถ้าเป็นเรื่องเร่งด่วน ให้แจ้งหัวหน้างานทันทีก่อน' },
                { step: 2, title: 'บันทึกข้อเท็จจริง', desc: 'จดบันทึกหรือถ่ายภาพทันที: ใคร ที่ไหน เมื่อไร อะไร อย่างไร', color: '#8b5cf6', tip: 'รายละเอียดยิ่งมาก ยิ่งช่วยวิเคราะห์หาสาเหตุได้ดี' },
                { step: 3, title: 'กรอกแบบฟอร์ม', desc: 'เข้าแบบฟอร์มรายงาน Near Miss ออนไลน์ กรอกข้อมูล 5 ขั้นตอน', color: '#f97316', tip: 'ใช้เวลาไม่ถึง 5 นาที กรอกได้ทุกที่ทุกเวลาผ่านมือถือ' },
                { step: 4, title: 'ส่งรายงาน', desc: 'ตรวจสอบความถูกต้องแล้วกดส่ง จะได้เลขที่รายงาน (Report No.) ทันที', color: '#059669', tip: 'เก็บเลขที่รายงานไว้สำหรับติดตามสถานะใน Board' },
                { step: 5, title: 'ติดตามผล', desc: 'ดูสถานะรายงานได้ที่ Board สาธารณะ ผู้ประสานงานจะดำเนินการสอบสวนและแก้ไข', color: '#6366f1', tip: 'หากมีข้อมูลเพิ่มเติม สามารถแจ้งผู้ประสานงานได้ตลอดเวลา' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                  {/* Vertical line */}
                  {i < 4 && (
                    <div style={{ position: 'absolute', left: 17, top: 40, bottom: -4, width: 2, background: '#e5e7eb', zIndex: 0 }} />
                  )}
                  <div style={{ ...stepCircle(s.color), zIndex: 1 }}>{s.step}</div>
                  <div style={{ flex: 1, paddingBottom: 24 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '6px 0 4px' }}>{s.title}</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', lineHeight: 1.6 }}>{s.desc}</p>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: s.color, background: `${s.color}0a`, padding: '6px 10px', borderRadius: 8, fontWeight: 500 }}>
                      <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{s.tip}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,122,255,0.3)' }}>
                <FileText size={18} /> เปิดแบบฟอร์มรายงาน Near Miss
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 5 — บทบาทหน้าที่
             ═══════════════════════════════════════════════════════ */}
          <div id="roles" style={cardStyle}>
            <h2 style={sectionTitle}>
              <Users size={20} color="#059669" /> บทบาทหน้าที่ของแต่ละฝ่าย
            </h2>

            {[
              { role: 'พนักงานทุกคน', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', duties: ['สังเกตและรายงาน Near Miss ทันทีที่พบ', 'ถ่ายภาพและเก็บรายละเอียดให้ครบถ้วน', 'ดำเนินมาตรการเบื้องต้นเพื่อป้องกันอันตรายทันที (เช่น กั้นพื้นที่ ปิดเครื่องจักร)', 'ร่วมมือในการสอบสวนและให้ข้อมูลเพิ่มเติม'] },
              { role: 'หัวหน้างาน / ผู้จัดการ', color: '#f97316', bg: 'rgba(249,115,22,0.06)', duties: ['ส่งเสริมให้ลูกทีมรายงาน Near Miss อย่างเปิดเผย', 'รับเรื่องและดำเนินการแก้ไขเบื้องต้นทันที', 'สอบสวนเหตุการณ์หาสาเหตุรากร่วมกับทีมความปลอดภัย', 'ติดตามมาตรการแก้ไขจนสำเร็จ'] },
              { role: 'เจ้าหน้าที่ความปลอดภัย (จป.)', color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', duties: ['ประเมินความเสี่ยงและจัดลำดับความสำคัญ', 'สอบสวนเชิงลึกเพื่อหา Root Cause', 'กำหนดมาตรการป้องกันและตรวจสอบประสิทธิผล', 'วิเคราะห์แนวโน้มและจัดทำรายงานสรุป'] },
              { role: 'ผู้บริหารระดับสูง', color: '#059669', bg: 'rgba(5,150,105,0.06)', duties: ['กำหนดนโยบายและสนับสนุนวัฒนธรรม Just Culture', 'จัดสรรทรัพยากรสำหรับระบบรายงาน Near Miss', 'ทบทวนรายงานสรุปเป็นประจำเพื่อการตัดสินใจ', 'เป็นแบบอย่างที่ดีในเรื่องความปลอดภัย'] },
            ].map((r, i) => (
              <div key={i} style={{ borderRadius: 12, background: r.bg, padding: '16px 18px', marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: r.color, margin: '0 0 10px' }}>{r.role}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.duties.map((d, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                      <CheckCircle size={14} color={r.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 6 — การประเมินความเสี่ยง (Risk Matrix)
             ═══════════════════════════════════════════════════════ */}
          <div id="risk" style={cardStyle}>
            <h2 style={sectionTitle}>
              <AlertTriangle size={20} color="#ef4444" /> การประเมินความเสี่ยง (Risk Matrix)
            </h2>

            <p style={bodyText}>
              เมื่อรายงาน Near Miss ท่านจะต้องประเมินความเสี่ยง 2 ด้าน คือ <strong>โอกาสเกิดซ้ำ (Probability)</strong> และ <strong>ความรุนแรง (Severity)</strong> แล้วคูณกัน:
            </p>

            {/* Probability */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📊 โอกาสเกิดซ้ำ (Probability)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RISK_MATRIX.probLabels.map((label, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>💥 ความรุนแรงหากเกิดจริง (Severity)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RISK_MATRIX.sevLabels.map((label, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Risk Matrix Grid */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🎯 ตาราง Risk Matrix (Probability × Severity)</p>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>P ╲ S</th>
                    {[1,2,3,4,5].map(s => (
                      <th key={s} style={{ padding: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5,4,3,2,1].map(p => (
                    <tr key={p}>
                      <td style={{ padding: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', fontWeight: 700, textAlign: 'center', color: '#374151' }}>{p}</td>
                      {[1,2,3,4,5].map(s => {
                        const score = p * s;
                        const rc = riskColor(score);
                        return (
                          <td key={s} style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 700, background: rc.bg, color: rc.text }}>
                            {score}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              {[
                { label: 'สูง (HIGH) 15–25', bg: '#ef4444' },
                { label: 'ค่อนข้างสูง (MED-HIGH) 9–14', bg: '#f97316' },
                { label: 'ปานกลาง (MEDIUM) 4–8', bg: '#eab308' },
                { label: 'ต่ำ (LOW) 1–3', bg: '#22c55e' },
              ].map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, display: 'inline-block' }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 7 — วัฒนธรรมการรายงาน
             ═══════════════════════════════════════════════════════ */}
          <div id="culture" style={cardStyle}>
            <h2 style={sectionTitle}>
              <ShieldCheck size={20} color="#22c55e" /> วัฒนธรรมการรายงาน (Just Culture)
            </h2>

            <div style={highlightBox('#22c55e', 'rgba(34,197,94,0.06)')}>
              <p style={{ ...bodyText, fontWeight: 700, color: '#059669', margin: 0 }}>
                🤝 Just Culture คือ วัฒนธรรมที่ส่งเสริมให้พนักงานรายงานข้อผิดพลาดและเหตุการณ์เฉียดอันตรายอย่างเปิดเผย
                โดยไม่ต้องกลัวถูกลงโทษ
              </p>
            </div>

            <p style={bodyText}>
              เพื่อให้ระบบรายงาน Near Miss ประสบความสำเร็จ องค์กรต้องสร้างบรรยากาศที่ทุกคนรู้สึกปลอดภัยในการรายงาน:
            </p>

            {/* Do's and Don'ts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)', padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', margin: '0 0 10px' }}>✅ สิ่งที่เราทำ</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#374151' }}>
                  <span>• ไม่ลงโทษผู้ที่รายงาน Near Miss</span>
                  <span>• ปกป้องข้อมูลส่วนตัวของผู้รายงาน</span>
                  <span>• สอบสวนหา &quot;ระบบที่ผิดพลาด&quot; ไม่ใช่ &quot;คนที่ผิด&quot;</span>
                  <span>• แจ้งผลการดำเนินการกลับให้ผู้รายงาน</span>
                  <span>• ชื่นชมและขอบคุณผู้ที่รายงาน</span>
                </div>
              </div>
              <div style={{ borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: '0 0 10px' }}>❌ สิ่งที่เราไม่ทำ</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#374151' }}>
                  <span>• ไม่ตำหนิหรือหาคนผิดจากการรายงาน</span>
                  <span>• ไม่เปิดเผยชื่อผู้รายงานสู่สาธารณะ</span>
                  <span>• ไม่เพิกเฉยต่อรายงานที่ส่งเข้ามา</span>
                  <span>• ไม่วัดผลงานจากจำนวนรายงาน Near Miss</span>
                  <span>• ไม่ทำให้ขั้นตอนรายงานยุ่งยากซับซ้อน</span>
                </div>
              </div>
            </div>

            {/* Barriers */}
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🚧 อุปสรรคที่ทำให้พนักงานไม่รายงาน</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[
                'กลัวถูกลงโทษ', 'กลัวเพื่อนร่วมงานมองไม่ดี', 'คิดว่าไม่ร้ายแรงพอ',
                'ระบบรายงานยุ่งยาก', 'ไม่เห็นผลการแก้ไข', 'ไม่รู้ว่าอะไรคือ Near Miss',
                'กลัวกระทบประเมินผลงาน', 'ไม่มีเวลา',
              ].map((barrier, i) => (
                <span key={i} style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                  {barrier}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
              องค์กรของเราตระหนักถึงอุปสรรคเหล่านี้ จึงได้ออกแบบระบบรายงานให้ง่าย รวดเร็ว สามารถรายงานแบบไม่ระบุชื่อได้
              และมีนโยบาย Just Culture ที่ชัดเจน
            </p>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 8 — FAQ
             ═══════════════════════════════════════════════════════ */}
          <div id="faq" style={cardStyle}>
            <h2 style={sectionTitle}>
              <HelpCircle size={20} color="#6366f1" /> คำถามที่พบบ่อย (FAQ)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FAQ_DATA.map((faq, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <div key={i} style={{ borderRadius: 12, border: `1.5px solid ${isOpen ? '#6366f1' : '#e5e7eb'}`, overflow: 'hidden', transition: 'all 0.15s' }}>
                    <button onClick={() => setExpandedFaq(isOpen ? null : i)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', background: isOpen ? 'rgba(99,102,241,0.04)' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: isOpen ? '#6366f1' : '#111827' }}>
                        {faq.q}
                      </span>
                      {isOpen ? <ChevronDown size={18} color="#6366f1" /> : <ChevronRight size={18} color="#9ca3af" />}
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 16px', fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Footer CTA ── */}
          <div style={{ textAlign: 'center', marginTop: 20, padding: '24px', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              พบเหตุการณ์เฉียดอันตราย? รายงานทันที!
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              ทุกรายงานของคุณช่วยให้เพื่อนร่วมงานทุกคนปลอดภัยยิ่งขึ้น
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}`, '_blank')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,122,255,0.3)' }}>
                <FileText size={18} /> รายงาน Near Miss
              </button>
              <button onClick={() => window.open(`/report/nearmiss/${companyId}/board`, '_blank')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: '2px solid #e5e7eb', background: '#fff', fontSize: 15, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>
                <Eye size={18} /> ดู Board สถานะ
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
