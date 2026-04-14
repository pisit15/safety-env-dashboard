'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function LegacyAdminSHEWorkforceRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/projects/employees/she-workforce'); }, [router]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
