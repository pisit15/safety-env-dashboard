'use client';

import { useEffect, useState, useRef } from 'react';

interface Company {
  id: string;
  name: string;
  fullName?: string;
}

interface TrainingSession {
  id: string;
  status: string;
  scheduled_date_start: string | null;
  scheduled_date_end: string | null;
  actual_cost: number;
  actual_participants: number;
  total_man_hours: number;
  hours_per_course: number;
  actual_hours: number;
  postponed_to_month: number | null;
  original_planned_month: number | null;
  instructor_name: string | null;
  training_location: string | null;
  training_method: string | null;
  note: string | null;
  training_attendees?: { count: number }[];
  dsd_submitted?: boolean;
  dsd_approved?: boolean;
  dsd_not_submitting?: boolean;
}

interface PlanRaw {
  id: string;
  company_id: string;
  course_name: string;
  category: string;
  planned_month: number;
  hours_per_course: number;
  planned_participants: number;
  budget: number;
  in_house_external: string;
  dsd_eligible: boolean;
  is_active?: boolean;
  training_sessions: TrainingSession[];
}

interface KPIData {
  totalCourses: number;
  completed: number;
  scheduled: number;
  pending: number;
  cancelled: number;
  totalBudget: number;
  actualCost: number;
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_CONFIG = {
  completed: { label: 'อบรมแล้ว', color: '#59A14F' },
  scheduled: { label: 'กำหนดวันแล้ว', color: '#4E79A7' },
  planned: { label: 'ยังไม่กำหนดวัน', color: '#BAB0AC' },
  cancelled: { label: 'ยกเลิก', color: '#E15759' },
  postponed: { label: 'เลื่อน', color: '#F28E2B' },
};

const DSD_STATUS_CONFIG = {
  none: { label: 'ไม่ระบุ', color: '#BAB0AC' },
  not_submitting: { label: 'ไม่ได้ยื่น', color: '#E15759' },
  submitted: { label: 'ยื่นแล้ว', color: '#F28E2B' },
  approved: { label: 'อนุมัติแล้ว', color: '#59A14F' },
};

function getEffectiveMonth(p: PlanRaw): number {
  const s = p.training_sessions?.[0];
  if (s?.postponed_to_month) return s.postponed_to_month;
  return p.planned_month;
}

function getSessionStatus(session: TrainingSession): string {
  if (!session) return 'planned';
  if (session.status === 'completed') return 'completed';
  if (session.status === 'scheduled') return 'scheduled';
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'postponed') return 'postponed';
  return 'planned';
}

function getDSDStatus(session: TrainingSession): string {
  if (session.dsd_approved) return 'approved';
  if (session.dsd_submitted) return 'submitted';
  if (session.dsd_not_submitting) return 'not_submitting';
  return 'none';
}

export default function TrainingDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<PlanRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [hrVerified, setHrVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, string>>({});
  const pinModalRef = useRef<HTMLDivElement>(null);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch plans for all companies
  useEffect(() => {
    const fetchAllPlans = async () => {
      setLoading(true);
      try {
        const allPlans: PlanRaw[] = [];
        for (const company of companies) {
          const res = await fetch(`/api/training/plans?companyId=${company.id}&year=${year}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            allPlans.push(...data);
          }
        }
        setPlans(allPlans);
        calculateKPI(allPlans);
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoading(false);
      }
    };

    if (companies.length > 0) {
      fetchAllPlans();
    }
  }, [companies, year]);

  // Initialize DSD statuses from sessions
  useEffect(() => {
    const statuses: Record<string, string> = {};
    plans.forEach((p) => {
      if (p.training_sessions?.[0]) {
        statuses[p.training_sessions[0].id] = getDSDStatus(p.training_sessions[0]);
      }
    });
    setSelectedStatuses(statuses);
  }, [plans]);

  function calculateKPI(plansData: PlanRaw[]) {
    let total = 0,
      completed = 0,
      scheduled = 0,
      pending = 0,
      cancelled = 0,
      totalBudget = 0,
      actualCost = 0;

    plansData.forEach((p) => {
      if (p.is_active === false) return;

      const session = p.training_sessions?.[0];
      const status = getSessionStatus(session);

      total++;
      totalBudget += p.budget || 0;

      if (session) {
        actualCost += session.actual_cost || 0;
      }

      if (status === 'completed') completed++;
      else if (status === 'scheduled' || status === 'postponed') scheduled++;
      else if (status === 'cancelled') cancelled++;
      else pending++;
    });

    setKpiData({
      totalCourses: total,
      completed,
      scheduled,
      pending,
      cancelled,
      totalBudget,
      actualCost,
    });
  }

  // Verify HR PIN
  const handleVerifyPin = async () => {
    try {
      setPinError('');
      const res = await fetch('/api/training/dsd-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'test',
          dsd_status: 'none',
          hr_pin: pinInput,
        }),
      });

      if (res.status === 403) {
        setPinError('รหัส HR ไม่ถูกต้อง');
        return;
      }

      if (res.ok) {
        setHrVerified(true);
        sessionStorage.setItem('hr_pin', pinInput);
        setShowPinModal(false);
        setPinInput('');
      }
    } catch (error) {
      setPinError('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : ''));
    }
  };

  // Update DSD status
  const handleUpdateDsd = async (sessionId: string, newStatus: string) => {
    try {
      const pin = sessionStorage.getItem('hr_pin') || pinInput;
      const res = await fetch('/api/training/dsd-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          dsd_status: newStatus,
          hr_pin: pin,
        }),
      });

      if (res.ok) {
        setSelectedStatuses((prev) => ({ ...prev, [sessionId]: newStatus }));
      } else {
        alert('อัปเดตสถานะ DSD ล้มเหลว');
      }
    } catch (error) {
      console.error('Error updating DSD status:', error);
    }
  };

  // Close PIN modal on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pinModalRef.current && !pinModalRef.current.contains(e.target as Node)) {
        setShowPinModal(false);
      }
    }
    if (showPinModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPinModal]);

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));

  // Group plans by month and status
  const plansByMonthStatus = new Map<string, { pending: PlanRaw[]; completed: PlanRaw[] }>();
  plans.forEach((p) => {
    if (p.is_active === false) return;
    const month = getEffectiveMonth(p);
    const status = getSessionStatus(p.training_sessions?.[0]);
    const group = status === 'completed' ? 'completed' : 'pending';
    const key = `${month}-${group}`;

    if (!plansByMonthStatus.has(key)) {
      plansByMonthStatus.set(key, { pending: [], completed: [] });
    }
    plansByMonthStatus.get(key)![group].push(p);
  });

  // Calculate KPI by quarter
  const kpiByQuarter = [
    { q: 'Q1', months: [1, 2, 3] },
    { q: 'Q2', months: [4, 5, 6] },
    { q: 'Q3', months: [7, 8, 9] },
    { q: 'Q4', months: [10, 11, 12] },
  ].map((quarter) => {
    let completed = 0,
      total = 0;
    plans.forEach((p) => {
      if (p.is_active === false) return;
      const month = getEffectiveMonth(p);
      if (quarter.months.includes(month)) {
        const status = getSessionStatus(p.training_sessions?.[0]);
        total++;
        if (status === 'completed') completed++;
      }
    });
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { ...quarter, completed, total, percent };
  });

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Noto Sans Thai", sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 100 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            📋 Training Dashboard — ภาพรวมแผนอบรม EA ปี {year}
          </h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Year Selector */}
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--card-solid)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </select>

            {/* HR Login Button */}
            {!hrVerified && (
              <button
                onClick={() => {
                  setShowPinModal(true);
                  setPinError('');
                }}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                🔑 HR เข้าระบบ
              </button>
            )}
            {hrVerified && (
              <div style={{ padding: '8px 12px', background: 'var(--success)', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>
                ✓ HR ยืนยันแล้ว
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            ref={pinModalRef}
            style={{
              background: 'var(--card-solid)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '360px',
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600' }}>ยืนยันตัวตนพนักงาน HR</h2>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>กรุณากรอกรหัส PIN ของ HR</p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="กรอกรหัส PIN (4+ ตัวเลข)"
              onKeyPress={(e) => e.key === 'Enter' && handleVerifyPin()}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                marginBottom: '12px',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
              }}
            />
            {pinError && <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{pinError}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPinError('');
                  setPinInput('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleVerifyPin}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>กำลังโหลด...</div>
        ) : (
          <>
            {/* KPI Cards Row */}
            {kpiData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <KPICard label="หลักสูตรทั้งหมด" value={kpiData.totalCourses} color="#4E79A7" />
                <KPICard
                  label="อบรมแล้ว"
                  value={`${kpiData.completed}${kpiData.totalCourses > 0 ? ` (${Math.round((kpiData.completed / kpiData.totalCourses) * 100)}%)` : ''}`}
                  color="#59A14F"
                />
                <KPICard label="กำหนดวันแล้ว" value={kpiData.scheduled} color="#4E79A7" />
                <KPICard label="รอดำเนินการ" value={kpiData.pending} color="#F28E2B" />
                <KPICard
                  label="งบประมาณรวม"
                  value={`${kpiData.totalBudget.toLocaleString('th-TH')} บาท`}
                  color="#4E79A7"
                />
                <KPICard
                  label="ค่าใช้จ่ายจริง"
                  value={`${kpiData.actualCost.toLocaleString('th-TH')} บาท`}
                  color="#4E79A7"
                />
              </div>
            )}

            {/* KPI by Quarter */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600' }}>KPI รายไตรมาส</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {kpiByQuarter.map((q) => (
                  <div key={q.q} style={{ background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{q.q}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#4E79A7', marginBottom: '4px' }}>
                      {q.percent}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {q.completed}/{q.total} หลักสูตร
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Course List */}
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600' }}>รายการหลักสูตรจำแนกตามสถานะ</h2>

              {/* Pending/Scheduled Section */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>รอดำเนินการ / กำหนดวันแล้ว</h3>
                <CourseList
                  plans={plans.filter((p) => {
                    const status = getSessionStatus(p.training_sessions?.[0]);
                    return status !== 'completed' && p.is_active !== false;
                  })}
                  companyMap={companyMap}
                  hrVerified={hrVerified}
                  selectedStatuses={selectedStatuses}
                  onUpdateDsd={handleUpdateDsd}
                />
              </div>

              {/* Completed Section */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>อบรมแล้ว</h3>
                <CourseList
                  plans={plans.filter((p) => {
                    const status = getSessionStatus(p.training_sessions?.[0]);
                    return status === 'completed' && p.is_active !== false;
                  })}
                  companyMap={companyMap}
                  hrVerified={hrVerified}
                  selectedStatuses={selectedStatuses}
                  onUpdateDsd={handleUpdateDsd}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div
      style={{
        background: 'var(--card-solid)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
    </div>
  );
}

interface CourseListProps {
  plans: PlanRaw[];
  companyMap: Record<string, Company>;
  hrVerified: boolean;
  selectedStatuses: Record<string, string>;
  onUpdateDsd: (sessionId: string, status: string) => void;
}

function CourseList({ plans, companyMap, hrVerified, selectedStatuses, onUpdateDsd }: CourseListProps) {
  if (plans.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '16px' }}>ไม่มีข้อมูล</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {plans.map((p) => {
        const session = p.training_sessions?.[0];
        const status = getSessionStatus(session);
        const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
        const month = getEffectiveMonth(p);
        const company = companyMap[p.company_id];
        const dsdStatus = session ? getDSDStatus(session) : 'none';
        const dsdStatusConfig = DSD_STATUS_CONFIG[dsdStatus as keyof typeof DSD_STATUS_CONFIG];

        return (
          <div
            key={p.id}
            style={{
              background: 'var(--card-solid)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              display: 'grid',
              gridTemplateColumns: '1fr 120px 100px 100px 140px auto',
              gap: '12px',
              alignItems: 'center',
              fontSize: '13px',
            }}
          >
            {/* Course Name + Company */}
            <div>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>{p.course_name}</div>
              <div
                style={{
                  display: 'inline-block',
                  background: 'var(--bg)',
                  border: `1px solid var(--border)`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                {company?.name || p.company_id}
              </div>
            </div>

            {/* Status Badge */}
            <div
              style={{
                display: 'inline-block',
                background: statusConfig?.color || '#ccc',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                textAlign: 'center',
              }}
            >
              {statusConfig?.label || 'ไม่ทราบ'}
            </div>

            {/* Month */}
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>เดือน {MONTHS[month - 1]}</div>

            {/* In-house / External */}
            <div
              style={{
                background: 'var(--bg)',
                padding: '4px 8px',
                borderRadius: '4px',
                textAlign: 'center',
                fontSize: '11px',
              }}
            >
              {p.in_house_external === 'internal' ? 'บริษัท' : 'ภายนอก'}
            </div>

            {/* DSD Status */}
            {p.dsd_eligible && session ? (
              hrVerified ? (
                <select
                  value={selectedStatuses[session.id] || dsdStatus}
                  onChange={(e) => onUpdateDsd(session.id, e.target.value)}
                  style={{
                    padding: '4px 6px',
                    border: `1px solid var(--border)`,
                    borderRadius: '4px',
                    background: 'var(--card-solid)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(DSD_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    display: 'inline-block',
                    background: dsdStatusConfig?.color || '#ccc',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                  }}
                >
                  {dsdStatusConfig?.label || 'ไม่ระบุ'}
                </div>
              )
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</div>
            )}

            {/* Budget */}
            <div style={{ textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {p.budget ? `${p.budget.toLocaleString('th-TH')} บ.` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
