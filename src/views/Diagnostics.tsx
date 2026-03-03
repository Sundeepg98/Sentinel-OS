import React from 'react';
import { SearchCode, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DIAGNOSTICS_PLAYBOOK } from '../data/diagnostics';
import { motion } from 'framer-motion';

export const Diagnostics: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <SearchCode className="w-5 h-5 text-neutral-400" />
          </div>
          Diagnostics Playbook
        </h2>
      </div>

      <div className="space-y-8">
        {DIAGNOSTICS_PLAYBOOK.map((item, idx) => (
          <div key={idx} className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-white/[0.02] border-b border-white/[0.05]">
              <h3 className="text-lg font-medium text-white flex gap-3 leading-relaxed">
                <span className="text-cyan-500/80 font-mono text-sm mt-1 shrink-0">[{String(idx+1).padStart(2, '0')}]</span> 
                {item.q}
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.05]">
              <div className="p-8 flex flex-col">
                <div className="flex items-center gap-2 mb-4 text-rose-400/80 font-semibold uppercase text-[11px] tracking-widest">
                  <ShieldAlert className="w-4 h-4" strokeWidth={2} /> The Trap Response
                </div>
                <p className="text-neutral-400 text-[14px] italic mb-6 leading-relaxed flex-1">"{item.trap}"</p>
                <div className="bg-rose-500/[0.03] border border-rose-500/10 rounded-lg p-4 text-[13px] text-rose-200/60 leading-relaxed">
                  <span className="font-semibold text-rose-400 block mb-1">Why it fails:</span>
                  {item.trapWhy}
                </div>
              </div>
              <div className="p-8 flex flex-col bg-[#0a0a0a]">
                <div className="flex items-center gap-2 mb-4 text-emerald-400/80 font-semibold uppercase text-[11px] tracking-widest">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Optimal Staff Response
                </div>
                <p className="text-neutral-300 text-[14px] leading-relaxed">{item.optimal}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
