import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateStyleReplication, compressImage } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
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
    Cpu,
    Sun
} from 'lucide-react';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { applyColorCorrectionBatch, ColorCorrectionMode } from '../utils/imageProcessor';
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

type TabMode = 'single' | 'batch';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

const PRODUCT_IMAGE_LIMIT = 10;
const PRODUCT_GROUP_LIMIT = 10;
const PRODUCT_GROUP_IMAGE_LIMIT = 10;

const COT_STEPS = [
    { id: 1, label: "全案设计解析", desc: "正在分析参考图的布局、色彩与风格基因...", icon: "分析" },
    { id: 2, label: "产品组识别", desc: "正在按产品组读取素材结构与细节...", icon: "分组" },
    { id: 3, label: "版式骨架复刻", desc: "正在建立参考图的构图与排版骨架...", icon: "构图" },
    { id: 4, label: "光影材质匹配", desc: "正在匹配参考图光线并重建产品材质...", icon: "光影" },
    { id: 5, label: "边缘融合", desc: "正在融合产品边缘、阴影与环境关系...", icon: "融合" },
    { id: 6, label: "高清渲染", desc: "正在输出高保真商业详情图...", icon: "渲染" },
    { id: 7, label: "色彩校准", desc: "正在同步参考图的色调与对比度...", icon: "调色" },
    { id: 8, label: "最终质检", desc: "正在检查产品一致性与画面完整度...", icon: "质检" },
];

type StyleReplicateTabProps = {
    isActive?: boolean;
};

const StyleReplicateTab: React.FC<StyleReplicateTabProps> = ({ isActive = true }) => {
    // Tab state
    const [tabMode, setTabMode] = useState<TabMode>('single');

    // Image states
    const [styleReferences, setStyleReferences] = useState<UploadedImage[]>([]);
    const [productImages, setProductImages] = useState<UploadedImage[]>([]);
    const [productGroups, setProductGroups] = useState<UploadedImage[][]>([[]]);
    const [activeProductGroupIndex, setActiveProductGroupIndex] = useState(0);

    // Config states
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");

    // 切换到 gpt-image-2 时，自动修正不兼容的参数
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
    const [colorCorrectionMode, setColorCorrectionMode] = useState<ColorCorrectionMode>('off');
    const [colorCorrectionBlend, setColorCorrectionBlend] = useState(0.85);

    // CoT Visualization State
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [batchStatus, setBatchStatus] = useState<string>("");

    // Drag states
    const [isDraggingStyle, setIsDraggingStyle] = useState(false);
    const [isDraggingProduct, setIsDraggingProduct] = useState(false);

    // Result states
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);
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

    // 杈呭姪鍑芥暟锛氬鐞嗘枃浠跺苟娣诲姞鍒扮姸鎬?
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

    // 缁戝畾鍓创鏉跨矘璐翠簨浠?
    useImagePaste(async (files) => {
        if (files.length === 0) return;

        // 如果风格参考为空，则加入风格参考
        if (styleReferences.length === 0) {
            const processed = await processFiles(tabMode === 'single' ? [files[0]] : files.slice(0, 12));
            setStyleReferences(processed);
            setError(null);
            return;
        }

        // 已有参考图时，粘贴图片默认追加到产品素材，不覆盖已有图片。
        if (tabMode === 'batch') {
            const targetIndex = Math.min(activeProductGroupIndex, productGroups.length - 1);
            const currentGroup = productGroups[targetIndex] || [];
            const remaining = PRODUCT_GROUP_IMAGE_LIMIT - currentGroup.length;
            if (remaining <= 0) return;

            const processed = await processFiles(files.slice(0, remaining));
            if (processed.length === 0) return;
            setProductGroups(prev => prev.map((group, idx) => (
                idx === targetIndex ? [...group, ...processed].slice(0, PRODUCT_GROUP_IMAGE_LIMIT) : group
            )));
            setError(null);
            return;
        }

        const remaining = PRODUCT_IMAGE_LIMIT - productImages.length;
        if (remaining <= 0) return;

        const processed = await processFiles(files.slice(0, remaining));
        if (processed.length === 0) return;
        setProductImages(prev => [...prev, ...processed].slice(0, PRODUCT_IMAGE_LIMIT));
        setError(null);
    }, isActive);

    const clearProductUploads = () => {
        if (tabMode === 'batch') {
            setProductGroups([[]]);
            setActiveProductGroupIndex(0);
        } else {
            setProductImages([]);
        }
    };

    const hasProductUploads = tabMode === 'batch'
        ? productGroups.some(group => group.length > 0)
        : productImages.length > 0;

    // Remove style reference
    const removeStyleReference = (index: number) => {
        setStyleReferences(prev => prev.filter((_, i) => i !== index));
    };

    // Handle product images upload
    const handleProductUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (tabMode === 'batch') {
            const groupIndex = Math.min(activeProductGroupIndex, productGroups.length - 1);
            const currentGroup = productGroups[groupIndex] || [];
            const remaining = PRODUCT_GROUP_IMAGE_LIMIT - currentGroup.length;
            if (remaining <= 0) return;

            const newImages = await processFiles(files.slice(0, remaining));
            setProductGroups(prev => prev.map((group, idx) => (
                idx === groupIndex ? [...group, ...newImages].slice(0, PRODUCT_GROUP_IMAGE_LIMIT) : group
            )));
            setError(null);
            e.target.value = '';
            return;
        }

        const remaining = PRODUCT_IMAGE_LIMIT - productImages.length;
        if (remaining <= 0) return;

        const newImages: UploadedImage[] = [];

        for (const file of files.slice(0, remaining)) {
            const preview = URL.createObjectURL(file);
            const compressed = await compressImage(file);
            newImages.push({
                file,
                preview,
                base64: compressed.base64,
                mime: compressed.mime,
            });
        }

        setProductImages(prev => [...prev, ...newImages].slice(0, PRODUCT_IMAGE_LIMIT));
        setError(null);
        e.target.value = '';
    }, [activeProductGroupIndex, productGroups, processFiles, productImages.length, tabMode]);

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
    const handleProductDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, groupIndex?: number) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingProduct(false);

        const files = await compressImageFiles(Array.from(e.dataTransfer.files));
        if (files.length === 0) return;

        if (tabMode === 'batch') {
            const targetIndex = typeof groupIndex === 'number' ? groupIndex : activeProductGroupIndex;
            const currentGroup = productGroups[targetIndex] || [];
            const remaining = PRODUCT_GROUP_IMAGE_LIMIT - currentGroup.length;
            if (remaining <= 0) return;

            const newImages = await processFiles(files.slice(0, remaining).filter(file => file.type.startsWith('image/')));
            setProductGroups(prev => prev.map((group, idx) => (
                idx === targetIndex ? [...group, ...newImages].slice(0, PRODUCT_GROUP_IMAGE_LIMIT) : group
            )));
            setError(null);
            return;
        }

        const remaining = PRODUCT_IMAGE_LIMIT - productImages.length;
        if (remaining <= 0) return;

        const newImages: UploadedImage[] = [];

        for (const file of files.slice(0, remaining)) {
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

        setProductImages(prev => [...prev, ...newImages].slice(0, PRODUCT_IMAGE_LIMIT));
        setError(null);
    }, [activeProductGroupIndex, processFiles, productGroups, productImages.length, tabMode]);

    // Remove product image
    const removeProductImage = (index: number) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    const addProductGroup = () => {
        setProductGroups(prev => {
            if (prev.length >= PRODUCT_GROUP_LIMIT) return prev;
            setActiveProductGroupIndex(prev.length);
            return [...prev, []];
        });
    };

    const removeProductGroup = (index: number) => {
        setProductGroups(prev => {
            const next = prev.filter((_, i) => i !== index);
            const normalized = next.length > 0 ? next : [[]];
            setActiveProductGroupIndex(Math.max(0, Math.min(activeProductGroupIndex, normalized.length - 1)));
            return normalized;
        });
    };

    const removeProductGroupImage = (groupIndex: number, imageIndex: number) => {
        setProductGroups(prev => prev.map((group, idx) => (
            idx === groupIndex ? group.filter((_, i) => i !== imageIndex) : group
        )));
    };

    // Generate handler
    const handleGenerate = async () => {
        const productGroupsToProcess = tabMode === 'batch'
            ? productGroups.filter(group => group.length > 0)
            : (productImages.length > 0 ? [productImages] : []);

        if (styleReferences.length === 0 || productGroupsToProcess.length === 0) {
            setError('请上传参考设计图和产品素材图');
            return;
        }

        const { taskId, signal } = startGenerationTask();
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setRegeneratingIndices([]);

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
            assertCurrentGenerationTask(taskId, signal);
            const stylesToProcess = styleReferences;
            
            if (tabMode === 'batch') {
                setBatchStatus(`正在处理 ${productGroupsToProcess.length} 个产品组，每组匹配 1 张参考设计图...`);
            }

            const generationJobs = tabMode === 'batch'
                ? productGroupsToProcess.map((group, groupIndex) => {
                    const styleIndex = stylesToProcess[groupIndex] ? groupIndex : 0;
                    return {
                        styleRef: stylesToProcess[styleIndex],
                        styleIndex,
                        productGroup: group,
                        productGroupIndex: groupIndex,
                    };
                })
                : stylesToProcess.map((styleRef, styleIndex) => ({ styleRef, styleIndex, productGroup: productGroupsToProcess[0], productGroupIndex: 0 }));

            // Create promises for parallel execution
            const generationPromises = generationJobs.map(async ({ styleRef, styleIndex, productGroup, productGroupIndex }, index) => {
                if (!styleRef.base64) return [];

                try {
                    console.log(`[Parallel] Starting Job ${index + 1}/${generationJobs.length} (Product ${productGroupIndex + 1}, Style ${styleIndex + 1})...`);
                    
                    // In batch mode, generate one image per product group.
                    // In single mode, we use the user-selected generateCount.
                    const countPerStyle = tabMode === 'batch' ? 1 : generateCount;
                    const groupedPrompt = [
                        customPrompt || '',
                        tabMode === 'batch'
                            ? `Product group ${productGroupIndex + 1}: use ONLY the ${productGroup.length} product image(s) provided in this group as the target product. Treat these images as different views/details of the SAME product. Do not mix with other product groups.`
                            : ''
                    ].filter(Boolean).join('\n');

                    const results = await generateStyleReplication(
                        { base64: styleRef.base64, mime: styleRef.mime || 'image/png' },
                        productGroup.map(img => ({ base64: img.base64!, mime: img.mime || 'image/png' })),
                        groupedPrompt || undefined,
                        {
                            aspectRatio,
                            resolution,
                            count: countPerStyle,
                            model: selectedModel,
                            retouch: isRetouchEnabled,
                            signal
                        }
                    );
                    return results;
                } catch (err) {
                    console.error(`[Parallel] Failed to process Job ${index + 1}:`, err);
                    return [];
                }
            });

            // Wait for all generations to complete in parallel
            const resultsArray = await Promise.all(generationPromises);
            assertCurrentGenerationTask(taskId, signal);
            const allResults = resultsArray.flat();

            if (allResults.length === 0) {
                throw new Error("批量生成全部失败，请检查输入内容和网络连接后重试。");
            }

            // Convert base64 to data URLs and optionally unify color tone.
            const generatedDataUrls = allResults.map(b64 => `data:image/png;base64,${b64}`);
            const colorReference = styleReferences[0]?.base64 && styleReferences[0]?.mime
                ? `data:${styleReferences[0].mime};base64,${styleReferences[0].base64}`
                : undefined;
            const finalDataUrls = await applyColorCorrectionBatch(generatedDataUrls, {
                mode: colorCorrectionMode,
                reference: colorReference,
                blend: colorCorrectionBlend,
            });
            assertCurrentGenerationTask(taskId, signal);
            setGeneratedImages(finalDataUrls);

            // Save to Project History
            try {
                // Prepare original assets as Data URIs
                const originalAssets = [
                    ...styleReferences.map(img => img.base64 && img.mime ? `data:${img.mime};base64,${img.base64}` : ''),
                    ...productGroupsToProcess.flatMap(group => group.map(img => img.base64 && img.mime ? `data:${img.mime};base64,${img.base64}` : ''))
                ].filter(Boolean);

                const projectId = crypto.randomUUID();
                const newProject: Project = {
                    id: projectId,
                    type: 'MARKETING',
                    createdAt: Date.now(),
                    thumbnail: finalDataUrls[0], // Use first generated image as thumbnail (Data URL)
                    assets: {
                        original: originalAssets,
                        generated: finalDataUrls
                    },
                    metadata: {
                        prompt: customPrompt,
                        styleRefCount: styleReferences.length,
                        productCount: productGroupsToProcess.reduce((total, group) => total + group.length, 0),
                        productGroupCount: productGroupsToProcess.length,
                        resolution,
                        aspectRatio,
                        model: selectedModel,
                        colorCorrectionMode,
                        colorCorrectionBlend,
                        subType: 'style_replication'
                    }
                };

                await storageService.saveProject(newProject);
                console.log('Project saved to history:', projectId);
            } catch (err) {
                console.error('Failed to save project to history:', err);
            }

        } catch (err: any) {
            if (!isAbortError(err)) {
                console.error('Generation failed:', err);
                const friendlyError = getErrorMessage(err);
                setError(friendlyError);
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
        setBatchStatus('');
    };

    // Download handler
    const handleDownload = async (imageUrl: string, index: number) => {
        try {
            await downloadImageFile(imageUrl, `style-replicate-${Date.now()}-${index + 1}.png`);
        } catch (error) {
            console.error('Failed to download replicated style image.', error);
            window.alert('图片下载失败，请稍后重试');
        }
    };

    const handleRegenerateOne = async (index: number) => {
        if (regeneratingIndices.includes(index)) return;

        const productGroupsToProcess = tabMode === 'batch'
            ? productGroups.filter(group => group.length > 0)
            : (productImages.length > 0 ? [productImages] : []);

        const productGroup = tabMode === 'batch'
            ? productGroupsToProcess[index]
            : productGroupsToProcess[0];
        const styleIndex = tabMode === 'batch' && styleReferences[index] ? index : 0;
        const styleRef = styleReferences[styleIndex];

        if (!styleRef?.base64 || !productGroup?.length) {
            setError('缺少该图片对应的参考设计图或产品素材图');
            return;
        }

        setRegeneratingIndices(prev => [...prev, index]);
        setError(null);

        try {
            const groupedPrompt = [
                customPrompt || '',
                tabMode === 'batch'
                    ? `Product group ${index + 1}: use ONLY the ${productGroup.length} product image(s) provided in this group as the target product. Treat these images as different views/details of the SAME product. Do not mix with other product groups.`
                    : ''
            ].filter(Boolean).join('\n');

            const results = await generateStyleReplication(
                { base64: styleRef.base64, mime: styleRef.mime || 'image/png' },
                productGroup.map(img => ({ base64: img.base64!, mime: img.mime || 'image/png' })),
                groupedPrompt || undefined,
                {
                    aspectRatio,
                    resolution,
                    count: 1,
                    model: selectedModel,
                    retouch: isRetouchEnabled,
                }
            );

            if (!results[0]) throw new Error('单张重新生成失败，请稍后重试。');

            const regeneratedDataUrl = `data:image/png;base64,${results[0]}`;
            const colorReference = styleReferences[0]?.base64 && styleReferences[0]?.mime
                ? `data:${styleReferences[0].mime};base64,${styleReferences[0].base64}`
                : undefined;
            const [finalImage] = await applyColorCorrectionBatch([regeneratedDataUrl], {
                mode: colorCorrectionMode,
                reference: colorReference,
                blend: colorCorrectionBlend,
            });

            setGeneratedImages(prev => prev.map((image, imageIndex) => (
                imageIndex === index ? finalImage : image
            )));
        } catch (err) {
            console.error(`Single regenerate failed for image ${index + 1}:`, err);
            setError(getErrorMessage(err));
        } finally {
            setRegeneratingIndices(prev => prev.filter(item => item !== index));
        }
    };

    // Sequential download all handler with 300ms delay to prevent browser blocking
    const handleDownloadAll = async () => {
        for (let i = 0; i < generatedImages.length; i++) {
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            await downloadImageFile(generatedImages[i], `style-replicate-${Date.now()}-${i + 1}.png`);
        }
    };

    // Reset handler
    const handleReset = () => {
        setStyleReferences([]);
        setProductImages([]);
        setProductGroups([[]]);
        setActiveProductGroupIndex(0);
        setGeneratedImages([]);
        setRegeneratingIndices([]);
        setError(null);
        setCustomPrompt('');
    };

    const filledProductGroups = productGroups.filter(group => group.length > 0);
    const batchOutputCount = tabMode === 'batch' ? filledProductGroups.length : generateCount;
    const canGenerate = styleReferences.length > 0 && (tabMode === 'batch' ? filledProductGroups.length > 0 : productImages.length > 0) && !isLoading;

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
                    上传喜欢的设计参考图和产品素材，AI 将融合参考风格与产品特性，生成专属高转化详情图。
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
                                <h3 className="font-semibold text-pastel-text">参考设计图 {tabMode === 'batch' && <span className="text-xs font-normal text-pastel-muted">(最多 12 张，按产品顺序匹配)</span>}</h3>
                            </div>
                            <p className="text-xs text-pastel-muted mb-3">上传希望复刻的设计风格图；一张或多张都可以</p>

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
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <Package className="w-5 h-5 text-pastel-highlight" />
                                    <h3 className="font-semibold text-pastel-text">产品素材图</h3>
                                </div>
                                {tabMode === 'batch' && (
                                    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100">
                                        已识别 {filledProductGroups.length} 个产品
                                    </span>
                                )}
                            </div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs text-pastel-muted">
                                    {tabMode === 'batch'
                                        ? `批量模式下请按产品分组上传，每个产品最多 ${PRODUCT_GROUP_IMAGE_LIMIT} 张素材；每个产品匹配 1 张参考设计图。`
                                        : '上传您希望出现在图片中的产品素材'}
                                </p>
                                {hasProductUploads && (
                                    <button
                                        type="button"
                                        onClick={clearProductUploads}
                                        className="shrink-0 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold text-red-500 transition-colors hover:bg-red-100"
                                    >
                                        全部清除
                                    </button>
                                )}
                            </div>

                            {tabMode === 'batch' ? (
                                <div className="space-y-3">
                                    <input
                                        ref={productInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleProductUpload}
                                        className="hidden"
                                    />
                                    {productGroups.map((group, groupIdx) => (
                                        <div key={groupIdx} className="rounded-xl border border-pastel-border bg-pastel-bg/20 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-xs font-bold text-pastel-text">
                                                    产品 {groupIdx + 1}
                                                    <span className="ml-2 text-[10px] font-normal text-pastel-muted">{group.length}/{PRODUCT_GROUP_IMAGE_LIMIT} 张</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductGroup(groupIdx)}
                                                    className="text-[10px] text-red-500 hover:text-red-600 disabled:text-gray-300"
                                                    disabled={productGroups.length === 1 && group.length === 0}
                                                >
                                                    删除产品
                                                </button>
                                            </div>
                                            <div
                                                onClick={() => { setActiveProductGroupIndex(groupIdx); productInputRef.current?.click(); }}
                                                onDragOver={(e) => { e.preventDefault(); setIsDraggingProduct(true); }}
                                                onDragLeave={(e) => { e.preventDefault(); setIsDraggingProduct(false); }}
                                                onDrop={(e) => handleProductDrop(e, groupIdx)}
                                                className={`relative border-2 border-dashed rounded-lg p-3 cursor-pointer transition-all group ${isDraggingProduct && activeProductGroupIndex === groupIdx
                                                    ? 'border-pastel-highlight bg-pastel-bg/80'
                                                    : 'border-pastel-border hover:border-pastel-highlight hover:bg-white/70'
                                                    }`}
                                            >
                                                {group.length > 0 ? (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {group.map((img, idx) => (
                                                            <div key={idx} className="relative group/item">
                                                                <img
                                                                    src={img.preview}
                                                                    alt={`Product ${groupIdx + 1}-${idx + 1}`}
                                                                    className="w-full h-20 object-cover rounded-lg border border-pastel-border"
                                                                />
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        removeProductGroupImage(groupIdx, idx);
                                                                    }}
                                                                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {group.length < PRODUCT_GROUP_IMAGE_LIMIT && (
                                                            <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                                                                <Upload className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4">
                                                        <Upload className="w-6 h-6 mx-auto mb-1 text-pastel-muted group-hover:text-pastel-highlight transition-colors" />
                                                        <p className="text-xs text-pastel-highlight">上传该产品素材，最多 {PRODUCT_GROUP_IMAGE_LIMIT} 张</p>
                                                        <p className="text-[10px] text-pastel-muted mt-1">同一产品的正面、背面、细节图放在同一组</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {productGroups.length < PRODUCT_GROUP_LIMIT && (
                                        <button
                                            type="button"
                                            onClick={addProductGroup}
                                            className="w-full py-2 rounded-lg border border-dashed border-orange-200 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
                                        >
                                            + 添加另一个产品
                                        </button>
                                    )}
                                </div>
                            ) : (
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
                                            {productImages.length < PRODUCT_IMAGE_LIMIT && (
                                                <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                                                    <Upload className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <Upload className="w-8 h-8 mx-auto mb-2 text-pastel-muted group-hover:text-pastel-highlight transition-colors" />
                                            <p className="text-sm text-pastel-highlight">上传产品图片，最多 {PRODUCT_IMAGE_LIMIT} 张</p>
                                            <p className="text-xs text-pastel-muted mt-1">支持多选</p>
                                        </div>
                                    )}
                                </div>
                            )}
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
                                placeholder='例如：这是 Tesla Model Y 2017 内饰；使用红色节日氛围；添加“限时特惠”文字。这里的描述会覆盖参考图中的原有产品信息。'
                                className="w-full h-24 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                            />
                            <p className="text-xs text-pastel-muted mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                AI 会优先遵循这里的文字指令，用于确定产品型号、场景细节或文案要求。
                            </p>
                        </div>

                        {/* Config Options */}
                        <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm space-y-5">
                            <div className="border-b border-pastel-border/50 pb-5">
                                <label className="text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5 px-1">
                                    <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                                </label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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
                                    <button
                                        onClick={() => setSelectedModel('qwen-image-3.0-pro')}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'qwen-image-3.0-pro'
                                            ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100'
                                            : 'border-pastel-border hover:border-cyan-200 bg-pastel-bg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-cyan-500" />
                                            <span className={`text-[10px] font-bold ${selectedModel === 'qwen-image-3.0-pro' ? 'text-cyan-700' : 'text-pastel-text'}`}>千问3.0pro</span>
                                        </div>
                                        <span className="text-[8px] text-pastel-muted">Qwen Image</span>
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
                                        <option value="2:3">2:3 竖版</option>
                                        <option value="3:2">3:2 横版</option>
                                        
                                        {selectedModel !== 'gpt-image-2' && (
                                            <>
                                                <option value="3:4">3:4 竖版</option>
                                                <option value="4:3">4:3 横版</option>
                                                <option value="4:5">4:5 竖版</option>
                                                <option value="5:4">5:4 横版</option>
                                            </>
                                        )}
                                        
                                        <option value="9:16">9:16 手机竖屏</option>
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
                                            <span>{filledProductGroups.length} 个产品 = {batchOutputCount} 张</span>
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

                            <div className="border-t border-pastel-border/50 pt-5">
                                <div className="mb-3 flex items-center gap-2">
                                    <Sun className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="text-sm font-bold text-pastel-text">色彩校准 Color Match</h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">生成后自动统一色调</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'off' as ColorCorrectionMode, label: '关闭', desc: '原图输出' },
                                        { id: 'match' as ColorCorrectionMode, label: '参考图匹配', desc: '最推荐' },
                                        { id: 'autoWhiteBalance' as ColorCorrectionMode, label: '自动白平衡', desc: 'Gray World' },
                                        { id: 'redSuppress' as ColorCorrectionMode, label: '压红补青', desc: '偏红修正' },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setColorCorrectionMode(item.id)}
                                            className={`min-h-[3.25rem] rounded-xl border px-2 py-2 text-center transition-all ${
                                                colorCorrectionMode === item.id
                                                    ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                                                    : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-blue-200'
                                            }`}
                                        >
                                            <span className="block text-[11px] font-black">{item.label}</span>
                                            <span className="mt-0.5 block text-[9px] opacity-70">{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                                {colorCorrectionMode !== 'off' && (
                                    <div className="mt-3">
                                        <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-pastel-muted">
                                            <span>混合度</span>
                                            <span>{Math.round(colorCorrectionBlend * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.3"
                                            max="1"
                                            step="0.05"
                                            value={colorCorrectionBlend}
                                            onChange={(event) => setColorCorrectionBlend(Number(event.target.value))}
                                            className="w-full accent-blue-500"
                                        />
                                    </div>
                                )}
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
                                        生成 {tabMode === 'batch' ? batchOutputCount : generateCount} 张详情图
                                    </>
                                )}
                            </button>
                            {isLoading && (
                                <button
                                    type="button"
                                    onClick={handleCancelGenerate}
                                    className="w-full py-3 rounded-xl font-bold bg-gray-800 text-white hover:bg-gray-900 transition-all"
                                >
                                    中止生成
                                </button>
                            )}
                            {cancelMessage && !isLoading && (
                                <p className="text-center text-xs font-bold text-orange-600 mt-2">{cancelMessage}</p>
                            )}
                            <p className="text-center text-xs text-pastel-muted mt-2">预计 5 秒起，批量任务按产品组并行处理</p>
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
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        className="text-xs text-pastel-highlight hover:text-orange-600 flex items-center gap-1 font-medium transition-colors"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        重新生成
                                    </button>
                                    {generatedImages.length > 1 && (
                                        <button
                                            onClick={handleDownloadAll}
                                            className="text-xs text-pastel-highlight hover:text-orange-600 flex items-center gap-1 font-medium transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            全部下载 ({generatedImages.length})
                                        </button>
                                    )}
                                    <button
                                        onClick={handleReset}
                                        className="text-xs text-pastel-muted hover:text-pastel-text flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        重置
                                    </button>
                                </div>
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
                                <div className={`p-4 h-full overflow-y-auto ${generatedImages.length === 1 ? 'flex items-center justify-center' : 'grid grid-cols-2 gap-3 items-start content-start'}`}>
                                    {generatedImages.map((img, idx) => {
                                        const isRegenerating = regeneratingIndices.includes(idx);
                                        return (
                                            <div
                                                key={idx}
                                                className={`relative group rounded-lg overflow-hidden border border-pastel-border bg-white shadow-sm ${generatedImages.length === 1 ? 'max-w-md w-full' : 'w-full'}`}
                                            >
                                                <img
                                                    src={img}
                                                    alt={`Generated ${idx + 1}`}
                                                    className="w-full h-auto object-contain block"
                                                />
                                                <div className={`absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center gap-2 ${
                                                    isRegenerating ? 'opacity-100 cursor-wait' : 'opacity-0 group-hover:opacity-100'
                                                }`}>
                                                    {isRegenerating ? (
                                                        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 text-pastel-text shadow-lg">
                                                            <RefreshCw className="w-6 h-6 animate-spin text-pastel-highlight" />
                                                            <span className="text-xs font-bold">重新生成中</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setSelectedPreview(img)}
                                                                className="p-2 bg-white rounded-full text-pastel-text hover:bg-pastel-pink transition-colors"
                                                            >
                                                                <ZoomIn className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRegenerateOne(idx)}
                                                                className="p-2 bg-white rounded-full text-pastel-text hover:bg-pastel-pink transition-colors"
                                                                title="重新生成这张"
                                                            >
                                                                <RefreshCw className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownload(img, idx)}
                                                                className="p-2 bg-white rounded-full text-pastel-text hover:bg-pastel-pink transition-colors"
                                                            >
                                                                <Download className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                {generatedImages.length > 1 ? (
                                    <>
                                        <button
                                            onClick={handleDownloadAll}
                                            className="px-6 py-2.5 bg-pastel-highlight text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5 transition-all shadow-md shadow-orange-200 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <Download className="w-4 h-4" />
                                            全部下载 ({generatedImages.length} 张)
                                        </button>
                                        <button
                                            onClick={handleGenerate}
                                            className="px-4 py-2 border border-pastel-border text-pastel-text rounded-lg text-sm font-medium hover:bg-pastel-bg flex items-center gap-1.5 transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            重新批量生成
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSelectedPreview(generatedImages[0])}
                                                className="px-4 py-2 border border-pastel-border rounded-lg text-sm text-pastel-text hover:bg-pastel-bg flex items-center gap-1.5 transition-colors"
                                            >
                                                <ZoomIn className="w-4 h-4" />
                                                放大
                                            </button>
                                            <button
                                                onClick={() => handleDownload(generatedImages[0], 0)}
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
                                    </>
                                )}
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
                        <p className="text-xs text-pastel-muted mt-1">自动识别并重绘营销文案，融入新产品语境</p>
                    </div>
                    <div className="bg-white rounded-xl border border-pastel-border p-4 text-center">
                        <FileOutput className="w-6 h-6 text-pastel-highlight mx-auto mb-2" />
                        <h4 className="font-semibold text-pastel-text text-sm">电商详情导出</h4>
                        <p className="text-xs text-pastel-muted mt-1">直接生成可商用的高转化详情图，支持拼图与长图</p>
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
