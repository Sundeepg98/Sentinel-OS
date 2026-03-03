import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../App';
import { motion } from 'framer-motion';
import { Network, X, Maximize2, Minimize2 } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  group: 'company' | 'module' | 'concept';
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

export const KnowledgeGraph: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { allCompanies, dossier } = useDossierContext();
  const graphRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, isFullscreen]);

  const { nodes, links } = useMemo(() => {
    const gNodes: GraphNode[] = [];
    const gLinks: GraphLink[] = [];
    const conceptSet = new Set<string>();

    if (!dossier) return { nodes: [], links: [] };

    // 1. Core Company Nodes
    allCompanies.forEach(c => {
      gNodes.push({ id: c.id, label: c.name, group: 'company', val: 20 });
    });

    // 2. Module Nodes
    dossier.modules.forEach(mod => {
      const modId = mod.fullId || mod.id;
      gNodes.push({ id: modId, label: mod.label, group: 'module', val: 10 });
      gLinks.push({ source: dossier.id, target: modId });

      // 3. Extracted Concepts
      const concepts = (mod as any).keywords || ['Infrastructure', 'Scale', 'Performance', 'Security'];
      
      concepts.slice(0, 3).forEach((c: string) => {
        const conceptId = `c_${c.toLowerCase()}`;
        if (!conceptSet.has(conceptId)) {
          conceptSet.add(conceptId);
          gNodes.push({ id: conceptId, label: c, group: 'concept', val: 4 });
        }
        gLinks.push({ source: modId, target: conceptId });
      });
    });

    return { nodes: gNodes, links: gLinks };
  }, [dossier, allCompanies]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`relative bg-[#050505] border border-white/[0.1] shadow-[0_0_100px_rgba(99,102,241,0.15)] flex flex-col transition-all duration-300 ${
          isFullscreen ? 'fixed inset-4 rounded-xl' : 'w-full max-w-6xl h-[80vh] rounded-2xl'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.05] bg-white/[0.02] z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Network className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">3D Semantic Map</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Architectural Relationships</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-neutral-500 hover:text-white"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors text-neutral-500 hover:text-rose-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={containerRef}>
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes, links }}
            nodeLabel="label"
            nodeColor={(node: any) => {
              if (node.group === 'company') return '#818cf8';
              if (node.group === 'module') return '#22d3ee';
              return '#a3a3a3';
            }}
            nodeVal={(node: any) => node.val}
            nodeResolution={32}
            linkColor={() => 'rgba(255,255,255,0.1)'}
            linkWidth={0.5}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleColor={() => '#6366f1'}
            backgroundColor="#050505"
            enableNodeDrag={false}
            onNodeClick={(node: any) => {
              // Aim at node from outside it
              const distance = 100;
              const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

              graphRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                node, // lookAt ({ x, y, z })
                3000  // ms transition duration
              );
            }}
          />
          
          <div className="absolute bottom-6 left-6 flex flex-col gap-3 pointer-events-none bg-black/50 p-4 rounded-xl border border-white/[0.05] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Dossier Root</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Technical Module</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neutral-400"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Semantic Concept</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
