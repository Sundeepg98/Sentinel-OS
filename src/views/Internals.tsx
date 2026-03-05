import React, { useState } from 'react';
import { Shield, Target, AlertCircle, CheckCircle2, ChevronRight, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../App';
import { cn } from '../lib/utils';

interface InternalsProps {
  activeModuleId?: string;
}

export const Internals: React.FC<InternalsProps> = ({ activeModuleId }) => {
  const { dossier } = useDossierContext();
  const [studyMode, setStudyMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<number[]>([]);

  if (!dossier) return null;
  
  const activeModule = activeModuleId 
    ? dossier.modules.find(m => m.id === activeModuleId)
    : dossier.modules.find(m => m.type === 'playbook');

  if (!activeModule) return (
    <div className="flex items-center justify-center h-full text-neutral-500 italic">
      No playbook data found for this module.
    </div>
  );

  const playbook = activeModule.data || [];

  const toggleReveal = (id: number) => {
    if (revealedIds.includes(id)) {
      setRevealedIds(revealedIds.filter(rid => rid !== id));
    } else {
      setRevealedIds([...revealedIds, id]);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Shield className="w-5 h-5 text-neutral-400" />
          </div>
          {activeModule.label}
        </h2>

        <button 
          onClick={() => setStudyMode(!studyMode)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm",
            studyMode 
              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
              : "bg-[#0d0d0d] border-white/[0.1] text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          )}
        >
          <BrainCircuit className="w-4 h-4" />
          {studyMode ? 'Exit Study Mode' : 'Active Recall'}
        </button>
      </div>

      <div className="space-y-12">
        {playbook.map((item: any, idx: number) => (
          <div key={idx} className="relative group">
            {/* Question Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="mt-1 p-1.5 bg-indigo-500/10 rounded-md text-indigo-400 font-mono text-[10px] font-bold">Q{idx + 1}</div>
              <h3 className="text-xl font-medium text-white leading-relaxed tracking-tight">{item.q}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-12">
              {/* Trap Response */}
              <div className="bg-[#0d0d0d] border border-rose-500/10 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertCircle size={40} className="text-rose-500" />
                </div>
                <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={12} /> The Trap Response
                </h4>
                <p className="text-neutral-400 text-[14px] leading-relaxed italic border-l-2 border-rose-500/20 pl-4">
                  "{item.trap}"
                </p>
                <div className="mt-6 pt-6 border-t border-white/[0.03]">
                  <h5 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Why it fails</h5>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">{item.trapWhy}</p>
                </div>
              </div>

              {/* Optimal Response */}
              <div className="bg-[#0d0d0d] border border-emerald-500/10 rounded-xl p-6 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Target size={40} className={cn(dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400")} />
                </div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={12} /> Optimal Staff Response
                  </h4>
                  {studyMode && (
                    <button 
                      onClick={() => toggleReveal(idx)}
                      className="text-neutral-500 hover:text-white transition-colors"
                    >
                      {revealedIds.includes(idx) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    {(!studyMode || revealedIds.includes(idx)) ? (
                      <motion.div
                        key="content"
                        initial={studyMode ? { opacity: 0, x: 10 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-neutral-200 text-[14px] leading-relaxed font-medium"
                      >
                        {item.optimal}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center py-10 cursor-pointer group/btn"
                        onClick={() => toggleReveal(idx)}
                      >
                        <BrainCircuit className="w-8 h-8 text-neutral-800 mb-2 group-hover/btn:text-neutral-600 transition-colors" />
                        <span className="text-[10px] text-neutral-600 uppercase font-bold tracking-widest">Reveal Strategy</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
