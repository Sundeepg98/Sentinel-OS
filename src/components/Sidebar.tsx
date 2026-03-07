import React from 'react';
import {
  Server,
  X,
  Pin,
  Activity,
  HelpCircle,
  Database,
  Brain,
  Shield,
  FileText,
  Zap,
  Layout,
  Cpu,
  Network,
  Swords,
  Terminal,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDossierContext } from '@/lib/context';
import { usePersistentState } from '@/hooks/usePersistentState';

// Map for dynamic icon lookup from dossier metadata
const IconMap: Record<string, LucideIcon> = {
  Database,
  Brain,
  Shield,
  FileText,
  Zap,
  Layout,
  Cpu,
  Network,
  Swords,
  Terminal,
  Search,
  HelpCircle,
};

interface SidebarProps {
  activeModuleId: string;
  setActiveModuleId: (id: string) => void;
  onDiagnosticsClick: () => void;
  diagnosticsActive: boolean;
  warRoomActive: boolean;
  onWarRoomClick: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const SidebarComponent: React.FC<SidebarProps> = ({
  activeModuleId,
  setActiveModuleId,
  onDiagnosticsClick,
  diagnosticsActive,
  warRoomActive,
  onWarRoomClick,
  isOpen = true,
  onClose,
}) => {
  const { dossier, loading } = useDossierContext();
  const [arenaIds, setArenaIds] = usePersistentState<string[]>('architect_arena_selection', []);

  const togglePin = (e: React.MouseEvent, fullId: string) => {
    e.stopPropagation();
    if (arenaIds.includes(fullId)) {
      setArenaIds(arenaIds.filter((id) => id !== fullId));
    } else {
      setArenaIds([...arenaIds, fullId]);
    }
  };

  const handleModuleClick = (id: string) => {
    setActiveModuleId(id);
    if (window.innerWidth < 768 && onClose) onClose();
  };

  const handleDiagnosticsClick = () => {
    onDiagnosticsClick();
    if (window.innerWidth < 768 && onClose) onClose();
  };

  if (loading || !dossier) {
    return (
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/[0.05] flex-col justify-between transition-transform duration-300 md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-8">
          <div className="w-32 h-8 bg-white/5 animate-pulse rounded-md mb-4" />
          <div className="w-48 h-4 bg-white/5 animate-pulse rounded-full" />
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      {/* SIDEBAR PANEL */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-72 bg-[#080808] border-r border-white/[0.05] z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-sm font-black text-white tracking-tighter uppercase">
              {dossier.name}
              <span className="text-neutral-400 font-light">_OS</span>
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="px-4 mt-4">
            <div className="px-4 pb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest flex justify-between items-center">
              <span>Modules</span>
              {arenaIds.length > 0 && (
                <span className="bg-indigo-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.4)]">
                  {arenaIds.length} in Arena
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {dossier.modules.map((mod) => {
                const isActive = mod.id === activeModuleId;
                const fullId = `${dossier.id}/${mod.id}.md`.toLowerCase();
                const isPinned = arenaIds.includes(fullId);
                const Icon = IconMap[mod.icon || 'FileText'] || FileText;

                return (
                  <li key={mod.id} className="group flex items-center gap-1 pr-2">
                    <button
                      onClick={() => handleModuleClick(mod.id)}
                      className={cn(
                        'flex-1 flex items-center group gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left',
                        isActive
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/5'
                          : 'bg-transparent text-neutral-400 border-transparent hover:bg-white/[0.02] hover:text-neutral-200'
                      )}
                    >
                      {isActive ? (
                        <Zap size={16} className="text-indigo-400 animate-pulse" />
                      ) : (
                        <Icon
                          size={16}
                          className="opacity-40 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                      <span className="truncate">{mod.label}</span>
                    </button>

                    <button
                      onClick={(e) => togglePin(e, fullId)}
                      aria-label={isPinned ? 'Unpin from Arena' : 'Pin to Architect Arena'}
                      title={isPinned ? 'Remove from Arena' : 'Add to Architect Arena'}
                      className={cn(
                        'p-1.5 rounded-md transition-all',
                        isPinned
                          ? 'text-indigo-400 opacity-100 bg-indigo-500/10'
                          : 'opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-400 hover:bg-white/5'
                      )}
                    >
                      <Pin size={12} className={isPinned ? 'fill-current' : ''} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="p-4 border-t border-white/[0.05] space-y-2">
          <button
            onClick={() => {
              onWarRoomClick();
              if (window.innerWidth < 768 && onClose) onClose();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border',
              warRoomActive
                ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.15)]'
                : 'bg-white/[0.02] border-white/[0.05] text-neutral-300 hover:text-white hover:border-white/10'
            )}
          >
            <Terminal size={16} />
            War Room
          </button>

          <button
            onClick={handleDiagnosticsClick}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border',
              diagnosticsActive
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                : 'bg-white/[0.02] border-white/[0.05] text-neutral-300 hover:text-white hover:border-white/10'
            )}
          >
            <Activity size={16} />
            System Status
          </button>

          <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 p-4 rounded-xl border border-white/[0.05]">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Engineering Dossier v2.8.0
              <br />
              <span className="text-neutral-600 font-mono text-[9px]">ARCHITECT_MODE: ENABLED</span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export const Sidebar = React.memo(SidebarComponent);
