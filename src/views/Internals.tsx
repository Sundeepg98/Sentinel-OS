import React, { useState } from 'react';
import { Cpu, AlertTriangle, CheckCircle2, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../App';
import { cn } from '../lib/utils';

const InternalsCard: React.FC<{ item: any, studyMode: boolean }> = ({ item, studyMode }) => {
  const [revealed, setRevealed] = useState(false);
  const isVisible = !studyMode || revealed;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-lg font-semibold text-white">{item.title}</h4>
        
        {studyMode && (
          <button 
            onClick={() => setRevealed(!revealed)}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors border mt-1 shrink-0",
              revealed ? "bg-white/5 border-white/10 text-neutral-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
            )}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            {revealed ? 'Hide Solution' : 'Reveal'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        
        <AnimatePresence mode="wait">
          {isVisible ? (
            <motion.div 
              key="content"
              initial={studyMode ? { opacity: 0, scale: 0.95 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-emerald-500/[0.03] border border-emerald-500/10 p-5 rounded-lg h-full flex flex-col justify-center"
            >
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="w-4 h-4" /> Senior Solution
              </span>
              <p className="text-emerald-100/70 text-[14px] leading-relaxed">{item.solution}</p>
            </motion.div>
          ) : (
            <motion.div 
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white/[0.02] border border-white/[0.05] border-dashed p-5 rounded-lg h-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.04] transition-colors"
              onClick={() => setRevealed(true)}
            >
              <BrainCircuit className="w-8 h-8 text-neutral-600 mb-3" />
              <p className="text-neutral-400 text-sm font-medium">How would you solve this bottleneck?</p>
              <p className="text-neutral-500 text-xs mt-1">Click reveal when ready.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const Internals: React.FC = () => {
  const { dossier } = useDossierContext();
  const [studyMode, setStudyMode] = useState(false);
  
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
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Cpu className="w-5 h-5 text-neutral-400" />
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

      {studyMode && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl text-indigo-200/80 text-sm flex items-start gap-3">
          <BrainCircuit className="w-5 h-5 shrink-0 text-indigo-400" />
          <p className="leading-relaxed"><strong>Active Recall Mode:</strong> The 'Senior Solution' section is hidden. Read the mechanism and the impact, formulate your own solution, and then reveal the answer to check your knowledge.</p>
        </div>
      )}

      {sections.map((section: any, sIdx: number) => (
        <div key={sIdx} className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-white/[0.02] px-6 py-4 border-b border-white/[0.05]">
            <h3 className="font-semibold text-sm text-neutral-300 uppercase tracking-widest">{section.category}</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {section.items.map((item: any, iIdx: number) => (
              <InternalsCard key={iIdx} item={item} studyMode={studyMode} />
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};
