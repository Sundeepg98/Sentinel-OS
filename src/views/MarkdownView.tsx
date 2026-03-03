import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { CodeBlock } from '../components/ui/CodeBlock';

interface MarkdownViewProps {
  data: string;
  label: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ data, label }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <div className="border-b border-white/[0.05] pb-5">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <FileText className="w-5 h-5 text-neutral-400" />
          </div>
          {label}
        </h2>
      </div>

      <div className="bg-[#0d0d0d] border border-white/[0.05] rounded-xl p-8 shadow-2xl relative overflow-hidden text-neutral-300 leading-relaxed">
        {/* Prose styling for the markdown content */}
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
                // If it's a block code (not inline), use our custom CodeBlock component
                if (!inline && match) {
                  return (
                    <CodeBlock 
                      code={String(children).replace(/\n$/, '')} 
                      title={`${match[1]} snippet`}
                      className="my-6"
                    />
                  );
                } else if (!inline) {
                   return (
                    <CodeBlock 
                      code={String(children).replace(/\n$/, '')} 
                      title="snippet"
                      className="my-6"
                    />
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {data}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
};
