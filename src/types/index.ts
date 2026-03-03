export type ModuleType = 'grid' | 'list' | 'map' | 'playbook' | 'checklist' | 'markdown';

export interface Module {
  id: string;
  label: string;
  type: ModuleType;
  icon: string; // Lucide icon name
  data: any; // Flexible data structure based on type
}

export interface CompanyDossier {
  id: string;
  name: string;
  targetRole: string;
  brandColor: 'cyan' | 'indigo' | 'emerald' | 'rose' | 'amber';
  modules: Module[];
}

export interface Task {
  id: number;
  text: string;
  done: boolean;
}
