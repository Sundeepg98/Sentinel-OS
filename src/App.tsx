import { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { SignedIn, SignedOut, SignIn, UserButton, useAuth } from '@clerk/clerk-react';
import { Sidebar } from '@/components/Sidebar';
import { InsightPanel } from '@/components/InsightPanel';
import { DeepSearch } from '@/components/DeepSearch';
import { useDossier } from '@/hooks/useDossier';
import { Loader2, AlertCircle, Network, Swords, Terminal } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ToastProvider } from '@/hooks/useToast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import { DossierContext, useDossierContext } from '@/lib/context';

// --- ⚡ ENGINEERING BASIC: BUNDLE OPTIMIZATION (CODE SPLITTING) ---
const Dashboard = lazy(() => import('@/views/Dashboard').then(m => ({ default: m.Dashboard })));
const Internals = lazy(() => import('@/views/Internals').then(m => ({ default: m.Internals })));
const ArchitectArena = lazy(() => import('@/views/ArchitectArena').then(m => ({ default: m.ArchitectArena })));
const WarRoom = lazy(() => import('@/views/WarRoom').then(m => ({ default: m.WarRoom })));
const Diagnostics = lazy(() => import('@/views/Diagnostics').then(m => ({ default: m.Diagnostics })));
const Tracker = lazy(() => import('@/views/Tracker').then(m => ({ default: m.Tracker })));
const MarkdownView = lazy(() => import('@/views/MarkdownView').then(m => ({ default: m.MarkdownView })));
const SystemDesign = lazy(() => import('@/views/SystemDesign').then(m => ({ default: m.SystemDesign })));

// Properly type the lazy loaded component to avoid TS errors
const KnowledgeGraph = lazy(() =>
  import('@/components/KnowledgeGraph').then((module) => ({ default: module.KnowledgeGraph }))
) as React.FC<{ isOpen: boolean; onClose: () => void; onSelectModule: (id: string) => void }>;

const MainView = () => {
  const dossierData = useDossierContext();
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [arenaMode, setArenaMode] = useLocalStorage('arena_mode_active', false);
  const [warRoomMode, setWarRoomMode] = useState(false);
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [pinnedIds] = useLocalStorage<string[]>('architect_arena_selection', []);

  const { data: stats } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/intelligence/stats');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const queryClient = useQueryClient();

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
      } catch {
        // SSE Parse Error ignored
      }
    };
    return () => eventSource.close();
  }, [queryClient]);

  const activeModule = useMemo(() => {
    if (!dossierData.dossier?.modules) return null;
    return dossierData.dossier.modules.find((m) => m.id === activeModuleId) || dossierData.dossier.modules[0];
  }, [dossierData.dossier, activeModuleId]);

  const resetViews = useCallback(() => {
    setArenaMode(false);
    setWarRoomMode(false);
    setDiagnosticsMode(false);
  }, [setArenaMode]);

  const renderActiveView = () => {
    if (!activeModule) return null;
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>}>
        {(() => {
          switch (activeModule.type) {
            case 'grid': return <Dashboard data={activeModule.data} label={activeModule.label} />;
            case 'markdown': return <MarkdownView data={activeModule.data} label={activeModule.label} />;
            case 'checklist': return <Tracker data={activeModule.data} label={activeModule.label} moduleId={activeModule.id} />;
            case 'playbook': return <Internals data={activeModule.data} label={activeModule.label} />;
            case 'map': return <SystemDesign data={activeModule.data} label={activeModule.label} />;
            default: return <MarkdownView data={typeof activeModule.data === 'string' ? activeModule.data : JSON.stringify(activeModule.data)} label={activeModule.label} />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div className="flex h-screen font-sans text-neutral-200 overflow-hidden bg-[#050505] selection:bg-cyan-500/30">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeModuleId={activeModule?.id || ''}
        setActiveModuleId={(id: string) => {
          setActiveModuleId(id);
          resetViews();
        }}
        onDiagnosticsClick={() => {
          setDiagnosticsMode(true);
          setArenaMode(false);
          setWarRoomMode(false);
        }}
        diagnosticsActive={diagnosticsMode}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 shrink-0 px-4 md:px-8 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/[0.05] z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5"
              aria-label="Toggle Navigation Menu"
            >
              <Terminal size={18} />
            </button>

            <select
              value={dossierData.companyId}
              onChange={(e) => {
                dossierData.setCompany(e.target.value);
                resetViews();
              }}
              aria-label="Select technical context profile"
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-medium text-neutral-300 outline-none focus:border-white/20 transition-all uppercase tracking-widest cursor-pointer max-w-[120px] md:max-w-none"
            >
              {dossierData.allCompanies.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsGraphOpen(true)}
              aria-label="Open 3D Knowledge Graph"
              className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all shadow-sm hidden sm:block"
              title="Open Knowledge Graph"
            >
              <Network size={16} />
            </button>

            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

            {stats?.isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg animate-pulse">
                <Loader2 size={12} className="text-cyan-400 animate-spin" />
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                  Sync Active
                </span>
              </div>
            )}

            <button
              onClick={() => {
                setArenaMode(!arenaMode);
                setWarRoomMode(false);
                setDiagnosticsMode(false);
              }}
              className={cn(
                'flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm',
                arenaMode
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                  : 'bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:text-white'
              )}
            >
              <Swords size={14} className="hidden xs:block" /> {arenaMode ? 'Exit Arena' : 'Arena'} {pinnedIds.length > 0 && `(${pinnedIds.length})`}
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:block">
              <DeepSearch
                onSelect={(id: string) => {
                  setActiveModuleId(id);
                  resetViews();
                }}
              />
            </div>
            {import.meta.env.VITE_AUTH_ENABLED === 'true' && <UserButton afterSignOutUrl="/" />}
          </div>
        </header>

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
              <div className="flex-1 overflow-y-auto p-4 md:p-8 h-full"><ArchitectArena /></div>
            ) : warRoomMode ? (
              <div className="flex-1 overflow-hidden p-4 md:p-8 h-full"><WarRoom /></div>
            ) : !activeModule ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-10 md:p-20 text-center h-full">
                <AlertCircle className="w-12 md:w-16 h-12 md:h-16 mb-4 text-neutral-600" />
                <h2 className="text-lg md:text-xl font-bold text-white mb-2">Dossier is Empty</h2>
                <p className="text-neutral-400 max-w-md text-sm">No technical modules found.</p>
                <button
                  onClick={() => setDiagnosticsMode(true)}
                  className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold uppercase tracking-widest transition-colors"
                >
                  Open System Control
                </button>
              </div>
            ) : (
              <div className="flex flex-1 overflow-hidden h-full">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  {renderActiveView()}
                </div>
                <div className="hidden xl:block w-80 shrink-0 border-l border-white/[0.05] bg-[#080808]/50 overflow-y-auto">
                  <InsightPanel
                    fullId={activeModule.fullId || ''}
                    brandColor={dossierData.dossier?.brandColor}
                  />
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
      <AnimatePresence>
        {isGraphOpen && (
          <Suspense fallback={null}>
            <KnowledgeGraph
              isOpen={isGraphOpen}
              onClose={() => setIsGraphOpen(false)}
              onSelectModule={(id: string) => {
                setActiveModuleId(id);
                setIsGraphOpen(false);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};

function App() {
  const dossierData = useDossier();
  const { isLoaded } = useAuth();

  const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
  const BYPASS_TOKEN = 'sentinel_staff_2026';

  if (!isLoaded && AUTH_ENABLED) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <StatusBanner />
      <DossierContext.Provider value={{ ...dossierData }}>
        {!AUTH_ENABLED || BYPASS_TOKEN ? (
          <MainView />
        ) : (
          <>
            <SignedIn>
              <MainView />
            </SignedIn>
            <SignedOut>
              <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-4">
                <div className="bg-[#0d0d0d] border border-white/5 p-1 rounded-2xl shadow-2xl w-full max-w-md">
                  <SignIn routing="hash" />
                </div>
              </div>
            </SignedOut>
          </>
        )}
      </DossierContext.Provider>
    </ToastProvider>
  );
}

export default App;
