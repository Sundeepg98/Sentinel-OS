export type ModuleType = 'grid' | 'list' | 'map' | 'playbook' | 'checklist' | 'markdown';

export interface Module {
  id: string;
  fullId?: string; // Normalized technical ID (e.g. mailin/00_master_analysis.md)
  label: string;
  type: ModuleType;
  icon: string; // Lucide icon name
  data: any; // Context-specific payload
}

export interface KPI {
  title: string;
  value: string;
  subValue: string;
  note: string;
  color: 'cyan' | 'indigo' | 'emerald' | 'rose' | 'amber';
}

export interface DashboardData {
  kpis: KPI[];
  failCriteria: string[];
  goldenRule: string;
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

export interface ArenaSelection {
  pinnedModuleIds: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  group: 'module' | 'learned' | 'concept';
  company: string;
  val: number;
  readiness?: number;
  blastRadius?: number;
  learned?: boolean;
  originalModule?: string;
  x?: number;
  y?: number;
  z?: number;
  neighbors: GraphNode[];
  links: GraphLink[];
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
  keyword?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SearchResult {
  id: string;
  label: string;
  company: string;
  snippet?: string;
  keywords?: string[];
  content?: string;
}
