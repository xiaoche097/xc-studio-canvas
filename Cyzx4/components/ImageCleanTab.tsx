import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { generateContentWithAnalysisFallback, getErrorMessage, getAiClient } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { QUALITY_BOOSTERS, enhancePrompt } from '../services/promptUtils';
import { extractEdges } from '../utils/imageProcessor';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { CLOTHING_POSES } from '../constants/clothingPresets';
import { MENS_SHIRT_POSES } from '../constants/mensShirtPosePresets';
import { MENS_KNIT_POSES } from '../constants/mensKnitPosePresets';
import { MENS_TEE_POSES } from '../constants/mensTeePosePresets';
import { SWIM_SHORTS_POSES } from '../constants/swimShortsPosePresets';

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

interface HeroFormState {
    productName: string;
    productCategory: string;
    sellingPoints: string;
    avoidElements: string;
    extraNotes: string;
    personaTemplate: string;
}

type AutoPoseLibrary = 'none' | 'mensShirt' | 'mensKnit' | 'mensTee' | 'swimShorts';

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

const normalizeGeneratedImageToAspectRatio = (src: string, targetAspectRatio: AspectRatio): Promise<string> => {
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

            const maxOutputSide = 2048;
            let outputWidth: number;
            let outputHeight: number;
            if (targetRatio >= 1) {
                outputWidth = Math.min(maxOutputSide, Math.max(sourceWidth, sourceHeight));
                outputHeight = Math.round(outputWidth / targetRatio);
            } else {
                outputHeight = Math.min(maxOutputSide, Math.max(sourceWidth, sourceHeight));
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

            outCtx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
            resolve(outCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
};

const normalizeGeneratedImagesToAspectRatio = (images: string[], targetAspectRatio: AspectRatio) => {
    return Promise.all(images.map((img) => normalizeGeneratedImageToAspectRatio(img, targetAspectRatio)));
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
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [isSafeMode, setIsSafeMode] = useState(false); // 鍔ㄤ綔瀹夊叏妯″紡
    const [isPoseOnly, setIsPoseOnly] = useState(true); // 浠呭弬鑰冨Э鎬?(榛樿寮€鍚紝鑷姩鎻愬彇绾跨浠ユ秷闄よ儗鏅共鎵?
    const [isSafeModeScene, setIsSafeModeScene] = useState(false); // 鍦烘櫙瀹夊叏妯″紡
    const [isSafeModeModel, setIsSafeModeModel] = useState(false); // 妯＄壒瀹夊叏妯″紡
    const [isFaceOnly, setIsFaceOnly] = useState(false); // 浠呭弬鑰冭劯鍨?
    const [isSceneOnly, setIsSceneOnly] = useState(false); // 浠呭弬鑰冨満鏅?
    const [isPurifyingScene, setIsPurifyingScene] = useState(false); // 姝ｅ湪鑷姩鍑€鍖栧満鏅浘
    const [isPurifyingProduct, setIsPurifyingProduct] = useState(false); // 姝ｅ湪鑷姩鍑€鍖栦骇鍝佺礌鏉愬浘
    const [isProductPurifyEnabled, setIsProductPurifyEnabled] = useState(true); // 鏄惁寮€鍚骇鍝佸浘AI鍘诲櫔鍑€鍖?
    const [showModelGuideModal, setShowModelGuideModal] = useState(false); // 鎺у埗AI妯＄壒瑙勫垯涓婁紶鎸囧崡寮圭獥鐨勬樉绀?
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
    
    // Refs
    const productInputRef = useRef<HTMLInputElement>(null);
    const actionInputRef = useRef<HTMLInputElement>(null);
    const sceneInputRef = useRef<HTMLInputElement>(null);
    const accessoryInputRef = useRef<HTMLInputElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const [hoveredSlot, setHoveredSlot] = useState<'product' | 'action' | 'scene' | 'accessory' | 'model' | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);

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
            return;
        }

        const normalizeLibrary = (value: string): AutoPoseLibrary => {
            const normalized = value.trim().toLowerCase();
            if (normalized.includes('swim') || normalized.includes('boardshort') || normalized.includes('board short') || normalized.includes('trunk')) return 'swimShorts';
            if (normalized.includes('tee') || normalized.includes('tshirt') || normalized.includes('t-shirt')) return 'mensTee';
            if (normalized.includes('knit') || normalized.includes('polo')) return 'mensKnit';
            if (normalized.includes('shirt')) return 'mensShirt';
            return 'none';
        };

        try {
            const ai = getAiClient();
            const parts: any[] = images.slice(0, 2).map(img => ({
                inlineData: { mimeType: img.mime!, data: img.base64! }
            }));
            parts.push({
                text: `Classify these uploaded product images for an ecommerce menswear pose library.
Return ONLY valid JSON: {"library":"mensShirt|mensKnit|mensTee|swimShorts|none","reason":"short reason"}.

Choose:
- mensShirt: men's woven button shirt, resort shirt, linen shirt, Hawaiian shirt, button-up shirt.
- mensKnit: men's knit polo, textured knit polo, knitted top, sweater-like short sleeve, ribbed knit menswear.
- mensTee: men's T-shirt, oversized tee, graphic tee, cotton short-sleeve tee.
- swimShorts: men's swim shorts, swim trunks, board shorts, beach shorts, quick-dry swimwear shorts, bathing trunks, swimwear bottom with drawstring or liner.
- none: not one of the above or uncertain.

Use visual garment structure first. User note: ${userPrompt || 'none'}`
            });

            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: { parts }
            }, { timeoutMs: 30000, fallbackTimeoutMs: 45000 });
            const text = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(text);
            setAutoPoseLibrary(normalizeLibrary(parsed.library || 'none'));
        } catch (err) {
            console.warn('Auto pose library detection failed, using no built-in library.', err);
            setAutoPoseLibrary('none');
        }
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        
        if (isProductPurifyEnabled && processed.length > 0) {
            setIsPurifyingProduct(true);
            setError(null);
            try {
                const purified = await Promise.all(processed.map(async (img) => {
                    // 1. 蹇€熸娴嬩骇鍝佸浘鑳屾櫙涓槸鍚﹀寘鍚。鏋躲€佺敾妗嗐€佹寕閽╃瓑骞叉壈
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
                        // 2. 璋冪敤 editGeneratedImage 鎿﹂櫎琛ｆ湇浠ュ鐨勮儗鏅€佽。鏋跺拰鐢绘
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
                void detectAutoPoseLibrary(purified);
            } catch (err) {
                console.error("Purify product image failed:", err);
                // 闄嶇骇鍥為€€鍒板師濮嬪浘鐗?
                setProductImages(prev => [...prev, ...processed].slice(0, 4));
                void detectAutoPoseLibrary(processed);
            } finally {
                setIsPurifyingProduct(false);
            }
        } else {
            setProductImages(prev => [...prev, ...processed].slice(0, 4));
            void detectAutoPoseLibrary(processed);
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
        
        setIsPurifyingScene(true);
        setError(null);
        try {
            const purified = await Promise.all(processed.map(async (img) => {
                // 1. 蹇€熸娴嬪浘鐗囦腑鏄惁鍖呭惈浜虹墿
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
                    // 2. 璋冪敤 editGeneratedImage 鍘婚櫎浜虹墿涓讳綋锛屽噣鍖栬儗鏅?
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
            // 鍥為€€鍒板師濮嬪浘鐗?
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
            setError("AI 鍒嗘瀽澶辫触");
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
  "needsBottom": "yes/no and why",
  "unifiedBottom": "one consistent pants/skirt/shorts recommendation if missing from product asset; include color, fit, rise, fabric, and why it matches",
  "unifiedShoes": "one consistent shoe recommendation if feet may be visible",
  "unifiedBag": "one consistent bag recommendation; use none if it would distract",
  "unifiedJewelry": "one consistent minimal jewelry/accessory recommendation",
  "avoidStyling": "styling details to avoid because they conflict with the product"
}
Rules:
- If pants/bottoms are not clearly part of the product asset, recommend a unified bottom to use across ALL generated outputs.
- If bags, shoes, belts, jewelry, or props are not in the product asset, recommend none unless the user has uploaded separate accessory reference images.
- The product garment itself is highest priority and must remain identical to the reference.
- Recommendations must be practical SHEIN/Amazon ecommerce styling, not editorial fantasy.
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
                `- Bottom coverage need: ${parsed.needsBottom || 'infer from product image'}`,
                `- Unified bottom for ALL images: ${parsed.unifiedBottom || 'consistent light-wash straight-leg denim jeans if bottom is not part of the product asset'}`,
                `- Unified shoes for ALL images: ${parsed.unifiedShoes || 'minimal neutral shoes only when visible'}`,
                `- Unified bag for ALL images: ${accessoryReferences.length > 0 ? (parsed.unifiedBag || 'follow uploaded accessory reference images exactly') : 'none; do not invent bags or handheld props'}`,
                `- Unified jewelry/accessories for ALL images: ${accessoryReferences.length > 0 ? (parsed.unifiedJewelry || 'follow uploaded accessory reference images exactly') : 'none unless already visible in the product asset'}`,
                `- Avoid styling: ${parsed.avoidStyling || 'avoid changing the product garment or adding distracting accessories'}`,
                '- CONSISTENCY RULE: pants, shoes, bags, belts, jewelry, and visible accessories must stay the same style/color/material across every image in this batch unless they are physically hidden by the crop.'
            ].join('\n');
        } catch (err) {
            console.warn('Hero styling plan analysis failed, using fallback.', err);
            return fallback;
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
            // 1. 棰勫鐞嗘墍鏈夊浘鐗囷紙濡傛灉寮€鍚畨鍏ㄦā寮忔垨浠呭弬鑰冨Э鎬侊紝鍒欏姩浣滃浘杞崲涓虹嚎绋跨嚎娈典互鍓旈櫎鑳屾櫙骞叉壈锛?
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
            const processedModel = await processRefImage(modelReference, isSafeModeModel);
            const processedScenes = await Promise.all(
                sceneReferences.map(img => processRefImage(img, isSafeModeScene))
            );
            const processedAccessories = await Promise.all(
                accessoryReferences.map(img => processRefImage(img, false))
            );

            // 2. 鏋勫缓鍥剧墖搴忓垪 (鏀寔鏍规嵁鍔ㄤ綔鍥剧储寮曡繘琛屽姩鎬佺嫭绔嬪榻?
            // 涓ユ牸鍖归厤 API 涓?Prompt 濂戠害锛氫骇鍝佸浘蹇呴』浣滀负 Image 1 (棣栧紶鍥剧墖) 浼犲叆浠ョ‘淇?100% 涓€鑷存€ч攣瀹氾紒
            const getInputImagesForIndex = (actionIndex?: number) => {
                const list: { base64: string; mimeType: string }[] = [];
                
                // [绗竴浼樺厛绾 娣诲姞浜у搧鍥句綔涓洪寮犲浘鐗?(Image 1)锛岃繖涓?Prompt 涓殑 "# CRITICAL REQUIREMENT: The FIRST IMAGE is the [PRODUCT ASSET]" 瀹岀編瀵归綈
                productImages.forEach(img => {
                    const isAlreadyAdded = actionReferences.some(ar => ar.base64 === img.base64);
                    if (!isAlreadyAdded) {
                        list.push({ base64: img.base64!, mimeType: img.mime! });
                    }
                });

                // [绗簩浼樺厛绾 娣诲姞妯＄壒鍥撅紝浣滀负浜鸿劯鐗瑰緛鍜岄暱鐩哥殑缁濆鍙傝€冿紙浼犲叆涓ゆ浠ュ弻鍊嶅寮?AI 鐨勬敞鎰忓姏闀跨浉閿佸畾鏉冮噸锛?
                processedAccessories.forEach(img => {
                    if (img) list.push(img);
                });

                if (processedModel) {
                    list.push(processedModel);
                    list.push(processedModel);
                }
                
                // [绗笁浼樺厛绾 娣诲姞鐗瑰畾鐨勫姩浣滃Э鎬佸弬鑰冨浘锛屼綔涓哄Э鎬佸榻愮殑鏋勫浘閿氱偣
                const selectedAction = typeof actionIndex === 'number' && processedActions[actionIndex]
                    ? processedActions[actionIndex]
                    : null;
                const shouldUseActionOriginal = !!selectedAction?.original && activeAutoPoseLibrary !== 'swimShorts';
                const actionOriginalStart = shouldUseActionOriginal ? list.length + 1 : 0;
                if (shouldUseActionOriginal && selectedAction?.original) {
                    list.push(selectedAction.original);
                    list.push(selectedAction.original);
                    if (!isPoseOnly) list.push(selectedAction.original);
                }
                const actionLineartStart = selectedAction?.lineart ? list.length + 1 : 0;
                if (selectedAction?.lineart) {
                    list.push(selectedAction.lineart);
                    list.push(selectedAction.lineart);
                }
                
                // [绗洓浼樺厛绾 娣诲姞鑳屾櫙鍦烘櫙鍙傝€冨浘
                processedScenes.forEach(img => {
                    if (img) list.push(img);
                });
                
                return {
                    images: list,
                    actionOriginalStart,
                    actionOriginalEnd: actionOriginalStart ? actionOriginalStart + (isPoseOnly ? 1 : 2) : 0,
                    actionLineartStart,
                    actionLineartEnd: actionLineartStart ? actionLineartStart + 1 : 0
                };
            };

            // 3. 鏋勫缓 Prompt 绛栫暐涓庡弬鑰冨浘 1-based 鍔ㄦ€佺储寮曡绠椾互瑙ｅ喅 Gemini 澶氭ā鎬佹槧灏勯敊浣嶉棶棰?
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
                    ? `Action: uploaded action references constrain only their matching output slots; non-matching outputs use intelligent random/auto poses`
                    : `Action: intelligent pose matching`,
                `Quality: ${QUALITY_BOOSTERS.EDITORIAL}`
            ].join(' | ');

            let basePrompt = enhancePrompt(userPrompt || `High-end fashion photography, ${form.personaTemplate} wearing ${form.productName}, studio background.`, 'PRODUCT');
            
            // 浠绘剰涓€绉嶅畨鍏ㄦā寮忓紑鍚潎鎵ц Prompt 鍑€鍖?
            if (isSafeMode || isSafeModeScene || isSafeModeModel) {
                basePrompt = basePrompt.replace(/鎯呰叮|鎬ф劅|閫忚|璇辨儜|sexy|erotic/gi, '鏃跺皻');
                basePrompt = basePrompt.replace(/鍐呰。|鐫¤。|lingerie/gi, '楂樺畾娉宠');
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
                        `- Images ${modelIndexStart}-${modelIndexEnd} are FACE IDENTITY references only.`,
                        '- Preserve only the model face/head identity: face shape, facial proportions, eyes, eyebrows, nose, lips, jaw/chin, expression, and visible skin tone.',
                        activeModelIdentityAnalysis?.promptBlock ? `- AI analyzed face contract: ${activeModelIdentityAnalysis.promptBlock}` : '',
                        activeModelIdentityAnalysis?.faceLock ? `- Face lock: ${activeModelIdentityAnalysis.faceLock}` : '',
                        '- Do NOT use the model reference clothing, jeans/pants, shoes, accessories, body pose, body shape, or outfit styling as constraints.',
                        '- Clothing and styling must come from the product asset, accessory references, user prompt, and platform styling only.'
                    ].filter(Boolean).join('\n')
                    : [
                        '# MODEL IDENTITY LOCK + LOW-PRIORITY WARDROBE CONTEXT:',
                        `- Images ${modelIndexStart}-${modelIndexEnd} are the fixed model identity references. Preserve the same face, facial proportions, hair color/style, skin tone, body proportions, and overall person identity in EVERY output.`,
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
            const getSupplementaryNotesPrompt = (isActionLockedOutput: boolean, outputNumber: number) => {
                if (!supplementalNotes) return '';
                return isActionLockedOutput
                    ? `# USER SUPPLEMENTARY NOTES FOR OUTPUT #${outputNumber} (LOW-PRIORITY CONTEXT ONLY): ${supplementalNotes}
# ACTION-LOCK CONFLICT RULE: For this output, ignore any supplementary-note requests about front/back/side view, full-body, half-body, camera angle, crop, pose, walking/sitting/standing state, or shot sequence. Those notes may influence only product styling, selling-point emphasis, mood, and non-pose details. The uploaded action reference controls pose, angle, subject scale, crop boundary, and visible body extent.`
                    : `# USER SUPPLEMENTARY NOTES FOR OUTPUT #${outputNumber} (MUST FOLLOW): ${supplementalNotes}
# USER REQUESTED ANGLES / FRAMING PRIORITY: This output has no matching uploaded action reference. If the notes mention front/back/side/three-quarter view, full-body/half-body crop, walking/sitting/standing state, camera framing, or required shot sequence, obey those instructions with high priority while preserving product fidelity. If the notes do not request a specific pose or angle for this output, choose a varied random/auto commercial pose.`;
            };

            const globalPrompt = `
            # AGENT STRATEGY: ${strategy}
            # MISSION: Professional commercial product photography with MANDATORY PRODUCT CONSISTENCY.
            # ABSOLUTE CANVAS RULE:
            The final output MUST be exactly ${aspectRatio}. Fill the ${aspectRatio} canvas with one continuous image. No nested photo, no framed image inside a white page, no letterbox, no pillarbox, no top/bottom blank bands, no side blank bands, no white empty lower half, no collage, no split screen, no comparison grid.
            
            # CRITICAL REQUIREMENT - MAXIMUM PRODUCT FIDELITY (HIGHEST PRIORITY): 
            The FIRST IMAGE (Image 1) is the [PRODUCT ASSET]. You MUST preserve its exact structural design, clothing shape, collar style, neck cuts, sleeves, pockets, fabric texture, prints/patterns (e.g. leopard print or stripes), stitching, and materials perfectly. 
            The clothing on the generated model MUST be a 100% pixel-accurate high-fidelity replica of this product asset, with ZERO structure changes or textile/fabric details loss. 
            # PRODUCT GARMENT SUPREMACY / NO LAYERING:
            The uploaded product images may include a full coordinated set, matching shorts, pants, skirt, suit bottom, pajama bottom, or other lower-body garment. If any product image shows such a bottom piece, it is part of the product and MUST replace any pants/jeans/shorts from the model identity reference.
            Never combine, stack, or blend the model reference bottom with the product bottom. Do NOT render original model pants visible underneath product shorts/pants. Do NOT create duplicate waistbands, duplicate hems, double drawstrings, double leg openings, or a layered pants-under-shorts artifact.
            **BACKGROUND NOISE ISOLATION (STRICT)**: You MUST completely and absolutely ignore, block, and discard any background elements present in the product asset image, including clothes hangers, hooks, picture frames on the wall, hanging art, wall stripes, wooden frames, shadow boards, stands, or room walls. 
            DO NOT generate or allow ANY of these product background items to appear in the final model's scene background. You must isolate ONLY the clothing itself from the product asset.
            
            ${unifiedStylingPlan}
            
            ${platformPrompt ? `# PLATFORM VISUAL GENE: ${platformPrompt}` : ''}
            ${accessoryReferences.length > 0 ? `# ACCESSORY REFERENCE DIRECTIVE (OPTIONAL BUT STRICT): Images ${accessoryIndexStart} to ${accessoryIndexEnd} are the ONLY authorized accessory references. If they show a bag, purse, jewelry, hat, belt, scarf, or handheld prop, include it only when naturally compatible with the selected pose, and preserve its exact color, material, size, shape, strap/handle direction, hardware, and placement logic. Do NOT invent extra accessories beyond these images.` : '# NO EXTRA ACCESSORY DIRECTIVE: The user did not upload accessory reference images. Do NOT add handbags, purses, hats, scarves, belts, sunglasses, jewelry, handheld props, or decorative accessories unless they are already part of the product asset. Keep styling clean and product-focused.'}
            ${modelWardrobeLock}
            ${measurementStr ? `# BODY PROPORTIONS: ${measurementStr}` : ''}
            # OUTPUT FORMAT LOCK: Generate exactly one image in the user-selected ${aspectRatio} aspect ratio. No collage, no split-screen, no side-by-side images, no before/after layout, no horizontal strip, no letterbox/pillarbox, no large blank white canvas.
            ${actionReferences.length > 0 ? '# ACTION REFERENCE IS POSE ONLY: Uploaded action references control only body pose and gesture. They must NOT control background, environment, lighting, product color, or output aspect ratio.' : ''}
            ${sceneReferences.length > 0
                ? `# SCENE FIDELITY (MANDATORY BACKGROUND SOURCE): You MUST replicate the uploaded scene reference background, environment, layout, walls, props, ambient lighting, shadows, and architectural details EXACTLY. The generated subject must be placed seamlessly into this exact scene environment. Action references must not override this background.`
                : (selectedPlatform === 'amazon' ? '# SCENE: Pure white background (#FFFFFF), clean studio lighting, centered.' : '# SCENE: Professional studio or high-end lifestyle background, minimalist.')}
            
            # CAMERA: ${cameraDevice !== '智能推荐' ? cameraDevice : 'Professional high-end commercial camera'}
            # SHOT: ${shotType !== '智能推荐' ? shotType : 'Optimal commercial framing'}
            
            # DESCRIPTION: ${basePrompt}
            # SUPPLEMENTARY NOTE ROUTING:
            User supplementary notes are applied per output slot. Outputs with a matching uploaded action reference use those notes only as low-priority style/product context; outputs without a matching uploaded action reference use those notes as high-priority angle/framing instructions. If extra outputs have no specific pose/angle requested in the notes, generate them with varied random/auto poses.
            # FINAL OUTPUT: High-fidelity, commercial-grade asset with strict geometric locking for the product.
            `;

            const countToGenerate = Math.max(generateCount, actionReferences.length);

            // 妫€鏌ユ槸鍚︿负鐫¤。/瀹跺眳鏈嶇郴鍒椾骇鍝?
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

            const activeAutoPoseLibrary: AutoPoseLibrary = autoPoseLibrary !== 'none'
                ? autoPoseLibrary
                : isSwimShorts
                    ? 'swimShorts'
                    : isMensTee
                        ? 'mensTee'
                        : isMensKnit
                            ? 'mensKnit'
                            : isMensShirt
                                ? 'mensShirt'
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

            // 褰诲簳娲楃墝鎵撲贡 230 涓潯琛ｅЭ鎬侀璁惧垪琛紝纭繚鎵归噺鐢熸垚鐨勬瘡涓€寮犲浘鍒嗛厤鍒扮殑鐫¤。濮挎€侀兘鏄粷瀵归殢鏈轰笖涓嶉噸澶嶇殑
            let shuffledSleepwearPoses = [...SLEEPWEAR_POSES];
            if (isSleepwear) {
                for (let k = shuffledSleepwearPoses.length - 1; k > 0; k--) {
                    const r = Math.floor(Math.random() * (k + 1));
                    [shuffledSleepwearPoses[k], shuffledSleepwearPoses[r]] = [shuffledSleepwearPoses[r], shuffledSleepwearPoses[k]];
                }
            }

            // 褰诲簳娲楃墝鎵撲贡 160 涓櫘閫氭湇瑁呭Э鎬侀璁惧垪琛紝纭繚鎵归噺鐢熸垚鐨勬瘡涓€寮犲浘鍒嗛厤鍒扮殑濮挎€侀兘鏄粷瀵归殢鏈轰笖涓嶉噸澶嶇殑
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

            const generationIndices = isSingleRegenerate ? [regenerateIndex!] : Array.from({ length: countToGenerate }, (_, i) => i);
            const batchPromises = generationIndices.map((i) => {
                const actionReferenceIndex = i < actionReferences.length ? i : undefined;
                const hasOutputActionReference = typeof actionReferenceIndex === 'number';
                const inputPack = getInputImagesForIndex(actionReferenceIndex);
                const specificInputImages = inputPack.images;
                const matchedActionReference = hasOutputActionReference ? actionReferences[actionReferenceIndex!] : null;
                const outputAspectRatio = aspectRatio;
                const actionReferenceInputDescription = inputPack.actionOriginalStart
                    ? `Original action reference ${inputPack.actionOriginalStart === inputPack.actionOriginalEnd ? `is Image ${inputPack.actionOriginalStart}` : `images are Images ${inputPack.actionOriginalStart}-${inputPack.actionOriginalEnd}`}; extracted pose/edge map is Image ${inputPack.actionLineartStart}. The ORIGINAL action reference is the framing/crop master: use it to read exact camera distance, visible body extent, cut-off boundaries, product-display area, and close-up/detail crop. Use the edge map only as supporting pose clarification. Do NOT copy the original action reference's clothing, logo, necklace, face identity, skin details, background, or lighting.`
                    : `Extracted pose/edge maps are Images ${inputPack.actionLineartStart}-${inputPack.actionLineartEnd}. The original action photo is intentionally not included because pose-only mode is enabled; use these edge maps as the clean skeleton/gesture blueprint.`;
                
                const outputNumber = i + 1;
                const perOutputSupplementaryNotes = getSupplementaryNotesPrompt(hasOutputActionReference, outputNumber);
                let finalPrompt = globalPrompt;
                let selectedPoseHeader = '';
                if (hasOutputActionReference) {
                    const actionFrameNote = getPoseReferenceFrameNote(actionReferences[actionReferenceIndex], actionReferenceIndex);
                    selectedPoseHeader = `# EXACT USER ACTION REFERENCE FOR THIS OUTPUT (ABSOLUTE):
Output #${outputNumber} is reserved for uploaded action reference #${actionReferenceIndex + 1}. This output slot must replicate that reference's angle, pose, subject scale, crop boundary, and visible body extent. The action reference images included in this input are the strongest geometry constraint for THIS IMAGE ONLY.
${actionFrameNote}
${actionReferenceInputDescription}
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
                    if (activeAutoPoseLibrary === 'swimShorts') {
                        const posePreset = shuffledSwimShortsPoses[i % shuffledSwimShortsPoses.length];
                        const poseSpec = sanitizeSwimShortsPosePrompt(posePreset.prompt);
                        selectedPoseHeader = `# SELECTED SWIM SHORTS POSE PRESET: ${posePreset.name} / ${posePreset.id}
# SWIM SHORTS SUBJECT FRAMING (CRITICAL - MANDATORY): This is NOT a fixed numeric aspect-ratio requirement. Keep the selected output canvas ratio, but compose the male model like the user's swim-shorts reference: visible from upper chest/pectorals down to feet/slides, no face and no head. Keep torso, arms, swim shorts, legs, socks and footwear in frame. The swim shorts must be the central product focus, with waistband, drawstring, pockets, side seams, hem, liner, and fabric texture clearly visible.
# CANVAS FILL LOCK: The entire ${outputAspectRatio} canvas must be one complete image. Do not place a landscape crop inside a portrait canvas. Do not leave blank white bands above or below.
# POSE ONLY DIRECTIVE: You MUST generate this men's swim shorts image with the EXACT pose described here: ${poseSpec}. This pose description contains NO background instruction. Preserve product fidelity from Image 1, but pose, hand placement, waistband interaction, pocket/liner demonstration, body angle, and crop must follow this preset as closely as possible.
# SWIM SHORTS FIT RULE: Render realistic male torso-to-feet anatomy only as needed to sell the shorts; keep attention on the shorts. Avoid face identity emphasis, avoid unrelated tops, hats, sunglasses, bags, and extra accessories unless directly requested. Footwear/slides are allowed when they match the reference crop or scene.
`;
                        finalPrompt += `\n# SWIM SHORTS ACTION LIBRARY DIRECTIVE: Use this selected swim shorts action exactly: ${poseSpec}. Do not force a numeric 4:5 ratio; keep the selected canvas ratio while framing the subject from upper chest/pectorals to feet/slides, matching the provided swim-shorts display effect. The shorts product must remain the same product from Image 1 while naturally adapting to the selected beach/pool/detail demonstration pose.\n`;
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
                        // 椤哄簭浠庢礂鐗屽悗鐨勫垪琛ㄤ腑鎶藉彇鍔ㄤ綔锛屽疄鐜扳€?00%褰诲簳鎵撲贡涓斾笉閲嶅鐢ㄥ埌鈥?
                        const posePreset = shuffledSleepwearPoses[i % shuffledSleepwearPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT lifestyle pajama pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic catalog standing angles.
`;
                        
                        finalPrompt += `\n# SELECTED PAJAMA POSE: ${posePreset.name} (${poseSpec})\n`;
                        // 鏋佸ぇ寮哄寲瀵逛簬鍔ㄤ綔濮挎€佺殑鎻忚堪锛岃祴浜堟渶楂樻潈閲嶄笌浼樺厛绾э紝褰诲簳瑙勯伩鍛嗘澘鏅€氱殑绔欏Э
                        finalPrompt += `\n# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate the model in the EXACT lifestyle pajama pose and body posture described here: ${poseSpec}. Completely ignore, bypass, and discard standard, rigid, artificial standing model poses. Focus heavily and render the relaxed limb angles, cozy physical twists, soft pajama creases, leg bends, and comfy sleepy lifestyle poses with 100% fidelity. The final image pose must strictly mirror this directive.\n`;
                    } else if (shouldUseClothingPoseLibrary) {
                        // 椤哄簭浠庢礂鐗屽悗鐨勫垪琛ㄤ腑鎶藉彇鏅€氭湇瑁呬富鍥惧Э鎬侊紝瀹炵幇鈥?00%褰诲簳鎵撲贡涓斾笉閲嶅鐢ㄥ埌鈥?
                        const posePreset = shuffledClothingPoses[i % shuffledClothingPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM CLOTHING POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT commercial fashion display pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic repeated catalog angles. Preserve product fidelity from Image 1, but pose, body posture, hand placement, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# RANDOMIZATION RULE: Each batch item receives a different shuffled preset. Do not reuse the same default front/side/back/seated four-angle pattern unless those exact presets were selected.
`;
                        
                        finalPrompt += `\n# SELECTED CLOTHING POSE: ${posePreset.name} (${poseSpec})\n`;
                        // 寮哄寲鏅€氭湇瑁呭姩浣滄覆鏌撴寚浠わ紝楂樻潈閲嶉攣瀹氾紝鏉滅粷姝绘澘濮垮娍锛屽己鍖栧紑琛?閽堢粐琛瓑鏃ュ父鎴愯。鐨勮川鎰熶笌鐗堝瀷灞曠幇
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
                const negativePrompt = [
                    hasOutputActionReference || activeAutoPoseLibrary !== 'none'
                        ? 'wrong pose, different pose, approximate pose, generic catalog pose, mismatched body angle, changed camera angle, changed crop, changed framing, changed body scale, ignored close-up crop, zoomed-out portrait when reference is close-up, full face visible when reference cuts off the face, full head visible when reference cuts off the head, waist visible when reference is chest-only, legs visible when reference is torso-only, full body when reference is half body, feet visible when reference crop hides feet, legs extended beyond reference crop, pulled-back camera, extra lower body, mirrored pose, reversed left-right direction, front-facing pose when reference is side view, side view when reference is front-facing, missing hand gesture, missing raised arm, missing pocket hand, missing bag-holding arm position, changed shoulder tilt, changed head direction, changed torso rotation, changed hip angle, straightened bent limb, standing pose when reference is seated, seated pose when reference is standing, walking pose when reference is still, still pose when reference is walking, zoomed out, zoomed in, different face, changed identity, different jeans, different pants, inconsistent outfit, outfit drift, copied action reference shirt, copied action reference logo, copied action reference necklace, collage, split screen, side-by-side images, two images in one, multiple panels, before and after, comparison layout, horizontal strip, wide landscape when aspect ratio is portrait, letterbox, pillarbox, large blank white area, empty lower half, copied action reference background, beach background from pose library, pool background from pose library, ocean background from pose library'
                        : '',
                    modelReference
                        ? 'original model pants visible under product, model reference pants, model reference jeans, layered pants under shorts, double waistband, duplicate waistband, duplicate shorts hem, duplicate pants hem, double drawstrings, shorts over pants, pants over shorts, overlapping bottoms, mixed product bottom and model bottom, mismatched lower garment, extra shorts, extra pants'
                        : ''
                ].filter(Boolean).join(', ') || undefined;

                return generateImageToImage(specificInputImages, finalPrompt, {
                    aspectRatio: outputAspectRatio,
                    resolution,
                    modelId: selectedModel,
                    negativePrompt,
                    hasModelRef: !!modelReference,
                    workflowHint: hasOutputActionReference ? 'hero-pose-lock' : (modelReference ? 'face-lock' : 'scene-product-lock')
                });
            });

            const batchResults = await Promise.all(batchPromises);
            const flatResults = batchResults.flat();
            const normalizedResults = await normalizeGeneratedImagesToAspectRatio(flatResults, aspectRatio);
            if (isSingleRegenerate) {
                setGeneratedImages(prev => prev.map((img, idx) => idx === regenerateIndex ? (normalizedResults[0] || img) : img));
            } else {
                setGeneratedImages(normalizedResults);
            }
            await saveGeneratedProject({
                type: 'RETOUCHING',
                generated: normalizedResults,
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
                    count: normalizedResults.length,
                    singleRegenerate: isSingleRegenerate,
                    platform: selectedPlatform
                }
            });

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            if (stepInterval) clearInterval(stepInterval);
            if (isSingleRegenerate) {
                setRegeneratingIndices(prev => prev.filter(idx => idx !== regenerateIndex));
            } else {
                setIsLoading(false);
                setProgress(100);
            }
        }
    };

    const handleDownload = (img: string, idx: number) => {
        const link = document.createElement('a');
        link.href = img;
        link.download = `hero-${Date.now()}-${idx}.png`;
        link.click();
    };

    const handleDownloadAll = () => {
        generatedImages.forEach((img, idx) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = img;
                link.download = `hero-all-${Date.now()}-${idx + 1}.png`;
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

                            {/* 妯＄壒鍥句笂浼犳寚鍗楀睍绀猴紝骞虫椂鍙樉绀轰竴涓狝I妯＄壒瑙勫垯锛岀偣鍑诲彲浠ユ斁澶ф煡鐪?*/}
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
                                    {/* 鍥惧儚妯″瀷閫夋嫨 Section */}
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

                        <button onClick={() => handleGenerate()} disabled={isLoading || productImages.length === 0 || regeneratingIndices.length > 0} className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isLoading || productImages.length === 0 || regeneratingIndices.length > 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01]'}`}>
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

            {/* AI妯＄壒瑙勫垯鏀惧ぇ鏌ョ湅寮圭獥 */}
            {showModelGuideModal && (
                <div 
                    className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300 animate-fade-in"
                    onClick={() => setShowModelGuideModal(false)}
                >
                    <div 
                        className="relative max-w-md w-full bg-white rounded-3xl p-7 shadow-2xl border border-purple-50 flex flex-col gap-5 transform transition-all duration-300 scale-100 hover:shadow-purple-100/40"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 澶撮儴鏍囬鍖?*/}
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

                        {/* 瑙勫垯鏉＄洰鍗＄墖鍒楄〃 */}
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
