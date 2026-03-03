import React, { useState, useEffect } from 'react';
import { Brain, Link as LinkIcon, Sparkles, Hash, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface InsightData {
  keywords: string[];
  related: Array<{
    fileId: string;
    company: string;
    sharedKeyword: string;
  }>;
}

interface DrillData {
  question: string;
  idealResponse: string;
}

interface InsightPanelProps {
  fullId: string;
  brandColor: string;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ fullId, brandColor }) => {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<DrillData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillRevealed, setDrillRevealed] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      setDrill(null);
      setDrillRevealed(false);
      try {
        const response = await fetch(`/api/intelligence/insights?fileId=${encodeURIComponent(fullId)}`);
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      } catch (e) {
        console.error('Insights failed', e);
      } finally {
        setLoading(false);
      }
    }

    if (fullId) fetchInsights();
  }, [fullId]);

  const generateDrill = async () => {
    setDrillLoading(true);
    try {
      const response = await fetch('/api/intelligence/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fullId })
      });
      const json = await response.json();
      if (json.error) {
        alert(json.error);
      } else {
        setDrill(json);
      }
    } catch (e) {
      console.error('Drill generation failed', e);
    } finally {
      setDrillLoading(false);
    }
  };

  if (!data && !loading) return null;

  return (
    <div className="w-80 shrink-0 hidden xl:flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-700 pb-10">
      {/* AI Deep Drill Section */}
      <div className="bg-[#0d0d0d] border border-indigo-500/20 rounded-xl p-5 shadow-[0_0_20px_rgba(99,102,241,0.05)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl -z-10 rounded-full" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> AI Deep Drill
          </div>
          {drill && (
            <button 
              onClick={() => setDrill(null)}
              className="text-[9px] text-neutral-600 hover:text-neutral-400 uppercase tracking-widest"
            >
              Reset
            </button>
          )}
        </div>

        {!drill ? (
          <button 
            onClick={generateDrill}
            disabled={drillLoading}
            className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-200 text-[12px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {drillLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain size={14} />}
            {drillLoading ? 'Analyzing Context...' : 'Generate Mock Question'}
          </button>
        ) : (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-[13px] text-neutral-200 leading-relaxed font-medium">
              "{drill.question}"
            </div>
            
            <button 
              onClick={() => setDrillRevealed(!drillRevealed)}
              className="w-full flex items-center justify-between py-2 px-3 bg-white/[0.03] border border-white/[0.05] rounded-md text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <span>{drillRevealed ? 'Hide Evaluation Criteria' : 'Reveal Ideal Response'}</span>
              {drillRevealed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <AnimatePresence>
              {drillRevealed && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="text-[12px] text-neutral-500 leading-relaxed italic border-l-2 border-indigo-500/30 pl-3 overflow-hidden"
                >
                  {drill.idealResponse}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Semantic Keywords */}
      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-widest">
          <Brain className="w-3.5 h-3.5 text-cyan-400" /> Key Concepts
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="h-6 w-16 bg-white/5 animate-pulse rounded-md" />)
          ) : (
            data?.keywords.map(k => (
              <span key={k} className="px-2 py-1 bg-white/[0.03] border border-white/[0.05] rounded-md text-[11px] text-neutral-300 font-mono flex items-center gap-1 hover:border-white/20 transition-colors">
                <Hash className="w-3 h-3 opacity-40" /> {k}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Cross-Dossier Relations */}
      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-widest">
          <LinkIcon className="w-3.5 h-3.5 text-indigo-400" /> Related Knowledge
        </div>
        <div className="space-y-3">
          {loading ? (
            [1,2].map(i => <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-lg" />)
          ) : !data || data.related.length === 0 ? (
            <p className="text-[12px] text-neutral-600 italic">No cross-references found for this module.</p>
          ) : (
            data.related.map((rel, i) => (
              <div key={i} className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:border-white/10 transition-all group cursor-default">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-tighter text-indigo-400 font-bold">{rel.company} Profile</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded border border-white/5 text-neutral-500 font-mono">
                    via {rel.sharedKeyword}
                  </span>
                </div>
                <p className="text-[12px] text-neutral-300 font-medium line-clamp-1 group-hover:text-white transition-colors">
                  {rel.fileId.split('/').pop()?.replace('.md', '')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
