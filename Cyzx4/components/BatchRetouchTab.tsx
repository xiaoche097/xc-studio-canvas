import React, { useState, useRef, useEffect } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X, Maximize2, Trash2, CheckCircle2, AlertCircle, Bot, Palette, Store, Aperture } from 'lucide-react';
import { compressImage, getErrorMessage } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';

// --- Prompt Templates ---
const BATCH_RETOUCH_PROMPT = `[ROLE] You are a world-class e-commerce product retouching expert specialized in pure white background photography.
[TASK] Professionally retouch this product photo for a clean, high-end e-commerce look.
[ABSOLUTE CONSTRAINT - GEOMETRY LOCK]
- DO NOT change camera angle, lens height, focal length (same pose, same camera angle, same geometry)
- DO NOT change the subject's orientation, pose, composition or cropping
- DO NOT change the product's design, proportions, or any part positions
- ONLY modify: lighting, color, sharpness, background, material texture, cleanup

[BACKGROUND & ENVIRONMENT - CRITICAL]
- Background: MANDATORY PURE WHITE (#FFFFFF). 
- REMOVAL: You MUST delete ALL environment details. Remove all floor, table, desk, wooden surfaces, horizon lines, wall textures, or studio props.
- FLOATING EFFECT: The product should appear as if it is floating in a perfectly clean, infinite white void. No ground plane should be visible.
- SHADOW: ONLY a very subtle, soft contact shadow directly under the product base (Ambient Occlusion). NO long shadows, NO shadows hitting a 'floor' surface.

[REFINEMENT TARGETS]
- Lighting: Soft even studio lighting, high-key, clean highlights.
- Texture: Enhance material texture clarity (plush fiber more visible but natural, not greasy).
- Color: Natural color correction, vibrant but realistic.
- Cleanup: Remove noise, dust, dirt, color cast, and any distracting elements from the original background.
- Output: Premium e-commerce hero image quality, crisp, authentic, 100% PURE WHITE BACKGROUND.`;

const INTENSITY_CONFIG = {
  conservative: {
    name: '保守', desc: '仅提升清晰度和光影',
    prefix: '在保留原图整体构图、主体和色调的基础上，轻微调整为',
    suffix: '\n[INTENSITY: CONSERVATIVE] Only do minor enhancement, keep 90%+ of original color and atmosphere.'
  },
  standard: {
    name: '平衡', desc: '全面对齐参考图风格',
    prefix: '参考原图的核心元素和构图逻辑，以',
    suffix: ''
  },
  aggressive: {
    name: '激进', desc: '最大程度靠近参考图效果',
    prefix: '完全以',
    suffix: '\n[INTENSITY: AGGRESSIVE] Boldly align with reference image style. Allow significant adjustments.'
  }
};

const STYLE_PRESETS = [
  { id: 'vsco', label: 'IG 胶片', icon: '📸', desc: 'VSCO质感、低对比、柔和颗粒', prompt: 'Instagram VSCO film aesthetic, soft muted tones, subtle film grain, natural lifestyle lighting, high-end editorial feel.' },
  { id: 'creamy', label: '奶油极简', icon: '🍦', desc: '暖白调、大地色、柔光氛围', prompt: 'Creamy minimalist aesthetic, beige and neutral tones, soft diffused light, clean and elegant composition, high-end lifestyle.' },
  { id: 'moody', label: '高街冷峻', icon: '🌑', desc: '高对比、深阴影、冷色调', prompt: 'High street moody style, deep shadows, high contrast, cool color temperature, dramatic cinematic lighting, edgy vibe.' },
  { id: 'y2k', label: '千禧闪光', icon: '⚡', desc: '直接闪光、高饱和、复古感', prompt: 'Y2K aesthetic, harsh direct flash photography, vibrant colors, retro digital camera look, nostalgic early 2000s energy.' },
  { id: 'golden', label: '落日余晖', icon: '🌇', desc: '金黄色、暖光、梦幻光圈', prompt: 'Golden hour aesthetic, warm glowing light, long shadows, dreamy bokeh, sun-drenched atmosphere.' },
  { id: 'oldmoney', label: '老钱风', icon: '💼', desc: '低调奢华、质感面料、经典布光', prompt: 'Old money aesthetic, quiet luxury, high-end materials, classic elegant lighting, timeless sophisticated vibe.' },
  { id: 'jp', label: '治愈生活', icon: '🍵', desc: '低饱和、自然光、空气感', prompt: 'Healing lifestyle aesthetic, low saturation, airy and light, natural daylight, soft texture, peaceful atmosphere.' },
  { id: 'flash', label: '随性抓拍', icon: '🤳', desc: '直闪快照、动感、真实感', prompt: 'Candid flash snapshot, high motion, authentic street vibe, direct flash, casual but stylish composition.' }
];

const SCENE_PRESETS = [
  { id: 'living', label: '简约客厅', icon: '🏠', desc: '白墙、木质家具、自然光' },
  { id: 'cafe', label: '咖啡馆', icon: '☕', desc: '木桌、暖光、生活气息' },
  { id: 'studio', label: '专业影棚', icon: '📸', desc: '纯色背景、可控布光' },
  { id: 'gallery', label: '艺术展厅', icon: '🖼️', desc: '白盒子空间、聚光照明' },
  { id: 'city', label: '都市街角', icon: '🌆', desc: '建筑线条、城市光影' },
  { id: 'forest', label: '自然森林', icon: '🌲', desc: '绿色植被、斑驳光影' }
];

const LIGHTING_PRESETS = [
  { id: 'morning', label: '清晨侧光', icon: '🌅', desc: '金色、长影、清新感' },
  { id: 'afternoon', label: '午后漫射', icon: '☀️', desc: '柔和、均匀、舒适感' },
  { id: 'dusk', label: '黄昏暖光', icon: '🌆', desc: '橙红、浪漫、戏剧性' },
  { id: 'softbox', label: '商业柔光', icon: '💡', desc: '均匀柔和、商业感' },
  { id: 'neon', label: '霓虹光效', icon: '🌈', desc: '彩色、赛博感、夜生活' }
];

interface RetouchResult {
  sourceUrl: string;
  resultUrl: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const BatchRetouchTab: React.FC = () => {
  const [sources, setSources] = useState<{file: File, url: string, base64: string, mime: string}[]>([]);
  const [refs, setRefs] = useState<{file: File, url: string, base64: string, mime: string}[]>([]);
  const [results, setResults] = useState<RetouchResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [guidance, setGuidance] = useState('');
  const [intensity, setIntensity] = useState<keyof typeof INTENSITY_CONFIG>('standard');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('yunwu_default_model') || 'gemini-3.1-flash-image-preview';
  });
  const [preview, setPreview] = useState<{ src: string, title: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [selectedLighting, setSelectedLighting] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    composition: string;
    lighting: string;
    scene: string;
    style: string;
    intensity_rec: keyof typeof INTENSITY_CONFIG;
  } | null>(null);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger analysis when first source image is uploaded
  useEffect(() => {
    if (sources.length > 0 && !analysisResult && !isAnalyzing) {
      handleAiAnalysis();
    }
  }, [sources.length]);

  const handleSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const nextFiles = files.slice(0, 10 - sources.length);
    if (nextFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(nextFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], file.name, { type: compressed.mime });
        return {
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime
        };
      }));
      setSources(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Source upload processing failed:', err);
    } finally {
      setIsProcessingImages(false);
      e.target.value = '';
    }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const nextFiles = files.slice(0, 3 - refs.length);
    if (nextFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(nextFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], file.name, { type: compressed.mime });
        return {
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime
        };
      }));
      setRefs(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Ref upload processing failed:', err);
    } finally {
      setIsProcessingImages(false);
      e.target.value = '';
    }
  };

  const handleSourceDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const nextFiles = imageFiles.slice(0, 10 - sources.length);
    if (nextFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(nextFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], file.name, { type: compressed.mime });
        return {
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime
        };
      }));
      setSources(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Source drop processing failed:', err);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleRefDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const nextFiles = imageFiles.slice(0, 3 - refs.length);
    if (nextFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(nextFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], file.name, { type: compressed.mime });
        return {
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime
        };
      }));
      setRefs(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Ref drop processing failed:', err);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter((f): f is File => f !== null);

    const nextFiles = files.slice(0, 10 - sources.length);
    if (nextFiles.length === 0) return;

    setIsProcessingImages(true);
    try {
      const processed = await Promise.all(nextFiles.map(async file => {
        const compressed = await compressImage(file, 2048, 0.9);
        const res = await fetch(`data:${compressed.mime};base64,${compressed.base64}`);
        const blob = await res.blob();
        const compressedFile = new File([blob], file.name, { type: compressed.mime });
        return {
          file: compressedFile,
          url: URL.createObjectURL(compressedFile),
          base64: compressed.base64,
          mime: compressed.mime
        };
      }));
      setSources(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Paste processing failed:', err);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const removeSource = (index: number) => {
    setSources(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };

  const removeRef = (index: number) => {
    setRefs(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleAiAnalysis = async () => {
    if (sources.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { generateText } = await import('../services/geminiService');
      const sample = sources[0];
      
      const styleInstruction = [
        selectedStyle ? `风格偏好: ${STYLE_PRESETS.find(s => s.id === selectedStyle)?.label}` : '',
        selectedScene ? `场景偏好: ${SCENE_PRESETS.find(s => s.id === selectedScene)?.label}` : '',
        selectedLighting ? `光影偏好: ${LIGHTING_PRESETS.find(l => l.id === selectedLighting)?.label}` : '',
        guidance.trim() ? `用户指令: ${guidance.trim()}` : ''
      ].filter(Boolean).join('; ') || '自动分析并优化画质';

      const analysisPrompt = `
你是一个专业的图像分析与提示词优化专家。

## 任务
分析用户上传的图片，结合用户的风格调整需求，输出适合 Gemini 图像生成的4段式提示词。

## 用户风格需求
${styleInstruction}

## 输出要求
请用自然语言段落描述，每段2-3句话，避免碎片化关键词堆叠：

**【构图与主体】**
描述画面的视角、景别、主体位置，以及主体的核心特征和动作。结合用户需求调整构图方向。

**【光影与氛围】**
描述光源类型、光线方向、整体色温，以及传递的情绪氛围。根据用户风格需求调整氛围基调。

**【场景与材质】**
描述背景环境、前景元素、主要材质的质感和纹理细节。保留原图精华，优化细节表达。

**【风格指令】**
用3-5个关键词概括目标风格，并给出明确的生成方向指令。

## 风格强度建议
请根据图片特征和用户需求，推荐适合的强度模式：conservative (保守), standard (平衡), aggressive (激进)。

## 输出格式
必须返回严格的 JSON 格式：
{
  "composition": "构图与主体描述...",
  "lighting": "光影与氛围描述...",
  "scene": "场景与材质描述...",
  "style": "风格关键词描述...",
  "intensity_rec": "standard"
}
`;

      const response = await generateText(
        [{ base64: sample.base64, mimeType: sample.mime }],
        analysisPrompt,
        'gemini-3.1-flash-lite-preview'
      );

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setAnalysisResult(data);
        setIntensity(data.intensity_rec);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadAll = async () => {
    for (let i = 0; i < results.length; i++) {
      if (results[i].resultUrl) {
        const a = document.createElement('a');
        a.href = results[i].resultUrl!;
        a.download = `batch-retouch-${i + 1}-${Date.now()}.png`;
        a.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }
  };

  const handleBatchGenerate = async () => {
    if (sources.length === 0) return alert('请上传至少一张原图');
    
    setIsGenerating(true);
    setProgress(0);
    setResults(sources.map(s => ({ sourceUrl: s.url, resultUrl: null, status: 'pending' })));

    try {
      const { generateImageToImage, analyzeReferenceEffect } = await import('../services/geminiService');
      
      let styleContext = '';
      if (refs.length > 0) {
        setStatusMessage('正在分析参考图风格...');
        const styleAnalysis = await analyzeReferenceEffect(refs.map(r => ({ base64: r.base64, mimeType: r.mime })));
        if (styleAnalysis?.extracted_style) {
          styleContext = `\n\n=== TARGET STYLE ===\n${styleAnalysis.extracted_style}`;
        }
      }

      for (let i = 0; i < sources.length; i++) {
        setStatusMessage(`正在处理第 ${i + 1}/${sources.length} 张图片...`);
        setResults(prev => {
          const next = [...prev];
          next[i].status = 'processing';
          return next;
        });

        const source = sources[i];
        const compressed = { base64: source.base64, mime: source.mime };
        
        let intensityPrefix = '';
        const targetStyle = selectedStyle ? STYLE_PRESETS.find(s => s.id === selectedStyle)?.label : '指定';
        const config = INTENSITY_CONFIG[intensity];
        
        if (intensity === 'conservative') {
          intensityPrefix = `在保留原图整体构图、主体和色调的基础上，轻微调整为${targetStyle}风格。`;
        } else if (intensity === 'standard') {
          intensityPrefix = `参考原图的核心元素和构图逻辑，以${targetStyle}风格重新诠释。`;
        } else {
          intensityPrefix = `完全以${targetStyle}风格重新创作，仅保留原图的主体概念和基本构图。`;
        }

        let finalPrompt = '';
        if (analysisResult) {
          finalPrompt = `
${intensityPrefix}

请根据以下描述生成一张图片：

【构图与主体】
${analysisResult.composition}

【光影与氛围】
${analysisResult.lighting}

【场景与材质】
${analysisResult.scene}

风格要求：${analysisResult.style}
`;
        } else {
          finalPrompt = BATCH_RETOUCH_PROMPT;
          finalPrompt += config.suffix;
          if (styleContext) finalPrompt += styleContext;
          if (guidance.trim()) finalPrompt += `\n\n[USER REQUEST]: ${guidance.trim()}`;
        }

        const result = await generateImageToImage(
          [{ base64: compressed.base64, mimeType: compressed.mime }],
          finalPrompt,
          {
            aspectRatio,
            resolution,
            modelId: selectedModel,
            negativePrompt: "floor, table, wooden surface, desk, environment, background texture, wall, window, room details, gray, shadow cast on floor, long shadow, floating artifacts, messy edges, horizon line, ground plane, furniture, studio equipment, reflection on floor",
            workflowHint: 'doll-retouching' as any
          }
        );

        if (result && result.length > 0) {
          setResults(prev => {
            const next = [...prev];
            next[i].resultUrl = result[0];
            next[i].status = 'done';
            return next;
          });
        } else {
          throw new Error('生成失败');
        }
        
        setProgress(Math.round(((i + 1) / sources.length) * 100));
      }
      setStatusMessage('批量精修全部完成！');
    } catch (err) {
      console.error(err);
      setStatusMessage('发生错误，处理已停止');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text overflow-hidden"
      onPaste={handlePaste}
    >
      {/* Sidebar Controls */}
      <div className="w-full md:w-1/3 lg:w-[500px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-8 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-wider">Batch Retouch</span>
            </div>
            <h3 className="text-xl font-black text-pastel-text">AI 洗图 (批量精修)</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传多张底图进行批量商业级精修。AI 保持产品角度与结构不变，仅提升材质质感与光影，强制纯白背景。
            </p>
          </div>

          {/* Source Upload */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex justify-between text-pastel-text">
              <span>原图上传 ({sources.length}/10)</span>
              <span className="text-xs text-pastel-muted font-normal">最多10张</span>
            </h3>
            <div 
              className="grid grid-cols-5 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleSourceDrop}
            >
              {isProcessingImages ? (
                <div className="col-span-5 aspect-[5/1] rounded-lg border-2 border-dashed border-pastel-highlight flex items-center justify-center bg-pastel-highlight/5 gap-2 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-pastel-highlight" />
                  <span className="text-[10px] text-pastel-highlight font-black uppercase">正在优化图片...</span>
                </div>
              ) : (
                <>
                  {sources.map((src, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden bg-white group">
                      <img src={src.url} className="w-full h-full object-cover" />
                      <button onClick={() => removeSource(idx)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  {sources.length < 10 && (
                    <button 
                      onClick={() => sourceInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-pastel-border flex flex-col items-center justify-center hover:border-pastel-highlight transition-colors bg-white/50"
                    >
                      <Upload className="w-4 h-4 text-pastel-muted" />
                      <span className="text-[8px] mt-1">添加</span>
                    </button>
                  )}
                </>
              )}
            </div>
            <input type="file" multiple hidden ref={sourceInputRef} onChange={handleSourceUpload} accept="image/*" />
            
            {sources.length > 0 && isAnalyzing && !analysisResult && (
              <div className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-xl flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-wider">Agent 正在分析产品特征...</span>
              </div>
            )}

            {analysisResult && (
              <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 border border-indigo-500/20 relative overflow-hidden group shadow-sm">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Bot className="w-12 h-12 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-indigo-500 text-white shadow-md shadow-indigo-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Agent 策略分析报告</span>
                  <button onClick={() => setAnalysisResult(null)} className="ml-auto p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500/70 uppercase">
                      <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                      构图与主体
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-700 font-medium bg-white/40 p-2 rounded-lg border border-white/60">{analysisResult.composition}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-purple-500/70 uppercase">
                      <div className="w-1 h-3 bg-purple-500 rounded-full"></div>
                      光影与氛围
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-700 font-medium bg-white/40 p-2 rounded-lg border border-white/60">{analysisResult.lighting}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-pink-500/70 uppercase">
                      <div className="w-1 h-3 bg-pink-500 rounded-full"></div>
                      场景与材质
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-700 font-medium bg-white/40 p-2 rounded-lg border border-white/60">{analysisResult.scene}</p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-indigo-500/10 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {analysisResult.style.split('、').slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 text-[8px] font-black uppercase">{s}</span>
                      ))}
                    </div>
                    <div className="text-[9px] text-indigo-600 font-bold italic flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      建议: {INTENSITY_CONFIG[analysisResult.intensity_rec].name}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ref Upload */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex justify-between text-pastel-text">
              <span>参考标准图 ({refs.length}/3)</span>
              <span className="text-[10px] text-pastel-muted">提取风格</span>
            </h3>
            <div 
              className="grid grid-cols-3 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleRefDrop}
            >
              {refs.map((ref, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden bg-white group">
                  <img src={ref.url} className="w-full h-full object-cover" />
                  <button onClick={() => removeRef(idx)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {refs.length < 3 && (
                <button 
                  onClick={() => refInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-pastel-border flex flex-col items-center justify-center hover:border-pastel-highlight transition-colors bg-white/50"
                >
                  <Sparkles className="w-4 h-4 text-pastel-muted" />
                  <span className="text-[8px] mt-1">参考图</span>
                </button>
              )}
            </div>
            <input type="file" multiple hidden ref={refInputRef} onChange={handleRefUpload} accept="image/*" />
          </div>

          {/* New Optimized Settings Section */}
          <div className="space-y-6">
            {/* Style Presets */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" /> 风格偏好 (Photography Style)
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all duration-200 group ${selectedStyle === style.id ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-pastel-border bg-white hover:border-indigo-300'}`}
                  >
                    <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{style.icon}</span>
                    <span className={`text-[9px] font-black ${selectedStyle === style.id ? 'text-indigo-600' : 'text-pastel-text'}`}>{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scene & Lighting */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                  <Store className="w-3 h-3" /> 场景 (Scene)
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {SCENE_PRESETS.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${selectedScene === scene.id ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-pastel-border bg-white text-pastel-muted hover:bg-gray-50'}`}
                    >
                      <span>{scene.icon}</span>
                      <span className="truncate">{scene.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                  <Aperture className="w-3 h-3" /> 光影 (Lighting)
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {LIGHTING_PRESETS.map((light) => (
                    <button
                      key={light.id}
                      onClick={() => setSelectedLighting(selectedLighting === light.id ? null : light.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${selectedLighting === light.id ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-pastel-border bg-white text-pastel-muted hover:bg-gray-50'}`}
                    >
                      <span>{light.icon}</span>
                      <span className="truncate">{light.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Intensity Controller */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-orange-500" /> 风格强度 (Intensity)
              </h3>
              <div className="bg-white rounded-2xl border border-pastel-border p-1 flex gap-1">
                {(Object.entries(INTENSITY_CONFIG) as [keyof typeof INTENSITY_CONFIG, any][]).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => setIntensity(key)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${intensity === key ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-pastel-muted hover:bg-gray-50'}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-pastel-muted px-2 italic">
                {INTENSITY_CONFIG[intensity].desc}: {INTENSITY_CONFIG[intensity].prefix}...
              </p>
            </div>

            {/* Basic Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-pastel-muted uppercase">输出画幅</h3>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-[10px] font-black outline-none focus:border-indigo-500 transition-all">
                  {[AspectRatio.SQUARE, AspectRatio.PORTRAIT_3_4, AspectRatio.PORTRAIT_4_5, AspectRatio.PORTRAIT_2_3, AspectRatio.PORTRAIT_9_16].map(ar => (
                    <option key={ar} value={ar}>{ar}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-pastel-muted uppercase">分辨率</h3>
                <select value={resolution} onChange={e => setResolution(e.target.value as ImageResolution)} className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-[10px] font-black outline-none focus:border-indigo-500 transition-all">
                  <option value={ImageResolution.RES_2K}>2K 高清</option>
                  <option value={ImageResolution.RES_4K}>4K 极致</option>
                </select>
              </div>
            </div>

            {/* Styled Model Selection */}
            <div className="bg-white p-4 rounded-2xl border border-pastel-border shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-pastel-text">
                <Cpu className="w-4 h-4 text-pastel-muted" />
                <span className="text-[10px] font-black uppercase tracking-widest text-pastel-muted">模型选择 (Model)</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                    className={`py-2 rounded-xl border text-[9px] font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-pastel-border text-pastel-muted hover:bg-gray-50'}`}
                  >
                    3.1 Flash (极速)
                  </button>
                  <button
                    onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                    className={`py-2 rounded-xl border text-[9px] font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-pastel-border text-pastel-muted hover:bg-gray-50'}`}
                  >
                    3.0 Pro (推荐)
                  </button>
                </div>
                <button
                  onClick={() => setSelectedModel('gpt-image-2')}
                  className={`w-full py-2 rounded-xl border text-[9px] font-bold transition-all ${selectedModel === 'gpt-image-2' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-pastel-border text-pastel-muted hover:bg-gray-50'}`}
                >
                  Imagen 2.0 (写实精修)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-black text-pastel-muted uppercase tracking-widest">补充需求 (Custom Guidance)</h3>
              <textarea 
                value={guidance} 
                onChange={e => setGuidance(e.target.value)} 
                placeholder="例如：背景再简洁一些，去掉多余杂物..."
                className="w-full bg-white border border-pastel-border rounded-2xl p-4 text-[11px] outline-none h-24 resize-none focus:border-indigo-500 transition-all placeholder:text-gray-300 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-8 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10">
          <button
            onClick={handleBatchGenerate}
            disabled={isGenerating || sources.length === 0}
            className="w-full py-5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {isGenerating ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> {progress}% 处理中</>
            ) : (
              <><Zap className="w-6 h-6" /> 开始批量精修</>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-8 relative flex flex-col">
        {results.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-pastel-muted opacity-40">
            <div className="w-20 h-20 rounded-full border-4 border-dashed border-pastel-border flex items-center justify-center mb-4">
              <ImageIcon className="w-10 h-10" />
            </div>
            <p className="text-lg font-bold">待处理任务列表</p>
            <p className="text-sm">上传原图并点击左侧按钮开始批量精修</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-pastel-text">精修进度</h2>
                <div className="px-3 py-1 rounded-full bg-pastel-highlight/10 text-pastel-highlight text-xs font-bold">
                  {results.filter(r => r.status === 'done').length} / {results.length} 完成
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold text-pastel-muted px-3 py-1 bg-pastel-bg rounded-lg border border-pastel-border flex items-center gap-2">
                  <Loader2 className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  {statusMessage || '等待中...'}
                </div>
                <button 
                  onClick={downloadAll}
                  disabled={results.filter(r => r.status === 'done').length === 0}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white border border-pastel-border text-sm font-bold hover:bg-pastel-bg transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> 批量下载
                </button>
              </div>
            </div>

            {/* Grid Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((res, idx) => (
                <div key={idx} className="bg-white rounded-3xl border border-pastel-border shadow-sm overflow-hidden flex flex-col">
                  <div className="flex-1 relative bg-slate-50 flex items-center justify-center p-4">
                    <div className="grid grid-cols-2 gap-2 w-full h-full">
                      <div className="relative rounded-xl overflow-hidden border border-pastel-border/50">
                        <img src={res.sourceUrl} className="w-full h-full object-cover" alt="source" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-[8px] font-bold">原图</div>
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-pastel-border shadow-md bg-white flex items-center justify-center">
                        {res.status === 'processing' ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-pastel-highlight" />
                            <span className="text-[8px] font-bold text-pastel-highlight">生成中...</span>
                          </div>
                        ) : res.resultUrl ? (
                          <>
                            <img src={res.resultUrl} className="w-full h-full object-cover" alt="result" />
                            <button 
                              onClick={() => setPreview({ src: res.resultUrl!, title: `精修结果 #${idx + 1}` })}
                              className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
                            >
                              <Maximize2 className="w-5 h-5 text-white" />
                            </button>
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-pastel-highlight text-white text-[8px] font-bold shadow-sm">精修图</div>
                          </>
                        ) : res.status === 'error' ? (
                          <div className="flex flex-col items-center text-red-500">
                            <AlertCircle className="w-6 h-6" />
                            <span className="text-[8px] font-bold">错误</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-pastel-muted/50">
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[8px] font-bold">等待队列</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-pastel-border/50 flex justify-between items-center bg-white/80">
                    <span className="text-xs font-bold text-pastel-muted"># {idx + 1} 任务</span>
                    {res.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-4xl bg-white rounded-[40px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-pastel-border flex items-center justify-between">
              <h3 className="text-xl font-black text-pastel-text">{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-pastel-bg rounded-full transition-colors">
                <X className="w-6 h-6 text-pastel-text" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 p-8 flex items-center justify-center">
              <img src={preview.src} className="max-w-full max-h-[70vh] object-contain shadow-xl rounded-lg" alt="preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchRetouchTab;
