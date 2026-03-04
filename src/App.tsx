import { useState, createContext, useContext, useEffect, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { Internals } from './views/Internals';
import { SystemDesign } from './views/SystemDesign';
import { Diagnostics } from './views/Diagnostics';
import { Tracker } from './views/Tracker';
import { MarkdownView } from './views/MarkdownView';
import { DeepSearch } from './components/DeepSearch';
import { InsightPanel } from './components/InsightPanel';
import { ArchitectArena } from './views/ArchitectArena';
import { WarRoom } from './views/WarRoom';
import { useDossier } from './hooks/useDossier';
import type { CompanyDossier } from './types';
import { Loader2, AlertCircle, Network, Swords, Terminal } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { cn } from './lib/utils';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/ErrorBoundary';

const KnowledgeGraph = lazy(() => import('./components/KnowledgeGraph').then(module => ({ default: module.KnowledgeGraph })));

interface DossierContextType {
  dossier: CompanyDossier | null;
  setCompany: (id: string) => void;
  allCompanies: { id: string; name: string }[];
  loading: boolean;
}

const DossierContext = createContext<DossierContextType | null>(null);

export const useDossierContext = () => {
  const context = useContext(DossierContext);
  if (!context) throw new Error('useDossierContext must be used within DossierProvider');
  return context;
};

function App() {
  const dossierData = useDossier();
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [arenaMode, setArenaMode] = useLocalStorage('arena_mode_active', false);
  const [warRoomMode, setWarRoomMode] = useState(false);
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [pinnedIds] = useLocalStorage<string[]>('architect_arena_selection', []);

  // Sync Status Polling
  const { data: stats } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/intelligence/stats');
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (dossierData.dossier?.modules && dossierData.dossier.modules.length > 0) {
      setActiveModuleId(dossierData.dossier.modules[0].id);
    }
  }, [dossierData.dossier?.id, dossierData.dossier?.modules]);

  const activeModule = dossierData.dossier?.modules?.find(m => m.id === activeModuleId);

  const resetViews = () => {
    setArenaMode(false);
    setWarRoomMode(false);
    setDiagnosticsMode(false);
  };

  return (
    <ToastProvider>
      <DossierContext.Provider value={{ ...dossierData }}>
        <div className="flex h-screen font-sans text-neutral-200 overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-100 bg-[#050505]">
          <Sidebar 
            activeModuleId={activeModuleId} 
            setActiveModuleId={(id) => { setActiveModuleId(id); resetViews(); }} 
            onDiagnosticsClick={() => { setDiagnosticsMode(true); setArenaMode(false); setWarRoomMode(false); }}
            diagnosticsActive={diagnosticsMode}
          />

          <main className="flex-1 overflow-y-auto relative flex flex-col">
            <div className="sticky top-0 z-30 w-full px-8 py-4 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/[0.05]">
              <div className="flex items-center gap-4">
                <select 
                  value={dossierData.dossier?.id || 'mailin'}
                  onChange={(e) => dossierData.setCompany(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-300 outline-none focus:border-white/20 transition-all cursor-pointer"
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
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Intelligence Sync Active</span>
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
                >                  Export Portfolio
                </button>
                <DeepSearch onSelect={(id) => { setActiveModuleId(id); resetViews(); }} />
              </div>
            </div>
            
            <Suspense fallback={null}>
              <KnowledgeGraph 
                isOpen={isGraphOpen} 
                onClose={() => setIsGraphOpen(false)} 
                onSelectModule={(id) => { setActiveModuleId(id); resetViews(); }}
              />
            </Suspense>
            
            <div 
              className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
              style={{ 
                backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
                backgroundSize: '40px 40px' 
              }}
            ></div>
            
            <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10 pb-24 md:pb-12 relative z-10 flex flex-col">
              <ErrorBoundary>
                {dossierData.loading ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-in fade-in duration-700">
                    <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                    <p className="text-neutral-500 font-mono text-sm tracking-widest uppercase">Harvesting GitHub Content...</p>
                  </div>
                ) : !dossierData.dossier?.modules ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4 bg-rose-500/5 border border-rose-500/10 p-10 rounded-2xl max-w-md mx-auto my-auto">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <h3 className="text-white font-semibold">Backend Connection Failed</h3>
                    <p className="text-neutral-500 text-sm text-center">Could not harvest technical profile from the sentinel server. Check if the Node.js backend is running on port 3002.</p>
                  </div>
                ) : diagnosticsMode ? (
                  <Diagnostics />
                ) : warRoomMode ? (
                  <WarRoom />
                ) : arenaMode ? (
                  <ArchitectArena />
                ) : (
                  <div className="flex gap-10 items-start h-full">
                    <div className="flex-1 min-w-0">
                      {activeModule?.type === 'grid' && <Dashboard />}
                      {activeModule?.type === 'list' && <Internals />}
                      {activeModule?.type === 'map' && <SystemDesign />}
                      {activeModule?.type === 'playbook' && <Diagnostics />}
                      {activeModule?.type === 'checklist' && <Tracker />}
                      {activeModule?.type === 'markdown' && <MarkdownView data={activeModule.data} label={activeModule.label} />}
                    </div>
                    {activeModuleId && (
                      <InsightPanel 
                        fullId={dossierData.dossier?.modules.find(m => m.id === activeModuleId)?.fullId || ''} 
                      />
                    )}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </DossierContext.Provider>
    </ToastProvider>
  );
}

export default App;
