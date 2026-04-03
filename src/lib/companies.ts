import { CompanyConfig } from './types';

// Available years for the dashboard
export const AVAILABLE_YEARS = [2026, 2027];
export const DEFAULT_YEAR = 2026;
// Years that are currently active (have data and can be selected)
// When 2027 data is ready, add 2027 here to enable it
export const ACTIVE_YEARS = [2026];

// Company configurations — edit this to add/remove companies
// Each company has a Google Spreadsheet with Safety Plan and Environment Plan sheets
// Use the `years` map to configure different Sheet files per year
export const COMPANIES: CompanyConfig[] = [
  {
    id: 'aab',
    name: 'AAB',
    shortName: 'AAB',
    fullName: 'Absolute Assembly Co., Ltd.',
    sheetId: '1sWQSLTCQZ96PYiFIsZ3zHjjfCnYGN8fL',
    safetySheet: 'AAB Safety Plan rev1',
    enviSheet: 'AAB Envi Plan rev1',
    group: 'Factory',
    bu: 'EV',
    years: {
      2026: {
        sheetId: '1sWQSLTCQZ96PYiFIsZ3zHjjfCnYGN8fL',
        safetySheet: 'AAB Safety Plan rev1',
        enviSheet: 'AAB Envi Plan rev1',
      },
      // 2027: { sheetId: 'NEW_SHEET_ID', safetySheet: 'AAB Safety Plan 2027', enviSheet: 'AAB Envi Plan 2027' },
    },
  },
  {
    id: 'ea-kabin',
    name: 'EA Kabin',
    shortName: 'EA Kabin',
    fullName: 'Energy Absolute (Kabin Buri) - โรงงานไบโอดีเซล กบินทร์บุรี',
    sheetId: '15lcITbJ_IL8MHm_W4J-2msjLqPUiKYK5',
    safetySheet: 'EA Kabin SafetyPlan Rev1',
    enviSheet: 'EA Kabin Envi Plan Rev1',
    group: 'Factory',
    bu: 'Biodiesel',
    years: {
      2026: {
        sheetId: '15lcITbJ_IL8MHm_W4J-2msjLqPUiKYK5',
        safetySheet: 'EA Kabin SafetyPlan Rev1',
        enviSheet: 'EA Kabin Envi Plan Rev1',
      },
    },
  },
  {
    id: 'ebi',
    name: 'EBI',
    shortName: 'EBI',
    fullName: 'EA Bio Innovation Co., Ltd. - โรงงานไบโอดีเซล',
    sheetId: '1JImW7-vLFtQ3R2zKzzLMHrPHx_h4f5vw',
    safetySheet: 'EBI SafetyPlan',
    enviSheet: 'EBI Envi Plan',
    group: 'Factory',
    bu: 'Biodiesel',
    years: {
      2026: {
        sheetId: '1JImW7-vLFtQ3R2zKzzLMHrPHx_h4f5vw',
        safetySheet: 'EBI SafetyPlan',
        enviSheet: 'EBI Envi Plan',
      },
    },
  },
  // Placeholder companies (add real Sheet IDs when ready)
  { id: 'ea-hq', name: 'EA HQ', shortName: 'EA HQ', fullName: 'Energy Absolute PCL. - สำนักงานใหญ่', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: '' },
  { id: 'ewhk', name: 'EWHK', shortName: 'EWHK', fullName: 'EA Wind (Huai Kachao) - โรงไฟฟ้าพลังงานลม ห้วยกะโจ', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'Renewable Energy' },
  { id: 'eslo', name: 'ESLO', shortName: 'ESLO', fullName: 'EA Solar (Lopburi) - โรงไฟฟ้าพลังงานแสงอาทิตย์ ลพบุรี', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'Renewable Energy' },
  { id: 'esn', name: 'ESN', shortName: 'ESN', fullName: 'EA Solar (Nakhon Ratchasima) - โรงไฟฟ้าพลังงานแสงอาทิตย์ นครราชสีมา', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'Renewable Energy' },
  { id: 'esl', name: 'ESL', shortName: 'ESL', fullName: 'EA Solar (Lampang) - โรงไฟฟ้าพลังงานแสงอาทิตย์ ลำปาง', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'Renewable Energy' },
  { id: 'esp', name: 'ESP', shortName: 'ESP', fullName: 'EA Solar (Phetchabun) - โรงไฟฟ้าพลังงานแสงอาทิตย์ เพชรบูรณ์', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'Renewable Energy' },
  { id: 'esm', name: 'ESM', shortName: 'ESM', fullName: 'EA Smart Mobility Co., Ltd. - อีวี สมาร์ท โมบิลิตี้', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: 'EV' },
  { id: 'hnm', name: 'HNM', shortName: 'HNM', fullName: 'Hanami Energy Co., Ltd. - ฮานามิ เอนเนอร์ยี่', sheetId: '', safetySheet: '', enviSheet: '', group: '', bu: 'Renewable Energy' },
  {
    id: 'amt',
    name: 'AMT',
    shortName: 'AMT',
    fullName: 'Amita Technology (Chonburi) Co., Ltd. - โรงงานแบตเตอรี่ ชลบุรี',
    sheetId: '1-d8ehNnYsVGn9JR_7ZqhEbpP5-e-ocaD',
    safetySheet: 'Amita Safety Plan Rev1',
    enviSheet: 'Amita Envi Plan Rev1',
    group: 'Factory',
    bu: 'EV',
    years: {
      2026: {
        sheetId: '1-d8ehNnYsVGn9JR_7ZqhEbpP5-e-ocaD',
        safetySheet: 'Amita Safety Plan Rev1',
        enviSheet: 'Amita Envi Plan Rev1',
      },
    },
  },
  { id: 'mmc', name: 'MMC', shortName: 'MMC', fullName: 'Mine Mobility Co., Ltd. - ไมน์ โมบิลิตี้ (รถ EV)', sheetId: '', safetySheet: '', enviSheet: '', group: 'Factory', bu: 'EV' },
  { id: 'wmp', name: 'WMP', shortName: 'WMP', fullName: 'Waste Management (Pinthong) - จัดการขยะ ปิ่นทอง', sheetId: '', safetySheet: '', enviSheet: '', group: 'Factory', bu: 'Waste Management' },
  { id: 'mmr', name: 'MMR', shortName: 'MMR', fullName: 'Mine Mobility Research Co., Ltd. - วิจัยและพัฒนา EV', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: '' },
  { id: 'gtr', name: 'GTR', shortName: 'GTR', fullName: 'Green Technology Research Co., Ltd. - วิจัยเทคโนโลยีสีเขียว', sheetId: '', safetySheet: '', enviSheet: '', group: 'Non-Factory', bu: '' },
  { id: 'swm', name: 'SWM', shortName: 'SWM', fullName: 'Smart Waste Management Co., Ltd. - จัดการขยะอัจฉริยะ', sheetId: '', safetySheet: '', enviSheet: '', group: 'Factory', bu: 'Waste Management' },
];

export function getCompanyById(id: string): CompanyConfig | undefined {
  return COMPANIES.find(c => c.id === id);
}

/**
 * Get a company config resolved for a specific year.
 * Returns a CompanyConfig with sheetId/safetySheet/enviSheet set to the year's values.
 * Falls back to the default (flat) values if the year is not configured.
 */
export function getCompanyForYear(id: string, year: number): CompanyConfig | undefined {
  const company = COMPANIES.find(c => c.id === id);
  if (!company) return undefined;

  const yearConfig = company.years?.[year];
  if (yearConfig) {
    return {
      ...company,
      sheetId: yearConfig.sheetId,
      safetySheet: yearConfig.safetySheet,
      enviSheet: yearConfig.enviSheet,
    };
  }

  // Fallback: if year not configured, return base config (only works for default year)
  return company;
}

/**
 * Get active companies for a specific year.
 * A company is "active" for a year if it has a sheetId configured for that year.
 */
export function getActiveCompaniesForYear(year: number): CompanyConfig[] {
  return COMPANIES.map(c => {
    const yearConfig = c.years?.[year];
    if (yearConfig && yearConfig.sheetId) {
      return { ...c, sheetId: yearConfig.sheetId, safetySheet: yearConfig.safetySheet, enviSheet: yearConfig.enviSheet };
    }
    // For default year, use flat config
    if (year === DEFAULT_YEAR && c.sheetId) return c;
    return null;
  }).filter((c): c is CompanyConfig => c !== null);
}

export function getActiveCompanies(): CompanyConfig[] {
  return COMPANIES.filter(c => c.sheetId !== '');
}

/**
 * Check which years a company has data for
 */
export function getCompanyAvailableYears(id: string): number[] {
  const company = COMPANIES.find(c => c.id === id);
  if (!company) return [];
  if (!company.years) return company.sheetId ? [DEFAULT_YEAR] : [];
  return AVAILABLE_YEARS.filter(y => {
    const yc = company.years?.[y];
    return yc && yc.sheetId;
  });
}
