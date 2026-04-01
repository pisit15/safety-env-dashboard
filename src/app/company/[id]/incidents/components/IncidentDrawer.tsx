'use client';

import { X, ChevronLeft, ChevronRight, AlertCircle, Eye, Edit2, Clock, FileText, DollarSign, AlertTriangle, Shield, Activity } from 'lucide-react';
import { Incident, getTypeBadge } from '../types';

interface IncidentDrawerProps {
  open: boolean;
  incident: Incident | null;
  detail: Record<string, unknown> | null;
  loading: boolean;
  error: boolean;
  tab: 'summary' | 'investigation' | 'cost' | 'actions';
  setTab: (tab: 'summary' | 'investigation' | 'cost' | 'actions') => void;
  injured: Record<string, unknown>[];
  onClose: () => void;
  onNavigate: (inc: Incident) => void;
  onEdit: (inc: Incident) => void;
  sourceList: Incident[];
}

export default function IncidentDrawer({
  open,
  incident: drawerIncident,
  detail: drawerDetail,
  loading: drawerLoading,
  error: drawerError,
  tab: drawerTab,
  setTab: setDrawerTab,
  injured: drawerInjured,
  onClose: closeDrawer,
  onNavigate: openDrawer,
  onEdit: openEditForm,
  sourceList,
}: IncidentDrawerProps) {
  if (!open || !drawerIncident) return null;

  // ---- Helper: FieldRow Component ----
  const FieldRow = ({ label, value, warn, color }: { label: string; value: string | number; warn?: boolean; color?: string }) => (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-[11px] font-medium shrink-0" style={{ width: 130, color: 'var(--muted)' }}>{label}</span>
      <span className="text-[12px] font-medium flex-1" style={{ color: warn ? '#dc2626' : color || 'var(--text-primary)' }}>
        {value || <span style={{ color: '#d97706', fontStyle: 'italic' }}>ไม่ระบุ</span>}
      </span>
    </div>
  );

  // ---- Helper Functions ----
  const d = drawerDetail || drawerIncident;
  const get = (key: string) => (d as Record<string, unknown>)[key];
  const str = (key: string) => String(get(key) || '') || '';
  const num = (key: string) => Number(get(key)) || 0;

  // ---- Calculate prev/next ----
  const currentIdx = sourceList.findIndex(i => i.id === drawerIncident.id);
  const prevInc = currentIdx > 0 ? sourceList[currentIdx - 1] : null;
  const nextInc = currentIdx >= 0 && currentIdx < sourceList.length - 1 ? sourceList[currentIdx + 1] : null;

  // ---- Cost and type data ----
  const badge = getTypeBadge(drawerIncident.incident_type);
  const isProperty = drawerIncident.incident_type === 'ทรัพย์สินเสียหาย';
  const directCost = num('direct_cost');
  const indirectCost = num('indirect_cost');
  const totalCost = directCost + indirectCost;

  // ---- Missing data checks ----
  const missingFields: string[] = [];
  if (isProperty) {
    if (!str('property_damage_type')) missingFields.push('ประเภทความเสียหาย');
    if (!directCost && !indirectCost) missingFields.push('ค่าเสียหาย');
    if (!str('production_impact')) missingFields.push('ผลกระทบต่อการผลิต');
  }

  // ---- Investigation completeness ----
  const invFields = ['investigation_level', 'rca_method', 'root_cause_category', 'immediate_cause'];
  const invFilled = invFields.filter(f => str(f)).length;
  const invTotal = invFields.length;

  // ---- Actions ----
  const ca1Status = str('ca1_status');
  const ca2Status = str('ca2_status');
  const ca1Due = str('ca1_due_date');
  const ca2Due = str('ca2_due_date');
  const isOverdue = (due: string, status: string) => {
    if (!due || status === 'Completed' || status === 'Verified' || status === 'Cancelled') return false;
    return new Date(due) < new Date();
  };
  const ca1Overdue = isOverdue(ca1Due, ca1Status);
  const ca2Overdue = isOverdue(ca2Due, ca2Status);

  const fmtThb = (v: number) => v > 0 ? `${v.toLocaleString()} ฿` : '—';

  const DRAWER_TABS: { key: typeof drawerTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'investigation', label: 'Investigation' },
    { key: 'cost', label: 'Cost' },
    { key: 'actions', label: 'Actions' },
  ];

  // ---- Keyboard handlers ----
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'ArrowLeft' && prevInc) openDrawer(prevInc);
    if (e.key === 'ArrowRight' && nextInc) openDrawer(nextInc);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div
        tabIndex={-1}
        role="dialog"
        aria-labelledby="drawer-title"
        className="fixed top-0 right-0 z-50 h-full flex flex-col"
        style={{
          width: 'min(520px, 85vw)',
          background: 'var(--card-solid)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.2s ease-out',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 id="drawer-title" className="text-[15px] font-bold font-mono" style={{ color: 'var(--accent)' }}>
                {drawerIncident.incident_no}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                  {drawerIncident.incident_type}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {drawerIncident.incident_date}
                </span>
                {str('shift') && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{str('shift')}</span>}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                  background: drawerIncident.report_status === 'Closed' ? '#dcfce7' : drawerIncident.report_status === 'Approved' ? '#dbeafe' : '#fef3c7',
                  color: drawerIncident.report_status === 'Closed' ? '#16a34a' : drawerIncident.report_status === 'Approved' ? '#2563eb' : '#d97706',
                }}>
                  {drawerIncident.report_status || 'Draft'}
                </span>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Warning badges */}
          {missingFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {missingFields.map(f => (
                <span key={f} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                  <AlertCircle size={10} /> {f}
                </span>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {DRAWER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setDrawerTab(tab.key)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: drawerTab === tab.key ? 'var(--accent)' : 'transparent',
                  color: drawerTab === tab.key ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
                {tab.key === 'actions' && (ca1Overdue || ca2Overdue) && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#dc2626' }} />
                )}
                {tab.key === 'investigation' && invFilled < invTotal && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {drawerLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="w-[130px] h-4 rounded" style={{ background: 'var(--bg-secondary)' }} />
                  <div className="flex-1 h-4 rounded" style={{ background: 'var(--bg-secondary)' }} />
                </div>
              ))}
            </div>
          ) : drawerError ? (
            <div className="text-center py-10">
              <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>โหลดรายละเอียดไม่สำเร็จ</p>
              <button onClick={() => openDrawer(drawerIncident)} className="mt-2 text-[12px] font-semibold px-3 py-1 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>ลองใหม่</button>
            </div>
          ) : drawerTab === 'summary' ? (
            /* ---- SUMMARY TAB ---- */
            <div>
              {/* Description */}
              {str('description') && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>คำอธิบายเหตุการณ์</p>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{str('description')}</p>
                </div>
              )}

              <FieldRow label="พื้นที่ / Area" value={str('area')} />
              <FieldRow label="แผนก" value={str('department')} />
              <FieldRow label="ผู้รายงาน" value={str('reporter')} />
              <FieldRow label="ประเภทบุคคล" value={str('person_type')} />
              <FieldRow label="เกี่ยวกับงาน" value={str('work_related')} />
              <FieldRow label="กิจกรรม" value={str('activity')} />
              <FieldRow label="สภาพแวดล้อม" value={str('environment')} />
              <FieldRow label="ประเภทการสัมผัส" value={str('contact_type')} />
              <FieldRow label="แหล่งที่มา/อุปกรณ์" value={str('agency_source')} />
              <FieldRow label="ความรุนแรงจริง" value={str('actual_severity')} />
              <FieldRow label="ความรุนแรงศักยภาพ" value={str('potential_severity')} />

              {/* Property-specific fields */}
              {isProperty && (
                <div className="mt-4 pt-3" style={{ borderTop: '2px solid var(--border)' }}>
                  <p className="text-[11px] font-bold mb-2" style={{ color: '#1e40af' }}>Property Damage Details</p>
                  <FieldRow label="ประเภทความเสียหาย" value={str('property_damage_type')} warn={!str('property_damage_type')} />
                  <FieldRow label="รายละเอียด" value={str('property_damage_detail')} />
                  <FieldRow label="อุปกรณ์ดับเพลิง" value={str('fire_equipment_used')} />
                  <FieldRow label="Direct Cost" value={directCost > 0 ? fmtThb(directCost) : ''} warn={!directCost && !indirectCost} color="#dc2626" />
                  <FieldRow label="Indirect Cost" value={indirectCost > 0 ? fmtThb(indirectCost) : ''} color="#ea580c" />
                  <FieldRow label="Production Impact" value={str('production_impact')} warn={!str('production_impact')} />
                  <FieldRow label="Insurance Claim" value={str('insurance_claim')} />
                </div>
              )}

              {/* Injured persons summary for injury types */}
              {drawerInjured.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '2px solid var(--border)' }}>
                  <p className="text-[11px] font-bold mb-2" style={{ color: '#f97316' }}>ผู้บาดเจ็บ ({drawerInjured.length} คน)</p>
                  {drawerInjured.map((p, idx) => (
                    <div key={idx} className="rounded-lg p-3 mb-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {String(p.full_name || `ผู้บาดเจ็บ #${idx + 1}`)}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                          background: p.is_lti === 'ใช่' ? '#fef2f2' : '#f0fdf4',
                          color: p.is_lti === 'ใช่' ? '#dc2626' : '#16a34a',
                        }}>
                          {p.is_lti === 'ใช่' ? 'LTI' : 'Non-LTI'}
                        </span>
                      </div>
                      <div className="text-[11px] space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {p.injury_severity ? <div>ความรุนแรง: {String(p.injury_severity)}</div> : null}
                        {p.nature_of_injury ? <div>ลักษณะ: {String(p.nature_of_injury)}</div> : null}
                        {p.body_part ? <div>ส่วนร่างกาย: {String(p.body_part)} {p.body_side ? `(${String(p.body_side)})` : ''}</div> : null}
                        {Number(p.lost_work_days) > 0 && <div>วันหยุดงาน: {String(p.lost_work_days)} วัน</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : drawerTab === 'investigation' ? (
            /* ---- INVESTIGATION TAB ---- */
            <div>
              {invFilled < invTotal && (
                <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                  <AlertCircle size={14} style={{ color: '#b45309' }} />
                  <span className="text-[11px] font-medium" style={{ color: '#92400e' }}>
                    Investigation incomplete — กรอกแล้ว {invFilled}/{invTotal} ฟิลด์หลัก
                  </span>
                </div>
              )}
              <FieldRow label="ระดับการสอบสวน" value={str('investigation_level')} />
              <FieldRow label="วันเริ่มสอบสวน" value={str('investigation_start_date')} />
              <FieldRow label="หัวหน้าสอบสวน" value={str('investigation_lead')} />
              <FieldRow label="วิธี RCA" value={str('rca_method')} />
              <FieldRow label="Root Cause Category" value={str('root_cause_category')} />
              <FieldRow label="Barrier Failure" value={str('barrier_failure')} />
              <FieldRow label="สาเหตุทันที" value={str('immediate_cause')} />
              <FieldRow label="สาเหตุร่วม" value={str('contributing_cause')} />
              <FieldRow label="รายละเอียด Root Cause" value={str('root_cause_detail')} />
              <FieldRow label="Just Culture" value={str('just_culture')} />
            </div>

          ) : drawerTab === 'cost' ? (
            /* ---- COST TAB ---- */
            <div>
              {/* Cost summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl p-3 text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#991b1b' }}>Direct Cost</p>
                  <p className="text-[16px] font-bold mt-1" style={{ color: '#dc2626' }}>{directCost > 0 ? fmtThb(directCost) : <span style={{ color: '#d97706', fontSize: 11 }}>Not provided</span>}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#9a3412' }}>Indirect Cost</p>
                  <p className="text-[16px] font-bold mt-1" style={{ color: '#ea580c' }}>{indirectCost > 0 ? fmtThb(indirectCost) : <span style={{ color: '#d97706', fontSize: 11 }}>Not provided</span>}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#1e3a5f' }}>Total</p>
                  <p className="text-[16px] font-bold mt-1" style={{ color: '#1e40af' }}>{totalCost > 0 ? fmtThb(totalCost) : '—'}</p>
                </div>
              </div>

              <FieldRow label="Direct Cost" value={directCost > 0 ? fmtThb(directCost) : '0 ฿ (Not provided)'} color="#dc2626" />
              <FieldRow label="Indirect Cost" value={indirectCost > 0 ? fmtThb(indirectCost) : '0 ฿ (Not provided)'} color="#ea580c" />
              <FieldRow label="Total Loss" value={totalCost > 0 ? fmtThb(totalCost) : '—'} color="#1e40af" />
              <FieldRow label="Production Impact" value={str('production_impact')} />
              <FieldRow label="Insurance Claim" value={str('insurance_claim')} />

              {!directCost && !indirectCost && (
                <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                  <AlertCircle size={14} style={{ color: '#b45309' }} />
                  <span className="text-[11px]" style={{ color: '#92400e' }}>ยังไม่มีข้อมูลค่าเสียหาย — กรุณาแก้ไข record เพื่อเพิ่มข้อมูล</span>
                </div>
              )}
            </div>

          ) : drawerTab === 'actions' ? (
            /* ---- ACTIONS TAB ---- */
            <div>
              {/* Status summary bar */}
              <div className="flex gap-3 mb-4">
                {(() => {
                  const statuses = [ca1Status, ca2Status].filter(Boolean);
                  const completed = statuses.filter(s => s === 'Completed' || s === 'Verified').length;
                  const overdue = [ca1Overdue, ca2Overdue].filter(Boolean).length;
                  const inProg = statuses.filter(s => s === 'In Progress' || s === 'Open').length;
                  return (
                    <>
                      {overdue > 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>
                          {overdue} overdue
                        </span>
                      )}
                      {inProg > 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>
                          {inProg} in progress
                        </span>
                      )}
                      {completed > 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                          {completed} completed
                        </span>
                      )}
                      {statuses.length === 0 && (
                        <span className="text-[11px] italic" style={{ color: 'var(--muted)' }}>ยังไม่มี Corrective Action</span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* CA 1 */}
              {(str('corrective_action_1') || ca1Status) && (
                <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--bg-secondary)', border: ca1Overdue ? '2px solid #dc2626' : '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>Corrective Action 1</span>
                    <div className="flex items-center gap-2">
                      {ca1Overdue && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#dc2626', color: '#fff' }}>OVERDUE</span>}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                        background: ca1Status === 'Completed' || ca1Status === 'Verified' ? '#dcfce7' : ca1Status === 'In Progress' ? '#dbeafe' : '#fef3c7',
                        color: ca1Status === 'Completed' || ca1Status === 'Verified' ? '#16a34a' : ca1Status === 'In Progress' ? '#2563eb' : '#d97706',
                      }}>
                        {ca1Status || 'Not set'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[12px] mb-2" style={{ color: 'var(--text-primary)' }}>{str('corrective_action_1') || 'ไม่ระบุ'}</p>
                  <div className="flex gap-4 text-[10px]" style={{ color: 'var(--muted)' }}>
                    <span>ผู้รับผิดชอบ: {str('ca1_responsible') || '—'}</span>
                    <span>กำหนด: {ca1Due || '—'}</span>
                    <span>HOC: {str('ca1_hoc') || '—'}</span>
                  </div>
                </div>
              )}

              {/* CA 2 */}
              {(str('corrective_action_2') || ca2Status) && (
                <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--bg-secondary)', border: ca2Overdue ? '2px solid #dc2626' : '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>Corrective Action 2</span>
                    <div className="flex items-center gap-2">
                      {ca2Overdue && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#dc2626', color: '#fff' }}>OVERDUE</span>}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                        background: ca2Status === 'Completed' || ca2Status === 'Verified' ? '#dcfce7' : ca2Status === 'In Progress' ? '#dbeafe' : '#fef3c7',
                        color: ca2Status === 'Completed' || ca2Status === 'Verified' ? '#16a34a' : ca2Status === 'In Progress' ? '#2563eb' : '#d97706',
                      }}>
                        {ca2Status || 'Not set'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[12px] mb-2" style={{ color: 'var(--text-primary)' }}>{str('corrective_action_2') || 'ไม่ระบุ'}</p>
                  <div className="flex gap-4 text-[10px]" style={{ color: 'var(--muted)' }}>
                    <span>ผู้รับผิดชอบ: {str('ca2_responsible') || '—'}</span>
                    <span>กำหนด: {ca2Due || '—'}</span>
                    <span>HOC: {str('ca2_hoc') || '—'}</span>
                  </div>
                </div>
              )}

              {/* Lessons learned + closure */}
              <div className="mt-3">
                <FieldRow label="บทเรียน" value={str('lessons_learned')} />
                <FieldRow label="สถานะรายงาน" value={str('report_status')} />
                <FieldRow label="วันปิดรายงาน" value={str('report_closed_date')} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer: Edit + Prev/Next */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <button
            onClick={() => { closeDrawer(); openEditForm(drawerIncident); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all hover:shadow-md"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Edit2 size={13} /> Edit full record
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevInc && openDrawer(prevInc)}
              disabled={!prevInc}
              className="p-2 rounded-lg transition-opacity"
              style={{ color: 'var(--text-secondary)', opacity: prevInc ? 1 : 0.25 }}
              title="Previous (←)"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {currentIdx >= 0 ? `${currentIdx + 1}/${sourceList.length}` : ''}
            </span>
            <button
              onClick={() => nextInc && openDrawer(nextInc)}
              disabled={!nextInc}
              className="p-2 rounded-lg transition-opacity"
              style={{ color: 'var(--text-secondary)', opacity: nextInc ? 1 : 0.25 }}
              title="Next (→)"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
