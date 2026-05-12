import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateStyleReplication, compressImage } from '../services/geminiService';
import { getErrorMessage } from '../utils/apiHelpers';
import { storageService, Project } from '../../services/storageService';
import {
    Sparkles,
    Upload,
    Image as ImageIcon,
    Package,
    Loader2,
    Download,
    ZoomIn,
    RefreshCw,
    X,
    Zap,
    AlertCircle,
    Layers,
    Palette,
    FileOutput,
    Cpu
} from 'lucide-react';

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

type TabMode = 'single' | 'batch';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

const COT_STEPS = [
    { id: 1, label: "全案设计解构", desc: "正在深度解析网格与色彩基因...", icon: "🔍" },
    { id: 2, label: "骨架重构", desc: "正在构建像素级排版骨架...", icon: "📐" },
    { id: 3, label: "光影物理模拟", desc: "正在计算场景光照与反射逻辑...", icon: "💡" },
    { id: 4, label: "高保真渲染", desc: "正在进行 8K 级超清材质渲染...", icon: "🖌️" },
    { id: 5, label: "材质微粒优化", desc: "正在增强皮革/金属/织物纹理...", icon: "🧶" },
    { id: 6, label: "边缘光影融合", desc: "正在处理边缘像素与环境融合...", icon: "✨" },
    { id: 7, label: "动态范围重塑", desc: "正在优化画面对比度与饱和度...", icon: "🎨" },
    { id: 8, label: "大师级调色", desc: "正在注入参考图的灵魂色调...", icon: "🌈" },
];

const StyleReplicateTab: React.FC = () => {
    // Tab state
    const [tabMode, setTabMode] = useState<TabMode>('single');

    // Image states
    const [styleReferences, setStyleReferences] = useState<UploadedImage[]>([]);
    const [productImages, setProductImages] = useState<UploadedImage[]>([]);

    // Config states
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");

    // 当切换到 gpt-image-2 时，自动修正不兼容的参数
    useEffect(() => {
        if (selectedModel === 'gpt-image-2') {
            const allowedRatios = [
                AspectRatio.SQUARE, 
                AspectRatio.LANDSCAPE_3_2, 
                AspectRatio.PORTRAIT_2_3, 
                AspectRatio.LANDSCAPE_16_9, 
                AspectRatio.PORTRAIT_9_16
            ];
            if (!allowedRatios.includes(aspectRatio)) {
                setAspectRatio(AspectRatio.SQUARE);
            }
        }
    }, [selectedModel]);
    const [isRetouchEnabled, setIsRetouchEnabled] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [generateCount, setGenerateCount] = useState(1);
    const [turboMode, setTurboMode] = useState(false);

    // CoT Visualization State
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [batchStatus, setBatchStatus] = useState<string>("");

    // Drag states
    const [isDraggingStyle, setIsDraggingStyle] = useState(false);
    const [isDraggingProduct, setIsDraggingProduct] = useState(false);

    // Result states
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

    // Refs
    const styleInputRef = useRef<HTMLInputElement>(null);
    const productInputRef = useRef<HTMLInputElement>(null);

    // Handle style reference upload
    const handleStyleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Calculate how many we can add
        const maxAllowed = tabMode === 'single' ? 1 : 12;
        const currentCount = tabMode === 'single' ? 0 : styleReferences.length; // Single mode replaces
        const remaining = maxAllowed - currentCount;

        if (remaining <= 0 && tabMode === 'batch') return;

        const filesToProcess = tabMode === 'single' ? [files[0]] : files.slice(0, remaining);

        const newImages: UploadedImage[] = [];
        for (const file of filesToProcess) {
            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }

        if (tabMode === 'single') {
            setStyleReferences(newImages);
        } else {
            setStyleReferences(prev => [...prev, ...newImages]);
        }
        setError(null);
    }, [tabMode, styleReferences]);

    // 辅助函数：处理文件并添加到状态
    const processFiles = useCallback(async (files: File[]) => {
        const newImages: UploadedImage[] = [];
        for (const file of files) {
            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }
        return newImages;
    }, []);

    // 绑定剪贴板粘贴事件
    useImagePaste(async (files) => {
        if (files.length === 0) return;

        // 如果风格参考为空，则加入风格参考
        if (styleReferences.length === 0) {
            const processed = await processFiles(tabMode === 'single' ? [files[0]] : files.slice(0, 12));
            setStyleReferences(processed);
        }
        // 否则如果产品图为空，则加入产品图
        else if (productImages.length === 0) {
            const processed = await processFiles(files);
            setProductImages(processed);
        }
        // 否则默认加入风格参考（追加或替换，根据模式）
        else {
            const maxAllowed = tabMode === 'single' ? 1 : 12;
            const currentCount = tabMode === 'single' ? 0 : styleReferences.length;
            const remaining = maxAllowed - currentCount;
            if (remaining <= 0 && tabMode === 'batch') return;

            const filesToProcess = tabMode === 'single' ? [files[0]] : files.slice(0, remaining);
            const processed = await processFiles(filesToProcess);

            if (tabMode === 'single') {
                setStyleReferences(processed);
            } else {
                setStyleReferences(prev => [...prev, ...processed]);
            }
        }
    });

    // Remove style reference
    const removeStyleReference = (index: number) => {
        setStyleReferences(prev => prev.filter((_, i) => i !== index));
    };

    // Handle product images upload
    const handleProductUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newImages: UploadedImage[] = [];

        for (const file of files) {
            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }

        setProductImages(prev => [...prev, ...newImages].slice(0, 5)); // Max 5 images
        setError(null);
    }, []);

    // Handle Style Drop
    const handleStyleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingStyle(false);

        const files = await compressImageFiles(Array.from(e.dataTransfer.files));
        if (files.length === 0) return;

        // Calculate how many we can add
        const maxAllowed = tabMode === 'single' ? 1 : 12;
        const currentCount = tabMode === 'single' ? 0 : styleReferences.length;
        const remaining = maxAllowed - currentCount;

        if (remaining <= 0 && tabMode === 'batch') return;

        const filesToProcess = tabMode === 'single' ? [files[0]] : files.slice(0, remaining);

        const newImages: UploadedImage[] = [];
        for (const file of filesToProcess) {
            if (!file.type.startsWith('image/')) continue;

            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }

        if (tabMode === 'single') {
            if (newImages.length > 0) setStyleReferences(newImages);
        } else {
            setStyleReferences(prev => [...prev, ...newImages]);
        }
        setError(null);
    }, [tabMode, styleReferences]);

    // Handle Product Drop
    const handleProductDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingProduct(false);

        const files = await compressImageFiles(Array.from(e.dataTransfer.files));
        if (files.length === 0) return;

        const newImages: UploadedImage[] = [];

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }

        setProductImages(prev => [...prev, ...newImages].slice(0, 5));
        setError(null);
    }, []);

    // Remove product image
    const removeProductImage = (index: number) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    // Generate handler
    const handleGenerate = async () => {
        if (styleReferences.length === 0 || productImages.length === 0) {
            setError('请上传参考设计图和产品素材图');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);

        // Start CoT Simulation
        setCurrentStep(0);
        setProgress(0);
        setBatchStatus("");

        // Timer to simulate the 8 steps
        const stepInterval = setInterval(() => {
            setCurrentStep(prev => {
                if (prev >= COT_STEPS.length - 1) return prev;
                return prev + 1;
            });
            setProgress(prev => Math.min(prev + 12, 95));
        }, 1200); // Slightly faster for parallel

        try {
            const stylesToProcess = styleReferences;
            
            if (tabMode === 'batch') {
                setBatchStatus(`正在并行处理 ${stylesToProcess.length} 个风格...`);
            }

            // Create promises for parallel execution
            const generationPromises = stylesToProcess.map(async (styleRef, index) => {
                if (!styleRef.base64) return [];

                try {
                    console.log(`[Parallel] Starting Style ${index + 1}/${stylesToProcess.length}...`);
                    
                    // In batch mode, we do 1 per style as per user request "automatic quantity"
                    // In single mode, we use the user-selected generateCount
                    const countPerStyle = tabMode === 'batch' ? 1 : generateCount;

                    const results = await generateStyleReplication(
                        { base64: styleRef.base64, mime: styleRef.mime || 'image/png' },
                        productImages.map(img => ({ base64: img.base64!, mime: img.mime || 'image/png' })),
                        customPrompt || undefined,
                        {
                            aspectRatio,
                            resolution,
                            count: countPerStyle,
                            model: selectedModel,
                            retouch: isRetouchEnabled
                        }
                    );
                    return results;
                } catch (err) {
                    console.error(`[Parallel] Failed to process Style ${index + 1}:`, err);
                    return [];
                }
            });

            // Wait for all generations to complete in parallel
            const resultsArray = await Promise.all(generationPromises);
            const allResults = resultsArray.flat();

            if (allResults.length === 0) {
                throw new Error("批量生成完全失败。请检查您的输入内容和网络连接后重试。");
            }

            // Convert base64 to data URLs for display
            const generatedDataUrls = allResults.map(b64 => `data:image/png;base64,${b64}`);
            setGeneratedImages(generatedDataUrls);

            // Save to Project History
            try {
                // Prepare original assets as Data URIs
                const originalAssets = [
                    ...styleReferences.map(img => img.base64 && img.mime ? `data:${img.mime};base64,${img.base64}` : ''),
                    ...productImages.map(img => img.base64 && img.mime ? `data:${img.mime};base64,${img.mime}` : '')
                ].filter(Boolean);

                const projectId = crypto.randomUUID();
                const newProject: Project = {
                    id: projectId,
                    type: 'MARKETING',
                    createdAt: Date.now(),
                    thumbnail: generatedDataUrls[0], // Use first generated image as thumbnail (Data URL)
                    assets: {
                        original: originalAssets,
                        generated: generatedDataUrls
                    },
                    metadata: {
                        prompt: customPrompt,
                        styleRefCount: styleReferences.length,
                        productCount: productImages.length,
                        resolution,
                        aspectRatio,
                        model: selectedModel,
                        subType: 'style_replication'
                    }
                };

                await storageService.saveProject(newProject);
                console.log('Project saved to history:', projectId);
            } catch (err) {
                console.error('Failed to save project to history:', err);
            }

        } catch (err: any) {
            console.error('Generation failed:', err);
            const friendlyError = getErrorMessage(err);
            setError(friendlyError);
        } finally {
            clearInterval(stepInterval);
            setIsLoading(false);
            setProgress(100);
        }
    };

    // Download handler
    const handleDownload = async (imageUrl: string, index: number) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `style-replicate-${Date.now()}-${index + 1}.png`;
        link.click();
    };

    // Reset handler
    const handleReset = () => {
        setStyleReferences([]);
        setProductImages([]);
        setGeneratedImages([]);
        setError(null);
        setCustomPrompt('');
    };

    const canGenerate = styleReferences.length > 0 && productImages.length > 0 && !isLoading;

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white">
            {/* Hero Header */}
            <div className="text-center py-8 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-sm text-pastel-muted mb-4 shadow-sm">
                    <Sparkles className="w-4 h-4 text-pastel-highlight" />
                    AI 驱动
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-pastel-text mb-3">
                    一键复刻爆款详情页风格
                </h1>
                <p className="text-pastel-muted max-w-xl mx-auto text-sm md:text-base">
                    上传您喜欢的设计参考图和产品素材，AI 将智能融合风格与产品特性，生成专属于您的高转化详情图
                </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex bg-white border border-pastel-border rounded-full p-1 shadow-sm">
                    <button
                        onClick={() => setTabMode('single')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${tabMode === 'single'
                            ? 'bg-pastel-text text-white shadow-sm'
                            : 'text-pastel-muted hover:text-pastel-text'
                            }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        单张复刻
                    </button>
                    <button
                        onClick={() => setTabMode('batch')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${tabMode === 'batch'
                            ? 'bg-pastel-text text-white shadow-sm'
                            : 'text-pastel-muted hover:text-pastel-text'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        批量复刻
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Left Panel - Upload & Config */}
                    <div className="space-y-4">
                        {/* Style Reference Upload */}
                        <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Palette className="w-5 h-5 text-pastel-highlight" />
                                <h3 className="font-semibold text-pastel-text">参考设计图 {tabMode === 'batch' && <span className="text-xs font-normal text-pastel-muted">(支持最多12张)</span>}</h3>
                            </div>
                            <p className="text-xs text-pastel-muted mb-3">上传具有期望风格的参考图</p>

                            <div
                                onClick={() => styleInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingStyle(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDraggingStyle(false); }}
                                onDrop={handleStyleDrop}
                                className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all group ${isDraggingStyle
                                    ? 'border-pastel-highlight bg-pastel-bg/80'
                                    : 'border-pastel-border hover:border-pastel-highlight hover:bg-pastel-bg/50'
                                    }`}
                            >
                                <input
                                    ref={styleInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple={tabMode === 'batch'}
                                    onChange={handleStyleUpload}
                                    className="hidden"
                                />

                                {styleReferences.length > 0 ? (
                                    <div className={`grid gap-2 ${styleReferences.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                                        {styleReferences.map((img, idx) => (
                                            <div key={idx} className="relative group/item">
                                                <img
                                                    src={img.preview}
                                                    alt={`Style Ref ${idx + 1}`}
                                                    className={`w-full rounded-lg border border-pastel-border ${styleReferences.length === 1 ? 'h-auto max-h-[500px] object-contain' : 'h-24 object-cover'}`}
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeStyleReference(idx);
                                                    }}
                                                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {(tabMode === 'batch' && styleReferences.length < 12) && (
                                            <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                                                <Upload className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-pastel-muted group-hover:text-pastel-highlight transition-colors" />
                                        <p className="text-sm text-pastel-highlight">拖拽图片到这里</p>
                                        <p className="text-xs text-pastel-muted mt-1">或点击选择文件 (PNG, JPG)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Product Images Upload */}
                        <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Package className="w-5 h-5 text-pastel-highlight" />
                                <h3 className="font-semibold text-pastel-text">产品素材图</h3>
                            </div>
                            <p className="text-xs text-pastel-muted mb-3">上传您希望出现在图片中的元素素材</p>

                            <div
                                onClick={() => productInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingProduct(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDraggingProduct(false); }}
                                onDrop={handleProductDrop}
                                className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all group ${isDraggingProduct
                                    ? 'border-pastel-highlight bg-pastel-bg/80'
                                    : 'border-pastel-border hover:border-pastel-highlight hover:bg-pastel-bg/50'
                                    }`}
                            >
                                <input
                                    ref={productInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleProductUpload}
                                    className="hidden"
                                />

                                {productImages.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {productImages.map((img, idx) => (
                                            <div key={idx} className="relative group/item">
                                                <img
                                                    src={img.preview}
                                                    alt={`Product ${idx + 1}`}
                                                    className="w-full h-20 object-cover rounded-lg border border-pastel-border"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeProductImage(idx);
                                                    }}
                                                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {productImages.length < 5 && (
                                            <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                                                <Upload className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-pastel-muted group-hover:text-pastel-highlight transition-colors" />
                                        <p className="text-sm text-pastel-highlight">上传产品图片 (最多5张)</p>
                                        <p className="text-xs text-pastel-muted mt-1">支持多选</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Custom Prompt */}
                        <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-pastel-text">场景/细节补充说明</h3>
                                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">最高优先级</span>
                            </div>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder='例如：这是特斯拉 Model Y 2017 内饰；使用红色节日氛围；添加“限时特惠”文字... (此处的描述将覆盖参考图中的原有物体信息)'
                                className="w-full h-24 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                            />
                            <p className="text-xs text-pastel-muted mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                AI 将优先遵循此处的文字指令来确定产品型号或场景细节
                            </p>
                        </div>

                        {/* Config Options */}
                        <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm space-y-5">
                            <div className="border-b border-pastel-border/50 pb-5">
                                <label className="text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5 px-1">
                                    <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                                            : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1">
                                            <BananaIcon className="w-3 h-3" />
                                            <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                                                Banana 2
                                            </span>
                                        </div>
                                        <span className="text-[8px] text-pastel-muted">3.1 Flash</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                                            : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1">
                                            <BananaIcon className="w-3 h-3" />
                                            <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                                                Banana Pro
                                            </span>
                                        </div>
                                        <span className="text-[8px] text-pastel-muted">3.0 Pro</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedModel('gpt-image-2')}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gpt-image-2'
                                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                                            : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-orange-500" />
                                            <span className={`text-[10px] font-bold ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>
                                                GPT Image 2
                                            </span>
                                        </div>
                                        <span className="text-[8px] text-pastel-muted">Ultra Quality</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Aspect Ratio */}
                                <div>
                                    <label className="text-xs text-pastel-muted mb-1 block">尺寸比例</label>
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                                    >
                                        <option value="1:1">1:1 正方形</option>
                                        <option value="2:3">2:3 坚版</option>
                                        <option value="3:2">3:2 横版</option>
                                        
                                        {selectedModel !== 'gpt-image-2' && (
                                            <>
                                                <option value="3:4">3:4 坚版</option>
                                                <option value="4:3">4:3 横版</option>
                                                <option value="4:5">4:5 坚版</option>
                                                <option value="5:4">5:4 横版</option>
                                            </>
                                        )}
                                        
                                        <option value="9:16">9:16 手机坚屏</option>
                                        <option value="16:9">16:9 宽屏</option>
                                        
                                        {selectedModel !== 'gpt-image-2' && (
                                            <option value="21:9">21:9 超宽屏</option>
                                        )}
                                    </select>
                                </div>

                                {/* Resolution */}
                                <div>
                                    <label className="text-xs text-pastel-muted mb-1 block">清晰度</label>
                                    <select
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value as ImageResolution)}
                                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                                    >
                                        <option value="1K">1K 标清</option>
                                        <option value="2K">2K 高清 (Pro)</option>
                                        <option value="4K">4K 超清</option>
                                    </select>
                                </div>

                                {/* Generate Count */}
                                <div>
                                    <label className="text-xs text-pastel-muted mb-1 block">
                                        {tabMode === 'batch' ? '批量生成数量' : '生成数量'}
                                    </label>
                                    {tabMode === 'batch' ? (
                                        <div className="w-full bg-gray-50 border border-pastel-border rounded-lg px-3 py-2 text-sm text-pastel-muted flex items-center justify-between">
                                            <span>{styleReferences.length} 张</span>
                                            <span className="text-[10px] bg-pastel-highlight/10 text-pastel-highlight px-1.5 py-0.5 rounded">自动匹配</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={generateCount}
                                            onChange={(e) => setGenerateCount(Number(e.target.value))}
                                            className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                <option key={num} value={num}>{num} 张</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Turbo Mode */}
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <div className={`relative w-10 h-5 rounded-full transition-colors ${turboMode ? 'bg-pastel-highlight' : 'bg-gray-200'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${turboMode ? 'translate-x-5' : ''}`} />
                                            <input
                                                type="checkbox"
                                                checked={turboMode}
                                                onChange={(e) => setTurboMode(e.target.checked)}
                                                className="sr-only"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-pastel-text">
                                            <Zap className="w-4 h-4 text-yellow-500" />
                                            Turbo
                                        </div>
                                    </label>
                                </div>

                                {/* Retouch Mode */}
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={isRetouchEnabled}
                                                onChange={(e) => setIsRetouchEnabled(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-5 rounded-full transition-colors ${isRetouchEnabled ? 'bg-pastel-highlight' : 'bg-gray-200'
                                                }`}></div>
                                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform transform ${isRetouchEnabled ? 'translate-x-5' : ''
                                                }`}></div>
                                        </div>
                                        <div className="text-sm text-pastel-text flex items-center gap-1">
                                            <Sparkles className={`w-3.5 h-3.5 ${isRetouchEnabled ? 'text-pastel-highlight' : 'text-gray-400'}`} />
                                            产品精修
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-600">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${canGenerate
                                    ? 'bg-pastel-highlight text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        正在并行生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        生成 {tabMode === 'batch' ? styleReferences.length : generateCount} 张详情图
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs text-pastel-muted mt-2">预计 5 秒</p>
                        </div>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-pastel-highlight" />
                                <h3 className="font-semibold text-pastel-text">生成结果</h3>
                            </div>
                            {generatedImages.length > 0 && (
                                <button
                                    onClick={handleReset}
                                    className="text-xs text-pastel-muted hover:text-pastel-text flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    重置
                                </button>
                            )}
                        </div>

                        <div className="flex-1 bg-pastel-bg/50 rounded-lg border border-pastel-border overflow-hidden">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 relative overflow-hidden">
                                    {/* Ambient Background Glow */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-orange-50/50 via-white/50 to-blue-50/30 animate-pulse pointer-events-none" />

                                    {/* Glass Card */}
                                    <div className="z-10 w-full max-w-sm bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(31,38,135,0.07)] p-8 border border-white/50 relative overflow-hidden transition-all duration-500 hover:shadow-[0_8px_40px_rgba(255,166,0,0.15)] transform hover:scale-[1.02]">

                                        {/* Progress Bar (Top) */}
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100/50">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-400 via-pink-400 to-orange-400 bg-[length:200%_100%] animate-pulse transition-all duration-500 ease-out rounded-r-full shadow-[0_0_10px_rgba(255,166,0,0.5)]"
                                                style={{ width: `${((currentStep + 1) / COT_STEPS.length) * 100}%` }}
                                            />
                                        </div>

                                        <div className="flex flex-col items-center text-center space-y-6 pt-4">
                                            {/* Icon with Ring Animation */}
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-orange-400/20 rounded-full animate-ping opacity-75" />
                                                <div className="w-24 h-24 bg-gradient-to-br from-white to-orange-50 rounded-full flex items-center justify-center text-5xl shadow-[inset_0_2px_10px_rgba(255,255,255,0.8),0_10px_20px_rgba(0,0,0,0.05)] border border-white relative z-10 transition-transform duration-500 scale-100">
                                                    {COT_STEPS[currentStep].icon}
                                                </div>
                                            </div>

                                            {/* Text Block */}
                                            <div className="space-y-3 w-full">
                                                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 tracking-tight">
                                                    {COT_STEPS[currentStep].label}
                                                </h3>
                                                <div className="h-8 flex items-center justify-center">
                                                    <p className="text-sm font-medium text-gray-500 bg-white/60 px-4 py-1.5 rounded-full border border-gray-100/50 shadow-sm backdrop-blur-sm transition-all duration-300">
                                                        {COT_STEPS[currentStep].desc}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step Indicators */}
                                            <div className="flex gap-2 justify-center mt-2 w-full px-4">
                                                {COT_STEPS.map((step, idx) => (
                                                    <div
                                                        key={step.id}
                                                        className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentStep ? 'w-8 bg-gradient-to-r from-orange-400 to-pink-400 shadow-[0_0_8px_rgba(255,166,0,0.4)]' :
                                                            idx < currentStep ? 'w-2 bg-orange-200/80' : 'w-2 bg-gray-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Status Text */}
                                    <div className="flex flex-col items-center gap-2 mt-8">
                                        {batchStatus && (
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 shadow-sm animate-pulse">
                                                {batchStatus}
                                            </span>
                                        )}
                                        <p className="text-xs font-medium text-gray-400 flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm border border-white/50">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                                            <span className="tracking-wide">AI 深度思维链执行中... ({currentStep + 1}/8)</span>
                                        </p>
                                    </div>
                                </div>
                            ) : generatedImages.length > 0 ? (
                                <div className={`p-4 h-full overflow-y-auto ${generatedImages.length === 1 ? 'flex items-center justify-center' : 'grid grid-cols-2 gap-3'}`}>
                                    {generatedImages.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className={`relative group rounded-lg overflow-hidden border border-pastel-border bg-white shadow-sm ${generatedImages.length === 1 ? 'max-w-md w-full' : 'w-full'}`}
                                        >
                                            <img
                                                src={img}
                                                alt={`Generated ${idx + 1}`}
                                                className="w-full h-auto object-contain"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedPreview(img)}
                                                    className="p-2 bg-white rounded-full text-pastel-text hover:bg-pastel-pink transition-colors"
                                                >
                                                    <ZoomIn className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(img, idx)}
                                                    className="p-2 bg-white rounded-full text-pastel-text hover:bg-pastel-pink transition-colors"
                                                >
                                                    <Download className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-pastel-muted p-8">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-pastel-border shadow-sm">
                                        <Sparkles className="w-8 h-8 text-pastel-highlight opacity-50" />
                                    </div>
                                    <p className="text-sm">等待生成</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {generatedImages.length > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedPreview(generatedImages[0])}
                                        className="px-4 py-2 border border-pastel-border rounded-lg text-sm text-pastel-text hover:bg-pastel-bg flex items-center gap-1.5 transition-colors"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                        放大
                                    </button>
                                    <button
                                        onClick={() => generatedImages.forEach((img, i) => handleDownload(img, i))}
                                        className="px-4 py-2 border border-pastel-border rounded-lg text-sm text-pastel-text hover:bg-pastel-bg flex items-center gap-1.5 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        下载
                                    </button>
                                </div>
                                <button
                                    onClick={handleGenerate}
                                    className="px-4 py-2 bg-pastel-highlight text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5 transition-colors shadow-sm"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    重新生成
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-white rounded-xl border border-pastel-border p-4 text-center">
                        <Palette className="w-6 h-6 text-pastel-highlight mx-auto mb-2" />
                        <h4 className="font-semibold text-pastel-text text-sm">全案视觉复刻</h4>
                        <p className="text-xs text-pastel-muted mt-1">AI 像素级还原参考图的排版布局、边框与设计元素</p>
                    </div>
                    <div className="bg-white rounded-xl border border-pastel-border p-4 text-center">
                        <Package className="w-6 h-6 text-pastel-highlight mx-auto mb-2" />
                        <h4 className="font-semibold text-pastel-text text-sm">智能文案重写</h4>
                        <p className="text-xs text-pastel-muted mt-1">自动识别并重绘营销文案，完美融入新产品语境</p>
                    </div>
                    <div className="bg-white rounded-xl border border-pastel-border p-4 text-center">
                        <FileOutput className="w-6 h-6 text-pastel-highlight mx-auto mb-2" />
                        <h4 className="font-semibold text-pastel-text text-sm">电商详情导出</h4>
                        <p className="text-xs text-pastel-muted mt-1">直接生成可商用的高转化详情页，支持拼图与长图</p>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedPreview && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setSelectedPreview(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img src={selectedPreview} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                        <button
                            onClick={() => setSelectedPreview(null)}
                            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StyleReplicateTab;
