'use client';

// Layout for /projects/training/* — renders ProjectSidebar for the 'training' project
// This is needed because /projects/training is a sibling of /projects/[projectId], not a child,
// so it doesn't inherit the layout from [projectId]/layout.tsx.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectSidebar from '@/components/ProjectSidebar';
import { useAuth } from '@/components/AuthContext';
import { getProject } from '@/lib/projects';

export default function TrainingProjectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const project = getProject('training');
  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  useEffect(() => {
    if (!isAuthed) router.push('/projects');
  }, [isAuthed, router]);

  if (!project) return null;
  if (!isAuthed) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProjectSidebar project={project} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
