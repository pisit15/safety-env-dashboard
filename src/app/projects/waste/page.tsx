'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { Recycle } from 'lucide-react';
import type { WasteRecord, WasteMethod, WasteTarget } from '@/lib/types';
import { aggregateByYear, recycleMethodSet, targetForYear, fmtTon, KG_PER_TON } from '@/lib/waste';

const C_RECYCLE = '#59A14F';
const C_DISPOSAL = '#E15759';
const C_HAZ = '#F28E2B';
const C_PRIMARY = '#4E79A7';

export default function WasteHqPage() {
  const auth = useAuth();
  const router = useRouter();
  const { companies } = useCompanies();

  // Non-admin users go straight to their own company page
  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) {
      const cid = Object.keys(auth.companyAuth)[0];
      if (cid) router.replace(`/projects/waste/${cid}`);
    }
  }, [auth.isHydrated, auth.isAdmin, auth.companyAuth, router]);

  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [methods, setMethods] = useState<WasteMethod[]>([]);
  const [targets, setTargets] = useState<WasteTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.isAdmin) return;
    Promise.all([
      fetch('/api/waste/records?companyId=all').then(r => r.json()),
      fetch('/api/waste/methods').then(r => r.json()),
      fetch('/api/waste/targets').then(r => r.json()),
    ]).then(([rec, met, tar]) => {
      setRecords(rec.records || []);
      setMethods(met.methods || []);
      setTargets(tar.targets || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.isAdmin]);

  const recycleSet = useMemo(() => recycleMethodSet(methods), [methods]);
  const groupTarget = useMemo(() => targets.find(t => t.company_id === 'all') || null, [targets]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const availableYears = useMemo(() => {
    const ys = new Set<number>(records.map(r => parseInt(String(r.record_date).slice(0, 4))).filter(Boolean));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [records, currentYear]);

  const yearRecords = useMemo(() =>
    records.filter(r => parseInt(String(r.record_date).slice(0, 4)) === selectedYear),
  [records, selectedYear]);

  // Group KPI for selected year
  const kpi = useMemo(() => {
    let recycleTon = 0, disposalTon = 0, hazTon = 0, cost = 0;
    for (const r of yearRecords) {
      const ton = (Number(r.quantity_kg) || 0) / KG_PER_TON;
      if (recycleSet.has(r.disposal_method)) recycleTon += ton; else disposalTon += ton;
      if (r.waste_category === 'Hazardous') hazTon += ton;
      cost += Number(r.cost) || 0;
    }
    const total = recycleTon + disposalTon;
    return { total, recycleTon, disposalTon, hazTon, cost, recyclePct: total > 0 ? (recycleTon / total) * 100 : 0 };
  }, [yearRecords, recycleSet]);

  // Yearly trend (all years, group)
  const yearlyAgg = useMemo(() => aggregateByYear(records, recycleSet), [records, recycleSet]);

  // Glide path table: base year → 2030 targets vs actual per year
  const glidePath = useMemo(() => {
    if (!groupTarget) return [];
    const rows: { year: number; tRecycle: number; tDisposal: number; aRecycle: number | null; aDisposal: number | null }[] = [];
    for (let y = groupTarget.base_year + 1; y <= groupTarget.target_end_year; y++) {
      const t = targetForYear(groupTarget, y);
      if (!t) continue;
      const actual = yearlyAgg.find(a => a.year === y);
      rows.push({
        year: y,
        tRecycle: t.recycleNonhazTon + t.recycleHazTon,
        tDisposal: t.disposalNonhazTon + t.disposalHazTon,
        aRecycle: actual ? actual.recycleNonhazTon + actual.recycleHazTon : null,
        aDisposal: actual ? actual.disposalNonhazTon + actual.disposalHazTon : null,
      });
    }
    return rows;
  }, [groupTarget, yearlyAgg]);

  // Target comparison for selected year (group)
  const yearAgg = useMemo(() => yearlyAgg.find(a => a.year === selectedYear) || null, [yearlyAgg, selectedYear]);
  const yearTarget = useMemo(() => groupTarget ? targetForYear(groupTarget, selectedYear) : null, [groupTarget, selectedYear]);

  // Per-company summary for selected year
  const companyStats = useMemo(() => {
    const map = new Map<string, { recycleTon: number; disposalTon: number; count: number }>();
    for (const r of yearRecords) {
      let s = map.get(r.company_id);
      if (!s) { s = { recycleTon: 0, disposalTon: 0, count: 0 }; map.set(r.company_id, s); }
      const ton = (Number(r.quantity_kg) || 0) / KG_PER_TON;
      if (recycleSet.has(r.disposal_method)) s.recycleTon += ton; else s.disposalTon += ton;
      s.count += 1;
    }
    return map;
  }, [yearRecords, recycleSet]);

  if (!auth.isHydrated || !auth.isAdmin) return null;

  const maxGlide = Math.max(...glidePath.map(g => Math.max(g.tRecycle, g.tDisposal, g.aRecycle || 0, g.aDisposal || 0)), 1);

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Recycle size={24} style={{ color: C_RECYCLE }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>การจัดการขยะ — ภาพรวมทุกบริษัท</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        เป้าหมาย 2030: รีไซเคิลเพิ่ม {groupTarget?.recycle_step_pct ?? 5}%/ปี · ลดการกำจัด {groupTarget?.disposal_step_pct ?? 3}%/ปี (ฐานปี {groupTarget?.base_year ?? 2023})
      </p>

      {/* Year chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>ปี:</span>
        {availableYears.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)}
            style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: selectedYear === y ? C_PRIMARY : 'var(--border)', background: selectedYear === y ? C_PRIMARY : 'var(--card-solid)', color: selectedYear === y ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
            {y}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: `ขยะรวมปี ${selectedYear}`, value: `${fmtTon(kpi.total)} ตัน`, color: C_PRIMARY },
          { label: 'รีไซเคิล/ใช้ซ้ำ', value: `${fmtTon(kpi.recycleTon)} ตัน`, sub: `${kpi.recyclePct.toFixed(1)}% ของขยะรวม`, color: C_RECYCLE },
          { label: 'กำจัด (ฝังกลบ/เผา)', value: `${fmtTon(kpi.disposalTon)} ตัน`, color: C_DISPOSAL },
          { label: 'ขยะอันตราย', value: `${fmtTon(kpi.hazTon)} ตัน`, color: C_HAZ },
          { label: 'รายได้/ค่าใช้จ่ายสุทธิ', value: `${kpi.cost.toLocaleString('en-US', { maximumFractionDigits: 0 })} ฿`, color: kpi.cost >= 0 ? C_RECYCLE : C_DISPOSAL },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', borderLeft: `4px solid ${card.color}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Selected-year target comparison */}
      {yearTarget && (
        <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            เทียบเป้าหมายกลุ่ม ปี {selectedYear} (รีไซเคิล +{yearTarget.cumPctRecycle}% · กำจัด −{yearTarget.cumPctDisposal}% จากฐานปี {groupTarget?.base_year})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>ตัวชี้วัด (ตัน)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>ผลจริง</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>เป้าหมาย</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'รีไซเคิล Non-Hazardous', actual: yearAgg?.recycleNonhazTon || 0, target: yearTarget.recycleNonhazTon, up: true },
                  { label: 'รีไซเคิล Hazardous', actual: yearAgg?.recycleHazTon || 0, target: yearTarget.recycleHazTon, up: true },
                  { label: 'กำจัด Non-Hazardous', actual: yearAgg?.disposalNonhazTon || 0, target: yearTarget.disposalNonhazTon, up: false },
                  { label: 'กำจัด Hazardous', actual: yearAgg?.disposalHazTon || 0, target: yearTarget.disposalHazTon, up: false },
                ].map(row => {
                  const ok = row.target > 0 ? (row.up ? row.actual >= row.target : row.actual <= row.target) : null;
                  return (
                    <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>{row.label}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: row.up ? C_RECYCLE : C_DISPOSAL }}>{fmtTon(row.actual)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.target > 0 ? `${row.up ? '≥' : '≤'} ${fmtTon(row.target)}` : '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {ok !== null && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: ok ? '#59A14F18' : '#E1575918', color: ok ? C_RECYCLE : C_DISPOSAL }}>
                            {ok ? 'ตามเป้า' : 'ไม่ตามเป้า'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Glide path to 2030 */}
      {glidePath.length > 0 && (
        <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เส้นทางสู่เป้าหมาย {groupTarget?.target_end_year} (ตัน/ปี)</h3>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 3, background: C_RECYCLE, display: 'inline-block' }} /> เป้ารีไซเคิล</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 3, background: C_DISPOSAL, display: 'inline-block' }} /> เป้ากำจัด</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: C_RECYCLE, display: 'inline-block' }} /> ผลจริงรีไซเคิล</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: C_DISPOSAL, display: 'inline-block' }} /> ผลจริงกำจัด</span>
            </div>
          </div>
          <svg viewBox="0 0 760 240" style={{ width: '100%', minWidth: 480, height: 'auto', marginTop: 8 }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => (
              <line key={f} x1={50} x2={740} y1={20 + 160 * f} y2={20 + 160 * f} stroke="var(--border)" strokeWidth={1} />
            ))}
            {(() => {
              const n = glidePath.length;
              const x = (i: number) => 50 + (690 / Math.max(n - 1, 1)) * i;
              const y = (v: number) => 180 - (v / maxGlide) * 160;
              const path = (vals: (number | null)[], _color: string) =>
                vals.map((v, i) => v === null ? '' : `${i === 0 || vals[i - 1] === null ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
              return (
                <g>
                  <path d={path(glidePath.map(g => g.tRecycle), C_RECYCLE)} fill="none" stroke={C_RECYCLE} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />
                  <path d={path(glidePath.map(g => g.tDisposal), C_DISPOSAL)} fill="none" stroke={C_DISPOSAL} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />
                  {glidePath.map((g, i) => (
                    <g key={g.year}>
                      {g.aRecycle !== null && <circle cx={x(i)} cy={y(g.aRecycle)} r={5} fill={C_RECYCLE} stroke="var(--card-solid)" strokeWidth={1.5} />}
                      {g.aDisposal !== null && <circle cx={x(i)} cy={y(g.aDisposal)} r={5} fill={C_DISPOSAL} stroke="var(--card-solid)" strokeWidth={1.5} />}
                      {g.aRecycle !== null && <text x={x(i)} y={y(g.aRecycle) - 9} fontSize={10} fontWeight={700} textAnchor="middle" fill={C_RECYCLE} stroke="var(--card-solid)" strokeWidth={3} paintOrder="stroke">{fmtTon(g.aRecycle)}</text>}
                      {g.aDisposal !== null && <text x={x(i)} y={y(g.aDisposal) + 18} fontSize={10} fontWeight={700} textAnchor="middle" fill={C_DISPOSAL} stroke="var(--card-solid)" strokeWidth={3} paintOrder="stroke">{fmtTon(g.aDisposal)}</text>}
                      <text x={x(i)} y={205} fontSize={11} fontWeight={700} textAnchor="middle" fill="var(--text-primary)">{g.year}</text>
                      <text x={x(i)} y={220} fontSize={8.5} textAnchor="middle" fill="var(--text-secondary)">♻ {Math.round(g.tRecycle)} · 🗑 {Math.round(g.tDisposal)}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </svg>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0' }}>เส้นประ = เป้าหมายรายปี · จุด = ผลจริง (แสดงเมื่อมีข้อมูล) · ตัวเลขใต้ปี = เป้ารีไซเคิล/เป้ากำจัด</p>
        </div>
      )}

      {/* Per-company table */}
      <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>รายบริษัท ปี {selectedYear}</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>บริษัท</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>รายการ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>รีไซเคิล (ตัน)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>กำจัด (ตัน)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>รวม (ตัน)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>% รีไซเคิล</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => {
                  const s = companyStats.get(c.id);
                  const total = s ? s.recycleTon + s.disposalTon : 0;
                  const pct = total > 0 && s ? (s.recycleTon / total) * 100 : 0;
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px' }}>
                        <Link href={`/projects/waste/${c.id}`} style={{ color: C_PRIMARY, fontWeight: 600, textDecoration: 'none' }}>{c.name}</Link>
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{s?.count || 0}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: C_RECYCLE, fontWeight: s ? 700 : 400 }}>{s ? fmtTon(s.recycleTon) : '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: C_DISPOSAL, fontWeight: s ? 700 : 400 }}>{s ? fmtTon(s.disposalTon) : '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{s ? fmtTon(total) : '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        {s && total > 0 ? (
                          <span style={{ fontWeight: 700, color: pct >= 50 ? C_RECYCLE : C_HAZ }}>{pct.toFixed(1)}%</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
