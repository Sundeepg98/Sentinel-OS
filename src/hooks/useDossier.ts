import { useState, useEffect } from 'react';
import type { CompanyDossier } from '../types';

interface CompanyListItem {
  id: string;
  name: string;
}

export function useDossier() {
  const [allCompanies, setAllCompanies] = useState<CompanyListItem[]>([]);
  const [companyId, setCompanyId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('company') || localStorage.getItem('active-company') || 'mailin';
  });

  const [dossier, setDossier] = useState<CompanyDossier | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Discover available companies
  useEffect(() => {
    async function discover() {
      try {
        const response = await fetch('/api/v1/companies');
        if (response.ok) {
          const data = await response.json();
          setAllCompanies(data);
          
          // If current companyId isn't in the discovered list, default to first available
          if (data.length > 0 && !data.find((c: any) => c.id === companyId)) {
            setCompanyId(data[0].id);
          }
        }
      } catch (e) {
        console.error('Discovery failed', e);
      }
    }
    discover();
  }, []);

  // 2. Fetch active dossier
  useEffect(() => {
    async function fetchDossier() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/dossier/${companyId}`);
        if (!response.ok) throw new Error('Fetch failed');
        const data = await response.json();
        setDossier(data);
      } catch (error) {
        console.error('Dossier fetch error:', error);
        setDossier(null);
      } finally {
        setLoading(false);
      }
    }

    if (companyId) fetchDossier();
  }, [companyId]);

  const setCompany = (id: string) => {
    setCompanyId(id);
    localStorage.setItem('active-company', id);
    const url = new URL(window.location.href);
    url.searchParams.set('company', id);
    window.history.pushState({}, '', url);
  };

  return {
    dossier,
    setCompany,
    loading,
    allCompanies
  };
}
