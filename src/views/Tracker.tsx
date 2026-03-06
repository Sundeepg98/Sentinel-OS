import React from 'react';
import { Zap, CheckCircle2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Task } from '@/types';
import { useDossierContext } from '@/lib/context';
import { cn } from '@/lib/utils';

interface TrackerProps {
  data: Task[];
  label: string;
  moduleId: string;
}

export const Tracker: React.FC<TrackerProps> = ({ data, label, moduleId }) => {
  const { dossier } = useDossierContext();
  const [tasks, setTasks] = useLocalStorage<Task[]>(dossier ? `tracker-${dossier.id}-${moduleId}` : `temp-tracker-${moduleId}`, data || []);

  // Sync with backend on mount
  React.useEffect(() => {
    if (!dossier) return;
    fetch(`/api/v1/state/tracker-${dossier.id}-${moduleId}`)
      .then(res => res.json())
      .then(dbData => {
        if (dbData.value) setTasks(dbData.value);
      });
  }, [dossier?.id, moduleId, setTasks]);

  if (!dossier) return null;

  const toggle = (id: number) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(newTasks);
    
    // Persist to backend for Heatmap
    fetch(`/api/v1/state/tracker-${dossier.id}-${moduleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newTasks })
    });
  };

  const progress = tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Zap className="w-5 h-5 text-neutral-400" />
          </div>
          {label}
        </h2>
      </div>

      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-end mb-4">
          <span className="text-neutral-400 font-medium text-sm tracking-wide">Readiness Progress</span>
          <span className="text-white font-mono text-3xl font-light">{progress}<span className="text-neutral-500 text-lg">%</span></span>
        </div>
        
        <div className="w-full bg-white/[0.03] rounded-full h-1.5 mb-10 border border-white/[0.02] overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out shadow-sm",
              dossier.brandColor === 'cyan' ? "bg-cyan-500" : "bg-indigo-500"
            )}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="space-y-3">
          {tasks.map(item => (
            <label 
              key={item.id} 
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 border",
                item.done 
                  ? 'bg-white/[0.02] border-white/[0.05] opacity-60' 
                  : 'bg-[#0a0a0a] border-white/[0.05] hover:border-white/10 shadow-sm'
              )}
            >
              <div className="mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={item.done} 
                  onChange={() => toggle(item.id)}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 rounded-[6px] border flex items-center justify-center transition-colors",
                  item.done 
                    ? (dossier.brandColor === 'cyan' ? 'bg-cyan-500 border-cyan-500' : 'bg-indigo-500 border-indigo-500')
                    : 'bg-white/[0.03] border-white/[0.1] hover:border-white/20'
                )}>
                  {item.done && <CheckCircle2 className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                </div>
              </div>
              <span className={cn(
                "block text-[14px] leading-relaxed transition-all",
                item.done ? 'text-neutral-500 line-through decoration-neutral-600' : 'text-neutral-200'
              )}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
