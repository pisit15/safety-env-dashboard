'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { Briefcase, Users, ShieldCheck, Building2, ChevronRight, AlertTriangle } from 'lucide-react';

interface CompanyOverview {
  personnelCount: number;
  byResponsibility: Record<string, number>;
  byEmploymentType: Record<string, number>;
  requirementsCount: number;
  licensedCount: number;
  employeeCount: number;
  contractorCount: number;
}

export default function SHEWorkforceHQPage() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    companies: Record<string, CompanyOverview>;
    totalPersonnel: number;
    totalRequirements: number;
    totalLicenses: number;
  } | null>(null);

  useEffect(() => {
    if (!auth.isAdmin || auth.adminRole !== 'super_admin') return;
    fetch('/api/she-workforce/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auth.isAdmin, auth.adminRole]);

  // Auth gate
  if (!auth.isAdmin || auth.adminRole !== 'super_admin') {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8" style={{ color: 'var(--text-primary)' }}>
          <div style={{ textAlign: 'center', marginTop: 100 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>เฉพาะ Super Admin</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>หน้านี้สำหรับ Super Admin เท่านั้น</p>
          </div>
        </main>
      </div>
    );
  }

  const activeCompanies = COMPANIES.filter(c => c.sheetId || c.id);
  const totalSHE = data?.totalPersonnel || 0;
  const companiesWithData = data ? Object.keys(data.companies).length : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '40px 32px 60px',
          position: 'relative',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Briefcase size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
                SHE Workforce
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginLeft: 54 }}>
              ภาพรวมบุคลากรด้านความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม ทุกบริษัท
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1200, margin: '-30px auto 40px', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'บุคลากร SHE ทั้งหมด', value: totalSHE, icon: Users, color: '#007aff' },
              { label: 'บริษัทที่มีข้อมูล', value: companiesWithData, icon: Building2, color: '#34c759' },
              { label: 'ใบอนุญาตที่ได้รับ', value: data?.totalLicenses || 0, icon: ShieldCheck, color: '#ff9500' },
              { label: 'ประเภทใบอนุญาต', value: data?.totalRequirements || 0, icon: AlertTriangle, color: '#af52de' },
            ].map((kpi, i) => (
              <div key={i} className="glass-card rounded-xl" style={{
                padding: 20, border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${kpi.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <kpi.icon size={20} color={kpi.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kpi.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Company List */}
          <div className="glass-card rounded-xl" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                บุคลากร SHE แยกตามบริษัท
              </h2>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div className="animate-spin" style={{
                  width: 32, height: 32, border: '3px solid var(--border)',
                  borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 12px',
                }} />
                กำลังโหลด...
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['บริษัท', 'BU', 'บุคลากร SHE', 'พนักงานทั้งหมด', 'อัตราส่วน', 'ใบอนุญาต', ''].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 14px', textAlign: i >= 2 ? 'center' : 'left',
                          fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCompanies.map(company => {
                      const cd = data?.companies[company.id];
                      const sheCount = cd?.personnelCount || 0;
                      const empCount = cd?.employeeCount || 0;
                      const ratio = empCount > 0 ? `1:${Math.round(empCount / Math.max(sheCount, 1))}` : '-';

                      return (
                        <tr key={company.id}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => router.push(`/company/${company.id}/she-workforce`)}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {company.name}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            {company.bu || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', minWidth: 28, padding: '2px 8px', borderRadius: 20,
                              background: sheCount > 0 ? '#007aff15' : 'var(--bg-secondary)',
                              color: sheCount > 0 ? '#007aff' : 'var(--text-secondary)',
                              fontWeight: 700, fontSize: 13,
                            }}>
                              {sheCount}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {empCount || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {ratio}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', minWidth: 28, padding: '2px 8px', borderRadius: 20,
                              background: (cd?.licensedCount || 0) > 0 ? '#34c75915' : 'var(--bg-secondary)',
                              color: (cd?.licensedCount || 0) > 0 ? '#34c759' : 'var(--text-secondary)',
                              fontWeight: 600, fontSize: 12,
                            }}>
                              {cd?.licensedCount || 0}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <ChevronRight size={16} color="var(--text-secondary)" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
