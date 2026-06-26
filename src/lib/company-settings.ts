import { COMPANIES, DEFAULT_YEAR, AVAILABLE_YEARS } from './companies';
import { getServiceSupabase } from './supabase';
import { getAllYears } from './plan-years';
import { CompanyConfig } from './types';

/**
 * Server-side utility to get companies with DB overrides merged.
 * This reads from the company_settings table and merges with static config.
 * Use this in API routes instead of directly using COMPANIES/getCompanyById.
 *
 * IMPORTANT: Uses getServiceSupabase() from ./supabase which:
 *   1. Uses service-role key (bypasses RLS)
 *   2. Uses cache:'no-store' fetch (avoids Next.js Data Cache)
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

async function fetchDbSettings(): Promise<DbSetting[]> {
  const now = Date.now();
  if (cachedSettings && (now - cacheTime) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await getServiceSupabase()
      .from('company_settings')
      .select('*');

    if (error) {
      console.warn('[company-settings] DB fetch error:', error.message);
    }

    if (!error && data && data.length > 0) {
      cachedSettings = data;
      cacheTime = now;
      return data;
    }
  } catch (e) {
    console.warn('[company-settings] fetchDbSettings exception:', e);
  }

  return [];
}

// ── Per-year sheet config (company_year_sheets table) ──────────
export interface YearSheetRow {
  company_id: string;
  year: number;
  sheet_id: string;
  safety_sheet: string;
  envi_sheet: string;
}

let cachedYearSheets: YearSheetRow[] | null = null;
let yearSheetsCacheTime = 0;

async function fetchYearSheets(): Promise<YearSheetRow[]> {
  const now = Date.now();
  if (cachedYearSheets && now - yearSheetsCacheTime < CACHE_TTL) {
    return cachedYearSheets;
  }
  try {
    const { data, error } = await getServiceSupabase()
      .from('company_year_sheets')
      .select('company_id, year, sheet_id, safety_sheet, envi_sheet');
    if (!error && data) {
      cachedYearSheets = data as YearSheetRow[];
      yearSheetsCacheTime = now;
      return cachedYearSheets;
    }
  } catch (e) {
    console.warn('[company-settings] fetchYearSheets exception:', e);
  }
  return [];
}

/** Invalidate the in-memory caches (call after mutating settings/year sheets). */
export function invalidateCompanySettingsCache(): void {
  cachedSettings = null;
  cacheTime = 0;
  cachedYearSheets = null;
  yearSheetsCacheTime = 0;
}

/**
 * Resolve the sheet config for a company in a given year.
 * Priority: DB year row (non-empty) -> static years map -> base (only for
 * the default year) -> empty (an un-configured future year).
 */
function resolveYearSheet(
  company: CompanyConfig,
  id: string,
  year: number,
  yearRows: YearSheetRow[],
): CompanyConfig {
  // The default (base) year is driven entirely by company_settings — the
  // existing Admin tab. Keep that behavior unchanged so 2026 never regresses.
  if (year === DEFAULT_YEAR) return company;

  // Other years: DB per-year row (non-empty) wins.
  const row = yearRows.find((r) => r.company_id === id && r.year === year);
  if (row && row.sheet_id) {
    return { ...company, sheetId: row.sheet_id, safetySheet: row.safety_sheet, enviSheet: row.envi_sheet };
  }
  // Then the static years map (legacy hard-coded config).
  const staticCompany = COMPANIES.find((c) => c.id === id);
  const yc = staticCompany?.years?.[year];
  if (yc && yc.sheetId) {
    return { ...company, sheetId: yc.sheetId, safetySheet: yc.safetySheet, enviSheet: yc.enviSheet };
  }
  // Un-configured future year -> no sheet (caller shows "not configured").
  return { ...company, sheetId: '', safetySheet: '', enviSheet: '' };
}

/** Pick the first non-empty trimmed string, or '' */
function pick(...values: (string | undefined | null)[]): string {
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function mergeCompany(company: CompanyConfig, dbSetting: DbSetting | undefined): CompanyConfig {
  if (!dbSetting) return company;

  return {
    ...company,
    name: pick(dbSetting.company_name, company.name),
    shortName: pick(dbSetting.company_name, company.shortName),
    fullName: pick(dbSetting.full_name, company.fullName),
    // DB values take priority over static config for sheet settings
    sheetId: pick(dbSetting.sheet_id, company.sheetId),
    safetySheet: pick(dbSetting.safety_sheet, company.safetySheet),
    enviSheet: pick(dbSetting.envi_sheet, company.enviSheet),
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

/** Get company for a specific year, with DB overrides (DB year sheets first) */
export async function getCompanyForYearWithDb(id: string, year: number): Promise<CompanyConfig | undefined> {
  const company = await getCompanyByIdWithDb(id);
  if (!company) return undefined;
  const yearRows = await fetchYearSheets();
  return resolveYearSheet(company, id, year, yearRows);
}

/** Get active companies (those with a sheetId) for a specific year, with DB overrides */
export async function getActiveCompaniesForYearWithDb(year: number): Promise<CompanyConfig[]> {
  const companies = await getCompaniesWithDbOverrides();
  const yearRows = await fetchYearSheets();
  return companies
    .map(c => resolveYearSheet(c, c.id, year, yearRows))
    .filter(c => c.sheetId !== '');
}

/** Get active companies (with sheetId), with DB overrides */
export async function getActiveCompaniesWithDb(): Promise<CompanyConfig[]> {
  const companies = await getCompaniesWithDbOverrides();
  return companies.filter(c => c.sheetId !== '');
}

/**
 * Get the years a company has a configured sheet for, with DB overrides.
 * Considers DB year rows, the static years map, and the base (default-year)
 * config — across every year known to plan_years (falls back to AVAILABLE_YEARS).
 */
export async function getCompanyAvailableYearsWithDb(id: string): Promise<number[]> {
  const company = await getCompanyByIdWithDb(id);
  if (!company) return [];
  const [yearRows, knownYears] = await Promise.all([
    fetchYearSheets(),
    getAllYears(),
  ]);
  const years = knownYears.length > 0 ? knownYears : [...AVAILABLE_YEARS];
  return years.filter(y => resolveYearSheet(company, id, y, yearRows).sheetId !== '');
}
