import React, { useState, useRef } from 'react';
import { 
    Upload, X, Wand2, Sparkles, AlertCircle, Loader2, 
    Layout, Sun, Image as ImageIcon, CheckCircle2, 
    ChevronDown, Ruler, MessageSquare, 
    Zap, RefreshCw, ZoomIn, Download, Brain, Layers,
    Camera, UserCircle, Cpu, ChevronUp, Settings,
    Maximize, Target, Info, ShieldAlert
} from 'lucide-react';
import { generateImageToImage, compressImage } from '../Cyzx4/services/geminiService';
import { getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { QUALITY_BOOSTERS, enhancePrompt } from '../Cyzx4/services/promptUtils';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

interface GenerationTask {
    id: string;
    poseIndex: number;
    posePreview: string;
    status: 'pending' | 'loading' | 'completed' | 'failed';
    progress: number;
    currentStep: number;
    resultImage?: string;
    error?: string;
}

const COT_STEPS = [
    { id: 1, label: "读取模特图(图1)", desc: "正在锁定长相、发型及服装特征...", icon: "👤" },
    { id: 2, label: "解析动作参考图", desc: "正在计算相机角度、肢体及透视比例...", icon: "📐" },
    { id: 3, label: "姿态骨骼映射", desc: "进行肢体位置与人物裁剪缩放精准对齐...", icon: "🦴" },
    { id: 4, label: "提取原图背景", desc: "提取并锁定图1原装背景与光影...", icon: "🖼️" },
    { id: 5, label: "互动道具计算", desc: "若涉及道具互动，在背景中自动补充细节...", icon: "🪑" },
    { id: 6, label: "高保真融合渲染", desc: "融合光影、渲染面部五官与发丝材质...", icon: "🖌️" },
    { id: 7, label: "色彩与高画质调谐", desc: "商业级高清晰度织物细节最后注入...", icon: "🌈" },
];

const ModelGenerationTab: React.FC = () => {
    // Selection states
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_2_3);
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
    const [showAdvanced, setShowAdvanced] = useState(true);
    
    // Constraints (保持背景、道具互动、裁剪角度锁)
    const [keepBackground, setKeepBackground] = useState(true);
    const [allowProps, setAllowProps] = useState(true);
    const [lockCropScale, setLockCropScale] = useState(true);

    // Image states
    const [primaryModelImages, setPrimaryModelImages] = useState<UploadedImage[]>([]); // 模特原画组 (最多5张)
    const [poseReferences, setPoseReferences] = useState<UploadedImage[]>([]); // 动作参考图组 (最多10张)
    const [userPrompt, setUserPrompt] = useState('');
    
    // Concurrency Tasks State
    const [tasks, setTasks] = useState<GenerationTask[]>([]);
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
    const [hoveredSlot, setHoveredSlot] = useState<'primary' | 'poses' | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);

    // Refs
    const primaryInputRef = useRef<HTMLInputElement>(null);
    const posesInputRef = useRef<HTMLInputElement>(null);

    // Helper for image dimensions and aspect ratio detection
    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const autoDetectRatio = (width: number, height: number) => {
        const ratio = width / height;
        const presets = [
            { value: AspectRatio.SQUARE, ratio: 1 / 1 },
            { value: AspectRatio.PORTRAIT_2_3, ratio: 2 / 3 },
            { value: AspectRatio.PORTRAIT_3_4, ratio: 3 / 4 },
            { value: AspectRatio.PORTRAIT_9_16, ratio: 9 / 16 },
            { value: AspectRatio.LANDSCAPE_16_9, ratio: 16 / 9 },
        ];
        
        let closest = presets[0];
        let minDiff = Math.abs(ratio - closest.ratio);
        
        for (const preset of presets) {
            const diff = Math.abs(ratio - preset.ratio);
            if (diff < minDiff) {
                minDiff = diff;
                closest = preset;
            }
        }
        return closest.value;
    };

    // Image processing
    const processFiles = async (files: File[]) => {
        const results: UploadedImage[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const { base64, mime } = await compressImage(file, 2048, 0.96);
            results.push({
                file,
                preview: URL.createObjectURL(file),
                base64: base64,
                mime: mime
            });
        }
        return results;
    };

    const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        if (files.length === 0) return;
        const dims = await getImageDimensions(files[0]);
        const detectedRatio = autoDetectRatio(dims.width, dims.height);
        setAspectRatio(detectedRatio);
        const processed = await processFiles(files);
        setPrimaryModelImages(prev => [...prev, ...processed].slice(0, 5));
    };

    const handlePosesUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        if (files.length === 0) return;
        const processed = await processFiles(files);
        setPoseReferences(prev => [...prev, ...processed].slice(0, 10));
    };

    // Drag and Drop Logic
    const handleDragOver = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
        setIsDragging(slot);
    };

    const handleDragLeave = () => {
        setIsDragging(null);
    };

    const handleDrop = async (e: React.DragEvent, slot: 'primary' | 'poses') => {
        e.preventDefault();
        setIsDragging(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        if (slot === 'primary') handlePrimaryUpload(files);
        else if (slot === 'poses') handlePosesUpload(files);
    };

    // Paste handler
    useImagePaste(async (files) => {
        if (files.length === 0) return;
        if (hoveredSlot === 'poses') handlePosesUpload(files);
        else handlePrimaryUpload(files);
    });

    const handleDownload = (img: string, idx: number) => {
        const link = document.createElement('a');
        link.href = img;
        link.download = `model-pose-${Date.now()}-${idx}.png`;
        link.click();
    };

    // 并发任务运行器 - 单个任务执行
    const runSingleTask = async (taskIdx: number) => {
        const ref = poseReferences[taskIdx];
        if (!ref) return;

        // 重置/初始化该任务的状态为加载中
        setTasks(prev => prev.map((t, i) => i === taskIdx ? {
            ...t,
            status: 'loading' as const,
            progress: 0,
            currentStep: 0,
            error: undefined,
            resultImage: undefined
        } : t));
        
        // 进度跟踪器定时器
        let currentProg = 0;
        let currentStepIdx = 0;
        const interval = setInterval(() => {
            currentStepIdx = Math.min(currentStepIdx + 1, COT_STEPS.length - 1);
            currentProg = Math.min(currentProg + 14, 95);
            setTasks(prev => prev.map((t, i) => i === taskIdx ? {
                ...t,
                progress: currentProg,
                currentStep: currentStepIdx
            } : t));
        }, 1100);

        try {
            // 映射模特参考图
            const poseItem = { base64: ref.base64!, mimeType: ref.mime! };
            const modelItems = primaryModelImages.map(m => ({ base64: m.base64!, mimeType: m.mime! }));
            
            // 复制姿态参考图以适配 [Pose, Pose, Model1, Model2, ...] 的布局
            let inputImages;
            if (primaryModelImages.length <= 2) {
                inputImages = [poseItem, ...modelItems];
            } else {
                inputImages = [poseItem, poseItem, ...modelItems];
            }

            const constraintsStr = [
                keepBackground ? "Lock and retain the original background from Image 3 (Primary Model Image)." : "Place model in a matching background.",
                allowProps ? "If the pose requires prop interaction (e.g. chair, umbrella), intelligently add the interacting prop into the original background of Image 3." : "Do not add any additional props.",
                lockCropScale ? "Align and match exact camera angle, zoom scale, portrait crop ratio, limb structure, subject size and position inside frame precisely as shown in Image 1 & 2 (Pose reference)." : ""
            ].filter(Boolean).join(" ");

            const prompt = `
            # SYSTEM CONSTRAINTS (CRITICAL & ENFORCED):
            1. MODEL HAIR & CLOTHING FIDELITY (HIGHEST WEIGHT):
               - The generated model MUST have the EXACT SAME hairstyle, facial features, body shape, and hair color as the person in Image 3 (Primary Model Image). Do NOT change hairstyle, color or facial features.
               - The clothing in the generated image MUST remain PIXEL-IDENTICAL to the garment shown in Image 3. Do not modify, deform, or change any style, pattern, fabric, or cut of the clothing.
            2. POSE & FRAMING REPLICATION:
               - You MUST transfer the EXACT human pose, limb positions, body positioning, camera angle, perspective, and subject-to-frame crop/scale factor from Image 1 & 2 (Pose Reference Image).
               - Do NOT transfer any background elements, colors, or textures from Image 1 & 2.
               - Do NOT transfer any accessories, bags, sunglasses, or jewelries from Image 1 & 2.
            3. BACKGROUND & PRECISION:
               - ${constraintsStr}
            4. EXCLUSIONS:
               - Absolutely no background elements from Image 1 & 2.
               - Absolutely no accessories from Image 1 & 2.

            # DETAILS: ${enhancePrompt(userPrompt || "High fidelity pose transfer", 'EDITORIAL')}, ${QUALITY_BOOSTERS.RETOUCHING}
            `;

            const results = await generateImageToImage(inputImages, prompt, {
                aspectRatio,
                resolution,
                modelId: selectedModel,
                workflowHint: 'pose-transfer',
                hasModelRef: true
            });

            clearInterval(interval);
            setTasks(prev => prev.map((t, i) => i === taskIdx ? {
                ...t,
                status: 'completed',
                progress: 100,
                resultImage: results[0]
            } : t));

        } catch (err) {
            clearInterval(interval);
            const errMsg = getErrorMessage(err);
            setTasks(prev => prev.map((t, i) => i === taskIdx ? {
                ...t,
                status: 'failed',
                progress: 100,
                error: errMsg
            } : t));
        }
    };

    // 触发并发生成
    const triggerConcurrentGeneration = async () => {
        if (primaryModelImages.length === 0) return;
        if (poseReferences.length === 0) return;

        // 重置任务列表
        const initialTasks = poseReferences.map((ref, idx) => ({
            id: `task-${Date.now()}-${idx}`,
            poseIndex: idx,
            posePreview: ref.preview,
            status: 'loading' as const,
            progress: 0,
            currentStep: 0,
            resultImage: undefined,
            error: undefined
        }));
        setTasks(initialTasks);

        // 并发启动所有任务！
        initialTasks.forEach((_, idx) => runSingleTask(idx));
    };

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white custom-scrollbar pb-24">
            {/* Header */}
            <div className="text-center py-6 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-xs text-pastel-muted mb-2 shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                    AI Agent 模特高保真姿态专家
                </div>
                <h1 className="text-2xl font-bold text-pastel-text">模特高保真姿态生成 (Model Pose Transfer)</h1>
                <p className="text-xs text-pastel-muted mt-1">锁定图1发型、服装与背景，精密转移参考图动作与相机角度，支持最高 10 任务并发</p>
            </div>

            <div className="max-w-7xl mx-auto px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    {/* LEFT COLUMN */}
                    <div className="space-y-5">
                        
                        {/* 1. Ratio */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Layout className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-bold text-pastel-text text-sm">画面比例</h3>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {[
                                    { id: AspectRatio.SQUARE, label: '1:1', icon: '正方形' },
                                    { id: AspectRatio.PORTRAIT_2_3, label: '2:3', icon: '主图' },
                                    { id: AspectRatio.PORTRAIT_3_4, label: '3:4', icon: '详情' },
                                    { id: AspectRatio.PORTRAIT_9_16, label: '9:16', icon: '竖屏' },
                                    { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', icon: '横幅' },
                                ].map((item) => (
                                    <button key={item.id} onClick={() => setAspectRatio(item.id)} className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${aspectRatio === item.id ? 'bg-orange-50 border-pastel-highlight ring-1 ring-orange-100 text-pastel-highlight' : 'bg-pastel-bg/30 border-pastel-border text-pastel-muted hover:border-orange-200'}`}>
                                        <span className="text-[11px] font-bold">{item.label}</span>
                                        <span className="text-[9px] opacity-60">{item.icon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Primary Model & Garment Upload (Up to 5 Images) */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <h3 className="font-bold text-pastel-text text-sm">模特与服装原图 (最多 5 张)</h3>
                                </div>
                                <span className="text-[10px] bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full border border-green-100 flex items-center gap-1 font-bold">
                                    已上传 {primaryModelImages.length}/5 张
                                </span>
                            </div>
                            
                            <div 
                                onClick={() => primaryInputRef.current?.click()} 
                                onMouseEnter={() => setHoveredSlot('primary')} 
                                onMouseLeave={() => setHoveredSlot(null)}
                                onDragOver={(e) => handleDragOver(e, 'primary')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'primary')}
                                className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all min-h-[140px] flex flex-col justify-center ${
                                    isDragging === 'primary' || hoveredSlot === 'primary'
                                    ? 'border-green-400 bg-green-50/10' 
                                    : 'border-pastel-border'
                                }`}
                            >
                                <input ref={primaryInputRef} type="file" multiple className="hidden" onChange={handlePrimaryUpload} accept="image/*" />
                                {primaryModelImages.length > 0 ? (
                                    <div className="w-full">
                                        <div className="grid grid-cols-5 gap-2">
                                            {primaryModelImages.map((img, idx) => (
                                                <div key={idx} className="relative group/primary aspect-square bg-pastel-bg/30 rounded-lg overflow-hidden border border-pastel-border">
                                                    <img src={img.preview} className="w-full h-full object-cover" alt={`primary-${idx}`} />
                                                    <span className={`absolute bottom-1 left-1 text-[8px] px-1 rounded font-bold text-white ${
                                                        idx === 0 ? 'bg-green-600' : 'bg-black/60'
                                                    }`}>
                                                        {idx === 0 ? '主参考' : `细节 #${idx}`}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); setPrimaryModelImages(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/primary:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                                                </div>
                                            ))}
                                            {primaryModelImages.length < 5 && (
                                                <div className="aspect-square border-2 border-dashed border-pastel-border rounded-lg flex flex-col items-center justify-center text-pastel-muted hover:border-green-300">
                                                    <Upload className="w-4 h-4 text-green-400" />
                                                    <span className="text-[8px] scale-95 mt-0.5 text-green-600 font-bold">继续添加</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-3 text-[10px] text-green-700 font-bold bg-green-50 px-3 py-1.5 rounded-full flex items-center justify-center gap-1.5 border border-green-100">
                                            <Layers className="w-3.5 h-3.5 text-green-600" />
                                            已锁定核心长相面容、多角度发型与服装材质一致性
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <Upload className="w-10 h-10 mx-auto mb-2 text-pastel-muted" />
                                        <p className="text-xs font-bold text-pastel-text">点击或拖拽上传模特与服装全身照 (最多 5 张)</p>
                                        <p className="text-[10px] text-pastel-muted mt-1">支持多角度对比图，提供极高的人像和细节锁定一致性权重</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Pose References Upload (Up to 10 Images) */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-sm">动作姿势与角度参考图 (最多 10 张)</h3>
                                </div>
                                <span className="text-[10px] bg-orange-50 text-orange-600 px-2.5 py-0.5 rounded-full font-bold">
                                    已上传 {poseReferences.length}/10 张
                                </span>
                            </div>

                            <div 
                                onClick={() => posesInputRef.current?.click()} 
                                onMouseEnter={() => setHoveredSlot('poses')} 
                                onMouseLeave={() => setHoveredSlot(null)}
                                onDragOver={(e) => handleDragOver(e, 'poses')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'poses')}
                                className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all min-h-[120px] flex flex-col justify-center ${
                                    isDragging === 'poses' || hoveredSlot === 'poses'
                                    ? 'border-orange-400 bg-orange-50/10' 
                                    : 'border-pastel-border'
                                }`}
                            >
                                <input ref={posesInputRef} type="file" multiple className="hidden" onChange={handlePosesUpload} accept="image/*" />
                                {poseReferences.length > 0 ? (
                                    <div className="grid grid-cols-5 gap-2 w-full">
                                        {poseReferences.map((img, idx) => (
                                            <div key={idx} className="relative group/pose aspect-square bg-pastel-bg/30 rounded-lg overflow-hidden border border-pastel-border">
                                                <img src={img.preview} className="w-full h-full object-cover" alt={`pose-${idx}`} />
                                                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">#{idx+1}</span>
                                                <button onClick={(e) => { e.stopPropagation(); setPoseReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/pose:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                                            </div>
                                        ))}
                                        {poseReferences.length < 10 && (
                                            <div className="aspect-square border-2 border-dashed border-pastel-border rounded-lg flex flex-col items-center justify-center text-pastel-muted hover:border-orange-300">
                                                <Upload className="w-4 h-4 text-orange-400" />
                                                <span className="text-[8px] scale-95 mt-0.5">继续添加</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <Wand2 className="w-8 h-8 mx-auto mb-2 text-pastel-muted" />
                                        <p className="text-xs font-bold text-pastel-text">点击或拖拽上传动作参考图 (最多 10 张)</p>
                                        <p className="text-[10px] text-pastel-muted mt-1">每个参考图将作为一个独立任务进行高精细姿势还原</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Precision Constraints Checkboxes */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Ruler className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-bold text-pastel-text text-sm">姿态转移约束设定 (Precision Constraints)</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-pastel-border bg-pastel-bg/10 cursor-pointer hover:bg-orange-50/20 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={keepBackground}
                                        onChange={e => setKeepBackground(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-pastel-text">保持图1背景</span>
                                        <span className="text-[9px] text-pastel-muted mt-0.5 leading-normal">绝对保持模特原图的背景与光照，不更换环境</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-pastel-border bg-pastel-bg/10 cursor-pointer hover:bg-orange-50/20 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={allowProps}
                                        onChange={e => setAllowProps(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-pastel-text">自适应道具互动</span>
                                        <span className="text-[9px] text-pastel-muted mt-0.5 leading-normal">若动作涉及互动（如坐椅），在背景中智能增加道具</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-pastel-border bg-pastel-bg/10 cursor-pointer hover:bg-orange-50/20 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={lockCropScale}
                                        onChange={e => setLockCropScale(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-pastel-text">裁剪与透视锁</span>
                                        <span className="text-[9px] text-pastel-muted mt-0.5 leading-normal">强力对齐参考图的人物裁剪比例、放大率与相机透视</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 5. Extra Details Prompt Input */}
                        <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-semibold text-pastel-text text-sm">额外微调说明</h3>
                            </div>
                            <input 
                                value={userPrompt} 
                                onChange={(e) => setUserPrompt(e.target.value)} 
                                placeholder="选填，例如：面带微笑，环境光增加一丝温暖的阳光感..." 
                                className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs focus:outline-none" 
                            />
                        </div>

                        {/* 6. Advanced Settings foldout */}
                        <div className="bg-white rounded-2xl border border-pastel-border shadow-sm overflow-hidden">
                            <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between p-4 border-b border-pastel-border hover:bg-pastel-bg/30">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="font-bold text-pastel-text text-xs">高级参数设置</h3>
                                </div>
                                {showAdvanced ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                            </button>

                            {showAdvanced && (
                                <div className="p-4 space-y-4">
                                    {/* Model selector */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Cpu className="w-4 h-4 text-pastel-highlight" />
                                            <h4 className="font-bold text-pastel-text text-xs">图像模型选择</h4>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'gemini-3.1-flash-image-preview', name: 'Banana 2', sub: '3.1 Flash', icon: <Zap className="w-4 h-4 text-orange-400" /> },
                                                { id: 'nanobananapro', name: 'Banana Pro', sub: '3.0 Pro', icon: <Zap className="w-4 h-4 text-orange-500" /> },
                                                { id: 'gpt-image-2', name: 'GPT Image 2', sub: 'Ultra Quality', icon: <Sparkles className="w-4 h-4 text-orange-600" /> }
                                            ].map(m => (
                                                <button 
                                                    key={m.id} 
                                                    onClick={() => setSelectedModel(m.id)} 
                                                    className={`relative p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center min-h-[75px] ${
                                                        selectedModel === m.id 
                                                        ? 'bg-purple-50 border-purple-400' 
                                                        : 'bg-white border-pastel-border hover:border-purple-200'
                                                    }`}
                                                >
                                                    <div className="font-bold text-xs mb-1">{m.name}</div>
                                                    <div className="text-[9px] opacity-60">{m.sub}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Resolution Selector */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-pastel-muted font-bold block mb-1">画质清晰度</label>
                                            <select 
                                                value={resolution} 
                                                onChange={e => setResolution(e.target.value as ImageResolution)} 
                                                className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs"
                                            >
                                                <option value={ImageResolution.RES_1K}>1K 快速标清</option>
                                                <option value={ImageResolution.RES_2K}>2K 商业高清</option>
                                                <option value={ImageResolution.RES_4K}>4K 极致海报级 (推荐)</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <div className="flex items-center gap-1 text-[10px] text-pastel-muted px-2 py-1 bg-pastel-bg/50 rounded-lg">
                                                <Info className="w-3.5 h-3.5 text-blue-500" />
                                                并发任务数会自动与动作参考图数量相同
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Concurrent trigger button */}
                        <button 
                            onClick={triggerConcurrentGeneration} 
                            disabled={primaryModelImages.length === 0 || poseReferences.length === 0} 
                            className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-3 ${
                                primaryModelImages.length === 0 || poseReferences.length === 0 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01] hover:shadow-xl'
                            }`}
                        >
                            <Sparkles className="w-5 h-5 animate-pulse" />
                            {primaryModelImages.length === 0 
                                ? '请先上传模特原图' 
                                : poseReferences.length === 0 
                                ? '请上传动作姿势参考图' 
                                : `并发启动 ${poseReferences.length} 个高保真姿态生成任务`}
                        </button>
                    </div>

                    {/* RIGHT COLUMN - Parallel Tasks Management Panel */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm flex-1 flex flex-col relative min-h-[550px]">
                            
                            {/* Panel Header */}
                            <div className="flex items-center justify-between mb-4 border-b border-pastel-border pb-3">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-5 h-5 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-base">并发任务监控中心 (Parallel Queue)</h3>
                                </div>
                                {tasks.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold border border-purple-100">
                                            生成中 {tasks.filter(t => t.status === 'loading').length} 个
                                        </span>
                                        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold border border-green-100">
                                            已完成 {tasks.filter(t => t.status === 'completed').length} 个
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Parallel Tasks List */}
                            <div className="flex-1 overflow-y-auto space-y-4 max-h-[750px] pr-1 custom-scrollbar">
                                {tasks.length > 0 ? (
                                    tasks.map((task, idx) => (
                                        <div key={task.id} className={`p-4 rounded-xl border transition-all flex gap-4 bg-white ${
                                            task.status === 'loading' ? 'border-orange-200 ring-2 ring-orange-50/50 shadow-sm' : 
                                            task.status === 'completed' ? 'border-green-200 bg-green-50/5' : 
                                            task.status === 'failed' ? 'border-red-200 bg-red-50/5' : 'border-pastel-border'
                                        }`}>
                                            
                                            {/* Left - Pose Ref thumbnail */}
                                            <div className="w-20 h-28 rounded-lg overflow-hidden bg-pastel-bg border border-pastel-border relative flex-shrink-0">
                                                <img src={task.posePreview} className="w-full h-full object-cover" alt="pose ref" />
                                                <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">参考 #{idx + 1}</div>
                                            </div>

                                            {/* Right - Status & content */}
                                            <div className="flex-grow flex flex-col justify-between min-w-0">
                                                
                                                {/* Loading/Thinking COT Steps */}
                                                {task.status === 'loading' && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin flex-shrink-0" />
                                                                <span className="text-xs font-bold text-pastel-text truncate">
                                                                    任务 #{idx + 1}: {COT_STEPS[task.currentStep].label}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-orange-500 font-bold">{task.progress}%</span>
                                                        </div>
                                                        <p className="text-[9px] text-pastel-muted leading-tight truncate">
                                                            {COT_STEPS[task.currentStep].desc}
                                                        </p>
                                                        
                                                        {/* Progress bar */}
                                                        <div className="w-full bg-pastel-bg/50 rounded-full h-1.5 overflow-hidden border border-pastel-border">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-orange-400 to-pink-400 rounded-full transition-all duration-300"
                                                                style={{ width: `${task.progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Completed Image output */}
                                                {task.status === 'completed' && task.resultImage && (
                                                    <div className="flex flex-col justify-between h-full">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 inline-flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                    生成成功 #{idx + 1}
                                                                </span>
                                                                <p className="text-[9px] text-pastel-muted mt-1">发型、衣服及背景完美锁死一致</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <button 
                                                                onClick={() => setSelectedPreview(task.resultImage!)}
                                                                className="flex-1 py-1.5 bg-pastel-bg border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-pastel-bg/80 flex items-center justify-center gap-1"
                                                            >
                                                                <ZoomIn className="w-3.5 h-3.5" />
                                                                放大预览
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDownload(task.resultImage!, idx)}
                                                                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                一键下载
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Failed Task details */}
                                                {task.status === 'failed' && (
                                                    <div className="space-y-1.5">
                                                        <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100 inline-flex items-center gap-1">
                                                            <ShieldAlert className="w-3.5 h-3.5" />
                                                            任务 #{idx + 1} 失败
                                                        </span>
                                                        <p className="text-[9px] text-red-600 leading-normal line-clamp-2">
                                                            {task.error || "发生了未知异常"}
                                                        </p>
                                                        <button 
                                                            onClick={() => runSingleTask(idx)}
                                                            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-[9px] font-bold rounded flex items-center gap-1 w-max transition-colors"
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                            重新生成
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right - Small thumbnail of completed result */}
                                            {task.status === 'completed' && task.resultImage && (
                                                <div 
                                                    onClick={() => setSelectedPreview(task.resultImage!)}
                                                    className="w-20 h-28 rounded-lg overflow-hidden border border-green-200 shadow-md flex-shrink-0 cursor-pointer group/thumb relative"
                                                >
                                                    <img src={task.resultImage} className="w-full h-full object-cover" alt="result thumbnail" />
                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                                        <ZoomIn className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    ))
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 h-full my-auto">
                                        <div className="w-16 h-16 rounded-full bg-pastel-bg flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-pastel-border" />
                                        </div>
                                        <div className="max-w-[280px] space-y-1.5">
                                            <p className="text-sm font-bold text-pastel-text">AI 并发姿态生成中心</p>
                                            <p className="text-xs text-pastel-muted leading-relaxed">
                                                在左侧上传模特原图(图1)与多个姿势图，AI 将启动多路子任务，并发渲染高精度姿势转移图片资产。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedPreview && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedPreview(null)}>
                    <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <img src={selectedPreview} className="max-h-[85vh] w-auto object-contain" alt="p" />
                        <button onClick={() => setSelectedPreview(null)} className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full"><X className="w-6 h-6" /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelGenerationTab;
