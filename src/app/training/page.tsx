'use client';

// Legacy redirect to /projects/training
// Old URL kept for backward compatibility (bookmarks, external links)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyTrainingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/projects/training');
  }, [router]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      กำลังนำคุณไปยังหน้าใหม่...
    </div>
  );
}
