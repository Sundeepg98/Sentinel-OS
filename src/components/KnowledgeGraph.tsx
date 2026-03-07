import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph3D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from 'react-force-graph-3d';
import { useDossierContext } from '@/lib/context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  X,
  Maximize2,
  Minimize2,
  Cpu,
  Zap,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  BloomEffect,
  VignetteEffect,
  EdgeDetectionMode,
} from 'postprocessing';
import { cn } from '@/lib/utils';
import { useAuth } from '@clerk/clerk-react';
import { useMutation } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/api';
import type { GraphData, GraphNode, GraphLink } from '@/types';
import { useToast } from '@/hooks/useToast';

interface KnowledgeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
}

interface IncidentAdvisory {
  title: string;
  description: string;
}

/**
 * 🛰️ ARCHITECTURAL NERVOUS SYSTEM (Knowledge Graph)
 * Cinematic 3D visualization featuring the Phase 4 Neural Impact Simulator.
 */
export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  isOpen,
  onClose,
  onSelectModule,
}) => {
  const { setCompany } = useDossierContext();
  const { getToken } = useAuth();
  const { toast: showToast } = useToast();
  const graphRef = useRef<
    ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined
  >(undefined);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<GraphNode>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<GraphLink>());
  const [isSimActive, setIsSimActive] = useState(false);
  const [simNode, setSimNode] = useState<GraphNode | null>(null);
  const [blastImpacts, setBlastImpacts] = useState<Map<string, number>>(new Map());
  const [advisory, setAdvisory] = useState<IncidentAdvisory | null>(null);
  const hasInitialZoomed = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Analysis & Build Graph
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const data = await fetchWithAuth<GraphData>('intelligence/search?q=*', getToken);
        if (data && data.nodes) {
          setGraphData(data);
        }
      } catch (_err: unknown) {
        showToast('Failed to sync knowledge graph', 'error');
        console.error('Knowledge Graph Sync Error:', _err);
      }
    };
    if (isOpen) fetchGraph();
  }, [isOpen, getToken, showToast]);

  // 2. Responsive Resizing
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // 3. Post-Processing Effects (Cinematic Layer)
  useEffect(() => {
    if (!graphRef.current) return;

    const graph = graphRef.current;
    const scene = graph.scene();
    const camera = graph.camera();
    const renderer = graph.renderer();

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // SMAA Antialiasing
    const smaaEffect = new SMAAEffect();
    (
      smaaEffect.edgeDetectionMaterial as unknown as { edgeDetectionMode: unknown }
    ).edgeDetectionMode = EdgeDetectionMode.COLOR;

    // Bloom for Neon Glow
    const bloomEffect = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.1,
      luminanceSmoothing: 0.9,
    });

    // Vignette for Focus
    const vignetteEffect = new VignetteEffect({
      offset: 0.3,
      darkness: 0.5,
    });

    composer.addPass(new EffectPass(camera, smaaEffect, bloomEffect, vignetteEffect));

    // Initial Zoom
    if (!hasInitialZoomed.current) {
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.cameraPosition({ z: 180 }, undefined, 800);
          const controls = graphRef.current.controls() as unknown as {
            minDistance: number;
            maxDistance: number;
            enableDamping: boolean;
            dampingFactor: number;
          };
          if (controls) {
            controls.minDistance = 80;
            controls.maxDistance = 450;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
          }
          hasInitialZoomed.current = true;
        }
      }, 400);
    }
  }, [isOpen]);

  // 4. Neural Impact Simulator
  const generateImpactAdvisory = useMutation({
    mutationFn: async (moduleIds: string[]) => {
      const data = await fetchWithAuth<IncidentAdvisory>('intelligence/incident', getToken, {
        method: 'POST',
        body: JSON.stringify({ moduleIds }),
      });
      return data;
    },
    onSuccess: (data) => setAdvisory(data),
  });

  const triggerBlastRadius = useCallback(
    (node: GraphNode) => {
      setSimNode(node);
      const impacts = new Map<string, number>();
      impacts.set(node.id, 1); // Origin

      const directLinks = graphData.links.filter(
        (l) =>
          (typeof l.source === 'string' ? l.source : l.source.id) === node.id ||
          (typeof l.target === 'string' ? l.target : l.target.id) === node.id
      );

      const moduleIds: string[] = [node.id];

      directLinks.forEach((l) => {
        const targetId = (typeof l.target === 'string' ? l.target : l.target.id) as string;
        const sourceId = (typeof l.source === 'string' ? l.source : l.source.id) as string;
        const linkedId = targetId === node.id ? sourceId : targetId;
        impacts.set(linkedId, 2); // Tier 2 Impact
        moduleIds.push(linkedId);
      });

      setBlastImpacts(impacts);
      generateImpactAdvisory.mutate(moduleIds);

      if (graphRef.current) {
        graphRef.current.cameraPosition(
          { x: (node.x || 0) * 1.2, y: (node.y || 0) * 1.2, z: (node.z || 0) * 1.2 },
          node as { x: number; y: number; z: number },
          800
        );
      }
    },
    [graphData.links, generateImpactAdvisory]
  );

  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      // 🛡️ STAFF BASIC: Object Reuse & Memoization
      // We check if the node already has an assigned object to avoid expensive recreation
      const cachedObj = (node as unknown as Record<string, THREE.Group>).__threeObj;
      if (cachedObj && !isSimActive && highlightNodes.size === 0) {
        return cachedObj;
      }

      const group = new THREE.Group();
      const isHighlighted = highlightNodes.has(node) || highlightNodes.size === 0;
      const impactLevel = blastImpacts.get(node.id);
      const isSimOrigin = simNode === node;

      const size = node.val || 3;
      const readiness = node.readiness || 0;

      let activeColor = '#737373';
      if (isSimOrigin) activeColor = '#f43f5e';
      else if (impactLevel === 2) activeColor = '#fb923c';
      else if (impactLevel === 3) activeColor = '#facc15';
      else if (node.group === 'learned') activeColor = '#facc15';
      else if (node.group === 'module') {
        if (readiness < 0.3) activeColor = '#f43f5e';
        else if (readiness < 0.7) activeColor = '#f59e0b';
        else activeColor = '#10b981';
      } else activeColor = '#6366f1';

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
        emissiveIntensity: isHighlighted ? 0.2 + (impactLevel ? 1 : readiness) * 0.8 : 0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      if (impactLevel || isSimOrigin) {
        const ringGeom = new THREE.RingGeometry(size + 1, size + 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: activeColor,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
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

      // Cache the object on the node for future reuse
      if (!isSimActive) {
        (node as unknown as Record<string, THREE.Group>).__threeObj = group;
      }

      return group;
    },
    [highlightNodes, blastImpacts, simNode, isSimActive]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (isSimActive) {
        triggerBlastRadius(node);
        return;
      }

      if (node.group === 'module') {
        const [companyId, fileName] = node.id.split('/');
        const moduleId = fileName.replace('.md', '');
        if (graphRef.current) {
          graphRef.current.cameraPosition(
            { x: (node.x || 0) * 1.5, y: (node.y || 0) * 1.5, z: (node.z || 0) * 1.5 },
            node as { x: number; y: number; z: number },
            800
          );
        }
        setTimeout(() => {
          setCompany(companyId);
          onSelectModule(moduleId);
          onClose();
        }, 850);
      }
    },
    [isSimActive, triggerBlastRadius, setCompany, onSelectModule, onClose]
  );

  const impactedModules = useMemo(() => {
    if (!simNode) return [];
    return graphData.nodes.filter((n) => blastImpacts.has(n.id));
  }, [simNode, graphData.nodes, blastImpacts]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 font-sans overflow-hidden',
        isFullscreen ? 'p-0' : ''
      )}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#050505]/95 backdrop-blur-2xl"
        onClick={onClose}
      />

      <div
        ref={containerRef}
        className={cn(
          'relative w-full h-full max-w-7xl bg-[#080808] border border-white/[0.05] rounded-3xl shadow-3xl flex flex-col overflow-hidden transition-all duration-500',
          isFullscreen ? 'max-w-none rounded-none border-none' : ''
        )}
      >
        {/* GRAPH HEADER */}
        <div className="p-6 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <Network className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 id="graph-title" className="text-lg font-bold text-white tracking-tight">
                Architectural Nervous System
              </h3>
              <p className="text-neutral-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-mono">
                Visualizing neural intersections & systemic dependencies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSimActive(!isSimActive)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border',
                isSimActive
                  ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              )}
            >
              <Zap size={14} className={isSimActive ? 'animate-pulse' : ''} />
              {isSimActive ? 'Impact Mode ACTIVE' : 'Blast Radius Simulator'}
            </button>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-neutral-400 hover:text-white transition-all"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/[0.03] hover:bg-rose-500/20 border border-white/[0.08] hover:border-rose-500/30 rounded-xl text-neutral-400 hover:text-rose-400 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 3D RENDER SURFACE */}
        <div className="flex-1 bg-black relative group/graph">
          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#000000"
            showNavInfo={false}
            nodeLabel="label"
            nodeRelSize={6}
            nodeThreeObject={nodeThreeObject}
            linkWidth={(link: GraphLink) => (highlightLinks.has(link) ? 2 : 0.5)}
            linkColor={() => '#ffffff'}
            linkDirectionalParticles={(link: GraphLink) => (highlightLinks.has(link) ? 4 : 0)}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleColor={() => '#6366f1'}
            onNodeClick={handleNodeClick}
            onNodeHover={(node: GraphNode | null) => {
              const nodes = new Set<GraphNode>();
              const links = new Set<GraphLink>();
              if (node) {
                nodes.add(node);
                graphData.links.forEach((l) => {
                  const sourceId = (
                    typeof l.source === 'string' ? l.source : l.source.id
                  ) as string;
                  const targetId = (
                    typeof l.target === 'string' ? l.target : l.target.id
                  ) as string;
                  if (sourceId === node.id || targetId === node.id) {
                    links.add(l);
                    nodes.add(typeof l.source === 'string' ? node : (l.source as GraphNode));
                    nodes.add(typeof l.target === 'string' ? node : (l.target as GraphNode));
                  }
                });
              }
              setHighlightNodes(nodes);
              setHighlightLinks(links);
            }}
          />

          {/* SIMULATION OVERLAY */}
          {isSimActive && (
            <div className="absolute top-6 left-6 z-20 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="bg-[#050505]/80 backdrop-blur-xl border border-rose-500/30 p-6 rounded-2xl max-w-sm shadow-2xl">
                <div className="flex items-center gap-3 text-rose-500 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">
                  <Activity size={14} className="animate-pulse" /> Neural Impact Analysis
                </div>

                {!simNode ? (
                  <p className="text-neutral-400 text-[13px] leading-relaxed italic">
                    Select any architectural node to simulate a component failure and analyze the
                    systemic blast radius.
                  </p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-mono">
                        Failure Origin
                      </div>
                      <div className="text-lg font-bold text-white">{simNode.label}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-[9px] text-neutral-500 uppercase tracking-widest mb-1 font-mono">
                          Impacted
                        </div>
                        <div className="text-xl font-black text-rose-500">
                          {impactedModules.length}
                        </div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-[9px] text-neutral-500 uppercase tracking-widest mb-1 font-mono">
                          Severity
                        </div>
                        <div className="text-xl font-black text-amber-500">
                          {impactedModules.length > 5 ? 'CRITICAL' : 'HIGH'}
                        </div>
                      </div>
                    </div>

                    {advisory && (
                      <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                          SRE Advisory
                        </div>
                        <p className="text-[12px] text-neutral-300 leading-relaxed font-mono">
                          {advisory.description}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSimNode(null);
                        setBlastImpacts(new Map());
                        setAdvisory(null);
                      }}
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Reset Simulation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEGEND & STATUS */}
          <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-4">
            <div className="bg-[#050505]/60 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  High Readiness
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  Needs Review
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  Critical Debt
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  System Concept
                </span>
              </div>
            </div>
          </div>

          {/* SEARCH & DISCOVERY OVERLAY */}
          <div className="absolute bottom-6 right-6 z-20">
            <div className="bg-[#050505]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl w-80 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest">
                <Activity size={14} /> Engine Status
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                    Neural Density
                  </span>
                  <span className="text-[10px] font-bold text-white font-mono">
                    {graphData.nodes.length} Nodes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                    Synaptic Links
                  </span>
                  <span className="text-[10px] font-bold text-white font-mono">
                    {graphData.links.length} Edges
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  <Zap size={10} className="text-amber-400" /> Neural Impact Analyzer
                </div>
                <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  <Cpu size={10} className="text-indigo-400" /> High-Justice V2.8
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* REPAIR ADVISORY POPUP */}
        <AnimatePresence>
          {advisory && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
            >
              <div className="bg-indigo-600 border border-indigo-400 p-6 rounded-2xl shadow-[0_0_50px_rgba(79,70,229,0.4)] flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold tracking-tight">{advisory.title}</h4>
                    <p className="text-indigo-100 text-xs mt-1 font-medium opacity-90">
                      Systemic remediation strategy generated for impacted modules.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (simNode) {
                      const [companyId, fileName] = simNode.id.split('/');
                      const moduleId = fileName.replace('.md', '');
                      setCompany(companyId);
                      onSelectModule(moduleId);
                      onClose();
                    }
                  }}
                  className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 whitespace-nowrap shadow-xl"
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
