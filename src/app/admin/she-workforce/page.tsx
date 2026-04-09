'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import {
  Users, Briefcase, ShieldCheck, RefreshCw, Loader2,
  Search, ChevronRight, Building2, AlertTriangle, Download,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface Personnel {
  id: string;
  company_id: string;
  full_name: string;
  nick_name: string;
  position: string;
  responsibility: string;
  department: string;
  employment_type: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_she_team: boolean;
}

interface CompanyStat {
  company_id: string;
  sheCount: number;
  employeeCount: number;
  ratio: number;
  complianceRate: number;
  requiredTotal: number;
  complianceMet: number;
}

// ── Constants ──────────────────────────────────────────────────
const EMP_TYPES: Record<string, string> = {
  permanent: 'พนักงานประจำ', subcontract: 'ผู้รับเหมา', outsource: 'Outsource',
  part_time: 'Part-time', dvt: 'ทวิภาคี',
};
const EMP_TYPE_COLORS: Record<string, string> = {
  permanent: '#4E79A7', subcontract: '#F28E2B', outsource: '#B07AA1',
  part_time: '#76B7B2', dvt: '#E15759',
};
const RESP_COLORS: Record<string, string> = {
  Safety: '#f97316', Environment: '#22c55e', 'Occupational Health': '#4E79A7', Admin: '#BAB0AC',
};

// ── Page ───────────────────────────────────────────────────────
export default function AdminSHEWorkforcePage() {
  const auth = useAuth();
  const router = useRouter();
  const { companies, getCompanyById } = useCompanies();

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'company'>('company');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/she-workforce/admin');
      const json = await res.json();
      setPersonnel(json.personnel || []);
      setCompanyStats(json.companyStats || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (auth.isAdmin && auth.adminRole === 'super_admin') fetchData();
  }, [auth.isAdmin, auth.adminRole]);

  // ── Computed ──
  const totalSHE = personnel.length;
  const companyIds = useMemo(() => Array.from(new Set(personnel.map(p => p.company_id))), [personnel]);

  const filtered = useMemo(() => {
    return personnel.filter(p => {
      if (filterCompany && p.company_id !== filterCompany) return false;
      if (filterResp && p.responsibility !== filterResp) return false;
      if (filterType && p.employment_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.nick_name?.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          p.company_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [personnel, filterCompany, filterResp, filterType, search]);

  // Responsibility distribution across all
  const respDist = useMemo(() => {
    const map: Record<string, number> = {};
    personnel.forEach(p => { const r = p.responsibility || 'อื่นๆ'; map[r] = (map[r] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [personnel]);
  const respMax = Math.max(...respDist.map(r => r[1]), 1);

  // ── Auth gate ──
  if (!auth.isAdmin || auth.adminRole !== 'super_admin') {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8" style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
          <div style={{ textAlign: 'center', marginTop: 100 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>เฉพาะ Super Admin</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>หน้านี้สำหรับ Super Admin เท่านั้น</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Main ──
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <Briefcase size={22} color="var(--accent, #007aff)" />
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>SHE Workforce — ภาพรวมทุกบริษัท</h1>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                บุคลากรด้านความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม ทั้ง {companyIds.length} บริษัท
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchData} style={btnOutline}>
                <RefreshCw size={14} /> รีเฟรช
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14 }}>กำลังโหลด...</p>
            </div>
          ) : (
            <>
              {/* ── KPI Row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={kpiStyle}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>บุคลากร SHE ทั้งหมด</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#4E79A7', lineHeight: 1 }}>{totalSHE}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{companyIds.length} บริษัท</div>
                </div>
                {(() => {
                  const lowCompliance = companyStats.filter(s => s.complianceRate < 100);
                  return (
                    <div style={{ ...kpiStyle, borderColor: lowCompliance.length > 0 ? '#E1575944' : 'var(--border)', background: lowCompliance.length > 0 ? '#E1575908' : undefined }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Compliance ไม่ผ่าน</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: lowCompliance.length > 0 ? '#E15759' : '#59A14F', lineHeight: 1 }}>{lowCompliance.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{lowCompliance.length > 0 ? lowCompliance.map(s => getCompanyById(s.company_id)?.shortName || s.company_id).join(', ') : 'ทุกบริษัทผ่าน'}</div>
                    </div>
                  );
                })()}
                {(() => {
                  const highRatio = companyStats.filter(s => s.ratio > 100);
                  return (
                    <div style={{ ...kpiStyle, borderColor: highRatio.length > 0 ? '#F28E2B44' : 'var(--border)', background: highRatio.length > 0 ? '#F28E2B08' : undefined }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>SHE:พนักงาน เกิน 1:100</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: highRatio.length > 0 ? '#F28E2B' : '#59A14F', lineHeight: 1 }}>{highRatio.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{highRatio.length > 0 ? highRatio.map(s => `${getCompanyById(s.company_id)?.shortName || s.company_id} (1:${s.ratio})`).join(', ') : 'ทุกบริษัทตามเกณฑ์'}</div>
                    </div>
                  );
                })()}
                <div style={kpiStyle}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>ตำแหน่งหลัก</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#4E79A7', lineHeight: 1 }}>{respDist.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Functions ที่ครอบคลุม</div>
                </div>
              </div>

              {/* ── Charts Row: Responsibility + Company breakdown ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {/* Resp distribution */}
                <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>หน้าที่หลัก (รวมทุกบริษัท)</p>
                  {respDist.map(([resp, count]) => (
                    <div key={resp} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{resp}</span>
                        <span style={{ fontWeight: 700, color: RESP_COLORS[resp] || '#BAB0AC' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(107,114,128,0.08)' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${(count / respMax) * 100}%`, background: RESP_COLORS[resp] || '#BAB0AC', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Company cards */}
                <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>จำนวนบุคลากรต่อบริษัท</p>
                  {companyStats.sort((a, b) => b.sheCount - a.sheCount).map(stat => {
                    const c = getCompanyById(stat.company_id);
                    const name = c?.shortName || stat.company_id.toUpperCase();
                    return (
                      <div key={stat.company_id}
                        onClick={() => router.push(`/company/${stat.company_id}/she-workforce`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{name}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#4E79A7', minWidth: 30, textAlign: 'right' }}>{stat.sheCount}</span>
                        <span style={{ fontSize: 10, color: stat.ratio > 100 ? '#F28E2B' : 'var(--text-secondary)', fontWeight: stat.ratio > 100 ? 600 : 400, minWidth: 40 }}>
                          {stat.ratio > 0 ? `1:${stat.ratio}` : '-'}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                          background: stat.complianceRate === 100 ? '#59A14F15' : '#E1575915',
                          color: stat.complianceRate === 100 ? '#59A14F' : '#E15759',
                        }}>{stat.complianceRate}%</span>
                        <ChevronRight size={12} color="#94a3b8" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── View toggle + Toolbar ── */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <button onClick={() => setViewMode('company')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === 'company' ? 'var(--accent, #007aff)' : 'var(--bg-secondary)', color: viewMode === 'company' ? '#fff' : 'var(--text-secondary)' }}>
                    <Building2 size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> แยกบริษัท
                  </button>
                  <button onClick={() => setViewMode('table')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === 'table' ? 'var(--accent, #007aff)' : 'var(--bg-secondary)', color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)' }}>
                    <Users size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> ตารางรวม
                  </button>
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ, ตำแหน่ง, บริษัท..."
                    style={{ width: '100%', padding: '7px 11px', paddingLeft: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                  style={selectStyle}>
                  <option value="">ทุกบริษัท</option>
                  {companyIds.map(cid => (
                    <option key={cid} value={cid}>{getCompanyById(cid)?.shortName || cid.toUpperCase()}</option>
                  ))}
                </select>
                <select value={filterResp} onChange={e => setFilterResp(e.target.value)}
                  style={selectStyle}>
                  <option value="">หน้าที่ทั้งหมด</option>
                  {respDist.map(([r]) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  style={selectStyle}>
                  <option value="">การจ้างทั้งหมด</option>
                  {Object.entries(EMP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {(search || filterCompany || filterResp || filterType) && (
                  <button onClick={() => { setSearch(''); setFilterCompany(''); setFilterResp(''); setFilterType(''); }}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                    ล้าง
                  </button>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} คน</span>
              </div>

              {/* ── Company-grouped view ── */}
              {viewMode === 'company' && (() => {
                const groups = companyIds
                  .map(cid => ({
                    id: cid,
                    name: getCompanyById(cid)?.shortName || cid.toUpperCase(),
                    fullName: getCompanyById(cid)?.fullName || getCompanyById(cid)?.name || cid,
                    people: filtered.filter(p => p.company_id === cid),
                    stat: companyStats.find(s => s.company_id === cid),
                  }))
                  .filter(g => g.people.length > 0)
                  .sort((a, b) => b.people.length - a.people.length);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {groups.map(g => (
                      <div key={g.id} style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-secondary, #fff)' }}>
                        {/* Company header */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-secondary)' }}>
                          <Building2 size={16} color="var(--accent, #007aff)" />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>{g.fullName}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#4E79A7' }}>{g.people.length} คน</span>
                          {g.stat && (
                            <>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: g.stat.ratio > 100 ? '#F28E2B15' : 'rgba(107,114,128,0.08)', color: g.stat.ratio > 100 ? '#F28E2B' : 'var(--text-secondary)', fontWeight: 600 }}>
                                {g.stat.ratio > 0 ? `1:${g.stat.ratio}` : '-'}
                              </span>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: g.stat.complianceRate === 100 ? '#59A14F15' : '#E1575915', color: g.stat.complianceRate === 100 ? '#59A14F' : '#E15759', fontWeight: 700 }}>
                                {g.stat.complianceRate}%
                              </span>
                            </>
                          )}
                          <button onClick={() => router.push(`/company/${g.id}/she-workforce`)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent, #007aff)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                            จัดการ <ChevronRight size={11} />
                          </button>
                        </div>
                        {/* Personnel table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['#', 'ชื่อ-นามสกุล', 'ประเภท', 'ตำแหน่ง', 'หน้าที่', 'การจ้าง', 'โทร'].map(h => (
                                <th key={h} style={thStyle}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {g.people.map((p, i) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ ...tdStyle, color: 'var(--text-secondary)', width: 36 }}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {p.full_name}
                                  {p.nick_name ? <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}> ({p.nick_name})</span> : null}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: p.is_she_team !== false ? '#59A14F15' : '#F28E2B15', color: p.is_she_team !== false ? '#59A14F' : '#F28E2B' }}>
                                    {p.is_she_team !== false ? 'ทีม SHE' : 'แต่งตั้ง'}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>{p.position || '-'}</td>
                                <td style={tdStyle}>
                                  {p.responsibility && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${RESP_COLORS[p.responsibility] || '#BAB0AC'}15`, color: RESP_COLORS[p.responsibility] || '#BAB0AC', fontWeight: 600 }}>{p.responsibility}</span>}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${EMP_TYPE_COLORS[p.employment_type] || '#BAB0AC'}15`, color: EMP_TYPE_COLORS[p.employment_type] || '#BAB0AC', fontWeight: 600 }}>{EMP_TYPES[p.employment_type] || p.employment_type}</span>
                                </td>
                                <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.phone || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                        <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                        <p style={{ fontSize: 14 }}>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Flat table view ── */}
              {viewMode === 'table' && (
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-secondary, #fff)' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                          {['#', 'บริษัท', 'ชื่อ-นามสกุล', 'ประเภท', 'แผนก', 'ตำแหน่ง', 'หน้าที่', 'การจ้าง', 'โทร', 'อีเมล'].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                            <div>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
                          </td></tr>
                        ) : filtered.map((p, i) => {
                          const c = getCompanyById(p.company_id);
                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ ...tdStyle, color: 'var(--text-secondary)', width: 36 }}>{i + 1}</td>
                              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--accent, #007aff)' + '12', color: 'var(--accent, #007aff)', fontWeight: 600 }}>{c?.shortName || p.company_id.toUpperCase()}</span>
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {p.full_name}
                                {p.nick_name ? <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}> ({p.nick_name})</span> : null}
                              </td>
                              <td style={tdStyle}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: p.is_she_team !== false ? '#59A14F15' : '#F28E2B15', color: p.is_she_team !== false ? '#59A14F' : '#F28E2B' }}>
                                  {p.is_she_team !== false ? 'ทีม SHE' : 'แต่งตั้ง'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.department || '-'}</td>
                              <td style={{ ...tdStyle, fontSize: 12 }}>{p.position || '-'}</td>
                              <td style={tdStyle}>
                                {p.responsibility && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${RESP_COLORS[p.responsibility] || '#BAB0AC'}15`, color: RESP_COLORS[p.responsibility] || '#BAB0AC', fontWeight: 600 }}>{p.responsibility}</span>}
                              </td>
                              <td style={tdStyle}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${EMP_TYPE_COLORS[p.employment_type] || '#BAB0AC'}15`, color: EMP_TYPE_COLORS[p.employment_type] || '#BAB0AC', fontWeight: 600 }}>{EMP_TYPES[p.employment_type] || p.employment_type}</span>
                              </td>
                              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.phone || '-'}</td>
                              <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{p.email || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const kpiStyle: React.CSSProperties = { padding: 16, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-secondary, #fff)' };
const btnOutline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 13 };
const selectStyle: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' };
