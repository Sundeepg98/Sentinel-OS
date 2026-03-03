import React, { useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useDossierContext } from '../App';
import { motion } from 'framer-motion';
import { Network, X } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  company: string;
  type: 'file' | 'concept';
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  keyword: string;
}

export const KnowledgeGraph: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { dossier } = useDossierContext();
  const graphRef = useRef<any>(null);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const concepts = new Set<string>();

    if (!dossier) return { nodes, links };

    // Add file nodes
    dossier.modules.forEach(mod => {
      nodes.push({
        id: mod.fullId || mod.id,
        label: mod.label,
        company: dossier.id,
        type: 'file',
        val: 10
      });

      // Extract dummy keywords for visualization
      const mockKeywords = ['Redis', 'Kubernetes', 'Scalability', 'Security', 'Latency'];
      const activeKeywords = mockKeywords.filter(() => Math.random() > 0.5);

      activeKeywords.forEach(k => {
        if (!concepts.has(k)) {
          nodes.push({ id: k, label: k, company: 'global', type: 'concept', val: 5 });
          concepts.add(k);
        }
        links.push({
          source: mod.fullId || mod.id,
          target: k,
          keyword: k
        });
      });
    });

    return { nodes, links };
  }, [dossier]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#050505]/90 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-6xl h-[80vh] bg-[#0d0d0d] border border-white/[0.1] rounded-2xl shadow-3xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Network className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Semantic Knowledge Graph</h2>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Mapping technical relationships across dossiers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/[0.05] rounded-full transition-colors text-neutral-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 relative bg-black/20">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel="label"
            nodeColor={(node: any) => node.type === 'file' ? '#6366f1' : '#06b6d4'}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 12/globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2) as [number, number];

              ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.type === 'file' ? '#a5b4fc' : '#67e8f9';
              ctx.fillText(label, node.x, node.y);

              node.__bckgDimensions = bckgDimensions; // to Use in nodePointerAreaPaint
            }}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              const bckgDimensions = node.__bckgDimensions;
              bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
            }}
            linkColor={() => 'rgba(255,255,255,0.05)'}
            linkWidth={1}
            backgroundColor="rgba(0,0,0,0)"
          />
          
          <div className="absolute bottom-6 left-6 flex flex-col gap-3 pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Technical Module</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Shared Concept</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
