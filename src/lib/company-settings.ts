import { createClient } from '@supabase/supabase-js';
import { COMPANIES, DEFAULT_YEAR, AVAILABLE_YEARS } from './companies';
import { CompanyConfig } from './types';

/**
 * Server-side utility to get companies with DB overrides merged.
 * This reads from the company_settings table and merges with static config.
 * Use this in API routes instead of directly using COMPANIES/getCompanyById.
 */

interface DbSetting {
  company_id: string;
  company_name: string;
  full_name?: string;
  group_name: string;
  bu: string;
  sheet_id: string;
  safety_sheet: string;
  envi_sheet: string;
}

let cachedSettings: DbSetting[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

async function fetchDbSettings(): Promise<DbSetting[]> {
  const now = Date.now();
  if (cachedSettings && (now - cacheTime) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await getSupabase()
      .from('company_settings')
      .select('*');

    if (!error && data && data.length > 0) {
      cachedSettings = data;
      cacheTime = now;
      return data;
    }
  } catch {
    // ignore — fallback to static
  }

  return [];
}

function mergeCompany(company: CompanyConfig, dbSetting: DbSetting | undefined): CompanyConfig {
  if (!dbSetting) return company;

  return {
    ...company,
    name: dbSetting.company_name || company.name,
    shortName: dbSetting.company_name || company.shortName,
    fullName: dbSetting.full_name || company.fullName,
    sheetId: (dbSetting.sheet_id || company.sheetId)?.trim(),
    safetySheet: (dbSetting.safety_sheet || company.safetySheet)?.trim(),
    enviSheet: (dbSetting.envi_sheet || company.enviSheet)?.trim(),
    group: (dbSetting.group_name as CompanyConfig['group']) || company.group,
    bu: (dbSetting.bu as CompanyConfig['bu']) || company.bu,
  };
}

/** Get all companies with DB overrides applied */
export async function getCompaniesWithDbOverrides(): Promise<CompanyConfig[]> {
  const dbSettings = await fetchDbSettings();
  return COMPANIES.map(c => {
    const db = dbSettings.find(s => s.company_id === c.id);
    return mergeCompany(c, db);
  });
}

/** Get a single company by ID with DB overrides */
export async function getCompanyByIdWithDb(id: string): Promise<CompanyConfig | undefined> {
  const companies = await getCompaniesWithDbOverrides();
  return companies.find(c => c.id === id);
}

/** Get company for a specific year, with DB overrides */
export async function getCompanyForYearWithDb(id: string, year: number): Promise<CompanyConfig | undefined> {
  const company = await getCompanyByIdWithDb(id);
  if (!company) return undefined;

  // Check year-specific config from static (years map)
  const staticCompany = COMPANIES.find(c => c.id === id);
  const yearConfig = staticCompany?.years?.[year];
  if (yearConfig) {
    return {
      ...company,
      sheetId: yearConfig.sheetId || company.sheetId,
      safetySheet: yearConfig.safetySheet || company.safetySheet,
      enviSheet: yearConfig.enviSheet || company.enviSheet,
    };
  }

  return company;
}

/** Get active companies (those with a sheetId) for a specific year, with DB overrides */
export async function getActiveCompaniesForYearWithDb(year: number): Promise<CompanyConfig[]> {
  const companies = await getCompaniesWithDbOverrides();
  return companies.map(c => {
    // Check year-specific config from static
    const staticCompany = COMPANIES.find(sc => sc.id === c.id);
    const yearConfig = staticCompany?.years?.[year];
    if (yearConfig && yearConfig.sheetId) {
      return { ...c, sheetId: yearConfig.sheetId, safetySheet: yearConfig.safetySheet, enviSheet: yearConfig.enviSheet };
    }
    // For default year, use merged config
    if (year === DEFAULT_YEAR && c.sheetId) return c;
    return null;
  }).filter((c): c is CompanyConfig => c !== null);
}

/** Get active companies (with sheetId), with DB overrides */
export async function getActiveCompaniesWithDb(): Promise<CompanyConfig[]> {
  const companies = await getCompaniesWithDbOverrides();
  return companies.filter(c => c.sheetId !== '');
}

/** Get available years for a company, with DB overrides */
export async function getCompanyAvailableYearsWithDb(id: string): Promise<number[]> {
  const company = await getCompanyByIdWithDb(id);
  if (!company) return [];
  const staticCompany = COMPANIES.find(c => c.id === id);
  if (!staticCompany?.years) return company.sheetId ? [DEFAULT_YEAR] : [];
  return AVAILABLE_YEARS.filter(y => {
    const yc = staticCompany.years?.[y];
    return (yc && yc.sheetId) || (y === DEFAULT_YEAR && company.sheetId);
  });
}
