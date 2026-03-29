'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import { GraduationCap, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react';

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

interface CompanyTrainingSummary {
  companyId: string;
  companyName: string;
  totalCourses: number;
  completed: number;
  scheduled: number;
  pending: number;
  cancelled: number;
  totalBudget: number;
  totalActual: number;
  totalParticipants: number;
  totalManHours: number;
  warnings: number;
}

export default function HQTrainingOverview() {
  const auth = useAuth();
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [summaries, setSummaries] = useState<CompanyTrainingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // History search
  const [historyTab, setHistoryTab] = useState<'overview' | 'course' | 'person'>('overview');
  const [courseSearch, setCourseSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results: CompanyTrainingSummary[] = [];
      const today = new Date();

      for (const company of COMPANIES) {
        try {
          const res = await fetch(`/api/training/plans?companyId=${company.id}&year=${selectedYear}`);
          const plans = await res.json();
          if (!Array.isArray(plans)) continue;

          let completed = 0, scheduled = 0, pending = 0, cancelled = 0, warnings = 0;
          let totalBudget = 0, totalActual = 0, totalParticipants = 0, totalManHours = 0;

          for (const p of plans) {
            const s = p.training_sessions?.[0];
            const status = s?.status || 'planned';
            if (status === 'completed') completed++;
            else if (status === 'scheduled') scheduled++;
            else if (status === 'cancelled') cancelled++;
            else pending++;

            totalBudget += p.budget || 0;
            totalActual += s?.actual_cost || 0;
            totalParticipants += s?.actual_participants || 0;
            totalManHours += s?.total_man_hours || 0;

            // Warning: approaching month with no date
            if (status === 'planned' && p.planned_month > 0) {
              const planned = new Date(selectedYear, p.planned_month - 1, 1);
              const diff = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
              if (diff <= 45 && diff > -30) warnings++;
            }
          }

          results.push({
            companyId: company.id,
            companyName: company.name,
            totalCourses: plans.length,
            completed, scheduled, pending, cancelled,
            totalBudget, totalActual, totalParticipants, totalManHours, warnings,
          });
        } catch { /* skip */ }
      }

      setSummaries(results);
      setLoading(false);
    };

    fetchAll();
  }, [selectedYear]);

  const handleCourseSearch = async () => {
    if (!courseSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/training/attendees?courseName=${encodeURIComponent(courseSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handlePersonSearch = async () => {
    if (!personSearch.trim()) return;
    setSearching(true);
    try {
      // Search by emp_code or name
      const res = await fetch(`/api/training/attendees?empCode=${encodeURIComponent(personSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const totals = summaries.reduce((acc, s) => ({
    courses: acc.courses + s.totalCourses,
    completed: acc.completed + s.completed,
    scheduled: acc.scheduled + s.scheduled,
    pending: acc.pending + s.pending,
    budget: acc.budget + s.totalBudget,
    actual: acc.actual + s.totalActual,
    participants: acc.participants + s.totalParticipants,
    manHours: acc.manHours + s.totalManHours,
    warnings: acc.warnings + s.warnings,
  }), { courses: 0, completed: 0, scheduled: 0, pending: 0, budget: 0, actual: 0, participants: 0, manHours: 0, warnings: 0 });

  const filtered = searchTerm
    ? summaries.filter(s => s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    : summaries;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            🎓 HQ Training Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0', fontSize: 14 }}>
            ภาพรวมแผนอบรมทุกบริษัทในกลุ่ม EA • ปี {selectedYear}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Tabs */}
          {['overview', 'course', 'person'].map(tab => (
            <button key={tab} onClick={() => { setHistoryTab(tab as typeof historyTab); setSearchResults([]); }}
              style={{ padding: '6px 14px', borderRadius: 6, border: historyTab === tab ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: historyTab === tab ? 'var(--primary)' : 'var(--bg-card)', color: historyTab === tab ? '#fff' : 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              {tab === 'overview' ? '📊 ภาพรวม' : tab === 'course' ? '📚 ค้นหาหลักสูตร' : '👤 ค้นหารายบุคคล'}
            </button>
          ))}
        </div>

        {historyTab === 'overview' && (
          <>
            {/* Grand Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KPIBox icon="📚" label="หลักสูตรรวม" value={totals.courses} />
              <KPIBox icon="✅" label="อบรมแล้ว" value={totals.completed} color="var(--success)" />
              <KPIBox icon="📅" label="กำหนดวันแล้ว" value={totals.scheduled} color="var(--info)" />
              <KPIBox icon="⏳" label="รอดำเนินการ" value={totals.pending} color="var(--warning)" />
              <KPIBox icon="💰" label="งบรวม" value={`${(totals.budget / 1000).toFixed(0)}K`} />
              <KPIBox icon="👥" label="ผู้เข้าอบรมรวม" value={totals.participants} />
              {totals.warnings > 0 && <KPIBox icon="⚠️" label="ต้องเร่ง" value={totals.warnings} color="var(--danger)" />}
            </div>

            {/* Warning */}
            {totals.warnings > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                ⚠️ มี {totals.warnings} หลักสูตรใกล้ถึงกำหนดแต่ยังไม่กำหนดวันอบรม
              </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <input placeholder="ค้นหาบริษัท..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', width: 250, fontSize: 13 }} />
            </div>

            {/* Company Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูล...</div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border)' }}>
                      <th style={th}>บริษัท</th>
                      <th style={th}>หลักสูตร</th>
                      <th style={th}>✅</th>
                      <th style={th}>📅</th>
                      <th style={th}>⏳</th>
                      <th style={th}>❌</th>
                      <th style={{ ...th, textAlign: 'right' }}>งบ (฿)</th>
                      <th style={{ ...th, textAlign: 'right' }}>จริง (฿)</th>
                      <th style={th}>ผู้เข้า</th>
                      <th style={th}>Man-hrs</th>
                      <th style={th}>⚠️</th>
                      <th style={th}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const pct = s.totalCourses > 0 ? Math.round((s.completed / s.totalCourses) * 100) : 0;
                      return (
                        <tr key={s.companyId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)' }}>
                          <td style={{ ...td, fontWeight: 600 }}>
                            <Link href={`/company/${s.companyId}/training`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                              {s.companyName}
                            </Link>
                          </td>
                          <td style={td}>{s.totalCourses}</td>
                          <td style={{ ...td, color: 'var(--success)' }}>{s.completed}</td>
                          <td style={{ ...td, color: 'var(--info)' }}>{s.scheduled}</td>
                          <td style={{ ...td, color: 'var(--warning)' }}>{s.pending}</td>
                          <td style={{ ...td, color: 'var(--danger)' }}>{s.cancelled}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{s.totalBudget.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{s.totalActual.toLocaleString()}</td>
                          <td style={td}>{s.totalParticipants}</td>
                          <td style={td}>{s.totalManHours}</td>
                          <td style={{ ...td, color: s.warnings > 0 ? 'var(--danger)' : 'var(--muted)' }}>{s.warnings || '-'}</td>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Course Search Tab */}
        {historyTab === 'course' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์ชื่อหลักสูตร..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCourseSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handleCourseSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}

        {/* Person Search Tab */}
        {historyTab === 'person' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="พิมพ์รหัสพนักงาน..." value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePersonSearch()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={handlePersonSearch} disabled={searching}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} /> ค้นหา
              </button>
            </div>
            {renderSearchResults()}
          </div>
        )}
      </main>
    </div>
  );

  function renderSearchResults() {
    if (searching) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>กำลังค้นหา...</div>;
    if (searchResults.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>ไม่พบข้อมูล</div>;

    return (
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th>
              <th style={th}>รหัส</th>
              <th style={{ ...th, textAlign: 'left' }}>หลักสูตร</th>
              <th style={th}>บริษัท</th>
              <th style={th}>วันอบรม</th>
              <th style={th}>ชม.</th>
              <th style={th}>ประเภท</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((r: Record<string, unknown>, i: number) => {
              const plan = r.training_plans as Record<string, unknown> | null;
              const session = r.training_sessions as Record<string, unknown> | null;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{r.first_name as string} {r.last_name as string}</td>
                  <td style={td}>{r.emp_code as string || '-'}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{plan?.course_name as string || '-'}</td>
                  <td style={td}>{r.company_id as string}</td>
                  <td style={td}>{session?.scheduled_date_start ? formatDate(session.scheduled_date_start as string) : '-'}</td>
                  <td style={td}>{r.hours_attended as number || plan?.hours_per_course as number || '-'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: r.registration_type === 'attended' ? '#dcfce7' : '#dbeafe', color: r.registration_type === 'attended' ? '#16a34a' : '#3b82f6' }}>
                      {r.registration_type === 'attended' ? 'เข้าอบรม' : 'ลงทะเบียน'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' };

function formatDate(d: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function KPIBox({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}
