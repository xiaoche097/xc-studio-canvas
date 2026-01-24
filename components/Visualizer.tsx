import React, { useState, useEffect } from 'react';
import { gemini } from '../lib/gemini';
import { RefreshIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualizerProps {
  prompt: string;
  aspectRatio?: string;
  label?: string;
  initialImage?: string | null;
  autoGenerate?: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ prompt, aspectRatio = "1:1", label = "PREVIEW", initialImage, autoGenerate = true }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(autoGenerate);

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    setHasStarted(true);
    try {
      const result = await gemini.generateImagePreview(prompt);
      if (typeof result === 'object' && result?.url) {
        setImageUrl(result.url);
      } else {
        setImageUrl(result as unknown as string);
      }
    } catch (err) {
      console.error("Visualizer Error:", err);
      setImageUrl(`https://placehold.co/600x600/ED6D46/white?text=${encodeURIComponent(label)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGenerate) {
      generate();
    }
  }, [prompt]);

  return (
    <div className="relative group overflow-hidden bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 w-full">
         <div style={{ paddingBottom: aspectRatio === '1:1' ? '100%' : '56.25%' }}></div>
         
         <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
                {!hasStarted ? (
                    <motion.div 
                        key="start"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3 w-full h-full justify-center bg-gray-200/50 dark:bg-black/40 backdrop-blur-sm cursor-pointer group/btn"
                        onClick={generate}
                    >
                        <div className="w-12 h-12 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg group-hover/btn:scale-110 transition-transform">
                            <motion.span 
                              animate={{ scale: [1, 1.2, 1] }} 
                              transition={{ repeat: Infinity, duration: 2 }}
                            >⚡</motion.span>
                        </div>
                        <span className="text-sm font-bold text-gray-800 dark:text-white bg-white/80 dark:bg-black/60 px-3 py-1 rounded-full">点击生成图片</span>
                    </motion.div>
                ) : loading ? (
                    <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full"
                        />
                        <span className="text-xs text-brand-orange font-mono animate-pulse">Rendering...</span>
                    </motion.div>
                ) : error ? (
                    <motion.div 
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-2 text-red-400 p-4 text-center"
                    >
                        <span className="text-2xl">⚠️</span>
                        <span className="text-xs">{error}</span>
                        <button onClick={generate} className="text-xs underline">Retry</button>
                    </motion.div>
                ) : imageUrl ? (
                    <motion.img 
                        key="image"
                        src={imageUrl} 
                        alt="Generated Preview" 
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="w-full h-full object-cover" 
                    />
                ) : null}
            </AnimatePresence>
         </div>

         {/* Overlay Label */}
         <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 dark:bg-black/60 backdrop-blur rounded text-xs text-brand-orange font-bold border border-brand-orange/20 z-10">
            {label}
         </div>

         {/* Refresh Action */}
         <button 
            onClick={(e) => { e.stopPropagation(); generate(); }}
            className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-black/60 backdrop-blur rounded-lg text-gray-500 hover:text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity z-10"
         >
            <RefreshIcon className="w-4 h-4" />
         </button>
         
         {/* Prompt Overlay on Hover */}
         {prompt && (
             <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-[10px] text-white/90 line-clamp-2 font-mono">{prompt}</p>
             </div>
         )}
    </div>
  );
};
