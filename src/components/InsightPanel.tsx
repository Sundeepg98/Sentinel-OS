import { useState } from 'react';
import { Brain, Hash, Loader2, Search, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { fetchWithAuth } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

interface InsightPanelProps {
  fullId: string;
  brandColor?: string;
}

interface EvaluationData {
  score: string;
  feedback: string;
}

interface Drill {
  question: string;
  idealResponse: string;
}

interface InsightData {
  keywords: string[];
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ fullId }) => {
  const { getToken } = useAuth();
  const { toast: showToast } = useToast();
  const queryClient = useQueryClient();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [evalData, setEvalData] = useState<EvaluationData | null>(null);
  const [userAnswer, setUserAnswer] = useState('');

  // 1. Fetch Insights (Keywords)
  const { data, isLoading, error } = useQuery<InsightData>({
    queryKey: ['insights', fullId],
    queryFn: () =>
      fetchWithAuth<InsightData>(
        `/intelligence/insights?fileId=${encodeURIComponent(fullId)}`,
        getToken
      ),
    enabled: !!fullId,
    staleTime: 1000 * 60 * 5,
  });

  const generateDrill = useMutation({
    mutationFn: () =>
      fetchWithAuth<Drill>('/intelligence/drill', getToken, {
        method: 'POST',
        body: JSON.stringify({ fileId: fullId }),
      }),
    onSuccess: (data) => setDrill(data),
    onError: () => showToast('Failed to generate technical drill', 'error'),
  });

  // 3. Evaluation Mutation
  const evaluateDrill = useMutation({
    mutationFn: () => {
      if (!drill) throw new Error('No drill active');
      return fetchWithAuth<EvaluationData>('/intelligence/evaluate', getToken, {
        method: 'POST',
        body: JSON.stringify({
          fileId: fullId,
          question: drill.question,
          idealResponse: drill.idealResponse,
          userAnswer,
        }),
      });
    },
    onSuccess: (data) => {
      setEvalData(data);
      queryClient.invalidateQueries({ queryKey: ['graph'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
    onError: () => showToast('Evaluation failed', 'error'),
  });

  // ðŸš€ INTERACTIVE KEYWORDS: Trigger global search on click
  const handleKeywordClick = (keyword: string) => {
    window.dispatchEvent(
      new CustomEvent('trigger-search', {
        detail: { query: keyword },
      })
    );
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6 bg-[#050505]">
      {/* AI DEEP DRILL SECTION */}
      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl transition-all hover:border-white/10">
        <div className="p-5 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-400 font-bold uppercase text-[10px] tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Deep Drill
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!drill ? (
            <button
              onClick={() => generateDrill.mutate()}
              disabled={generateDrill.isPending}
              className="w-full py-3 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-neutral-300 rounded-lg text-[11px] font-bold transition-all uppercase tracking-widest flex items-center justify-center gap-2 group"
            >
              {generateDrill.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
              Generate Mock Question
            </button>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Search className="w-3 h-3" /> Question
                </div>
                <div className="text-[13px] text-white leading-relaxed font-medium">
                  {drill.question}
                </div>
              </div>

              {!evalData ? (
                <>
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Provide your Staff-level response..."
                    className="w-full h-32 bg-black/40 border border-white/5 rounded-lg p-4 text-xs text-neutral-300 outline-none focus:border-indigo-500/50 transition-all resize-none custom-scrollbar"
                  />
                  <button
                    onClick={() => evaluateDrill.mutate()}
                    disabled={evaluateDrill.isPending || !userAnswer.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all uppercase tracking-widest disabled:opacity-50"
                  >
                    {evaluateDrill.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Submit Response'
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-3 pt-2 animate-in slide-in-from-bottom-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-tighter">
                    <span className="text-neutral-500">Staff Score</span>
                    <span
                      className={cn(
                        parseInt(evalData.score) >= 7 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {evalData.score}
                    </span>
                  </div>
                  <div className="text-[12px] text-neutral-300 leading-relaxed bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg max-h-[250px] overflow-y-auto custom-scrollbar">
                    {evalData.feedback}
                  </div>
                  <button
                    onClick={() => {
                      setEvalData(null);
                      setUserAnswer('');
                    }}
                    className="w-full text-[10px] text-neutral-500 hover:text-white uppercase font-bold tracking-widest pt-2"
                  >
                    Next Drill
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KEY CONCEPTS SECTION */}
      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-5 shadow-2xl transition-all hover:border-white/10">
        <div className="flex items-center gap-2 mb-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-widest border-b border-white/5 pb-3">
          <Brain className="w-3.5 h-3.5 text-cyan-400" /> Key Concepts
        </div>

        {error ? (
          <div className="text-[10px] text-rose-400 font-mono italic">
            Failed to hydrate concepts.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-16 bg-white/5 animate-pulse rounded-md" />
              ))
            ) : data?.keywords && data.keywords.length > 0 ? (
              data.keywords.map((k: string) => (
                <button
                  key={k}
                  onClick={() => handleKeywordClick(k)}
                  className="px-2 py-1 bg-white/[0.03] border border-white/[0.05] rounded-md text-[11px] text-neutral-300 font-mono flex items-center gap-1 hover:bg-white/[0.08] hover:border-cyan-500/30 hover:text-cyan-400 transition-all cursor-pointer group"
                >
                  <Hash className="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:text-cyan-500 transition-all" />{' '}
                  {k}
                </button>
              ))
            ) : (
              <div className="text-[10px] text-neutral-600 font-mono italic">
                No semantic keywords found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
