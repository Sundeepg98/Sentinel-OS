import React, { useState, useEffect } from 'react';
import { Brain, Link as LinkIcon, Sparkles, Hash, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
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

interface EvalData {
  score: string;
  feedback: string;
  followUp: string;
}

interface InsightPanelProps {
  fullId: string;
  brandColor?: string;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ fullId }) => {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<DrillData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillRevealed, setDrillRevealed] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-2.5-flash' | 'gemini-2.5-pro'>('gemini-2.5-flash');

  // Conversational state
  const [userAnswer, setUserAnswer] = useState('');
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      setDrill(null);
      setEvalData(null);
      setUserAnswer('');
      setDrillRevealed(false);
      setSessionId(crypto.randomUUID());
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
    setEvalData(null);
    setUserAnswer('');
    try {
      const response = await fetch('/api/intelligence/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fullId, model: selectedModel })
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

  const submitAnswer = async () => {
    if (!drill || !userAnswer.trim()) return;
    setEvalLoading(true);
    try {
      const response = await fetch('/api/intelligence/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: drill.question, 
          idealResponse: drill.idealResponse, 
          userAnswer,
          sessionId,
          model: selectedModel 
        })
      });
      const json = await response.json();
      if (json.error) {
        alert(json.error);
      } else {
        setEvalData(json);
      }
    } catch (e) {
      console.error('Evaluation failed', e);
    } finally {
      setEvalLoading(false);
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
          <div className="flex gap-1 bg-white/[0.03] p-0.5 rounded-md border border-white/5">
            <button 
              onClick={() => setSelectedModel('gemini-2.5-flash')}
              className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all", selectedModel === 'gemini-2.5-flash' ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-400")}
            >
              Flash
            </button>
            <button 
              onClick={() => setSelectedModel('gemini-2.5-pro')}
              className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all", selectedModel === 'gemini-2.5-pro' ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-400")}
            >
              Pro
            </button>
          </div>
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
            
            {!evalData ? (
              <div className="space-y-3">
                <textarea 
                  placeholder="Draft your architectural response..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 text-[12px] text-white placeholder:text-neutral-600 min-h-[100px] outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
                <button 
                  onClick={submitAnswer}
                  disabled={evalLoading || !userAnswer.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50"
                >
                  {evalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={14} />}
                  Submit for Evaluation
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-white/[0.05] animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-bold">Evaluation</span>
                  <span className="text-[14px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{evalData.score}</span>
                </div>
                <div className="text-[12px] text-neutral-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.05]">
                  {evalData.feedback}
                </div>
                {evalData.followUp && (
                  <div className="text-[12px] text-indigo-300 italic border-l-2 border-indigo-500/50 pl-3">
                    <span className="font-bold text-indigo-400 block mb-1">Follow-up:</span>
                    {evalData.followUp}
                  </div>
                )}
                <button 
                  onClick={() => { setEvalData(null); setUserAnswer(''); }}
                  className="w-full py-1.5 text-[11px] text-neutral-500 hover:text-white transition-colors"
                >
                  Try another answer
                </button>
              </div>
            )}

            <button 
              onClick={() => setDrillRevealed(!drillRevealed)}
              className="w-full flex items-center justify-between py-2 px-3 bg-white/[0.03] border border-white/[0.05] rounded-md text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors mt-2"
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
