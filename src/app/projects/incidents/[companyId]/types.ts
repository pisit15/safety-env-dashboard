// Shared types for the Incidents workspace

export interface Incident {
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
  incident_detail?: string;
  area?: string;
  equipment?: string;
  environment?: string;
  direct_cost?: number;
  indirect_cost?: number;
  report_status?: string;
  [key: string]: unknown;
}

export interface SummaryData {
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

export interface InjuredPerson {
  incident_no: string;
  person_type?: string;
  injury_severity?: string;
  nature_of_injury?: string;
  body_part?: string;
  body_side?: string;
  is_lti?: string;
  lost_work_days?: number;
}

export type IncidentCategory = 'overview' | 'injury' | 'property' | 'actions' | 'rates';

export interface GlobalFilters {
  selectedYears: number[];
  workRelatedOnly: boolean;
  search: string;
}

export interface LiveStats {
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
  typeBreakdown: Record<string, number>;
}

export interface ManHours {
  employee: number;
  contractor: number;
  total: number;
}

// Helper functions shared across components
export const getTypeColor = (t: string): string => {
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
  return TYPE_COLORS[t] || '#9ca3af';
};

export const getSevColor = (sev: string): string => {
  if (sev?.includes('S6') || sev?.includes('เสียชีวิต')) return '#ef4444';
  if (sev?.includes('S5') || sev?.includes('S4')) return '#f97316';
  if (sev?.includes('S3')) return '#eab308';
  if (sev?.includes('S2')) return '#3b82f6';
  if (sev?.includes('S1')) return '#22c55e';
  return '#9ca3af';
};

export const getTypeBadge = (type: string): { bg: string; color: string; border: string } => {
  if (type?.includes('เสียชีวิต')) return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  if (type?.includes('หยุดงาน')) return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
  if (type?.includes('ทำงานอย่างจำกัด')) return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' };
  if (type?.includes('ไม่หยุดงาน') || type?.includes('ปฐมพยาบาล')) return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd' };
  if (type === 'Near Miss') return { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' };
  if (type === 'ทรัพย์สินเสียหาย') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
  return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
};

// Build live stats from filtered incidents
export function buildLiveStats(categoryIncidents: Incident[]): LiveStats {
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

  const empInj = injuryIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
  const conInj = injuryIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));
  const empLti = ltiIncidents.filter(i => (i.person_type || '').includes('พนักงาน'));
  const conLti = ltiIncidents.filter(i => (i.person_type || '').includes('ผู้รับเหมา'));

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
}
