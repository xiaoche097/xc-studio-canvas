import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
    analyzeImageQuality,
    analyzeStyle,
    generateColorMap,
    generateLineArt,
    generateHDUpscale,
    compressImage,
} from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { downloadImageFile } from '../utils/imageDownload';
import {
    Upload,
    Loader2,
    X,
    Download,
    Image as ImageIcon,
    CheckCircle2,
    Zap,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Trash2,
    Check,
    Sparkles,
    Layers,
    ChevronRight,
    ArrowRight,
    RotateCcw,
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { ECOMMERCE_RATIOS } from '../constants/ecommerceHeroPresets';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';

// ==================== Types & Interfaces ====================

export interface HDUploadedImage {
    file?: File;
    base64: string;
    mime: string;
    preview: string;
    width?: number;
    height?: number;
}

export interface HDAnalysisResult {
    quality?: any;
    style?: any;
    colorMap?: string;
    lineArt?: string;
    upscaled?: string;
}

export type HDStep = 'input' | 'analyzing' | 'color' | 'line' | 'upscaling' | 'complete';
export type HDCheckpoint = 'input' | 'analyzed' | 'color_done' | 'line_done' | 'complete';

export interface HDUpscaleRecord {
    id: string;
    createdAt: number;
    step: HDStep;
    checkpoint: HDCheckpoint;
    oneClick: boolean;
    originalImage: HDUploadedImage | null;
    upscaleFactor: 2 | 4 | 8;
    modelId: string;
    aspectRatio: AspectRatio;
    resolution: ImageResolution;
    results: HDAnalysisResult;
    currentProcessStep: number;
    error: string | null;
}

const MAX_RECORDS = 20;

const IMAGE_MODEL_OPTIONS: Array<{ id: string; label: string; description: string; badge: string }> = [
    { id: 'gemini-3.1-flash-image-preview', label: 'Gemini Banana 2', description: '快速稳定', badge: '默认' },
    { id: 'gpt-image-2', label: 'GPT Image 2', description: 'Ultra Quality', badge: 'GPT' },
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro', description: '专业细节', badge: 'Pro' },
    { id: 'qwen-image-3.0-pro', label: '千问3.0pro', description: '高质量图像生成与编辑', badge: '千问' },
];

const STEPS: Array<{ id: HDStep; label: string }> = [
    { id: 'input', label: '1. 输入' },
    { id: 'analyzing', label: '2. AI分析' },
    { id: 'color', label: '3. 颜色稿' },
    { id: 'line', label: '4. 线稿' },
    { id: 'upscaling', label: '5. 高清重绘' },
    { id: 'complete', label: '6. 完成' },
];

const PROCESS_STEPS_PROGRESS = [
    { id: 0, label: "质量评估", desc: "分析原图细节与降噪参数", icon: "🔍" },
    { id: 1, label: "风格分析", desc: "反推材质、光影与特征", icon: "🎨" },
    { id: 2, label: "生成颜色稿", desc: "提取平面色块分布", icon: "🌈" },
    { id: 3, label: "生成线稿", desc: "解析结构与闭合轮廓", icon: "✏️" },
    { id: 4, label: "高清重建", desc: "AI 细节重绘与超级放大", icon: "✨" },
];

const createRecord = (): HDUpscaleRecord => ({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    step: 'input',
    checkpoint: 'input',
    oneClick: false,
    originalImage: null,
    upscaleFactor: 2,
    modelId: 'gemini-3.1-flash-image-preview',
    aspectRatio: AspectRatio.SQUARE,
    resolution: ImageResolution.RES_2K,
    results: {},
    currentProcessStep: 0,
    error: null,
});

const getClosestAspectRatio = (width: number, height: number): AspectRatio => {
    const ratio = width / height;
    const ratios = [
        { id: AspectRatio.SQUARE, value: 1.0 },
        { id: AspectRatio.LANDSCAPE_3_2, value: 3 / 2 },
        { id: AspectRatio.PORTRAIT_2_3, value: 2 / 3 },
        { id: AspectRatio.LANDSCAPE_4_3, value: 4 / 3 },
        { id: AspectRatio.PORTRAIT_3_4, value: 3 / 4 },
        { id: AspectRatio.LANDSCAPE_5_4, value: 5 / 4 },
        { id: AspectRatio.PORTRAIT_4_5, value: 4 / 5 },
        { id: AspectRatio.LANDSCAPE_16_9, value: 16 / 9 },
        { id: AspectRatio.PORTRAIT_9_16, value: 9 / 16 },
        { id: AspectRatio.LANDSCAPE_21_9, value: 21 / 9 },
    ];
    return ratios.reduce((prev, curr) =>
        Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
    ).id;
};

const WorkflowSteps: React.FC<{ step: HDStep }> = ({ step }) => {
    const stepOrder: HDStep[] = ['input', 'analyzing', 'color', 'line', 'upscaling', 'complete'];
    const current = stepOrder.indexOf(step);

    return (
        <div className="no-scrollbar mt-4 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
            {STEPS.map((item, index) => (
                <React.Fragment key={item.id}>
                    <div className={`flex min-w-fit items-center gap-2 text-xs font-black ${index <= current ? 'text-[#17243c] dark:text-white' : 'text-[#93a2b6]'}`}>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${index < current ? 'border-[#ed6d46] bg-[#ed6d46] text-white' : index === current ? 'border-[#17243c] bg-[#17243c] text-white' : 'border-[#d8e2ec] bg-white text-[#93a2b6] dark:bg-white/5'}`}>
                            {index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        <span>{item.label}</span>
                    </div>
                    {index < STEPS.length - 1 && <span className="h-px w-6 shrink-0 bg-[#d8e2ec] sm:w-10" />}
                </React.Fragment>
            ))}
        </div>
    );
};

const SelectionModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
            <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15191f]" onMouseDown={(event) => event.stopPropagation()}>
                <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6">
                    <h2 className="text-base font-black text-[#17243c] dark:text-white">{title}</h2>
                    <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted hover:text-[#17243c]" aria-label="关闭">
                        <X className="h-5 w-5" />
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
            </section>
        </div>
    );
};

// ==================== Main Component ====================

const HDUpscaleTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
    const initialRecordRef = useRef<HDUpscaleRecord | null>(null);
    if (!initialRecordRef.current) initialRecordRef.current = createRecord();

    const [records, setRecords] = useState<HDUpscaleRecord[]>([initialRecordRef.current]);
    const [activeRecordId, setActiveRecordId] = useState<string>(initialRecordRef.current.id);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewMode, setPreviewMode] = useState<'original' | 'color' | 'line' | 'upscaled'>('original');
    const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
    const [selectionModal, setSelectionModal] = useState<'ratio' | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeRecord = useMemo(
        () => records.find((r) => r.id === activeRecordId) || records[0],
        [records, activeRecordId]
    );

    const patchActive = useCallback(
        (patch: Partial<HDUpscaleRecord>) => {
            setRecords((prev) =>
                prev.map((rec) => (rec.id === activeRecordId ? { ...rec, ...patch } : rec))
            );
        },
        [activeRecordId]
    );

    const {
        cancelMessage,
        startGenerationTask,
        cancelGenerationTask,
        isCurrentGenerationTask,
        assertCurrentGenerationTask,
        finishGenerationTask,
    } = useCancelableGeneration();

    const handleFilesPasted = useCallback(
        async (files: File[]) => {
            const file = files[0];
            if (!file || !file.type.startsWith('image/')) return;
            try {
                const compressed = await compressImage(file, 2048, 0.92);
                const preview = `data:${compressed.mime};base64,${compressed.base64}`;

                const img = new Image();
                img.onload = () => {
                    const detectedRatio = getClosestAspectRatio(img.width, img.height);
                    patchActive({
                        originalImage: {
                            file,
                            base64: compressed.base64,
                            mime: compressed.mime,
                            preview,
                            width: img.width,
                            height: img.height,
                        },
                        aspectRatio: detectedRatio,
                        results: {},
                        step: 'input',
                        checkpoint: 'input',
                        currentProcessStep: 0,
                        error: null,
                    });
                    setPreviewMode('original');
                };
                img.src = preview;
            } catch (e) {
                patchActive({ error: '剪贴板图片解析失败' });
            }
        },
        [patchActive]
    );

    useImagePaste(handleFilesPasted, isActive && !isProcessing);

    const handleUploadFiles = useCallback(
        async (files: FileList | File[]) => {
            const file = Array.from(files)[0];
            if (!file || !file.type.startsWith('image/')) return;

            try {
                const compressed = await compressImage(file, 2048, 0.92);
                const preview = `data:${compressed.mime};base64,${compressed.base64}`;

                const img = new Image();
                img.onload = () => {
                    const detectedRatio = getClosestAspectRatio(img.width, img.height);
                    patchActive({
                        originalImage: {
                            file,
                            base64: compressed.base64,
                            mime: compressed.mime,
                            preview,
                            width: img.width,
                            height: img.height,
                        },
                        aspectRatio: detectedRatio,
                        results: {},
                        step: 'input',
                        checkpoint: 'input',
                        currentProcessStep: 0,
                        error: null,
                    });
                    setPreviewMode('original');
                };
                img.src = preview;
            } catch (e) {
                patchActive({ error: '图片上传处理失败' });
            }
        },
        [patchActive]
    );

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
        }
    };

    const startNewRecord = () => {
        if (isProcessing) return;
        const fresh = createRecord();
        setRecords((prev) => [fresh, ...prev.slice(0, MAX_RECORDS - 1)]);
        setActiveRecordId(fresh.id);
        setPreviewMode('original');
    };

    const deleteRecord = (id: string) => {
        if (records.length <= 1) {
            const fresh = createRecord();
            setRecords([fresh]);
            setActiveRecordId(fresh.id);
            return;
        }
        const nextRecords = records.filter((r) => r.id !== id);
        setRecords(nextRecords);
        if (activeRecordId === id) {
            setActiveRecordId(nextRecords[0].id);
        }
    };

    // ==================== Agent Step-by-Step Handlers ====================

    // Step 1: Execute Image Quality & Style Analysis
    const runStep1_Analyze = async () => {
        if (!activeRecord.originalImage || isProcessing) return;

        const { taskId, signal } = startGenerationTask();
        setIsProcessing(true);
        patchActive({ error: null, currentProcessStep: 0, step: 'analyzing' });

        try {
            assertCurrentGenerationTask(taskId, signal);

            patchActive({ currentProcessStep: 0 });
            const qualityRes = await analyzeImageQuality(
                activeRecord.originalImage.base64,
                activeRecord.originalImage.mime
            );
            assertCurrentGenerationTask(taskId, signal);

            patchActive({ currentProcessStep: 1 });
            const styleRes = await analyzeStyle(
                activeRecord.originalImage.base64,
                activeRecord.originalImage.mime
            );
            assertCurrentGenerationTask(taskId, signal);

            const updatedResults = { quality: qualityRes, style: styleRes };
            patchActive({
                results: updatedResults,
                checkpoint: 'analyzed',
                step: 'analyzing',
            });

            // If One-Click mode is ON, proceed automatically to Step 2
            if (activeRecord.oneClick) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
                await runStep2_ColorMap(updatedResults);
                return;
            }
        } catch (err: any) {
            if (!isAbortError(err)) {
                console.error(err);
                patchActive({ error: getErrorMessage(err), step: 'input' });
            }
        } finally {
            if (isCurrentGenerationTask(taskId)) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
            }
        }
    };

    // Step 2: Generate Color Map
    const runStep2_ColorMap = async (existingResults = activeRecord.results) => {
        if (!activeRecord.originalImage || isProcessing) return;

        const { taskId, signal } = startGenerationTask();
        setIsProcessing(true);
        patchActive({ error: null, currentProcessStep: 2, step: 'color' });

        try {
            assertCurrentGenerationTask(taskId, signal);
            const colorMapUrl = await generateColorMap(
                activeRecord.originalImage.base64,
                activeRecord.originalImage.mime,
                activeRecord.aspectRatio
            );
            assertCurrentGenerationTask(taskId, signal);

            const updatedResults = { ...existingResults, colorMap: colorMapUrl || undefined };
            patchActive({
                results: updatedResults,
                checkpoint: 'color_done',
                step: 'color',
            });
            if (colorMapUrl) setPreviewMode('color');

            // If One-Click mode is ON, proceed automatically to Step 3
            if (activeRecord.oneClick) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
                await runStep3_LineArt(updatedResults);
                return;
            }
        } catch (err: any) {
            if (!isAbortError(err)) {
                console.error(err);
                patchActive({ error: getErrorMessage(err) });
            }
        } finally {
            if (isCurrentGenerationTask(taskId)) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
            }
        }
    };

    // Step 3: Generate Line Art
    const runStep3_LineArt = async (existingResults = activeRecord.results) => {
        if (!activeRecord.originalImage || isProcessing) return;

        const { taskId, signal } = startGenerationTask();
        setIsProcessing(true);
        patchActive({ error: null, currentProcessStep: 3, step: 'line' });

        try {
            assertCurrentGenerationTask(taskId, signal);
            const lineArtUrl = await generateLineArt(
                activeRecord.originalImage.base64,
                activeRecord.originalImage.mime,
                activeRecord.aspectRatio
            );
            assertCurrentGenerationTask(taskId, signal);

            const updatedResults = { ...existingResults, lineArt: lineArtUrl || undefined };
            patchActive({
                results: updatedResults,
                checkpoint: 'line_done',
                step: 'line',
            });
            if (lineArtUrl) setPreviewMode('line');

            // If One-Click mode is ON, proceed automatically to Step 4
            if (activeRecord.oneClick) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
                await runStep4_HDReconstruct(updatedResults);
                return;
            }
        } catch (err: any) {
            if (!isAbortError(err)) {
                console.error(err);
                patchActive({ error: getErrorMessage(err) });
            }
        } finally {
            if (isCurrentGenerationTask(taskId)) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
            }
        }
    };

    // Step 4: Final HD Reconstruction / Upscale
    const runStep4_HDReconstruct = async (existingResults = activeRecord.results) => {
        if (!activeRecord.originalImage || isProcessing) return;

        const { taskId, signal } = startGenerationTask();
        setIsProcessing(true);
        patchActive({ error: null, currentProcessStep: 4, step: 'upscaling' });

        try {
            assertCurrentGenerationTask(taskId, signal);

            const styleRes = existingResults.style || {};
            const upscaledUrl = await generateHDUpscale(
                { base64: activeRecord.originalImage.base64, mime: activeRecord.originalImage.mime },
                existingResults.colorMap || null,
                existingResults.lineArt || null,
                { positive: styleRes.positive_prompt || '', negative: styleRes.negative_prompt || '' },
                activeRecord.upscaleFactor,
                activeRecord.aspectRatio
            );

            assertCurrentGenerationTask(taskId, signal);
            if (upscaledUrl) {
                const finalResults = { ...existingResults, upscaled: upscaledUrl };
                patchActive({
                    results: finalResults,
                    currentProcessStep: 5,
                    step: 'complete',
                    checkpoint: 'complete',
                });
                setPreviewMode('upscaled');

                await saveGeneratedProject({
                    type: 'RETOUCHING',
                    generated: [upscaledUrl],
                    original: [`data:${activeRecord.originalImage.mime};base64,${activeRecord.originalImage.base64}`],
                    prompt: styleRes.positive_prompt || '',
                    params: {
                        source: 'Cyzx4/components/HDUpscaleTab',
                        aspectRatio: activeRecord.aspectRatio,
                        upscaleFactor: activeRecord.upscaleFactor,
                        negativePrompt: styleRes.negative_prompt || '',
                    },
                });
            } else {
                throw new Error("HD 重绘放大未能生成有效图片，请重试。");
            }
        } catch (err: any) {
            if (!isAbortError(err)) {
                console.error(err);
                patchActive({ error: getErrorMessage(err) });
            }
        } finally {
            if (isCurrentGenerationTask(taskId)) {
                finishGenerationTask(taskId);
                setIsProcessing(false);
            }
        }
    };

    const handleCancelProcess = () => {
        cancelGenerationTask();
        setIsProcessing(false);
    };

    const handleDownload = async (url: string) => {
        try {
            await downloadImageFile(url, `hd-upscale-${Date.now()}.png`);
        } catch (error) {
            console.error('Failed to download upscaled image.', error);
            window.alert('图片下载失败，请稍后重试');
        }
    };

    const displayImage = useMemo(() => {
        const { results, originalImage } = activeRecord;
        switch (previewMode) {
            case 'color':
                return results.colorMap || originalImage?.preview || null;
            case 'line':
                return results.lineArt || originalImage?.preview || null;
            case 'upscaled':
                return results.upscaled || originalImage?.preview || null;
            default:
                return originalImage?.preview || null;
        }
    }, [previewMode, activeRecord]);

    const selectedImageModel = IMAGE_MODEL_OPTIONS.find((m) => m.id === activeRecord.modelId) || IMAGE_MODEL_OPTIONS[0];

    // History Panel Component (Matches SceneGenerationTab 1:1)
    const historyPanel = (
        <aside className="flex h-full flex-col rounded-2xl border border-[#d8e3ee] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-base font-black text-[#17243c] dark:text-white">生成记录</h2>
                    <p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsHistoryOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted"
                    aria-label="收起生成记录"
                >
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            <button
                type="button"
                onClick={startNewRecord}
                disabled={isProcessing}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white disabled:opacity-40"
            >
                <Plus className="h-4 w-4" /> 新开任务
            </button>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                {records.map((record) => {
                    const isCurrent = record.id === activeRecord.id;

                    return (
                        <button
                            key={record.id}
                            type="button"
                            onClick={() => {
                                if (!isProcessing) {
                                    setActiveRecordId(record.id);
                                    setPreviewMode(record.results.upscaled ? 'upscaled' : 'original');
                                }
                            }}
                            className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                                isCurrent
                                    ? 'border-[#ed6d46] bg-[#fff8f3]'
                                    : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="truncate text-xs font-black text-[#17243c]">
                                    {record.originalImage?.file?.name || '未命名产品'}
                                </span>
                                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.62rem] font-bold text-pastel-muted">
                                    {STEPS.find((item) => item.id === record.step)?.label}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted">
                                <span>{record.upscaleFactor}x 放大</span>
                                <span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRecord(record.id);
                                }}
                                className="absolute bottom-2 right-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex"
                                aria-label="删除记录"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );

    return (
        <div className="h-full overflow-y-auto bg-[#eef6ff] text-pastel-text dark:bg-[#080a0d]">
            <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
                
                {/* Header Banner (Matches SceneGenerationTab 1:1) */}
                <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7">
                    <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
                    <div className="relative text-center">
                        <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]">
                            <Sparkles className="h-4 w-4 text-[#ed6d46]" /> AI 图像视觉 Agent
                        </div>
                        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">
                            生成超高清放大与结构重塑图
                        </h1>
                        <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">
                            基于 Gemini 3 Pro Image 的多步骤智能重建与放大技术（多维细节还原框架）。
                        </p>
                        <WorkflowSteps step={activeRecord.step} />
                    </div>
                </header>

                {/* Floating Bottom-Left Collapsed Record Button (Matches 图2/场景图生成 1:1) */}
                {!isHistoryOpen && (
                    <button
                        type="button"
                        onClick={() => setIsHistoryOpen(true)}
                        className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] md:left-[16.25rem] lg:left-[17rem] dark:bg-[#11151c] dark:border-white/10 dark:text-white"
                    >
                        <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
                        生成记录
                        <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted dark:bg-white/10">{records.length}</span>
                    </button>
                )}

                {/* Main Grid Layout (Matches SceneGenerationTab 1:1) */}
                <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'}`}>
                    
                    {/* Column 1: History Panel */}
                    {isHistoryOpen && (
                        <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">
                            {historyPanel}
                        </div>
                    )}

                    {/* Column 2: Controls Panel */}
                    <div className="flex min-w-0 flex-col gap-4">

                        {/* Model Selection */}
                        <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-black">生成模型</h2>
                                    <p className="mt-1 text-xs leading-5 text-pastel-muted">默认使用Gemini Banana 2，也可切换GPT Image 2或Gemini 3 Pro。</p>
                                </div>
                                <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">{selectedImageModel.badge}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {IMAGE_MODEL_OPTIONS.map((model) => {
                                    const selected = activeRecord.modelId === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            disabled={isProcessing}
                                            onClick={() => patchActive({ modelId: model.id })}
                                            className={`relative flex min-h-20 items-center gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                                                selected
                                                    ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff] shadow-[0_8px_20px_rgba(237,109,70,0.12)]'
                                                    : 'border-pastel-border bg-pastel-bg/60 hover:border-[#efb49d]'
                                            }`}
                                        >
                                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${model.id === 'gpt-image-2' ? 'bg-[#17243c] text-white' : 'bg-[#e8f2ff] text-[#2d6bb1]'}`}>
                                                <Sparkles className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 pr-3">
                                                <strong className="block text-xs font-black leading-snug text-[#17243c]">{model.label}</strong>
                                                <small className="mt-0.5 block text-[0.68rem] text-pastel-muted">{model.description}</small>
                                            </span>
                                            {selected && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 shrink-0 text-[#ed6d46]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Upload Product Image */}
                        <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]">
                                        <ImageIcon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-black flex items-center gap-2">原图上传</h3>
                                        <p className="mt-1 text-xs leading-5 text-pastel-muted">支持拖拽、点击或 Ctrl+V 粘贴图片。</p>
                                    </div>
                                </div>
                            </div>

                            {activeRecord.originalImage ? (
                                <div className="group relative mt-4 aspect-video overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg">
                                    <img src={activeRecord.originalImage.preview} alt="原图" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        disabled={isProcessing}
                                        onClick={() => patchActive({ originalImage: null, results: {}, step: 'input', checkpoint: 'input' })}
                                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#17243c]/85 text-white shadow"
                                        title="移除图片"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                    {activeRecord.originalImage.width && (
                                        <span className="absolute bottom-2 left-2 rounded-lg bg-[#17243c]/90 px-2 py-1 text-xs font-black text-white backdrop-blur-sm">
                                            {activeRecord.originalImage.width}x{activeRecord.originalImage.height} ({activeRecord.aspectRatio})
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                    className="mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] p-4 text-center transition hover:border-[#ed6d46]"
                                >
                                    <Upload className="h-6 w-6 text-[#ed6d46]" />
                                    <span className="mt-2 text-sm font-black text-[#17243c]">拖拽、点击或Ctrl+V粘贴图片</span>
                                    <span className="mt-1 text-xs text-pastel-muted">JPG / JPEG / PNG / WEBP · 单张≤10MB</span>
                                </button>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleUploadFiles(e.target.files)} />
                        </section>

                        {/* Parameter Section: Upscale Factor & Ratio & Resolution */}
                        <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
                            <h3 className="text-sm font-black text-[#17243c] dark:text-white">放大倍数选择</h3>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {[2, 4, 8].map((factor) => (
                                    <button
                                        key={factor}
                                        type="button"
                                        disabled={isProcessing}
                                        onClick={() => patchActive({ upscaleFactor: factor as any })}
                                        className={`min-h-11 rounded-xl border text-xs font-black transition ${
                                            activeRecord.upscaleFactor === factor
                                                ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]'
                                                : 'border-pastel-border bg-white text-pastel-muted hover:border-[#efb49d]'
                                        }`}
                                    >
                                        {factor}x 放大
                                    </button>
                                ))}
                            </div>

                            {/* Ratio & Resolution Selection Row (Matches User Request Image 1) */}
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => setSelectionModal('ratio')}
                                    className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46] dark:bg-white/5 dark:border-white/10"
                                >
                                    <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                                    <div className="mt-1 flex items-center justify-between">
                                        <strong className="text-sm font-black text-pastel-text dark:text-white">
                                            {ECOMMERCE_RATIOS.find((r) => r.id === activeRecord.aspectRatio)?.label || activeRecord.aspectRatio}
                                        </strong>
                                        <ChevronRight className="h-4 w-4 text-pastel-muted" />
                                    </div>
                                </button>

                                <div className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left dark:bg-white/5 dark:border-white/10">
                                    <span className="text-[0.68rem] font-bold text-pastel-muted">分辨率</span>
                                    <select
                                        value={activeRecord.resolution}
                                        disabled={isProcessing}
                                        onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })}
                                        className="mt-1 min-h-8 w-full bg-transparent text-sm font-black text-pastel-text dark:text-white outline-none"
                                    >
                                        <option value={ImageResolution.RES_1K}>1K</option>
                                        <option value={ImageResolution.RES_2K}>2K (默认)</option>
                                        <option value={ImageResolution.RES_4K}>4K</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-orange-100 bg-[#fff8f3] p-3 text-xs leading-5 text-orange-900">
                                💡 <strong>还原专家提示:</strong> 当前已启用“多维细节还原框架”，2x 适合快速修复，4x/8x 将深度重建原图纹理（如毛孔、纤维）。
                            </div>
                        </section>

                        {/* One-Click Mode Toggle */}
                        <label className="flex min-h-14 cursor-pointer items-center justify-between rounded-2xl border border-pastel-border bg-white px-4 shadow-sm dark:bg-[#11151c]">
                            <span>
                                <strong className="block text-xs font-black text-[#17243c] dark:text-white">一键全流程自动生成</strong>
                                <small className="mt-0.5 block text-[0.68rem] text-pastel-muted">开启后跳过 Agent 分步确认，自动完成分析与重绘</small>
                            </span>
                            <span className={`relative h-6 w-11 rounded-full transition ${activeRecord.oneClick ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec]'}`}>
                                <input
                                    type="checkbox"
                                    checked={activeRecord.oneClick}
                                    disabled={isProcessing}
                                    onChange={(event) => patchActive({ oneClick: event.target.checked })}
                                    className="sr-only"
                                />
                                <i className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${activeRecord.oneClick ? 'left-5.5' : 'left-0.5'}`} />
                            </span>
                        </label>

                        {/* Agent Step-by-Step Action Control Buttons */}
                        {activeRecord.checkpoint === 'input' && (
                            <button
                                type="button"
                                onClick={() => void runStep1_Analyze()}
                                disabled={!activeRecord.originalImage || isProcessing}
                                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                            >
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#ff9b67]" />}
                                {isProcessing ? 'Agent 正在分析中...' : '开始 Agent 分步分析与修复'}
                            </button>
                        )}

                        {activeRecord.checkpoint === 'analyzed' && !isProcessing && (
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => void runStep2_ColorMap()}
                                    className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#ed6d46] text-sm font-black text-white shadow-[0_14px_28px_rgba(237,109,70,0.2)] transition hover:-translate-y-0.5"
                                >
                                    <span>确认分析结果，继续生成颜色稿</span>
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void runStep1_Analyze()}
                                    className="min-h-10 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted hover:bg-pastel-bg"
                                >
                                    重新进行 Agent 分析
                                </button>
                            </div>
                        )}

                        {activeRecord.checkpoint === 'color_done' && !isProcessing && (
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => void runStep3_LineArt()}
                                    className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#ed6d46] text-sm font-black text-white shadow-[0_14px_28px_rgba(237,109,70,0.2)] transition hover:-translate-y-0.5"
                                >
                                    <span>确认颜色稿，继续生成线稿</span>
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void runStep2_ColorMap()}
                                    className="min-h-10 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted hover:bg-pastel-bg"
                                >
                                    重新生成颜色稿
                                </button>
                            </div>
                        )}

                        {activeRecord.checkpoint === 'line_done' && !isProcessing && (
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => void runStep4_HDReconstruct()}
                                    className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5"
                                >
                                    <Sparkles className="h-5 w-5 text-[#ff9b67]" />
                                    <span>确认线稿，开始最终高清重绘</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void runStep3_LineArt()}
                                    className="min-h-10 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted hover:bg-pastel-bg"
                                >
                                    重新生成线稿
                                </button>
                            </div>
                        )}

                        {activeRecord.checkpoint === 'complete' && !isProcessing && (
                            <button
                                type="button"
                                onClick={startNewRecord}
                                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white text-xs font-black text-[#17243c] hover:border-[#ed6d46] hover:text-[#ed6d46]"
                            >
                                <Plus className="h-4 w-4" /> 开始新高清重绘任务
                            </button>
                        )}

                        {isProcessing && (
                            <button
                                type="button"
                                onClick={handleCancelProcess}
                                className="min-h-11 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted"
                            >
                                取消重绘任务
                            </button>
                        )}
                        {activeRecord.error && (
                            <p className="text-center text-xs font-bold text-red-500">{activeRecord.error}</p>
                        )}
                    </div>

                    {/* Column 3: Canvas / Output Panel */}
                    <div className="flex min-w-0 flex-col gap-4">
                        
                        {/* Empty State when inputting (Matches SceneGenerationTab 1:1) */}
                        {!activeRecord.results.upscaled && !isProcessing && activeRecord.checkpoint === 'input' && (
                            <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center">
                                <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]">
                                    <Zap className="h-9 w-9 fill-[#ed6d46]" />
                                </span>
                                <h2 className="mt-5 text-xl font-black text-[#17243c]">先上传原图，再开始 Agent 分步重绘</h2>
                                <p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">
                                    Agent 会识别画面细节、提取结构线稿与配色，建立多维重构方案；每一步均可把关确认后再生成底图。
                                </p>
                                <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl bg-white p-3 text-left shadow-sm">
                                        <Sparkles className="h-4 w-4 text-[#ed6d46]" />
                                        <strong className="mt-2 block text-xs font-black">多维细节还原</strong>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 text-left shadow-sm">
                                        <Layers className="h-4 w-4 text-[#2d6bb1]" />
                                        <strong className="mt-2 block text-xs font-black">矢量线稿/颜色稿</strong>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 text-left shadow-sm">
                                        <Zap className="h-4 w-4 text-emerald-600" />
                                        <strong className="mt-2 block text-xs font-black">2x/4x/8x 深度重建</strong>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Processing Card */}
                        {isProcessing && (
                            <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border border-pastel-border bg-white p-8 text-center shadow-sm">
                                <div className="relative flex h-24 w-24 items-center justify-center">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-[#ed6d46]/10" />
                                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#17243c] text-white">
                                        <Loader2 className="h-7 w-7 animate-spin" />
                                    </span>
                                </div>
                                <h2 className="mt-6 text-xl font-black">Agent 正在执行当前阶段任务</h2>
                                <p className="mt-2 max-w-md text-sm leading-7 text-pastel-muted">
                                    {PROCESS_STEPS_PROGRESS.find((s) => s.id === activeRecord.currentProcessStep)?.desc || '校验图像降噪、颜色稿与线稿结构'}
                                </p>
                            </section>
                        )}

                        {/* Agent Checkpoint Alert Card (When paused for approval) */}
                        {!isProcessing && activeRecord.checkpoint !== 'input' && activeRecord.checkpoint !== 'complete' && (
                            <section className="rounded-2xl border border-[#f0d8c9] bg-[#fffaf6] p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-[0.68rem] font-black tracking-[0.14em] text-[#ed6d46]">AGENT CHECKPOINT</span>
                                        <h3 className="mt-0.5 text-base font-black text-[#17243c]">
                                            {activeRecord.checkpoint === 'analyzed' && 'Agent 已完成品质与风格分析'}
                                            {activeRecord.checkpoint === 'color_done' && 'Agent 已生成平面颜色稿'}
                                            {activeRecord.checkpoint === 'line_done' && 'Agent 已生成矢量结构线稿'}
                                        </h3>
                                        <p className="mt-1 text-xs text-pastel-muted">
                                            {activeRecord.checkpoint === 'analyzed' && '已识别图像分辨率、材质肌理与光影分布。请点击“生成颜色稿”开始下一步。'}
                                            {activeRecord.checkpoint === 'color_done' && '已提纯色块层级，请在上方“颜色稿”页签中核对色块关系。确认后可继续生成线稿。'}
                                            {activeRecord.checkpoint === 'line_done' && '已解析物体的矢量主轮廓与细节线，请在“线稿”页签中检查闭合情况。确认后即可开始最终高清重绘。'}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-black text-[#d8552e] shrink-0">
                                        待确认把关
                                    </span>
                                </div>
                            </section>
                        )}

                        {/* Result Display Canvas */}
                        {(activeRecord.results.upscaled || activeRecord.results.colorMap || activeRecord.results.lineArt || activeRecord.results.quality) && !isProcessing && (
                            <section className="flex flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
                                {/* Mode Tabs */}
                                <div className="flex items-center justify-between border-b border-pastel-border pb-3">
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'original', label: '原图' },
                                            { id: 'color', label: '颜色稿', disabled: !activeRecord.results.colorMap },
                                            { id: 'line', label: '线稿', disabled: !activeRecord.results.lineArt },
                                            { id: 'upscaled', label: '高清结果', disabled: !activeRecord.results.upscaled },
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => !tab.disabled && setPreviewMode(tab.id as any)}
                                                disabled={tab.disabled}
                                                className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                                                    previewMode === tab.id
                                                        ? 'bg-[#ed6d46] text-white shadow-sm'
                                                        : tab.disabled
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : 'text-pastel-muted hover:bg-pastel-bg'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    {activeRecord.results.upscaled && (
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(activeRecord.results.upscaled!)}
                                            className="flex items-center gap-1.5 rounded-xl bg-[#17243c] px-3.5 py-1.5 text-xs font-black text-white hover:bg-[#253858] shadow-sm"
                                        >
                                            <Download className="h-3.5 w-3.5" /> 下载高清大图
                                        </button>
                                    )}
                                </div>

                                {/* Canvas Viewport */}
                                <div className="mt-4 flex flex-1 min-h-[460px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] p-4 text-center dark:bg-black/20">
                                    {displayImage && (
                                        <img
                                            src={displayImage}
                                            alt="Preview"
                                            className="max-h-[540px] max-w-full object-contain cursor-zoom-in rounded-lg shadow-sm transition hover:scale-[1.01]"
                                            onClick={() => setPreviewModalImage(displayImage)}
                                        />
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Analysis Cards below canvas */}
                        {(activeRecord.results.quality || activeRecord.results.style) && (
                            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
                                {activeRecord.results.quality && (
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="rounded-xl bg-pastel-bg p-2.5">
                                            <span className="text-pastel-muted font-bold">质量评分</span>
                                            <strong className="mt-1 block text-base font-black text-[#ed6d46]">{activeRecord.results.quality.quality_score ?? '-'}</strong>
                                        </div>
                                        <div className="rounded-xl bg-pastel-bg p-2.5">
                                            <span className="text-pastel-muted font-bold">推荐倍数</span>
                                            <strong className="mt-1 block text-base font-black text-[#17243c]">{activeRecord.results.quality.recommended_upscale_factor ?? '-'}x</strong>
                                        </div>
                                        <div className="rounded-xl bg-pastel-bg p-2.5">
                                            <span className="text-pastel-muted font-bold">处理难度</span>
                                            <strong className="mt-1 block text-sm font-black text-[#17243c]">
                                                {activeRecord.results.quality.processing_difficulty === 'high' ? '复杂重构' : activeRecord.results.quality.processing_difficulty === 'medium' ? '标准增强' : '快速修复'}
                                            </strong>
                                        </div>
                                    </div>
                                )}

                                {activeRecord.results.style?.style_summary && (
                                    <div className="mt-3 border-t border-pastel-border pt-3 text-xs leading-relaxed text-pastel-muted">
                                        <strong className="block text-[#17243c] font-black mb-1">画面特征深度解析 (Micro-Detail Analysis)</strong>
                                        <p className="whitespace-pre-wrap">{activeRecord.results.style.style_summary}</p>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                </div>
            </div>

            {/* Selection Modal for Aspect Ratio */}
            {selectionModal === 'ratio' && (
                <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {ECOMMERCE_RATIOS.map((ratio) => {
                            const isSelected = activeRecord.aspectRatio === ratio.id;
                            return (
                                <button
                                    key={ratio.id}
                                    type="button"
                                    onClick={() => {
                                        patchActive({ aspectRatio: ratio.id as AspectRatio });
                                        setSelectionModal(null);
                                    }}
                                    className={`flex min-h-16 items-center justify-between rounded-xl border p-4 text-left transition ${
                                        isSelected
                                            ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]'
                                            : 'border-pastel-border bg-pastel-bg hover:border-[#ed6d46]'
                                    }`}
                                >
                                    <div>
                                        <strong className="block text-sm font-black">{ratio.label}</strong>
                                        <span className="text-xs text-pastel-muted">{ratio.id}</span>
                                    </div>
                                    {isSelected && <Check className="h-5 w-5 text-[#ed6d46]" />}
                                </button>
                            );
                        })}
                    </div>
                </SelectionModal>
            )}

            {/* Modal Fullscreen Image Preview */}
            {previewModalImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-md"
                    onClick={() => setPreviewModalImage(null)}
                >
                    <img
                        src={previewModalImage}
                        className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl"
                        alt="Full Preview"
                    />
                    <button
                        type="button"
                        className="absolute top-4 right-4 p-2 text-white hover:text-red-500 transition-colors"
                        onClick={() => setPreviewModalImage(null)}
                    >
                        <X className="h-8 w-8" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default HDUpscaleTab;
