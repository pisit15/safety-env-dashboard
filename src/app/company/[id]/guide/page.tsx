'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function LegacyGuideRedirect() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  // Guide was company-specific — redirect to that company's action-plan (closest match)
  useEffect(() => { router.replace(`/projects/action-plan/${id}`); }, [router, id]);
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังนำคุณไปยังหน้าใหม่...</div>;
}
