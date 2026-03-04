import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, Maximize2, Zap, Cpu, AlertCircle, Play } from 'lucide-react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { 
  EffectComposer, 
  RenderPass, 
  BloomEffect, 
  EffectPass, 
  SMAAEffect, 
  VignetteEffect,
  EdgeDetectionMode
} from 'postprocessing';
import { cn } from '../lib/utils';

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
  
  // --- SIMULATION STATE ---
  const [isSimActive, setIsSimActive] = useState(false);
  const [simNode, setSimNode] = useState<any | null>(null);
  const [blastNodes, setBlastNodes] = useState(new Set());

  const hasInitialZoomed = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      hasInitialZoomed.current = false;
      setHoveredNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      setIsSimActive(false);
      setSimNode(null);
      setBlastNodes(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/v1/intelligence/graph')
        .then(res => res.json())
        .then(data => {
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
          const weightedNodes = Object.values(nodesById).map((n: any) => ({
            ...n,
            weight: n.group === 'module' ? 10 : n.group === 'learned' ? 8 : Math.min(Math.max(n.neighbors.length || 1, 2), 8)
          }));
          setGraphData({ nodes: weightedNodes, links: data.links });
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    }
  }, [isOpen, isFullscreen]);

  // Master Post-Processing Pipeline
  useEffect(() => {
    if (isOpen && graphRef.current && !hasInitialZoomed.current) {
      const scene = graphRef.current.scene();
      const camera = graphRef.current.camera();
      const renderer = graphRef.current.renderer();

      scene.children = scene.children.filter((c: any) => !(c instanceof THREE.Light));
      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const key = new THREE.DirectionalLight(0xffffff, 2.5);
      key.position.set(100, 200, 100);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x818cf8, 1.2);
      rim.position.set(-100, -50, -100);
      scene.add(rim);

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      const smaaEffect = new SMAAEffect({ edgeDetectionMode: EdgeDetectionMode.COLOR });
      const bloomEffect = new BloomEffect({ 
        intensity: 1.5, 
        luminanceThreshold: 0.2, 
        luminanceSmoothing: 0.9,
        mipmapBlur: true 
      });
      const vignetteEffect = new VignetteEffect({ offset: 0.3, darkness: 0.6 });

      composer.addPass(new EffectPass(camera, smaaEffect, bloomEffect, vignetteEffect));

      let animationFrameId: number;
      const renderLoop = () => {
        composer.render();
        animationFrameId = requestAnimationFrame(renderLoop);
      };
      
      if (graphRef.current) {
        graphRef.current.pauseAnimation();
        renderLoop();
      }

      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.cameraPosition({ z: 180 }, undefined, 800);
          const controls = graphRef.current.controls();
          if (controls) {
            controls.minDistance = 80;
            controls.maxDistance = 450;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
          }
          hasInitialZoomed.current = true;
        }
      }, 400);

      return () => {
        cancelAnimationFrame(animationFrameId);
        if (graphRef.current) graphRef.current.resumeAnimation();
        composer.dispose();
      };
    }
  }, [isOpen, graphData]);

  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleNodeHover = useCallback((node: any) => {
    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();
    if (node && graphRef.current) {
      newHighlightNodes.add(node);
      node.neighbors.forEach((neighbor: any) => newHighlightNodes.add(neighbor));
      node.links.forEach((link: any) => newHighlightLinks.add(link));
      const coords = graphRef.current.graph2ScreenCoords(node.x, node.y, node.z);
      setTooltipPos({ x: coords.x, y: coords.y });
      setHoveredNode({ ...node, connections: node.neighbors.map((n: any) => n.label).slice(0, 3) });
    } else {
      setHoveredNode(null);
    }
    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, []);

  const triggerBlastRadius = (node: any) => {
    const affected = new Set();
    const stack = [{ n: node, depth: 0 }];
    affected.add(node);

    while (stack.length > 0) {
      const { n, depth } = stack.pop()!;
      if (depth < 2) {
        n.neighbors.forEach((nb: any) => {
          if (!affected.has(nb)) {
            affected.add(nb);
            stack.push({ n: nb, depth: depth + 1 });
          }
        });
      }
    }
    setSimNode(node);
    setBlastNodes(affected);
  };

  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    const isHighlighted = highlightNodes.has(node) || highlightNodes.size === 0;
    const isBlastAffected = blastNodes.has(node);
    const isSimOrigin = simNode === node;
    
    const size = node.weight || 3;
    const readiness = node.readiness || 0;

    // --- COLOR LOGIC ---
    let activeColor = '#737373'; 
    if (isSimOrigin) {
      activeColor = '#ef4444'; // Bright Red Origin
    } else if (isBlastAffected) {
      activeColor = '#fb923c'; // Orange Impact
    } else if (node.group === 'learned') {
      activeColor = '#facc15'; // Gold for Learned
    } else if (node.group === 'module') {
      if (readiness < 0.3) activeColor = '#f43f5e';
      else if (readiness < 0.7) activeColor = '#f59e0b';
      else activeColor = '#10b981';
    } else {
      activeColor = '#6366f1';
    }

    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
      color: activeColor,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      transmission: 0.3,
      thickness: 1.5,
      transparent: true,
      opacity: isHighlighted ? 1 : 0.15,
      emissive: isHighlighted ? activeColor : '#000000',
      emissiveIntensity: isHighlighted ? (0.2 + readiness * 0.8) : 0
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // --- PULSE EFFECT FOR LEARNED NODES ---
    if (node.group === 'learned') {
      const ringGeom = new THREE.RingGeometry(size + 1, size + 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      group.add(ring);
    }

    if (isHighlighted || node.group === 'module' || node.group === 'learned') {
      const sprite = new SpriteText(node.label);
      sprite.color = '#ffffff';
      sprite.textHeight = size * 0.7;
      sprite.fontWeight = '500';
      sprite.position.y = size + 5;
      sprite.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      sprite.padding = [2, 4];
      sprite.borderRadius = 2;
      group.add(sprite);
    }
    return group;
  }, [highlightNodes, blastNodes, simNode]);

  const handleNodeClick = useCallback((node: any) => {
    if (isSimActive) {
      triggerBlastRadius(node);
      return;
    }

    if (node.group === 'module') {
      const [companyId, fileName] = node.id.split('/');
      const moduleId = fileName.replace('.md', '');
      graphRef.current.cameraPosition({ x: node.x * 1.5, y: node.y * 1.5, z: node.z * 1.5 }, node, 800);
      setTimeout(() => {
        setCompany(companyId);
        onSelectModule(moduleId);
        onClose();
      }, 850);
    }
  }, [isSimActive, setCompany, onSelectModule, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 font-sans">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-3xl" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={cn(
          "relative bg-[#050505] border border-white/[0.1] shadow-3xl flex flex-col transition-all duration-300",
          isFullscreen ? 'fixed inset-4 rounded-xl' : 'w-full max-w-6xl h-[80vh] rounded-2xl'
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.05] bg-white/[0.02] z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20"><Network className="w-5 h-5 text-indigo-400" /></div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide uppercase">Architectural Nervous System</h2>
              <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5 font-mono flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Post-Processing Engine: High-Justice
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsSimActive(!isSimActive);
                if (isSimActive) { setSimNode(null); setBlastNodes(new Set()); }
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                isSimActive ? "bg-rose-600 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]" : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
              )}
            >
              <AlertCircle size={14} /> {isSimActive ? 'Deactivate Simulator' : 'Blast Radius Simulation'}
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-white/[0.05] rounded-lg text-neutral-500 ml-2"><Maximize2 size={18} /></button>
            <button onClick={onClose} className="p-2 hover:bg-rose-500/10 rounded-lg text-neutral-500"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden rounded-b-2xl" ref={containerRef}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />
          
          <ForceGraph3D
            ref={graphRef} width={dimensions.width} height={dimensions.height} graphData={graphData}
            nodeThreeObject={nodeThreeObject} linkCurvature={0.2}
            linkColor={(link: any) => highlightLinks.has(link) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)'}
            linkWidth={(link: any) => highlightLinks.has(link) ? 2 : 0.5}
            linkDirectionalParticles={(link: any) => (highlightLinks.has(link) || highlightLinks.size === 0) ? 3 : 0}
            linkDirectionalParticleWidth={2} linkDirectionalParticleSpeed={0.005}
            backgroundColor="rgba(0,0,0,0)" enableNodeDrag={false} onNodeClick={handleNodeClick}
            warmupTicks={100} cooldownTicks={0} onNodeHover={handleNodeHover}
          />

          {isSimActive && !simNode && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
              <Play className="w-12 h-12 text-rose-500/20 mx-auto mb-4 animate-ping" />
              <p className="text-rose-400 font-mono text-xs uppercase tracking-[0.3em] font-bold">Select Origin Node to Simulate Failure</p>
            </div>
          )}

          <AnimatePresence>
            {hoveredNode && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="absolute z-[100] pointer-events-none" style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}
              >
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl min-w-[250px]">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{hoveredNode.group === 'module' ? 'Domain' : hoveredNode.group === 'learned' ? 'User Asset' : 'Concept'}</div>
                  <div className="text-white font-semibold text-sm mb-3">{hoveredNode.label}</div>
                  {isSimActive && hoveredNode.group === 'module' && (
                    <div className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Zap size={10} /> Predicted Blast Radius: {hoveredNode.blastRadius} Nodes
                    </div>
                  )}
                  {hoveredNode.connections && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                      {hoveredNode.connections.map((c: any, i: any) => <div key={i} className="text-[10px] px-2 py-1 rounded bg-white/5 text-neutral-300">{c}</div>)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="absolute bottom-6 left-6 pointer-events-none bg-black/40 border border-white/10 backdrop-blur-xl p-5 rounded-xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#facc15] shadow-[0_0_12px_#facc15]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Learned Asset (Glow)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_15px_#10b981]"></div>
              <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Mastered (71-100%)</span>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest"><Zap size={10} className="text-amber-400" /> Neural Impact Analyzer</div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest"><Cpu size={10} className="text-indigo-400" /> High-Justice V2.0</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
