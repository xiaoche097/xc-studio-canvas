import React, { useState, useRef } from 'react';
import { generateImageToImage, blobToBase64, optimizePrompt, editGeneratedImage, optimizeImageToImagePrompt } from '../services/geminiService';
import { StyleModelModal } from './StyleModelModal';
import { STYLE_PRESETS, StylePreset } from '../constants/stylePresets';
import { getErrorMessage } from '../utils/apiHelpers';
import { storageService } from '../../services/storageService';
import { Layers, Upload, Loader2, AlertCircle, X, Sparkles, Key, Image as ImageIcon, Wand2, Monitor, Grid, Maximize2, Download, RefreshCw, Eye, EyeOff, MessageCircle, Cpu } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';

interface EditPoint {
  id: number;
  x: number;
  y: number;
  snapshot?: string;
}

// 自定义香蕉图标组件
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

const FusionTab: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refinement State
  const [hasPolished, setHasPolished] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');

  // Edit & Interactive States
  const [editPrompts, setEditPrompts] = useState<Record<number, string>>({});
  const [isEditing, setIsEditing] = useState<Record<number, boolean>>({});
  const [selectedPoints, setSelectedPoints] = useState<Record<number, EditPoint[]>>({});
  const [editRefImages, setEditRefImages] = useState<Record<number, File[]>>({}); // NEW: Ref images for edit
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Comparison State
  const [originalImages, setOriginalImages] = useState<Record<number, string>>({});
  const [isComparing, setIsComparing] = useState<Record<number, boolean>>({});

  // Model Selection State
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image-preview');

  // Style Model State
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));

    if (selectedFiles.length + validFiles.length > 10) {
      setError("最多只能上传10张参考图片");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);

    // Create object URLs for preview
    const newUrls = validFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newUrls]);

    // Clear previous results when new input is added
    if (generatedImages.length > 0) {
      setGeneratedImages([]);
      setSelectedPoints({});
      setEditPrompts({});
      setEditRefImages({}); // Clear edit refs
    }
  };

  // ... (removeFile remains same, see context) ...

  const handleEditRefUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(f => f.type.startsWith('image/'));

      setEditRefImages(prev => {
        const current = prev[index] || [];
        if (current.length + validFiles.length > 3) { // Max 3 ref images for edit
          // Could show error toast here
          return prev;
        }
        return { ...prev, [index]: [...current, ...validFiles] };
      });
    }
  };

  const removeEditRefImage = (index: number, refIndex: number) => {
    setEditRefImages(prev => {
      const current = prev[index] || [];
      const updated = [...current];
      updated.splice(refIndex, 1);
      return { ...prev, [index]: updated };
    });
  };


  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);

    const newUrls = [...previewUrls];
    URL.revokeObjectURL(newUrls[index]); // Clean up memory
    newUrls.splice(index, 1);
    setPreviewUrls(newUrls);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Optimization: Add a ghost image or styling if needed
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newFiles = [...selectedFiles];
    const newUrls = [...previewUrls];

    // Swap files
    const draggedFile = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIndex, 0, draggedFile);

    // Swap URLs
    const draggedUrl = newUrls[draggedIndex];
    newUrls.splice(draggedIndex, 1);
    newUrls.splice(targetIndex, 0, draggedUrl);

    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    setDraggedIndex(null);
  };

  // Auto-Optimize State
  const [isAutoOptimize, setIsAutoOptimize] = useState(true);

  const handleGenerate = async () => {
    if (!description && !selectedStyle) return; // Allow empty description if style is selected
    setError(null);
    setProgress('');
    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      // Step 0: Auto-Optimize Prompt (Nano Banana Agent)
      let finalPrompt = description;
      if (isAutoOptimize && description.trim()) {
        setProgress('🧠 AI 正在思考优化提示词 (Thinking...)...');
        try {
          // Prepare context for optimization
          let refImagesData: { base64: string; mimeType: string }[] | undefined = undefined;
          if (selectedFiles.length > 0) {
            const imagesToProcess = selectedFiles.slice(0, 4);
            refImagesData = await Promise.all(imagesToProcess.map(async file => ({
              base64: await blobToBase64(file),
              mimeType: file.type
            })));
          }

          let optimized = '';
          // If reference images are present, use the specialized Img2Img optimizer
          if (refImagesData && refImagesData.length > 0) {
            optimized = await optimizeImageToImagePrompt(description);
          } else {
            // Otherwise use the standard Txt2Img optimizer (Precision Expert)
            optimized = await optimizePrompt(description, refImagesData);
          }
          finalPrompt = optimized;
          // Note: We don't overwrite with selectedStyle prompt here as optimization happened after.
          // But if user chose a style, we might want to ensure the style constraints are preserved.
          setDescription(optimized); // Update UI to show the magic

          await new Promise(resolve => setTimeout(resolve, 800)); // Small delay for user to see the change
        } catch (e) {
          console.warn("Auto-optimization failed, proceeding with original prompt", e);
        }
      }

      // Step 1: 压缩图片
      setProgress('正在压缩图片...');
      const imagePromises = selectedFiles.map(async file => ({
        base64: await blobToBase64(file),
        mimeType: file.type
      }));

      const images = await Promise.all(imagePromises);

      // Step 2: 发送到AI服务器
      setProgress(`正在生成图片 (预计30-90秒)...`);

      // Inject Style Prompt if selected
      let generationPrompt = finalPrompt;
      let negativePrompt = undefined;
      
      if (selectedStyle) {
          const stylePrompt = images.length > 0 ? selectedStyle.promptWithRef : selectedStyle.prompt;
          // Replace [SUBJECT] in style prompt if it exists, otherwise append
          if (stylePrompt.includes('[SUBJECT]')) {
             generationPrompt = stylePrompt.replace('[SUBJECT]', finalPrompt || 'a professional subject');
          } else {
             generationPrompt = finalPrompt ? `${finalPrompt}, ${stylePrompt}` : stylePrompt;
          }
          negativePrompt = selectedStyle.negativePrompt;
      }

      const results = await generateImageToImage(images, generationPrompt, { 
        aspectRatio, 
        resolution,
        modelId: selectedModel,
        negativePrompt,
        workflowHint: selectedStyle?.id?.includes('strict-angle') ? 'strict-geometry-lock' : undefined
      });

      setProgress('生成完成！');
      setGeneratedImages(results);

      // Save to Project History
      results.forEach((url, i) => {
        storageService.saveProject({
          id: Date.now().toString() + i, // Ensure unique ID
          type: 'FUSION',
          createdAt: Date.now(),
          thumbnail: url,
          assets: {
            generated: [url],
            original: selectedFiles.map(f => f.name)
          },
          metadata: {
            prompt: finalPrompt, // Save the optimized prompt
            params: { aspectRatio, resolution },
            refImageCount: selectedFiles.length,
            autoOptimized: isAutoOptimize
          }
        }).catch(err => console.error("Failed to save to history", err));
      });
    } catch (error: any) {
      setError(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const capturePointSnapshot = (img: HTMLImageElement, xPct: number, yPct: number) => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;

      const size = 120; // Snapshot size
      canvas.width = size;
      canvas.height = size;

      const itemsX = (xPct / 100) * img.naturalWidth;
      const itemsY = (yPct / 100) * img.naturalHeight;

      if (!itemsX || !itemsY) return undefined;

      // Draw crop
      ctx.drawImage(
        img,
        itemsX - size / 2, itemsY - size / 2, size, size, // Source
        0, 0, size, size // Dest
      );

      // Add crosshair
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size / 2 - 5, size / 2); ctx.lineTo(size / 2 + 5, size / 2);
      ctx.moveTo(size / 2, size / 2 - 5); ctx.lineTo(size / 2, size / 2 + 5);
      ctx.stroke();

      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (e) {
      console.error("Snapshot failed", e);
      return undefined;
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const imgElement = e.currentTarget.querySelector('img');
      const snapshot = imgElement ? capturePointSnapshot(imgElement, x, y) : undefined;

      setSelectedPoints(prev => {
        const currentPoints = prev[index] || [];
        if (currentPoints.length >= 10) return prev; // Max 10 limit

        return {
          ...prev,
          [index]: [...currentPoints, { id: Date.now(), x, y, snapshot }]
        };
      });
    }
  };

  const removePoint = (imgIndex: number, pointId: number) => {
    setSelectedPoints(prev => ({
      ...prev,
      [imgIndex]: prev[imgIndex]?.filter(p => p.id !== pointId) || []
    }));
  };

  const handleEditImage = async (index: number) => {
    const rawPrompt = editPrompts[index];
    const image = generatedImages[index];
    const refFiles = editRefImages[index] || []; // Get ref images

    if (!rawPrompt || !image) return;

    // Inject spatial context if points are selected
    const points = selectedPoints[index] || [];
    let finalPrompt = rawPrompt;

    if (points.length > 0) {
      const pointDetails = points.map((p, i) => `Point ${i + 1}: [x:${p.x.toFixed(1)}%, y:${p.y.toFixed(1)}%]`).join(", ");
      finalPrompt = `The user has marked specific points on the image: ${pointDetails}. Please focus your edit on the areas around these points. Instruction: ${rawPrompt}`;
    }

    setIsEditing(prev => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const base64 = image.includes(',') ? image.split(',')[1] : image;
      const mime = image.includes('image/webp') ? 'image/webp' : 'image/png';

      // Convert Ref Images to Base64
      const refImagesData = await Promise.all(refFiles.map(async file => ({
        base64: await blobToBase64(file),
        mimeType: file.type
      })));

      const newImages = await editGeneratedImage(base64, mime, finalPrompt, refImagesData, { aspectRatio, resolution }); // Pass query params
      if (newImages && newImages.length > 0) {
        // Save Original for Comparison
        setOriginalImages(prev => ({ ...prev, [index]: image }));

        const updatedImages = [...generatedImages];
        updatedImages[index] = newImages[0];
        setGeneratedImages(updatedImages);
        // Clear prompt and point after success
        // Keep refs or clear? Usually keep prompt/refs for tweaks, but user flow implies "Done". 
        // Let's clear to avoid confusion on next edit.
        setEditPrompts(prev => ({ ...prev, [index]: '' }));
        setSelectedPoints(prev => ({ ...prev, [index]: [] }));
        setEditRefImages(prev => ({ ...prev, [index]: [] }));
      }
    } catch (error: any) {
      console.error("Edit failed", error);
      setError(error.message || "编辑失败，请重试");
    } finally {
      setIsEditing(prev => ({ ...prev, [index]: false }));
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (

    <div className="flex flex-col h-full bg-pastel-bg text-pastel-text">
      {/* Header */}
      <div className="px-6 py-4 bg-pastel-card border-b border-pastel-border flex items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-pastel-text">
          <Layers className="w-5 h-5 text-pastel-highlight" />
          图像生成 (Image Generation)
        </h2>
        <div className="text-sm text-pastel-muted">
          已选择 {selectedFiles.length} / 10 张参考图
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">

          <div className="flex flex-col gap-5 h-full">

            {/* 1. Upload Area */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all min-h-[220px] flex flex-col items-center justify-center group
                ${selectedFiles.length === 0
                  ? 'border-pastel-border hover:border-pastel-highlight hover:bg-orange-50/30'
                  : 'border-pastel-highlight/30 bg-pastel-pink/10'
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const files = Array.from(e.dataTransfer.files);
                  addFiles(files);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFiles.length === 0 ? (
                <div className="text-center cursor-pointer">
                  <div className="w-16 h-16 bg-white shadow-sm border border-pastel-border rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-8 h-8 text-pastel-highlight" />
                  </div>
                  <p className="text-base font-semibold text-pastel-text">点击或拖拽上传参考图</p>
                  <p className="text-xs text-pastel-muted mt-2">支持 JPG, PNG, WEBP (最多10张)</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 gap-3 w-full content-start">
                    {previewUrls.map((url, idx) => (
                      <div 
                        key={idx} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`relative aspect-square group/img rounded-lg overflow-hidden border shadow-sm bg-white cursor-move transition-all
                          ${draggedIndex === idx ? 'opacity-40 scale-95 border-pastel-highlight' : 'border-pastel-border hover:border-pastel-highlight/50'}
                        `}
                      >
                        <img src={url} alt={`Ref ${idx}`} className="w-full h-full object-cover pointer-events-none" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-all scale-90 hover:scale-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {selectedFiles.length < 10 && (
                      <div className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-white hover:border-pastel-highlight transition-colors text-pastel-muted hover:text-pastel-highlight"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        <Upload className="w-5 h-5 mb-1 opacity-50" />
                        <span className="text-[10px] font-medium">添加</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <span className="inline-block px-3 py-1 bg-white border border-pastel-border rounded-full text-xs text-pastel-muted shadow-sm">
                      已选 {selectedFiles.length} 张图片
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Configuration & Prompt Wrapper */}
            <div className="flex-1 flex flex-col gap-5 min-h-0">
              {/* Model Selection - Top Row for consistency */}
              <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
                <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                        ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <BananaIcon className="w-3.5 h-3.5" />
                      <span className={`text-xs font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                        Nano Banana 2
                      </span>
                    </div>
                    <span className="text-[9px] text-pastel-muted">3.1 Flash (极速)</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                        ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <BananaIcon className="w-3.5 h-3.5" />
                      <span className={`text-xs font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                        Nano Banana Pro
                      </span>
                    </div>
                    <span className="text-[9px] text-pastel-muted">3.0 Pro (推荐)</span>
                  </button>
                </div>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" /> 画幅比例
                  </label>
                  <div className="relative">
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                      className="w-full appearance-none bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm text-pastel-text outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all font-medium hover:border-pastel-highlight/50 cursor-pointer"
                    >
                      <option value={AspectRatio.SQUARE}>1:1 (正方形)</option>
                      <option value={AspectRatio.LANDSCAPE_3_2}>3:2 (横构图)</option>
                      <option value={AspectRatio.PORTRAIT_2_3}>2:3 (竖构图)</option>
                      <option value={AspectRatio.LANDSCAPE_4_3}>4:3 (常规)</option>
                      <option value={AspectRatio.PORTRAIT_3_4}>3:4 (人像)</option>
                      <option value={AspectRatio.LANDSCAPE_5_4}>5:4 (宽幅人像)</option>
                      <option value={AspectRatio.PORTRAIT_4_5}>4:5 (社交媒体)</option>
                      <option value={AspectRatio.LANDSCAPE_16_9}>16:9 (宽屏)</option>
                      <option value={AspectRatio.PORTRAIT_9_16}>9:16 (手机)</option>
                      <option value={AspectRatio.LANDSCAPE_21_9}>21:9 (电影感)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-pastel-muted">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5" /> 画质精度
                  </label>
                  <div className="relative">
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as ImageResolution)}
                      className="w-full appearance-none bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm text-pastel-text outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all font-medium hover:border-pastel-highlight/50 cursor-pointer"
                    >
                      <option value={ImageResolution.RES_05K}>0.5K (512px)</option>
                      <option value={ImageResolution.RES_1K}>1K (标准)</option>
                      <option value={ImageResolution.RES_2K}>2K (高清)</option>
                      <option value={ImageResolution.RES_4K}>4K (超清)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-pastel-muted">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                    </div>
                  </div>
                </div>
              </div>


              {/* Prompt Area */}
              <div className="flex-1 flex flex-col relative">
                <div className="flex items-center justify-between mb-2 px-1">
                  <label className="block text-sm font-bold text-pastel-text flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pastel-highlight" />
                    创意描述
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Style Model Selector Button */}
                    <button
                      onClick={() => setIsStyleModalOpen(true)}
                      className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all border shadow-sm ${
                        selectedStyle 
                          ? 'border-orange-200 bg-orange-50 text-orange-600 font-bold' 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      {selectedStyle ? <Sparkles className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                      {selectedStyle ? `风格: ${selectedStyle.name}` : '风格库'}
                      {selectedStyle && (
                        <div 
                          className="ml-1 p-0.5 hover:bg-orange-200 rounded-full"
                          onClick={(e) => { e.stopPropagation(); setSelectedStyle(null); }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                    {/* Refine Popover */}
                    {showRefineInput && hasPolished && (
                      <div className="absolute top-10 right-0 z-50 w-72 bg-white rounded-xl shadow-xl border border-pastel-border p-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-pastel-text">继续优化指令</span>
                          <button onClick={() => setShowRefineInput(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          autoFocus
                          value={refineInstruction}
                          onChange={(e) => setRefineInstruction(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (!refineInstruction.trim()) return;

                              setIsOptimizing(true);
                              setShowRefineInput(false);
                              try {
                                // Reuse existing ref images logic? Or just rely on text context? 
                                // Usually refinement is text-based but keeping context is good.
                                let refImagesData: { base64: string; mimeType: string }[] | undefined = undefined;
                                if (selectedFiles.length > 0) {
                                  const imagesToProcess = selectedFiles.slice(0, 4);
                                  refImagesData = await Promise.all(imagesToProcess.map(async file => ({
                                    base64: await blobToBase64(file),
                                    mimeType: file.type
                                  })));
                                }

                                const refined = await optimizePrompt(description, refImagesData, refineInstruction);
                                setDescription(refined);
                                setRefineInstruction('');
                              } catch (e: any) {
                                setError("优化失败: " + (e.message || "未知错误"));
                              } finally {
                                setIsOptimizing(false);
                              }
                            }
                          }}
                          placeholder="例如：更亮一点、去掉背景..."
                          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-pastel-highlight outline-none"
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={async () => {
                              if (!refineInstruction.trim()) return;
                              setIsOptimizing(true);
                              setShowRefineInput(false);
                              try {
                                let refImagesData: { base64: string; mimeType: string }[] | undefined = undefined;
                                if (selectedFiles.length > 0) {
                                  const imagesToProcess = selectedFiles.slice(0, 4);
                                  refImagesData = await Promise.all(imagesToProcess.map(async file => ({
                                    base64: await blobToBase64(file),
                                    mimeType: file.type
                                  })));
                                }
                                const refined = await optimizePrompt(description, refImagesData, refineInstruction);
                                setDescription(refined);
                                setRefineInstruction('');
                              } catch (e: any) {
                                setError("优化失败: " + (e.message || "未知错误"));
                              } finally {
                                setIsOptimizing(false);
                              }
                            }}
                            className="text-xs bg-pastel-highlight text-white px-3 py-1 rounded-md hover:bg-orange-600 transition-colors"
                          >
                            确认
                          </button>
                        </div>
                      </div>
                    )}

                    {hasPolished && (
                      <button
                        onClick={() => setShowRefineInput(!showRefineInput)}
                        disabled={isOptimizing}
                        className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <MessageCircle className="w-3 h-3" />
                        继续优化
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        if (!description) return;
                        setIsOptimizing(true);
                        try {
                          // Prepare reference images if any
                          let refImagesData: { base64: string; mimeType: string }[] | undefined = undefined;
                          if (selectedFiles.length > 0) {
                            // Limit to 4 images for prompt optimization context to avoid excessive tokens
                            const imagesToProcess = selectedFiles.slice(0, 4);
                            refImagesData = await Promise.all(imagesToProcess.map(async file => ({
                              base64: await blobToBase64(file),
                              mimeType: file.type
                            })));
                          }

                          const optimized = await optimizePrompt(description, refImagesData);
                          setDescription(optimized);
                          setHasPolished(true); // Mark as polished
                        } catch (e: any) {
                          setError("优化提示词失败: " + (e.message || "未知错误"));
                          setTimeout(() => setError(null), 3000);
                          setHasPolished(false);
                        } finally {
                          setIsOptimizing(false);
                        }
                      }}
                      disabled={!description || isOptimizing}
                      className={`text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all border ${!description
                        ? 'text-gray-400 border-transparent cursor-not-allowed bg-gray-50'
                        : 'text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 shadow-sm'}`}
                    >
                      <Wand2 className={`w-3 h-3 ${isOptimizing ? 'animate-spin' : ''}`} />
                      {isOptimizing ? '正在优化...' : 'AI 润色'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative group">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="在此输入您的创意描述...
例如：
- 赛博朋克风格的城市夜景， neon lights
- 极简主义风格的产品摄影，柔光"
                    className="w-full h-full min-h-[140px] bg-white border border-pastel-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-pastel-highlight/50 outline-none resize-none shadow-sm text-pastel-text placeholder:text-gray-300 transition-all hover:border-pastel-highlight/30"
                  />
                </div>
              </div>

            </div>

            {/* 4. Bottom Action Area with Error Handling */}
            <div className="mt-auto flex flex-col gap-3">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-600 animate-in slide-in-from-bottom-2 fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {(error.includes("403") || error.includes("权限")) && (
                      <button
                        onClick={() => (window as any).aistudio?.openSelectKey()}
                        className="mt-2 text-xs font-semibold underline hover:text-red-700 flex items-center gap-1"
                      >
                        <Key className="w-3 h-3" /> 点击配置 API Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                {/* Auto-Optimize Toggle */}
                <button
                  onClick={() => setIsAutoOptimize(!isAutoOptimize)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isAutoOptimize
                    ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  title={isAutoOptimize ? "生成前自动优化提示词 (已开启)" : "生成前自动优化提示词 (已关闭)"}
                >
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${isAutoOptimize ? 'bg-purple-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAutoOptimize ? 'left-4.5' : 'left-0.5'}`} style={{ left: isAutoOptimize ? 'calc(100% - 14px)' : '2px' }} />
                  </div>
                  <span>✨ 智能优化</span>
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={(!description && !selectedStyle) || isGenerating}
                  className={`flex-1 py-4 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${((!description && !selectedStyle) || isGenerating)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                    : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105'
                    }`}
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? '正在生成... (Working)' : isAutoOptimize ? '智能生成 (Smart Generate)' : '开始生成 (Generate)'}
                </button>
              </div>
            </div>

          </div>

          {/* Right: Result Area */}
          <div className="flex flex-col bg-pastel-card rounded-xl border border-pastel-border p-6 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-pastel-text flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-pastel-highlight" />
                生成结果
              </h3>
              {generatedImages.length > 0 && (
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                  完成
                </span>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center bg-pastel-bg rounded-lg border-2 border-dashed border-pastel-border overflow-hidden relative">
              {generatedImages.length > 0 ? (
                <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
                  {generatedImages.map((imgSrc, idx) => (
                    <div key={idx} className="mb-6 last:mb-0 group/card relative animate-in fade-in slide-in-from-bottom-4 duration-500">

                      {/* Image Area with Selection */}
                      <div
                        className="relative rounded-lg shadow-lg border border-pastel-border overflow-hidden cursor-crosshair"
                        onClick={(e) => handleImageClick(e, idx)}
                        onMouseDown={(e) => e.ctrlKey && e.preventDefault()}
                      >
                        <img
                          src={isComparing[idx] && originalImages[idx] ? originalImages[idx] : imgSrc}
                          alt="Generated Result"
                          className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                          onClick={(e) => !e.ctrlKey && setZoomImage(imgSrc)} // Always zoom current image
                        />

                        {/* Markers */}
                        {selectedPoints[idx]?.map((point, pIndex) => (
                          <div
                            key={point.id}
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-in zoom-in duration-300"
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                          >
                            <div className="relative group/point">
                              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] text-white font-bold">
                                {pIndex + 1}
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></div>

                              {/* Snapshot Tooltip */}
                              {point.snapshot && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/point:block bg-white p-1 rounded-md shadow-lg border border-gray-100 z-50">
                                  <img src={point.snapshot} className="w-16 h-16 object-cover rounded" alt="Snapshot" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            <span>Ctrl + 点击添加标记点 ({selectedPoints[idx]?.length || 0}/10)</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="flex items-center justify-between mt-3 bg-white p-2 rounded-lg border border-pastel-border shadow-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setZoomImage(imgSrc)}
                            className="flex items-center gap-1.5 text-xs font-medium text-pastel-text hover:text-pastel-highlight px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                            title="放大查看"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            放大
                          </button>
                          <button
                            onClick={() => downloadImage(imgSrc, `i2i-gen-${Date.now()}.png`)}
                            className="flex items-center gap-1.5 text-xs font-medium text-pastel-text hover:text-pastel-highlight px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                            title="下载原图"
                          >
                            <Download className="w-3.5 h-3.5" />
                            下载
                          </button>

                          {/* Compare Button (Only if edited) */}
                          {originalImages[idx] && (
                            <button
                              onMouseDown={() => setIsComparing(prev => ({ ...prev, [idx]: true }))}
                              onMouseUp={() => setIsComparing(prev => ({ ...prev, [idx]: false }))}
                              onMouseLeave={() => setIsComparing(prev => ({ ...prev, [idx]: false }))}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors select-none active:scale-95 shadow-sm"
                              title="按住查看修改前效果"
                            >
                              {isComparing[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              {isComparing[idx] ? '原图' : '按住对比'}
                            </button>
                          )}
                        </div>

                        <button
                          onClick={handleGenerate} // Re-generate globally for now, or could implementing local regen
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 text-xs font-medium text-pastel-muted hover:text-pastel-highlight px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          重绘
                        </button>
                      </div>

                      {/* Edit Area */}
                      <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                        {/* Selected Points Chips */}
                        {selectedPoints[idx]?.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-thin">
                            {selectedPoints[idx]!.map((p, i) => (
                              <div key={p.id} className="flex-shrink-0 flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-blue-200 shadow-sm min-w-[120px]">
                                {p.snapshot && <img src={p.snapshot} className="w-8 h-8 rounded border border-gray-100 object-cover" alt="Point" />}
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-blue-600">Point #{i + 1}</span>
                                  <span className="text-[9px] text-gray-400">已选定区域</span>
                                </div>
                                <button
                                  onClick={() => removePoint(idx, p.id)}
                                  className="ml-auto text-gray-400 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {/* Edit Content Row */}
                          <div className="flex gap-2 items-start">

                            {/* Ref Image Upload & List */}
                            <div className="flex gap-2">
                              {/* Upload Button */}
                              <label title="上传参考图以引导生成风格或构图" className="h-[60px] w-[60px] flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-pastel-highlight hover:text-pastel-highlight text-gray-400 transition-colors shadow-sm shrink-0">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleEditRefUpload(e, idx)}
                                />
                                <ImageIcon className="w-5 h-5 mb-1" />
                                <span className="text-[9px] scale-90">加参考图</span>
                              </label>

                              {/* Thumbnails */}
                              {editRefImages[idx]?.map((file, rIdx) => (
                                <div key={rIdx} className="relative h-[60px] w-[60px] group shrink-0">
                                  <img
                                    src={URL.createObjectURL(file)}
                                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                                    alt="Ref"
                                  />
                                  <button
                                    onClick={() => removeEditRefImage(idx, rIdx)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <textarea
                              value={editPrompts[idx] || ''}
                              onChange={(e) => setEditPrompts(prev => ({ ...prev, [idx]: e.target.value }))}
                              placeholder={selectedPoints[idx]?.length
                                ? `[已标记 ${selectedPoints[idx]?.length} 处] 输入修改指令...`
                                : "输入微调指令 (可上传参考图)..."}
                              className={`flex-1 text-xs bg-white border rounded-lg pl-3 pr-3 py-2 min-h-[60px] focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text shadow-sm placeholder:text-gray-400 transition-colors resize-y ${selectedPoints[idx]?.length ? 'border-blue-300 ring-1 ring-blue-50' : 'border-gray-200'}`}
                            />

                            <button
                              onClick={() => handleEditImage(idx)}
                              disabled={(!editPrompts[idx] && (!editRefImages[idx] || editRefImages[idx].length === 0)) || isEditing[idx]}
                              className={`h-[60px] w-[60px] rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 flex-shrink-0 ${(!editPrompts[idx] && (!editRefImages[idx] || editRefImages[idx].length === 0))
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-pastel-highlight text-white hover:brightness-110 shadow-md"
                                }`}
                            >
                              {isEditing[idx] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              <span className="text-[10px]">微调</span>
                            </button>
                          </div>

                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 max-w-sm">
                  {isGenerating ? (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 relative mb-4">
                        <div className="absolute inset-0 border-4 border-pastel-border rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-pastel-highlight rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <p className="text-pastel-text font-medium">
                        {progress || '正在进行图生图...'}
                      </p>
                      <p className="text-sm text-pastel-muted mt-2">
                        {progress.includes('生成图片')
                          ? 'Gemini Pro 正在分析参考图并进行创作，请耐心等待'
                          : 'Gemini Pro 正在处理您的请求'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Layers className="w-16 h-16 text-pastel-muted mx-auto mb-4" />
                      <p className="text-pastel-muted">生成的图片将显示在这里</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {zoomImage && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setZoomImage(null)}>
                <button
                  className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
                  onClick={() => setZoomImage(null)}
                >
                  <X className="w-6 h-6" />
                </button>

                <img
                  src={zoomImage}
                  alt="Full Screen Preview"
                  className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadImage(zoomImage, `i2i-zoom-${Date.now()}.png`); }}
                    className="bg-white text-black px-6 py-2.5 rounded-full font-medium shadow-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> 下载原图
                  </button>
                </div>
              </div>
            )}
      {/* Style Model Modal */}
      <StyleModelModal 
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        onSelect={(style) => {
          setSelectedStyle(style);
          const wideStyles = ['model-clothing-extraction', 'master-model-no-ref', 'master-model-with-ref'];
          if (style?.id && wideStyles.includes(style.id)) {
            setAspectRatio(AspectRatio.LANDSCAPE_16_9);
          }
        }}
        currentSelectedId={selectedStyle?.id}
      />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FusionTab;