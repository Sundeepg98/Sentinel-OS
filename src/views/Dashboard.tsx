import React from 'react';
import { Terminal, Activity, Timer, Database, ShieldAlert, CheckSquare, XCircle } from 'lucide-react';
import { StatusCard } from '../components/ui/StatusCard';
import { motion } from 'framer-motion';

export const Dashboard: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Terminal className="w-5 h-5 text-neutral-400" />
          </div>
          System Command Center
        </h2>
        <p className="text-neutral-500 text-sm mt-2 ml-12">Mailin Target Parameters & Architectural Constraints.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard 
          title="Throughput SLA" 
          value="10k" 
          subValue="req/sec" 
          note="Per Edge Pod" 
          icon={<Activity className="text-emerald-400 w-5 h-5" />} 
          color="emerald" 
        />
        <StatusCard 
          title="P99 Latency" 
          value="50" 
          subValue="ms" 
          note="Auth + Queue Push" 
          icon={<Timer className="text-amber-400 w-5 h-5" />} 
          color="amber" 
        />
        <StatusCard 
          title="Max V8 Heap" 
          value="1.5" 
          subValue="GB" 
          note="Strict OOM Limits" 
          icon={<Database className="text-rose-400 w-5 h-5" />} 
          color="rose" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
          <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Automatic Fail Criteria
          </h3>
          <ul className="space-y-3 font-mono text-[13px]">
            {[
              'Using `JSON.parse` on massive arrays (blocks event loop).',
              'Buffering files into memory instead of `stream.Pipeline`.',
              "Missing 'error' event listeners on DB connections."
            ].map((text, i) => (
              <li key={i} className="flex gap-3 text-neutral-400 items-start bg-rose-500/[0.03] p-3 rounded-lg border border-rose-500/[0.08]">
                <XCircle className="w-4 h-4 text-rose-500/80 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 translate-y-1/4 translate-x-1/4"></div>
          <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <CheckSquare className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">The Golden Rule</h3>
          <blockquote className="text-neutral-400 text-[15px] leading-relaxed border-l-2 border-cyan-500/50 pl-4 py-1 italic">
            "Never block the main thread. Always protect consumers with backpressure. Assume downstream services have already failed."
          </blockquote>
        </div>
      </div>
    </motion.div>
  );
};
