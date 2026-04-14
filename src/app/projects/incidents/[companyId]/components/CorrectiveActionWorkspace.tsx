'use client';

import { useState, useMemo } from 'react';
import { ClipboardCheck, Clock, AlertTriangle, CheckCircle, XCircle, Filter, Download } from 'lucide-react';
import type { Incident } from '../types';
import { getTypeBadge } from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CARecord {
  incidentNo: string;
  incidentDate: string;
  incidentType: string;
  caNumber: 1 | 2;
  action: string;
  hocType: string;
  responsible: string;
  dueDate: string;
  status: string;
  incident: Incident;
}

interface CorrectiveActionWorkspaceProps {
  baseIncidents: Incident[];
  openDrawer: (inc: Incident) => void;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  'Open':        { bg: 'rgba(59,130,246,0.08)', fg: '#2563eb', border: 'rgba(59,130,246,0.2)' },
  'In Progress': { bg: 'rgba(234,179,8,0.08)',  fg: '#ca8a04', border: 'rgba(234,179,8,0.2)' },
  'Completed':   { bg: 'rgba(34,197,94,0.08)',  fg: '#16a34a', border: 'rgba(34,197,94,0.2)' },
  'Verified':    { bg: 'rgba(16,185,129,0.08)', fg: '#059669', border: 'rgba(16,185,129,0.2)' },
  'Overdue':     { bg: 'rgba(239,68,68,0.08)',  fg: '#dc2626', border: 'rgba(239,68,68,0.2)' },
  'Cancelled':   { bg: 'rgba(107,114,128,0.08)',fg: '#6b7280', border: 'rgba(107,114,128,0.2)' },
};

const getStatusStyle = (s: string) => STATUS_COLORS[s] || STATUS_COLORS['Open'];

const HOC_COLORS: Record<string, string> = {
  '1.Elimination': '#dc2626',
  '2.Substitution': '#ea580c',
  '3.Engineering Controls': '#2563eb',
  '4.Administrative Controls': '#ca8a04',
  '5.PPE': '#6b7280',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CorrectiveActionWorkspace({ baseIncidents, openDrawer }: CorrectiveActionWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [hocFilter, setHocFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  /* Extract CA records from all incidents */
  const allCAs = useMemo(() => {
    const records: CARecord[] = [];
    baseIncidents.forEach(inc => {
      // CA1
      const ca1 = (inc.corrective_action_1 as string) || '';
      if (ca1) {
        records.push({
          incidentNo: inc.incident_no,
          incidentDate: inc.incident_date,
          incidentType: inc.incident_type,
          caNumber: 1,
          action: ca1,
          hocType: (inc.ca1_type as string) || '',
          responsible: (inc.ca1_responsible as string) || '',
          dueDate: (inc.ca1_due_date as string) || '',
          status: (inc.ca1_status as string) || 'Open',
          incident: inc,
        });
      }
      // CA2
      const ca2 = (inc.corrective_action_2 as string) || '';
      if (ca2) {
        records.push({
          incidentNo: inc.incident_no,
          incidentDate: inc.incident_date,
          incidentType: inc.incident_type,
          caNumber: 2,
          action: ca2,
          hocType: (inc.ca2_type as string) || '',
          responsible: (inc.ca2_responsible as string) || '',
          dueDate: (inc.ca2_due_date as string) || '',
          status: (inc.ca2_status as string) || 'Open',
          incident: inc,
        });
      }
    });
    // Sort by due date ascending (earliest first), empty dates last
    records.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return records;
  }, [baseIncidents]);

  /* Mark overdue: if status is Open/In Progress and dueDate < today */
  const today = new Date().toISOString().split('T')[0];
  const enriched = allCAs.map(ca => ({
    ...ca,
    isOverdue: ca.dueDate && ca.dueDate < today && !['Completed', 'Verified', 'Cancelled'].includes(ca.status),
  }));

  /* Filter */
  const filtered = enriched.filter(ca => {
    if (statusFilter) {
      if (statusFilter === 'Overdue') {
        if (!ca.isOverdue) return false;
      } else {
        if (ca.status !== statusFilter) return false;
      }
    }
    if (hocFilter && ca.hocType !== hocFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!ca.action.toLowerCase().includes(s) && !ca.responsible.toLowerCase().includes(s) && !ca.incidentNo.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  /* KPIs */
  const totalCA = allCAs.length;
  const openCA = enriched.filter(ca => ca.status === 'Open' || ca.status === 'In Progress').length;
  const overdueCA = enriched.filter(ca => ca.isOverdue).length;
  const completedCA = allCAs.filter(ca => ca.status === 'Completed' || ca.status === 'Verified').length;
  const cancelledCA = allCAs.filter(ca => ca.status === 'Cancelled').length;
  const completionRate = totalCA > 0 ? Math.round((completedCA / totalCA) * 100) : 0;

  /* HoC breakdown */
  const hocBreakdown: Record<string, number> = {};
  allCAs.forEach(ca => { if (ca.hocType) hocBreakdown[ca.hocType] = (hocBreakdown[ca.hocType] || 0) + 1; });
  const hocEntries = Object.entries(hocBreakdown).sort((a, b) => b[1] - a[1]);

  /* Responsible breakdown */
  const respBreakdown: Record<string, number> = {};
  enriched.filter(ca => !['Completed', 'Verified', 'Cancelled'].includes(ca.status)).forEach(ca => {
    if (ca.responsible) respBreakdown[ca.responsible] = (respBreakdown[ca.responsible] || 0) + 1;
  });
  const respEntries = Object.entries(respBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* CSV Export */
  const exportCSV = () => {
    if (filtered.length === 0) return;
    const esc = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    const headers = ['Incident No', 'วันที่เกิดเหตุ', 'ประเภท', 'CA#', 'มาตรการ', 'HoC', 'ผู้รับผิดชอบ', 'กำหนดเสร็จ', 'สถานะ', 'Overdue'];
    const csv = '\uFEFF' + [
      headers.join(','),
      ...filtered.map(ca => [
        esc(ca.incidentNo), esc(ca.incidentDate), esc(ca.incidentType),
        String(ca.caNumber), esc(ca.action), esc(ca.hocType),
        esc(ca.responsible), esc(ca.dueDate), esc(ca.status),
        ca.isOverdue ? 'Yes' : '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `corrective_actions_${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total CAs', value: totalCA, icon: ClipboardCheck, color: 'var(--accent)' },
          { label: 'Open / In Progress', value: openCA, icon: Clock, color: '#2563eb' },
          { label: 'Overdue', value: overdueCA, icon: AlertTriangle, color: '#dc2626' },
          { label: 'Completed', value: completedCA, icon: CheckCircle, color: '#16a34a' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle, color: '#059669' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{kpi.label}</span>
            </div>
            <p className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row: HoC Breakdown + Top Responsible */}
      <div className="grid grid-cols-2 gap-3">
        {/* HoC Breakdown */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
          <h4 className="text-[12px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Hierarchy of Controls</h4>
          {hocEntries.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูล HoC</p>
          ) : (
            <div className="space-y-2">
              {hocEntries.map(([hoc, count]) => {
                const pct = totalCA > 0 ? (count / totalCA) * 100 : 0;
                return (
                  <div key={hoc}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{hoc}</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: HOC_COLORS[hoc] || 'var(--accent)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Responsible (open CAs) */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
          <h4 className="text-[12px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Open CAs by Responsible</h4>
          {respEntries.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>ไม่มี CA ที่เปิดอยู่</p>
          ) : (
            <div className="space-y-2">
              {respEntries.map(([name, count]) => {
                const pct = openCA > 0 ? (count / openCA) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหามาตรการ, ผู้รับผิดชอบ, Incident No..."
            className="w-full rounded-lg text-[12px]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '7px 12px 7px 32px', color: 'var(--text-primary)' }}
          />
        </div>
        {/* Status chips */}
        <div className="flex items-center gap-1">
          {['', 'Open', 'In Progress', 'Overdue', 'Completed', 'Verified', 'Cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: statusFilter === s ? (s === '' ? 'var(--accent)' : getStatusStyle(s).bg) : 'transparent',
                color: statusFilter === s ? (s === '' ? '#fff' : getStatusStyle(s).fg) : 'var(--muted)',
                border: `1px solid ${statusFilter === s ? (s === '' ? 'var(--accent)' : getStatusStyle(s).border) : 'var(--border)'}`,
              }}
            >
              {s || 'ทั้งหมด'}
            </button>
          ))}
        </div>
        {/* HoC filter */}
        <select
          value={hocFilter}
          onChange={e => setHocFilter(e.target.value)}
          className="rounded-lg text-[11px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '5px 8px', color: 'var(--text-secondary)' }}
        >
          <option value="">ทุก HoC</option>
          {['1.Elimination', '2.Substitution', '3.Engineering Controls', '4.Administrative Controls', '5.PPE'].map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <Download size={12} /> Export
        </button>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{filtered.length} รายการ</span>
      </div>

      {/* CA Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
        <div className="overflow-auto max-h-[500px]">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-[2]">
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                {['Incident', 'CA#', 'มาตรการแก้ไข', 'HoC', 'ผู้รับผิดชอบ', 'กำหนดเสร็จ', 'สถานะ'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--muted)', fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: 'var(--muted)' }}>ไม่พบ Corrective Action</td></tr>
              ) : filtered.map((ca, i) => {
                const badge = getTypeBadge(ca.incidentType);
                const ss = ca.isOverdue ? getStatusStyle('Overdue') : getStatusStyle(ca.status);
                return (
                  <tr
                    key={`${ca.incidentNo}-${ca.caNumber}`}
                    onClick={() => openDrawer(ca.incident)}
                    className="hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                    style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold text-[11px]" style={{ color: 'var(--accent)' }}>{ca.incidentNo}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {ca.incidentDate ? new Date(ca.incidentDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        {ca.caNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[250px]">
                      <div className="truncate" style={{ color: 'var(--text-primary)' }} title={ca.action}>{ca.action}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {ca.hocType ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${HOC_COLORS[ca.hocType] || 'var(--muted)'}15`, color: HOC_COLORS[ca.hocType] || 'var(--muted)' }}>
                          {ca.hocType}
                        </span>
                      ) : <span style={{ color: 'var(--muted)' }}>-</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{ca.responsible || '-'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {ca.dueDate ? (
                        <span style={{ color: ca.isOverdue ? '#dc2626' : 'var(--text-secondary)', fontWeight: ca.isOverdue ? 600 : 400 }}>
                          {new Date(ca.dueDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {ca.isOverdue && <span className="ml-1 text-[9px]">⚠</span>}
                        </span>
                      ) : <span style={{ color: 'var(--muted)' }}>-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}` }}>
                        {ca.isOverdue ? 'Overdue' : ca.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
