import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../App';
import { motion } from 'framer-motion';
import { Network, X, Maximize2, Minimize2, Zap, Cpu } from 'lucide-react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';

interface GraphNode {
  id: string;
  label: string;
  group: 'module' | 'concept';
  company: string;
  val: number;
  readiness?: number;
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
  const [hasInitialZoomed, setHasInitialZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom lock when closing/opening
  useEffect(() => {
    if (!isOpen) setHasInitialZoomed(false);
  }, [isOpen]);

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

  // Premium Node Rendering
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    
    const size = node.group === 'module' ? 6 : 3;
    const isMastered = node.readiness === 1;
    const baseColor = node.company === 'mailin' ? '#06b6d4' : node.company === 'turing' ? '#6366f1' : '#737373';
    const activeColor = isMastered ? '#10b981' : baseColor;

    // 1. Core Sphere (Glossy)
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
      color: activeColor,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: isMastered ? 1 : 0.85,
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // 2. Neon Glow Aura (Only for modules)
    if (node.group === 'module') {
      const auraGeo = new THREE.SphereGeometry(size * 1.5, 32, 32);
      const auraMat = new THREE.MeshBasicMaterial({
        color: activeColor,
        transparent: true,
        opacity: isMastered ? 0.15 : 0.05,
        blending: THREE.AdditiveBlending
      });
      group.add(new THREE.Mesh(auraGeo, auraMat));
    }

    // 3. Crisp 3D Text Label
    const sprite = new SpriteText(node.label);
    sprite.color = '#ffffff';
    sprite.textHeight = size * 0.8;
    sprite.fontWeight = 'bold';
    sprite.fontFace = 'Inter, sans-serif';
    sprite.position.y = size + 3; // Float above the node
    sprite.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    sprite.padding = 2;
    sprite.borderRadius = 4;
    group.add(sprite);

    return group;
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    if (node.group === 'module') {
      const [companyId, fileName] = node.id.split('/');
      const moduleId = fileName.replace('.md', '');
      
      // Cinematic Camera Fly-to before closing
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      
      if(graphRef.current) {
        graphRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1000
        );
      }

      setTimeout(() => {
        setCompany(companyId);
        setTimeout(() => {
          onSelectModule(moduleId);
          onClose();
        }, 100);
      }, 1000); // Wait for animation
    }
  }, [setCompany, onSelectModule, onClose]);

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
              <h2 className="text-lg font-semibold text-white tracking-wide uppercase italic">Architectural Core</h2>
              <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5 font-mono flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Live Neural Engine
              </div>
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

        <div className="flex-1 relative overflow-hidden rounded-b-2xl" ref={containerRef}>
          {/* Ambient Background Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />
          
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeThreeObject={nodeThreeObject}
            // Advanced Link Physics & Aesthetics
            linkColor={() => 'rgba(255,255,255,0.1)'}
            linkWidth={1}
            linkResolution={6}
            // Data Flow Particles
            linkDirectionalParticles={(link: any) => link.source.group === 'module' ? 3 : 1}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={(link: any) => link.source.company === 'mailin' ? '#22d3ee' : '#818cf8'}
            linkDirectionalParticleSpeed={0.005}
            // Environment
            backgroundColor="rgba(0,0,0,0)"
            enableNodeDrag={true}
            onNodeClick={handleNodeClick}
            // Tighter Physics Forces
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.1}
            onEngineStop={() => {
              if (graphRef.current && !hasInitialZoomed) {
                // Wait for physics to settle, then smoothly frame the entire graph with a 20% margin
                graphRef.current.zoomToFit(1500, 150);
                setHasInitialZoomed(true);
              }
            }}
          />
          
          {/* Professional Legend Overlay */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-4 pointer-events-none">
            <div className="bg-black/40 border border-white/10 backdrop-blur-xl p-5 rounded-xl space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#06b6d4] shadow-[0_0_12px_#22d3ee]"></div>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Mailin Core</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#6366f1] shadow-[0_0_12px_#818cf8]"></div>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Turing Core</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_15px_#10b981]"></div>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">100% Mastered</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-neutral-500"></div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Shared Concept</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-full text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                <Zap size={10} className="text-amber-400" /> Data Flow Enabled
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-full text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                <Cpu size={10} className="text-indigo-400" /> WebGL Physical Materials
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
