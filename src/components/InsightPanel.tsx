import React, { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, Hash, Loader2, Mic, MicOff, PenTool, X } from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';

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

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
};

export const InsightPanel: React.FC<InsightPanelProps> = ({ fullId }) => {
  const { toast } = useToast();
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<DrillData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [sessionId, setSessionId] = useState(getUUID());
  const [showCanvas, setShowCanvas] = useState(false);

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
        toast("Speech Recognition is not supported in this browser.", "error");
      }
    }
  };

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      setDrill(null);
      setEvalData(null);
      setUserAnswer('');
      setShowCanvas(false);
      setSessionId(getUUID());
      try {
        const response = await fetch(`/api/v1/intelligence/insights?fileId=${encodeURIComponent(fullId)}`);
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
      const response = await fetch('/api/v1/intelligence/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fullId })
      });
      const json = await response.json();
      if (json.error) toast(json.error, "error"); else setDrill(json);
    } catch (e) {
      toast("Failed to generate technical drill.", "error");
    } finally {
      setDrillLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!drill || !userAnswer.trim()) return;
    setEvalLoading(true);
    try {
      const response = await fetch('/api/v1/intelligence/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: fullId,
          question: drill.question, 
          idealResponse: drill.idealResponse, 
          userAnswer,
          sessionId 
        })
      });
      const json = await response.json();
      setEvalData(json);
      toast("Evaluation complete.", "success");
    } catch (e) {
      toast("Failed to evaluate proposal.", "error");
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className={cn("shrink-0 flex flex-col gap-6 animate-in fade-in duration-700 pb-10 transition-all duration-500", showCanvas ? "w-[700px]" : "w-80")}>
      <div className="bg-[#0d0d0d] border border-indigo-500/20 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> AI Deep Drill
          </div>
          {drill && (
            <button 
              onClick={() => setShowCanvas(!showCanvas)}
              className={cn(
                "p-1.5 rounded-md transition-all border",
                showCanvas ? "bg-cyan-500 text-black border-cyan-400" : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"
              )}
            >
              {showCanvas ? <X size={12} /> : <PenTool size={12} />}
            </button>
          )}
        </div>

        {!drill ? (
          <button 
            onClick={generateDrill}
            disabled={drillLoading || !fullId}
            className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-200 text-[12px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {drillLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain size={14} />}
            {drillLoading ? 'Analyzing...' : 'Generate Mock Question'}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-[13px] text-neutral-200 leading-relaxed font-medium italic">"{drill.question}"</div>
            
            <div className="flex gap-4 min-h-[350px]">
              {showCanvas && (
                <div className="flex-1 border border-white/10 rounded-lg overflow-hidden bg-black shadow-inner">
                  <Whiteboard sessionId={`module-${fullId}`} />
                </div>
              )}
              
              <div className={cn("flex flex-col gap-3", showCanvas ? "w-72" : "w-full")}>
                {!evalData ? (
                  <>
                    <div className="relative flex-1 min-h-[150px]">
                      <textarea 
                        placeholder="Speak or type your architectural proposal..."
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="w-full h-full bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 pr-12 text-[12px] text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/50 resize-none font-sans"
                      />
                      <button onClick={toggleRecording} className={cn("absolute top-2 right-2 p-2 rounded-md transition-all", isRecording ? "bg-rose-500/20 text-rose-500 animate-pulse" : "text-neutral-500 hover:text-neutral-300")}>
                        {isRecording ? <Mic size={14} /> : <MicOff size={14} />}
                      </button>
                    </div>
                    <button onClick={submitAnswer} disabled={evalLoading || !userAnswer.trim()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all uppercase tracking-widest disabled:opacity-50">
                      {evalLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Response'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-white/5 animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-tighter">
                      <span className="text-neutral-500 text-[10px]">Staff Score</span>
                      <span className={cn(parseInt(evalData.score) >= 7 ? "text-emerald-400" : "text-rose-400")}>{evalData.score}</span>
                    </div>
                    <div className="text-[12px] text-neutral-300 leading-relaxed bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg max-h-[250px] overflow-y-auto">{evalData.feedback}</div>
                    <button onClick={() => { setEvalData(null); setUserAnswer(''); }} className="w-full text-[10px] text-neutral-500 hover:text-white uppercase font-bold tracking-widest pt-2">Next Drill</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-widest">
          <Brain className="w-3.5 h-3.5 text-cyan-400" /> Key Concepts
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-6 w-16 bg-white/5 animate-pulse rounded-md" />) : 
            data?.keywords?.map(k => (
              <span key={k} className="px-2 py-1 bg-white/[0.03] border border-white/[0.05] rounded-md text-[11px] text-neutral-300 font-mono flex items-center gap-1">
                <Hash className="w-3 h-3 opacity-40" /> {k}
              </span>
            ))
          }
        </div>
      </div>
    </div>
  );
};
