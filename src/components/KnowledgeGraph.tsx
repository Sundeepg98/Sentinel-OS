import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useDossierContext } from '../lib/context';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, Maximize2, Zap, Cpu, AlertCircle, Play, ChevronRight, Activity, ShieldAlert, FileText } from 'lucide-react';
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
import { useAuth } from '@clerk/clerk-react';
import { fetchWithAuth } from '../lib/api';

interface KnowledgeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ isOpen, onClose, onSelectModule }) => {
  const { setCompany } = useDossierContext();
  const { getToken } = useAuth();
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
  const [blastImpacts, setBlastImpacts] = useState<Map<string, 1 | 2 | 3>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      setBlastImpacts(new Map());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchWithAuth('/api/v1/intelligence/graph', getToken)
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
        })
        .catch(err => console.error('Graph Load Error:', err));
    }
  }, [isOpen, getToken]);

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
    const impacts = new Map<string, 1 | 2 | 3>();
    const queue = [{ n: node, depth: 0 }];
    impacts.set(node.id, 1);

    while (queue.length > 0) {
      const { n, depth } = queue.shift()!;
      if (depth < 2) {
        n.neighbors.forEach((nb: any) => {
          if (!impacts.has(nb.id)) {
            const nextDepth = depth + 1;
            impacts.set(nb.id, (nextDepth + 1) as 1 | 2 | 3);
            queue.push({ n: nb, depth: nextDepth });
          }
        });
      }
    }
    setSimNode(node);
    setBlastImpacts(impacts);
    setIsAnalyzing(true);
    
    // Auto-scroll to node
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: node.x * 1.2, y: node.y * 1.2, z: node.z * 1.2 }, node, 800);
    }
  };

  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    const isHighlighted = highlightNodes.has(node) || highlightNodes.size === 0;
    const impactLevel = blastImpacts.get(node.id);
    const isSimOrigin = simNode === node;
    
    const size = node.weight || 3;
    const readiness = node.readiness || 0;

    // --- COLOR LOGIC ---
    let activeColor = '#737373'; 
    if (isSimOrigin) {
      activeColor = '#f43f5e'; // Bright Red Origin
    } else if (impactLevel === 2) {
      activeColor = '#fb923c'; // Orange Impact
    } else if (impactLevel === 3) {
      activeColor = '#facc15'; // Yellow Warning
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
      emissiveIntensity: isHighlighted ? (0.2 + (impactLevel ? 1 : readiness) * 0.8) : 0
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // --- PULSE EFFECT FOR IMPACTED NODES ---
    if (impactLevel || isSimOrigin) {
      const ringGeom = new THREE.RingGeometry(size + 1, size + 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: activeColor, 
        transparent: true, 
        opacity: 0.5, 
        side: THREE.DoubleSide 
      });
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
  }, [highlightNodes, blastImpacts, simNode]);

  const handleNodeClick = useCallback((node: any) => {
    if (isSimActive) {
      triggerBlastRadius(node);
      return;
    }

    if (node.group === 'module') {
      const [companyId, fileName] = node.id.split('/');
      const moduleId = fileName.replace('.md', '');
      if (graphRef.current) {
        graphRef.current.cameraPosition({ x: node.x * 1.5, y: node.y * 1.5, z: node.z * 1.5 }, node, 800);
      }
      setTimeout(() => {
        setCompany(companyId);
        onSelectModule(moduleId);
        onClose();
      }, 850);
    }
  }, [isSimActive, setCompany, onSelectModule, onClose]);

  const impactedModules = useMemo(() => {
    return Array.from(blastImpacts.entries())
      .map(([id, level]) => ({ node: graphData.nodes.find(n => n.id === id), level }))
      .filter(i => i.node && i.node.group === 'module')
      .sort((a, b) => a.level - b.level);
  }, [blastImpacts, graphData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-3xl" />
      
      <div className="relative w-full max-w-7xl h-full flex gap-6 pointer-events-none">
        {/* MAIN GRAPH CONTAINER */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={cn(
            "relative bg-[#050505] border border-white/[0.1] shadow-3xl flex flex-col transition-all duration-300 pointer-events-auto",
            isFullscreen ? 'fixed inset-4 rounded-xl' : 'flex-1 h-[85vh] rounded-2xl self-center'
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
                  if (isSimActive) { setSimNode(null); setBlastImpacts(new Map()); setIsAnalyzing(false); }
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
              linkColor={(link: any) => {
                const impactA = blastImpacts.get(link.source.id || link.source);
                const impactB = blastImpacts.get(link.target.id || link.target);
                if (impactA === 1 || impactB === 1) return '#f43f5e';
                if (impactA === 2 || impactB === 2) return '#fb923c';
                return highlightLinks.has(link) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)';
              }}
              linkWidth={(link: any) => {
                const impactA = blastImpacts.get(link.source.id || link.source);
                const impactB = blastImpacts.get(link.target.id || link.target);
                return (impactA || impactB) ? 3 : 0.5;
              }}
              linkDirectionalParticles={(link: any) => {
                const impactA = blastImpacts.get(link.source.id || link.source);
                const impactB = blastImpacts.get(link.target.id || link.target);
                if (impactA || impactB) return 5;
                return (highlightLinks.has(link) || highlightLinks.size === 0) ? 2 : 0;
              }}
              linkDirectionalParticleWidth={(link: any) => {
                const impactA = blastImpacts.get(link.source.id || link.source);
                const impactB = blastImpacts.get(link.target.id || link.target);
                return (impactA || impactB) ? 4 : 2;
              }}
              linkDirectionalParticleSpeed={(link: any) => {
                const impactA = blastImpacts.get(link.source.id || link.source);
                const impactB = blastImpacts.get(link.target.id || link.target);
                return (impactA || impactB) ? 0.02 : 0.005;
              }}
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
                        <Zap size={10} /> Predicted Blast Radius: {hoveredNode.blastRadius || 5} Nodes
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
                <div className="w-3 h-3 rounded-full bg-[#f43f5e] shadow-[0_0_12px_#f43f5e]"></div>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Failure Origin</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#fb923c] shadow-[0_0_12px_#fb923c]"></div>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Critical Impact</span>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest"><Zap size={10} className="text-amber-400" /> Neural Impact Analyzer</div>
                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest"><Cpu size={10} className="text-indigo-400" /> High-Justice V2.0</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* SIDE IMPACT PANEL */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
              className="w-96 bg-[#080808]/80 backdrop-blur-3xl border-l border-white/10 h-[85vh] self-center rounded-2xl flex flex-col pointer-events-auto shadow-4xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Impact Assessment</h3>
                </div>
                <button onClick={() => setIsAnalyzing(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-500"><ChevronRight size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* ORIGIN CARD */}
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Activity size={12} /> Failure Origin
                  </div>
                  <div className="text-lg font-bold text-white">{simNode?.label}</div>
                  <div className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">{simNode?.company} Infrastructure</div>
                </div>

                {/* BLAST RADIUS LIST */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Affected Technical Domains</div>
                  {impactedModules.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-white/10 transition-all group">
                      <div className={cn(
                        "w-1 h-8 rounded-full",
                        item.level === 1 ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]" : 
                        item.level === 2 ? "bg-orange-500 shadow-[0_0_8px_#fb923c]" : "bg-amber-500"
                      )} />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">{item.node.label}</div>
                        <div className="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">Impact Level: {item.level === 1 ? 'Total Outage' : 'Degraded State'}</div>
                      </div>
                      <FileText size={14} className="text-neutral-600" />
                    </div>
                  ))}
                </div>

                {/* ARCHITECT ADVISORY */}
                <div className="pt-4 border-t border-white/5">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Staff Architect Advisory</div>
                  <p className="text-xs text-neutral-400 leading-relaxed italic">
                    "A failure in {simNode?.label} creates a high-entropy propagation across your {simNode?.company} stack. The primary risk vector is {impactedModules[1]?.node?.label || 'interconnected dependencies'}, which will likely trigger a cascading saturation of the event loop."
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-black/40">
                <button 
                  onClick={() => {
                    setCompany(simNode?.company);
                    onSelectModule(simNode?.id.split('/').pop().replace('.md', ''));
                    onClose();
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  Repair in Architect Arena <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
