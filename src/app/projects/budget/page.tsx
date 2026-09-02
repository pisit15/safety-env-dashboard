'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { DEFAULT_YEAR } from '@/lib/companies';
import { Wallet, Lock, CheckCircle2, CircleDashed, BarChart3 } from 'lucide-react';

interface DashCompany { companyId: string; safety: number; environment: number; total: number }
interface DashCategory { name: string; planType: string; total: number; count: number }
interface DashMonth { month: number; safety: number; environment: number }
interface DashData { perCompany: DashCompany[]; perCategory: DashCategory[]; perMonth: DashMonth[] }

// หน่วยเดียวทั้ง dashboard: ล้านบาท
const fmtMB = (v: number): string => {
  if (v === 0) return '0';
  const m = v / 1_000_000;
  const a = Math.abs(m);
  if (a >= 0.01) return m.toFixed(2);
  if (a >= 0.001) return m.toFixed(3);
  return m.toFixed(4);
};
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

interface CompanySummary {
  companyId: string;
  itemCount: number;
  safetyCount: number;
  environmentCount: number;
  totalAmount: number;
  lastUpdated: string | null;
  lastBy: string | null;
  locked: boolean;
  lockedBy: string | null;
}

const BUDGET_DEFAULT_YEAR = DEFAULT_YEAR + 1;

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDay = Math.floor(diffMs / 86400000);
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (diffDay <= 0 && d.getDate() === now.getDate()) return `วันนี้ ${time}`;
  if (diffDay <= 7) {
    const dd = Math.max(diffDay, 1);
    return `${dd} วันก่อน`;
  }
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function BudgetLanding() {
  const auth = useAuth();
  const router = useRouter();
  const { companies } = useCompanies();
  const [selectedYear, setSelectedYear] = useState(BUDGET_DEFAULT_YEAR);
  const [years, setYears] = useState<number[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CompanySummary>>({});
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashData | null>(null);

  // Non-admin users go straight to their own company budget
  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) {
      const cid = Object.keys(auth.companyAuth)[0];
      if (cid) router.replace(`/projects/budget/${cid}`);
    }
  }, [auth.isHydrated, auth.isAdmin, auth.companyAuth, router]);

  // Year options
  useEffect(() => {
    fetch('/api/plan-years')
      .then(r => r.json())
      .then(d => {
        const ys: number[] = Array.isArray(d.years) && d.years.length ? d.years : [DEFAULT_YEAR];
        const all = Array.from(new Set([...ys, BUDGET_DEFAULT_YEAR])).sort((a, b) => b - a);
        setYears(all);
      })
      .catch(() => setYears([DEFAULT_YEAR, BUDGET_DEFAULT_YEAR].sort((a, b) => b - a)));
  }, []);

  // Per-company progress for the selected year
  useEffect(() => {
    if (!auth.isAdmin) return;
    setLoading(true);
    fetch(`/api/budget-plan/summary?year=${selectedYear}`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, CompanySummary> = {};
        (d.summaries || []).forEach((s: CompanySummary) => { map[s.companyId] = s; });
        setSummaries(map);
      })
      .catch(() => setSummaries({}))
      .finally(() => setLoading(false));
  }, [selectedYear, auth.isAdmin]);

  // Executive dashboard aggregates
  useEffect(() => {
    if (!auth.isAdmin) return;
    setDash(null);
    fetch(`/api/budget-plan/dashboard?year=${selectedYear}`)
      .then(r => r.json())
      .then(d => { if (d.perCompany) setDash(d as DashData); })
      .catch(() => setDash(null));
  }, [selectedYear, auth.isAdmin]);

  if (!auth.isHydrated) return null;
  if (!auth.isAdmin) return null;

  const active = companies.filter((c) => c.sheetId !== undefined);
  const doneCount = active.filter(c => summaries[c.id]?.locked).length;
  const startedCount = active.filter(c => (summaries[c.id]?.itemCount || 0) > 0 && !summaries[c.id]?.locked).length;
  const notStartedCount = active.length - doneCount - startedCount;

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wallet size={24} style={{ color: '#f59e0b' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>งบประมาณประจำปี</h1>
        </div>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {(years.length ? years : [BUDGET_DEFAULT_YEAR]).map(y => <option key={y} value={y}>ปี {y}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>เลือกบริษัทเพื่อจัดการแผนงบประมาณ</p>

      {/* Progress summary strip */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Lock size={13} style={{ color: '#59A14F' }} /> เสร็จ/ล็อกแล้ว <b style={{ color: '#59A14F' }}>{doneCount}</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle2 size={13} style={{ color: '#4E79A7' }} /> อัปเดตแล้ว <b style={{ color: '#4E79A7' }}>{startedCount}</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CircleDashed size={13} style={{ color: '#BAB0AC' }} /> ยังไม่เริ่ม <b>{notStartedCount}</b>
        </span>
        <span style={{ opacity: 0.7 }}>· ปี {selectedYear}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {active.map((c) => {
          const s = summaries[c.id];
          const hasItems = (s?.itemCount || 0) > 0;
          const locked = !!s?.locked;
          const borderColor = locked ? '#59A14F' : hasItems ? '#4E79A7' : 'var(--border)';
          return (
            <Link key={c.id} href={`/projects/budget/${c.id}`}
              style={{ display: 'block', padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: `1px solid ${borderColor}`, borderLeft: `4px solid ${locked ? '#59A14F' : hasItems ? '#4E79A7' : 'var(--border)'}`, textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                {loading ? (
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>…</span>
                ) : locked ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#59A14F18', color: '#59A14F' }}><Lock size={10} /> ล็อกแล้ว</span>
                ) : hasItems ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#4E79A718', color: '#4E79A7' }}><CheckCircle2 size={10} /> อัปเดตแล้ว</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}><CircleDashed size={10} /> ยังไม่เริ่ม</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName || c.id}</div>
              {!loading && hasItems && s && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div>
                    <b style={{ color: 'var(--text-primary)' }}>{s.itemCount}</b> รายการ
                    {s.environmentCount > 0 && <span> (S {s.safetyCount} · E {s.environmentCount})</span>}
                    {' · รวม '}<b style={{ color: 'var(--text-primary)' }}>{s.totalAmount.toLocaleString()}</b> ฿
                  </div>
                  {s.lastUpdated && (
                    <div>อัปเดตล่าสุด {fmtWhen(s.lastUpdated)}{s.lastBy ? ` โดย ${s.lastBy}` : ''}</div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* ═══ Executive Dashboard — งบตั้ง (แผน) ปีที่เลือก ═══ */}
      {dash && dash.perCompany.length > 0 && (() => {
        const totalAll = dash.perCompany.reduce((s, c) => s + c.total, 0);
        const totalS = dash.perCompany.reduce((s, c) => s + c.safety, 0);
        const totalE = dash.perCompany.reduce((s, c) => s + c.environment, 0);
        const compRows = dash.perCompany.filter(c => c.total > 0);
        const maxComp = Math.max(...compRows.map(c => c.total), 1);
        const topCats = dash.perCategory.filter(c => c.total > 0).slice(0, 8);
        const otherCats = dash.perCategory.filter(c => c.total > 0).slice(8);
        const otherTotal = otherCats.reduce((s, c) => s + c.total, 0);
        const maxCat = Math.max(...topCats.map(c => c.total), otherTotal, 1);
        const maxMonth = Math.max(...dash.perMonth.map(m => m.safety + m.environment), 1);
        const peakMonth = dash.perMonth.reduce((best, m) => (m.safety + m.environment > best.safety + best.environment ? m : best), dash.perMonth[0]);
        const nameOf = (cid: string) => companies.find(c => c.id === cid)?.name || cid.toUpperCase();
        const card = { background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' } as const;
        return (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BarChart3 size={18} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ภาพรวมผู้บริหาร — งบตั้งปี {selectedYear}</h2>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              หน่วย: ล้านบาท · ตัวเลขทั้งหมดเป็นงบตั้ง (แผน) ยังไม่ใช่ค่าใช้จ่ายจริง
            </p>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'งบรวมทั้งกลุ่ม', value: `${fmtMB(totalAll)} ลบ.`, color: '#4E79A7', sub: `${dash.perCompany.reduce((s, c) => s + (c.total > 0 ? 1 : 0), 0)} บริษัทที่มีงบ` },
                { label: 'Safety', value: `${fmtMB(totalS)} ลบ.`, color: '#F28E2B', sub: totalAll > 0 ? `${Math.round((totalS / totalAll) * 100)}% ของงบรวม` : '' },
                { label: 'Environment', value: `${fmtMB(totalE)} ลบ.`, color: '#59A14F', sub: totalAll > 0 ? `${Math.round((totalE / totalAll) * 100)}% ของงบรวม` : '' },
                { label: 'เดือนที่ใช้งบสูงสุด', value: TH_MONTHS[peakMonth.month - 1], color: '#E15759', sub: `${fmtMB(peakMonth.safety + peakMonth.environment)} ลบ.` },
              ].map(k => (
                <div key={k.label} style={{ ...card, borderLeft: `4px solid ${k.color}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
              {/* งบรายบริษัท (stacked S/E, มาก→น้อย) */}
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>งบรายบริษัท — เรียงจากมากไปน้อย</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <span style={{ color: '#F28E2B' }}>■</span> Safety&nbsp;&nbsp;<span style={{ color: '#59A14F' }}>■</span> Environment
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {compRows.map(c => (
                    <Link key={c.companyId} href={`/projects/budget/${c.companyId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }} title={`เปิดแผนงบ ${nameOf(c.companyId)}`}>
                      <span style={{ fontSize: 11, fontWeight: 700, width: 62, flexShrink: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(c.companyId)}</span>
                      <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${(c.safety / maxComp) * 100}%`, background: '#F28E2B', minWidth: c.safety > 0 ? 2 : 0 }} />
                        <div style={{ width: `${(c.environment / maxComp) * 100}%`, background: '#59A14F', minWidth: c.environment > 0 ? 2 : 0 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, width: 58, textAlign: 'right', flexShrink: 0, color: 'var(--text-primary)' }}>{fmtMB(c.total)}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Top หมวดค่าใช้จ่าย */}
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>หมวดค่าใช้จ่ายสูงสุด</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 10 }}>% = สัดส่วนของงบรวมทั้งกลุ่ม</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {topCats.map((c, i) => (
                    <div key={`${c.name}-${c.planType}-${i}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: c.planType === 'environment' ? '#59A14F' : '#F28E2B', fontWeight: 700 }}>{c.planType === 'environment' ? 'E' : 'S'}</span> {c.name}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                          {fmtMB(c.total)} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({totalAll > 0 ? Math.round((c.total / totalAll) * 100) : 0}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-secondary)' }}>
                        <div style={{ height: 8, borderRadius: 4, width: `${(c.total / maxCat) * 100}%`, background: c.planType === 'environment' ? '#59A14F' : '#F28E2B', opacity: 0.85, minWidth: 3 }} />
                      </div>
                    </div>
                  ))}
                  {otherTotal > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>+ หมวดอื่นๆ อีก {otherCats.length} หมวด รวม {fmtMB(otherTotal)} ลบ.</div>
                  )}
                </div>
              </div>

              {/* งบรายเดือน (cash flow) */}
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>งบตั้งรายเดือน — รวมทั้งกลุ่ม</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 10 }}>ใช้วางแผนกระแสเงินสด — เดือน peak คือ {TH_MONTHS[peakMonth.month - 1]}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
                  {dash.perMonth.map(m => {
                    const tot = m.safety + m.environment;
                    const h = (tot / maxMonth) * 90;
                    const hS = tot > 0 ? (m.safety / tot) * h : 0;
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} title={`${TH_MONTHS[m.month - 1]}: ${fmtMB(tot)} ลบ. (S ${fmtMB(m.safety)} · E ${fmtMB(m.environment)})`}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{tot > 0 ? fmtMB(tot) : ''}</span>
                        <div style={{ width: '100%', maxWidth: 22, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 90 }}>
                          <div style={{ height: Math.max(h - hS, tot > 0 ? 1 : 0), background: '#59A14F', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                          <div style={{ height: Math.max(hS, m.safety > 0 ? 1 : 0), background: '#F28E2B', opacity: 0.85 }} />
                        </div>
                        <span style={{ fontSize: 9, color: peakMonth.month === m.month ? '#E15759' : 'var(--text-secondary)', fontWeight: peakMonth.month === m.month ? 700 : 400 }}>{TH_MONTHS[m.month - 1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
