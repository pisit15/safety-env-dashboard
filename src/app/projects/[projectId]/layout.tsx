'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ProjectSidebar from '@/components/ProjectSidebar';
import { useAuth } from '@/components/AuthContext';
import { getProject, type ProjectId } from '@/lib/projects';

interface Props {
  children: React.ReactNode;
  params: { projectId: string };
}

export default function ProjectLayout({ children, params }: Props) {
  const { projectId } = params;
  const project = getProject(projectId as ProjectId);
  const router = useRouter();
  const auth = useAuth();

  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  useEffect(() => {
    if (!isAuthed) router.push('/projects');
  }, [isAuthed, router]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">ไม่พบโครงการ</h2>
          <button
            onClick={() => router.push('/projects')}
            className="text-blue-600 underline"
          >
            กลับไปหน้าเลือกโครงการ
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthed) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProjectSidebar project={project} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
