import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { fetchWithAuth } from '../lib/api';
import type { CompanyDossier } from '../types';

interface CompanyListItem {
  id: string;
  name: string;
}

export function useDossier() {
  const { getToken } = useAuth();
  
  // 1. Get active company from URL directly (Single Source of Truth)
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));

  // Listen for browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => setSearchParams(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const companyIdFromUrl = searchParams.get('company');
  const companyId = companyIdFromUrl || 'mailin';

  // 2. Synchronize URL if missing
  useEffect(() => {
    if (!companyIdFromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('company', 'mailin');
      window.history.replaceState({}, '', url.toString());
      setSearchParams(new URLSearchParams(url.search));
    }
  }, [companyIdFromUrl]);

  // 3. Discover available companies
  const { data: allCompanies = [] } = useQuery<CompanyListItem[]>({
    queryKey: ['companies'],
    queryFn: () => fetchWithAuth('/api/v1/companies', getToken)
  });

  // 4. Fetch active dossier
  const { data: dossier = null, isLoading } = useQuery<CompanyDossier>({
    queryKey: ['dossier', companyId],
    queryFn: () => fetchWithAuth(`/api/v1/dossier/${companyId}`, getToken),
    enabled: !!companyId,
    placeholderData: (previousData) => previousData,
  });

  const setCompany = (id: string) => {
    localStorage.setItem('active-company', id);
    const url = new URL(window.location.href);
    url.searchParams.set('company', id);
    window.history.pushState({}, '', url.toString());
    setSearchParams(new URLSearchParams(url.search));
  };

  return {
    companyId,
    dossier,
    setCompany,
    loading: isLoading,
    allCompanies
  };
}
