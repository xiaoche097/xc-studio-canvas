import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
    Upload, X, Wand2, Sparkles, AlertCircle, Loader2, 
    Layout, Sun, Image as ImageIcon, CheckCircle2, 
    ChevronDown, Package, Store, Ruler, MessageSquare, 
    Zap, RefreshCw, ZoomIn, Download, Brain, Layers,
    Camera, UserCircle, Cpu, ChevronUp, Edit3, Settings,
    FileText, Smartphone, Film, Eye, Maximize, Scan, Target
} from 'lucide-react';
import { generateImageToImage, blobToBase64 } from '../services/geminiService';
import { analyzeProductForScene, SceneAnalysisResult } from '../services/sceneAnalyzer';
import { getErrorMessage } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { storageService } from '../../services/storageService';
import { QUALITY_BOOSTERS, enhancePrompt } from '../services/promptUtils';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

interface HeroFormState {
    productName: string;
    productCategory: string;
    sellingPoints: string;
    avoidElements: string;
    extraNotes: string;
    personaTemplate: string;
}

const PERSONA_PRESETS = [
    '美国都市女性', '美国职场女性', '美国瑜伽/健身女性', '美国居家主妇', 
    '美国都市男性', '美国运动型男性', '美国户外冒险男性',
    '美国年轻情侣', '美国郊区家庭', '美国校园学生', '无模特（纯产品）'
];

const CAMERA_DEVICES = [
    { id: '智能推荐', label: '智能推荐', desc: '根据场景匹配', icon: <Brain className="w-4 h-4" /> },
    { id: 'iPhone 实拍', label: 'iPhone 实拍', desc: '手机真实抓拍感', icon: <Smartphone className="w-4 h-4" /> },
    { id: '富士胶片', label: '富士胶片', desc: '复古色调颗粒', icon: <Film className="w-4 h-4" /> },
    { id: '单反人像', label: '单反人像', desc: '唯美肤色虚化', icon: <Camera className="w-4 h-4" /> },
    { id: '微单高清', label: '微单高清', desc: '极致高清锐度', icon: <Target className="w-4 h-4" /> },
    { id: '拍立得', label: '拍立得', desc: '拍立得一次成像', icon: <Zap className="w-4 h-4" /> }
];

const SHOT_TYPES = [
    { id: '智能推荐', label: '智能推荐' },
    { id: '远景环境', label: '远景环境' },
    { id: '中景半身', label: '中景半身' },
    { id: '近景特写', label: '近景特写' },
    { id: '微距细节', label: '微距细节' }
];

const ACTION_TAGS = ['自然站姿', '街拍走路', '坐姿休闲', '侧身回头', '转身展示背面', '手扶墨镜', '插兜造型'];
const SCENE_TAGS = ['纯白棚拍', '城市街头', '咖啡店', '海边度假', '居家客厅', '现代简约', '复古花园'];

const PLATFORM_STYLES = [
    { id: 'amazon', label: 'Amazon', icon: '🅰️', desc: '纯白背景 / 极简', prompt: 'Amazon professional main image, pure white background (#FFFFFF), high clarity, centered composition, clean edges, professional studio photography.' },
    { id: 'shein', label: 'SHEIN', icon: '👗', desc: '潮流街拍 / 灵动', prompt: 'SHEIN trendy lifestyle photography, bright natural lighting, youthful vibe, fashionable outdoor or minimalist indoor setting, high-end editorial.' },
    { id: 'temu', label: 'Temu', icon: '🧡', desc: '高饱和 / 抓眼', prompt: 'Temu commercial style, high contrast, vibrant colors, sharp focus, attention-grabbing composition, clean modern commercial setting.' },
    { id: 'tmall', label: '天猫淘宝', icon: '🐈', desc: '高级感 / 质感', prompt: 'Tmall/Taobao premium luxury photography, sophisticated soft lighting, elegant composition, rich textures, high-end commercial studio aesthetic.' },
    { id: 'shopify', label: '独立站', icon: '🛒', desc: '品牌感 / 极简', prompt: 'Minimalist brand photography for independent stores, artistic lighting, soft shadows, clean aesthetic, high-end lifestyle atmosphere.' }
];

const COT_STEPS = [
    { id: 1, label: "视觉语义解析", desc: "正在分析产品材质与剪裁特征...", icon: "🔍" },
    { id: 2, label: "AI Agent 策略制定", desc: "正在根据产品卖点规划生成策略...", icon: "🧠" },
    { id: 3, label: "构图与景别对齐", desc: "正在设置相机参数与景别...", icon: "📸" },
    { id: 4, label: "模特动作复刻", desc: "正在同步参考图中的姿态特征...", icon: "👤" },
    { id: 5, label: "光影物理映射", desc: "正在计算环境光与织物反射...", icon: "💡" },
    { id: 6, label: "高保真渲染", desc: "正在生成 8K 级超清纹理细节...", icon: "🖌️" },
    { id: 7, label: "商业级调色", desc: "正在注入电商高转化色彩基因...", icon: "🌈" },
];

const HeroImageTab: React.FC = () => {
    // Selection states
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3-pro-image-preview");
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [generateCount, setGenerateCount] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(true);
    
    // Photo controls
    const [cameraDevice, setCameraDevice] = useState('智能推荐');
    const [shotType, setShotType] = useState('智能推荐');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    
    // Image states
    const [productImages, setProductImages] = useState<UploadedImage[]>([]);
    const [actionReference, setActionReference] = useState<UploadedImage | null>(null);
    const [sceneReferences, setSceneReferences] = useState<UploadedImage[]>([]);
    const [modelReference, setModelReference] = useState<UploadedImage | null>(null);
    const [measurements, setMeasurements] = useState({ bust: '', waist: '', hips: '' });
    const [userPrompt, setUserPrompt] = useState('');
    
    // Form
    const [form, setForm] = useState<HeroFormState>({
        productName: '',
        productCategory: '',
        sellingPoints: '',
        avoidElements: '',
        extraNotes: '',
        personaTemplate: '美国都市女性'
    });

    // Status states
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<SceneAnalysisResult | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
    
    // Refs
    const productInputRef = useRef<HTMLInputElement>(null);
    const actionInputRef = useRef<HTMLInputElement>(null);
    const sceneInputRef = useRef<HTMLInputElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const [hoveredSlot, setHoveredSlot] = useState<'product' | 'action' | 'scene' | 'model' | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);

    // Image processing
    const processFiles = async (files: File[]) => {
        const results: UploadedImage[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const base64 = await blobToBase64(file);
            results.push({
                file,
                preview: URL.createObjectURL(file),
                base64: base64 as string,
                mime: file.type
            });
        }
        return results;
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        setProductImages(prev => [...prev, ...processed].slice(0, 4));
        setError(null);
    };

    const handleActionUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        if (processed.length > 0) setActionReference(processed[0]);
        setError(null);
    };

    const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        setSceneReferences(prev => [...prev, ...processed].slice(0, 3));
        setError(null);
    };

    const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        if (processed.length > 0) setModelReference(processed[0]);
        setError(null);
    };

    // Drag and Drop Logic
    const handleDragOver = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
        setIsDragging(slot);
    };

    const handleDragLeave = () => {
        setIsDragging(null);
    };

    const handleDrop = async (e: React.DragEvent, slot: 'product' | 'action' | 'scene' | 'model') => {
        e.preventDefault();
        setIsDragging(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        if (slot === 'product') handleProductUpload(files);
        else if (slot === 'action') handleActionUpload(files);
        else if (slot === 'scene') handleSceneUpload(files);
        else if (slot === 'model') handleModelUpload(files);
    };

    // Paste handler
    useImagePaste(async (files) => {
        if (files.length === 0) return;
        if (hoveredSlot === 'action') handleActionUpload(files);
        else if (hoveredSlot === 'scene') handleSceneUpload(files);
        else if (hoveredSlot === 'model') handleModelUpload(files);
        else handleProductUpload(files);
        setError(null);
    });

    const runAIAnalysis = async () => {
        if (productImages.length === 0) return;
        setIsAnalyzing(true);
        setError(null);
        try {
            const images = productImages.map(img => ({ base64: img.base64!, mimeType: img.mime! }));
            const result = await analyzeProductForScene(images, userPrompt, 'main');
            setAnalysisResult(result);
            setForm({
                productName: result.productName || '',
                productCategory: result.productCategory || '',
                sellingPoints: result.sellingPoints || '',
                avoidElements: '',
                extraNotes: '',
                personaTemplate: result.modelPersonaPreset || '美国都市女性'
            });
        } catch (err) {
            setError("AI 分析失败");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerate = async () => {
        if (productImages.length === 0) {
            setError('请上传产品图素材');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        
        setCurrentStep(0);
        setProgress(0);
        const stepInterval = setInterval(() => {
            setCurrentStep(prev => (prev < COT_STEPS.length - 1 ? prev + 1 : prev));
            setProgress(prev => Math.min(prev + 12, 95));
        }, 1200);

        try {
            const inputImages = [
                ...productImages.map(img => ({ base64: img.base64!, mimeType: img.mime! })),
            ];
            
            if (actionReference) inputImages.push({ base64: actionReference.base64!, mimeType: actionReference.mime! });
            if (modelReference) inputImages.push({ base64: modelReference.base64!, mimeType: modelReference.mime! });
            sceneReferences.forEach(img => inputImages.push({ base64: img.base64!, mimeType: img.mime! }));

            const measurementStr = (measurements.bust || measurements.waist || measurements.hips) 
                ? `Model Measurements: Bust ${measurements.bust || 'N/A'}, Waist ${measurements.waist || 'N/A'}, Hips ${measurements.hips || 'N/A'}.` 
                : "";

            const photoStrategy = `相机预设: ${cameraDevice} | 景别: ${shotType}`;
            const sceneStrategy = sceneReferences.length > 0 ? "根据参考图复刻背景场景" : (userPrompt || "摄影棚拍摄背景 (Studio lighting, minimal background)");

            const strategy = [
                `产品：${form.productName}`,
                `人群：${form.personaTemplate}`,
                `场景：${sceneStrategy}`,
                photoStrategy,
                actionReference ? `动作：复刻姿态参考图` : `动作：智能匹配姿态`,
                `画质：${QUALITY_BOOSTERS.EDITORIAL}`
            ].join(' | ');

            const basePrompt = enhancePrompt(userPrompt || `High-end fashion photography, ${form.personaTemplate} wearing ${form.productName}, studio background.`, 'PRODUCT');
            
            const platformPrompt = selectedPlatform ? PLATFORM_STYLES.find(p => p.id === selectedPlatform)?.prompt : "";

            const prompt = `
            # AGENT STRATEGY: ${strategy}
            # MISSION: Professional commercial product photography with MANDATORY PRODUCT CONSISTENCY.
            
            # CRITICAL REQUIREMENT: The FIRST IMAGE is the [PRODUCT ASSET]. You MUST preserve its structure, texture, cut, and pattern EXACTLY. Do NOT allow any stylistic drift. The product in the output must be 100% identical to the source product asset.
            
            ${platformPrompt ? `# PLATFORM VISUAL GENE: ${platformPrompt}` : ''}
            ${modelReference ? `# MODEL IDENTITY: REPLICATE the facial features and identity from the model reference image.` : ''}
            ${measurementStr ? `# BODY PROPORTIONS: ${measurementStr}` : ''}
            ${actionReference ? `# POSE: Replicate the human pose from the pose reference image while KEEPING the product structure locked.` : ''}
            ${sceneReferences.length > 0 ? `# SCENE: Replicate background and lighting from reference images.` : (selectedPlatform === 'amazon' ? '# SCENE: Pure white background (#FFFFFF), clean studio lighting, centered.' : '# SCENE: Professional studio or high-end lifestyle background, minimalist.')}
            
            # CAMERA: ${cameraDevice !== '智能推荐' ? cameraDevice : 'Professional high-end commercial camera'}
            # SHOT: ${shotType !== '智能推荐' ? shotType : 'Optimal commercial framing'}
            
            # DESCRIPTION: ${basePrompt}
            # FINAL OUTPUT: High-fidelity, commercial-grade asset with strict geometric locking for the product.
            `;

            const batchPromises = Array.from({ length: generateCount }, () => 
                generateImageToImage(inputImages, prompt, {
                    aspectRatio,
                    resolution,
                    modelId: selectedModel,
                    hasModelRef: !!modelReference,
                    workflowHint: actionReference ? 'pose-transfer' : (modelReference ? 'face-lock' : 'scene-product-lock')
                })
            );

            const batchResults = await Promise.all(batchPromises);
            setGeneratedImages(batchResults.flat());

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            clearInterval(stepInterval);
            setIsLoading(false);
            setProgress(100);
        }
    };

    const handleDownload = (img: string, idx: number) => {
        const link = document.createElement('a');
        link.href = img;
        link.download = `hero-${Date.now()}-${idx}.png`;
        link.click();
    };

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white custom-scrollbar">
            {/* Header */}
            <div className="text-center py-6 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-xs text-pastel-muted mb-2 shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-purple-500" />
                    AI Agent 服装主图专家
                </div>
                <h1 className="text-2xl font-bold text-pastel-text">智能主图生成 (Hero Image)</h1>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* LEFT COLUMN */}
                    <div className="space-y-4">
                        
                        {/* 1. Ratio */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Layout className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-bold text-pastel-text text-sm">画幅比例</h3>
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

                        {/* 1.1 Platform Styles */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Store className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-bold text-pastel-text text-sm">投放平台风格</h3>
                                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">适配各平台视觉基因</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {PLATFORM_STYLES.map((platform) => (
                                    <button 
                                        key={platform.id} 
                                        onClick={() => setSelectedPlatform(selectedPlatform === platform.id ? null : platform.id)} 
                                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${selectedPlatform === platform.id ? 'bg-orange-50 border-pastel-highlight ring-1 ring-orange-100' : 'bg-pastel-bg/30 border-pastel-border hover:border-orange-200'}`}
                                    >
                                        <span className="text-lg mb-1">{platform.icon}</span>
                                        <span className={`text-[10px] font-bold ${selectedPlatform === platform.id ? 'text-pastel-highlight' : 'text-pastel-text'}`}>{platform.label}</span>
                                        <span className="text-[8px] text-pastel-muted scale-90 whitespace-nowrap">{platform.desc.split(' / ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Product Assets */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="font-bold text-pastel-text text-sm">产品素材图</h3>
                                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1 animate-pulse">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    产品一致性已锁定
                                </span>
                            </div>
                            <div 
                                onClick={() => productInputRef.current?.click()} 
                                onMouseEnter={() => setHoveredSlot('product')} 
                                onMouseLeave={() => setHoveredSlot(null)}
                                onDragOver={(e) => handleDragOver(e, 'product')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'product')}
                                className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                                    isDragging === 'product' || hoveredSlot === 'product'
                                    ? 'border-pastel-highlight bg-pastel-bg/30' 
                                    : 'border-pastel-border'
                                }`}
                            >
                                <input ref={productInputRef} type="file" multiple className="hidden" onChange={handleProductUpload} accept="image/*" />
                                {productImages.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2">
                                        {productImages.map((img, idx) => (
                                            <div key={idx} className="relative group/item">
                                                <img src={img.preview} className="w-full h-20 object-cover rounded-lg border border-pastel-border" alt="product" />
                                                <button onClick={(e) => { e.stopPropagation(); setProductImages(prev => prev.filter((_, i) => i !== idx)); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                        {productImages.length < 4 && <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted"><Upload className="w-4 h-4" /></div>}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <Upload className="w-8 h-8 mx-auto mb-1 text-pastel-muted" />
                                        <p className="text-xs font-medium text-pastel-text">点击或拖拽产品图片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Specialized References (Pose & Scene) */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Pose */}
                            <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap className="w-4 h-4 text-purple-500" />
                                    <h3 className="font-bold text-pastel-text text-xs text-nowrap">动作参考图</h3>
                                </div>
                                <div 
                                    onClick={() => actionInputRef.current?.click()} 
                                    onMouseEnter={() => setHoveredSlot('action')} 
                                    onMouseLeave={() => setHoveredSlot(null)}
                                    onDragOver={(e) => handleDragOver(e, 'action')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 'action')}
                                    className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                                        isDragging === 'action' || hoveredSlot === 'action'
                                        ? 'border-purple-300 bg-purple-50/20' 
                                        : 'border-pastel-border'
                                    }`}
                                >
                                    <input ref={actionInputRef} type="file" className="hidden" onChange={handleActionUpload} accept="image/*" />
                                    {actionReference ? (
                                        <div className="relative group/action">
                                            <img src={actionReference.preview} className="w-full h-32 object-cover rounded-lg border-2 border-purple-200" alt="action" />
                                            <button onClick={(e) => { e.stopPropagation(); setActionReference(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Wand2 className="w-6 h-6 mx-auto mb-1 text-purple-300" />
                                            <p className="text-[10px] text-purple-600 font-medium">指定模特姿态</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Scene */}
                            <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sun className="w-4 h-4 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-xs text-nowrap">场景参考图</h3>
                                </div>
                                <div 
                                    onClick={() => sceneInputRef.current?.click()} 
                                    onMouseEnter={() => setHoveredSlot('scene')} 
                                    onMouseLeave={() => setHoveredSlot(null)}
                                    onDragOver={(e) => handleDragOver(e, 'scene')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 'scene')}
                                    className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                                        isDragging === 'scene' || hoveredSlot === 'scene'
                                        ? 'border-orange-300 bg-orange-50/20' 
                                        : 'border-pastel-border'
                                    }`}
                                >
                                    <input ref={sceneInputRef} type="file" multiple className="hidden" onChange={handleSceneUpload} accept="image/*" />
                                    {sceneReferences.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-1">
                                            {sceneReferences.map((img, idx) => (
                                                <div key={idx} className="relative group/scene">
                                                    <img src={img.preview} className="w-full h-12 object-cover rounded border border-orange-200" alt="scene" />
                                                    <button onClick={(e) => { e.stopPropagation(); setSceneReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2" /></button>
                                                </div>
                                            ))}
                                            {sceneReferences.length < 3 && <div className="w-full h-12 border border-dashed border-orange-200 rounded flex items-center justify-center"><Upload className="w-3 h-3 text-orange-300" /></div>}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-orange-300" />
                                            <p className="text-[10px] text-orange-600 font-medium">复刻背景与光影</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3.1 Model Identity Locking (Face & Body) */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="w-4 h-4 text-blue-500" />
                                    <h3 className="font-bold text-pastel-text text-sm">模特身份固定 (Face & Body)</h3>
                                </div>
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">固定长相与身材比例</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div 
                                    onClick={() => modelInputRef.current?.click()} 
                                    onMouseEnter={() => setHoveredSlot('model')} 
                                    onMouseLeave={() => setHoveredSlot(null)}
                                    onDragOver={(e) => handleDragOver(e, 'model')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 'model')}
                                    className={`relative col-span-1 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-all ${
                                        isDragging === 'model' || hoveredSlot === 'model'
                                        ? 'border-blue-300 bg-blue-50/20' 
                                        : 'border-pastel-border'
                                    }`}
                                >
                                    <input ref={modelInputRef} type="file" className="hidden" onChange={handleModelUpload} accept="image/*" />
                                    {modelReference ? (
                                        <div className="relative group/model">
                                            <img src={modelReference.preview} className="w-full h-24 object-cover rounded-lg border-2 border-blue-200" alt="model" />
                                            <button onClick={(e) => { e.stopPropagation(); setModelReference(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-2 h-2" /></button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-2">
                                            <UserCircle className="w-6 h-6 mx-auto mb-1 text-blue-300" />
                                            <p className="text-[9px] text-blue-600 font-medium">指定长相</p>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-2 grid grid-cols-1 gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-pastel-muted font-bold w-12">胸围</span>
                                        <input 
                                            type="text" 
                                            value={measurements.bust} 
                                            onChange={e => setMeasurements({...measurements, bust: e.target.value})}
                                            placeholder="如 88cm" 
                                            className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-[10px]" 
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-pastel-muted font-bold w-12">腰围</span>
                                        <input 
                                            type="text" 
                                            value={measurements.waist} 
                                            onChange={e => setMeasurements({...measurements, waist: e.target.value})}
                                            placeholder="如 60cm" 
                                            className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-[10px]" 
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-pastel-muted font-bold w-12">臀围</span>
                                        <input 
                                            type="text" 
                                            value={measurements.hips} 
                                            onChange={e => setMeasurements({...measurements, hips: e.target.value})}
                                            placeholder="如 90cm" 
                                            className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-[10px]" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. One-line Scene Hint */}
                        <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-semibold text-pastel-text text-sm">补充说明</h3>
                            </div>
                            <div className="flex gap-2">
                                <input value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="例如：在纽约时尚街头走秀..." className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                <button onClick={runAIAnalysis} disabled={isAnalyzing || productImages.length === 0} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:bg-gray-200 whitespace-nowrap">
                                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'AI 分析'}
                                </button>
                            </div>
                        </div>

                        {/* 5. Camera & Shot Type */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm space-y-6">
                            {/* Device Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Camera className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="font-bold text-pastel-text text-sm">设备预设 (Camera / Device)</h3>
                                    <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">影响质感色调</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {CAMERA_DEVICES.map(dev => (
                                        <button 
                                            key={dev.id}
                                            onClick={() => setCameraDevice(dev.id)}
                                            className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                                                cameraDevice === dev.id 
                                                ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-100' 
                                                : 'bg-white border-pastel-border hover:border-purple-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cameraDevice === dev.id ? 'text-purple-600' : 'text-pastel-muted'}>{dev.icon}</span>
                                                <span className={`text-[11px] font-bold ${cameraDevice === dev.id ? 'text-purple-700' : 'text-pastel-text'}`}>{dev.label}</span>
                                            </div>
                                            <span className="text-[9px] text-pastel-muted leading-tight">{dev.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Shot Type Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Maximize className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="font-bold text-pastel-text text-sm">画面景别 (Shot Type)</h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">影响构图远近</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SHOT_TYPES.map(type => (
                                        <button 
                                            key={type.id}
                                            onClick={() => setShotType(type.id)}
                                            className={`px-4 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                                                shotType === type.id 
                                                ? 'bg-blue-50 border-blue-400 text-blue-700 ring-1 ring-blue-100' 
                                                : 'bg-white border-pastel-border text-pastel-muted hover:border-blue-200'
                                            }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 6. Advanced Settings */}
                        <div className="bg-white rounded-2xl border border-pastel-border shadow-sm overflow-hidden">
                            <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between p-4 border-b border-pastel-border hover:bg-pastel-bg/30">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="font-bold text-pastel-text text-sm">高级参数与手动覆盖</h3>
                                </div>
                                {showAdvanced ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                            </button>

                            {showAdvanced && (
                                <div className="p-4 space-y-4">
                                    {/* Model Selector */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'nano-banana', name: 'Banana 2', desc: '3.1 Flash' },
                                            { id: 'nano-banana-pro', name: 'Banana Pro', desc: '3.0 Pro' },
                                            { id: 'gpt-image-2', name: 'GPT Image 2', desc: 'Ultra Quality' }
                                        ].map(m => (
                                            <button key={m.id} onClick={() => setSelectedModel(m.id)} className={`py-2 rounded-lg border text-center transition-all ${selectedModel === m.id ? 'bg-purple-50 border-purple-400 text-purple-700' : 'bg-white border-pastel-border text-pastel-muted text-[10px]'}`}>
                                                <div className="font-bold text-[11px]">{m.name}</div>
                                                <div className="opacity-60">{m.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                    {/* Form */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">产品名称</label><input value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">品类</label><input value={form.productCategory} onChange={e => setForm({...form, productCategory: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">人群</label><select value={form.personaTemplate} onChange={e => setForm({...form, personaTemplate: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs">{PERSONA_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">卖点</label><input value={form.sellingPoints} onChange={e => setForm({...form, sellingPoints: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">清晰度</label><select value={resolution} onChange={e => setResolution(e.target.value as ImageResolution)} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs"><option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option></select></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">批量</label><select value={generateCount} onChange={e => setGenerateCount(Number(e.target.value))} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs"><option value={1}>1张</option><option value={2}>2张</option><option value={4}>4张</option></select></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleGenerate} disabled={isLoading || productImages.length === 0} className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isLoading || productImages.length === 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01]'}`}>
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {isLoading ? 'Agent 正在绘制...' : '一键生成高品质主图'}
                        </button>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm flex-1 flex flex-col relative min-h-[500px]">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-5 h-5 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-lg">生成结果</h3>
                                </div>
                                {error && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium border border-red-100 animate-fade-in">
                                        <AlertCircle className="w-3 h-3" />
                                        {error}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 bg-pastel-bg/50 rounded-2xl border-2 border-dashed border-pastel-border flex flex-col relative overflow-hidden">
                                {isLoading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-10 bg-white/80 backdrop-blur-sm">
                                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-xl border animate-pulse">{COT_STEPS[currentStep].icon}</div>
                                        <div className="text-center">
                                            <h4 className="font-bold text-pastel-text">{COT_STEPS[currentStep].label}</h4>
                                            <p className="text-[10px] text-pastel-muted">{COT_STEPS[currentStep].desc}</p>
                                        </div>
                                        <div className="w-full max-w-xs bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                                    </div>
                                ) : generatedImages.length > 0 ? (
                                    <div className={`w-full h-full p-6 overflow-y-auto grid gap-6 content-start ${generatedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        {generatedImages.map((img, idx) => (
                                            <div key={idx} className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white bg-white">
                                                <div className="aspect-auto min-h-[200px] flex items-center justify-center">
                                                    <img src={img} className="w-full h-auto object-contain" alt="res" />
                                                </div>
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                                    <button onClick={() => setSelectedPreview(img)} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform"><ZoomIn className="w-6 h-6" /></button>
                                                    <button onClick={() => handleDownload(img, idx)} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform"><Download className="w-6 h-6" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-pastel-bg flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-pastel-border" />
                                        </div>
                                        <p className="text-sm text-pastel-muted max-w-[240px]">上传素材并设置参数，Agent 将为您创作商业级主图资产</p>
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

export default HeroImageTab;
