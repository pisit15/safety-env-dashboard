'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { Clock, Save, Users, HardHat, Calculator, CheckCircle } from 'lucide-react';

const MONTH_NAMES = [
  { num: 1, en: 'Jan', th: 'มกราคม' },
  { num: 2, en: 'Feb', th: 'กุมภาพันธ์' },
  { num: 3, en: 'Mar', th: 'มีนาคม' },
  { num: 4, en: 'Apr', th: 'เมษายน' },
  { num: 5, en: 'May', th: 'พฤษภาคม' },
  { num: 6, en: 'Jun', th: 'มิถุนายน' },
  { num: 7, en: 'Jul', th: 'กรกฎาคม' },
  { num: 8, en: 'Aug', th: 'สิงหาคม' },
  { num: 9, en: 'Sep', th: 'กันยายน' },
  { num: 10, en: 'Oct', th: 'ตุลาคม' },
  { num: 11, en: 'Nov', th: 'พฤศจิกายน' },
  { num: 12, en: 'Dec', th: 'ธันวาคม' },
];

interface ManHourRow {
  month: number;
  employee_count: number;
  employee_manhours: number;
  contractor_count: number;
  contractor_manhours: number;
}

const inputStyle: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, width: '100%', color: '#1a1a1a',
  textAlign: 'right',
};

const selectStyle: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10,
  padding: '8px 12px', fontSize: 13, color: '#1a1a1a',
};

export default function ManHoursPage() {
  const { id } = useParams() as { id: string };
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);
  const companyName = company?.shortName || id.toUpperCase();

  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<ManHourRow[]>([]);

  // Initialize rows for all 12 months
  const initRows = useCallback((): ManHourRow[] => {
    return MONTH_NAMES.map(m => ({
      month: m.num,
      employee_count: 0,
      employee_manhours: 0,
      contractor_count: 0,
      contractor_manhours: 0,
    }));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/manhours?companyId=${id}&year=${year}`);
      const data = await res.json();
      const dbRows = data.manHours || [];

      // Merge with full 12-month template
      const merged = initRows().map(row => {
        const dbRow = dbRows.find((d: Record<string, unknown>) => Number(d.month) === row.month);
        if (dbRow) {
          return {
            month: row.month,
            employee_count: Number(dbRow.employee_count) || 0,
            employee_manhours: Number(dbRow.employee_manhours) || 0,
            contractor_count: Number(dbRow.contractor_count) || 0,
            contractor_manhours: Number(dbRow.contractor_manhours) || 0,
          };
        }
        return row;
      });
      setRows(merged);
    } catch {
      setRows(initRows());
    }
    setLoading(false);
  }, [id, year, initRows]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateRow = (monthNum: number, field: keyof ManHourRow, value: number) => {
    setRows(prev => prev.map(r => r.month === monthNum ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = rows
        .filter(r => r.employee_count > 0 || r.employee_manhours > 0 || r.contractor_count > 0 || r.contractor_manhours > 0)
        .map(r => ({
          company_id: id,
          year,
          month: r.month,
          employee_count: r.employee_count,
          employee_manhours: r.employee_manhours,
          contractor_count: r.contractor_count,
          contractor_manhours: r.contractor_manhours,
        }));

      if (payload.length === 0) {
        alert('ไม่มีข้อมูลที่จะบันทึก');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/manhours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSaving(false);
  };

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      empCount: acc.empCount + r.employee_count,
      empHours: acc.empHours + r.employee_manhours,
      conCount: acc.conCount + r.contractor_count,
      conHours: acc.conHours + r.contractor_manhours,
    }),
    { empCount: 0, empHours: 0, conCount: 0, conHours: 0 }
  );
  const totalManHours = totals.empHours + totals.conHours;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                ชั่วโมงการทำงาน — {companyName}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Man-hours สำหรับคำนวณ TIFR / LTIFR
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={selectStyle}
              >
                {[2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
                style={{ background: saved ? '#22c55e' : saving ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
              >
                {saved ? <><CheckCircle size={16} /> บันทึกแล้ว</> :
                 saving ? 'กำลังบันทึก...' :
                 <><Save size={16} /> บันทึก</>}
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          {/* Summary KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Man-hours พนักงาน', value: totals.empHours.toLocaleString(), sub: `${totals.empCount} คน (เฉลี่ย)`, icon: Users, color: '#3b82f6' },
              { label: 'Man-hours ผู้รับเหมา', value: totals.conHours.toLocaleString(), sub: `${totals.conCount} คน (เฉลี่ย)`, icon: HardHat, color: '#f97316' },
              { label: 'Man-hours รวม', value: totalManHours.toLocaleString(), sub: 'พนักงาน + ผู้รับเหมา', icon: Clock, color: '#6366f1' },
              { label: 'TIFR Factor', value: totalManHours > 0 ? '1,000,000' : 'N/A', sub: totalManHours > 0 ? `÷ ${totalManHours.toLocaleString()} hrs` : 'กรอกข้อมูลก่อน', icon: Calculator, color: '#22c55e' },
            ].map((kpi, idx) => (
              <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.sub}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Data Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted)' }}>
              <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mr-3" />
              กำลังโหลดข้อมูล...
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th rowSpan={2} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--muted)', fontSize: 11, borderBottom: '2px solid var(--border)', minWidth: 100 }}>เดือน</th>
                      <th colSpan={2} className="px-4 py-2 text-center font-semibold" style={{ color: '#3b82f6', fontSize: 11, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-center gap-1"><Users size={12} /> พนักงาน (Employee)</div>
                      </th>
                      <th colSpan={2} className="px-4 py-2 text-center font-semibold" style={{ color: '#f97316', fontSize: 11, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-center gap-1"><HardHat size={12} /> ผู้รับเหมา (Contractor)</div>
                      </th>
                      <th rowSpan={2} className="px-4 py-3 text-right font-semibold" style={{ color: '#6366f1', fontSize: 11, borderBottom: '2px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 110 }}>
                        Man-hours รวม
                      </th>
                    </tr>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 10, borderBottom: '2px solid var(--border)', borderLeft: '1px solid var(--border)' }}>จำนวนคน</th>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 10, borderBottom: '2px solid var(--border)' }}>Man-hours</th>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 10, borderBottom: '2px solid var(--border)', borderLeft: '1px solid var(--border)' }}>จำนวนคน</th>
                      <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 10, borderBottom: '2px solid var(--border)' }}>Man-hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const mName = MONTH_NAMES.find(m => m.num === row.month);
                      const rowTotal = row.employee_manhours + row.contractor_manhours;
                      return (
                        <tr key={row.month} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                            <span className="text-[12px]">{mName?.th}</span>
                          </td>
                          {/* Employee Count */}
                          <td className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                            <input
                              type="number"
                              min={0}
                              value={row.employee_count || ''}
                              onChange={e => updateRow(row.month, 'employee_count', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                              placeholder="0"
                            />
                          </td>
                          {/* Employee Man-hours */}
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.employee_manhours || ''}
                              onChange={e => updateRow(row.month, 'employee_manhours', parseFloat(e.target.value) || 0)}
                              style={inputStyle}
                              placeholder="0"
                            />
                          </td>
                          {/* Contractor Count */}
                          <td className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                            <input
                              type="number"
                              min={0}
                              value={row.contractor_count || ''}
                              onChange={e => updateRow(row.month, 'contractor_count', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                              placeholder="0"
                            />
                          </td>
                          {/* Contractor Man-hours */}
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.contractor_manhours || ''}
                              onChange={e => updateRow(row.month, 'contractor_manhours', parseFloat(e.target.value) || 0)}
                              style={inputStyle}
                              placeholder="0"
                            />
                          </td>
                          {/* Row Total */}
                          <td className="px-4 py-2 text-right font-semibold" style={{ color: rowTotal > 0 ? '#6366f1' : 'var(--muted)', borderLeft: '1px solid var(--border)' }}>
                            {rowTotal > 0 ? rowTotal.toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>รวมทั้งปี</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: '#3b82f6', borderLeft: '1px solid var(--border)' }}>{totals.empCount > 0 ? totals.empCount.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: '#3b82f6' }}>{totals.empHours > 0 ? totals.empHours.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: '#f97316', borderLeft: '1px solid var(--border)' }}>{totals.conCount > 0 ? totals.conCount.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: '#f97316' }}>{totals.conHours > 0 ? totals.conHours.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: '#6366f1', borderLeft: '1px solid var(--border)', fontSize: 15 }}>{totalManHours > 0 ? totalManHours.toLocaleString() : '-'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* TIFR/LTIFR Formula Info */}
              <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  สูตรการคำนวณ
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-[11px] p-3 rounded-lg" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                    <span className="font-semibold" style={{ color: '#f97316' }}>TIFR</span>
                    <span style={{ color: 'var(--muted)' }}> = (Total Recordable Injuries × 1,000,000) ÷ Total Man-hours</span>
                  </div>
                  <div className="text-[11px] p-3 rounded-lg" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                    <span className="font-semibold" style={{ color: '#ef4444' }}>LTIFR</span>
                    <span style={{ color: 'var(--muted)' }}> = (Lost Time Injuries × 1,000,000) ÷ Total Man-hours</span>
                  </div>
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
                  * สามารถดู TIFR/LTIFR ได้ที่หน้า สถิติอุบัติเหตุ → Dashboard (แยก พนักงาน / ผู้รับเหมา / รวม)
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
