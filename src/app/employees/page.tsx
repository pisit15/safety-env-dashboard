'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import {
  Users, Search, Building2, GraduationCap, ChevronLeft, ChevronRight,
  Filter, UserCheck, BookOpen, ArrowUpDown, AlertTriangle, Check, X,
  Clock, Ban, CalendarClock,
} from 'lucide-react';
import { STATUS, PALETTE, BULLET } from '@/lib/she-theme';

interface AttendeeRecord {
  id: string;
  company_id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  hours_attended: number;
  training_sessions: { status: string; scheduled_date_start: string | null; scheduled_date_end: string | null } | null;
  training_plans: { course_name: string; category: string; hours_per_course: number; in_house_external: string; planned_month: number; year: number } | null;
}

interface CourseSummary {
  course_name: string;
  category: string;
  hours: number;
  type: string;
  companies: string[];
  company_count: number;
  total_attendees: number;
  completed_attendees: number;
  unique_employee_count: number;
}

interface CompanySummary {
  company_id: string;
  total_records: number;
  completed_records: number;
}

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function EmployeesHQPage() {
  const auth = useAuth();
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [viewTab, setViewTab] = useState<'company' | 'employee' | 'course'>('company');
  const [loading, setLoading] = useState(false);

  // Company view
  const [companySummary, setCompanySummary] = useState<CompanySummary[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');

  // Employee search view
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<AttendeeRecord[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);

  // Course view
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseAttendees, setCourseAttendees] = useState<AttendeeRecord[]>([]);

  // Company detail view
  const [companyAttendees, setCompanyAttendees] = useState<AttendeeRecord[]>([]);
  const [companyAttendeesTotal, setCompanyAttendeesTotal] = useState(0);
  const [companyPage, setCompanyPage] = useState(1);
  const [companyTotalPages, setCompanyTotalPages] = useState(1);
  const [companyFilter, setCompanyFilter] = useState(''); // sub-search within company

  // Status filter
  const [statusFilter, setStatusFilter] = useState('');

  const getCompanyName = (id: string) => {
    const c = COMPANIES.find(co => co.id === id);
    return c?.shortName || c?.name || id.toUpperCase();
  };

  // Fetch company summary
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employees?mode=summary&year=${selectedYear}`);
      const data = await res.json();
      if (data.summary) setCompanySummary(data.summary);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => { if (auth.isAdmin) fetchSummary(); }, [auth.isAdmin, fetchSummary]);

  // Search employees
  const searchEmployees = useCallback(async (page = 1) => {
    if (!searchText.trim()) { setSearchResults([]); setSearchTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: 'attendees',
        search: searchText.trim(),
        year: String(selectedYear),
        page: String(page),
        limit: '50',
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/employees?${params}`);
      const data = await res.json();
      setSearchResults(data.attendees || []);
      setSearchTotal(data.total || 0);
      setSearchPage(data.page || 1);
      setSearchTotalPages(data.totalPages || 1);
    } catch { /* ignore */ }
    setLoading(false);
  }, [searchText, selectedYear, statusFilter]);

  // Fetch company detail
  const fetchCompanyDetail = useCallback(async (companyId: string, page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: 'attendees',
        companyId,
        year: String(selectedYear),
        page: String(page),
        limit: '50',
      });
      if (companyFilter) params.set('search', companyFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/employees?${params}`);
      const data = await res.json();
      setCompanyAttendees(data.attendees || []);
      setCompanyAttendeesTotal(data.total || 0);
      setCompanyPage(data.page || 1);
      setCompanyTotalPages(data.totalPages || 1);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedYear, companyFilter, statusFilter]);

  // Fetch courses
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'courses', year: String(selectedYear) });
      if (courseSearch) params.set('courseName', courseSearch);
      const res = await fetch(`/api/admin/employees?${params}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedYear, courseSearch]);

  // Fetch attendees for a specific course
  const fetchCourseAttendees = useCallback(async (courseName: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: 'attendees',
        courseName,
        year: String(selectedYear),
        limit: '200',
        status: 'completed',
      });
      const res = await fetch(`/api/admin/employees?${params}`);
      const data = await res.json();
      setCourseAttendees(data.attendees || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedYear]);

  // Tab change effects
  useEffect(() => {
    if (viewTab === 'course') fetchCourses();
  }, [viewTab, fetchCourses]);

  useEffect(() => {
    if (selectedCompany) {
      setCompanyPage(1);
      fetchCompanyDetail(selectedCompany, 1);
    }
  }, [selectedCompany, fetchCompanyDetail]);

  useEffect(() => {
    if (selectedCourse) fetchCourseAttendees(selectedCourse);
  }, [selectedCourse, fetchCourseAttendees]);

  // Login gate
  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--muted)' }}>
            <Users size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-[15px] font-semibold">เฉพาะ Admin เท่านั้น</p>
            <p className="text-[13px] mt-1">กรุณาเข้าสู่ระบบ Admin เพื่อดูข้อมูลพนักงาน</p>
          </div>
        </main>
      </div>
    );
  }

  const sortedSummary = [...companySummary]
    .map(s => ({ ...s, name: getCompanyName(s.company_id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalAllRecords = companySummary.reduce((s, c) => s + c.total_records, 0);
  const totalCompleted = companySummary.reduce((s, c) => s + c.completed_records, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Users size={26} style={{ color: 'var(--accent)' }} />
            จัดการพนักงาน — ภาพรวมทุกบริษัท
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
            ค้นหาและตรวจสอบข้อมูลพนักงานที่เข้าอบรมจากทุกบริษัทใน EA Group
          </p>
        </div>

        {/* Top controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 14 }}>
            {ACTIVE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Tab toggle */}
          <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {([
              { key: 'company' as const, label: 'ตามบริษัท', icon: Building2 },
              { key: 'employee' as const, label: 'ค้นหาพนักงาน', icon: Search },
              { key: 'course' as const, label: 'ตามหลักสูตร', icon: BookOpen },
            ]).map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setViewTab(opt.key); setSelectedCompany(''); setSelectedCourse(''); }}
                  style={{
                    padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: viewTab === opt.key ? 'var(--accent)' : 'transparent',
                    color: viewTab === opt.key ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }}>
            <option value="">ทุกสถานะ</option>
            <option value="completed">อบรมแล้ว</option>
            <option value="scheduled">กำหนดวันแล้ว</option>
            <option value="planned">ยังไม่กำหนดวัน</option>
          </select>
        </div>

        {/* KPI Summary Cards */}
        {(() => {
          const completionRate = totalAllRecords > 0 ? Math.round((totalCompleted / totalAllRecords) * 100) : 0;
          const rateColor = completionRate >= 90 ? STATUS.ok : completionRate >= 70 ? STATUS.warning : STATUS.critical;
          const rateBg = completionRate >= 90 ? STATUS.okBg : completionRate >= 70 ? STATUS.warningBg : STATUS.criticalBg;
          const incompleteCompanies = companySummary.filter(s => s.total_records > 0 && Math.round((s.completed_records / s.total_records) * 100) < 100);
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {/* HERO: Completion Rate */}
              <div style={{ padding: '20px 18px', borderRadius: 12, border: `2px solid ${rateColor}44`, background: rateBg }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>อัตราการอบรมสำเร็จ</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: rateColor, lineHeight: 1 }}>
                  {completionRate}<span style={{ fontSize: 18 }}>%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: PALETTE.border, marginTop: 8 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${completionRate}%`, background: rateColor, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {totalCompleted.toLocaleString()} / {totalAllRecords.toLocaleString()} รายการ
                </div>
              </div>
              {/* KPI 2: Incomplete companies (actionable) */}
              <div style={{ padding: 16, borderRadius: 12, border: `1.5px solid ${incompleteCompanies.length > 0 ? `${STATUS.warning}44` : 'var(--border)'}`, background: incompleteCompanies.length > 0 ? STATUS.warningBg : 'var(--bg-secondary, #fff)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>บริษัทที่ยังไม่ครบ</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: incompleteCompanies.length > 0 ? STATUS.warning : STATUS.ok, lineHeight: 1 }}>{incompleteCompanies.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>จาก {companySummary.length} บริษัท</div>
              </div>
              {/* KPI 3: Total records */}
              <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-secondary, #fff)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>รายการอบรมทั้งหมด</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: PALETTE.primary, lineHeight: 1 }}>{totalAllRecords.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>อบรมแล้ว {totalCompleted.toLocaleString()}</div>
              </div>
              {/* KPI 4: Completed */}
              <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-secondary, #fff)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>อบรมสำเร็จ</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: PALETTE.primary, lineHeight: 1 }}>{totalCompleted.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                  คงเหลือ {(totalAllRecords - totalCompleted).toLocaleString()} รายการ
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========== COMPANY TAB ========== */}
        {viewTab === 'company' && !selectedCompany && (
          <div>
            {loading ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>กำลังโหลด...</p>
            ) : (
              <>
                {/* ── Horizontal bar chart: completion rate by company ── */}
                {sortedSummary.length > 0 && (() => {
                  const barData = [...sortedSummary]
                    .map(s => ({ ...s, rate: s.total_records > 0 ? Math.round((s.completed_records / s.total_records) * 100) : 0 }))
                    .sort((a, b) => a.rate - b.rate); // worst first
                  return (
                    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid, var(--bg-secondary))', marginBottom: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>อัตราการอบรมสำเร็จ — เปรียบเทียบทุกบริษัท</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 14px' }}>เรียงจากต่ำสุดไปสูงสุด · เส้นแดง = เป้า 100%</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {barData.map(s => {
                          const rColor = s.rate >= 90 ? STATUS.ok : s.rate >= 70 ? STATUS.warning : STATUS.critical;
                          return (
                            <div key={s.company_id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedCompany(s.company_id); setCompanyFilter(''); }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 60 }}>{s.name}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: rColor }}>{s.rate}%</span>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.completed_records}/{s.total_records}</span>
                              </div>
                              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: BULLET.bgBand }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${s.rate}%`, borderRadius: 4, background: BULLET.actual, transition: 'width 0.3s' }} />
                                {/* Target line at 100% */}
                                <div style={{ position: 'absolute', top: -2, right: 0, width: 2, height: 12, background: BULLET.target, borderRadius: 1 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 14, height: 6, borderRadius: 3, background: BULLET.actual, display: 'inline-block' }} /> สำเร็จ</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 2, height: 12, borderRadius: 1, background: BULLET.target, display: 'inline-block' }} /> เป้าหมาย</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Company cards grid ── */}
                <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
                  รายชื่อบริษัท — คลิกเพื่อดูรายละเอียด
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {[...sortedSummary]
                    .sort((a, b) => {
                      const rateA = a.total_records > 0 ? (a.completed_records / a.total_records) : 1;
                      const rateB = b.total_records > 0 ? (b.completed_records / b.total_records) : 1;
                      return rateA - rateB; // lowest completion first
                    })
                    .map(s => {
                      const rate = s.total_records > 0 ? Math.round((s.completed_records / s.total_records) * 100) : 0;
                      const rColor = rate >= 90 ? STATUS.ok : rate >= 70 ? STATUS.warning : STATUS.critical;
                      return (
                        <div
                          key={s.company_id}
                          onClick={() => { setSelectedCompany(s.company_id); setCompanyFilter(''); }}
                          className="glass-card"
                          style={{ borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `linear-gradient(135deg, ${PALETTE.primary} 0%, #5856d6 100%)`, color: '#fff', fontSize: 12, fontWeight: 700,
                            }}>
                              {s.name.substring(0, 2)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{s.name}</p>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 800, color: rColor }}>{rate}%</span>
                          </div>
                          {/* Mini progress bar */}
                          <div style={{ height: 5, borderRadius: 3, background: BULLET.bgBand, marginBottom: 8 }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${rate}%`, background: rColor, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <div>
                              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.total_records}</p>
                              <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>ทั้งหมด</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 16, fontWeight: 700, color: PALETTE.primary, margin: 0 }}>{s.completed_records}</p>
                              <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>สำเร็จ</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>{s.total_records - s.completed_records}</p>
                              <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>คงเหลือ</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {sortedSummary.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                      <GraduationCap size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                      <div style={{ fontSize: 14 }}>ยังไม่มีข้อมูลผู้เข้าอบรมในปี {selectedYear}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>ลองเลือกปีอื่น หรือตรวจสอบว่ามีการนำเข้าข้อมูลแล้ว</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Company detail */}
        {viewTab === 'company' && selectedCompany && (
          <div>
            <button
              onClick={() => setSelectedCompany('')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', marginBottom: 12, fontWeight: 600 }}
            >
              <ChevronLeft size={16} /> กลับไปรายชื่อบริษัท
            </button>
            <h2 className="text-[17px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              <Building2 size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              {getCompanyName(selectedCompany)} — รายชื่อพนักงานเข้าอบรม
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchCompanyDetail(selectedCompany, 1)}
                  placeholder="ค้นหาชื่อพนักงาน..."
                  style={{ width: '100%', paddingLeft: 34, padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <button onClick={() => fetchCompanyDetail(selectedCompany, 1)}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                ค้นหา
              </button>
            </div>
            <AttendeeTable attendees={companyAttendees} loading={loading} showCompany={false} />
            <Pagination page={companyPage} totalPages={companyTotalPages} total={companyAttendeesTotal}
              onPrev={() => fetchCompanyDetail(selectedCompany, companyPage - 1)}
              onNext={() => fetchCompanyDetail(selectedCompany, companyPage + 1)} />
          </div>
        )}

        {/* ========== EMPLOYEE SEARCH TAB ========== */}
        {viewTab === 'employee' && (
          <div>
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              ค้นหาพนักงาน — พิมพ์ชื่อ นามสกุล หรือรหัสพนักงาน
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchEmployees(1)}
                  placeholder="ชื่อ นามสกุล หรือรหัสพนักงาน..."
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </div>
              <button onClick={() => searchEmployees(1)}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                ค้นหา
              </button>
            </div>

            {searchTotal > 0 && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
                พบ {searchTotal.toLocaleString()} รายการ
              </p>
            )}

            <AttendeeTable attendees={searchResults} loading={loading} showCompany={true} />
            {searchTotal > 0 && (
              <Pagination page={searchPage} totalPages={searchTotalPages} total={searchTotal}
                onPrev={() => searchEmployees(searchPage - 1)}
                onNext={() => searchEmployees(searchPage + 1)} />
            )}

            {!loading && searchText && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                <Search size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                <div style={{ fontSize: 14, marginBottom: 4 }}>ไม่พบข้อมูลสำหรับ &ldquo;{searchText}&rdquo;</div>
                <div style={{ fontSize: 12 }}>ลองค้นหาด้วยชื่ออื่น หรือตรวจสอบปีที่เลือก ({selectedYear})</div>
              </div>
            )}
          </div>
        )}

        {/* ========== COURSE TAB ========== */}
        {viewTab === 'course' && !selectedCourse && (
          <div>
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              รายชื่อหลักสูตร — คลิกเพื่อดูรายชื่อผู้เข้าอบรม
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchCourses(); }}
                  placeholder="ค้นหาชื่อหลักสูตร..."
                  style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>
              <button onClick={fetchCourses}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                ค้นหา
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>กำลังโหลด...</p>
            ) : (
              <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      <th style={thStyle}>ชื่อหลักสูตร</th>
                      <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>ประเภท</th>
                      <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>ชม.</th>
                      <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>บริษัท</th>
                      <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>ผู้เข้าอบรม</th>
                      <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>อบรมแล้ว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelectedCourse(c.course_name)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--accent)' }}>{c.course_name}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                            background: c.type === 'In-House' ? `${PALETTE.primary}12` : `${STATUS.warning}15`,
                            color: c.type === 'In-House' ? PALETTE.primary : STATUS.warning,
                          }}>{c.type || '-'}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{c.hours || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{c.company_count}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{c.unique_employee_count}</td>
                        {(() => {
                          const cRate = c.unique_employee_count > 0 ? Math.round((c.completed_attendees / c.unique_employee_count) * 100) : 0;
                          const cColor = cRate >= 90 ? STATUS.ok : cRate >= 70 ? STATUS.warning : STATUS.critical;
                          return (
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                              <span style={{ color: cColor }}>{c.completed_attendees}</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>/{c.unique_employee_count}</span>
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                    {courses.length === 0 && (
                      <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
                        <BookOpen size={28} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                        <div style={{ fontSize: 13 }}>ไม่พบหลักสูตร</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>ลองค้นหาด้วยคำอื่น หรือตรวจสอบปีที่เลือก</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Course detail — attendee list */}
        {viewTab === 'course' && selectedCourse && (
          <div>
            <button
              onClick={() => { setSelectedCourse(''); setCourseAttendees([]); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', marginBottom: 12, fontWeight: 600 }}
            >
              <ChevronLeft size={16} /> กลับไปรายชื่อหลักสูตร
            </button>
            <h2 className="text-[17px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              <GraduationCap size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              {selectedCourse}
            </h2>
            <p className="text-[12px] mb-3" style={{ color: 'var(--muted)' }}>
              แสดงเฉพาะผู้ที่อบรมเสร็จแล้ว — {courseAttendees.length} คน
            </p>
            <AttendeeTable attendees={courseAttendees} loading={loading} showCompany={true} />
          </div>
        )}

      </main>
    </div>
  );
}

// ====== Sub-components ======

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', color: 'var(--text-primary)',
};

function getCompanyName(id: string) {
  const c = COMPANIES.find(co => co.id === id);
  return c?.shortName || c?.name || id.toUpperCase();
}

function AttendeeTable({ attendees, loading, showCompany }: { attendees: AttendeeRecord[]; loading: boolean; showCompany: boolean }) {
  if (loading) return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>กำลังโหลด...</p>;

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ ...thStyle, width: 40 }}>#</th>
            {showCompany && <th style={{ ...thStyle, width: 80 }}>บริษัท</th>}
            <th style={thStyle}>รหัส</th>
            <th style={thStyle}>ชื่อ-นามสกุล</th>
            <th style={thStyle}>ตำแหน่ง</th>
            <th style={thStyle}>แผนก</th>
            <th style={thStyle}>หลักสูตร</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>สถานะ</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>ชม.</th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((a, i) => {
            const status = a.training_sessions?.status || 'planned';
            const statusConfig: Record<string, { bg: string; color: string; label: string; Icon: typeof Check }> = {
              completed: { bg: `${STATUS.ok}15`, color: STATUS.ok, label: 'อบรมแล้ว', Icon: Check },
              scheduled: { bg: `${PALETTE.primary}12`, color: PALETTE.primary, label: 'กำหนดแล้ว', Icon: CalendarClock },
              planned: { bg: '#f3f4f6', color: '#6b7280', label: 'รอ', Icon: Clock },
              cancelled: { bg: `${STATUS.critical}12`, color: STATUS.critical, label: 'ยกเลิก', Icon: Ban },
              postponed: { bg: `${STATUS.warning}15`, color: STATUS.warning, label: 'เลื่อน', Icon: AlertTriangle },
            };
            const sc = statusConfig[status] || statusConfig.planned;
            const StatusIcon = sc.Icon;
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</td>
                {showCompany && (
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-secondary)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {getCompanyName(a.company_id)}
                    </span>
                  </td>
                )}
                <td style={{ ...tdStyle, fontSize: 12, color: 'var(--muted)' }}>{a.emp_code || '-'}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{a.first_name} {a.last_name}</td>
                <td style={{ ...tdStyle, fontSize: 12 }}>{a.position || '-'}</td>
                <td style={{ ...tdStyle, fontSize: 12 }}>{a.department || '-'}</td>
                <td style={{ ...tdStyle, fontSize: 12, color: PALETTE.primary }}>{a.training_plans?.course_name || '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: sc.bg, color: sc.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <StatusIcon size={10} />
                    {sc.label}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{a.hours_attended || a.training_plans?.hours_per_course || '-'}</td>
              </tr>
            );
          })}
          {attendees.length === 0 && (
            <tr><td colSpan={showCompany ? 9 : 8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
              <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <div style={{ fontSize: 13 }}>ไม่มีข้อมูลพนักงาน</div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, fontSize: 13 }}>
      <button
        onClick={onPrev}
        disabled={page <= 1}
        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, background: 'var(--card-solid)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <ChevronLeft size={14} /> ก่อนหน้า
      </button>
      <span style={{ color: 'var(--text-secondary)' }}>
        หน้า {page} / {totalPages} ({total.toLocaleString()} รายการ)
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, background: 'var(--card-solid)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ถัดไป <ChevronRight size={14} />
      </button>
    </div>
  );
}
