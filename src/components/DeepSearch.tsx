import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Command, Cpu, Network, SearchCode } from 'lucide-react';
import { V8_INTERNALS } from '../data/v8Internals';
import { ARCHITECTURE_PATTERNS } from '../data/architecture';
import { DIAGNOSTICS_PLAYBOOK } from '../data/diagnostics';
import { motion, AnimatePresence } from 'framer-motion';
import type { TabId } from './Sidebar';

interface SearchResult {
  title: string;
  type: 'Internals' | 'Architecture' | 'Diagnostics';
  tab: TabId;
  snippet: string;
}

interface DeepSearchProps {
  onSelect: (tab: TabId) => void;
}

export const DeepSearch: React.FC<DeepSearchProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

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

    V8_INTERNALS.forEach(section => {
      section.items.forEach(item => {
        if (item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)) {
          searchItems.push({ title: item.title, type: 'Internals', tab: 'internals', snippet: item.desc });
        }
      });
    });

    ARCHITECTURE_PATTERNS.forEach(item => {
      if (item.title.toLowerCase().includes(q) || item.scenario.toLowerCase().includes(q)) {
        searchItems.push({ title: item.title, type: 'Architecture', tab: 'systems', snippet: item.scenario });
      }
    });

    DIAGNOSTICS_PLAYBOOK.forEach(item => {
      if (item.q.toLowerCase().includes(q) || item.optimal.toLowerCase().includes(q)) {
        searchItems.push({ title: item.q, type: 'Diagnostics', tab: 'playbook', snippet: item.optimal });
      }
    });

    return searchItems.slice(0, 8);
  }, [query]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-sm hover:border-slate-700 transition-all w-full max-w-xs"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Deep Search...</span>
        <div className="flex items-center gap-1 opacity-50">
          <Command size={12} />
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
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                <Search className="text-slate-500" size={20} />
                <input 
                  autoFocus
                  placeholder="Search for internal mechanics, patterns, or playbooks..."
                  className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-600"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={() => setIsOpen(false)}>
                  <X className="text-slate-500 hover:text-slate-300" size={20} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onSelect(res.tab);
                          setIsOpen(false);
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-slate-800 group transition-colors flex items-start gap-4"
                      >
                        <div className="mt-1 p-2 bg-slate-950 border border-slate-800 rounded text-slate-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                          {res.type === 'Internals' && <Cpu size={16} />}
                          {res.type === 'Architecture' && <Network size={16} />}
                          {res.type === 'Diagnostics' && <SearchCode size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-slate-200 truncate">{res.title}</h4>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {res.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">{res.snippet}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-600 italic">
                    {query.length < 2 ? 'Start typing to search across the dossier...' : 'No results found for this query.'}
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
