import { useState, createContext, useContext, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { Internals } from './views/Internals';
import { SystemDesign } from './views/SystemDesign';
import { Diagnostics } from './views/Diagnostics';
import { Tracker } from './views/Tracker';
import { MarkdownView } from './views/MarkdownView';
import { DeepSearch } from './components/DeepSearch';
import { InsightPanel } from './components/InsightPanel';
import { useDossier } from './hooks/useDossier';
import type { CompanyDossier } from './types';
import { Loader2, AlertCircle, Network } from 'lucide-react';
import { Suspense, lazy } from 'react';

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

  useEffect(() => {
    if (dossierData.dossier?.modules && dossierData.dossier.modules.length > 0) {
      setActiveModuleId(dossierData.dossier.modules[0].id);
    }
  }, [dossierData.dossier?.id, dossierData.dossier?.modules]);

  const activeModule = dossierData.dossier?.modules?.find(m => m.id === activeModuleId);

  return (
    <DossierContext.Provider value={{ ...dossierData }}>
      <div className="flex h-screen font-sans text-neutral-200 overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-100">
        <Sidebar activeModuleId={activeModuleId} setActiveModuleId={setActiveModuleId} />

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
            </div>
            <DeepSearch onSelect={setActiveModuleId} />
          </div>
          
          <Suspense fallback={null}>
            <KnowledgeGraph 
              isOpen={isGraphOpen} 
              onClose={() => setIsGraphOpen(false)} 
              onSelectModule={setActiveModuleId}
            />
          </Suspense>
          
          <div 
            className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
            style={{ 
              backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }}
          ></div>
          
          <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10 pb-24 md:pb-12 relative z-10 flex flex-col justify-center">
            {dossierData.loading ? (
              <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in duration-700">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                <p className="text-neutral-500 font-mono text-sm tracking-widest uppercase">Harvesting GitHub Content...</p>
              </div>
            ) : !dossierData.dossier?.modules ? (
              <div className="flex flex-col items-center justify-center gap-4 bg-rose-500/5 border border-rose-500/10 p-10 rounded-2xl max-w-md mx-auto">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <h3 className="text-white font-semibold">Backend Connection Failed</h3>
                <p className="text-neutral-500 text-sm text-center">Could not harvest technical profile from the sentinel server. Check if the Node.js backend is running on port 3002.</p>
              </div>
            ) : (
              <div className="flex gap-10 items-start">
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
          </div>
        </main>
      </div>
    </DossierContext.Provider>
  );
}

export default App;
