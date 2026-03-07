import { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  AlertTriangle,
  Clock,
  Shield,
  Play,
  Send,
  Loader2,
  RefreshCw,
  PenTool,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useDossierContext } from '@/lib/context';
import { Whiteboard } from '@/components/Whiteboard';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { fetchWithAuth } from '@/lib/api';

interface Incident {
  title: string;
  description: string;
  logs: string[];
  rootCause: string;
  idealMitigation: string;
}

interface Evaluation {
  score: string;
  feedback: string;
  missedSteps: string[];
}

export const WarRoom = () => {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { dossier } = useDossierContext();
  const [status, setStatus] = useState<
    'idle' | 'generating' | 'active' | 'evaluating' | 'completed'
  >('idle');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [userMitigation, setUserMitigation] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleLogs]);

  useEffect(() => {
    if (status === 'active' && incident && visibleLogs.length < incident.logs.length) {
      const timeout = setTimeout(
        () => {
          setVisibleLogs((prev) => [...prev, incident.logs[prev.length]]);
        },
        Math.random() * 800 + 400
      );
      return () => clearTimeout(timeout);
    }
  }, [status, incident, visibleLogs]);

  useEffect(() => {
    if (status === 'active' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus('completed');
            toast('Simulation Time Expired. System Failure Imminent.', 'error');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [status, timeLeft, toast]);

  // 1. Incident Generation Mutation
  const incidentMutation = useMutation({
    mutationFn: () => {
      const moduleIds = dossier?.modules?.map((m) => m.fullId).slice(0, 3) || [];
      return fetchWithAuth<Incident>('/intelligence/incident', getToken, {
        method: 'POST',
        body: JSON.stringify({ moduleIds }),
      });
    },
    onSuccess: (data) => {
      setIncident(data);
      setStatus('active');
      setVisibleLogs([]);
      setTimeLeft(180);
      setEvaluation(null);
      setUserMitigation('');
      setShowCanvas(false);
      toast('P0 Incident Triggered. Secure the perimeter.', 'info');
    },
    onError: (e: Error) => {
      toast('Chaos Synthesis Failed: ' + e.message, 'error');
      setStatus('idle');
    },
  });

  // 2. Mitigation Evaluation Mutation
  const evalMutation = useMutation({
    mutationFn: () => {
      if (!incident) throw new Error('No active incident');
      return fetchWithAuth<Evaluation>('/intelligence/incident/evaluate', getToken, {
        method: 'POST',
        body: JSON.stringify({ incident, userAnswer: userMitigation }),
      });
    },
    onSuccess: (data) => {
      setEvaluation(data);
      setStatus('completed');
      toast('Incident Evaluation Received.', 'success');
    },
    onError: (e: Error) => {
      toast('Post-Mortem Failure: ' + e.message, 'error');
      setStatus('completed');
    },
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden relative shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50">
        <div className="flex items-center gap-3">
          <Terminal className="text-cyan-400" size={20} />
          <h2 className="text-lg font-bold text-white uppercase tracking-widest">
            Incident War Room
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {(status === 'active' || status === 'completed') && (
            <button
              onClick={() => setShowCanvas(!showCanvas)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                showCanvas
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              )}
            >
              {showCanvas ? <X size={14} /> : <PenTool size={14} />}
              {showCanvas ? 'Close Canvas' : 'Architect Canvas'}
            </button>
          )}

          {status === 'active' && (
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-sm font-bold animate-pulse',
                timeLeft < 60 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              )}
            >
              <Clock size={16} />
              T-MINUS {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={cn(
            'flex flex-col border-r border-white/5 transition-all duration-500',
            showCanvas ? 'flex-1' : 'flex-[2]'
          )}
        >
          {status === 'idle' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <Shield className="w-16 h-16 text-neutral-600 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">Simulate a Production Outage</h3>
              <p className="text-neutral-400 max-w-md mb-8">
                The AI will generate a critical infrastructure failure based on your dossier. You
                have 3 minutes to diagnose the streaming logs and propose a fix.
              </p>
              <button
                onClick={() => {
                  setStatus('generating');
                  incidentMutation.mutate();
                }}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                <Play size={18} /> Start Simulation
              </button>
            </div>
          ) : status === 'generating' ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-4" />
              <p className="text-neutral-500 font-mono animate-pulse uppercase tracking-widest text-sm">
                Synthesizing Chaos...
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-rose-500/5 border-b border-rose-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0 mt-1" size={18} />
                  <div>
                    <h4 className="font-bold text-rose-400 text-sm uppercase tracking-wide">
                      P0 ALERT: {incident?.title}
                    </h4>
                    <p className="text-neutral-300 text-sm mt-1">{incident?.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-[#050505] p-6 overflow-y-auto font-mono text-sm">
                <AnimatePresence>
                  {visibleLogs.map((log, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i}
                      className={cn(
                        'mb-2 break-all',
                        log.toLowerCase().includes('error') || log.toLowerCase().includes('fatal')
                          ? 'text-rose-400'
                          : log.toLowerCase().includes('warn')
                            ? 'text-amber-400'
                            : 'text-emerald-400/70'
                      )}
                    >
                      <span className="text-neutral-600 mr-2">
                        [{new Date().toISOString().split('T')[1].slice(0, -1)}]
                      </span>
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logsEndRef} />
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {showCanvas && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-white/5 overflow-hidden bg-black"
            >
              <div className="h-full p-4">
                <Whiteboard sessionId={`warroom-${incident?.title || 'general'}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={cn(
            'transition-all duration-500 bg-neutral-900/30 relative',
            showCanvas ? 'w-80' : 'w-96'
          )}
        >
          {(status === 'active' || status === 'evaluating') && (
            <div className="flex-1 flex flex-col p-6 h-full">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">
                Mitigation Console
              </h3>
              <textarea
                value={userMitigation}
                onChange={(e) => setUserMitigation(e.target.value)}
                placeholder="Describe your root cause hypothesis and immediate mitigation steps..."
                className="flex-1 w-full bg-black/40 border border-white/10 rounded-lg p-4 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-cyan-500/50"
                disabled={status !== 'active'}
              />
              <button
                onClick={() => evalMutation.mutate()}
                disabled={status !== 'active' || !userMitigation.trim() || evalMutation.isPending}
                className="mt-4 w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-xs"
              >
                {evalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Deploy Fix
              </button>
            </div>
          )}

          {status === 'completed' && evaluation && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right-4 duration-500 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                  Post-Mortem
                </h3>
                <span
                  className={cn(
                    'text-lg font-black',
                    parseInt(evaluation.score) >= 7 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {evaluation.score}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">
                    Technical Feedback
                  </h4>
                  <p className="text-sm text-neutral-200 leading-relaxed">{evaluation.feedback}</p>
                </div>

                {evaluation.missedSteps && evaluation.missedSteps.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-rose-500 uppercase mb-2">
                      Critical Misses
                    </h4>
                    <ul className="list-disc pl-4 space-y-1">
                      {evaluation.missedSteps.map((step, i) => (
                        <li key={i} className="text-sm text-neutral-400">
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-lg">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2">
                    Actual Root Cause
                  </h4>
                  <p className="text-sm text-neutral-300">{incident?.rootCause}</p>
                </div>
              </div>

              <button
                onClick={() => setStatus('idle')}
                className="mt-8 w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-xs"
              >
                <RefreshCw size={16} /> New Incident
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
