'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import {
  BookOpen, CheckCircle, Clock, AlertTriangle, XCircle, MinusCircle,
  ArrowRightCircle, Lock, ShieldCheck, HelpCircle, TrendingUp, Calendar,
  GraduationCap, ClipboardList, MousePointerClick, BarChart3, Table2,
  Eye, Edit3, Send, ChevronRight, Layers, LayoutDashboard, ArrowDown,
  FileText, Users, Settings, CircleDot, Star
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Visual Illustration Components (SVG-style mockups)
   ────────────────────────────────────────────── */

function IllustrationSidebar() {
  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, padding: '16px 14px',
      width: 160, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {['Dashboard', 'Action Plan', 'Training', 'คู่มือ'].map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
          background: i === 1 ? 'rgba(0,122,255,0.25)' : 'transparent',
          color: i === 1 ? '#60a5fa' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: i === 1 ? 700 : 400,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: i === 1 ? '#007aff' : 'rgba(255,255,255,0.15)' }} />
          {item}
        </div>
      ))}
    </div>
  );
}

function IllustrationDashboard() {
  return (
    <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 16, flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'เสร็จ', val: '45', color: '#34c759', bg: 'rgba(52,199,89,0.1)' },
          { label: 'เกินกำหนด', val: '3', color: '#ff3b30', bg: 'rgba(255,59,48,0.1)' },
          { label: 'แผน', val: '12', color: '#007aff', bg: 'rgba(0,122,255,0.1)' },
        ].map((card, i) => (
          <div key={i} style={{
            flex: 1, padding: '10px 8px', borderRadius: 8,
            background: card.bg, textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: card.color }}>{card.val}</div>
            <div style={{ fontSize: 9, color: card.color, fontWeight: 600 }}>{card.label}</div>
          </div>
        ))}
      </div>
      {/* Mini bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
        {[60, 80, 45, 90, 70, 55, 85, 40, 65, 75, 50, 30].map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`, borderRadius: 3,
            background: i < 4 ? '#34c759' : i < 8 ? '#007aff' : '#e5e7eb',
          }} />
        ))}
      </div>
    </div>
  );
}

function IllustrationKpiCards() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[
        { q: 'Q1', score: 4, pct: '92%', color: '#007aff' },
        { q: 'Q2', score: 5, pct: '100%', color: '#34c759' },
        { q: 'Q3', score: 3, pct: '85%', color: '#ff9500' },
        { q: 'Q4', score: '-', pct: 'อนาคต', color: '#d1d5db' },
      ].map((item, i) => (
        <div key={i} style={{
          flex: 1, textAlign: 'center', padding: '12px 6px', borderRadius: 10,
          background: i < 3 ? `${item.color}12` : '#f3f4f6',
          border: `1px solid ${i < 3 ? `${item.color}30` : '#e5e7eb'}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.q}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: i < 3 ? item.color : '#d1d5db' }}>{item.score}</div>
          <div style={{ fontSize: 9, color: i < 3 ? item.color : '#9ca3af', marginTop: 2 }}>{item.pct}</div>
        </div>
      ))}
    </div>
  );
}

function IllustrationTable({ type }: { type: 'action' | 'training' }) {
  const rows = type === 'action'
    ? [
        { no: '1.1', name: 'ตรวจสอบอุปกรณ์ PPE', m1: 'done', m2: 'done', m3: 'plan' },
        { no: '1.2', name: 'ฝึกซ้อมอพยพ', m1: 'na', m2: 'done', m3: 'overdue' },
        { no: '2.1', name: 'ตรวจวัดสิ่งแวดล้อม', m1: 'done', m2: 'plan', m3: 'plan' },
      ]
    : [
        { no: '1', name: 'Fire Safety Training', m1: 'completed', m2: '-', m3: '-' },
        { no: '2', name: 'First Aid Course', m1: '-', m2: 'scheduled', m3: '-' },
        { no: '3', name: 'Chemical Handling', m1: '-', m2: '-', m3: 'planned' },
      ];
  const statusColors: Record<string, string> = {
    done: '#34c759', completed: '#34c759', plan: '#007aff', planned: '#6b7280',
    overdue: '#ff3b30', na: '#8e8e93', scheduled: '#3b82f6',
  };
  return (
    <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', fontSize: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>#</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>กิจกรรม</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>ม.ค.</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>ก.พ.</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>มี.ค.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>{row.no}</td>
              <td style={{ padding: '6px 8px', color: '#1f2937', fontWeight: 500 }}>{row.name}</td>
              {[row.m1, row.m2, row.m3].map((s, j) => (
                <td key={j} style={{ padding: '6px 8px', textAlign: 'center' }}>
                  {s !== '-' && (
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: statusColors[s] || '#d1d5db',
                    }} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepNumber({ n, color = '#007aff' }: { n: number; color?: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0,
      boxShadow: `0 4px 14px ${color}40`,
    }}>
      {n}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Guide Page
   ────────────────────────────────────────────── */

export default function GuidePage() {
  const params = useParams();
  const companyId = params.id as string;
  const [activeTab, setActiveTab] = useState<'action-plan' | 'training'>('action-plan');

  const accentColor = activeTab === 'action-plan' ? '#5856d6' : '#34c759';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>

        {/* ════════ Hero Section ════════ */}
        <div style={{
          background: activeTab === 'action-plan'
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
            : 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          padding: '48px 32px 40px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 0.5s ease',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: `${accentColor}15` }} />
          <div style={{ position: 'absolute', bottom: -80, left: '30%', width: 260, height: 260, borderRadius: '50%', background: `${accentColor}08` }} />

          <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 24px ${accentColor}50`,
              }}>
                <BookOpen size={26} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>คู่มือการใช้งาน</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  Safety & Environment Dashboard — Step-by-Step Guide
                </p>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', maxWidth: 560 }}>
              คู่มือแนะนำขั้นตอนการใช้งานระบบอย่างละเอียด ตั้งแต่เข้าสู่ระบบจนถึงการติดตาม KPI
              ทำตามทีละขั้นตอนเพื่อให้การทำงานมีประสิทธิภาพสูงสุด
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 60px' }}>

          {/* ════════ Tab Navigation ════════ */}
          <div style={{
            display: 'flex', gap: 4, marginTop: -20, marginBottom: 36, padding: 5,
            borderRadius: 14, background: 'var(--card-solid, #fff)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            position: 'relative', zIndex: 2,
          }}>
            {([
              { key: 'action-plan' as const, label: 'แผนงานประจำปี (Action Plan)', icon: <ClipboardList size={16} />, color: '#5856d6' },
              { key: 'training' as const, label: 'แผนอบรมประจำปี (Training)', icon: <GraduationCap size={16} />, color: '#34c759' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
                  background: activeTab === tab.key
                    ? `linear-gradient(135deg, ${tab.color}15, ${tab.color}08)`
                    : 'transparent',
                  color: activeTab === tab.key ? tab.color : 'var(--text-secondary)',
                  boxShadow: activeTab === tab.key ? `inset 0 0 0 1.5px ${tab.color}30, 0 2px 8px ${tab.color}10` : 'none',
                  transition: 'all 0.25s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════ */}
          {/* ══════ TAB: ACTION PLAN ══════ */}
          {/* ══════════════════════════════════════════════ */}
          {activeTab === 'action-plan' && (<>

            {/* ── Step 1: เข้าสู่ระบบ ── */}
            <StepSection
              step={1}
              color="#5856d6"
              title="เข้าสู่ระบบ"
              subtitle="Login เข้าบริษัทของคุณ"
            >
              <p style={pStyle}>
                เปิดเว็บไซต์ระบบ แล้วคลิกเลือก<strong style={{ color: 'var(--text-primary)' }}>บริษัทของคุณ</strong>จากหน้าแรก
                จากนั้นใส่รหัสผ่านที่ได้รับจาก Admin เพื่อเข้าใช้งาน
              </p>
              {/* Visual: Login flow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                <MockScreen label="หน้าแรก" width={140}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['AAB Co.', 'BBC Co.', 'CCE Co.'].map((c, i) => (
                      <div key={i} style={{
                        padding: '6px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                        background: i === 0 ? '#5856d615' : '#f3f4f6',
                        color: i === 0 ? '#5856d6' : '#6b7280',
                        border: i === 0 ? '1px solid #5856d630' : '1px solid #e5e7eb',
                      }}>{c}</div>
                    ))}
                  </div>
                </MockScreen>
                <ChevronRight size={20} color="#d1d5db" />
                <MockScreen label="ใส่รหัสผ่าน" width={140}>
                  <div style={{ padding: '6px 8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', marginBottom: 6 }}>
                    ••••••••
                  </div>
                  <div style={{ padding: '5px 0', borderRadius: 6, background: '#5856d6', color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center' }}>
                    เข้าสู่ระบบ
                  </div>
                </MockScreen>
                <ChevronRight size={20} color="#d1d5db" />
                <MockScreen label="Dashboard" width={140}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <div style={{ flex: 1, height: 20, borderRadius: 4, background: '#34c75915', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#34c759', fontWeight: 700 }}>45</div>
                    <div style={{ flex: 1, height: 20, borderRadius: 4, background: '#ff3b3015', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#ff3b30', fontWeight: 700 }}>3</div>
                  </div>
                  <div style={{ height: 20, borderRadius: 4, background: '#f3f4f6' }} />
                </MockScreen>
              </div>
              <Tip>เมื่อ Login สำเร็จ ระบบจะนำคุณไปยังหน้า Dashboard ของบริษัทโดยอัตโนมัติ</Tip>
            </StepSection>

            {/* ── Step 2: ทำความรู้จัก Sidebar ── */}
            <StepSection
              step={2}
              color="#007aff"
              title="ทำความรู้จักเมนูด้านซ้าย"
              subtitle="Sidebar Navigation"
            >
              <p style={pStyle}>
                เมนูด้านซ้าย (Sidebar) คือตัวนำทางหลัก ใช้เลื่อนไปยังส่วนต่างๆ ของระบบ
              </p>
              <div style={{
                display: 'flex', gap: 16, marginTop: 16, marginBottom: 12,
                padding: 16, borderRadius: 12, background: '#f8f9fa', border: '1px solid #e5e7eb',
              }}>
                <IllustrationSidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: <LayoutDashboard size={14} />, label: 'Dashboard', desc: 'ภาพรวมสถานะและ KPI ทั้งหมด', color: '#5856d6' },
                    { icon: <ClipboardList size={14} />, label: 'Action Plan', desc: 'ตารางแผนงาน อัปเดตสถานะ ดู KPI รายเดือน', color: '#007aff' },
                    { icon: <GraduationCap size={14} />, label: 'Training', desc: 'แผนอบรม จัดการหลักสูตร ติดตามผล', color: '#34c759' },
                    { icon: <BookOpen size={14} />, label: 'คู่มือ', desc: 'หน้าที่คุณกำลังอ่านอยู่ตอนนี้', color: '#ff9500' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${item.color}12`, color: item.color,
                      }}>{item.icon}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </StepSection>

            {/* ── Step 3: ดู Dashboard ── */}
            <StepSection
              step={3}
              color="#34c759"
              title="ดู Dashboard ภาพรวม"
              subtitle="Summary Cards & Charts"
            >
              <p style={pStyle}>
                หน้า Dashboard แสดงภาพรวมทั้งหมดของบริษัท ประกอบด้วยการ์ดสรุป กราฟ KPI และตาราง
              </p>
              <div style={{
                display: 'flex', gap: 10, marginTop: 16, marginBottom: 12,
                padding: 16, borderRadius: 12, background: '#f8f9fa', border: '1px solid #e5e7eb',
              }}>
                <IllustrationDashboard />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  { icon: <BarChart3 size={15} />, label: 'กราฟ KPI', desc: 'แสดง % ความสำเร็จรายเดือน', color: '#007aff' },
                  { icon: <Layers size={15} />, label: 'การ์ดสรุป', desc: 'จำนวน เสร็จ / เกินกำหนด / แผน', color: '#34c759' },
                  { icon: <TrendingUp size={15} />, label: 'แนวโน้ม', desc: 'ติดตาม KPI รายไตรมาส', color: '#5856d6' },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 10,
                    background: `${item.color}08`, border: `1px solid ${item.color}20`,
                    textAlign: 'center',
                  }}>
                    <div style={{ color: item.color, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </StepSection>

            {/* ── Step 4: ตารางแผนงาน ── */}
            <StepSection
              step={4}
              color="#ff9500"
              title="ดูตารางแผนงานและอัปเดตสถานะ"
              subtitle="Action Plan Table"
            >
              <p style={pStyle}>
                ไปที่เมนู <strong style={{ color: 'var(--text-primary)' }}>Action Plan</strong> เพื่อดูตารางแผนงานทั้งหมด
                แต่ละแถวคือ 1 กิจกรรม แต่ละคอลัมน์คือ 1 เดือน คลิกที่เซลล์เพื่ออัปเดตสถานะ
              </p>
              <div style={{
                marginTop: 16, marginBottom: 12, padding: 16,
                borderRadius: 12, background: '#f8f9fa', border: '1px solid #e5e7eb',
              }}>
                <IllustrationTable type="action" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                  {[
                    { color: '#34c759', label: 'เสร็จแล้ว' },
                    { color: '#ff3b30', label: 'เกินกำหนด' },
                    { color: '#007aff', label: 'แผน' },
                    { color: '#8e8e93', label: 'N/A' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 10, background: '#007aff08', border: '1px solid #007aff20', marginBottom: 8,
              }}>
                <MousePointerClick size={18} color="#007aff" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                  <strong style={{ color: '#007aff' }}>คลิกที่เซลล์</strong> เพื่อเปิด Drawer → เลือกสถานะ → แนบหลักฐาน → กดบันทึก
                </p>
              </div>
            </StepSection>

            {/* ── Step 5: สถานะและผลต่อ KPI ── */}
            <StepSection
              step={5}
              color="#5856d6"
              title="ทำความเข้าใจสถานะ และผลต่อ KPI"
              subtitle="Statuses & KPI Impact"
            >
              <p style={pStyle}>
                สถานะของแต่ละกิจกรรมมีผลโดยตรงต่อการคำนวณ KPI รายไตรมาส ดังนี้:
              </p>

              {/* KPI Formula */}
              <div style={{
                padding: 20, borderRadius: 14, textAlign: 'center', marginTop: 16, marginBottom: 16,
                background: 'linear-gradient(135deg, #5856d608, #007aff08)',
                border: '1px solid #5856d620',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>สูตรการคำนวณ</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#5856d6' }}>
                  KPI % = เสร็จแล้ว ÷ ฐาน
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  ฐาน = รายการทั้งหมด − ยกเลิก − ไม่เข้าเงื่อนไข (N/A)
                </div>
              </div>

              {/* Status cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <StatusCard
                  icon={<CheckCircle size={14} />}
                  label="เสร็จแล้ว (Done)"
                  color="#34c759"
                  effect="นับเป็นตัวตั้ง + ตัวหาร"
                  desc="กิจกรรมดำเนินการเสร็จสิ้น ยิ่งมีเสร็จมาก คะแนนยิ่งสูง"
                />
                <StatusCard
                  icon={<AlertTriangle size={14} />}
                  label="เกินกำหนด (Overdue)"
                  color="#ff3b30"
                  effect="นับเป็นตัวหาร ไม่นับตัวตั้ง → ลด KPI"
                  desc="ยังไม่ได้ทำเมื่อพ้นกำหนด ควรติดตามแก้ไขโดยเร็ว"
                />
                <StatusCard
                  icon={<Clock size={14} />}
                  label="แผน / ยังไม่เริ่ม"
                  color="#007aff"
                  effect="นับเป็นตัวหาร"
                  desc="มีแผนแต่ยังไม่ถึงกำหนด ไม่ส่งผลเชิงลบ"
                />
                <StatusCard
                  icon={<ArrowRightCircle size={14} />}
                  label="เลื่อน (Postponed)"
                  color="#ff9500"
                  effect="ย้ายไปนับในเดือนปลายทาง"
                  desc="ถูกเลื่อนไปเดือนอื่น ไม่กระทบเดือนเดิม"
                />
                <StatusCard
                  icon={<XCircle size={14} />}
                  label="ยกเลิก (Cancelled)"
                  color="#ff3b30"
                  effect="หักออกจากฐาน → ไม่มีผลต่อ KPI"
                  desc="ต้องส่งคำขอให้ Admin อนุมัติก่อนจึงจะมีผล"
                  requiresApproval
                />
                <StatusCard
                  icon={<MinusCircle size={14} />}
                  label="ไม่เข้าเงื่อนไข (N/A)"
                  color="#8e8e93"
                  effect="หักออกจากฐาน → ไม่มีผลต่อ KPI"
                  desc="ไม่เกี่ยวข้องกับบริษัทนี้ ต้องขออนุมัติเช่นกัน"
                  requiresApproval
                />
              </div>

              {/* Scoring */}
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>เกณฑ์คะแนน KPI</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { score: 5, label: '100%', color: '#34c759' },
                    { score: 4, label: '≥ 90%', color: '#007aff' },
                    { score: 3, label: '≥ 80%', color: '#5856d6' },
                    { score: 2, label: '≥ 70%', color: '#ff9500' },
                    { score: 1, label: '< 70%', color: '#ff3b30' },
                  ].map(item => (
                    <div key={item.score} style={{
                      textAlign: 'center', padding: '10px 4px', borderRadius: 10,
                      background: `${item.color}10`, border: `1px solid ${item.color}22`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.score}</div>
                      <div style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <ExampleBox color="#34c759">
                ถ้าเดือน ม.ค. มีกิจกรรม 10 รายการ ยกเลิก 1 N/A 2 เสร็จ 5
                → ฐาน = 10 − 1 − 2 = <strong>7</strong> → KPI = 5/7 = <strong>71.4%</strong> → คะแนน <strong>3</strong>
              </ExampleBox>
            </StepSection>

            {/* ── Step 6: Deadline & Lock ── */}
            <StepSection
              step={6}
              color="#ff9500"
              title="กำหนดส่งข้อมูลและการ Lock"
              subtitle="Monthly Deadline"
            >
              <p style={pStyle}>
                เพื่อให้ข้อมูลถูกต้อง ระบบกำหนดให้อัปเดตสถานะภายในวันที่กำหนด
              </p>
              <div style={{
                padding: 24, borderRadius: 14, textAlign: 'center', marginTop: 16, marginBottom: 16,
                background: 'linear-gradient(135deg, #ff950008, #ff3b3005)',
                border: '1px solid #ff950025',
              }}>
                <Lock size={30} color="#ff9500" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: '#ff9500' }}>Deadline: วันที่ 10 ของเดือนถัดไป</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  เช่น กิจกรรมเดือน มกราคม → อัปเดตภายใน <strong style={{ color: '#ff9500' }}>10 กุมภาพันธ์</strong>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{
                  padding: 16, borderRadius: 12, background: '#34c75908', border: '1px solid #34c75920',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CheckCircle size={14} color="#34c759" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#34c759' }}>ก่อนวันที่ 10</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    อัปเดตสถานะ แนบหลักฐาน เพิ่มบันทึกได้ตามปกติ
                  </p>
                </div>
                <div style={{
                  padding: 16, borderRadius: 12, background: '#ff3b3008', border: '1px solid #ff3b3020',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Lock size={14} color="#ff3b30" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ff3b30' }}>หลังวันที่ 10</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    ระบบ Lock อัตโนมัติ ต้องส่ง Edit Request ให้ Admin
                  </p>
                </div>
              </div>
            </StepSection>

            {/* ── Step 7: Approval Workflow ── */}
            <StepSection
              step={7}
              color="#ff3b30"
              title="ส่งคำขออนุมัติ"
              subtitle="Approval Workflow"
            >
              <p style={pStyle}>
                การเปลี่ยนแปลงบางประเภทต้องได้รับอนุมัติจาก Admin ก่อนจึงจะมีผล
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, marginBottom: 16 }}>
                <ApprovalCard
                  title="คำขอยกเลิก / N/A"
                  color="#ff3b30"
                  steps={[
                    'กดเลือกสถานะ "ยกเลิก" หรือ "N/A"',
                    'กรอกเหตุผลว่าทำไมต้องเปลี่ยน',
                    'กด "ส่งคำขอ" → รอ Admin ตรวจสอบ',
                    'Admin อนุมัติ → สถานะเปลี่ยนทันที',
                  ]}
                />
                <ApprovalCard
                  title="คำขอแก้ไขหลัง Lock"
                  color="#007aff"
                  steps={[
                    'เปิด Drawer ของกิจกรรม → กดปุ่ม "ขอแก้ไข"',
                    'ระบุสถานะใหม่และเหตุผล',
                    'กด "ส่งคำขอ" → รอ Admin อนุมัติ',
                  ]}
                />
                <ApprovalCard
                  title="ขอเปลี่ยนขอบเขตแผน (มีแผน ↔ ไม่มีแผน)"
                  color="#ff9500"
                  steps={[
                    'นำออกจากแผน: ลดจำนวนรายการ กระทบฐาน KPI',
                    'เพิ่มเข้าแผน: เพิ่มจำนวนรายการ เพิ่มฐาน KPI',
                    'กรอกเหตุผล → ส่งคำขอให้ Admin พิจารณา',
                  ]}
                />
              </div>

              {/* Approval status */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { icon: <Clock size={18} />, label: 'รอดำเนินการ', desc: 'Admin ยังไม่ตรวจสอบ', color: '#ff9500' },
                  { icon: <CheckCircle size={18} />, label: 'อนุมัติแล้ว', desc: 'สถานะถูกเปลี่ยนเรียบร้อย', color: '#34c759' },
                  { icon: <XCircle size={18} />, label: 'ปฏิเสธ', desc: 'สถานะคงเดิม', color: '#ff3b30' },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: 14, borderRadius: 10,
                    background: `${s.color}08`, border: `1px solid ${s.color}18`,
                  }}>
                    <div style={{ color: s.color, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </StepSection>

            {/* ── Step 8: KPI Quarterly ── */}
            <StepSection
              step={8}
              color="#007aff"
              title="ติดตาม KPI รายไตรมาส"
              subtitle="Quarterly KPI Tracking"
            >
              <p style={pStyle}>
                ระบบรวมข้อมูลรายเดือนเป็นรายไตรมาส โดยคำนวณคะแนนจาก % ความสำเร็จรวม
              </p>
              <div style={{
                padding: 16, borderRadius: 12, background: '#f8f9fa',
                border: '1px solid #e5e7eb', marginTop: 16, marginBottom: 12,
              }}>
                <IllustrationKpiCards />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { q: 'Q1', months: 'ม.ค. — มี.ค.', color: '#007aff' },
                  { q: 'Q2', months: 'เม.ย. — มิ.ย.', color: '#34c759' },
                  { q: 'Q3', months: 'ก.ค. — ก.ย.', color: '#ff9500' },
                  { q: 'Q4', months: 'ต.ค. — ธ.ค.', color: '#5856d6' },
                ].map(item => (
                  <div key={item.q} style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: `${item.color}08`, border: `1px solid ${item.color}18` }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.q}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.months}</div>
                  </div>
                ))}
              </div>
              <Tip>คะแนน KPI ประจำปี = ค่าเฉลี่ยของ 4 ไตรมาส (เฉพาะไตรมาสที่มีข้อมูลจริง)</Tip>
            </StepSection>

            {/* ── Tips ── */}
            <TipsSection tips={[
              { tip: 'อัปเดตสถานะทันที', desc: 'ไม่ต้องรอใกล้ Deadline เมื่อกิจกรรมเสร็จให้อัปเดตทันที', icon: '⚡' },
              { tip: 'แนบหลักฐานทุกครั้ง', desc: 'เมื่อเปลี่ยนเป็น "เสร็จแล้ว" ควรแนบรูปภาพ ไฟล์ หรือลิงก์', icon: '📎' },
              { tip: 'เขียนเหตุผลชัดเจน', desc: 'เมื่อขอยกเลิกหรือ N/A ให้เขียนเหตุผลละเอียด Admin จะอนุมัติเร็วขึ้น', icon: '✍️' },
              { tip: 'ตรวจสอบ KPI ประจำ', desc: 'ดูหน้า KPI รายไตรมาสเพื่อประเมินคะแนนและวางแผน', icon: '📊' },
              { tip: 'ใช้ตัวกรอง (Filter)', desc: 'ใช้ปุ่มกรองเพื่อโฟกัสรายการที่ต้องจัดการก่อน', icon: '🔍' },
            ]} />

          </>)}

          {/* ══════════════════════════════════════════════ */}
          {/* ══════ TAB: TRAINING ══════ */}
          {/* ══════════════════════════════════════════════ */}
          {activeTab === 'training' && (<>

            {/* ── Step 1: เข้าหน้า Training ── */}
            <StepSection
              step={1}
              color="#34c759"
              title="เข้าหน้า Training"
              subtitle="เปิดเมนู แผนอบรมประจำปี"
            >
              <p style={pStyle}>
                หลัง Login แล้ว คลิกที่เมนู <strong style={{ color: 'var(--text-primary)' }}>Training</strong> ในแถบด้านซ้าย
                ระบบจะแสดงแผนอบรมทั้งหมดของบริษัทในปีนี้
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 8, flexWrap: 'wrap',
              }}>
                <MockScreen label="Sidebar" width={140}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {['Dashboard', 'Action Plan', 'Training', 'คู่มือ'].map((item, i) => (
                      <div key={i} style={{
                        padding: '5px 8px', borderRadius: 5, fontSize: 9, fontWeight: i === 2 ? 700 : 400,
                        background: i === 2 ? '#34c75920' : 'transparent',
                        color: i === 2 ? '#34c759' : '#9ca3af',
                      }}>{item}</div>
                    ))}
                  </div>
                </MockScreen>
                <ChevronRight size={20} color="#d1d5db" />
                <MockScreen label="หน้า Training" width={200}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <div style={{ flex: 1, padding: '4px 6px', borderRadius: 4, background: '#34c75910', fontSize: 8, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#34c759' }}>12</div>
                      <div style={{ color: '#6b7280' }}>หลักสูตร</div>
                    </div>
                    <div style={{ flex: 1, padding: '4px 6px', borderRadius: 4, background: '#007aff10', fontSize: 8, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#007aff' }}>8</div>
                      <div style={{ color: '#6b7280' }}>อบรมแล้ว</div>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '67%', borderRadius: 2, background: '#34c759' }} />
                  </div>
                </MockScreen>
              </div>
            </StepSection>

            {/* ── Step 2: สอง Tab ── */}
            <StepSection
              step={2}
              color="#007aff"
              title="สลับระหว่าง 2 โหมด"
              subtitle="ภาพรวม & อัปเดต"
            >
              <p style={pStyle}>
                หน้า Training มี <strong style={{ color: 'var(--text-primary)' }}>2 แท็บ</strong>:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 12 }}>
                <div style={{
                  padding: 16, borderRadius: 12, background: '#007aff08', border: '1px solid #007aff20',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Eye size={16} color="#007aff" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#007aff' }}>ภาพรวม</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    ดู KPI รายไตรมาส กราฟ Timeline และตารางหลักสูตรทั้งหมด (อ่านอย่างเดียว)
                  </p>
                </div>
                <div style={{
                  padding: 16, borderRadius: 12, background: '#34c75908', border: '1px solid #34c75920',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Edit3 size={16} color="#34c759" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#34c759' }}>อัปเดต</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    เปลี่ยนสถานะ กำหนดวัน เพิ่มผู้เข้าอบรม แนบหลักฐาน
                  </p>
                </div>
              </div>
            </StepSection>

            {/* ── Step 3: อัปเดตสถานะ ── */}
            <StepSection
              step={3}
              color="#ff9500"
              title="อัปเดตสถานะหลักสูตร"
              subtitle="เปลี่ยนสถานะใน Tab อัปเดต"
            >
              <p style={pStyle}>
                ใน tab <strong style={{ color: 'var(--text-primary)' }}>อัปเดต</strong> คลิกที่หลักสูตรเพื่อเปิดฟอร์ม
                เลือกสถานะ กำหนดวัน และบันทึก
              </p>
              <div style={{
                marginTop: 16, marginBottom: 12, padding: 16,
                borderRadius: 12, background: '#f8f9fa', border: '1px solid #e5e7eb',
              }}>
                <IllustrationTable type="training" />
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                borderRadius: 10, background: '#ff950008', border: '1px solid #ff950020',
              }}>
                <Edit3 size={16} color="#ff9500" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                  คลิกหลักสูตร → เลือกสถานะ → กำหนดวัน (ถ้ามี) → กด <strong style={{ color: '#ff9500' }}>บันทึก</strong>
                </p>
              </div>
            </StepSection>

            {/* ── Step 4: สถานะและผลต่อ KPI ── */}
            <StepSection
              step={4}
              color="#5856d6"
              title="ทำความเข้าใจสถานะ และผลต่อ KPI"
              subtitle="Training Statuses & KPI Impact"
            >
              <p style={pStyle}>
                KPI แผนอบรมใช้หลักการเดียวกับ Action Plan:
              </p>

              {/* KPI Formula */}
              <div style={{
                padding: 20, borderRadius: 14, textAlign: 'center', marginTop: 16, marginBottom: 16,
                background: 'linear-gradient(135deg, #34c75908, #007aff08)',
                border: '1px solid #34c75920',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>สูตรการคำนวณ</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#34c759' }}>
                  KPI % = อบรมแล้ว ÷ ฐาน
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  ฐาน = หลักสูตรทั้งหมด − ยกเลิก
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <StatusCard icon={<CircleDot size={14} />} label="ยังไม่กำหนดวัน" color="#6b7280" effect="นับเป็นตัวหาร" desc="หลักสูตรอยู่ในแผนแต่ยังไม่กำหนดวันอบรม" />
                <StatusCard icon={<Calendar size={14} />} label="กำหนดวันแล้ว" color="#3b82f6" effect="นับเป็นตัวหาร" desc="กำหนดวันอบรมแล้ว รอถึงวัน" />
                <StatusCard icon={<CheckCircle size={14} />} label="อบรมแล้ว" color="#16a34a" effect="นับเป็นตัวตั้ง + ตัวหาร" desc="จัดอบรมเสร็จเรียบร้อย" />
                <StatusCard icon={<ArrowRightCircle size={14} />} label="เลื่อน" color="#f59e0b" effect="ย้ายไปเดือนปลายทาง" desc="เลื่อนไปจัดเดือนอื่น ไม่ต้องขออนุมัติ" />
                <StatusCard icon={<XCircle size={14} />} label="ยกเลิก" color="#dc2626" effect="หักออกจากฐาน" desc="ต้องขออนุมัติจาก Admin ก่อน" requiresApproval />
              </div>

              {/* Scoring */}
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>เกณฑ์คะแนน KPI</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { score: 5, label: '100%', color: '#34c759' },
                    { score: 4, label: '≥ 90%', color: '#007aff' },
                    { score: 3, label: '≥ 80%', color: '#5856d6' },
                    { score: 2, label: '≥ 70%', color: '#ff9500' },
                    { score: 1, label: '< 70%', color: '#ff3b30' },
                  ].map(item => (
                    <div key={item.score} style={{
                      textAlign: 'center', padding: '10px 4px', borderRadius: 10,
                      background: `${item.color}10`, border: `1px solid ${item.color}22`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.score}</div>
                      <div style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <ExampleBox color="#34c759">
                Q1 มีหลักสูตร 15 รายการ ยกเลิก 2 อบรมแล้ว 10
                → ฐาน = 15 − 2 = <strong>13</strong> → KPI = 10/13 = <strong>76.9%</strong> → คะแนน <strong>2</strong>
              </ExampleBox>
            </StepSection>

            {/* ── Step 5: ยกเลิกหลักสูตร ── */}
            <StepSection
              step={5}
              color="#ff3b30"
              title="ขอยกเลิกหลักสูตร"
              subtitle="Cancellation Approval"
            >
              <p style={pStyle}>
                การยกเลิกหลักสูตรต้องได้รับอนุมัติจาก Admin ก่อนจึงจะมีผล
              </p>
              <ApprovalCard
                title="ขั้นตอนการขอยกเลิก"
                color="#ff3b30"
                steps={[
                  'เปิด tab อัปเดต → เลือกหลักสูตรที่ต้องการยกเลิก',
                  'เปลี่ยนสถานะเป็น "ยกเลิก"',
                  'กรอกเหตุผลว่าทำไมต้องยกเลิก',
                  'กด "ส่งคำขอยกเลิก" → รอ Admin HQ ตรวจสอบ',
                  'Admin อนุมัติ → หักออกจาก KPI / ปฏิเสธ → สถานะคงเดิม',
                ]}
              />
            </StepSection>

            {/* ── Step 6: KPI Quarterly ── */}
            <StepSection
              step={6}
              color="#007aff"
              title="ติดตาม KPI รายไตรมาส"
              subtitle="Quarterly KPI Tracking"
            >
              <p style={pStyle}>
                ดู KPI รายไตรมาสใน tab <strong style={{ color: 'var(--text-primary)' }}>ภาพรวม</strong>
              </p>
              <div style={{
                padding: 16, borderRadius: 12, background: '#f8f9fa',
                border: '1px solid #e5e7eb', marginTop: 16, marginBottom: 12,
              }}>
                <IllustrationKpiCards />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { q: 'Q1', months: 'ม.ค. — มี.ค.', color: '#007aff' },
                  { q: 'Q2', months: 'เม.ย. — มิ.ย.', color: '#34c759' },
                  { q: 'Q3', months: 'ก.ค. — ก.ย.', color: '#ff9500' },
                  { q: 'Q4', months: 'ต.ค. — ธ.ค.', color: '#5856d6' },
                ].map(item => (
                  <div key={item.q} style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: `${item.color}08`, border: `1px solid ${item.color}18` }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.q}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.months}</div>
                  </div>
                ))}
              </div>
              <Tip>หลักสูตรที่ เลื่อน จะย้ายไปนับในเดือนปลายทาง เช่น เลื่อนจาก มี.ค.(Q1) → พ.ค.(Q2) จะนับใน Q2</Tip>
            </StepSection>

            {/* ── Tips ── */}
            <TipsSection tips={[
              { tip: 'อัปเดตสถานะทันทีเมื่อจัดอบรมเสร็จ', desc: 'เปลี่ยนเป็น "อบรมแล้ว" พร้อมแนบหลักฐาน', icon: '✅' },
              { tip: 'กำหนดวันล่วงหน้า', desc: 'เมื่อทราบวันอบรม ให้เปลี่ยนเป็น "กำหนดวันแล้ว" เพื่อ Admin ติดตามได้', icon: '📅' },
              { tip: 'เลื่อนแทนยกเลิก', desc: 'ถ้ายังจัดได้แต่ไม่ทันเดือนนี้ ใช้ "เลื่อน" ไม่ต้องขออนุมัติ', icon: '➡️' },
              { tip: 'เขียนเหตุผลยกเลิกให้ชัดเจน', desc: 'เหตุผลที่ดีช่วยให้ Admin อนุมัติเร็วขึ้น', icon: '✍️' },
              { tip: 'ดู KPI รายไตรมาสใน tab ภาพรวม', desc: 'ตรวจสอบคะแนนประจำไตรมาสเพื่อวางแผนการจัดอบรม', icon: '🎯' },
            ]} />

          </>)}

        </div>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Reusable Sub-Components
   ────────────────────────────────────────────── */

const pStyle: React.CSSProperties = {
  fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)', margin: 0,
};

function StepSection({ step, color, title, subtitle, children }: {
  step: number; color: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36, position: 'relative' }}>
      {/* Connector line */}
      <div style={{
        position: 'absolute', left: 17, top: 40, bottom: -36, width: 2,
        background: `linear-gradient(to bottom, ${color}30, transparent)`,
      }} />

      <div style={{ display: 'flex', gap: 16 }}>
        <StepNumber n={step} color={color} />
        <div style={{ flex: 1, paddingTop: 2 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
          <p style={{ fontSize: 11, fontWeight: 600, color, margin: '2px 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function MockScreen({ label, width, children }: { label: string; width: number; children: React.ReactNode }) {
  return (
    <div style={{ width }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textAlign: 'center' }}>{label}</div>
      <div style={{
        padding: 10, borderRadius: 10, background: '#fff',
        border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {children}
      </div>
    </div>
  );
}

function StatusCard({ icon, label, color, effect, desc, requiresApproval }: {
  icon: React.ReactNode; label: string; color: string; effect: string; desc: string; requiresApproval?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: `${color}06`, border: `1px solid ${color}15`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}12`, color, flexShrink: 0, marginTop: 1,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
          {requiresApproval && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: '#ff3b3012', color: '#ff3b30',
            }}>ต้องขออนุมัติ</span>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{effect}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function ApprovalCard({ title, color, steps }: { title: string; color: string; steps: string[] }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: `${color}05`, border: `1px solid ${color}18`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 10 }}>{title}</div>
      <div style={{ paddingLeft: 12, borderLeft: `3px solid ${color}25` }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < steps.length - 1 ? 6 : 0 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${color}12`, color, fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
            }}>{i + 1}</div>
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
      padding: '10px 14px', borderRadius: 8,
      background: 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.12)',
    }}>
      <Star size={13} color="#007aff" style={{ marginTop: 2, flexShrink: 0 }} />
      <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}

function ExampleBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
      padding: '12px 16px', borderRadius: 10,
      background: `${color}06`, border: `1px solid ${color}18`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap', marginTop: 1 }}>ตัวอย่าง:</div>
      <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}

function TipsSection({ tips }: { tips: { tip: string; desc: string; icon: string }[] }) {
  return (
    <div style={{
      padding: '20px 24px', borderRadius: 16, marginTop: 8,
      background: 'var(--bg-secondary, #f8f9fa)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <HelpCircle size={18} color="#34c759" />
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>เคล็ดลับการใช้งาน</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tips.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--card-solid, #fff)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.tip}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
