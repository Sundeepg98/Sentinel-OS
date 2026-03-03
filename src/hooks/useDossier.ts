import { useState, useEffect } from 'react';
import type { CompanyDossier } from '../types';

const STATIC_FALLBACKS: Record<string, CompanyDossier> = {
  mailin: {
    id: 'mailin',
    name: 'MAILIN',
    targetRole: 'L6 Staff Infrastructure Engineer',
    brandColor: 'cyan',
    modules: [
      {
        id: 'dashboard',
        label: 'Command Center',
        type: 'grid',
        icon: 'Terminal',
        data: {
          kpis: [
            { title: 'Throughput SLA', value: '10k', subValue: 'req/sec', note: 'Per Edge Pod', color: 'emerald' },
            { title: 'P99 Latency', value: '50', subValue: 'ms', note: 'Auth + Queue Push', color: 'amber' },
            { title: 'Max V8 Heap', value: '1.5', subValue: 'GB', note: 'Strict OOM Limits', color: 'rose' }
          ],
          failCriteria: [
            'Using `JSON.parse` on massive arrays (blocks event loop).',
            'Buffering files into memory instead of `stream.Pipeline`.',
            "Missing 'error' event listeners on DB connections."
          ],
          goldenRule: "Never block the main thread. Always protect consumers with backpressure. Assume downstream services have already failed."
        }
      }
    ]
  },
  turing: {
    id: 'turing',
    name: 'TURING',
    targetRole: 'Infrastructure & Pulumi Architect',
    brandColor: 'indigo',
    modules: [
      {
        id: 'infra',
        label: 'Cloud & IaC',
        type: 'list',
        icon: 'Layers',
        data: [
          {
            category: 'Infrastructure as Code (Pulumi)',
            items: [
              {
                title: 'State Locking & Concurrency',
                desc: 'Managing state across large teams.',
                impact: 'Race conditions during stack updates.',
                solution: 'Use standard state locking mechanisms.'
              }
            ]
          }
        ]
      }
    ]
  }
};

export function useDossier() {
  const [companyId, setCompanyId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('company') || localStorage.getItem('active-company') || 'mailin';
  });

  const [dossier, setDossier] = useState<CompanyDossier>(STATIC_FALLBACKS[companyId] || STATIC_FALLBACKS.mailin);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchDossier() {
      setLoading(true);
      try {
        const response = await fetch(`/api/dossier/${companyId}`);
        if (!response.ok) throw new Error('Backend Offline');
        const data = await response.json();
        setDossier(data);
      } catch (error) {
        console.warn('Backend offline, using static fallback');
        setDossier(STATIC_FALLBACKS[companyId] || STATIC_FALLBACKS.mailin);
      } finally {
        setLoading(false);
      }
    }

    fetchDossier();
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
    allCompanies: [
      { id: 'mailin', name: 'MAILIN' },
      { id: 'turing', name: 'TURING' }
    ]
  };
}
