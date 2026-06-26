'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { Wallet } from 'lucide-react';

export default function BudgetLanding() {
  const auth = useAuth();
  const router = useRouter();
  const { companies } = useCompanies();

  // Non-admin users go straight to their own company budget
  useEffect(() => {
    if (!auth.isHydrated) return;
    if (!auth.isAdmin) {
      const cid = Object.keys(auth.companyAuth)[0];
      if (cid) router.replace(`/projects/budget/${cid}`);
    }
  }, [auth.isHydrated, auth.isAdmin, auth.companyAuth, router]);

  if (!auth.isHydrated) return null;
  if (!auth.isAdmin) return null;

  const active = companies.filter((c) => c.sheetId !== undefined);

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Wallet size={24} style={{ color: '#f59e0b' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>งบประมาณประจำปี</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 22px' }}>เลือกบริษัทเพื่อจัดการแผนงบประมาณ</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {active.map((c) => (
          <Link key={c.id} href={`/projects/budget/${c.id}`}
            style={{ display: 'block', padding: '16px 18px', borderRadius: 12, background: 'var(--card-solid)', border: '1px solid var(--border)', textDecoration: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName || c.id}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
