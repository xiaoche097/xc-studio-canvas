import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from '../DollFactory/components/DollImageEditor';

// --- Multi-Angle Ecommerce Prompts ---
const ANGLE_TEMPLATES = {
  A: {
    name: '左前 45°',
    label: '3/4 front-left',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：执行视角重建。**
**视角转换**：请忽略参考图的原始角度。将模特重建至【左前方 45 度视角（3/4 front-left）】，呈现自然站姿。
**身份与服装保持**：必须 100% 保持 Image 1 中模特的面部特征、发型、肤色、身材比例、服装款式与颜色。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  B: {
    name: '正面',
    label: 'front view',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：强制回正视角。**
**视角转换**：请忽略参考图的原始偏转角度，将模特重建至【正前方平视视角（Front View）】，自然站姿面对镜头。
**身份与服装保持**：必须 100% 保持 Image 1 中模特的面部特征、发型、肤色、身材比例、服装款式与颜色。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  C: {
    name: '右前 45°',
    label: '3/4 front-right',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：执行视角重建。**
**视角转换**：请忽略参考图的原始角度，将模特重建至【右前方 45 度视角（3/4 front-right）】，呈现自然侧身站姿。
**身份与服装保持**：必须 100% 保持 Image 1 中模特的面部特征、发型、肤色、身材比例、服装款式与颜色。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  D: {
    name: '侧面',
    label: 'side profile',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：视角 90 度转动。**
**视角转换**：请基于 Image 1 的模特身份重构一个【正侧面视角（Side Profile）】，模特自然侧身站立。
**身份与服装保持**：必须 100% 保持 Image 1 中模特的面部特征、发型、肤色、身材比例、服装款式与颜色。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，真实皮肤质感。`
  },
  E: {
    name: '背面',
    label: 'back view',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：视角 180 度大转弯。**
**视角转换**：请基于 Image 1 的模特身份重构一个【正背面视角（Back View）】，展示服装背面效果。
**身份与服装保持**：必须 100% 保持 Image 1 中的发色、身材比例、服装款式与颜色。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度。`
  },
  RETOUCH: {
    name: '主图精修',
    label: 'Retouch & Lock',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：商业级主图精修。**
**角度锁定**：严格保持 Image 1 的相机角度、模特姿势、构图与裁切范围完全一致。
**精修要求**：清理皮肤瑕疵，优化服装褶皱，增强面料质感，提升整体画质与锐度。
**身份保持**：必须 100% 保持模特身份。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，商业大片质感。`
  }
};

const GLOBAL_NEGATIVE_PROMPT = `deformed anatomy, distorted face, different person, extra limbs, bad lighting, text, watermark, plastic skin, cartoon, illustration, low resolution, blurry, messy background, colorful background`;

const ModelMainAdjustTab: React.FC = () => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [guidance, setGuidance] = useState('');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [variantCount, setVariantCount] = useState(1);

  // Reference Images (Up to 3)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorBoxes, setEditorBoxes] = useState<EditorBox[]>([]);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const dataURLtoFile = (dataUrl: string, filename: string) => {
    let arr = dataUrl.split(','),
        mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png',
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const setSourceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (sourceUrl && sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    setSourceFile(file);
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setResultImages([]);
    setEditorBoxes([]); // Reset boxes on new image
    
    // Calculate aspect ratio
    const img = new Image();
    img.onload = () => {
      setImageAspectRatio(img.width / img.height);
    };
    img.src = url;
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSourceFromFile(file);
    e.target.value = '';
  };

  const handleSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSourceFromFile(file);
  };

  const addRefFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (refFiles.length >= 3) return; // Limit to 3 files
    setRefFiles(prev => [...prev, file]);
    setRefUrls(prev => [...prev, URL.createObjectURL(file)]);
  };
  
  const removeRefFile = (index: number) => {
     setRefFiles(prev => prev.filter((_, i) => i !== index));
     setRefUrls(prev => {
        const newUrls = [...prev];
        URL.revokeObjectURL(newUrls[index]);
        newUrls.splice(index, 1);
        return newUrls;
     });
  };

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => addRefFile(file));
    e.target.value = '';
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach(file => addRefFile(file));
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请上传模特原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在分析模特原图结构属性，调整生成参数...');

    try {
      // Import here to avoid early hydration issues if any
      const { generateImageToImage, analyzeDollModification } = await import('../Cyzx4/services/geminiService');
      
      const compressedImage = await compressImage(sourceFile, 2048, 0.96);
      const inputImages = [{ base64: compressedImage.base64, mimeType: compressedImage.mime }];
      
      const refInputImages: { base64: string; mimeType: string }[] = [];
      for (const file of refFiles) {
         const compressedRef = await compressImage(file, 2048, 0.96);
         inputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
         refInputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
      }

      let prompt = `[MODEL MAIN IMAGE ENHANCEMENT - HIGH PRIORITY COMMAND]\nOptimizing the main display image for a fashion model.\n\n=== STRICT INSTRUCTIONS (PRIORITIZE ABOVE ALL) ===\n${guidance || 'Enhance lighting, details and background to make it look professional for e-commerce, retaining the model identity and clothing.'}\n**Perspective**: Maintain the exact same camera angle and model pose as Image 1.\n=== END STRICT INSTRUCTIONS ===`;
      let negativePrompt = GLOBAL_NEGATIVE_PROMPT;

      // Use Professional Angle Prompts if selected
      if (selectedAngle && (ANGLE_TEMPLATES as any)[selectedAngle]) {
        const template = (ANGLE_TEMPLATES as any)[selectedAngle];
        prompt = template.prompt;
        if (guidance) {
          prompt += `\n\n**Additional Instruction**: ${guidance}`;
        }
        negativePrompt = template.negativePrompt || GLOBAL_NEGATIVE_PROMPT;
      }

      // ==========================================
      // [NEW] Agentic Pre-analysis for Precision Locality
      // ==========================================
      if (selectedAngle || (editorBoxes.length > 0 && refInputImages.length > 0)) {
        setStatusMessage('🌍 Agent 正在解析局部调整指令...');
        // Execute Vision Pre-processing
        const analysis = await analyzeDollModification(
          { base64: compressedImage.base64, mimeType: compressedImage.mime },
          refInputImages,
          editorBoxes.map((b, i) => ({ 
            x: b.x, y: b.y, w: b.w, h: b.h, 
            color: ['Red', 'Yellow', 'Blue'][i % 3] 
          })),
          guidance,
          selectedAngle ? (ANGLE_TEMPLATES as any)[selectedAngle].name : undefined
        );
        
        if (analysis && analysis.engineered_prompt) {
           // Build a spatially-constrained prompt with explicit frozen zones
           let constrainedPrompt = `[PRECISION LOCALIZED MODIFICATION MODE]\n`;
           constrainedPrompt += analysis.engineered_prompt;
           
           // Inject frozen zones as hard constraints
           if (analysis.outside_boxes && analysis.outside_boxes.length > 0) {
             constrainedPrompt += `\n\n=== FROZEN ZONES (ABSOLUTELY DO NOT MODIFY) ===\nThe following parts MUST remain 100% IDENTICAL to Image 1. Any change to these areas is a CRITICAL FAILURE:\n`;
             constrainedPrompt += analysis.outside_boxes.map((part: string) => `- ${part}`).join('\n');
             constrainedPrompt += `\n=== END FROZEN ZONES ===`;
           }
           
           if (analysis.inside_boxes && analysis.inside_boxes.length > 0) {
             constrainedPrompt += `\n\n=== MODIFICATION TARGETS (ONLY these may change) ===\n`;
             constrainedPrompt += analysis.inside_boxes.map((part: string) => `- ${part}`).join('\n');
             constrainedPrompt += `\n=== END MODIFICATION TARGETS ===`;
           }
           
           prompt = constrainedPrompt;
           
           // Also inject frozen parts into the negative prompt for double enforcement
           if (analysis.outside_boxes && analysis.outside_boxes.length > 0) {
             const frozenNegative = analysis.outside_boxes.map((part: string) => `change ${part}, modify ${part}`).join(', ');
             negativePrompt = `${negativePrompt}, ${frozenNegative}, change unselected areas, modify areas outside selection box`;
           }
           
           if (analysis.reasoning) {
             console.log("Agent Reasoning:", analysis.reasoning);
           }
        }
      } else if (refInputImages.length > 0) {
        // Fallback for global reference without specific boxes
        prompt += `\nCRITICAL: You have been provided ${refFiles.length} additional input image(s) acting as STYLE/EFFECT REFERENCES. Please seamlessly blend their visual features globally onto the main model image.`;
      }
      
      setStatusMessage(`正在为您并行生成 ${variantCount} 组精修方案 (约 30-60s)...`);
      
      const generationTasks = Array(variantCount).fill(null).map(() => 
        generateImageToImage(
          inputImages,
          prompt,
          {
            aspectRatio: outputAspectRatio,
            resolution: resolution,
            modelId: selectedModel,
            negativePrompt,
            workflowHint: (selectedAngle === 'RETOUCH' ? 'model-retouching' : 'model-modification') as any,
            sampleCount: 1 
          }
        )
      );

      const allResults = await Promise.all(generationTasks);
      const flattenedResult = allResults.flat().filter(img => !!img);

      if (flattenedResult.length > 0) {
        setResultImages(flattenedResult);
        setSelectedResultIndex(0);
        setStatusMessage(selectedAngle ? '视角转换完成！请查看生成效果。' : '精修完成！');
      } else {
        throw new Error('未返回任何图片');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* 左侧控制栏 */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Model Main Adjust</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">模特主图调整</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传模特原图，通过 AI 进行视角重建或商业级精修，完美对齐电商展示需求。
            </p>
          </div>

          {/* 原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>模特原图</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            {sourceUrl ? (
              <div 
                className="relative group w-full aspect-square rounded-[24px] border border-pastel-border shadow-sm overflow-hidden bg-white flex items-center justify-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
              >
                <div className="relative w-full h-full p-3 flex items-center justify-center">
                  <div 
                    className="relative shadow-sm"
                    style={{ 
                      aspectRatio: imageAspectRatio || '1/1', 
                      maxHeight: '100%', 
                      maxWidth: '100%' 
                    }}
                  >
                    <img src={sourceUrl} alt="source" className="w-full h-full block rounded-lg object-contain" />
                    
                    {/* Draw Boxes Preview */}
                    <div className="absolute inset-0 pointer-events-none">
                       {editorBoxes.map((b, i) => {
                          const colors = [
                             { border: 'border-red-500', bg: 'bg-red-500', text: 'text-white' },
                             { border: 'border-yellow-400', bg: 'bg-yellow-400', text: 'text-black' },
                             { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-white' }
                          ];
                          const style = colors[i % 3];
                          return (
                          <div 
                             key={b.id} 
                             className={`absolute border-2 ${style.border} ${style.bg}/10 pointer-events-none flex items-start justify-start overflow-hidden`}
                             style={{ left: `${b.x*100}%`, top: `${b.y*100}%`, width: `${b.w*100}%`, height: `${b.h*100}%` }}
                          >
                             <span className={`${style.bg} ${style.text} text-[8px] font-bold px-1 rounded-br-sm`}>{i+1}</span>
                          </div>
                       )})}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setSourceUrl(null); setSourceFile(null); setEditorBoxes([]); }}
                  className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 z-20"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <button 
                  onClick={() => setIsEditorOpen(true)}
                  className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-black/90 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-20 backdrop-blur-sm border border-white/10"
                >
                  编辑
                </button>
              </div>
            ) : (
              <label 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
                className="relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
              >
                <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-pastel-text">点击或拖拽模特图到此处</span>
              </label>
            )}
          </div>

          {/* 角度选择 */}
          <div className="space-y-3">
             <h3 className="text-sm font-semibold text-pastel-text">调整角度 / 视角</h3>
             <div className="grid grid-cols-3 gap-2">
                {Object.entries(ANGLE_TEMPLATES).map(([key, item]) => (
                   <button
                      key={key}
                      onClick={() => setSelectedAngle(selectedAngle === key ? null : key)}
                      className={`py-2 px-1 rounded-xl border text-[10px] font-bold transition-all ${selectedAngle === key ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                   >
                      {item.name}
                   </button>
                ))}
             </div>
          </div>

          {/* 参考图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>参考效果图 (可选)</span>
              <span className="text-[10px] font-normal text-pastel-muted">{refFiles.length}/3</span>
            </h3>
            <div 
              className="grid grid-cols-3 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleRefDrop}
            >
               {refUrls.map((url, i) => {
                   const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500'];
                   return (
                   <div key={i} className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white p-1">
                     <img src={url} alt={`ref-${i}`} className="w-full h-full object-contain" />
                     
                     {/* Color mapping badge */}
                     <span className={`absolute top-1 left-1 w-3.5 h-3.5 ${colors[i % 3]} rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold text-white z-10`}>
                       {i+1}
                     </span>

                     <button 
                       onClick={() => removeRefFile(i)}
                       className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                     >
                       <X className="w-2 h-2" />
                     </button>
                   </div>
                )})}
               {refFiles.length < 3 && (
                  <label 
                    className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 cursor-pointer"
                  >
                    <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" multiple />
                    <Upload className="w-4 h-4 text-pastel-muted" />
                  </label>
               )}
            </div>
          </div>

          {/* 画幅选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅</h3>
            <div className="grid grid-cols-5 gap-2">
              {[AspectRatio.SQUARE, AspectRatio.PORTRAIT_3_4, AspectRatio.PORTRAIT_4_5, AspectRatio.PORTRAIT_2_3, AspectRatio.PORTRAIT_9_16].map((ar) => (
                <button
                  key={ar}
                  onClick={() => setOutputAspectRatio(ar)}
                  className={`rounded-xl border py-2 text-[10px] font-bold transition-all ${outputAspectRatio === ar ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border'}`}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          {/* 生成设置 */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <h3 className="text-xs font-bold text-pastel-muted">画质</h3>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ImageResolution)}
                  className="w-full bg-white border border-pastel-border rounded-xl py-2 px-2 text-[10px] font-bold outline-none"
                >
                  <option value={ImageResolution.RES_2K}>2K (快速)</option>
                  <option value={ImageResolution.RES_4K}>4K (极致)</option>
                </select>
             </div>
             <div className="space-y-2">
                <h3 className="text-xs font-bold text-pastel-muted">数量</h3>
                <div className="flex gap-1">
                   {[1, 2, 3, 4].map(n => (
                      <button 
                         key={n} 
                         onClick={() => setVariantCount(n)}
                         className={`flex-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${variantCount === n ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight' : 'border-pastel-border bg-white text-pastel-muted'}`}
                      >
                         {n}
                      </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">补充提示词 (可选)</h3>
            <textarea
              rows={2}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例如：将模特的衣服颜色改为参考图1的深蓝色，或者将背景换成参考图2的家居场景（高权重指令）..."
              className="w-full bg-white border border-pastel-border rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !sourceFile}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 hover:brightness-105 transition-all"
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 正在处理中...</>
            ) : (
              <><Zap className="h-5 w-5" /> 开始主图调整</>
            )}
          </button>
        </div>
      </div>

      {/* 右侧展示区 */}
      <div className="flex-1 flex px-6 py-6 overflow-hidden relative items-center justify-center">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-pastel-highlight animate-spin mb-4" />
            <p className="text-pastel-text font-medium animate-pulse">{statusMessage}</p>
          </div>
        ) : resultImages.length === 0 ? (
          <div className="text-center text-pastel-muted">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-bold">等待生成结果</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-4xl px-2">
               <span className="text-sm font-bold">生成结果 ({selectedResultIndex + 1}/{resultImages.length})</span>
               <button
                 onClick={() => {
                   const a = document.createElement('a');
                   a.href = resultImages[selectedResultIndex];
                   a.download = `model-adjust-${Date.now()}.png`;
                   a.click();
                 }}
                 className="flex items-center gap-2 rounded-xl bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight hover:bg-pastel-highlight/20 transition-all"
               >
                 <Download className="h-3.5 w-3.5" /> 下载图片
               </button>
            </div>
            
            <div 
              className="relative rounded-[32px] border-4 border-white bg-white shadow-2xl overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: outputAspectRatio.replace(':', ' / '), maxHeight: '85%', height: '100%' }}
            >
              <img src={resultImages[selectedResultIndex]} alt="Result" className="w-full h-full object-contain" />
              
              {resultImages.length > 1 && (
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {resultImages.map((_, i) => (
                       <button 
                          key={i} 
                          onClick={() => setSelectedResultIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all ${selectedResultIndex === i ? 'bg-orange-500 w-6' : 'bg-white/50 hover:bg-white'}`}
                       />
                    ))}
                 </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isEditorOpen && sourceUrl && (
        <DollImageEditor
           initialImage={sourceUrl}
           initialBoxes={editorBoxes}
           onClose={() => setIsEditorOpen(false)}
           onApplyCrop={(base64) => {
              setSourceUrl(base64);
              setSourceFile(dataURLtoFile(base64, 'cropped_model.png'));
           }}
           onApplyBoxes={(boxes) => {
              setEditorBoxes(boxes);
           }}
        />
      )}
    </div>
  );
};

export default ModelMainAdjustTab;
