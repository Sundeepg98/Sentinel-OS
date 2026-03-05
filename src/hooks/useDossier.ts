import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompanyDossier } from '../types';

interface CompanyListItem {
  id: string;
  name: string;
}

export function useDossier() {
  const [companyId, setCompanyId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('company') || localStorage.getItem('active-company') || 'mailin';
  });

  // 1. Discover available companies
  const { data: allCompanies = [] } = useQuery<CompanyListItem[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await fetch('/api/v1/companies');
      if (!res.ok) throw new Error('Discovery failed');
      return res.json();
    }
  });

  // Sync companyId if it's not in the list
  useEffect(() => {
    if (allCompanies.length > 0 && !allCompanies.find((c) => c.id === companyId)) {
      setCompanyId(allCompanies[0].id);
    }
  }, [allCompanies, companyId]);

  // 2. Fetch active dossier
  const { data: dossier = null, isLoading } = useQuery<CompanyDossier>({
    queryKey: ['dossier', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dossier/${companyId}`);
      if (!res.ok) throw new Error('Fetch failed');
      return res.json();
    },
    enabled: !!companyId,
  });

  const setCompany = (id: string) => {
    setCompanyId(id);
    localStorage.setItem('active-company', id);
    const url = new URL(window.location.href);
    url.searchParams.set('company', id);
    window.history.pushState({}, '', url);
  };

  return {
    companyId,
    dossier,
    setCompany,
    loading: isLoading,
    allCompanies
  };
}
