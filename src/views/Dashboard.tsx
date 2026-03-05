import React, { useState } from 'react';
import { Terminal, ShieldAlert, CheckSquare, XCircle, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { StatusCard } from '../components/ui/StatusCard';
import { useDossierContext } from '../App';
import { cn } from '../lib/utils';

interface DashboardProps {
  data: any;
  label: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, label }) => {
  const { dossier } = useDossierContext();
  const [studyMode, setStudyMode] = useState(false);
  const [failCriteriaRevealed, setFailCriteriaRevealed] = useState(false);
  const [goldenRuleRevealed, setGoldenRuleRevealed] = useState(false);
  
  if (!dossier || !data) return null;

  const { kpis, failCriteria, goldenRule } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
              <Terminal className="w-5 h-5 text-neutral-400" />
            </div>
            {label}
          </h2>
          <div className="text-neutral-500 text-sm mt-2 ml-12">{dossier.name} Operational Parameters.</div>
        </div>

        <button 
          onClick={() => setStudyMode(!studyMode)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm",
            studyMode 
              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
              : "bg-[#0d0d0d] border-white/[0.1] text-neutral-400 hover:text-white"
          )}
        >
          <BrainCircuit className="w-4 h-4" />
          {studyMode ? 'Exit Study Mode' : 'Active Recall'}
        </button>
      </div>

      {studyMode && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl text-indigo-200/80 text-sm flex items-start gap-3">
          <BrainCircuit className="w-5 h-5 shrink-0 text-indigo-400" />
          <p className="leading-relaxed"><strong>Active Recall Mode:</strong> Critical operational constraints are hidden. Visualize the fail criteria and the core golden rule for this architecture before revealing.</p>
        </div>
      )}

      {kpis && (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl relative flex flex-col">
          <div 
            className={cn(
              "px-6 py-4 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]",
              studyMode && "cursor-pointer hover:bg-white/[0.04] transition-colors"
            )}
            onClick={() => studyMode && setFailCriteriaRevealed(!failCriteriaRevealed)}
          >
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Automatic Fail Criteria
            </h3>
            {studyMode && (
              <button className="text-neutral-500 hover:text-neutral-300">
                {failCriteriaRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>

          <div className="p-6 flex-1">
            {(!studyMode || failCriteriaRevealed) ? (
              <ul className="space-y-3 font-mono text-[13px]">
                {failCriteria?.map((text: string, i: number) => (
                  <li key={i} className="flex gap-3 text-neutral-400 items-start bg-rose-500/[0.03] p-3 rounded-lg border border-rose-500/[0.08]">
                    <XCircle className="w-4 h-4 text-rose-500/80 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 cursor-pointer" onClick={() => setFailCriteriaRevealed(true)}>
                <BrainCircuit className="w-10 h-10 text-neutral-700 mb-4" />
                <p className="text-neutral-500 text-sm">What are the absolute deal-breakers for this role?</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl relative flex flex-col">
          <div 
            className={cn(
              "px-6 py-4 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]",
              studyMode && "cursor-pointer hover:bg-white/[0.04] transition-colors"
            )}
            onClick={() => studyMode && setGoldenRuleRevealed(!goldenRuleRevealed)}
          >
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className={cn("w-4 h-4", dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400")} /> The Golden Rule
            </h3>
            {studyMode && (
              <button className="text-neutral-500 hover:text-neutral-300">
                {goldenRuleRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>

          <div className="p-8 flex-1 flex flex-col justify-center">
            {(!studyMode || goldenRuleRevealed) ? (
              <blockquote className="text-neutral-400 text-[15px] leading-relaxed border-l-2 border-white/20 pl-4 py-1 italic">
                "{goldenRule}"
              </blockquote>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 cursor-pointer" onClick={() => setGoldenRuleRevealed(true)}>
                <BrainCircuit className="w-10 h-10 text-neutral-700 mb-4" />
                <p className="text-neutral-500 text-sm">Recall the #1 principle for this architectural domain.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
