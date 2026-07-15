'use client';

import { COMPANIES } from '@/lib/companies';

/**
 * Group-wide injury analytics for the HQ overview.
 * Aggregates injured-person records across all companies:
 * body part, nature of injury, severity, person type, company, top lost-days.
 * Respects the global filters (years via fetch, work-related + person group via props).
 */

export interface HqInjuredPerson {
  incident_no: string;
  person_type?: string | null;
  injury_severity?: string | null;
  nature_of_injury?: string | null;
  body_part?: string | null;
  is_lti?: boolean | string | null;
  lost_work_days?: number | null;
}

export interface HqIncidentMeta {
  year: number;
  work_related: string;
  incident_type: string;
  company_id?: string;
}

interface Props {
  persons: HqInjuredPerson[];
  incidentMap: Record<string, HqIncidentMeta>;
  workRelatedOnly: boolean;
  personFilter: 'all' | 'employee' | 'contractor';
}

const BAR_COLORS = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2', '#B07AA1'];

function BreakdownCard({ title, counts, total }: { title: string; counts: [string, number][]; total: number }) {
  const top = counts.slice(0, 6);
  const max = Math.max(...top.map(([, c]) => c), 1);
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{title}</div>
      {top.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ไม่มีข้อมูล</div>
      ) : top.map(([label, count], i) => (
        <div key={label} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({total > 0 ? Math.round((count / total) * 100) : 0}%)</span></span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
            <div style={{ height: 6, borderRadius: 3, width: `${(count / max) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HqInjuryAnalytics({ persons, incidentMap, workRelatedOnly, personFilter }: Props) {
  const shortName = (cid?: string) => COMPANIES.find(c => c.id === cid)?.shortName || (cid || '').toUpperCase();

  // Apply the same global filters as the rest of the page
  const filtered = persons.filter(p => {
    const meta = incidentMap[p.incident_no];
    if (workRelatedOnly && meta && meta.work_related !== 'ใช่') return false;
    if (personFilter === 'employee') return (p.person_type || '').includes('พนักงาน');
    if (personFilter === 'contractor') return (p.person_type || '').includes('ผู้รับเหมา');
    return true;
  });

  const countBy = (fn: (p: HqInjuredPerson) => string): [string, number][] => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { const k = fn(p) || 'ไม่ระบุ'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const total = filtered.length;
  const totalLostDays = filtered.reduce((s, p) => s + (Number(p.lost_work_days) || 0), 0);
  const topLostDays = [...filtered]
    .filter(p => (Number(p.lost_work_days) || 0) > 0)
    .sort((a, b) => (Number(b.lost_work_days) || 0) - (Number(a.lost_work_days) || 0))
    .slice(0, 10);

  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>วิเคราะห์การบาดเจ็บ — ทุกบริษัท</h3>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          ผู้บาดเจ็บ {total} คน · วันหยุดงานรวม {totalLostDays} วัน · ตามตัวกรองด้านบน
        </span>
      </div>

      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>ไม่มีผู้บาดเจ็บในช่วงที่เลือก</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
            <BreakdownCard title="อวัยวะที่บาดเจ็บ" counts={countBy(p => p.body_part || '')} total={total} />
            <BreakdownCard title="ลักษณะการบาดเจ็บ" counts={countBy(p => p.nature_of_injury || '')} total={total} />
            <BreakdownCard title="ความรุนแรง" counts={countBy(p => p.injury_severity || '')} total={total} />
            <BreakdownCard title="บริษัท" counts={countBy(p => shortName(incidentMap[p.incident_no]?.company_id))} total={total} />
          </div>

          {topLostDays.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>วันหยุดงานสูงสุด (Top 10)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>บริษัท</th>
                      <th style={{ padding: '6px 8px' }}>เลขที่เหตุการณ์</th>
                      <th style={{ padding: '6px 8px' }}>อวัยวะ</th>
                      <th style={{ padding: '6px 8px' }}>ลักษณะแผล</th>
                      <th style={{ padding: '6px 8px' }}>ประเภทบุคคล</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>หยุดงาน (วัน)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLostDays.map((p, i) => {
                      const cid = incidentMap[p.incident_no]?.company_id;
                      return (
                        <tr key={`${p.incident_no}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <a href={`/projects/incidents/${cid || ''}`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>{shortName(cid)}</a>
                          </td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{p.incident_no}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{p.body_part || '—'}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{p.nature_of_injury || '—'}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{p.person_type || '—'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#E15759' }}>{Number(p.lost_work_days) || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>คลิกชื่อบริษัทเพื่อดูรายละเอียดเหตุการณ์ในหน้าบริษัทนั้น</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
