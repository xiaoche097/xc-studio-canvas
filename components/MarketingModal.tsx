import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productImage: string) => void;
}

export const MarketingModal: React.FC<MarketingModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [productImage, setProductImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setProductImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickTry = (img: string) => {
      setProductImage(img);
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
                    <div className="mb-8 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                营销图生成
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                支持上传图片后选择风格模版，一键生成Post图、亚马逊黑五宣传图等
                            </p>
                        </div>
                        {/* Decorative Graphic (Optional, based on screenshot) */}
                        <div className="hidden md:block w-32">
                            {/* Placeholder for the graphic in top right */}
                        </div>
                    </div>

                    {/* Main Upload Area */}
                    <div 
                        className={`
                            relative h-72 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group
                            ${productImage ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-brand-blue/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                        `}
                        onClick={() => !productImage && fileInputRef.current?.click()}
                    >
                        {productImage ? (
                            <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                <img src={productImage} className="w-full h-full object-contain p-4" alt="Product" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setProductImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-6">
                                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-brand-blue transition-colors">
                                    <UploadIcon className="w-8 h-8" />
                                </div>
                                <p className="text-base font-bold text-gray-700 dark:text-gray-200">可拖拽图片或点此上传</p>
                                <button className="mt-6 px-8 py-2.5 bg-brand-blue/10 text-brand-blue dark:text-blue-400 hover:bg-brand-blue hover:text-white rounded-xl font-bold transition-all">
                                    本地上传
                                </button>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </div>

                    {/* Examples */}
                    <div className="mt-8 border-t border-gray-100 dark:border-white/5 pt-6">
                        <p className="text-xs text-gray-500 mb-4 text-center">快速尝试以下案例</p>
                        <div className="flex justify-center gap-6">
                            {[ 
                                "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", // Jacket
                                "https://images.unsplash.com/photo-1570222094114-28a9d8894b74?w=400", // Blender (approx)
                                "https://images.unsplash.com/photo-1516961642265-531546e84af2?w=400"  // Camera/Tech
                            ].map((img, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleQuickTry(img)}
                                    className="group relative w-24 h-24 p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:border-brand-blue/50 hover:shadow-lg transition-all bg-white dark:bg-white/5"
                                >
                                    <img src={img} className="w-full h-full object-contain" alt={`Example ${i}`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8 flex justify-end">
                        <button 
                            onClick={() => productImage && onConfirm(productImage)}
                            disabled={!productImage}
                            className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all
                                ${productImage 
                                    ? 'bg-brand-blue hover:shadow-blue-500/30 hover:-translate-y-1 cursor-pointer' 
                                    : 'bg-gray-300 dark:bg-white/10 cursor-not-allowed'}
                            `}
                        >
                            由 AI 生成营销图
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    </AnimatePresence>
  );
};
