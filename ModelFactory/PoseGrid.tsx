import React, { useState, useEffect } from 'react';
import { Loader2, Download, X, Maximize2, Zap, Sparkles, ChevronRight, Camera, PlusIcon, Bookmark } from 'lucide-react';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { storageService } from '../services/storageService';

/**
 * 极致高级感 UI 重塑
 * 采用 Apple-Style 毛玻璃质感、灵动岛交互及专业级对齐框。
 */
const GET_FIXED_CONFIG = (aspectRatio: string) => {
  if (aspectRatio === "16:9") {
    return { cols: 4, rows: 2, padT: 0, padB: 0, padL: 0, padR: 0, gap: 0 };
  } else {
    return { cols: 3, rows: 4, padT: 0, padB: 0, padL: 0, padR: 0, gap: 0 };
  }
};

const cropImage = (
  src: string, 
  config: ReturnType<typeof GET_FIXED_CONFIG>,
  cellIndex: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const { padT, padB, padL, padR, gap, cols, rows } = config;
      
      const pT = (img.height * padT) / 100;
      const pB = (img.height * padB) / 100;
      const pL = (img.width * padL) / 100;
      const pR = (img.width * padR) / 100;
      const gW = (img.width * gap) / 100;
      const gH = (img.height * gap) / 100;

      const contentWidth = img.width - pL - pR - (cols - 1) * gW;
      const contentHeight = img.height - pT - pB - (rows - 1) * gH;
      const cellW = contentWidth / cols;
      const cellH = contentHeight / rows;
      
      canvas.width = cellW;
      canvas.height = cellH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas failure"));
      
      const col = cellIndex % cols;
      const row = Math.floor(cellIndex / cols);
      const sourceX = pL + col * (cellW + gW);
      const sourceY = pT + row * (cellH + gH);
      
      ctx.drawImage(img, sourceX, sourceY, cellW, cellH, 0, 0, cellW, cellH);
      resolve(canvas.toDataURL("image/jpeg", 0.98));
    };
    img.onerror = () => reject(new Error("Image error"));
    img.src = src;
  });
};

interface PoseGridProps {
  imageUrl: string;
  aspectRatio?: string;
  analysisContext?: any;
  bodyInfo?: string;
  specificFeatures?: string;
  onSavePreset?: () => void;
}

const PoseGrid: React.FC<PoseGridProps> = ({ 
  imageUrl, 
  aspectRatio = "9:16", 
  analysisContext,
  bodyInfo = '',
  specificFeatures = '',
  onSavePreset
}) => {
  const isHorizontal = aspectRatio === "16:9";
  const config = GET_FIXED_CONFIG(aspectRatio);
  const { cols, rows, padT, padB, padL, padR, gap } = config;
  
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [detailCellIndex, setDetailCellIndex] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [cellStates, setCellStates] = useState<Record<number, { isGenerating: boolean, resultUrl: string | null }>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [promptInput, setPromptInput] = useState("");

  const handleCellClick = (index: number) => {
    if (cellStates[index]?.resultUrl) {
      setDetailCellIndex(index);
      return;
    }
    if (cellStates[index]?.isGenerating) return;
    setSelectedCell(index);
    setPromptInput("");
    setIsModalOpen(true);
  };

  const handleConfirmGenerate = async () => {
    if (selectedCell === null) return;
    const cellIdx = selectedCell;
    setIsModalOpen(false);
    setCellStates(prev => ({ ...prev, [cellIdx]: { isGenerating: true, resultUrl: null } }));

    try {
      const croppedBase64 = await cropImage(imageUrl, config, cellIdx);
      const match = croppedBase64.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/);
      const apiImage = match 
         ? { mimeType: match[1], base64: match[2] } 
         : { mimeType: 'image/jpeg', base64: croppedBase64.split(',')[1] || croppedBase64 };

      const contextPrompt = analysisContext 
        ? `[IDENTITY LOCK]: CRITICAL: The model MUST be the EXACT SAME person as the reference images. Zero identity drift.
- Identity Analysis: ${analysisContext.model_identity || "Match the person in the reference image exactly."}
- User Specified Features: ${specificFeatures}
[BODY DIMENSIONS]: CRITICAL: Match the model's build, height, and proportions exactly as shown in the reference images.
- Dimensions/Measurements: ${bodyInfo}
- NO body shape variation. 
[PRODUCT CLONE]: CRITICAL: The model MUST wear the EXACT SAME product. Color: ${analysisContext.product_description || "Match clothing color exactly."}.
[ANGLE SYNC]: This cell must follow the original perspective: ${analysisContext.poses_list?.split('\n')?.[cellIdx] || "Match reference perspective"}.`
        : `[IDENTITY LOCK]: The person MUST be identical to the one in the reference image.`;

      const finalPrompt = `Photo-realistic fashion portrait. 
${contextPrompt}
[POSE]: ${promptInput || "Professional fashion pose matching the grid layout."}
[STRICT COMPOSITION]: EVERYTHING MUST be shown ON THE MODEL. ABSOLUTELY NO standalone product shots (NO shoes/bags/accessories only).
- TREAT ACCESSORIES AS WEARABLES. Even if redraw involves an accessory, show it ON THE MODEL.
[STYLE]: High-end catalog style, pure white background.`;

      const result = await generateImageToImage([apiImage], finalPrompt, {
        aspectRatio: "2:3" as any,
        resolution: "2K" as any,
        modelId: "gemini-3.1-flash-image-preview" 
      });

      if (result && result.length > 0) {
        setCellStates(prev => ({ ...prev, [cellIdx]: { isGenerating: false, resultUrl: result[0] } }));
        setDetailCellIndex(cellIdx);

        // Save to recent projects
        try {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'MODEL',
            createdAt: Date.now(),
            thumbnail: result[0],
            assets: {
              original: [imageUrl],
              generated: result,
            },
            metadata: {
              subType: 'pose_fission_cell_redraw',
              cellIndex: cellIdx,
              prompt: promptInput,
              context: analysisContext,
            },
          });
        } catch (e) {
          console.error("Failed to save project", e);
        }
      } else {
        throw new Error("Generate failed");
      }
    } catch (err: any) {
      alert(getErrorMessage(err));
      setCellStates(prev => ({ ...prev, [cellIdx]: { isGenerating: false, resultUrl: null } }));
    }
  };

  const cellW = (100 - padL - padR - (cols - 1) * gap) / cols;
  const cellH = (100 - padT - padB - (rows - 1) * gap) / rows;

  return (
    <div className="relative w-full h-full flex flex-col items-center bg-slate-50/30 p-4">
      
      {/* --- 高级感顶栏：悬浮胶囊设计 (Capsule Design) --- */}
      <div className="w-full max-w-4xl mb-12 mt-4 z-50">
          <div className="flex items-center justify-between bg-white/70 shadow-[0_8px_32px_rgba(0,0,0,0.06)] px-6 py-3 rounded-full border border-white/50 backdrop-blur-2xl ring-1 ring-black/[0.03]">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full text-white shadow-lg shadow-orange-500/20">
                   <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[11px] font-black text-slate-800 tracking-tight uppercase opacity-90">Pose Fission Workspace</span>
                   <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">{aspectRatio} • Precision Grid v2.0</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                 <button onClick={() => setIsFullScreen(true)} className="group flex items-center gap-2 text-[11px] font-bold text-orange-600/80 hover:text-orange-600 transition-all">
                    <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> 沉浸预览
                 </button>
                 {onSavePreset && (
                   <button onClick={onSavePreset} className="group flex items-center gap-2 text-[11px] font-bold text-pink-600/80 hover:text-pink-600 transition-all">
                      <Bookmark className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> 保存预设
                   </button>
                 )}
                 <div className="h-6 w-px bg-slate-200" />
                 <button 
                    onClick={() => { const link=document.createElement('a'); link.href=imageUrl; link.download="pose-grid.png"; link.click(); }}
                    className="pl-5 pr-2 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full flex items-center gap-3 text-[10px] font-bold hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                 >
                    下载全图资源 <div className="p-1 bg-white/20 rounded-full"><Download className="w-3 h-3" /></div>
                 </button>
              </div>
          </div>
      </div>

      {/* --- 画布区域：极平滑阴影与边缘细节 --- */}
      <div className="relative group/canvas perspective-1000">
         {/* 装饰性背景层 */}
         <div className="absolute -inset-4 bg-gradient-to-tr from-orange-500/5 to-pink-500/5 blur-3xl opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-1000" />
         
         <div className="inline-block relative bg-white shadow-[0_40px_100px_rgba(0,0,0,0.08)] rounded-2xl p-2 border border-slate-100/50 backdrop-blur-sm transition-transform duration-700 ease-out group-hover/canvas:translate-y-[-4px]">
            <div className="relative overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-black/10">
               <img 
                 src={imageUrl} 
                 alt="Pose Grid" 
                 className="w-auto h-auto max-h-[70vh] block select-none pointer-events-none opacity-95 group-hover/canvas:opacity-100 transition-opacity duration-500" 
               />
               
               {/* 对齐网格：极致对齐标口 */}
               <div className="absolute inset-0 grid z-10" 
                    style={{ 
                      top: `${padT}%`, bottom: `${padB}%`, left: `${padL}%`, right: `${padR}%`,
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                      gap: `${gap}%`
                    }}
               >
                 {Array.from({ length: cols * rows }).map((_, i) => {
                    const cellData = cellStates[i];
                    const isGenerating = cellData?.isGenerating;
                    const hasResult = !!cellData?.resultUrl;

                    return (
                       <div 
                         key={i}
                         onMouseEnter={() => setHoveredCell(i)}
                         onMouseLeave={() => setHoveredCell(null)}
                         onClick={() => handleCellClick(i)}
                         className={`
                           relative transition-all duration-300 border-[0.5px] border-white/5
                           ${hasResult ? 'z-20 cursor-zoom-in' : 'cursor-crosshair'}
                           ${hoveredCell === i && !isGenerating ? 'bg-white/5 z-20 border-orange-500/40' : ''}
                         `}
                       >
                         {/* 悬停时的角标 UI (Premium 细节) */}
                         {hoveredCell === i && !isGenerating && !hasResult && (
                           <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in-50 duration-300">
                              <div className="p-2 bg-orange-500 text-white rounded-full shadow-lg shadow-orange-500/40">
                                 <PlusIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-orange-500" />
                              <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-orange-500" />
                              <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-orange-500" />
                              <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-orange-500" />
                           </div>
                         )}

                         {hasResult && (
                           <div className="absolute inset-x-0.5 inset-y-0.5 z-40 shadow-2xl rounded-lg overflow-hidden border border-white/40 ring-2 ring-orange-500/10 scale-[0.98] group-hover:scale-100 transition-transform">
                             <img src={cellStates[i].resultUrl!} className="w-full h-full object-cover" alt="Render" />
                           </div>
                         )}

                         {isGenerating && (
                           <div className="absolute inset-0 bg-white/40 backdrop-blur-md flex flex-col items-center justify-center z-30">
                              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                              <span className="text-[8px] font-bold text-slate-800 mt-2 tracking-widest uppercase opacity-60">Rendering</span>
                           </div>
                         )}
                       </div>
                    );
                  })}
               </div>
            </div>

            {/* 高级放大预览 */}
            {hoveredCell !== null && !cellStates[hoveredCell]?.isGenerating && (
               <div 
                  className="absolute z-[100] pointer-events-none shadow-[0_32px_96px_rgba(0,0,0,0.3)] border-[1.5px] border-white/60 bg-white/90 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] transition-all animate-in slide-in-from-top-6 duration-500 ease-out"
                  style={{
                    top: '-40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '420px',
                    height: '560px',
                  }}
               >
                 <div className="absolute top-4 left-4 z-[99] bg-white/80 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-sm border border-slate-100 flex items-center gap-2">
                    <Camera className="w-3 h-3 text-orange-500" />
                    <span className="text-[9px] font-black text-slate-800 uppercase">Live Preview • Cell #{hoveredCell + 1}</span>
                 </div>
                 <div className="relative w-full h-full">
                    <img 
                       src={imageUrl} 
                       className="absolute max-w-none"
                       style={{
                          width: `${(100 / cellW) * 100}%`,
                          height: `${(100 / cellH) * 100}%`,
                          left: `-${(padL + (hoveredCell % cols) * (cellW + gap)) * (100 / cellW)}%`,
                          top: `-${(padT + Math.floor(hoveredCell / cols) * (cellH + gap)) * (100 / cellH)}%`,
                       }}
                    />
                    {cellStates[hoveredCell]?.resultUrl && (
                       <img src={cellStates[hoveredCell].resultUrl!} className="absolute inset-0 w-full h-full object-contain bg-zinc-950 z-50" />
                    )}
                 </div>
               </div>
            )}
         </div>
      </div>

      {/* --- 高级详情 Modal (Glassmorphism Modal) --- */}
      {detailCellIndex !== null && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-500" onClick={() => setDetailCellIndex(null)}>
          <div className="absolute top-10 right-10 group cursor-pointer" onClick={() => setDetailCellIndex(null)}>
             <div className="bg-white/10 group-hover:bg-white/20 p-4 rounded-full transition-all shadow-2xl backdrop-blur-md border border-white/10">
                <X className="w-8 h-8 text-white" />
             </div>
          </div>
          
          <div className="relative max-w-5xl w-full h-[90vh] rounded-[2.5rem] overflow-hidden bg-zinc-950 shadow-[0_64px_128px_rgba(0,0,0,0.5)] border border-white/5 animate-in zoom-in-95 duration-700" onClick={it => it.stopPropagation()}>
             <img 
                src={cellStates[detailCellIndex]?.resultUrl || imageUrl} 
                className="w-full h-full object-contain z-10" alt="Full" 
             />
             
             {/* 浮动操作条 (Premium Details) */}
             <div className="absolute bottom-10 inset-x-0 flex justify-center z-50">
                <div className="bg-white/10 backdrop-blur-3xl p-2 rounded-full border border-white/10 shadow-2xl flex gap-1">
                   {[
                      { icon: Download, label: '保存作品', primary: true, action: () => { const link=document.createElement('a'); link.href=cellStates[detailCellIndex!]!.resultUrl!; link.download="pose-art.png"; link.click(); } },
                      { icon: X, label: '退出预览', primary: false, action: () => setDetailCellIndex(null) }
                   ].map(btn => (
                      <button 
                         key={btn.label}
                         onClick={btn.action}
                         className={`
                           px-8 py-3.5 rounded-full flex items-center gap-3 text-[11px] font-black transition-all
                           ${btn.primary ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-xl shadow-orange-500/20 active:scale-95' : 'bg-transparent text-white/70 hover:text-white hover:bg-white/5'}
                         `}
                      >
                         <btn.icon className="w-4 h-4" /> {btn.label}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- 高级重绘 Modal (The Stunning UI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsModalOpen(false)}>
          <div className="relative bg-white/70 backdrop-blur-3xl rounded-[2.5rem] w-[480px] p-10 shadow-[0_40px_120px_rgba(0,0,0,0.1)] border border-white/40 overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
            
            {/* 顶层光晕 */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-orange-400/20 blur-[100px] rounded-full" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-pink-400/20 blur-[100px] rounded-full" />

            <div className="relative">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2 mb-1">
                        <div className="bg-orange-500 p-1.5 rounded-lg shadow-lg shadow-orange-500/20">
                           <Zap className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tighter uppercase">High-Diff Upscale</span>
                     </div>
                     <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Consistent 2K Mesh Portrait</span>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                     <X className="w-6 h-6 text-slate-400" />
                  </button>
               </div>
               
               <div className="relative mb-8 group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-[1.5rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <textarea 
                    autoFocus 
                    value={promptInput} 
                    onChange={(e) => setPromptInput(e.target.value)} 
                    placeholder="请输入对该姿势的额外描述..." 
                    className="relative w-full h-32 p-6 bg-white/50 border border-white/80 rounded-[1.5rem] outline-none transition-all font-medium text-sm text-slate-800 placeholder-slate-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]" 
                  />
               </div>
               
               <button 
                onClick={handleConfirmGenerate} 
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] hover:shadow-orange-500/40"
               >
                  <Zap className="w-5 h-5" />
                  执行高清重绘 (Premium Render)
                  <ChevronRight className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 沉浸式全屏 */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[110] bg-zinc-950 flex items-center justify-center p-8 transition-all animate-in zoom-in-110 duration-700" onClick={() => setIsFullScreen(false)}>
           <div className="absolute top-10 right-10 flex gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFullScreen(false); }}
                className="bg-white/10 hover:bg-white/20 p-4 rounded-full backdrop-blur-3xl text-white transition-all border border-white/10"
              >
                 <X className="w-8 h-8" />
              </button>
           </div>
           <img src={imageUrl} alt="RAW" className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_80px_160px_rgba(0,0,0,0.8)]" />
        </div>
      )}
    </div>
  );
};

export default PoseGrid;
