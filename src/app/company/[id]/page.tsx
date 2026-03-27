'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import { DEMO_COMPANIES, DEMO_EBI_ACTIVITIES } from '@/lib/demo-data';
import { Activity } from '@/lib/types';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export default function CompanyDrilldown() {
  const params = useParams();
  const companyId = params.id as string;
  const [planType, setPlanType] = useState<'safety' | 'environment'>('environment');
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const company = DEMO_COMPANIES.find(c => c.companyId === companyId);
  if (!company) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-muted">ไม่พบข้อมูลบริษัท — กลับ <Link href="/" className="text-accent hover:underline">หน้าหลัก</Link></p>
        </main>
      </div>
    );
  }

  // Use EBI demo activities when available, otherwise show placeholder
  const activities: Activity[] = companyId === 'ebi' ? DEMO_EBI_ACTIVITIES : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <Link href="/" className="hover:text-white">Home</Link>
          <span>/</span>
          <Link href="/" className="hover:text-white">แผนงานประจำปี</Link>
          <span>/</span>
          <span className="text-white">{company.companyName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">
            🔍 {company.companyName} — แผนงาน{planType === 'safety' ? 'ความปลอดภัย' : 'สิ่งแวดล้อม'} 2026
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setPlanType('safety')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'safety' ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🛡️ Safety
            </button>
            <button
              onClick={() => setPlanType('environment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                planType === 'environment' ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-white'
              }`}
            >
              🌿 Environment
            </button>
            <button
              onClick={() => setShowUpdateForm(!showUpdateForm)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              ✏️ Quick Update
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard label="กิจกรรมทั้งหมด" value={company.total} />
          <KPICard label="ดำเนินการแล้ว" value={company.done} color="#4ade80" progress={company.pctDone} delta={`${company.pctDone}%`} />
          <KPICard label="กำลังดำเนินการ" value={company.inProgress} color="#fbbf24" />
          <KPICard label="งบประมาณ" value={company.budget.toLocaleString()} color="#00d4ff" subtext="บาท" />
        </div>

        {/* Quick Update Form */}
        {showUpdateForm && (
          <div className="bg-card border-2 border-green-600/30 rounded-xl p-5 mb-6">
            <h3 className="text-sm text-green-400 font-semibold mb-4 flex items-center gap-2">
              ✏️ Quick Update — อัปเดตสถานะกิจกรรม
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted block mb-1">เลือกกิจกรรม</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white">
                  <option>1.1 — แต่งตั้งบุคลากรด้านสิ่งแวดล้อม</option>
                  <option>2.1.1 — ตรวจสอบสถานที่จัดเก็บของเสีย</option>
                  <option>2.1.6 — ตรวจวัดคุณภาพน้ำทิ้ง</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">เดือน</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white">
                  {MONTH_LABELS.map((m, i) => <option key={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">สถานะ</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white">
                  <option>✓ ดำเนินการแล้ว</option>
                  <option>○ ยังไม่ดำเนินการ</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted block mb-1">หมายเหตุ</label>
                <input type="text" placeholder="รายละเอียดเพิ่มเติม..." className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">แนบไฟล์ (รูปภาพ/รายงาน)</label>
                <input type="file" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white file:mr-2 file:bg-accent file:text-white file:border-0 file:rounded file:px-3 file:py-1 file:text-xs" />
              </div>
            </div>
            <button className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              💾 บันทึก
            </button>
          </div>
        )}

        {/* Activity Table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
            รายละเอียดกิจกรรม
          </h3>
          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted font-semibold text-xs">ลำดับ</th>
                    <th className="text-left py-3 px-2 text-muted font-semibold text-xs min-w-[250px]">กิจกรรม</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className="text-center py-3 px-1 text-muted font-semibold text-[10px]">{m}</th>
                    ))}
                    <th className="text-left py-3 px-2 text-muted font-semibold text-xs">เป้าหมาย</th>
                    <th className="text-center py-3 px-2 text-muted font-semibold text-xs">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, i) => (
                    <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-2 text-muted text-xs">{act.no}</td>
                      <td className="py-2.5 px-2 text-white text-xs">{act.activity}</td>
                      {MONTH_KEYS.map(k => (
                        <td key={k} className="text-center py-2.5 px-1">
                          {act.months[k] ? (
                            <span className="text-green-400 text-sm">✓</span>
                          ) : (
                            <span className="text-zinc-700 text-sm">-</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 px-2 text-xs text-zinc-400">{act.target}</td>
                      <td className="py-2.5 px-2 text-center">
                        <StatusBadge status={act.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-muted">
              <p className="text-4xl mb-3">📌</p>
              <p>ข้อมูลตัวอย่างมีเฉพาะ EBI</p>
              <p className="text-xs mt-1">ระบบจริงจะดึงจาก Google Sheets ของทุกบริษัท</p>
              <Link href="/company/ebi" className="text-accent text-sm hover:underline mt-3 inline-block">
                ดูตัวอย่าง EBI →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
