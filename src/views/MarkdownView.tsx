import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { CodeBlock } from '../components/ui/CodeBlock';
import { cn } from '../lib/utils';

interface MarkdownViewProps {
  data: string;
  label: string;
}

const StudyCard: React.FC<{ section: string }> = ({ section }) => {
  const [revealed, setRevealed] = useState(false);
  const lines = section.split('\n');
  const headerMatch = lines[0].match(/^(#+)\s+(.*)/);
  const title = headerMatch ? headerMatch[2] : 'Core Concept';
  const content = headerMatch ? lines.slice(1).join('\n') : section;

  if (!content.trim()) return null;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl overflow-hidden shadow-lg transition-all">
      <div 
        className="p-6 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setRevealed(!revealed)}
      >
        <h3 className="text-lg font-medium text-neutral-200">
          <span className="text-cyan-500/50 mr-2 font-mono">Q:</span> Explain {title}
        </h3>
        <button className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors border",
          revealed ? "bg-white/5 border-white/10 text-neutral-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
        )}>
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          {revealed ? 'Hide Answer' : 'Reveal'}
        </button>
      </div>
      
      <AnimatePresence>
        {revealed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.05]"
          >
            <div className="p-6 bg-[#0a0a0a] prose prose-invert prose-neutral max-w-none 
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-rose-300 prose-code:bg-rose-500/[0.05] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
              prose-blockquote:border-l-cyan-500/50 prose-blockquote:bg-cyan-500/[0.02] prose-blockquote:px-5 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
              prose-table:border-collapse prose-th:border-b prose-th:border-white/10 prose-th:text-left prose-td:border-b prose-td:border-white/5"
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match) {
                      return <CodeBlock code={String(children).replace(/\n$/, '')} title={`${match[1]} snippet`} className="my-6"/>;
                    } else if (!inline) {
                       return <CodeBlock code={String(children).replace(/\n$/, '')} title="snippet" className="my-6"/>;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ data, label }) => {
  const [studyMode, setStudyMode] = useState(false);

  // Split markdown by H2 and H3 headers to create study cards automatically
  // (Avoids single # to prevent splitting inside bash code block comments)
  const sections = data.split(/(?=\n##{1,2}\s)/).filter(s => s.trim().length > 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <FileText className="w-5 h-5 text-neutral-400" />
          </div>
          {label}
        </h2>
        
        <button 
          onClick={() => setStudyMode(!studyMode)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm",
            studyMode 
              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
              : "bg-[#0d0d0d] border-white/[0.1] text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          )}
        >
          <BrainCircuit className="w-4 h-4" />
          {studyMode ? 'Exit Study Mode' : 'Active Recall'}
        </button>
      </div>

      {studyMode ? (
        <div className="space-y-4">
          <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl text-indigo-200/80 text-sm mb-6 flex items-start gap-3">
             <BrainCircuit className="w-5 h-5 shrink-0 text-indigo-400" />
             <p className="leading-relaxed"><strong>Active Recall Mode:</strong> Your notes have been automatically converted into flashcards based on their headers. Try to explain the concept out loud before revealing the answer.</p>
          </div>
          {sections.map((sec, i) => <StudyCard key={i} section={sec} />)}
        </div>
      ) : (
        <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl relative overflow-hidden text-neutral-300 leading-relaxed">
          <div className="prose prose-invert prose-neutral max-w-none 
            prose-headings:text-white prose-headings:font-semibold
            prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
            prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
            prose-code:text-rose-300 prose-code:bg-rose-500/[0.05] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
            prose-blockquote:border-l-cyan-500/50 prose-blockquote:bg-cyan-500/[0.02] prose-blockquote:px-5 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
            prose-table:border-collapse prose-th:border-b prose-th:border-white/10 prose-th:text-left prose-td:border-b prose-td:border-white/5
          ">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                code({node, inline, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  if (!inline && match) {
                    return <CodeBlock code={String(children).replace(/\n$/, '')} title={`${match[1]} snippet`} className="my-6"/>;
                  } else if (!inline) {
                     return <CodeBlock code={String(children).replace(/\n$/, '')} title="snippet" className="my-6"/>;
                  }
                  return <code className={className} {...props}>{children}</code>;
                }
              }}
            >
              {data}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </motion.div>
  );
};
