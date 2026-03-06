import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { FileText, Clock, ExternalLink } from 'lucide-react';

interface MarkdownViewProps {
  data: any;
  label: string;
}

/**
 * 📝 STABILIZED MARKDOWN RENDERER
 * Uses rehype-sanitize for robust XSS protection and custom 
 * component overrides to fix layout nesting warnings.
 */
export const MarkdownView: React.FC<MarkdownViewProps> = ({ data, label }) => {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-10 flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{label}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
              <span className="flex items-center gap-1.5"><Clock size={12} className="text-neutral-600" /> Read Time: ~8 min</span>
              <span className="w-1 h-1 rounded-full bg-neutral-800" />
              <span className="text-neutral-400">Staff-Level Intelligence</span>
            </div>
          </div>
        </div>
        <button 
          aria-label="Open in external viewer"
          className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 transition-colors"
        >
          <ExternalLink size={18} />
        </button>
      </header>

      <div className="prose prose-invert prose-indigo prose-sm sm:prose-base max-w-none 
        prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
        prose-p:text-neutral-300 prose-p:leading-relaxed
        prose-strong:text-indigo-300 prose-strong:font-semibold
        prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[#0d0d0d] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-xl prose-pre:shadow-2xl
        prose-li:text-neutral-300
        prose-table:border prose-table:border-white/5 prose-table:rounded-xl
        prose-th:bg-white/[0.02] prose-th:px-4 prose-th:py-3 prose-th:text-xs prose-th:uppercase prose-th:tracking-widest
        prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-white/5
      ">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            // 🚀 HYDRATION FIX: Render pre blocks as top-level elements to avoid <p> nesting
            pre: ({ node: _node, ...props }) => (
              <div className="my-6 rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                <pre {...props} className="m-0 p-6 overflow-x-auto custom-scrollbar bg-[#0d0d0d]" />
              </div>
            ),
            // Ensure codes inside paragraphs don't break layout
            code: ({ node: _node, inline, ...props }: any) => 
              inline ? (
                <code {...props} className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded text-[0.9em]" />
              ) : (
                <code {...props} />
              ),
            // Custom table wrapper for glassmorphism
            table: ({ node: _node, ...props }) => (
              <div className="my-8 overflow-hidden rounded-xl border border-white/5 bg-white/[0.01]">
                <table {...props} className="w-full text-left border-collapse" />
              </div>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
