// ─────────────────────────────────────────────────────────────
// Project-first architecture config
// Each project has its own sidebar, color, and nav items
// ─────────────────────────────────────────────────────────────
import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  FolderKanban,
  GraduationCap,
  AlertTriangle,
  FileText,
  FileWarning,
  Users,
} from 'lucide-react';

export type ProjectId =
  | 'action-plan'
  | 'special'
  | 'training'
  | 'incidents'
  | 'nearmiss'
  | 'risk'
  | 'employees';

export interface ProjectNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: (companyId: string) => string; // hq if companyId === 'all'
  companyRequired?: boolean;
  adminOnly?: boolean;
}

export interface ProjectConfig {
  id: ProjectId;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  color: string; // tailwind gradient e.g. 'from-orange-500 to-red-600'
  accentColor: string; // hex e.g. '#f97316'
  ready: boolean;
  nav: ProjectNavItem[];
}

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'action-plan',
    name: 'แผนงานประจำปี',
    shortName: 'Action Plan',
    description: 'แผนงาน Safety + Environment รายปี พร้อม KPI รายไตรมาส',
    icon: ClipboardList,
    color: 'from-orange-500 to-green-600',
    accentColor: '#f97316',
    ready: true,
    nav: [
      { id: 'overview', label: 'ภาพรวมทั้งหมด', icon: ClipboardList, href: () => '/action-plan' },
      { id: 'safety', label: 'แผน Safety', icon: ClipboardList, href: (cid) => cid === 'all' ? '/action-plan?plan=safety' : `/company/${cid}/action-plan?plan=safety` },
      { id: 'environment', label: 'แผน Environment', icon: ClipboardList, href: (cid) => cid === 'all' ? '/action-plan?plan=environment' : `/company/${cid}/action-plan?plan=environment` },
    ],
  },
  {
    id: 'special',
    name: 'โครงการพิเศษ',
    shortName: 'Special Projects',
    description: 'ติดตามโครงการ milestones และ attachments',
    icon: FolderKanban,
    color: 'from-purple-500 to-indigo-600',
    accentColor: '#8b5cf6',
    ready: true,
    nav: [
      { id: 'all-projects', label: 'โครงการทั้งหมด', icon: FolderKanban, href: (cid) => cid === 'all' ? '/admin/projects' : `/company/${cid}/projects`, companyRequired: false },
    ],
  },
  {
    id: 'training',
    name: 'แผนอบรมประจำปี',
    shortName: 'Training',
    description: 'แผนอบรม DSD ผู้เข้าอบรม และประกาศนียบัตร',
    icon: GraduationCap,
    color: 'from-blue-500 to-cyan-600',
    accentColor: '#3b82f6',
    ready: true,
    nav: [
      { id: 'plan', label: 'แผนอบรม', icon: GraduationCap, href: (cid) => cid === 'all' ? '/projects/training' : `/projects/training/${cid}` },
    ],
  },
  {
    id: 'incidents',
    name: 'สถิติอุบัติเหตุ + ชั่วโมงทำงาน',
    shortName: 'Incidents & Manhours',
    description: 'สถิติอุบัติเหตุ LTIFR, TRIR และชั่วโมงการทำงาน',
    icon: AlertTriangle,
    color: 'from-red-500 to-rose-600',
    accentColor: '#ef4444',
    ready: true,
    nav: [
      { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, href: (cid) => cid === 'all' ? '/incidents' : `/company/${cid}/incidents` },
      { id: 'manhours', label: 'ชั่วโมงการทำงาน', icon: AlertTriangle, href: (cid) => `/company/${cid}/manhours`, companyRequired: true },
    ],
  },
  {
    id: 'nearmiss',
    name: 'Near Miss',
    shortName: 'Near Miss',
    description: 'รายงาน Near Miss จากพนักงาน พร้อมวิเคราะห์',
    icon: FileText,
    color: 'from-amber-500 to-orange-600',
    accentColor: '#f59e0b',
    ready: true,
    nav: [
      { id: 'admin', label: 'Admin Dashboard', icon: FileText, href: () => '/admin/nearmiss', adminOnly: true },
      { id: 'company', label: 'จัดการข้อมูลบริษัท', icon: FileText, href: (cid) => `/company/${cid}/nearmiss`, companyRequired: true },
      { id: 'report-link', label: 'ลิงก์รายงาน (สำหรับพนักงาน)', icon: FileText, href: (cid) => cid === 'all' ? '/report/nearmiss' : `/report/nearmiss/${cid}` },
    ],
  },
  {
    id: 'risk',
    name: 'ประเมินความเสี่ยง',
    shortName: 'Risk Assessment',
    description: 'ประเมินอันตรายและความเสี่ยง HIRA ตาม ISO 45001',
    icon: FileWarning,
    color: 'from-pink-500 to-rose-600',
    accentColor: '#ec4899',
    ready: true,
    nav: [
      { id: 'tasks', label: 'ประเมินความเสี่ยง', icon: FileWarning, href: (cid) => `/company/${cid}/risk`, companyRequired: true },
      { id: 'guide', label: 'คู่มือ', icon: FileWarning, href: (cid) => `/company/${cid}/risk/guide`, companyRequired: true },
    ],
  },
  {
    id: 'employees',
    name: 'จัดการพนักงาน',
    shortName: 'Employees',
    description: 'ทะเบียนพนักงานและ SHE Workforce',
    icon: Users,
    color: 'from-slate-500 to-gray-700',
    accentColor: '#64748b',
    ready: true,
    nav: [
      { id: 'employees', label: 'ทะเบียนพนักงาน', icon: Users, href: (cid) => cid === 'all' ? '/employees' : `/company/${cid}/employees` },
      { id: 'she-workforce', label: 'SHE Workforce', icon: Users, href: (cid) => cid === 'all' ? '/admin/she-workforce' : `/company/${cid}/she-workforce` },
    ],
  },
];

export function getProject(id: ProjectId): ProjectConfig | undefined {
  return PROJECTS.find((p) => p.id === id);
}
