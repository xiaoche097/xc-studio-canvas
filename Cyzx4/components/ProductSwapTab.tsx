import React, { useState, useRef, useCallback, useEffect } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import { generateProductSwap, compressImage } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { storageService, Project } from '../../services/storageService';
import {
    ArrowLeftRight,
    Upload,
    Loader2,
    AlertCircle,
    X,
    Download,
    Maximize2,
    RotateCcw,
    Sparkles,
    Image as ImageIcon,
    ChevronDown,
    Cpu,
} from 'lucide-react';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { downloadImageFile } from '../utils/imageDownload';

// 自定义香蕉图标组件
const BananaIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ color: '#fbbf24' }}
    >
        <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
        <path d="M15 3s-1.5 1-2 3" />
    </svg>
);
import { AspectRatio, ImageResolution } from '../types';
import { compressImageFiles } from '../utils/imageCompressor';
import { useImagePaste } from '../hooks/useImagePaste';

// ==================== CoT Steps ====================
const SWAP_COT_STEPS = [
    { id: 1, label: "场景深度解析", desc: "正在分析参考图的场景结构...", icon: "🔍" },
    { id: 2, label: "产品定位识别", desc: "正在定位需替换的产品区域...", icon: "📍" },
    { id: 3, label: "光影物理计算", desc: "正在匹配目标场景光照条件...", icon: "💡" },
    { id: 4, label: "透视角度匹配", desc: "正在校准产品透视与场景一致...", icon: "📐" },
    { id: 5, label: "1:1 精准替换", desc: "正在执行像素级产品替换...", icon: "🔄" },
    { id: 6, label: "边缘融合处理", desc: "正在优化接缝与环境融合...", icon: "✨" },
    { id: 7, label: "材质纹理增强", desc: "正在还原产品真实材质质感...", icon: "🧶" },
    { id: 8, label: "最终品质检查", desc: "正在进行大师级品质校验...", icon: "🏆" },
];

// ==================== Model Options ====================
const MODEL_OPTIONS = [
    { value: 'gemini-3.1-flash-image-preview', label: 'Banana 2', subLabel: '3.1 Flash' },
    { value: 'gemini-3-pro-image-preview', label: 'Banana Pro', subLabel: '3.0 Pro' },
    { value: 'gpt-image-2', label: 'GPT Image 2', subLabel: 'Ultra Quality' },
    { value: 'qwen-image-3.0-pro', label: '千问3.0pro', subLabel: 'Qwen Image' },
];

type ImageData = {
    file?: File;
    base64?: string;
    mime?: string;
    preview: string;
    width?: number;
    height?: number;
};

type ProductSwapTabProps = {
    isActive?: boolean;
};

const ProductSwapTab: React.FC<ProductSwapTabProps> = ({ isActive = true }) => {
    // Image state
    const [sceneImage, setSceneImage] = useState<ImageData | null>(null);
    const [productImages, setProductImages] = useState<ImageData[]>([]);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);

    // Config state
    const [userPrompt, setUserPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio | 'auto'>('auto');
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const {
        cancelMessage,
        startGenerationTask,
        cancelGenerationTask,
        isCurrentGenerationTask,
        assertCurrentGenerationTask,
        finishGenerationTask,
    } = useCancelableGeneration();
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // 当切换到 gpt-image-2 时，自动修正不兼容的参数
    useEffect(() => {
        if (selectedModel === 'gpt-image-2') {
            const allowedRatios: (AspectRatio | 'auto')[] = [
                'auto',
                AspectRatio.SQUARE, 
                AspectRatio.LANDSCAPE_3_2, 
                AspectRatio.PORTRAIT_2_3, 
                AspectRatio.LANDSCAPE_16_9, 
                AspectRatio.PORTRAIT_9_16
            ];
            if (!allowedRatios.includes(aspectRatio)) {
                setAspectRatio('auto');
            }
        }
    }, [selectedModel]);

    // Drag state
    const [isDraggingScene, setIsDraggingScene] = useState(false);
    const [isDraggingProduct, setIsDraggingProduct] = useState(false);

    // Refs
    const sceneInputRef = useRef<HTMLInputElement>(null);
    const productInputRef = useRef<HTMLInputElement>(null);

    // ==================== File Handlers ====================
    const processFile = async (file: File): Promise<ImageData> => {
        const compressed = await compressImage(file);

        // Get dimensions
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.src = URL.createObjectURL(file);
        });

        return {
            file,
            base64: compressed.base64,
            mime: compressed.mime,
            preview: URL.createObjectURL(file),
            width: dimensions.width,
            height: dimensions.height
        };
    };

    const handleSceneUpload = useCallback(async (files: FileList | File[]) => {
        const file = Array.from(files)[0];
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const data = await processFile(file);
            setSceneImage(data);
            setError(null);
        } catch (e) {
            setError('场景图上传失败，请重试');
        }
    }, []);

    const handleProductUpload = useCallback(async (files: FileList | File[]) => {
        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (newFiles.length === 0) return;
        try {
            const dataPromises = newFiles.map(f => processFile(f));
            const newImages = await Promise.all(dataPromises);
            setProductImages(prev => [...prev, ...newImages].slice(0, 5));
            setError(null);
        } catch (e) {
            setError('产品图上传失败，请重试');
        }
    }, []);

    const removeProductImage = (index: number) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    // 绑定剪贴板粘贴事件
    useImagePaste(async (files) => {
        const file = files[0];
        if (!file || !file.type.startsWith('image/')) return;

        // 如果场景图为空，则设为场景图
        if (!sceneImage) {
            handleSceneUpload([file]);
        }
        // 否则全部作为产品图
        else {
            handleProductUpload(files);
        }
    }, isActive);

    // ==================== Drag & Drop ====================
    const handleDrop = async (e: React.DragEvent, type: 'scene' | 'product') => {
        e.preventDefault();
        type === 'scene' ? setIsDraggingScene(false) : setIsDraggingProduct(false);
        const files = await compressImageFiles(Array.from(e.dataTransfer.files));
        if (type === 'scene') handleSceneUpload(files);
        else handleProductUpload(files);
    };

    const handleDragOver = async (e: React.DragEvent, type: 'scene' | 'product') => {
        e.preventDefault();
        type === 'scene' ? setIsDraggingScene(true) : setIsDraggingProduct(true);
    };

    const handleDragLeave = async (e: React.DragEvent, type: 'scene' | 'product') => {
        e.preventDefault();
        type === 'scene' ? setIsDraggingScene(false) : setIsDraggingProduct(false);
    };

    // ==================== Generate ====================
    const handleGenerate = async () => {
        if (!sceneImage?.base64 || productImages.length === 0) {
            setError('请上传参考场景图和产品素材图');
            return;
        }

        const { taskId, signal } = startGenerationTask();
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setCurrentStep(0);
        setProgress(0);

        // CoT simulation timer
        const stepInterval = setInterval(() => {
            setCurrentStep(prev => {
                if (prev >= SWAP_COT_STEPS.length - 1) return prev;
                return prev + 1;
            });
            setProgress(prev => Math.min(prev + 12, 95));
        }, 1500);

        try {
            assertCurrentGenerationTask(taskId, signal);
            // Determine Aspect Ratio
            let finalAspectRatio = aspectRatio;
            if (aspectRatio === 'auto' && sceneImage.width && sceneImage.height) {
                const ratio = sceneImage.width / sceneImage.height;
                const ratios = [
                    { r: 1, val: AspectRatio.SQUARE },
                    { r: 4 / 3, val: AspectRatio.LANDSCAPE_4_3 },
                    { r: 3 / 4, val: AspectRatio.PORTRAIT_3_4 },
                    { r: 16 / 9, val: AspectRatio.LANDSCAPE_16_9 },
                    { r: 9 / 16, val: AspectRatio.PORTRAIT_9_16 },
                    { r: 21 / 9, val: AspectRatio.LANDSCAPE_21_9 },
                ];
                // Find closest
                const closest = ratios.reduce((prev, curr) => {
                    return (Math.abs(curr.r - ratio) < Math.abs(prev.r - ratio) ? curr : prev);
                });
                finalAspectRatio = closest.val;
            } else if (aspectRatio === 'auto') {
                finalAspectRatio = AspectRatio.LANDSCAPE_4_3; // Fallback
            }

            const results = await generateProductSwap(
                { base64: sceneImage.base64, mime: sceneImage.mime || 'image/png' },
                productImages.map(img => ({ base64: img.base64!, mime: img.mime || 'image/png' })),
                userPrompt || undefined,
                {
                    aspectRatio: finalAspectRatio as AspectRatio,
                    resolution,
                    model: selectedModel,
                    signal,
                }
            );

            const generatedDataUrls = results.map(src => (
                src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')
                    ? src
                    : `data:image/png;base64,${src}`
            ));
            setGeneratedImages(generatedDataUrls);

            // Save to history
            try {
                const projectId = crypto.randomUUID();
                const newProject: Project = {
                    id: projectId,
                    type: 'MARKETING',
                    createdAt: Date.now(),
                    thumbnail: generatedDataUrls[0],
                    assets: {
                        original: [sceneImage.preview, ...productImages.map(p => p.preview)],
                        generated: generatedDataUrls,
                    },
                    metadata: {
                        prompt: userPrompt,
                        resolution,
                        metadata: {
                            prompt: userPrompt,
                            resolution,
                            aspectRatio: aspectRatio === 'auto' ? 'Auto' : aspectRatio,
                            model: selectedModel,
                            subType: 'product_swap',
                        },
                        model: selectedModel,
                        subType: 'product_swap',
                    },
                };
                await storageService.saveProject(newProject);
            } catch (e) {
                console.error('Failed to save project:', e);
            }
        } catch (err: any) {
            if (!isAbortError(err)) {
                setError(getErrorMessage(err));
            }
        } finally {
            clearInterval(stepInterval);
            if (!isCurrentGenerationTask(taskId)) {
                return;
            }
            finishGenerationTask(taskId);
            setIsLoading(false);
            setProgress(100);
        }
    };

    const handleCancelGenerate = () => {
        cancelGenerationTask();
        setIsLoading(false);
        setProgress(0);
    };

    // ==================== Actions ====================
    const handleDownload = async (imageUrl: string, index: number) => {
        try {
            await downloadImageFile(imageUrl, `product-swap-${Date.now()}-${index + 1}.png`);
        } catch (error) {
            console.error('Failed to download product swap image.', error);
            window.alert('图片下载失败，请稍后重试');
        }
    };

    const handleReset = () => {
        setSceneImage(null);
        setProductImages([]);
        setGeneratedImages([]);
        setError(null);
        setUserPrompt('');
    };

    const canGenerate = !!sceneImage?.base64 && productImages.length > 0 && !isLoading;

    // ==================== Render ====================
    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white">
            {/* Hero Header */}
            <div className="text-center py-8 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-sm text-pastel-muted mb-4 shadow-sm">
                    <ArrowLeftRight className="w-4 h-4 text-pastel-highlight" />
                    <span>智能产品替换</span>
                </div>
                <h2 className="text-2xl font-bold text-pastel-text mb-2">
                    1:1 产品上身替换
                </h2>
                <p className="text-sm text-pastel-muted max-w-lg mx-auto">
                    上传参考场景图和产品素材，AI 将精准替换场景中的产品，保持场景、光影、构图不变
                </p>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Config Panel */}
                    <div className="space-y-5">
                        {/* Scene Upload */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <h3 className="font-semibold text-pastel-text mb-3 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-blue-500" />
                                参考场景图
                                <span className="text-xs text-pastel-muted font-normal">(人物/场景)</span>
                            </h3>

                            {sceneImage ? (
                                <div className="relative group">
                                    <img
                                        src={sceneImage.preview}
                                        alt="Scene"
                                        className="w-full h-48 object-cover rounded-xl border border-pastel-border"
                                    />
                                    <button
                                        onClick={() => setSceneImage(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDrop={(e) => handleDrop(e, 'scene')}
                                    onDragOver={(e) => handleDragOver(e, 'scene')}
                                    onDragLeave={(e) => handleDragLeave(e, 'scene')}
                                    onClick={() => sceneInputRef.current?.click()}
                                    className={`h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${isDraggingScene
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-pastel-border hover:border-pastel-highlight hover:bg-orange-50/30'
                                        }`}
                                >
                                    <Upload className="w-8 h-8 text-pastel-muted mb-2" />
                                    <p className="text-sm text-pastel-muted">拖拽或点击上传场景图</p>
                                    <p className="text-xs text-pastel-muted mt-1">如：人物背着背包的照片</p>
                                </div>
                            )}
                            <input
                                ref={sceneInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files && handleSceneUpload(e.target.files)}
                            />
                        </div>

                        {/* Product Upload */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <h3 className="font-semibold text-pastel-text mb-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-orange-500" />
                                产品素材图
                                <span className="text-xs text-pastel-muted font-normal">(最多5张)</span>
                            </h3>

                            <div 
                                className={`grid grid-cols-3 gap-2 mb-3 p-2 border-2 border-dashed rounded-xl transition-all ${isDraggingProduct ? 'border-orange-400 bg-orange-50' : 'border-transparent'}`}
                                onDrop={(e) => handleDrop(e, 'product')}
                                onDragOver={(e) => handleDragOver(e, 'product')}
                                onDragLeave={(e) => handleDragLeave(e, 'product')}
                            >
                                {productImages.map((img, idx) => (
                                    <div key={idx} className="relative group aspect-square">
                                        <img
                                            src={img.preview}
                                            alt={`Product ${idx + 1}`}
                                            className="w-full h-full object-cover rounded-lg border border-pastel-border"
                                        />
                                        <button
                                            onClick={() => removeProductImage(idx)}
                                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {productImages.length < 5 && (
                                    <div
                                        onClick={() => productInputRef.current?.click()}
                                        className="aspect-square border-2 border-dashed border-pastel-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pastel-highlight hover:bg-white transition-all"
                                    >
                                        <Upload className="w-5 h-5 text-pastel-muted mb-1" />
                                        <p className="text-[10px] text-pastel-muted">添加</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={productInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => e.target.files && handleProductUpload(e.target.files)}
                            />
                        </div>

                        {/* Prompt & Config */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm space-y-4">
                            {/* Prompt */}
                            <div>
                                <label className="text-sm font-medium text-pastel-text mb-1.5 block">
                                    ✏️ 替换指令 <span className="text-xs text-pastel-muted font-normal">(可选)</span>
                                </label>
                                <textarea
                                    value={userPrompt}
                                    onChange={(e) => setUserPrompt(e.target.value)}
                                    placeholder="例: 将图中的背包替换成我的产品，保持颜色和纹理一致"
                                    className="w-full h-20 px-3 py-2 text-sm border border-pastel-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-pastel-highlight/30 focus:border-pastel-highlight bg-pastel-bg/30"
                                />
                            </div>

                            {/* Model Selection - Moved to top for better visibility */}
                            <div className="border-b border-pastel-border/50 pb-4">
                                <label className="text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5 px-1">
                                    <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                                </label>
                                <CreativeImageModelSelector value={selectedModel} onChange={setSelectedModel} title="" compact className="border-0 bg-transparent p-0 shadow-none" />
                                <div className="hidden">
                                    {MODEL_OPTIONS.map(m => (
                                        <button
                                            key={m.value}
                                            onClick={() => setSelectedModel(m.value)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === m.value
                                                ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                                                : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                                                }`}
                                        >
                                            <div className="flex items-center gap-1">
                                                {m.value === 'gpt-image-2' ? <Sparkles className="w-3 h-3 text-orange-500" /> : <BananaIcon className="w-3 h-3" />}
                                                <span className={`text-[10px] font-bold ${selectedModel === m.value ? 'text-purple-700' : 'text-pastel-text'}`}>
                                                    {m.label}
                                                </span>
                                            </div>
                                            <span className="text-[8px] text-pastel-muted">{m.subLabel}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Config Row - Now 2 columns */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-pastel-muted block mb-2 px-1">画幅比例</label>
                                    <div className="relative">
                                        <select
                                            value={aspectRatio}
                                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio | 'auto')}
                                            className="w-full text-xs px-3 py-2.5 border border-pastel-border rounded-xl bg-pastel-bg/50 appearance-none focus:outline-none focus:ring-2 focus:ring-pastel-highlight/20"
                                        >
                                            <option value="auto">自动识别 (Auto)</option>
                                            <option value="1:1">1:1</option>
                                            
                                            {selectedModel !== 'gpt-image-2' && (
                                                <>
                                                    <option value="4:3">4:3</option>
                                                    <option value="3:4">3:4</option>
                                                </>
                                            )}
                                            
                                            <option value="16:9">16:9</option>
                                            <option value="9:16">9:16</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pastel-muted pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-pastel-muted block mb-2 px-1">精度分辨率</label>
                                    <div className="relative">
                                        <select
                                            value={resolution}
                                            onChange={(e) => setResolution(e.target.value as ImageResolution)}
                                            className="w-full text-xs px-3 py-2.5 border border-pastel-border rounded-xl bg-pastel-bg/50 appearance-none focus:outline-none focus:ring-2 focus:ring-pastel-highlight/20"
                                        >
                                            <option value="1K">1K (标准)</option>
                                            <option value="2K">2K (高清)</option>
                                            <option value="4K">4K (超清)</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pastel-muted pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${canGenerate
                                ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 hover:shadow-lg active:scale-[0.98]'
                                : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            <ArrowLeftRight className="w-5 h-5" />
                            开始替换 (Product Swap)
                        </button>
                    </div>

                        {isLoading && (
                            <button
                                type="button"
                                onClick={handleCancelGenerate}
                                className="w-full py-3 rounded-xl font-bold text-white bg-gray-800 hover:bg-gray-900 transition-all shadow-md"
                            >
                                中止生成
                            </button>
                        )}
                        {cancelMessage && !isLoading && (
                            <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
                        )}
                    {/* Right: Result Panel */}
                    <div className="bg-white rounded-2xl border border-pastel-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-pastel-border bg-pastel-bg/50">
                            <h3 className="font-semibold text-pastel-text flex items-center gap-2">
                                <ArrowLeftRight className="w-4 h-4 text-pastel-highlight" />
                                替换结果
                            </h3>
                            {generatedImages.length > 0 && (
                                <button
                                    onClick={handleReset}
                                    className="text-xs text-pastel-highlight hover:underline"
                                >
                                    重置
                                </button>
                            )}
                        </div>

                        <div className="flex-1">
                            {isLoading ? (
                                /* ==================== CoT Overlay ==================== */
                                <div className="h-full flex flex-col items-center justify-center p-8 relative overflow-hidden">
                                    {/* Ambient Background Glow */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-white/50 to-orange-50/30 animate-pulse pointer-events-none" />

                                    {/* Glass Card */}
                                    <div className="z-10 w-full max-w-sm bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(31,38,135,0.07)] p-8 border border-white/50 relative overflow-hidden transition-all duration-500 hover:shadow-[0_8px_40px_rgba(255,166,0,0.15)] transform hover:scale-[1.02]">

                                        {/* Progress Bar (Top) */}
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100/50">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-pink-400 bg-[length:200%_100%] animate-pulse transition-all duration-500 ease-out rounded-r-full shadow-[0_0_10px_rgba(255,166,0,0.5)]"
                                                style={{ width: `${((currentStep + 1) / SWAP_COT_STEPS.length) * 100}%` }}
                                            />
                                        </div>

                                        <div className="flex flex-col items-center text-center space-y-6 pt-4">
                                            {/* Icon with Ring Animation */}
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-orange-400/20 rounded-full animate-ping opacity-75" />
                                                <div className="w-24 h-24 bg-gradient-to-br from-white to-blue-50 rounded-full flex items-center justify-center text-5xl shadow-[inset_0_2px_10px_rgba(255,255,255,0.8),0_10px_20px_rgba(0,0,0,0.05)] border border-white relative z-10 transition-transform duration-500 scale-100">
                                                    {SWAP_COT_STEPS[currentStep].icon}
                                                </div>
                                            </div>

                                            {/* Text Block */}
                                            <div className="space-y-3 w-full">
                                                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 tracking-tight">
                                                    {SWAP_COT_STEPS[currentStep].label}
                                                </h3>
                                                <div className="h-8 flex items-center justify-center">
                                                    <p className="text-sm font-medium text-gray-500 bg-white/60 px-4 py-1.5 rounded-full border border-gray-100/50 shadow-sm backdrop-blur-sm transition-all duration-300">
                                                        {SWAP_COT_STEPS[currentStep].desc}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step Indicators */}
                                            <div className="flex gap-2 justify-center mt-2 w-full px-4">
                                                {SWAP_COT_STEPS.map((step, idx) => (
                                                    <div
                                                        key={step.id}
                                                        className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentStep
                                                            ? 'w-8 bg-gradient-to-r from-orange-400 to-pink-400 shadow-[0_0_8px_rgba(255,166,0,0.4)]'
                                                            : idx < currentStep
                                                                ? 'w-2 bg-orange-200/80'
                                                                : 'w-2 bg-gray-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Status */}
                                    <p className="text-xs font-medium text-gray-400 mt-8 flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm border border-white/50">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                                        <span className="tracking-wide">AI 产品替换引擎执行中... ({currentStep + 1}/8)</span>
                                    </p>
                                </div>
                            ) : generatedImages.length > 0 ? (
                                /* ==================== Results ==================== */
                                <div className="p-4 h-full flex items-center justify-center">
                                    <div className="w-full space-y-3">
                                        {generatedImages.map((img, idx) => (
                                            <div key={idx} className="relative group">
                                                <img
                                                    src={img}
                                                    alt={`Result ${idx + 1}`}
                                                    className="w-full rounded-xl border border-pastel-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                                    onClick={() => setPreviewImage(img)}
                                                />
                                                <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setPreviewImage(img)}
                                                        className="p-2 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                                                        title="放大"
                                                    >
                                                        <Maximize2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(img, idx)}
                                                        className="p-2 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                                                        title="下载"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleReset}
                                            className="w-full py-2.5 border border-pastel-border rounded-xl text-sm text-pastel-muted hover:bg-pastel-bg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            重新开始
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ==================== Empty State ==================== */
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-blue-50 rounded-2xl flex items-center justify-center mb-4">
                                        <ArrowLeftRight className="w-10 h-10 text-pastel-highlight/50" />
                                    </div>
                                    <p className="text-pastel-muted text-sm mb-1">替换结果将显示在这里</p>
                                    <p className="text-pastel-muted/60 text-xs">上传场景图和产品图，点击"开始替换"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
                        />
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <button
                                onClick={() => handleDownload(previewImage, 0)}
                                className="px-4 py-2 bg-white/90 text-gray-800 rounded-lg font-medium text-sm hover:bg-white transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                下载
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductSwapTab;
