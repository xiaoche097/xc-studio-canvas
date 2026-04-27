import React, { useState, useRef } from 'react';
import { 
  Download, Loader2, Maximize2, Palette, Plus, RefreshCw, Upload, X, Zap, 
  Sparkles, Image as ImageIcon, Ratio, MonitorSmartphone, Cpu, 
  Scissors, Shirt, Briefcase, Footprints, Smile, HardHat, Coffee, Sparkle,
  CheckCircle2, AlertCircle, LayoutGrid
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { storageService } from '../services/storageService';

// Types
type PropCategory = 'hair' | 'pants' | 'shoes' | 'bag' | 'accessory' | 'handheld';

interface CategoryConfig {
  id: PropCategory;
  label: string;
  icon: React.ReactNode;
  promptTemplate: string;
}

interface ResultItem {
  sourceUrl: string;
  sourceIndex: number;
  url: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  category: PropCategory;
  description: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    id: 'hair', 
    label: '头发 (Hair)', 
    icon: <Smile className="w-5 h-5" />,
    promptTemplate: "Replace the hairstyle with [USER_DESCRIPTION]. Natural hairline, realistic strands, soft studio highlights, natural volume, consistent shadow on forehead."
  },
  { 
    id: 'pants', 
    label: '裤子 (Pants)', 
    icon: <Shirt className="w-5 h-5" />,
    promptTemplate: "Replace the pants with [USER_DESCRIPTION]. Realistic fabric texture, natural folds, proper waistband alignment, accurate drape, clean hem. Do not alter the upper garment in any way."
  },
  { 
    id: 'shoes', 
    label: '鞋子 (Shoes)', 
    icon: <Footprints className="w-5 h-5" />,
    promptTemplate: "Replace the shoes with [USER_DESCRIPTION]. Realistic texture, accurate scale, natural contact shadows, consistent perspective."
  },
  { 
    id: 'bag', 
    label: '包包 (Bag)', 
    icon: <Briefcase className="w-5 h-5" />,
    promptTemplate: "Replace the bag/handbag with [USER_DESCRIPTION]. Realistic texture, accurate scale, natural grip position, realistic shadow and perspective."
  },
  { 
    id: 'accessory', 
    label: '帽子配饰 (Accessory)', 
    icon: <HardHat className="w-5 h-5" />,
    promptTemplate: "Replace the hat/accessory with [USER_DESCRIPTION]. Realistic texture, accurate fit, natural integration with the model."
  },
  { 
    id: 'handheld', 
    label: '手持物 (Props)', 
    icon: <Coffee className="w-5 h-5" />,
    promptTemplate: "Replace the handheld item with [USER_DESCRIPTION]. Realistic scale, natural contact, consistent perspective and studio lighting."
  }
];

const BatchPropsModifierTab: React.FC = () => {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const MAX_SOURCES = 10;

  const [activeCategory, setActiveCategory] = useState<PropCategory>('hair');
  const [description, setDescription] = useState('');
  const [refImages, setRefImages] = useState<{ base64: string; mime: string; preview: string }[]>([]);
  const [isDraggingRef, setIsDraggingRef] = useState(false);

  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [userGuidance, setUserGuidance] = useState('');
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const remainingCount = MAX_SOURCES - sourceFiles.length;
    const filesToAdd = validFiles.slice(0, remainingCount);
    
    if (filesToAdd.length > 0) {
      setSourceFiles(prev => [...prev, ...filesToAdd]);
      setSourceUrls(prev => [...prev, ...filesToAdd.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files));
  };

  useImagePaste(handleFiles);

  const removeSource = (index: number) => {
    URL.revokeObjectURL(sourceUrls[index]);
    setSourceFiles(prev => prev.filter((_, i) => i !== index));
    setSourceUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleRefImageUpload = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const remainingCount = 3 - refImages.length;
    const filesToAdd = validFiles.slice(0, remainingCount);

    for (const file of filesToAdd) {
      const compressed = await compressImage(file, 512, 0.8);
      setRefImages(prev => [...prev, {
        base64: compressed.base64,
        mime: compressed.mime,
        preview: `data:${compressed.mime};base64,${compressed.base64}`
      }]);
    }
  };

  const removeRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const buildPropsPrompt = (category: PropCategory, userDesc: string, hasVisualRef: boolean) => {
    const config = CATEGORIES.find(c => c.id === category);
    const variablePrompt = config?.promptTemplate.replace('[USER_DESCRIPTION]', userDesc) || '';
    
    const basePrompt = `
[PROPS MODIFIER - HIGH CONVERSION DESIGN]
Edit the image to replace only the specified element.
Keep the original model's face, expression, pose, body proportions, skin tone, garment, background, lighting, shadows, camera angle, and composition unchanged.
Preserve the clothing exactly as in the original image.
Match the original commercial fashion photography style.
Photorealistic, realistic texture, natural edges, correct perspective, consistent shadow direction, clean studio quality.

TASK: ${variablePrompt}
${hasVisualRef ? "STRICT CONSISTENCY: Match the style, color, design, and texture of the target item from the reference images EXACTLY. Ensure the item is visually identical to the provided reference." : ""}
${userGuidance ? `USER SUPPLEMENT: ${userGuidance}` : ""}
`;

    const negativePrompt = `changed face, different model, altered clothing, changed pose, changed body shape, different background, unrealistic lighting, warped fabric, blurry edges, extra limbs, distorted hands, floating objects, cartoon, illustration, low quality, messy hair, jagged lines`;

    return { prompt: basePrompt.trim(), negativePrompt };
  };

  const handleGenerate = async () => {
    if (sourceFiles.length === 0) return alert('请先上传至少一张模特原图');
    if (!description.trim() && refImages.length === 0) return alert('请提供描述或参考图');

    setIsGenerating(true);
    const newResults: ResultItem[] = sourceUrls.map((url, idx) => ({
      sourceUrl: url,
      sourceIndex: idx,
      url: null,
      status: 'pending',
      category: activeCategory,
      description: description
    }));
    setResults(newResults);

    let batchAnchorBase64: string | null = null;

    for (let i = 0; i < sourceFiles.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));
      
      try {
        const sourceImage = await compressImage(sourceFiles[i], 2048, 0.96);
        const { prompt, negativePrompt } = buildPropsPrompt(activeCategory, description, !!batchAnchorBase64 || refImages.length > 0);
        
        const inputImages = [
          { base64: sourceImage.base64, mimeType: sourceImage.mime },
          ...refImages.map(img => ({ base64: img.base64, mimeType: img.mime }))
        ];

        // If we have an anchor from the first image in this batch, use it
        if (batchAnchorBase64) {
          inputImages.push({ base64: batchAnchorBase64, mimeType: 'image/jpeg' });
        }

        const res = await generateImageToImage(inputImages, prompt, {
          modelId: selectedModel,
          aspectRatio: outputAspectRatio,
          resolution,
          workflowHint: 'doll-modification',
          negativePrompt
        });

        if (res && res.length > 0) {
          // If no user reference was provided, the first generated image becomes the anchor for the rest
          if (i === 0 && refImages.length === 0) {
            batchAnchorBase64 = res[0];
          }
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'done', url: res[0] } : r));

          // Save to recent projects
          try {
            await storageService.saveProject({
              id: crypto.randomUUID(),
              type: 'MODEL',
              createdAt: Date.now(),
              thumbnail: res[0],
              assets: {
                original: [sourceUrls[i]],
                generated: res,
              },
              metadata: {
                subType: 'batch_props_modifier',
                category: activeCategory,
                description: description,
                userGuidance,
                resolution,
                aspectRatio: outputAspectRatio,
                modelId: selectedModel,
              },
            });
          } catch (e) {
            console.error("Failed to save project", e);
          }
        } else {
          throw new Error('No image returned');
        }
      } catch (err) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: getErrorMessage(err) } : r));
      }
    }
    setIsGenerating(false);
  };

  const handleRegenerateSingle = async (index: number) => {
    const item = results[index];
    setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'generating', url: null } : r));

    try {
      const sourceImage = await compressImage(sourceFiles[item.sourceIndex], 2048, 0.96);
      const { prompt, negativePrompt } = buildPropsPrompt(activeCategory, description, refImages.length > 0);
      
      const inputImages = [
        { base64: sourceImage.base64, mimeType: sourceImage.mime },
        ...refImages.map(img => ({ base64: img.base64, mimeType: img.mime }))
      ];

      const res = await generateImageToImage(inputImages, prompt, {
        modelId: selectedModel,
        aspectRatio: outputAspectRatio,
        resolution,
        workflowHint: 'doll-modification',
        negativePrompt
      });

      if (res && res.length > 0) {
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'done', url: res[0] } : r));
      }
    } catch (err) {
      setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'error', error: getErrorMessage(err) } : r));
    }
  };

  // Banana Icon (same as Recolor)
  const BananaIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ color: '#fbbf24' }}>
      <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
      <path d="M15 3s-1.5 1-2 3" />
    </svg>
  );

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden text-pastel-text">
      {/* Sidebar */}
      <div className="w-[420px] border-r border-pastel-border bg-pastel-card flex flex-col overflow-y-auto custom-scrollbar shadow-sm z-10">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Scissors className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Props Modifier</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">批量修改道具</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              保持模特与核心衣服不变，通过局部重绘替换头发、配饰、裤子等局部物件。建议一次只改一个大类。
            </p>
          </div>

          {/* 1. Source Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-3 h-3" />
                1. 模特原图上传 ({sourceFiles.length}/{MAX_SOURCES})
              </h3>
            </div>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="space-y-4"
            >
              {sourceUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {sourceUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden group bg-white shadow-sm">
                      <img src={url} className="w-full h-full object-cover" alt="source" />
                      <button onClick={() => removeSource(idx)} className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {sourceFiles.length < MAX_SOURCES && (
                    <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-pastel-border flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-all bg-white/50">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {sourceFiles.length === 0 && (
                <label className="flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group shadow-inner">
                  <input type="file" multiple className="hidden" onChange={handleSourceChange} />
                  <div className="w-12 h-12 mb-3 bg-pastel-bg rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold">批量上传原图</span>
                  <span className="text-[10px] text-pastel-muted mt-1">支持拖拽、粘贴或点击</span>
                </label>
              )}
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleSourceChange} />
            </div>
          </div>

          {/* 2. Category Selection */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <LayoutGrid className="w-3 h-3" />
              2. 选择替换类别
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-2xl border transition-all ${
                    activeCategory === cat.id
                      ? 'bg-pastel-pink border-pastel-border text-pastel-text shadow-sm ring-2 ring-pastel-pink/20'
                      : 'bg-white border-gray-100 text-pastel-muted hover:border-pastel-border'
                  }`}
                >
                  <div className={`${activeCategory === cat.id ? 'text-pastel-text' : 'text-pastel-muted'} mb-1`}>
                    {cat.icon}
                  </div>
                  <span className="text-[9px] font-bold">{cat.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Definition */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <Sparkle className="w-3 h-3" />
              3. 替换目标定义
            </h3>
            <div className="space-y-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`请输入${CATEGORIES.find(c => c.id === activeCategory)?.label.split(' ')[0]}描述...`}
                className="w-full h-24 p-4 text-xs bg-white border border-pastel-border rounded-2xl focus:ring-2 focus:ring-pastel-pink/30 focus:border-pastel-border outline-none transition-all resize-none shadow-inner"
              />
              
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
                onDragLeave={() => setIsDraggingRef(false)}
                onDrop={(e) => { e.preventDefault(); setIsDraggingRef(false); if(e.dataTransfer.files) handleRefImageUpload(Array.from(e.dataTransfer.files)); }}
                onPaste={(e) => { 
                  const items = e.clipboardData?.items;
                  if (items) {
                    const files: File[] = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const f = items[i].getAsFile();
                        if (f) files.push(f);
                      }
                    }
                    if (files.length > 0) handleRefImageUpload(files);
                  }
                }}
                className={`relative flex flex-col items-center justify-center min-h-24 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                  isDraggingRef ? 'bg-pastel-pink border-pastel-border' : 'border-gray-100 bg-white hover:border-pastel-border'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = (ev: any) => { if(ev.target.files) handleRefImageUpload(Array.from(ev.target.files)); };
                  input.click();
                }}
              >
                {refImages.length > 0 ? (
                  <div className="w-full p-3 grid grid-cols-3 gap-2">
                    {refImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-pastel-border shadow-sm group">
                        <img src={img.preview} className="w-full h-full object-cover" alt="ref" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeRefImage(idx); }} 
                          className="absolute top-1 right-1 p-1 bg-white rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {refImages.length < 3 && (
                      <div className="aspect-square rounded-xl border border-dashed border-pastel-border flex flex-col items-center justify-center text-pastel-muted text-[8px] font-bold">
                        <Plus className="w-3 h-3 mb-0.5" />
                        继续上传
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-pastel-muted py-6">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">上传参考图 (最多3张)</span>
                    <span className="text-[8px]">支持拖拽、复制粘贴</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Settings */}
          <div className="space-y-6 pt-4 border-t border-pastel-border">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Ratio className="w-3 h-3" />
                输出比例
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '标准' },
                  { value: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '修长' },
                  { value: AspectRatio.PORTRAIT_4_5, label: '4:5', desc: 'INS' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setOutputAspectRatio(item.value)}
                    className={`rounded-xl border py-2 text-center transition-all ${
                      outputAspectRatio === item.value
                        ? 'bg-pastel-pink border-pastel-border text-pastel-text shadow-sm'
                        : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <MonitorSmartphone className="w-3 h-3" />
                清晰度
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: ImageResolution.RES_2K, label: '2K 高清' },
                  { value: ImageResolution.RES_4K, label: '4K 极致 (推荐)' }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setResolution(item.value)}
                    className={`rounded-xl border py-2 text-center transition-all ${
                      resolution === item.value
                        ? 'bg-pastel-pink border-pastel-border text-pastel-text shadow-sm'
                        : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-pastel-border shadow-sm space-y-3">
              <label className="block text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', version: '3.1 Flash' },
                  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', version: '3.0 Pro' },
                  { id: 'gpt-image-2', label: 'GPT Image 2', version: 'Ultra Quality' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      selectedModel === m.id ? 'border-purple-300 bg-purple-50 ring-2 ring-purple-100' : 'border-gray-100 bg-pastel-bg'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {m.id === 'gpt-image-2' ? <Sparkles className="w-3 h-3 text-orange-500" /> : <BananaIcon className="w-3 h-3" />}
                      <span className={`text-[10px] font-black ${selectedModel === m.id ? 'text-purple-700' : 'text-pastel-text'}`}>{m.label}</span>
                    </div>
                    <span className="text-[8px] text-pastel-muted font-bold">{m.version}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 mt-auto border-t border-pastel-border bg-white/50 backdrop-blur-sm">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || sourceFiles.length === 0 || (!description.trim() && refImages.length === 0)}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 正在批量修改...</>
            ) : (
              <><Zap className="w-5 h-5 fill-white" /> 一键批量生成 ({sourceFiles.length}张)</>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white/30 backdrop-blur-[2px]">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-pastel-muted text-center max-w-sm mx-auto">
            <div className="w-24 h-24 mb-6 bg-white rounded-[40px] shadow-sm border border-pastel-border flex items-center justify-center opacity-40">
              <Scissors className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-pastel-text mb-2">等待上传并配置</h3>
            <p className="text-xs leading-relaxed">上传模特图并选择要替换的道具类别，系统将为您生成锁定模特与服装的局部修改效果。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((item, i) => (
              <div key={i} className="group relative bg-white rounded-3xl border border-pastel-border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-xl animate-in fade-in zoom-in-95 duration-300">
                <div className="aspect-[3/4] relative bg-pastel-bg overflow-hidden">
                  {item.status === 'generating' || item.status === 'pending' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-pastel-muted animate-pulse">Processing...</span>
                    </div>
                  ) : item.status === 'error' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <X className="w-8 h-8 text-red-500 mb-2" />
                      <span className="text-[10px] text-red-500 font-bold leading-tight">{item.error}</span>
                      <button onClick={() => handleRegenerateSingle(i)} className="mt-4 px-4 py-2 bg-pastel-bg rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-white transition-colors">Retry</button>
                    </div>
                  ) : (
                    <img src={item.url!} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="result" />
                  )}

                  {item.status === 'done' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <button onClick={() => setPreview({ src: item.url!, title: `${CATEGORIES.find(c => c.id === item.category)?.label}` })} className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                        <Maximize2 className="w-4 h-4 text-slate-800" />
                      </button>
                      <button onClick={() => handleRegenerateSingle(i)} className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                        <RefreshCw className="w-4 h-4 text-slate-800" />
                      </button>
                      <a href={item.url!} download="optimized.png" className="p-2.5 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 w-8 h-8 rounded-lg border border-white shadow-md overflow-hidden z-10">
                    <img src={item.sourceUrl} className="w-full h-full object-cover" alt="source" />
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between border-t border-pastel-border bg-white">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-pastel-pink rounded-md text-pastel-text">
                      {CATEGORIES.find(c => c.id === item.category)?.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-pastel-text leading-tight">{CATEGORIES.find(c => c.id === item.category)?.label.split(' ')[0]}修改</span>
                      <span className="text-[8px] text-pastel-muted truncate max-w-[100px]">{item.description}</span>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider ${item.status === 'done' ? 'text-green-500' : 'text-pastel-muted'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white">
              <span className="font-bold text-lg">{preview.title} 版本预览</span>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <img src={preview.src} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-4 border-white/10" alt="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchPropsModifierTab;
