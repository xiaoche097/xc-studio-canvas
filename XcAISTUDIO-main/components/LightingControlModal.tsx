import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCcw, ArrowUp, Sun, Sparkles, Scan } from 'lucide-react';
import { detectImageLighting } from '../services/lightingAnalysisService';

export interface LightingParams {
    azimuth: number;    // -180 ~ 180 (水平环绕)
    elevation: number;  // -90 ~ 90 (高度)
    intensity: number;  // 0 ~ 100 (%) (强度)
    color: string;      // HEX color (e.g. '#FFFFFF')
    viewMode: 'perspective' | 'front';
}

interface LightingControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (params: LightingParams) => void;
    onChange?: (params: LightingParams) => void;
    currentImage?: string;
}

const DEFAULT_LIGHTING: LightingParams = {
    azimuth: 0,
    elevation: 0,
    intensity: 30,
    color: '#FFFFFF',
    viewMode: 'perspective',
};

const PRESET_LIGHTS = [
    { label: '左侧', azimuth: -90, elevation: 0 },
    { label: '顶部', azimuth: 0, elevation: 75 },
    { label: '右侧', azimuth: 90, elevation: 0 },
    { label: '前方', azimuth: 0, elevation: 0 },
    { label: '底部', azimuth: 0, elevation: -75 },
    { label: '后方', azimuth: 180, elevation: 0 },
];

const PRESET_COLORS = [
    { label: '纯白光', hex: '#FFFFFF' },
    { label: '暖窗光', hex: '#FFE8CD' },
    { label: '日光', hex: '#FFF4E0' },
    { label: '冷月光', hex: '#E0F2FE' },
    { label: '夕阳金', hex: '#FDE68A' },
    { label: '霓虹红', hex: '#F87171' },
];

const hexToRgba = (hex: string, alpha: number) => {
    try {
        let c = (hex || '#FFFFFF').replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
        return `rgba(255, 255, 255, ${alpha})`;
    }
};

export const LightingControlModal: React.FC<LightingControlModalProps> = ({
    isOpen,
    onClose,
    onApply,
    onChange,
    currentImage,
}) => {
    // 1. ALL HOOKS MUST BE DECLARED UNCONDITIONAL AT TOP
    const [params, setParams] = useState<LightingParams>(DEFAULT_LIGHTING);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const sphereCanvasRef = useRef<HTMLCanvasElement>(null);

    const updateParams = useCallback((next: Partial<LightingParams>) => {
        setParams(prev => {
            const updated = { ...prev, ...next };
            onChange?.(updated);
            return updated;
        });
    }, [onChange]);

    const handleReset = useCallback(() => {
        setParams(DEFAULT_LIGHTING);
        onChange?.(DEFAULT_LIGHTING);
    }, [onChange]);

    const handleDetectLighting = useCallback(async () => {
        if (!currentImage) return;
        setIsAnalyzing(true);
        try {
            const detected = await detectImageLighting(currentImage);
            updateParams(detected);
        } catch (err) {
            console.error('Failed to detect image lighting:', err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [currentImage, updateParams]);

    const draw3DSphere = useCallback(() => {
        if (!isOpen) return;
        try {
            const canvas = sphereCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;
            const cx = width / 2;
            const cy = height / 2;
            const R = Math.min(width, height) * 0.38;

            ctx.clearRect(0, 0, width, height);

            // 1. Outer sphere glowing circle & grid
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 15, 18, 0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Latitude & Longitude wireframe circles
            const isPerspective = params.viewMode === 'perspective';
            const gridRings = 5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;

            for (let i = 1; i < gridRings; i++) {
                const rLat = R * Math.sin((i / gridRings) * Math.PI);
                ctx.beginPath();
                ctx.ellipse(cx, cy, R, Math.max(1, rLat * 0.4), isPerspective ? 0.2 : 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 2. Center Image Plane (3D Perspective tilt)
            const planeW = 70;
            const planeH = 95;
            ctx.save();
            ctx.translate(cx, cy);
            if (isPerspective) {
                ctx.transform(1, -0.15, 0.1, 0.95, 0, 0);
            }
            ctx.beginPath();
            ctx.rect(-planeW / 2, -planeH / 2, planeW, planeH);
            ctx.fillStyle = '#18181b';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (currentImage) {
                const img = new Image();
                img.src = currentImage;
                if (img.complete && img.naturalWidth) {
                    ctx.drawImage(img, -planeW / 2 + 2, -planeH / 2 + 2, planeW - 4, planeH - 4);
                }
            }
            ctx.restore();

            // 3. Calculate 3D Light Point Position
            const radAz = (params.azimuth * Math.PI) / 180;
            const radEl = (params.elevation * Math.PI) / 180;

            const lx = cx + R * Math.cos(radEl) * Math.sin(radAz);
            const ly = cy - R * Math.sin(radEl) * (isPerspective ? 0.7 : 0.9);

            // Light cone beam from light point to center
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(cx - planeW * 0.2, cy - planeH * 0.2);
            ctx.lineTo(cx + planeW * 0.2, cy + planeH * 0.2);
            ctx.closePath();
            const beamGrad = ctx.createRadialGradient(lx, ly, 2, cx, cy, R);
            beamGrad.addColorStop(0, hexToRgba(params.color, 0.3));
            beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = beamGrad;
            ctx.fill();

            // Light Point node on sphere
            ctx.beginPath();
            ctx.arc(lx, ly, 10, 0, Math.PI * 2);
            ctx.fillStyle = params.color || '#FFFFFF';
            ctx.shadowColor = params.color || '#FFFFFF';
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        } catch (e) {
            console.error('Canvas 3D Sphere draw error:', e);
        }
    }, [isOpen, params, currentImage]);

    useEffect(() => {
        if (isOpen) {
            draw3DSphere();
        }
    }, [isOpen, draw3DSphere]);

    const updateSphereFromMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
        const canvas = sphereCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const R = Math.min(rect.width, rect.height) * 0.38;

        const dx = mouseX - cx;
        const dy = cy - mouseY;

        let newAz = Math.round((dx / R) * 180);
        let newEl = Math.round((dy / R) * 90);

        newAz = Math.max(-180, Math.min(180, newAz));
        newEl = Math.max(-90, Math.min(90, newEl));

        updateParams({ azimuth: newAz, elevation: newEl });
    }, [updateParams]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        updateSphereFromMouse(e);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => updateSphereFromMouse(e);
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, updateSphereFromMouse]);

    // EARLY RETURN ONLY BEFORE JSX RETURN, NEVER BEFORE HOOKS!
    if (!isOpen) return null;

    return (
        <div
            className="absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 z-[600] w-[720px] max-w-[92vw] bg-[#1c1c1e] border border-white/15 rounded-[26px] shadow-[0_24px_70px_rgba(0,0,0,0.95)] p-5 text-zinc-100 animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Sun size={16} className="text-amber-300" />
                        <span className="text-[14px] font-bold text-white tracking-wide">3D 摄影打光</span>
                    </div>
                    <button
                        onClick={handleDetectLighting}
                        disabled={isAnalyzing || !currentImage}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/30 text-amber-200 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        title="智能识别原图当下的打光方向与色彩"
                    >
                        <Scan size={13} className={isAnalyzing ? 'animate-spin' : ''} />
                        <span>{isAnalyzing ? '分析打光中...' : '🔍 识别原图光源'}</span>
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X size={15} />
                </button>
            </div>


            {/* Main Content Grid: Left 3D Canvas + Right Controls */}
            <div className="grid grid-cols-12 gap-5 mt-4">
                {/* Left Area: 3D Light Sphere */}
                <div className="col-span-6 flex flex-col bg-black/40 border border-white/10 rounded-2xl p-3 relative">
                    {/* Perspective / Front Switcher */}
                    <div className="flex justify-center mb-2">
                        <div className="inline-flex bg-white/5 p-1 rounded-xl border border-white/10 text-[11px] font-bold">
                            <button
                                onClick={() => updateParams({ viewMode: 'perspective' })}
                                className={`px-4 py-1 rounded-lg transition-all ${
                                    params.viewMode === 'perspective' ? 'bg-white/20 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                透视
                            </button>
                            <button
                                onClick={() => updateParams({ viewMode: 'front' })}
                                className={`px-4 py-1 rounded-lg transition-all ${
                                    params.viewMode === 'front' ? 'bg-white/20 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                正面
                            </button>
                        </div>
                    </div>

                    {/* Interactive 3D Sphere Canvas */}
                    <div className="relative aspect-square w-full flex items-center justify-center cursor-crosshair">
                        <canvas
                            ref={sphereCanvasRef}
                            width={300}
                            height={300}
                            className="w-full h-full"
                            onMouseDown={handleCanvasMouseDown}
                        />
                    </div>

                    {/* Bottom Left Reset Button */}
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-300 hover:text-white transition-colors"
                        >
                            <RotateCcw size={12} />
                            <span>重置</span>
                        </button>
                        <span className="text-[10px] text-zinc-500 font-medium">拖动球面上光源点改变角度</span>
                    </div>
                </div>

                {/* Right Area: Presets & Sliders */}
                <div className="col-span-6 flex flex-col justify-between space-y-4">
                    {/* 1. 主光源 (6 Presets) */}
                    <div>
                        <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-2">主光源</span>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_LIGHTS.map((p) => {
                                const isActive = params.azimuth === p.azimuth && params.elevation === p.elevation;
                                return (
                                    <button
                                        key={p.label}
                                        onClick={() => updateParams({ azimuth: p.azimuth, elevation: p.elevation })}
                                        className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                                            isActive
                                                ? 'bg-white/20 border-white/30 text-white shadow-md'
                                                : 'bg-white/[0.03] hover:bg-white/10 border-white/5 text-zinc-300'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. 全局参数调节 */}
                    <div className="space-y-3 bg-black/30 border border-white/5 rounded-2xl p-3">
                        <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">全局调节</span>

                        {/* 水平环绕 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-300 font-semibold">
                                <span>水平环绕</span>
                                <span className="bg-black/50 px-2 py-0.5 rounded font-mono text-zinc-200">{params.azimuth}°</span>
                            </div>
                            <input
                                type="range"
                                min={-180}
                                max={180}
                                value={params.azimuth}
                                onChange={(e) => updateParams({ azimuth: Number(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-200"
                            />
                        </div>

                        {/* 高度 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-300 font-semibold">
                                <span>高度</span>
                                <span className="bg-black/50 px-2 py-0.5 rounded font-mono text-zinc-200">{params.elevation}°</span>
                            </div>
                            <input
                                type="range"
                                min={-90}
                                max={90}
                                value={params.elevation}
                                onChange={(e) => updateParams({ elevation: Number(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-200"
                            />
                        </div>

                        {/* 强度 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-300 font-semibold">
                                <span>强度</span>
                                <span className="bg-black/50 px-2 py-0.5 rounded font-mono text-zinc-200">{params.intensity}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={params.intensity}
                                onChange={(e) => updateParams({ intensity: Number(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-zinc-200"
                            />
                        </div>

                        {/* 灯光颜色 */}
                        <div className="space-y-1.5 pt-1 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] text-zinc-300 font-semibold">
                                <span>灯光颜色</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={params.color}
                                        onChange={(e) => updateParams({ color: e.target.value })}
                                        className="w-5 h-5 rounded-md border border-white/20 bg-transparent cursor-pointer"
                                    />
                                    <span className="font-mono text-zinc-400">{params.color.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c.hex}
                                        onClick={() => updateParams({ color: c.hex })}
                                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                                            params.color === c.hex ? 'border-white ring-2 ring-white/30 scale-110' : 'border-white/10 hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: c.hex }}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Right Submit Action Button */}
                    <div className="pt-2 flex justify-end">
                        <button
                            onClick={() => {
                                onApply(params);
                                onClose();
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Sparkles size={14} />
                            <span>生成商业光影</span>
                            <ArrowUp size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
