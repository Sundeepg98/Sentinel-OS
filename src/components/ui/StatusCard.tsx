import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: string;
  subValue?: string;
  note?: string;
  icon: ReactNode;
  color?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo';
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  subValue,
  note,
  icon,
  color = 'cyan',
  className
}) => {
  const colorMap = {
    emerald: 'from-emerald-500/10 to-transparent text-emerald-400',
    amber: 'from-amber-500/10 to-transparent text-amber-400',
    rose: 'from-rose-500/10 to-transparent text-rose-400',
    cyan: 'from-cyan-500/10 to-transparent text-cyan-400',
    indigo: 'from-indigo-500/10 to-transparent text-indigo-400'
  };

  const bgHoverMap = {
    emerald: 'hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    amber: 'hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]',
    rose: 'hover:border-rose-500/30 hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]',
    cyan: 'hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]',
    indigo: 'hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]'
  };

  return (
    <div className={cn("bg-[#0d0d0d] border border-white/[0.05] p-6 rounded-xl relative overflow-hidden group transition-all duration-300", bgHoverMap[color], className)}>
      <div className={cn("absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl opacity-50 rounded-bl-full transition-opacity group-hover:opacity-100", colorMap[color])}></div>
      <div className="relative z-10">
        <div className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-3 flex justify-between items-center">
          <span>{title}</span> 
          <div className="opacity-80">{icon}</div>
        </div>
        <div className="text-4xl font-bold text-white tracking-tight">
          {value} <span className="text-base text-neutral-500 font-normal">{subValue}</span>
        </div>
        {note && (
          <div className={cn("text-xs mt-4 pt-4 border-t border-white/[0.05] font-medium opacity-80", `text-${color}-400`)}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
};
