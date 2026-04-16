'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function LegacyCompanyHomeRedirect() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  useEffect(() => { router.replace(`/projects/action-plan/${id}`); }, [router, id]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
