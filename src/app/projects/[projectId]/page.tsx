'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { getProject, type ProjectId } from '@/lib/projects';
import { ArrowRight, Building2, Info } from 'lucide-react';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default function ProjectHubPage({ params }: Props) {
  const { projectId } = use(params);
  const project = getProject(projectId as ProjectId);
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { companies } = useCompanies();

  if (!project) return null;

  const isAdmin = auth.isAdmin;
  const companyAuthIds = Object.keys(auth.companyAuth);
  const companyId =
    searchParams.get('company') ||
    (isAdmin ? 'all' : companyAuthIds[0] || 'all');

  const activeCompanyName =
    companyId === 'all'
      ? 'ทุกบริษัท (ภาพรวม)'
      : companies.find((c) => c.id === companyId)?.name || companyId.toUpperCase();

  const ProjectIcon = project.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-3 flex items-center gap-2">
        <Link href="/projects" className="hover:text-blue-600">โครงการทั้งหมด</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-lg bg-gradient-to-br ${project.color} flex-shrink-0`}
          >
            <ProjectIcon size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.name}</h1>
            <p className="text-gray-600 text-sm mb-3">{project.description}</p>
            <div className="flex items-center gap-2 text-sm">
              <Building2 size={14} className="text-gray-400" />
              <span className="text-gray-600">บริษัท:</span>
              <span className="font-medium text-gray-900">{activeCompanyName}</span>
              {isAdmin && (
                <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-bold">
                  ADMIN
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav shortcuts */}
      <div className="grid md:grid-cols-2 gap-4">
        {project.nav.map((item) => {
          const ItemIcon = item.icon;
          if (item.adminOnly && !isAdmin) return null;
          if (item.companyRequired && companyId === 'all') {
            return (
              <div
                key={item.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-5 opacity-60"
              >
                <div className="flex items-start gap-3">
                  <ItemIcon size={20} className="text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-700 mb-1">{item.label}</h3>
                    <p className="text-xs text-gray-500">
                      เลือกบริษัทเฉพาะจาก sidebar ก่อน (ปัจจุบันเป็นภาพรวม)
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          const href = item.href(companyId);
          return (
            <Link
              key={item.id}
              href={href}
              className="group bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-500 hover:shadow transition"
            >
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded flex-shrink-0"
                  style={{
                    background: `${project.accentColor}15`,
                    color: project.accentColor,
                  }}
                >
                  <ItemIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    {item.label}
                    <ArrowRight
                      size={14}
                      className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition"
                    />
                  </h3>
                  <p className="text-xs text-gray-500 font-mono truncate">{href}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>หมายเหตุ:</strong> ในช่วง refactor ลิงก์จะนำคุณไปยังหน้าเดิม{' '}
          (<code className="bg-blue-100 px-1 rounded">/company/[id]/...</code> หรือ{' '}
          <code className="bg-blue-100 px-1 rounded">/admin/...</code>){' '}
          ซึ่งยังใช้งานได้เต็มรูปแบบ ต่อไปเราจะย้ายเข้ามาอยู่ใต้{' '}
          <code className="bg-blue-100 px-1 rounded">/projects/{project.id}/*</code>{' '}
          ตามลำดับ
        </div>
      </div>
    </div>
  );
}
