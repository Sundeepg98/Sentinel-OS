import type { CompanyDossier } from '../types';

export const DOSSIER_REGISTRY: Record<string, CompanyDossier> = {
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
      },
      {
        id: 'runtime',
        label: 'V8 & Libuv',
        type: 'list',
        icon: 'Cpu',
        data: [
          {
            category: 'Libuv & The Thread Pool',
            items: [
              {
                title: 'DNS Resolution Blocking',
                desc: 'Mailin makes millions of SMTP connections. `http` and `net` modules use `dns.lookup()`, relying on `getaddrinfo` in the Libuv thread pool (default size 4).',
                impact: 'If 10,000 emails are dispatched simultaneously, all 4 threads block. The entire Node.js event loop stalls.',
                solution: 'Use `dns.resolve()` to make direct async network queries bypassing the thread pool.'
              }
            ]
          }
        ]
      },
      {
        id: 'infra',
        label: 'Deliverability Infra',
        type: 'map',
        icon: 'Network',
        data: [
          {
            id: 'smtp',
            title: 'SMTP Dispatch Pipeline',
            tech: 'Node.js + Postfix + PowerMTA',
            bottleneck: 'MTA Connection Limits',
            scenario: 'High-volume outbound queues getting throttled by Gmail/Outlook due to poor connection management.',
            code: `// Optimal Connection Pooling\nconst pool = new SMTPPool({\n  maxConnections: 100,\n  maxMessages: 1000,\n  rateLimit: 50 // ms between messages\n});`
          }
        ]
      },
      {
        id: 'diagnostics',
        label: 'Deliverability Playbook',
        type: 'playbook',
        icon: 'SearchCode',
        data: [
          {
            q: "A dedicated IP is warming up, but bounce rates spiked. How do you triage?",
            trap: "I will immediately stop all sending and change the IP.",
            trapWhy: "Switching IPs without root cause analysis flags the entire subnet. It looks like 'snowshoeing' to ISPs.",
            optimal: "Check SPF/DKIM/DMARC alignment. Analyze bounce codes (e.g., 421 vs 550). Adjust the warm-up volume curve down by 20% while monitoring sender score."
          }
        ]
      },
      {
        id: 'tracker',
        label: 'Readiness Tracker',
        type: 'checklist',
        icon: 'Zap',
        data: [
          { id: 1, text: "Explain SMTP 4xx vs 5xx errors clearly.", done: false },
          { id: 2, text: "Whiteboard a Redis rate-limiter for domain-specific throttling.", done: false }
        ]
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
        id: 'iac',
        label: 'Pulumi & IaC',
        type: 'list',
        icon: 'Layers',
        data: [
          {
            category: 'State & Orchestration',
            items: [
              {
                title: 'Stack Orchestration',
                desc: 'Managing cross-stack dependencies using StackReferences in Pulumi.',
                impact: 'Tightly coupled stacks cause "dependency hell" during teardowns.',
                solution: 'Use micro-stacks with clear output/input contracts and versioned artifacts.'
              }
            ]
          }
        ]
      },
      {
        id: 'system-design',
        label: 'System Design',
        type: 'map',
        icon: 'Network',
        data: [
          {
            id: 'sharding',
            title: 'Horizontal Sharding',
            tech: 'Postgres + Citus / Vitess',
            bottleneck: 'Single Leader Write Contention',
            scenario: 'The primary database is hitting CPU limits due to massive write volume from global telemetry.',
            code: `-- Pulumi Resource Definition\nconst cluster = new aws.rds.Cluster("sharded-db", {\n  engine: "aurora-postgresql",\n  instances: 3\n});`
          }
        ]
      },
      {
        id: 'turing-playbook',
        label: 'Seniority Drills',
        type: 'playbook',
        icon: 'SearchCode',
        data: [
          {
            q: "How do you decide between a monolith and microservices for a new Turing client project?",
            trap: "Microservices are always better for scale.",
            trapWhy: "Premature optimization. Microservices add 10x operational overhead. Small teams should usually start with a modular monolith.",
            optimal: "I evaluate based on Team Size, Domain Complexity, and Deployment Independence requirements. I prefer a 'Modular Monolith' initially, using clean boundaries so services can be extracted as they hit specific scaling bottlenecks."
          }
        ]
      },
      {
        id: 'turing-tracker',
        label: 'Action Items',
        type: 'checklist',
        icon: 'Zap',
        data: [
          { id: 1, text: "Refactor a monolithic Pulumi stack into micro-stacks.", done: false },
          { id: 2, text: "Practice explaining SOLID principles using real infra examples.", done: false }
        ]
      }
    ]
  }
};
