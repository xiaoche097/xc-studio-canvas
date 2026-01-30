import React, { useState, useRef } from 'react';
import { generateImageToImage, blobToBase64, optimizePrompt, editGeneratedImage } from '../services/geminiService';
import { Layers, Upload, Loader2, AlertCircle, X, Sparkles, Key, Image as ImageIcon, Wand2, Monitor, Grid, Maximize2, Download, RefreshCw } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';

interface EditPoint {
  id: number;
  x: number;
  y: number;
  snapshot?: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit & Interactive States
  const [editPrompts, setEditPrompts] = useState<Record<number, string>>({});
  const [isEditing, setIsEditing] = useState<Record<number, boolean>>({});
  const [selectedPoints, setSelectedPoints] = useState<Record<number, EditPoint[]>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);

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
    }
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

  const handleGenerate = async () => {
    if (selectedFiles.length === 0 || !description) return;
    setError(null);
    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }
    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      // Convert all files to base64
      const imagePromises = selectedFiles.map(async file => ({
        base64: await blobToBase64(file),
        mimeType: file.type
      }));

      const images = await Promise.all(imagePromises);
      const results = await generateImageToImage(images, description, { aspectRatio, resolution });
      setGeneratedImages(results);
    } catch (error: any) {
      const isPermissionError = error.status === 403 || (error.message && error.message.includes("permission"));
      if (isPermissionError) {
        setError("权限不足：需要配置 API Key。");
      } else {
        setError("生成失败: " + (error.message || "未知错误"));
      }
    } finally {
      setIsGenerating(false);
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

      const newImages = await editGeneratedImage(base64, mime, finalPrompt);
      if (newImages && newImages.length > 0) {
        const updatedImages = [...generatedImages];
        updatedImages[index] = newImages[0];
        setGeneratedImages(updatedImages);
        // Clear prompt and point after success
        setEditPrompts(prev => ({ ...prev, [index]: '' }));
        setSelectedPoints(prev => ({ ...prev, [index]: [] }));
      }
    } catch (e: any) {
      setError("微调失败: " + (e.message || "未知错误"));
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
                      <div key={idx} className="relative aspect-square group/img rounded-lg overflow-hidden border border-pastel-border shadow-sm bg-white">
                        <img src={url} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
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
                      <option value={AspectRatio.PORTRAIT_3_4}>3:4 (人像)</option>
                      <option value={AspectRatio.LANDSCAPE_4_3}>4:3 (常规)</option>
                      <option value={AspectRatio.PORTRAIT_9_16}>9:16 (手机)</option>
                      <option value={AspectRatio.LANDSCAPE_16_9}>16:9 (宽屏)</option>
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
                  <button
                    onClick={async () => {
                      if (!description) return;
                      setIsOptimizing(true);
                      try {
                        const optimized = await optimizePrompt(description);
                        setDescription(optimized);
                      } catch (e: any) {
                        setError("优化提示词失败: " + (e.message || "未知错误"));
                        setTimeout(() => setError(null), 3000);
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

              <button
                onClick={handleGenerate}
                disabled={selectedFiles.length === 0 || !description || isGenerating}
                className={`w-full py-4 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${selectedFiles.length === 0 || !description || isGenerating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                  : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105'
                  }`}
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isGenerating ? '正在生成创意 (Generating...)' : '开始生成 (Generate)'}
              </button>
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
                          src={imgSrc}
                          alt="Generated Result"
                          className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                          onClick={(e) => !e.ctrlKey && setZoomImage(imgSrc)}
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

                        <div className="flex gap-2 items-start">
                          <textarea
                            value={editPrompts[idx] || ''}
                            onChange={(e) => setEditPrompts(prev => ({ ...prev, [idx]: e.target.value }))}
                            placeholder={selectedPoints[idx]?.length
                              ? `[已标记 ${selectedPoints[idx]?.length} 处区域] 请描述修改内容...`
                              : "在此输入微调指令 (例如: 背景颜色调暗 / 增加光效)"}
                            className={`w-full text-xs bg-white border rounded-lg pl-3 pr-3 py-2 min-h-[60px] focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text shadow-sm placeholder:text-gray-400 transition-colors resize-y ${selectedPoints[idx]?.length ? 'border-blue-300 ring-1 ring-blue-50' : 'border-gray-200'}`}
                          />
                          <button
                            onClick={() => handleEditImage(idx)}
                            disabled={!editPrompts[idx] || isEditing[idx]}
                            className={`h-[60px] w-[60px] rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 flex-shrink-0 ${editPrompts[idx] && !isEditing[idx]
                              ? "bg-pastel-pink text-white hover:bg-orange-600 shadow-md"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                          >
                            {isEditing[idx] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            <span className="text-[10px]">微调</span>
                          </button>
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
                      <p className="text-pastel-text font-medium">正在进行图生图...</p>
                      <p className="text-sm text-pastel-muted mt-2">Gemini Pro 正在分析参考图并进行创作</p>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default FusionTab;