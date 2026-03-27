'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { COMPANIES } from '@/lib/companies';

interface CompanyRow {
  id: string;
  name: string;
  sheetId: string;
  safetySheet: string;
  enviSheet: string;
  connected: boolean;
}

export default function AdminPage() {
  const [companies] = useState<CompanyRow[]>(
    COMPANIES.map(c => ({
      id: c.id,
      name: c.name,
      sheetId: c.sheetId,
      safetySheet: c.safetySheet,
      enviSheet: c.enviSheet,
      connected: c.sheetId !== '',
    }))
  );

  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted mb-1">
          <span>Home</span>
          <span>/</span>
          <span className="text-white">Admin / ตั้งค่า</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">⚙️ Admin — จัดการบริษัทและแผนงาน</h1>
            <p className="text-sm text-muted mt-1">เพิ่ม/แก้ไข URL Google Sheets ของแต่ละบริษัท</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + เพิ่มบริษัทใหม่
          </button>
        </div>

        {/* Add new company form */}
        {showAddForm && (
          <div className="bg-card border-2 border-accent/30 rounded-xl p-5 mb-6">
            <h3 className="text-sm text-accent font-semibold mb-4">+ เพิ่มบริษัทใหม่</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted block mb-1">ชื่อบริษัท</label>
                <input type="text" placeholder="เช่น EBI, AMT..." className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white" />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-muted block mb-1">Google Sheet URL หรือ ID</label>
                <input type="text" placeholder="วาง URL: https://docs.google.com/spreadsheets/d/xxxxx หรือ Sheet ID" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">ชื่อ Sheet: Safety Plan</label>
                <input type="text" placeholder="เช่น EBI SafetyPlan" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">ชื่อ Sheet: Envi Plan</label>
                <input type="text" placeholder="เช่น EBI Envi Plan" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-5 py-2.5 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                💾 บันทึก
              </button>
              <button onClick={() => setShowAddForm(false)} className="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Setup Guide */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="text-sm text-accent font-semibold mb-3 border-l-2 border-accent pl-3">
            📖 วิธีตั้งค่า Google Sheets
          </h3>
          <div className="text-xs text-zinc-400 space-y-2">
            <p>1. เปิด Google Spreadsheet ของบริษัท → คลิก Share → เพิ่ม Service Account email เป็น Viewer</p>
            <p>2. คัดลอก Spreadsheet ID จาก URL (ส่วน /d/<strong className="text-white">xxxxx</strong>/edit)</p>
            <p>3. วาง ID ในช่อง Google Sheet ID ด้านล่าง และใส่ชื่อ Sheet ที่ตรงกับแท็บใน Spreadsheet</p>
            <p>4. กดบันทึก — ระบบจะดึงข้อมูลจาก Sheets อัตโนมัติ</p>
            <p className="text-accent mt-2">Service Account: <code className="bg-bg px-2 py-0.5 rounded text-xs">safety-dashboard@your-project.iam.gserviceaccount.com</code></p>
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm text-muted mb-4 border-l-2 border-accent pl-3">
            รายชื่อบริษัท ({companies.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-muted font-semibold">บริษัท</th>
                  <th className="text-left py-3 px-3 text-muted font-semibold">Google Sheet ID</th>
                  <th className="text-left py-3 px-3 text-muted font-semibold">Safety Plan Sheet</th>
                  <th className="text-left py-3 px-3 text-muted font-semibold">Envi Plan Sheet</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold">สถานะ</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                    <td className="py-3 px-3">
                      {c.sheetId ? (
                        <code className="text-xs bg-bg px-2 py-0.5 rounded text-zinc-400">
                          {c.sheetId.slice(0, 20)}...
                        </code>
                      ) : (
                        <span className="text-zinc-600 text-xs">ยังไม่ได้ตั้งค่า</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-zinc-400">{c.safetySheet || '-'}</td>
                    <td className="py-3 px-3 text-xs text-zinc-400">{c.enviSheet || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      {c.connected ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400">
                          ✅ เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-500">
                          ⏳ รอตั้งค่า
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <button className="text-xs text-accent hover:underline">แก้ไข</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
