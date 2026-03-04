import React, { useState, useEffect, useRef } from 'react';
import { Swords, Brain, Loader2, Send, X, ShieldAlert, CheckCircle2, ChevronUp, ChevronDown, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface ArenaModule {
  id: string;
  label: string;
  content: string;
}

export const ArchitectArena: React.FC = () => {
  const [arenaIds, setArenaIds] = useLocalStorage<string[]>('architect_arena_selection', []);
  const [modules, setModules] = useState<ArenaModule[]>([]);
  const [, setLoading] = useState(false);
  const [drill, setDrill] = useState<{question: string, idealResponse: string} | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [evalData, setEvalData] = useState<any>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [sessionId, setSessionId] = useState('');

  // --- VOICE ARTICULATION LAYER ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setUserAnswer(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + event.results[i][0].transcript);
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        alert("Speech Recognition is not supported in this browser. Please use Chrome or Edge.");
      }
    }
  };
  // --------------------------------

  useEffect(() => {
    if (arenaIds.length === 0) {
      setModules([]);
      return;
    }
    setSessionId(crypto.randomUUID());

    const fetchAll = async () => {
      setLoading(true);
      try {
        // We reuse the search endpoint or a custom multi-fetch to get raw content
        const res = await fetch(`/api/v1/intelligence/search?q=*`); // placeholder logic
        const allData = await res.json();
        setModules(allData.filter((d: any) => arenaIds.includes(d.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [arenaIds]);

  const generateSynthesisDrill = async () => {
    setDrillLoading(true);
    setEvalData(null);
    setUserAnswer('');
    try {
      // 1. SEMANTIC CROSS-POLLINATION
      // Search for technical segments that bridge the pinned modules
      const searchRes = await fetch('/api/v1/intelligence/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          q: modules.map(m => m.label).join(" and "), 
          limit: 5 
        })
      });
      const semanticContext = await searchRes.json();
      const crossDossierContext = semanticContext.map((c: any) => c.chunk_text).join("\n\n---\n\n");

      // 2. GENERATE DRILL WITH SEMANTIC DEPTH
      const res = await fetch('/api/v1/intelligence/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: arenaIds[0], 
          extraContext: `PRIMARY MODULES:\n${modules.map(m => m.content).join("\n\n")}\n\nSEMANTICALLY RETRIEVED BRIDGING CONTEXT:\n${crossDossierContext}`,
          isSynthesis: true 
        })
      });
      const data = await res.json();
      setDrill(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDrillLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!drill || !userAnswer.trim()) return;
    setEvalLoading(true);
    try {
      const res = await fetch('/api/v1/intelligence/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: drill.question, 
          idealResponse: drill.idealResponse, 
          userAnswer,
          sessionId 
        })
      });
      setEvalData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setEvalLoading(false);
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

      {/* Selected Modules Horizontal Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {modules.map(mod => (
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
                onClick={generateSynthesisDrill}
                disabled={drillLoading}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(99,102,241,0.2)] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {drillLoading ? <Loader2 className="animate-spin" /> : <Brain size={20} />}
                {drillLoading ? 'Analyzing Architectural Intersections...' : 'Commence Drill'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Question Card */}
            <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-8 shadow-3xl">
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-6">
                <ShieldAlert size={14} /> The Integration Challenge
              </div>
              <h4 className="text-lg text-white font-medium leading-relaxed">"{drill.question}"</h4>
            </div>

            {/* Response Section */}
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
                    title={isRecording ? "Stop Recording" : "Start Voice Articulation"}
                  >
                    {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                </div>
                <button 
                  onClick={submitAnswer}
                  disabled={evalLoading || !userAnswer.trim()}
                  className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {evalLoading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
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
