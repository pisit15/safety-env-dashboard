'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Root redirect: / → /projects
// (Legacy company-first landing replaced by project-first /projects)
export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/projects');
  }, [router]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
      กำลังนำคุณไปยังหน้าเลือกโครงการ...
    </div>
  );
}
