'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, Plus, Search, ChevronLeft, ChevronRight, X,
  Activity, TrendingUp, Shield, Users, DollarSign, FileText,
  Eye, Edit2, Trash2, BarChart3, List, Clock,
} from 'lucide-react';

// Dropdown options matching the Excel template
const INCIDENT_TYPES = [
  'เสียชีวิต (Fatality)', 'บาดเจ็บ - หยุดงาน > 3 วัน', 'บาดเจ็บ - หยุดงาน ≤ 3 วัน',
  'บาดเจ็บ - ทำงานอย่างจำกัด', 'บาดเจ็บ - ไม่หยุดงาน', 'บาดเจ็บ - ปฐมพยาบาล (FA)',
  'ทรัพย์สินเสียหาย', 'เพลิงไหม้ (Fire)', 'สารเคมีรั่วไหล',
  'Near Miss', 'โรคจากการทำงาน', 'อุบัติเหตุระหว่าง บ้าน-ที่ทำงาน', 'สิ่งแวดล้อม',
];

const ACTUAL_SEVERITIES = [
  'S0 ไม่ได้รับบาดเจ็บ', 'S1 ปฐมพยาบาล', 'S2 รักษาโดยแพทย์',
  'S3 ทำงานอย่างจำกัด', 'S4 อุบัติเหตุหยุดงาน', 'S5 ทุพพลภาพ', 'S6 เสียชีวิต',
];

const PERSON_TYPES = ['พนักงานประจำ', 'พนักงานสัญญาจ้าง', 'พนักงานทดลองงาน', 'ผู้รับเหมา', 'ผู้รับเหมาช่วง', 'พนักงานชั่วคราว/รายวัน', 'นักศึกษาฝึกงาน', 'ผู้เยี่ยมชม', 'อื่นๆ'];

const POTENTIAL_SEVERITIES = [
  'P0 ไม่มีศักยภาพรุนแรงกว่านี้', 'P1 อาจถึง ปฐมพยาบาล', 'P2 อาจถึง รักษาโดยแพทย์',
  'P3 อาจถึง หยุดงาน', 'P4 อาจถึง ทุพพลภาพถาวร', 'P5 อาจถึง เสียชีวิต', 'P6 อาจถึง เสียชีวิตหลายคน',
];

const ACTIVITIES = [
  'ปฏิบัติงานปกติ', 'ซ่อมบำรุง', 'ทำความสะอาด', 'ตั้งเครื่อง/ปรับเครื่อง',
  'เปลี่ยนผลัด/ส่งงาน', 'ขนย้ายวัสดุ/ยกของ', 'ขับรถ/ใช้ยานพาหนะ',
  'ทดสอบ/ตรวจสอบ', 'ติดตั้ง/ก่อสร้าง', 'รื้อถอน', 'Rework/แก้ไขงาน',
  'พักผ่อน', 'เดินทาง', 'เดิน/เคลื่อนที่', 'อื่นๆ',
];

const ENVIRONMENTS = [
  'ปกติ', 'แสงสว่างไม่เพียงพอ', 'เสียงดัง', 'อุณหภูมิสูง', 'อุณหภูมิต่ำ',
  'พื้นเปียก/ลื่น', 'ฝุ่น/ควัน/ไอระเหย', 'พื้นที่คับแคบ', 'สภาพอากาศเลว/ฝนตก',
  'อากาศถ่ายเทไม่ดี', 'ที่สูง', 'มีสิ่งกีดขวาง', 'อื่นๆ',
];

const PROP_DMG_TYPES = [
  'เครื่องจักร/อุปกรณ์เสียหาย', 'โครงสร้างอาคาร/ผนัง', 'ยานพาหนะเสียหาย',
  'ผลิตภัณฑ์/วัตถุดิบ', 'ระบบไฟฟ้า/ควบคุม', 'ระบบท่อ/วาล์วรั่ว',
  'สารเคมีรั่วไหล', 'เพลิงไหม้', 'ระเบิด', 'Safety/Interlock ขัดข้อง', 'อื่นๆ',
];

const PROD_IMPACTS = [
  'ไม่มีผลกระทบ', 'ลดกำลังผลิต < 25%', 'ลดกำลังผลิต 25-50%',
  'ลดกำลังผลิต > 50%', 'หยุดสายผลิต', 'หยุดทั้งโรงงาน',
];

const INSUR_CLAIMS = ['ไม่ต้องเคลม', 'อยู่ระหว่างเคลม', 'เคลมสำเร็จ', 'ไม่อนุมัติ'];

const INV_LEVELS = [
  'Level 0 บันทึกเท่านั้น', 'Level 1 ACA', 'Level 2 RCA', 'Level 3 Team Investigation',
];

const RCA_METHODS = [
  '5 Whys', 'Fishbone/Ishikawa', 'FTA', 'SOURCE™', 'DO IT²', 'PROACT', 'TapRooT',
  'Change Analysis', 'Barrier Analysis', 'Bow Tie', 'ไม่ได้ทำ RCA',
];

const RC_CATEGORIES = [
  'ขั้นตอนปฏิบัติ/WI', 'การฝึกอบรม', 'การสื่อสาร', 'การจัดการ/กำกับดูแล',
  'การออกแบบ/วิศวกรรม', 'การบำรุงรักษา', 'มาตรฐาน/ข้อกำหนด', 'การจัดซื้อ/วัสดุ',
  'MOC', 'วัฒนธรรมความปลอดภัย', 'อุปกรณ์/เครื่องมือ', 'ทรัพยากร/งบประมาณ',
  'สภาพแวดล้อม', 'การวางแผนงาน', 'จัดการผู้รับเหมา', 'Human Factors', 'อื่นๆ',
];

const BARRIER_FAILS = ['ไม่มี Barrier', 'ไม่เพียงพอ', 'ไม่ทำงาน (Failed)', 'ถูกข้ามไป (Bypassed)', 'ไม่เหมาะสม', 'ไม่ทราบ'];

const HOC_TYPES = ['1.Elimination', '2.Substitution', '3.Engineering Controls', '4.Administrative Controls', '5.PPE'];

const CA_STATUSES = ['Open', 'In Progress', 'Completed', 'Verified', 'Overdue', 'Cancelled'];

const JUST_CULTURES = ['Human Error (Honest Mistake)', 'At-Risk Behavior (Drift)', 'Reckless Behavior', 'ไม่เกี่ยวกับ Human Error', 'ยังไม่ได้ประเมิน'];

const NATURE_INJURIES = [
  '0 ไม่ได้รับบาดเจ็บ', 'แผลมีดบาด / ฉีกขาด', 'แผลถูกเจาะ', 'ถลอก/ขีดข่วน',
  'ฟกช้ำ', 'กระดูกแตก/หัก', 'เคลื่อน/หลุด', 'เส้นเอ็นฉีกขาด', 'แผลตัด/ขาด/ดึงออก',
  'แผลไหม้จากความร้อน', 'แผลไหม้จากสารเคมี', 'แผลไหม้จากไฟฟ้า', 'ไฟฟ้าช็อต/แฟลชอาร์ค',
  'พิษ/แพ้สารเคมี', 'ผิวหนังอักเสบ / แพ้เฉียบพลัน', 'สมองกระทบกระเทือน',
  'บาดเจ็บภายใน', 'ปัญหาระบบหายใจ', 'สูญเสียการได้ยิน', 'ปัญหากล้ามเนื้อ', 'ช็อก/หมดสติ', 'อื่นๆ',
];

const BODY_PARTS = [
  '0 ไม่ได้รับบาดเจ็บ', 'ศีรษะ', 'ใบหน้า', 'ตา', 'ปาก/ฟัน', 'หู', 'คอ', 'ไหล่',
  'แขน/ศอก', 'ข้อมือ', 'มือ', 'นิ้วมือ', 'หลัง', 'หน้าอก/ซี่โครง', 'ท้อง/เอว',
  'สะโพก', 'ขา / เข่า / น่อง', 'ข้อเท้า', 'เท้า', 'นิ้วเท้า', 'ระบบหายใจ',
  'อวัยวะภายใน', 'หลายส่วน', 'ไม่สามารถจำแนกได้', 'ไม่ได้รับบาดเจ็บ',
];

const BODY_SIDES = ['ซ้าย', 'ขวา', 'ทั้งสองข้าง', 'ไม่ระบุ'];

const INJ_SEVERITIES = [
  'FA ปฐมพยาบาล', 'MTC รักษาโดยแพทย์', 'RW ทำงานอย่างจำกัด',
  'LTI หยุดงาน', 'PD ทุพพลภาพถาวร', 'Fatal เสียชีวิต',
];

const TRAIN_STATUSES = ['ผ่าน-มีหลักฐาน', 'ผ่าน-ไม่มีหลักฐาน', 'ไม่ผ่าน', 'ไม่ต้องอบรม', 'ไม่ทราบ'];

const CONTACT_TYPES = [
  'กระแทก/ชนกับวัตถุหรืออุปกรณ์', 'ถูกหนีบ/ถูกกดทับ โดยเครื่องจักรหรือวัตถุ',
  'ถูกกระแทก หรือถูกทับจากโครงสร้างที่พัง', 'วัตถุหรืออุปกรณ์ บาด/ตัด/เจาะ/ทิ่ม',
  'ตกจากที่สูง', 'ลื่น/สะดุด/หกล้ม', 'สัมผัสสารเคมี ก๊าซพิษ',
  'สัมผัสไฟฟ้า', 'สัมผัสของร้อน/เย็น', 'ยกของหนักเกินไป',
  'ถูกวัตถุตก/หล่น/กระเด็นใส่', 'ยานพาหนะ/รถยก', 'อื่นๆ',
];

const AGENCY_SOURCES = [
  'เครื่องจักร', 'เครื่องมือ (มีด , ค้อน )', 'เครื่องมือกล/ไฟฟ้า',
  'สารเคมีและผลิตภัณฑ์เคมี', 'วัตถุ/ชิ้นส่วน', 'พื้นผิว/ทางเดิน',
  'ยานพาหนะ', 'ไฟฟ้า', 'เศษวัสดุ ขยะ ', 'โครงสร้าง/อาคาร', 'อื่นๆ',
];

const SHIFTS = ['Day (08:00-18:00)', 'Night (20:00-08:00)', 'OT (กะกลางวัน)', 'OT (กะกลางคืน)'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH: Record<string, string> = {
  Jan: 'ม.ค.', Feb: 'ก.พ.', Mar: 'มี.ค.', Apr: 'เม.ย.', May: 'พ.ค.', Jun: 'มิ.ย.',
  Jul: 'ก.ค.', Aug: 'ส.ค.', Sep: 'ก.ย.', Oct: 'ต.ค.', Nov: 'พ.ย.', Dec: 'ธ.ค.',
};

interface Incident {
  id: string;
  incident_no: string;
  company_id: string;
  incident_date: string;
  incident_time?: string;
  year: number;
  month: string;
  shift?: string;
  report_date?: string;
  reporter?: string;
  person_type?: string;
  department?: string;
  work_related?: string;
  incident_type: string;
  actual_severity?: string;
  potential_severity?: string;
  injured_count?: number;
  contact_type?: string;
  agency_source?: string;
  activity?: string;
  description?: string;
  area?: string;
  equipment?: string;
  environment?: string;
  direct_cost?: number;
  indirect_cost?: number;
  report_status?: string;
  [key: string]: unknown;
}

interface SummaryData {
  summary: {
    totalIncidents: number;
    totalInjuries: number;
    ltiCases: number;
    nearMisses: number;
    propertyDamage: number;
    fatalities: number;
    totalDirectCost: number;
    totalIndirectCost: number;
    employeeInjuries: number;
    contractorInjuries: number;
    employeeLti: number;
    contractorLti: number;
  };
  monthlyData: Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }>;
  severityBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
}

const inputStyle = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10,
  padding: '8px 12px', fontSize: 13, width: '100%', color: '#1a1a1a',
};

const selectStyle = { ...inputStyle, appearance: 'none' as const };

export default function IncidentsPage() {
  const { id } = useParams() as { id: string };
  const auth = useAuth();
  const company = COMPANIES.find(c => c.id === id);
  const companyName = company?.shortName || id.toUpperCase();

  const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'form'>('dashboard');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Dashboard data
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  // List data
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form data
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [injuredPersons, setInjuredPersons] = useState<Record<string, unknown>[]>([]);

  // Man-hours data for TIFR/LTIFR
  const [manHours, setManHours] = useState<{ employee: number; contractor: number; total: number }>({ employee: 0, contractor: 0, total: 0 });

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents?mode=summary&companyId=${id}&year=${year}`);
      const data = await res.json();
      setSummaryData(data);
    } catch { /* empty */ }

    // Fetch man-hours
    try {
      const mhRes = await fetch(`/api/manhours?companyId=${id}&year=${year}`);
      const mhData = await mhRes.json();
      const mh = (mhData.manHours || []).reduce(
        (acc: { employee: number; contractor: number; total: number }, r: Record<string, unknown>) => ({
          employee: acc.employee + (Number(r.employee_manhours) || 0),
          contractor: acc.contractor + (Number(r.contractor_manhours) || 0),
          total: acc.total + (Number(r.employee_manhours) || 0) + (Number(r.contractor_manhours) || 0),
        }),
        { employee: 0, contractor: 0, total: 0 }
      );
      setManHours(mh);
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year]);

  // Fetch list
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: id, year: String(year), page: String(page), limit: '20' });
      if (searchTerm) params.set('search', searchTerm);
      if (filterType) params.set('incidentType', filterType);
      const res = await fetch(`/api/incidents?${params}`);
      const data = await res.json();
      setIncidents(data.incidents || []);
      setTotal(data.total || 0);
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year, page, searchTerm, filterType]);

  useEffect(() => {
    if (viewMode === 'dashboard') fetchSummary();
    else if (viewMode === 'list') fetchList();
  }, [viewMode, fetchSummary, fetchList]);

  // Calculate TIFR/LTIFR — Combined, Employee-only, Contractor-only
  const s = summaryData?.summary;
  const tifrCombined = manHours.total > 0 && s ? (s.totalInjuries / manHours.total) * 1000000 : null;
  const ltifrCombined = manHours.total > 0 && s ? (s.ltiCases / manHours.total) * 1000000 : null;
  const tifrEmployee = manHours.employee > 0 && s ? ((s.employeeInjuries || 0) / manHours.employee) * 1000000 : null;
  const ltifrEmployee = manHours.employee > 0 && s ? ((s.employeeLti || 0) / manHours.employee) * 1000000 : null;
  const tifrContractor = manHours.contractor > 0 && s ? ((s.contractorInjuries || 0) / manHours.contractor) * 1000000 : null;
  const ltifrContractor = manHours.contractor > 0 && s ? ((s.contractorLti || 0) / manHours.contractor) * 1000000 : null;

  // Form handlers
  const openNewForm = () => {
    setEditingIncident(null);
    setFormData({
      company_id: id,
      incident_date: new Date().toISOString().split('T')[0],
      incident_type: '',
      work_related: 'ใช่',
      report_status: 'Draft',
    });
    setInjuredPersons([]);
    setViewMode('form');
  };

  const openEditForm = async (incident: Incident) => {
    setEditingIncident(incident);
    setFormData({ ...incident });
    // Fetch injured persons for this incident
    try {
      const res = await fetch(`/api/incidents/injured?incident_no=${encodeURIComponent(incident.incident_no)}`);
      const data = await res.json();
      setInjuredPersons(data.persons || []);
    } catch { setInjuredPersons([]); }
    setViewMode('form');
  };

  const addInjuredPerson = () => {
    setInjuredPersons(prev => [...prev, {
      person_type: '', full_name: '', position: '', department: '', years_of_service: null,
      training_status: '', injury_severity: '', nature_of_injury: '', body_part: '', body_side: '',
      injury_detail: '', is_lti: 'ไม่ใช่', lost_work_days: 0, leave_start_date: '', return_to_work_date: '',
      treatment: '', hospital: '', medical_cost: 0,
    }]);
  };

  const updateInjuredPerson = (idx: number, key: string, value: unknown) => {
    setInjuredPersons(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  };

  const removeInjuredPerson = (idx: number) => {
    setInjuredPersons(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!formData.incident_type || !formData.incident_date) {
      alert('กรุณากรอกวันที่และประเภทอุบัติการณ์');
      return;
    }
    setSaving(true);
    try {
      const method = editingIncident ? 'PUT' : 'POST';
      const payload = { ...formData, injured_persons: injuredPersons.length > 0 ? injuredPersons : undefined };
      const res = await fetch('/api/incidents', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        setViewMode('list');
        fetchList();
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
    setSaving(false);
  };

  const handleDelete = async (inc: Incident) => {
    if (!confirm(`ต้องการลบ ${inc.incident_no}?`)) return;
    try {
      await fetch(`/api/incidents?id=${inc.id}`, { method: 'DELETE' });
      fetchList();
    } catch { /* empty */ }
  };

  const updateForm = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Severity color
  const getSevColor = (sev: string) => {
    if (sev?.includes('S6') || sev?.includes('เสียชีวิต')) return '#ef4444';
    if (sev?.includes('S5') || sev?.includes('S4')) return '#f97316';
    if (sev?.includes('S3')) return '#eab308';
    if (sev?.includes('S2')) return '#3b82f6';
    if (sev?.includes('S1')) return '#22c55e';
    return '#9ca3af';
  };

  // Incident type badge color
  const getTypeBadge = (type: string) => {
    if (type?.includes('เสียชีวิต')) return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
    if (type?.includes('หยุดงาน')) return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
    if (type?.includes('ทำงานอย่างจำกัด')) return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' };
    if (type?.includes('ไม่หยุดงาน') || type?.includes('ปฐมพยาบาล')) return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd' };
    if (type === 'Near Miss') return { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' };
    if (type === 'ทรัพย์สินเสียหาย') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  };

  // Max bar value for chart
  const maxMonthly = summaryData ? Math.max(...Object.values(summaryData.monthlyData).map(m => m.total), 1) : 1;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — {companyName}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Incident Statistics & Recording
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Year selector */}
              <select
                value={year}
                onChange={e => { setYear(Number(e.target.value)); setPage(1); }}
                style={{ ...selectStyle, width: 100 }}
              >
                {[2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* View mode tabs */}
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {[
                  { mode: 'dashboard' as const, icon: BarChart3, label: 'Dashboard' },
                  { mode: 'list' as const, icon: List, label: 'รายการ' },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-colors"
                    style={{
                      background: viewMode === mode ? 'var(--accent)' : 'transparent',
                      color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={openNewForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                <Plus size={16} /> บันทึกอุบัติเหตุ
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          {loading && viewMode !== 'form' ? (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted)' }}>
              <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mr-3" />
              กำลังโหลดข้อมูล...
            </div>
          ) : viewMode === 'dashboard' && summaryData ? (
            /* ===================== DASHBOARD VIEW ===================== */
            <div>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'อุบัติการณ์ทั้งหมด', value: summaryData.summary.totalIncidents, icon: AlertTriangle, color: '#6366f1' },
                  { label: 'บาดเจ็บ', value: summaryData.summary.totalInjuries, icon: Activity, color: '#f97316' },
                  { label: 'LTI Cases', value: summaryData.summary.ltiCases, icon: Clock, color: '#ef4444' },
                  { label: 'Near Miss', value: summaryData.summary.nearMisses, icon: Shield, color: '#8b5cf6' },
                  { label: 'ทรัพย์สินเสียหาย', value: summaryData.summary.propertyDamage, icon: DollarSign, color: '#22c55e' },
                  { label: 'เสียชีวิต', value: summaryData.summary.fatalities, icon: Users, color: summaryData.summary.fatalities > 0 ? '#ef4444' : '#9ca3af' },
                ].map((kpi, idx) => (
                  <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                        <kpi.icon size={16} style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* TIFR / LTIFR — 3-way split + Cost */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  TIFR / LTIFR
                </h3>
                {manHours.total === 0 && (
                  <p className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: '#fef3c7', color: '#92400e' }}>
                    กรุณากรอก Man-hours ที่หน้า &quot;ชั่วโมงการทำงาน&quot; เพื่อคำนวณ TIFR/LTIFR
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Employee */}
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                      <span className="text-[11px] font-semibold" style={{ color: '#3b82f6' }}>พนักงาน (Employee)</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>TIFR</span>
                        <span className="text-lg font-bold" style={{ color: tifrEmployee !== null ? '#f97316' : 'var(--muted)' }}>
                          {tifrEmployee !== null ? tifrEmployee.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>LTIFR</span>
                        <span className="text-lg font-bold" style={{ color: ltifrEmployee !== null ? '#ef4444' : 'var(--muted)' }}>
                          {ltifrEmployee !== null ? ltifrEmployee.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="text-[10px] pt-1" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                        Man-hours: {manHours.employee > 0 ? manHours.employee.toLocaleString() : '-'} | Injuries: {summaryData.summary.employeeInjuries || 0} | LTI: {summaryData.summary.employeeLti || 0}
                      </div>
                    </div>
                  </div>
                  {/* Contractor */}
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
                      <span className="text-[11px] font-semibold" style={{ color: '#f97316' }}>ผู้รับเหมา (Contractor)</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>TIFR</span>
                        <span className="text-lg font-bold" style={{ color: tifrContractor !== null ? '#f97316' : 'var(--muted)' }}>
                          {tifrContractor !== null ? tifrContractor.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>LTIFR</span>
                        <span className="text-lg font-bold" style={{ color: ltifrContractor !== null ? '#ef4444' : 'var(--muted)' }}>
                          {ltifrContractor !== null ? ltifrContractor.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="text-[10px] pt-1" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                        Man-hours: {manHours.contractor > 0 ? manHours.contractor.toLocaleString() : '-'} | Injuries: {summaryData.summary.contractorInjuries || 0} | LTI: {summaryData.summary.contractorLti || 0}
                      </div>
                    </div>
                  </div>
                  {/* Combined */}
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '2px solid var(--accent)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} />
                      <span className="text-[11px] font-semibold" style={{ color: '#6366f1' }}>รวม (Combined)</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>TIFR</span>
                        <span className="text-xl font-bold" style={{ color: tifrCombined !== null ? '#f97316' : 'var(--muted)' }}>
                          {tifrCombined !== null ? tifrCombined.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>LTIFR</span>
                        <span className="text-xl font-bold" style={{ color: ltifrCombined !== null ? '#ef4444' : 'var(--muted)' }}>
                          {ltifrCombined !== null ? ltifrCombined.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="text-[10px] pt-1" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                        Man-hours: {manHours.total > 0 ? manHours.total.toLocaleString() : '-'} | Injuries: {summaryData.summary.totalInjuries} | LTI: {summaryData.summary.ltiCases}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>ค่าเสียหายรวม</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: '#22c55e' }}>
                      {(summaryData.summary.totalDirectCost + summaryData.summary.totalIndirectCost).toLocaleString()} ฿
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายตรง</p>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{summaryData.summary.totalDirectCost.toLocaleString()} ฿</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายอ้อม</p>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{summaryData.summary.totalIndirectCost.toLocaleString()} ฿</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Chart */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  อุบัติการณ์รายเดือน — {year}
                </h3>
                <div className="flex items-end gap-2" style={{ height: 180 }}>
                  {MONTHS.map(m => {
                    const d = summaryData.monthlyData[m] || { total: 0, injuries: 0, nearMiss: 0, propertyDamage: 0 };
                    const h = d.total > 0 ? (d.total / maxMonthly) * 150 : 0;
                    return (
                      <div key={m} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{d.total || ''}</span>
                        <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: Math.max(h, 2) }}>
                          {d.injuries > 0 && (
                            <div style={{ height: `${(d.injuries / d.total) * 100}%`, background: '#f97316', minHeight: 2 }} />
                          )}
                          {d.nearMiss > 0 && (
                            <div style={{ height: `${(d.nearMiss / d.total) * 100}%`, background: '#8b5cf6', minHeight: 2 }} />
                          )}
                          {d.propertyDamage > 0 && (
                            <div style={{ height: `${(d.propertyDamage / d.total) * 100}%`, background: '#22c55e', minHeight: 2 }} />
                          )}
                          {d.total === 0 && <div style={{ height: 2, background: 'var(--border)' }} />}
                        </div>
                        <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-6 mt-4 justify-center">
                  {[
                    { label: 'บาดเจ็บ', color: '#f97316' },
                    { label: 'Near Miss', color: '#8b5cf6' },
                    { label: 'ทรัพย์สิน', color: '#22c55e' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Type & Severity breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>ประเภทอุบัติการณ์</h3>
                  <div className="space-y-2">
                    {Object.entries(summaryData.typeBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const badge = getTypeBadge(type);
                        const pct = summaryData.summary.totalIncidents > 0 ? (count / summaryData.summary.totalIncidents) * 100 : 0;
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{type}</span>
                                <span className="text-[12px] font-semibold" style={{ color: badge.color }}>{count}</span>
                              </div>
                              <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: badge.color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                  <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>ระดับความรุนแรง</h3>
                  <div className="space-y-2">
                    {Object.entries(summaryData.severityBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([sev, count]) => {
                        const color = getSevColor(sev);
                        const pct = summaryData.summary.totalIncidents > 0 ? (count / summaryData.summary.totalIncidents) * 100 : 0;
                        return (
                          <div key={sev} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{sev}</span>
                                <span className="text-[12px] font-semibold" style={{ color }}>{count}</span>
                              </div>
                              <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            /* ===================== LIST VIEW ===================== */
            <div>
              {/* Search & Filter */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                  <input
                    placeholder="ค้นหา Incident No, รายละเอียด, พื้นที่..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, paddingLeft: 36 }}
                  />
                </div>
                <select
                  value={filterType}
                  onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  style={{ ...selectStyle, width: 220 }}
                >
                  <option value="">ทุกประเภท</option>
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                  {total} รายการ
                </span>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['Incident No.', 'วันที่', 'ประเภท', 'ความรุนแรง', 'รายละเอียด', 'พื้นที่', 'สถานะ', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc, idx) => {
                      const badge = getTypeBadge(inc.incident_type);
                      return (
                        <tr key={inc.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                          <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--accent)' }}>{inc.incident_no}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {inc.incident_date ? new Date(inc.incident_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                              {inc.incident_type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: getSevColor(inc.actual_severity || '') }} />
                              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{inc.actual_severity || '-'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[250px] truncate" style={{ color: 'var(--text-secondary)' }} title={inc.description || ''}>
                            {inc.description || '-'}
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{inc.area || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{
                              background: inc.report_status === 'Closed' ? '#dcfce7' : inc.report_status === 'Approved' ? '#dbeafe' : '#fef3c7',
                              color: inc.report_status === 'Closed' ? '#16a34a' : inc.report_status === 'Approved' ? '#2563eb' : '#d97706',
                            }}>
                              {inc.report_status || 'Draft'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditForm(inc)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--accent)' }}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(inc)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {incidents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                          ไม่พบข้อมูลอุบัติเหตุ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 20 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', opacity: page === 1 ? 0.3 : 1 }}>
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-[13px] px-3" style={{ color: 'var(--text-secondary)' }}>
                    หน้า {page} / {Math.ceil(total / 20)}
                  </span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', opacity: page >= Math.ceil(total / 20) ? 0.3 : 1 }}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'form' ? (
            /* ===================== FORM VIEW ===================== */
            <div className="max-w-4xl">
              <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                {/* Form Header */}
                <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[16px] font-bold text-white">
                        {editingIncident ? `แก้ไข ${editingIncident.incident_no}` : 'บันทึกอุบัติเหตุใหม่'}
                      </h2>
                      <p className="text-[12px] text-white/70 mt-0.5">{companyName}</p>
                    </div>
                    <button onClick={() => setViewMode('list')} className="text-white/70 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Section 1: Identification */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[11px] font-bold">1</span>
                      IDENTIFICATION
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่เกิดเหตุ *</label>
                        <input type="date" value={(formData.incident_date as string) || ''} onChange={e => updateForm('incident_date', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>เวลาเกิดเหตุ</label>
                        <input type="time" value={(formData.incident_time as string) || ''} onChange={e => updateForm('incident_time', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>กะการทำงาน</label>
                        <select value={(formData.shift as string) || ''} onChange={e => updateForm('shift', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่รายงาน</label>
                        <input type="date" value={(formData.report_date as string) || ''} onChange={e => updateForm('report_date', e.target.value)} style={inputStyle} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ผู้รายงาน</label>
                        <input type="text" value={(formData.reporter as string) || ''} onChange={e => updateForm('reporter', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รายงาน" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Who */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-bold">2</span>
                      WHO
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภทบุคคล</label>
                        <select value={(formData.person_type as string) || ''} onChange={e => updateForm('person_type', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {PERSON_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>แผนก</label>
                        <input type="text" value={(formData.department as string) || ''} onChange={e => updateForm('department', e.target.value)} style={inputStyle} placeholder="แผนก" />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: What & Where */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">3</span>
                      WHAT & WHERE
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>อุบัติเหตุเกี่ยวกับงาน</label>
                        <select value={(formData.work_related as string) || 'ใช่'} onChange={e => updateForm('work_related', e.target.value)} style={selectStyle}>
                          <option value="ใช่">ใช่</option>
                          <option value="ไม่ใช่">ไม่ใช่</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภทอุบัติการณ์ *</label>
                        <select value={(formData.incident_type as string) || ''} onChange={e => updateForm('incident_type', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ความรุนแรงจริง (Actual)</label>
                        <select value={(formData.actual_severity as string) || ''} onChange={e => updateForm('actual_severity', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {ACTUAL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ความรุนแรงที่อาจเกิด (Potential)</label>
                        <select value={(formData.potential_severity as string) || ''} onChange={e => updateForm('potential_severity', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {POTENTIAL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>จำนวนผู้บาดเจ็บ</label>
                        <input type="number" value={(formData.injured_count as number) || 0} onChange={e => updateForm('injured_count', parseInt(e.target.value) || 0)} style={inputStyle} min={0} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>เหตุการณ์/การสัมผัส</label>
                        <select value={(formData.contact_type as string) || ''} onChange={e => updateForm('contact_type', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>แหล่งที่มาอุบัติเหตุ</label>
                        <select value={(formData.agency_source as string) || ''} onChange={e => updateForm('agency_source', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {AGENCY_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>กิจกรรมขณะเกิดเหตุ</label>
                        <select value={(formData.activity as string) || ''} onChange={e => updateForm('activity', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>รายละเอียดเหตุการณ์</label>
                      <textarea value={(formData.description as string) || ''} onChange={e => updateForm('description', e.target.value)} style={{ ...inputStyle, minHeight: 80 }} placeholder="อธิบายรายละเอียดเหตุการณ์..." />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>พื้นที่เกิดเหตุ</label>
                        <input type="text" value={(formData.area as string) || ''} onChange={e => updateForm('area', e.target.value)} style={inputStyle} placeholder="พื้นที่/โซน" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>เครื่องจักร/อุปกรณ์</label>
                        <input type="text" value={(formData.equipment as string) || ''} onChange={e => updateForm('equipment', e.target.value)} style={inputStyle} placeholder="เครื่องจักรที่เกี่ยวข้อง" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>สภาพแวดล้อม</label>
                        <select value={(formData.environment as string) || ''} onChange={e => updateForm('environment', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Property Damage 🟣 */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[11px] font-bold">4</span>
                      PROPERTY DAMAGE 🟣
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภททรัพย์สินเสียหาย</label>
                        <select value={(formData.property_damage_type as string) || ''} onChange={e => updateForm('property_damage_type', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {PROP_DMG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>อุปกรณ์ดับเพลิงที่ใช้</label>
                        <input type="text" value={(formData.fire_equipment_used as string) || ''} onChange={e => updateForm('fire_equipment_used', e.target.value)} style={inputStyle} placeholder="ถ้ามี" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>รายละเอียดความเสียหาย</label>
                      <textarea value={(formData.property_damage_detail as string) || ''} onChange={e => updateForm('property_damage_detail', e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="รายละเอียดทรัพย์สินที่เสียหาย..." />
                    </div>
                  </div>

                  {/* Section 5: Consequence */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[11px] font-bold">5</span>
                      CONSEQUENCE
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ค่าเสียหายโดยตรง (บาท)</label>
                        <input type="number" value={(formData.direct_cost as number) || 0} onChange={e => updateForm('direct_cost', parseFloat(e.target.value) || 0)} style={inputStyle} min={0} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ค่าเสียหายทางอ้อม (บาท)</label>
                        <input type="number" value={(formData.indirect_cost as number) || 0} onChange={e => updateForm('indirect_cost', parseFloat(e.target.value) || 0)} style={inputStyle} min={0} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ผลกระทบต่อการผลิต</label>
                        <select value={(formData.production_impact as string) || ''} onChange={e => updateForm('production_impact', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {PROD_IMPACTS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>สถานะเคลมประกัน</label>
                        <select value={(formData.insurance_claim as string) || ''} onChange={e => updateForm('insurance_claim', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {INSUR_CLAIMS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Investigation */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-[11px] font-bold">6</span>
                      INVESTIGATION
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ระดับการสอบสวน</label>
                        <select value={(formData.investigation_level as string) || ''} onChange={e => updateForm('investigation_level', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {INV_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่เริ่มสอบสวน</label>
                        <input type="date" value={(formData.investigation_start_date as string) || ''} onChange={e => updateForm('investigation_start_date', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>หัวหน้าทีมสอบสวน</label>
                        <input type="text" value={(formData.investigation_lead as string) || ''} onChange={e => updateForm('investigation_lead', e.target.value)} style={inputStyle} placeholder="ชื่อหัวหน้าทีม" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>RCA Method</label>
                        <select value={(formData.rca_method as string) || ''} onChange={e => updateForm('rca_method', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {RCA_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Root Cause Category</label>
                        <select value={(formData.root_cause_category as string) || ''} onChange={e => updateForm('root_cause_category', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {RC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Barrier ที่ล้มเหลว</label>
                        <select value={(formData.barrier_failure as string) || ''} onChange={e => updateForm('barrier_failure', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {BARRIER_FAILS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Immediate Cause</label>
                        <textarea value={(formData.immediate_cause as string) || ''} onChange={e => updateForm('immediate_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="สาเหตุโดยตรง" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Contributing Cause</label>
                        <textarea value={(formData.contributing_cause as string) || ''} onChange={e => updateForm('contributing_cause', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="สาเหตุร่วม" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Root Cause Detail</label>
                        <textarea value={(formData.root_cause_detail as string) || ''} onChange={e => updateForm('root_cause_detail', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="รายละเอียดสาเหตุราก" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Just Culture</label>
                        <select value={(formData.just_culture as string) || ''} onChange={e => updateForm('just_culture', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {JUST_CULTURES.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 7: Corrective Action */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-[11px] font-bold">7</span>
                      CORRECTIVE ACTION
                    </h3>
                    {/* CA 1 */}
                    <div className="p-3 rounded-lg mb-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <p className="text-[11px] font-bold mb-2" style={{ color: '#374151' }}>Corrective Action 1</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>มาตรการแก้ไข</label>
                          <textarea value={(formData.corrective_action_1 as string) || ''} onChange={e => updateForm('corrective_action_1', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="อธิบายมาตรการแก้ไข..." />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภท (HoC)</label>
                          <select value={(formData.ca1_type as string) || ''} onChange={e => updateForm('ca1_type', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {HOC_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ผู้รับผิดชอบ</label>
                          <input type="text" value={(formData.ca1_responsible as string) || ''} onChange={e => updateForm('ca1_responsible', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับผิดชอบ" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>กำหนดเสร็จ</label>
                          <input type="date" value={(formData.ca1_due_date as string) || ''} onChange={e => updateForm('ca1_due_date', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>สถานะ</label>
                          <select value={(formData.ca1_status as string) || ''} onChange={e => updateForm('ca1_status', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {CA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    {/* CA 2 */}
                    <div className="p-3 rounded-lg mb-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <p className="text-[11px] font-bold mb-2" style={{ color: '#374151' }}>Corrective Action 2</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>มาตรการแก้ไข</label>
                          <textarea value={(formData.corrective_action_2 as string) || ''} onChange={e => updateForm('corrective_action_2', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="อธิบายมาตรการแก้ไข..." />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภท (HoC)</label>
                          <select value={(formData.ca2_type as string) || ''} onChange={e => updateForm('ca2_type', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {HOC_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>ผู้รับผิดชอบ</label>
                          <input type="text" value={(formData.ca2_responsible as string) || ''} onChange={e => updateForm('ca2_responsible', e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับผิดชอบ" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>กำหนดเสร็จ</label>
                          <input type="date" value={(formData.ca2_due_date as string) || ''} onChange={e => updateForm('ca2_due_date', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>สถานะ</label>
                          <select value={(formData.ca2_status as string) || ''} onChange={e => updateForm('ca2_status', e.target.value)} style={selectStyle}>
                            <option value="">เลือก</option>
                            {CA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>Lessons Learned</label>
                      <textarea value={(formData.lessons_learned as string) || ''} onChange={e => updateForm('lessons_learned', e.target.value)} style={{ ...inputStyle, minHeight: 50 }} placeholder="บทเรียนที่ได้..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่ปิดรายงาน</label>
                        <input type="date" value={(formData.report_closed_date as string) || ''} onChange={e => updateForm('report_closed_date', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>สถานะรายงาน</label>
                        <select value={(formData.report_status as string) || 'Draft'} onChange={e => updateForm('report_status', e.target.value)} style={selectStyle}>
                          {['Draft', 'Under Review', 'Approved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 8: Injured Person Log */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[11px] font-bold">IP</span>
                      INJURED PERSON LOG
                      <span className="text-[11px] font-normal" style={{ color: '#9ca3af' }}>({injuredPersons.length} คน)</span>
                    </h3>
                    {injuredPersons.map((person, idx) => (
                      <div key={idx} className="p-3 rounded-lg mb-3 relative" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold" style={{ color: '#dc2626' }}>ผู้บาดเจ็บที่ {idx + 1}</p>
                          <button onClick={() => removeInjuredPerson(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ประเภทบุคคล</label>
                            <select value={(person.person_type as string) || ''} onChange={e => updateInjuredPerson(idx, 'person_type', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {PERSON_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ชื่อ-สกุล</label>
                            <input type="text" value={(person.full_name as string) || ''} onChange={e => updateInjuredPerson(idx, 'full_name', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} placeholder="ชื่อ-สกุล" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ตำแหน่ง</label>
                            <input type="text" value={(person.position as string) || ''} onChange={e => updateInjuredPerson(idx, 'position', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} placeholder="ตำแหน่ง" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>แผนก</label>
                            <input type="text" value={(person.department as string) || ''} onChange={e => updateInjuredPerson(idx, 'department', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} placeholder="แผนก" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>อายุงาน (ปี)</label>
                            <input type="number" value={(person.years_of_service as number) || ''} onChange={e => updateInjuredPerson(idx, 'years_of_service', parseFloat(e.target.value) || null)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} min={0} step={0.5} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ผ่านการอบรม</label>
                            <select value={(person.training_status as string) || ''} onChange={e => updateInjuredPerson(idx, 'training_status', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {TRAIN_STATUSES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ระดับการบาดเจ็บ</label>
                            <select value={(person.injury_severity as string) || ''} onChange={e => updateInjuredPerson(idx, 'injury_severity', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {INJ_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ลักษณะการบาดเจ็บ</label>
                            <select value={(person.nature_of_injury as string) || ''} onChange={e => updateInjuredPerson(idx, 'nature_of_injury', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {NATURE_INJURIES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ส่วนร่างกาย</label>
                            <select value={(person.body_part as string) || ''} onChange={e => updateInjuredPerson(idx, 'body_part', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ด้าน</label>
                            <select value={(person.body_side as string) || ''} onChange={e => updateInjuredPerson(idx, 'body_side', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="">เลือก</option>
                              {BODY_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>LTI?</label>
                            <select value={(person.is_lti as string) || 'ไม่ใช่'} onChange={e => updateInjuredPerson(idx, 'is_lti', e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 8px' }}>
                              <option value="ใช่">ใช่</option>
                              <option value="ไม่ใช่">ไม่ใช่</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันหยุดงาน (LWD)</label>
                            <input type="number" value={(person.lost_work_days as number) || 0} onChange={e => updateInjuredPerson(idx, 'lost_work_days', parseInt(e.target.value) || 0)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} min={0} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่เริ่มหยุด</label>
                            <input type="date" value={(person.leave_start_date as string) || ''} onChange={e => updateInjuredPerson(idx, 'leave_start_date', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>วันที่กลับทำงาน</label>
                            <input type="date" value={(person.return_to_work_date as string) || ''} onChange={e => updateInjuredPerson(idx, 'return_to_work_date', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>การรักษา</label>
                            <input type="text" value={(person.treatment as string) || ''} onChange={e => updateInjuredPerson(idx, 'treatment', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} placeholder="วิธีรักษา" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>โรงพยาบาล/คลินิก</label>
                            <input type="text" value={(person.hospital as string) || ''} onChange={e => updateInjuredPerson(idx, 'hospital', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} placeholder="ชื่อสถานพยาบาล" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>ค่ารักษา (บาท)</label>
                            <input type="number" value={(person.medical_cost as number) || 0} onChange={e => updateInjuredPerson(idx, 'medical_cost', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} min={0} />
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>รายละเอียดบาดเจ็บ</label>
                          <textarea value={(person.injury_detail as string) || ''} onChange={e => updateInjuredPerson(idx, 'injury_detail', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', minHeight: 40 }} placeholder="รายละเอียดเพิ่มเติม..." />
                        </div>
                      </div>
                    ))}
                    <button onClick={addInjuredPerson} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-rose-600 hover:bg-rose-50" style={{ border: '1px dashed #fca5a5' }}>
                      <Plus size={14} /> เพิ่มผู้บาดเจ็บ
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-3" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                      style={{ background: saving ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                    >
                      {saving ? 'กำลังบันทึก...' : editingIncident ? 'อัปเดต' : 'บันทึก'}
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="px-6 py-2.5 rounded-xl text-[13px] font-medium"
                      style={{ color: '#6b7280', background: '#f3f4f6' }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
