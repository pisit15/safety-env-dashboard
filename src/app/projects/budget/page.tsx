'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { DEFAULT_YEAR } from '@/lib/companies';
import { Wallet, Lock, CheckCircle2, CircleDashed } from 'lucide-react';

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
    </div>
  );
}
