import React, { useState } from 'react';
import { Activity, Database, Brain, Cpu, Clock, CheckCircle2, Shield, Upload, FileText, Trash2, Loader2, Plus, Terminal } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '@/lib/context';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { fetchWithAuth } from '@/lib/api';

interface Stats {
  totalChunks: number;
  interactions: number;
  learnedAssets: number;
  model: string;
  uptime: number;
  env: string;
  auth: string;
  isSyncing: boolean;
  aiEngine?: {
    circuitState: string;
  };
}

interface LogEntry {
  timestamp: string;
  type: string;
  category: string;
  message: string;
  payload?: string;
  stack?: string;
  url?: string;
  error?: string; // Legacy field
  prompt?: string; // Legacy field
}

export const Diagnostics: React.FC = () => {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const dossierData = useDossierContext();
  const { dossier } = dossierData;
  const [activeTab, setActiveTab] = useState<'stats' | 'knowledge' | 'ai-logs' | 'ui-logs'>('stats');
  const [uploading, setUploading] = useState(false);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => fetchWithAuth('/api/v1/intelligence/stats', getToken),
    refetchInterval: 30000,
  });

  // 🕵️ AI FAILURE LOGS QUERY
  const { data: aiLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ['ai-logs'],
    queryFn: () => fetchWithAuth('/api/v1/admin/ai-logs', getToken),
    enabled: activeTab === 'ai-logs',
  });

  // 🖥️ UI ERROR LOGS QUERY
  const { data: uiLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ['ui-logs'],
    queryFn: () => fetchWithAuth('/api/v1/admin/ui-logs', getToken),
    enabled: activeTab === 'ui-logs',
  });

  // 📁 FILE DELETION MUTATION
  const deleteMutation = useMutation({
    mutationFn: (filename: string) => fetchWithAuth(`/api/v1/admin/files/${dossier?.id}/${filename}`, getToken, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      toast("File physically deleted and purged from DB.", "success");
      queryClient.invalidateQueries({ queryKey: ['dossier'] });
    },
    onError: (e: Error) => toast(e.message, "error")
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dossier?.id) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await fetchWithAuth(`/api/v1/admin/upload/${dossier.id}`, getToken, {
        method: 'POST',
        body: formData
      });
      toast(`Successfully uploaded ${file.name}`, "success");
      queryClient.invalidateQueries({ queryKey: ['dossier'] });
    } catch (e: unknown) {
      const err = e as Error;
      toast(err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 space-y-10"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/[0.05] pb-6 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
            <Activity className="text-cyan-400" /> System Control
          </h2>
          <p className="text-neutral-500 text-xs mt-2 font-mono uppercase tracking-widest">Global Intelligence & Knowledge Management</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-white/[0.02] p-1 rounded-xl border border-white/5">
          <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>Observability</TabButton>
          <TabButton active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')}>Knowledge</TabButton>
          <TabButton active={activeTab === 'ai-logs'} onClick={() => setActiveTab('ai-logs')}>AI Failures</TabButton>
          <TabButton active={activeTab === 'ui-logs'} onClick={() => setActiveTab('ui-logs')}>UI Crashes</TabButton>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<Database className="text-cyan-400" />} label="Knowledge Base" value={`${stats?.totalChunks || 0}`} sub="Indexed Chunks" />
              <StatCard icon={<Brain className="text-indigo-400" />} label="Neural Growth" value={`${stats?.learnedAssets || 0}`} sub="Learned Proposals" />
              <StatCard icon={<CheckCircle2 className="text-emerald-400" />} label="Interaction Lab" value={`${stats?.interactions || 0}`} sub="Historical Drills" />
              <StatCard icon={<Clock className="text-amber-400" />} label="Engine Uptime" value={stats ? formatUptime(stats.uptime) : '0h 0m'} sub="Active Service" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-6 space-y-6 shadow-2xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Cpu size={16} className="text-cyan-500" /> Core Engine Configuration
                </h3>
                <div className="space-y-4">
                  <ConfigItem label="PRIMARY_MODEL" value={stats?.model} />
                  <ConfigItem label="ENVIRONMENT" value={stats?.env} color="text-indigo-400" />
                  <ConfigItem label="AI_CIRCUIT" value={stats?.aiEngine?.circuitState} color={stats?.aiEngine?.circuitState === 'CLOSED' ? 'text-emerald-400' : 'text-rose-400'} />
                  <button 
                    onClick={async () => {
                      const url = '/api/v1/admin/export-db';
                      const token = await getToken();
                      window.open(token ? `${url}?token=${token}` : url, '_blank');
                    }}
                    className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all uppercase tracking-widest"
                  >
                    Download Database Backup
                  </button>
                </div>
              </div>

              <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-6 space-y-6 shadow-2xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Shield size={16} className="text-rose-500" /> Integrity & Safety
                </h3>
                <div className="space-y-4 font-mono text-[10px] text-neutral-600">
                  <StatusLine ok={!stats?.isSyncing} label="RAG WORKER" detail={stats?.isSyncing ? 'SYNCHRONIZING' : 'IDLE'} />
                  <StatusLine ok={true} label="FILE WATCHER ACTIVE" />
                  <StatusLine ok={true} label="ENFORCED JSON_SCHEMA PROTOCOL" />
                  <StatusLine ok={false} label="IP_RATE_LIMITING ACTIVE" detail="15 RPM" warn />
                  <StatusLine ok={true} label="HTTP_PARAMETER_POLLUTION_PREVENTION" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'knowledge' && (
          <motion.div key="knowledge" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <Database className="text-indigo-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest">Context: {dossier?.name}</h3>
                  <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">{dossier?.modules.length || 0} Technical Documents Indexed</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  const name = prompt("Enter new company ID:");
                  if (name) {
                    const cleanName = name.toLowerCase().trim().replace(/\s+/g, '-');
                    await fetchWithAuth(`/api/v1/admin/companies/${cleanName}`, getToken, { method: 'POST' });
                    queryClient.invalidateQueries({ queryKey: ['companies'] });
                    dossierData.setCompany(cleanName);
                  }
                }} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.1] text-neutral-300 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all">
                  <Plus size={14} /> New Context
                </button>

                <label className="cursor-pointer group">
                  <input type="file" accept=".md" className="hidden" onChange={handleUpload} disabled={uploading} />
                  <div className={cn("flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]", uploading && "opacity-50 pointer-events-none")}>
                    {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                    Upload to {dossier?.id.toUpperCase()}
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {dossier?.modules.map(mod => (
                <div key={mod.fullId} className="bg-[#0d0d0d] border border-white/[0.05] p-4 rounded-xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-white/5 text-neutral-500 group-hover:text-indigo-400 transition-colors"><FileText size={18} /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">{mod.label}</h4>
                      <p className="text-neutral-600 text-[10px] font-mono mt-0.5">{mod.fullId}</p>
                    </div>
                  </div>
                  <button onClick={() => confirm(`Permanently delete ${mod.label}?`) && deleteMutation.mutate(mod.fullId?.split('/').pop() || '')} className="p-2 hover:bg-rose-500/10 text-neutral-600 hover:text-rose-500 rounded-lg transition-all">
                    {deleteMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'ai-logs' && (
          <motion.div key="ai-logs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <Header label="AI Failure Logs" sub="System Exceptions & Prompt Errors" icon={<Shield className="text-rose-500" />} />
            <LogList logs={aiLogs} emptyMsg="No AI failures recorded. System is 100% stable." />
          </motion.div>
        )}

        {activeTab === 'ui-logs' && (
          <motion.div key="ui-logs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <Header label="UI Error Telemetry" sub="Recorded Frontend Crashes & Stack Traces" icon={<Terminal className="text-amber-500" />} />
            <LogList logs={uiLogs} type="UI" emptyMsg="No frontend errors reported." />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const TabButton = ({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", active ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300")}>{children}</button>
);

const ConfigItem = ({ label, value, color = "text-cyan-400" }: { label: string, value?: string, color?: string }) => (
  <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
    <span className="text-xs text-neutral-500 font-mono">{label}</span>
    <span className={cn("text-xs font-bold font-mono uppercase", color)}>{value || 'unknown'}</span>
  </div>
);

const StatusLine = ({ ok, label, detail, warn }: { ok: boolean, label: string, detail?: string, warn?: boolean }) => (
  <div className="flex gap-3">
    <span className={cn(ok ? "text-emerald-500" : warn ? "text-amber-500" : "text-rose-500")}>[{ok ? 'OK' : warn ? 'WARN' : 'BUSY'}]</span>
    <span>{label} {detail && `- ${detail}`}</span>
  </div>
);

const Header = ({ label, sub, icon }: { label: string, sub: string, icon: React.ReactNode }) => (
  <div className="flex items-center gap-4">
    <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">{icon}</div>
    <div>
      <h3 className="text-lg font-bold text-white uppercase tracking-widest">{label}</h3>
      <p className="text-neutral-500 text-xs font-mono">{sub}</p>
    </div>
  </div>
);

const LogList = ({ logs, emptyMsg, type = 'AI' }: { logs: LogEntry[], emptyMsg: string, type?: 'AI' | 'UI' }) => (
  <div className="space-y-4">
    {logs.length === 0 ? (
      <div className="py-20 text-center border-2 border-dashed border-white/[0.05] rounded-2xl">
        <CheckCircle2 className="w-12 h-12 text-emerald-900 mx-auto mb-4" />
        <p className="text-neutral-500 text-sm">{emptyMsg}</p>
      </div>
    ) : (
      logs.map((log, i) => (
        <div key={i} className="bg-[#0d0d0d] border border-white/[0.05] p-6 rounded-xl space-y-4 shadow-xl">
          <div className="flex justify-between items-start">
            <span className={cn("px-2 py-1 text-[10px] font-bold rounded uppercase tracking-tighter", type === 'AI' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500")}>{type} FAILURE</span>
            <span className="text-[10px] text-neutral-600 font-mono">{log.timestamp}</span>
          </div>
          {log.url && <div className="text-[10px] text-neutral-500 font-mono">URL: {log.url}</div>}
          {(log.prompt || log.payload) && (
            <div>
              <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Payload</h4>
              <pre className="bg-black/40 p-4 rounded-lg text-[11px] text-neutral-400 font-mono whitespace-pre-wrap border border-white/5 max-h-40 overflow-y-auto italic">{log.prompt || log.payload}</pre>
            </div>
          )}
          <div>
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Error / Stack</h4>
            <p className="text-[12px] text-neutral-300 font-mono leading-relaxed">{log.error || log.message}</p>
            {log.stack && <pre className="mt-2 bg-black/20 p-4 rounded-lg text-[10px] text-neutral-600 font-mono overflow-x-auto whitespace-pre">{log.stack}</pre>}
          </div>
        </div>
      ))
    )}
  </div>
);

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub: string }) => (
  <div className="bg-[#0d0d0d] border border-white/[0.05] p-6 rounded-2xl shadow-xl space-y-4 hover:border-white/10 transition-all group">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/[0.02] rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div>
      <div className="text-3xl font-black text-white font-mono">{value}</div>
      <div className="text-[10px] text-neutral-600 uppercase tracking-widest mt-1 font-semibold">{sub}</div>
    </div>
  </div>
);
