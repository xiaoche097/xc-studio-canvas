import React, { useState, useRef, useEffect } from 'react';
import { Download, Loader2, Maximize2, Palette, Plus, RefreshCw, Trash2, Upload, X, Zap, Sparkles, Image as ImageIcon, Ratio, MonitorSmartphone, Cpu, Settings2 } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';

type ColorType = 'text' | 'hex' | 'image';

interface ColorEntry {
  id: string;
  type: ColorType;
  value: string; // text name, hex code, or base64
  label: string;
  previewUrl?: string; // For images
}

type ResultItem = {
  sourceUrl: string;
  sourceIndex: number;
  entry: ColorEntry;
  url: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
};

const BatchRecolorTab: React.FC = () => {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const MAX_SOURCES = 10;

  const [colors, setColors] = useState<ColorEntry[]>([]);
  
  const [newColorText, setNewColorText] = useState('');
  const [selectedHex, setSelectedHex] = useState('#fbbf24');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [userGuidance, setUserGuidance] = useState('');
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);

  const [isDraggingRef, setIsDraggingRef] = useState(false);

  // 自定义香蕉图标组件
  const BananaIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ color: '#fbbf24' }}>
      <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
      <path d="M15 3s-1.5 1-2 3" />
    </svg>
  );

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const remainingCount = MAX_SOURCES - sourceFiles.length;
    const filesToAdd = validFiles.slice(0, remainingCount);
    
    if (filesToAdd.length > 0) {
      setSourceFiles(prev => [...prev, ...filesToAdd]);
      setSourceUrls(prev => [...prev, ...filesToAdd.map(f => URL.createObjectURL(f))]);
      setResults([]);
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
    setResults([]);
  };

  const addTextColor = () => {
    if (newColorText.trim()) {
      const entry: ColorEntry = {
        id: Date.now().toString(),
        type: 'text',
        value: newColorText.trim(),
        label: newColorText.trim()
      };
      setColors([...colors, entry]);
      setNewColorText('');
    }
  };

  const addHexColor = () => {
    const entry: ColorEntry = {
      id: Date.now().toString(),
      type: 'hex',
      value: selectedHex,
      label: selectedHex.toUpperCase()
    };
    setColors([...colors, entry]);
  };

  const handleImageRefFiles = async (files: File[]) => {
    const file = files.find(f => f.type.startsWith('image/'));
    if (file) {
      const compressed = await compressImage(file, 512, 0.8);
      const entry: ColorEntry = {
        id: Date.now().toString(),
        type: 'image',
        value: compressed.base64,
        label: '参考图颜色',
        previewUrl: `data:image/jpeg;base64,${compressed.base64}`
      };
      setColors(prev => [...prev, entry]);
    }
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRef(false);
    if (e.dataTransfer.files) handleImageRefFiles(Array.from(e.dataTransfer.files));
  };

  const removeColor = (id: string) => {
    setColors(colors.filter(c => c.id !== id));
  };

  const buildRecolorPrompt = (entry: ColorEntry) => {
    let colorInstruction = '';
    if (entry.type === 'text') {
      colorInstruction = `TARGET COLOR: ${entry.value}.`;
    } else if (entry.type === 'hex') {
      colorInstruction = `TARGET COLOR: Exact HEX code ${entry.value}.`;
    } else {
      colorInstruction = `TARGET COLOR: Match the dominant color from Image 2 exactly.`;
    }

    return `[NANO BANANA - PRECISION RECOLORING]
- TASK: Change the color of the main garment in Image 1.
- ${colorInstruction}
- CONSTRAINT: Preserve the EXACT structure, fit, wrinkles, fabric texture, and background of Image 1.
- ISOLATION: Only change the color of the clothing. Do NOT change skin tone, face, hair, or environment.
- FIDELITY: Maintain photorealistic highlights and shadows on the new color surface.
- STYLE: Commercial product photography, high-end catalog quality.
${userGuidance ? `- USER SUPPLEMENT: ${userGuidance}` : ''}`;
  };

  const handleGenerate = async () => {
    if (sourceFiles.length === 0) {
      alert('请先上传至少一张服装原图');
      return;
    }
    if (colors.length === 0) {
      alert('请添加至少一种颜色');
      return;
    }

    setIsGenerating(true);
    
    // Build initial results matrix
    const initialResults: ResultItem[] = [];
    sourceUrls.forEach((sUrl, sIdx) => {
      colors.forEach(entry => {
        initialResults.push({
          sourceUrl: sUrl,
          sourceIndex: sIdx,
          entry,
          url: null,
          status: 'pending'
        });
      });
    });
    setResults(initialResults);

    // Process each source image
    for (let sIdx = 0; sIdx < sourceFiles.length; sIdx++) {
      const sourceFile = sourceFiles[sIdx];
      const sourceImage = await compressImage(sourceFile, 2048, 0.96);

      // Process each color for this source image
      for (let cIdx = 0; cIdx < colors.length; cIdx++) {
        const currentEntry = colors[cIdx];
        const resIdx = sIdx * colors.length + cIdx;
        
        setResults(prev => prev.map((r, idx) => idx === resIdx ? { ...r, status: 'generating' } : r));

        try {
          const prompt = buildRecolorPrompt(currentEntry);
          const inputImages = [{ base64: sourceImage.base64, mimeType: sourceImage.mime }];
          
          if (currentEntry.type === 'image') {
            inputImages.push({ base64: currentEntry.value, mimeType: 'image/jpeg' });
          }

          const res = await generateImageToImage(inputImages, prompt, {
            modelId: selectedModel,
            aspectRatio: outputAspectRatio,
            resolution,
            workflowHint: 'clothing-modification',
            negativePrompt: 'color bleeding, unnatural color, simplified texture, blurred details, changed garment structure, distorted face, changed background'
          });

          if (res && res.length > 0) {
            setResults(prev => prev.map((r, idx) => idx === resIdx ? { ...r, status: 'done', url: res[0] } : r));
          } else {
            throw new Error('No image returned');
          }
        } catch (err) {
          console.error(err);
          setResults(prev => prev.map((r, idx) => idx === resIdx ? { ...r, status: 'error', error: getErrorMessage(err) } : r));
        }
      }
    }
    setIsGenerating(false);
  };

  const handleRegenerateSingle = async (index: number) => {
    const item = results[index];
    const sourceFile = sourceFiles[item.sourceIndex];
    if (!sourceFile) return;
    
    setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'generating', url: null } : r));

    try {
      const sourceImage = await compressImage(sourceFile, 2048, 0.96);
      const inputImages = [{ base64: sourceImage.base64, mimeType: sourceImage.mime }];
      if (item.entry.type === 'image') {
        inputImages.push({ base64: item.entry.value, mimeType: 'image/jpeg' });
      }
      const prompt = buildRecolorPrompt(item.entry);
      
      const res = await generateImageToImage(inputImages, prompt, {
        modelId: selectedModel,
        aspectRatio: outputAspectRatio,
        resolution,
        workflowHint: 'clothing-modification',
        negativePrompt: 'color bleeding, unnatural color, simplified texture, blurred details, changed garment structure, distorted face, changed background'
      });

      if (res && res.length > 0) {
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'done', url: res[0] } : r));
      }
    } catch (err) {
      setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'error', error: getErrorMessage(err) } : r));
    }
  };

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden text-pastel-text">
      {/* Sidebar */}
      <div className="w-[420px] border-r border-pastel-border bg-pastel-card flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Palette className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Batch Recolor</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">批量服装改色</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              支持批量上传多张服装原图（最多 10 张），每张图将生成定义好的所有颜色版本。
            </p>
          </div>

          {/* Multi-Source Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-3 h-3" />
                1. 原图上传 ({sourceFiles.length}/{MAX_SOURCES})
              </h3>
              <span className="text-[10px] text-pastel-muted font-medium">支持拖拽与粘贴</span>
            </div>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="space-y-4"
            >
              {sourceUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {sourceUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden group bg-white">
                      <img src={url} className="w-full h-full object-cover" alt={`source-${idx}`} />
                      <button 
                        onClick={() => removeSource(idx)}
                        className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {sourceFiles.length < MAX_SOURCES && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-pastel-border flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-all bg-white/50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {sourceFiles.length === 0 && (
                <label className="flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group">
                  <input type="file" multiple className="hidden" onChange={handleSourceChange} />
                  <div className="w-12 h-12 mb-3 bg-pastel-bg rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold">批量上传原图</span>
                  <span className="text-[10px] text-pastel-muted mt-1">支持拖拽或 Ctrl+V 粘贴</span>
                </label>
              )}
              
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleSourceChange} />
            </div>
          </div>

          {/* Color List */}
          <div className="space-y-5">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3 h-3" />
              2. 目标颜色 (Color Palette)
            </h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newColorText}
                  onChange={(e) => setNewColorText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTextColor()}
                  placeholder="文字描述：如 '莫兰迪绿'..."
                  className="flex-1 px-4 py-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all"
                />
                <button onClick={addTextColor} className="p-2.5 bg-pastel-highlight text-white rounded-xl hover:shadow-lg transition-all active:scale-95">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-pastel-border rounded-xl">
                  <input
                    type="color"
                    value={selectedHex}
                    onChange={(e) => setSelectedHex(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 p-0 cursor-pointer overflow-hidden bg-transparent"
                  />
                  <span className="text-[10px] font-mono font-bold text-pastel-muted">{selectedHex.toUpperCase()}</span>
                  <button onClick={addHexColor} className="ml-auto text-[10px] font-black text-pastel-highlight uppercase tracking-wider hover:underline">
                    添加色值
                  </button>
                </div>
                <button 
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
                  onDragLeave={() => setIsDraggingRef(false)}
                  onDrop={handleRefDrop}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.onchange = (e: any) => { if(e.target.files) handleImageRefFiles(Array.from(e.target.files)); };
                    input.click();
                  }}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all group ${isDraggingRef ? 'bg-pastel-highlight/10 border-pastel-highlight' : 'bg-white border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  <ImageIcon className={`w-4 h-4 ${isDraggingRef ? 'text-pastel-highlight' : 'text-pastel-muted group-hover:text-pastel-highlight'}`} />
                  <span className="text-[10px] font-bold">参考图 (拖拽上传)</span>
                </button>
              </div>
            </div>

            {/* Visual Color Grid */}
            <div className="grid grid-cols-4 gap-3">
              {colors.map((c) => (
                <div key={c.id} className="group relative aspect-square bg-white border border-pastel-border rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all hover:border-pastel-highlight/40 shadow-sm animate-in zoom-in-95 duration-200">
                  {c.type === 'hex' ? (
                    <div className="w-full h-full flex flex-col p-1.5">
                      <div className="flex-1 rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: c.value }} />
                      <span className="text-[8px] font-mono font-bold text-center mt-1 text-pastel-muted">{c.label}</span>
                    </div>
                  ) : c.type === 'image' ? (
                    <div className="w-full h-full flex flex-col p-1.5">
                      <div className="flex-1 rounded-xl overflow-hidden border border-pastel-border shadow-inner">
                        <img src={c.previewUrl} className="w-full h-full object-cover" alt="ref" />
                      </div>
                      <span className="text-[8px] font-bold text-center mt-1 text-pastel-muted truncate">参考图</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                      <Palette className="w-5 h-5 text-pastel-highlight/60 mb-1" />
                      <span className="text-[9px] font-black leading-tight text-pastel-text line-clamp-2">{c.label}</span>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => removeColor(c.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow-md border border-pastel-border flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {colors.length === 0 && (
                <div className="col-span-4 py-8 border-2 border-dashed border-pastel-border rounded-2xl flex flex-col items-center justify-center text-pastel-muted/40">
                  <Sparkles className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">暂无颜色，请从上方添加</span>
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-6 pt-4 border-t border-pastel-border">
            {/* 输出比例 */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Ratio className="w-3 h-3" />
                输出比例 (ASPECT RATIO)
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
                    className={`relative rounded-xl border py-2.5 text-center transition-all ${
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

            {/* 清晰度 */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <MonitorSmartphone className="w-3 h-3" />
                清晰度 (RESOLUTION)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: ImageResolution.RES_1K, label: '1K', desc: '快速' },
                  { value: ImageResolution.RES_2K, label: '2K', desc: '高清' },
                  { value: ImageResolution.RES_4K, label: '4K', desc: '超清' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setResolution(item.value)}
                    className={`relative rounded-xl border py-2.5 text-center transition-all ${
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
            </div>

            {/* 内容补充 */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                内容补充 (CONTENT SUPPLEMENT)
              </h3>
              <div className="relative group">
                <textarea
                  value={userGuidance}
                  onChange={(e) => setUserGuidance(e.target.value)}
                  placeholder="例如：保持领口V领不变、去掉裙摆边框、增加面料丝绸质感..."
                  className="w-full h-24 p-3 text-xs bg-white border border-pastel-border rounded-xl focus:ring-2 focus:ring-pastel-highlight/20 focus:border-pastel-highlight outline-none transition-all resize-none placeholder:text-pastel-muted/50 shadow-sm"
                />
              </div>
            </div>

            {/* 图像模型选择 */}
            <div className="bg-white p-4 rounded-2xl border border-pastel-border shadow-sm space-y-3">
              <label className="block text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BananaIcon className="w-3.5 h-3.5" />
                    <span className={`text-[10px] font-black ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Nano Banana 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted font-bold">3.1 Flash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BananaIcon className="w-3.5 h-3.5" />
                    <span className={`text-[10px] font-black ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Nano Banana Pro
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted font-bold">3.0 Pro</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-6 mt-auto border-t border-pastel-border bg-white/50 backdrop-blur-sm">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || sourceFiles.length === 0 || colors.length === 0}
            className="w-full py-4 bg-gradient-to-r from-pastel-highlight to-orange-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-pastel-highlight/20 hover:shadow-pastel-highlight/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在批量改色...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-white" />
                生成所有版本 ({sourceFiles.length * colors.length}张)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-pastel-muted">
            <div className="w-32 h-32 mb-8 bg-white rounded-[40px] shadow-sm border-2 border-dashed border-pastel-border flex items-center justify-center opacity-40">
              <Palette className="w-16 h-16" />
            </div>
            <h3 className="text-xl font-bold text-pastel-text mb-2">等待开始批量改色</h3>
            <p className="text-xs max-w-xs text-center leading-relaxed">
              上传多张服装原图并定义颜色，系统将自动为每张图生成全套颜色方案。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((item, i) => (
              <div key={i} className="group relative bg-white rounded-3xl border border-pastel-border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-xl animate-in fade-in zoom-in-95 duration-300">
                <div className="aspect-[3/4] relative bg-pastel-bg overflow-hidden">
                  {item.status === 'generating' || item.status === 'pending' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin" />
                      <div className="text-center">
                        <p className="text-[10px] font-black text-pastel-muted uppercase tracking-widest animate-pulse">
                          {item.entry.label}
                        </p>
                        <p className="text-[8px] text-pastel-muted mt-1">Source {item.sourceIndex + 1}</p>
                      </div>
                    </div>
                  ) : item.status === 'error' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <X className="w-8 h-8 text-red-500 mb-2" />
                      <span className="text-xs text-red-500 font-medium">{item.error}</span>
                      <button onClick={() => handleRegenerateSingle(i)} className="mt-4 px-4 py-2 bg-pastel-bg rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-white transition-colors">
                        Retry
                      </button>
                    </div>
                  ) : (
                    <img src={item.url!} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={`result-${i}`} />
                  )}

                  {item.status === 'done' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <button onClick={() => setPreview({ src: item.url!, title: item.entry.label })} className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                        <Maximize2 className="w-4 h-4 text-pastel-text" />
                      </button>
                      <button onClick={() => handleRegenerateSingle(i)} className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                        <RefreshCw className="w-4 h-4 text-pastel-text" />
                      </button>
                      <a href={item.url!} download={`recolor-${item.entry.label}.png`} className="p-2.5 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                  
                  {/* Source Thumbnail for Reference */}
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-lg border border-white shadow-md overflow-hidden z-10 opacity-60 group-hover:opacity-100 transition-opacity">
                    <img src={item.sourceUrl} className="w-full h-full object-cover" alt="source-thumb" />
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between border-t border-pastel-border bg-white">
                  <div className="flex items-center gap-2">
                    {item.entry.type === 'hex' ? (
                      <div className="w-3 h-3 rounded-full border border-black/5" style={{ backgroundColor: item.entry.value }} />
                    ) : item.entry.type === 'image' ? (
                      <div className="w-4 h-4 rounded border border-black/5 overflow-hidden">
                        <img src={item.entry.previewUrl} className="w-full h-full object-cover" alt="ref" />
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-pastel-highlight shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                    )}
                    <span className="text-xs font-black text-pastel-text">{item.entry.label}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${item.status === 'done' ? 'text-green-500' : 'text-pastel-muted'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white">
              <span className="font-bold text-lg">{preview.title} 版本</span>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <img src={preview.src} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" alt="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchRecolorTab;
