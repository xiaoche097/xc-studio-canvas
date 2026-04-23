import React, { useState } from 'react';
import { Download, Loader2, Maximize2, Sparkles, Upload, X, Zap, Shirt, Settings2, Ratio, MonitorSmartphone, Cpu, RefreshCw } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage, analyzeVtonMaterials } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
// Removed broken smartCrop import

type ResultItem = {
  refIndex: number;
  refUrl: string;
  resultUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
};

// 自定义香蕉图标组件（复用）
const BananaIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ color: '#fbbf24' }}
  >
    <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
    <path d="M15 3s-1.5 1-2 3" />
  </svg>
);

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

const GarmentReplacementTab: React.FC = () => {
  // Core Garment
  const [coreGarmentFile, setCoreGarmentFile] = useState<File | null>(null);
  const [coreGarmentUrl, setCoreGarmentUrl] = useState<string | null>(null);

  // Pairing Garment
  const [pairingFile, setPairingFile] = useState<File | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);

  // Model Identity Reference (NEW)
  const [modelRefFile, setModelRefFile] = useState<File | null>(null);
  const [modelRefUrl, setModelRefUrl] = useState<string | null>(null);

  // Target photos (up to 10)
  const [targetFiles, setTargetFiles] = useState<File[]>([]);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [cachedGlobalReport, setCachedGlobalReport] = useState<string | null>(null);

  // Output settings
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);

  // Preview modal
  const [preview, setPreview] = useState<PreviewState>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [userGuidance, setUserGuidance] = useState('');

  const MAX_TARGETS = 10;

  // ---- Upload Handlers ----
  const setCoreFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (coreGarmentUrl) URL.revokeObjectURL(coreGarmentUrl);
    setCoreGarmentFile(file);
    setCoreGarmentUrl(URL.createObjectURL(file));
    setResults([]);
  };

  const handleCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCoreFromFile(file);
    e.target.value = '';
  };

  const removeCoreGarment = () => {
    if (coreGarmentUrl) URL.revokeObjectURL(coreGarmentUrl);
    setCoreGarmentFile(null);
    setCoreGarmentUrl(null);
    setResults([]);
  };

  const setPairingFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (pairingUrl) URL.revokeObjectURL(pairingUrl);
    setPairingFile(file);
    setPairingUrl(URL.createObjectURL(file));
    setResults([]);
  };

  const handlePairingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPairingFromFile(file);
    e.target.value = '';
  };

  const removePairing = () => {
    if (pairingUrl) URL.revokeObjectURL(pairingUrl);
    setPairingFile(null);
    setPairingUrl(null);
    setResults([]);
  };

  const setModelRefFromFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (modelRefUrl) URL.revokeObjectURL(modelRefUrl);
    
    // Initial preview (native)
    setModelRefFile(file);
    const initialUrl = URL.createObjectURL(file);
    setModelRefUrl(initialUrl);
    
    setModelRefUrl(initialUrl);
    
    setResults([]);
  };

  const handleModelRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setModelRefFromFile(file);
    e.target.value = '';
  };

  const removeModelRef = () => {
    if (modelRefUrl) URL.revokeObjectURL(modelRefUrl);
    setModelRefFile(null);
    setModelRefUrl(null);
    setResults([]);
  };

  // 绑定剪贴板粘贴事件
  useImagePaste((files) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // 优先级 1: 主体商品 (Core Garment)
    if (!coreGarmentUrl) {
      setCoreFromFile(file);
    }
    // 优先级 2: 模特参考 (Identity Ref)
    else if (!modelRefUrl) {
      setModelRefFromFile(file);
    }
    // 优先级 3: 搭配商品 (Pairing)
    else if (!pairingUrl) {
      setPairingFromFile(file);
    }
    // 优先级 4: 全部作为待替换图
    else {
      addTargetFiles(files);
    }
  });

  // ---- Target Handlers ----
  const addTargetFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (targetFiles.length + validFiles.length > MAX_TARGETS) {
      alert(`最多支持 ${MAX_TARGETS} 张要替换的图片`);
      return;
    }
    const newFiles = [...targetFiles];
    const newUrls = [...targetUrls];
    validFiles.forEach(file => {
      newFiles.push(file);
      newUrls.push(URL.createObjectURL(file));
    });
    setTargetFiles(newFiles);
    setTargetUrls(newUrls);
    setResults([]);
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addTargetFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeTarget = (index: number) => {
    URL.revokeObjectURL(targetUrls[index]);
    setTargetFiles(prev => prev.filter((_, i) => i !== index));
    setTargetUrls(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const removeAllTargets = () => {
    targetUrls.forEach(url => URL.revokeObjectURL(url));
    setTargetFiles([]);
    setTargetUrls([]);
    setResults([]);
  };

  const handleTargetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addTargetFiles(Array.from(e.dataTransfer.files));
    }
  };

  /**
   * Prepares an image for API parsing (compresses it to a max of 2048px width without destroying multi-view formats).
   */
  const smartCrop = async (file: File): Promise<{ base64: string; mimeType: string; displayUrl: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            compressImage(file).then(res => resolve({ 
              base64: res.base64, 
              mimeType: res.mime, 
              displayUrl: URL.createObjectURL(file) 
            }));
            return;
          }

          let sourceWidth = img.width;

          canvas.width = Math.min(sourceWidth, 2048);
          canvas.height = Math.round((img.height * canvas.width) / sourceWidth);

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, sourceWidth, img.height, 0, 0, canvas.width, canvas.height);

          const base64Url = canvas.toDataURL('image/jpeg', 0.95);
          resolve({ 
            base64: base64Url.split(',')[1], 
            mimeType: 'image/jpeg', // 更改：从 mime 改为 mimeType 以保持一致
            displayUrl: base64Url
          });
        };
      };
    });
  };

  const buildGarmentReplacementPrompt = () => {
    return `[NANO BANANA - STRUCTURAL GARMENT LOCK]
- TASK: Virtual Try-On.
- SUBJECT: Transfer the garment from the reference images to the model in the target scene.
- FIDELITY: Maintain 1:1 identical color, print pattern, and fabric texture.
- STRUCTURE: Preserve the original neckline, sleeve type, and hemline length.
- STYLE: High-end fashion editorial, photorealistic, cinematic lighting.
- CONSTRAINT: Image 1 is the POSE master. Image 2 (and 3) is the PRODUCT master.
${userGuidance ? `- USER SUPPLEMENT: ${userGuidance}` : ''}`;
  };

  const buildGarmentReplacementNegativePrompt = () => {
    return 'magenta tint, red cast, red drift, purple bleed, oversaturated reds, color distortion, unnatural warmth, distorted white balance, wrong color, color shift, color drift, different garment, grid, multi-view, three-view, layout, split screen, collage, multiple people, blurry face, low quality, logo on wrong side, text, watermark, different person, changed pose, reframed composition, strap, tank top, high neck, crew neck, turtleneck, blurred print, smeared texture, simplified patterns, changed neckline, altered sleeves, dark border at hem, hem trim, bottom border, decorative edge, contrasting trim';
  };

  // ---- Generators ----
  const handleGenerate = async () => {
    if (!coreGarmentFile) {
      alert('请上传服装 (核心)');
      return;
    }
    if (targetFiles.length === 0) {
      alert('请至少上传 1 张要替换的图片');
      return;
    }

    setIsGenerating(true);
    setStatusMessage(`正在预处理并生成...`);

    const initialResults: ResultItem[] = targetUrls.map((url, i) => ({
      refIndex: i,
      refUrl: url,
      resultUrl: null,
      status: 'pending',
    }));
    setResults(initialResults);

    try {
      // PHASE 1: Material Analysis (Dual-Agent VTON)
      setStatusMessage('正在深度分析素材特征 (1/2)...');
      
      const coreImg = await smartCrop(coreGarmentFile);
      let pairingImg: { base64: string; mimeType: string } | null = null;
      if (pairingFile) pairingImg = await smartCrop(pairingFile);
      
      let processedModelRef: { base64: string; mimeType: string; displayUrl: string } | null = null;
      if (modelRefFile) processedModelRef = await smartCrop(modelRefFile);

      // Analyze Global Reference (Identity + Garment) - Cache it
      const globalRefs = [];
      if (processedModelRef) globalRefs.push(processedModelRef);
      globalRefs.push(coreImg);
      if (pairingImg) globalRefs.push(pairingImg);
      
      const globalReport = await analyzeVtonMaterials(globalRefs, { type: 'global' });
      setCachedGlobalReport(globalReport); // Store in state for individual regeneration

      // PHASE 2: Individual Target Generation (Parallel)
      const generationTasks = targetFiles.map(async (_, index) => {
        await performSingleGeneration(index, globalReport);
      });

      // Wait for all tasks to complete or fail
      await Promise.all(generationTasks);
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const performSingleGeneration = async (index: number, globalReport: string) => {
    try {
      setResults(prev => prev.map((r, i) => i === index ? { ...r, status: 'generating', error: undefined } : r));

      const targetFile = targetFiles[index];
      if (!targetFile) throw new Error('找不到目标图片');

      const coreImg = await smartCrop(coreGarmentFile!);
      let pairingImg: { base64: string; mimeType: string } | null = null;
      if (pairingFile) pairingImg = await smartCrop(pairingFile);
      
      let processedModelRef: { base64: string; mimeType: string; displayUrl: string } | null = null;
      if (modelRefFile) processedModelRef = await smartCrop(modelRefFile);

      const targetImg = await compressImage(targetFile, 2048, 0.96);
      
      // Per-target Scene Analysis
      const targetReport = await analyzeVtonMaterials([{ base64: targetImg.base64, mimeType: targetImg.mime }], { type: 'target' });
      const combinedReport = `REF_REPORT:\n${globalReport}\n\nSCENE_REPORT:\n${targetReport}`;

      const inputImages: { base64: string; mimeType: string }[] = [];
      
      if (processedModelRef) {
        // Image 1 = Target Scene (Pose/Angle/Background Anchor)
        inputImages.push({ base64: targetImg.base64, mimeType: targetImg.mime });
        // Image 2 = Model Identity
        inputImages.push({ base64: processedModelRef.base64, mimeType: processedModelRef.mimeType });
        // Image 3 = Core Garment
        inputImages.push({ base64: coreImg.base64, mimeType: coreImg.mimeType });
        // Image 4 = Pairing
        if (pairingImg) {
          inputImages.push({ base64: pairingImg.base64, mimeType: pairingImg.mimeType });
        }
      } else {
        // Image 1 = Target Scene (Pose/Angle/Identity Anchor)
        inputImages.push({ base64: targetImg.base64, mimeType: targetImg.mime });
        // Image 2 = Core Garment
        inputImages.push({ base64: coreImg.base64, mimeType: coreImg.mimeType });
        // Image 3 = Pairing
        if (pairingImg) {
          inputImages.push({ base64: pairingImg.base64, mimeType: pairingImg.mimeType });
        }
      }

      let lastError: any = null;
      const fallbackModels = [selectedModel, selectedModel === 'gemini-3.1-flash-image-preview' ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview'] as const;
      let result: string[] = [];

      for (const modelId of fallbackModels) {
        try {
          result = await generateImageToImage(
            inputImages,
            buildGarmentReplacementPrompt(), 
            {
              modelId,
              aspectRatio: outputAspectRatio,
              resolution: resolution,
              workflowHint: 'garment-replacement',
              hasModelRef: !!modelRefFile,
              negativePrompt: buildGarmentReplacementNegativePrompt(),
              vtonReport: combinedReport
            }
          );
          if (result && result.length > 0) break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[GarmentSwap] Model ${modelId} failed:`, e);
        }
      }

      if (result && result.length > 0) {
        setResults(prev => prev.map((r, i) =>
          i === index ? { ...r, status: 'done', resultUrl: result[0] } : r
        ));
      } else {
        throw new Error(`生成失败: ${getErrorMessage(lastError)}`);
      }
    } catch (error: any) {
      console.error(`[GarmentSwap] Target ${index + 1} failed:`, error);
      setResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'error', error: getErrorMessage(error) } : r
      ));
    }
  };

  const handleRegenerateSingle = async (index: number) => {
    if (!coreGarmentFile) {
      alert('请上传服装 (核心)');
      return;
    }

    try {
      let report = cachedGlobalReport;
      
      // If no cached report, generate one first
      if (!report) {
        const coreImg = await smartCrop(coreGarmentFile);
        let pairingImg: { base64: string; mimeType: string } | null = null;
        if (pairingFile) pairingImg = await smartCrop(pairingFile);
        let processedModelRef: { base64: string; mimeType: string; displayUrl: string } | null = null;
        if (modelRefFile) processedModelRef = await smartCrop(modelRefFile);

        const globalRefs = [];
        if (processedModelRef) globalRefs.push(processedModelRef);
        globalRefs.push(coreImg);
        if (pairingImg) globalRefs.push(pairingImg);
        
        report = await analyzeVtonMaterials(globalRefs, { type: 'global' });
        setCachedGlobalReport(report);
      }

      await performSingleGeneration(index, report);
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err));
    }
  };

  const downloadAllResults = () => {
    results.forEach((item, i) => {
      if (item.resultUrl) {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = item.resultUrl!;
          a.download = `garment-replace-${i + 1}-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 300);
      }
    });
  };

  return (
    <div className="flex h-full w-full bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      {/* Left panel: Upload controls */}
      <div className="w-[320px] lg:w-[380px] bg-white border-r border-pastel-border flex flex-col flex-shrink-0 z-10 shadow-sm relative overflow-y-auto custom-scrollbar">
        <div className="flex-1 p-6 space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-pastel-highlight font-black tracking-widest text-[10px] uppercase">
              <Shirt className="w-3.5 h-3.5" />
              <span>Garment Replacement</span>
            </div>
            <h2 className="text-xl font-bold text-pastel-text">批量服装替换</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              上传服装，再批量上传要替换的模特图（最高10张）。底层将保持姿势、背景完全一致，仅替换服装结构。
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex justify-between">
              参考物上传 (Reference)
            </h3>
            
            <div className="space-y-3">
              {/* LARGE: Core Garment (The Star) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <span className="text-[11px] text-pastel-text font-black" title="建议上传包含正/背/侧面的拼图">1. 服装三视图 (必)</span>
                  <span className="text-[10px] text-pastel-highlight bg-pastel-highlight/10 px-2 py-0.5 rounded-full font-bold">三视图/参考图</span>
                </div>
                {coreGarmentUrl ? (
                  <div
                    className="relative group w-full aspect-[16/9] rounded-2xl border-2 border-pastel-highlight shadow-sm overflow-hidden bg-pastel-bg"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setCoreFromFile(f); }}
                  >
                    <img src={coreGarmentUrl} alt="core-garment" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110">
                        <input type="file" className="hidden" onChange={handleCoreChange} accept="image/*" />
                        <Upload className="w-4 h-4" />
                      </label>
                      <button type="button" onClick={removeCoreGarment} className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className="relative flex flex-col items-center justify-center w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-pastel-highlight/40 bg-pastel-highlight/5 hover:bg-pastel-highlight/10 hover:border-pastel-highlight transition-all cursor-pointer group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setCoreFromFile(f); }}
                  >
                    <input type="file" className="hidden" onChange={handleCoreChange} accept="image/*" />
                    <div className="w-12 h-12 rounded-full bg-pastel-highlight/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Shirt className="w-6 h-6 text-pastel-highlight" />
                    </div>
                    <span className="text-xs text-pastel-text font-bold mb-1">点击上传服装三视图</span>
                    <span className="text-[10px] text-pastel-muted">支持正、背、侧视角拼图</span>
                  </label>
                )}
              </div>

              {/* SMALL: Optional Secondary Refs */}
              <div className="grid grid-cols-2 gap-3">
                {/* Model Ref */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-pastel-muted font-bold ml-1">人脸/肤色 (可选)</span>
                  {modelRefUrl ? (
                    <div
                      className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-pastel-bg"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setModelRefFromFile(f); }}
                    >
                      <img src={modelRefUrl} alt="model-ref" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer bg-white p-1.5 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110">
                          <input type="file" className="hidden" onChange={handleModelRefChange} accept="image/*" />
                          <Upload className="w-3 h-3" />
                        </label>
                        <button type="button" onClick={removeModelRef} className="bg-white p-1.5 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setModelRefFromFile(f); }}
                    >
                      <input type="file" className="hidden" onChange={handleModelRefChange} accept="image/*" />
                      <Upload className="w-4 h-4 text-pastel-muted group-hover:text-pastel-highlight mb-1" />
                      <span className="text-[9px] text-pastel-muted font-bold">固定模特</span>
                    </label>
                  )}
                </div>

                {/* Pairing */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-pastel-muted font-bold ml-1">搭配/裤子 (可选)</span>
                  {pairingUrl ? (
                    <div
                      className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-pastel-bg"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPairingFromFile(f); }}
                    >
                      <img src={pairingUrl} alt="pairing" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer bg-white p-1.5 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110">
                          <input type="file" className="hidden" onChange={handlePairingChange} accept="image/*" />
                          <Upload className="w-3 h-3" />
                        </label>
                        <button type="button" onClick={removePairing} className="bg-white p-1.5 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPairingFromFile(f); }}
                    >
                      <input type="file" className="hidden" onChange={handlePairingChange} accept="image/*" />
                      <Upload className="w-4 h-4 text-pastel-muted group-hover:text-pastel-highlight mb-1" />
                      <span className="text-[9px] text-pastel-muted font-bold">搭配单品</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider">
                要替换的图片库
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-pastel-muted font-bold">
                  {targetFiles.length}/{MAX_TARGETS}
                </span>
                {targetFiles.length > 0 && (
                  <button type="button" onClick={removeAllTargets} className="text-[10px] text-pastel-highlight hover:underline font-bold">
                    清空
                  </button>
                )}
              </div>
            </div>

            <div 
              className="grid grid-cols-3 gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleTargetDrop}
            >
              {targetUrls.map((url, i) => (
                <div key={i} className="relative group aspect-[3/4] rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white">
                  <img src={url} alt={`target-${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    #{i + 1}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button type="button" onClick={() => setPreview({ src: url, title: `目标图片 #${i + 1}` })} className="bg-white p-1 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110">
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => removeTarget(i)} className="bg-white p-1 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {targetFiles.length < MAX_TARGETS && (
                <label
                  className="relative flex flex-col items-center justify-center aspect-[3/4] rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) addTargetFiles(Array.from(e.dataTransfer.files)); }}
                >
                  <input type="file" className="hidden" onChange={handleTargetChange} accept="image/*" multiple />
                  <Upload className="w-5 h-5 text-pastel-muted group-hover:text-pastel-highlight transition-colors mb-1" />
                  <span className="text-[9px] text-pastel-muted font-bold">拖拽或点击上传</span>
                </label>
              )}
            </div>
          </div>

          {/* 输出比例 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <Ratio className="w-3 h-3" />
              输出比例 (Aspect Ratio)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '标准' },
                { value: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '修长' },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5', desc: 'INS' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setOutputAspectRatio(item.value)}
                  className={`relative rounded-xl border py-2 text-center transition-all ${
                    outputAspectRatio === item.value
                      ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm'
                      : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'
                  }`}
                >
                  <span className="text-xs font-bold block">{item.label}</span>
                  <span className="text-[9px] opacity-60">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <MonitorSmartphone className="w-3 h-3" />
              清晰度 (Resolution)
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: ImageResolution.RES_1K, label: '1K', desc: '快速' },
                { value: ImageResolution.RES_2K, label: '2K', desc: '高清' },
                { value: ImageResolution.RES_4K, label: '4K', desc: '超清' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setResolution(item.value)}
                  className={`relative rounded-xl border py-2 text-center transition-all ${
                    resolution === item.value
                      ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm'
                      : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'
                  }`}
                >
                  <span className="text-xs font-bold block">{item.label}</span>
                  <span className="text-[9px] opacity-60">{item.desc}</span>
                </button>
              ))}
            </div>
          
          {/* 内容补充 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              内容补充 (Content Supplement)
            </h3>
            <div className="relative group">
              <textarea
                value={userGuidance}
                onChange={(e) => setUserGuidance(e.target.value)}
                placeholder="例如：保持领口V领不变、去掉裙摆边框、增加面料丝绸质感..."
                className="w-full h-24 p-3 text-xs bg-white border border-pastel-border rounded-xl focus:ring-2 focus:ring-pastel-highlight/20 focus:border-pastel-highlight outline-none transition-all resize-none placeholder:text-pastel-muted/50"
              />
              <div className="absolute bottom-2 right-2 text-[9px] text-pastel-muted opacity-0 group-hover:opacity-100 transition-opacity">
                AI 将优先考虑此补充内容
              </div>
            </div>
          </div>

          {/* 图像模型选择 */}
            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <BananaIcon className="w-3 h-3" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Banana 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">3.1 Flash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <BananaIcon className="w-3 h-3" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Banana Pro
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">3.0 Pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gpt-image-2')}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gpt-image-2'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-orange-500" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      GPT Image 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">Ultra Quality</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-pastel-border bg-pastel-bg/50 backdrop-blur sticky bottom-0 z-10 w-full">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !coreGarmentFile || targetFiles.length === 0}
            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${isGenerating || !coreGarmentFile || targetFiles.length === 0
              ? 'bg-pastel-border text-pastel-muted cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-pastel-highlight to-pink-500 text-white hover:opacity-90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{statusMessage || '正在并行替换...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>一键批量替换 ({targetFiles.length}张)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right panel: Results */}
      <div className="flex-1 bg-pastel-bg flex flex-col relative min-w-0 overflow-y-auto">
        {results.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center opacity-30 text-center select-none p-8">
            <Shirt className="w-24 h-24 mb-6 stroke-[1]" />
            <h3 className="text-2xl font-bold mb-2">等待上传并替换</h3>
            <p className="text-sm max-w-md">上传核心服装和模特实拍图，即可一键将原图中的衣服替换为你指定的产品，并且严格保持原图姿势和场景不变。</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 flex-1 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pastel-highlight" />
                替换结果 ({results.filter(r => r.status === 'done').length}/{results.length})
              </h2>
              {results.some(r => r.status === 'done') && (
                <button onClick={downloadAllResults} className="text-xs font-bold flex items-center gap-2 bg-white border border-pastel-border text-pastel-text px-4 py-2 rounded-lg hover:bg-pastel-bg hover:text-pastel-highlight transition-all shadow-sm">
                  <Download className="w-4 h-4" />
                  全部下载
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((item, i) => (
                <div key={i} className="flex flex-col gap-3 group">
                  {/* Target reference visualization */}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-pastel-muted pl-1">
                    <img src={item.refUrl} className="w-6 h-6 object-cover rounded-md border" alt="ref" />
                    <span>目标图片 #{i + 1}</span>
                  </div>

                  {item.status === 'pending' || item.status === 'generating' ? (
                    <div className="relative w-full aspect-[3/4] bg-white rounded-3xl border border-pastel-border shadow-sm flex flex-col items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-tr from-pastel-bg/50 to-white animate-pulse rounded-3xl" />
                      <div className="relative flex flex-col items-center gap-4 text-pastel-highlight">
                        {item.status === 'pending' ? (
                          <div className="w-8 h-8 rounded-full border-2 border-pastel-highlight/30 flex items-center justify-center">
                            <span className="text-xs font-bold text-pastel-muted">{i + 1}</span>
                          </div>
                        ) : (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        )}
                        <span className="text-xs font-bold animate-pulse text-pastel-muted">
                          {item.status === 'pending' ? '等待生成...' : 'AI 缝合处理中...'}
                        </span>
                      </div>
                    </div>
                  ) : item.status === 'error' ? (
                    <div className="w-full aspect-[3/4] bg-red-50/50 rounded-3xl border border-red-100 flex flex-col items-center justify-center p-6 text-center text-red-500 relative group">
                      <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <span className="text-sm font-bold mb-2">生成失败</span>
                      <span className="text-[10px] opacity-80 break-all mb-4">{item.error}</span>
                      <button
                        onClick={() => handleRegenerateSingle(i)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重试
                      </button>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[3/4] rounded-3xl border border-pastel-border shadow-sm overflow-hidden bg-white">
                      <img src={item.resultUrl!} className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]" alt={`result-${i + 1}`} />
                      <div className="absolute top-4 left-4 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm">
                        ✓ #{i + 1}
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                        <button
                          type="button"
                          onClick={() => setPreview({ src: item.resultUrl!, title: `替换结果 #${i + 1}` })}
                          className="bg-white text-pastel-text p-2.5 rounded-full hover:scale-110 hover:text-pastel-highlight transition-all shadow-xl"
                          title="查看大图"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingle(i)}
                          className="bg-white text-pastel-text p-2.5 rounded-full hover:scale-110 hover:text-pastel-highlight transition-all shadow-xl"
                          title="重新生成"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = item.resultUrl!;
                            a.download = `garment-replace-${i + 1}.png`;
                            a.click();
                          }}
                          className="bg-pastel-highlight text-white p-2.5 rounded-full hover:scale-110 hover:shadow-xl transition-all shadow-lg"
                          title="下载图片"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full flex flex-col pointer-events-none" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white pointer-events-auto">
              <div className="flex flex-col">
                <span className="font-bold text-lg">{preview.title}</span>
                {preview.subtitle && <span className="text-sm opacity-80">{preview.subtitle}</span>}
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <img src={preview.src} className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl pointer-events-auto" alt="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default GarmentReplacementTab;
