'use client';

// Layout for /projects/nearmiss/* — renders ProjectSidebar for the 'nearmiss' project
// This is needed because /projects/nearmiss is a sibling of /projects/[projectId], not a child,
// so it doesn't inherit the layout from [projectId]/layout.tsx.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectSidebar from '@/components/ProjectSidebar';
import { useAuth } from '@/components/AuthContext';
import { getProject } from '@/lib/projects';

export default function NearMissProjectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const project = getProject('nearmiss');
  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  useEffect(() => {
    // Wait for sessionStorage restore before checking auth
    if (!auth.isHydrated) return;
    if (!isAuthed) router.push('/projects');
  }, [auth.isHydrated, isAuthed, router]);

  if (!project) return null;
  if (!auth.isHydrated) return null; // Show nothing while restoring session
  if (!isAuthed) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProjectSidebar project={project} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
