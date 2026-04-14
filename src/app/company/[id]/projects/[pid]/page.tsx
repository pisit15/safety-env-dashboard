'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function LegacyRedirect() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  useEffect(() => { router.replace(`/projects/special/${companyId}/${params.pid}`); }, [router, companyId, params.pid]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
