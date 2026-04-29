'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CompanySiteVisitRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/site-visit/${params.companyId}/assess`);
  }, [params.companyId, router]);

  return null;
}
