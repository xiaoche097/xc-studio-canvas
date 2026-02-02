import React, { useState } from 'react';
import { editGeneratedImage, blobToBase64, inpaintImage } from '../services/geminiService';
import { Wand2, Image as ImageIcon, Loader2, Save, AlertCircle, Key, MousePointer2, Eraser, Trash2, Crosshair, RotateCcw, Sparkles, Upload, CheckCircle2, X } from 'lucide-react';

interface EditorTabProps {
  initialImage: string | null;
}

const getFriendlyErrorMessage = (error: any): string => {
  const message = error.message || JSON.stringify(error);
  if (message.includes('403')) return "权限不足 (403)。请检查您的 API 密钥。";
  if (message.includes('401')) return "身份验证失败 (401)。";
  return `操作失败: ${message.substring(0, 150)}...`;
};

interface EditPoint {
  id: number;
  x: number;
  y: number;
  snapshot?: string;
}

const EditorTab: React.FC<EditorTabProps> = ({ initialImage }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New States for Marker & Eraser
  const [mode, setMode] = useState<'move' | 'point' | 'eraser'>('move');
  const [points, setPoints] = useState<EditPoint[]>([]);
  const [brushSize, setBrushSize] = useState(40);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await blobToBase64(file);
      setCurrentImage(`data:${file.type};base64,${base64}`);
      setError(null);
      setPoints([]);
      clearMask();
    }
  };

  const clearMask = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const clearAll = () => {
    setPoints([]);
    clearMask();
    setEditPrompt('');
  };

  const getMaskBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Check if anything is drawn
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasData = imageData.data.some((channel, index) => index % 4 === 3 && channel > 0);
    if (!hasData) return null;

    // Create a temporary canvas to export as binary mask
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return null;

    // Fill background with black
    exportCtx.fillStyle = 'black';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw the mask as white
    exportCtx.globalCompositeOperation = 'source-over';
    exportCtx.drawImage(canvas, 0, 0);
    // Convert everything with alpha to white
    const exportImageData = exportCtx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < exportImageData.data.length; i += 4) {
      if (exportImageData.data[i + 3] > 0) {
        exportImageData.data[i] = 255;
        exportImageData.data[i + 1] = 255;
        exportImageData.data[i + 2] = 255;
        exportImageData.data[i + 3] = 255;
      }
    }
    exportCtx.putImageData(exportImageData, 0, 0);

    return exportCanvas.toDataURL('image/png').split(',')[1];
  };

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentImage || mode === 'move') return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = (('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = (('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    if (mode === 'point' && e.type === 'mousedown') {
      const xPct = (x / rect.width) * 100;
      const yPct = (y / rect.height) * 100;

      if (points.length >= 10) return;

      const newPoint: EditPoint = {
        id: Date.now(),
        x: xPct,
        y: yPct
      };
      setPoints([...points, newPoint]);
    } else if (mode === 'eraser') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (e.type === 'mousedown' || e.type === 'touchstart') {
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if ((e.type === 'mousemove' || e.type === 'touchmove') && isDrawing) {
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') {
        setIsDrawing(false);
      }
    }
  };

  const handleEdit = async () => {
    if (!currentImage) return;

    let finalPrompt = editPrompt;
    const maskBase64 = getMaskBase64();

    // If eraser is used but no prompt, assume removal
    if (maskBase64 && !finalPrompt) {
      finalPrompt = "Please remove the selected object or area and fill it naturally to match the surrounding background and textures.";
    }

    if (!finalPrompt && points.length === 0) return;

    // Inject points into prompt if any
    if (points.length > 0) {
      const pointStr = points.map((p, i) => `Point ${i + 1}: [x:${p.x.toFixed(1)}%, y:${p.y.toFixed(1)}%]`).join(", ");
      finalPrompt = `The user has marked specific points on the image: ${pointStr}. Instruction: ${finalPrompt}`;
    }

    setIsEditing(true);
    setError(null);
    try {
      const matches = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) throw new Error("无效的图片格式。");

      let resultImages: string[] = [];
      if (maskBase64) {
        // Use Inpainting for mask
        resultImages = await inpaintImage(matches[2], maskBase64, finalPrompt);
      } else {
        // Use normal edit for points/text
        resultImages = await editGeneratedImage(matches[2], matches[1], finalPrompt);
      }

      if (resultImages.length > 0) {
        setCurrentImage(resultImages[0]);
        setEditPrompt('');
        setPoints([]);
        clearMask();
      }
    } catch (error: any) {
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden relative">
      {/* 1. Creative Workspace (Main Image Area) */}
      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* 工作区状态指示器 (增强可见度) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white/95 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-pastel-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-4 transition-all hover:shadow-[0_8px_30px_rgba(212,134,159,0.1)]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-pastel-highlight rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-pastel-pink rounded-full animate-ping opacity-30"></div>
              </div>
              <span className="text-[10px] font-black text-pastel-highlight uppercase tracking-[0.25em]">工作室状态</span>
            </div>
            <div className="h-4 w-px bg-pastel-border/60"></div>
            <p className="text-sm font-bold text-pastel-text flex items-center gap-2">
              {currentImage ? (
                <>素材就绪 <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></>
              ) : "等待添加素材"}
            </p>
          </div>
        </div>

        {/* 悬浮工具栏 (品牌化设计) */}
        {currentImage && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4 p-2.5 bg-white/80 backdrop-blur-2xl rounded-[2rem] border border-pastel-border shadow-lg animate-in fade-in slide-in-from-left-4 duration-700">
            <ToolButton
              active={mode === 'move'}
              onClick={() => setMode('move')}
              icon={<MousePointer2 className="w-5 h-5" />}
              label="选择模式"
            />
            <ToolButton
              active={mode === 'point'}
              onClick={() => setMode('point')}
              icon={<Crosshair className="w-5 h-5" />}
              label="添加标记点"
            />
            <ToolButton
              active={mode === 'eraser'}
              onClick={() => setMode('eraser')}
              icon={<Eraser className="w-5 h-5" />}
              label="智能消除笔"
            />
            <div className="h-px bg-pastel-border mx-2"></div>
            <ToolButton
              active={false}
              onClick={clearAll}
              icon={<RotateCcw className="w-5 h-5" />}
              label="重置画布"
              danger
            />
          </div>
        )}

        {/* The Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div
            ref={containerRef}
            className={`relative bg-white rounded-[2.5rem] shadow-[0_30px_60px_-20px_rgba(212,134,159,0.15)] overflow-hidden transition-all duration-700 group
               ${currentImage ? 'border border-pastel-border' : 'border-4 border-dashed border-pastel-border w-[520px] h-[520px] hover:border-pastel-pink hover:bg-white/50'}`}
          >
            {currentImage ? (
              <>
                <img
                  ref={imgRef}
                  src={currentImage}
                  alt="Creative Source"
                  className="max-w-[72vw] max-h-[72vh] object-contain pointer-events-none select-none transition-all duration-700"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const canvas = canvasRef.current;
                    if (canvas) {
                      canvas.width = img.clientWidth;
                      canvas.height = img.clientHeight;
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 m-auto z-10 transition-opacity duration-300
                      ${mode === 'move' ? 'pointer-events-none opacity-40' : 'cursor-crosshair opacity-100'}`}
                  onMouseDown={handleCanvasInteraction}
                  onMouseMove={handleCanvasInteraction}
                  onMouseUp={handleCanvasInteraction}
                  onMouseLeave={handleCanvasInteraction}
                  onTouchStart={handleCanvasInteraction}
                  onTouchMove={handleCanvasInteraction}
                  onTouchEnd={handleCanvasInteraction}
                />

                {/* 标记点 (增强对比度与层级) */}
                {points.map((p, idx) => {
                  const img = imgRef.current;
                  if (!img) return null;
                  return (
                    <div
                      key={p.id}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `calc(50% + ${(p.x - 50) * (img.clientWidth / 100)}px)`,
                        top: `calc(50% + ${(p.y - 50) * (img.clientHeight / 100)}px)`
                      }}
                    >
                      <div className="relative group/point animate-in zoom-in duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)">
                        {/* 外圈装饰 */}
                        <div className="absolute inset-[-4px] rounded-full border-2 border-pastel-pink/30 animate-pulse"></div>
                        {/* 标记主体 */}
                        <div className="w-9 h-9 bg-pastel-highlight text-white rounded-full border-[3px] border-white shadow-[0_8px_16px_rgba(212,134,159,0.4)] flex items-center justify-center text-[13px] font-black ring-4 ring-pastel-highlight/10">
                          {idx + 1}
                        </div>
                        {/* 波纹动效 */}
                        <div className="absolute inset-0 bg-pastel-highlight rounded-full animate-ping opacity-20 transform scale-150"></div>
                      </div>
                    </div>
                  );
                })}

                {/* 底部悬浮操作栏 */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                  <div className="bg-white/90 backdrop-blur-xl px-8 py-3 rounded-full flex items-center gap-6 border border-pastel-border shadow-xl">
                    <div className="flex items-center gap-2.5 text-pastel-text">
                      <ImageIcon className="w-4 h-4 text-pastel-highlight" />
                      <span className="text-xs font-bold tracking-tight">工作室素材</span>
                    </div>
                    <div className="h-4 w-px bg-pastel-border"></div>
                    <a href={currentImage} download="skysper-edit.png" className="text-xs font-bold text-pastel-highlight hover:text-pastel-text flex items-center gap-2 transition-colors">
                      <Save className="w-4 h-4" /> 下载修图结果
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-28 h-28 bg-pastel-bg rounded-[2.5rem] flex items-center justify-center mb-8 border border-pastel-border overflow-hidden">
                  <Wand2 className="w-12 h-12 text-pastel-pink animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-pastel-text mb-3">开启您的创意旅程</h3>
                <p className="text-sm text-pastel-muted mb-10 max-w-[320px] leading-relaxed">从工作室中选择一张照片，或上传您的产品实拍图，开启专业级 AI 修图流程。</p>

                <label className="px-12 py-4 bg-pastel-pink hover:bg-pastel-pinkhover text-pastel-text rounded-2xl font-bold text-sm tracking-relaxed cursor-pointer transition-all shadow-lg active:scale-95 group border border-white/50">
                  <span className="flex items-center gap-3">
                    <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    上传产品实拍图
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. 专业控制引擎 (侧边栏优化) */}
      <aside className="w-[420px] bg-white border-l border-pastel-border flex flex-col z-50 overflow-hidden shadow-[-40px_0_80px_rgba(0,0,0,0.02)]">

        {/* 侧边栏头部 - 增强品牌视觉 */}
        <div className="p-10 border-b border-pastel-bg bg-gradient-to-br from-white to-pastel-bg/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pastel-pink/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pastel-highlight/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-pastel-highlight" />
              </div>
              <h2 className="text-[11px] font-black text-pastel-highlight uppercase tracking-[0.4em]">Creative Intelligence</h2>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black text-pastel-text tracking-tight">创意中心</h3>
              <span className="text-[10px] font-black bg-pastel-text text-white px-3 py-1.5 rounded-lg shadow-sm">ELITE 4.0</span>
            </div>
          </div>
        </div>

        {/* Control Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

          {/* Brush Settings */}
          {mode === 'eraser' && (
            <div className="space-y-5 animate-in slide-in-from-top-4 duration-700">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest">消除笔大小</label>
                <span className="text-xs font-bold text-pastel-highlight font-mono">{brushSize}px</span>
              </div>
              <div className="relative pt-2">
                <input
                  type="range"
                  min="10" max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-pastel-bg rounded-lg appearance-none cursor-pointer accent-pastel-pink"
                />
              </div>
              <p className="text-[10px] text-pastel-muted font-medium bg-pastel-bg/50 p-3 rounded-xl border border-pastel-border/50">
                提示：使用消除笔涂满您希望 AI 重新构思或移除的区域。
              </p>
            </div>
          )}

          {/* 标记点列表 - 增强紧凑度与美感 */}
          {points.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-black text-pastel-muted uppercase tracking-widest">选中焦点点位 ({points.length})</label>
                <button onClick={clearAll} className="text-[10px] font-bold text-pastel-highlight hover:underline">全部移除</button>
              </div>
              <div className="bg-pastel-bg/30 border border-pastel-border/60 rounded-[2rem] p-4 max-h-[160px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2.5">
                  {points.map((p, i) => (
                    <div key={p.id} className="bg-white border border-pastel-border/80 px-4 py-2.5 rounded-2xl flex items-center gap-3 group/mark shadow-sm hover:shadow-md hover:border-pastel-pink transition-all">
                      <div className="w-4 h-4 bg-pastel-highlight text-white rounded-lg flex items-center justify-center text-[9px] font-black">{i + 1}</div>
                      <span className="text-[10px] font-bold text-pastel-text truncate max-w-[60px]">点位{i + 1}</span>
                      <button
                        onClick={() => setPoints(points.filter(item => item.id !== p.id))}
                        className="opacity-0 group-hover/mark:opacity-100 p-1 text-pastel-muted hover:text-red-500 transition-all scale-75 group-hover/mark:scale-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 指令输入区 */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest flex items-center justify-between">
              编辑需求指令
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-pastel-pink rounded-full opacity-40"></div>
                <div className="w-1.5 h-1.5 bg-pastel-pink rounded-full opacity-70"></div>
                <div className="w-1.5 h-1.5 bg-pastel-pink rounded-full"></div>
              </div>
            </label>
            <div className="relative group">
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={mode === 'eraser' ? "涂抹区域应该生成或更换为什么内容？" : "描述您的创意想法，例如：'在产品周围添加柔和的玫瑰花瓣'"}
                className="w-full h-52 bg-pastel-input border border-pastel-border rounded-[2rem] p-6 text-sm focus:ring-4 focus:ring-pastel-pink/10 focus:border-pastel-pink outline-none resize-none text-pastel-text placeholder:text-pastel-muted transition-all font-medium leading-relaxed"
              />
            </div>

            {/* 预设灵感 */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['纯白展示台', '自然阳光', '添加倒影'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setEditPrompt(tag)}
                  className="text-[10px] font-bold px-4 py-2 rounded-full border border-pastel-border bg-white text-pastel-muted hover:border-pastel-pink hover:text-pastel-highlight transition-all shadow-sm"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostics */}
          {error && (
            <div className="p-5 bg-[#FFF0F3] border border-pastel-border rounded-[2rem] flex flex-col gap-4 animate-in shake duration-500">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-pastel-highlight shrink-0" />
                <p className="text-xs font-bold text-pastel-text leading-normal">{error}</p>
              </div>
              {error.includes("Key") && (
                <button
                  onClick={() => (window as any).aistudio?.openSelectKey()}
                  className="w-full py-2.5 bg-white border border-pastel-border rounded-xl text-xs font-bold text-pastel-highlight hover:bg-pastel-bg transition-all"
                >
                  验证工作室 API 密钥
                </button>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮区 - 极致视觉反馈 */}
        <div className="p-10 border-t border-pastel-bg bg-white relative">
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent -translate-y-full pointer-events-none"></div>
          <button
            onClick={handleEdit}
            disabled={!currentImage || (!editPrompt && points.length === 0 && !getMaskBase64()) || isEditing}
            className={`w-full py-6 rounded-[2.5rem] font-bold text-[15px] tracking-[0.1em] uppercase flex items-center justify-center gap-4 transition-all active:scale-[0.96] group relative overflow-hidden ${!currentImage || (!editPrompt && points.length === 0 && !getMaskBase64())
                ? 'bg-pastel-bg text-pastel-border cursor-not-allowed border border-pastel-border'
                : isEditing
                  ? 'bg-pastel-pink cursor-wait text-pastel-text shadow-inner'
                  : 'bg-pastel-text text-white hover:bg-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1.5 active:translate-y-0'
              }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pastel-pink/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {isEditing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 处理并渲染中...</>
            ) : (
              <><Wand2 className={`w-5 h-5 ${currentImage && 'group-hover:rotate-12 transition-transform'}`} /> 执行创意方案</>
            )}
          </button>
          <div className="mt-8 flex items-center justify-center gap-4 opacity-40">
            <div className="h-px w-8 bg-pastel-muted"></div>
            <p className="text-[9px] font-black text-pastel-muted uppercase tracking-[0.5em]">Skysper Intelligence</p>
            <div className="h-px w-8 bg-pastel-muted"></div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const ToolButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}> = ({ active, onClick, icon, label, danger }) => (
  <button
    onClick={onClick}
    className={`p-5 rounded-[2.5rem] transition-all relative group shadow-sm ${active
      ? 'bg-pastel-text text-white shadow-[0_15px_30px_rgba(0,0,0,0.15)] scale-110 z-10'
      : danger
        ? 'text-pastel-muted bg-white hover:bg-rose-50 hover:text-red-500 border border-pastel-border/50 hover:border-red-200'
        : 'text-pastel-muted bg-white hover:bg-pastel-bg hover:text-pastel-text border border-pastel-border/50 hover:border-pastel-pink'
      }`}
  >
    <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
      {icon}
    </div>

    {/* 便捷气泡 */}
    <div className="absolute left-full ml-6 px-4 py-2 bg-pastel-text text-white text-[11px] font-bold rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-3 group-hover:translate-x-0 whitespace-nowrap z-50 uppercase tracking-widest shadow-2xl border border-white/10">
      {label}
      <div className="absolute left-0 top-1/2 -underline-translate-x-1 -translate-y-1/2 border-[6px] border-transparent border-r-pastel-text"></div>
    </div>

    {active && (
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-pastel-pink rounded-full shadow-[0_0_15px_rgba(255,196,214,1)] animate-in fade-in slide-in-from-left-2 duration-500"></div>
    )}
  </button>
);

export default EditorTab;