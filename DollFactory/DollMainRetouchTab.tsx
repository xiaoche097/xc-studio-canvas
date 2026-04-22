import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from './components/DollImageEditor';

// --- Multi-Angle Ecommerce Prompts ---
const ANGLE_TEMPLATES = {
  A: {
    name: '左前 45°',
    label: '3/4 front-left',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：执行视角大回转。**
**视角转换**：请忽略参考图的原始角度。无论参考图朝向何方，请在空间中将其 3D 重建并旋转至【左前方 45 度视角（3/4 front-left）】。
**身份与材质保真**：必须 100% 保持 Image 1 中玩偶的 IP 身份（五官比例、颜色、绒毛质感、所有配件）。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  B: {
    name: '正面',
    label: 'front view',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：强制回正视角。**
**视角转换**：请忽略参考图的原始偏转角度。请在空间中将其 3D 重建并强制转动至【正前方平视视角（Front View）】。
**身份与材质保真**：必须 100% 保持 Image 1 中玩偶的 IP 身份（五官比例、颜色、绒毛质感、所有配件）。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  C: {
    name: '右前 45°',
    label: '3/4 front-right',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：执行视角大回转。**
**视角转换**：请忽略参考图的原始角度。无论参考图朝向何方，请在空间中将其 3D 重建并旋转至【右前方 45 度视角（3/4 front-right）】。需看到玩偶右侧更多细节。
**身份与材质保真**：必须 100% 保持 Image 1 中玩偶的 IP 身份（五官比例、颜色、绒毛质感、所有配件）。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  D: {
    name: '侧面',
    label: 'side profile',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：视角 90 度转动。**
**视角转换**：请基于 Image 1 的 identity 重构一个【正侧面视角（Side Profile）】的渲染。
**身份与材质保真**：必须 100% 保持 Image 1 中玩偶的 IP 身份（五官比例、颜色、绒毛质感、所有配件）。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度。`
  },
  E: {
    name: '背面',
    label: 'back view',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：视角 180 度大转弯。**
**视角转换**：请基于 Image 1 的 identity 重构一个【正背面视角（Back View）】的渲染。需合理推导出玩偶背部的结构。
**身份与材质保真**：必须高度统一绒毛颜色与材质感。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度。`
  },
  F: {
    name: '细节特写',
    label: 'details',
    prompt: `你现在是一名资深的电商产品微距摄影师。
**核心指令：局部高清精修。**
**一致性要求**：保持参考图 100% 的比例与位置，仅对绒毛细节、缝线、刺绣进行超高清清晰度增强与去瑕疵。
**输出要求**：纯白背景 (#FFFFFF)。`
  },
  G: {
    name: '微调-左',
    label: 'slight left (5°-20°)',
    prompt: `在 Image 1 的基础上，执行极细微的向左旋转修正（约 5°-20°）。
保持 100% 身份一致性，仅做透视修正与电商级精修。
输出：纯白背景 (#FFFFFF)。`
  },
  H: {
    name: '微调-右',
    label: 'slight right (5°-20°)',
    prompt: `在 Image 1 的基础上，执行极细微的向右旋转修正（约 5°-20°）。
保持 100% 身份一致性，仅做透视修正与电商级精修。
输出：纯白背景 (#FFFFFF)。`
  },
  RETOUCH: {
    name: '主图精修',
    label: 'Retouch & Lock',
    prompt: `以参考图为唯一依据进行产品精修：严格保持相机角度、镜头高度、焦距透视、主体朝向、姿势、构图与裁切范围完全一致（camera/view locked, do not change viewpoint, do not change pose, do not change framing, same camera angle, same perspective, same focal length, same framing, no rotation, no viewpoint change），不要改变玩偶外形设计与比例，不要移动任何部件位置。
输出为电商白底主图 packshot：纯白无缝背景（seamless pure white background），背景干净无纹理无渐变。
对玩偶做商业级精修与质感升级：面料为高级短毛绒（short-pile velboa / crystal velboa / minky short pile / microfiber microfleece），绒毛短而致密、柔软饱满、表面细腻均匀，轻微毛向与少量逆毛带来自然明暗层次（subtle nap marks, gentle brushed pile, soft tonal variation），边缘微微蓬松但整洁不炸毛。车缝线/拼接更平整干净，轮廓清晰但不过度锐化；刺绣/贴布/五官细节更清楚、边缘干净。清理瑕疵：灰尘、毛屑、线头、脏点、折痕压痕。
棚拍柔光：soft even studio lighting, high-key, clean highlights, soft natural shadow directly under the toy, sharp focus, high resolution, professional e-commerce retouching, vibrant but realistic colors, rich contrast.`,
    negativePrompt: `change of angle, different viewpoint, rotation, tilted camera, zoomed out, zoomed in, crop change, top-down, bird’s-eye view, worm’s-eye view, perspective distortion, fisheye, wide-angle distortion, rearranged parts, redesign, deformed, wrong proportions, extra objects, background texture, gradient background, shadow too strong, harsh light, overexposed, underexposed, haze, dull colors, desaturated, washed out, grayish, muddy colors, noisy, grainy, blurry, low resolution, oversharpen, watermark, text, logo.`
  }
};

const FABRIC_TEMPLATES = {
  SLEEK: {
    name: '哑光贴毛',
    desc: '最干净、几乎无毛丝 (Sleek)',
    prompt: 'very short pile, sleek velboa, minimal fuzz, compact surface',
    negative: 'long fur, shaggy, fluffy, hairy edges'
  },
  PUFFY: {
    name: '蓬松饱满',
    desc: '稍微蓬松但仍高级 (Puffy)',
    prompt: 'softly puffed short pile, fluffy but neat, airy and full, velvety volume',
    negative: 'flat surface, thin fabric, bald spots'
  },
  NAP: {
    name: '自然毛向',
    desc: '带轻微逆毛层次 (Nap Marks)',
    prompt: 'subtle nap marks, gentle brushed pile, soft tonal variation, natural fabric movement',
    negative: 'uniform plastic look, artificial surface'
  }
};

const GLOBAL_NEGATIVE_PROMPT = `change design, redesign, altered structure, mismatch, inaccurate details, different product, wrong proportions, wrong color, color shift, hue shift, changed texture, plastic look, glossy, over-smooth, over-sharpen, extra accessories, missing accessories, added patterns, added text, logo, watermark, label, tag, sticker, background props, hands, people, multiple products, duplicated product, cropped, cut off, out of frame, floating, harsh shadow, strong shadow, gray background, gradient background, messy edges, white outline, halo, jagged edges, blur, low resolution, noise, jpeg artifacts, cartoon, illustration, anime, 3D render, CGI`;


const DollMainRetouchTab: React.FC = () => {
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
  const [selectedAngle, setSelectedAngle] = useState<string | null>('RETOUCH');
  const [selectedFabric, setSelectedFabric] = useState<keyof typeof FABRIC_TEMPLATES | null>(null);
  const [variantCount, setVariantCount] = useState(1);

  // Reference Images (Up to 3)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorBoxes, setEditorBoxes] = useState<EditorBox[]>([]);

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
    setSourceUrl(URL.createObjectURL(file));
    setResultImages([]);
    setEditorBoxes([]); // Reset boxes on new image
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
      alert('请上传玩偶原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在分析玩偶原图结构属性，调整生成参数...');

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

      let prompt = `[DOLL MAIN IMAGE ENHANCEMENT]\nOptimizing the main display image for a toy/doll.\nUser instruction: ${guidance || 'Enhance lighting, details and background to make it look professional for e-commerce, retaining the core features of the doll.'}`;
      let negativePrompt = 'deformed anatomy, totally different doll, distorted shape, extra limbs, bad lighting, text, watermark';

      // ==========================================
      // [RETOUCH MODE] Always hardcoded to RETOUCH
      // ==========================================
      const template = ANGLE_TEMPLATES.RETOUCH;
      prompt = template.prompt;
      
      // Inject Fabric specifics only if selected
      if (selectedFabric && FABRIC_TEMPLATES[selectedFabric]) {
        const fabricTemplate = FABRIC_TEMPLATES[selectedFabric];
        prompt += `\n\n**FABRIC FINISH**: ${fabricTemplate.prompt}. Surface: short-pile velboa plush, crystal velboa, minky short pile, microfiber microfleece, dense and smooth nap, matte soft finish, subtle directional pile sheen, clean uniform texture, premium plush toy fabric.`;
        negativePrompt = (template.negativePrompt || GLOBAL_NEGATIVE_PROMPT) + ', ' + fabricTemplate.negative;
      } else {
        negativePrompt = template.negativePrompt || GLOBAL_NEGATIVE_PROMPT;
      }

      // ==========================================
      // [NEW] Agentic Pre-analysis for Precision Locality
      // ==========================================
      if (editorBoxes.length > 0 && refInputImages.length > 0) {
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
          template.name
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
        prompt += `\nCRITICAL: You have been provided ${refFiles.length} additional input image(s) acting as STYLE/EFFECT REFERENCES. Please seamlessly blend their visual features globally onto the main doll.`;
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
            workflowHint: (selectedAngle === 'RETOUCH' ? 'doll-retouching' : 'doll-modification') as any,
            sampleCount: 1 
          }
        )
      );

      const allResults = await Promise.all(generationTasks);
      const flattenedResult = allResults.flat().filter(img => !!img);

      if (flattenedResult.length > 0) {
        setResultImages(flattenedResult);
        setSelectedResultIndex(0);
        setStatusMessage(selectedAngle ? '视角转换方案已生成！请从变体中挑选最准确的一张。' : '精修图已生成！');
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
              <span className="text-xs font-black uppercase tracking-[0.22em]">Doll Retouching</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">玩偶主图精修</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传基础的玩偶草图或原片，AI 结合提示词为您生成精美、专业的商业展示主图。
            </p>
          </div>

          {/* 原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>基础玩偶原图</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            {sourceUrl ? (
              <div 
                className="relative group w-full aspect-square rounded-[24px] border border-pastel-border shadow-sm overflow-hidden bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
              >
                <img src={sourceUrl} alt="source" className="w-full h-full object-contain" />
                
                {/* Delete button (Top Right) */}
                <button 
                  onClick={() => { setSourceUrl(null); setSourceFile(null); setEditorBoxes([]); }}
                  className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Edit Button overlay (Bottom Right) */}
                <button 
                  onClick={() => setIsEditorOpen(true)}
                  className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-black/90 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10 backdrop-blur-sm border border-white/10"
                >
                  编辑
                </button>
                
                {/* Draw Boxes Preview (optional, visual only) */}
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
                <span className="text-sm font-bold text-pastel-text">点击或拖拽原图到此处</span>
              </label>
            )}
          </div>

          {/* 视角锁定状态展示 */}
          <div className="bg-orange-50/10 border border-orange-200/50 rounded-2xl p-4 flex items-center gap-4 transition-all">
             <div className="w-10 h-10 bg-orange-100/50 rounded-xl flex items-center justify-center flex-shrink-0 border border-orange-200/50 shadow-sm">
                <Sparkles className="w-5 h-5 text-orange-500" />
             </div>
             <div className="flex-1">
                <div className="text-[10px] font-black text-orange-800/60 uppercase tracking-wider mb-0.5">Perspective Locked</div>
                <div className="text-[10px] text-orange-600/80 font-medium leading-relaxed">
                  视角锁定模式已开启
                </div>
             </div>
          </div>

          {/* 面料精修选择器 (New Section) */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-pastel-text flex items-center gap-2">
                   <Edit2 className="w-4 h-4 text-pastel-highlight" />
                   <span>面料毛感精修</span>
                </h3>
                <span className="text-[10px] py-0.5 px-2 bg-pastel-highlight/10 text-pastel-highlight rounded-full font-bold">Premium Texture</span>
             </div>
             <div className="grid grid-cols-1 gap-2">
                <button
                   onClick={() => setSelectedFabric(null)}
                   className={`group relative p-3 rounded-2xl border text-left transition-all duration-200 ${
                      selectedFabric === null 
                         ? 'border-pastel-highlight bg-white shadow-md' 
                         : 'border-pastel-border bg-pastel-bg/50 hover:bg-white hover:border-pastel-highlight/30'
                   }`}
                >
                   <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                         <span className={`text-xs font-black transition-colors ${selectedFabric === null ? 'text-pastel-highlight' : 'text-pastel-text'}`}>
                            默认精修
                         </span>
                         <span className="text-[10px] text-pastel-muted mt-0.5">基础材质增强，保持原样</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                         selectedFabric === null ? 'border-pastel-highlight bg-pastel-highlight shadow-inner' : 'border-pastel-border bg-white'
                      }`}>
                         {selectedFabric === null && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                      </div>
                   </div>
                </button>

                {(Object.entries(FABRIC_TEMPLATES) as [keyof typeof FABRIC_TEMPLATES, any][]).map(([key, item]) => (
                   <button
                      key={key}
                      onClick={() => setSelectedFabric(key)}
                      className={`group relative p-3 rounded-2xl border text-left transition-all duration-200 ${
                         selectedFabric === key 
                            ? 'border-pastel-highlight bg-white shadow-md' 
                            : 'border-pastel-border bg-pastel-bg/50 hover:bg-white hover:border-pastel-highlight/30'
                      }`}
                   >
                      <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className={`text-xs font-black transition-colors ${selectedFabric === key ? 'text-pastel-highlight' : 'text-pastel-text'}`}>
                               {item.name}
                            </span>
                            <span className="text-[10px] text-pastel-muted mt-0.5">{item.desc}</span>
                         </div>
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedFabric === key ? 'border-pastel-highlight bg-pastel-highlight shadow-inner' : 'border-pastel-border bg-white'
                         }`}>
                            {selectedFabric === key && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                         </div>
                      </div>
                   </button>
                ))}
             </div>
          </div>

          {/* 参考图上传 (可选) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>参考效果图 <span className="opacity-60 font-normal">({refFiles.length}/3)</span></span>
              <span className="text-[10px] font-normal text-pastel-muted">可选</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
               {refUrls.map((url, i) => {
                  const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500'];
                  return (
                  <div 
                    key={i}
                    className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white flex items-center justify-center p-1"
                  >
                    <img src={url} alt={`reference-${i}`} className="max-w-full max-h-full object-contain" />
                    
                    {/* Color badge mapper */}
                    <span className={`absolute top-1 left-1 w-3.5 h-3.5 ${colors[i % 3]} rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold text-white`}>
                      {i+1}
                    </span>

                    <button 
                      onClick={() => removeRefFile(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors bg-opacity-0 opacity-0 group-hover:opacity-100 z-10"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
               )})}

               {refFiles.length < 3 && (
                 <label 
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={handleRefDrop}
                   className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                 >
                   <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" multiple />
                   <div className="w-6 h-6 mb-1 bg-white shadow-sm rounded-md flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                     <ImageIcon className="w-3 h-3" />
                   </div>
                   <span className="text-[9px] font-bold text-pastel-text opacity-70">上传参考</span>
                 </label>
               )}
            </div>
          </div>

          {/* 画幅选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (Aspect Ratio)</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: AspectRatio.SQUARE, label: '1:1' },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5' },
                { value: AspectRatio.PORTRAIT_9_16, label: '9:16' }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setOutputAspectRatio(item.value)}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all ${outputAspectRatio === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <h3 className="text-xs font-bold text-pastel-muted mb-2">生成画质</h3>
             <select
               value={resolution}
               onChange={(e) => setResolution(e.target.value as ImageResolution)}
               className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-xs font-bold outline-none transition-all"
             >
               <option value={ImageResolution.RES_2K}>2K (快速清晰)</option>
               <option value={ImageResolution.RES_4K}>4K (极致细节)</option>
             </select>
          </div>

          {/* 变体数量选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">生成变体数量 (Variants)</h3>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setVariantCount(num)}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all ${variantCount === num ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">补充提示词 (可选)</h3>
            <textarea
              rows={3}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例如：毛绒材质、明亮的暖色调灯光、背景是童话房间..."
              className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
            />
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
             <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
               <Cpu className="w-3.5 h-3.5" /> 模型选择
             </label>
             <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                 className={`py-2 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
               >
                 3.1 Flash (极速)
               </button>
               <button
                 onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                 className={`py-2 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
               >
                 3.0 Pro (推荐)
               </button>
             </div>
           </div>

        </div>

        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-sm">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all hover:brightness-105 active:scale-[0.98]"
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 正在生成玩偶主图...</>
            ) : (
              <><Zap className="h-5 w-5" /> 立即生成</>
            )}
          </button>
        </div>
      </div>

      {/* 右侧展示区 */}
      <div className="flex-1 flex px-6 py-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-md w-full">
              <Loader2 className="w-16 h-16 text-pastel-highlight animate-spin" />
              <div className="text-center space-y-3">
                <h3 className="text-xl font-black text-pastel-highlight">处理中...</h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse">
                  {statusMessage}
                </p>
              </div>
            </div>
          </div>
        ) : resultImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted w-full h-full">
             <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-6 shadow-sm">
               <Zap className="w-10 h-10 text-pastel-border" />
             </div>
             <p className="text-lg font-black text-pastel-text">等待生成</p>
             <p className="text-xs mt-2 opacity-70">请在左侧上传玩偶底图并点击生成</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-4xl px-2">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-pastel-highlight" />
                   <span className="text-sm font-black text-slate-800 tracking-tight">生成结果 ({selectedResultIndex + 1}/{resultImages.length})</span>
                 </div>
                 
                 {/* Multi-result thumbnails selector */}
                 <div className="flex items-center gap-1.5 ml-2">
                    {resultImages.map((img, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setSelectedResultIndex(idx)}
                        className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${selectedResultIndex === idx ? 'border-orange-500 scale-110 shadow-md' : 'border-transparent opacity-40 hover:opacity-100'}`}
                      >
                        <img src={img} className="w-full h-full object-cover" />
                      </button>
                    ))}
                 </div>
               </div>
               
               <button
                 onClick={() => {
                   const a = document.createElement('a');
                   a.href = resultImages[selectedResultIndex];
                   a.download = `doll-adjust-${selectedResultIndex}-${Date.now()}.png`;
                   document.body.appendChild(a);
                   a.click();
                   a.remove();
                 }}
                 className="flex items-center justify-center gap-2 rounded-xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight hover:bg-pastel-highlight/15 shadow-sm"
               >
                 <Download className="h-3.5 w-3.5" /> 下载当前变体
               </button>
            </div>
            
            <div className="relative group max-h-[80%] aspect-square overflow-hidden rounded-[32px] border-4 border-white bg-white shadow-2xl transition-all">
              <img
                src={resultImages[selectedResultIndex]}
                alt="Doll Result"
                className="w-full h-full object-contain bg-slate-50"
              />
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
              setSourceFile(dataURLtoFile(base64, 'cropped_doll.png'));
           }}
           onApplyBoxes={(boxes) => {
              setEditorBoxes(boxes);
           }}
        />
      )}
    </div>
  );
};

export default DollMainRetouchTab;
