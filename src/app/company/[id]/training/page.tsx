'use client';

// Legacy redirect to /projects/training/[companyId]
// Old URL kept for backward compatibility (bookmarks, external links)
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function LegacyCompanyTrainingRedirect() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  useEffect(() => {
    router.replace(`/projects/training/${companyId}`);
  }, [router, companyId]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      กำลังนำคุณไปยังหน้าใหม่...
    </div>
  );
}
