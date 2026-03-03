export interface V8InternalItem {
  title: string;
  desc: string;
  impact: string;
  solution: string;
}

export interface V8InternalSection {
  category: string;
  items: V8InternalItem[];
}

export interface ArchitecturePattern {
  id: string;
  title: string;
  tech: string;
  bottleneck: string;
  scenario: string;
  code: string;
}

export interface DiagnosticItem {
  q: string;
  trap: string;
  trapWhy: string;
  optimal: string;
}

export interface Task {
  id: number;
  text: string;
  done: boolean;
}
