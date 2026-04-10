import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImageFiles } from '../Cyzx4/utils/imageCompressor';

interface MarketingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (images: string[], aspectRatio: string, description: string, resolution: string) => void;
}

export const MarketingModal: React.FC<MarketingModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [images, setImages] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState<string>("1:1");
    const [resolution, setResolution] = useState<string>("2k");
    const [description, setDescription] = useState<string>(''); // Added description state
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ratios = [
        { label: "1:1 (主图)", value: "1:1" },
        { label: "3:4 (社媒)", value: "3:4" },
        { label: "4:3 (展示)", value: "4:3" },
        { label: "16:9 (横幅)", value: "16:9" },
        { label: "9:16 (Story)", value: "9:16" },
    ];

    const resolutions = [
        { label: "1k (快速)", value: "1k" },
        { label: "2k (高清)", value: "2k" },
        { label: "4k (Vip)", value: "4k" },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newImages: string[] = [];
            const files = await compressImageFiles(Array.from(e.target.files));

            let processedCount = 0;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        newImages.push(reader.result);
                    }
                    processedCount++;
                    if (processedCount === files.length) {
                        setImages(prev => [...prev, ...newImages].slice(0, 5)); // Limit to 5
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleQuickTry = (img: string) => {
        setImages([img]);
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
                                营销图生成 <span className="text-xs font-normal px-2 py-1 bg-brand-orange/10 text-brand-orange rounded-full border border-brand-orange/20">Pro</span>
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">支持上传图片后选择风格模板，一键生成Post图、亚马逊五宣宣传图等</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Side: Upload */}
                            <div>
                                {/* Image Upload Area */}
                                <div
                                    className={`
                                    relative h-72 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden
                                    ${images.length > 0 ? 'border-gray-200 dark:border-white/10' : 'border-gray-300 dark:border-white/20 hover:border-brand-blue/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                                `}
                                    onClick={() => images.length < 5 && fileInputRef.current?.click()}
                                >
                                    {images.length > 0 ? (
                                        <div className="w-full h-full p-4 grid grid-cols-2 gap-4 overflow-y-auto content-start">
                                            {images.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                                                    <img src={img} className="w-full h-full object-cover" alt={`Upload ${idx}`} />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            {images.length < 5 && (
                                                <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    <div className="text-center">
                                                        <span className="text-2xl text-gray-400">+</span>
                                                        <p className="text-xs text-gray-400 mt-1">添加更多</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400 hover:text-brand-blue transition-colors">
                                                <UploadIcon className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">可拖拽图片或点此上传</h3>
                                            <p className="text-sm text-gray-500 mt-2">支持 JPG, PNG • 最多 5 张</p>
                                            <button className="mt-6 px-6 py-2 bg-blue-50 text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors text-sm font-bold">
                                                本地上传
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            </div>

                            {/* Right Side: Inputs */}
                            <div className="flex flex-col gap-6">
                                {/* Description Input */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                        营销文案/详细描述 <span className="text-gray-400 font-normal ml-1">(可选)</span>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="例如：亚马逊黑五大促广告，黑色背景，金色文字，强调限时50% OFF优惠，营造节日狂欢氛围..."
                                        className="w-full h-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-all"
                                    ></textarea>
                                </div>

                                {/* Aspect Ratio Selector */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                        生成比例
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {ratios.map(r => (
                                            <button
                                                key={r.value}
                                                onClick={() => setAspectRatio(r.value)}
                                                className={`
                                                px-3 py-2 rounded-lg text-sm font-medium transition-all border flex-1 text-center whitespace-nowrap
                                                ${aspectRatio === r.value
                                                        ? 'bg-brand-orange text-white border-brand-orange'
                                                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300'}
                                            `}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Resolution Selector New*/}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                        清晰度 (分辨率)
                                    </label>
                                    <div className="flex gap-2">
                                        {resolutions.map(r => (
                                            <button
                                                key={r.value}
                                                onClick={() => setResolution(r.value)}
                                                className={`
                                                px-3 py-2 rounded-lg text-sm font-medium transition-all border flex-1 text-center whitespace-nowrap
                                                ${resolution === r.value
                                                        ? 'bg-brand-orange text-white border-brand-orange'
                                                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300'}
                                            `}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Examples */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                        快速尝试
                                    </label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleQuickTry("https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400")}
                                            className="w-16 h-16 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden hover:opacity-80 transition-opacity"
                                        >
                                            <img src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400" className="w-full h-full object-cover" alt="Example 1" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickTry("https://images.unsplash.com/photo-1516961642265-531546e84af2?w=400")}
                                            className="w-16 h-16 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden hover:opacity-80 transition-opacity"
                                        >
                                            <img src="https://images.unsplash.com/photo-1516961642265-531546e84af2?w=400" className="w-full h-full object-cover" alt="Example 2" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => images.length > 0 && onConfirm(images, aspectRatio, description, resolution)}
                                disabled={images.length === 0}
                                className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all flex items-center gap-2
                                ${images.length > 0
                                        ? 'bg-gradient-to-r from-brand-orange to-red-500 hover:shadow-brand-orange/30 hover:-translate-y-1 cursor-pointer'
                                        : 'bg-gray-300 dark:bg-white/10 cursor-not-allowed'}
                            `}
                            >
                                <span>由 AI 生成营销图</span>
                                <span className="text-lg">✨</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
