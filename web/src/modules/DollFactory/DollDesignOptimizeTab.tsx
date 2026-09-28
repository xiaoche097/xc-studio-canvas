import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, X, LayoutGrid, CheckCircle2, ChevronRight, AlertCircle, Sparkle, Cpu, Image as ImageIcon, ShoppingCart, Smartphone, RotateCcw } from 'lucide-react';
import { compressImage, generateContentWithAnalysisFallback, getAiClient, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { saveGeneratedProject } from '../../services/projectHistoryService';

// Types

interface DiagnosisResult {
  scene_type: string;
  overall_score: number;
  issues: { category: string; problem: string; suggestion: string }[];
  layout_suggestion: string;
  copy_suggestion: { headline: string; subheadline: string; features: string[] };
  style_direction: string;
}

interface ImageItem {
  id: string;
  file: File;
  url: string;
  base64: string;
  mime: string;
  diagnosis?: DiagnosisResult;
  status: 'pending' | 'diagnosing' | 'diagnosed' | 'generating' | 'done' | 'error';
  error?: string;
  optimizedUrl?: string;
}

const DollDesignOptimizeTab: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [thinkingModel, setThinkingModel] = useState('gemini-3.1-flash-lite-preview');
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [userStyle, setUserStyle] = useState('');
  const [guidance, setGuidance] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  
  // State for sequential processing
  const [globalStatus, setGlobalStatus] = useState('');

  const MAX_IMAGES = 3;

  // Handlers
  const handleFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const remainingCount = MAX_IMAGES - images.length;
    const filesToAdd = validFiles.slice(0, remainingCount);

    if (filesToAdd.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(filesToAdd.map(async f => {
        const compressed = await compressImage(f, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], f.name, { type: compressed.mime });
        
        return {
          id: Math.random().toString(36).substr(2, 9),
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime,
          status: 'pending' as const
        };
      }));

      setImages(prev => {
        const next = [...prev, ...processed];
        if (!selectedImageId && next.length > 0) {
          setSelectedImageId(next[0].id);
        }
        return next;
      });
    } catch (err) {
      console.error('File processing failed:', err);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files));
  };

  const removeImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      const next = prev.filter(i => i.id !== id);
      if (selectedImageId === id) {
        setSelectedImageId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };
  
  const resetDiagnosis = (id: string) => {
    setImages(prev => prev.map(p => p.id === id ? { ...p, status: 'pending', diagnosis: undefined, optimizedUrl: undefined } : p));
  };

  // --- Phase 1: Diagnose ---
  const runDiagnosis = async () => {
    if (images.length === 0) return;
    
    setIsProcessing(true);
    setGlobalStatus('Phase 1: AI 正在深度诊断视觉与文案逻辑...');
    
    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];
      if (img.status === 'diagnosed' || img.status === 'done') continue; // Skip already diagnosed
      
      setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'diagnosing' } : p));
      setSelectedImageId(img.id);
      
      try {
        const ai = getAiClient();
        
        const stylePrompt = userStyle 
          ? `STYLE DIRECTION: 核心风格严格遵循用户期望: "${userStyle}"` 
          : `STYLE DIRECTION: 默认采用「温暖治愈系 · 极简高级」风格 (主色: 奶油米白 #F6F2ED, 辅色: 浅暖杏 #F3E4D7, 点缀: 薰衣草紫 #BFAEDC, 强调: 暖橙 #F5B27A)。`;
        
        const prompt = `
ROLE: 你是一位资深亚马逊 A+ Content 视觉策略师 & 欧美电商转化率优化大师，拥有 15 年 DTC 品牌视觉设计经验。

TASK: 对这张亚马逊产品副图进行深度视觉诊断。你需要像审计一个品牌的视觉资产一样，从专业角度分析每个维度的问题。

${stylePrompt}

分析框架（必须逐项深度分析）：

1. **核心场景识别**: 
   - 这张图的展示目的是什么？（尺寸说明/功能演示/使用场景/细节特写/对比图/成分说明）
   - 当前的图片能否在 3 秒内让买家理解核心卖点？

2. **构图与信息层级** (权重 25%):
   - 产品是否是绝对的视觉中心？占比是否合理（建议 40-60%）？
   - 信息层级是否清晰：主标题 → 产品 → 辅助说明？
   - 是否存在视觉噪音（太多箭头、线条、文字堆叠）？

3. **文案与排版** (权重 25%):
   - 文字量是否过多？（欧美审美倾向 less is more，每个区域不超过 5-8 个单词）
   - 是否有"说明书感"（过度技术化、缺乏情感价值）？
   - 字体选择是否现代、高级？（避免圆体、手写体、装饰性字体）
   - 中英文混排是否不专业？

4. **视觉风格与一致性** (权重 25%):
   - 图标/插画是否廉价？（彩色卡通图标 = 低端感）
   - 配色是否统一协调？是否有超过 3 种主色？
   - 背景是否干净高级？（灰暗/杂乱 = 扣分）

5. **转化心理学** (权重 25%):
   - 是否能激发购买欲望？是否有情感价值（安全感/治愈感/高级感）？
   - 是否有竞品差异化的视觉亮点？
   - CTA（行动号召）是否隐含在设计中？

输出要求：
1. overall_score 必须严格打分，不要客气。60分以下 = 需要重做，60-75 = 及格但有明显问题，75-85 = 良好，85+ = 优秀。
2. issues 数组必须包含 3-6 个具体问题，每个问题的 suggestion 必须是可执行的具体指令（不要说"优化一下"，要说"将标题字号放大到 48px，居中对齐，使用 Inter Bold"）。
3. layout_suggestion 必须给出具体的空间布局指令（例如"采用上 40% 主图 + 中 20% 标题区 + 下 40% 三列图标网格"）。
4. copy_suggestion 的 headline 必须精炼到 2-4 个英文单词，subheadline 不超过 8 个单词，features 不超过 4 个。
5. style_direction 必须给出具体的视觉替换指令。

你必须返回一段严格的 JSON，格式如下：
\`\`\`json
{
  "scene_type": "尺寸与细节展示图",
  "overall_score": 65,
  "issues": [
    { "category": "构图", "problem": "产品占比不到20%，信息分散", "suggestion": "将产品居中放大至画面50%，移除多余装饰元素" },
    { "category": "文案", "problem": "中英文混排，文字过多有说明书感", "suggestion": "全部改为英文，标题精简为3个单词，副标题不超过8个单词" },
    { "category": "视觉", "problem": "使用了彩色卡通图标，颜色不统一", "suggestion": "替换为统一的1px细线灰色图标，配色限定在奶油白+暖杏色" }
  ],
  "layout_suggestion": "上40%放大产品居中展示 → 中20%标题区(Inter Bold 48px) → 下40%三列极简图标+文字",
  "copy_suggestion": { 
    "headline": "Perfect Size", 
    "subheadline": "Designed to be hugged", 
    "features": ["12 inch tall", "Ultra Soft Fill", "Machine Washable"] 
  },
  "style_direction": "移除所有彩色插画Icon，改用统一的1px细线极简Icon(#9CA3AF)。背景改为纯净奶油白(#F6F2ED)。所有文字使用Inter字体家族。"
}
\`\`\`
只输出 JSON 代码块，不要包含任何其他文字。
`;
        
        const response = await generateContentWithAnalysisFallback(ai, {
          model: thinkingModel,
          contents: { parts: [
            { inlineData: { mimeType: img.mime, data: img.base64 } },
            { text: prompt }
          ] }
        });
        
        let text = response.text || "{}";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const result: DiagnosisResult = JSON.parse(text);
        
        updatedImages[i] = { ...img, diagnosis: result, status: 'diagnosed' };
        setImages(prev => prev.map(p => p.id === img.id ? updatedImages[i] : p));
        
      } catch (err) {
        console.error("Diagnosis failed for image", img.id, err);
        updatedImages[i] = { ...img, status: 'error', error: getErrorMessage(err) };
        setImages(prev => prev.map(p => p.id === img.id ? updatedImages[i] : p));
      }
    }
    
    setIsProcessing(false);
    setGlobalStatus('');
  };

  // --- Phase 2: Generate Optimization ---
  const runGeneration = async () => {
    const imagesToProcess = images.filter(img => img.status === 'diagnosed');
    if (imagesToProcess.length === 0) {
      alert("请先运行AI诊断，或者没有待优化的图片。");
      return;
    }
    
    setIsProcessing(true);
    setGlobalStatus('Phase 2: 正在基于欧美高转化逻辑重新生成副图...');
    
    for (const img of imagesToProcess) {
      setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'generating' } : p));
      setSelectedImageId(img.id);
      
      try {
        const compressed = { base64: img.base64, mime: img.mime };
        const diag = img.diagnosis!;
        
        const styleContext = userStyle 
          ? `SPECIFIC USER STYLE INSPIRATION: "${userStyle}". Ensure this highly influences the color palette, lighting, and overall atmosphere.` 
          : `COLOR PHILOSOPHY: Use a vibrant, bright, premium, and warm aesthetic. Background must be a clean, bright creamy white (#F6F2ED) or very soft warm apricot (#F3E4D7). ABSOLUTELY NO muddy, dark, or greyish backgrounds. The lighting must feel natural, soft, and inviting like a sunlit cozy room.`;
        
        const prompt = `
[AMAZON SECONDARY IMAGE OPTIMIZATION - HIGH CONVERSION DESIGN]
TASK: Redesign this Amazon product image based on expert conversion strategy.
IMAGE PURPOSE: ${diag.scene_type}
${styleContext}

EXPERT LAYOUT & COPY RESTRUCTURE:
Layout Instruction: ${diag.layout_suggestion}
Headline to use: "${diag.copy_suggestion.headline}"
Subheadline: "${diag.copy_suggestion.subheadline}"
Key Features: ${diag.copy_suggestion.features.join(', ')}

VISUAL FIXES:
${diag.issues.map(i => `- ${i.suggestion}`).join('\n')}
- STRICT STYLE RULE: ${diag.style_direction}
- STRICT RULE (PRODUCT FIDELITY): DO NOT alter the physical appearance, shape, design, or details of the core product. Keep the product EXACTLY as it appears in the original image. Only change the layout, background, and typography.
- STRICT RULE (TEXT): ALL TEXT ON THE IMAGE MUST BE IN ENGLISH. Completely replace any existing Chinese text in the original image with the provided English Headline and Features. Do NOT generate any Chinese characters or non-English text.
- STRICT RULE (LAYOUT & TYPOGRAPHY): Apply a modern, airy Apple-style grid layout with generous negative space around the product. Typography must be highly legible, modern sans-serif. Do NOT clutter the image. Text should be neatly aligned and must not overlap the product.

${guidance ? `USER GUIDANCE: ${guidance}` : ''}
`;
        const resUrls = await generateImageToImage(
          [{ base64: compressed.base64, mimeType: compressed.mime }],
          prompt,
          {
            aspectRatio: outputAspectRatio,
            resolution: resolution,
            modelId: selectedModel,
            negativePrompt: 'chinese text, non-english text, altered product, deformed product, different product design, cluttered text, cheap illustration, cartoon icons, busy background, messy layout, hard shadows, ugly typography, instruction manual look',
            workflowHint: 'listing-optimization'
          }
        );
        
        if (resUrls && resUrls.length > 0) {
          setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'done', optimizedUrl: resUrls[0] } : p));
          await saveGeneratedProject({
            type: 'MARKETING',
            generated: [resUrls[0]],
            original: [`data:${compressed.mime};base64,${compressed.base64}`],
            prompt,
            params: {
              source: 'DollFactory/DollDesignOptimizeTab',
              model: selectedModel,
              thinkingModel,
              aspectRatio: outputAspectRatio,
              resolution,
              sceneType: diag.scene_type,
              score: diag.overall_score
            }
          });
        } else {
          throw new Error("No image generated");
        }
        
      } catch (err) {
        console.error("Generation failed for image", img.id, err);
        setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', error: getErrorMessage(err) } : p));
      }
    }
    
    setIsProcessing(false);
    setGlobalStatus('');
  };

  const selectedImage = images.find(i => i.id === selectedImageId) || images[0];

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#FAFAFA] text-slate-800 font-sans">
      {/* Left Control Panel */}
      <div className="w-full md:w-1/3 lg:w-[500px] flex flex-col border-r border-gray-200 bg-white overflow-y-auto shadow-sm z-10">
        <div className="p-6 flex-1 space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#F5B27A]">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Listing Optimizer</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-800">玩偶设计优化</h3>
            <p className="text-xs leading-5 text-slate-500">
              基于欧美极简审美与亚马逊高转化逻辑，一键诊断并重绘您的副图。解决信息散乱、视觉廉价等问题。
            </p>
          </div>

          {/* Upload Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">1. 上传待优化副图</h3>
              <span className="text-[10px] text-slate-500 font-medium">{images.length}/{MAX_IMAGES} 张</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {isProcessingImages ? (
                <div className="col-span-3 aspect-[3/1] rounded-xl border-2 border-dashed border-[#F5B27A]/50 bg-[#F5B27A]/5 flex items-center justify-center gap-3 animate-pulse">
                   <Loader2 className="w-5 h-5 animate-spin text-[#F5B27A]" />
                   <span className="text-xs font-bold text-[#F5B27A] uppercase tracking-wider">正在深度优化图片...</span>
                </div>
              ) : (
                <>
                  {images.map((img, i) => (
                    <div 
                      key={img.id}
                      onClick={() => setSelectedImageId(img.id)}
                      className={`relative aspect-square rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${selectedImageId === img.id ? 'border-[#F5B27A] shadow-md ring-2 ring-[#F5B27A]/20' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <img src={img.url} className="w-full h-full object-cover" alt="upload" />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                        图{i+1}
                      </div>
                      <button 
                        onClick={(e) => removeImage(img.id, e)}
                        className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors backdrop-blur-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      
                      {/* Status Indicator */}
                      {img.status !== 'pending' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                          <div className={`h-full ${img.status === 'done' ? 'bg-green-500' : img.status === 'error' ? 'bg-red-500' : 'bg-[#F5B27A] animate-pulse'} w-full`}></div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {images.length < MAX_IMAGES && (
                    <label 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-[#F5B27A]/5 hover:border-[#F5B27A]/50 transition-all cursor-pointer group"
                    >
                      <input type="file" className="hidden" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} accept="image/*" multiple />
                      <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#F5B27A] transition-colors mb-1.5" />
                      <span className="text-[10px] font-medium text-gray-500">点击/拖拽</span>
                    </label>
                  )}
                </>
              )}
            </div>
            
          </div>

          <hr className="border-gray-100" />

          {/* Style & Settings */}
          <div className="space-y-6">
            {/* User Style Direction */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">2. 视觉灵感与风格期望</h3>
              <p className="text-[10px] text-slate-500 mb-1">输入您想要的风格、灵感或者特定元素，Agent 会分析并融入优化中（留空则默认使用极简治愈风）。</p>
              <textarea
                rows={3}
                value={userStyle}
                onChange={(e) => setUserStyle(e.target.value)}
                placeholder="例如：偏母婴安全感、像无印良品一样的高级感、想要赛博朋克风、背景是温馨的壁炉..."
                className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-[#F5B27A] focus:border-[#F5B27A] outline-none placeholder-gray-300 resize-none transition-all"
              />
            </div>

            {/* Model Selection UI */}
            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Cpu className="w-4 h-4" />
                <h3 className="text-sm font-semibold">模型选择</h3>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setThinkingModel('gemini-3.1-flash-lite-preview')}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    thinkingModel === 'gemini-3.1-flash-lite-preview'
                      ? 'bg-[#FDF4FF] text-[#9333EA] border border-[#D8B4FE]'
                      : 'bg-white text-slate-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  3.1 Flash (极速)
                </button>
                <button
                  onClick={() => setThinkingModel('gpt-5.4')}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    thinkingModel === 'gpt-5.4'
                      ? 'bg-[#FDF4FF] text-[#9333EA] border border-[#D8B4FE]'
                      : 'bg-white text-slate-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  GPT-5.4 (推荐)
                </button>
              </div>
            </div>

            {/* Image Model Selection UI */}
            <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-600">
                <ImageIcon className="w-4 h-4" />
                <h3 className="text-sm font-semibold">生图模型</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedModel('gpt-image-2')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedModel === 'gpt-image-2'
                      ? 'bg-[#FDF4FF] text-[#9333EA] border border-[#D8B4FE]'
                      : 'bg-white text-slate-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  GPT-Image 2
                </button>
                <button
                  onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedModel === 'gemini-3.1-flash-image-preview'
                      ? 'bg-[#FDF4FF] text-[#9333EA] border border-[#D8B4FE]'
                      : 'bg-white text-slate-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  3.1 Flash
                </button>
                <button
                  onClick={() => setSelectedModel('nano-banana-pro')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedModel === 'nano-banana-pro'
                      ? 'bg-[#FDF4FF] text-[#9333EA] border border-[#D8B4FE]'
                      : 'bg-white text-slate-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Nano Banana
                </button>
              </div>
            </div>

            {/* Aspect Ratio Selection */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase">输出画幅</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: AspectRatio.SQUARE, label: '副图', ratio: '1:1', icon: <ShoppingCart className="w-4 h-4" /> },
                  { id: AspectRatio.LANDSCAPE_16_9, label: 'A+', ratio: '16:9', icon: <Sparkles className="w-4 h-4" /> },
                  { id: AspectRatio.PORTRAIT_3_4, label: '社媒买家秀', ratio: '3:4', icon: <Smartphone className="w-4 h-4" /> }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setOutputAspectRatio(item.id)}
                    className={`flex flex-col items-center justify-center py-3 rounded-2xl border transition-all ${
                      outputAspectRatio === item.id
                        ? 'bg-[#FDF4FF] border-[#D8B4FE] text-[#9333EA] shadow-sm'
                        : 'bg-white border-gray-100 text-slate-500 hover:border-gray-200'
                    }`}
                  >
                    <div className={`${outputAspectRatio === item.id ? 'text-[#9333EA]' : 'text-slate-400'} mb-1.5`}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[9px] opacity-60 font-medium">{item.ratio}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Settings */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase">清晰度</h3>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ImageResolution)}
                className="w-full bg-white border border-gray-100 rounded-xl py-2.5 px-3 text-xs outline-none focus:border-[#F5B27A] shadow-sm"
              >
                <option value={ImageResolution.RES_1K}>1K 标清</option>
                <option value={ImageResolution.RES_2K}>2K 高清</option>
                <option value={ImageResolution.RES_4K}>4K 极致 (推荐)</option>
              </select>
            </div>

            {/* Guidance */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase">自定义补充要求 (可选)</h3>
              <textarea
                rows={2}
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder="例如：强调面料丝滑感、去掉背景植物..."
                className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-[#F5B27A] focus:border-[#F5B27A] outline-none placeholder-gray-400 resize-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons (Sticky Bottom) */}
        <div className="p-5 border-t border-gray-200 bg-white sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-3">
            <button
              onClick={runDiagnosis}
              disabled={isProcessing || images.length === 0}
              className="w-full py-3 bg-[#F6F2ED] text-slate-700 border border-[#F3E4D7] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#F3E4D7] transition-all disabled:opacity-50"
            >
              {isProcessing && globalStatus.includes('Phase 1') ? (
                <><Loader2 className="w-4 h-4 animate-spin text-[#F5B27A]" /> 诊断中...</>
              ) : (
                <><LayoutGrid className="w-4 h-4 text-[#F5B27A]" /> 1. 执行 AI 视觉诊断</>
              )}
            </button>
            
            <button
              onClick={runGeneration}
              disabled={isProcessing || !images.some(i => i.status === 'diagnosed')}
              className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-900 shadow-md shadow-slate-800/20 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {isProcessing && globalStatus.includes('Phase 2') ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 生成优化版...</>
              ) : (
                <><Sparkle className="w-4 h-4" /> 2. 一键生成优化副图</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Display Area */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
        {/* Status Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
             <Loader2 className="w-12 h-12 text-[#F5B27A] animate-spin mb-4" />
             <div className="bg-white px-6 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#F5B27A] animate-ping" />
                <span className="font-bold text-slate-700 text-sm">{globalStatus}</span>
             </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center opacity-40 text-center select-none p-8 max-w-sm">
            <LayoutGrid className="w-20 h-20 mb-6 text-slate-300" />
            <h3 className="text-xl font-bold mb-2">等待上传副图</h3>
            <p className="text-xs leading-relaxed">上传现有的亚马逊副图，AI 将提供深度的视觉排版诊断，并重绘为欧美高转化率的极简风格。</p>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full space-y-8 pb-20">
            {images.map((img, idx) => (
              <div 
                key={img.id} 
                className={`flex flex-col bg-white rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden ${selectedImageId === img.id ? 'border-[#F5B27A] ring-4 ring-[#F5B27A]/10' : 'border-gray-200'}`}
              >
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                    <h2 className="font-bold text-slate-800">
                      {img.diagnosis?.scene_type || `待诊断副图`}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {(img.status === 'diagnosed' || img.status === 'done' || img.status === 'error') && (
                      <button 
                        onClick={() => resetDiagnosis(img.id)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 transition-all text-[10px] font-bold"
                        title="重新分析"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重新分析
                      </button>
                    )}
                    {img.status === 'done' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Optimized</span>}
                    {img.status === 'diagnosed' && <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Diagnosed</span>}
                    {img.status === 'error' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Error</span>}
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-gray-100">
                  {/* Left: Original + Diagnosis */}
                  <div className="flex-1 p-6 flex flex-col gap-6">
                    <div className="flex items-start gap-6">
                      <div 
                        className="w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-50 cursor-zoom-in hover:border-[#F5B27A] transition-colors"
                        onClick={() => setFullscreenImage(img.url)}
                      >
                        <img src={img.url} className="w-full h-full object-cover" alt="original" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">AI 诊断报告</span>
                        </div>
                        
                        {!img.diagnosis ? (
                          <div className="h-20 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            点击左侧「执行 AI 视觉诊断」生成报告
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-end gap-2">
                              <span className="text-3xl font-black text-slate-800 leading-none">{img.diagnosis.overall_score}</span>
                              <span className="text-xs text-slate-500 font-medium mb-1">/ 100 分</span>
                            </div>
                            
                            <div className="space-y-2">
                              {img.diagnosis.issues.map((issue, i) => (
                                <div key={i} className="bg-red-50/50 border border-red-100 p-3 rounded-xl">
                                  <div className="flex gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{issue.category}</span>
                                    <span className="text-xs font-semibold text-slate-800">{issue.problem}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 pl-2 border-l-2 border-red-200 ml-1 mt-1.5">👉 {issue.suggestion}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Copywriting Suggestion Box */}
                    {img.diagnosis && (
                      <div className="bg-[#F6F2ED]/50 border border-[#F3E4D7] rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#F5B27A]" /> 优化文案架构
                        </h4>
                        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                          <h1 className="text-lg font-black text-slate-800">{img.diagnosis.copy_suggestion.headline}</h1>
                          <p className="text-xs text-slate-500 mt-1 font-medium">{img.diagnosis.copy_suggestion.subheadline}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {img.diagnosis.copy_suggestion.features.map((f, fi) => (
                              <span key={fi} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-semibold flex items-center gap-1">
                                <Sparkle className="w-2.5 h-2.5" /> {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Optimized Result */}
                  <div className="flex-1 p-6 flex flex-col bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-[#F5B27A]">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">优化生成结果</span>
                      </div>
                      {img.optimizedUrl && (
                        <a 
                          href={img.optimizedUrl} 
                          download={`optimized-img${idx+1}.png`}
                          className="p-1.5 bg-white text-slate-600 hover:text-slate-900 hover:bg-gray-100 rounded-lg border shadow-sm transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="flex-1 flex items-center justify-center min-h-[300px]">
                      {img.optimizedUrl ? (
                        <div 
                          className="w-full max-w-sm rounded-2xl overflow-hidden shadow-lg border-4 border-white cursor-zoom-in hover:shadow-xl transition-all flex items-center justify-center bg-white"
                          style={{ aspectRatio: outputAspectRatio.replace(':', ' / ') }}
                          onClick={() => setFullscreenImage(img.optimizedUrl!)}
                        >
                          <img src={img.optimizedUrl} className="w-full h-full object-contain" alt="optimized" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center">
                            <Sparkle className="w-6 h-6 text-gray-300" />
                          </div>
                          <p className="text-xs font-medium">点击右侧「生成优化副图」获取结果</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" 
          onClick={() => setFullscreenImage(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-[#F5B27A] transition-colors">
            <X className="w-8 h-8" />
          </button>
          <img 
            src={fullscreenImage} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
            alt="Fullscreen view" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default DollDesignOptimizeTab;
