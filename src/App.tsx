import { useState, Suspense, lazy, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { Sidebar } from '@/components/Sidebar';
import { InsightPanel } from '@/components/InsightPanel';
import { DeepSearch } from '@/components/DeepSearch';
import { useDossier } from '@/hooks/useDossier';
import { Loader2, Network, Swords, Terminal } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ToastProvider } from '@/hooks/useToast';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/lib/utils';
import { DossierContext, useDossierContext } from '@/lib/context';
import { env } from '@/lib/env';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { DashboardData, Task } from '@/types';
import type { DesignPattern } from '@/views/SystemDesign';
import type { PlaybookItem } from '@/views/Internals';

// --- ⚡ ENGINEERING BASIC: BUNDLE OPTIMIZATION (CODE SPLITTING) ---
const Dashboard = lazy(() => import('@/views/Dashboard').then((m) => ({ default: m.Dashboard })));
const Internals = lazy(() => import('@/views/Internals').then((m) => ({ default: m.Internals })));
const ArchitectArena = lazy(() =>
  import('@/views/ArchitectArena').then((m) => ({ default: m.ArchitectArena }))
);
const WarRoom = lazy(() => import('@/views/WarRoom').then((m) => ({ default: m.WarRoom })));
const Diagnostics = lazy(() =>
  import('@/views/Diagnostics').then((m) => ({ default: m.Diagnostics }))
);
const Tracker = lazy(() => import('@/views/Tracker').then((m) => ({ default: m.Tracker })));
const MarkdownView = lazy(() =>
  import('@/views/MarkdownView').then((m) => ({ default: m.MarkdownView }))
);
const SystemDesign = lazy(() =>
  import('@/views/SystemDesign').then((m) => ({ default: m.SystemDesign }))
);

// Properly type the lazy loaded component to avoid TS errors
const KnowledgeGraph = lazy(() =>
  import('@/components/KnowledgeGraph').then((module) => ({ default: module.KnowledgeGraph }))
) as React.FC<{ isOpen: boolean; onClose: () => void; onSelectModule: (id: string) => void }>;

function AppContent() {
  const [activeModuleId, setActiveModuleId] = useState('00_master_analysis');
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isArenaOpen, setArenaMode] = usePersistentState('architect_arena_mode', false);
  const [isWarRoomOpen, setWarRoomMode] = useState(false);
  const [isDiagnosticsOpen, setDiagnosticsMode] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const dossierData = useDossierContext(); // 🛡️ STAFF BASIC: Consume from Context instead of re-calling hook
  const queryClient = useQueryClient();

  // 🛡️ STAFF BASIC: Centralized View Navigation
  const navigateToView = useCallback(
    (view: 'arena' | 'warroom' | 'diagnostics' | 'dossier', moduleId?: string) => {
      setArenaMode(view === 'arena');
      setWarRoomMode(view === 'warroom');
      setDiagnosticsMode(view === 'diagnostics');
      if (moduleId) {
        setActiveModuleId(moduleId);
      }
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [setArenaMode]
  );

  // Optimized derived state
  const activeModule = useMemo(
    () =>
      dossierData.dossier?.modules.find((m) => m.id === activeModuleId) ||
      dossierData.dossier?.modules[0],
    [dossierData.dossier, activeModuleId]
  );

  const diagnosticsActive = isDiagnosticsOpen || !activeModule;

  const renderActiveView = () => {
    if (!activeModule) return null;
    return (
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        }
      >
        {(() => {
          switch (activeModule.type) {
            case 'grid':
              return (
                <Dashboard data={activeModule.data as DashboardData} label={activeModule.label} />
              );
            case 'markdown':
              return <MarkdownView data={activeModule.data as string} label={activeModule.label} />;
            case 'checklist':
              return (
                <Tracker
                  data={activeModule.data as Task[]}
                  label={activeModule.label}
                  moduleId={activeModule.id}
                />
              );
            case 'playbook':
              return (
                <Internals data={activeModule.data as PlaybookItem[]} label={activeModule.label} />
              );
            case 'map':
              return (
                <SystemDesign
                  data={activeModule.data as DesignPattern[]}
                  label={activeModule.label}
                />
              );
            default:
              return (
                <MarkdownView
                  data={
                    typeof activeModule.data === 'string'
                      ? activeModule.data
                      : JSON.stringify(activeModule.data)
                  }
                  label={activeModule.label}
                />
              );
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div
      data-testid="app-shell"
      className="flex h-screen font-sans text-neutral-200 overflow-hidden bg-[#050505] selection:bg-cyan-500/30"
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeModuleId={activeModuleId}
        setActiveModuleId={(id) => navigateToView('dossier', id)}
        diagnosticsActive={diagnosticsActive}
        onDiagnosticsClick={() => navigateToView('diagnostics')}
        warRoomActive={isWarRoomOpen}
        onWarRoomClick={() => navigateToView('warroom')}
      />

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* MOBILE HEADER */}
        <header
          data-testid="mobile-header"
          className="md:hidden flex items-center justify-between p-4 border-b border-white/[0.05] bg-[#0a0a0a]/80 backdrop-blur-lg z-30"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-neutral-400 hover:text-white transition-colors"
          >
            <Network size={20} />
          </button>
          <div className="font-bold text-sm tracking-tight text-white">
            {dossierData.dossier?.name || 'SENTINEL'}_OS
          </div>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* TOP NAVIGATION & SEARCH */}
        <div
          data-testid="desktop-nav"
          className="p-4 md:p-6 border-b border-white/[0.05] bg-[#080808]/50 flex flex-wrap items-center justify-between gap-4 z-20"
        >
          <div className="flex items-center gap-3">
            <select
              value={dossierData.companyId}
              onChange={(e) => {
                dossierData.setCompany(e.target.value);
                navigateToView('dossier');
              }}
              aria-label="Select technical context profile"
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-medium text-neutral-300 outline-none focus:border-white/20 transition-all uppercase tracking-widest cursor-pointer max-w-[120px] md:max-w-none"
            >
              {dossierData.allCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsGraphOpen(true)}
              title="Open 3D Knowledge Graph"
              data-testid="graph-toggle"
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 uppercase tracking-widest transition-all group"
            >
              <Network
                size={14}
                className="group-hover:rotate-12 transition-transform"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Open 3D Knowledge Graph</span>
            </button>

            <button
              onClick={() => navigateToView(isArenaOpen ? 'dossier' : 'arena')}
              data-testid="arena-toggle"
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                isArenaOpen
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              )}
            >
              <Swords size={14} /> Arena{' '}
              {isArenaOpen && dossierData.dossier && (
                <span className="ml-1 opacity-70">
                  (
                  {import.meta.env.VITE_AUTH_ENABLED === 'true'
                    ? JSON.parse(localStorage.getItem('architect_arena_selection') || '[]').length
                    : 3}
                  )
                </span>
              )}
            </button>

            <button
              onClick={() => navigateToView(isWarRoomOpen ? 'dossier' : 'warroom')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                isWarRoomOpen
                  ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              )}
            >
              <Terminal size={14} /> War Room
            </button>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <DeepSearch onSelect={(id) => navigateToView('dossier', id)} />
            <div className="hidden md:block">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>

        {/* CONTENT LAYOUT */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <ErrorBoundary>
              {isArenaOpen ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  }
                >
                  <ArchitectArena />
                </Suspense>
              ) : isWarRoomOpen ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  }
                >
                  <WarRoom />
                </Suspense>
              ) : isDiagnosticsOpen ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  }
                >
                  <Diagnostics />
                </Suspense>
              ) : (
                renderActiveView()
              )}
            </ErrorBoundary>
          </div>

          {activeModule && !isArenaOpen && !isWarRoomOpen && !isDiagnosticsOpen && (
            <div className="hidden xl:block w-80 shrink-0 border-l border-white/[0.05] bg-[#080808]/50 overflow-y-auto">
              <ErrorBoundary>
                <InsightPanel
                  key={activeModule.fullId || activeModule.id}
                  fullId={activeModule.fullId || ''}
                  brandColor={dossierData.dossier?.brandColor}
                />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </main>

      <Suspense fallback={null}>
        {isGraphOpen && (
          <ErrorBoundary>
            <KnowledgeGraph
              isOpen={isGraphOpen}
              onClose={() => setIsGraphOpen(false)}
              onSelectModule={(id) => {
                setActiveModuleId(id);
                setIsGraphOpen(false);
                navigateToView('dossier', id);
              }}
            />
          </ErrorBoundary>
        )}
      </Suspense>

      <StatusBanner onSyncComplete={() => queryClient.invalidateQueries()} />
    </div>
  );
}

function App() {
  const dossierData = useDossier();

  return (
    <ErrorBoundary>
      <ToastProvider>
        <DossierContext.Provider value={dossierData}>
          {env.VITE_AUTH_ENABLED ? (
            <>
              <SignedIn>
                <AppContent />
              </SignedIn>
              <SignedOut>
                <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%)] pointer-events-none" />
                  <div className="z-10 w-full max-w-md space-y-8 text-center">
                    <div className="space-y-4">
                      <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
                        <Terminal size={32} />
                      </div>
                      <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
                        Sentinel-OS Access
                      </h1>
                      <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest">
                        Authorized Personnel Only
                      </p>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/[0.05] p-8 rounded-3xl shadow-2xl space-y-6">
                      <SignIn routing="hash" />
                    </div>
                  </div>
                </div>
              </SignedOut>
            </>
          ) : (
            <AppContent />
          )}
        </DossierContext.Provider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
