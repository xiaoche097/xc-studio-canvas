import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface ModelTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (modelImage: string, garmentImage: string, aspectRatio: string, resolution: string) => void;
}

export const ModelTryOnModal: React.FC<ModelTryOnModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("3:4");
  const [resolution, setResolution] = useState<string>("1K");
  const modelInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);

  const ratios = [
    { label: "1:1", value: "1:1" },
    { label: "3:4", value: "3:4" },
    { label: "4:3", value: "4:3" },
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
  ];

  const resolutions = ["1K", "2K", "4K"];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isModel: boolean) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (isModel) setModelImage(reader.result);
          else setGarmentImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickTry = (m: string, g: string) => {
      setModelImage(m);
      setGarmentImage(g);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl relative"
            >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors z-10"
                >
                    ✕
                </button>

                <div className="p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            模特上身 <span className="text-xs font-normal px-2 py-1 bg-brand-orange/10 text-brand-orange rounded-full border border-brand-orange/20">Beta</span>
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">目前支持包袋，帽子，项链，耳饰，眼镜等模特上身效果</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        {/* Connector Icon */}
                        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-[#1a1a1a] rounded-full border border-gray-200 dark:border-white/10 items-center justify-center text-gray-400 z-10">
                            +
                        </div>

                        {/* Model Upload */}
                        <div 
                            className={`
                                relative h-64 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group
                                ${modelImage ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-brand-orange/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                            `}
                            onClick={() => !modelImage && modelInputRef.current?.click()}
                        >
                            {modelImage ? (
                                <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                    <img src={modelImage} className="w-full h-full object-cover" alt="Model" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setModelImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-brand-orange transition-colors">
                                        <UploadIcon className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">找找或点此上传模特图</p>
                                    <button className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg shadow-lg shadow-brand-blue/20 hover:scale-105 transition-transform text-sm font-bold">
                                        本地上传
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={modelInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                        </div>

                        {/* Garment Upload */}
                        <div 
                            className={`
                                relative h-64 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group
                                ${garmentImage ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-brand-orange/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                            `}
                            onClick={() => !garmentImage && garmentInputRef.current?.click()}
                        >
                            {garmentImage ? (
                                <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                    <img src={garmentImage} className="w-full h-full object-cover" alt="Garment" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setGarmentImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-brand-orange transition-colors">
                                        <UploadIcon className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">找找或点此上传服饰图</p>
                                    <button className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg shadow-lg shadow-brand-blue/20 hover:scale-105 transition-transform text-sm font-bold">
                                        本地上传
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={garmentInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, false)} />
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                        {/* Examples */}
                        <div className="flex gap-4">
                            <span className="text-xs text-gray-500 self-center">快速案例:</span>
                            {[1, 2].map((i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleQuickTry(
                                        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400", // Model
                                        "https://images.unsplash.com/photo-1551232864-3f52236a3f29?w=400"  // Product
                                    )}
                                    className="w-12 h-8 rounded border border-gray-200 dark:border-white/10 overflow-hidden opacity-70 hover:opacity-100 transition-all flex"
                                >
                                     <div className="w-1/2 h-full bg-gray-200"></div>
                                     <div className="w-1/2 h-full bg-gray-300"></div>
                                </button>
                            ))}
                        </div>

                        {/* Aspect Ratio Selector */}
                        <div className="flex items-center gap-2">
                             <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">生成比例:</span>
                             <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                {ratios.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setAspectRatio(r.value)}
                                        className={`
                                            px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                            ${aspectRatio === r.value 
                                                ? 'bg-white dark:bg-white/10 text-brand-orange shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}
                                        `}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                             </div>
                        </div>

                        {/* Resolution Selector */}
                        <div className="flex items-center gap-2">
                             <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">清晰度:</span>
                             <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                {resolutions.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setResolution(r)}
                                        className={`
                                            px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                            ${resolution === r 
                                                ? 'bg-white dark:bg-white/10 text-brand-orange shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}
                                        `}
                                    >
                                        {r}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8 flex justify-end">
                        <button 
                            onClick={() => modelImage && garmentImage && onConfirm(modelImage, garmentImage, aspectRatio, resolution)}
                            disabled={!modelImage || !garmentImage}
                            className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all
                                ${modelImage && garmentImage 
                                    ? 'bg-brand-orange hover:shadow-brand-orange/30 hover:-translate-y-1 cursor-pointer' 
                                    : 'bg-gray-300 dark:bg-white/10 cursor-not-allowed'}
                            `}
                        >
                            开始生成
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    </AnimatePresence>
  );
};
