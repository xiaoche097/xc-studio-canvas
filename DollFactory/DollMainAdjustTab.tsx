import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X, Maximize2 } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from './components/DollImageEditor';
import { saveGeneratedProject } from '../services/projectHistoryService';
import { convertImageDataUrlsFormat, getImageDownloadExtension, OutputImageFormat } from './utils/imageFormat';

// --- Multi-Angle Ecommerce Prompts ---
const PRODUCT_CATEGORY_ROUTING = `**产品类型识别（必须先执行）**：判断 Image 1 是玩偶/毛绒产品，还是背包、手提包、托特包、午餐包、化妆包等包类产品。
- 玩偶/毛绒产品：保持原有玩偶精修标准，锁定五官、身体比例、姿势、绒毛质感、缝线、刺绣、颜色、图案与配件。
- 包类产品：锁定包型轮廓、长宽厚比例、裁片结构、口袋数量与位置、拉链走向、提手、肩带、卡扣、五金、包边、车线、Logo、印花、颜色与原始材质。
- 严禁改变产品品类、改款、增减结构，严禁把包变成玩偶或给包添加五官、四肢等玩偶特征。`;

const PURE_WHITE_PACKSHOT_RULES = `**纯白底输出（最高优先级，不得被任何参考图覆盖）**：
- 最终背景必须是均匀、无缝的纯白色 #FFFFFF；画面四角和产品周围必须保持 RGB(255,255,255)。
- 禁止灰色、浅灰色、米白色、暖白色、渐变背景、灰色摄影棚、灰色地面、墙面分界线、环境场景或大面积灰雾。
- 产品下方必须保留符合静物摄影规律的自然接触阴影与柔和投影，用于表现落地感、重量和空间关系；阴影应贴近产品、方向合理、边缘柔和、透明度自然，不能形成灰色背景或大面积灰底。
- 使用干净柔和的商业棚拍布光，保留真实高光、暗部层次与材质细节，产品不能悬浮。`;

const REFERENCE_ANGLE_RULES = `**参考效果图角度复刻（最高优先级）**：
- Image 1 是待精修产品，只提供产品身份、结构、颜色、Logo、印花、材质和配件。
- Images 2+ 是参考效果图。必须复刻参考效果图中的产品朝向、水平旋转角、俯仰角、相机高度、镜头透视、构图位置、主体大小和裁切范围。
- 参考图只控制角度、构图、布光和精修效果，绝不能把参考图产品的款式、口袋、拉链、肩带、五金、Logo、印花或颜色复制到 Image 1。
- 若多张参考图角度不一致，以 Image 2 为主要目标角度，其余参考图只补充光影和材质效果。
- 不得保留 Image 1 的原始角度来规避视角重建；输出角度与参考效果图明显不一致即视为失败。`;

const ANGLE_TEMPLATES = {
  A: {
    name: '左前 45°',
    label: '3/4 front-left',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：执行视角大回转。**
**视角转换**：请忽略参考图的原始角度。无论参考图朝向何方，请在空间中将其 3D 重建并旋转至【左前方 45 度视角（3/4 front-left）】。
${PRODUCT_CATEGORY_ROUTING}
**身份与材质保真**：必须 100% 保持 Image 1 中产品的身份、结构、颜色、材质、图案与全部细节。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  B: {
    name: '正面',
    label: 'front view',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：强制回正视角。**
**视角转换**：请忽略参考图的原始偏转角度。请在空间中将其 3D 重建并强制转动至【正前方平视视角（Front View）】。
${PRODUCT_CATEGORY_ROUTING}
**身份与材质保真**：必须 100% 保持 Image 1 中产品的身份、结构、颜色、材质、图案与全部细节。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  C: {
    name: '右前 45°',
    label: '3/4 front-right',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：执行视角大回转。**
**视角转换**：请忽略参考图的原始角度。无论参考图朝向何方，请在空间中将其 3D 重建并旋转至【右前方 45 度视角（3/4 front-right）】。需看到产品右侧更多细节。
${PRODUCT_CATEGORY_ROUTING}
**身份与材质保真**：必须 100% 保持 Image 1 中产品的身份、结构、颜色、材质、图案与全部细节。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度，自然贴地阴影。`
  },
  D: {
    name: '侧面',
    label: 'side profile',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：视角 90 度转动。**
**视角转换**：请基于 Image 1 的 identity 重构一个【正侧面视角（Side Profile）】的渲染。
${PRODUCT_CATEGORY_ROUTING}
**身份与材质保真**：必须 100% 保持 Image 1 中产品的身份、结构、颜色、材质、图案与全部细节。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度。`
  },
  E: {
    name: '背面',
    label: 'back view',
    prompt: `你现在是一名顶级的电商 3D 产品修图师。
**核心指令：视角 180 度大转弯。**
**视角转换**：请基于 Image 1 的 identity 重构一个【正背面视角（Back View）】的渲染。仅可保守推导被遮挡的背部结构，不得凭空增加口袋、肩带、五金、配件或身体部件。
${PRODUCT_CATEGORY_ROUTING}
**身份与材质保真**：必须高度统一产品颜色、材质、结构与工艺细节。
**输出要求**：纯白背景 (#FFFFFF)，电商棚拍级锐度。`
  },
  F: {
    name: '细节特写',
    label: 'details',
    prompt: `你现在是一名资深的电商产品微距摄影师。
**核心指令：局部高清精修。**
${PRODUCT_CATEGORY_ROUTING}
**一致性要求**：保持参考图 100% 的比例与位置；玩偶仅增强绒毛、缝线、刺绣等细节，包类仅增强面料纹理、皮革、车线、包边、拉链和五金等真实细节并去除瑕疵。
**输出要求**：纯白背景 (#FFFFFF)。`
  },
  G: {
    name: '微调-左',
    label: 'slight left (5°-20°)',
    prompt: `在 Image 1 的基础上，执行极细微的向左旋转修正（约 5°-20°）。
${PRODUCT_CATEGORY_ROUTING}
保持 100% 身份一致性，仅做透视修正与电商级精修。
输出：纯白背景 (#FFFFFF)。`
  },
  H: {
    name: '微调-右',
    label: 'slight right (5°-20°)',
    prompt: `在 Image 1 的基础上，执行极细微的向右旋转修正（约 5°-20°）。
${PRODUCT_CATEGORY_ROUTING}
保持 100% 身份一致性，仅做透视修正与电商级精修。
输出：纯白背景 (#FFFFFF)。`
  },
  RETOUCH: {
    name: '主图精修',
    label: 'Retouch & Lock',
    prompt: `以参考图为唯一依据进行产品精修：严格保持相机角度、镜头高度、焦距透视、主体朝向、姿势、构图与裁切范围完全一致（camera/view locked, do not change viewpoint, do not change pose, do not change framing, same camera angle, same perspective, same focal length, same framing, no rotation, no viewpoint change），不要改变产品外形设计与比例，不要移动任何部件位置。
${PRODUCT_CATEGORY_ROUTING}
输出为电商白底主图 packshot：纯白无缝背景（seamless pure white background），背景干净无纹理无渐变。
玩偶/毛绒产品继续使用原精修标准：增强真实短毛绒或原始绒毛材质，整理毛向、缝线、刺绣、贴布与五官细节，清理灰尘、毛屑、线头、脏点和压痕，不改变玩偶设计。
包类产品使用包袋精修标准：忠实增强原始尼龙、帆布、涤纶、皮革、PU、绗缝或其他真实材质；整理包身形态、裁片边缘、车线、包边、拉链与五金，清理灰尘、污点、线头、运输挤压和非设计性褶皱，但保留真实结构褶皱，不改变包型与款式。
棚拍柔光：soft even studio lighting, high-key, clean highlights, soft natural shadow directly under the product, sharp focus, high resolution, professional e-commerce retouching, vibrant but realistic colors, rich contrast.`,
    negativePrompt: `change of category, toy features added to bag, eyes on bag, limbs on bag, different product, changed angle, different viewpoint, rotation, tilted camera, zoomed out, zoomed in, crop change, perspective distortion, rearranged parts, redesign, deformed, wrong proportions, changed pocket layout, extra pocket, missing pocket, changed zipper, changed handle, changed strap, changed hardware, changed logo, changed print, changed material, extra objects, background texture, gradient background, shadow too strong, harsh light, overexposed, underexposed, haze, dull colors, desaturated, washed out, muddy colors, noisy, grainy, blurry, low resolution, oversharpen, watermark, added text.`
  }
};

const GLOBAL_NEGATIVE_PROMPT = `change category, turn bag into toy, toy face on bag, eyes on bag, limbs on bag, change design, redesign, altered structure, mismatch, inaccurate details, different product, wrong proportions, wrong color, color shift, hue shift, changed texture, changed material, plastic look, glossy, over-smooth, over-sharpen, changed pocket layout, extra pocket, missing pocket, changed zipper, changed handle, changed strap, changed buckle, changed hardware, extra accessories, missing accessories, added patterns, changed logo, added text, watermark, label, tag, sticker, background props, hands, people, multiple products, duplicated product, cropped, cut off, out of frame, floating, harsh shadow, strong shadow, gray background, gradient background, messy edges, white outline, halo, jagged edges, blur, low resolution, noise, jpeg artifacts, cartoon, illustration, anime, 3D render, CGI`;


const DollMainAdjustTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  type PasteTarget = { kind: 'source' } | { kind: 'reference'; index?: number };

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [guidance, setGuidance] = useState('');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [variantCount, setVariantCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('jpg');
  const [preview, setPreview] = useState<{ src: string, title: string } | null>(null);

  // Reference Images (Up to 3)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const pasteTargetRef = useRef<PasteTarget | null>(null);

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

  const replaceRefFile = (index: number, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setRefFiles(prev => prev.map((item, i) => i === index ? file : item));
    setRefUrls(prev => {
      const next = [...prev];
      if (next[index]?.startsWith('blob:')) URL.revokeObjectURL(next[index]);
      next[index] = URL.createObjectURL(file);
      return next;
    });
  };

  useEffect(() => {
    const handleClipboardPaste = (event: ClipboardEvent) => {
      if (!isActive || event.defaultPrevented) return;
      const target = pasteTargetRef.current;
      if (!target) return;

      const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
      const imageFile = imageItem?.getAsFile();
      if (!imageFile) return;

      event.preventDefault();
      if (target.kind === 'source') {
        setSourceFromFile(imageFile);
      } else if (typeof target.index === 'number' && target.index < refFiles.length) {
        replaceRefFile(target.index, imageFile);
      } else {
        addRefFile(imageFile);
      }
    };

    window.addEventListener('paste', handleClipboardPaste);
    return () => window.removeEventListener('paste', handleClipboardPaste);
  }, [isActive, sourceUrl, refFiles.length]);

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
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.click();
    }
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请上传产品原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在识别产品类型与结构属性，调整精修参数...');

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

      let prompt = `[ECOMMERCE PRODUCT MAIN IMAGE ENHANCEMENT - HIGH PRIORITY COMMAND]\nFirst identify whether Image 1 is a toy/doll/plush product or a bag product such as a backpack, handbag, tote bag, lunch bag, or cosmetic bag.\n\n${PRODUCT_CATEGORY_ROUTING}\n\n=== STRICT USER INSTRUCTIONS (PRIORITIZE ABOVE ALL) ===\n${guidance || 'Perform professional ecommerce retouching: improve lighting, clarity, material detail, shape presentation, and background cleanliness while preserving the exact product identity, structure, color, print, logo, and accessories.'}\n=== END STRICT USER INSTRUCTIONS ===`;
      let negativePrompt = GLOBAL_NEGATIVE_PROMPT;

      // Use Professional Angle Prompts if selected
      if (selectedAngle && (ANGLE_TEMPLATES as any)[selectedAngle]) {
        const template = (ANGLE_TEMPLATES as any)[selectedAngle];
        prompt = template.prompt;
        if (guidance) {
          prompt += `\n\n**Additional Instruction**: ${guidance}`;
        }
        // Handle custom negative prompt for RETOUCH
        negativePrompt = template.negativePrompt || GLOBAL_NEGATIVE_PROMPT;
      }

      // ==========================================
      // [NEW] Agentic Pre-analysis for Precision Locality
      // ==========================================
      if (selectedAngle || refInputImages.length > 0 || editorBoxes.length > 0) {
        setStatusMessage('🌍 Agent 正在解析视角转换与局部调整指令...');
        // Execute Vision Pre-processing
        const analysis = await analyzeDollModification(
          { base64: compressedImage.base64, mimeType: compressedImage.mime },
          refInputImages,
          editorBoxes.map((b, i) => ({ 
            x: b.x, y: b.y, w: b.w, h: b.h, 
            color: ['Red', 'Yellow', 'Blue'][i % 3] 
          })),
          guidance,
          selectedAngle ? (ANGLE_TEMPLATES as any)[selectedAngle].name : undefined,
          'doll-or-bag'
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
      }

      // These final constraints must survive prompt replacement by the vision pre-analysis.
      if (refInputImages.length > 0) {
        prompt += `\n\n${REFERENCE_ANGLE_RULES}`;
      }
      prompt += `\n\n${PURE_WHITE_PACKSHOT_RULES}`;
      
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
            workflowHint: (selectedAngle === 'RETOUCH' ? 'product-retouching' : 'product-modification') as any,
            sampleCount: 1 
          }
        )
      );

      const allResults = await Promise.all(generationTasks);
      const flattenedResult = allResults.flat().filter(img => !!img);

      if (flattenedResult.length > 0) {
        const formattedResults = await convertImageDataUrlsFormat(flattenedResult, outputFormat);
        setResultImages(formattedResults);
        setSelectedResultIndex(0);
        await saveGeneratedProject({
          type: 'RETOUCHING',
          generated: formattedResults,
          original: [
            `data:${compressedImage.mime};base64,${compressedImage.base64}`,
            ...refInputImages.map(img => `data:${img.mimeType};base64,${img.base64}`)
          ],
          prompt,
          params: {
            source: 'DollFactory/DollMainAdjustTab',
            model: selectedModel,
            aspectRatio: outputAspectRatio,
            resolution,
            outputFormat,
            variantCount,
            selectedAngle
          }
        });
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
      {/* Sidebar Controls */}
      <div className="w-full md:w-1/3 lg:w-[500px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Doll Adjustment</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">主图精修工具</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传玩偶或包类产品原图，AI 自动识别品类并生成结构保真的专业电商主图。
            </p>
          </div>

          {/* 原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>产品原图</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            {sourceUrl ? (
              <div 
                className="relative group w-full aspect-square rounded-[24px] border border-pastel-border shadow-sm overflow-hidden bg-white flex items-center justify-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
                onMouseEnter={() => { pasteTargetRef.current = { kind: 'source' }; }}
                onMouseLeave={() => { pasteTargetRef.current = null; }}
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
                    
                    {/* Draw Boxes Preview (Visual only) */}
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
                
                {/* Delete button (Top Right) */}
                <button 
                  onClick={() => { setSourceUrl(null); setSourceFile(null); setEditorBoxes([]); }}
                  className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 z-20"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Edit Button overlay (Bottom Right) */}
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
                onMouseEnter={() => { pasteTargetRef.current = { kind: 'source' }; }}
                onMouseLeave={() => { pasteTargetRef.current = null; }}
                className="relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
              >
                <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-pastel-text">点击或拖拽原图到此处</span>
                <span className="mt-1 text-[10px] text-pastel-muted">鼠标停在这里可 Ctrl+V 粘贴</span>
              </label>
            )}
          </div>

          {/* 角度锁定选择器 (NEW) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>角度锁定 <span className="text-[10px] font-normal text-pastel-muted">(电商主图预设)</span></span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ANGLE_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setSelectedAngle(selectedAngle === key ? null : key)}
                  className={`px-2 py-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${selectedAngle === key ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-orange-200'}`}
                >
                  <span className="text-xs">{template.name}</span>
                  <span className="opacity-40 text-[8px] uppercase">{template.label}</span>
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
            <div 
              className="grid grid-cols-3 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleRefDrop}
            >
               {refUrls.map((url, i) => {
                  const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500'];
                  return (
                  <div 
                    key={i}
                    className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white flex items-center justify-center p-1"
                    onMouseEnter={() => { pasteTargetRef.current = { kind: 'reference', index: i }; }}
                    onMouseLeave={() => { pasteTargetRef.current = null; }}
                    title="鼠标停在此处按 Ctrl+V 可替换这张参考图"
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
                   className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                   onMouseEnter={() => { pasteTargetRef.current = { kind: 'reference' }; }}
                   onMouseLeave={() => { pasteTargetRef.current = null; }}
                 >
                   <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" multiple />
                   <div className="w-6 h-6 mb-1 bg-white shadow-sm rounded-md flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                     <ImageIcon className="w-3 h-3" />
                   </div>
                   <span className="text-[9px] font-bold text-pastel-text opacity-70">上传参考</span>
                   <span className="mt-0.5 text-[8px] text-pastel-muted">或 Ctrl+V</span>
                 </label>
               )}
            </div>
          </div>

          {/* 画幅选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (Aspect Ratio)</h3>
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: AspectRatio.SQUARE, label: '1:1' },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5' },
                { value: AspectRatio.PORTRAIT_2_3, label: '2:3' },
                { value: AspectRatio.PORTRAIT_9_16, label: '9:16' }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setOutputAspectRatio(item.value)}
                  className={`rounded-xl border py-2 text-[10px] font-bold transition-all ${outputAspectRatio === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
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

          <div className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm">
             <div className="mb-3 flex items-center gap-2">
               <Download className="h-4 w-4 text-pastel-highlight" />
               <h3 className="text-sm font-black text-pastel-text">输出格式</h3>
               <span className="rounded-full bg-orange-50 px-2 py-1 text-[9px] font-bold text-orange-400">下载与历史保存格式</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {([
                 { value: 'jpg', label: 'JPG', description: '默认' },
                 { value: 'png', label: 'PNG', description: '高清' }
               ] as const).map((format) => {
                 const active = outputFormat === format.value;
                 return (
                   <button
                     key={format.value}
                     type="button"
                     onClick={() => setOutputFormat(format.value as OutputImageFormat)}
                     aria-pressed={active}
                     className={`flex min-h-14 flex-col items-center justify-center rounded-xl border text-center transition-all ${active
                       ? 'border-pastel-highlight bg-orange-50/70 text-pastel-highlight shadow-sm'
                       : 'border-pastel-border bg-white text-pastel-muted hover:border-orange-200 hover:bg-orange-50/30'
                     }`}
                   >
                     <span className="text-xs font-black">{format.label}</span>
                     <span className={`mt-0.5 text-[9px] font-medium ${active ? 'text-orange-300' : 'text-slate-300'}`}>{format.description}</span>
                   </button>
                 );
               })}
             </div>
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
              placeholder="例如：清理包身褶皱并增强尼龙纹理，保持口袋、拉链、肩带、Logo 和印花不变；或按原标准精修玩偶绒毛与缝线（高权重指令）..."
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
              <><Loader2 className="h-5 w-5 animate-spin" /> 正在生成精修主图...</>
            ) : (
              <><Zap className="h-5 w-5" /> 立即生成</>
            )}
          </button>
        </div>
      </div>

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
             <p className="text-xs mt-2 opacity-70">请在左侧上传玩偶或包类产品原图并点击生成</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-4xl px-2">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-pastel-highlight" />
                   <span className="text-sm font-black text-slate-800 tracking-tight">生成结果 ({selectedResultIndex + 1}/{resultImages.length})</span>
                 </div>
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
                 onClick={() => downloadImage(resultImages[selectedResultIndex], `product-retouch-${Date.now()}.${getImageDownloadExtension(resultImages[selectedResultIndex], outputFormat)}`)}
                 className="flex items-center justify-center gap-2 rounded-xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight hover:bg-pastel-highlight/15 shadow-sm"
               >
                 <Download className="h-3.5 w-3.5" /> 下载当前变体
               </button>
            </div>
            
            <div 
              className="relative group max-h-[85%] overflow-hidden rounded-[32px] border-4 border-white bg-white shadow-2xl transition-all flex items-center justify-center"
              style={{ 
                aspectRatio: outputAspectRatio.replace(':', ' / '),
                width: 'auto',
                height: '100%'
              }}
            >
              <img
                src={resultImages[selectedResultIndex]}
                alt="Doll Result"
                className="w-full h-full object-contain bg-slate-50"
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all group flex items-center justify-center">
                  <button
                    onClick={() => setPreview({ src: resultImages[selectedResultIndex], title: `生成结果 #${selectedResultIndex + 1}` })}
                    className="bg-white/90 p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Maximize2 className="w-6 h-6 text-pastel-text" />
                  </button>
               </div>
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
              setSourceFile(dataURLtoFile(base64, 'cropped_product.png'));
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
                onClick={() => downloadImage(preview.src, `download-${Date.now()}.${getImageDownloadExtension(preview.src, outputFormat)}`)}
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

export default DollMainAdjustTab;
