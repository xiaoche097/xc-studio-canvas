import React, { useState, useEffect } from 'react';
import { gemini } from '../lib/gemini';
import { RefreshIcon, UploadIcon, DownloadIcon, ZoomIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImageFiles } from '../Cyzx4/utils/imageCompressor';
import { downloadImageFile } from '../Cyzx4/utils/imageDownload';

type OutputFormat = 'jpg' | 'png';

interface VisualizerProps {
  prompt: string;
  aspectRatio?: string;
  allowedRatios?: string[];
  label?: string;
  initialImage?: string | null;
  autoGenerate?: boolean;
  onImageGenerated?: (url: string) => void;
  enableFormatSelector?: boolean;
  defaultOutputFormat?: OutputFormat;
}

const DETAIL_LEVELS = ['Standard', 'High Detail', 'Ultra (4K)'];

export const Visualizer: React.FC<VisualizerProps> = ({ prompt, aspectRatio = "1:1", allowedRatios = ['1:1', '3:4'], label = "PREVIEW", initialImage, autoGenerate = false, onImageGenerated, enableFormatSelector = false, defaultOutputFormat = 'jpg' }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage || null);
  const [loading, setLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(!!initialImage || autoGenerate);
  const [selectedRatio, setSelectedRatio] = useState(allowedRatios.includes(aspectRatio) ? aspectRatio : allowedRatios[0]);
  const [resolution, setResolution] = useState('High Detail'); // Changed initial resolution to 'High Detail'
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultOutputFormat);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'fit' | 'original'>('fit'); // New state for zoom modal

  const convertImageFormat = (src: string, format: OutputFormat): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas is not available.'));
          return;
        }

        if (format === 'jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
      };
      img.onerror = () => reject(new Error('Generated image could not be loaded for format conversion.'));
      img.src = src;
    });
  };

  const getDownloadFormat = (url: string): OutputFormat => {
    if (url.startsWith('data:image/png')) return 'png';
    if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
    return outputFormat;
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    const format = getDownloadFormat(imageUrl);
    try {
      await downloadImageFile(imageUrl, `skysper-gen-${Date.now()}.${format}`);
    } catch (downloadError) {
      console.error('Failed to download generated image.', downloadError);
      setError('图片下载失败，请检查网络后重试。');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = await compressImageFiles(Array.from(e.target.files));
    if (files && files.length > 0) {
      const remainingSlots = 6 - referenceImages.length;
      if (remainingSlots <= 0) {
        alert("Maximum 6 reference images allowed");
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setReferenceImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input
    e.target.value = '';
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    setHasStarted(true);
    try {
      // Map Detail Level to Prompt
      let detailKeywords = "";
      if (resolution === "High Detail") detailKeywords = "highly detailed, sharp focus, high resolution";
      if (resolution === "Ultra (4K)") detailKeywords = "UHD, 8k, best quality, sharp focus, high res, commercial photography, masterful composition";

      // map Detail Level to API Resolution Parameter
      // Gemini 3 Pro supports 1K, 2K, 4K (must be uppercase)
      let apiResolution = '1K';
      if (resolution === "High Detail") apiResolution = '2K';
      if (resolution === "Ultra (4K)") apiResolution = '4K';

      // Enhanced prompt
      const technicalPrompt = `${prompt}, aspect ratio ${selectedRatio}, ${detailKeywords}`;
      const result = await gemini.generateImage(technicalPrompt, referenceImages, { aspectRatio: selectedRatio, resolution: apiResolution });
      let finalResult = result;
      if (enableFormatSelector) {
        try {
          finalResult = await convertImageFormat(result, outputFormat);
        } catch (conversionError) {
          console.warn("Image format conversion failed. Using original generated image.", conversionError);
        }
      }
      setImageUrl(finalResult);
      if (onImageGenerated) onImageGenerated(finalResult);
    } catch (err: any) {
      console.error("Visualizer Error:", err);
      // Fallback for demo if API fails (or key invalid)
      if (err.message.includes("API Key")) {
        setError("API Key Error");
      } else {
        setError("生成失败");
      }
      // Keep placeholder on error so UI doesn't collapse? Or show Error UI.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Determine height based on selected ratio
    // 1:1 -> 100%, 3:4 -> 133%, 4:3 -> 75%, 16:9 -> 56.25%
  }, [selectedRatio]);

  useEffect(() => {
    if (initialImage) {
      setImageUrl(initialImage);
      setHasStarted(true);
    }
  }, [initialImage]);

  const getPaddingBottom = () => {
    const [w, h] = selectedRatio.split(':').map(Number);
    return `${(h / w) * 100}%`;
  };

  useEffect(() => {
    if (autoGenerate && !imageUrl) {
      generate();
    }
  }, []);

  return (
    <div className="relative group overflow-hidden bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 w-full flex flex-col">
      {/* Controls Toolbar - Enlarged & Improved */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-white/5 z-20 gap-2">
        <div className="flex items-center gap-3">
          {/* Ratio Selector */}
          <div className="relative group/select">
            <select
              value={selectedRatio}
              onChange={(e) => setSelectedRatio(e.target.value)}
              className="appearance-none bg-white dark:bg-white/5 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              {allowedRatios.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>

          {/* Detail Level Selector */}
          <div className="relative group/select flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Detail:</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="appearance-none bg-white dark:bg-white/5 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              {DETAIL_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>

          {enableFormatSelector && (
            <div className="relative group/select flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Format:</span>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                className="appearance-none bg-white dark:bg-white/5 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
              >
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          )}

          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

          {/* Upload Button - Larger & Clearer */}
          <label className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-white/20 transition-all text-gray-500 dark:text-gray-400 ${referenceImages.length >= 6 ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-orange hover:bg-brand-orange/5 hover:text-brand-orange'}`} title="上传参考图 (最多6张)">
            <UploadIcon className="w-4 h-4" />
            <span className="text-xs font-medium">参考 {referenceImages.length}/6</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={referenceImages.length >= 6}
            />
          </label>

          {/* Reference Images List */}
          {referenceImages.map((img, idx) => (
            <div key={idx} className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 group/ref cursor-pointer shadow-sm" title="点击删除">
              <img src={img} className="w-full h-full object-cover" />
              <button
                onClick={() => removeReferenceImage(idx)}
                className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/ref:opacity-100 text-xs font-bold transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">{label}</div>
      </div>

      <div className="relative w-full group/image" style={{ paddingBottom: getPaddingBottom() }}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-black/40">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2 text-red-400 p-4 text-center z-10"
              >
                <span className="text-xl">⚠️</span>
                <span className="text-sm font-medium">{error}</span>
                <button onClick={generate} className="text-xs underline hover:text-red-300 mt-2">Retry Generation</button>
              </motion.div>
            ) : imageUrl ? (
              <div className="relative w-full h-full">
                <motion.img
                  key="image"
                  src={imageUrl}
                  alt="Generated Content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full object-cover"
                />

                {/* Central Action Overlay - Replaces small top-right buttons */}
                {!loading && (
                  <div className="absolute inset-0 z-20 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 backdrop-blur-[1px]">
                    {/* Zoom Button */}
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.25)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed(true);
                        setViewMode('fit'); // Reset view mode when opening zoom
                      }}
                      className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex flex-col items-center justify-center shadow-2xl transition-all group/btn"
                      title="放大预览"
                    >
                      <ZoomIcon className="w-6 h-6 mb-0.5" />
                      <span className="text-[9px] font-medium opacity-80 group-hover/btn:opacity-100">放大</span>
                    </motion.button>

                    {/* Download Button */}
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.25)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage();
                      }}
                      className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex flex-col items-center justify-center shadow-2xl transition-all group/btn"
                      title="下载原图"
                    >
                      <DownloadIcon className="w-6 h-6 mb-0.5" />
                      <span className="text-[9px] font-medium opacity-80 group-hover/btn:opacity-100">下载</span>
                    </motion.button>

                    {/* Regenerate Button */}
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(237, 109, 70, 0.9)" }} // Brand orange on hover
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); generate(); }}
                      className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex flex-col items-center justify-center shadow-2xl transition-all group/btn"
                      title="重新生成"
                    >
                      <RefreshIcon className="w-6 h-6 mb-0.5" />
                      <span className="text-[9px] font-medium opacity-80 group-hover/btn:opacity-100">重绘</span>
                    </motion.button>
                  </div>
                )}

                {loading && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
                    <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-white font-mono animate-pulse">Updating...</span>
                  </div>
                )}
              </div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-brand-orange font-mono animate-pulse">Rendering...</span>
              </motion.div>
            ) : !hasStarted ? (
              <motion.div
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 w-full h-full justify-center cursor-pointer group/btn"
                onClick={generate}
              >
                <div className="w-12 h-12 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg group-hover/btn:scale-110 transition-transform">
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-xl">⚡</motion.span>
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-white bg-white/80 dark:bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm border border-white/20">立即生成</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Zoom Modal - Enhanced with Scroll/Fit Toggle */}
        {isZoomed && imageUrl && (
          <div
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(false);
            }}
          >
            {/* Modal Toolbar */}
            <div
              className="flex items-center justify-between px-6 py-4 bg-black/50 border-b border-white/10 z-50 backdrop-blur-sm shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4">
                <h3 className="text-white font-bold text-lg">Image Preview</h3>
                <div className="flex bg-white/10 rounded-lg p-1 border border-white/10">
                  <button
                    onClick={() => setViewMode('fit')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'fit' ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                  >
                    Fit Screen
                  </button>
                  <button
                    onClick={() => setViewMode('original')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'original' ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                  >
                    Original (1:1)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    downloadImage();
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-white/10"
                >
                  <DownloadIcon className="w-4 h-4" /> Download
                </button>
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-500 transition-colors"
                  onClick={() => setIsZoomed(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className={`flex-1 overflow-auto flex items-center justify-center p-4 ${viewMode === 'original' ? 'items-start' : ''}`}>
              <img
                src={imageUrl}
                className={`
                    shadow-2xl rounded-sm transition-all duration-300
                    ${viewMode === 'fit' ? 'max-w-full max-h-full object-contain' : 'max-w-none w-auto h-auto cursor-zoom-out'}
                  `}
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMode === 'fit') setViewMode('original');
                  else setViewMode('fit');
                }}
                style={{ transformOrigin: 'center center' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

