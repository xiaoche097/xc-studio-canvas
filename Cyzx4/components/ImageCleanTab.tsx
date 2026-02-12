import React, { useState, useRef } from 'react';
import { Upload, X, Wand2, Sparkles, AlertCircle, Loader2, Layout, Sun, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { analyzeAndMergePrompts, generateCleanImage, blobToBase64 } from '../services/geminiService';
import { getErrorMessage } from '../utils/apiHelpers';

type IntensityMode = 'conservative' | 'balanced' | 'aggressive';

const ImageCleanTab: React.FC = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [userInstruction, setUserInstruction] = useState('');
    const [intensity, setIntensity] = useState<IntensityMode>('balanced');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // New Options
    const [generateCount, setGenerateCount] = useState<number>(1);
    const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = async (file: File) => {
        try {
            const base64 = await blobToBase64(file);
            const dataUri = `data:${file.type};base64,${base64}`;
            setSelectedImage(dataUri);
            setGeneratedImages([]);
            setAnalysisResult('');
            setError(null);
        } catch (err) {
            setError("图片处理失败，请重试");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setGeneratedImages([]);
        setAnalysisResult('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAnalyzeAndGenerate = async () => {
        if (!selectedImage) return;

        setError(null);
        setIsAnalyzing(true);
        setGeneratedImages([]);

        try {
            // Step 1: Analyze
            // API expects raw base64, frontend uses data URI
            const base64Parts = selectedImage.split(',');
            const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

            let finalPrompt = analysisResult;
            if (!finalPrompt) {
                finalPrompt = await analyzeAndMergePrompts(rawBase64, userInstruction, intensity);
                setAnalysisResult(finalPrompt);
            }
            setIsAnalyzing(false);

            // Step 2: Generate
            setIsGenerating(true);
            const results = await generateCleanImage(finalPrompt, rawBase64, intensity, {
                count: generateCount,
                resolution: resolution
            });

            // Add prefix to all images
            const validImages = results.map(b64 => `data:image/jpeg;base64,${b64}`);
            setGeneratedImages(validImages);

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsAnalyzing(false);
            setIsGenerating(false);
        }
    };

    const handleRegenerate = async () => {
        if (!analysisResult || !selectedImage) return;
        setError(null);
        setIsGenerating(true);
        try {
            const base64Parts = selectedImage.split(',');
            const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

            const results = await generateCleanImage(analysisResult, rawBase64, intensity, {
                count: generateCount,
                resolution: resolution
            });
            const validImages = results.map(b64 => `data:image/jpeg;base64,${b64}`);
            setGeneratedImages(validImages);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-pastel-bg text-pastel-text overflow-hidden font-sans">
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                    {/* Left Column: Configuration (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">

                        {/* 1. Image Upload Card */}
                        <div className="bg-pastel-card rounded-2xl p-6 shadow-sm border border-pastel-border transition-all hover:shadow-md">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-pastel-text">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                    <Upload className="w-5 h-5 text-pastel-highlight" />
                                </div>
                                1. 上传参考图
                            </h3>

                            {!selectedImage ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all bg-pastel-bg/50 group ${isDragging
                                        ? 'border-pastel-highlight bg-orange-50 dark:bg-orange-900/20 scale-[1.02]'
                                        : 'border-pastel-border hover:border-pastel-highlight'
                                        }`}
                                >
                                    <div className="p-4 bg-white dark:bg-white/5 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-sm">
                                        <ImageIcon className={`w-8 h-8 ${isDragging ? 'text-pastel-highlight' : 'text-pastel-muted group-hover:text-pastel-highlight'}`} />
                                    </div>
                                    <p className={`text-sm font-medium ${isDragging ? 'text-pastel-highlight' : 'text-pastel-muted group-hover:text-pastel-text'}`}>
                                        {isDragging ? '松开以上传图片' : '点击或拖拽上传图片'}
                                    </p>
                                    <p className="text-xs text-pastel-muted/70 mt-1">支持 JPG, PNG (最大 10MB)</p>
                                </div>
                            ) : (
                                <div className="relative group rounded-xl overflow-hidden h-48 bg-black/5 flex items-center justify-center border border-pastel-border">
                                    <img src={selectedImage} alt="Reference" className="max-h-full max-w-full object-contain" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={handleRemoveImage}
                                            className="p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-red-500/80 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>

                        {/* 2. Instruction & Intensity Card */}
                        <div className="bg-pastel-card rounded-2xl p-6 shadow-sm border border-pastel-border flex-1 flex flex-col gap-5 transition-all hover:shadow-md">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-pastel-text">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                    <Sparkles className="w-5 h-5 text-pastel-highlight" />
                                </div>
                                2. 风格与设置
                            </h3>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-pastel-text">
                                    洗图指令 (Prompt)
                                </label>
                                <textarea
                                    value={userInstruction}
                                    onChange={(e) => setUserInstruction(e.target.value)}
                                    placeholder="例如：改为极简风格，白色背景，柔和光影..."
                                    className="w-full h-32 px-4 py-3 bg-pastel-bg border border-pastel-border rounded-xl focus:ring-2 focus:ring-pastel-highlight/50 focus:border-pastel-highlight outline-none resize-none transition-all text-sm placeholder:text-pastel-muted/60"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-pastel-text">
                                    重绘强度 (Intensity)
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { id: 'conservative', label: '保守模式', desc: '微调优化，保留80%原图细节', val: '30%' },
                                        { id: 'balanced', label: '平衡模式', desc: '风格迁移，保留核心构图', val: '60%' },
                                        { id: 'aggressive', label: '激进模式', desc: '概念重塑，仅保留主体轮廓', val: '90%' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setIntensity(mode.id as IntensityMode)}
                                            className={`relative flex items-center p-3 rounded-xl border transition-all text-left group ${intensity === mode.id
                                                ? 'bg-orange-50 dark:bg-orange-900/20 border-pastel-highlight ring-1 ring-pastel-highlight'
                                                : 'bg-pastel-bg/50 border-pastel-border hover:bg-pastel-bg hover:border-pastel-muted/50'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${intensity === mode.id ? 'border-pastel-highlight' : 'border-pastel-muted/50'
                                                }`}>
                                                {intensity === mode.id && <div className="w-2 h-2 rounded-full bg-pastel-highlight" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-sm font-bold ${intensity === mode.id ? 'text-pastel-highlight' : 'text-pastel-text'}`}>
                                                    {mode.label}
                                                </div>
                                                <div className="text-xs text-pastel-muted mt-0.5">{mode.desc}</div>
                                            </div>
                                            <div className={`text-xs font-bold px-2 py-1 rounded-md ${intensity === mode.id ? 'bg-pastel-highlight text-white' : 'bg-pastel-border text-pastel-muted'
                                                }`}>
                                                {mode.val}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-pastel-text">
                                    生成数量 (Count)
                                </label>
                                <div className="flex gap-2 p-1 bg-pastel-bg/50 rounded-xl border border-pastel-border">
                                    {[1, 2, 3, 4].map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => setGenerateCount(num)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${generateCount === num
                                                ? 'bg-white shadow text-pastel-highlight'
                                                : 'text-pastel-muted hover:text-pastel-text'
                                                }`}
                                        >
                                            {num}张
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-pastel-text">
                                    分辨率 (Resolution)
                                </label>
                                <div className="flex gap-2 p-1 bg-pastel-bg/50 rounded-xl border border-pastel-border">
                                    {['1K', '2K', '4K'].map((res) => (
                                        <button
                                            key={res}
                                            onClick={() => setResolution(res as any)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${resolution === res
                                                ? 'bg-white shadow text-pastel-highlight'
                                                : 'text-pastel-muted hover:text-pastel-text'
                                                }`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-auto pt-4">
                                <button
                                    onClick={handleAnalyzeAndGenerate}
                                    disabled={!selectedImage || isAnalyzing || isGenerating}
                                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${!selectedImage || isAnalyzing || isGenerating
                                        ? 'bg-slate-300 dark:bg-white/10 cursor-not-allowed text-slate-500'
                                        : 'bg-gradient-to-r from-[#ED6D46] to-[#F09275] shadow-orange-500/30'
                                        }`}
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            正在分析画面结构...
                                        </>
                                    ) : isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            正在极速绘图中...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-5 h-5" />
                                            开始智能洗图
                                        </>
                                    )}
                                </button>
                            </div>

                            {error && (
                                <div className="mt-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Results (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6 h-full">

                        {/* 3. Analysis Result */}
                        <div className="bg-pastel-card rounded-2xl p-6 shadow-sm border border-pastel-border transition-all hover:shadow-md">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-pastel-text">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Layout className="w-5 h-5 text-blue-500" />
                                </div>
                                3. AI 视觉分析 (Prompt Engineer)
                            </h3>
                            <div className="relative">
                                <textarea
                                    value={analysisResult}
                                    onChange={(e) => setAnalysisResult(e.target.value)}
                                    placeholder="AI 智能分析后的结构化提示词将显示在这里，您可以手动修改以精准控制生成结果..."
                                    className="w-full h-32 px-4 py-3 bg-pastel-bg border border-pastel-border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none resize-none transition-all text-sm font-mono leading-relaxed"
                                />
                                {analysisResult && !isGenerating && (
                                    <div className="absolute bottom-3 right-3">
                                        <button
                                            onClick={handleRegenerate}
                                            className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            基于当前提示词重绘
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Generated Image */}
                        <div className="bg-pastel-card rounded-2xl p-6 shadow-sm border border-pastel-border flex-1 flex flex-col min-h-[500px] transition-all hover:shadow-md">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-pastel-text">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <Sun className="w-5 h-5 text-green-500" />
                                </div>
                                4. 生成结果 {generatedImages.length > 0 && <span className="text-xs font-normal text-pastel-muted ml-2">({generatedImages.length} 张)</span>}
                            </h3>

                            <div className="flex-1 bg-pastel-bg rounded-xl overflow-hidden border-2 border-dashed border-pastel-border relative group min-h-[400px]">
                                {generatedImages.length > 0 ? (
                                    <div className={`w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] p-4 overflow-y-auto grid gap-4 ${generatedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                                        }`}>
                                        {generatedImages.map((imgSrc, idx) => (
                                            <div key={idx} className="relative group/image rounded-xl overflow-hidden shadow-lg border border-white/20 transition-transform hover:scale-[1.01]">
                                                <img src={imgSrc} alt={`Generated ${idx + 1}`} className="w-full h-auto object-cover" />
                                                <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                                                    <a
                                                        href={imgSrc}
                                                        download={`skysper-clean-${Date.now()}-${idx}.jpg`}
                                                        className="p-2 bg-white/90 backdrop-blur text-slate-800 rounded-lg shadow-lg hover:bg-white font-medium text-xs flex items-center gap-1"
                                                    >
                                                        下载
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/50 backdrop-blur-sm z-10 transition-all">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-pastel-bg rounded-full border-t-pastel-highlight animate-spin"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Sparkles className="w-6 h-6 text-pastel-highlight animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-pastel-text font-bold text-lg">正在生成高清图像...</p>
                                            <p className="text-pastel-muted text-sm mt-1">Gemini Pro 正在通过像素级重绘优化您的图片</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                        <div className="w-20 h-20 bg-pastel-bg rounded-full flex items-center justify-center mx-auto mb-4">
                                            <ImageIcon className="w-8 h-8 text-pastel-border" />
                                        </div>
                                        <p className="text-pastel-muted font-medium">生成结果将显示在这里</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ImageCleanTab;
