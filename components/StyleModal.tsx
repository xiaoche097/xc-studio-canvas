import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productImage: string, styleImage: string) => void;
}

export const StyleModal: React.FC<StyleModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [productImage, setProductImage] = useState<string | null>(null);
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isProduct: boolean) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (isProduct) setProductImage(reader.result);
          else setStyleImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickTry = (prod: string, style: string) => {
      setProductImage(prod);
      setStyleImage(style);
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
                            风格模仿
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">上传原图及参考图，风格模板快速克隆</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        
                        {/* Product Upload */}
                        <div 
                            className={`
                                relative h-64 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group
                                ${productImage ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-brand-orange/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                            `}
                            onClick={() => !productImage && productInputRef.current?.click()}
                        >
                            {productImage ? (
                                <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                    <img src={productImage} className="w-full h-full object-contain p-2" alt="Product" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setProductImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-brand-orange transition-colors">
                                        <UploadIcon className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">拖拽或点此上传商品图</p>
                                    <button className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg shadow-lg shadow-brand-blue/20 hover:scale-105 transition-transform text-sm font-bold">
                                        本地上传
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={productInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                        </div>

                        {/* Style Upload */}
                        <div 
                            className={`
                                relative h-64 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group
                                ${styleImage ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-brand-orange/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                            `}
                            onClick={() => !styleImage && styleInputRef.current?.click()}
                        >
                            {styleImage ? (
                                <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                    <img src={styleImage} className="w-full h-full object-cover" alt="Style" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setStyleImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-brand-orange transition-colors">
                                        <UploadIcon className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">拖拽或点此上传风格参考图</p>
                                    <button className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg shadow-lg shadow-brand-blue/20 hover:scale-105 transition-transform text-sm font-bold">
                                        本地上传
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={styleInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, false)} />
                        </div>
                    </div>

                    {/* Examples */}
                    <div className="mt-8 border-t border-gray-100 dark:border-white/5 pt-6">
                        <p className="text-xs text-gray-500 mb-4 text-center">快速尝试以下案例</p>
                        <div className="flex justify-center gap-4">
                            {[1, 2, 3].map((i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleQuickTry(
                                        "https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=400", // Perfume/Product
                                        "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400"  // Nature/Style
                                    )}
                                    className="group relative w-32 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 opacity-70 hover:opacity-100 hover:scale-105 transition-all"
                                >
                                    <div className="absolute inset-0 flex">
                                        <div className="w-1/2 h-full bg-white flex items-center justify-center"><img src="https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=400" className="w-[80%] h-[80%] object-contain" /></div>
                                        <div className="w-1/2 h-full bg-gray-200"><img src="https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400" className="w-full h-full object-cover" /></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8 flex justify-end">
                        <button 
                            onClick={() => productImage && styleImage && onConfirm(productImage, styleImage)}
                            disabled={!productImage || !styleImage}
                            className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all
                                ${productImage && styleImage 
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
