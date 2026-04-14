'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/projects/action-plan'); }, [router]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
