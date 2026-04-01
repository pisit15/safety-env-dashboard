'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import {
  AlertTriangle, Plus, Search, ChevronLeft, ChevronRight, X,
  Activity, TrendingUp, TrendingDown, Shield, Users, DollarSign, FileText,
  Eye, Edit2, Trash2, BarChart3, List, Clock,
} from 'lucide-react';

// Dropdown options matching the Excel template
const INCIDENT_TYPES = [
  'เสียชีวิต (Fatality)', 'บาดเจ็บ - หยุดงาน > 3 วัน', 'บาดเจ็บ - หยุดงาน ≤ 3 วัน',
  'บาดเจ็บ - ทำงานอย่างจำกัด', 'บาดเจ็บ - ไม่หยุดงาน',
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

  // Dashboard filter state (for interactive clicking)
  const [dashFilter, setDashFilter] = useState<{ month?: string; type?: string }>({});
  const [dashIncidents, setDashIncidents] = useState<Incident[]>([]);

  // Dashboard new filters: work-related and multi-year
  const [workRelatedOnly, setWorkRelatedOnly] = useState(true);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021, 2022, 2023, 2024, 2025, 2026]);
  const [incidentCategory, setIncidentCategory] = useState<'total' | 'injury' | 'property'>('total');

  // Cross-filter for injury charts (click to drill down)
  const [injuryFilter, setInjuryFilter] = useState<{ field: string; value: string } | null>(null);

  // Multi-year TRIR/LTIFR trend — raw data for client-side computation
  const [trendIncidents, setTrendIncidents] = useState<Incident[]>([]);
  const [trendManhours, setTrendManhours] = useState<Record<number, number>>({});

  // Injured persons data for injury-specific charts
  interface InjuredPerson {
    incident_no: string;
    person_type?: string;
    injury_severity?: string;
    nature_of_injury?: string;
    body_part?: string;
    body_side?: string;
    is_lti?: string;
    lost_work_days?: number;
  }
  const [injuredPersonsData, setInjuredPersonsData] = useState<InjuredPerson[]>([]);
  const [injuredIncidentMap, setInjuredIncidentMap] = useState<Record<string, { year: number; work_related: string; incident_type: string }>>({});

  // Fetch summary (handles multi-year for dashboard)
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      // For dashboard view, fetch for all selectedYears and merge
      const yearsToFetch = viewMode === 'dashboard' ? selectedYears : [year];
      const summaries = await Promise.all(
        yearsToFetch.map(y => fetch(`/api/incidents?mode=summary&companyId=${id}&year=${y}`).then(r => r.json()))
      );
      
      if (summaries.length === 0) {
        setSummaryData(null);
      } else if (summaries.length === 1) {
        setSummaryData(summaries[0]);
      } else {
        // Merge multiple years
        const merged: SummaryData = {
          summary: {
            totalIncidents: summaries.reduce((s, d) => s + (d.summary?.totalIncidents || 0), 0),
            totalInjuries: summaries.reduce((s, d) => s + (d.summary?.totalInjuries || 0), 0),
            ltiCases: summaries.reduce((s, d) => s + (d.summary?.ltiCases || 0), 0),
            nearMisses: summaries.reduce((s, d) => s + (d.summary?.nearMisses || 0), 0),
            propertyDamage: summaries.reduce((s, d) => s + (d.summary?.propertyDamage || 0), 0),
            fatalities: summaries.reduce((s, d) => s + (d.summary?.fatalities || 0), 0),
            totalDirectCost: summaries.reduce((s, d) => s + (d.summary?.totalDirectCost || 0), 0),
            totalIndirectCost: summaries.reduce((s, d) => s + (d.summary?.totalIndirectCost || 0), 0),
            employeeInjuries: summaries.reduce((s, d) => s + (d.summary?.employeeInjuries || 0), 0),
            contractorInjuries: summaries.reduce((s, d) => s + (d.summary?.contractorInjuries || 0), 0),
            employeeLti: summaries.reduce((s, d) => s + (d.summary?.employeeLti || 0), 0),
            contractorLti: summaries.reduce((s, d) => s + (d.summary?.contractorLti || 0), 0),
          },
          monthlyData: {} as Record<string, { injuries: number; nearMiss: number; propertyDamage: number; total: number }>,
          severityBreakdown: {} as Record<string, number>,
          typeBreakdown: {} as Record<string, number>,
        };
        
        // Merge monthly data
        summaries.forEach(d => {
          if (d.monthlyData) {
            Object.entries(d.monthlyData).forEach(([month, data]: [string, any]) => {
              if (!merged.monthlyData[month]) merged.monthlyData[month] = { injuries: 0, nearMiss: 0, propertyDamage: 0, total: 0 };
              merged.monthlyData[month].injuries += data.injuries || 0;
              merged.monthlyData[month].nearMiss += data.nearMiss || 0;
              merged.monthlyData[month].propertyDamage += data.propertyDamage || 0;
              merged.monthlyData[month].total += data.total || 0;
            });
          }
          if (d.severityBreakdown) {
            Object.entries(d.severityBreakdown).forEach(([sev, count]: [string, any]) => {
              merged.severityBreakdown[sev] = (merged.severityBreakdown[sev] || 0) + count;
            });
          }
          if (d.typeBreakdown) {
            Object.entries(d.typeBreakdown).forEach(([type, count]: [string, any]) => {
              merged.typeBreakdown[type] = (merged.typeBreakdown[type] || 0) + count;
            });
          }
        });
        
        setSummaryData(merged);
      }
    } catch { /* empty */ }

    // Fetch man-hours (multi-year for dashboard)
    try {
      const yearsToFetch = viewMode === 'dashboard' ? selectedYears : [year];
      const mhDataSets = await Promise.all(
        yearsToFetch.map(y => fetch(`/api/manhours?companyId=${id}&year=${y}`).then(r => r.json()))
      );
      
      const mh = mhDataSets.reduce(
        (acc, mhData) => {
          const rows = mhData.manHours || [];
          return {
            employee: acc.employee + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.employee_manhours) || 0), 0),
            contractor: acc.contractor + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.contractor_manhours) || 0), 0),
            total: acc.total + rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.employee_manhours) || 0) + (Number(r.contractor_manhours) || 0), 0),
          };
        },
        { employee: 0, contractor: 0, total: 0 }
      );
      setManHours(mh);
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year, viewMode, selectedYears]);

  // Fetch list (multi-year support)
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const yearsToFetch = selectedYears.length > 0 ? selectedYears : [year];
      const results = await Promise.all(
        yearsToFetch.map(y => {
          const params = new URLSearchParams({ companyId: id, year: String(y), limit: '1000' });
          if (searchTerm) params.set('search', searchTerm);
          if (filterType) params.set('incidentType', filterType);
          return fetch(`/api/incidents?${params}`).then(r => r.json());
        })
      );
      let allInc: Incident[] = [];
      results.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
      // Apply work-related filter
      if (workRelatedOnly) {
        allInc = allInc.filter(i => i.work_related === 'ใช่');
      }
      // Apply category filter
      if (incidentCategory === 'injury') {
        allInc = allInc.filter(i => ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (i.incident_type || '').includes(p)));
      }
      if (incidentCategory === 'property') {
        allInc = allInc.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
      }
      // Sort by date descending
      allInc.sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || ''));
      setTotal(allInc.length);
      // Client-side pagination
      const start = (page - 1) * 20;
      setIncidents(allInc.slice(start, start + 20));
    } catch { /* empty */ }
    setLoading(false);
  }, [id, year, selectedYears, page, searchTerm, filterType, workRelatedOnly, incidentCategory]);

  useEffect(() => {
    if (viewMode === 'dashboard') fetchSummary();
    else if (viewMode === 'list') fetchList();
  }, [viewMode, fetchSummary, fetchList]);

  // Fetch all incidents for dashboard table (multi-year)
  useEffect(() => {
    if (viewMode === 'dashboard') {
      Promise.all(
        selectedYears.map(y => fetch(`/api/incidents?companyId=${id}&year=${y}&limit=1000`).then(r => r.json()))
      )
        .then(results => {
          const allIncidents = results.flatMap(d => d.incidents || []);
          setDashIncidents(allIncidents);
        })
        .catch(() => setDashIncidents([]));
    }
  }, [viewMode, id, selectedYears]);

  // Fetch multi-year raw data for TRIR/LTIFR trend (incidents + manhours for 6 years)
  useEffect(() => {
    if (viewMode !== 'dashboard') return;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

    // Fetch all incidents for 6 years
    Promise.all(years.map(y => fetch(`/api/incidents?companyId=${id}&year=${y}&limit=1000`).then(r => r.json())))
      .then(results => {
        const allInc: Incident[] = [];
        results.forEach(r => { if (r.incidents) allInc.push(...r.incidents); });
        setTrendIncidents(allInc);
      })
      .catch(() => setTrendIncidents([]));

    // Fetch manhours for 6 years
    Promise.all(years.map(y => fetch(`/api/manhours?companyId=${id}&year=${y}`).then(r => r.json()).then(d => ({
      year: y,
      total: (d.manHours || []).reduce((acc: number, r: Record<string, unknown>) => acc + (Number(r.employee_manhours) || 0) + (Number(r.contractor_manhours) || 0), 0),
    }))))
      .then(results => {
        const mhMap: Record<number, number> = {};
        results.forEach(r => { mhMap[r.year] = r.total; });
        setTrendManhours(mhMap);
      })
      .catch(() => setTrendManhours({}));
  }, [viewMode, id]);

  // Fetch injured persons data when in injury category
  useEffect(() => {
    if (viewMode !== 'dashboard' || incidentCategory !== 'injury' || selectedYears.length === 0) {
      return;
    }
    fetch(`/api/incidents/injured-bulk?company_id=${id}&years=${selectedYears.join(',')}`)
      .then(r => r.json())
      .then(data => {
        setInjuredPersonsData(data.persons || []);
        setInjuredIncidentMap(data.incidentMap || {});
      })
      .catch(() => {
        setInjuredPersonsData([]);
        setInjuredIncidentMap({});
      });
  }, [viewMode, id, incidentCategory, selectedYears]);

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

  // Determine if injury-related sections should be shown based on incident_type
  const NON_INJURY_TYPES = ['ทรัพย์สินเสียหาย', 'เพลิงไหม้ (Fire)', 'สารเคมีรั่วไหล', 'Near Miss', 'สิ่งแวดล้อม'];
  const selectedType = (formData.incident_type as string) || '';
  const showInjurySections = selectedType !== '' && !NON_INJURY_TYPES.includes(selectedType);

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
  const getTypeBadge = (type: string): { bg: string; color: string; border: string } => {
    if (type?.includes('เสียชีวิต')) return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
    if (type?.includes('หยุดงาน')) return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
    if (type?.includes('ทำงานอย่างจำกัด')) return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' };
    if (type?.includes('ไม่หยุดงาน') || type?.includes('ปฐมพยาบาล')) return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd' };
    if (type === 'Near Miss') return { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' };
    if (type === 'ทรัพย์สินเสียหาย') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  };

  // Type color map for stacked chart
  const TYPE_COLORS: Record<string, string> = {
    'ทรัพย์สินเสียหาย': '#3b82f6',
    'บาดเจ็บ - ไม่หยุดงาน': '#f97316',
    'บาดเจ็บ - หยุดงาน ≤ 3 วัน': '#eab308',
    'บาดเจ็บ - หยุดงาน > 3 วัน': '#ef4444',
    'บาดเจ็บ - ทำงานอย่างจำกัด': '#a855f7',
    'Near Miss': '#22c55e',
    'เสียชีวิต (Fatality)': '#991b1b',
    'เพลิงไหม้ (Fire)': '#dc2626',
    'สารเคมีรั่วไหล': '#d946ef',
    'โรคจากการทำงาน': '#64748b',
    'อุบัติเหตุระหว่าง บ้าน-ที่ทำงาน': '#14b8a6',
    'สิ่งแวดล้อม': '#84cc16',
  };
  const getTypeColor = (t: string) => TYPE_COLORS[t] || '#9ca3af';

  // Base incidents filtered by workRelatedOnly (for KPIs, type cards, charts)
  const baseIncidents = workRelatedOnly ? dashIncidents.filter(i => i.work_related === 'ใช่') : dashIncidents;

  const categoryIncidents = baseIncidents.filter(inc => {
    if (incidentCategory === 'injury') {
      return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (inc.incident_type || '').includes(p));
    }
    if (incidentCategory === 'property') {
      return inc.incident_type === 'ทรัพย์สินเสียหาย';
    }
    return true;
  });

  // Compute live stats from baseIncidents (respects workRelatedOnly toggle)
  const liveStats = (() => {
    const INJURY_TYPES_PART = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'];
    const injuryIncidents = categoryIncidents.filter(i => INJURY_TYPES_PART.some(p => (i.incident_type || '').includes(p)));
    const ltiIncidents = categoryIncidents.filter(i => {
      const t = i.incident_type || '';
      return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
    });
    const nearMisses = categoryIncidents.filter(i => i.incident_type === 'Near Miss');
    const propDamage = categoryIncidents.filter(i => i.incident_type === 'ทรัพย์สินเสียหาย');
    const fatalities = categoryIncidents.filter(i => (i.incident_type || '').includes('เสียชีวิต'));
    const directCost = categoryIncidents.reduce((s, i) => s + (Number(i.direct_cost) || 0), 0);
    const indirectCost = categoryIncidents.reduce((s, i) => s + (Number(i.indirect_cost) || 0), 0);

    // Employee vs Contractor breakdown
    const empInj = injuryIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
    const conInj = injuryIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));
    const empLti = ltiIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
    const conLti = ltiIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));

    // Type breakdown
    const typeBreakdown: Record<string, number> = {};
    categoryIncidents.forEach(i => { const t = i.incident_type || 'อื่นๆ'; typeBreakdown[t] = (typeBreakdown[t] || 0) + 1; });

    return {
      totalIncidents: categoryIncidents.length,
      totalInjuries: injuryIncidents.length,
      ltiCases: ltiIncidents.length,
      nearMisses: nearMisses.length,
      propertyDamage: propDamage.length,
      fatalities: fatalities.length,
      totalDirectCost: directCost,
      totalIndirectCost: indirectCost,
      employeeInjuries: empInj.length,
      contractorInjuries: conInj.length,
      employeeLti: empLti.length,
      contractorLti: conLti.length,
      typeBreakdown,
    };
  })();

  // Calculate TIFR/LTIFR — Combined, Employee-only, Contractor-only (uses liveStats for toggle support)
  const tifrCombined = manHours.total > 0 ? (liveStats.totalInjuries / manHours.total) * 1000000 : null;
  const ltifrCombined = manHours.total > 0 ? (liveStats.ltiCases / manHours.total) * 1000000 : null;
  const tifrEmployee = manHours.employee > 0 ? (liveStats.employeeInjuries / manHours.employee) * 1000000 : null;
  const ltifrEmployee = manHours.employee > 0 ? (liveStats.employeeLti / manHours.employee) * 1000000 : null;
  const tifrContractor = manHours.contractor > 0 ? (liveStats.contractorInjuries / manHours.contractor) * 1000000 : null;
  const ltifrContractor = manHours.contractor > 0 ? (liveStats.contractorLti / manHours.contractor) * 1000000 : null;

  // Compute yearlyTrend from raw data — respects workRelatedOnly toggle
  const INJURY_TYPES_PART_TREND = ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'];
  const yearlyTrend = (() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);
    const filtered = workRelatedOnly ? trendIncidents.filter(i => i.work_related === 'ใช่') : trendIncidents;
    
    // Apply category filter to trend data
    const categoryFiltered = filtered.filter(inc => {
      if (incidentCategory === 'injury') {
        return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p => (inc.incident_type || '').includes(p));
      }
      if (incidentCategory === 'property') {
        return inc.incident_type === 'ทรัพย์สินเสียหาย';
      }
      return true;
    });
    
    return years.map(y => {
      const yInc = categoryFiltered.filter(i => i.year === y);
      const injuries = yInc.filter(i => INJURY_TYPES_PART_TREND.some(p => (i.incident_type || '').includes(p))).length;
      const lti = yInc.filter(i => {
        const t = i.incident_type || '';
        return (t.includes('หยุดงาน') && !t.includes('ไม่หยุดงาน')) || t === 'เสียชีวิต (Fatality)';
      }).length;
      const mh = trendManhours[y] || 0;
      return {
        year: y,
        trir: mh > 0 ? (injuries / mh) * 1000000 : 0,
        ltifr: mh > 0 ? (lti / mh) * 1000000 : 0,
      };
    });
  })();

  // Filtered dashboard incidents based on dashFilter
  const filteredDashIncidents = categoryIncidents.filter(inc => {
    if (dashFilter.month) {
      const incMonth = inc.month;
      const monthNum = parseInt(String(incMonth));
      const normalizedMonth = (monthNum >= 1 && monthNum <= 12) ? MONTHS[monthNum - 1] : String(incMonth);
      if (normalizedMonth !== dashFilter.month) return false;
    }
    if (dashFilter.type) {
      if (inc.incident_type !== dashFilter.type) return false;
    }
    return true;
  });

  // Compute monthly stacked data from baseIncidents (respects work-related filter)
  const monthlyStacked: Record<string, Record<string, number>> = {};
  MONTHS.forEach(m => { monthlyStacked[m] = {}; });
  categoryIncidents.forEach(inc => {
    const raw = inc.month;
    const num = parseInt(String(raw));
    const m = (num >= 1 && num <= 12) ? MONTHS[num - 1] : String(raw);
    if (m && monthlyStacked[m] !== undefined) {
      const t = inc.incident_type || 'อื่นๆ';
      monthlyStacked[m][t] = (monthlyStacked[m][t] || 0) + 1;
    }
  });
  const allTypes = Array.from(new Set(dashIncidents.map(i => i.incident_type || 'อื่นๆ')));
  const maxStackedMonthly = Math.max(...MONTHS.map(m => Object.values(monthlyStacked[m]).reduce((s, v) => s + v, 0)), 1);

  // Max bar value for chart
  const maxMonthly = summaryData ? Math.max(...Object.values(summaryData.monthlyData).map(m => m.total), 1) : 1;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-8 pt-6 pb-3" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                สถิติอุบัติเหตุ — {companyName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
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

          {/* Dashboard Filter Bar — Year Checkboxes & Work-Related Toggle */}
          {viewMode === 'dashboard' && (
            <div className="flex items-center gap-5 flex-wrap">
              {/* Year Checkboxes */}
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>ปี:</span>
                {[2021, 2022, 2023, 2024, 2025, 2026].map(yr => (
                  <label key={yr} className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(yr)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedYears([...selectedYears, yr].sort());
                        } else {
                          const next = selectedYears.filter(y => y !== yr);
                          if (next.length > 0) setSelectedYears(next);
                        }
                      }}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-[12px]" style={{ color: selectedYears.includes(yr) ? 'var(--text-primary)' : 'var(--muted)' }}>{yr}</span>
                  </label>
                ))}
              </div>

              {/* Separator */}
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

              {/* Work-Related Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWorkRelatedOnly(!workRelatedOnly)}
                  className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                  style={{
                    background: workRelatedOnly ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                    style={{
                      transform: workRelatedOnly ? 'translateX(17px)' : 'translateX(2px)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
                <span className="text-[12px]" style={{ color: workRelatedOnly ? 'var(--accent)' : 'var(--muted)' }}>
                  เฉพาะจากการทำงาน
                </span>
              </div>

              {/* Active filter indicator */}
              {(dashFilter.month || dashFilter.type) && (
                <>
                  <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>กรอง:</span>
                    {dashFilter.month && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
                        {MONTH_TH[dashFilter.month] || dashFilter.month}
                        <button onClick={() => setDashFilter(f => ({ ...f, month: undefined }))} className="ml-1 opacity-70 hover:opacity-100">×</button>
                      </span>
                    )}
                    {dashFilter.type && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: getTypeColor(dashFilter.type), color: '#fff' }}>
                        {dashFilter.type}
                        <button onClick={() => setDashFilter(f => ({ ...f, type: undefined }))} className="ml-1 opacity-70 hover:opacity-100">×</button>
                      </span>
                    )}
                    <button
                      onClick={() => setDashFilter({})}
                      className="text-[11px] underline"
                      style={{ color: 'var(--muted)' }}
                    >ล้างทั้งหมด</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* List view filter bar — same as dashboard */}
          {viewMode === 'list' && (
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>ปี:</span>
                {[2021, 2022, 2023, 2024, 2025, 2026].map(yr => (
                  <label key={yr} className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(yr)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedYears([...selectedYears, yr].sort());
                        } else {
                          const next = selectedYears.filter(y => y !== yr);
                          if (next.length > 0) setSelectedYears(next);
                        }
                        setPage(1);
                      }}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-[12px]" style={{ color: selectedYears.includes(yr) ? 'var(--text-primary)' : 'var(--muted)' }}>{yr}</span>
                  </label>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setWorkRelatedOnly(!workRelatedOnly); setPage(1); }}
                  className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                  style={{ background: workRelatedOnly ? 'var(--accent)' : 'var(--border)' }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                    style={{ transform: workRelatedOnly ? 'translateX(17px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                  />
                </button>
                <span className="text-[12px]" style={{ color: workRelatedOnly ? 'var(--accent)' : 'var(--muted)' }}>เฉพาะจากการทำงาน</span>
              </div>
            </div>
          )}

          {/* Incident Category Segmented Control */}
          {(viewMode === 'dashboard' || viewMode === 'list') && (
            <div className="flex items-center gap-1 mt-2 p-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {[
                { key: 'total' as const, label: 'ทั้งหมด' },
                { key: 'injury' as const, label: 'อุบัติเหตุบาดเจ็บ' },
                { key: 'property' as const, label: 'ทรัพย์สินเสียหาย' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setIncidentCategory(tab.key); setPage(1); setInjuryFilter(null); }}
                  className="px-4 py-1.5 rounded-md text-[12px] font-medium transition-all"
                  style={{
                    background: incidentCategory === tab.key ? 'var(--accent)' : 'transparent',
                    color: incidentCategory === tab.key ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Incident', value: liveStats.totalIncidents, icon: AlertTriangle, color: '#6366f1' },
                  { label: 'TRC Cases', value: liveStats.totalInjuries, icon: Activity, color: '#f97316' },
                  { label: 'LTI Cases', value: liveStats.ltiCases, icon: Clock, color: '#ef4444' },
                  { label: 'Total Manhour', value: manHours.total, icon: Users, color: '#3b82f6' },
                ].map((kpi, idx) => (
                  <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                        <kpi.icon size={16} style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: kpi.color }}>{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* TIFR / LTIFR — 3-way split + Cost (only for total tab) */}
              {incidentCategory === 'total' && (<>
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
                        Man-hours: {manHours.employee > 0 ? manHours.employee.toLocaleString() : '-'} | Injuries: {liveStats.employeeInjuries} | LTI: {liveStats.employeeLti}
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
                        Man-hours: {manHours.contractor > 0 ? manHours.contractor.toLocaleString() : '-'} | Injuries: {liveStats.contractorInjuries} | LTI: {liveStats.contractorLti}
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
                        Man-hours: {manHours.total > 0 ? manHours.total.toLocaleString() : '-'} | Injuries: {liveStats.totalInjuries} | LTI: {liveStats.ltiCases}
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
                      {(liveStats.totalDirectCost + liveStats.totalIndirectCost).toLocaleString()} ฿
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายตรง</p>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{liveStats.totalDirectCost.toLocaleString()} ฿</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายอ้อม</p>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{liveStats.totalIndirectCost.toLocaleString()} ฿</p>
                    </div>
                  </div>
                </div>
              </div>
              </>)}

              {/* YTD TRIR / LTIFR Trend Charts (only for total tab) */}
              {incidentCategory === 'total' && yearlyTrend.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'YTD TRIR', key: 'trir' as const, color: '#3b82f6' },
                  { label: 'YTD LTIFR', key: 'ltifr' as const, color: '#3b82f6' },
                ].map(chart => {
                  const values = yearlyTrend.map(d => d[chart.key]);
                  const maxVal = Math.max(...values, 1);
                  const chartW = 400;
                  const chartH = 150;
                  const padX = 30;
                  const padY = 25;
                  const padBottom = 25;
                  const plotW = chartW - padX * 2;
                  const plotH = chartH - padY - padBottom;
                  const points = yearlyTrend.map((d, i) => ({
                    x: padX + (i / Math.max(yearlyTrend.length - 1, 1)) * plotW,
                    y: padY + plotH - (d[chart.key] / maxVal) * plotH,
                    val: d[chart.key],
                    year: d.year,
                  }));
                  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                  const areaPath = linePath + ` L${points[points.length - 1].x},${padY + plotH} L${points[0].x},${padY + plotH} Z`;

                  return (
                    <div key={chart.key} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-[2px]" style={{ background: chart.color }} />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{chart.label}</span>
                      </div>
                      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: 160 }}>
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                          const gy = padY + plotH - pct * plotH;
                          return <line key={pct} x1={padX} y1={gy} x2={chartW - padX} y2={gy} stroke="var(--border)" strokeWidth="0.5" />;
                        })}
                        {/* Y axis labels */}
                        {[0, 0.5, 1].map(pct => {
                          const gy = padY + plotH - pct * plotH;
                          return <text key={pct} x={padX - 4} y={gy + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{(maxVal * pct).toFixed(0)}</text>;
                        })}
                        {/* Area fill */}
                        <path d={areaPath} fill={chart.color} fillOpacity="0.08" />
                        {/* Line */}
                        <path d={linePath} fill="none" stroke={chart.color} strokeWidth="2" />
                        {/* Points and labels */}
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={chart.color} strokeWidth="2" />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill={chart.color}>
                              {p.val > 0 ? p.val.toFixed(2) : '0'}
                            </text>
                            <text x={p.x} y={chartH - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.year}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Incident Type Breakdown Cards — fixed order matching reference */}
              <div className="mb-6">
                <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
                  {[
                    { type: 'Near Miss', bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
                    { type: 'อุบัติเหตุระหว่าง บ้าน-ที่ทำงาน', bg: '#ccfbf1', border: '#5eead4', text: '#115e59' },
                    { type: 'ทรัพย์สินเสียหาย', bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
                    { type: 'บาดเจ็บ - ไม่หยุดงาน', bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
                    { type: 'บาดเจ็บ - ทำงานอย่างจำกัด', bg: '#fed7aa', border: '#fdba74', text: '#9a3412' },
                    { type: 'บาดเจ็บ - หยุดงาน ≤ 3 วัน', bg: '#fed7aa', border: '#fb923c', text: '#9a3412' },
                    { type: 'บาดเจ็บ - หยุดงาน > 3 วัน', bg: '#fecaca', border: '#f87171', text: '#991b1b' },
                    { type: 'เสียชีวิต (Fatality)', bg: '#fecaca', border: '#ef4444', text: '#7f1d1d' },
                    { type: 'เพลิงไหม้ (Fire)', bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
                    { type: 'สารเคมีรั่วไหล', bg: '#f3e8ff', border: '#c4b5fd', text: '#6b21a8' },
                    { type: 'โรคจากการทำงาน', bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
                    { type: 'สิ่งแวดล้อม', bg: '#ecfccb', border: '#bef264', text: '#3f6212' },
                  ].map(({ type, bg, border, text }) => {
                    const count = liveStats.typeBreakdown[type] || 0;
                    const isActive = dashFilter.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setDashFilter({ ...dashFilter, type: isActive ? undefined : type })}
                        className="rounded-lg px-3 py-3 transition-all cursor-pointer text-center"
                        style={{
                          background: isActive ? text : bg,
                          border: `2px solid ${isActive ? text : border}`,
                          color: isActive ? '#fff' : text,
                          opacity: isActive ? 1 : (count === 0 ? 0.5 : 1),
                        }}
                      >
                        <div className="text-[11px] font-semibold whitespace-nowrap">{type}</div>
                        <div className="text-2xl font-bold mt-1">{count}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Filter Indicator */}
              {(dashFilter.month || dashFilter.type) && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: '#166534' }}>
                      Active Filter: {dashFilter.month && `Month: ${dashFilter.month}`} {dashFilter.type && `Type: ${dashFilter.type}`}
                    </span>
                    <button
                      onClick={() => setDashFilter({})}
                      className="text-[12px] font-semibold px-2 py-1 rounded hover:bg-white transition-colors"
                      style={{ color: '#166534' }}
                    >
                      Clear Filter
                    </button>
                  </div>
                </div>
              )}

              {/* Monthly Stacked Bar Chart (hidden for injury tab) */}
              {incidentCategory !== 'injury' && (
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  อุบัติการณ์รายเดือน — {selectedYears.length === 1 ? selectedYears[0] : selectedYears.join(', ')}
                </h3>
                <div className="flex items-end gap-2" style={{ height: 280 }}>
                  {MONTHS.map(m => {
                    const monthData = monthlyStacked[m] || {};
                    const monthTotal = Object.values(monthData).reduce((s, v) => s + v, 0);
                    const barHeight = monthTotal > 0 ? (monthTotal / maxStackedMonthly) * 240 : 0;
                    
                    return (
                      <div key={m} className="flex-1 flex flex-col items-center">
                        {monthTotal > 0 && (
                          <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{monthTotal}</span>
                        )}
                        <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: Math.max(barHeight, 4) }}>
                          {allTypes.map((type) => {
                            const count = monthData[type] || 0;
                            if (count <= 0) return null;
                            const segPct = monthTotal > 0 ? (count / monthTotal) * 100 : 0;
                            const segH = (count / monthTotal) * barHeight;
                            return (
                              <div
                                key={`${m}-${type}`}
                                onClick={() => setDashFilter({ month: m, type })}
                                className="cursor-pointer hover:opacity-80 transition-opacity relative flex items-center justify-center"
                                style={{
                                  height: `${segPct}%`,
                                  background: getTypeColor(type),
                                  minHeight: 3,
                                }}
                              >
                                {segH >= 14 && (
                                  <span className="text-[9px] font-medium leading-none" style={{ color: 'rgba(255,255,255,0.55)' }}>{count}</span>
                                )}
                              </div>
                            );
                          })}
                          {monthTotal === 0 && <div style={{ height: 4, background: 'var(--border)' }} />}
                        </div>
                        <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{MONTH_TH[m]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-4 justify-start flex-wrap">
                  {allTypes.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: getTypeColor(t) }} />
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Incident List Table (hidden for injury tab) */}
              {incidentCategory !== 'injury' && (
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  รายการอุบัติการณ์ {filteredDashIncidents.length > 0 ? `(${filteredDashIncidents.length})` : ''}
                </h3>
                {filteredDashIncidents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="text-left py-2 px-3" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>วันที่</th>
                          <th className="text-left py-2 px-3" style={{ color: 'var(--muted)' }}>รายละเอียด</th>
                          <th className="text-left py-2 px-3" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>ประเภท</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDashIncidents.slice(0, 20).map((inc) => {
                          const badge = getTypeBadge(inc.incident_type);
                          return (
                            <tr key={inc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="py-2 px-3" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{inc.incident_date}</td>
                              <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>{String(inc.description || inc.incident_detail || '-')}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap" style={{ background: badge.bg, color: badge.color }}>
                                  {inc.incident_type}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-center" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลอุบัติการณ์</p>
                )}
              </div>
              )}

              {/* ===== Monthly Trend Comparison + Cumulative Charts (only for total tab) ===== */}
              {incidentCategory === 'total' && (() => {
                const YEAR_COLORS: Record<number, string> = {
                  2021: '#94a3b8', 2022: '#64748b', 2023: '#8b5cf6',
                  2024: '#3b82f6', 2025: '#f97316', 2026: '#ef4444',
                };
                const yearMonthCounts: Record<number, number[]> = {};
                selectedYears.forEach(y => { yearMonthCounts[y] = Array(12).fill(0); });
                baseIncidents.forEach(inc => {
                  const y = inc.year;
                  if (!yearMonthCounts[y]) return;
                  const num = parseInt(String(inc.month));
                  const mi = (num >= 1 && num <= 12) ? num - 1 : MONTHS.indexOf(String(inc.month));
                  if (mi >= 0 && mi < 12) yearMonthCounts[y][mi]++;
                });

                const activeYears = selectedYears.filter(y => yearMonthCounts[y]?.some(v => v > 0));
                if (activeYears.length === 0) return null;

                const yearCumulative: Record<number, number[]> = {};
                selectedYears.forEach(y => {
                  yearCumulative[y] = [];
                  let sum = 0;
                  yearMonthCounts[y].forEach(v => { sum += v; yearCumulative[y].push(sum); });
                });

                const maxTrend = Math.max(...selectedYears.flatMap(y => yearMonthCounts[y]), 1);
                const maxCum = Math.max(...selectedYears.flatMap(y => yearCumulative[y]), 1);

                const chartW = 700, chartH = 260;
                const padL = 45, padR = 20, padT = 20, padB = 35;
                const plotW = chartW - padL - padR;
                const plotH = chartH - padT - padB;

                const renderChart = (title: string, getData: (y: number) => number[], maxVal: number) => {
                  const gridCount = 5;
                  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
                    const val = Math.round((maxVal / gridCount) * i);
                    const yPos = padT + plotH - (val / maxVal) * plotH;
                    return { val, y: yPos };
                  });

                  return (
                    <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                      <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxHeight: 300 }}>
                        {gridLines.map(g => (
                          <g key={g.val}>
                            <line x1={padL} y1={g.y} x2={chartW - padR} y2={g.y} stroke="var(--border)" strokeWidth={0.5} />
                            <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize={9} fill="var(--muted)">{g.val}</text>
                          </g>
                        ))}
                        {MONTHS.map((m, i) => {
                          const x = padL + (i / 11) * plotW;
                          return (
                            <text key={m} x={x} y={chartH - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
                              {MONTH_TH[m]}
                            </text>
                          );
                        })}
                        {selectedYears.map(y => {
                          const data = getData(y);
                          const points = data.map((v, i) => ({
                            x: padL + (i / 11) * plotW,
                            y: padT + plotH - (v / maxVal) * plotH,
                          }));
                          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                          const color = YEAR_COLORS[y] || '#9ca3af';
                          const hasData = data.some(v => v > 0);
                          if (!hasData) return null;
                          return (
                            <g key={y}>
                              <path
                                d={`${pathD} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`}
                                fill={color} opacity={0.06}
                              />
                              <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
                                  {data[i] > 0 && (
                                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={color}>
                                      {data[i]}
                                    </text>
                                  )}
                                </g>
                              ))}
                            </g>
                          );
                        })}
                      </svg>
                      <div className="flex gap-4 mt-3 justify-center flex-wrap">
                        {selectedYears.map(y => {
                          const color = YEAR_COLORS[y] || '#9ca3af';
                          const hasData = getData(y).some(v => v > 0);
                          return (
                            <div key={y} className="flex items-center gap-1.5" style={{ opacity: hasData ? 1 : 0.3 }}>
                              <div className="w-4 h-[3px] rounded-full" style={{ background: color }} />
                              <span className="text-[11px] font-medium" style={{ color }}>{y}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderChart(
                      'แนวโน้มอุบัติการณ์รายเดือน — เปรียบเทียบรายปี',
                      (y) => yearMonthCounts[y] || Array(12).fill(0),
                      maxTrend
                    )}
                    {renderChart(
                      'อุบัติการณ์สะสมรายเดือน — เปรียบเทียบรายปี',
                      (y) => yearCumulative[y] || Array(12).fill(0),
                      maxCum
                    )}
                  </>
                );
              })()}

              {/* ===================== INJURY-SPECIFIC CHARTS (only when injury tab) ===================== */}
              {incidentCategory === 'injury' && (() => {
                // Base filter: workRelatedOnly + selected years + injury type
                const allFilteredPersons = injuredPersonsData.filter(p => {
                  const incInfo = injuredIncidentMap[p.incident_no];
                  if (!incInfo) return false;
                  if (!selectedYears.includes(incInfo.year)) return false;
                  if (workRelatedOnly && incInfo.work_related !== 'ใช่') return false;
                  const t = incInfo.incident_type || '';
                  return ['บาดเจ็บ', 'เสียชีวิต', 'โรคจากการทำงาน'].some(p2 => t.includes(p2));
                });

                // Apply cross-filter
                const filteredPersons = injuryFilter
                  ? allFilteredPersons.filter(p => {
                      if (injuryFilter.field === 'is_lti') {
                        const isLti = p.is_lti === 'ใช่';
                        return injuryFilter.value === 'หยุดงาน (LTI)' ? isLti : !isLti;
                      }
                      return (p[injuryFilter.field as keyof InjuredPerson] as string || 'ไม่ระบุ') === injuryFilter.value;
                    })
                  : allFilteredPersons;

                const YEAR_COLORS_INJ: Record<number, string> = {
                  2021: '#94a3b8', 2022: '#64748b', 2023: '#8b5cf6',
                  2024: '#3b82f6', 2025: '#f97316', 2026: '#ef4444',
                };
                const activeYears = selectedYears.filter(y =>
                  allFilteredPersons.some(p => injuredIncidentMap[p.incident_no]?.year === y)
                ).sort();

                // Field labels for display
                const FIELD_LABELS: Record<string, string> = {
                  is_lti: 'หยุดงานหรือไม่',
                  injury_severity: 'ระดับการบาดเจ็บ',
                  nature_of_injury: 'ลักษณะการบาดเจ็บ',
                  body_part: 'ส่วนร่างกาย',
                };

                // Helper: group persons by a field per year
                const groupByFieldPerYear = (persons: InjuredPerson[], field: keyof InjuredPerson, labels?: string[]) => {
                  const counts: Record<string, Record<number, number>> = {};
                  persons.forEach(p => {
                    const val = (p[field] as string) || 'ไม่ระบุ';
                    const yr = injuredIncidentMap[p.incident_no]?.year;
                    if (!yr) return;
                    if (!counts[val]) counts[val] = {};
                    counts[val][yr] = (counts[val][yr] || 0) + 1;
                  });
                  let keys = Object.keys(counts);
                  if (labels) {
                    keys = labels.filter(l => counts[l]);
                    Object.keys(counts).forEach(k => { if (!keys.includes(k)) keys.push(k); });
                  } else {
                    keys.sort((a, b) => {
                      const totA = Object.values(counts[a]).reduce((s, v) => s + v, 0);
                      const totB = Object.values(counts[b]).reduce((s, v) => s + v, 0);
                      return totB - totA;
                    });
                  }
                  keys = keys.slice(0, 12);
                  return { keys, counts };
                };

                // ---- Clickable stacked horizontal bar chart ----
                const renderStackedBarChart = (
                  title: string,
                  chartField: string,
                  data: { keys: string[]; counts: Record<string, Record<number, number>> },
                ) => {
                  const { keys, counts } = data;
                  if (keys.length === 0) return null;
                  const maxTotal = Math.max(...keys.map(k => activeYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0)), 1);
                  const isThisChartFiltered = injuryFilter?.field === chartField;

                  return (
                    <div className="rounded-2xl p-5" style={{
                      background: 'var(--card-solid)',
                      border: isThisChartFiltered ? '2px solid var(--accent)' : '1px solid var(--border)',
                    }}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                        {isThisChartFiltered && (
                          <button
                            onClick={() => setInjuryFilter(null)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                          >
                            {injuryFilter?.value} <X size={10} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {keys.map(k => {
                          const total = activeYears.reduce((s, y) => s + (counts[k]?.[y] || 0), 0);
                          const barPct = (total / maxTotal) * 100;
                          const isActive = isThisChartFiltered && injuryFilter?.value === k;
                          const isDimmed = isThisChartFiltered && !isActive;

                          return (
                            <div
                              key={k}
                              className="flex items-center gap-3 rounded-lg px-2 py-1 transition-all"
                              style={{
                                cursor: 'pointer',
                                opacity: isDimmed ? 0.3 : 1,
                                background: isActive ? 'var(--bg-secondary)' : 'transparent',
                              }}
                              onClick={() => {
                                if (isActive) {
                                  setInjuryFilter(null);
                                } else {
                                  setInjuryFilter({ field: chartField, value: k });
                                }
                              }}
                            >
                              <span className="text-[11px] font-medium shrink-0 text-right" style={{ color: 'var(--text-primary)', width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k}>{k}</span>
                              <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1 relative rounded-md overflow-hidden" style={{ height: 22, background: 'var(--bg-secondary)' }}>
                                  <div className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden" style={{ width: `${Math.max(barPct, total > 0 ? 3 : 0)}%` }}>
                                    {activeYears.map(y => {
                                      const val = counts[k]?.[y] || 0;
                                      if (val === 0) return null;
                                      const segPct = (val / total) * 100;
                                      return (
                                        <div key={y} className="h-full flex items-center justify-center" style={{ width: `${segPct}%`, background: YEAR_COLORS_INJ[y] || '#9ca3af', minWidth: val > 0 ? 14 : 0 }} title={`${y}: ${val}`}>
                                          {segPct > 20 && <span className="text-[9px] font-bold text-white/80">{val}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--text-primary)', width: 26, textAlign: 'right' }}>{total}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                // ---- Data computations (use filteredPersons for all charts EXCEPT the source chart) ----
                // For the chart that IS the filter source, show allFilteredPersons so user sees full options
                const personsFor = (chartField: string) =>
                  injuryFilter && injuryFilter.field !== chartField ? filteredPersons : allFilteredPersons;

                // Chart 1: LTI vs non-LTI
                const ltiData = (() => {
                  const src = personsFor('is_lti');
                  const counts: Record<string, Record<number, number>> = { 'หยุดงาน (LTI)': {}, 'ไม่หยุดงาน': {} };
                  src.forEach(p => {
                    const yr = injuredIncidentMap[p.incident_no]?.year;
                    if (!yr) return;
                    const key = p.is_lti === 'ใช่' ? 'หยุดงาน (LTI)' : 'ไม่หยุดงาน';
                    counts[key][yr] = (counts[key][yr] || 0) + 1;
                  });
                  return { keys: ['หยุดงาน (LTI)', 'ไม่หยุดงาน'], counts };
                })();

                // Chart 2: Lost work days per year
                const lostDaysData: Record<number, number> = {};
                filteredPersons.forEach(p => {
                  const yr = injuredIncidentMap[p.incident_no]?.year;
                  if (!yr) return;
                  lostDaysData[yr] = (lostDaysData[yr] || 0) + (Number(p.lost_work_days) || 0);
                });
                const maxLostDays = Math.max(...activeYears.map(y => lostDaysData[y] || 0), 1);
                const totalLostDays = activeYears.reduce((s, y) => s + (lostDaysData[y] || 0), 0);

                // Chart 3-5
                const severityData = groupByFieldPerYear(personsFor('injury_severity'), 'injury_severity', INJ_SEVERITIES);
                const natureData = groupByFieldPerYear(personsFor('nature_of_injury'), 'nature_of_injury');
                const bodyPartData = groupByFieldPerYear(personsFor('body_part'), 'body_part');

                return (
                  <div className="mt-2">
                    {allFilteredPersons.length === 0 ? (
                      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลผู้บาดเจ็บ สำหรับปีที่เลือก</p>
                      </div>
                    ) : (
                      <>
                        {/* Top bar: Legend + Filter indicator */}
                        <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
                          {activeYears.map(y => (
                            <div key={y} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded" style={{ background: YEAR_COLORS_INJ[y] || '#9ca3af' }} />
                              <span className="text-[11px] font-semibold" style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}>{y}</span>
                            </div>
                          ))}
                          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                            | แสดง {filteredPersons.length} จาก {allFilteredPersons.length} คน
                          </span>
                          {injuryFilter && (
                            <button
                              onClick={() => setInjuryFilter(null)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all hover:shadow-md"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              {FIELD_LABELS[injuryFilter.field] || injuryFilter.field}: {injuryFilter.value}
                              <X size={12} />
                            </button>
                          )}
                          {!injuryFilter && (
                            <span className="text-[10px] italic" style={{ color: 'var(--muted)' }}>
                              คลิกที่แท่งกราฟเพื่อกรองข้อมูล
                            </span>
                          )}
                        </div>

                        {/* Row 1: LTI + Lost days */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                          {renderStackedBarChart('หยุดงานหรือไม่', 'is_lti', ltiData)}

                          {/* Chart 2: Lost work days — vertical bar */}
                          <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>จำนวนวันหยุดงาน</h3>
                              <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                รวม {totalLostDays.toLocaleString()} วัน
                              </span>
                            </div>
                            <div className="flex items-end gap-4 justify-center" style={{ height: 170 }}>
                              {activeYears.map(y => {
                                const val = lostDaysData[y] || 0;
                                const pct = maxLostDays > 0 ? (val / maxLostDays) * 100 : 0;
                                return (
                                  <div key={y} className="flex flex-col items-center" style={{ flex: 1, maxWidth: 72 }}>
                                    <span className="text-[14px] font-bold mb-1" style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}>{val}</span>
                                    <div className="w-full rounded-t-lg" style={{
                                      height: `${Math.max(pct * 1.3, val > 0 ? 6 : 2)}px`,
                                      background: YEAR_COLORS_INJ[y] || '#9ca3af',
                                      maxHeight: 130,
                                      opacity: val > 0 ? 1 : 0.15,
                                    }} />
                                    <span className="text-[12px] font-bold mt-2" style={{ color: YEAR_COLORS_INJ[y] || '#9ca3af' }}>{y}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Chart 3: Injury severity */}
                        <div className="mb-5">
                          {renderStackedBarChart('ระดับการบาดเจ็บ', 'injury_severity', severityData)}
                        </div>

                        {/* Row 2: Nature + Body part */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {renderStackedBarChart('ลักษณะการบาดเจ็บ', 'nature_of_injury', natureData)}
                          {renderStackedBarChart('ส่วนร่างกายที่ได้รับบาดเจ็บ', 'body_part', bodyPartData)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ===================== PROPERTY DAMAGE CHARTS (only when property tab) ===================== */}
              {incidentCategory === 'property' && (() => {
                const YEAR_COLORS_PROP: Record<number, string> = {
                  2021: '#94a3b8', 2022: '#64748b', 2023: '#8b5cf6',
                  2024: '#3b82f6', 2025: '#f97316', 2026: '#ef4444',
                };
                const propActiveYears = selectedYears.filter(y =>
                  categoryIncidents.some(i => i.year === y)
                ).sort();

                // ---- Chart 1: Property damage type per year ----
                const dmgTypeCounts: Record<string, Record<number, number>> = {};
                categoryIncidents.forEach(inc => {
                  const t = (inc as Record<string, unknown>).property_damage_type as string || 'ไม่ระบุ';
                  const yr = inc.year;
                  if (!dmgTypeCounts[t]) dmgTypeCounts[t] = {};
                  dmgTypeCounts[t][yr] = (dmgTypeCounts[t][yr] || 0) + 1;
                });
                let dmgTypeKeys = Object.keys(dmgTypeCounts);
                dmgTypeKeys.sort((a, b) => {
                  const totA = Object.values(dmgTypeCounts[a]).reduce((s, v) => s + v, 0);
                  const totB = Object.values(dmgTypeCounts[b]).reduce((s, v) => s + v, 0);
                  return totB - totA;
                });
                dmgTypeKeys = dmgTypeKeys.slice(0, 12);

                // ---- Chart 2: Cost per year (direct + indirect) ----
                const costPerYear: Record<number, { direct: number; indirect: number }> = {};
                categoryIncidents.forEach(inc => {
                  const yr = inc.year;
                  if (!costPerYear[yr]) costPerYear[yr] = { direct: 0, indirect: 0 };
                  costPerYear[yr].direct += Number(inc.direct_cost) || 0;
                  costPerYear[yr].indirect += Number(inc.indirect_cost) || 0;
                });
                const maxCostYear = Math.max(
                  ...propActiveYears.map(y => (costPerYear[y]?.direct || 0) + (costPerYear[y]?.indirect || 0)),
                  1
                );
                const totalCost = propActiveYears.reduce((s, y) => s + (costPerYear[y]?.direct || 0) + (costPerYear[y]?.indirect || 0), 0);

                // ---- Chart 3: Incident count per year ----
                const countPerYear: Record<number, number> = {};
                categoryIncidents.forEach(inc => {
                  countPerYear[inc.year] = (countPerYear[inc.year] || 0) + 1;
                });
                const maxCountYear = Math.max(...propActiveYears.map(y => countPerYear[y] || 0), 1);

                // Stacked bar renderer for damage type
                const maxDmgTotal = Math.max(...dmgTypeKeys.map(k => propActiveYears.reduce((s, y) => s + (dmgTypeCounts[k]?.[y] || 0), 0)), 1);

                return (
                  <div className="mt-2">
                    {categoryIncidents.length === 0 ? (
                      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลทรัพย์สินเสียหาย สำหรับปีที่เลือก</p>
                      </div>
                    ) : (
                      <>
                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
                          {propActiveYears.map(y => (
                            <div key={y} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded" style={{ background: YEAR_COLORS_PROP[y] || '#9ca3af' }} />
                              <span className="text-[11px] font-semibold" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>{y}</span>
                            </div>
                          ))}
                          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                            | ทรัพย์สินเสียหายทั้งหมด {categoryIncidents.length} ครั้ง
                          </span>
                        </div>

                        {/* Row 1: Count per year + Cost per year */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                          {/* Incident count per year */}
                          <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                            <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>จำนวนครั้ง — เปรียบเทียบรายปี</h3>
                            <div className="flex items-end gap-4 justify-center" style={{ height: 170 }}>
                              {propActiveYears.map(y => {
                                const val = countPerYear[y] || 0;
                                const pct = (val / maxCountYear) * 100;
                                return (
                                  <div key={y} className="flex flex-col items-center" style={{ flex: 1, maxWidth: 72 }}>
                                    <span className="text-[16px] font-bold mb-1" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>{val}</span>
                                    <div className="w-full rounded-t-lg" style={{
                                      height: `${Math.max(pct * 1.3, val > 0 ? 6 : 2)}px`,
                                      background: YEAR_COLORS_PROP[y] || '#9ca3af',
                                      maxHeight: 130,
                                      opacity: val > 0 ? 1 : 0.15,
                                    }} />
                                    <span className="text-[12px] font-bold mt-2" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>{y}</span>
                                    <span className="text-[9px]" style={{ color: 'var(--muted)' }}>ครั้ง</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Cost per year (stacked direct + indirect) */}
                          <div className="rounded-2xl p-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>มูลค่าความเสียหาย</h3>
                              <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                รวม {totalCost.toLocaleString()} ฿
                              </span>
                            </div>
                            <div className="flex items-end gap-4 justify-center" style={{ height: 170 }}>
                              {propActiveYears.map(y => {
                                const d = costPerYear[y]?.direct || 0;
                                const ind = costPerYear[y]?.indirect || 0;
                                const total = d + ind;
                                const pct = (total / maxCostYear) * 100;
                                const dPct = total > 0 ? (d / total) * 100 : 0;
                                return (
                                  <div key={y} className="flex flex-col items-center" style={{ flex: 1, maxWidth: 72 }}>
                                    <span className="text-[11px] font-bold mb-1" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>
                                      {total >= 1000 ? `${(total / 1000).toFixed(0)}K` : total.toLocaleString()}
                                    </span>
                                    <div className="w-full rounded-t-lg overflow-hidden flex flex-col-reverse" style={{
                                      height: `${Math.max(pct * 1.3, total > 0 ? 6 : 2)}px`,
                                      maxHeight: 130,
                                      opacity: total > 0 ? 1 : 0.15,
                                    }}>
                                      {/* Direct cost (bottom, darker) */}
                                      <div style={{ height: `${dPct}%`, background: YEAR_COLORS_PROP[y] || '#9ca3af' }} />
                                      {/* Indirect cost (top, lighter) */}
                                      <div style={{ height: `${100 - dPct}%`, background: YEAR_COLORS_PROP[y] || '#9ca3af', opacity: 0.4 }} />
                                    </div>
                                    <span className="text-[12px] font-bold mt-2" style={{ color: YEAR_COLORS_PROP[y] || '#9ca3af' }}>{y}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-center gap-4 mt-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded" style={{ background: '#3b82f6' }} />
                                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายตรง</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded" style={{ background: '#3b82f6', opacity: 0.4 }} />
                                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>ค่าเสียหายอ้อม</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chart: Property damage type (stacked horizontal bar) */}
                        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card-solid)', border: '1px solid var(--border)' }}>
                          <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>ประเภททรัพย์สินเสียหาย</h3>
                          {dmgTypeKeys.length === 0 ? (
                            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--muted)' }}>ไม่มีข้อมูลประเภททรัพย์สิน</p>
                          ) : (
                            <div className="space-y-2">
                              {dmgTypeKeys.map(k => {
                                const total = propActiveYears.reduce((s, y) => s + (dmgTypeCounts[k]?.[y] || 0), 0);
                                const barPct = (total / maxDmgTotal) * 100;
                                return (
                                  <div key={k} className="flex items-center gap-3">
                                    <span className="text-[11px] font-medium shrink-0 text-right" style={{ color: 'var(--text-primary)', width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k}>{k}</span>
                                    <div className="flex-1 flex items-center gap-2">
                                      <div className="flex-1 relative rounded-md overflow-hidden" style={{ height: 24, background: 'var(--bg-secondary)' }}>
                                        <div className="absolute left-0 top-0 bottom-0 flex rounded-md overflow-hidden" style={{ width: `${Math.max(barPct, total > 0 ? 3 : 0)}%` }}>
                                          {propActiveYears.map(y => {
                                            const val = dmgTypeCounts[k]?.[y] || 0;
                                            if (val === 0) return null;
                                            const segPct = (val / total) * 100;
                                            return (
                                              <div key={y} className="h-full flex items-center justify-center" style={{ width: `${segPct}%`, background: YEAR_COLORS_PROP[y] || '#9ca3af', minWidth: val > 0 ? 14 : 0 }} title={`${y}: ${val}`}>
                                                {segPct > 20 && <span className="text-[9px] font-bold text-white/80">{val}</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--text-primary)', width: 26, textAlign: 'right' }}>{total}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

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
                  {/* Section 1: Identification — Incident Type first */}
                  <div>
                    <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[11px] font-bold">1</span>
                      IDENTIFICATION
                    </h3>
                    {/* Incident Type — prominent selector */}
                    <div className="mb-4 p-3 rounded-lg" style={{ background: selectedType ? '#f0fdf4' : '#fef9c3', border: `1px solid ${selectedType ? '#bbf7d0' : '#fde68a'}` }}>
                      <label className="block text-[12px] font-bold mb-1.5" style={{ color: '#374151' }}>ประเภทอุบัติการณ์ * <span className="font-normal text-[11px]" style={{ color: '#6b7280' }}>(เลือกก่อนเพื่อแสดงฟอร์มที่เกี่ยวข้อง)</span></label>
                      <select
                        value={selectedType}
                        onChange={e => {
                          updateForm('incident_type', e.target.value);
                          // Clear injury data if switching to non-injury type
                          if (NON_INJURY_TYPES.includes(e.target.value)) {
                            setInjuredPersons([]);
                            updateForm('injured_count', 0);
                          }
                        }}
                        style={{ ...selectStyle, fontSize: 14, padding: '10px 12px', fontWeight: 600, background: '#ffffff' }}
                      >
                        <option value="">— กรุณาเลือกประเภทอุบัติการณ์ —</option>
                        {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {selectedType && (
                        <p className="mt-1.5 text-[11px]" style={{ color: showInjurySections ? '#16a34a' : '#d97706' }}>
                          {showInjurySections
                            ? '✓ ฟอร์มจะแสดงส่วนข้อมูลการบาดเจ็บ + Injured Person Log'
                            : '⚡ ฟอร์มจะซ่อนส่วนข้อมูลการบาดเจ็บ (ไม่เกี่ยวข้อง)'}
                        </p>
                      )}
                    </div>
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

                  {/* Section 2: Who — only show for injury-related types */}
                  {showInjurySections && (
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
                  )}

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
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: '#6b7280' }}>กิจกรรมขณะเกิดเหตุ</label>
                        <select value={(formData.activity as string) || ''} onChange={e => updateForm('activity', e.target.value)} style={selectStyle}>
                          <option value="">เลือก</option>
                          {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      {showInjurySections && (
                      <>
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
                      </>
                      )}
                      {showInjurySections && (
                      <>
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
                      </>
                      )}
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

                  {/* Section 8: Injured Person Log — only show for injury-related types */}
                  {showInjurySections && (<div>
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
                  </div>)}

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
