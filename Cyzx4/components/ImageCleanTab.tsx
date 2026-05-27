import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
    Upload, X, Wand2, Sparkles, AlertCircle, Loader2, 
    Layout, Sun, Image as ImageIcon, CheckCircle2, 
    ChevronDown, Package, Store, Ruler, MessageSquare, 
    Zap, RefreshCw, ZoomIn, Download, Brain, Layers,
    Camera, UserCircle, Cpu, ChevronUp, Edit3, Settings,
    FileText, Smartphone, Film, Eye, Maximize, Scan, Target
} from 'lucide-react';
import { generateImageToImage, blobToBase64, compressImage, editGeneratedImage } from '../services/geminiService';
import { analyzeProductForScene, SceneAnalysisResult } from '../services/sceneAnalyzer';
import { generateContentWithAnalysisFallback, getErrorMessage, getAiClient } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { storageService } from '../../services/storageService';
import { QUALITY_BOOSTERS, enhancePrompt } from '../services/promptUtils';
import { extractEdges } from '../utils/imageProcessor';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { CLOTHING_POSES } from '../constants/clothingPresets';

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
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
    const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");
    const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [generateCount, setGenerateCount] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [isSafeMode, setIsSafeMode] = useState(false); // 动作安全模式
    const [isPoseOnly, setIsPoseOnly] = useState(true); // 仅参考姿态 (默认开启，自动提取线稿以消除背景干扰)
    const [isSafeModeScene, setIsSafeModeScene] = useState(false); // 场景安全模式
    const [isSafeModeModel, setIsSafeModeModel] = useState(false); // 模特安全模式
    const [isFaceOnly, setIsFaceOnly] = useState(false); // 仅参考脸型
    const [isSceneOnly, setIsSceneOnly] = useState(false); // 仅参考场景
    const [isPurifyingScene, setIsPurifyingScene] = useState(false); // 正在自动净化场景图
    const [isPurifyingProduct, setIsPurifyingProduct] = useState(false); // 正在自动净化产品素材图
    const [isProductPurifyEnabled, setIsProductPurifyEnabled] = useState(true); // 是否开启产品图AI去噪净化
    const [showModelGuideModal, setShowModelGuideModal] = useState(false); // 控制AI模特规则上传指南弹窗的显示
    
    // Photo controls
    const [cameraDevice, setCameraDevice] = useState('智能推荐');
    const [shotType, setShotType] = useState('智能推荐');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    
    // Image states
    const [productImages, setProductImages] = useState<UploadedImage[]>([]);
    const [actionReferences, setActionReferences] = useState<UploadedImage[]>([]);
    const [sceneReferences, setSceneReferences] = useState<UploadedImage[]>([]);
    const [modelReference, setModelReference] = useState<UploadedImage | null>(null);
    const [measurements, setMeasurements] = useState({ bust: '', waist: '', hips: '' });
    const [userPrompt, setUserPrompt] = useState('');
    
    // 自动同步动作参考图的数量到批量生成数量 (当数量 > 1 时自动锁定对齐)
    useEffect(() => {
        if (actionReferences.length > 1) {
            setGenerateCount(actionReferences.length);
        }
    }, [actionReferences]);
    
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
    const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
    
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
            // 使用压缩逻辑减小负载，避免 4K/2K 超时
            const { base64, mime } = await compressImage(file, 2048, 0.9);
            results.push({
                file,
                preview: URL.createObjectURL(file),
                base64: base64,
                mime: mime
            });
        }
        return results;
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const processed = await processFiles(files);
        
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
            } catch (err) {
                console.error("Purify product image failed:", err);
                // 降级回退到原始图片
                setProductImages(prev => [...prev, ...processed].slice(0, 4));
            } finally {
                setIsPurifyingProduct(false);
            }
        } else {
            setProductImages(prev => [...prev, ...processed].slice(0, 4));
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

    const analyzeHeroStylingPlan = async (images: UploadedImage[]): Promise<string> => {
        const fallback = [
            '# UNIFIED STYLING PLAN:',
            '- If the product image does not show pants, use one consistent clean light-wash straight-leg denim jean style across every generated image.',
            '- If shoes are visible, use one consistent minimal neutral shoe style across every generated image.',
            '- If bags or jewelry are needed, keep them minimal, commercially realistic, and consistent across the batch.',
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
- If bags, shoes, belts, jewelry, or props are not in the product asset, recommend a consistent minimal set or explicitly say none.
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
                `- Unified bag for ALL images: ${parsed.unifiedBag || 'none unless pose requires a handheld accessory'}`,
                `- Unified jewelry/accessories for ALL images: ${parsed.unifiedJewelry || 'minimal small earrings or a delicate necklace, consistent across the batch'}`,
                `- Avoid styling: ${parsed.avoidStyling || 'avoid changing the product garment or adding distracting accessories'}`,
                '- CONSISTENCY RULE: pants, shoes, bags, belts, jewelry, and visible accessories must stay the same style/color/material across every image in this batch unless they are physically hidden by the crop.'
            ].join('\n');
        } catch (err) {
            console.warn('Hero styling plan analysis failed, using fallback.', err);
            return fallback;
        }
    };

    const handleGenerate = async (regenerateIndex?: number) => {
        if (productImages.length === 0) {
            setError('请上传产品图素材');
            return;
        }

        const isSingleRegenerate = typeof regenerateIndex === 'number';
        if (isSingleRegenerate) {
            setRegeneratingIndex(regenerateIndex);
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
            // 1. 预处理所有图片（如果开启安全模式或仅参考姿态，则动作图转换为线稿线段以剔除背景干扰）
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

            // 2. 构建图片序列 (支持根据动作图索引进行动态独立对齐)
            // 严格匹配 API 与 Prompt 契约：产品图必须作为 Image 1 (首张图片) 传入以确保 100% 一致性锁定！
            const getInputImagesForIndex = (actionIndex?: number) => {
                const list: { base64: string; mimeType: string }[] = [];
                
                // [第一优先级] 添加产品图作为首张图片 (Image 1)，这与 Prompt 中的 "# CRITICAL REQUIREMENT: The FIRST IMAGE is the [PRODUCT ASSET]" 完美对齐
                productImages.forEach(img => {
                    const isAlreadyAdded = actionReferences.some(ar => ar.base64 === img.base64);
                    if (!isAlreadyAdded) {
                        list.push({ base64: img.base64!, mimeType: img.mime! });
                    }
                });

                // [第二优先级] 添加模特图，作为人脸特征和长相的绝对参考（传入两次以双倍增强 AI 的注意力长相锁定权重）
                if (processedModel) {
                    list.push(processedModel);
                    list.push(processedModel);
                }
                
                // [第三优先级] 添加特定的动作姿态参考图，作为姿态对齐的构图锚点
                const selectedAction = typeof actionIndex === 'number' && processedActions[actionIndex]
                    ? processedActions[actionIndex]
                    : processedActions[0];
                if (selectedAction?.original) {
                    list.push(selectedAction.original);
                }
                if (selectedAction?.lineart) {
                    list.push(selectedAction.lineart);
                }
                
                // [第四优先级] 添加背景场景参考图
                processedScenes.forEach(img => {
                    if (img) list.push(img);
                });
                
                return list;
            };

            // 3. 构建 Prompt 策略与参考图 1-based 动态索引计算以解决 Gemini 多模态映射错位问题
            const productIndexStart = 1;
            const productIndexEnd = productImages.length;
            
            let modelIndexStart = 0;
            let modelIndexEnd = 0;
            if (processedModel) {
                modelIndexStart = productIndexEnd + 1;
                modelIndexEnd = productIndexEnd + 2;
            }
            
            let actionIndex = 0;
            let actionLineartIndex = 0;
            if (actionReferences.length > 0) {
                actionIndex = (processedModel ? productIndexEnd + 2 : productIndexEnd) + 1;
                actionLineartIndex = actionIndex + 1;
            }
            
            let sceneIndexStart = 0;
            let sceneIndexEnd = 0;
            if (processedScenes.length > 0) {
                const prevCount = (processedModel ? productIndexEnd + 2 : productIndexEnd) + (actionReferences.length > 0 ? 2 : 0);
                sceneIndexStart = prevCount + 1;
                sceneIndexEnd = prevCount + processedScenes.length;
            }

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
                actionReferences.length > 0 ? `动作：复刻姿态参考图` : `动作：智能匹配姿态`,
                `画质：${QUALITY_BOOSTERS.EDITORIAL}`
            ].join(' | ');

            let basePrompt = enhancePrompt(userPrompt || `High-end fashion photography, ${form.personaTemplate} wearing ${form.productName}, studio background.`, 'PRODUCT');
            
            // 任意一种安全模式开启均执行 Prompt 净化
            if (isSafeMode || isSafeModeScene || isSafeModeModel) {
                basePrompt = basePrompt.replace(/情趣|性感|透视|诱惑|sexy|erotic/gi, '时尚');
                basePrompt = basePrompt.replace(/内衣|睡衣|lingerie/gi, '高定泳装');
                basePrompt += " # SAFE MODE: High-end Fashion Editorial, elegant styling.";
            }

            const platformPrompt = selectedPlatform ? PLATFORM_STYLES.find(p => p.id === selectedPlatform)?.prompt : "";
            const unifiedStylingPlan = await analyzeHeroStylingPlan(productImages);

            const prompt = `
            # AGENT STRATEGY: ${strategy}
            # MISSION: Professional commercial product photography with MANDATORY PRODUCT CONSISTENCY.
            
            # CRITICAL REQUIREMENT - MAXIMUM PRODUCT FIDELITY (HIGHEST PRIORITY): 
            The FIRST IMAGE (Image 1) is the [PRODUCT ASSET]. You MUST preserve its exact structural design, clothing shape, collar style, neck cuts, sleeves, pockets, fabric texture, prints/patterns (e.g. leopard print or stripes), stitching, and materials perfectly. 
            The clothing on the generated model MUST be a 100% pixel-accurate high-fidelity replica of this product asset, with ZERO structure changes or textile/fabric details loss. 
            **BACKGROUND NOISE ISOLATION (STRICT)**: You MUST completely and absolutely ignore, block, and discard any background elements present in the product asset image, including clothes hangers, hooks, picture frames on the wall, hanging art, wall stripes, wooden frames, shadow boards, stands, or room walls. 
            DO NOT generate or allow ANY of these product background items to appear in the final model's scene background. You must isolate ONLY the clothing itself from the product asset.
            
            ${unifiedStylingPlan}
            
            ${platformPrompt ? `# PLATFORM VISUAL GENE: ${platformPrompt}` : ''}
            ${modelReference ? `# MODEL IDENTITY AND BODY SHAPE FIDELITY (CRITICAL): The generated model MUST inherit ONLY the facial features (face shape, eyes, nose, lips, eyebrows, expression, hair style/color) and the physical body shape/proportions from the provided model reference images at Image ${modelIndexStart} and Image ${modelIndexEnd}. You MUST completely IGNORE, DISCARD, and BYPASS the clothing, outfits, accessories, jewelry, background, pose, and any other non-anatomy elements present in Image ${modelIndexStart} and Image ${modelIndexEnd}. The clothing on the generated model MUST be the product asset from Image 1, and the pose must follow the pose directive.` : ''}
            ${measurementStr ? `# BODY PROPORTIONS: ${measurementStr}` : ''}
            ${actionReferences.length > 0 ? `# POSE ANCHOR DIRECTIVE (CRITICAL): Images ${actionIndex} and ${actionLineartIndex} are the ONLY pose anchors for this output. Image ${actionIndex} is the original pose reference for crop, framing, camera angle, body scale, subject placement, lens distance, and left/right facing direction. Image ${actionLineartIndex} is the lineart/silhouette pose map for skeletal alignment, limb angles, hand positions, head direction, torso rotation, leg stance, and body proportions. Product fidelity from Image 1 has higher priority than pose if there is a conflict, but the output MUST keep the same overall pose family, crop, angle, body scale, and composition as Images ${actionIndex}-${actionLineartIndex}. Do NOT replace a side/back/three-quarter pose with a front standing pose. Do NOT drop raised hands, pocket hands, hand-to-face gestures, seated stance, walking stance, or over-shoulder direction. Do NOT zoom in/out, change half-body to full-body, change full-body to half-body, shift the subject scale, mirror left/right direction, or invent a different standard catalog pose. You MUST completely IGNORE, DISCARD, and BYPASS any background elements, clothing, outfits, faces, colors, textures, lighting, or scene details present in Images ${actionIndex}-${actionLineartIndex}. The scene background of the output MUST be determined SOLELY by the scene reference images or scene prompt, with absolutely zero influence from the action reference's background.` : ''}
            ${sceneReferences.length > 0 ? `# SCENE FIDELITY (MANDATORY): You MUST replicate the background scene, environment, layout, walls, props, ambient lighting, shadows, and architectural details of the scene reference images from Image ${sceneIndexStart} to Image ${sceneIndexEnd} EXACTLY. Replicate the scene background with 100% precision. The generated subject must be placed seamlessly into this exact scene environment. Any alteration of the background environment is STRICTLY PROHIBITED.` : (selectedPlatform === 'amazon' ? '# SCENE: Pure white background (#FFFFFF), clean studio lighting, centered.' : '# SCENE: Professional studio or high-end lifestyle background, minimalist.')}
            
            # CAMERA: ${cameraDevice !== '智能推荐' ? cameraDevice : 'Professional high-end commercial camera'}
            # SHOT: ${shotType !== '智能推荐' ? shotType : 'Optimal commercial framing'}
            
            # DESCRIPTION: ${basePrompt}
            # FINAL OUTPUT: High-fidelity, commercial-grade asset with strict geometric locking for the product.
            `;

            const countToGenerate = actionReferences.length > 1 ? actionReferences.length : generateCount;

            // 检查是否为睡衣/家居服系列产品
            const keywords = ['睡衣', 'pajama', 'sleepwear', '家居服', 'loungewear', '睡裤', '睡袍', 'nightgown', 'bathrobe'];
            const productNameLower = (form.productName || '').toLowerCase();
            const productCategoryLower = (form.productCategory || '').toLowerCase();
            const isSleepwear = keywords.some(keyword => productNameLower.includes(keyword) || productCategoryLower.includes(keyword));

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

            // 彻底洗牌打乱 230 个睡衣姿态预设列表，确保批量生成的每一张图分配到的睡衣姿态都是绝对随机且不重复的
            let shuffledSleepwearPoses = [...SLEEPWEAR_POSES];
            if (isSleepwear) {
                for (let k = shuffledSleepwearPoses.length - 1; k > 0; k--) {
                    const r = Math.floor(Math.random() * (k + 1));
                    [shuffledSleepwearPoses[k], shuffledSleepwearPoses[r]] = [shuffledSleepwearPoses[r], shuffledSleepwearPoses[k]];
                }
            }

            // 彻底洗牌打乱 160 个普通服装姿态预设列表，确保批量生成的每一张图分配到的姿态都是绝对随机且不重复的
            let shuffledClothingPoses = [...CLOTHING_POSES];
            if (shouldUseClothingPoseLibrary) {
                for (let k = shuffledClothingPoses.length - 1; k > 0; k--) {
                    const r = Math.floor(Math.random() * (k + 1));
                    [shuffledClothingPoses[k], shuffledClothingPoses[r]] = [shuffledClothingPoses[r], shuffledClothingPoses[k]];
                }
            }

            const generationIndices = isSingleRegenerate ? [regenerateIndex!] : Array.from({ length: countToGenerate }, (_, i) => i);
            const batchPromises = generationIndices.map((i) => {
                const specificInputImages = getInputImagesForIndex(actionReferences.length > 1 ? i : undefined);
                
                let finalPrompt = prompt;
                let selectedPoseHeader = '';
                if (actionReferences.length === 0) {
                    if (isSleepwear) {
                        // 顺序从洗牌后的列表中抽取动作，实现“100%彻底打乱且不重复用到”
                        const posePreset = shuffledSleepwearPoses[i % shuffledSleepwearPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT lifestyle pajama pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic catalog standing angles.
`;
                        
                        finalPrompt = finalPrompt.replace(
                            "动作：智能匹配姿态",
                            `动作：睡衣预设姿态 - ${posePreset.name} (${poseSpec})`
                        );
                        // 极大强化对于动作姿态的描述，赋予最高权重与优先级，彻底规避呆板普通的站姿
                        finalPrompt += `\n# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate the model in the EXACT lifestyle pajama pose and body posture described here: ${poseSpec}. Completely ignore, bypass, and discard standard, rigid, artificial standing model poses. Focus heavily and render the relaxed limb angles, cozy physical twists, soft pajama creases, leg bends, and comfy sleepy lifestyle poses with 100% fidelity. The final image pose must strictly mirror this directive.\n`;
                    } else if (shouldUseClothingPoseLibrary) {
                        // 顺序从洗牌后的列表中抽取普通服装主图姿态，实现“100%彻底打乱且不重复用到”
                        const posePreset = shuffledClothingPoses[i % shuffledClothingPoses.length];
                        const poseSpec = posePreset.prompt;
                        selectedPoseHeader = `# SELECTED RANDOM CLOTHING POSE PRESET: ${posePreset.name} / ${posePreset.id}
# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate this image with the EXACT commercial fashion display pose and camera framing described here: ${poseSpec}. This selected preset is mandatory for this output and must override generic repeated catalog angles. Preserve product fidelity from Image 1, but pose, body posture, hand placement, body angle, standing/sitting/walking state, and crop must follow this preset as closely as possible.
# RANDOMIZATION RULE: Each batch item receives a different shuffled preset. Do not reuse the same default front/side/back/seated four-angle pattern unless those exact presets were selected.
`;
                        
                        finalPrompt = finalPrompt.replace(
                            "动作：智能匹配姿态",
                            `动作：服装预设姿态 - ${posePreset.name} (${poseSpec})`
                        );
                        // 强化普通服装动作渲染指令，高权重锁定，杜绝死板姿势，强化开衫/针织衫等日常成衣的质感与版型展现
                        finalPrompt += `\n# POSE AND ANGLE DIRECTIVE (CRITICAL - MANDATORY): You MUST generate the model in the EXACT commercial fashion display pose described here: ${poseSpec}. Completely ignore and bypass awkward, rigid, standard dummy postures. Ensure the sweater/knitwear/clothing draping, hem adjustment, pocket insertions, shoulder exposure, or bag carrying action is rendered with 100% realism. The final model's pose and garment geometry must strictly adhere to this directive.\n`;
                    } else if (countToGenerate > 1) {
                        const poseSpec = DIVERSE_POSES[i % DIVERSE_POSES.length];
                        finalPrompt = finalPrompt.replace(
                            "动作：智能匹配姿态",
                            `动作：智能变化 (${poseSpec})`
                        );
                        finalPrompt += `\n# POSE AND ANGLE DIVERSIFICATION: For this specific image out of the batch, you MUST generate the model in this pose and camera angle: ${poseSpec}. Keep the face structure and environment identical, but vary the body position and shot perspective strictly to match this directive.\n`;
                    }
                }
                if (selectedPoseHeader) {
                    finalPrompt = `${selectedPoseHeader}\n${finalPrompt}`;
                }

                return generateImageToImage(specificInputImages, finalPrompt, {
                    aspectRatio,
                    resolution,
                    modelId: selectedModel,
                    negativePrompt: actionReferences.length > 0 
                        ? 'wrong pose, different pose, mismatched body angle, changed camera angle, changed crop, changed framing, changed body scale, mirrored pose, front-facing pose when reference is side view, side view when reference is front-facing, missing hand gesture, missing raised arm, missing pocket hand, standing pose when reference is seated, seated pose when reference is standing, zoomed out, zoomed in'
                        : undefined,
                    hasModelRef: !!modelReference,
                    workflowHint: actionReferences.length > 0 ? 'hero-pose-lock' : (modelReference ? 'face-lock' : 'scene-product-lock')
                });
            });

            const batchResults = await Promise.all(batchPromises);
            const flatResults = batchResults.flat();
            if (isSingleRegenerate) {
                setGeneratedImages(prev => prev.map((img, idx) => idx === regenerateIndex ? (flatResults[0] || img) : img));
            } else {
                setGeneratedImages(flatResults);
            }

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            if (stepInterval) clearInterval(stepInterval);
            if (isSingleRegenerate) {
                setRegeneratingIndex(null);
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
                                    <h3 className="font-bold text-pastel-text text-sm">产品素材图</h3>
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1 animate-pulse">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        产品一致性已锁定
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-purple-50/50 px-2 py-0.5 rounded-lg border border-purple-100 shadow-sm" title="开启后，AI在您上传图片时将自动检测并移除背景里的画框、相框、衣架、挂钩等干扰元素，只保留衣服主体">
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
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="仅提取动作姿态，自动过滤和消除动作图中的背景与场景元素干扰（推荐开启）">
                                            <input 
                                                type="checkbox" 
                                                checked={isPoseOnly}
                                                onChange={(e) => setIsPoseOnly(e.target.checked)}
                                                className="w-3.5 h-3.5 text-purple-500 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-purple-600 transition-colors font-medium">仅参考姿态</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，动作图将自动转化为线稿，并净化Prompt，以绕过敏感词拦截">
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
                                                    <button onClick={(e) => { e.stopPropagation(); setActionReferences(prev => prev.filter((_, i) => i !== idx)); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/action:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
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
                                            <p className="text-[10px] text-purple-600 font-medium">指定模特姿态 (最多10张)</p>
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
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，AI 将仅提取场景图的构图与光影，忽略图中原有主体">
                                            <input 
                                                type="checkbox" 
                                                checked={isSceneOnly}
                                                onChange={(e) => setIsSceneOnly(e.target.checked)}
                                                className="w-3.5 h-3.5 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                                            />
                                            <span className="text-[10px] text-gray-500 group-hover:text-orange-600 transition-colors font-medium">仅场景</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，场景图将自动转化为线稿，以绕过敏感场景拦截">
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
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，AI 将仅提取模特图的脸型与五官特征，忽略图中原有姿态">
                                        <input 
                                            type="checkbox" 
                                            checked={isFaceOnly}
                                            onChange={(e) => setIsFaceOnly(e.target.checked)}
                                            className="w-3.5 h-3.5 text-blue-500 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-gray-500 group-hover:text-blue-600 transition-colors font-medium">仅脸型</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer group" title="开启后，模特参考图将自动转化为线稿，以绕过敏感人物拦截">
                                        <input 
                                            type="checkbox" 
                                            checked={isSafeModeModel}
                                            onChange={(e) => setIsSafeModeModel(e.target.checked)}
                                            className="w-3.5 h-3.5 text-blue-500 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-gray-500 group-hover:text-blue-600 transition-colors font-medium">安全脱敏</span>
                                    </label>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">固定长相</span>
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
                            
                            {/* 模特图上传指南展示，平时只显示一个AI模特规则，点击可以放大查看 */}
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[10px] text-pastel-muted font-bold block mb-1">清晰度</label><select value={resolution} onChange={e => setResolution(e.target.value as ImageResolution)} className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs"><option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option></select></div>
                                        <div>
                                            <label className="text-[10px] text-pastel-muted font-bold block mb-1">
                                                批量 {actionReferences.length > 1 && <span className="text-[8px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-normal border border-purple-100 animate-pulse">自动对齐动作</span>}
                                            </label>
                                            <select 
                                                value={generateCount} 
                                                onChange={e => setGenerateCount(Number(e.target.value))} 
                                                disabled={actionReferences.length > 1}
                                                className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-xs disabled:opacity-85 disabled:bg-purple-50/10 disabled:border-purple-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {actionReferences.length > 1 ? (
                                                    <option value={actionReferences.length}>{actionReferences.length}张 (等同于参考图数)</option>
                                                ) : (
                                                    <>
                                                        <option value={1}>1张</option>
                                                        <option value={2}>2张</option>
                                                        <option value={4}>4张</option>
                                                        <option value={6}>6张</option>
                                                        <option value={8}>8张</option>
                                                        <option value={10}>10张</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => handleGenerate()} disabled={isLoading || productImages.length === 0} className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isLoading || productImages.length === 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01]'}`}>
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
                                                    <button onClick={() => handleGenerate(idx)} disabled={regeneratingIndex !== null || isLoading} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed" title="重新生成这张"><RefreshCw className={`w-6 h-6 ${regeneratingIndex === idx ? 'animate-spin' : ''}`} /></button>
                                                    <button onClick={() => handleDownload(img, idx)} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transform hover:scale-110 transition-transform"><Download className="w-6 h-6" /></button>
                                                </div>
                                                {regeneratingIndex === idx && (
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

            {/* AI模特规则放大查看弹窗 */}
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
                                    遵循以下高精度提取准则，可让生成的商拍模特质量达到极致
                                </p>
                            </div>
                        </div>

                        {/* 规则条目卡片列表 */}
                        <div className="space-y-3">
                            {[
                                {
                                    num: "01",
                                    title: "纯色或简单背景",
                                    desc: "优先提供干净、白墙或单色背景的图片。避免背景中有复杂的货架、多人环境，有利于 AI 更加聚焦并提取模特五官与体态曲线。",
                                    badgeColor: "bg-purple-50 text-purple-600 border border-purple-100"
                                },
                                {
                                    num: "02",
                                    title: "清晰正面半身特写",
                                    desc: "推荐使用五官及发型清晰无遮挡、光线均匀的正面半身照片。避开强逆光、浓重侧光阴影或低头/仰头角度，保证长相提取准确度最高。",
                                    badgeColor: "bg-blue-50 text-blue-600 border border-blue-100"
                                },
                                {
                                    num: "03",
                                    title: "穿着素色或紧身衣服",
                                    desc: "强烈推荐让参考模特穿着紧身吊带、背心或贴身衣物。这能帮助 AI 完美且精准地提取模特的体型比例，不受宽大衣服误导。",
                                    badgeColor: "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                },
                                {
                                    num: "04",
                                    title: "避免首饰与配饰遮挡",
                                    desc: "参考照片中严禁佩戴大镜框墨镜、大型项链、挂饰或遮阳帽等配饰。避免面部和颈部特征受干扰产生畸变。",
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

                        {/* 底部按钮区 */}
                        <div className="flex gap-3 mt-1">
                            <button 
                                onClick={() => setShowModelGuideModal(false)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-purple-100/60 hover:scale-[1.01] active:scale-95 transition-all text-center"
                            >
                                我已了解，开始上传
                            </button>
                        </div>

                        {/* 关闭按钮 */}
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
