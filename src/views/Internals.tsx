import React from 'react';
import { Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDossierContext } from '../App';

export const Internals: React.FC = () => {
  const { dossier } = useDossierContext();
  
  if (!dossier) return null;
  const activeModule = dossier.modules.find(m => m.type === 'list'); 
  
  if (!activeModule) return null;
  const sections = activeModule.data;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Cpu className="w-5 h-5 text-neutral-400" />
          </div>
          {activeModule.label}
        </h2>
      </div>

      {sections.map((section: any, sIdx: number) => (
        <div key={sIdx} className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-white/[0.02] px-6 py-4 border-b border-white/[0.05]">
            <h3 className="font-semibold text-sm text-neutral-300 uppercase tracking-widest">{section.category}</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {section.items.map((item: any, iIdx: number) => (
              <div key={iIdx} className="p-6">
                <h4 className="text-lg font-semibold text-white mb-4">{item.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-4 flex flex-col">
                    <div className="flex-1">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest block mb-2">Mechanism</span>
                      <p className="text-neutral-400 text-[14px] leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="bg-rose-500/[0.03] border border-rose-500/10 p-4 rounded-lg mt-auto">
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> The Impact
                      </span>
                      <p className="text-rose-200/70 text-[13px] leading-relaxed">{item.impact}</p>
                    </div>
                  </div>
                  <div className="bg-emerald-500/[0.03] border border-emerald-500/10 p-5 rounded-lg h-full flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                      <CheckCircle2 className="w-4 h-4" /> Senior Solution
                    </span>
                    <p className="text-emerald-100/70 text-[14px] leading-relaxed">{item.solution}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};
