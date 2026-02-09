import React from 'react';
import { ImageResolution, AspectRatio, EditPoint } from '../../types';
import { Upload, X, Loader2, Sparkles, Compass, AlertCircle, RefreshCw, Wand2, Camera } from 'lucide-react';

interface EditorSidebarProps {
    mode: 'move' | 'point' | 'eraser' | 'camera';
    cameraAngle: { yaw: number; pitch: number; zoom: number };
    setCameraAngle: (angle: { yaw: number; pitch: number; zoom: number }) => void;
    handleCameraShift: () => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    points: EditPoint[];
    setPoints: (points: EditPoint[]) => void;
    editPrompt: string;
    setEditPrompt: (prompt: string) => void;
    isOptimizing: boolean;
    handleOptimizePrompt: () => void;
    referenceImages: { id: string; base64: string; mimeType: string }[];
    setReferenceImages: (images: { id: string; base64: string; mimeType: string }[]) => void;
    handleRefUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeRefImage: (id: string) => void;
    handleEdit: () => void;
    isEditing: boolean;
    error: string | null;
    selectedResolution: ImageResolution;
    setSelectedResolution: (res: ImageResolution) => void;
    selectedAspectRatio: AspectRatio;
    setSelectedAspectRatio: (ratio: AspectRatio) => void;
    currentImage: string | null;
    showRefineInput: boolean;
    setShowRefineInput: (show: boolean) => void;
    refineInstruction: string;
    setRefineInstruction: (instruction: string) => void;
    handleRefinePrompt: () => void;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
    mode,
    cameraAngle,
    setCameraAngle,
    handleCameraShift,
    brushSize,
    setBrushSize,
    points,
    setPoints,
    editPrompt,
    setEditPrompt,
    isOptimizing,
    handleOptimizePrompt,
    referenceImages,
    handleRefUpload,
    removeRefImage,
    handleEdit,
    isEditing,
    error,
    selectedResolution,
    setSelectedResolution,
    selectedAspectRatio,
    setSelectedAspectRatio,
    currentImage,
    showRefineInput,
    setShowRefineInput,
    refineInstruction,
    setRefineInstruction,
    handleRefinePrompt
}) => {

    const hasContentToProcess = currentImage && (editPrompt || points.length > 0 || referenceImages.length > 0);

    return (
        <aside className="w-[420px] bg-pastel-card border-l border-pastel-border flex flex-col z-40 h-full shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">

            {/* Header */}
            <div className="p-6 border-b border-pastel-border bg-pastel-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-pastel-highlight rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-pastel-muted uppercase tracking-widest">Creative Intelligence</span>
                </div>
                <h2 className="text-2xl font-bold text-pastel-text tracking-tight">创意中心</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                {/* --- CAMERA MODE --- */}
                {mode === 'camera' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3 pb-2 border-b border-pastel-border">
                            <Compass className="w-5 h-5 text-pastel-highlight" />
                            <div>
                                <h3 className="text-sm font-bold text-pastel-text">3D 运镜系统</h3>
                                <p className="text-[10px] text-pastel-muted">Virtual Camera Control</p>
                            </div>
                        </div>

                        {/* 3D Visualizer Placeholder - Pure CSS 3D Cube */}
                        <div className="bg-pastel-bg p-6 rounded-2xl flex justify-center perspective-[1000px] border border-pastel-border">
                            <div
                                className="w-24 h-24 relative transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform-style-3d"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: `rotateX(${cameraAngle.pitch}deg) rotateY(${cameraAngle.yaw}deg) scale(${cameraAngle.zoom})`
                                }}
                            >
                                {/* Cube Faces */}
                                {[
                                    { id: 'front', tx: 'translateZ(48px)', bg: 'bg-pastel-highlight', text: '正' },
                                    { id: 'back', tx: 'rotateY(180deg) translateZ(48px)', bg: 'bg-pastel-highlight/90', text: '背' },
                                    { id: 'right', tx: 'rotateY(90deg) translateZ(48px)', bg: 'bg-pastel-pink', text: '右' },
                                    { id: 'left', tx: 'rotateY(-90deg) translateZ(48px)', bg: 'bg-pastel-pink', text: '左' },
                                    { id: 'top', tx: 'rotateX(90deg) translateZ(48px)', bg: 'bg-pastel-border', text: '顶' },
                                    { id: 'bottom', tx: 'rotateX(-90deg) translateZ(48px)', bg: 'bg-pastel-border', text: '底' }
                                ].map(face => (
                                    <div key={face.id} className={`absolute inset-0 ${face.bg} opacity-90 border border-white/20 flex items-center justify-center text-white font-bold shadow-lg backface-hidden`} style={{ transform: face.tx }}>
                                        {face.text}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-5">
                            {[
                                { label: '水平旋转 (Yaw)', val: cameraAngle.yaw, set: (v: number) => setCameraAngle({ ...cameraAngle, yaw: v }), min: 0, max: 360, unit: '°' },
                                { label: '垂直俯仰 (Pitch)', val: cameraAngle.pitch, set: (v: number) => setCameraAngle({ ...cameraAngle, pitch: v }), min: -90, max: 90, unit: '°' },
                                { label: '镜头距离 (Zoom)', val: cameraAngle.zoom, set: (v: number) => setCameraAngle({ ...cameraAngle, zoom: v }), min: 0.5, max: 2.5, step: 0.1, unit: 'x' },
                            ].map((ctrl) => (
                                <div key={ctrl.label}>
                                    <div className="flex justify-between text-[11px] font-medium text-pastel-muted mb-2">
                                        <span>{ctrl.label}</span>
                                        <span className="font-mono text-pastel-text">{typeof ctrl.val === 'number' && ctrl.val % 1 !== 0 ? ctrl.val.toFixed(1) : ctrl.val}{ctrl.unit}</span>
                                    </div>
                                    <input
                                        type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step || 1}
                                        value={ctrl.val}
                                        onChange={(e) => ctrl.set(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-pastel-bg rounded-lg appearance-none cursor-pointer accent-pastel-highlight hover:accent-pastel-pink"
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleCameraShift}
                            disabled={isEditing}
                            className="w-full py-3 bg-pastel-highlight text-white rounded-xl font-bold text-sm hover:bg-pastel-pinkhover transition-all flex items-center justify-center gap-2"
                        >
                            {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            <span>渲染新视角</span>
                        </button>
                    </div>
                )}

                {/* --- ERASER MODE --- */}
                {mode === 'eraser' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-pastel-text uppercase">笔刷大小</label>
                            <span className="text-xs font-mono text-pastel-muted">{brushSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="10" max="200"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-pastel-bg rounded-lg appearance-none cursor-pointer accent-pastel-highlight"
                        />
                        <div className="p-4 bg-zinc-50 rounded-xl text-xs text-zinc-500 leading-relaxed">
                            使用涂抹工具覆盖您想要移除或修改的区域。AI 将自动填充这些区域。
                        </div>
                    </div>
                )}

                {/* --- POINTS MODE --- */}
                {points.length > 0 && (
                    <div className="space-y-4 animate-in slide-in-from-right-2 duration-300 p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-700">选中区域 ({points.length})</h4>
                            <button onClick={() => setPoints([])} className="text-[10px] text-red-500 hover:underline">清空</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {points.map((p, i) => (
                                <div key={p.id} className="relative group bg-white border border-zinc-200 rounded-lg p-1 pr-3 flex items-center gap-2 shadow-sm">
                                    {p.snapshot && <img src={p.snapshot} className="w-8 h-8 rounded-md object-cover bg-zinc-100" alt="" />}
                                    <span className="text-xs font-bold text-zinc-600">#{i + 1}</span>
                                    <button
                                        onClick={() => setPoints(points.filter(pt => pt.id !== p.id))}
                                        className="absolute -top-1 -right-1 bg-white border border-zinc-200 rounded-full p-0.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- PROMPT INPUT --- */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-pastel-text border-l-2 border-pastel-highlight pl-2">创意指令</label>
                        {!showRefineInput && (
                            <button
                                onClick={() => setShowRefineInput(true)}
                                className="text-[10px] font-medium text-pastel-highlight hover:bg-pastel-pink px-2 py-1 rounded transition-colors flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" /> AI 润色
                            </button>
                        )}
                    </div>

                    <div className="relative group">
                        <textarea
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="描述您的创意修改... (例如: '将背景换成海滩', '增加温暖的阳光')"
                            className={`
                w-full h-32 p-4 bg-pastel-input border rounded-2xl outline-none resize-none transition-all text-sm text-pastel-text placeholder:text-pastel-muted
                ${isOptimizing ? 'border-pastel-pink bg-pastel-bg' : 'border-pastel-border focus:border-pastel-highlight focus:bg-white'}
              `}
                            disabled={isOptimizing}
                        />
                        {isOptimizing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-2xl">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            </div>
                        )}
                    </div>

                    {showRefineInput && (
                        <div className="animate-in slide-in-from-top-2">
                            <div className="flex gap-2 p-1.5 bg-pastel-bg border border-pastel-border rounded-xl">
                                <input
                                    value={refineInstruction}
                                    onChange={(e) => setRefineInstruction(e.target.value)}
                                    placeholder="输入优化要求..."
                                    className="flex-1 bg-transparent px-2 text-xs outline-none text-pastel-text placeholder:text-pastel-muted"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefinePrompt()}
                                />
                                <button onClick={handleRefinePrompt} className="px-3 py-1 bg-pastel-highlight text-white text-[10px] rounded-lg font-bold hover:bg-pastel-pinkhover">执行</button>
                                <button onClick={() => setShowRefineInput(false)} className="px-2 text-pastel-muted hover:text-pastel-highlight"><X className="w-3 h-3" /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- REFERENCE IMAGES --- */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-pastel-text border-l-2 border-pastel-highlight pl-2 flex justify-between">
                        参考图 (Reference)
                        <span className="text-[10px] font-normal text-pastel-muted">{referenceImages.length}/3</span>
                    </label>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {referenceImages.length < 3 && (
                            <label className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-bg transition-all cursor-pointer flex flex-col items-center justify-center gap-1">
                                <Upload className="w-4 h-4 text-pastel-muted" />
                                <span className="text-[9px] text-pastel-muted font-bold">上传</span>
                                <input type="file" multiple accept="image/*" onChange={handleRefUpload} className="hidden" />
                            </label>
                        )}
                        {referenceImages.map(img => (
                            <div key={img.id} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 group">
                                <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover" alt="" />
                                <button
                                    onClick={() => removeRefImage(img.id)}
                                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- SETTINGS --- */}
                <div className="pt-6 border-t border-zinc-100 space-y-4">
                    {/* Resolution & Aspect Ratio */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-pastel-muted uppercase">分辨率</label>
                            <select
                                value={selectedResolution}
                                onChange={(e) => setSelectedResolution(e.target.value as ImageResolution)}
                                className="w-full bg-pastel-input border border-pastel-border text-xs font-bold rounded-lg p-2 outline-none focus:border-pastel-highlight text-pastel-text"
                            >
                                <option value={ImageResolution.RES_1K}>1K Standard</option>
                                <option value={ImageResolution.RES_2K}>2K High-Res</option>
                                <option value={ImageResolution.RES_4K}>4K Ultra</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-pastel-muted uppercase">画幅</label>
                            <select
                                value={selectedAspectRatio}
                                onChange={(e) => setSelectedAspectRatio(e.target.value as AspectRatio)}
                                className="w-full bg-pastel-input border border-pastel-border text-xs font-bold rounded-lg p-2 outline-none focus:border-pastel-highlight text-pastel-text"
                            >
                                <option value={AspectRatio.SQUARE}>1:1 Square</option>
                                <option value={AspectRatio.PORTRAIT_3_4}>3:4 Portrait</option>
                                <option value={AspectRatio.LANDSCAPE_4_3}>4:3 Landscape</option>
                                <option value={AspectRatio.LANDSCAPE_16_9}>16:9 Cinema</option>
                            </select>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-600 animate-in shake">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-xs font-medium leading-relaxed">{error}</p>
                    </div>
                )}

            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-pastel-border bg-white">
                <button
                    onClick={handleEdit}
                    disabled={!hasContentToProcess || isEditing}
                    className={`
            w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all
            ${!hasContentToProcess
                            ? 'bg-pastel-bg text-pastel-muted cursor-not-allowed'
                            : isEditing
                                ? 'bg-pastel-highlight text-white cursor-wait opacity-80'
                                : 'bg-pastel-highlight text-white hover:bg-pastel-pinkhover hover:scale-[1.02] shadow-xl shadow-pastel-pink/20'}
          `}
                >
                    {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    {isEditing ? 'GENERATING...' : 'RUN CREATIVE'}
                </button>
            </div>

        </aside>
    );
};

export default EditorSidebar;
