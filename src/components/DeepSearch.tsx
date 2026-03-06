import React, { useState, useEffect } from 'react';
import { Search, X, Command, SearchCode, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useDossierContext } from '@/lib/context';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';

interface SearchResult {
  id: string; // "company/module.md"
  label: string;
  company: string;
  snippet?: string;
}

interface DeepSearchProps {
  onSelect: (moduleId: string) => void;
}

interface SemanticSearchResult {
  file_id: string;
  chunk_text: string;
}

export const DeepSearch: React.FC<DeepSearchProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const { setCompany } = useDossierContext();
  const { getToken } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleExternalTrigger = (e: CustomEvent) => {
      if (e.detail?.query) {
        setQuery(e.detail.query);
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('trigger-search' as any, handleExternalTrigger as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('trigger-search' as any, handleExternalTrigger as any);
    };
  }, []);

  const { data: results = [], isFetching: isSearching } = useQuery<SearchResult[]>({
    queryKey: ['search', query, searchMode],
    queryFn: async () => {
      if (query.length < 2) return [];
      
      if (searchMode === 'keyword') {
        return fetchWithAuth(`/api/v1/intelligence/search?q=${encodeURIComponent(query)}`, getToken);
      } else {
        const rawData = await fetchWithAuth('/api/v1/intelligence/semantic-search', getToken, {
          method: 'POST',
          body: JSON.stringify({ q: query, limit: 10 })
        });
        return rawData.map((item: SemanticSearchResult) => ({
          id: item.file_id,
          label: item.file_id.split('/').pop()?.replace('.md', '') || 'Module',
          company: item.file_id.split('/')[0],
          snippet: item.chunk_text
        }));
      }
    },
    enabled: query.length >= 2,
    placeholderData: (previousData) => previousData,
  });

  const handleSelect = (res: SearchResult) => {
    const [companyId, fileName] = res.id.split('/');
    const moduleId = fileName.replace('.md', '');
    setCompany(companyId);
    setTimeout(() => {
      onSelect(moduleId);
    }, 100);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2 bg-[#0a0a0a] border border-white/[0.08] rounded-lg text-neutral-400 text-sm hover:border-white/[0.15] hover:text-neutral-300 transition-all w-full max-w-xs shadow-sm"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Global Search...</span>
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
                  placeholder={searchMode === 'keyword' ? "Search keywords (e.g., 'Redis', 'V8')..." : "Search by meaning (e.g., 'How to handle high traffic?')..."}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-neutral-600 text-[15px]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                
                <div className="flex items-center bg-white/[0.03] p-1 rounded-lg border border-white/5 gap-1">
                  <button 
                    onClick={() => setSearchMode('keyword')}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                      searchMode === 'keyword' ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-neutral-600 hover:text-neutral-400"
                    )}
                  >
                    Keyword
                  </button>
                  <button 
                    onClick={() => setSearchMode('semantic')}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                      searchMode === 'semantic' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-neutral-600 hover:text-neutral-400"
                    )}
                  >
                    Semantic
                  </button>
                </div>

                <button onClick={() => setIsOpen(false)} className="ml-2 p-1 hover:bg-white/[0.05] rounded-md transition-colors">
                  <X className="text-neutral-500 hover:text-white" size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelect(res)}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/[0.03] group transition-colors flex items-start gap-4 border border-transparent hover:border-white/[0.05]"
                      >
                        <div className="mt-1 p-2 bg-[#0a0a0a] border border-white/[0.08] rounded-md text-neutral-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors shadow-sm">
                          {searchMode === 'keyword' ? <SearchCode size={16} /> : <Brain size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-neutral-200 truncate text-[14px]">{res.label}</h4>
                            <span className="text-[10px] uppercase tracking-widest font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                              {res.company}
                            </span>
                          </div>
                          <p className="text-[12px] text-neutral-500 line-clamp-2 leading-relaxed font-mono italic opacity-80">
                            {res.snippet || res.id}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/[0.05]">
                      <Search className={isSearching ? "w-5 h-5 text-cyan-500 animate-pulse" : "w-5 h-5 text-neutral-600"} />
                    </div>
                    <p className="text-neutral-500 text-[14px]">
                      {query.length < 2 ? (
                        searchMode === 'keyword' ? 'Start typing to search across all dossiers...' : 'Type a technical question or concept...'
                      ) : (isSearching ? 'Analyzing semantic vectors...' : 'No results found for this query.')}
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
