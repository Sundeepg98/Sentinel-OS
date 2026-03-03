import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '../lib/utils';
import { useDossierContext } from '../App';

interface SidebarProps {
  activeModuleId: string;
  setActiveModuleId: (id: string) => void;
}
export const Sidebar: React.FC<SidebarProps> = ({ activeModuleId, setActiveModuleId }) => {
  const { dossier, loading } = useDossierContext();

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
    <aside className="w-[280px] bg-[#0a0a0a]/80 backdrop-blur-xl border-r border-white/[0.05] flex-col justify-between hidden md:flex z-20 shrink-0">
...
      <div>
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
          <div className="px-4 pb-2 text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">Modules</div>
          {dossier.modules.map((mod) => {
            const IconComponent = (Icons as any)[mod.icon] || Icons.HelpCircle;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveModuleId(mod.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                  activeModuleId === mod.id 
                    ? "bg-white/[0.06] text-white border-white/[0.08] shadow-sm" 
                    : "bg-transparent text-neutral-400 border-transparent hover:bg-white/[0.02] hover:text-neutral-200"
                )}
              >
                <div className={cn(
                  "transition-colors", 
                  activeModuleId === mod.id 
                    ? (dossier.brandColor === 'cyan' ? "text-cyan-400" : "text-indigo-400") 
                    : "text-neutral-500"
                )}>
                  <IconComponent size={18} strokeWidth={1.5} />
                </div>
                {mod.label}
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="p-6 border-t border-white/[0.05]">
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 p-4 rounded-xl border border-white/[0.05]">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Engineering Dossier v2.4.0<br/>
            <span className="text-neutral-600">Strictly Confidential</span>
          </p>
        </div>
      </div>
    </aside>
  );
};
