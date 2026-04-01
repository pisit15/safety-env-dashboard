'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Search,
  FileWarning,
  FileText,
  ArrowRight,
  Building2,
} from 'lucide-react';

// ready can be: true (all companies), false (no company), or 'hasSheet' (only companies with Google Sheet)
const PROJECTS = [
  { id: 'action-plan', label: 'แผนงานประจำปี', icon: ClipboardList, path: '/action-plan', ready: 'hasSheet' as const },
  { id: 'training', label: 'แผนอบรมประจำปี', icon: GraduationCap, path: '/training', ready: true },
  { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: AlertTriangle, path: '/incidents', ready: true },
  { id: 'safety-patrol', label: 'Safety Patrol', icon: Search, path: '/safety-patrol', ready: false },
  { id: 'risk', label: 'ประเมินความเสี่ยง', icon: FileWarning, path: '/risk', ready: false },
  { id: 'nearmiss', label: 'Near Miss Report', icon: FileText, path: '/nearmiss', ready: false },
];

export default function CompanyDashboard() {
  const { id } = useParams() as { id: string };
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);

  // Fetch DB settings to check if company has sheet configured via Admin
  const [dbSheetId, setDbSheetId] = useState<string | null>(null);
  const [dbCompanyName, setDbCompanyName] = useState<string>('');
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then(d => {
        const s = (d.settings || []).find((s: { company_id: string }) => s.company_id === id);
        if (s) {
          setDbSheetId(s.sheet_id || '');
          setDbCompanyName(s.company_name || '');
        }
      })
      .catch(() => {});
  }, [id]);

  const hasSheet = !!(dbSheetId || company?.sheetId);
  const companyName = dbCompanyName || company?.shortName || id.toUpperCase();

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs mb-1">
          <Link href="/" style={{ color: 'var(--muted)' }} className="hover:opacity-70">Home</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{companyName}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--info) 100%)' }}>
            <Building2 size={24} color="white" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {companyName}
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
              เลือกโปรเจกต์ที่ต้องการจัดการ
            </p>
          </div>
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map(p => {
            const Icon = p.icon;
            const href = `/company/${id}${p.path}`;
            // Resolve ready state: 'hasSheet' means only ready if company has Google Sheet (static or DB)
            const isReady = p.ready === 'hasSheet' ? hasSheet : p.ready;
            return (
              <Link key={p.id} href={isReady ? href : '#'}>
                <div
                  className={`glass-card rounded-xl p-5 transition-all duration-200 ${isReady ? 'hover:scale-[1.02] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: isReady ? 'var(--accent-glow)' : 'var(--bg-secondary)' }}>
                      <Icon size={20} style={{ color: isReady ? 'var(--accent)' : 'var(--muted)' }} />
                    </div>
                    {isReady && <ArrowRight size={16} style={{ color: 'var(--accent)' }} />}
                  </div>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {p.label}
                  </h3>
                  <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                    {isReady ? 'ใช้งานได้' : 'เร็วๆ นี้'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
