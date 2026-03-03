import React from 'react';
import { Terminal, ShieldAlert, CheckSquare, XCircle } from 'lucide-react';
import { StatusCard } from '../components/ui/StatusCard';
import { motion } from 'framer-motion';
import { useDossierContext } from '../App';

export const Dashboard: React.FC = () => {
  const { dossier } = useDossierContext();
  const activeModule = dossier.modules.find(m => m.type === 'grid'); // Fallback or specific ID logic
  
  if (!activeModule) return null;
  const { kpis, failCriteria, goldenRule } = activeModule.data;

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
          {activeModule.label}
        </h2>
        <p className="text-neutral-500 text-sm mt-2 ml-12">{dossier.name} Operational Parameters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi: any, i: number) => (
          <StatusCard 
            key={i}
            title={kpi.title} 
            value={kpi.value} 
            subValue={kpi.subValue} 
            note={kpi.note} 
            icon={<Terminal className="w-5 h-5 opacity-50" />} 
            color={kpi.color} 
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
          <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Automatic Fail Criteria
          </h3>
          <ul className="space-y-3 font-mono text-[13px]">
            {failCriteria.map((text: string, i: number) => (
              <li key={i} className="flex gap-3 text-neutral-400 items-start bg-rose-500/[0.03] p-3 rounded-lg border border-rose-500/[0.08]">
                <XCircle className="w-4 h-4 text-rose-500/80 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 translate-y-1/4 translate-x-1/4"></div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-6 border shadow-sm",
            dossier.brandColor === 'cyan' ? "bg-cyan-500/10 border-cyan-500/20" : "bg-indigo-500/10 border-indigo-500/20"
          )}>
            <CheckSquare className={cn("w-6 h-6", dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400")} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">The Golden Rule</h3>
          <blockquote className="text-neutral-400 text-[15px] leading-relaxed border-l-2 border-white/20 pl-4 py-1 italic">
            "{goldenRule}"
          </blockquote>
        </div>
      </div>
    </motion.div>
  );
};

// Re-importing cn utility since it was used in template
import { cn } from '../lib/utils';
