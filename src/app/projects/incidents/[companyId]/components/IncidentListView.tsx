'use client';

import { useState, useRef, type Dispatch, type SetStateAction } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2, Download, Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import type { Incident } from '../types';
import { getSevColor, getTypeBadge } from '../types';
import { INCIDENT_TYPES, inputStyle, selectStyle } from '../constants';

interface IncidentListViewProps {
  incidents: Incident[];
  total: number;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  openDrawer: (inc: Incident) => void;
  openEditForm: (inc: Incident) => void;
  handleDelete: (inc: Incident) => void;
  allIncidentsForExport: Incident[];
  companyId: string;
  onImported?: () => void;
  isLoggedIn?: boolean;
}

/* ---- CSV Parser ---- */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

/* ---- Field mapping (Thai label → DB column) ---- */
const FIELD_MAP: Record<string, string> = {
  'Incident No': 'incident_no', 'incident_no': 'incident_no',
  'วันที่': 'incident_date', 'incident_date': 'incident_date',
  'เวลา': 'incident_time', 'incident_time': 'incident_time',
  'กะ': 'shift', 'shift': 'shift',
  'ประเภท': 'incident_type', 'incident_type': 'incident_type',
  'ความรุนแรงจริง': 'actual_severity', 'actual_severity': 'actual_severity',
  'ความรุนแรงที่อาจเกิด': 'potential_severity', 'potential_severity': 'potential_severity',
  'ประเภทบุคคล': 'person_type', 'person_type': 'person_type',
  'แผนก': 'department', 'department': 'department',
  'เกี่ยวกับงาน': 'work_related', 'work_related': 'work_related',
  'กิจกรรม': 'activity', 'activity': 'activity',
  'การสัมผัส': 'contact_type', 'contact_type': 'contact_type',
  'แหล่งที่มา': 'agency_source', 'agency_source': 'agency_source',
  'รายละเอียด': 'description', 'description': 'description',
  'พื้นที่': 'area', 'area': 'area',
  'เครื่องจักร': 'equipment', 'equipment': 'equipment',
  'สภาพแวดล้อม': 'environment', 'environment': 'environment',
  'ค่าเสียหายตรง': 'direct_cost', 'direct_cost': 'direct_cost',
  'ค่าเสียหายอ้อม': 'indirect_cost', 'indirect_cost': 'indirect_cost',
  'ผลกระทบผลิต': 'production_impact', 'production_impact': 'production_impact',
  'เคลมประกัน': 'insurance_claim', 'insurance_claim': 'insurance_claim',
  'สถานะ': 'report_status', 'report_status': 'report_status',
  'ผู้รายงาน': 'reporter', 'reporter': 'reporter',
  'วันที่รายงาน': 'report_date', 'report_date': 'report_date',
  'จำนวนผู้บาดเจ็บ': 'injured_count', 'injured_count': 'injured_count',
  'year': 'year', 'month': 'month',
};

const NUM_FIELDS = new Set(['direct_cost', 'indirect_cost', 'injured_count', 'year']);

export default function IncidentListView({
  incidents, total, page, setPage,
  searchTerm, setSearchTerm, filterType, setFilterType,
  openDrawer, openEditForm, handleDelete,
  allIncidentsForExport, companyId, onImported, isLoggedIn,
}: IncidentListViewProps) {
  /* Import modal state */
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- CSV Export ---- */
  const exportCSV = () => {
    const rows = allIncidentsForExport;
    if (rows.length === 0) { alert('ไม่มีข้อมูลสำหรับ export'); return; }

    const headers = [
      'incident_no', 'incident_date', 'incident_time', 'shift', 'incident_type',
      'actual_severity', 'potential_severity', 'person_type', 'department',
      'work_related', 'activity', 'contact_type', 'agency_source',
      'description', 'area', 'equipment', 'environment',
      'direct_cost', 'indirect_cost', 'production_impact', 'insurance_claim',
      'report_status',
    ];
    const headerLabels = [
      'Incident No', 'วันที่', 'เวลา', 'กะ', 'ประเภท',
      'ความรุนแรงจริง', 'ความรุนแรงที่อาจเกิด', 'ประเภทบุคคล', 'แผนก',
      'เกี่ยวกับงาน', 'กิจกรรม', 'การสัมผัส', 'แหล่งที่มา',
      'รายละเอียด', 'พื้นที่', 'เครื่องจักร', 'สภาพแวดล้อม',
      'ค่าเสียหายตรง', 'ค่าเสียหายอ้อม', 'ผลกระทบผลิต', 'เคลมประกัน',
      'สถานะ',
    ];

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvContent = '\uFEFF' + [
      headerLabels.map(esc).join(','),
      ...rows.map(r => headers.map(h => esc(r[h as keyof Incident])).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `incidents_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  /* ---- CSV Import ---- */
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setImportRows(rows);
      setImportStatus('idle');
      setImportMsg(`พบ ${rows.length} แถวจากไฟล์ ${file.name}`);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (importRows.length === 0) return;
    setImportStatus('loading');
    setImportMsg('กำลังนำเข้าข้อมูล...');

    // Map CSV columns → DB columns
    const mapped = importRows.map(row => {
      const rec: Record<string, unknown> = { company_id: companyId };
      Object.entries(row).forEach(([key, val]) => {
        const dbCol = FIELD_MAP[key];
        if (dbCol && val) {
          rec[dbCol] = NUM_FIELDS.has(dbCol) ? (parseFloat(val) || 0) : val;
        }
      });
      // Auto-compute year/month from incident_date if not set
      if (rec.incident_date && !rec.year) {
        const d = new Date(rec.incident_date as string);
        if (!isNaN(d.getTime())) {
          rec.year = d.getFullYear();
          rec.month = String(d.getMonth() + 1);
        }
      }
      // Default work_related
      if (!rec.work_related) rec.work_related = 'ใช่';
      if (!rec.report_status) rec.report_status = 'Draft';
      return rec;
    }).filter(r => r.incident_no && r.incident_date && r.incident_type);

    if (mapped.length === 0) {
      setImportStatus('error');
      setImportMsg('ไม่พบแถวที่มีข้อมูลครบ (ต้องมี incident_no, incident_date, incident_type)');
      return;
    }

    try {
      const res = await fetch('/api/incidents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidents: mapped }),
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus('success');
        setImportMsg(`นำเข้าสำเร็จ ${data.insertedIncidents} รายการ`);
        onImported?.();
      } else {
        setImportStatus('error');
        setImportMsg(`นำเข้า ${data.insertedIncidents} รายการ มี error: ${(data.errors || []).join('; ')}`);
      }
    } catch {
      setImportStatus('error');
      setImportMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Search & Filter & Export & Import */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            placeholder="ค้นหา Incident No, รายละเอียด, พื้นที่..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          style={{ ...selectStyle, width: 220 }}
        >
          <option value="">ทุกประเภท</option>
          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => { setShowImport(true); setImportRows([]); setImportStatus('idle'); setImportMsg(''); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors hover:opacity-80"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}
          title="Import CSV"
        >
          <Upload size={14} /> Import
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          title="Export CSV"
        >
          <Download size={14} /> Export CSV
        </button>
        <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
          {total} รายการ
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['Incident No.', 'วันที่', 'ประเภท', 'ความรุนแรง', 'รายละเอียด', 'พื้นที่', 'สถานะ', ...(isLoggedIn ? [''] : [])].map(h => (
                <th key={h || '_actions'} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc, idx) => {
              const badge = getTypeBadge(inc.incident_type);
              return (
                <tr key={inc.id} onClick={() => openDrawer(inc)} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined, cursor: 'pointer' }} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--accent)' }}>{inc.incident_no}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {inc.incident_date ? new Date(inc.incident_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {inc.incident_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: getSevColor(inc.actual_severity || '') }} />
                      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{inc.actual_severity || '-'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[250px] truncate" style={{ color: 'var(--text-secondary)' }} title={inc.description || ''}>
                    {inc.description || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{inc.area || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{
                      background: inc.report_status === 'Closed' ? '#dcfce7' : inc.report_status === 'Approved' ? '#dbeafe' : '#fef3c7',
                      color: inc.report_status === 'Closed' ? '#16a34a' : inc.report_status === 'Approved' ? '#2563eb' : '#d97706',
                    }}>
                      {inc.report_status || 'Draft'}
                    </span>
                  </td>
                  {isLoggedIn && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEditForm(inc); }} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--accent)' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(inc); }} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={isLoggedIn ? 8 : 7} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                  ไม่พบข้อมูลอุบัติเหตุ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', opacity: page === 1 ? 0.3 : 1 }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-[13px] px-3" style={{ color: 'var(--text-secondary)' }}>
            หน้า {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', opacity: page >= totalPages ? 0.3 : 1 }}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ---- Import Modal ---- */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowImport(false)}>
          <div className="rounded-2xl w-full max-w-lg overflow-hidden" style={{ background: 'var(--card-solid)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>
              <div>
                <h3 className="text-[15px] font-bold text-white">Import CSV</h3>
                <p className="text-[11px] text-white/70 mt-0.5">นำเข้าข้อมูลอุบัติเหตุจากไฟล์ CSV</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              >
                <Upload size={28} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>คลิกหรือลากไฟล์ CSV มาวาง</p>
                <p className="text-[11px] mt-1">รองรับ .csv (UTF-8) — ใช้ Export CSV เป็น template ได้</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
              </div>

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    ตัวอย่างข้อมูล ({importRows.length} แถว)
                  </p>
                  <div className="rounded-lg overflow-auto max-h-[200px]" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          {Object.keys(importRows[0]).slice(0, 6).map(h => (
                            <th key={h} className="text-left px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color: 'var(--muted)' }}>{h}</th>
                          ))}
                          {Object.keys(importRows[0]).length > 6 && <th className="px-2 py-1.5" style={{ color: 'var(--muted)' }}>...</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((row, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            {Object.values(row).slice(0, 6).map((v, j) => (
                              <td key={j} className="px-2 py-1 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>{v || '-'}</td>
                            ))}
                            {Object.keys(row).length > 6 && <td className="px-2 py-1" style={{ color: 'var(--muted)' }}>...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Status message */}
              {importMsg && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-[12px]" style={{
                  background: importStatus === 'success' ? 'rgba(34,197,94,0.08)' : importStatus === 'error' ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                  color: importStatus === 'success' ? '#16a34a' : importStatus === 'error' ? '#dc2626' : 'var(--text-secondary)',
                }}>
                  {importStatus === 'success' ? <CheckCircle size={16} /> : importStatus === 'error' ? <AlertCircle size={16} /> : null}
                  {importMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importRows.length === 0 || importStatus === 'loading' || importStatus === 'success'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                  style={{
                    background: importRows.length === 0 || importStatus === 'loading' || importStatus === 'success' ? 'var(--muted)' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    cursor: importRows.length === 0 || importStatus === 'loading' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importStatus === 'loading' ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
                </button>
                <button onClick={() => setShowImport(false)} className="px-5 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                  {importStatus === 'success' ? 'ปิด' : 'ยกเลิก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
