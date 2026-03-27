import { CompanyConfig } from './types';

// Company configurations — edit this to add/remove companies
// Each company has a Google Spreadsheet with Safety Plan and Environment Plan sheets
export const COMPANIES: CompanyConfig[] = [
  {
    id: 'aab',
    name: 'AAB',
    shortName: 'AAB',
    sheetId: '1sWQSLTCQZ96PYiFIsZ3zHjjfCnYGN8fL',
    safetySheet: 'AAB Safety Plan rev1',
    enviSheet: 'AAB Envi Plan rev1',
  },
  {
    id: 'ea-kabin',
    name: 'EA Kabin',
    shortName: 'EA Kabin',
    sheetId: '15lcITbJ_IL8MHm_W4J-2msjLqPUiKYK5',
    safetySheet: 'EA Kabin Safety Plan',
    enviSheet: 'EA Kabin Envi Plan',
  },
  {
    id: 'ebi',
    name: 'EBI',
    shortName: 'EBI',
    sheetId: '1JImW7-vLFtQ3R2zKzzLMHrPHx_h4f5vw',
    safetySheet: 'EBI SafetyPlan',
    enviSheet: 'EBI Envi Plan',
  },
  // Placeholder companies (add real Sheet IDs when ready)
  { id: 'ea-hq', name: 'EA HQ', shortName: 'EA HQ', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'ewhk', name: 'EWHK', shortName: 'EWHK', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'eslo', name: 'ESLO', shortName: 'ESLO', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'esn', name: 'ESN', shortName: 'ESN', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'esl', name: 'ESL', shortName: 'ESL', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'esp', name: 'ESP', shortName: 'ESP', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'esm', name: 'ESM', shortName: 'ESM', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'hnm', name: 'HNM', shortName: 'HNM', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'amt', name: 'AMT', shortName: 'AMT', sheetId: '', safetySheet: '', enviSheet: '' },
  { id: 'mmc', name: 'MMC', shortName: 'MMC', sheetId: '', safetySheet: '', enviSheet: '' },
];

export function getCompanyById(id: string): CompanyConfig | undefined {
  return COMPANIES.find(c => c.id === id);
}

export function getActiveCompanies(): CompanyConfig[] {
  return COMPANIES.filter(c => c.sheetId !== '');
}
