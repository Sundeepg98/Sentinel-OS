import { createContext, useContext } from 'react';
import type { CompanyDossier } from '@/types';

export interface DossierContextType {
  dossier: CompanyDossier | null;
  setCompany: (id: string) => void;
  allCompanies: {id: string, name: string}[];
  companyId: string;
  loading: boolean;
}

export const DossierContext = createContext<DossierContextType>({
  dossier: null,
  setCompany: () => {},
  allCompanies: [],
  companyId: 'mailin',
  loading: false
});

export const useDossierContext = () => useContext(DossierContext);
