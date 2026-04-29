'use client';

// Layout for /projects/site-visit/* — renders ProjectSidebar for the 'site-visit' project
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectSidebar from '@/components/ProjectSidebar';
import { useAuth } from '@/components/AuthContext';
import { getProject } from '@/lib/projects';

export default function SiteVisitProjectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const project = getProject('site-visit');
  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  useEffect(() => {
    // Wait for sessionStorage restore before checking auth
    if (!auth.isHydrated) return;
    if (!isAuthed) router.push('/projects');
  }, [auth.isHydrated, isAuthed, router]);

  if (!project) return null;
  if (!auth.isHydrated) return null;
  if (!isAuthed) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProjectSidebar project={project} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
