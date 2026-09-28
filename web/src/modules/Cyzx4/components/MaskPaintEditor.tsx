import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  Hand,
  Minus,
  Paintbrush,
  Plus,
  RotateCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const BRUSH_COLOR_PRESETS = [
  { id: 'red', name: '红', hex: '#ef4444' },
  { id: 'yellow', name: '黄', hex: '#eab308' },
  { id: 'blue', name: '蓝', hex: '#3b82f6' },
  { id: 'green', name: '绿', hex: '#22c55e' },
  { id: 'black', name: '黑', hex: '#000000' },
  { id: 'white', name: '白', hex: '#ffffff' },
] as const;

const hexToRgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((part) => `${part}${part}`).join('')
    : value;
  const number = Number.parseInt(normalized, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
};

export type SavedPaintMask = {
  base64?: string;
  preview?: string;
  composite?: string;
  opacity: number;
};

type MaskPaintEditorProps = {
  imageUrl: string;
  imageName?: string;
  initialPreview?: string;
  initialOpacity?: number;
  onClose: () => void;
  onSave: (mask: SavedPaintMask) => void;
};

type Point = { x: number; y: number };
type Tool = 'brush' | 'eraser' | 'zoom';

const MaskPaintEditor: React.FC<MaskPaintEditorProps> = ({
  imageUrl,
  imageName,
  initialPreview,
  initialOpacity = 60,
  onClose,
  onSave,
}) => {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<Point | null>(null);
  const lastCursorClientPointRef = useRef<Point | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; offset: Point } | null>(null);
  const brushSizeRef = useRef(35);

  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(35);
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushOpacity, setBrushOpacity] = useState(Math.max(10, Math.min(100, initialOpacity)) / 100);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasPaint, setHasPaint] = useState(Boolean(initialPreview));
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!sourceCanvas || !maskCanvas) return;

    let disposed = false;
    const sourceImage = new window.Image();
    sourceImage.onload = () => {
      if (disposed) return;
      const width = sourceImage.naturalWidth || 1;
      const height = sourceImage.naturalHeight || 1;
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      sourceCanvas.getContext('2d')?.drawImage(sourceImage, 0, 0, width, height);

      if (!initialPreview) {
        setIsReady(true);
        return;
      }

      const overlay = new window.Image();
      overlay.onload = () => {
        if (disposed) return;
        const context = maskCanvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, width, height);
          context.drawImage(overlay, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height);
          for (let index = 3; index < pixels.data.length; index += 4) {
            if (pixels.data[index] > 8) pixels.data[index] = 255;
          }
          context.putImageData(pixels, 0, 0);
        }
        setIsReady(true);
      };
      overlay.onerror = () => !disposed && setIsReady(true);
      overlay.src = initialPreview;
    };
    sourceImage.onerror = () => !disposed && setIsReady(true);
    sourceImage.src = imageUrl;
    return () => {
      disposed = true;
    };
  }, [imageUrl, initialPreview]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (event.code === 'Escape') onClose();
      if (event.code === 'Space') {
        event.preventDefault();
        setIsSpacePressed(true);
      }
      if (event.key.toLowerCase() === 'b') setActiveTool('brush');
      if (event.key.toLowerCase() === 'e') setActiveTool('eraser');
      if (event.key.toLowerCase() === 'z') setActiveTool('zoom');
      if (event.key === 'Alt') setIsAltPressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false);
      if (event.key === 'Alt') setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onClose]);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height)),
    };
  };

  const renderCursorAt = useCallback((clientPoint: Point) => {
    if (!cursorRef.current) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localScale = canvas.clientWidth / Math.max(1, canvas.width);
    const viewportToLocalScale = canvas.clientWidth / Math.max(1, rect.width);
    const renderedSize = brushSizeRef.current * localScale;
    const localX = (clientPoint.x - rect.left) * viewportToLocalScale;
    const localY = (clientPoint.y - rect.top) * viewportToLocalScale;
    cursorRef.current.style.width = `${renderedSize}px`;
    cursorRef.current.style.height = `${renderedSize}px`;
    cursorRef.current.style.transform = `translate3d(${localX - renderedSize / 2}px, ${localY - renderedSize / 2}px, 0)`;
    cursorRef.current.style.opacity = '1';
  }, []);

  const updateCursor = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const clientPoint = { x: event.clientX, y: event.clientY };
    lastCursorClientPointRef.current = clientPoint;
    renderCursorAt(clientPoint);
  }, [renderCursorAt]);

  const applyBrushSize = useCallback((nextSize: number) => {
    const normalizedSize = Math.max(5, Math.min(150, Math.round(nextSize)));
    brushSizeRef.current = normalizedSize;
    setBrushSize(normalizedSize);
    if (lastCursorClientPointRef.current) renderCursorAt(lastCursorClientPointRef.current);
  }, [renderCursorAt]);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeTool === 'zoom' || event.altKey) {
        setZoomLevel((value) => Math.max(0.5, Math.min(4, Number((value + (event.deltaY < 0 ? 0.25 : -0.25)).toFixed(2)))));
      } else {
        applyBrushSize(brushSizeRef.current + (event.deltaY < 0 ? 5 : -5));
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [activeTool, applyBrushSize]);

  const drawSegment = useCallback((from: Point, to: Point) => {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.save();
    context.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = brushColor;
    context.fillStyle = brushColor;
    const currentBrushSize = brushSizeRef.current;
    context.lineWidth = currentBrushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (from.x === to.x && from.y === to.y) {
      context.beginPath();
      context.arc(to.x, to.y, currentBrushSize / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    context.restore();
    if (activeTool === 'brush') setHasPaint(true);
  }, [activeTool, brushColor]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isReady) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCursor(event);

    if (isSpacePressed) {
      panStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        offset: panOffset,
      };
      setIsPanning(true);
      return;
    }

    if (activeTool === 'zoom') {
      setZoomLevel((current) => Math.max(0.5, Math.min(4, Number((current + (isAltPressed ? -0.25 : 0.25)).toFixed(2)))));
      return;
    }

    const point = getCanvasPoint(event);
    lastPointRef.current = point;
    setIsDrawing(true);
    drawSegment(point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateCursor(event);
    if (isPanning && panStartRef.current) {
      setPanOffset({
        x: panStartRef.current.offset.x + event.clientX - panStartRef.current.clientX,
        y: panStartRef.current.offset.y + event.clientY - panStartRef.current.clientY,
      });
      return;
    }
    if (!isDrawing || !lastPointRef.current) return;
    const point = getCanvasPoint(event);
    drawSegment(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const finishPointerAction = () => {
    setIsDrawing(false);
    setIsPanning(false);
    lastPointRef.current = null;
    panStartRef.current = null;
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasPaint(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const saveMask = () => {
    const paintCanvas = maskCanvasRef.current;
    const context = paintCanvas?.getContext('2d');
    if (!paintCanvas || !context) return;

    const pixels = context.getImageData(0, 0, paintCanvas.width, paintCanvas.height).data;
    let containsPaint = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 8) {
        containsPaint = true;
        break;
      }
    }
    if (!containsPaint) {
      onSave({ opacity: Math.round(brushOpacity * 100) });
      return;
    }

    const whiteLayer = document.createElement('canvas');
    whiteLayer.width = paintCanvas.width;
    whiteLayer.height = paintCanvas.height;
    const whiteContext = whiteLayer.getContext('2d');
    if (!whiteContext) return;
    whiteContext.drawImage(paintCanvas, 0, 0);
    whiteContext.globalCompositeOperation = 'source-in';
    whiteContext.fillStyle = '#ffffff';
    whiteContext.fillRect(0, 0, whiteLayer.width, whiteLayer.height);

    const binaryMask = document.createElement('canvas');
    binaryMask.width = paintCanvas.width;
    binaryMask.height = paintCanvas.height;
    const binaryContext = binaryMask.getContext('2d');
    if (!binaryContext) return;
    binaryContext.fillStyle = '#000000';
    binaryContext.fillRect(0, 0, binaryMask.width, binaryMask.height);
    binaryContext.drawImage(whiteLayer, 0, 0);

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = paintCanvas.width;
    previewCanvas.height = paintCanvas.height;
    const previewContext = previewCanvas.getContext('2d');
    if (!previewContext) return;
    previewContext.globalAlpha = brushOpacity;
    previewContext.drawImage(paintCanvas, 0, 0);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = paintCanvas.width;
    compositeCanvas.height = paintCanvas.height;
    const compositeContext = compositeCanvas.getContext('2d');
    const sourceCanvas = sourceCanvasRef.current;
    if (!compositeContext || !sourceCanvas) return;
    compositeContext.drawImage(sourceCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);
    compositeContext.globalAlpha = brushOpacity;
    compositeContext.drawImage(paintCanvas, 0, 0);

    onSave({
      base64: binaryMask.toDataURL('image/png').split(',')[1],
      preview: previewCanvas.toDataURL('image/png'),
      composite: compositeCanvas.toDataURL('image/png'),
      opacity: Math.round(brushOpacity * 100),
    });
  };

  const cursor = isSpacePressed
    ? (isPanning ? 'grabbing' : 'grab')
    : activeTool === 'zoom'
      ? (isAltPressed ? 'zoom-out' : 'zoom-in')
      : 'none';

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="模特图涂抹画布"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-[96vw] max-w-[110rem] flex-col overflow-hidden rounded-3xl border border-pastel-border bg-white shadow-2xl dark:bg-[#10192b]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border bg-slate-50 px-4 py-3 dark:bg-[#182338] sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Paintbrush className="h-5 w-5 shrink-0 text-orange-500" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-pastel-text sm:text-base">模特图画笔涂抹画布</h3>
              <p className="truncate text-[0.68rem] text-pastel-muted">{imageName || '模特参考图'} · 涂抹区域将作为换装范围</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-xl bg-white p-1 shadow-sm dark:bg-slate-900">
              <button type="button" onClick={() => setActiveTool('brush')} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black ${activeTool === 'brush' ? 'bg-red-500 text-white' : 'text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Paintbrush className="h-3.5 w-3.5" />画笔 [B]</button>
              <button type="button" onClick={() => setActiveTool('eraser')} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black ${activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Eraser className="h-3.5 w-3.5" />橡皮擦 [E]</button>
              <button type="button" onClick={() => setActiveTool('zoom')} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black ${activeTool === 'zoom' ? 'bg-amber-500 text-slate-950' : 'text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Search className="h-3.5 w-3.5" />放大镜 [Z]</button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-pastel-border bg-white px-2 py-1.5 dark:bg-slate-900">
              {BRUSH_COLOR_PRESETS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => { setBrushColor(color.hex); setActiveTool('brush'); }}
                  className={`h-5 w-5 rounded-full border transition hover:scale-110 ${brushColor === color.hex ? 'scale-110 border-white ring-2 ring-orange-500' : 'border-slate-300'}`}
                  style={{ backgroundColor: color.hex }}
                  title={`画笔颜色：${color.name}`}
                />
              ))}
            </div>

            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-pastel-border bg-white px-2 text-[0.68rem] font-bold text-pastel-muted dark:bg-slate-900">
              透明度
              <input type="range" min={0.1} max={1} step={0.05} value={brushOpacity} onChange={(event) => setBrushOpacity(Number(event.target.value))} className="w-20 accent-orange-500" />
              <span className="w-8 text-right">{Math.round(brushOpacity * 100)}%</span>
            </label>

            <label className="flex min-h-9 items-center gap-1 rounded-xl border border-pastel-border bg-white px-2 text-[0.68rem] font-bold text-pastel-muted dark:bg-slate-900">
              <button type="button" onClick={() => applyBrushSize(brushSizeRef.current - 5)}><Minus className="h-3.5 w-3.5" /></button>
              <input type="range" min={5} max={150} value={brushSize} onInput={(event) => applyBrushSize(Number(event.currentTarget.value))} className="w-20 accent-orange-500" />
              <button type="button" onClick={() => applyBrushSize(brushSizeRef.current + 5)}><Plus className="h-3.5 w-3.5" /></button>
              <span className="w-9 text-right">{brushSize}px</span>
            </label>

            <div className="flex min-h-9 items-center gap-1 rounded-xl border border-pastel-border bg-white px-2 dark:bg-slate-900">
              <button type="button" onClick={() => setZoomLevel((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))} title="缩小"><ZoomOut className="h-4 w-4" /></button>
              <span className="min-w-11 text-center text-xs font-black text-pastel-text">{Math.round(zoomLevel * 100)}%</span>
              <button type="button" onClick={() => setZoomLevel((value) => Math.min(4, Number((value + 0.25).toFixed(2))))} title="放大"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={resetView} className="ml-1 rounded-md bg-slate-100 px-2 py-1 text-[0.65rem] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">重置</button>
            </div>

            <button type="button" onClick={clearMask} className="flex min-h-9 items-center gap-1.5 rounded-xl border border-pastel-border px-3 text-xs font-bold text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />清除</button>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="关闭涂抹画布"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden bg-slate-950 p-4">
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
              transformOrigin: 'center',
              willChange: 'transform',
              cursor,
            }}
          >
            <canvas ref={sourceCanvasRef} className="block max-h-[72vh] max-w-[88vw] object-contain" />
            <canvas
              ref={maskCanvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ opacity: activeTool === 'eraser' ? 1 : brushOpacity }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerAction}
              onPointerCancel={finishPointerAction}
              onPointerLeave={(event) => {
                if (!isDrawing && !isPanning && cursorRef.current) cursorRef.current.style.opacity = '0';
                if (event.buttons === 0) finishPointerAction();
              }}
            />
            {!isSpacePressed && activeTool !== 'zoom' && (
              <div
                ref={cursorRef}
                className="pointer-events-none absolute left-0 top-0 z-30 rounded-full border-2 opacity-0"
                style={{
                  borderColor: activeTool === 'eraser' ? 'rgba(59,130,246,.95)' : hexToRgba(brushColor, 0.95),
                  backgroundColor: activeTool === 'eraser' ? 'rgba(59,130,246,.2)' : hexToRgba(brushColor, brushOpacity * 0.4),
                  willChange: 'transform',
                }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pastel-border bg-white px-4 py-3 dark:bg-[#182338] sm:px-6">
          <div className="flex items-center gap-2 text-xs font-bold text-pastel-muted">
            {isSpacePressed ? <Hand className="h-4 w-4 text-orange-500" /> : <span className={`h-2.5 w-2.5 rounded-full ${hasPaint ? 'bg-red-500' : 'bg-slate-300'}`} />}
            <span>{isSpacePressed ? '抓手模式：拖动画面' : hasPaint ? '涂抹区域已就绪' : '按 B 画笔、E 橡皮擦、Z 放大镜；按住 Space 拖动画面'}</span>
          </div>
          <button type="button" onClick={saveMask} className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 text-xs font-black text-white shadow-lg hover:brightness-105"><Check className="h-4 w-4" />完成涂抹并保存蒙版</button>
        </div>
      </div>
    </div>
  );
};

export default MaskPaintEditor;
