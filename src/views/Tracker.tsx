import React from 'react';
import { Zap, CheckCircle2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Task } from '../types';
import { motion } from 'framer-motion';

const INITIAL_TASKS: Task[] = [
  { id: 1, text: "Write a Transform stream to parse a 5GB file without OOM.", done: false },
  { id: 2, text: "Explain Libuv DNS blocking clearly aloud.", done: false },
  { id: 3, text: "Whiteboard a Redis Token Bucket using MULTI/EXEC or Lua.", done: false },
  { id: 4, text: "Implement Kafka consumer backpressure with consumer.pause().", done: false },
  { id: 5, text: "Identify how to run V8 Sampling Heap Profiler.", done: false }
];

export const Tracker: React.FC = () => {
  const [tasks, setTasks] = useLocalStorage<Task[]>('mailin-tracker-v3', INITIAL_TASKS);

  const toggle = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const progress = Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-3xl mx-auto"
    >
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <Zap className="w-5 h-5 text-neutral-400" />
          </div>
          Protocol Tracker
        </h2>
      </div>

      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex justify-between items-end mb-4">
          <span className="text-neutral-400 font-medium text-sm tracking-wide">Interview Readiness</span>
          <span className="text-white font-mono text-3xl font-light">{progress}<span className="text-neutral-500 text-lg">%</span></span>
        </div>
        
        <div className="w-full bg-white/[0.03] rounded-full h-1.5 mb-10 border border-white/[0.02] overflow-hidden">
          <div 
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="space-y-3">
          {tasks.map(item => (
            <label 
              key={item.id} 
              className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                item.done 
                  ? 'bg-white/[0.02] border-white/[0.05] opacity-60' 
                  : 'bg-[#0a0a0a] hover:bg-white/[0.02] border-white/[0.05] hover:border-white/10 shadow-sm'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={item.done} 
                  onChange={() => toggle(item.id)}
                  className="hidden"
                />
                <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-colors ${
                  item.done 
                    ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'bg-white/[0.03] border-white/[0.1] hover:border-white/20'
                }`}>
                  {item.done && <CheckCircle2 className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                </div>
              </div>
              <span className={`block text-[14px] leading-relaxed transition-all ${
                item.done ? 'text-neutral-500 line-through decoration-neutral-600' : 'text-neutral-200'
              }`}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
