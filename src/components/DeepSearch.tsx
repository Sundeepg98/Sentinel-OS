import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Command, Cpu, Network, SearchCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDossierContext } from '../App';

interface SearchResult {
  title: string;
  type: string;
  moduleId: string;
  snippet: string;
}

interface DeepSearchProps {
  onSelect: (moduleId: string) => void;
}

export const DeepSearch: React.FC<DeepSearchProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { dossier } = useDossierContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    
    const searchItems: SearchResult[] = [];
    const q = query.toLowerCase();

    dossier.modules.forEach(mod => {
      if (mod.type === 'list') {
        mod.data.forEach((section: any) => {
          section.items.forEach((item: any) => {
            if (item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)) {
              searchItems.push({ title: item.title, type: mod.label, moduleId: mod.id, snippet: item.desc });
            }
          });
        });
      } else if (mod.type === 'map') {
        mod.data.forEach((item: any) => {
          if (item.title.toLowerCase().includes(q) || item.scenario.toLowerCase().includes(q)) {
            searchItems.push({ title: item.title, type: mod.label, moduleId: mod.id, snippet: item.scenario });
          }
        });
      } else if (mod.type === 'playbook') {
        mod.data.forEach((item: any) => {
          if (item.q.toLowerCase().includes(q) || item.optimal.toLowerCase().includes(q)) {
            searchItems.push({ title: item.q, type: mod.label, moduleId: mod.id, snippet: item.optimal });
          }
        });
      } else if (mod.type === 'checklist') {
        mod.data.forEach((item: any) => {
          if (item.text.toLowerCase().includes(q)) {
            searchItems.push({ title: 'Task', type: mod.label, moduleId: mod.id, snippet: item.text });
          }
        });
      }
    });

    return searchItems.slice(0, 8);
  }, [query, dossier]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2 bg-[#0a0a0a] border border-white/[0.08] rounded-lg text-neutral-400 text-sm hover:border-white/[0.15] hover:text-neutral-300 transition-all w-full max-w-xs shadow-sm"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Deep Search...</span>
        <div className="flex items-center gap-1 opacity-50 font-mono text-[10px] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.05]">
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.05] bg-white/[0.02]">
                <Search className="text-neutral-400" size={20} />
                <input 
                  autoFocus
                  placeholder="Search for mechanics, patterns, or playbooks..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-neutral-600 text-[15px]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/[0.05] rounded-md transition-colors">
                  <X className="text-neutral-500 hover:text-white" size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onSelect(res.moduleId);
                          setIsOpen(false);
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/[0.03] group transition-colors flex items-start gap-4 border border-transparent hover:border-white/[0.05]"
                      >
                        <div className="mt-1 p-2 bg-[#0a0a0a] border border-white/[0.08] rounded-md text-neutral-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors shadow-sm">
                          <SearchCode size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-neutral-200 truncate text-[14px]">{res.title}</h4>
                            <span className="text-[10px] uppercase tracking-widest font-mono text-neutral-500 bg-[#0a0a0a] px-2 py-0.5 rounded border border-white/[0.05]">
                              {res.type}
                            </span>
                          </div>
                          <p className="text-[13px] text-neutral-500 line-clamp-1 leading-relaxed">{res.snippet}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/[0.05]">
                      <Search className="w-5 h-5 text-neutral-600" />
                    </div>
                    <p className="text-neutral-500 text-[14px]">
                      {query.length < 2 ? 'Start typing to search across the dossier...' : 'No results found for this query.'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
