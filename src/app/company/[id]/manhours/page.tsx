'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { Clock, Save, Users, HardHat, Calculator, CheckCircle, AlertTriangle } from 'lucide-react';

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

type RowField = 'employee_count' | 'employee_manhours' | 'contractor_count' | 'contractor_manhours';

interface ManHourRow {
  month: number;
  employee_count: number;
  employee_manhours: number;
  contractor_count: number;
  contractor_manhours: number;
}

/* ── Dynamic year list: 2021..currentYear+1 ── */
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = 2021; y <= currentYear + 1; y++) years.push(y);
  return years;
}
const YEAR_OPTIONS = getYearOptions();

/* ── Helpers ── */
function initRows(): ManHourRow[] {
  return MONTH_NAMES.map(m => ({
    month: m.num, employee_count: 0, employee_manhours: 0, contractor_count: 0, contractor_manhours: 0,
  }));
}

function rowsEqual(a: ManHourRow[], b: ManHourRow[]): boolean {
  for (let i = 0; i < 12; i++) {
    if (a[i].employee_count !== b[i].employee_count) return false;
    if (a[i].employee_manhours !== b[i].employee_manhours) return false;
    if (a[i].contractor_count !== b[i].contractor_count) return false;
    if (a[i].contractor_manhours !== b[i].contractor_manhours) return false;
  }
  return true;
}

const inputStyle: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, width: '100%', color: '#1a1a1a',
  textAlign: 'right' as const,
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<ManHourRow[]>(initRows);

  /* ── Raw input strings (for clean typing experience) ── */
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

  /* ── Baseline rows for isDirty comparison ── */
  const [baselineRows, setBaselineRows] = useState<ManHourRow[]>(initRows);

  /* ── AbortController ref ── */
  const abortRef = useRef<AbortController | null>(null);

  /* ── isDirty ── */
  const isDirty = useMemo(() => !rowsEqual(rows, baselineRows), [rows, baselineRows]);

  /* ── Fetch data ── */
  const fetchData = useCallback(async (targetYear: number) => {
    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFetchError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/manhours?companyId=${id}&year=${targetYear}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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
      setBaselineRows(merged.map(r => ({ ...r })));
      setRawInputs({});
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // ignore aborted
      setFetchError((err as Error).message || 'โหลดข้อมูลไม่สำเร็จ');
      setRows(initRows());
      setBaselineRows(initRows());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(year); }, [year, fetchData]);

  /* ── Input helpers: raw string on change, parse on blur ── */
  const getRawKey = (month: number, field: RowField) => `${month}_${field}`;

  const getDisplayValue = (row: ManHourRow, field: RowField): string => {
    const rk = getRawKey(row.month, field);
    if (rk in rawInputs) return rawInputs[rk];
    const val = row[field];
    return val === 0 ? '' : String(val);
  };

  const handleInputChange = (month: number, field: RowField, rawValue: string) => {
    const rk = getRawKey(month, field);
    setRawInputs(prev => ({ ...prev, [rk]: rawValue }));

    // Parse incrementally for KPI updates (but keep raw for display)
    const parsed = field.includes('count') ? parseInt(rawValue) : parseFloat(rawValue);
    if (!isNaN(parsed) && parsed >= 0) {
      setRows(prev => prev.map(r => r.month === month ? { ...r, [field]: parsed } : r));
    } else if (rawValue === '' || rawValue === '-') {
      setRows(prev => prev.map(r => r.month === month ? { ...r, [field]: 0 } : r));
    }
    setSaved(false);
  };

  const handleInputBlur = (month: number, field: RowField) => {
    const rk = getRawKey(month, field);
    const raw = rawInputs[rk];
    if (raw === undefined) return;

    const parsed = field.includes('count') ? parseInt(raw) : parseFloat(raw);
    const final = (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
    setRows(prev => prev.map(r => r.month === month ? { ...r, [field]: final } : r));
    // Clear raw — let display use parsed value
    setRawInputs(prev => {
      const next = { ...prev };
      delete next[rk];
      return next;
    });
  };

  /* ── Save: send ALL 12 months (including zeros) ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = rows.map(r => ({
        company_id: id,
        year,
        month: r.month,
        employee_count: r.employee_count,
        employee_manhours: r.employee_manhours,
        contractor_count: r.contractor_count,
        contractor_manhours: r.contractor_manhours,
      }));

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
        setBaselineRows(rows.map(r => ({ ...r })));
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSaving(false);
  };

  /* ── Totals ── */
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

  /* ── Warn on unsaved changes leaving page ── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                ชั่วโมงการทำงาน — {companyName}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Man-hours สำหรับคำนวณ TRIR / LTIFR
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={selectStyle}
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
                style={{
                  background: saved ? '#22c55e' : (!isDirty && !saving) ? '#d1d5db' : saving ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  cursor: (!isDirty && !saving) ? 'default' : 'pointer',
                }}
              >
                {saved ? <><CheckCircle size={16} /> บันทึกแล้ว</> :
                 saving ? 'กำลังบันทึก...' :
                 <><Save size={16} /> บันทึก</>}
              </button>
            </div>
          </div>
          {/* Unsaved changes indicator */}
          {isDirty && !saved && (
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
              <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
            </div>
          )}
        </div>

        <div className="px-8 pb-8">
          {/* Summary KPI — always visible, updates live */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Man-hours พนักงาน', value: totals.empHours.toLocaleString(), sub: `${totals.empCount.toLocaleString()} คน (เฉลี่ย)`, icon: Users, color: '#3b82f6' },
              { label: 'Man-hours ผู้รับเหมา', value: totals.conHours.toLocaleString(), sub: `${totals.conCount.toLocaleString()} คน (เฉลี่ย)`, icon: HardHat, color: '#f97316' },
              { label: 'Man-hours รวม', value: totalManHours.toLocaleString(), sub: 'พนักงาน + ผู้รับเหมา', icon: Clock, color: '#6366f1' },
              { label: 'TRIR Factor', value: totalManHours > 0 ? '1,000,000' : 'N/A', sub: totalManHours > 0 ? `÷ ${totalManHours.toLocaleString()} hrs` : 'กรอกข้อมูลก่อน', icon: Calculator, color: '#22c55e' },
            ].map((kpi, idx) => (
              <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-xl font-bold" style={{ color: loading ? 'var(--muted)' : kpi.color }}>{loading ? '...' : kpi.value}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.sub}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Error Banner */}
          {fetchError && (
            <div className="mb-4 flex items-center gap-3 px-5 py-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <AlertTriangle size={18} style={{ color: '#dc2626' }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#dc2626' }}>โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{fetchError}</p>
              </div>
              <button onClick={() => fetchData(year)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#fee2e2', color: '#dc2626' }}>ลองอีกครั้ง</button>
            </div>
          )}

          {/* Data Table — always rendered, inline loading */}
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
                      <tr key={row.month} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)', opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                        <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                          <span className="text-[12px]">{mName?.th}</span>
                        </td>
                        {/* Employee Count */}
                        <td className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                          <input
                            type="text" inputMode="numeric"
                            value={getDisplayValue(row, 'employee_count')}
                            onChange={e => handleInputChange(row.month, 'employee_count', e.target.value)}
                            onBlur={() => handleInputBlur(row.month, 'employee_count')}
                            disabled={loading}
                            style={inputStyle}
                            placeholder="0"
                          />
                        </td>
                        {/* Employee Man-hours */}
                        <td className="px-2 py-1.5">
                          <input
                            type="text" inputMode="decimal"
                            value={getDisplayValue(row, 'employee_manhours')}
                            onChange={e => handleInputChange(row.month, 'employee_manhours', e.target.value)}
                            onBlur={() => handleInputBlur(row.month, 'employee_manhours')}
                            disabled={loading}
                            style={inputStyle}
                            placeholder="0"
                          />
                        </td>
                        {/* Contractor Count */}
                        <td className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                          <input
                            type="text" inputMode="numeric"
                            value={getDisplayValue(row, 'contractor_count')}
                            onChange={e => handleInputChange(row.month, 'contractor_count', e.target.value)}
                            onBlur={() => handleInputBlur(row.month, 'contractor_count')}
                            disabled={loading}
                            style={inputStyle}
                            placeholder="0"
                          />
                        </td>
                        {/* Contractor Man-hours */}
                        <td className="px-2 py-1.5">
                          <input
                            type="text" inputMode="decimal"
                            value={getDisplayValue(row, 'contractor_manhours')}
                            onChange={e => handleInputChange(row.month, 'contractor_manhours', e.target.value)}
                            onBlur={() => handleInputBlur(row.month, 'contractor_manhours')}
                            disabled={loading}
                            style={inputStyle}
                            placeholder="0"
                          />
                        </td>
                        {/* Row Total */}
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: rowTotal > 0 ? '#6366f1' : 'var(--muted)', borderLeft: '1px solid var(--border)' }}>
                          {loading ? '-' : rowTotal > 0 ? rowTotal.toLocaleString() : '-'}
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

            {/* TRIR/LTIFR Formula Info */}
            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                สูตรการคำนวณ
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="text-[11px] p-3 rounded-lg" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <span className="font-semibold" style={{ color: '#f97316' }}>TRIR</span>
                  <span style={{ color: 'var(--muted)' }}> = (Total Recordable Injuries × 1,000,000) ÷ Total Man-hours</span>
                </div>
                <div className="text-[11px] p-3 rounded-lg" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <span className="font-semibold" style={{ color: '#ef4444' }}>LTIFR</span>
                  <span style={{ color: 'var(--muted)' }}> = (Lost Time Injuries × 1,000,000) ÷ Total Man-hours</span>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
                * สามารถดู TRIR/LTIFR ได้ที่หน้า สถิติอุบัติเหตุ → Dashboard (แยก พนักงาน / ผู้รับเหมา / รวม)
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
