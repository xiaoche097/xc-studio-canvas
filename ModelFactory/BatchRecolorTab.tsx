import React, { useState, useRef, useEffect } from 'react';
import { Download, Info, Loader2, Maximize2, Palette, Plus, RefreshCw, Trash2, Upload, X, Zap, Sparkles, Image as ImageIcon, Ratio, MonitorSmartphone, Cpu, Settings2, Crop } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { DollImageEditor, EditorBox } from '../DollFactory/components/DollImageEditor';
import { storageService } from '../services/storageService';

type ColorType = 'text' | 'hex' | 'image';
type RecolorMode = 'single-multi' | 'batch-source' | 'matrix';

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
  const MAX_REF_IMAGES = 10;

  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [recolorMode, setRecolorMode] = useState<RecolorMode>('single-multi');
  const [showModeHelp, setShowModeHelp] = useState(false);
  
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isRefPasteTarget, setIsRefPasteTarget] = useState(false);

  const modeOptions: Array<{ id: RecolorMode; title: string; desc: string }> = [
    { id: 'single-multi', title: '\u5355\u56fe\u591a\u8272', desc: '1 \u5f20\u539f\u56fe\u751f\u6210\u591a\u79cd\u989c\u8272' },
    { id: 'batch-source', title: '\u6279\u91cf\u539f\u56fe', desc: '\u591a\u5f20\u539f\u56fe\u7edf\u4e00\u6539\u8272' },
    { id: 'matrix', title: '\u77e9\u9635\u6a21\u5f0f', desc: '\u591a\u56fe x \u591a\u8272\u5168\u7ec4\u5408' },
  ];

  const maxSourcesForMode = recolorMode === 'single-multi' ? 1 : MAX_SOURCES;
  const generationCount = sourceFiles.length * colors.length;
  const modeCopy = {
    'single-multi': {
      title: '\u5355\u56fe\u591a\u8272\u51fa\u6b3e',
      description: '\u4e0a\u4f20 1 \u5f20\u670d\u88c5\u539f\u56fe\uff0c\u518d\u6dfb\u52a0\u591a\u4e2a\u76ee\u6807\u989c\u8272\uff0c\u7cfb\u7edf\u4f1a\u5206\u522b\u751f\u6210\u5bf9\u5e94\u989c\u8272\u7248\u672c\u3002',
      uploadEmptyTitle: '\u4e0a\u4f20 1 \u5f20\u539f\u56fe',
      uploadHint: '\u5355\u56fe\u591a\u8272\u6a21\u5f0f\u4f1a\u4ee5\u6700\u65b0\u4e0a\u4f20\u7684 1 \u5f20\u56fe\u4e3a\u51c6',
      button: `\u751f\u6210\u591a\u8272\u7248\u672c (${generationCount}\u5f20)`,
      emptyTitle: '\u7b49\u5f85\u751f\u6210\u591a\u8272\u7248\u672c',
      emptyDesc: '\u4e0a\u4f20 1 \u5f20\u670d\u88c5\u539f\u56fe\u5e76\u6dfb\u52a0\u591a\u4e2a\u989c\u8272\uff0c\u7cfb\u7edf\u4f1a\u8f93\u51fa\u540c\u4e00\u5f20\u56fe\u7684\u591a\u79cd\u989c\u8272\u7248\u672c\u3002',
    },
    'batch-source': {
      title: '\u6279\u91cf\u670d\u88c5\u6539\u8272',
      description: '\u4e0a\u4f20\u591a\u5f20\u670d\u88c5\u539f\u56fe\u5e76\u6307\u5b9a\u76ee\u6807\u989c\u8272\uff0c\u9002\u5408\u628a\u4e00\u7ec4\u56fe\u7247\u7edf\u4e00\u6539\u6210\u540c\u4e00\u4e2a\u989c\u8272\u3002',
      uploadEmptyTitle: '\u6279\u91cf\u4e0a\u4f20\u539f\u56fe',
      uploadHint: '\u5efa\u8bae\u53ea\u6dfb\u52a0 1 \u4e2a\u989c\u8272\uff1b\u591a\u4e2a\u989c\u8272\u4f1a\u751f\u6210\u591a\u7ec4\u7ed3\u679c',
      button: `\u6279\u91cf\u7edf\u4e00\u6539\u8272 (${generationCount}\u5f20)`,
      emptyTitle: '\u7b49\u5f85\u5f00\u59cb\u6279\u91cf\u6539\u8272',
      emptyDesc: '\u4e0a\u4f20\u591a\u5f20\u670d\u88c5\u539f\u56fe\u5e76\u5b9a\u4e49\u989c\u8272\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u4e3a\u6bcf\u5f20\u56fe\u751f\u6210\u6539\u8272\u7ed3\u679c\u3002',
    },
    matrix: {
      title: '\u77e9\u9635\u6539\u8272\u65b9\u6848',
      description: '\u4e0a\u4f20\u591a\u5f20\u539f\u56fe\u548c\u591a\u4e2a\u76ee\u6807\u989c\u8272\uff0c\u7cfb\u7edf\u4f1a\u751f\u6210\u539f\u56fe\u6570\u91cf x \u989c\u8272\u6570\u91cf\u7684\u5168\u90e8\u7ec4\u5408\u3002',
      uploadEmptyTitle: '\u4e0a\u4f20\u77e9\u9635\u539f\u56fe',
      uploadHint: '\u9002\u5408\u4e00\u6b21\u751f\u6210\u5b8c\u6574\u8272\u5361\u7ec4\u5408',
      button: `\u751f\u6210\u77e9\u9635\u65b9\u6848 (${generationCount}\u5f20)`,
      emptyTitle: '\u7b49\u5f85\u751f\u6210\u77e9\u9635\u65b9\u6848',
      emptyDesc: '\u4e0a\u4f20\u591a\u5f20\u539f\u56fe\u5e76\u6dfb\u52a0\u591a\u4e2a\u989c\u8272\uff0c\u7cfb\u7edf\u4f1a\u751f\u6210\u6bcf\u5f20\u539f\u56fe\u5bf9\u5e94\u6bcf\u4e2a\u989c\u8272\u7684\u5168\u90e8\u7ec4\u5408\u3002',
    },
  }[recolorMode];

  const sanitizeFilePart = (value: string) => value.replace(/[\\/:*?"<>|#]+/g, '-').replace(/\s+/g, '-').slice(0, 40) || 'color';

  const handleModeChange = (mode: RecolorMode) => {
    setRecolorMode(mode);
    setResults([]);
    if (mode === 'single-multi' && sourceFiles.length > 1) {
      sourceUrls.slice(1).forEach(url => URL.revokeObjectURL(url));
      setSourceFiles(prev => prev.slice(0, 1));
      setSourceUrls(prev => prev.slice(0, 1));
    }
  };

  // 自定义香蕉图标组件
  const BananaIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ color: '#fbbf24' }}>
      <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
      <path d="M15 3s-1.5 1-2 3" />
    </svg>
  );

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (recolorMode === 'single-multi') {
      const latestFile = validFiles[validFiles.length - 1];
      if (!latestFile) return;
      sourceUrls.forEach(url => URL.revokeObjectURL(url));
      setSourceFiles([latestFile]);
      setSourceUrls([URL.createObjectURL(latestFile)]);
      setResults([]);
      return;
    }

    const remainingCount = maxSourcesForMode - sourceFiles.length;
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

  const removeSource = (index: number) => {
    URL.revokeObjectURL(sourceUrls[index]);
    setSourceFiles(prev => prev.filter((_, i) => i !== index));
    setSourceUrls(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const handleApplyCrop = (base64: string) => {
    if (editingIndex === null) return;
    
    // Convert base64 to File
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const croppedFile = new File([u8arr], `cropped-${Date.now()}.png`, { type: mime });
    
    const newFiles = [...sourceFiles];
    newFiles[editingIndex] = croppedFile;
    setSourceFiles(newFiles);
    
    const newUrls = [...sourceUrls];
    URL.revokeObjectURL(newUrls[editingIndex]);
    newUrls[editingIndex] = URL.createObjectURL(croppedFile);
    setSourceUrls(newUrls);
    
    setEditingIndex(null);
    setResults([]);
  };

  const handleDownloadAll = () => {
    const doneResults = results.filter(r => r.status === 'done' && r.url);
    if (doneResults.length === 0) return;
    
    doneResults.forEach((res, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = res.url!;
        link.download = `recolor-source-${res.sourceIndex + 1}-${sanitizeFilePart(res.entry.label)}-${i + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, i * 300);
    });
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
    const existingImageEntries = colors.filter(c => c.type === 'image');
    if (existingImageEntries.length >= MAX_REF_IMAGES) {
      alert(`最多支持 ${MAX_REF_IMAGES} 张调色参考图`);
      return;
    }

    const remainingSlots = MAX_REF_IMAGES - existingImageEntries.length;
    const validFiles = files.filter(f => f.type.startsWith('image/')).slice(0, remainingSlots);
    
    if (validFiles.length === 0) return;

    const newEntries: ColorEntry[] = [];
    for (const file of validFiles) {
      const compressed = await compressImage(file, 512, 0.8);
      newEntries.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        value: compressed.base64,
        label: '参考图颜色',
        previewUrl: `data:image/jpeg;base64,${compressed.base64}`
      });
    }
    setColors(prev => [...prev, ...newEntries]);
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRef(false);
    setIsRefPasteTarget(true);
    if (e.dataTransfer.files) handleImageRefFiles(Array.from(e.dataTransfer.files));
  };

  useImagePaste((files) => {
    if (isRefPasteTarget) {
      handleImageRefFiles(files);
    } else {
      handleFiles(files);
    }
  });

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

            // Save to recent projects
            try {
              await storageService.saveProject({
                id: crypto.randomUUID(),
                type: 'MODEL',
                createdAt: Date.now(),
                thumbnail: res[0],
                assets: {
                  original: [sourceUrls[sIdx]],
                  generated: res,
                },
                metadata: {
                  subType: 'batch_recolor',
                  colorEntry: currentEntry,
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
            <div className="rounded-2xl border border-pastel-border bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-pastel-text">{modeCopy.title}</h3>
                  <p className="text-[10px] text-pastel-muted mt-0.5">{modeCopy.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModeHelp(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pastel-bg text-[10px] font-black text-pastel-muted hover:text-pastel-highlight transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  模式说明
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {modeOptions.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleModeChange(mode.id)}
                    className={`rounded-xl border p-2 text-left transition-all ${
                      recolorMode === mode.id
                        ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight shadow-sm'
                        : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-pastel-highlight/40'
                    }`}
                  >
                    <span className="block text-[11px] font-black text-pastel-text">{mode.title}</span>
                    <span className="mt-1 block text-[8px] leading-snug opacity-70">{mode.desc}</span>
                  </button>
                ))}
              </div>
              {recolorMode === 'batch-source' && colors.length > 1 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-bold text-orange-600">
                  当前已添加多个颜色，将按矩阵方式生成 {generationCount} 张结果。
                </div>
              )}
            </div>
          </div>

          {/* Multi-Source Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-3 h-3" />
                1. 原图上传 ({sourceFiles.length}/{maxSourcesForMode})
              </h3>
              <span className="text-[10px] text-pastel-muted font-medium">{modeCopy.uploadHint}</span>
            </div>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onMouseEnter={() => setIsRefPasteTarget(false)}
              onFocus={() => setIsRefPasteTarget(false)}
              className="space-y-4"
            >
              {sourceUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {sourceUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden group bg-white shadow-sm">
                      <img src={url} className="w-full h-full object-cover" alt={`source-${idx}`} />
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingIndex(idx)}
                          className="p-1.5 bg-white/95 rounded-full text-pastel-highlight shadow-sm hover:scale-110 transition-transform"
                          title="裁切图片"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => removeSource(idx)}
                          className="p-1.5 bg-white/95 rounded-full text-red-500 shadow-sm hover:scale-110 transition-transform"
                          title="删除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sourceFiles.length < maxSourcesForMode && (
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
                  <input type="file" multiple={recolorMode !== 'single-multi'} className="hidden" onChange={handleSourceChange} />
                  <div className="w-12 h-12 mb-3 bg-pastel-bg rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold">{modeCopy.uploadEmptyTitle}</span>
                  <span className="text-[10px] text-pastel-muted mt-1">支持拖拽或 Ctrl+V 粘贴</span>
                </label>
              )}
              
              <input type="file" multiple={recolorMode !== 'single-multi'} ref={fileInputRef} className="hidden" onChange={handleSourceChange} />
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
                  className="flex-1 px-4 py-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all shadow-sm"
                />
                <button onClick={addTextColor} className="p-2.5 bg-pastel-highlight text-white rounded-xl hover:shadow-lg transition-all active:scale-95">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-pastel-border rounded-xl shadow-sm">
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
            </div>

            {/* 调色参考图 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  调色参考图 ({colors.filter(c => c.type === 'image').length}/{MAX_REF_IMAGES})
                </h4>
                <span className="text-[9px] text-pastel-muted font-medium">支持拖拽、点击和 Ctrl+V 粘贴</span>
              </div>
              
              <div
                className="grid grid-cols-3 gap-3"
                onMouseEnter={() => setIsRefPasteTarget(true)}
                onFocus={() => setIsRefPasteTarget(true)}
              >
                {colors.filter(c => c.type === 'image').map((c) => (
                  <div key={c.id} className="relative aspect-square rounded-2xl border border-pastel-border overflow-hidden bg-white group shadow-sm animate-in zoom-in-95 duration-200">
                    <img src={c.previewUrl} className="w-full h-full object-cover" alt="ref" />
                    <button 
                      onClick={() => removeColor(c.id)}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 shadow-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {colors.filter(c => c.type === 'image').length < MAX_REF_IMAGES && (
                  <button 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
                    onDragLeave={() => setIsDraggingRef(false)}
                    onDrop={handleRefDrop}
                    onFocus={() => setIsRefPasteTarget(true)}
                    onClick={() => {
                      setIsRefPasteTarget(true);
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = "image/*";
                      input.onchange = (e: any) => { if(e.target.files) handleImageRefFiles(Array.from(e.target.files)); };
                      input.click();
                    }}
                    className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all group ${isDraggingRef ? 'bg-pastel-highlight/10 border-pastel-highlight scale-[1.02]' : 'bg-white border-pastel-border hover:border-pastel-highlight/40 hover:bg-pastel-highlight/5'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-pastel-bg flex items-center justify-center text-pastel-muted mb-1 transition-colors group-hover:bg-pastel-highlight/10 group-hover:text-pastel-highlight">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-pastel-muted group-hover:text-pastel-highlight transition-colors">添加参考图</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Color Grid */}
            <div className="grid grid-cols-4 gap-3">
              {colors.filter(c => c.type !== 'image').map((c) => (
                <div key={c.id} className="group relative aspect-square bg-white border border-pastel-border rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all hover:border-pastel-highlight/40 shadow-sm animate-in zoom-in-95 duration-200">
                  {c.type === 'hex' ? (
                    <div className="w-full h-full flex flex-col p-1.5">
                      <div className="flex-1 rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: c.value }} />
                      <span className="text-[8px] font-mono font-bold text-center mt-1 text-pastel-muted">{c.label}</span>
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
              
              {colors.filter(c => c.type !== 'image').length === 0 && (
                <div className="col-span-4 py-8 border-2 border-dashed border-pastel-border rounded-2xl flex flex-col items-center justify-center text-pastel-muted/40 bg-white/30">
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
                  { value: AspectRatio.SQUARE, label: '1:1', desc: '方图' },
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
                    <span className={`text-[9px] font-black ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Nano Banana 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted font-bold">3.1 Flash</span>
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
                    <span className={`text-[9px] font-black ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Banana Pro
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted font-bold">3.0 Pro</span>
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
                    <span className={`text-[9px] font-black ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      GPT Image 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted font-bold">Ultra Quality</span>
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
                <span>{modeCopy.button}</span>
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
            <h3 className="text-xl font-bold text-pastel-text mb-2">{modeCopy.emptyTitle}</h3>
            <p className="text-xs max-w-xs text-center leading-relaxed">
              {modeCopy.emptyDesc}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-pastel-border shadow-sm sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="bg-pastel-highlight/10 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-pastel-highlight" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-pastel-text">生成结果</h3>
                  <p className="text-[10px] text-pastel-muted">共 {results.length} 张图片，已完成 {results.filter(r => r.status === 'done').length} 张</p>
                </div>
              </div>
              
              <button 
                onClick={handleDownloadAll}
                disabled={results.filter(r => r.status === 'done').length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-pastel-text text-white rounded-xl text-xs font-black hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-black/5"
              >
                <Download className="w-4 h-4" />
                全部下载
              </button>
            </div>
            
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
                      <a href={item.url!} download={`recolor-source-${item.sourceIndex + 1}-${sanitizeFilePart(item.entry.label)}.png`} className="p-2.5 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white">
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
          </div>
        )}
      </div>

      {/* Mode Help */}
      {showModeHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md" onClick={() => setShowModeHelp(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-pastel-border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-pastel-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pastel-highlight/10 text-pastel-highlight flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-pastel-text">批量改色模式说明</h3>
                  <p className="text-xs text-pastel-muted">选择适合的输入方式，生成逻辑会自动计算总张数。</p>
                </div>
              </div>
              <button onClick={() => setShowModeHelp(false)} className="p-2 rounded-full hover:bg-pastel-bg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid gap-3">
              {[
                {
                  title: '单图多色',
                  formula: '1 张原图 x 多个颜色',
                  desc: '适合给同一件服装快速出一组色卡。上传第二张图时会以最新图片替换当前原图。',
                },
                {
                  title: '批量原图',
                  formula: '多张原图 x 1 个颜色',
                  desc: '适合把一批服装图统一改成同一个目标色。若添加多个颜色，会提示并按矩阵方式生成。',
                },
                {
                  title: '矩阵模式',
                  formula: '多张原图 x 多个颜色',
                  desc: '适合一次生成完整组合，例如 3 张原图和 4 个颜色会输出 12 张图片。',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-pastel-border bg-pastel-bg/40 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="text-sm font-black text-pastel-text">{item.title}</h4>
                    <span className="text-[10px] font-black text-pastel-highlight bg-white px-2 py-1 rounded-full border border-pastel-border">{item.formula}</span>
                  </div>
                  <p className="text-xs text-pastel-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 bg-orange-50 border-t border-orange-100 text-xs text-orange-700 leading-relaxed">
              颜色可以用文字描述、HEX 色值或调色参考图添加；生成数量越多，等待时间越久，下载文件名会包含原图序号和颜色名。
            </div>
          </div>
        </div>
      )}

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

      {/* Editor Modal */}
      {editingIndex !== null && (
        <DollImageEditor
          initialImage={sourceUrls[editingIndex]}
          initialBoxes={[]}
          onClose={() => setEditingIndex(null)}
          onApplyCrop={handleApplyCrop}
          onApplyBoxes={() => {}}
        />
      )}
    </div>
  );
};

export default BatchRecolorTab;
