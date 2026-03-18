import React, { useState, useRef, useCallback } from 'react';
import { analyzeImageQuality, analyzeStyle, generateColorMap, generateLineArt, generateHDUpscale, compressImage } from '../services/geminiService';
import { getErrorMessage } from '../utils/apiHelpers';
import { Upload, Loader2, AlertCircle, X, Download, Maximize2, RotateCcw, Image as ImageIcon, CheckCircle2, ChevronRight, Zap, Target } from 'lucide-react';
import { ImageResolution, AspectRatio } from '../types';

// ==================== Steps & State ====================
const PROCESS_STEPS = [
    { id: 0, label: "质量评估", desc: "分析原图参数", icon: "🔍" },
    { id: 1, label: "风格分析", desc: "反推提示词", icon: "🎨" },
    { id: 2, label: "生成颜色稿", desc: "提取色彩分布", icon: "🌈" },
    { id: 3, label: "生成线稿", desc: "提取结构轮廓", icon: "✏️" },
    { id: 4, label: "高清重建", desc: "AI 细节重绘", icon: "✨" },
];

type ProcessStep = 0 | 1 | 2 | 3 | 4 | 5; // 5 = Completed

interface ImageData {
    file?: File;
    base64: string;
    mime: string;
    preview: string;
}

interface AnalysisResult {
    quality?: any;
    style?: any;
    colorMap?: string;
    lineArt?: string;
    upscaled?: string;
}

const HDUpscaleTab: React.FC = () => {
    // State
    const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
    const [results, setResults] = useState<AnalysisResult>({});
    const [currentStep, setCurrentStep] = useState<ProcessStep>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upscaleFactor, setUpscaleFactor] = useState<2 | 4 | 8>(2);
    const [previewMode, setPreviewMode] = useState<'original' | 'color' | 'line' | 'upscaled'>('original');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ==================== Helpers ====================
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

        // Find closest ratio
        return ratios.reduce((prev, curr) => {
            return (Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev);
        }).id;
    };

    // ==================== Handlers ====================

    const processFile = async (file: File): Promise<ImageData> => {
        const compressed = await compressImage(file);
        return {
            file,
            base64: compressed.base64,
            mime: compressed.mime,
            preview: URL.createObjectURL(file), // Use original for preview if possible, or compressed
        };
    };

    const handleUpload = useCallback(async (files: FileList | File[]) => {
        const file = Array.from(files)[0];
        if (!file || !file.type.startsWith('image/')) return;

        try {
            const data = await processFile(file);

            // Detect Aspect Ratio
            const img = new Image();
            img.onload = () => {
                const detectedRatio = getClosestAspectRatio(img.width, img.height);
                setAspectRatio(detectedRatio);
                console.log(`Detected Aspect Ratio: ${detectedRatio} (${img.width}x${img.height})`);
            };
            img.src = data.preview;

            setOriginalImage(data);
            setResults({});
            setCurrentStep(0);
            setError(null);
            setPreviewMode('original');
        } catch (e) {
            setError('图片上传失败');
        }
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleUpload(e.dataTransfer.files);
    };

    const runProcess = async () => {
        if (!originalImage) return;

        setIsProcessing(true);
        setError(null);
        setResults({});
        setCurrentStep(0);

        try {
            // Step 0: Quality Analysis
            console.log("Step 0: Quality Analysis...");
            setCurrentStep(0);
            const qualityRes = await analyzeImageQuality(originalImage.base64, originalImage.mime);
            setResults(prev => ({ ...prev, quality: qualityRes }));

            // Step 1: Style Analysis
            console.log("Step 1: Style Analysis...");
            setCurrentStep(1);
            const styleRes = await analyzeStyle(originalImage.base64, originalImage.mime);
            console.log("Style Analysis Result:", styleRes); // Debug Log for User
            setResults(prev => ({ ...prev, style: styleRes }));

            // Step 2: Color Map
            console.log("Step 2: Color Map...");
            setCurrentStep(2);
            const colorMapUrl = await generateColorMap(originalImage.base64, originalImage.mime, aspectRatio);
            if (colorMapUrl) setResults(prev => ({ ...prev, colorMap: colorMapUrl }));

            // Step 3: Line Art
            console.log("Step 3: Line Art...");
            setCurrentStep(3);
            const lineArtUrl = await generateLineArt(originalImage.base64, originalImage.mime, aspectRatio);
            if (lineArtUrl) setResults(prev => ({ ...prev, lineArt: lineArtUrl }));

            // Step 4: Upscale
            console.log("Step 4: HD Upscale...");
            setCurrentStep(4);
            const upscaledUrl = await generateHDUpscale(
                { base64: originalImage.base64, mime: originalImage.mime },
                colorMapUrl,
                lineArtUrl,
                { positive: styleRes.positive_prompt, negative: styleRes.negative_prompt },
                upscaleFactor,
                aspectRatio
            );

            if (upscaledUrl) {
                setResults(prev => ({ ...prev, upscaled: upscaledUrl }));
                setPreviewMode('upscaled');
                setCurrentStep(5); // Completed
            } else {
                throw new Error("Upscale generation returned no image.");
            }

        } catch (err: any) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `hd-upscale-${Date.now()}.png`;
        link.click();
    };

    const handleReset = () => {
        setOriginalImage(null);
        setResults({});
        setCurrentStep(0);
        setError(null);
        setIsProcessing(false);
    };

    // Helper to get current display image
    const getDisplayImage = () => {
        switch (previewMode) {
            case 'color': return results.colorMap || null;
            case 'line': return results.lineArt || null;
            case 'upscaled': return results.upscaled || null;
            default: return originalImage?.preview || null;
        }
    };

    const displayImage = getDisplayImage();

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white p-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-pastel-text flex items-center justify-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        AI 图片高清修复 (HD Upscale)
                    </h2>
                    <p className="text-sm text-pastel-muted mt-2">
                        基于 Gemini 3 Pro Image 的多步骤智能重建与放大技术
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Panel: Upload & Config */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Upload Card */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-6 shadow-sm">
                            <h3 className="font-bold text-pastel-text mb-4 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> 原图上传
                            </h3>

                            {originalImage ? (
                                <div className="relative group rounded-xl overflow-hidden border border-pastel-border">
                                    <img src={originalImage.preview} alt="Original" className="w-full h-auto object-cover max-h-64" />
                                    <button
                                        onClick={handleReset}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={e => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-pastel-border rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-pastel-highlight hover:bg-orange-50/30 transition-all"
                                >
                                    <Upload className="w-8 h-8 text-pastel-muted mb-2" />
                                    <p className="text-sm text-pastel-muted font-medium">拖拽或点击上传</p>
                                    <p className="text-xs text-pastel-muted/70 mt-1">支持 PNG/JPG (建议 &lt; 10MB)</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
                        </div>

                        {/* Settings Card */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-6 shadow-sm">
                            <h3 className="font-bold text-pastel-text mb-4 flex items-center gap-2">
                                <Target className="w-4 h-4" /> 参数设置
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-pastel-muted uppercase mb-2 block">放大倍数</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[2, 4, 8].map(factor => (
                                            <button
                                                key={factor}
                                                onClick={() => setUpscaleFactor(factor as any)}
                                                className={`py-2 rounded-lg text-sm font-bold border transition-all ${upscaleFactor === factor
                                                    ? 'bg-pastel-highlight text-white border-pastel-highlight shadow-sm'
                                                    : 'bg-white text-pastel-text border-pastel-border hover:border-pastel-highlight'
                                                    }`}
                                            >
                                                {factor}x
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-600 leading-relaxed border border-blue-100">
                                    💡 <strong>还原专家提示:</strong> 当前已启用“多维细节还原框架”，2x 适合快速修复，4x/8x 将深度重建原图纹理（如毛孔、纤维）。
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={runProcess}
                            disabled={!originalImage || isProcessing}
                            className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${!originalImage || isProcessing
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg transform active:scale-[0.98]'
                                }`}
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                            {isProcessing ? 'AI 正在处理...' : '开始高清修复'}
                        </button>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Progress Steps */}
                        {isProcessing && (
                            <div className="bg-white rounded-2xl border border-pastel-border p-4 shadow-sm space-y-3">
                                {PROCESS_STEPS.map((step) => (
                                    <div key={step.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${currentStep === step.id ? 'bg-blue-50 border border-blue-100' : 'opacity-60'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${currentStep === step.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                            {step.icon}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800">{step.label}</p>
                                            <p className="text-xs text-gray-500">{step.desc}</p>
                                        </div>
                                        {currentStep > step.id && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                        {currentStep === step.id && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Preview & Results */}
                    <div className="lg:col-span-8 space-y-4 flex flex-col h-full">

                        {/* Tabs */}
                        <div className="flex gap-2 p-1 bg-white border border-pastel-border rounded-xl w-fit">
                            {[
                                { id: 'original', label: '原图' },
                                { id: 'color', label: '颜色稿', disabled: !results.colorMap },
                                { id: 'line', label: '线稿', disabled: !results.lineArt },
                                { id: 'upscaled', label: '高清结果', disabled: !results.upscaled },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => !tab.disabled && setPreviewMode(tab.id as any)}
                                    disabled={tab.disabled}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${previewMode === tab.id
                                        ? 'bg-pastel-highlight text-white shadow-sm'
                                        : tab.disabled
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Canvas Area */}
                        <div className="flex-1 bg-zinc-900 rounded-2xl border border-pastel-border relative overflow-hidden flex items-center justify-center min-h-[500px]">
                            {displayImage ? (
                                <img
                                    src={displayImage}
                                    className="max-w-full max-h-full object-contain cursor-zoom-in"
                                    onClick={() => setPreviewImage(displayImage)}
                                    alt="Preview"
                                />
                            ) : (
                                <div className="text-center text-zinc-600">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">暂无预览内容</p>
                                </div>
                            )}

                            {/* Bottom Toolbar */}
                            {results.upscaled && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
                                    <button
                                        onClick={() => handleDownload(results.upscaled!)}
                                        className="px-6 py-2.5 bg-white text-zinc-900 rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> 下载高清大图
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Analysis Debug Info */}
                        {(results.quality || results.style) && (
                            <div className="space-y-4">
                                {results.quality && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="bg-white p-3 rounded-xl border border-pastel-border text-center">
                                            <p className="text-xs text-gray-500 uppercase font-bold">质量评分</p>
                                            <p className="text-lg font-bold text-pastel-highlight">{results.quality.quality_score ?? '-'}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-pastel-border text-center">
                                            <p className="text-xs text-gray-500 uppercase font-bold">推荐建议</p>
                                            <p className="text-lg font-bold text-gray-800">{results.quality.recommended_upscale_factor ?? '-'}x</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-pastel-border text-center">
                                            <p className="text-xs text-gray-500 uppercase font-bold">处理难度</p>
                                            <p className="text-lg font-bold text-gray-800 capitalize">
                                                {results.quality.processing_difficulty === 'high' ? '复杂重构' : 
                                                 results.quality.processing_difficulty === 'medium' ? '标准增强' : '快速修复'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {results.style?.style_summary && (
                                    <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
                                        <h4 className="text-xs font-bold text-pastel-muted uppercase mb-2 flex items-center gap-2">
                                            <Target className="w-3 h-3 text-pastel-highlight" /> 画面特征深度解析 (Micro-Detail Analysis)
                                        </h4>
                                        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {results.style.style_summary}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Modal Preview */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <img src={previewImage} className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl" alt="Full Preview" />
                    <button className="absolute top-4 right-4 text-white hover:text-red-500" onClick={() => setPreviewImage(null)}>
                        <X className="w-8 h-8" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default HDUpscaleTab;
