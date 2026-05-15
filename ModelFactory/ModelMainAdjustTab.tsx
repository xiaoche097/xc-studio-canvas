import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X, Maximize2, Shirt, Wand2, CheckCircle2 } from 'lucide-react';
import { compressImage, getErrorMessage, blobToBase64 } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from '../DollFactory/components/DollImageEditor';
import { storageService } from '../services/storageService';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';

// --- Multi-Angle Ecommerce Prompts ---
const ANGLE_TEMPLATES = {
  A: {
    name: '左前 45°',
    label: '3/4 front-left',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：执行视角重建。**
**视角转换**：请忽略参考图的原始角度。将模特重建至【左前方 45 度视角（3/4 front-left）】，呈现自然站姿。
**身份与身材锁定 (CRITICAL)**：必须 100% 完美复刻 Image 1 中模特的面部长相、五官、身高、三围比例、体型胖瘦以及服装的款式与颜色。严禁出现生成的模特长相或身材与原图完全不一样的情况。
**色彩一致性**：必须严格保持与 Image 1 完全一致的色彩基调、光影氛围和白平衡。严禁自行改变色温。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  B: {
    name: '正面',
    label: 'front view',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：强制回正视角。**
**视角转换**：请忽略参考图的原始偏转角度，将模特重建至【正前方平视视角（Front View）】，自然站姿面对镜头。
**身份与身材锁定 (CRITICAL)**：必须 100% 完美复刻 Image 1 中模特的面部长相、五官、身高、三围比例、体型胖瘦以及服装的款式与颜色。严禁出现生成的模特长相或身材与原图完全不一样的情况。
**色彩一致性**：必须严格保持与 Image 1 完全一致的色彩基调、光影氛围和白平衡。严禁自行改变色温。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  C: {
    name: '右前 45°',
    label: '3/4 front-right',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：执行视角重建。**
**视角转换**：请忽略参考图的原始角度，将模特重建至【右前方 45 度视角（3/4 front-right）】，呈现自然侧身站姿。
**身份与身材锁定 (CRITICAL)**：必须 100% 完美复刻 Image 1 中模特的面部长相、五官、身高、三围比例、体型胖瘦以及服装的款式与颜色。严禁出现生成的模特长相或身材与原图完全不一样的情况。
**色彩一致性**：必须严格保持与 Image 1 完全一致的色彩基调、光影氛围和白平衡。严禁自行改变色温。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，自然柔光，真实皮肤质感。`
  },
  D: {
    name: '侧面',
    label: 'side profile',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：视角 90 度转动。**
**视角转换**：请基于 Image 1 的模特身份重构一个【正侧面视角（Side Profile）】，模特自然侧身站立。
**身份与身材锁定 (CRITICAL)**：必须 100% 完美复刻 Image 1 中模特的面部长相、五官、身高、三围比例、体型胖瘦以及服装的款式与颜色。严禁出现生成的模特长相或身材与原图完全不一样的情况。
**色彩一致性**：必须严格保持与 Image 1 完全一致的色彩基调、光影氛围和白平衡。严禁自行改变色温。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，真实皮肤质感。`
  },
  E: {
    name: '背面',
    label: 'back view',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：视角 180 度大转弯。**
**视角转换**：请基于 Image 1 的模特身份重构一个【正背面视角（Back View）】，展示服装背面效果。
**身份与身材锁定 (CRITICAL)**：必须 100% 完美复刻 Image 1 中模特的身高、三围比例、体型胖瘦、发型发色以及服装款式与颜色。严禁出现生成的模特身材与原图不一致的情况。
**色彩一致性**：保持与 Image 1 一致。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度。`
  },
  RETOUCH: {
    name: '主图精修',
    label: 'Retouch & Lock',
    prompt: `你现在是一名顶级的电商模特摄影修图师。
**核心指令：商业级主图精修。**
**角度锁定**：严格保持 Image 1 的相机角度、模特姿势、构构与裁切范围完全一致。
**精修要求**：清理皮肤瑕疵，优化服装褶皱，增强面料质感，提升整体画质与锐度。
**色彩一致性**：严格保持与 Image 1 完全一致的色彩基调、肤色表现和光影饱和度。严禁自行改变色温。
**身份保持**：必须 100% 保持模特身份。
**输出要求**：纯白背景(#FFFFFF)，电商棚拍级锐度，商业大片质感。`
  }
};

const GLOBAL_NEGATIVE_PROMPT = `deformed anatomy, distorted face, different person, extra limbs, bad lighting, text, watermark, plastic skin, cartoon, illustration, low resolution, blurry, messy background, colorful background, color shift, color mismatch, inconsistent lighting`;

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
  const [preview, setPreview] = useState<{ src: string, title: string } | null>(null);

  // Core Garment for replacement (up to 5 images)
  const [coreGarmentFiles, setCoreGarmentFiles] = useState<File[]>([]);
  const [coreGarmentUrls, setCoreGarmentUrls] = useState<string[]>([]);
  const [garmentAnalysis, setGarmentAnalysis] = useState<any>(null);
  const [isAnalyzingGarment, setIsAnalyzingGarment] = useState(false);

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

  const addCoreFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (coreGarmentFiles.length >= 5) return;
    setCoreGarmentFiles(prev => [...prev, file]);
    setCoreGarmentUrls(prev => [...prev, URL.createObjectURL(file)]);
    setGarmentAnalysis(null);
  };

  const handleCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => addCoreFile(file));
    e.target.value = '';
  };

  const handleCoreDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach(file => addCoreFile(file));
  };

  const removeCoreGarment = (index: number) => {
    setCoreGarmentFiles(prev => prev.filter((_, i) => i !== index));
    setCoreGarmentUrls(prev => {
      const newUrls = [...prev];
      URL.revokeObjectURL(newUrls[index]);
      newUrls.splice(index, 1);
      return newUrls;
    });
    setGarmentAnalysis(null);
  };

  // Add paste hook
  useImagePaste((files) => {
    // If we have room in coreGarmentFiles, paste there
    files.forEach(file => {
      setCoreGarmentFiles(prev => {
        if (prev.length < 5) {
          addCoreFile(file);
        }
        return prev;
      });
    });
  });

  const handleAnalyzeGarment = async () => {
    if (coreGarmentFiles.length === 0) {
      alert('请先上传产品素材图 (需替换的服装)');
      return;
    }
    setIsAnalyzingGarment(true);
    try {
      const { analyzeGarmentFeatures } = await import('../Cyzx4/services/geminiService');
      const coreImgs = await Promise.all(coreGarmentFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.96);
        return { base64: compressed.base64, mimeType: compressed.mime };
      }));
      const result = await analyzeGarmentFeatures(coreImgs, guidance);
      if (result) {
        setGarmentAnalysis(result);
      }
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setIsAnalyzingGarment(false);
    }
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

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.click();
    }
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
      
      for (const file of coreGarmentFiles) {
         const compressedCore = await compressImage(file, 2048, 0.96);
         inputImages.push({ base64: compressedCore.base64, mimeType: compressedCore.mime });
         refInputImages.push({ base64: compressedCore.base64, mimeType: compressedCore.mime });
      }

      for (const file of refFiles) {
         const compressedRef = await compressImage(file, 2048, 0.96);
         inputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
         refInputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
      }

      let prompt = `[MODEL MAIN IMAGE ENHANCEMENT - HIGH PRIORITY COMMAND]\nOptimizing the main display image for a fashion model.\n\n=== STRICT INSTRUCTIONS (PRIORITIZE ABOVE ALL) ===\n${guidance || 'Enhance lighting, details and background to make it look professional for e-commerce, retaining the model identity and clothing.'}\n**Perspective**: Maintain the exact same camera angle and model pose as Image 1.\n=== END STRICT INSTRUCTIONS ===`;
      let negativePrompt = `${GLOBAL_NEGATIVE_PROMPT}, extra objects, additional items, new props, change layout, hallucinate`;

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
      if (selectedAngle || refInputImages.length > 0) {
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
              negativePrompt = `${negativePrompt}, ${frozenNegative}, change unselected areas, modify areas outside selection box, add new objects, hallucinate items`;
            }
           
           if (analysis.reasoning) {
             console.log("Agent Reasoning:", analysis.reasoning);
           }
        }
      } else if (refInputImages.length > 0) {
        // Fallback for global reference without specific boxes
        prompt += `\nCRITICAL: You have been provided ${refFiles.length} additional input image(s) acting as STYLE/EFFECT REFERENCES. Please seamlessly blend their visual features globally onto the main model image.`;
      }
      
      // Inject garment analysis at the very end to ensure it is not overwritten
      if (garmentAnalysis && garmentAnalysis.engineered_prompt) {
         prompt += `\n\n[AGENT GARMENT ANALYSIS OVERRIDE]\nGARMENT FEATURES TO ENFORCE (PRIORITY): ${garmentAnalysis.engineered_prompt}`;
         prompt += `\nCRITICAL GARMENT RULES: Ensure the generated garment strictly follows the neckline stitching details (e.g. seamless vs stitched) and exact length/cropped waist style mentioned above.`;
         
         if (garmentAnalysis.negative_prompt_additions) {
           negativePrompt += `, ${garmentAnalysis.negative_prompt_additions}`;
         }
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

        // Save to recent projects
        try {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'MODEL',
            createdAt: Date.now(),
            thumbnail: flattenedResult[0],
            assets: {
              original: sourceUrl ? [sourceUrl] : [],
              generated: flattenedResult,
            },
            metadata: {
              subType: 'model_main_adjust',
              prompt: prompt,
              negativePrompt,
              selectedAngle,
              resolution,
              aspectRatio: outputAspectRatio,
              modelId: selectedModel,
              variantCount
            },
          });
        } catch (e) {
          console.error("Failed to save project", e);
        }
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

          {/* 产品素材图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>产品素材图 (需替换的衣服)</span>
              <span className="text-[10px] font-normal text-pastel-muted">{coreGarmentFiles.length}/5</span>
            </h3>
            <div 
              className="grid grid-cols-5 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCoreDrop}
            >
               {coreGarmentUrls.map((url, i) => (
                 <div key={i} className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white p-1">
                   <img src={url} alt={`core-${i}`} className="w-full h-full object-contain rounded-lg" />
                   <button 
                     onClick={() => removeCoreGarment(i)}
                     className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                   >
                     <X className="w-2 h-2" />
                   </button>
                 </div>
               ))}
               {coreGarmentFiles.length < 5 && (
                 <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 cursor-pointer">
                   <input type="file" className="hidden" onChange={handleCoreChange} accept="image/*" multiple />
                   <Shirt className="w-4 h-4 text-pastel-muted mb-1" />
                   <span className="text-[8px] text-pastel-muted">上传衣服</span>
                 </label>
               )}
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

          {/* Agent Garment Analysis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-3 h-3 text-purple-500" />
                智能服饰特征分析
              </h3>
              <button
                type="button"
                onClick={handleAnalyzeGarment}
                disabled={isAnalyzingGarment || coreGarmentFiles.length === 0}
                className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 border border-purple-200"
              >
                {isAnalyzingGarment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {garmentAnalysis ? '重新分析' : '提取特征'}
              </button>
            </div>
            
            {garmentAnalysis && (
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 space-y-2 animate-in fade-in zoom-in duration-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 w-full">
                    <div className="text-[11px] font-bold text-purple-900">Agent 已提取服装关键细节</div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white rounded-md p-1.5 border border-purple-100 shadow-sm">
                        <span className="block text-[9px] text-purple-400 font-bold mb-0.5">版型与上身效果</span>
                        <span className="text-[10px] text-pastel-text line-clamp-2" title={garmentAnalysis.fit + " / " + garmentAnalysis.wearing_effect}>{garmentAnalysis.fit}</span>
                      </div>
                      <div className="bg-white rounded-md p-1.5 border border-purple-100 shadow-sm">
                        <span className="block text-[9px] text-purple-400 font-bold mb-0.5">领口设计</span>
                        <span className="text-[10px] text-pastel-text line-clamp-2" title={garmentAnalysis.neckline}>{garmentAnalysis.neckline}</span>
                      </div>
                      <div className="bg-white rounded-md p-1.5 border border-purple-100 shadow-sm">
                        <span className="block text-[9px] text-purple-400 font-bold mb-0.5">衣长/裙长</span>
                        <span className="text-[10px] text-pastel-text line-clamp-2" title={garmentAnalysis.length}>{garmentAnalysis.length}</span>
                      </div>
                      <div className="bg-white rounded-md p-1.5 border border-purple-100 shadow-sm">
                        <span className="block text-[9px] text-purple-400 font-bold mb-0.5">袖长与袖口</span>
                        <span className="text-[10px] text-pastel-text line-clamp-2" title={garmentAnalysis.cuffs_sleeves}>{garmentAnalysis.cuffs_sleeves}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!garmentAnalysis && !isAnalyzingGarment && (
              <div className="text-[10px] text-pastel-muted bg-pastel-bg border border-pastel-border rounded-xl p-3 text-center">
                如需替换服装，上传素材图后点击提取特征，可大幅提升换装精准度。
              </div>
            )}
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
                 onClick={() => downloadImage(resultImages[selectedResultIndex], `model-adjust-${Date.now()}.png`)}
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
              
              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all group flex items-center justify-center">
                 <button
                   onClick={() => setPreview({ src: resultImages[selectedResultIndex], title: `生成结果 #${selectedResultIndex + 1}` })}
                   className="bg-white/90 p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                 >
                   <Maximize2 className="w-6 h-6 text-pastel-text" />
                 </button>
              </div>
              
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

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-xl" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} className="absolute right-6 top-6 rounded-full border border-white/15 bg-white/10 p-4 text-white transition-colors hover:bg-white/20 shadow-2xl">
            <X className="h-8 w-8" />
          </button>

          <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[#0d1117] shadow-[0_60px_150px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-8 py-6 text-white bg-white/5">
              <div className="text-xl font-black tracking-tight">{preview.title}</div>
              <button
                onClick={() => downloadImage(preview.src, `download-${Date.now()}.png`)}
                className="flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white hover:bg-orange-600 transition-all active:scale-95"
              >
                <Download className="h-4 w-4" /> 下载图片
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px] p-12 flex items-center justify-center">
              <img src={preview.src} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelMainAdjustTab;
