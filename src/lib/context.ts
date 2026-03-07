import { createContext, useContext } from 'react';
import type { CompanyDossier } from '@/types';

export interface CompanyListItem {
  id: string;
  name: string;
}

export interface DossierContextType {
  dossier: CompanyDossier | null;
  setCompany: (id: string) => void;
  allCompanies: CompanyListItem[];
  companyId: string;
  loading: boolean;
  arenaIds?: string[];
  setArenaIds?: (ids: string[]) => void;
}

export const DossierContext = createContext<DossierContextType>({
  dossier: null,
  setCompany: () => {},
  allCompanies: [],
  companyId: 'mailin',
  loading: false
});

export const useDossierContext = () => useContext(DossierContext);
