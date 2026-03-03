import React, { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../App';
import { motion } from 'framer-motion';
import { Network, X, Maximize2, Minimize2 } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  group: 'module' | 'concept';
  company: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  keyword?: string;
}

interface KnowledgeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ isOpen, onClose, onSelectModule }) => {
  const { setCompany } = useDossierContext();
  const graphRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load real graph data from backend
  useEffect(() => {
    if (isOpen) {
      fetch('/api/intelligence/graph')
        .then(res => res.json())
        .then(data => setGraphData(data))
        .catch(err => console.error('Graph fetch failed', err));
    }
  }, [isOpen]);

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

  const handleNodeClick = (node: any) => {
    if (node.group === 'module') {
      const [companyId, fileName] = node.id.split('/');
      const moduleId = fileName.replace('.md', '');
      
      setCompany(companyId);
      // Brief delay to allow context switch
      setTimeout(() => {
        onSelectModule(moduleId);
        onClose();
      }, 100);
    } else {
      // For concepts, just focus the camera
      const distance = 100;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        2000
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 font-sans">
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
              <h2 className="text-lg font-semibold text-white tracking-wide">3D Semantic nervous System</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Live Architectural Relationships</p>
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
            graphData={graphData}
            nodeLabel={(node: any) => `${node.label} (${node.company})`}
            nodeColor={(node: any) => {
              if (node.company === 'mailin') return '#22d3ee'; // Cyan
              if (node.company === 'turing') return '#818cf8'; // Indigo
              return '#a3a3a3'; // Global Concept
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
            onNodeClick={handleNodeClick}
          />
          
          <div className="absolute bottom-6 left-6 flex flex-col gap-3 pointer-events-none bg-black/50 p-4 rounded-xl border border-white/[0.05] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Mailin Module</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Turing Module</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neutral-400"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Shared Concept (Link)</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
