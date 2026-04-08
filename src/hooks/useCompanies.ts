'use client';

import { useState, useEffect, useMemo } from 'react';
import { COMPANIES } from '@/lib/companies';
import { CompanyConfig } from '@/lib/types';

interface UseCompaniesReturn {
  companies: CompanyConfig[];
  loading: boolean;
  getCompanyById: (id: string) => CompanyConfig | undefined;
}

/**
 * Hook to fetch companies with DB overrides applied.
 * Falls back to static COMPANIES if API fails.
 * Results are cached in component state.
 */
export function useCompanies(): UseCompaniesReturn {
  const [companies, setCompanies] = useState<CompanyConfig[]>(COMPANIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        if (response.ok) {
          const data = await response.json();
          setCompanies(data);
        } else {
          // API failed, keep static fallback
          setCompanies(COMPANIES);
        }
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        // Fallback to static companies
        setCompanies(COMPANIES);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Memoize the getCompanyById function
  const getCompanyById = useMemo(
    () => (id: string) => companies.find(c => c.id === id),
    [companies]
  );

  return { companies, loading, getCompanyById };
}
