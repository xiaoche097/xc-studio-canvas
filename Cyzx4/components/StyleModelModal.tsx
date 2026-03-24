import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Info } from 'lucide-react';
import { STYLE_PRESETS, StylePreset } from '../constants/stylePresets';

interface StyleModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (style: StylePreset | null) => void;
    currentSelectedId?: string;
}

const CATEGORIES = ['全部', '电商', '摄影', '艺术', '通用'] as const;

export const StyleModelModal: React.FC<StyleModelModalProps> = ({ 
    isOpen, 
    onClose, 
    onSelect,
    currentSelectedId 
}) => {
    const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('全部');

    if (!isOpen) return null;

    const filteredStyles = activeCategory === '全部' 
        ? STYLE_PRESETS 
        : STYLE_PRESETS.filter(s => s.category === activeCategory);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-white/20"
                >
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-500/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">风格广场</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">选择一个风格模型以增强生成效果</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="px-8 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-black/10">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                                    activeCategory === cat
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-gray-400'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Style Grid */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                            {/* None Option */}
                            <div 
                                onClick={() => { onSelect(null); onClose(); }}
                                className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-white/5 hover:border-orange-500/50 ${
                                    !currentSelectedId ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-transparent'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 group-hover:text-orange-500 transition-colors">
                                    <X className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">无风格</span>
                                {!currentSelectedId && (
                                    <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg">
                                        <Check className="w-3.5 h-3.5" />
                                    </div>
                                )}
                            </div>

                            {filteredStyles.map(style => (
                                <div 
                                    key={style.id}
                                    onClick={() => { onSelect(style); onClose(); }}
                                    className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:border-orange-500/50 hover:-translate-y-1 shadow-sm hover:shadow-xl ${
                                        currentSelectedId === style.id ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-transparent'
                                    }`}
                                >
                                    <img 
                                        src={style.previewUrl} 
                                        alt={style.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 group-hover:opacity-90 transition-opacity flex flex-col justify-end p-4">
                                        <h3 className="text-white font-bold text-sm leading-tight drop-shadow-md">{style.name}</h3>
                                        <p className="text-white/60 text-[10px] mt-1 line-clamp-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100 font-medium">{style.description}</p>
                                    </div>

                                    {/* Selected Badge */}
                                    {currentSelectedId === style.id && (
                                        <div className="absolute top-3 right-3 w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-orange-500/20">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    )}

                                    {/* Info Icon */}
                                    <button className="absolute top-3 left-3 w-7 h-7 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40">
                                        <Info className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer / Info */}
                    <div className="px-8 py-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between">
                        <p className="text-xs text-gray-400 font-medium">共 {STYLE_PRESETS.length} 个风格模型可用</p>
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            取消
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
