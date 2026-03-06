import React, { useState } from 'react';
import { Network, FastForward, Layers, GitPullRequest, Box, Code2, ArrowRight, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { CodeBlock } from '../components/ui/CodeBlock';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../lib/context';
import { cn } from '../lib/utils';

interface DesignPattern {
  id: string;
  title: string;
  tech: string;
  bottleneck: string;
  scenario: string;
  code: string;
}

const PatternCard: React.FC<{ sys: DesignPattern, studyMode: boolean }> = ({ sys, studyMode }) => {
  const [revealed, setRevealed] = useState(false);
  const isVisible = !studyMode || revealed;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden group">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-5/12 p-8 border-b md:border-b-0 md:border-r border-white/[0.05] bg-white/[0.01]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Box className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
              <h3 className="text-xl font-semibold text-white tracking-tight">{sys.title}</h3>
            </div>
            
            {studyMode && (
              <button 
                onClick={() => setRevealed(!revealed)}
                className={cn(
                  "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors border shrink-0",
                  revealed ? "bg-white/5 border-white/10 text-neutral-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                )}
              >
                {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            )}
          </div>
          <div className="inline-flex px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] text-neutral-300 text-[10px] font-mono rounded-md mb-8 uppercase tracking-widest">
            {sys.tech}
          </div>
          <div className="space-y-5">
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-amber-500"></div> Bottleneck
              </span>
              <p className="text-neutral-300 text-sm font-medium">{sys.bottleneck}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest block mb-2">Scenario</span>
              <p className="text-neutral-400 text-[13px] leading-relaxed">{sys.scenario}</p>
            </div>
          </div>
        </div>
        
        <div className="md:w-7/12 p-8 flex flex-col bg-[#0a0a0a]">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Code2 className="w-4 h-4 text-emerald-500" strokeWidth={1.5} /> Implementation Pattern
          </span>
          <div className="flex-1 mt-2 relative">
            <AnimatePresence mode="wait">
              {isVisible ? (
                <motion.div 
                  key="code"
                  initial={studyMode ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <CodeBlock 
                    code={sys.code} 
                    title={sys.id === 'ingest' ? 'rate-limiter.lua' : 'implementation.ts'} 
                  />
                </motion.div>
              ) : (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.04] transition-colors p-6"
                  onClick={() => setRevealed(true)}
                >
                  <BrainCircuit className="w-8 h-8 text-neutral-600 mb-3" />
                  <p className="text-neutral-400 text-sm font-medium">How would you implement this pattern?</p>
                  <p className="text-neutral-500 text-xs mt-1">Think about the syntax, then click to reveal.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SystemDesign: React.FC<{ data: DesignPattern[], label: string }> = ({ data, label }) => {
  const { dossier } = useDossierContext();
  const [studyMode, setStudyMode] = useState(false);
  
  if (!dossier || !data) return null;
  const patterns = data;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Network className="w-5 h-5 text-neutral-400" />
          </div>
          {label}
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
          <p className="leading-relaxed"><strong>Active Recall Mode:</strong> The 'Implementation Pattern' code blocks are hidden. Analyze the bottleneck and scenario, visualize the code, and then reveal the answer.</p>
        </div>
      )}

      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-10 shadow-2xl mb-10 flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)]"></div>
        <div className="hidden md:block absolute top-1/2 left-10 right-10 h-px bg-gradient-to-r from-cyan-500/0 via-white/10 to-emerald-500/0 -z-0 -translate-y-1/2"></div>
        
        <div className="z-10 bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-5 w-full md:w-52 text-center shadow-[0_0_30px_rgba(6,182,212,0.05)] mb-4 md:mb-0 relative group">
          <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl", dossier.brandColor === 'cyan' ? "bg-cyan-500/5" : "bg-indigo-500/5")}></div>
          <FastForward className={cn("w-8 h-8 mx-auto mb-3 opacity-80", dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400")} strokeWidth={1.5} />
          <h4 className="font-semibold text-white text-sm tracking-wide">1. Edge API</h4>
          <p className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-widest font-mono">Gateway Layer</p>
        </div>
        
        <ArrowRight className="z-10 text-neutral-600 hidden md:block" strokeWidth={1} />
        
        <div className="z-10 bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-5 w-full md:w-52 text-center shadow-[0_0_30px_rgba(99,102,241,0.05)] mb-4 md:mb-0 relative group">
          <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl", dossier.brandColor === 'cyan' ? "bg-cyan-500/5" : "bg-indigo-500/5")}></div>
          <Layers className="w-8 h-8 text-neutral-400 mx-auto mb-3 opacity-80" strokeWidth={1.5} />
          <h4 className="font-semibold text-white text-sm tracking-wide">2. Event Bus</h4>
          <p className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-widest font-mono">Stream Processing</p>
        </div>
        
        <ArrowRight className="z-10 text-neutral-600 hidden md:block" strokeWidth={1} />

        <div className="z-10 bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-5 w-full md:w-52 text-center shadow-[0_0_30px_rgba(16,185,129,0.05)] relative group">
          <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl", dossier.brandColor === 'cyan' ? "bg-cyan-500/5" : "bg-indigo-500/5")}></div>
          <GitPullRequest className={cn("w-8 h-8 mx-auto mb-3 opacity-80", dossier.brandColor === 'cyan' ? "text-emerald-400" : "text-blue-400")} strokeWidth={1.5} />
          <h4 className="font-semibold text-white text-sm tracking-wide">3. Workers</h4>
          <p className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-widest font-mono">Service Cluster</p>
        </div>
      </div>

      <div className="space-y-8">
        {patterns.map((sys, idx) => (
          <PatternCard key={idx} sys={sys} studyMode={studyMode} />
        ))}
      </div>
    </motion.div>
  );
};
