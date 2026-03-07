import React, { useState, useEffect, useRef } from 'react';
import { Swords, Brain, Loader2, Send, X, ShieldAlert, CheckCircle2, ChevronUp, ChevronDown, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { fetchWithAuth } from '@/lib/api';

interface ArenaModule {
  id: string;
  label: string;
  content: string;
}

interface EvaluationData {
  score: string;
  feedback: string;
  followUp: string;
}

export const ArchitectArena: React.FC = () => {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [arenaIds, setArenaIds] = useLocalStorage<string[]>('architect_arena_selection', []);
  const [drill, setDrill] = useState<{question: string, idealResponse: string} | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [evalData, setEvalData] = useState<EvaluationData | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sessionId, setSessionId] = useState('');

  // --- VOICE ARTICULATION LAYER ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 1. Fetch All Modules for filtering
  const { data: allModules = [] } = useQuery<ArenaModule[]>({
    queryKey: ['arena-discovery'],
    queryFn: () => fetchWithAuth('/api/v1/intelligence/search?q=*', getToken),
    enabled: arenaIds.length > 0
  });

  const selectedModules = allModules.filter(m => arenaIds.includes(m.id));

  useEffect(() => {
    if (arenaIds.length > 0) setSessionId(crypto.randomUUID());
  }, [arenaIds.length]);

  // 2. Synthesis Drill Mutation
  const drillMutation = useMutation({
    mutationFn: async () => {
      // 1. SEMANTIC CROSS-POLLINATION
      const semanticContext = await fetchWithAuth('/api/v1/intelligence/semantic-search', getToken, {
        method: 'POST',
        body: JSON.stringify({ 
          q: selectedModules.map(m => m.label).join(" and "), 
          limit: 5 
        })
      });
      const crossDossierContext = (semanticContext as any[]).map((c) => c.chunk_text).join("\n\n---\n\n");

      // 2. GENERATE DRILL
      return fetchWithAuth('/api/v1/intelligence/drill', getToken, {
        method: 'POST',
        body: JSON.stringify({ 
          fileId: arenaIds[0], 
          extraContext: `PRIMARY MODULES:\n${selectedModules.map(m => m.content).join("\n\n")}\n\nSEMANTICALLY RETRIEVED BRIDGING CONTEXT:\n${crossDossierContext}`,
          isSynthesis: true 
        })
      });
    },
    onSuccess: (data) => {
      setDrill(data);
      setEvalData(null);
      setUserAnswer('');
    },
    onError: (e: Error) => toast(e.message, "error")
  });

  // 3. Evaluation Mutation
  const evalMutation = useMutation({
    mutationFn: () => {
      if (!drill) throw new Error('No drill active');
      return fetchWithAuth('/api/v1/intelligence/evaluate', getToken, {
        method: 'POST',
        body: JSON.stringify({ 
          fileId: arenaIds[0],
          question: drill.question, 
          idealResponse: drill.idealResponse, 
          userAnswer,
          sessionId 
        })
      });
    },
    onSuccess: (data) => {
      setEvalData(data as EvaluationData);
      toast("Strategy evaluated.", "success");
    },
    onError: (e: Error) => toast(e.message, "error")
  });

// --- 🛰️ TYPE DEFINITIONS FOR EXPERIMENTAL SPEECH API ---
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

// ...

  useEffect(() => {
    const WindowSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (WindowSpeechRecognition) {
      recognitionRef.current = new WindowSpeechRecognition() as SpeechRecognition;
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setUserAnswer(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + event.results[i][0].transcript);
          }
        }
      };
      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        toast("Speech recognition unavailable", "error");
      }
    }
  };

  if (arenaIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
          <Swords className="w-10 h-10 text-neutral-700" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-xl font-semibold text-white mb-2">The Architect's Arena</h2>
          <p className="text-neutral-500 text-sm leading-relaxed">Pin multiple technical modules from the sidebar to start a cross-dossier synthesis drill.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
            <Swords className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Architect's Arena</h2>
            <p className="text-neutral-500 text-sm mt-1 uppercase tracking-widest font-mono">Synthesizing {arenaIds.length} technical domains</p>
          </div>
        </div>
        
        <button 
          onClick={() => setArenaIds([])}
          className="text-xs text-neutral-500 hover:text-rose-400 transition-colors uppercase tracking-widest flex items-center gap-2"
        >
          <X size={14} /> Clear Selection
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {selectedModules.map(mod => (
          <div key={mod.id} className="bg-[#0d0d0d] border border-white/[0.08] px-4 py-3 rounded-xl flex items-center gap-3 shrink-0 group">
            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            <span className="text-sm font-medium text-neutral-300">{mod.label}</span>
            <button 
              onClick={() => setArenaIds(arenaIds.filter(id => id !== mod.id))}
              className="p-1 hover:bg-white/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} className="text-neutral-600 hover:text-rose-400" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {!drill ? (
          <div className="bg-[#0d0d0d] border border-indigo-500/20 rounded-2xl p-12 text-center space-y-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative space-y-4 max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-white">Generate Synthesis Drill</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Gemini will analyze the intersections between these technologies and challenge you with a high-stakes integration scenario.
              </p>
              <button 
                onClick={() => drillMutation.mutate()}
                disabled={drillMutation.isPending}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(99,102,241,0.2)] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {drillMutation.isPending ? <Loader2 className="animate-spin" /> : <Brain size={20} />}
                {drillMutation.isPending ? 'Analyzing Architectural Intersections...' : 'Commence Drill'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-8 shadow-3xl">
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-6">
                <ShieldAlert size={14} /> The Integration Challenge
              </div>
              <h4 className="text-lg text-white font-medium leading-relaxed">"{drill.question}"</h4>
            </div>

            {!evalData ? (
              <div className="space-y-4">
                <div className="relative">
                  <textarea 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Speak or type your architectural approach, trade-offs, and integration logic..."
                    className="w-full min-h-[250px] bg-[#080808] border border-white/[0.05] rounded-2xl p-6 pr-16 text-white placeholder:text-neutral-700 outline-none focus:border-indigo-500/30 transition-all text-[15px] leading-relaxed shadow-inner"
                  />
                  <button
                    onClick={toggleRecording}
                    className={`absolute top-4 right-4 p-3 rounded-full transition-all ${
                      isRecording 
                        ? 'bg-rose-500/20 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse' 
                        : 'bg-white/[0.02] text-neutral-500 hover:bg-white/[0.05] hover:text-white border border-white/[0.05]'
                    }`}
                  >
                    {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                </div>
                <button 
                  onClick={() => evalMutation.mutate()}
                  disabled={evalMutation.isPending || !userAnswer.trim()}
                  className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {evalMutation.isPending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                  Submit Proposal for Evaluation
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-xl text-center">
                    <span className="block text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">Architecture Score</span>
                    <span className="text-3xl font-mono font-bold text-white">{evalData.score}</span>
                  </div>
                  <div className="md:col-span-2 bg-[#0d0d0d] border border-white/[0.05] p-6 rounded-xl flex items-center">
                    <p className="text-[13px] text-neutral-300 leading-relaxed italic">"{evalData.feedback}"</p>
                  </div>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest">
                    <CheckCircle2 size={14} /> Critical Follow-up
                  </div>
                  <p className="text-white text-[15px] leading-relaxed font-medium">
                    {evalData.followUp}
                  </p>
                </div>

                <button 
                  onClick={() => { setEvalData(null); setDrill(null); }}
                  className="w-full py-3 text-neutral-500 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold"
                >
                  Return to Arena Briefing
                </button>
              </div>
            )}

            <button 
              onClick={() => setRevealed(!revealed)}
              className="w-full flex items-center justify-between py-3 px-6 bg-white/[0.02] border border-white/[0.05] rounded-xl text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <span>{revealed ? 'Hide Evaluation Criteria' : 'View Ideal Integration Response'}</span>
              {revealed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
              {revealed && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-white/[0.01] border-l-2 border-indigo-500/30 pl-6 py-2 overflow-hidden"
                >
                  <p className="text-sm text-neutral-400 leading-relaxed italic">{drill.idealResponse}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};
