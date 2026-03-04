// Shared Type Contracts between Frontend and Backend
// Ensures 100% protocol integrity and prevents architectural drift.

export interface AIResponseDrill {
  question: string;
  idealResponse: string;
}

export interface AIResponseIncident {
  title: string;
  description: string;
  logs: string[];
  rootCause: string;
  idealMitigation: string;
}

export interface AIResponseEvaluation {
  score: string;
  feedback: string;
  followUp?: string;
  missedSteps?: string[];
}

export interface IntelligenceStats {
  totalChunks: number;
  interactions: number;
  learnedAssets: number;
  model: string;
  uptime: number;
  env: string;
  auth: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  group: 'module' | 'concept' | 'learned';
  company: string;
  val: number;
  readiness: number;
  blastRadius?: number;
  learned?: boolean;
  originalModule?: string;
}

export interface KnowledgeLink {
  source: string;
  target: string;
  type?: string;
  keyword?: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}
