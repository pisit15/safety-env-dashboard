'use client';

import { type Dispatch, type SetStateAction } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2, Download } from 'lucide-react';
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
}

export default function IncidentListView({
  incidents, total, page, setPage,
  searchTerm, setSearchTerm, filterType, setFilterType,
  openDrawer, openEditForm, handleDelete,
  allIncidentsForExport,
}: IncidentListViewProps) {

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

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Search & Filter & Export */}
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
              {['Incident No.', 'วันที่', 'ประเภท', 'ความรุนแรง', 'รายละเอียด', 'พื้นที่', 'สถานะ', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
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
                </tr>
              );
            })}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
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
    </div>
  );
}
