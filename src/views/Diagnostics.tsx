import React, { useEffect, useState } from 'react';
import { Activity, Database, Brain, Cpu, Clock, RefreshCw, CheckCircle2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface Stats {
  totalChunks: number;
  interactions: number;
  learnedAssets: number;
  model: string;
  uptime: number;
}

export const Diagnostics: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/intelligence/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

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
            <Activity className="text-cyan-400" /> System Diagnostics
          </h2>
          <p className="text-neutral-500 text-xs mt-2 font-mono uppercase tracking-widest">Real-time Intelligence Engine Monitoring</p>
        </div>
        <button 
          onClick={fetchStats}
          className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 transition-colors"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Database className="text-cyan-400" />} 
          label="Knowledge Base" 
          value={`${stats?.totalChunks || 0}`} 
          sub="Indexed Chunks" 
        />
        <StatCard 
          icon={<Brain className="text-indigo-400" />} 
          label="Neural Growth" 
          value={`${stats?.learnedAssets || 0}`} 
          sub="Learned Proposals" 
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-400" />} 
          label="Interaction Lab" 
          value={`${stats?.interactions || 0}`} 
          sub="Historical Drills" 
        />
        <StatCard 
          icon={<Clock className="text-amber-400" />} 
          label="Engine Uptime" 
          value={stats ? formatUptime(stats.uptime) : '0h 0m'} 
          sub="Active Service" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* MODEL STATUS */}
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-6 space-y-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Cpu size={16} className="text-cyan-500" /> Core Model Configuration
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <span className="text-xs text-neutral-500 font-mono">PRIMARY_ENGINE</span>
              <span className="text-xs text-cyan-400 font-bold font-mono">{stats?.model}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <span className="text-xs text-neutral-500 font-mono">VECTOR_DIMENSIONS</span>
              <span className="text-xs text-indigo-400 font-bold font-mono">3072-D</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <span className="text-xs text-neutral-500 font-mono">RECOVERY_MODE</span>
              <span className="text-xs text-emerald-400 font-bold font-mono">AUTOMATIC</span>
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY LOGS STUB */}
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-2xl p-6 space-y-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Shield size={16} className="text-rose-500" /> Security & Integrity
          </h3>
          <div className="space-y-4 font-mono text-[10px] text-neutral-600">
            <div className="flex gap-3">
              <span className="text-emerald-500">[OK]</span>
              <span>RAG SYNCHRONIZATION STABLE</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">[OK]</span>
              <span>SQLITE PERSISTENCE LAYER ACTIVE</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">[OK]</span>
              <span>MULTI-TENANT SCHEMA READY</span>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-500">[WARN]</span>
              <span>GEMINI API QUOTA (FREE_TIER) MONITORED</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: any, label: string, value: string, sub: string }) => (
  <div className="bg-[#0d0d0d] border border-white/[0.05] p-6 rounded-2xl shadow-xl space-y-4 hover:border-white/10 transition-all group">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/[0.02] rounded-lg group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div>
      <div className="text-3xl font-black text-white font-mono">{value}</div>
      <div className="text-[10px] text-neutral-600 uppercase tracking-widest mt-1 font-semibold">{sub}</div>
    </div>
  </div>
);
