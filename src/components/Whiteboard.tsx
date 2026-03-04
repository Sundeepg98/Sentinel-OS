import { useState, useRef, useEffect } from 'react';
import { MousePointer2, Square, Circle, Minus, Type, Trash2, RotateCcw, Download } from 'lucide-react';
import { cn } from '../lib/utils';

interface Element {
  id: number;
  type: 'pencil' | 'rect' | 'circle' | 'line' | 'text';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

export const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [tool, setTool] = useState<Element['type']>('pencil');
  const [isDrawing, setIsRecording] = useState(false);
  const [currentElement, setCurrentElement] = useState<Element | null>(null);

  const drawElement = (ctx: CanvasRenderingContext2D, element: Element) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'pencil':
        if (!element.points || element.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);
        element.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(element.x!, element.y!, element.width!, element.height!);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(element.x! + element.width! / 2, element.y! + element.height! / 2, Math.abs(element.width! / 2), 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(element.x!, element.y!);
        ctx.lineTo(element.x! + element.width!, element.y! + element.height!);
        ctx.stroke();
        break;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elements.forEach(el => drawElement(ctx, el));
    if (currentElement) drawElement(ctx, currentElement);
  }, [elements, currentElement]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsRecording(true);
    const id = Date.now();
    
    if (tool === 'pencil') {
      setCurrentElement({ id, type: 'pencil', points: [{ x, y }], color: '#22d3ee' });
    } else {
      setCurrentElement({ id, type: tool, x, y, width: 0, height: 0, color: '#22d3ee' });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentElement) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentElement.type === 'pencil') {
      setCurrentElement({
        ...currentElement,
        points: [...currentElement.points!, { x, y }]
      });
    } else {
      setCurrentElement({
        ...currentElement,
        width: x - currentElement.x!,
        height: y - currentElement.y!
      });
    }
  };

  const handleMouseUp = () => {
    if (currentElement) {
      setElements([...elements, currentElement]);
    }
    setIsRecording(false);
    setCurrentElement(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      {/* TOOLBAR */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border-b border-white/5 overflow-x-auto">
        {[
          { id: 'pencil', icon: MousePointer2, label: 'Draw' },
          { id: 'rect', icon: Square, label: 'Block' },
          { id: 'circle', icon: Circle, label: 'Node' },
          { id: 'line', icon: Minus, label: 'Link' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id as any)}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider",
              tool === t.id ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-neutral-500 hover:text-white"
            )}
          >
            <t.icon size={14} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        
        <div className="h-4 w-px bg-white/10 mx-2" />
        
        <button onClick={() => setElements(elements.slice(0, -1))} className="p-2 text-neutral-500 hover:text-white transition-colors">
          <RotateCcw size={14} />
        </button>
        <button onClick={() => setElements([])} className="p-2 text-neutral-500 hover:text-rose-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* CANVAS */}
      <div className="flex-1 relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full"
        />
        
        {elements.length === 0 && !currentElement && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-neutral-700 font-mono text-[10px] uppercase tracking-[0.2em]">Architect's Drawing Surface</p>
          </div>
        )}
      </div>
    </div>
  );
};
