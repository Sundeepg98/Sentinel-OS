import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '../lib/utils';
import { useDossierContext } from '../App';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SidebarProps {
  activeModuleId: string;
  setActiveModuleId: (id: string) => void;
  onDiagnosticsClick: () => void;
  diagnosticsActive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeModuleId, 
  setActiveModuleId, 
  onDiagnosticsClick,
  diagnosticsActive
}) => {
  const { dossier, loading } = useDossierContext();
  const [arenaIds, setArenaIds] = useLocalStorage<string[]>('architect_arena_selection', []);

  const togglePin = (e: React.MouseEvent, fullId: string) => {
    e.stopPropagation();
    if (arenaIds.includes(fullId)) {
      setArenaIds(arenaIds.filter(id => id !== fullId));
    } else {
      setArenaIds([...arenaIds, fullId]);
    }
  };

  if (loading || !dossier) {
    return (
      <aside className="w-[280px] bg-[#0a0a0a]/80 backdrop-blur-xl border-r border-white/[0.05] flex-col justify-between hidden md:flex z-20 shrink-0">
        <div className="p-8">
          <div className="w-32 h-8 bg-white/5 animate-pulse rounded-md mb-4" />
          <div className="w-48 h-4 bg-white/5 animate-pulse rounded-full" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[280px] bg-[#0a0a0a]/80 backdrop-blur-xl border-r border-white/[0.05] flex flex-col justify-between hidden md:flex z-20 shrink-0">
      <div className="overflow-y-auto custom-scrollbar flex-1">
        <div className="p-8 pb-6">
          <h1 className="font-semibold text-lg text-white tracking-tight flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-md border border-white/10 shadow-sm",
              dossier.brandColor === 'cyan' ? "bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
            )}>
              <Icons.Server className={cn("w-5 h-5", dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400")} />
            </div>
            {dossier.name}<span className="text-neutral-500 font-light">_OS</span>
          </h1>
          <div className="flex items-center gap-2 mt-4 inline-flex bg-white/[0.03] border border-white/[0.05] rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <span className="text-[11px] font-medium text-neutral-400 tracking-wide">Target: {dossier.targetRole}</span>
          </div>
        </div>
        
        <nav className="px-4 space-y-1 mt-4">
          <div className="px-4 pb-2 text-[10px] font-semibold text-neutral-600 uppercase tracking-widest flex justify-between items-center">
            <span>Modules</span>
            {arenaIds.length > 0 && (
              <span className="bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
                {arenaIds.length} in Arena
              </span>
            )}
          </div>
          
          {dossier.modules.map((mod) => {
            const IconComponent = (Icons as any)[mod.icon] || Icons.HelpCircle;
            const fullId = mod.fullId || `${dossier.id}/${mod.id}.md`;
            const isPinned = arenaIds.includes(fullId);

            return (
              <button
                key={mod.id}
                onClick={() => setActiveModuleId(mod.id)}
                className={cn(
                  "w-full flex items-center group gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left",
                  (activeModuleId === mod.id && !diagnosticsActive)
                    ? "bg-white/[0.06] text-white border-white/[0.08] shadow-sm" 
                    : "bg-transparent text-neutral-400 border-transparent hover:bg-white/[0.02] hover:text-neutral-200"
                )}
              >
                <div className={cn(
                  "transition-colors", 
                  (activeModuleId === mod.id && !diagnosticsActive)
                    ? (dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400") 
                    : "text-neutral-500"
                )}>
                  <IconComponent size={18} strokeWidth={1.5} />
                </div>
                <span className="flex-1 truncate">{mod.label}</span>
                
                <div 
                  onClick={(e) => togglePin(e, fullId)}
                  className={cn(
                    "p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100",
                    isPinned ? "text-indigo-400 opacity-100 bg-indigo-500/10" : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                  )}
                  title={isPinned ? "Remove from Arena" : "Add to Architect Arena"}
                >
                  <Icons.Pin size={14} className={isPinned ? "fill-current" : ""} />
                </div>
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="p-4 border-t border-white/[0.05] space-y-4">
        <button
          onClick={onDiagnosticsClick}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
            diagnosticsActive 
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]" 
              : "bg-white/[0.02] border-white/[0.05] text-neutral-500 hover:text-white hover:border-white/10"
          )}
        >
          <Icons.Activity size={16} />
          System Status
        </button>

        <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 p-4 rounded-xl border border-white/[0.05]">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Engineering Dossier v2.5.0<br/>
            <span className="text-neutral-600 font-mono">ARCHITECT_MODE: ENABLED</span>
          </p>
        </div>
      </div>
    </aside>
  );
};
