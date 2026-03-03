import React from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CodeBlockProps {
  code: string;
  title?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  code, 
  title = "implementation.ts",
  className 
}) => {
  return (
    <div className={cn("bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl my-4", className)}>
      <div className="bg-white/[0.02] px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.05]">
        <Terminal className="w-4 h-4 text-neutral-500" />
        <span className="text-[11px] font-mono text-neutral-400 tracking-wider">{title}</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-[13px] font-mono leading-relaxed text-neutral-300">
          {code.split('\n').map((line, i) => {
            const highlightedLine = line
              .replace(/(const|let|await|async|function|return|if|else|local)/g, '<span class="text-rose-400 font-medium">$1</span>')
              .replace(/(redis|consumer|kafka|process|Math|SELECT|UPDATE|SET|WHERE|FOR|BEGIN|COMMIT)/g, '<span class="text-indigo-400">$1</span>')
              .replace(/('.*?'|".*?")/g, '<span class="text-emerald-400">$1</span>')
              .replace(/(\/\/.*|--.*)/g, '<span class="text-neutral-500 italic">$1</span>');
            return (
              <div key={i} className="flex hover:bg-white/[0.02] transition-colors rounded px-2 -mx-2">
                <span className="w-6 shrink-0 text-neutral-600 select-none border-r border-white/[0.05] mr-4 text-right pr-3">{i + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};
