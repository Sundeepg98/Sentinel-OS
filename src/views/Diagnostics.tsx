import React, { useState } from 'react';
import { SearchCode, ShieldAlert, CheckCircle2, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../App';
import { cn } from '../lib/utils';

const PlaybookCard: React.FC<{ item: any, studyMode: boolean }> = ({ item, studyMode }) => {
  const [revealed, setRevealed] = useState(false);

  // If not in study mode, it's always revealed
  const isVisible = !studyMode || revealed;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl transition-all">
      <div 
        className={cn(
          "p-6 bg-white/[0.02] border-b border-white/[0.05] flex justify-between items-start",
          studyMode && "cursor-pointer hover:bg-white/[0.04] transition-colors"
        )}
        onClick={() => studyMode && setRevealed(!revealed)}
      >
        <h3 className="text-lg font-medium text-white flex gap-3 leading-relaxed">
          {item.q}
        </h3>
        
        {studyMode && (
          <button className={cn(
            "flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors border mt-1 shrink-0",
            revealed ? "bg-white/5 border-white/10 text-neutral-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
          )}>
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            {revealed ? 'Hide Answer' : 'Reveal'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={studyMode ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.05]"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Diagnostics: React.FC = () => {
  const { dossier } = useDossierContext();
  const [studyMode, setStudyMode] = useState(false);
  
  if (!dossier) return null;
  const activeModule = dossier.modules.find(m => m.type === 'playbook');
  
  if (!activeModule) return null;
  const items = activeModule.data;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <SearchCode className="w-5 h-5 text-neutral-400" />
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
          <div className="leading-relaxed"><strong>Active Recall Mode:</strong> Test your diagnostic skills. Try to identify the 'Trap Response' and articulate the 'Optimal Staff Response' before revealing the answers.</div>
        </div>
      )}

      <div className="space-y-8">
        {items.map((item: any, idx: number) => (
          <PlaybookCard key={idx} item={item} studyMode={studyMode} />
        ))}
      </div>
    </motion.div>
  );
};
