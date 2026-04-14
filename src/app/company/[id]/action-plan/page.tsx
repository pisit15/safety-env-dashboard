'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function LegacyRedirect() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const search = typeof window !== 'undefined' ? window.location.search : '';
  useEffect(() => { router.replace(`/projects/action-plan/${companyId}${search}`); }, [router, companyId]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
