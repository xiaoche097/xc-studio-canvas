import React, { useState, useEffect } from 'react';
import { gemini } from '../lib/gemini';
import { RefreshIcon, UploadIcon, DownloadIcon, ZoomIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualizerProps {
  prompt: string;
  aspectRatio?: string;
  allowedRatios?: string[];
  label?: string;
  initialImage?: string | null;
  autoGenerate?: boolean;
  onImageGenerated?: (url: string) => void;
}

const RESOLUTIONS = ['1k', '2k', '4k'];

export const Visualizer: React.FC<VisualizerProps> = ({ prompt, aspectRatio = "1:1", allowedRatios = ['1:1', '3:4'], label = "PREVIEW", initialImage, autoGenerate = false, onImageGenerated }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage || null);
  const [loading, setLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(autoGenerate && !initialImage);
  const [selectedRatio, setSelectedRatio] = useState(allowedRatios.includes(aspectRatio) ? aspectRatio : allowedRatios[0]);
  const [resolution, setResolution] = useState('2k');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    setHasStarted(true);
    try {
      // Append technical parameters to prompt
      const technicalPrompt = `${prompt}, aspect ratio ${selectedRatio}, ${resolution} resolution, highly detailed, photorealistic, 8k`;
      const result = await gemini.generateImage(technicalPrompt, referenceImage ? [referenceImage] : []); // Use Real Generation with Reference
      setImageUrl(result);
      if (onImageGenerated) onImageGenerated(result);
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
         {/* Controls Toolbar */}
         <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-black/20 border-b border-gray-200 dark:border-white/5 z-20">
             <div className="flex items-center gap-2">
                 <select 
                    value={selectedRatio} 
                    onChange={(e) => setSelectedRatio(e.target.value)}
                    className="bg-white dark:bg-black/40 text-xs border border-gray-200 dark:border-white/10 rounded px-1 py-0.5 outline-none focus:border-brand-orange text-gray-700 dark:text-gray-300"
                 >
                     {allowedRatios.map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
                 <select 
                    value={resolution} 
                    onChange={(e) => setResolution(e.target.value)}
                    className="bg-white dark:bg-black/40 text-xs border border-gray-200 dark:border-white/10 rounded px-1 py-0.5 outline-none focus:border-brand-orange text-gray-700 dark:text-gray-300"
                 >
                     {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
                 
                 <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1"></div>

                 <label className="cursor-pointer hover:text-brand-orange text-gray-400 transition-colors p-1" title="上传参考图">
                    <UploadIcon className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                 </label>

                 {referenceImage && (
                    <div className="relative w-6 h-6 rounded overflow-hidden border border-gray-200 group/ref cursor-pointer" title="点击删除参考图">
                        <img src={referenceImage} className="w-full h-full object-cover" />
                        <button 
                           onClick={() => setReferenceImage(null)}
                           className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/ref:opacity-100 text-[10px]"
                        >
                          ×
                        </button>
                    </div>
                 )}
             </div>
             <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{label}</div>
         </div>

         <div className="relative w-full" style={{ paddingBottom: getPaddingBottom() }}>
             <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-black/40">
                <AnimatePresence mode="wait">
                    {!hasStarted ? (
                        <motion.div 
                            key="start"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-3 w-full h-full justify-center cursor-pointer group/btn"
                            onClick={generate}
                        >
                            <div className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg group-hover/btn:scale-110 transition-transform">
                                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>⚡</motion.span>
                            </div>
                            <span className="text-xs font-bold text-gray-800 dark:text-white bg-white/80 dark:bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">生成</span>
                        </motion.div>
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
                    ) : error ? (
                        <motion.div 
                            key="error"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-2 text-red-400 p-4 text-center"
                        >
                            <span className="text-xl">⚠️</span>
                            <span className="text-xs">{error}</span>
                            <button onClick={generate} className="text-xs underline hover:text-red-300">Retry</button>
                        </motion.div>
                    ) : imageUrl ? (
                        <motion.img 
                            key="image"
                            src={imageUrl} 
                            alt="Generated Content" 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-full h-full object-cover" 
                        />
                    ) : null}
                </AnimatePresence>
             </div>
             
             {/* Prompt Overlay */}
             {prompt && (
                 <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                    <p className="text-[10px] text-white/80 line-clamp-2 font-mono leading-tight">{prompt}</p>
                 </div>
             )}
              
             {/* Toolbar Actions - Refresh, Download, Zoom */}
             {imageUrl && !loading && (
                 <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            const link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = `skysper-gen-${Date.now()}.png`;
                            link.click();
                        }}
                        className="p-1.5 bg-black/50 backdrop-blur rounded-md text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        title="下载 (Download)"
                     >
                        <DownloadIcon className="w-3 h-3" />
                     </button>
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsZoomed(true);
                        }}
                        className="p-1.5 bg-black/50 backdrop-blur rounded-md text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        title="放大预览 (Enlarge)"
                     >
                        <ZoomIcon className="w-3 h-3" />
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); generate(); }}
                        className="p-1.5 bg-black/50 backdrop-blur rounded-md text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        title="重新生成 (Regenerate)"
                     >
                        <RefreshIcon className="w-3 h-3" />
                     </button>
                 </div>
             )}
         </div>

         {/* Zoom Modal */}
         {isZoomed && imageUrl && (
            <div 
              className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
              onClick={(e) => {
                 e.stopPropagation();
                 setIsZoomed(false);
              }}
            >
               <div className="relative max-w-[95vw] max-h-[95vh]">
                   <img 
                     src={imageUrl} 
                     className="w-full h-full object-contain rounded-lg shadow-2xl"
                     onClick={(e) => e.stopPropagation()} 
                   />
                   <button 
                     className="absolute -top-10 right-0 text-white/70 hover:text-white p-2"
                     onClick={() => setIsZoomed(false)}
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
               </div>
            </div>
         )}
    </div>
  );
};
