import { useState, createContext, useContext, useEffect, Suspense, lazy } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { Internals } from './views/Internals';
import { ArchitectArena } from './views/ArchitectArena';
import { WarRoom } from './views/WarRoom';
import { Diagnostics } from './views/Diagnostics';
import { Tracker } from './views/Tracker';
import { MarkdownView } from './views/MarkdownView';
import { SystemDesign } from './views/SystemDesign';
import { InsightPanel } from './components/InsightPanel';
import { useDossier } from './hooks/useDossier';
import type { CompanyDossier } from './types';
import { Loader2, AlertCircle, Network, Swords, Terminal } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cn } from './lib/utils';
import { AnimatePresence } from 'framer-motion';

const KnowledgeGraph = lazy(() => import('./components/KnowledgeGraph').then(module => ({ default: module.KnowledgeGraph })));

interface DossierContextType {
  dossier: CompanyDossier | null;
  setCompany: (id: string) => void;
  allCompanies: {id: string, name: string}[];
  companyId: string;
}

export const DossierContext = createContext<DossierContextType>({
  dossier: null,
  setCompany: () => {},
  allCompanies: [],
  companyId: 'mailin'
});

export const useDossierContext = () => useContext(DossierContext);

function App() {
  const dossierData = useDossier();
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [arenaMode, setArenaMode] = useLocalStorage('arena_mode_active', false);
  const [warRoomMode, setWarRoomMode] = useState(false);
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [pinnedIds] = useLocalStorage<string[]>('architect_arena_selection', []);

  const queryClient = useQueryClient();

  // Sync Status Polling
  const { data: stats } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/intelligence/stats');
      return res.json();
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/v1/intelligence/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_COMPLETE') {
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['dossier'] });
          queryClient.invalidateQueries({ queryKey: ['insights'] });
          queryClient.invalidateQueries({ queryKey: ['graph'] });
          queryClient.invalidateQueries({ queryKey: ['sync-status'] });
        }
      } catch (e) {}
    };
    return () => eventSource.close();
  }, [queryClient]);

  useEffect(() => {
    setArenaMode(false);
    setWarRoomMode(false);
  }, [dossierData.companyId]);

  useEffect(() => {
    // Synchronize active module with the current dossier
    if (dossierData.dossier?.modules && dossierData.dossier.modules.length > 0) {
      const currentModuleExists = dossierData.dossier.modules.find(m => m.id === activeModuleId);
      if (!currentModuleExists) {
        setActiveModuleId(dossierData.dossier.modules[0].id);
      }
    } else if (dossierData.dossier) {
      setActiveModuleId('');
    }
  }, [dossierData.dossier?.id, dossierData.dossier?.modules]);

  const activeModule = dossierData.dossier?.modules?.find(m => m.id === activeModuleId);

  const resetViews = () => {
    setArenaMode(false);
    setWarRoomMode(false);
    setDiagnosticsMode(false);
  };

  const renderActiveView = () => {
    if (!activeModule) return null;

    switch (activeModule.type) {
      case 'grid':
        return <Dashboard data={activeModule.data} label={activeModule.label} />;
      case 'markdown':
        return <MarkdownView data={activeModule.data} label={activeModule.label} />;
      case 'checklist':
        return <Tracker data={activeModule.data} label={activeModule.label} moduleId={activeModule.id} />;
      case 'playbook':
        return <Internals data={activeModule.data} label={activeModule.label} />;
      case 'map':
        return <SystemDesign data={activeModule.data} label={activeModule.label} />;
      default:
        return <MarkdownView data={typeof activeModule.data === 'string' ? activeModule.data : JSON.stringify(activeModule.data)} label={activeModule.label} />;
    }
  };

  return (
    <ToastProvider>
      <DossierContext.Provider value={{ ...dossierData }}>
        <div className="flex h-screen font-sans text-neutral-200 overflow-hidden bg-[#050505] selection:bg-cyan-500/30">
          <Sidebar 
            activeModuleId={activeModuleId} 
            setActiveModuleId={(id) => { setActiveModuleId(id); resetViews(); }} 
            onDiagnosticsClick={() => { setDiagnosticsMode(true); setArenaMode(false); setWarRoomMode(false); }}
            diagnosticsActive={diagnosticsMode}
          />

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* NAVIGATION HEADER */}
            <header className="h-16 shrink-0 px-8 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/[0.05] z-30">
              <div className="flex items-center gap-4">
                <select 
                  value={dossierData.companyId}
                  onChange={(e) => {
                    dossierData.setCompany(e.target.value);
                    resetViews();
                  }}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-300 outline-none focus:border-white/20 transition-all cursor-pointer uppercase tracking-widest"
                >
                  {dossierData.allCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} Profile</option>
                  ))}
                </select>

                <button 
                  onClick={() => setIsGraphOpen(true)}
                  className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all shadow-sm"
                  title="Open Knowledge Graph"
                >
                  <Network size={16} />
                </button>

                <div className="h-4 w-px bg-white/10 mx-1" />

                {stats?.isSyncing && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg animate-pulse">
                    <Loader2 size={12} className="text-cyan-400 animate-spin" />
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Sync Active</span>
                  </div>
                )}

                <button 
                  onClick={() => { setArenaMode(!arenaMode); setWarRoomMode(false); setDiagnosticsMode(false); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm",
                    arenaMode 
                      ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" 
                      : "bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  <Swords size={14} />
                  Arena {pinnedIds.length > 0 && `(${pinnedIds.length})`}
                </button>
                
                <button 
                  onClick={() => { setWarRoomMode(!warRoomMode); setArenaMode(false); setDiagnosticsMode(false); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm",
                    warRoomMode 
                      ? "bg-rose-600 border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]" 
                      : "bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-rose-400 hover:border-rose-500/30"
                  )}
                >
                  <Terminal size={14} />
                  War Room
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => window.open('/api/v1/portfolio/export', '_blank')}
                  className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors uppercase tracking-widest px-3 py-1.5 border border-white/5 hover:border-white/20 rounded-lg bg-white/[0.02]"
                >
                  Export Portfolio
                </button>
              </div>
            </header>

            {/* CONTENT AREA */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              <ErrorBoundary>
                {dossierData.loading && !dossierData.dossier ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                ) : diagnosticsMode ? (
                  <div className="flex-1 overflow-y-auto">
                    <Diagnostics />
                  </div>
                ) : arenaMode ? (
                  <div className="flex-1 overflow-y-auto p-8 h-full">
                    <ArchitectArena />
                  </div>
                ) : warRoomMode ? (
                  <div className="flex-1 overflow-hidden p-8 h-full">
                    <WarRoom />
                  </div>
                ) : !activeModule ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-20 text-center h-full">
                    <AlertCircle className="w-16 h-16 mb-4 text-neutral-600" />
                    <h2 className="text-xl font-bold text-white mb-2">Dossier is Empty</h2>
                    <p className="text-neutral-400 max-w-md">No technical modules found. Upload Markdown files in System Control.</p>
                    <button 
                      onClick={() => setDiagnosticsMode(true)}
                      className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                      Open System Control
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 overflow-hidden h-full">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      {renderActiveView()}
                    </div>
                    <div className="w-80 shrink-0 border-l border-white/[0.05] bg-[#080808]/50 overflow-y-auto">
                      <InsightPanel fullId={activeModule.fullId || ''} brandColor={dossierData.dossier?.brandColor} />
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </main>
        </div>

        <AnimatePresence>
          {isGraphOpen && (
            <Suspense fallback={null}>
              <KnowledgeGraph isOpen={isGraphOpen} onClose={() => setIsGraphOpen(false)} onSelectModule={(id) => { setActiveModuleId(id); setIsGraphOpen(false); }} />
            </Suspense>
          )}
        </AnimatePresence>

      </DossierContext.Provider>
    </ToastProvider>
  );
}

export default App;
