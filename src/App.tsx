import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { TabId } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { Internals } from './views/Internals';
import { SystemDesign } from './views/SystemDesign';
import { Diagnostics } from './views/Diagnostics';
import { Tracker } from './views/Tracker';
import { DeepSearch } from './components/DeepSearch';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="flex h-screen font-sans text-neutral-200 overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <div className="sticky top-0 z-30 w-full px-8 py-4 flex justify-end items-center bg-black/40 backdrop-blur-md border-b border-white/[0.05]">
          <DeepSearch onSelect={setActiveTab} />
        </div>
        
        <div 
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
          style={{ 
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }}
        ></div>
        
        <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10 pb-24 md:pb-12 relative z-10">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'internals' && <Internals />}
          {activeTab === 'systems' && <SystemDesign />}
          {activeTab === 'playbook' && <Diagnostics />}
          {activeTab === 'tracker' && <Tracker />}
        </div>
      </main>
    </div>
  );
}

export default App;
