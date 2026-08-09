import React, { useState } from 'react';
import { ColorAdjustments } from '../types';
import { RotateCcw, Eye, X, SunMedium, Palette, SlidersHorizontal, FlaskConical, Wand2 } from 'lucide-react';

interface ColorAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    adjustments?: ColorAdjustments;
    onChange: (newAdjustments: ColorAdjustments) => void;
    onCompareChange?: (isComparing: boolean) => void;
}

const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,

    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,

    texture: 0,
    clarity: 0,
    sharpen: 0,
    noiseReduction: 0,
    colorNoiseReduction: 0,

    dehaze: 0,
    vignette: 0,
    grain: 0,
    fade: 0,
    blur: 0,
};

export const ColorAdjustmentModal: React.FC<ColorAdjustmentModalProps> = ({
    isOpen,
    onClose,
    adjustments = {},
    onChange,
    onCompareChange,
}) => {
    const [activeTab, setActiveTab] = useState<'light' | 'color' | 'detail' | 'effects'>('light');

    if (!isOpen) return null;

    const current = { ...DEFAULT_ADJUSTMENTS, ...adjustments };

    const updateField = (field: keyof ColorAdjustments, val: number) => {
        const next = { ...current, [field]: val };
        onChange(next);
    };

    const handleReset = () => {
        onChange(DEFAULT_ADJUSTMENTS);
    };

    const handleAutoOptimize = () => {
        onChange({
            ...current,
            exposure: 12,
            contrast: 15,
            highlights: -10,
            shadows: 15,
            whites: 6,
            blacks: -4,
            temperature: 3,
            tint: 0,
            vibrance: 16,
            saturation: 10,
            texture: 8,
            clarity: 12,
            sharpen: 15,
            dehaze: 10,
        });
    };

    const renderSlider = (
        label: string,
        field: keyof ColorAdjustments,
        min: number = -100,
        max: number = 100
    ) => {
        const val = current[field] ?? 0;
        return (
            <div className="flex flex-col gap-1.5 py-1.5" key={field}>
                <div className="flex justify-between items-center text-[11px] text-zinc-300">
                    <span className="font-semibold">{label}</span>
                    <span className="text-zinc-400 font-mono text-[10px]">{val}</span>
                </div>
                <div className="relative flex items-center">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        value={val}
                        onChange={(e) => updateField(field, Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-200"
                    />
                </div>
            </div>
        );
    };

    return (
        <div 
            className="absolute left-[calc(100%+16px)] top-0 z-[600] w-72 bg-[#1c1c1e] border border-white/15 rounded-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-4 text-zinc-100 animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto"
            style={{
                maxHeight: '580px',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-[13px] font-bold text-white tracking-wide">调色</span>
                <div className="flex items-center gap-1.5">
                    {/* 重置 */}
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="重置"
                    >
                        <RotateCcw size={14} />
                    </button>
                    {/* 自动优化 */}
                    <button
                        onClick={handleAutoOptimize}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-white/10 transition-colors"
                        title="自动优化"
                    >
                        <Wand2 size={14} />
                    </button>
                    {/* 按住对比 */}
                    <button
                        onMouseDown={() => onCompareChange?.(true)}
                        onMouseUp={() => onCompareChange?.(false)}
                        onMouseLeave={() => onCompareChange?.(false)}
                        onTouchStart={() => onCompareChange?.(true)}
                        onTouchEnd={() => onCompareChange?.(false)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors active:text-cyan-400"
                        title="按住对比原图"
                    >
                        <Eye size={14} />
                    </button>
                    {/* 关闭 */}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="关闭"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>


            {/* Category Tab Bar (4 sub-tabs) */}
            <div className="grid grid-cols-4 gap-1 p-1 my-3 bg-white/5 rounded-xl border border-white/5">
                <button
                    onClick={() => setActiveTab('light')}
                    className={`flex items-center justify-center py-1.5 rounded-lg transition-all ${
                        activeTab === 'light' ? 'bg-white/20 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="光线"
                >
                    <SunMedium size={14} />
                </button>
                <button
                    onClick={() => setActiveTab('color')}
                    className={`flex items-center justify-center py-1.5 rounded-lg transition-all ${
                        activeTab === 'color' ? 'bg-white/20 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="颜色"
                >
                    <Palette size={14} />
                </button>
                <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex items-center justify-center py-1.5 rounded-lg transition-all ${
                        activeTab === 'detail' ? 'bg-white/20 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="细节"
                >
                    <SlidersHorizontal size={14} />
                </button>
                <button
                    onClick={() => setActiveTab('effects')}
                    className={`flex items-center justify-center py-1.5 rounded-lg transition-all ${
                        activeTab === 'effects' ? 'bg-white/20 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="效果"
                >
                    <FlaskConical size={14} />
                </button>
            </div>

            {/* Scrollable Sliders */}
            <div className="overflow-y-auto max-h-[55vh] pr-1 space-y-3 custom-scrollbar">
                {activeTab === 'light' && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">光线</div>
                        {renderSlider('曝光', 'exposure')}
                        {renderSlider('对比度', 'contrast')}
                        {renderSlider('高光', 'highlights')}
                        {renderSlider('阴影', 'shadows')}
                        {renderSlider('白色', 'whites')}
                        {renderSlider('黑色', 'blacks')}
                    </div>
                )}

                {activeTab === 'color' && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">颜色</div>
                        {renderSlider('色温', 'temperature')}
                        {renderSlider('色调', 'tint')}
                        {renderSlider('自然饱和度', 'vibrance')}
                        {renderSlider('饱和度', 'saturation')}
                    </div>
                )}

                {activeTab === 'detail' && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">细节</div>
                        {renderSlider('纹理', 'texture')}
                        {renderSlider('清晰度', 'clarity')}
                        {renderSlider('锐化', 'sharpen', 0, 100)}
                        {renderSlider('降噪', 'noiseReduction', 0, 100)}
                        {renderSlider('色彩降噪', 'colorNoiseReduction', 0, 100)}
                    </div>
                )}

                {activeTab === 'effects' && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">效果</div>
                        {renderSlider('去雾', 'dehaze')}
                        {renderSlider('暗角', 'vignette')}
                        {renderSlider('颗粒', 'grain', 0, 100)}
                        {renderSlider('褪色', 'fade')}
                        {renderSlider('模糊', 'blur', 0, 100)}
                    </div>
                )}
            </div>
        </div>
    );
};
