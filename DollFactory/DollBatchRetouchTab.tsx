import React, { useState, useRef, useEffect } from 'react';

import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X, Maximize2, Trash2, CheckCircle2, AlertCircle, Bot, Layout, Store, RefreshCw } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';

const PLATFORM_STYLES = [
    { id: 'amazon', label: 'Amazon', icon: '🅰️', desc: '纯白背景 / 极简', prompt: 'Amazon professional main image, pure white background (#FFFFFF), high clarity, centered composition, clean edges, professional studio photography.' },
    { id: 'shein', label: 'SHEIN', icon: '👗', desc: '潮流街拍 / 灵动', prompt: 'SHEIN trendy lifestyle photography, bright natural lighting, youthful vibe, fashionable outdoor or minimalist indoor setting, high-end editorial.' },
    { id: 'temu', label: 'Temu', icon: '🧡', desc: '高饱和 / 抓眼', prompt: 'Temu commercial style, high contrast, vibrant colors, sharp focus, attention-grabbing composition, clean modern commercial setting.' },
    { id: 'tmall', label: '天猫淘宝', icon: '🐈', desc: '高级感 / 质感', prompt: 'Tmall/Taobao premium luxury photography, sophisticated soft lighting, elegant composition, rich textures, high-end commercial studio aesthetic.' },
    { id: 'shopify', label: '独立站', icon: '🛒', desc: '品牌感 / 极简', prompt: 'Minimalist brand photography for independent stores, artistic lighting, soft shadows, clean aesthetic, high-end lifestyle aesthetic.' }
];

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
    suffix: '\n[INTENSITY: CONSERVATIVE] Only do minor enhancement, keep 90%+ of original color and atmosphere.'
  },
  standard: {
    name: '标准', desc: '全面对齐参考图风格',
    suffix: ''
  },
  aggressive: {
    name: '激进', desc: '最大程度靠近参考图效果',
    suffix: '\n[INTENSITY: AGGRESSIVE] Boldly align with reference image style. Allow significant adjustments.'
  }
};

interface RetouchResult {
  sourceUrl: string;
  resultUrl: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const DollBatchRetouchTab: React.FC = () => {
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
  const [selectedPlatform, setSelectedPlatform] = useState<string>('amazon');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('yunwu_default_model') || 'gemini-3.1-flash-image-preview';
  });
  const [preview, setPreview] = useState<{ src: string, title: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    material: string;
    focus: string;
    intensity_rec: keyof typeof INTENSITY_CONFIG;
    prompt_enhancement: string;
  } | null>(null);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // AI Reference Analysis states
  const [refAnalysis, setRefAnalysis] = useState<{
    lighting_analysis: string;
    material_analysis: string;
    overall_atmosphere: string;
  } | null>(null);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);

  // Automatically analyze reference image quality and fabric texture in background
  useEffect(() => {
    const runRefAnalysis = async () => {
      if (refs.length > 0) {
        if (refAnalysis || isAnalyzingRef) return;
        setIsAnalyzingRef(true);
        try {
          const { analyzeReferenceEffect } = await import('../Cyzx4/services/geminiService');
          const sample = refs[0];
          const styleAnalysis = await analyzeReferenceEffect([{ base64: sample.base64, mimeType: sample.mime }]);
          if (styleAnalysis) {
            setRefAnalysis({
              lighting_analysis: styleAnalysis.lighting_analysis || '',
              material_analysis: styleAnalysis.material_analysis || '',
              overall_atmosphere: styleAnalysis.overall_atmosphere || ''
            });
          }
        } catch (e) {
          console.error("Auto reference analysis failed in batch:", e);
        } finally {
          setIsAnalyzingRef(false);
        }
      } else {
        setRefAnalysis(null);
      }
    };
    runRefAnalysis();
  }, [refs.length]);

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
      const { generateText } = await import('../Cyzx4/services/geminiService');
      const sample = sources[0];
      
      const analysisPrompt = `Analyze this product image for commercial retouching. 
      Respond ONLY in JSON format:
      {
        "material": "short description of material",
        "focus": "key focus area for retouching (e.g. fur texture, edge cleanup)",
        "intensity_rec": "conservative" | "standard" | "aggressive",
        "prompt_enhancement": "specific technical keywords for this product"
      }
      Focus on being an expert photo retoucher.`;

      const response = await generateText(
        [{ base64: sample.base64, mimeType: sample.mime }],
        analysisPrompt
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
      const { generateImageToImage, analyzeReferenceEffect } = await import('../Cyzx4/services/geminiService');
      
      let styleContext = '';
      if (refAnalysis) {
        styleContext = `\n\n=== TARGET STYLE ===\n- Lighting: ${refAnalysis.lighting_analysis}\n- Plush Material: ${refAnalysis.material_analysis}\n- Atmosphere: ${refAnalysis.overall_atmosphere}`;
      } else if (refs.length > 0) {
        setStatusMessage('正在分析参考图风格...');
        const styleAnalysis = await analyzeReferenceEffect(refs.map(r => ({ base64: r.base64, mimeType: r.mime })));
        if (styleAnalysis) {
          styleContext = `\n\n=== TARGET STYLE ===\n- Lighting: ${styleAnalysis.lighting_analysis || ''}\n- Plush Material: ${styleAnalysis.material_analysis || ''}\n- Atmosphere: ${styleAnalysis.overall_atmosphere || ''}`;
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
        
        const platformObj = PLATFORM_STYLES.find(p => p.id === selectedPlatform);
        const platformPromptStr = platformObj ? platformObj.prompt : '';

        let finalPrompt = BATCH_RETOUCH_PROMPT;
        finalPrompt += INTENSITY_CONFIG[intensity].suffix;
        if (platformPromptStr) {
          finalPrompt += `\n\n[PLATFORM VISUAL GENE: ${platformObj?.label}]: ${platformPromptStr}`;
        }
        if (styleContext) finalPrompt += styleContext;
        if (analysisResult) {
          finalPrompt += `\n\n[AI AGENT ANALYSIS]:\n- Material: ${analysisResult.material}\n- Focus: ${analysisResult.focus}\n- Style Keywords: ${analysisResult.prompt_enhancement}`;
        }
        if (guidance.trim()) finalPrompt += `\n\n[USER REQUEST]: ${guidance.trim()}`;

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

  const handleSingleRegenerate = async (idx: number) => {
    setResults(prev => {
      const next = [...prev];
      next[idx].status = 'processing';
      next[idx].resultUrl = null;
      next[idx].error = undefined;
      return next;
    });

    try {
      const { generateImageToImage, analyzeReferenceEffect } = await import('../Cyzx4/services/geminiService');
      
      let styleContext = '';
      if (refAnalysis) {
        styleContext = `\n\n=== TARGET STYLE ===\n- Lighting: ${refAnalysis.lighting_analysis}\n- Plush Material: ${refAnalysis.material_analysis}\n- Atmosphere: ${refAnalysis.overall_atmosphere}`;
      } else if (refs.length > 0) {
        const styleAnalysis = await analyzeReferenceEffect(refs.map(r => ({ base64: r.base64, mimeType: r.mime })));
        if (styleAnalysis) {
          styleContext = `\n\n=== TARGET STYLE ===\n- Lighting: ${styleAnalysis.lighting_analysis || ''}\n- Plush Material: ${styleAnalysis.material_analysis || ''}\n- Atmosphere: ${styleAnalysis.overall_atmosphere || ''}`;
        }
      }

      const source = sources[idx];
      const compressed = { base64: source.base64, mime: source.mime };
      
      const platformObj = PLATFORM_STYLES.find(p => p.id === selectedPlatform);
      const platformPromptStr = platformObj ? platformObj.prompt : '';

      let finalPrompt = BATCH_RETOUCH_PROMPT;
      finalPrompt += INTENSITY_CONFIG[intensity].suffix;
      if (platformPromptStr) {
        finalPrompt += `\n\n[PLATFORM VISUAL GENE: ${platformObj?.label}]: ${platformPromptStr}`;
      }
      if (styleContext) finalPrompt += styleContext;
      if (analysisResult) {
        finalPrompt += `\n\n[AI AGENT ANALYSIS]:\n- Material: ${analysisResult.material}\n- Focus: ${analysisResult.focus}\n- Style Keywords: ${analysisResult.prompt_enhancement}`;
      }
      if (guidance.trim()) finalPrompt += `\n\n[USER REQUEST]: ${guidance.trim()}`;

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
          next[idx].resultUrl = result[0];
          next[idx].status = 'done';
          return next;
        });
      } else {
        throw new Error('生成失败');
      }
    } catch (err: any) {
      console.error(err);
      setResults(prev => {
        const next = [...prev];
        next[idx].status = 'error';
        next[idx].error = err.message || '生成失败';
        return next;
      });
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
            <h3 className="text-xl font-black text-pastel-text">批量精修</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传多张底图进行批量商业级精修。AI 保持产品角度与结构不变，仅提升材质质感与光影。
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
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Bot className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 rounded-md bg-indigo-500 text-white">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase">Agent 诊断报告</span>
                  <button onClick={() => setAnalysisResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-gray-500">产品材质</span>
                    <span className="text-[10px] font-black text-gray-800">{analysisResult.material}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-gray-500">精修重点</span>
                    <span className="text-[10px] font-black text-gray-800">{analysisResult.focus}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-indigo-500/10">
                    <p className="text-[9px] text-indigo-600 font-medium leading-relaxed italic">
                      "建议使用 {INTENSITY_CONFIG[analysisResult.intensity_rec].name} 模式，重点还原材质质感..."
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ref Upload */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex justify-between">
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

          {/* AI Reference Analysis Diagnostic Card */}
          {isAnalyzingRef && (
            <div className="w-full py-2.5 bg-purple-50 dark:bg-purple-500/10 border border-dashed border-purple-200 dark:border-purple-500/30 rounded-xl flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-wider">AI 正在深度解析参考图光感与材质...</span>
            </div>
          )}

          {refAnalysis && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                <Bot className="w-8 h-8 text-purple-500" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1 rounded-md bg-purple-500 text-white">
                  <Sparkles className="w-3 h-3" />
                </div>
                <span className="text-[10px] font-black text-purple-600 uppercase">精修质感与光影标准 (AI 已锁定)</span>
                <button onClick={() => setRefAnalysis(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">✨</span>
                    <span className="text-[10px] font-bold text-gray-500">光影光感识别：</span>
                  </div>
                  <p className="text-[10px] text-gray-800 font-medium pl-5 leading-relaxed">{refAnalysis.lighting_analysis}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🧶</span>
                    <span className="text-[10px] font-bold text-gray-500">毛绒质感识别：</span>
                  </div>
                  <p className="text-[10px] text-gray-800 font-medium pl-5 leading-relaxed">{refAnalysis.material_analysis}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🌈</span>
                    <span className="text-[10px] font-bold text-gray-500">画面色调氛围：</span>
                  </div>
                  <p className="text-[10px] text-gray-600 font-medium pl-5 leading-relaxed italic">{refAnalysis.overall_atmosphere}</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted uppercase">精修强度</h3>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(INTENSITY_CONFIG) as [keyof typeof INTENSITY_CONFIG, any][]).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => setIntensity(key)}
                    className={`px-2 py-2 rounded-xl border text-[10px] font-bold transition-all ${intensity === key ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight' : 'border-pastel-border bg-white text-pastel-muted'}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Ratio */}
              <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Layout className="w-4 h-4 text-pastel-highlight" />
                  <h3 className="font-bold text-pastel-text text-sm">画幅比例</h3>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: AspectRatio.SQUARE, label: '1:1', icon: '正方形' },
                    { id: AspectRatio.PORTRAIT_2_3, label: '2:3', icon: '主图' },
                    { id: AspectRatio.PORTRAIT_3_4, label: '3:4', icon: '详情' },
                    { id: AspectRatio.PORTRAIT_9_16, label: '9:16', icon: '竖屏' },
                    { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', icon: '横幅' },
                  ].map((item) => (
                    <button key={item.id} onClick={() => setAspectRatio(item.id)} className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${aspectRatio === item.id ? 'bg-orange-50 border-pastel-highlight ring-1 ring-orange-100 text-pastel-highlight' : 'bg-pastel-bg/30 border-pastel-border text-pastel-muted hover:border-orange-200'}`}>
                      <span className="text-[11px] font-bold">{item.label}</span>
                      <span className="text-[9px] opacity-60">{item.icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Styles */}
              <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="w-4 h-4 text-pastel-highlight" />
                  <h3 className="font-bold text-pastel-text text-sm">投放平台风格</h3>
                  <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">适配各平台视觉基因</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {PLATFORM_STYLES.map((platform) => (
                    <button 
                      key={platform.id} 
                      onClick={() => setSelectedPlatform(platform.id)} 
                      className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${selectedPlatform === platform.id ? 'bg-orange-50 border-pastel-highlight ring-1 ring-orange-100' : 'bg-pastel-bg/30 border-pastel-border hover:border-orange-200'}`}
                    >
                      <span className="text-lg mb-1">{platform.icon}</span>
                      <span className={`text-[10px] font-bold ${selectedPlatform === platform.id ? 'text-pastel-highlight' : 'text-pastel-text'}`}>{platform.label}</span>
                      <span className="text-[8px] text-pastel-muted scale-90 whitespace-nowrap">{platform.desc.split(' / ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm space-y-2">
                <h3 className="text-xs font-bold text-pastel-muted uppercase">分辨率</h3>
                <select value={resolution} onChange={e => setResolution(e.target.value as ImageResolution)} className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs font-bold outline-none focus:border-pastel-highlight transition-all">
                  <option value={ImageResolution.RES_2K}>2K 高清</option>
                  <option value={ImageResolution.RES_4K}>4K 极致</option>
                </select>
              </div>

              {/* Styled Model Selection */}
              <div className="bg-white p-4 rounded-2xl border border-pastel-border shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-pastel-text">
                  <Cpu className="w-4 h-4 text-pastel-muted" />
                  <span className="text-xs font-bold">模型选择</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                      className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-pastel-highlight bg-pastel-highlight/5 text-pastel-highlight' : 'border-pastel-border text-pastel-muted'}`}
                    >
                      3.1 Flash (极速)
                    </button>
                    <button
                      onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                      className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-pastel-highlight bg-pastel-highlight/5 text-pastel-highlight' : 'border-pastel-border text-pastel-muted'}`}
                    >
                      3.0 Pro (推荐)
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedModel('gpt-image-2')}
                    className={`w-full py-2.5 rounded-xl border text-[10px] font-bold transition-all ${selectedModel === 'gpt-image-2' ? 'border-pastel-highlight bg-pastel-highlight/5 text-pastel-highlight' : 'border-pastel-border text-pastel-muted'}`}
                  >
                    Imagen 2.0 (写实精修)
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted uppercase">补充需求</h3>
              <textarea 
                value={guidance} 
                onChange={e => setGuidance(e.target.value)} 
                placeholder="例如：提升毛发蓬松度，保持配色一致..."
                className="w-full bg-white border border-pastel-border rounded-xl p-4 text-xs outline-none h-28 resize-none focus:border-pastel-highlight transition-all"
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
              <button 
                onClick={downloadAll}
                disabled={results.filter(r => r.status === 'done').length === 0}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white border border-pastel-border text-sm font-bold hover:bg-pastel-bg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> 批量下载
              </button>
            </div>

            {/* Grid Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((res, idx) => (
                <div key={idx} className="bg-white rounded-3xl border border-pastel-border shadow-sm overflow-hidden flex flex-col">
                  <div className="flex-1 relative bg-slate-50 flex items-center justify-center p-4">
                    <div className="grid grid-cols-2 gap-2 w-full h-full">
                      <div className="relative rounded-xl overflow-hidden border border-pastel-border/50">
                        <img src={res.sourceUrl} className="w-full h-full object-cover" />
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
                            <img src={res.resultUrl} className="w-full h-full object-cover" />
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
                    <div className="flex items-center gap-3">
                      {(res.status === 'done' || res.status === 'error') && (
                        <button 
                          onClick={() => handleSingleRegenerate(idx)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded border border-pastel-border hover:bg-pastel-bg text-[10px] font-bold text-pastel-muted transition-colors hover:text-pastel-highlight hover:border-pastel-highlight"
                        >
                          <RefreshCw className="w-3 h-3" />
                          重新生成
                        </button>
                      )}
                      {res.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
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
              <img src={preview.src} className="max-w-full max-h-[70vh] object-contain shadow-xl rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DollBatchRetouchTab;
