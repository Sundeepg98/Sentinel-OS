import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, Maximize2, Minimize2, Zap, Cpu } from 'lucide-react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const hasInitialZoomed = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      hasInitialZoomed.current = false;
      setHoveredNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [isOpen]);

  // Load and cross-link data for neighborhood discovery
  useEffect(() => {
    if (isOpen) {
      fetch('/api/intelligence/graph')
        .then(res => res.json())
        .then(data => {
          // Pre-calculate neighborhoods for instant highlighting
          const nodesById = Object.fromEntries(data.nodes.map((n: any) => [n.id, { ...n, neighbors: [], links: [] }]));
          
          data.links.forEach((link: any) => {
            const a = nodesById[link.source];
            const b = nodesById[link.target];
            if (a && b) {
              a.neighbors.push(b);
              b.neighbors.push(a);
              a.links.push(link);
              b.links.push(link);
            }
          });

          // Degree-based sizing
          const weightedNodes = Object.values(nodesById).map((n: any) => ({
            ...n,
            weight: n.group === 'module' ? 10 : Math.min(Math.max(n.neighbors.length || 1, 2), 8)
          }));

          setGraphData({ nodes: weightedNodes, links: data.links });
        })
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

  // Final High-Justice Camera Strategy & Post-Processing
  useEffect(() => {
    if (isOpen && graphData.nodes.length > 0 && graphRef.current && !hasInitialZoomed.current) {
      
      // --- CLASSY STUDIO LIGHTING ---
      const scene = graphRef.current.scene();
      // Remove harsh default lights
      scene.children = scene.children.filter((c: any) => !(c instanceof THREE.Light));
      
      scene.add(new THREE.AmbientLight(0xffffff, 0.4)); // Soft base
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5); // Sharp reflections on frosted glass
      keyLight.position.set(100, 200, 100);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x818cf8, 1.5); // Cool background rim
      rimLight.position.set(-100, -50, -100);
      scene.add(rimLight);

      // --- UNREAL BLOOM PASS ---
      try {
        const composer = graphRef.current.postProcessingComposer();
        if (composer && !composer.passes.some((p: any) => p instanceof UnrealBloomPass)) {
          const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6,  // strength (subtle, classy glow)
            0.2,  // radius (tight optical flare)
            0.9   // threshold (only highly emissive materials bloom, text stays crisp)
          );
          composer.addPass(bloomPass);
        }
      } catch (e) {
        console.warn('Bloom pass not supported in this environment');
      }

      // 1. One-time setup: Snap to the mathematical 'Sweet Spot' for this graph density
      setTimeout(() => {
        if (graphRef.current) {
          // Set explicit Z distance for perfect density view
          graphRef.current.cameraPosition({ z: 180 }, undefined, 800);
          
          // 2. Configure the 'Coolness' constraints via the underlying Three.js controls
          const controls = graphRef.current.controls();
          if (controls) {
            controls.minDistance = 80;  // Prevent clipping through nodes
            controls.maxDistance = 450; // Prevent zooming into the void
            controls.enableDamping = true; // High-end 'weighted' feel
            controls.dampingFactor = 0.05;
          }
          hasInitialZoomed.current = true;
        }
      }, 400);
    }
  }, [isOpen, graphData]);

  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleNodeHover = useCallback((node: any) => {
    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();

    if (node && graphRef.current) {
      // 1. Highlight Neighborhood
      newHighlightNodes.add(node);
      node.neighbors.forEach((neighbor: any) => newHighlightNodes.add(neighbor));
      node.links.forEach((link: any) => newHighlightLinks.add(link));

      // 2. Position Tooltip
      const coords = graphRef.current.graph2ScreenCoords(node.x, node.y, node.z);
      setTooltipPos({ x: coords.x, y: coords.y });
      
      const connections = node.neighbors.map((n: any) => n.label).slice(0, 3);
      setHoveredNode({ ...node, connections });
    } else {
      setHoveredNode(null);
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, []);

  // Premium 'Classy' Node Rendering with True Optical Bloom
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    
    const isHighlighted = highlightNodes.has(node) || highlightNodes.size === 0;
    const size = node.weight || 3;
    const isMastered = node.readiness === 1;
    const baseColor = node.company === 'mailin' ? '#06b6d4' : node.company === 'turing' ? '#6366f1' : '#737373';
    const activeColor = isMastered ? '#10b981' : baseColor;

    // 1. Core Sphere (Frosted Glass / Classy)
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
      color: activeColor,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.2, // Semi-transparent glass effect
      thickness: 1,
      transparent: true,
      opacity: isHighlighted ? (isMastered ? 1 : 0.85) : 0.15, // Dim unrelated
      emissive: isHighlighted && node.group === 'module' ? activeColor : '#000000',
      emissiveIntensity: isHighlighted && node.group === 'module' ? 0.5 : 0 // Triggers the UnrealBloomPass mathematically
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Removed the fake 2D aura meshes; the UnrealBloomPass now handles the optical glow dynamically

    // 3. Selective Typography (Classy: only show if relevant)
    if (isHighlighted || node.group === 'module') {
      const sprite = new SpriteText(node.label);
      sprite.color = '#ffffff';
      sprite.textHeight = size * 0.7;
      sprite.fontWeight = '500';
      sprite.fontFace = 'Inter, sans-serif';
      sprite.position.y = size + 4;
      sprite.backgroundColor = 'rgba(0, 0, 0, 0.4)';
      sprite.padding = [2, 4];
      sprite.borderRadius = 2;
      group.add(sprite);
    }

    return group;
  }, [highlightNodes]);

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
            // Brilliant Link Neighborhood Highlighting
            linkCurvature={0.2}
            linkColor={(link: any) => highlightLinks.has(link) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)'}
            linkWidth={(link: any) => highlightLinks.has(link) ? 2 : 0.5}
            linkResolution={8}
            // Data Flow Particles: Brilliant focus
            linkDirectionalParticles={(link: any) => (highlightLinks.has(link) || highlightLinks.size === 0) ? 3 : 0}
            linkDirectionalParticleWidth={(link: any) => highlightLinks.has(link) ? 3 : 1.5}
            linkDirectionalParticleColor={(link: any) => {
              const source = typeof link.source === 'string' ? link.source : link.source.id;
              return source.includes('mailin') ? '#22d3ee' : '#818cf8';
            }}
            linkDirectionalParticleSpeed={0.005}
            // Environment
            backgroundColor="rgba(0,0,0,0)"
            enableNodeDrag={false}
            onNodeClick={handleNodeClick}
            // Static Layout Engine
            warmupTicks={100}
            cooldownTicks={0}
            onNodeHover={handleNodeHover}
          />

          {/* Semantic Hover Overlay */}
          <AnimatePresence>
            {hoveredNode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-[100] pointer-events-none"
                style={{
                  left: tooltipPos.x + 15,
                  top: tooltipPos.y + 15,
                }}
              >
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl min-w-[250px]">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                    {hoveredNode.group === 'module' ? 'Architectural Domain' : 'Technical Concept'}
                  </div>
                  <div className="text-white font-semibold text-sm mb-3">
                    {hoveredNode.label}
                  </div>
                  
                  {hoveredNode.connections && hoveredNode.connections.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-2 border-t border-white/10 pt-2">
                        Connected Sub-Systems
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {hoveredNode.connections.map((c: string, idx: number) => (
                          <div key={idx} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-neutral-300">
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
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
