import React, { useState } from 'react';
import { Activity, Database, Brain, Cpu, Clock, RefreshCw, CheckCircle2, Shield, Upload, FileText, Trash2, Loader2, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../App';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';

interface Stats {
  totalChunks: number;
  interactions: number;
  learnedAssets: number;
  model: string;
  uptime: number;
  env: string;
  auth: string;
  isSyncing: boolean;
}

export const Diagnostics: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dossier, allCompanies } = useDossierContext();
  const [activeTab, setActiveTab] = useState<'stats' | 'knowledge'>('stats');
  const [uploading, setUploading] = useState(false);

  const { data: stats, isLoading, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/v1/intelligence/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // 📁 FILE DELETION MUTATION
  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/v1/admin/files/${dossier?.id}/${filename}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      toast("File physically deleted and purged from DB.", "success");
      queryClient.invalidateQueries({ queryKey: ['dossier'] });
    },
    onError: (e: any) => toast(e.message, "error")
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dossier?.id) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/v1/admin/upload/${dossier.id}`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      toast(`Successfully uploaded ${file.name}`, "success");
      queryClient.invalidateQueries({ queryKey: ['dossier'] });
    } catch (e: any) {
      toast(e.message, "error");
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
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
            <Activity className="text-cyan-400" /> System Control
          </h2>
          <p className="text-neutral-500 text-xs mt-2 font-mono uppercase tracking-widest">Global Intelligence & Knowledge Management</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/[0.02] p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveTab('stats')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === 'stats' ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Observability
          </button>
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === 'knowledge' ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Knowledge Base
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' ? (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
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
                  <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <span className="text-xs text-neutral-500 font-mono">PRIMARY_MODEL</span>
                    <span className="text-xs text-cyan-400 font-bold font-mono">{stats?.model}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <span className="text-xs text-neutral-500 font-mono">ENVIRONMENT</span>
                    <span className="text-xs text-indigo-400 font-bold font-mono uppercase">{stats?.env || 'unknown'}</span>
                  </div>
                  <button 
                    onClick={() => window.open('/api/v1/admin/export-db', '_blank')}
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
                  <div className="flex gap-3">
                    <span className={cn(stats?.isSyncing ? "text-amber-500" : "text-emerald-500")}>[{stats?.isSyncing ? 'BUSY' : 'OK'}]</span>
                    <span>RAG WORKER {stats?.isSyncing ? 'SYNCHRONIZING' : 'IDLE'}</span>
                  </div>
                  <div className="flex gap-3"><span className="text-emerald-500">[OK]</span><span>FILE WATCHER ACTIVE</span></div>
                  <div className="flex gap-3"><span className="text-emerald-500">[OK]</span><span>ENFORCED JSON_SCHEMA PROTOCOL</span></div>
                  <div className="flex gap-3"><span className="text-amber-500">[WARN]</span><span>IP_RATE_LIMITING ACTIVE (15 RPM)</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="knowledge"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Database className="text-indigo-400" size={24} />
                <div className="flex flex-col gap-1">
                  <select 
                    value={dossier?.id || 'mailin'}
                    onChange={(e) => dossierData.setCompany(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-indigo-500/50 transition-all cursor-pointer uppercase tracking-widest"
                  >
                    {allCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} Dossier</option>
                    ))}
                  </select>
                  <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">{dossier?.modules.length} Technical Documents Indexed</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    const name = prompt("Enter new company ID (e.g., 'google'):");
                    if (name) {
                      fetch(`/api/v1/admin/companies/${name.toLowerCase()}`, { method: 'POST' })
                        .then(() => {
                          toast(`Company ${name} created.`, "success");
                          queryClient.invalidateQueries({ queryKey: ['companies'] });
                        })
                        .catch(e => toast(e.message, "error"));
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.1] text-neutral-300 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all"
                >
                  <Plus size={14} /> New Company
                </button>

                <label className="cursor-pointer group">
                  <input type="file" accept=".md" className="hidden" onChange={handleUpload} disabled={uploading} />
                  <div className={cn(
                    "flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]",
                    uploading && "opacity-50 pointer-events-none"
                  )}>
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
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-white/5 text-neutral-500 group-hover:text-indigo-400 transition-colors">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">{mod.label}</h4>
                      <p className="text-neutral-600 text-[10px] font-mono mt-0.5">{mod.fullId}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete ${mod.label}?`)) {
                          deleteMutation.mutate(mod.fullId.split('/').pop() || '');
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 hover:bg-rose-500/10 text-neutral-600 hover:text-rose-500 rounded-lg transition-all"
                      title="Permanently Delete Dossier"
                    >
                      {deleteMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              {dossier?.modules.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-white/[0.05] rounded-2xl">
                  <FileText className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-500 text-sm">No technical documents found in this dossier folder.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: any, label: string, value: string, sub: string }) => (
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

