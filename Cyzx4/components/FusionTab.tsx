import React, { useState, useRef } from 'react';
import { generateImageToImage, blobToBase64 } from '../services/geminiService';
import { Layers, Upload, Loader2, AlertCircle, X, Sparkles, Key, Image as ImageIcon } from 'lucide-react';

const FusionTab: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (generatedImages.length > 0) setGeneratedImages([]);
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
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) {}
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
      const results = await generateImageToImage(images, description);
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
          
          {/* Left: Input Area */}
          <div className="flex flex-col gap-4">
            
            {/* Upload Area */}
            <div 
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all min-h-[200px] flex flex-col items-center justify-center
                ${selectedFiles.length === 0 
                  ? 'border-pastel-border hover:border-pastel-highlight bg-pastel-card/50' 
                  : 'border-pastel-highlight/30 bg-pastel-pink/30'
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
                  <div className="w-16 h-16 bg-pastel-pink rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-pastel-highlight" />
                  </div>
                  <p className="text-lg font-medium text-pastel-text">点击或拖拽上传图片</p>
                  <p className="text-sm text-pastel-muted mt-2">支持 JPG, PNG, WEBP (最多10张)</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square group rounded-lg overflow-hidden border border-pastel-border shadow-sm bg-pastel-card">
                        <img src={url} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {selectedFiles.length < 10 && (
                      <div className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg mx-auto w-full text-pastel-muted hover:text-pastel-highlight bg-pastel-card"
                       onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                         <Upload className="w-6 h-6 mb-1" />
                         <span className="text-xs">添加</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input - Moved to Bottom of Left Column */}
            <div className="flex-1 flex flex-col justify-end mt-auto">
              <label className="block text-sm font-medium text-pastel-text mb-2">生成提示词 (Prompt)</label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="在此输入您的创意描述... (例如：将这些参考图风格融合，生成一张赛博朋克风格的城市夜景)"
                  className="w-full h-32 bg-pastel-card border border-pastel-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-pastel-highlight outline-none resize-none shadow-sm text-pastel-text placeholder-pastel-muted"
                />
                <button
                  onClick={handleGenerate}
                  disabled={selectedFiles.length === 0 || !description || isGenerating}
                  className={`absolute bottom-3 right-3 py-2 px-6 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md ${
                    selectedFiles.length === 0 || !description || isGenerating
                      ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed' 
                      : 'bg-pastel-highlight hover:opacity-90 text-white hover:scale-105 active:scale-95'
                  }`}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? '生成中...' : '开始生成'}
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {(error.includes("403") || error.includes("权限")) && (
                      <button 
                        onClick={() => (window as any).aistudio?.openSelectKey()}
                        className="mt-2 text-xs underline hover:text-red-700 flex items-center gap-1"
                      >
                        <Key className="w-3 h-3" /> 点击配置 Key
                      </button>
                    )}
                  </div>
                </div>
              )}
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
                      <div key={idx} className="mb-6 last:mb-0 group relative">
                        <img src={imgSrc} alt="Generated Result" className="w-full h-auto rounded-lg shadow-lg border border-pastel-border" />
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a 
                              href={imgSrc} 
                              download={`i2i-gen-${Date.now()}.png`} 
                              className="bg-white/90 dark:bg-slate-800/90 p-2 rounded-full shadow-lg text-gray-700 dark:text-gray-200 hover:text-pastel-highlight block"
                              title="下载原图"
                            >
                                <Upload className="w-5 h-5 rotate-180" />
                            </a>
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
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default FusionTab;