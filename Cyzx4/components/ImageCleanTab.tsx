import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
    Upload, X, Wand2, Sparkles, AlertCircle, Loader2, 
    Layout, Sun, Image as ImageIcon, CheckCircle2, 
    ChevronDown, Package, Store, Ruler, MessageSquare, 
    Zap, RefreshCw, ZoomIn, Download, Brain, Layers,
    Camera, UserCircle, Cpu, ChevronUp, Edit3, Settings,
    FileText, Smartphone, Film, Eye, Maximize, Scan, Target, ShoppingBag
} from 'lucide-react';
import { generateImageToImage, blobToBase64, compressImage, editGeneratedImage } from '../services/geminiService';
import { analyzeProductForScene, SceneAnalysisResult } from '../services/sceneAnalyzer';
import { generateContentWithAnalysisFallback, getErrorMessage, getAiClient, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { QUALITY_BOOSTERS, enhancePrompt } from '../services/promptUtils';
import { extractEdges } from '../utils/imageProcessor';
import { convertImageDataUrlsFormat, getImageDownloadExtension, OutputImageFormat } from '../utils/imageFormat';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { CLOTHING_POSES } from '../constants/clothingPresets';
import { MENS_SHIRT_POSES } from '../constants/mensShirtPosePresets';
import { MENS_KNIT_POSES } from '../constants/mensKnitPosePresets';
import { MENS_TEE_POSES } from '../constants/mensTeePosePresets';
import { SWIM_SHORTS_POSES } from '../constants/swimShortsPosePresets';
import { MENS_SHORTS_POSES } from '../constants/mensShortsPosePresets';
import { MENS_PANTS_POSES } from '../constants/mensPantsPosePresets';
import { LONG_DRESS_POSES } from '../constants/longDressPosePresets';
import { WOMENS_FASHION_POSES } from '../constants/womensFashionPosePresets';
import { SOLAVIBE_POSES } from '../constants/solavibePosePresets';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
    width?: number;
    height?: number;
}

interface ModelIdentityAnalysis {
    identitySignature?: string;
    faceLock?: string;
    hairLock?: string;
    bodyLock?: string;
    skinLock?: string;
    outfitLock?: string;
    bottomLock?: string;
    shoeLock?: string;
    forbiddenDrift?: string;
    promptBlock?: string;
}

interface AccessoryAnalysis {
    promptBlock?: string;
    itemChecklist?: string;
    placementRules?: string;
    forbiddenDrift?: string;
}

interface HeroFormState {
    productName: string;
    productCategory: string;
    sellingPoints: string;
    avoidElements: string;
    extraNotes: string;
    personaTemplate: string;
}

type AutoPoseLibrary = 'none' | 'mensShirt' | 'mensKnit' | 'mensTee' | 'mensShorts' | 'mensPants' | 'swimShorts' | 'longDress' | 'womensFashion' | 'solavibe';

interface AutoPoseAnalysis {
    productType: string;
    library: AutoPoseLibrary;
    libraryLabel: string;
    reason: string;
    confidence: string;
}

type ManualPoseLibrary = AutoPoseLibrary | 'sleepwear' | 'clothing';

interface ManualPoseOption {
    key: string;
    library: ManualPoseLibrary;
    libraryLabel: string;
    id: string;
    name: string;
    prompt: string;
}

const AUTO_POSE_LIBRARY_LABELS: Record<AutoPoseLibrary, string> = {
    none: '通用服装动作库 / 智能随机动作',
    mensShirt: '男士衬衫动作库',
    mensKnit: '男士针织/Polo动作库',
    mensTee: '男士T恤动作库',
    mensShorts: '男士短裤动作库',
    mensPants: '男士长裤动作库',
    swimShorts: '泳裤/沙滩裤动作库',
    longDress: '长裙/连衣裙动作库',
    womensFashion: '通用时尚女装动作库',
    solavibe: 'Solavibe 度假大码动作库',
};

const MANUAL_POSE_LIBRARY_LABELS: Record<ManualPoseLibrary, string> = {
    ...AUTO_POSE_LIBRARY_LABELS,
    sleepwear: '睡衣/居家动作库',
    clothing: '通用服装动作库',
};

const buildManualPoseOptions = (): ManualPoseOption[] => {
    const libraries: Array<{ library: ManualPoseLibrary; poses: Array<{ id: string; name: string; prompt: string }> }> = [
        { library: 'mensShirt', poses: MENS_SHIRT_POSES },
        { library: 'mensKnit', poses: MENS_KNIT_POSES },
        { library: 'mensTee', poses: MENS_TEE_POSES },
        { library: 'mensShorts', poses: MENS_SHORTS_POSES },
        { library: 'mensPants', poses: MENS_PANTS_POSES },
        { library: 'swimShorts', poses: SWIM_SHORTS_POSES },
        { library: 'longDress', poses: LONG_DRESS_POSES },
        { library: 'womensFashion', poses: WOMENS_FASHION_POSES },
        { library: 'solavibe', poses: SOLAVIBE_POSES },
        { library: 'sleepwear', poses: SLEEPWEAR_POSES },
        { library: 'clothing', poses: CLOTHING_POSES },
    ];

    return libraries.flatMap(({ library, poses }) =>
        poses.map((pose) => ({
            key: library + ':' + pose.id,
            library,
            libraryLabel: MANUAL_POSE_LIBRARY_LABELS[library],
            id: pose.id,
            name: pose.name,
            prompt: pose.prompt,
        }))
    );
};

const MANUAL_POSE_OPTIONS = buildManualPoseOptions();

const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = src;
    });
};

const getPoseReferenceFrameNote = (img?: UploadedImage, index?: number) => {
    if (!img?.width || !img?.height) {
        return `Action reference #${typeof index === 'number' ? index + 1 : ''}: match the reference image's visible person-to-frame proportion, crop boundary, camera distance, angle, and pose.`;
    }

    const ratio = img.width / img.height;
    const orientation = ratio > 1.15 ? 'landscape/wide' : ratio < 0.87 ? 'portrait/vertical' : 'square/near-square';
    const ratioText = `${img.width}:${img.height} (${ratio.toFixed(2)})`;
    return [
        `Action reference #${typeof index === 'number' ? index + 1 : ''} frame analysis: source frame is ${orientation}, ${ratioText}.`,
        'Transfer the visual framing logic, not the background: match the same camera angle, lens distance, subject placement, crop boundary, and visible body extent.',
        'Match the person-to-canvas occupancy from the reference as closely as possible: if the reference is chest-up, neck-to-chest, torso detail, waist-up, thigh-up, knee-up, or full-body, keep that same body scale and amount of empty space.',
        'If the reference is an extreme close-up or detail crop, preserve the close camera distance exactly: do not zoom out, do not reveal a complete face/head, do not add extra waist/legs, and keep the same cut-off boundaries.'
    ].join(' ');
};

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

const parseRatioValue = (ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    return w && h ? w / h : 1;
};

const getResolutionOutputLongSide = (resolution: ImageResolution) => {
    switch (resolution) {
        case ImageResolution.RES_4K:
            return 4096;
        case ImageResolution.RES_2K:
            return 2048;
        case ImageResolution.RES_1K:
        case ImageResolution.RES_05K:
        default:
            return 1024;
    }
};

const normalizeGeneratedImageToAspectRatio = (src: string, targetAspectRatio: AspectRatio, resolution: ImageResolution): Promise<string> => {
    if (!src.startsWith('data:image')) return Promise.resolve(src);

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const sourceWidth = img.naturalWidth || img.width;
            const sourceHeight = img.naturalHeight || img.height;
            if (!sourceWidth || !sourceHeight) {
                resolve(src);
                return;
            }

            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = sourceWidth;
            scanCanvas.height = sourceHeight;
            const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
            if (!scanCtx) {
                resolve(src);
                return;
            }

            scanCtx.drawImage(img, 0, 0, sourceWidth, sourceHeight);

            let bounds = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
            try {
                const data = scanCtx.getImageData(0, 0, sourceWidth, sourceHeight).data;
                const rowHits = new Uint16Array(sourceHeight);
                const colHits = new Uint16Array(sourceWidth);

                for (let y = 0; y < sourceHeight; y += 1) {
                    for (let x = 0; x < sourceWidth; x += 1) {
                        const idx = (y * sourceWidth + x) * 4;
                        const alpha = data[idx + 3];
                        const isBlank = alpha < 10 || (data[idx] > 248 && data[idx + 1] > 248 && data[idx + 2] > 248);
                        if (!isBlank) {
                            rowHits[y] += 1;
                            colHits[x] += 1;
                        }
                    }
                }

                const minRowHits = Math.max(2, Math.floor(sourceWidth * 0.01));
                const minColHits = Math.max(2, Math.floor(sourceHeight * 0.01));
                let top = 0;
                let bottom = sourceHeight - 1;
                let left = 0;
                let right = sourceWidth - 1;

                while (top < sourceHeight && rowHits[top] < minRowHits) top += 1;
                while (bottom > top && rowHits[bottom] < minRowHits) bottom -= 1;
                while (left < sourceWidth && colHits[left] < minColHits) left += 1;
                while (right > left && colHits[right] < minColHits) right -= 1;

                const detectedWidth = right - left + 1;
                const detectedHeight = bottom - top + 1;
                const detectedArea = detectedWidth * detectedHeight;
                const sourceArea = sourceWidth * sourceHeight;
                if (detectedArea > sourceArea * 0.12 && detectedWidth > 32 && detectedHeight > 32) {
                    const marginX = Math.round(detectedWidth * 0.045);
                    const marginY = Math.round(detectedHeight * 0.045);
                    const paddedLeft = Math.max(0, left - marginX);
                    const paddedTop = Math.max(0, top - marginY);
                    const paddedRight = Math.min(sourceWidth - 1, right + marginX);
                    const paddedBottom = Math.min(sourceHeight - 1, bottom + marginY);
                    bounds = {
                        x: paddedLeft,
                        y: paddedTop,
                        width: paddedRight - paddedLeft + 1,
                        height: paddedBottom - paddedTop + 1,
                    };
                }
            } catch {
                bounds = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
            }

            const targetRatio = parseRatioValue(targetAspectRatio);
            let cropX = bounds.x;
            let cropY = bounds.y;
            let cropWidth = bounds.width;
            let cropHeight = bounds.height;
            const cropRatio = cropWidth / cropHeight;

            if (cropRatio > targetRatio) {
                const adjustedWidth = cropHeight * targetRatio;
                cropX += (cropWidth - adjustedWidth) / 2;
                cropWidth = adjustedWidth;
            } else if (cropRatio < targetRatio) {
                const adjustedHeight = cropWidth / targetRatio;
                cropY += (cropHeight - adjustedHeight) / 2;
                cropHeight = adjustedHeight;
            }

            const maxOutputSide = getResolutionOutputLongSide(resolution);
            let outputWidth: number;
            let outputHeight: number;
            if (targetRatio >= 1) {
                outputWidth = maxOutputSide;
                outputHeight = Math.round(outputWidth / targetRatio);
            } else {
                outputHeight = maxOutputSide;
                outputWidth = Math.round(outputHeight * targetRatio);
            }

            const outCanvas = document.createElement('canvas');
            outCanvas.width = outputWidth;
            outCanvas.height = outputHeight;
            const outCtx = outCanvas.getContext('2d');
            if (!outCtx) {
                resolve(src);
                return;
            }

            outCtx.fillStyle = '#FFFFFF';
            outCtx.fillRect(0, 0, outputWidth, outputHeight);
            outCtx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
            resolve(outCanvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
};

const normalizeGeneratedImagesToAspectRatio = (images: string[], targetAspectRatio: AspectRatio, resolution: ImageResolution) => {
    return Promise.all(images.map((img) => normalizeGeneratedImageToAspectRatio(img, targetAspectRatio, resolution)));
};

const closestAspectRatioForImage = (image?: UploadedImage | null, fallback: AspectRatio = AspectRatio.PORTRAIT_3_4): AspectRatio => {
    if (!image?.width || !image?.height) return fallback;
    const sourceRatio = image.width / image.height;
    const supported = Object.values(AspectRatio);
    return supported.reduce((best, current) => {
        const bestDiff = Math.abs(parseRatioValue(best) - sourceRatio);
        const currentDiff = Math.abs(parseRatioValue(current) - sourceRatio);
        return currentDiff < bestDiff ? current : best;
    }, fallback);
};

const describeImageFraming = (image?: UploadedImage | null) => {
    if (!image?.width || !image?.height) return 'unknown source dimensions';
    const orientation = image.width > image.height ? 'landscape' : image.width < image.height ? 'portrait' : 'square';
    return `${image.width}x${image.height}px, ${orientation}, source ratio ${(image.width / image.height).toFixed(3)}. Inspect the actual visible body extent: it may be an extreme close-up/detail crop, neck-to-chest crop, chest-up crop, waist-up crop, or full-body crop, and the output must preserve that visible extent.`;
};

const sanitizeSwimShortsPosePrompt = (prompt: string) => {
    return prompt
        .replace(/\b(on|near|beside|along|at)\s+(the\s+)?(beach|shoreline|pool|ocean|sea|sand)\b/gi, '')
        .replace(/\b(beach|shoreline|pool|poolside|ocean|sea|sand|water|wave|waves|surfboard|background|scene|lifestyle)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+,/g, ',')
        .trim();
};

const PLATFORM_STYLES = [
    { id: 'amazon', label: 'Amazon', icon: '🅰️', desc: '纯白背景', prompt: 'Amazon professional main image, pure white background (#FFFFFF), high clarity, centered composition, clean edges, professional studio photography.' },
    { id: 'shein', label: 'SHEIN', icon: '👗', desc: '潮流街拍', prompt: 'SHEIN trendy lifestyle photography, bright natural lighting, youthful vibe, fashionable outdoor or minimalist indoor setting, high-end editorial.' },
    { id: 'temu', label: 'Temu', icon: '🧡', desc: '高饱和', prompt: 'Temu commercial style, high contrast, vibrant colors, sharp focus, attention-grabbing composition, clean modern commercial setting.' },
    { id: 'tmall', label: '天猫淘宝', icon: '🏬', desc: '高级质感', prompt: 'Tmall/Taobao premium luxury photography, sophisticated soft lighting, elegant composition, rich textures, high-end commercial studio aesthetic.' },
    { id: 'shopify', label: '独立站', icon: '🛒', desc: '品牌感', prompt: 'Minimalist brand photography for independent stores, artistic lighting, soft shadows, clean aesthetic, high-end lifestyle atmosphere.' }
];

const COT_STEPS = [
    { id: 1, label: "视觉语义解析", desc: "正在分析产品材质与剪裁特征...", icon: "🔎" },
    { id: 2, label: "AI Agent 策略制定", desc: "正在根据产品卖点规划生成策略...", icon: "🤖" },
    { id: 3, label: "构图与景别对齐", desc: "正在设置相机参数与景别...", icon: "📷" },
    { id: 4, label: "模特动作复刻", desc: "正在同步参考图中的姿态特征...", icon: "🧍" },
    { id: 5, label: "光影物理映射", desc: "正在计算环境光与织物反射...", icon: "💡" },
    { id: 6, label: "高保真渲染", desc: "正在生成高清纹理细节...", icon: "🖼️" },
    { id: 7, label: "商业级调色", desc: "正在注入电商高转化色彩基因...", icon: "🎨" },
];

const HeroImageTab: React.FC = () => {
    // Selection states
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [generateCount, setGenerateCount] = useState(1);
    const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('jpg');
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [isSafeMode, setIsSafeMode] = useState(false); // 动作安全模式
    const [isPoseOnly, setIsPoseOnly] = useState(true); // 仅参考姿态（默认开启，自动提取线稿以消除背景干扰）
    const [isSafeModeScene, setIsSafeModeScene] = useState(false); // 场景安全模式
    const [isSafeModeModel, setIsSafeModeModel] = useState(false); // 妯＄壒瀹夊叏妯″紡
    const [isFaceOnly, setIsFaceOnly] = useState(true); // 仅参考脸型
    const [isSceneOnly, setIsSceneOnly] = useState(true); // 仅参考场景
    const [isPurifyingScene, setIsPurifyingScene] = useState(false); // 正在自动净化场景图
    const [isPurifyingProduct, setIsPurifyingProduct] = useState(false); // 正在自动净化产品素材图
    const [isProductPurifyEnabled, setIsProductPurifyEnabled] = useState(true); // 是否开启产品图 AI 去噪净化
    const [isScenePurifyEnabled, setIsScenePurifyEnabled] = useState(true); // 是否开启场景图 AI 去人净化
    const [showModelGuideModal, setShowModelGuideModal] = useState(false); // 控制 AI 模特规则上传指南弹窗的显示
    const [isAnalyzingModelIdentity, setIsAnalyzingModelIdentity] = useState(false);
    const [modelIdentityAnalysis, setModelIdentityAnalysis] = useState<ModelIdentityAnalysis | null>(null);
    
    // Photo controls
    const [cameraDevice, setCameraDevice] = useState('智能推荐');
    const [shotType, setShotType] = useState('智能推荐');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    
    // Image states
    const [productImages, setProductImages] = useState<UploadedImage[]>([]);
    const [actionReferences, setActionReferences] = useState<UploadedImage[]>([]);
    const [autoPoseLibrary, setAutoPoseLibrary] = useState<AutoPoseLibrary>('none');
    const [autoPoseAnalysis, setAutoPoseAnalysis] = useState<AutoPoseAnalysis | null>(null);
    const [isAnalyzingPoseLibrary, setIsAnalyzingPoseLibrary] = useState(false);
    const [isPoseAutoDetectEnabled, setIsPoseAutoDetectEnabled] = useState(true);
    const [manualPoseLibraryFilter, setManualPoseLibraryFilter] = useState<ManualPoseLibrary | 'auto' | 'all'>('auto');
    const [manualPoseSearch, setManualPoseSearch] = useState('');
    const [selectedManualPoseKey, setSelectedManualPoseKey] = useState<string | null>(null);
    const [sceneReferences, setSceneReferences] = useState<UploadedImage[]>([]);
    const [accessoryReferences, setAccessoryReferences] = useState<UploadedImage[]>([]);
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
    const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);
    const {
        cancelMessage,
        startGenerationTask,
        cancelGenerationTask,
        isCurrentGenerationTask,
        assertCurrentGenerationTask,
        finishGenerationTask,
    } = useCancelableGeneration();
    
    // Refs
    const productInputRef = useRef<HTMLInputElement>(null);
    const actionInputRef = useRef<HTMLInputElement>(null);
    const sceneInputRef = useRef<HTMLInputElement>(null);
    const accessoryInputRef = useRef<HTMLInputElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const [hoveredSlot, setHoveredSlot] = useState<'product' | 'action' | 'scene' | 'accessory' | 'model' | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);

    const selectedManualPose = useMemo(
        () => MANUAL_POSE_OPTIONS.find((pose) => pose.key === selectedManualPoseKey) || null,
        [selectedManualPoseKey]
    );

    const visibleManualPoseOptions = useMemo(() => {
        const detectedLibrary: ManualPoseLibrary = autoPoseLibrary !== 'none' ? autoPoseLibrary : 'clothing';
        const activeFilter = manualPoseLibraryFilter === 'auto' ? detectedLibrary : manualPoseLibraryFilter;
        const keyword = manualPoseSearch.trim().toLowerCase();

        return MANUAL_POSE_OPTIONS.filter((pose) => {
            const matchesLibrary = activeFilter === 'all' || pose.library === activeFilter;
            const matchesKeyword = !keyword
                || pose.name.toLowerCase().includes(keyword)
                || pose.id.toLowerCase().includes(keyword)
                || pose.libraryLabel.toLowerCase().includes(keyword)
                || pose.prompt.toLowerCase().includes(keyword);
            return matchesLibrary && matchesKeyword;
        });
    }, [autoPoseLibrary, manualPoseLibraryFilter, manualPoseSearch]);

    // Image processing
    const processFiles = async (files: File[]) => {
        const results: UploadedImage[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            // 浣跨敤鍘嬬缉閫昏緫鍑忓皬璐熻浇锛岄伩鍏?4K/2K 瓒呮椂
            const { base64, mime } = await compressImage(file, 2048, 0.9);
            const preview = URL.createObjectURL(file);
            const { width, height } = await getImageDimensions(preview);
            results.push({
                file,
                preview,
                base64: base64,
                mime: mime,
                width,
                height
            });
        }
        return results;
    };

    const detectAutoPoseLibrary = async (images: UploadedImage[]) => {
        if (images.length === 0) {
            setAutoPoseLibrary('none');
            setAutoPoseAnalysis(null);
            return;
        }

        const normalizeLibrary = (value: string): AutoPoseLibrary => {
            const normalized = value.trim().toLowerCase();
            if (normalized.includes('solavibe') || normalized.includes('plus size') || normalized.includes('plussize') || normalized.includes('boho') || normalized.includes('vacation') || normalized.includes('resort dress') || normalized.includes('resort wear') || normalized.includes('resort set') || normalized.includes('relaxed comfort')) return 'solavibe';
            if (normalized.includes('longdress') || normalized.includes('long dress') || normalized.includes('maxi') || normalized.includes('ankle') || normalized.includes('floor') || normalized.includes('gown')) return 'longDress';
            if (normalized.includes('womensfashion') || normalized.includes('women') || normalized.includes('female') || normalized.includes('womenswear') || normalized.includes('fashion')) return 'womensFashion';
            if (normalized.includes('swim') || normalized.includes('boardshort') || normalized.includes('board short') || normalized.includes('trunk')) return 'swimShorts';
            if (normalized.includes('mensshorts') || normalized.includes('men shorts') || normalized.includes("men's shorts") || normalized.includes('casual shorts') || normalized.includes('shorts')) return 'mensShorts';
            if (normalized.includes('menspants') || normalized.includes('men pants') || normalized.includes("men's pants") || normalized.includes('trousers') || normalized.includes('pants') || normalized.includes('jeans')) return 'mensPants';
            if (normalized.includes('tee') || normalized.includes('tshirt') || normalized.includes('t-shirt')) return 'mensTee';
            if (normalized.includes('knit') || normalized.includes('polo')) return 'mensKnit';
            if (normalized.includes('shirt')) return 'mensShirt';
            return 'none';
        };

        setIsAnalyzingPoseLibrary(true);
        try {
            const ai = getAiClient();
            const parts: any[] = images.slice(0, 2).map(img => ({
                inlineData: { mimeType: img.mime!, data: img.base64! }
            }));
            parts.push({
                text: `Classify these uploaded product images for an ecommerce apparel pose library.
Return ONLY valid JSON: {"productType":"short precise product category","library":"mensShirt|mensKnit|mensTee|mensShorts|mensPants|swimShorts|longDress|womensFashion|solavibe|none","confidence":"high|medium|low","reason":"short reason"}.

Choose:
- solavibe: plus-size women's vacation/resort/boho/relaxed comfort apparel, including loose shirts, vacation dresses, relaxed two-piece sets, wide-leg pants, resort dresses, plus-size collections, warm approachable SHEIN Solavibe-style products.
- longDress: women's long dress, maxi dress, ankle-length dress, floor-length dress, long skirt dress, evening dress, long slip dress, long sundress, gown-like dress.
- womensFashion: generic women's fashion apparel that is not covered by the targeted libraries above, such as women's blouse, short dress, mini/midi dress, skirt, pants, jeans, blazer, coat, jacket, cardigan, vest, top, bodysuit, matching set, suit set, or uncertain womenswear.
- mensShirt: men's woven button shirt, resort shirt, linen shirt, Hawaiian shirt, button-up shirt.
- mensKnit: men's knit polo, textured knit polo, knitted top, sweater-like short sleeve, ribbed knit menswear.
- mensTee: men's T-shirt, oversized tee, graphic tee, cotton short-sleeve tee.
- mensShorts: men's regular casual shorts, chino shorts, cargo shorts, denim shorts, athletic shorts, streetwear shorts, drawstring lounge shorts. This is NOT swimwear.
- mensPants: men's regular long pants, trousers, jeans, cargo pants, chino pants, linen pants, dress pants, joggers, sweatpants, streetwear pants.
- swimShorts: men's swim shorts, swim trunks, board shorts, beach shorts, quick-dry swimwear shorts, bathing trunks, swimwear bottom with drawstring or liner.
- none: not one of the above or uncertain.

Priority rules:
- If the product or user note suggests Solavibe, plus size, vacation, boho, resort, relaxed comfort, loose resort shirt, vacation dress, relaxed two-piece set, wide-leg vacation pants, or approachable plus-size womenswear, choose solavibe before longDress or womensFashion.
- If the product is women's apparel but not clearly longDress, choose womensFashion.
- If the garment is a short dress, mini dress, midi dress, skirt, blouse, blazer, jacket, coat, pants, jeans, cardigan, vest, top, or set, choose womensFashion.
- If the product is regular men's shorts and not swimwear, choose mensShorts.
- If the product is men's long pants, trousers, cargo pants, jeans, chino pants, linen pants, joggers, or sweatpants, choose mensPants.
- Choose swimShorts only when the garment is explicitly swim trunks, board shorts, swim shorts, bathing trunks, beach shorts, or swimwear.
- Use none only when it is not apparel or the apparel gender/category is genuinely unclear.
Use visual garment structure first. User note: ${userPrompt || 'none'}`
            });

            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: { parts }
            }, { timeoutMs: 30000, fallbackTimeoutMs: 45000 });
            const text = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(text);
            const library = normalizeLibrary(parsed.library || 'none');
            setAutoPoseLibrary(library);
            setAutoPoseAnalysis({
                productType: parsed.productType || '未明确识别，按通用服装处理',
                library,
                libraryLabel: AUTO_POSE_LIBRARY_LABELS[library],
                confidence: parsed.confidence || 'medium',
                reason: parsed.reason || '根据产品图结构和用户备注自动匹配',
            });
        } catch (err) {
            console.warn('Auto pose library detection failed, using no built-in library.', err);
            setAutoPoseLibrary('none');
            setAutoPoseAnalysis({
                productType: '识别失败，按通用服装处理',
                library: 'none',
                libraryLabel: AUTO_POSE_LIBRARY_LABELS.none,
                confidence: 'low',
                reason: '产品分类服务未返回可用结果，生成时仍会使用通用服装动作与补充描述。',
            });
        } finally {
            setIsAnalyzingPoseLibrary(false);
        }
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        setSelectedManualPoseKey(null);
        setManualPoseLibraryFilter(isPoseAutoDetectEnabled ? 'auto' : 'all');

        const updatePoseDetection = (images: UploadedImage[]) => {
            if (isPoseAutoDetectEnabled) {
                void detectAutoPoseLibrary(images);
            } else {
                setAutoPoseLibrary('none');
                setAutoPoseAnalysis(null);
            }
        };
        
        if (isProductPurifyEnabled && processed.length > 0) {
            setIsPurifyingProduct(true);
            setError(null);
            try {
                const purified = await Promise.all(processed.map(async (img) => {
                    // 1. 快速检测产品图背景中是否包含衣架、画框、挂钩等干扰
                    const ai = getAiClient();
                    const checkPrompt = "Analyze this product photo. Does the background contain any distracting items such as clothes hangers, hooks, picture frames on the wall, stands, furniture, or complex messy background? Respond with ONLY 'yes' or 'no' in lowercase.";
                    const response = await generateContentWithAnalysisFallback(ai, {
                        model: 'gemini-3.1-flash-lite-preview',
                        contents: {
                            parts: [
                                { inlineData: { mimeType: img.mime!, data: img.base64! } },
                                { text: checkPrompt }
                            ]
                        }
                    });
                    const answer = (response.text || '').trim().toLowerCase();
                    
                    if (answer.includes('yes')) {
                        console.log("[Product Purify] Distractions detected in product image. Purifying product background...");
                        // 2. 调用 editGeneratedImage 擦除衣服以外的背景、衣架和画框
                        const editPrompt = "Selectively remove all background noise, hangers, wall hooks, wall frames, art frames, picture borders, stands, and messy environment shadows. Do not touch or modify the clothing garment product itself. Replace the background with a completely solid, clean, seamless studio light gray or white background. Keep the exact fabric texture, print pattern, and shape of the clothing perfectly.";
                        const results = await editGeneratedImage(img.base64!, img.mime!, editPrompt, [], { aspectRatio: AspectRatio.SQUARE });
                        if (results && results.length > 0) {
                            const cleanBase64Data = results[0];
                            const parts = cleanBase64Data.split(',');
                            const cleanBase64 = parts[1];
                            const cleanMime = parts[0].split(':')[1].split(';')[0];
                            return {
                                ...img,
                                preview: cleanBase64Data,
                                base64: cleanBase64,
                                mime: cleanMime
                            };
                        }
                    }
                    return img;
                }));
                setProductImages(prev => [...prev, ...purified].slice(0, 4));
                updatePoseDetection(purified);
            } catch (err) {
                console.error("Purify product image failed:", err);
                // 降级回退到原始图片
                setProductImages(prev => [...prev, ...processed].slice(0, 4));
                updatePoseDetection(processed);
            } finally {
                setIsPurifyingProduct(false);
            }
        } else {
            setProductImages(prev => [...prev, ...processed].slice(0, 4));
            updatePoseDetection(processed);
        }
        setError(null);
    };

    const handleActionUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        setActionReferences(prev => [...prev, ...processed].slice(0, 10));
        setError(null);
    };

    const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);

        if (!isScenePurifyEnabled) {
            setSceneReferences(prev => [...prev, ...processed].slice(0, 3));
            setError(null);
            return;
        }
        
        setIsPurifyingScene(true);
        setError(null);
        try {
            const purified = await Promise.all(processed.map(async (img) => {
                // 1. 快速检测图片中是否包含人物
                const ai = getAiClient();
                const checkPrompt = "Analyze this image. Does it contain any humans, models, people, or persons? Respond with ONLY 'yes' or 'no' in lowercase.";
                const response = await generateContentWithAnalysisFallback(ai, {
                    model: 'gemini-3.1-flash-lite-preview',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: img.mime!, data: img.base64! } },
                            { text: checkPrompt }
                        ]
                    }
                });
                const answer = (response.text || '').trim().toLowerCase();
                
                if (answer.includes('yes')) {
                    console.log("[Scene Purify] Person detected in scene reference. Purifying background...");
                    // 2. 调用 editGeneratedImage 去除人物主体，净化背景
                    const editPrompt = "Remove all people, persons, models, and humans from the image, and naturally fill in and inpaint the background details behind them to create a clean, empty room/space scene. Keep all other furniture, lighting, walls, windows, and architectural elements exactly identical.";
                    const results = await editGeneratedImage(img.base64!, img.mime!, editPrompt, [], { aspectRatio: AspectRatio.SQUARE });
                    if (results && results.length > 0) {
                        const cleanBase64Data = results[0];
                        const parts = cleanBase64Data.split(',');
                        const cleanBase64 = parts[1];
                        const cleanMime = parts[0].split(':')[1].split(';')[0];
                        return {
                            ...img,
                            preview: cleanBase64Data,
                            base64: cleanBase64,
                            mime: cleanMime
                        };
                    }
                }
                return img;
            }));
            setSceneReferences(prev => [...prev, ...purified].slice(0, 3));
        } catch (err) {
            console.error("Purify scene image failed:", err);
            // 回退到原始图片
            setSceneReferences(prev => [...prev, ...processed].slice(0, 3));
        } finally {
            setIsPurifyingScene(false);
        }
        setError(null);
    };

    const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        if (processed.length > 0) {
            setModelReference(processed[0]);
            setModelIdentityAnalysis(null);
            await analyzeModelIdentityReference(processed[0], true);
        }
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

    const handleDrop = async (e: React.DragEvent, slot: 'product' | 'action' | 'scene' | 'accessory' | 'model') => {
        e.preventDefault();
        setIsDragging(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        if (slot === 'product') handleProductUpload(files);
        else if (slot === 'action') handleActionUpload(files);
        else if (slot === 'scene') handleSceneUpload(files);
        else if (slot === 'accessory') handleAccessoryUpload(files);
        else if (slot === 'model') handleModelUpload(files);
    };

    // Paste handler
    useImagePaste(async (files) => {
        if (files.length === 0) return;
        if (hoveredSlot === 'action') handleActionUpload(files);
        else if (hoveredSlot === 'scene') handleSceneUpload(files);
        else if (hoveredSlot === 'accessory') handleAccessoryUpload(files);
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
                personaTemplate: result.modelPersonaPreset || 'US urban woman'
            });
        } catch (err) {
            setError("AI 分析失败");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const analyzeHeroStylingPlan = async (images: UploadedImage[]): Promise<string> => {
        const fallback = [
            '# UNIFIED STYLING PLAN:',
            '- If the product image does not show pants, use one consistent clean light-wash straight-leg denim jean style across every generated image.',
            '- If shoes are visible, use one consistent minimal neutral shoe style across every generated image.',
            '- Do not add bags, purses, hats, scarves, jewelry, handheld props, or extra accessories unless the user uploaded accessory reference images.',
            '- Accessory batch lock: the same visible accessory set must be used across the whole batch. Do not randomly swap necklaces, watches, sunglasses, hats, bracelets, bags, belts, or handheld props between outputs.',
            '- Never replace, redesign, recolor, simplify, or reinterpret the product garment from Image 1.'
        ].join('\n');
        try {
            const ai = getAiClient();
            const parts: any[] = images.map(img => ({
                inlineData: { mimeType: img.mime!, data: img.base64! }
            }));
            parts.push({ text: `Analyze these product asset images for an ecommerce fashion hero-image workflow.
Return ONLY valid JSON with these string fields:
{
  "productGarment": "precise garment type, color, fabric, construction, trims, neckline, sleeve/strap details, hem, buttons, ruffles, patterns",
  "productFidelityChecklist": "short checklist of product details that must never change",
  "autoStylingRationale": "explain what supporting styling is necessary for a complete believable fashion photo, based on the product, platform, persona, and user note",
  "needsBottom": "yes/no and why",
  "unifiedBottom": "one consistent pants/skirt/shorts recommendation if missing from product asset; include color, fit, rise, fabric, and why it matches",
  "unifiedShoes": "one consistent shoe recommendation if feet may be visible",
  "unifiedBag": "one consistent bag recommendation; use none if it would distract",
  "unifiedJewelry": "one consistent minimal jewelry/accessory recommendation",
  "unifiedOtherAccessories": "one consistent hat/sunglasses/belt/scarf/watch/prop recommendation, or none",
  "avoidStyling": "styling details to avoid because they conflict with the product"
}
Rules:
- If pants/bottoms are not clearly part of the product asset and the product is upper-body only, recommend ONE unified bottom to use across ALL generated outputs. If the product is a long dress, one-piece dress, jumpsuit, pajama set, suit set, or full outfit, set unifiedBottom to "none; product already covers this area".
- If shoes may be visible, recommend ONE realistic unified shoe style that matches the product and platform, unless the user explicitly requested barefoot/no shoes.
- If bags, belts, jewelry, watches, sunglasses, hats, bracelets, scarves, or props are not in the product asset, decide whether they are commercially necessary. Use "none" for any category that would distract. If needed, choose ONE minimal compatible item per category and keep it realistic.
- If accessory references are provided, describe one fixed accessory set from those references for the whole batch. Do not invent per-image accessory variations.
- If the user note explicitly requests a styling item, obey it and make it part of the unified batch styling contract.
- The product garment itself is highest priority and must remain identical to the reference.
- Recommendations must be practical SHEIN/Amazon ecommerce styling, not editorial fantasy. Prefer clean complete outfits: no random extra jewelry, no changing bags, no changing shoes, no changing pants between images.
User note: ${userPrompt || 'none'}` });
            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: { parts }
            });
            const text = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(text);
            return [
                '# UNIFIED STYLING PLAN (AGENT ANALYZED - APPLY TO EVERY OUTPUT):',
                `- Product garment identity: ${parsed.productGarment || 'use Image 1 as the exact product source of truth'}`,
                `- Product fidelity checklist: ${parsed.productFidelityChecklist || 'preserve exact structure, fabric, trims, color, seams, buttons, ruffles, prints, and silhouette'}`,
                `- Auto styling rationale: ${parsed.autoStylingRationale || 'build one realistic complete outfit only where the product photo leaves required styling areas unspecified'}`,
                `- Bottom coverage need: ${parsed.needsBottom || 'infer from product image'}`,
                `- Unified bottom/pants for ALL images: ${parsed.unifiedBottom || 'one consistent neutral bottom only if the product is upper-body-only; otherwise none if the product covers the lower body'}`,
                `- Unified shoes for ALL images: ${parsed.unifiedShoes || 'minimal neutral shoes only when visible'}`,
                `- Unified bag for ALL images: ${accessoryReferences.length > 0 ? (parsed.unifiedBag || 'follow uploaded accessory reference images exactly') : (parsed.unifiedBag || 'none unless the user explicitly requested a bag or the outfit genuinely needs one')}`,
                `- Unified jewelry/accessories for ALL images: ${accessoryReferences.length > 0 ? (parsed.unifiedJewelry || 'follow uploaded accessory reference images exactly') : (parsed.unifiedJewelry || 'none or one minimal compatible jewelry set only if commercially appropriate')}`,
                `- Unified other accessories for ALL images: ${accessoryReferences.length > 0 ? (parsed.unifiedOtherAccessories || 'follow uploaded accessory reference images exactly') : (parsed.unifiedOtherAccessories || 'none unless explicitly requested or necessary for the selected styling')}`,
                `- Avoid styling: ${parsed.avoidStyling || 'avoid changing the product garment or adding distracting accessories'}`,
                '- CONSISTENCY RULE: pants, shoes, bags, belts, jewelry, watches, sunglasses, hats, bracelets, handheld props, and every visible accessory must stay the same style/color/material across every image in this batch unless they are physically hidden by the crop.',
                accessoryReferences.length > 0 ? '- UPLOADED STYLING REFERENCES OVERRIDE AUTO-STYLING: bottoms/pants, shoes, bags, jewelry, belts, sunglasses, hats, scarves, bracelets, watches, and props visible in uploaded styling references must override any AI-recommended automatic styling item in the same category.' : '',
                '- AUTO-STYLING LOCK: if the user did not upload accessory references, use the analyzed unified styling above as the only allowed generated outfit support. Do not improvise a new bag, shoe, pant, necklace, ring, belt, sunglasses, hat, watch, bracelet, scarf, or prop in later outputs.',
                '- ACCESSORY NO-RANDOMIZATION RULE: do not create a different necklace/watch/sunglasses/hat/bag/bracelet/shoe/pant combination for different outputs. Use the single unified styling set above, or no accessories.'
            ].filter(Boolean).join('\n');
        } catch (err) {
            console.warn('Hero styling plan analysis failed, using fallback.', err);
            return fallback;
        }
    };

    const analyzeAccessoryReferences = async (images: UploadedImage[]): Promise<AccessoryAnalysis | null> => {
        if (images.length === 0) return null;

        try {
            const ai = getAiClient();
            const parts: any[] = images.map((img, index) => ({
                inlineData: { mimeType: img.mime!, data: img.base64! }
            }));
            parts.push({
                text: `Analyze these uploaded accessory / outfit styling reference images for a fashion hero-image workflow.
Return ONLY valid JSON with these exact string fields:
{
  "itemChecklist": "numbered inventory of every visible styling item across all images: bottoms/pants/skirt/shorts, shoes, bag, jewelry, earrings, bracelet, watch, necklace, belt, hat, sunglasses, scarf, handheld prop; include category, color, material, shape, size, hardware, strap/handle, texture, pattern, and distinctive details",
  "placementRules": "how each styling item must be worn, held, placed, layered, scaled, and occluded on the model; include left/right hand or body placement when visible",
  "forbiddenDrift": "short comma-separated list of styling mistakes to forbid",
  "promptBlock": "strong English generation prompt block that requires exact outfit styling item identity preservation and forbids invented replacement accessories or bottoms"
}
Rules:
- Treat each uploaded image as an authorized concrete styling source, not generic style inspiration.
- A single uploaded flat-lay image may contain multiple separate items. Split that one image into a numbered per-item inventory and preserve every visible item unless the crop naturally hides it.
- If an image shows pants, jeans, shorts, skirt, shoes, bag, jewelry, earrings, bracelet, watch, necklace, belt, hat, sunglasses, scarf, or handheld prop, describe it as a concrete item that must be reproduced whenever visible.
- Preserve count, material, color, scale, closure/hardware, strap/handle direction, texture, silhouette, and wearing/carrying logic.
- Do not invent alternate accessories, bottoms, shoes, or styling items, and do not change the styling set between outputs.
- If a styling item would be hidden by the crop or pose, it may be naturally hidden, but any visible styling item must match the references exactly.`
            });
            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: { parts }
            }, { timeoutMs: 30000, fallbackTimeoutMs: 45000 });
            const raw = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            return JSON.parse(raw) as AccessoryAnalysis;
        } catch (err) {
            console.warn('Accessory reference analysis failed, using direct image-only lock.', err);
            return {
                itemChecklist: 'Use every uploaded accessory / outfit styling reference as a concrete source of truth, including any visible bottoms, shoes, bags, jewelry, belts, hats, sunglasses, scarves, bracelets, watches, and handheld props.',
                placementRules: 'Reproduce each visible styling item with the same item identity, scale, material, color, and wearing/carrying logic whenever visible.',
                forbiddenDrift: 'invented accessories, invented bottoms, changed pants, changed bag, changed shoes, changed jewelry, changed color, changed material',
                promptBlock: 'ACCESSORY / OUTFIT STYLING LOCK: Use the uploaded styling images as exact item identity references, not mood boards. Do not invent or substitute accessories, bottoms, shoes, or props.'
            };
        }
    };

    const analyzeModelIdentityReference = async (
        image: UploadedImage | null = modelReference,
        updateUi: boolean = true
    ): Promise<ModelIdentityAnalysis | null> => {
        if (!image?.base64 || !image?.mime) {
            if (updateUi) setError('请先上传模特身份参考图');
            return null;
        }

        if (updateUi) {
            setIsAnalyzingModelIdentity(true);
            setError(null);
        }

        try {
            const ai = getAiClient();
            const analysisModeInstruction = isFaceOnly
                ? `FACE-ONLY MODE IS ENABLED.
- Analyze ONLY the model's face/head identity needed for face consistency.
- Fill outfitLock, bottomLock, shoeLock, and bodyLock with "ignored because face-only mode is enabled".
- The promptBlock MUST explicitly say: preserve only the face identity from the model reference; ignore the model reference clothing, pants, jeans, shoes, body pose, body shape, and accessories.`
                : `FULL MODEL + WARDROBE MODE IS ENABLED.
- Analyze the model's face, hair, body proportions, and the complete visible outfit/styling.
- The model reference outfit pieces that do not conflict with the product asset MUST remain consistent.
- If jeans/pants are visible, describe them very precisely and lock them across every output.`;
            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: {
                    parts: [
                        { inlineData: { mimeType: image.mime, data: image.base64 } },
                        {
                            text: `Analyze this image as the SINGLE FIXED MODEL IDENTITY REFERENCE for a fashion ecommerce image-generation workflow.

${analysisModeInstruction}

Return ONLY valid JSON with these exact string fields:
{
  "identitySignature": "one concise unique identity description: apparent age range, gender presentation, face shape, expression, overall model vibe",
  "faceLock": "precise face features to preserve: face shape, eyes, eyebrows, nose, lips, jaw/chin, expression. Do not identify the person by name.",
  "hairLock": "hair color, length, parting, texture, styling, volume, hairline/visible shape",
  "bodyLock": "visible body proportions/build/posture traits that should stay consistent",
  "skinLock": "skin tone and natural complexion details to preserve without over-smoothing",
  "outfitLock": "all visible clothing and styling items in the model reference that do NOT conflict with the product asset and should remain consistent",
  "bottomLock": "precise pants/jeans/skirt/shorts description if visible; if blue jeans are visible, describe wash, rise, fit, leg shape, and color",
  "shoeLock": "shoe description if visible; otherwise say not visible",
  "forbiddenDrift": "short comma-separated list of identity/outfit changes to forbid",
  "promptBlock": "a strong English prompt block for generation. It MUST lock face, hair, skin tone, and body identity. It may describe visible wardrobe only as low-priority styling context, and MUST state that product garments from Image 1 override model-reference clothing wherever they occupy the same garment area."
}

Rules:
- Model identity references are NEVER scene references. Ignore and forbid their background, wall, floor, sea, sky, street, furniture, props, shadows, lighting direction, color temperature, camera crop, lens distance, and environment mood.
- In FACE-ONLY MODE, the model reference controls only face/head identity. Do NOT use its body shape, clothing, jeans/pants, shoes, accessories, or styling as generation constraints.
- In FULL MODEL + WARDROBE MODE, the model reference controls identity, hair, skin tone, and body proportions. Product assets control all product garment areas. If the product asset includes a matching bottom, shorts, pants, skirt, set, suit, pajama set, or coordinated outfit, that product bottom MUST replace the model reference bottom. Do not preserve jeans/pants/shorts from the model reference when they conflict with the product asset.
- Never instruct generation to layer the model's original pants under or over product shorts/pants. Avoid duplicate waistbands, duplicate hems, double drawstrings, and mixed original-model bottom + product bottom artifacts.
- If the model image is cropped, still analyze all visible identity and wardrobe cues.
- Do not mention uncertainty unless an item is truly not visible.`
                        }
                    ]
                }
            });

            const raw = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(raw) as ModelIdentityAnalysis;
            const normalized: ModelIdentityAnalysis = {
                ...parsed,
                promptBlock: parsed.promptBlock || (isFaceOnly
                    ? 'FACE-ONLY MODEL LOCK: Preserve only the same face/head identity from the model reference. Ignore model-reference clothing, jeans/pants, shoes, accessories, pose, and body styling.'
                    : [
                        'MODEL IDENTITY LOCK: Preserve the same face, hair, skin tone, body proportions, and person identity from the model reference.',
                        'MODEL BACKGROUND BAN: Never copy or infer the model reference background, walls, floor, sea, sky, street, architecture, props, shadows, lighting direction, color temperature, camera crop, lens distance, or scene mood.',
                        parsed.outfitLock ? `LOW-PRIORITY MODEL WARDROBE OBSERVATION: ${parsed.outfitLock}` : '',
                        parsed.bottomLock ? `LOW-PRIORITY MODEL BOTTOM OBSERVATION: ${parsed.bottomLock}` : '',
                        'PRODUCT GARMENT OVERRIDE: Product asset garments override model-reference clothing in any overlapping garment area. If the product asset includes shorts, pants, skirt, or a matching set bottom, replace the model reference bottom completely and do not layer or mix both bottoms.'
                    ].filter(Boolean).join('\n'))
            };

            if (updateUi) setModelIdentityAnalysis(normalized);
            return normalized;
        } catch (err) {
            console.error('Model identity analysis failed:', err);
            if (updateUi) setError('模特身份解析失败，请检查图片后重试');
            return null;
        } finally {
            if (updateUi) setIsAnalyzingModelIdentity(false);
        }
    };

    const handleAccessoryUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        setAccessoryReferences(prev => [...prev, ...processed].slice(0, 10));
        setError(null);
    };

    const handleGenerate = async (regenerateIndex?: number) => {
        if (productImages.length === 0) {
            setError('请上传产品图素材');
            return;
        }

        const isSingleRegenerate = typeof regenerateIndex === 'number';
        const { taskId, signal } = startGenerationTask();

        if (isSingleRegenerate) {
            setRegeneratingIndices(prev => prev.includes(regenerateIndex) ? prev : [...prev, regenerateIndex]);
        } else {
            setIsLoading(true);
        }
        setError(null);
        if (!isSingleRegenerate) {
            setGeneratedImages([]);
        }
        
        setCurrentStep(0);
        setProgress(0);
        const stepInterval = isSingleRegenerate ? undefined : setInterval(() => {
            setCurrentStep(prev => (prev < COT_STEPS.length - 1 ? prev + 1 : prev));
            setProgress(prev => Math.min(prev + 12, 95));
        }, 1200);

        try {
            assertCurrentGenerationTask(taskId, signal);
            // 1. 预处理所有图片：安全模式或仅参考姿态开启时，将动作图转换为线稿以剔除背景干扰
            const processRefImage = async (img: UploadedImage | null, isSafeOrPoseOnly: boolean) => {
                if (!img) return null;
                let b64 = img.base64!;
                let mime = img.mime!;
                if (isSafeOrPoseOnly) {
                    const dataUrl = await extractEdges(`data:${mime};base64,${b64}`);
                    const parts = dataUrl.split(',');
                    if (parts.length > 1) {
                        mime = parts[0].split(':')[1].split(';')[0];
                        b64 = parts[1];
                    }
                }
                return { base64: b64, mimeType: mime };
            };

            const processedActions = await Promise.all(
                actionReferences.map(async img => {
                    const original = await processRefImage(img, false);
                    const poseOnlyMap = await processRefImage(img, isPoseOnly || isSafeMode);
                    const lineart = (isPoseOnly || isSafeMode) ? poseOnlyMap : await processRefImage(img, true);
                    return { original, lineart };
                })
            );
            assertCurrentGenerationTask(taskId, signal);
            const processedModel = await processRefImage(modelReference, isSafeModeModel);
            const processedScenes = await Promise.all(
                sceneReferences.map(img => processRefImage(img, isSafeModeScene))
            );
            const processedAccessories = await Promise.all(
                accessoryReferences.map(img => processRefImage(img, false))
            );
            const accessoryVisualAnalysis = await analyzeAccessoryReferences(accessoryReferences);

            // 2. 构建图片序列：支持根据动作图索引进行动态独立对齐
            // 严格匹配 API 与 Prompt 契约：产品图必须作为 Image 1（首张图片）传入以确保 100% 一致性锁定
            const getInputImagesForIndex = (actionIndex?: number) => {
                const list: { base64: string; mimeType: string }[] = [];
                const routeLines: string[] = [];
                const addRangeRoute = (label: string, start: number, end: number, note: string) => {
                    if (start <= 0 || end <= 0) return;
                    routeLines.push(`- Images ${start === end ? start : `${start}-${end}`}: ${label}. ${note}`);
                };
                
                // 第一优先级：添加产品图作为首张图片（Image 1），与 Prompt 中的 "# CRITICAL REQUIREMENT: The FIRST IMAGE is the [PRODUCT ASSET]" 对齐
                const productStart = list.length + 1;
                productImages.forEach(img => {
                    list.push({ base64: img.base64!, mimeType: img.mime! });
                });
                const productEnd = list.length;
                addRangeRoute('PRODUCT ASSET source of truth', productStart, productEnd, 'Preserve garment/product identity, structure, fabric, color, seams, trims, pattern, and construction exactly. Ignore product-photo background.');

                // 第二优先级：添加模特图，作为人脸特征和长相参考
                const accessoryStart = processedAccessories.some(Boolean) ? list.length + 1 : 0;
                processedAccessories.forEach(img => {
                    if (img) list.push(img);
                });
                const accessoryEnd = accessoryStart ? list.length : 0;
                addRangeRoute('ACCESSORY / OUTFIT STYLING reference set', accessoryStart, accessoryEnd, 'Exact authorized styling items only: clone every visible bottom/pants/skirt/shorts, shoes, bag, jewelry, watch, sunglasses, hat, belt, scarf, bracelet, handheld prop, material, color, scale, hardware, texture, and wearing/carrying logic whenever visible.');

                const modelStart = processedModel ? list.length + 1 : 0;
                if (processedModel) {
                    list.push(processedModel);
                    list.push(processedModel);
                }
                const modelEnd = modelStart ? list.length : 0;
                addRangeRoute('MODEL identity reference', modelStart, modelEnd, 'Preserve only the allowed identity/body/face information described in the model lock. This is NOT a scene, lighting, camera, background, wall, floor, sea, sky, props, or mood reference. Product assets override wardrobe conflicts.');
                
                // 第三优先级：添加特定动作姿态参考图，作为姿态对齐的构图锚点
                const selectedAction = typeof actionIndex === 'number' && processedActions[actionIndex]
                    ? processedActions[actionIndex]
                    : null;
                const shouldUseActionOriginal = !!selectedAction?.original && !isSafeMode && activeAutoPoseLibrary !== 'swimShorts';
                const actionOriginalStart = shouldUseActionOriginal ? list.length + 1 : 0;
                if (shouldUseActionOriginal && selectedAction?.original) {
                    list.push(selectedAction.original);
                    list.push(selectedAction.original);
                    list.push(selectedAction.original);
                }
                const actionOriginalEnd = actionOriginalStart ? list.length : 0;
                addRangeRoute('ORIGINAL ACTION / POSE reference for this output only', actionOriginalStart, actionOriginalEnd, 'PRIMARY geometry master. Match pose, camera distance, crop, body scale, body angle, shoulder/hip tilt, hand placement, limb bends, weight distribution, and visible body extent. Do not copy clothing, accessories, face, background, or lighting.');
                const actionLineartStart = selectedAction?.lineart ? list.length + 1 : 0;
                if (selectedAction?.lineart) {
                    list.push(selectedAction.lineart);
                    list.push(selectedAction.lineart);
                }
                const actionLineartEnd = actionLineartStart ? list.length : 0;
                addRangeRoute('EXTRACTED ACTION EDGE MAP for this output only', actionLineartStart, actionLineartEnd, 'Clean pose skeleton and silhouette support. It is not a scene, clothing, face, or lighting source.');
                
                // 第四优先级：添加背景场景参考图
                const sceneStart = processedScenes.some(Boolean) ? list.length + 1 : 0;
                processedScenes.forEach(img => {
                    if (img) list.push(img);
                });
                const sceneEnd = sceneStart ? list.length : 0;
                addRangeRoute('SCENE / LOCATION reference', sceneStart, sceneEnd, 'Same-shoot location anchor: preserve location identity, horizon/geometry, ground/wall materials, color palette, lighting direction, shadow softness, color temperature, mood, and recognizable cues. It is the only background source.');
                
                return {
                    images: list,
                    routePrompt: [
                        '# EXACT IMAGE ROUTING FOR THIS GENERATION CALL (DO NOT GUESS):',
                        ...routeLines,
                        '- Priority order: product identity > user-uploaded accessory identity > model identity rules > current action geometry > scene/location lighting and camera geometry.',
                        '- Never use action-reference background/lighting/accessories as scene or styling sources. Never use product-photo background as scene source.'
                    ].join('\n'),
                    accessoryIndexStart: accessoryStart,
                    accessoryIndexEnd: accessoryEnd,
                    modelIndexStart: modelStart,
                    modelIndexEnd: modelEnd,
                    sceneIndexStart: sceneStart,
                    sceneIndexEnd: sceneEnd,
                    actionOriginalStart,
                    actionOriginalEnd,
                    actionLineartStart,
                    actionLineartEnd
                };
            };

            // 3. 构建 Prompt 策略与参考图 1-based 动态索引，避免 Gemini 多模态映射错位
            const productIndexStart = 1;
            const productIndexEnd = productImages.length;
            const accessoryCount = processedAccessories.length;
            const accessoryIndexStart = accessoryCount > 0 ? productIndexEnd + 1 : 0;
            const accessoryIndexEnd = accessoryCount > 0 ? productIndexEnd + accessoryCount : 0;
            
            let modelIndexStart = 0;
            let modelIndexEnd = 0;
            if (processedModel) {
                modelIndexStart = productIndexEnd + accessoryCount + 1;
                modelIndexEnd = productIndexEnd + accessoryCount + 2;
            }
            
            let actionIndex = 0;
            let actionLineartIndex = 0;
            const actionAnchorCount = actionReferences.length > 0 ? 4 : 0;
            if (actionReferences.length > 0) {
                actionIndex = (processedModel ? productIndexEnd + accessoryCount + 2 : productIndexEnd + accessoryCount) + 1;
                actionLineartIndex = actionIndex + 2;
            }
            
            let sceneIndexStart = 0;
            let sceneIndexEnd = 0;
            if (processedScenes.length > 0) {
                const prevCount = (processedModel ? productIndexEnd + accessoryCount + 2 : productIndexEnd + accessoryCount) + actionAnchorCount;
                sceneIndexStart = prevCount + 1;
                sceneIndexEnd = prevCount + processedScenes.length;
            }
            void productIndexStart;
            void actionIndex;
            void actionLineartIndex;
            void sceneIndexStart;
            void sceneIndexEnd;

            const measurementStr = (measurements.bust || measurements.waist || measurements.hips) 
                ? `Model Measurements: Bust ${measurements.bust || 'N/A'}, Waist ${measurements.waist || 'N/A'}, Hips ${measurements.hips || 'N/A'}.` 
                : "";

            const photoStrategy = `Camera preset: ${cameraDevice} | Shot type: ${shotType}`;
            const sceneStrategy = sceneReferences.length > 0 ? "Replicate background scene from reference images" : (userPrompt || "Studio lighting, minimal background");

            const strategy = [
                `Product: ${form.productName}`,
                `Persona: ${form.personaTemplate}`,
                `Scene: ${sceneStrategy}`,
                photoStrategy,
                actionReferences.length > 0
                    ? `Action: uploaded action references are the highest-priority pose source. Matching outputs must ignore AI-recognized/auto action libraries; only outputs without an uploaded action reference may use intelligent random/auto poses`
                    : `Action: intelligent pose matching`,
                `Quality: ${QUALITY_BOOSTERS.EDITORIAL}`
            ].join(' | ');

            let basePrompt = enhancePrompt(userPrompt || `High-end fashion photography, ${form.personaTemplate} wearing ${form.productName}, studio background.`, 'PRODUCT');
            
            // 任意一种安全模式开启时均执行 Prompt 净化
            if (isSafeMode || isSafeModeScene || isSafeModeModel) {
                basePrompt = basePrompt.replace(/情趣|性感|透视|诱惑|sexy|erotic/gi, '时尚');
                basePrompt = basePrompt.replace(/内衣|睡衣|lingerie/gi, '高定泳装');
                basePrompt += " # SAFE MODE: High-end Fashion Editorial, elegant styling.";
            }

            const platformPrompt = selectedPlatform ? PLATFORM_STYLES.find(p => p.id === selectedPlatform)?.prompt : "";
            const unifiedStylingPlan = await analyzeHeroStylingPlan(productImages);
            const activeModelIdentityAnalysis = modelReference
                ? (modelIdentityAnalysis || await analyzeModelIdentityReference(modelReference, false))
                : null;
            if (activeModelIdentityAnalysis && !modelIdentityAnalysis) {
                setModelIdentityAnalysis(activeModelIdentityAnalysis);
            }
            const modelWardrobeLock = modelReference
                ? (isFaceOnly
                    ? [
                        '# MODEL FACE-ONLY LOCK (HIGHEST PRIORITY AFTER PRODUCT):',
                        `- The MODEL identity reference images are listed in the exact image routing table for this generation call.`,
                        '- Preserve only the model face/head identity: face shape, facial proportions, eyes, eyebrows, nose, lips, jaw/chin, expression, and visible skin tone.',
                        activeModelIdentityAnalysis?.promptBlock ? `- AI analyzed face contract: ${activeModelIdentityAnalysis.promptBlock}` : '',
                        activeModelIdentityAnalysis?.faceLock ? `- Face lock: ${activeModelIdentityAnalysis.faceLock}` : '',
                        '- Do NOT use the model reference clothing, jeans/pants, shoes, accessories, body pose, body shape, or outfit styling as constraints.',
                        '- MODEL REFERENCE BACKGROUND BAN: Do NOT copy or infer the model-reference background, wall, floor, ocean, sky, architecture, props, shadows, lighting, color temperature, lens, camera crop, or scene mood.',
                        '- Clothing and styling must come from the product asset, accessory references, user prompt, and platform styling only.'
                    ].filter(Boolean).join('\n')
                    : [
                        '# MODEL IDENTITY LOCK + LOW-PRIORITY WARDROBE CONTEXT:',
                        `- The MODEL identity reference images are listed in the exact image routing table for this generation call. Preserve the same face, facial proportions, hair color/style, skin tone, body proportions, and overall person identity in EVERY output.`,
                        '- MODEL REFERENCE BACKGROUND BAN: The model identity reference is NOT a scene reference. Ignore and forbid its background, wall, floor, ocean/sea, sky, street, furniture, architecture, props, shadow pattern, lighting direction, color temperature, camera crop, lens distance, and environment mood.',
                        '- If a separate uploaded scene reference exists, it is the ONLY scene source. If no scene reference exists, use the platform/user scene settings only, never the model identity image environment.',
                        activeModelIdentityAnalysis?.faceLock ? `- Face lock: ${activeModelIdentityAnalysis.faceLock}` : '',
                        activeModelIdentityAnalysis?.hairLock ? `- Hair lock: ${activeModelIdentityAnalysis.hairLock}` : '',
                        activeModelIdentityAnalysis?.bodyLock ? `- Body lock: ${activeModelIdentityAnalysis.bodyLock}` : '',
                        activeModelIdentityAnalysis?.outfitLock ? `- Low-priority model outfit observation, NOT a lock: ${activeModelIdentityAnalysis.outfitLock}` : '',
                        activeModelIdentityAnalysis?.bottomLock ? `- Low-priority model bottom observation, NOT a lock: ${activeModelIdentityAnalysis.bottomLock}` : '',
                        activeModelIdentityAnalysis?.shoeLock ? `- Low-priority model shoe observation, NOT a lock: ${activeModelIdentityAnalysis.shoeLock}` : '',
                        '- Product garments from Image 1 and all uploaded product assets have absolute priority over model-reference clothing.',
                        '- If the product asset includes shorts, pants, skirt, bottom piece, matching set, pajama set, suit set, or coordinated outfit bottom, replace the model reference bottom completely.',
                        '- Never render the original model jeans/pants/shorts underneath or overlapping the product bottom. Never create double waistbands, duplicate hems, double drawstrings, or mixed original-bottom + product-bottom artifacts.',
                        '- If the product is clearly upper-body only, the model reference bottom may be used only as compatible low-priority styling, never as a hard lock.',
                        activeModelIdentityAnalysis?.forbiddenDrift ? `- Forbidden drift: ${activeModelIdentityAnalysis.forbiddenDrift}` : ''
                    ].filter(Boolean).join('\n'))
                : '';

            const supplementalNotes = form.extraNotes.trim();
            const userExplicitlyRequestedFullBody = /full[-\s]?body|full[-\s]?length|head[-\s]?to[-\s]?toe|entire\s+body|全身|全身照|全身展示|从头到脚/i.test(supplementalNotes);
            const getSupplementaryNotesPrompt = (isActionLockedOutput: boolean, outputNumber: number) => {
                if (!supplementalNotes) return '';
                return isActionLockedOutput
                    ? `# USER SUPPLEMENTARY NOTES FOR OUTPUT #${outputNumber} (LOW-PRIORITY CONTEXT ONLY): ${supplementalNotes}
# ACTION-LOCK CONFLICT RULE: For this output, ignore any supplementary-note requests about front/back/side view, full-body, half-body, camera angle, crop, pose, walking/sitting/standing state, or shot sequence. Those notes may influence only product styling, selling-point emphasis, mood, and non-pose details. The uploaded action reference controls pose, angle, subject scale, crop boundary, and visible body extent.`
                    : `# USER SUPPLEMENTARY NOTES FOR OUTPUT #${outputNumber} (MUST FOLLOW): ${supplementalNotes}
# USER REQUESTED ANGLES / FRAMING PRIORITY: This output has no matching uploaded action reference. If the notes mention front/back/side/three-quarter view, full-body/half-body crop, walking/sitting/standing state, camera framing, or required shot sequence, obey those instructions with high priority while preserving product fidelity. If the notes do not request a specific pose or angle for this output, choose a varied random/auto commercial pose.`;
            };

            const sceneVariationPresets = [
                'wide framing from the same tripod zone: keep the reference background anchors visible, show slightly more floor/ground and horizon while preserving the same location geometry and sun/shadow direction',
                'medium framing from the same camera height: keep the same background anchors behind the subject, vary only lens distance and crop, with natural subject-to-background separation and professional lookbook lighting',
                'three-quarter framing from a small left/right camera shift within the same spot: preserve the same horizon, wall/ground/material cues, prop family, color temperature, and real parallax',
                'full-body commercial framing: keep the same ground plane and background horizon/architecture relation, only adjust subject scale and focal length; feet, shoes, and dress hem must contact the ground believably',
                'half-body framing: crop tighter with moderate background blur, keeping a recognizable softened portion of the same reference scene behind the upper body and matching the reference light direction on face/fabric',
                'close-up/detail framing: use shallow depth of field and visibly blurred background; retain only soft recognizable scene cues from the uploaded reference, such as the same ground texture, horizon, wall, prop, or color block, while fabric highlights match the same light source'
            ];

            const accessoryBatchLockPrompt = accessoryReferences.length > 0
                ? `# ACCESSORY / OUTFIT STYLING BATCH IDENTITY LOCK:
Images ${accessoryIndexStart}-${accessoryIndexEnd} define the ONLY authorized styling set allowed in this batch. If one image contains multiple flat-lay items, treat each visible item as a separate required styling reference. Use the same bottom/pants/jeans/skirt/shorts, shoes, bag, jewelry, watch, sunglasses, hat, belt, scarf, bracelet, and handheld prop identity across every output whenever visible: same item count, same color, same material, same hardware, same scale, and same styling logic. A crop may hide a styling item naturally, but visible styling items must not change between outputs. Do NOT invent alternate pants, shoes, necklaces, watches, sunglasses, hats, bags, belts, bracelets, or props.`
                : `# AUTO-STYLING BATCH IDENTITY LOCK:
No accessory reference images were uploaded. The AI-analyzed UNIFIED STYLING PLAN above is the ONLY allowed generated styling support for this batch.
- First decide from the product, platform, persona, scene, and user notes whether the outfit needs pants/bottoms, shoes, bag, rings, necklace, earrings, bracelet, watch, belt, sunglasses, hat, scarf, or handheld prop.
- If an item is needed or explicitly requested by the user, generate exactly ONE consistent version of that item across ALL outputs: same category, color, material, scale, hardware, shape, placement logic, and styling mood.
- If an item is not needed, keep it absent across ALL outputs.
- Never let shoes, pants, bags, rings, necklaces, earrings, bracelets, watches, belts, sunglasses, hats, scarves, or props vary randomly between images. Crops may hide items naturally, but any visible item must match the unified styling plan.`;
            const accessoryVisualLockPrompt = accessoryReferences.length > 0
                ? [
                    '# ACCESSORY / OUTFIT STYLING VISUAL ANALYSIS LOCK (STRICT):',
                    `- Styling item inventory: ${accessoryVisualAnalysis?.itemChecklist || 'Follow every visible item in the uploaded styling images exactly.'}`,
                    `- Placement/wearing rules: ${accessoryVisualAnalysis?.placementRules || 'Use the same wearing, carrying, scale, and occlusion logic as the reference images.'}`,
                    accessoryVisualAnalysis?.promptBlock ? `- AI accessory prompt contract: ${accessoryVisualAnalysis.promptBlock}` : '',
                    `- Forbidden styling drift: ${accessoryVisualAnalysis?.forbiddenDrift || 'changed styling item identity, changed color/material, invented accessory, invented pants, missing referenced item, swapped bag/shoes/jewelry/bottoms'}`
                ].filter(Boolean).join('\n')
                : '';

            const getPerOutputScenePrompt = (outputNumber: number, isActionLockedOutput: boolean) => {
                if (sceneReferences.length === 0) return '';
                const variation = sceneVariationPresets[(outputNumber - 1) % sceneVariationPresets.length];
                return `# SCENE VARIATION FOR OUTPUT #${outputNumber}:
Use the uploaded scene reference as the SAME-SHOOT LOCATION ANCHOR, not as a different scene inspiration. This output must feel photographed at the same place, on the same day, by the same camera team.
- Preserve the key scene anchors from the reference: same location type, horizon/architecture relationship, ground or wall material, dominant props/materials, color palette, weather/season, lighting direction, and overall mood.
- Allow only conservative real-camera variation: ${variation}.
- Variation may come from subject scale, focal length, crop, mild parallax, depth of field, and small camera height/left-right changes. Do not redesign or replace the background.
- PERSPECTIVE SOLVER: rebuild the scene with physically valid camera geometry. Horizon line, vanishing points, ground plane, subject foot contact, shadow direction, lens compression, and background scale must agree with the selected full-body / half-body / close-up framing.
- LOOKBOOK LIGHTING SOLVER: treat this as professional fashion lookbook photography, not a pasted product composite. The model must be lit by the same real light system as the scene: same sun/window/key-light direction, same shadow softness, same color temperature, same fill level, and realistic bounce light from nearby stone/wall/water/floor surfaces.
- SUBJECT-SCENE INTEGRATION: skin, hair, dress fabric, bag, shoes, and ground contact shadows must all respond to the same light. Dress folds should show natural highlight rolloff and shadow occlusion; feet/shoes and long dress hem must cast grounded contact shadows on the exact floor/ground plane.
- DEPTH-OF-FIELD LOCK: if this output is close-up, extreme close-up, detail crop, chest-up, neck-to-chest, or waist-up, the scene background must be optically blurred like a real lens. Keep only soft recognizable scene cues from the uploaded scene reference; do not render a crisp, equally sharp background behind a close subject.
- For full-body and wide shots, the background can be clearer, but it must still obey real lens perspective, subject distance, scale, contact shadows, lighting direction, and professional model exposure.
- If the uploaded scene reference perspective is imperfect or conflicts with the selected pose/crop, correct it subtly while preserving the same scene identity and key visual anchors.
- Every output, including close-ups/details, must retain at least one recognizable cue from the uploaded scene reference.
- Do NOT make every batch image use the identical background crop, but also do NOT change to a different beach/room/street/studio, different architecture, different season, different time of day, or unrelated props.
- If the scene reference has ocean/stone/shell/sky cues, preserve those same cues across the batch; if it has walls/floor/furniture cues, preserve those same cues across the batch.
${isActionLockedOutput ? '- Respect the uploaded action reference crop/pose first; scene variation must adapt behind that pose without changing the action-reference framing.' : '- Let the scene camera naturally support the requested full-body / half-body / close-up / detail shot.'}`;
            };

            const globalPrompt = `
            # AGENT STRATEGY: ${strategy}
            # MISSION: Professional commercial product photography with MANDATORY PRODUCT CONSISTENCY.
            # ABSOLUTE CANVAS RULE:
            The final output MUST be exactly ${aspectRatio}. Fill the ${aspectRatio} canvas with one continuous image. No nested photo, no framed image inside a white page, no letterbox, no pillarbox, no top/bottom blank bands, no side blank bands, no white empty lower half, no collage, no split screen, no comparison grid.

            ${actionReferences.length > 0 ? `# USER-UPLOADED ACTION REFERENCE PRIORITY (ABSOLUTE):
            The user uploaded action reference image(s). For every output slot that has a matching uploaded action reference, that uploaded action reference is the ONLY valid pose/angle/framing source.
            AI product recognition, AI category analysis, automatic pose libraries, random commercial pose presets, and inferred action suggestions MUST NOT override, replace, soften, reinterpret, or compete with the uploaded action reference.
            Use AI-recognized/automatic actions ONLY for output slots that do NOT have any uploaded action reference assigned.` : `# AUTO ACTION SOURCE:
            No uploaded action reference image was provided, so AI-recognized category/action analysis and automatic pose libraries may be used for pose selection.`}
            
            # CRITICAL REQUIREMENT - MAXIMUM PRODUCT FIDELITY (HIGHEST PRIORITY): 
            The FIRST IMAGE (Image 1) is the [PRODUCT ASSET]. You MUST preserve its exact structural design, clothing shape, collar style, neck cuts, sleeves, pockets, fabric texture, prints/patterns (e.g. leopard print or stripes), stitching, and materials perfectly. 
            The clothing on the generated model MUST be a 100% pixel-accurate high-fidelity replica of this product asset, with ZERO structure changes or textile/fabric details loss. 
            # PRODUCT GARMENT SUPREMACY / NO LAYERING:
            The uploaded product images may include a full coordinated set, matching shorts, pants, skirt, suit bottom, pajama bottom, or other lower-body garment. If any product image shows such a bottom piece, it is part of the product and MUST replace any pants/jeans/shorts from the model identity reference.
            Never combine, stack, or blend the model reference bottom with the product bottom. Do NOT render original model pants visible underneath product shorts/pants. Do NOT create duplicate waistbands, duplicate hems, double drawstrings, double leg openings, or a layered pants-under-shorts artifact.
            **BACKGROUND NOISE ISOLATION (STRICT)**: You MUST completely and absolutely ignore, block, and discard any background elements present in the product asset image, including clothes hangers, hooks, picture frames on the wall, hanging art, wall stripes, wooden frames, shadow boards, stands, or room walls. 
            DO NOT generate or allow ANY of these product background items to appear in the final model's scene background. You must isolate ONLY the clothing itself from the product asset.
            
            ${unifiedStylingPlan}
            ${accessoryBatchLockPrompt}
            ${accessoryVisualLockPrompt}
            
            ${platformPrompt ? `# PLATFORM VISUAL GENE: ${platformPrompt}` : ''}
            ${accessoryReferences.length > 0 ? `# ACCESSORY / OUTFIT STYLING REFERENCE DIRECTIVE (STRICT): The styling reference images listed in the routing table are the ONLY authorized styling references. If they show pants, jeans, skirt, shorts, shoes, bag, purse, jewelry, ring, necklace, earrings, watch, sunglasses, hat, belt, scarf, bracelet, or handheld prop, use the same item identity across the batch whenever visible and preserve its exact color, material, size, shape, strap/handle direction, hardware, texture, silhouette, and placement logic. A single flat-lay image can contain multiple required items; do not reduce it to a vague mood board. Do NOT invent extra styling items beyond these images, and do NOT replace the referenced bottoms/shoes/bag/jewelry with AI-chosen alternatives.` : '# AUTO-STYLING DIRECTIVE (STRICT): The user did not upload accessory reference images, so you must use the UNIFIED STYLING PLAN as the single batch styling contract. Generate only the pants/bottom, shoes, bag, ring, necklace, earrings, bracelet, watch, belt, sunglasses, hat, scarf, or prop explicitly selected by that plan or explicitly requested in user supplementary notes. Keep every selected styling item identical across all outputs. Do not add unplanned accessories.'}
            ${modelWardrobeLock}
            ${measurementStr ? `# BODY PROPORTIONS: ${measurementStr}` : ''}
            # OUTPUT FORMAT LOCK: Generate exactly one image in the user-selected ${aspectRatio} aspect ratio. No collage, no split-screen, no side-by-side images, no before/after layout, no horizontal strip, no letterbox/pillarbox, no large blank white canvas.
            ${actionReferences.length > 0 ? '# ACTION REFERENCE IS POSE ONLY: Uploaded action references control only body pose and gesture. They must NOT control background, environment, lighting, product color, or output aspect ratio.' : ''}
            ${sceneReferences.length > 0
                ? `# PROFESSIONAL LOOKBOOK SCENE LOCK + REAL CAMERA GEOMETRY:
Uploaded scene references define the exact shooting location identity: environment type, horizon/architecture relationship, ground/wall material, dominant props/materials, color temperature, lighting direction, mood, weather/season, and location cues.
The final image must look like a real professional fashion lookbook shoot at that location, not a pasted model over a background.
- SAME LOCATION, REAL VARIATION: Do NOT copy the exact same background crop in every image, but stay in the SAME location. Variation is limited to real camera changes: crop, focal length, subject distance, mild parallax, depth of field, and small camera height/left-right shifts. Do NOT invent a different scene or replace the background with another similar-looking place.
- REAL CAMERA GEOMETRY: coherent horizon, vanishing point, ground plane, object scale, subject placement, lens compression, and depth of field. The model's feet/shoes and long dress hem must sit on the same ground plane as the scene.
- PROFESSIONAL MODEL LIGHTING: match the reference light system exactly. Use the same sun/window/key-light direction, shadow angle, shadow softness, color temperature, fill ratio, and bounce light. If the reference is outdoor daylight, render believable fashion daylight with natural fill and soft reflected light from stone/wall/water/floor surfaces. If the reference is studio/interior, render a plausible key/fill/rim setup consistent with the room.
- MATERIAL LIGHT RESPONSE: skin, hair, dress fabric, bag, jewelry, shoes, and ground must share the same exposure and light direction. Fabric folds need real highlight rolloff, occlusion shadows, and texture visibility. No plastic skin, no flat AI lighting, no cutout edge glow.
- CONTACT SHADOWS: feet, shoes, bag contact points, dress hem, and any object touching the scene must cast grounded contact shadows matching the light direction and surface texture.
- CLOSE-UP RULE: for close-up, extreme close-up, chest-up, neck-to-chest, waist-up, and detail crops, the uploaded scene must appear as a real out-of-focus background with recognizable but blurred cues; never render a crisp flat background behind a close subject.
- PLAUSIBILITY FIX: If the uploaded scene reference perspective is imperfect or conflicts with the selected pose/crop, correct it subtly while preserving the same scene identity and key visual anchors.`
                : (selectedPlatform === 'amazon'
                    ? '# PROFESSIONAL LOOKBOOK SCENE REALISM LOCK: Pure white background (#FFFFFF), clean studio lighting, centered. Use a real studio fashion lighting setup with one consistent key light and soft fill, natural skin/fabric highlights, physically plausible model/product contact shadows, no floating body, no pasted cutout edges, no impossible shadow direction.'
                    : '# PROFESSIONAL LOOKBOOK SCENE REALISM LOCK: Choose one professional studio or high-end lifestyle background that matches the product, persona, platform, and unified styling plan. The scene and lighting must feel like a real fashion lookbook shoot: coherent horizon/vanishing points, believable ground plane, correct subject scale, consistent color temperature, realistic key/fill/bounce light, grounded contact shadows under feet/shoes/dress hem, lens-appropriate depth of field, natural fabric highlight rolloff, and no artificial pasted backdrop.')}
            
            # CAMERA: ${cameraDevice !== '智能推荐' ? cameraDevice : 'Professional high-end commercial camera'}
            # SHOT: ${shotType !== '智能推荐' ? shotType : 'Optimal commercial framing'}
            
            # DESCRIPTION: ${basePrompt}
            # SUPPLEMENTARY NOTE ROUTING:
            User supplementary notes are applied per output slot. Outputs with a matching uploaded action reference use those notes only as low-priority style/product context; outputs without a matching uploaded action reference use those notes as high-priority angle/framing instructions. If extra outputs have no specific pose/angle requested in the notes, generate them with varied random/auto poses.
            # FINAL OUTPUT: High-fidelity, commercial-grade asset with strict geometric locking for the product.
            `;

            const countToGenerate = Math.max(generateCount, actionReferences.length);

            // 检查是否为睡衣/家居服系列产品
            const keywords = ['pajama', 'sleepwear', 'loungewear', 'nightgown', 'bathrobe'];
            const productNameLower = (form.productName || '').toLowerCase();
            const productCategoryLower = (form.productCategory || '').toLowerCase();
            const isSleepwear = keywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const mensShirtKeywords = ['mens shirt', "men's shirt", 'resort shirt', 'linen shirt', 'button shirt', 'button-up shirt', 'hawaiian shirt'];
            const isMensShirt = mensShirtKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const mensKnitKeywords = ['knit', 'knitwear', 'knit polo', 'textured knit', 'polo shirt'];
            const isMensKnit = mensKnitKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const mensTeeKeywords = ['tee', 't-shirt', 't shirt', 'oversized tee', 'oversized t-shirt'];
            const isMensTee = mensTeeKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const swimShortsKeywords = ['swim shorts', 'swim trunks', 'board shorts', 'boardshorts', 'beach shorts', 'bathing trunks', 'swimwear shorts', 'quick dry shorts', 'quick-dry shorts', '泳裤', '沙滩裤'];
            const isSwimShorts = swimShortsKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const mensShortsKeywords = [
                'mens shorts', "men's shorts", 'men shorts', 'casual shorts', 'chino shorts', 'cargo shorts', 'denim shorts',
                'athletic shorts', 'gym shorts', 'training shorts', 'streetwear shorts', 'drawstring shorts', 'lounge shorts',
                'short pants', '短裤', '男士短裤', '男款短裤', '休闲短裤', '工装短裤', '运动短裤', '牛仔短裤'
            ];
            const isMensShorts = !isSwimShorts && mensShortsKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const mensPantsKeywords = [
                'mens pants', "men's pants", 'men pants', 'trousers', 'pants', 'jeans', 'denim pants', 'cargo pants',
                'chino pants', 'linen pants', 'dress pants', 'joggers', 'sweatpants', 'wide leg pants', 'straight leg pants',
                '长裤', '男士长裤', '男裤', '休闲裤', '工装裤', '牛仔裤', '亚麻裤', '西裤', '运动裤', '卫裤', '直筒裤', '宽腿裤'
            ];
            const womensBottomKeywords = ['women', "women's", 'female', 'ladies', '女士', '女款', '女装', '女性'];
            const isWomensBottomText = womensBottomKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const isMensPants = !isWomensBottomText && mensPantsKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const longDressKeywords = [
                'long dress', 'maxi dress', 'ankle-length dress', 'ankle length dress', 'floor-length dress', 'floor length dress',
                'long skirt dress', 'evening dress', 'slip dress', 'long sundress', 'gown', 'dress gown',
                '长裙', '长款连衣裙', '及踝裙', '拖地裙', '礼服裙', '吊带长裙', '度假长裙'
            ];
            const isLongDress = longDressKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const solavibeKeywords = [
                'solavibe', 'plus size', 'plussize', 'curve', 'curvy', 'vacation', 'boho', 'bohemian',
                'relaxed', 'comfort', 'loose shirt', 'oversized shirt', 'vacation dress', 'resort dress',
                'resort wear', 'resort set', 'two piece set', 'two-piece set', 'matching set', 'wide leg pants', 'wide-leg pants',
                '大码', '加大码', '胖mm', '度假', '度假风', '波西米亚', '波西米亚风', '宽松衬衫',
                '宽松上衣', '度假裙', '度假连衣裙', '两件套', '套装', '阔腿裤', '舒适', '休闲度假'
            ];
            const isSolavibe = solavibeKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));
            const womensFashionKeywords = [
                'women', "women's", 'female', 'ladies', 'womenswear', 'fashion dress', 'short dress', 'mini dress', 'midi dress',
                'skirt', 'blouse', 'camisole', 'tank top', 'crop top', 'bodysuit', 'cardigan', 'blazer', 'jacket', 'coat',
                'trench', 'vest', 'pants', 'trousers', 'jeans', 'matching set', 'two piece set', 'suit set',
                '女装', '女士', '女性', '短裙', '半身裙', '短连衣裙', '中长裙', '上衣', '衬衫女', '吊带', '背心',
                '开衫', '西装外套', '外套', '大衣', '风衣', '马甲', '女裤', '牛仔裤', '套装'
            ];
            const isWomensFashion = womensFashionKeywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));

            const activeAutoPoseLibrary: AutoPoseLibrary = autoPoseLibrary !== 'none'
                ? autoPoseLibrary
                : isSolavibe
                    ? 'solavibe'
                    : isLongDress
                        ? 'longDress'
                        : isSwimShorts
                            ? 'swimShorts'
                            : isMensShorts
                                ? 'mensShorts'
                                : isMensPants
                                    ? 'mensPants'
                                    : isMensTee
                                        ? 'mensTee'
                                        : isMensKnit
                                            ? 'mensKnit'
                                            : isMensShirt
                                                ? 'mensShirt'
                                                : isWomensFashion
                                                    ? 'womensFashion'
                                                    : 'none';

            const shouldUseClothingPoseLibrary = !isSleepwear;

            // Define 10 highly varied, high-end professional commercial studio camera angles and modeling poses
            const DIVERSE_POSES = [
                "front view modeling pose, looking at camera, standing naturally with hands resting at sides, full body composition",
                "three-quarter elegant profile view, model walking gracefully with light motion, turned head, confident gaze",
                "side view modeling pose, looking back over shoulder toward camera, highlighting back side styling",
                "relaxed editorial sitting pose on a clean studio block, front view, hands on knees, medium full body framing",
                "dynamic diagonal action pose, three-quarter perspective, body slightly angled with arms in relaxed mid-stride motion",
                "close-up detail portrait shot showing the product fit, front view, cropped at waist level, focusing on garment layout",
                "low-angle heroic fashion stance, looking slightly down at camera, hands on hips, confident runway poise",
                "elegant casual pose leaning gently against a sleek minimalist wall, crossed legs, body tilted at a 15-degree angle",
                "full back view modeling pose, head turned 90 degrees showing profile chin line and back garment consistency",
                "medium shot from high-angle perspective, showing the model walking forward with relaxed shoulders, looking forward"
            ];

            // 彻底洗牌打乱睡衣姿态预设列表，确保批量生成的每张图都随机且不重复
            let shuffledSleepwearPoses = [...SLEEPWEAR_POSES];
            if (isSleepwear) {
                for (let k = shuffledSleepwearPoses.length - 1; k > 0; k--) {
                    const r = Math.floor(Math.random() * (k + 1));
                    [shuffledSleepwearPoses[k], shuffledSleepwearPoses[r]] = [shuffledSleepwearPoses[r], shuffledSleepwearPoses[k]];
                }
            }

            // 彻底洗牌打乱普通服装姿态预设列表，确保批量生成的每张图都随机且不重复
            let shuffledClothingPoses = [...CLOTHING_POSES];
            if (shouldUseClothingPoseLibrary) {
                for (let k = shuffledClothingPoses.length - 1; k > 0; k--) {
                    const r = Math.floor(Math.random() * (k + 1));
                    [shuffledClothingPoses[k], shuffledClothingPoses[r]] = [shuffledClothingPoses[r], shuffledClothingPoses[k]];
                }
            }

            let shuffledMensShirtPoses = [...MENS_SHIRT_POSES];
            for (let k = shuffledMensShirtPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledMensShirtPoses[k], shuffledMensShirtPoses[r]] = [shuffledMensShirtPoses[r], shuffledMensShirtPoses[k]];
            }

            let shuffledMensKnitPoses = [...MENS_KNIT_POSES];
            for (let k = shuffledMensKnitPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledMensKnitPoses[k], shuffledMensKnitPoses[r]] = [shuffledMensKnitPoses[r], shuffledMensKnitPoses[k]];
            }

            let shuffledMensTeePoses = [...MENS_TEE_POSES];
            for (let k = shuffledMensTeePoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledMensTeePoses[k], shuffledMensTeePoses[r]] = [shuffledMensTeePoses[r], shuffledMensTeePoses[k]];
            }

            let shuffledSwimShortsPoses = [...SWIM_SHORTS_POSES];
            for (let k = shuffledSwimShortsPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledSwimShortsPoses[k], shuffledSwimShortsPoses[r]] = [shuffledSwimShortsPoses[r], shuffledSwimShortsPoses[k]];
            }

            let shuffledMensShortsPoses = [...MENS_SHORTS_POSES];
            for (let k = shuffledMensShortsPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledMensShortsPoses[k], shuffledMensShortsPoses[r]] = [shuffledMensShortsPoses[r], shuffledMensShortsPoses[k]];
            }

            let shuffledMensPantsPoses = [...MENS_PANTS_POSES];
            for (let k = shuffledMensPantsPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledMensPantsPoses[k], shuffledMensPantsPoses[r]] = [shuffledMensPantsPoses[r], shuffledMensPantsPoses[k]];
            }

            let shuffledLongDressPoses = [...LONG_DRESS_POSES];
            for (let k = shuffledLongDressPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledLongDressPoses[k], shuffledLongDressPoses[r]] = [shuffledLongDressPoses[r], shuffledLongDressPoses[k]];
            }

            let shuffledWomensFashionPoses = [...WOMENS_FASHION_POSES];
            for (let k = shuffledWomensFashionPoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledWomensFashionPoses[k], shuffledWomensFashionPoses[r]] = [shuffledWomensFashionPoses[r], shuffledWomensFashionPoses[k]];
            }

            let shuffledSolavibePoses = [...SOLAVIBE_POSES];
            for (let k = shuffledSolavibePoses.length - 1; k > 0; k--) {
                const r = Math.floor(Math.random() * (k + 1));
                [shuffledSolavibePoses[k], shuffledSolavibePoses[r]] = [shuffledSolavibePoses[r], shuffledSolavibePoses[k]];
            }

            const generationIndices = isSingleRegenerate ? [regenerateIndex!] : Array.from({ length: countToGenerate }, (_, i) => i);
            const batchPromises = generationIndices.map((i) => {
                const actionReferenceIndex = i < actionReferences.length ? i : undefined;
                const hasOutputActionReference = typeof actionReferenceIndex === 'number';
                const inputPack = getInputImagesForIndex(actionReferenceIndex);
                const specificInputImages = inputPack.images;
                const matchedActionReference = hasOutputActionReference ? actionReferences[actionReferenceIndex!] : null;
                const outputAspectRatio = aspectRatio;
                const actionReferenceInputDescription = inputPack.actionOriginalStart
                    ? `Original action reference ${inputPack.actionOriginalStart === inputPack.actionOriginalEnd ? `is Image ${inputPack.actionOriginalStart}` : `images are Images ${inputPack.actionOriginalStart}-${inputPack.actionOriginalEnd}`}; extracted pose/edge map is Image ${inputPack.actionLineartStart}. The ORIGINAL action reference is the PRIMARY framing/crop/body-geometry master: use it to read exact camera distance, visible body extent, cut-off boundaries, product-display area, close-up/detail crop, shoulder line, hip angle, hand-to-body spacing, arm bend, leg stance, and body weight distribution. Use the edge map only as supporting pose clarification. Do NOT copy the original action reference's clothing, logo, necklace, face identity, skin details, background, or lighting.`
                    : `Extracted pose/edge maps are Images ${inputPack.actionLineartStart}-${inputPack.actionLineartEnd}. The original action photo is intentionally not included because safe mode requires pose-only extraction; use these edge maps as the clean skeleton/gesture blueprint. Since no action photo pixels are provided, do NOT infer or hallucinate any action-reference background, architecture, room, beach, pool, plants, props, color palette, or lighting.`;
                
                const outputNumber = i + 1;
                const perOutputSupplementaryNotes = getSupplementaryNotesPrompt(hasOutputActionReference, outputNumber);
                const perOutputScenePrompt = getPerOutputScenePrompt(outputNumber, hasOutputActionReference);
                const sceneRoutingLock = sceneReferences.length > 0 && inputPack.sceneIndexStart
                    ? `# SCENE IMAGE ROUTING FOR OUTPUT #${outputNumber}:
Images ${inputPack.sceneIndexStart === inputPack.sceneIndexEnd ? inputPack.sceneIndexStart : `${inputPack.sceneIndexStart}-${inputPack.sceneIndexEnd}`} are the ONLY scene/location references for this output. The final model, product, accessories, shadows, exposure, depth of field, and camera perspective must be physically integrated into this same location. Do not use any action-reference or product-photo background as the scene.`
                    : modelReference
                        ? `# SCENE SOURCE LOCK FOR OUTPUT #${outputNumber}:
No uploaded scene reference is available for this output. Build the background only from the selected platform style, user prompt, and global scene realism rules. Do NOT use the model identity reference environment, background, wall, floor, ocean, sky, architecture, props, shadows, lighting direction, color temperature, camera crop, lens distance, or scene mood.`
                        : '';
                let finalPrompt = `${inputPack.routePrompt}
${sceneRoutingLock}
${globalPrompt}`;
                let selectedPoseHeader = '';
                if (hasOutputActionReference) {
                    const actionFrameNote = getPoseReferenceFrameNote(actionReferences[actionReferenceIndex], actionReferenceIndex);
                    selectedPoseHeader = `# EXACT USER ACTION REFERENCE FOR THIS OUTPUT (ABSOLUTE):
Output #${outputNumber} is reserved for uploaded action reference #${actionReferenceIndex + 1}. This output slot must replicate that reference's angle, pose, subject scale, crop boundary, and visible body extent. The action reference images included in this input are the strongest geometry constraint for THIS IMAGE ONLY.
${actionFrameNote}
${actionReferenceInputDescription}
AI ACTION ANALYSIS OVERRIDE BAN: AI-recognized category actions, recommended action libraries, random pose presets, product-type pose suggestions, and automatic pose analysis have ZERO authority for this output. They must be ignored completely because the user provided an action reference for this slot.
STRICT SLOT ROUTING: This is a one-to-one batch assignment. Output #${outputNumber} MUST use uploaded action reference #${actionReferenceIndex + 1}; using a generic pose, another uploaded action reference, an auto pose library pose, or ignoring this reference is a failed result.
Reference geometry: ${describeImageFraming(matchedActionReference)}. Output aspect ratio MUST be the USER SELECTED ratio ${outputAspectRatio}. Never override it with the action reference ratio.
Match the uploaded action reference's crop, framing, camera angle, body scale, subject placement, lens distance, left/right facing direction, hand placement, arm bend, shoulder tilt, head direction, torso rotation, hip angle, leg stance, knee bend, foot direction, and visible body silhouette.
CROP LOCK IS MANDATORY: if the action reference is half-body, waist-up, thigh-up, full-body, seated, walking, leaning, or cropped at the knees, this output MUST use the same body extent and crop boundary.
EXTREME CLOSE-UP LOCK: if the action reference is a close-up/detail crop such as neck-to-chest, chin-to-chest, cropped face, no full head, no eyes visible, chest-dominant product detail, or torso-only crop, the output MUST stay equally close. Do NOT zoom out into a normal portrait, do NOT reveal the full face/head, do NOT show waist/legs, and do NOT convert it into a standard half-body catalog shot.
Do NOT replace the referenced pose with a generic catalog pose. Do NOT drop raised hands, pocket hands, hand-to-face gestures, seated stance, walking stance, leaning pose, crossed legs, over-shoulder direction, or asymmetric limb angle.
Use the product asset only for clothing identity and the scene reference/user prompt for background. Completely ignore the action reference background, face identity, clothing design, logo, colors, texture, jewelry/accessories, lighting, and scene details. Keep only camera distance, crop geometry, pose/framing, and visible-body extent.
CANVAS FILL LOCK: create a single full-frame ${outputAspectRatio} image. The generated photo must touch the intended canvas boundaries naturally and must not sit as a smaller horizontal image inside a larger white/blank canvas.
ACTION ONLY LOCK: use the uploaded action reference only for pose geometry: hand placement, arm bend, shoulder tilt, torso rotation, hip angle, leg stance, knee bend, foot direction, body silhouette and product-display crop idea.
BACKGROUND SOURCE LOCK: do NOT copy the action reference background, lighting, beach, pool, ocean, sand, walls, props, model identity, face, skin tone, or old swim shorts. Background must come from the uploaded scene reference if present; otherwise from the user's platform/style/background settings.
ACTION BACKGROUND BAN: any arches, walls, interiors, pools, plants, beaches, props, furniture, windows, doors, floors, or lighting that came from the action reference must be treated as forbidden contamination. The action reference is not a scene source.
GARMENT REPLACEMENT ONLY: the product asset controls only the swim shorts/garment design, color, material, pattern, waistband, drawstring, pockets, liner, seams, hem and fit.
SINGLE IMAGE OUTPUT: generate one normal ${outputAspectRatio} image only. Do NOT create a collage, split screen, side-by-side comparison, before/after layout, two images in one canvas, horizontal strip, letterbox, pillarbox, or a large blank white area.
${perOutputSupplementaryNotes}
`;
                    if (activeAutoPoseLibrary === 'swimShorts') {
                        selectedPoseHeader += `
# SWIM SHORTS OVERRIDE FOR UPLOADED ACTION REFERENCE (HIGHEST PRIORITY):
Uploaded action references provide ONLY body pose and product-display crop. Do not copy their background or old swim shorts. Keep the user-selected ${outputAspectRatio} canvas. If the action pose shows swim-shorts product framing, preserve the upper-chest/pectorals-to-feet subject display inside the selected ${outputAspectRatio} image.
`;
                    }
                    finalPrompt += `\n# MATCHING ACTION REFERENCE ROUTING: Output #${outputNumber} is generated from uploaded action reference #${actionReferenceIndex + 1}. Other outputs without their own uploaded action reference must use random/auto poses instead and must not inherit this reference.\n`;
                } else {
                    if (actionReferences.length > 0) {
                        finalPrompt += `\n# NO UPLOADED ACTION REFERENCE FOR OUTPUT #${outputNumber}: Do NOT copy, infer from, or visually reuse any uploaded action reference for this output. Uploaded action references are reserved only for output slots 1-${actionReferences.length}. Generate this output from the user's supplementary notes when they request a specific angle/framing; otherwise use a varied random/auto commercial pose while preserving product fidelity.\n`;
                    }
                    if (perOutputSupplementaryNotes) {
                        finalPrompt += `\n${perOutputSupplementaryNotes}\n`;
                    }
                    if (selectedManualPose) {
                        const posePreset = selectedManualPose;
                        const poseSpec = posePreset.library === 'swimShorts' ? sanitizeSwimShortsPosePrompt(posePreset.prompt) : posePreset.prompt;
                        selectedPoseHeader = `# USER SELECTED MANUAL ACTION PRESET: ${posePreset.libraryLabel} / ${posePreset.name} / ${posePreset.id}
# MANUAL ACTION OVERRIDE (CRITICAL - MANDATORY): The user explicitly selected this action from the visible action library UI. For this output, use this selected pose instead of AI-recognized random/auto pose selection.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): Generate the model/product with the EXACT pose, body posture, hand placement, walking/sitting/leaning state, body angle, crop intent, and garment interaction described here: ${poseSpec}. Preserve the product identity from Image 1 with zero design drift, but adapt the body and garment naturally to this selected action.
# PRIORITY RULE: Uploaded action reference images still have higher priority. This manual action applies only to output slots without an uploaded action reference.
`;
                        finalPrompt += `
# MANUAL ACTION LIBRARY DIRECTIVE: Use the user-selected action exactly: ${poseSpec}. Do not fall back to generic catalog standing, do not randomly choose another library action, and do not ignore the selected hand/leg/torso/crop details.
`;
                    } else if (activeAutoPoseLibrary === 'solavibe') {
                        const posePreset = shuffledSolavibePoses[i % shuffledSolavibePoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED SOLAVIBE POSE PRESET: ${posePreset.name} / ${posePreset.id}
# SOLAVIBE BRAND MOOD LOCK (CRITICAL - MANDATORY): This is a plus-size vacation/resort/boho/relaxed comfort commercial hero image, not a Paris fashion week or high-fashion editorial image. Keep the model approachable, relaxed, friendly, confident, and comfortable.
# SOLAVIBE SUBJECT FRAMING (CRITICAL - MANDATORY): Keep the selected ${outputAspectRatio} canvas and compose a warm SHEIN-style Solavibe lookbook image. The product garment must be clearly readable: loose shirt shape, vacation dress flow, two-piece set proportions, wide-leg pants drape, waistline, hem, sleeve/strap/collar details, fabric texture, and comfortable fit.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this Solavibe image with the EXACT relaxed vacation pose and camera intent described here: ${poseSpec}. Preserve product fidelity from Image 1, but body posture, hand placement, pocket/waist/hem/bag interaction, walking/leaning/turning state, head direction, garment drape, body angle, and crop must follow this preset as closely as possible.
# PLUS-SIZE COMFORT RULE: Render realistic plus-size or curvy-friendly proportions when appropriate, natural body balance, flattering 45-degree angles, breathable loose drape, comfortable resort styling, soft smiles or calm expressions, and believable everyday movement. Do not over-slim the body, do not create stiff mannequin posture, and do not replace the product with a luxury runway garment.
# SOLAVIBE SCENE TASTE: If no scene reference overrides it, prefer warm vacation/resort settings such as european small-town streets, seaside resort hotel, white wall architecture, wood balcony, poolside, cafe, palm walkway, resort corridor, beach boardwalk, or warm stone wall architecture.
`;
                        finalPrompt += `\n# SOLAVIBE ACTION LIBRARY DIRECTIVE: Use this selected Solavibe action exactly: ${poseSpec}. This instruction has higher priority than generic womenswear or long-dress pose sets. The product must remain the same product from Image 1 while naturally adapting to a relaxed plus-size vacation resort lookbook mood.\n`;
                    } else if (activeAutoPoseLibrary === 'longDress') {
                        const posePreset = shuffledLongDressPoses[i % shuffledLongDressPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED LONG DRESS POSE PRESET: ${posePreset.name} / ${posePreset.id}
# LONG DRESS SUBJECT FRAMING (CRITICAL - MANDATORY): Keep the selected ${outputAspectRatio} canvas, but compose a premium full-length fashion hero image. The entire long dress/maxi dress must be visible from neckline/shoulders through waist, skirt body, hem, and footwear/contact ground when relevant. Do not crop off the dress hem. The dress is the central product focus.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this long dress hero image with the EXACT pose and motion described here: ${poseSpec}. Preserve product fidelity from Image 1, but body posture, walking/turning/leaning state, hand placement, head direction, dress flow, hem movement, body angle, and crop must follow this preset as closely as possible.
# LONG DRESS FIT RULE: Render realistic feminine proportions, elegant full-length silhouette, natural fabric weight, waist shaping, skirt drape, flowing hem, folds, seams, sleeves/straps/neckline details, and movement. Do not turn the pose into a stiff catalog mannequin stance. Do not replace the product with a different dress, coat, skirt, or gown.
`;
                        finalPrompt += `\n# LONG DRESS ACTION LIBRARY DIRECTIVE: Use this selected long dress action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The long dress product must remain the same product from Image 1 while naturally adapting to the selected quiet-luxury editorial movement.\n`;
                    } else if (activeAutoPoseLibrary === 'womensFashion') {
                        const posePreset = shuffledWomensFashionPoses[i % shuffledWomensFashionPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED WOMENS FASHION POSE PRESET: ${posePreset.name} / ${posePreset.id}
# GENERIC WOMENSWEAR SUBJECT FRAMING (CRITICAL - MANDATORY): Keep the selected ${outputAspectRatio} canvas and create a polished women's fashion lookbook hero image. The product garment must be clearly readable: neckline/collar, sleeve or strap shape, waist/hem, front/side silhouette, fit, fabric drape, texture, trims, and styling details. Crop must support the selected pose while preserving product visibility.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this non-targeted women's apparel image with the EXACT pose and camera intent described here: ${poseSpec}. Preserve product fidelity from Image 1, but body posture, hand placement, walking/sitting/leaning state, head direction, garment drape, body angle, and crop must follow this preset as closely as possible.
# WOMENSWEAR FIT RULE: Render realistic feminine proportions, natural fashion-model balance, clean editorial posture, real fabric weight, believable folds, and natural motion. Do not turn the pose into a stiff mannequin stance. Do not replace the product with a different garment category.
`;
                        finalPrompt += `\n# WOMENS FASHION ACTION LIBRARY DIRECTIVE: Use this selected generic womenswear action exactly: ${poseSpec}. This instruction is for women's apparel that is not covered by a more specific library. It has higher priority than the old generic apparel pose set, while product identity from Image 1 remains absolute.\n`;
                    } else if (activeAutoPoseLibrary === 'swimShorts') {
                        const posePreset = shuffledSwimShortsPoses[i % shuffledSwimShortsPoses.length];
                        const poseSpec = sanitizeSwimShortsPosePrompt(posePreset.prompt);
                        selectedPoseHeader = `# SELECTED SWIM SHORTS POSE PRESET: ${posePreset.name} / ${posePreset.id}
# SWIM SHORTS SUBJECT FRAMING (CRITICAL - MANDATORY): This is NOT a fixed numeric aspect-ratio requirement. Keep the selected output canvas ratio, but compose the male model like the user's swim-shorts reference: visible from upper chest/pectorals down to feet/slides, no face and no head. Keep torso, arms, swim shorts, legs, socks and footwear in frame. The swim shorts must be the central product focus, with waistband, drawstring, pockets, side seams, hem, liner, and fabric texture clearly visible.
# CANVAS FILL LOCK: The entire ${outputAspectRatio} canvas must be one complete image. Do not place a landscape crop inside a portrait canvas. Do not leave blank white bands above or below.
# POSE ONLY DIRECTIVE: You MUST generate this men's swim shorts image with the EXACT pose described here: ${poseSpec}. This pose description contains NO background instruction. Preserve product fidelity from Image 1, but pose, hand placement, waistband interaction, pocket/liner demonstration, body angle, and crop must follow this preset as closely as possible.
# SWIM SHORTS FIT RULE: Render realistic male torso-to-feet anatomy only as needed to sell the shorts; keep attention on the shorts. Avoid face identity emphasis, avoid unrelated tops, hats, sunglasses, bags, and extra accessories unless directly requested. Footwear/slides are allowed when they match the reference crop or scene.
`;
                        finalPrompt += `\n# SWIM SHORTS ACTION LIBRARY DIRECTIVE: Use this selected swim shorts action exactly: ${poseSpec}. Do not force a numeric 4:5 ratio; keep the selected canvas ratio while framing the subject from upper chest/pectorals to feet/slides, matching the provided swim-shorts display effect. The shorts product must remain the same product from Image 1 while naturally adapting to the selected beach/pool/detail demonstration pose.\n`;
                    } else if (activeAutoPoseLibrary === 'mensShorts') {
                        const posePreset = shuffledMensShortsPoses[i % shuffledMensShortsPoses.length];
                        const poseSpec = posePreset.prompt;
                        const bottomCropRule = userExplicitlyRequestedFullBody
                            ? 'The user explicitly requested full-body, so full-body framing is allowed while keeping the shorts as the product focus.'
                            : 'Default shorts framing: do NOT generate a full-body head-to-toe fashion portrait. Use a lower-body product crop similar to ecommerce pants/shorts references: lower torso/waist to shoes, waist to knees, or waist to mid-calf depending on pose. Face/head are optional and should usually be cropped out or de-emphasized.';
                        selectedPoseHeader = `# SELECTED MENS SHORTS POSE PRESET: ${posePreset.name} / ${posePreset.id}
# REGULAR SHORTS CATEGORY LOCK (CRITICAL - MANDATORY): This product is regular men's shorts, NOT swim shorts, swim trunks, board shorts, beach shorts, bathing trunks, or swimwear. Do not add beach/pool/swimwear cues unless the user explicitly requested that scene.
# SHORTS SUBJECT FRAMING (CRITICAL - MANDATORY): ${bottomCropRule} Keep the selected ${outputAspectRatio} canvas and compose a clean SHEIN menswear hero image. The shorts must be the central product focus with waistband, drawstring or belt loops, pockets, side seams, hem, leg opening, inseam length, fit, fabric texture, and silhouette clearly visible.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this men's regular shorts image with the EXACT pose and camera intent described here: ${poseSpec}. Preserve product fidelity from Image 1, but body posture, hand placement, waist/hem/pocket interaction, leg stance, walking/sitting/leaning state, body angle, and crop must follow this preset as closely as possible.
# MENS SHORTS FIT RULE: Render realistic male proportions, natural shorts drape, believable fabric folds, correct leg opening, clean waistband construction, functional pockets, and real casual menswear styling. Do not turn the shorts into swimwear and do not add compression liner unless visible in the product asset.
`;
                        finalPrompt += `\n# MENS SHORTS ACTION LIBRARY DIRECTIVE: Use this selected regular shorts action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The shorts product must remain the same product from Image 1 while naturally adapting to the selected SHEIN menswear pose.\n`;
                    } else if (activeAutoPoseLibrary === 'mensPants') {
                        const posePreset = shuffledMensPantsPoses[i % shuffledMensPantsPoses.length];
                        const poseSpec = posePreset.prompt;
                        const bottomCropRule = userExplicitlyRequestedFullBody
                            ? 'The user explicitly requested full-body, so full-body framing is allowed while keeping the pants as the product focus.'
                            : 'Default pants framing: do NOT generate a full-body head-to-toe fashion portrait. Use a lower-body product crop like the user reference: lower torso/waist to shoes, waist to ankles, or waist to hem break depending on pose. Face/head are optional and should usually be cropped out or de-emphasized.';
                        selectedPoseHeader = `# SELECTED MENS PANTS POSE PRESET: ${posePreset.name} / ${posePreset.id}
# MENS PANTS CATEGORY LOCK (CRITICAL - MANDATORY): This product is men's long pants/trousers/jeans/cargo/chino/linen/jogger style bottoms. Do not convert them into shorts, swimwear, skirt, or unrelated bottoms.
# PANTS SUBJECT FRAMING (CRITICAL - MANDATORY): ${bottomCropRule} Keep the selected ${outputAspectRatio} canvas and compose a premium SHEIN menswear pants image. The pants must be the central product focus with waistband, belt loops or belt, pockets, side seams, leg drape, inseam length, hem break, fit, fabric folds, and silhouette clearly visible.
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this men's pants image with the EXACT pose and camera intent described here: ${poseSpec}. Preserve product fidelity from Image 1, but body posture, hand placement, waistband/belt/pocket/hem interaction, leg stance, walking/sitting/leaning state, body angle, and crop must follow this preset as closely as possible.
# MENS PANTS FIT RULE: Render realistic male proportions, natural trouser drape, correct leg length, believable fabric folds, clean waistband construction, functional pockets, and real commercial menswear styling. Do not make the pose a generic full-body model shot unless the user explicitly requested full body.
`;
                        finalPrompt += `\n# MENS PANTS ACTION LIBRARY DIRECTIVE: Use this selected pants action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The pants product must remain the same product from Image 1 while naturally adapting to the selected SHEIN menswear pose and lower-body product framing.\n`;
                    } else if (activeAutoPoseLibrary === 'mensTee') {
                        const posePreset = shuffledMensTeePoses[i % shuffledMensTeePoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED MENS OVERSIZED TEE POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this men's oversized T-shirt hero image with the EXACT California summer lifestyle pose and camera framing described here: ${poseSpec}. Preserve product fidelity from Image 1, but pose, body posture, hand placement, oversized tee drape, hem interaction, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# TEE-SPECIFIC FIT RULE: Render natural masculine shoulders, relaxed torso, oversized tee silhouette, realistic cotton fabric weight, sleeve drop, hem drape, soft wrinkles, and movement. Do not turn the pose into a stiff catalog mannequin stance.
`;
                        finalPrompt += `\n# MENS TEE ACTION LIBRARY DIRECTIVE: Use this selected oversized tee action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The T-shirt product must remain the same product from Image 1 while naturally adapting to the selected California summer lifestyle movement.\n`;
                    } else if (activeAutoPoseLibrary === 'mensKnit') {
                        const posePreset = shuffledMensKnitPoses[i % shuffledMensKnitPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED MENS KNIT POLO POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this men's knitwear hero image with the EXACT old-money resort pose and camera framing described here: ${poseSpec}. Preserve product fidelity from Image 1, but pose, body posture, hand placement, knit polo drape, collar/hem interaction, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# KNITWEAR-SPECIFIC FIT RULE: Render natural masculine shoulders, relaxed torso, premium textured knit surface, realistic polo collar, sleeve cuff, hem, button placket, ribbed structure, and soft fabric weight. Do not turn the pose into a stiff catalog mannequin stance.
`;
                        finalPrompt += `\n# MENS KNIT ACTION LIBRARY DIRECTIVE: Use this selected men's knit polo action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The knitwear product must remain the same product from Image 1 while naturally adapting to the selected body movement and luxury resort lifestyle context.\n`;
                    } else if (activeAutoPoseLibrary === 'mensShirt') {
                        const posePreset = shuffledMensShirtPoses[i % shuffledMensShirtPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED MENS SHIRT POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this men's shirt hero image with the EXACT resort menswear pose and camera framing described here: ${poseSpec}. Preserve product fidelity from Image 1, but pose, body posture, hand placement, shirt drape, collar/hem interaction, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# SHIRT-SPECIFIC FIT RULE: Render natural masculine shoulders, relaxed torso, realistic shirt placket, collar, hem, sleeves, buttons, fabric drape, and breeze movement when requested. Do not turn the pose into a stiff catalog mannequin stance.
`;
                        
                        finalPrompt += `\n# MENS SHIRT ACTION LIBRARY DIRECTIVE: Use this selected men's resort shirt action exactly: ${poseSpec}. This instruction has higher priority than generic apparel poses. The shirt must remain the same product from Image 1 while naturally adapting to the selected body movement and lifestyle context.\n`;
                    } else if (isSleepwear) {
                        // 从洗牌后的列表中抽取动作，尽量做到彻底打乱且不重复
                        const posePreset = shuffledSleepwearPoses[i % shuffledSleepwearPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT lifestyle pajama pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic catalog standing angles.
`;
                        
                        finalPrompt += `\n# SELECTED PAJAMA POSE: ${posePreset.name} (${poseSpec})\n`;
                        // 强化动作姿态描述，提升优先级，规避呆板站姿
                        finalPrompt += `\n# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate the model in the EXACT lifestyle pajama pose and body posture described here: ${poseSpec}. Completely ignore, bypass, and discard standard, rigid, artificial standing model poses. Focus heavily and render the relaxed limb angles, cozy physical twists, soft pajama creases, leg bends, and comfy sleepy lifestyle poses with 100% fidelity. The final image pose must strictly mirror this directive.\n`;
                    } else if (shouldUseClothingPoseLibrary) {
                        // 从洗牌后的列表中抽取普通服装主图姿态，尽量做到彻底打乱且不重复
                        const posePreset = shuffledClothingPoses[i % shuffledClothingPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM CLOTHING POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT commercial fashion display pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic repeated catalog angles. Preserve product fidelity from Image 1, but pose, body posture, hand placement, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# RANDOMIZATION RULE: Each batch item receives a different shuffled preset. Do not reuse the same default front/side/back/seated four-angle pattern unless those exact presets were selected.
`;
                        
                        finalPrompt += `\n# SELECTED CLOTHING POSE: ${posePreset.name} (${poseSpec})\n`;
                        // 强化普通服装动作渲染指令，锁定高权重动作并突出成衣质感与版型
                        finalPrompt += `\n# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate the model in the EXACT commercial fashion display pose described here: ${poseSpec}. Completely ignore and bypass awkward, rigid, standard dummy postures. Ensure the sweater/knitwear/clothing draping, hem adjustment, pocket insertions, shoulder exposure, or bag carrying action is rendered with 100% realism. The final model's pose and garment geometry must strictly adhere to this directive.\n`;
                    } else if (countToGenerate > 1) {
                        const poseSpec = DIVERSE_POSES[i % DIVERSE_POSES.length];
                        finalPrompt += `\n# SELECTED DIVERSE POSE: ${poseSpec}\n`;
                        finalPrompt += `\n# POSE AND ANGLE DIVERSIFICATION: For this specific image out of the batch, you MUST generate the model in this pose and camera angle: ${poseSpec}. Keep the face structure and environment identical, but vary the body position and shot perspective strictly to match this directive.\n`;
                    }
                }
                if (selectedPoseHeader) {
                    finalPrompt = `${selectedPoseHeader}\n${finalPrompt}`;
                }
                if (perOutputScenePrompt) {
                    finalPrompt += `\n${perOutputScenePrompt}\n`;
                }
                const negativePrompt = [
                    hasOutputActionReference || activeAutoPoseLibrary !== 'none' || !!selectedManualPose
                        ? 'wrong pose, different pose, approximate pose, generic catalog pose, mismatched body angle, changed camera angle, changed crop, changed framing, changed body scale, ignored close-up crop, zoomed-out portrait when reference is close-up, full face visible when reference cuts off the face, full head visible when reference cuts off the head, waist visible when reference is chest-only, legs visible when reference is torso-only, full body when reference is half body, feet visible when reference crop hides feet, legs extended beyond reference crop, pulled-back camera, extra lower body, mirrored pose, reversed left-right direction, front-facing pose when reference is side view, side view when reference is front-facing, missing hand gesture, missing raised arm, missing pocket hand, missing bag-holding arm position, changed shoulder tilt, changed head direction, changed torso rotation, changed hip angle, straightened bent limb, standing pose when reference is seated, seated pose when reference is standing, walking pose when reference is still, still pose when reference is walking, zoomed out, zoomed in, different face, changed identity, different jeans, different pants, inconsistent outfit, outfit drift, copied action reference shirt, copied action reference logo, copied action reference necklace, collage, split screen, side-by-side images, two images in one, multiple panels, before and after, comparison layout, horizontal strip, wide landscape when aspect ratio is portrait, letterbox, pillarbox, large blank white area, empty lower half, copied action reference background, copied action reference architecture, action reference arches, action reference room, action reference interior, action reference wall, action reference floor, action reference furniture, action reference pool, action reference plants, action reference props, beach background from pose library, pool background from pose library, ocean background from pose library'
                        : '',
                    modelReference
                        ? 'original model pants visible under product, model reference pants, model reference jeans, layered pants under shorts, double waistband, duplicate waistband, duplicate shorts hem, duplicate pants hem, double drawstrings, shorts over pants, pants over shorts, overlapping bottoms, mixed product bottom and model bottom, mismatched lower garment, extra shorts, extra pants'
                        : '',
                    modelReference
                        ? 'copied model reference background, model reference scene, model reference wall, model reference floor, model reference ocean, model reference sea, model reference sky, model reference street, model reference architecture, model reference props, model reference furniture, model reference shadow pattern, model reference lighting direction, model reference color temperature, model reference camera crop, model reference lens distance, model identity image environment'
                        : '',
                    'random accessories, inconsistent accessories, styling drift, different pants, different jeans, different skirt, different shoes, different sandals, different boots, different necklace, different earrings, different rings, different watch, different sunglasses, different hat, different bracelet, different bag, different belt, different scarf, extra jewelry, extra watch, extra sunglasses, extra rings, extra bag, invented unplanned accessories, accessory drift between outputs, shoe drift between outputs, bottom outfit drift between outputs',
                    sceneReferences.length > 0
                        ? 'different scene, changed location, unrelated background, different beach, different room, different street, different studio, different architecture, different season, different time of day, missing scene reference cues, missing same-location background anchors, replaced background, invented background props, wrong horizon, wrong ground material, inconsistent lighting direction, inconsistent color temperature, impossible perspective, flat pasted background, mismatched vanishing points, mismatched contact shadows, mismatched lens compression, sharp detailed background in close-up, crisp background behind close subject, no depth of field, artificial backdrop'
                        : 'unrealistic scene, fake studio backdrop, pasted background, mismatched lighting direction, inconsistent color temperature, impossible perspective, missing contact shadows, floating feet, floating dress hem, wrong ground plane, flat cutout look, artificial backdrop, no depth of field when close-up, overprocessed CGI lighting'
                ].filter(Boolean).join(', ') || undefined;

                return generateImageToImage(specificInputImages, finalPrompt, {
                    aspectRatio: outputAspectRatio,
                    resolution,
                    modelId: selectedModel,
                    negativePrompt,
                    hasModelRef: !!modelReference,
                    workflowHint: hasOutputActionReference ? 'hero-pose-lock' : (modelReference ? 'face-lock' : 'scene-product-lock'),
                    signal
                });
            });

            const batchResults = await Promise.all(batchPromises);
            assertCurrentGenerationTask(taskId, signal);
            const flatResults = batchResults.flat();
            const normalizedResults = await normalizeGeneratedImagesToAspectRatio(flatResults, aspectRatio, resolution);
            assertCurrentGenerationTask(taskId, signal);
            const formattedResults = await convertImageDataUrlsFormat(normalizedResults, outputFormat);
            assertCurrentGenerationTask(taskId, signal);
            if (isSingleRegenerate) {
                setGeneratedImages(prev => prev.map((img, idx) => idx === regenerateIndex ? (formattedResults[0] || img) : img));
            } else {
                setGeneratedImages(formattedResults);
            }
            await saveGeneratedProject({
                type: 'RETOUCHING',
                generated: formattedResults,
                original: [
                    ...productImages.map(img => `data:${img.mime};base64,${img.base64}`),
                    ...actionReferences.map(img => `data:${img.mime};base64,${img.base64}`),
                    ...sceneReferences.map(img => `data:${img.mime};base64,${img.base64}`),
                    ...accessoryReferences.map(img => `data:${img.mime};base64,${img.base64}`),
                    ...(modelReference ? [`data:${modelReference.mime};base64,${modelReference.base64}`] : [])
                ],
                prompt: globalPrompt,
                params: {
                    source: 'Cyzx4/components/ImageCleanTab',
                    model: selectedModel,
                    aspectRatio,
                    resolution,
                    outputFormat,
                    count: formattedResults.length,
                    singleRegenerate: isSingleRegenerate,
                    platform: selectedPlatform
                }
            });

        } catch (err) {
            if (!isAbortError(err)) {
                setError(getErrorMessage(err));
            }
        } finally {
            if (stepInterval) clearInterval(stepInterval);
            if (!isCurrentGenerationTask(taskId)) {
                return;
            }
            finishGenerationTask(taskId);
            if (isSingleRegenerate) {
                setRegeneratingIndices(prev => prev.filter(idx => idx !== regenerateIndex));
            } else {
                setIsLoading(false);
                setProgress(100);
            }
        }
    };

    const handleCancelGenerate = () => {
        cancelGenerationTask();
        setIsLoading(false);
        setRegeneratingIndices([]);
        setProgress(0);
    };

    const handleDownload = (img: string, idx: number) => {
        const link = document.createElement('a');
        link.href = img;
        link.download = `hero-${Date.now()}-${idx}.${getImageDownloadExtension(img, outputFormat)}`;
        link.click();
    };

    const handleDownloadAsset = (img: UploadedImage, type: 'product' | 'scene', idx: number) => {
        const source = img.preview || (img.base64 && img.mime ? `data:${img.mime};base64,${img.base64}` : '');
        if (!source) return;

        const extension = img.mime?.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const link = document.createElement('a');
        link.href = source;
        link.download = `${type}-reference-${Date.now()}-${idx + 1}.${extension}`;
        link.click();
    };

    const handleDownloadAll = () => {
        generatedImages.forEach((img, idx) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = img;
                link.download = `hero-all-${Date.now()}-${idx + 1}.${getImageDownloadExtension(img, outputFormat)}`;
                link.click();
            }, idx * 250);
        });
    };

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white custom-scrollbar pb-24">
            {/* Header */}
            <div className="text-center py-6 px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-xs text-pastel-muted mb-2 shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-purple-500" />
                    AI Agent 服装主图专家
                </div>
                <h1 className="text-2xl font-bold text-pastel-text">智能主图生成 (Hero Image)</h1>
            </div>

            <div className="max-w-7xl mx-auto px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    {/* LEFT COLUMN */}
                    <div className="space-y-4">
                        
                        {/* 1. Ratio */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-6 shadow-sm mb-6">
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

                        {/* 1.2 Output Format */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Download className="w-4 h-4 text-pastel-highlight" />
                                <h3 className="font-bold text-pastel-text text-sm">输出格式</h3>
                                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">下载与历史保存格式</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'jpg' as OutputImageFormat, label: 'JPG', desc: '默认' },
                                    { id: 'png' as OutputImageFormat, label: 'PNG', desc: '高清' },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setOutputFormat(item.id)}
                                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${outputFormat === item.id ? 'bg-orange-50 border-pastel-highlight ring-1 ring-orange-100 text-pastel-highlight' : 'bg-pastel-bg/30 border-pastel-border text-pastel-muted hover:border-orange-200'}`}
                                    >
                                        <span className="text-[11px] font-bold">{item.label}</span>
                                        <span className="text-[9px] opacity-60">{item.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Product Assets */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-pastel-highlight" />
                                    <h3 className="font-bold text-pastel-text text-sm">产品素材图</h3>
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1 animate-pulse">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        产品一致性已锁定
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-purple-50/50 px-2 py-0.5 rounded-lg border border-purple-100 shadow-sm" title="开启后，AI 会自动检测并移除产品图背景里的画框、相框、衣架、挂钩等干扰元素，只保留产品主体">
                                    <input 
                                        type="checkbox" 
                                        id="product-purify-toggle"
                                        checked={isProductPurifyEnabled}
                                        onChange={(e) => setIsProductPurifyEnabled(e.target.checked)}
                                        className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                    />
                                    <label htmlFor="product-purify-toggle" className="text-[10px] font-bold text-purple-700 cursor-pointer flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                                        AI背景去噪净化
                                    </label>
                                </div>
                            </div>
                            <div 
                                onClick={() => !isPurifyingProduct && productInputRef.current?.click()} 
                                onMouseEnter={() => setHoveredSlot('product')} 
                                onMouseLeave={() => setHoveredSlot(null)}
                                onDragOver={(e) => handleDragOver(e, 'product')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'product')}
                                className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all overflow-hidden ${
                                    isDragging === 'product' || hoveredSlot === 'product'
                                    ? 'border-pastel-highlight bg-pastel-bg/30' 
                                    : 'border-pastel-border'
                                }`}
                            >
                                <input ref={productInputRef} type="file" multiple className="hidden" onChange={handleProductUpload} accept="image/*" />
                                
                                {isPurifyingProduct && (
                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 p-2">
                                        <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                                        <span className="text-[11px] font-bold text-purple-700 animate-pulse">AI 智能去噪净化中...</span>
                                        <span className="text-[8px] text-pastel-muted">正在擦除衣架、画框、墙面等背景杂质</span>
                                    </div>
                                )}

                                {productImages.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2">
                                        {productImages.map((img, idx) => (
                                            <div key={idx} className="relative group/item">
                                                <img src={img.preview} className="w-full h-20 object-cover rounded-lg border border-pastel-border" alt="product" />
                                                <button
                                                    type="button"
                                                    title="下载这张产品素材图"
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadAsset(img, 'product', idx); }}
                                                    className="absolute bottom-1 right-1 z-20 bg-black/65 text-white rounded-full p-1 opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm hover:bg-black/80"
                                                >
                                                    <Download className="w-3 h-3" />
                                                </button>
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
                            {productImages.length > 0 && autoPoseAnalysis && (
                                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-blue-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Brain className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="font-black shrink-0">AI识别</span>
                                            <span className="truncate">产品：{autoPoseAnalysis.productType}</span>
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                            autoPoseAnalysis.confidence === 'high'
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : autoPoseAnalysis.confidence === 'low'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>
                                            {autoPoseAnalysis.confidence}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-start gap-2 text-blue-700">
                                        <Sparkles className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0" />
                                        <div className="leading-relaxed">
                                            <span className="font-bold">动作库：</span>{autoPoseAnalysis.libraryLabel}
                                            <span className="mx-1 text-blue-300">|</span>
                                            <span>{autoPoseAnalysis.reason}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2.5 Manual Action Library */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                                <div className="flex items-start gap-2 min-w-0">
                                    <Scan className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-pastel-text text-sm">{"\u52a8\u4f5c\u9009\u62e9"}</h3>
                                        <p className="text-[10px] text-pastel-muted mt-0.5 leading-relaxed">AI检测可关闭；检测不准时直接手动选动作库和动作，不再消耗分析次数</p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPoseAutoDetectEnabled((enabled) => {
                                                const next = !enabled;
                                                if (!next) {
                                                    setAutoPoseLibrary('none');
                                                    setAutoPoseAnalysis(null);
                                                    setManualPoseLibraryFilter('all');
                                                } else {
                                                    setManualPoseLibraryFilter('auto');
                                                }
                                                return next;
                                            });
                                        }}
                                        className={`min-h-[36px] px-3 py-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${isPoseAutoDetectEnabled ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-900 border-slate-900 text-white'}`}
                                    >
                                        {isPoseAutoDetectEnabled ? <Brain className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                                        {isPoseAutoDetectEnabled ? 'AI检测开启' : '手动选择'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => detectAutoPoseLibrary(productImages)}
                                        disabled={!isPoseAutoDetectEnabled || productImages.length === 0 || isAnalyzingPoseLibrary}
                                        className="min-h-[36px] px-3 py-2 rounded-xl bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        {isAnalyzingPoseLibrary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        {isAnalyzingPoseLibrary ? '\u5206\u6790\u4e2d' : autoPoseAnalysis ? '\u91cd\u65b0\u5206\u6790' : 'AI \u5206\u6790'}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-purple-100 bg-purple-50/40 px-3 py-2 text-[11px] text-purple-800 mb-3">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-black">{"AI\u68c0\u6d4b"}</span>
                                    <span>{isPoseAutoDetectEnabled ? (autoPoseAnalysis ? autoPoseAnalysis.productType : '\u5c1a\u672a\u5206\u6790') : '已关闭，使用手动动作库'}</span>
                                    <span className="text-purple-300">|</span>
                                    <span className="font-bold">{isPoseAutoDetectEnabled ? (autoPoseAnalysis?.libraryLabel || MANUAL_POSE_LIBRARY_LABELS.clothing) : '全部动作库可选'}</span>
                                    {autoPoseAnalysis && <span className="px-2 py-0.5 rounded-full bg-white border border-purple-100 text-[10px] font-bold">{autoPoseAnalysis.confidence}</span>}
                                </div>
                                {selectedManualPose && (
                                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white border border-purple-100 px-2 py-1.5">
                                        <span className="truncate"><b>{"\u5df2\u624b\u9009"}</b> {selectedManualPose.libraryLabel} / {selectedManualPose.name} #{selectedManualPose.id}</span>
                                        <button type="button" onClick={() => setSelectedManualPoseKey(null)} className="text-[10px] text-red-500 font-bold shrink-0">{"\u6e05\u9664"}</button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 mb-3">
                                <select
                                    value={manualPoseLibraryFilter}
                                    onChange={(e) => setManualPoseLibraryFilter(e.target.value as ManualPoseLibrary | 'auto' | 'all')}
                                    className="min-h-[40px] bg-pastel-bg border border-pastel-border rounded-xl px-3 py-2 text-xs font-bold text-pastel-text focus:outline-none focus:ring-1 focus:ring-purple-200"
                                >
                                    {isPoseAutoDetectEnabled && <option value="auto">{"\u8ddf\u968fAI\u68c0\u6d4b\u5e93"}</option>}
                                    <option value="all">{"\u5168\u90e8\u52a8\u4f5c\u5e93"}</option>
                                    {Object.entries(MANUAL_POSE_LIBRARY_LABELS).filter(([key]) => key !== 'none').map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                                <input
                                    value={manualPoseSearch}
                                    onChange={(e) => setManualPoseSearch(e.target.value)}
                                    placeholder={"\u641c\u7d22\u52a8\u4f5c\u540d / ID / prompt"}
                                    className="min-h-[40px] bg-pastel-bg border border-pastel-border rounded-xl px-3 py-2 text-xs text-pastel-text focus:outline-none focus:ring-1 focus:ring-purple-200"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {visibleManualPoseOptions.map((pose) => (
                                        <button
                                            key={pose.key}
                                            type="button"
                                            title={pose.prompt}
                                            onClick={() => setSelectedManualPoseKey(pose.key)}
                                            className={`min-h-[56px] text-left rounded-xl border px-3 py-2 transition-all ${selectedManualPoseKey === pose.key ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-100' : 'bg-white border-pastel-border hover:border-purple-200 hover:bg-purple-50/30'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-[11px] font-black truncate ${selectedManualPoseKey === pose.key ? 'text-purple-700' : 'text-pastel-text'}`}>{pose.name}</span>
                                                <span className="text-[9px] text-pastel-muted shrink-0">#{pose.id}</span>
                                            </div>
                                            <div className="mt-1 text-[9px] text-purple-500 font-bold truncate">{pose.libraryLabel}</div>
                                        </button>
                                    ))}
                                </div>
                                {visibleManualPoseOptions.length === 0 && (
                                    <div className="py-6 text-center text-xs text-pastel-muted">{"\u6ca1\u6709\u5339\u914d\u7684\u52a8\u4f5c"}</div>
                                )}
                            </div>
                            <div className="mt-3 text-[10px] text-pastel-muted flex flex-wrap items-center gap-2">
                                <span>{"\u5f53\u524d\u663e\u793a"} {visibleManualPoseOptions.length} / {MANUAL_POSE_OPTIONS.length}</span>
                                {actionReferences.length > 0 && <span className="text-purple-600 font-bold">{"\u5df2\u4e0a\u4f20\u52a8\u4f5c\u53c2\u8003\u56fe\u65f6\uff0c\u524d\u51e0\u5f20\u4ecd\u4f18\u5148\u9501\u5b9a\u53c2\u8003\u56fe"}</span>}
                            </div>
                        </div>

                        {/* 3. Specialized References (Pose & Scene) */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Pose */}
                            <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-purple-500" />
                                        <h3 className="font-bold text-pastel-text text-xs text-nowrap">动作参考图</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="仅提取动作姿态，自动过滤动作图里的背景和场景元素">
                                            <input 
                                                type="checkbox" 
                                                checked={isPoseOnly}
                                                onChange={(e) => setIsPoseOnly(e.target.checked)}
                                                className="w-3.5 h-3.5 text-purple-500 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-purple-600 transition-colors font-medium">仅参考姿态</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="Enable safe pose preprocessing">
                                            <input 
                                                type="checkbox" 
                                                checked={isSafeMode}
                                                onChange={(e) => setIsSafeMode(e.target.checked)}
                                                className="w-3.5 h-3.5 text-purple-500 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-purple-600 transition-colors font-medium">安全脱敏</span>
                                        </label>
                                    </div>
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
                                    <input ref={actionInputRef} type="file" multiple className="hidden" onChange={handleActionUpload} accept="image/*" />
                                    {actionReferences.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-1.5 w-full">
                                            {actionReferences.map((img, idx) => (
                                                <div key={idx} className="relative group/action aspect-[3/4] bg-pastel-bg/30 rounded border border-purple-200 overflow-hidden">
                                                    <img src={img.preview} className="w-full h-full object-cover" alt="action" />
                                                    <span className="absolute bottom-0.5 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">#{idx+1}</span>
                                                    {img.width && img.height && (
                                                        <span className="absolute top-0.5 left-1 bg-purple-600/80 text-white text-[7px] px-1 rounded font-bold">
                                                            精确 {closestAspectRatioForImage(img)}
                                                        </span>
                                                    )}
                                                    <span className="absolute bottom-0.5 right-1 bg-purple-700/80 text-white text-[7px] px-1 rounded font-bold">
                                                        锁定图{idx + 1}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); setActionReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-1 right-1 z-20 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/action:opacity-100 transition-opacity shadow-sm"><X className="w-2.5 h-2.5" /></button>
                                                </div>
                                            ))}
                                            {actionReferences.length < 10 && (
                                                <div className="aspect-[3/4] border border-dashed border-purple-200 rounded flex flex-col items-center justify-center text-purple-400 hover:border-purple-300">
                                                    <Upload className="w-4 h-4 text-purple-400" />
                                                    <span className="text-[8px] scale-90 mt-0.5 text-purple-600 font-semibold">继续添加</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Wand2 className="w-6 h-6 mx-auto mb-1 text-purple-300" />
                                            <p className="text-[10px] text-purple-600 font-medium">按顺序锁定前几张结果；其余按补充说明，未指定动作则随机</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Scene */}
                            <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Sun className="w-4 h-4 text-orange-500" />
                                        <h3 className="font-bold text-pastel-text text-xs text-nowrap">场景参考图</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，AI 仅提取场景图的构图与光影，忽略原有主体">
                                            <input 
                                                type="checkbox" 
                                                checked={isSceneOnly}
                                                onChange={(e) => setIsSceneOnly(e.target.checked)}
                                                className="w-3.5 h-3.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-orange-600 transition-colors font-medium">仅场景</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，场景图会自动转为线稿，降低敏感场景拦截">
                                            <input 
                                                type="checkbox" 
                                                checked={isSafeModeScene}
                                                onChange={(e) => setIsSafeModeScene(e.target.checked)}
                                                className="w-3.5 h-3.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-orange-600 transition-colors font-medium">安全脱敏</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="关闭后，上传场景图时不再用 AI 检测人物或自动去人">
                                            <input 
                                                type="checkbox" 
                                                checked={isScenePurifyEnabled}
                                                onChange={(e) => setIsScenePurifyEnabled(e.target.checked)}
                                                className="w-3.5 h-3.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-orange-600 transition-colors font-medium">AI去人</span>
                                        </label>
                                    </div>
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
                                    {isPurifyingScene ? (
                                        <div className="text-center py-4 flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                                            <p className="text-[10px] text-orange-600 font-semibold animate-pulse">正在检测并自动净化场景（去除人像主体）...</p>
                                        </div>
                                    ) : sceneReferences.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-1">
                                            {sceneReferences.map((img, idx) => (
                                                <div key={idx} className="relative group/scene">
                                                    <img src={img.preview} className="w-full h-12 object-cover rounded border border-orange-200" alt="scene" />
                                                    <button
                                                        type="button"
                                                        title="下载这张场景参考图"
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadAsset(img, 'scene', idx); }}
                                                        className="absolute bottom-0.5 right-0.5 z-20 bg-black/65 text-white rounded-full p-0.5 opacity-0 group-hover/scene:opacity-100 transition-opacity shadow-sm hover:bg-black/80"
                                                    >
                                                        <Download className="w-2.5 h-2.5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setSceneReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2" /></button>
                                                </div>
                                            ))}
                                            {sceneReferences.length < 3 && <div className="w-full h-12 border border-dashed border-orange-200 rounded flex items-center justify-center"><Upload className="w-3 h-3 text-orange-300" /></div>}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-orange-300" />
                                            <p className="text-[10px] text-orange-600 font-medium">复制背景与光影</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3.05 Accessory References */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4 text-pink-500" />
                                    <h3 className="font-bold text-pastel-text text-xs text-nowrap">配饰参考图（可选）</h3>
                                    <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full border border-pink-100">包包/首饰/帽子/道具</span>
                                </div>
                                {accessoryReferences.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setAccessoryReferences([])}
                                        className="text-[10px] text-red-500 hover:text-red-600 font-bold"
                                    >
                                        清空
                                    </button>
                                )}
                            </div>
                            <div
                                onClick={() => accessoryInputRef.current?.click()}
                                onMouseEnter={() => setHoveredSlot('accessory')}
                                onMouseLeave={() => setHoveredSlot(null)}
                                onDragOver={(e) => handleDragOver(e, 'accessory')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'accessory')}
                                className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                                    isDragging === 'accessory' || hoveredSlot === 'accessory'
                                    ? 'border-pink-300 bg-pink-50/20'
                                    : 'border-pastel-border'
                                }`}
                            >
                                <input ref={accessoryInputRef} type="file" multiple className="hidden" onChange={handleAccessoryUpload} accept="image/*" />
                                {accessoryReferences.length > 0 ? (
                                    <div className="grid grid-cols-5 gap-2">
                                        {accessoryReferences.map((img, idx) => (
                                            <div key={idx} className="relative group/accessory aspect-square bg-pastel-bg/30 rounded-lg border border-pink-100 overflow-visible">
                                                <img src={img.preview} className="w-full h-full object-cover rounded-lg" alt="accessory" />
                                                <span className="absolute bottom-0.5 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">#{idx + 1}</span>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setAccessoryReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute -top-2 -right-2 z-20 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-100 hover:bg-red-600 transition-colors"><X className="w-2.5 h-2.5" /></button>
                                            </div>
                                        ))}
                                        {accessoryReferences.length < 10 && (
                                            <div className="aspect-square border border-dashed border-pink-200 rounded-lg flex flex-col items-center justify-center text-pink-400 hover:border-pink-300">
                                                <Upload className="w-4 h-4" />
                                                <span className="text-[8px] scale-90 mt-0.5 text-pink-600 font-semibold">继续添加</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <ShoppingBag className="w-6 h-6 mx-auto mb-1 text-pink-300" />
                                        <p className="text-[10px] text-pink-600 font-medium">没有上传则默认不添加包包和配饰</p>
                                        <p className="text-[9px] text-pastel-muted mt-1">支持点击、拖拽、Ctrl+V 粘贴，最多10张</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3.1 Model Identity Locking (Face & Body) */}
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="w-4 h-4 text-blue-500" />
                                    <h3 className="font-bold text-pastel-text text-sm">模特身份固定 (Face & Body)</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer group" title="Only extract model facial identity">
                                            <input 
                                                type="checkbox" 
                                                checked={isFaceOnly}
                                                onChange={(e) => {
                                                    setIsFaceOnly(e.target.checked);
                                                    setModelIdentityAnalysis(null);
                                                }}
                                                className="w-3.5 h-3.5 text-blue-500 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                        <span className="text-[10px] text-gray-500 group-hover:text-blue-600 transition-colors font-medium">仅脸型</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，模特参考图将自动转为线稿，降低敏感人物拦截">
                                        <input 
                                            type="checkbox" 
                                            checked={isSafeModeModel}
                                            onChange={(e) => setIsSafeModeModel(e.target.checked)}
                                            className="w-3.5 h-3.5 text-blue-500 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-gray-500 group-hover:text-blue-600 transition-colors font-medium">安全脱敏</span>
                                    </label>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${modelIdentityAnalysis ? 'bg-emerald-50 text-emerald-600' : isAnalyzingModelIdentity ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {isAnalyzingModelIdentity ? '解析中' : modelIdentityAnalysis ? '已解析' : '固定长相'}
                                    </span>
                                </div>
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
                                            <button onClick={(e) => { e.stopPropagation(); setModelReference(null); setModelIdentityAnalysis(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-2 h-2" /></button>
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
                            
                            {modelIdentityAnalysis && (
                                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 px-3.5 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="text-[11px] font-bold text-blue-700">模特身份解析已锁定</span>
                                    </div>
                                    <div className="space-y-1 text-[10px] leading-relaxed text-slate-600">
                                        {modelIdentityAnalysis.identitySignature && <p><span className="font-bold text-slate-700">身份：</span>{modelIdentityAnalysis.identitySignature}</p>}
                                        {modelIdentityAnalysis.faceLock && <p><span className="font-bold text-slate-700">脸部：</span>{modelIdentityAnalysis.faceLock}</p>}
                                        {!isFaceOnly && modelIdentityAnalysis.hairLock && <p><span className="font-bold text-slate-700">发型：</span>{modelIdentityAnalysis.hairLock}</p>}
                                        {!isFaceOnly && modelIdentityAnalysis.bottomLock && <p><span className="font-bold text-slate-700">下装：</span>{modelIdentityAnalysis.bottomLock}</p>}
                                        {isFaceOnly && <p><span className="font-bold text-slate-700">模式：</span>仅锁定脸部，不读取模特穿搭。</p>}
                                    </div>
                                </div>
                            )}

                            {/* 模特图上传指南展示，平时只显示一个 AI 模特规则，点击可以放大查看 */}
                            <div className="mt-3 bg-purple-50/40 border border-purple-100/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                    </span>
                                    <span className="text-[11px] text-pastel-text font-bold">
                                        如何上传以达到最高准确度？
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={!modelReference || isAnalyzingModelIdentity}
                                        onClick={() => analyzeModelIdentityReference()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all active:scale-95"
                                    >
                                        {isAnalyzingModelIdentity ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                        {isAnalyzingModelIdentity ? '解析中' : modelIdentityAnalysis ? '重新解析' : '解析身份'}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setShowModelGuideModal(true)} 
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-sm hover:from-purple-600 hover:to-indigo-600 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        <Sparkles className="w-3 h-3 text-white animate-pulse" />
                                        AI模特规则
                                    </button>
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
                                    <h3 className="font-bold text-pastel-text text-sm">高级参数与手动覆写</h3>
                                </div>
                                {showAdvanced ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                            </button>

                            {showAdvanced && (
                                <div className="p-4 space-y-4">
                                    {/* Model Selector */}
                                    {/* 图像模型选择 Section */}
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-3">
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
                                                    className={`relative p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center min-h-[85px] ${
                                                        selectedModel === m.id 
                                                        ? 'bg-purple-50/50 border-purple-400 ring-1 ring-purple-100 shadow-sm' 
                                                        : 'bg-white border-pastel-border hover:border-purple-200'
                                                    }`}
                                                >
                                                    <div className="absolute top-2 left-2">
                                                        {m.icon}
                                                    </div>
                                                    <div className={`font-black text-xs mb-1 ${selectedModel === m.id ? 'text-purple-700' : 'text-pastel-text'}`}>{m.name}</div>
                                                    <div className={`text-[9px] font-bold opacity-60 ${selectedModel === m.id ? 'text-purple-600' : 'text-pastel-muted'}`}>{m.sub}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Form */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">产品名称</label><input value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">品类</label><input value={form.productCategory} onChange={e => setForm({...form, productCategory: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">人群</label><select value={form.personaTemplate} onChange={e => setForm({...form, personaTemplate: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs">{PERSONA_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">卖点</label><input value={form.sellingPoints} onChange={e => setForm({...form, sellingPoints: e.target.value})} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs" placeholder="AI 推断" /></div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-pastel-muted font-bold block mb-1">补充说明</label>
                                        <textarea
                                            value={form.extraNotes}
                                            onChange={e => setForm({ ...form, extraNotes: e.target.value })}
                                            className="w-full min-h-[76px] bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-orange-200"
                                            placeholder="例如：除动作参考图外，再生成一张正面全身和一张背面全身。未写特定动作的额外图片会随机生成。"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">清晰度</label><select value={resolution} onChange={e => setResolution(e.target.value as ImageResolution)} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs"><option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option></select></div>
                                        <div>
                                            <label className="text-[10px] text-pastel-muted font-bold block mb-1">
                                                批量 {actionReferences.length > 0 && <span className="text-[8px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-normal border border-purple-100 animate-pulse">前{actionReferences.length}张锁定动作，其余按补充说明/随机动作</span>}
                                            </label>
                                            <select 
                                                value={generateCount} 
                                                onChange={e => setGenerateCount(Number(e.target.value))} 
                                                disabled={false}
                                                className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs disabled:opacity-85 disabled:bg-purple-50/10 disabled:border-purple-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                <option value={1}>1张</option>
                                                <option value={2}>2张</option>
                                                <option value={4}>4张</option>
                                                <option value={6}>6张</option>
                                                <option value={8}>8张</option>
                                                <option value={10}>10张</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => handleGenerate()} disabled={isLoading || productImages.length === 0 || regeneratingIndices.length > 0} className={`flex-1 py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isLoading || productImages.length === 0 || regeneratingIndices.length > 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01]'}`}>
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                {isLoading ? 'Agent 正在绘制...' : '一键生成高品质主图'}
                            </button>
                            {(isLoading || regeneratingIndices.length > 0) && (
                                <button type="button" onClick={handleCancelGenerate} className="px-5 py-4 rounded-2xl font-bold text-white bg-gray-800 hover:bg-gray-900 shadow-lg transition-all">
                                    中止生成
                                </button>
                            )}
                        </div>
                        {cancelMessage && !isLoading && regeneratingIndices.length === 0 && (
                            <div className="text-xs font-bold text-orange-600 text-center">{cancelMessage}</div>
                        )}
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-pastel-border p-5 shadow-sm flex-1 flex flex-col relative min-h-[500px]">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-5 h-5 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-lg">生成结果</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    {error && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium border border-red-100 animate-fade-in">
                                            <AlertCircle className="w-3 h-3" />
                                            {error}
                                        </div>
                                    )}
                                    {generatedImages.length > 0 && !isLoading && (
                                        <button 
                                            type="button"
                                            onClick={handleDownloadAll}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg text-xs font-black shadow-md hover:from-orange-600 hover:to-pink-600 hover:scale-[1.02] active:scale-95 transition-all animate-fade-in"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            全部下载 ({generatedImages.length})
                                        </button>
                                    )}
                                </div>
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
                                                    <button onClick={() => handleGenerate(idx)} disabled={isLoading || regeneratingIndices.includes(idx)} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed" title="重新生成这张"><RefreshCw className={`w-6 h-6 ${regeneratingIndices.includes(idx) ? 'animate-spin' : ''}`} /></button>
                                                    <button onClick={() => handleDownload(img, idx)} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform"><Download className="w-6 h-6" /></button>
                                                </div>
                                                {regeneratingIndices.includes(idx) && (
                                                    <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-orange-600 font-bold text-xs">
                                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                                        <span>正在重新生成...</span>
                                                    </div>
                                                )}
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

            {/* AI 模特规则放大查看弹窗 */}
            {showModelGuideModal && (
                <div 
                    className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300 animate-fade-in"
                    onClick={() => setShowModelGuideModal(false)}
                >
                    <div 
                        className="relative max-w-md w-full bg-white rounded-3xl p-7 shadow-2xl border border-purple-50 flex flex-col gap-5 transform transition-all duration-300 scale-100 hover:shadow-purple-100/40"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 头部标题区 */}
                        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-200 shrink-0">
                                <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
                                    AI 模特身份固定上传规则
                                </h3>
                                <p className="text-[10px] text-gray-400 font-medium">
                                    遵循以下高精度提取准则，可提升生成模特的一致性与质感
                                </p>
                            </div>
                        </div>

                        {/* 规则条目卡片列表 */}
                        <div className="space-y-3">
                            {[
                                {
                                    num: "01",
                                    title: "纯色或简单背景",
                                    desc: "优先提供干净白墙或单色背景的图片，让 AI 更专注提取脸部和体型比例。",
                                    badgeColor: "bg-purple-50 text-purple-600 border border-purple-100"
                                },
                                {
                                    num: "02",
                                    title: "清晰正面半身照",
                                    desc: "建议五官和发型清晰无遮挡，光线均匀，避免强逆光或低头仰头角度。",
                                    badgeColor: "bg-blue-50 text-blue-600 border border-blue-100"
                                },
                                {
                                    num: "03",
                                    title: "穿着素色或紧身衣物",
                                    desc: "贴身衣物能帮助 AI 准确提取体型比例，减少宽大衣服造成的误导。",
                                    badgeColor: "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                },
                                {
                                    num: "04",
                                    title: "避免首饰与配饰遮挡",
                                    desc: "避免大墨镜、项链、围巾或帽子遮挡脸部和颈部特征。",
                                    badgeColor: "bg-amber-50 text-amber-600 border border-amber-100"
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="flex gap-3.5 p-3 bg-pastel-bg/25 border border-pastel-border/60 rounded-2xl hover:border-purple-200 hover:bg-purple-50/10 transition-colors">
                                    <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-sm ${item.badgeColor}`}>
                                        {item.num}
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="text-xs font-extrabold text-gray-800">{item.title}</h4>
                                        <p className="text-[10px] text-gray-500 leading-relaxed font-medium">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 搴曢儴鎸夐挳鍖?*/}
                        <div className="flex gap-3 mt-1">
                            <button 
                                onClick={() => setShowModelGuideModal(false)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-purple-100/60 hover:scale-[1.01] active:scale-95 transition-all text-center"
                            >
                                我已了解，开始上传
                            </button>
                        </div>

                        {/* 鍏抽棴鎸夐挳 */}
                        <button 
                            onClick={() => setShowModelGuideModal(false)} 
                            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeroImageTab;
