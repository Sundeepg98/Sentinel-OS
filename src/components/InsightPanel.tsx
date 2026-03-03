import React, { useState, useEffect } from 'react';
import { Brain, Link as LinkIcon, Sparkles, Hash } from 'lucide-react';
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

interface InsightPanelProps {
  fullId: string;
  brandColor: string;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ fullId, brandColor }) => {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
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

  if (!data && !loading) return null;

  return (
    <div className="w-80 shrink-0 hidden xl:flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-700">
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
      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-5 shadow-2xl flex-1">
        <div className="flex items-center gap-2 mb-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-widest">
          <LinkIcon className="w-3.5 h-3.5 text-indigo-400" /> Related Knowledge
        </div>
        <div className="space-y-3">
          {loading ? (
            [1,2].map(i => <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-lg" />)
          ) : data?.related.length === 0 ? (
            <p className="text-[12px] text-neutral-600 italic">No cross-references found for this module.</p>
          ) : (
            data?.related.map((rel, i) => (
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

      {/* Active Recall Teaser */}
      <div className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/10 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl -z-10 rounded-full" />
        <div className="flex items-center gap-2 mb-3 text-cyan-400/80 font-bold uppercase text-[10px] tracking-widest">
          <Sparkles className="w-3.5 h-3.5" /> Intelligence Tip
        </div>
        <p className="text-[12px] text-neutral-400 leading-relaxed italic">
          "The concepts found here also appear in your {data?.related[0]?.company || 'other'} prep. Focus on synthesizing how {data?.keywords[0]} applies to both contexts."
        </p>
      </div>
    </div>
  );
};
