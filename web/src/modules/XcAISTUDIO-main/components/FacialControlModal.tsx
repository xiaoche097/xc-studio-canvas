import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, Eye, RotateCcw, RefreshCw, ShieldCheck, ArrowUp } from 'lucide-react';
import { 
    FACE_3D_NEUTRAL, 
    FACE_3D_HAPPY, 
    FACE_3D_EXCITED, 
    FACE_3D_SAD, 
    FACE_3D_DEPRESSED,
    FACE_3D_MOUTH_POUT,
    FACE_3D_MOUTH_SNICKER,
    FACE_3D_MOUTH_OPEN,
    FACE_3D_GAZE_UP,
    FACE_3D_GAZE_LEFT
} from './face3dAssets';

interface FacialControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply?: (params: { emotion?: string; gaze?: string; mouth?: string }) => void;
    currentImage?: string;
    canvasScale?: number;
}

// 1. 情绪对应的 3D 表情与描述
const EMOTION_CONFIGS: Record<string, { label: string; avatarSrc: string }> = {
    '平静': { label: '自然平静', avatarSrc: FACE_3D_NEUTRAL },
    '开心': { label: '开怀大笑', avatarSrc: FACE_3D_HAPPY },
    '兴奋': { label: '激动惊喜', avatarSrc: FACE_3D_EXCITED },
    '低落': { label: '情绪低落', avatarSrc: FACE_3D_DEPRESSED },
    '难过': { label: '呜咽失控', avatarSrc: FACE_3D_SAD }
};

// 2. 视线方向 3x3 矩阵配置 (对齐截图 1)
const GAZE_OPTIONS: Array<{ id: string; label: string; avatarSrc: string }> = [
    { id: 'top-left', label: '左上', avatarSrc: FACE_3D_GAZE_UP },
    { id: 'top', label: '上方', avatarSrc: FACE_3D_GAZE_UP },
    { id: 'top-right', label: '右上', avatarSrc: FACE_3D_GAZE_UP },
    { id: 'left', label: '左侧', avatarSrc: FACE_3D_GAZE_LEFT },
    { id: 'center', label: '正视', avatarSrc: FACE_3D_NEUTRAL },
    { id: 'right', label: '右侧', avatarSrc: FACE_3D_GAZE_LEFT },
    { id: 'bottom-left', label: '左下', avatarSrc: FACE_3D_GAZE_LEFT },
    { id: 'bottom', label: '下方', avatarSrc: FACE_3D_NEUTRAL },
    { id: 'bottom-right', label: '右下', avatarSrc: FACE_3D_GAZE_LEFT },
];

// 3. 嘴巴形态 3x3 矩阵配置 (对齐截图 2)
const MOUTH_OPTIONS: Array<{ id: string; label: string; avatarSrc: string }> = [
    { id: 'snicker', label: '单侧嗤笑', avatarSrc: FACE_3D_MOUTH_SNICKER },
    { id: 'laugh', label: '大笑', avatarSrc: FACE_3D_HAPPY },
    { id: 'pout', label: '嘟嘴', avatarSrc: FACE_3D_MOUTH_POUT },
    { id: 'crooked', label: '歪嘴', avatarSrc: FACE_3D_MOUTH_SNICKER },
    { id: 'smile', label: '微笑', avatarSrc: FACE_3D_HAPPY },
    { id: 'pout_sad', label: '瘪嘴', avatarSrc: FACE_3D_SAD },
    { id: 'bite', label: '咬嘴唇', avatarSrc: FACE_3D_MOUTH_POUT },
    { id: 'open', label: '张嘴', avatarSrc: FACE_3D_MOUTH_OPEN },
    { id: 'droop', label: '嘴角下垂', avatarSrc: FACE_3D_DEPRESSED },
];

export const FacialControlModal: React.FC<FacialControlModalProps> = ({
    isOpen,
    onClose,
    onApply,
    currentImage,
    canvasScale = 1,
}) => {
    // 顶部 Tab 状态
    const [activeTab, setActiveTab] = useState<'emotion' | 'gaze' | 'mouth'>('emotion');
    
    // 情绪控制状态 (默认 null 代表未选择/不调整)
    const [coord, setCoord] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'3d' | 'real'>('3d');

    // 视线方向状态 (默认 null 代表未选择/默认)
    const [selectedGaze, setSelectedGaze] = useState<string | null>(null);

    // 嘴巴形态状态 (默认 null 代表未选择/默认)
    const [selectedMouth, setSelectedMouth] = useState<string | null>(null);

    // Toast 警告气泡消息
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 高级控制
    const [resolution, setResolution] = useState('2K');
    const [scale, setScale] = useState('1X');

    const gridRef = useRef<HTMLDivElement>(null);
    const rafIdRef = useRef<number | null>(null);

    // Toast 自动消失
    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        window.setTimeout(() => {
            setToastMessage(null);
        }, 2800);
    }, []);

    // 情绪判定
    const calculateEmotionKey = useCallback((x: number, y: number) => {
        if (Math.abs(x) < 0.25 && Math.abs(y) < 0.25) return '平静';
        if (x < -0.3) return '难过';
        if (x > 0.3) return '开心';
        if (y < -0.3) return '兴奋';
        if (y > 0.3) return '低落';
        return '平静';
    }, []);

    const updateCoordFromMouseEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (!gridRef.current) return;
        
        // 严格互斥规则 1：如果已经选择了视线或嘴巴，阻断情绪选择，弹出必须点了 x 提示
        if (selectedGaze || selectedMouth) {
            showToast('已选择视线和嘴巴控制，无法进行情绪控制选择，请点了视线/嘴巴 x 重置后再进行操作');
            return;
        }

        const rect = gridRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        let normX = (mouseX / rect.width) * 2 - 1;
        let normY = (mouseY / rect.height) * 2 - 1;

        normX = Math.max(-0.95, Math.min(0.95, normX));
        normY = Math.max(-0.95, Math.min(0.95, normY));

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
            setCoord({ x: normX, y: normY });
            const key = calculateEmotionKey(normX, normY);
            setSelectedEmotion(EMOTION_CONFIGS[key]?.label || '自然平静');
        });
    }, [calculateEmotionKey, selectedGaze, selectedMouth, showToast]);

    useEffect(() => {
        if (!isDragging) return;
        const handleWindowMouseMove = (e: MouseEvent) => updateCoordFromMouseEvent(e);
        const handleWindowMouseUp = () => setIsDragging(false);

        window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
        window.addEventListener('mouseup', handleWindowMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDragging, updateCoordFromMouseEvent]);

    if (!isOpen) return null;

    const handleMouseDownOnGrid = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedGaze || selectedMouth) {
            showToast('已选择视线和嘴巴控制，无法进行情绪控制选择，请点了视线/嘴巴 x 重置后再进行操作');
            return;
        }
        setIsDragging(true);
        updateCoordFromMouseEvent(e);
    };

    // 快速定位处理
    const handleQuickLocate = (type: '开心' | '兴奋' | '低落' | '难过') => {
        if (selectedGaze || selectedMouth) {
            showToast('已选择视线和嘴巴控制，无法进行情绪控制选择，请点了视线/嘴巴 x 重置后再进行操作');
            return;
        }
        let nextCoord = { x: 0, y: 0 };
        if (type === '开心') nextCoord = { x: 0.7, y: 0.1 };
        else if (type === '兴奋') nextCoord = { x: 0.1, y: -0.7 };
        else if (type === '低落') nextCoord = { x: 0.0, y: 0.7 };
        else if (type === '难过') nextCoord = { x: -0.7, y: 0.0 };
        
        setCoord(nextCoord);
        setSelectedEmotion(EMOTION_CONFIGS[type]?.label || type);
    };

    const handleResetEmotion = () => { setCoord({ x: 0, y: 0 }); setSelectedEmotion(null); };

    // 严格互斥规则 2：选择视线时，如果已经选择了情绪，必须阻止并弹出提示！
    const handleSelectGaze = (label: string) => {
        if (selectedEmotion) {
            showToast('已选择情绪控制，无法进行视线和嘴巴控制选择，请点了情绪 x 重置后再进行操作');
            return;
        }
        setSelectedGaze(label === selectedGaze ? null : label);
    };

    // 严格互斥规则 3：选择嘴型时，如果已经选择了情绪，必须阻止并弹出提示！
    const handleSelectMouth = (label: string) => {
        if (selectedEmotion) {
            showToast('已选择情绪控制，无法进行视线和嘴巴控制选择，请点了情绪 x 重置后再进行操作');
            return;
        }
        setSelectedMouth(label === selectedMouth ? null : label);
    };

    // 图像展示匹配
    const currentEmotionKey = Object.keys(EMOTION_CONFIGS).find(k => EMOTION_CONFIGS[k].label === selectedEmotion) || '平静';
    const currentEmotionConfig = EMOTION_CONFIGS[currentEmotionKey];
    const activeEmotionImage = previewMode === 'real' && currentImage ? currentImage : currentEmotionConfig.avatarSrc;

    // 当前选中的视线 3D 渲染图
    const activeGazeItem = GAZE_OPTIONS.find(g => g.label === selectedGaze) || GAZE_OPTIONS[4];

    // 当前选中的嘴型 3D 渲染图 (对齐图 2)
    const activeMouthItem = MOUTH_OPTIONS.find(m => m.label === selectedMouth) || MOUTH_OPTIONS[2];

    // 提交最终 Prompt 逻辑：只拼接真正选中的维度，绝不强行加默认项
    const handleGenerate = () => {
        onApply?.({ 
            emotion: selectedEmotion || undefined, 
            gaze: selectedGaze || undefined, 
            mouth: selectedMouth || undefined 
        });
        onClose();
    };

    return (
        <div 
            className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-[300] w-[840px] max-w-[92vw] bg-[#141416]/98 border border-white/10 rounded-[28px] shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col overflow-hidden text-left font-sans animate-in zoom-in-95 duration-200 select-none pointer-events-auto relative"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Toast 警告气泡 (完全 1:1 对齐截图 2) */}
            {toastMessage && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-xl bg-black/90 border border-white/15 text-xs font-semibold text-zinc-100 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-center max-w-[85%]">
                    {toastMessage}
                </div>
            )}

            {/* 1. 顶部 Header */}
            <div className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-baseline gap-3">
                    <h2 className="text-base font-bold text-white tracking-wide">面部控制</h2>
                    <span className="text-xs text-zinc-400 font-medium">改变选中单张人物的内容，其余不变</span>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                >
                    <X size={15} />
                </button>
            </div>

            {/* 2. 顶部分页 Tab 选项 */}
            <div className="px-7 pt-3.5 pb-2.5 border-b border-white/5 bg-black/20">
                <div className="inline-flex bg-black/60 p-1 rounded-xl border border-white/5">
                    {[
                        { id: 'emotion', label: '情绪控制' },
                        { id: 'gaze', label: '视线方向' },
                        { id: 'mouth', label: '嘴巴形态' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-white/15 text-white shadow-sm border border-white/10' 
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. 面板主体内容 (按 ActiveTab 切换) */}
            <div className="p-6 bg-[#141416]">
                {/* A. 情绪控制 Tab */}
                {activeTab === 'emotion' && (
                    <div className="grid grid-cols-12 gap-6">
                        {/* 左侧: 2D 情绪坐标控制轴 */}
                        <div className="col-span-7 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-300">情绪控制</span>
                                <span className="text-xs font-semibold text-zinc-400">当前: <span className="text-white font-bold">{selectedEmotion || '默认'}</span></span>
                            </div>

                            <div 
                                ref={gridRef}
                                onMouseDown={handleMouseDownOnGrid}
                                className={`relative aspect-[4/3] w-full bg-[#08080a] border border-white/10 rounded-2xl overflow-hidden cursor-crosshair group/grid flex items-center justify-center ${selectedGaze || selectedMouth ? 'opacity-50' : ''}`}
                            >
                                <div className="absolute inset-0 flex items-center justify-center opacity-45 pointer-events-none transition-opacity duration-300">
                                    <img 
                                        key={currentEmotionKey}
                                        src={currentEmotionConfig.avatarSrc} 
                                        className="w-full h-full object-cover filter grayscale contrast-125 brightness-90 animate-in fade-in duration-200"
                                        alt="3D Emotion Face Grid"
                                    />
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[0.5px]" />
                                </div>

                                <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-zinc-300 tracking-wider pointer-events-none drop-shadow-md">兴奋</span>
                                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-zinc-300 tracking-wider pointer-events-none drop-shadow-md">低落</span>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-300 tracking-wider pointer-events-none drop-shadow-md">难过</span>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-300 tracking-wider pointer-events-none drop-shadow-md">开心</span>

                                <div className="absolute inset-y-6 left-1/2 border-r border-dashed border-white/25 pointer-events-none" />
                                <div className="absolute inset-x-6 top-1/2 border-b border-dashed border-white/25 pointer-events-none" />

                                <div className="absolute inset-8 grid grid-cols-5 grid-rows-5 pointer-events-none opacity-60">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={i} className="flex items-center justify-center">
                                            <div className="w-1 h-1 rounded-full bg-white/50 shadow-sm" />
                                        </div>
                                    ))}
                                </div>

                                <div 
                                    className="absolute z-20 w-5 h-5 rounded-full bg-white border-2 border-white shadow-[0_0_16px_rgba(255,255,255,1)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{
                                        left: selectedEmotion ? `${((coord.x + 1) / 2) * 100}%` : '50%',
                                        top: selectedEmotion ? `${((coord.y + 1) / 2) * 100}%` : '50%',
                                        willChange: 'left, top',
                                    }}
                                >
                                    <div className="w-full h-full rounded-full bg-white animate-ping opacity-30" />
                                </div>
                            </div>

                            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">拖动中心位置圆点，实时预览里查看</span>
                        </div>

                        {/* 右侧: 实时预览 & 快速定位 */}
                        <div className="col-span-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-300">实时预览</span>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={() => setPreviewMode(m => m === '3d' ? 'real' : '3d')}
                                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md transition-all border border-emerald-500/20"
                                        >
                                            {previewMode === '3d' ? '切换真实原图' : '切换 3D 人脸'}
                                        </button>
                                        <button className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-md transition-all">
                                            <span>预设情绪</span>
                                            <span>&gt;</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-[#08080a] shadow-inner">
                                    <img 
                                        key={`${currentEmotionKey}-${previewMode}`}
                                        src={activeEmotionImage} 
                                        className="w-full h-full object-cover contrast-105 animate-in fade-in duration-200"
                                        alt="Realtime Emotion Face Preview"
                                    />
                                    <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 text-[9px] font-bold backdrop-blur-md">
                                        {previewMode === '3d' ? '3D面部拟合' : '节点原图映射'}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#18181b]/70 border border-white/5 rounded-2xl p-3 flex flex-col gap-2.5">
                                <span className="text-xs font-bold text-zinc-300">快速定位</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['开心', '兴奋', '低落', '难过'] as const).map((label) => (
                                        <button
                                            key={label}
                                            onClick={() => handleQuickLocate(label)}
                                            className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all active:scale-95 text-center ${
                                                selectedEmotion === EMOTION_CONFIGS[label]?.label || selectedEmotion === label 
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                                                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-zinc-200'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-zinc-400">
                                    <button className="flex items-center gap-1 hover:text-white transition-colors"><Eye size={12} /><span>调整前</span></button>
                                    <button className="flex items-center gap-1 hover:text-white transition-colors"><RotateCcw size={12} /><span>撤销</span></button>
                                    <button onClick={handleResetEmotion} className="flex items-center gap-1 hover:text-white transition-colors"><RefreshCw size={12} /><span>重置</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* B. 视线方向 Tab (1:1 复刻截图 1) */}
                {activeTab === 'gaze' && (
                    <div className="grid grid-cols-12 gap-6">
                        {/* 左侧: 3D 视线大预览图 */}
                        <div className="col-span-6 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-300">视线方向</span>
                                <span className="text-xs font-semibold text-zinc-400">当前: <span className="text-white font-bold">{selectedGaze || '默认'}</span></span>
                            </div>
                            
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-[#08080a] flex items-center justify-center group/preview">
                                <img 
                                    src={activeGazeItem.avatarSrc} 
                                    className="w-full h-full object-cover grayscale contrast-110 filter brightness-95"
                                    alt="3D Gaze Face Preview"
                                />
                                <button 
                                    onClick={() => setSelectedGaze(null)}
                                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-[10px] font-bold text-zinc-300 hover:text-white border border-white/10 backdrop-blur-md flex items-center gap-1 transition-all"
                                >
                                    <RefreshCw size={11} />
                                    <span>重置</span>
                                </button>
                            </div>
                        </div>

                        {/* 右侧: 3x3 视线方向选择矩阵 (完全对齐截图 1) */}
                        <div className="col-span-6 bg-[#101012] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                            <div className="grid grid-cols-3 gap-3 h-full">
                                {GAZE_OPTIONS.map(opt => {
                                    const isSelected = selectedGaze === opt.label;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSelectGaze(opt.label)}
                                            className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 group ${
                                                isSelected 
                                                    ? 'bg-white/10 border-white/30 text-white shadow-lg ring-1 ring-white/20' 
                                                    : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200'
                                            }`}
                                        >
                                            <div className="w-12 h-12 rounded-lg overflow-hidden mb-1.5 opacity-60 group-hover:opacity-100 transition-opacity bg-black/40">
                                                <img src={opt.avatarSrc} className="w-full h-full object-cover grayscale" alt={opt.label} />
                                            </div>
                                            <span className="text-[11px] font-bold">{opt.label}</span>
                                            {isSelected && <div className="absolute bottom-1 w-5 h-0.5 bg-white rounded-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* C. 嘴巴形态 Tab (1:1 复刻截图 2) */}
                {activeTab === 'mouth' && (
                    <div className="grid grid-cols-12 gap-6">
                        {/* 左侧: 3D 嘴型大预览图 (对齐图 2 嘟嘴 3D 雕塑) */}
                        <div className="col-span-6 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-300">嘴巴形态</span>
                                <span className="text-xs font-semibold text-zinc-400">当前: <span className="text-white font-bold">{selectedMouth || '默认'}</span></span>
                            </div>
                            
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-[#08080a] flex items-center justify-center group/preview">
                                <img 
                                    src={activeMouthItem.avatarSrc} 
                                    className="w-full h-full object-cover grayscale contrast-110 filter brightness-95"
                                    alt="3D Mouth Face Preview"
                                />
                                <button 
                                    onClick={() => setSelectedMouth(null)}
                                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-[10px] font-bold text-zinc-300 hover:text-white border border-white/10 backdrop-blur-md flex items-center gap-1 transition-all"
                                >
                                    <RefreshCw size={11} />
                                    <span>重置</span>
                                </button>
                            </div>
                        </div>

                        {/* 右侧: 3x3 嘴巴形态选择矩阵 (完全对齐截图 2) */}
                        <div className="col-span-6 bg-[#101012] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                            <div className="grid grid-cols-3 gap-3 h-full">
                                {MOUTH_OPTIONS.map(opt => {
                                    const isSelected = selectedMouth === opt.label;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSelectMouth(opt.label)}
                                            className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 group ${
                                                isSelected 
                                                    ? 'bg-white/10 border-white/30 text-white shadow-lg ring-1 ring-white/20' 
                                                    : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200'
                                            }`}
                                        >
                                            <div className="w-12 h-12 rounded-lg overflow-hidden mb-1.5 opacity-60 group-hover:opacity-100 transition-opacity bg-black/40">
                                                <img src={opt.avatarSrc} className="w-full h-full object-cover grayscale" alt={opt.label} />
                                            </div>
                                            <span className="text-[11px] font-bold">{opt.label}</span>
                                            {isSelected && <div className="absolute bottom-1 w-5 h-0.5 bg-white rounded-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. 底部 Footer 生成控制工具栏 (精致双行布局，完全 1:1 对齐参考图 1 & 截图 2) */}
            <div className="px-7 py-4 border-t border-white/5 bg-[#101012] flex flex-col gap-3.5 text-left">
                {/* 上层: 本次人物调节操作 Pills 标签 */}
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-zinc-300 shrink-0">本次人物调节操作</span>
                    <div className="flex items-center gap-2">
                        {/* 情绪 Pill */}
                        <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 shrink-0 transition-all ${
                            selectedEmotion 
                                ? 'bg-white/10 text-white border-white/15' 
                                : 'bg-white/5 text-zinc-400 border-white/5'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedEmotion ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                            <span>情绪 · {selectedEmotion || '默认'}</span>
                            {selectedEmotion && <X size={10} className="cursor-pointer hover:text-red-400 ml-0.5" onClick={handleResetEmotion} />}
                        </div>

                        {/* 视线 Pill */}
                        <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 shrink-0 transition-all ${
                            selectedGaze 
                                ? 'bg-white/10 text-white border-white/15' 
                                : 'bg-white/5 text-zinc-400 border-white/5'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedGaze ? 'bg-cyan-400' : 'bg-zinc-500'}`} />
                            <span>视线 · {selectedGaze || '默认'}</span>
                            {selectedGaze && <X size={10} className="cursor-pointer hover:text-red-400 ml-0.5" onClick={() => setSelectedGaze(null)} />}
                        </div>

                        {/* 嘴巴 Pill */}
                        <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 shrink-0 transition-all ${
                            selectedMouth 
                                ? 'bg-white/10 text-white border-white/15' 
                                : 'bg-white/5 text-zinc-400 border-white/5'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedMouth ? 'bg-purple-400' : 'bg-zinc-500'}`} />
                            <span>嘴巴 · {selectedMouth || '默认'}</span>
                            {selectedMouth && <X size={10} className="cursor-pointer hover:text-red-400 ml-0.5" onClick={() => setSelectedMouth(null)} />}
                        </div>
                    </div>
                </div>

                {/* 下层: 已启用保护项 + 2K + 1X + 生成按钮 */}
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                        <ShieldCheck size={14} className="text-emerald-400" />
                        <span>已启用全部保护项</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setResolution(r => r === '2K' ? '4K' : '2K')}
                            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1 transition-all"
                        >
                            <span>{resolution}</span>
                            <ChevronDown size={12} />
                        </button>

                        <button 
                            onClick={() => setScale(s => s === '1X' ? '2X' : '1X')}
                            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1 transition-all"
                        >
                            <span>{scale}</span>
                            <ChevronDown size={12} />
                        </button>

                        <button 
                            onClick={handleGenerate}
                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#27272a] hover:bg-emerald-500 text-white hover:text-black border border-white/10 text-xs font-black transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95 group"
                        >
                            <span>生成</span>
                            <div className="w-4 h-4 rounded-full bg-white/10 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                <ArrowUp size={11} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
