'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES, DEFAULT_YEAR, ACTIVE_YEARS } from '@/lib/companies';
import {
  Users, Search, Building2, GraduationCap, ChevronLeft, ChevronRight,
  Filter, UserCheck, BookOpen, ArrowUpDown,
} from 'lucide-react';

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div className="glass-card" style={{ borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,122,255,0.1)' }}>
              <Building2 size={20} style={{ color: '#007aff' }} />
            </div>
            <div>
              <p className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>{companySummary.length}</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>บริษัทที่มีข้อมูล</p>
            </div>
          </div>
          <div className="glass-card" style={{ borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(88,86,214,0.1)' }}>
              <Users size={20} style={{ color: '#5856d6' }} />
            </div>
            <div>
              <p className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>{totalAllRecords.toLocaleString()}</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>รายการเข้าอบรมทั้งหมด</p>
            </div>
          </div>
          <div className="glass-card" style={{ borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,199,89,0.1)' }}>
              <UserCheck size={20} style={{ color: '#34c759' }} />
            </div>
            <div>
              <p className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>{totalCompleted.toLocaleString()}</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>อบรมเสร็จแล้ว</p>
            </div>
          </div>
          <div className="glass-card" style={{ borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,149,0,0.1)' }}>
              <GraduationCap size={20} style={{ color: '#ff9500' }} />
            </div>
            <div>
              <p className="text-[22px] font-bold" style={{ color: 'var(--text-primary)' }}>{totalAllRecords > 0 ? Math.round((totalCompleted / totalAllRecords) * 100) : 0}%</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>อัตราการอบรม</p>
            </div>
          </div>
        </div>

        {/* ========== COMPANY TAB ========== */}
        {viewTab === 'company' && !selectedCompany && (
          <div>
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              รายชื่อบริษัท — คลิกเพื่อดูรายละเอียด
            </h2>
            {loading ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>กำลังโหลด...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {sortedSummary.map(s => (
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
                        background: 'linear-gradient(135deg, var(--accent) 0%, #5856d6 100%)', color: '#fff', fontSize: 12, fontWeight: 700,
                      }}>
                        {s.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{s.total_records}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>รายการทั้งหมด</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-bold" style={{ color: '#34c759' }}>{s.completed_records}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>อบรมแล้ว</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-bold" style={{ color: '#ff9500' }}>
                          {s.total_records > 0 ? Math.round((s.completed_records / s.total_records) * 100) : 0}%
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>สำเร็จ</p>
                      </div>
                    </div>
                  </div>
                ))}
                {sortedSummary.length === 0 && (
                  <p style={{ color: 'var(--muted)', gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                    ยังไม่มีข้อมูลผู้เข้าอบรมในปี {selectedYear}
                  </p>
                )}
              </div>
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
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>ไม่พบข้อมูล</p>
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
                            background: c.type === 'In-House' ? '#dbeafe' : '#fef3c7',
                            color: c.type === 'In-House' ? '#1d4ed8' : '#92400e',
                          }}>{c.type || '-'}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{c.hours || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{c.company_count}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{c.unique_employee_count}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: '#34c759' }}>{c.completed_attendees}</td>
                      </tr>
                    ))}
                    {courses.length === 0 && (
                      <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: 40 }}>ไม่พบหลักสูตร</td></tr>
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
            const statusColors: Record<string, { bg: string; color: string; label: string }> = {
              completed: { bg: '#dcfce7', color: '#16a34a', label: 'อบรมแล้ว' },
              scheduled: { bg: '#dbeafe', color: '#2563eb', label: 'กำหนดแล้ว' },
              planned: { bg: '#f3f4f6', color: '#6b7280', label: 'รอ' },
              cancelled: { bg: '#fee2e2', color: '#dc2626', label: 'ยกเลิก' },
              postponed: { bg: '#fef3c7', color: '#d97706', label: 'เลื่อน' },
            };
            const sc = statusColors[status] || statusColors.planned;
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
                <td style={{ ...tdStyle, fontSize: 12, color: 'var(--accent)' }}>{a.training_plans?.course_name || '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{a.hours_attended || a.training_plans?.hours_per_course || '-'}</td>
              </tr>
            );
          })}
          {attendees.length === 0 && (
            <tr><td colSpan={showCompany ? 9 : 8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: 40 }}>ไม่มีข้อมูล</td></tr>
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
