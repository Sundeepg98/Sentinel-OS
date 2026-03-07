import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  Type,
  Trash2,
  RotateCcw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistentState } from '@/hooks/usePersistentState';

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

/**
 * 🎨 ARCHITECTURAL WHITEBOARD
 * Features real-time state persistence and cinematic 2D drawing primitives.
 * Utilizes usePersistentState for industrial-grade data integrity and cloud sync.
 */
export const Whiteboard = React.memo(({ sessionId = 'default' }: { sessionId?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Element['type']>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<Element | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [inputValue, setInputValue] = useState('');

  // 🛡️ STAFF STATE: Automated cloud sync via usePersistentState
  const [elements, setElements] = usePersistentState<Element[]>(`whiteboard-${sessionId}`, []);

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: Element) => {
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
        element.points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(element.x!, element.y!, element.width!, element.height!);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(
          element.x! + element.width! / 2,
          element.y! + element.height! / 2,
          Math.abs(element.width! / 2),
          0,
          2 * Math.PI
        );
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(element.x!, element.y!);
        ctx.lineTo(element.x! + element.width!, element.y! + element.height!);
        ctx.stroke();
        break;
      case 'text':
        ctx.font = '14px JetBrains Mono, monospace';
        ctx.fillText(element.text || '', element.x!, element.y!);
        break;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Redraw after resize
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        elements.forEach((el) => drawElement(ctx, el));
        if (currentElement) drawElement(ctx, currentElement);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elements.forEach((el) => drawElement(ctx, el));
    if (currentElement) drawElement(ctx, currentElement);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [elements, currentElement, drawElement]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (textInput) return; // Wait for text input to finish

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'text') {
      setTextInput({ x, y });
      return;
    }

    setIsDrawing(true);
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
        points: [...currentElement.points!, { x, y }],
      });
    } else {
      setCurrentElement({
        ...currentElement,
        width: x - currentElement.x!,
        height: y - currentElement.y!,
      });
    }
  };

  const handleMouseUp = () => {
    if (currentElement) {
      setElements([...elements, currentElement]);
    }
    setIsDrawing(false);
    setCurrentElement(null);
  };

  const handleTextSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && textInput && inputValue.trim()) {
      const newElement: Element = {
        id: Date.now(),
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: inputValue,
        color: '#22d3ee',
      };
      setElements([...elements, newElement]);
      setTextInput(null);
      setInputValue('');
    } else if (e.key === 'Escape') {
      setTextInput(null);
      setInputValue('');
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `architectural-diagram-${sessionId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const clearCanvas = () => {
    setElements([]);
  };

  const undo = () => {
    setElements(elements.slice(0, -1));
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 overflow-x-auto">
        <div className="flex items-center gap-2">
          {[
            { id: 'pencil' as const, icon: MousePointer2, label: 'Draw' },
            { id: 'rect' as const, icon: Square, label: 'Block' },
            { id: 'circle' as const, icon: Circle, label: 'Node' },
            { id: 'line' as const, icon: Minus, label: 'Link' },
            { id: 'text' as const, icon: Type, label: 'Label' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                'p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider',
                tool === t.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-neutral-500 hover:text-white'
              )}
            >
              <t.icon size={14} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            className="p-2 text-neutral-500 hover:text-white transition-colors"
            title="Undo"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={downloadCanvas}
            className="p-2 text-neutral-500 hover:text-white transition-colors"
            title="Export PNG"
          >
            <Download size={14} />
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 text-neutral-500 hover:text-rose-400 transition-colors"
            title="Clear All"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        className="flex-1 relative cursor-crosshair"
        role="region"
        aria-label="Architectural drawing surface"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full"
          tabIndex={0}
          aria-label="Design canvas. Use mouse or touch to draw architectural diagrams."
        />

        {/* TEXT INPUT OVERLAY */}
        {textInput && (
          <div className="absolute z-50" style={{ left: textInput.x, top: textInput.y - 10 }}>
            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleTextSubmit}
              onBlur={() => {
                setTextInput(null);
                setInputValue('');
              }}
              className="bg-[#0a0a0a] border border-cyan-500/50 rounded px-2 py-1 text-xs text-cyan-400 outline-none shadow-[0_0_15px_rgba(34,211,238,0.2)] font-mono"
              placeholder="Labeling..."
            />
          </div>
        )}

        {elements.length === 0 && !currentElement && !textInput && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-neutral-700 font-mono text-[10px] uppercase tracking-[0.2em]">
              Architect's Drawing Surface
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
