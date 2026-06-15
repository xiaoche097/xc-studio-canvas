import React, { useEffect, useState, useRef } from 'react';
import {
    Upload, X, Sparkles, Loader2,
    Download, Scissors, Shirt, Tag,
    CheckCircle2, AlertCircle, Image as ImageIcon,
    ShoppingBag, Watch, Footprints, Crown, Plus, Trash2,
    Glasses, Gem, MonitorSmartphone, Ratio, Cpu, RotateCcw, CheckSquare,
    Wand2, Palette
} from 'lucide-react';
import { analyzeOutfitItems, generateImageToImage, generateText, compressImage, type OutfitAnalysisItem } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

interface ExtractedItem {
    id: string;
    label: string;
    imageUrl: string | null;
    status: 'pending' | 'processing' | 'done' | 'error';
    analysis?: OutfitAnalysisItem;
    error?: string;
}

type ExtractionMode = 'precise' | 'rebuild';
type ActiveWorkflow = 'extract' | 'match';

interface ExtractionTarget {
    id: string;
    label: string;
    englishName: string;
    analysis?: OutfitAnalysisItem;
}

interface MatchTarget {
    id: string;
    label: string;
    englishName: string;
    icon: React.ReactNode;
}

interface MatchNeedsAnalysis {
    recommendedTargetIds: string[];
    styleSummary: string;
    reason: string;
}

// Preset clothing item tags
const PRESET_ITEMS = [
    { id: 'top', label: '上衣', icon: <Shirt className="w-3.5 h-3.5" /> },
    { id: 'bottom', label: '下装', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'dress', label: '连衣裙', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'outerwear', label: '外套', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'shoes', label: '鞋子', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'bag', label: '包包', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'hat', label: '帽子', icon: <Crown className="w-3.5 h-3.5" /> },
    { id: 'glasses', label: '眼镜', icon: <Glasses className="w-3.5 h-3.5" /> },
    { id: 'earrings', label: '耳环', icon: <Gem className="w-3.5 h-3.5" /> },
    { id: 'bracelet', label: '手环', icon: <Watch className="w-3.5 h-3.5" /> },
    { id: 'necklace', label: '项链', icon: <Gem className="w-3.5 h-3.5" /> },
    { id: 'accessory', label: '其他配饰', icon: <Watch className="w-3.5 h-3.5" /> },
];

const MATCH_TARGETS: MatchTarget[] = [
    { id: 'top', label: '上装', englishName: 'matching top', icon: <Shirt className="w-3.5 h-3.5" /> },
    { id: 'bottom', label: '下装', englishName: 'matching bottom', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'outerwear', label: '外套', englishName: 'matching outerwear', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'shoes', label: '鞋', englishName: 'matching shoes', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'bag', label: '包', englishName: 'matching bag', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'hat', label: '帽子', englishName: 'matching hat', icon: <Crown className="w-3.5 h-3.5" /> },
    { id: 'jewelry', label: '首饰', englishName: 'matching jewelry', icon: <Gem className="w-3.5 h-3.5" /> },
    { id: 'watch', label: '手表', englishName: 'matching wristwatch', icon: <Watch className="w-3.5 h-3.5" /> },
    { id: 'glasses', label: '眼镜', englishName: 'matching eyewear', icon: <Glasses className="w-3.5 h-3.5" /> },
];

const DEFAULT_MATCH_TARGET_IDS = ['shoes', 'bag', 'bottom', 'outerwear', 'jewelry', 'watch'];

const STYLE_PRESETS = [
    '通勤',
    '街头',
    '度假',
    '甜酷',
    '轻奢',
    '运动休闲',
];

const DEFAULT_MATCH_STYLE = '现代电商百搭、干净高级、适合日常销售图';
const MAX_MATCH_REFERENCE_IMAGES = 5;

// Tags for elements to exclude
const REMOVE_TAGS = [
    { id: 'person', label: '人物', default: true },
    { id: 'top', label: '上衣', default: true },
    { id: 'clothes', label: '衣服', default: true },
    { id: 'hair', label: '头发' },
    { id: 'shoes', label: '鞋子' },
    { id: 'bag', label: '包包' },
    { id: 'hat', label: '帽子' },
    { id: 'background', label: '背景' },
];

const MODEL_OPTIONS = [
    { id: 'gemini-3.1-flash-image-preview', name: 'Banana 2', sub: '3.1 Flash', desc: '速度优先' },
    { id: 'gemini-3-pro-image-preview', name: 'Banana Pro', sub: '3 Pro', desc: '品质优先' },
    { id: 'gpt-image-2', name: 'GPT Image 2', sub: 'Ultra', desc: '极致细节' },
];

const RATIO_OPTIONS = [
    { value: AspectRatio.SQUARE, label: '1:1', desc: '方图' },
    { value: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '标准' },
    { value: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '修长' },
    { value: AspectRatio.PORTRAIT_4_5, label: '4:5', desc: 'INS' },
    { value: AspectRatio.PORTRAIT_9_16, label: '9:16', desc: '竖屏' },
];

const RESOLUTION_OPTIONS = [
    { value: ImageResolution.RES_2K, label: '2K 高清', desc: '推荐' },
    { value: ImageResolution.RES_4K, label: '4K 极致', desc: '超清' },
];

const OutfitExtractionTab: React.FC = () => {
    const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow>('extract');

    // Image state
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);

    // Remove elements (tag-based selection)
    const [removeTags, setRemoveTags] = useState<Set<string>>(
        new Set(REMOVE_TAGS.filter(t => t.default).map(t => t.id))
    );

    // Settings
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
    const [selectedResolution, setSelectedResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');
    const [extractionMode, setExtractionMode] = useState<ExtractionMode>('rebuild');

    // Items to extract
    const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
    const [detectedItems, setDetectedItems] = useState<OutfitAnalysisItem[]>([]);
    const [selectedDetectedIds, setSelectedDetectedIds] = useState<Set<string>>(new Set());
    const [customItems, setCustomItems] = useState<string[]>([]);
    const [customInput, setCustomInput] = useState('');

    // Matching generation
    const [stylePrompt, setStylePrompt] = useState('');
    const [selectedMatchTargets, setSelectedMatchTargets] = useState<Set<string>>(
        new Set(DEFAULT_MATCH_TARGET_IDS)
    );
    const [matchItems, setMatchItems] = useState<ExtractedItem[]>([]);
    const [outfitPreview, setOutfitPreview] = useState<ExtractedItem | null>(null);
    const [matchReferenceImages, setMatchReferenceImages] = useState<UploadedImage[]>([]);
    const [isAnalyzingMatchNeeds, setIsAnalyzingMatchNeeds] = useState(false);
    const [matchAnalysisNotice, setMatchAnalysisNotice] = useState<string | null>(null);

    // Generation state
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [items, setItems] = useState<ExtractedItem[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);

    // Preview
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const analysisAbortRef = useRef<AbortController | null>(null);

    // --- Image Upload ---
    const processUploadFile = async (file: File): Promise<UploadedImage> => {
        const { base64, mime } = await compressImage(file, 2048, 0.9);
        return {
            file,
            preview: URL.createObjectURL(file),
            base64,
            mime
        };
    };

    const toApiImages = (images: UploadedImage[]) =>
        images
            .filter(image => image.base64)
            .map(image => ({ base64: image.base64 || '', mimeType: image.mime || 'image/png' }));

    const getMatchInputImages = () => sourceImage
        ? toApiImages([sourceImage, ...matchReferenceImages])
        : [];

    const parseMatchNeedsAnalysis = (text: string): MatchNeedsAnalysis => {
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned || '{}');
            const validIds = new Set(MATCH_TARGETS.map(target => target.id));
            const recommendedTargetIds = Array.isArray(parsed.recommendedTargetIds)
                ? parsed.recommendedTargetIds.filter((id: string) => validIds.has(id)).slice(0, MATCH_TARGETS.length)
                : [];
            return {
                recommendedTargetIds,
                styleSummary: String(parsed.styleSummary || '').trim(),
                reason: String(parsed.reason || '').trim(),
            };
        } catch {
            return { recommendedTargetIds: [], styleSummary: '', reason: '' };
        }
    };

    const analyzeMatchNeeds = async (
        productImage: UploadedImage,
        referenceImages: UploadedImage[] = matchReferenceImages,
        options: { resetBeforeAnalyze?: boolean } = {}
    ) => {
        if (!productImage.base64) return;
        if (options.resetBeforeAnalyze) {
            setStylePrompt('');
            setSelectedMatchTargets(new Set(DEFAULT_MATCH_TARGET_IDS));
            setMatchItems([]);
            setOutfitPreview(null);
            setSelectedResultIds(new Set());
            setMatchAnalysisNotice(null);
        }
        const controller = new AbortController();
        analysisAbortRef.current?.abort();
        analysisAbortRef.current = controller;
        setIsAnalyzingMatchNeeds(true);
        setMatchAnalysisNotice('正在分析产品图，推荐需要生成的搭配类型...');

        try {
            const imageInputs = toApiImages([productImage, ...referenceImages]);
            const targetCatalog = MATCH_TARGETS.map(target => `${target.id}: ${target.label}`).join(', ');
            const prompt = `
You are a senior ecommerce fashion stylist.

Analyze Image 1 as the user's core product. Images 2+ are optional visual references for desired style, color mood, outfit direction, or market taste.

Decide which matching items should be generated to complete a useful outfit around Image 1.

Available target ids:
${targetCatalog}

Rules:
- Recommend only useful complementary targets, not duplicates of the core product.
- If Image 1 is a top, usually recommend bottom, shoes, bag, outerwear or jewelry.
- If Image 1 is a bottom, usually recommend top, shoes, bag, outerwear or jewelry.
- If Image 1 is shoes or bag, recommend clothing and accessories that complete the outfit.
- Recommend watch as "watch" when wrist styling would improve the outfit; do not hide watches inside generic jewelry.
- Use references only as styling direction; do not require every visible reference item.
- Return 3 to 6 target ids unless the product clearly needs fewer.

Return ONLY valid JSON:
{
  "recommendedTargetIds": ["shoes", "bag", "bottom"],
  "styleSummary": "short Chinese style summary",
  "reason": "short Chinese reason for these choices"
}
`.trim();
            const text = await generateText(imageInputs, prompt, 'gemini-3.1-flash-lite-preview');
            if (analysisAbortRef.current !== controller || controller.signal.aborted) return;
            const analysis = parseMatchNeedsAnalysis(text);
            if (analysis.recommendedTargetIds.length > 0) {
                setSelectedMatchTargets(new Set(analysis.recommendedTargetIds));
            }
            setStylePrompt(analysis.styleSummary || '');
            setMatchAnalysisNotice(
                analysis.recommendedTargetIds.length > 0
                    ? `${analysis.styleSummary || 'AI 已完成搭配分析'}：${analysis.reason || `推荐生成 ${analysis.recommendedTargetIds.length} 类搭配单品`}`
                    : 'AI 未能明确推荐搭配类型，可手动选择搭配类型继续生成。'
            );
        } catch (analysisError) {
            if (!isAbortError(analysisError)) {
                setMatchAnalysisNotice('搭配分析失败，可手动选择搭配类型继续生成。');
            }
        } finally {
            if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
            setIsAnalyzingMatchNeeds(false);
        }
    };

    const handleUpload = async (file: File) => {
        if (!file?.type.startsWith('image/')) return;
        setIsProcessing(true);
        setError(null);
        setAnalysisNotice(null);
        analysisAbortRef.current?.abort();
        try {
            const uploaded = await processUploadFile(file);
            setSourceImage(uploaded);
            setItems([]);
            setMatchItems([]);
            setOutfitPreview(null);
            setSelectedResultIds(new Set());
            setDetectedItems([]);
            setSelectedDetectedIds(new Set());
            setIsProcessing(false);

            if (activeWorkflow === 'match') {
                await analyzeMatchNeeds(uploaded, matchReferenceImages, { resetBeforeAnalyze: true });
                return;
            }

            const controller = new AbortController();
            analysisAbortRef.current = controller;
            setIsAnalyzing(true);
            setAnalysisNotice('正在识别模特身上的搭配...');
            try {
                const analysis = await analyzeOutfitItems(
                    { base64: uploaded.base64 || '', mimeType: uploaded.mime || 'image/png' },
                    controller.signal
                );
                const detected = analysis.items.slice(0, 8);
                setDetectedItems(detected);
                setSelectedDetectedIds(new Set(detected.map(item => item.id)));
                setAnalysisNotice(
                    detected.length > 0
                        ? `AI 已识别 ${detected.length} 件可提取单品`
                        : '自动识别未找到明确单品，可手动选择单品继续提取。'
                );
            } catch (analysisError) {
                if (!isAbortError(analysisError)) {
                    setAnalysisNotice('自动识别失败，可手动选择单品继续提取。');
                }
            } finally {
                if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
                setIsAnalyzing(false);
            }
        } catch {
            setError('图片处理失败，请重试');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const item = Array.from(e.clipboardData.items).find(x => x.type.startsWith('image/'));
        if (item) {
            const file = item.getAsFile();
            if (file) handleUpload(file);
        }
    };

    useEffect(() => {
        const handleWindowPaste = (event: ClipboardEvent) => {
            if (isProcessing || sourceImage) return;
            const target = event.target as HTMLElement | null;
            const isTextInput = target?.closest('input, textarea, [contenteditable="true"]');
            if (isTextInput) return;

            const item = Array.from(event.clipboardData?.items || []).find(x => x.type.startsWith('image/'));
            const file = item?.getAsFile();
            if (!file) return;

            event.preventDefault();
            void handleUpload(file);
        };

        window.addEventListener('paste', handleWindowPaste);
        return () => window.removeEventListener('paste', handleWindowPaste);
    }, [isProcessing, sourceImage]);

    const handleReferenceUpload = async (files?: FileList | null) => {
        if (!files || isProcessing) return;
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (validFiles.length === 0) return;
        setError(null);
        try {
            const remaining = Math.max(0, MAX_MATCH_REFERENCE_IMAGES - matchReferenceImages.length);
            const uploaded = await Promise.all(validFiles.slice(0, remaining).map(processUploadFile));
            const nextReferences = [...matchReferenceImages, ...uploaded].slice(0, MAX_MATCH_REFERENCE_IMAGES);
            setMatchReferenceImages(nextReferences);
            setMatchItems([]);
            setOutfitPreview(null);
            setSelectedResultIds(new Set());
            if (sourceImage) {
                await analyzeMatchNeeds(sourceImage, nextReferences, { resetBeforeAnalyze: true });
            }
        } catch {
            setError('参考图处理失败，请重试');
        }
    };

    const removeReferenceImage = async (id: string) => {
        const target = matchReferenceImages.find(image => image.preview === id);
        if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
        const nextReferences = matchReferenceImages.filter(image => image.preview !== id);
        setMatchReferenceImages(nextReferences);
        setMatchItems([]);
        setOutfitPreview(null);
        setSelectedResultIds(new Set());
        if (sourceImage) {
            await analyzeMatchNeeds(sourceImage, nextReferences, { resetBeforeAnalyze: true });
        }
    };

    const removeImage = () => {
        analysisAbortRef.current?.abort();
        if (sourceImage?.preview) URL.revokeObjectURL(sourceImage.preview);
        setSourceImage(null);
        setItems([]);
        setMatchItems([]);
        setOutfitPreview(null);
        setSelectedResultIds(new Set());
        setDetectedItems([]);
        setSelectedDetectedIds(new Set());
        setError(null);
        setAnalysisNotice(null);
        setMatchAnalysisNotice(null);
        setStylePrompt('');
        setSelectedMatchTargets(new Set(DEFAULT_MATCH_TARGET_IDS));
        matchReferenceImages.forEach(image => {
            if (image.preview.startsWith('blob:')) URL.revokeObjectURL(image.preview);
        });
        setMatchReferenceImages([]);
    };

    const switchWorkflow = (workflow: ActiveWorkflow) => {
        if (isProcessing) return;
        setActiveWorkflow(workflow);
        setError(null);
        setSelectedResultIds(new Set());
        if (workflow === 'match') {
            setSelectedRatio(AspectRatio.PORTRAIT_3_4);
            analysisAbortRef.current?.abort();
            setIsAnalyzing(false);
            if (sourceImage) void analyzeMatchNeeds(sourceImage, matchReferenceImages, { resetBeforeAnalyze: true });
        } else {
            analysisAbortRef.current?.abort();
            setIsAnalyzingMatchNeeds(false);
        }
    };

    // --- Remove Tags ---
    const toggleRemoveTag = (id: string) => {
        setRemoveTags(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Item Selection ---
    const togglePreset = (id: string) => {
        setSelectedPresets(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleDetectedItem = (id: string) => {
        setSelectedDetectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const addCustomItem = () => {
        const trimmed = customInput.trim();
        if (!trimmed || customItems.includes(trimmed)) return;
        if (customItems.length + selectedPresets.size >= 8) {
            setError('最多提取 8 件单品');
            return;
        }
        setCustomItems(prev => [...prev, trimmed]);
        setCustomInput('');
    };

    const removeCustomItem = (item: string) => {
        setCustomItems(prev => prev.filter(i => i !== item));
    };

    const getExtractionTargets = (): ExtractionTarget[] => {
        const targets: ExtractionTarget[] = [];
        const seen = new Set<string>();
        detectedItems
            .filter(item => selectedDetectedIds.has(item.id))
            .forEach(item => {
                const key = `${item.label}-${item.englishName}`.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                targets.push({ id: item.id, label: item.label, englishName: item.englishName, analysis: item });
            });
        Array.from(selectedPresets).forEach(id => {
            const preset = PRESET_ITEMS.find(p => p.id === id);
            const label = preset?.label || id;
            const key = label.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            targets.push({ id, label, englishName: label });
        });
        customItems.forEach((label, index) => {
            const key = label.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            targets.push({ id: `custom-${index}-${label}`, label, englishName: label });
        });
        return targets.slice(0, 8);
    };

    // --- Extraction Logic ---
    const buildExtractionPrompt = (itemLabel: string, ratio: AspectRatio): string => {
        const selectedLabels = REMOVE_TAGS
            .filter(t => removeTags.has(t.id))
            .map(t => t.label);
        const removal = selectedLabels.length > 0
            ? `\n[EXTRA STRICT REMOVE in addition to body/skin/face/hands/feet/background]: ${selectedLabels.join('、')}`
            : '';

        const ratioDisplay = ratio.replace(':', '：');
        const ratioText = ratio === AspectRatio.SQUARE ? '1:1' : ratio;

        return `[ROLE: Senior e-commerce fashion product retoucher and catalog image generator]
[TASK: Generate a polished standalone product image from the source outfit photo]
[EXTRACT TARGET: ${itemLabel}]

[ABSOLUTE GOAL]
- Generate ONLY the "${itemLabel}" as a clean, refined e-commerce product image.
- Use the source image as the truth for design, color, material, pattern, trims, hardware, seams, proportions, and visible construction details.
- Remove the person, body parts, other garments, background, props, and image clutter.
- Do NOT return a raw cutout or an in-place mask. The final result must look like a professionally retouched catalog product shot.
- Center the product naturally in the frame with clean margins and polished edges.

[PRODUCT FIDELITY]
- Preserve the exact product identity: silhouette, color, print, fabric texture, weave/knit direction, buttons, zippers, seams, stitching, straps, soles, handles, buckles, metal hardware, labels, and distinctive design details.
- If the product is partially blocked by hands, hair, body, or another item, reconstruct only the missing blocked portion in a believable way that matches the visible product.
- Keep the same product style and proportions. Do not redesign, simplify, add logos, change color, change pattern, or invent decorative elements.

[STRICT REMOVE]
- Remove ALL non-"${itemLabel}" pixels:${removal}
- Remove: body, skin, face, head, hair, hands, arms, legs, feet, background, room, studio, floor, props, accessories, jewelry, bags, phones, hanger, mannequin, text, watermark, and logo overlays.
- Remove all OTHER clothing items that are NOT "${itemLabel}".

[OUTPUT]
- Premium product catalog photo on a completely pure white background (#FFFFFF), not transparent and not checkerboard.
- Every pixel that is not the "${itemLabel}" must be #FFFFFF. No colored backdrop, no tabletop, no wall, no studio sweep, no props, no gradient, no beige/gray tint, no texture, no clutter.
- Clean refined edges, no jagged mask, no leftover skin/hair/background pixels, no white holes, no pasted-crop feeling.
- Natural product presentation: flat-lay, ghost-mannequin, or standalone packshot as appropriate for "${itemLabel}".
- Avoid scene shadows and floor shadows; use only the minimum soft self-shadow needed to preserve product shape.
- No visible person, body parts, mannequin, hanger, or extra objects.
- The "${itemLabel}" must fill the frame naturally at ${ratioText} aspect ratio.

[NEGATIVE]
raw cutout, in-place mask, copied crop, jagged edge, broken edge, leftover body, leftover skin, leftover hair, background fragments, colored background, gray background, beige background, textured backdrop, tabletop, floor, wall, props, clutter, gradient, cast shadow, messy shadow, white holes, occlusion gaps, incomplete product, distorted product, changed color, changed pattern, added logo, low resolution, blurry`;
    };

    const extractSingleItem = async (itemLabel: string, signal?: AbortSignal): Promise<string> => {
        if (!sourceImage?.base64) throw new Error('No source image');

        const prompt = buildExtractionPrompt(itemLabel, selectedRatio);
        const results = await generateImageToImage(
            [{ base64: sourceImage.base64, mimeType: sourceImage.mime || 'image/png' }],
            prompt,
            {
                aspectRatio: selectedRatio,
                resolution: selectedResolution,
                modelId: selectedModel,
                signal,
                sampleCount: 1,
            }
        );

        if (!results || results.length === 0) {
            throw new Error(`未能生成 ${itemLabel}`);
        }
        return results[0];
    };

    const buildSmartExtractionPrompt = (target: ExtractionTarget, ratio: AspectRatio): string => {
        const analysis = target.analysis;
        const itemLabel = target.label;
        const selectedLabels = REMOVE_TAGS.filter(t => removeTags.has(t.id)).map(t => t.label);
        const removal = selectedLabels.length > 0
            ? `\n[EXTRA STRICT REMOVE in addition to body/skin/face/hands/feet/background]: ${selectedLabels.join(', ')}`
            : '';
        const ratioText = ratio === AspectRatio.SQUARE ? '1:1' : ratio;
        const analysisGuide = analysis
            ? `
[AI DETECTED TARGET PROFILE]
- Chinese label: ${analysis.label}
- English extraction target: ${analysis.englishName}
- Category: ${analysis.category}
- Visibility: ${analysis.visibility}
- Occlusion: ${analysis.occlusion}
- Color/material: ${analysis.colorMaterial}
- Key visible details: ${analysis.keyDetails}
- Confidence: ${Math.round(analysis.confidence * 100)}%
`
            : `
[USER TARGET PROFILE]
- Target label: ${target.label}
- English extraction target: ${target.englishName}
- Category: user-specified
`;

        if (extractionMode === 'precise') {
            return `[ROLE: Senior fashion image masking and exact outfit extraction specialist]
[TASK: Extract ONLY the target item from the source outfit photo]
[EXTRACT TARGET: ${itemLabel} / ${target.englishName}]
${analysisGuide}

[ABSOLUTE GOAL]
- Preserve the target item exactly as it appears in Image 1.
- Keep its original pose-driven shape, camera angle, perspective, crop, folds, wrinkles, drape, shadows, material texture, color, pattern, trims, seams, and visible construction details.
- Do NOT straighten, rotate, recenter, resize, redraw, beautify, complete, redesign, restyle, recolor, or add logos.
- Output must look like Image 1 with every non-target pixel painted pure white.

[STRICT KEEP]
- Keep ONLY visible pixels belonging to "${itemLabel}".
- Preserve visible edges and occlusion contours exactly, including where hands, hair, body, other garments, or accessories cover the target.
- If part of the item is hidden, do not hallucinate the hidden part. Leave hidden/removed areas pure white.

[STRICT REMOVE]
- Remove ALL non-"${itemLabel}" pixels:${removal}
- Remove person, skin, face, head, hair, hands, arms, legs, feet, background, floor, props, text, watermark, logo overlays, and all other outfit items.
- If the target is a shoe, bag, jewelry, hat, belt, scarf, glasses, or small accessory, keep that accessory and remove clothing/body around it.

[OUTPUT]
- Pure white background (#FFFFFF), not transparent and not checkerboard.
- Every non-target pixel must be #FFFFFF: no colored backdrop, gray/beige tint, tabletop, wall, floor, props, gradient, texture, or clutter.
- Preserve original item placement as much as possible inside ${ratioText}; do not force a polished flat-lay if it changes the true shape.
- Clean mask edges, no leftover skin/hair/background, no jagged edge, no white holes inside visible target pixels.

[NEGATIVE]
wrong item, all clothing kept, extra garments, leftover body, leftover skin, leftover hair, background fragments, colored background, gray background, beige background, textured backdrop, tabletop, floor, wall, props, clutter, gradient, cast shadow, changed color, changed pattern, invented logo, completed hidden parts, redesigned item, blurry product details`;
        }

        return `[ROLE: Senior e-commerce fashion product retoucher and catalog image generator]
[TASK: Generate a polished standalone product image from the source outfit photo]
[EXTRACT TARGET: ${itemLabel} / ${target.englishName}]
${analysisGuide}

[ABSOLUTE GOAL]
- Generate ONLY the "${itemLabel}" as a clean, refined e-commerce product image.
- Use the source image and AI target profile as the truth for design, color, material, pattern, trims, hardware, seams, proportions, and visible construction details.
- Remove the person, body parts, other garments, background, props, and image clutter.
- Center the product naturally in the frame with clean margins and polished edges.

[PRODUCT FIDELITY]
- Preserve the exact product identity: silhouette, color, print, fabric texture, weave/knit direction, buttons, zippers, seams, stitching, straps, soles, handles, buckles, metal hardware, labels, and distinctive design details.
- If the product is partially blocked by hands, hair, body, or another item, reconstruct only the missing blocked portion in a believable way that matches the visible product and the AI target profile.
- Keep the same product style and proportions. Do not redesign, simplify, add logos, change color, change pattern, or invent decorative elements.

[STRICT REMOVE]
- Remove ALL non-"${itemLabel}" pixels:${removal}
- Remove: body, skin, face, head, hair, hands, arms, legs, feet, background, room, studio, floor, props, unrelated accessories, other clothing, phones, hanger, mannequin, text, watermark, and logo overlays.

[OUTPUT]
- Premium product catalog photo on a completely pure white background (#FFFFFF), not transparent and not checkerboard.
- Every pixel that is not the "${itemLabel}" must be #FFFFFF. No colored backdrop, no tabletop, no wall, no studio sweep, no props, no gradient, no beige/gray tint, no texture, no clutter.
- Natural product presentation: flat-lay, ghost-mannequin, or standalone packshot as appropriate for "${itemLabel}".
- Avoid scene shadows and floor shadows; use only the minimum soft self-shadow needed to preserve product shape.
- The "${itemLabel}" must fill the frame naturally at ${ratioText} aspect ratio.

[NEGATIVE]
raw cutout, in-place mask, copied crop, jagged edge, broken edge, leftover body, leftover skin, leftover hair, background fragments, colored background, gray background, beige background, textured backdrop, tabletop, floor, wall, props, clutter, gradient, cast shadow, messy shadow, white holes, occlusion gaps, incomplete product, distorted product, changed color, changed pattern, added logo, low resolution, blurry`;
    };

    const extractSingleTarget = async (target: ExtractionTarget, signal?: AbortSignal): Promise<string> => {
        if (!sourceImage?.base64) throw new Error('No source image');
        const prompt = buildSmartExtractionPrompt(target, selectedRatio);
        const results = await generateImageToImage(
            [{ base64: sourceImage.base64, mimeType: sourceImage.mime || 'image/png' }],
            prompt,
            {
                aspectRatio: AspectRatio.PORTRAIT_3_4,
                resolution: selectedResolution,
                modelId: selectedModel,
                signal,
                sampleCount: 1,
                workflowHint: extractionMode === 'precise' ? 'garment-extraction' : undefined,
            }
        );
        if (!results || results.length === 0) {
            throw new Error(`未能生成 ${target.label}`);
        }
        return results[0];
    };

    const runExtractionForTarget = async (target: ExtractionTarget, signal: AbortSignal) => {
        setItems(prev => prev.map(i =>
            i.id === target.id ? { ...i, status: 'processing' as const, imageUrl: null, error: undefined } : i
        ));

        try {
            const imageUrl = await extractSingleTarget(target, signal);
            setItems(prev => prev.map(i =>
                i.id === target.id
                    ? { ...i, imageUrl, status: 'done' as const, error: undefined }
                    : i
            ));
        } catch (err) {
            const aborted = isAbortError(err);
            if (!aborted) {
                console.error(`Extraction failed for "${target.label}":`, err);
            }
            setItems(prev => prev.map(i =>
                i.id === target.id
                    ? { ...i, imageUrl: null, status: 'error' as const, error: aborted ? '已取消生成' : getErrorMessage(err) }
                    : i
            ));
        }
    };

    const handleExtract = async () => {
        const targets = getExtractionTargets();

        if (targets.length === 0) {
            setError('请至少选择一个要提取的单品');
            return;
        }

        if (!sourceImage) {
            setError('请先上传一张穿搭图片');
            return;
        }

        setIsProcessing(true);
        setError(null);

        // Initialize items
        const initialItems: ExtractedItem[] = targets.map(target => ({
            id: target.id,
            label: target.label,
            analysis: target.analysis,
            imageUrl: null,
            status: 'processing' as const,
        }));
        setItems(initialItems);
        setSelectedResultIds(new Set());

        // Create abort controller
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await Promise.all(targets.map(target => runExtractionForTarget(target, controller.signal)));
        } catch (err) {
            if (!isAbortError(err)) {
                setError(getErrorMessage(err));
            }
        } finally {
            setIsProcessing(false);
            abortRef.current = null;
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
        setIsProcessing(false);
    };

    const getTargetFromItem = (item: ExtractedItem): ExtractionTarget => ({
        id: item.id,
        label: item.label,
        englishName: item.analysis?.englishName || item.label,
        analysis: item.analysis,
    });

    const handleRegenerateItems = async (targetItems: ExtractedItem[]) => {
        if (!sourceImage || targetItems.length === 0 || isProcessing) return;
        setIsProcessing(true);
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await Promise.all(targetItems.map(item => runExtractionForTarget(getTargetFromItem(item), controller.signal)));
        } finally {
            setIsProcessing(false);
            abortRef.current = null;
        }
    };

    const getSelectedMatchTargets = (): MatchTarget[] =>
        MATCH_TARGETS.filter(target => selectedMatchTargets.has(target.id));

    const getEffectiveStyle = () => stylePrompt.trim() || DEFAULT_MATCH_STYLE;

    const buildMatchingItemPrompt = (target: MatchTarget): string => {
        const style = getEffectiveStyle();
        return `[ROLE: Senior ecommerce fashion stylist and product image generator]
[TASK: Generate one standalone matching fashion item from the product reference]
[MATCH TARGET: ${target.label} / ${target.englishName}]

[SOURCE PRODUCT]
- Image 1 is the user's core product. Analyze its category, color palette, material, texture, season, price feeling, silhouette, and style direction.
- The output must be a NEW complementary item that can be styled with Image 1.
- Do NOT copy Image 1, do NOT generate the same product, do NOT make a duplicate, and do NOT replace the target with the original product.
- Images 2+ are optional style references. Use them only for styling DNA, color mood, market taste, and outfit direction. Do not copy their exact products unless they naturally match the requested target.

[STYLE BRIEF]
- User style: ${style}
- Keep the generated item coordinated with the source product in color harmony, material logic, season, market positioning, and ecommerce appeal.
- The matching item should feel commercially useful, tasteful, and immediately pairable with the source product.

[OUTPUT]
- Generate ONLY one ${target.englishName}.
- Pure white background (#FFFFFF), clean catalog product image, centered with natural margins.
- No model, no person, no mannequin, no hanger, no extra props, no text, no watermark, no logo overlay.
- Preserve realistic construction, material texture, edges, hardware, seams, stitching, and scale for the target category.

[NEGATIVE]
duplicate of source product, same product as reference, copied source, full outfit, model, person, mannequin, hanger, multiple items, collage, text, watermark, logo overlay, colored background, gray background, beige background, tabletop, floor, wall, props, blurry, distorted shape, broken edges, unrealistic material`;
    };

    const buildOutfitPreviewPrompt = (targets: MatchTarget[], generatedItems: ExtractedItem[] = []): string => {
        const style = getEffectiveStyle();
        const targetLabels = targets.map(target => `${target.label} (${target.englishName})`).join(', ');
        const styleReferenceLine = matchReferenceImages.length > 0
            ? `- Images 2-${1 + matchReferenceImages.length} are user-uploaded style references only.`
            : '- No user-uploaded style reference images are attached.';
        const generatedItemStart = 2 + matchReferenceImages.length;
        const generatedItemGuide = generatedItems.length > 0
            ? generatedItems.map((item, index) => `- Image ${generatedItemStart + index}: generated matching item "${item.label}". The final model-wearing preview MUST use this exact item design, not a new substitute.`).join('\n')
            : '- No generated matching item images are attached yet. Use the selected matching targets as text guidance.';
        return `[ROLE: Senior ecommerce fashion stylist, virtual try-on director, and commercial fashion photographer]
[TASK: Create a photorealistic model-wearing outfit preview using the source product as the hero item]

[IMAGE ROUTING]
- Image 1 is the user's core product and MUST be worn naturally by the model in the final image.
- Preserve the source product's recognizable color, material, silhouette, construction, and style identity while adapting it realistically to the model's body.
- Do not redesign, recolor, simplify, or replace the source product.
${styleReferenceLine}
${matchReferenceImages.length > 0 ? '- Style references guide model styling, outfit mood, color harmony, scene taste, and ecommerce fashion direction only.' : ''}
${generatedItems.length > 0 ? `- Images ${generatedItemStart}+ are generated matching item references and have higher priority than style references.` : ''}

[GENERATED MATCHING ITEM LOCK]
${generatedItemGuide}
- CRITICAL: The worn outfit MUST be visually consistent with the already generated matching item images. Preserve their color, material, shape, print/pattern, hardware, texture, and style identity.
- Do NOT invent a different top, jacket, hat, jewelry, watch, shoes, bag, or glasses when a generated matching item image is provided.
- If a generated matching item is a watch, place it naturally on the model's wrist and keep it visible.
- If a generated matching item is jewelry, place it naturally as necklace, ring, bracelet, earrings, or related jewelry depending on the item image.

[MATCHING ITEMS TO INCLUDE]
- Dress the model with coordinated items for: ${targetLabels || 'shoes, bag, outerwear, bottom, jewelry'}.
- These matching items must match the generated standalone item references whenever those images are attached.

[STYLE BRIEF]
- User style: ${style}
- Build a cohesive, commercially attractive model outfit that helps shoppers understand how to wear and style the source product.
- The result must look like a finished fashion ecommerce model photo, not a product layout.

[OUTPUT]
- One photorealistic full-body or 3/4-body model wearing the complete outfit.
- Use a European or American fashion ecommerce model by default, with a Western commercial catalog casting direction.
- The model should have a natural fashion pose, realistic body proportions, natural hands, and clean commercial styling.
- Show the source product clearly on the model as the hero item. Integrate matching items naturally as worn clothing, shoes, bag, jewelry, hat, or eyewear.
- Keep all provided generated matching items visible unless physically impossible; do not omit small accessories such as watch, ring, necklace, bracelet, or eyewear.
- Use a clean ecommerce/editorial background that fits the style brief. No explanatory text, no labels, no watermark, no logo overlay.
- Avoid clutter. The outfit should be visible, plausible, coordinated, and attractive at thumbnail size.

[NEGATIVE]
flat lay, outfit board, product layout, product grid, items arranged on floor, tabletop, isolated products, model-free composition, different generated items, substituted jacket, substituted top, substituted hat, substituted jewelry, substituted watch, missing watch, missing jewelry, missing generated accessory, collage, split screen, missing source product, changed source product, duplicate products, unrelated style, messy collage, text labels, watermark, logo overlay, extra hands, distorted hands, broken fingers, distorted body, bad anatomy, unrealistic scale, blurry, low quality`;
    };

    const generateSingleMatchItem = async (target: MatchTarget, signal?: AbortSignal): Promise<string> => {
        if (!sourceImage?.base64) throw new Error('No source image');
        const results = await generateImageToImage(
            getMatchInputImages(),
            buildMatchingItemPrompt(target),
            {
                aspectRatio: selectedRatio,
                resolution: selectedResolution,
                modelId: selectedModel,
                signal,
                sampleCount: 1,
            }
        );
        if (!results || results.length === 0) {
            throw new Error(`未能生成 ${target.label}`);
        }
        return results[0];
    };

    const generateOutfitPreviewImage = async (targets: MatchTarget[], generatedItems: ExtractedItem[] = [], signal?: AbortSignal): Promise<string> => {
        if (!sourceImage?.base64) throw new Error('No source image');
        const generatedItemInputs = generatedItems
            .filter(item => item.status === 'done' && item.imageUrl?.startsWith('data:'))
            .map(item => {
                const [header, base64 = ''] = item.imageUrl!.split(',');
                const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
                return { base64, mimeType };
            });
        const results = await generateImageToImage(
            [...getMatchInputImages(), ...generatedItemInputs],
            buildOutfitPreviewPrompt(targets, generatedItems.filter(item => item.status === 'done' && item.imageUrl)),
            {
                aspectRatio: selectedRatio,
                resolution: selectedResolution,
                modelId: selectedModel,
                signal,
                sampleCount: 1,
            }
        );
        if (!results || results.length === 0) {
            throw new Error('未能生成整套搭配预览');
        }
        return results[0];
    };

    const runMatchForTarget = async (target: MatchTarget, signal: AbortSignal): Promise<ExtractedItem> => {
        setMatchItems(prev => prev.map(item =>
            item.id === target.id ? { ...item, status: 'processing' as const, imageUrl: null, error: undefined } : item
        ));

        try {
            const imageUrl = await generateSingleMatchItem(target, signal);
            const doneItem: ExtractedItem = {
                id: target.id,
                label: target.label,
                imageUrl,
                status: 'done',
            };
            setMatchItems(prev => prev.map(item =>
                item.id === target.id ? { ...item, ...doneItem, error: undefined } : item
            ));
            return doneItem;
        } catch (err) {
            const aborted = isAbortError(err);
            const errorItem: ExtractedItem = {
                id: target.id,
                label: target.label,
                imageUrl: null,
                status: 'error',
                error: aborted ? '已取消生成' : getErrorMessage(err),
            };
            setMatchItems(prev => prev.map(item =>
                item.id === target.id
                    ? { ...item, ...errorItem }
                    : item
            ));
            return errorItem;
        }
    };

    const runOutfitPreview = async (targets: MatchTarget[], signal: AbortSignal, generatedItems = matchItems) => {
        setOutfitPreview(prev => ({
            id: 'outfit-preview',
            label: '模特上身预览',
            imageUrl: prev?.imageUrl || null,
            status: 'processing',
            error: undefined,
        }));

        try {
            const imageUrl = await generateOutfitPreviewImage(targets, generatedItems, signal);
            setOutfitPreview({
                id: 'outfit-preview',
                label: '模特上身预览',
                imageUrl,
                status: 'done',
            });
        } catch (err) {
            const aborted = isAbortError(err);
            setOutfitPreview(prev => ({
                id: 'outfit-preview',
                label: '模特上身预览',
                imageUrl: prev?.imageUrl || null,
                status: 'error',
                error: aborted ? '已取消生成' : getErrorMessage(err),
            }));
        }
    };

    const handleGenerateMatch = async () => {
        const targets = getSelectedMatchTargets();
        if (!sourceImage) {
            setError('请先上传一张产品图片');
            return;
        }
        if (targets.length === 0) {
            setError('请至少选择一个搭配类型');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSelectedResultIds(new Set());

        const initialItems: ExtractedItem[] = targets.map(target => ({
            id: target.id,
            label: target.label,
            imageUrl: null,
            status: 'processing',
        }));
        setMatchItems(initialItems);
        setOutfitPreview({
            id: 'outfit-preview',
            label: '模特上身预览',
            imageUrl: null,
            status: 'processing',
        });

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const generatedItems = await Promise.all(targets.map(target => runMatchForTarget(target, controller.signal)));
            if (!controller.signal.aborted) {
                await runOutfitPreview(targets, controller.signal, generatedItems);
            }
        } finally {
            setIsProcessing(false);
            abortRef.current = null;
        }
    };

    const handleRegenerateMatchItems = async (targetItems: ExtractedItem[]) => {
        if (!sourceImage || targetItems.length === 0 || isProcessing) return;
        const targets = targetItems
            .map(item => MATCH_TARGETS.find(target => target.id === item.id))
            .filter((target): target is MatchTarget => Boolean(target));
        if (targets.length === 0) return;

        setIsProcessing(true);
        setError(null);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await Promise.all(targets.map(target => runMatchForTarget(target, controller.signal)));
        } finally {
            setIsProcessing(false);
            abortRef.current = null;
        }
    };

    const handleRegenerateOutfitPreview = async () => {
        if (!sourceImage || isProcessing) return;
        const targets = getSelectedMatchTargets();
        if (targets.length === 0) {
            setError('请至少选择一个搭配类型');
            return;
        }

        setIsProcessing(true);
        setError(null);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await runOutfitPreview(targets, controller.signal);
        } finally {
            setIsProcessing(false);
            abortRef.current = null;
        }
    };

    const toggleResultSelection = (id: string) => {
        setSelectedResultIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleMatchTarget = (id: string) => {
        setSelectedMatchTargets(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const applyStylePreset = (preset: string) => {
        setStylePrompt(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return preset;
            if (trimmed.includes(preset)) return trimmed;
            return `${trimmed} / ${preset}`;
        });
    };

    const handleDownload = (dataUrl: string, label: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${label}_提取图.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = async () => {
        const downloadable = activeWorkflow === 'match'
            ? [...matchItems, ...(outfitPreview ? [outfitPreview] : [])].filter(item => item.status === 'done' && item.imageUrl)
            : displayItems.filter(item => item.status === 'done' && item.imageUrl);
        for (let index = 0; index < downloadable.length; index++) {
            if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            handleDownload(downloadable[index].imageUrl!, `${downloadable[index].label}_${index + 1}`);
        }
    };

    const totalSelected = getExtractionTargets().length;
    const canExtract = sourceImage && totalSelected > 0 && !isProcessing;
    const selectedMatchTargetList = getSelectedMatchTargets();
    const canGenerateMatch = sourceImage && selectedMatchTargetList.length > 0 && !isProcessing;

    const displayItems = items;
    const displayDoneCount = displayItems.filter(i => i.status === 'done').length;
    const selectedResultItems = displayItems.filter(i => selectedResultIds.has(i.id));
    const selectedMatchResultItems = matchItems.filter(i => selectedResultIds.has(i.id));
    const matchDoneCount = matchItems.filter(i => i.status === 'done').length;
    const hasMatchPreview = outfitPreview?.status === 'done' && Boolean(outfitPreview.imageUrl);
    const hasDownloadableItems = activeWorkflow === 'match'
        ? matchDoneCount > 0 || hasMatchPreview
        : displayDoneCount > 0;

    return (
        <div className="h-full flex flex-col bg-pastel-bg text-pastel-text overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-8 py-5 border-b border-pastel-border bg-white/50 backdrop-blur-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-pastel-text tracking-tight">
                            {activeWorkflow === 'extract' ? '穿搭单品提取' : '产品搭配生成'}
                        </h1>
                        <p className="text-xs text-pastel-muted mt-1">
                            {activeWorkflow === 'extract'
                                ? '上传一张模特穿搭图，AI 自动拆解并提取每件单品的独立白底图'
                                : '上传一张产品图并给出风格，AI 自动生成搭配单品和整套搭配预览'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT: Upload & Config */}
                    <div className="space-y-5">
                        {/* Upload Area */}
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm">
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-4">
                                <Upload className="w-4 h-4 text-orange-500" />
                                {activeWorkflow === 'extract' ? '上传穿搭图片' : '上传产品图片'}
                            </h3>

                            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-pastel-border bg-pastel-bg/40 p-1">
                                {[
                                    { id: 'extract' as ActiveWorkflow, label: '搭配提取', icon: <Scissors className="h-4 w-4" /> },
                                    { id: 'match' as ActiveWorkflow, label: '搭配生成', icon: <Wand2 className="h-4 w-4" /> },
                                ].map(item => {
                                    const active = activeWorkflow === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => switchWorkflow(item.id)}
                                            disabled={isProcessing}
                                            className={`flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${
                                                active
                                                    ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white shadow-md'
                                                    : 'text-pastel-muted hover:bg-white/70'
                                            } disabled:opacity-50`}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {!sourceImage ? (
                                <div
                                    className="relative border-2 border-dashed border-pastel-border rounded-2xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all group"
                                    onClick={() => inputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onPaste={handlePaste}
                                    tabIndex={0}
                                >
                                    <div className="p-4 rounded-2xl bg-orange-50 w-fit mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <ImageIcon className="w-10 h-10 text-orange-400" />
                                    </div>
                                    <p className="text-sm font-bold text-pastel-text">点击上传或拖拽图片</p>
                                    <p className="text-[11px] text-pastel-muted mt-1">
                                        {activeWorkflow === 'extract'
                                            ? '支持 JPG/PNG/WebP，建议上传清晰的模特全身或半身穿搭照'
                                            : '支持 JPG/PNG/WebP，建议上传清晰的单品、商品图或局部产品图'}
                                    </p>
                                    <p className="text-[10px] text-pastel-muted/60 mt-1">
                                        也可直接 Ctrl+V 粘贴图片
                                    </p>
                                    <input
                                        ref={inputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                    />
                                </div>
                            ) : (
                                <div className="relative rounded-2xl overflow-hidden border border-pastel-border bg-black/5">
                                    <img
                                        src={sourceImage.preview}
                                        className="w-full max-h-[300px] object-contain"
                                        alt={activeWorkflow === 'extract' ? '穿搭原图' : '产品原图'}
                                    />
                                    <button
                                        onClick={removeImage}
                                        disabled={isProcessing}
                                        className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all disabled:opacity-30"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                                        <span className="text-white text-xs font-bold">
                                            {activeWorkflow === 'extract' ? '穿搭原图' : '产品原图'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {activeWorkflow === 'extract' && (isAnalyzing || analysisNotice) && (
                                <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                                    isAnalyzing
                                        ? 'border-purple-100 bg-purple-50 text-purple-700'
                                        : detectedItems.length > 0
                                            ? 'border-green-100 bg-green-50 text-green-700'
                                            : 'border-orange-100 bg-orange-50 text-orange-700'
                                }`}>
                                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    <span>{analysisNotice}</span>
                                </div>
                            )}
                        </div>

                        {/* Settings Card: Model + Ratio + Resolution */}
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm space-y-5">
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-blue-500" />
                                图像模型与输出设置
                            </h3>

                            {/* Model Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <Cpu className="w-3 h-3" /> 图像模型
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {MODEL_OPTIONS.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setSelectedModel(m.id)}
                                            className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border transition-all ${
                                                selectedModel === m.id
                                                    ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-100'
                                                    : 'border-gray-100 bg-pastel-bg'
                                            }`}
                                            title={m.desc}
                                        >
                                            <span className={`text-[10px] font-black ${selectedModel === m.id ? 'text-purple-700' : 'text-pastel-text'}`}>
                                                {m.name}
                                            </span>
                                            <span className="text-[8px] text-pastel-muted font-bold">{m.sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aspect Ratio Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <Ratio className="w-3 h-3" /> 输出比例
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {RATIO_OPTIONS.map(item => (
                                        <button
                                            key={item.value}
                                            onClick={() => setSelectedRatio(item.value)}
                                            className={`rounded-xl border py-2 text-center transition-all ${
                                                selectedRatio === item.value
                                                    ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm'
                                                    : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-[10px] font-bold block">{item.label}</span>
                                            <span className="text-[8px] opacity-60">{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Resolution Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <MonitorSmartphone className="w-3 h-3" /> 清晰度
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {RESOLUTION_OPTIONS.map(item => (
                                        <button
                                            key={item.value}
                                            onClick={() => setSelectedResolution(item.value)}
                                            className={`rounded-xl border py-2 text-center transition-all ${
                                                selectedResolution === item.value
                                                    ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm'
                                                    : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-xs font-bold block">{item.label}</span>
                                            <span className="text-[9px] opacity-60">{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {activeWorkflow === 'extract' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <Scissors className="w-3 h-3" /> 输出模式
                                </label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {[
                                        { id: 'precise' as ExtractionMode, title: '精准提取', desc: '保留原图轮廓、褶皱和遮挡，不补画隐藏部分' },
                                        { id: 'rebuild' as ExtractionMode, title: '商品重建', desc: '生成更完整的白底商品图，允许合理补全遮挡' },
                                    ].map(mode => {
                                        const active = extractionMode === mode.id;
                                        return (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setExtractionMode(mode.id)}
                                                disabled={isProcessing}
                                                className={`min-h-[4.25rem] rounded-xl border p-3 text-left transition-all ${
                                                    active
                                                        ? 'border-purple-300 bg-purple-50 text-purple-700 ring-1 ring-purple-100'
                                                        : 'border-gray-100 bg-white text-pastel-muted hover:border-purple-100'
                                                } disabled:opacity-50`}
                                            >
                                                <span className="block text-xs font-black">{mode.title}</span>
                                                <span className="mt-1 block text-[10px] leading-relaxed opacity-75">{mode.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Remove Elements */}
                        {activeWorkflow === 'extract' && (
                        <>
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm">
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-3">
                                <Trash2 className="w-4 h-4 text-red-400" />
                                要去除的元素
                            </h3>
                            <p className="text-[11px] text-pastel-muted mb-3">
                                选择要去除的元素类型（会自动去除人物、背景等）
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {REMOVE_TAGS.map(tag => {
                                    const sel = removeTags.has(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => !isProcessing && toggleRemoveTag(tag.id)}
                                            disabled={isProcessing}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                sel
                                                    ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                                                    : 'bg-gray-50 border-gray-100 text-pastel-muted hover:border-red-100'
                                            } disabled:opacity-40`}
                                        >
                                            {sel && <CheckCircle2 className="w-3 h-3" />}
                                            {tag.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        </>
                        )}

                        {activeWorkflow === 'match' && (
                            <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm space-y-5">
                                <div>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-orange-500" />
                                            搭配参考图
                                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                                                {matchReferenceImages.length}/{MAX_MATCH_REFERENCE_IMAGES}
                                            </span>
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => referenceInputRef.current?.click()}
                                            disabled={isProcessing || matchReferenceImages.length >= MAX_MATCH_REFERENCE_IMAGES}
                                            className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 disabled:opacity-40"
                                        >
                                            上传参考图
                                        </button>
                                    </div>
                                    <input
                                        ref={referenceInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={e => {
                                            handleReferenceUpload(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                    {matchReferenceImages.length > 0 ? (
                                        <div className="grid grid-cols-5 gap-2">
                                            {matchReferenceImages.map(image => (
                                                <div key={image.preview} className="group relative overflow-hidden rounded-xl border border-pastel-border bg-white">
                                                    <img src={image.preview} alt="搭配参考图" className="h-20 w-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeReferenceImage(image.preview)}
                                                        disabled={isProcessing}
                                                        className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100 disabled:opacity-30"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {matchReferenceImages.length < MAX_MATCH_REFERENCE_IMAGES && (
                                                <button
                                                    type="button"
                                                    onClick={() => referenceInputRef.current?.click()}
                                                    disabled={isProcessing}
                                                    className="flex h-20 items-center justify-center rounded-xl border border-dashed border-pastel-border bg-pastel-bg/40 text-pastel-muted transition-all hover:border-orange-200 hover:bg-orange-50 disabled:opacity-40"
                                                >
                                                    <Plus className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => referenceInputRef.current?.click()}
                                            disabled={isProcessing}
                                            className="flex min-h-[4.5rem] w-full items-center justify-center rounded-xl border border-dashed border-pastel-border bg-pastel-bg/30 text-xs font-bold text-pastel-muted transition-all hover:border-orange-200 hover:bg-orange-50 disabled:opacity-40"
                                        >
                                            可选：上传最多 5 张参考图，用于风格、色调和搭配方向
                                        </button>
                                    )}
                                    {(isAnalyzingMatchNeeds || matchAnalysisNotice) && (
                                        <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                                            isAnalyzingMatchNeeds
                                                ? 'border-purple-100 bg-purple-50 text-purple-700'
                                                : 'border-green-100 bg-green-50 text-green-700'
                                        }`}>
                                            {isAnalyzingMatchNeeds ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
                                            <span className="leading-relaxed">{matchAnalysisNotice}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-2">
                                        <Palette className="w-4 h-4 text-purple-500" />
                                        搭配风格
                                    </h3>
                                    <textarea
                                        value={stylePrompt}
                                        onChange={e => setStylePrompt(e.target.value)}
                                        placeholder="例如：美式复古通勤 / SHEIN 甜酷 / 极简高级灰"
                                        disabled={isProcessing}
                                        className="min-h-[5rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg/40 px-3 py-2 text-xs text-pastel-text outline-none placeholder:text-pastel-muted/50 focus:ring-2 focus:ring-purple-200 disabled:opacity-50"
                                    />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {STYLE_PRESETS.map(preset => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => applyStylePreset(preset)}
                                                disabled={isProcessing}
                                                className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 transition-all hover:bg-purple-100 disabled:opacity-40"
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-[10px] text-pastel-muted">
                                        未填写时默认使用“{DEFAULT_MATCH_STYLE}”。
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-3">
                                        <ShoppingBag className="w-4 h-4 text-orange-500" />
                                        搭配类型
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {MATCH_TARGETS.map(target => {
                                            const selected = selectedMatchTargets.has(target.id);
                                            return (
                                                <button
                                                    key={target.id}
                                                    type="button"
                                                    onClick={() => !isProcessing && toggleMatchTarget(target.id)}
                                                    disabled={isProcessing}
                                                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                                        selected
                                                            ? 'border-orange-200 bg-orange-50 text-orange-700 shadow-sm'
                                                            : 'border-gray-100 bg-gray-50 text-pastel-muted hover:border-orange-100'
                                                    } disabled:opacity-40`}
                                                >
                                                    {target.icon}
                                                    {target.label}
                                                    {selected && <CheckCircle2 className="w-3 h-3" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedMatchTargetList.length > 0 && (
                                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                                            <Sparkles className="w-4 h-4 text-orange-500" />
                                            <span className="text-xs font-bold text-orange-700">
                                                将生成 {selectedMatchTargetList.length} 件搭配单品 + 1 张模特上身预览
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Extract Items */}
                        {activeWorkflow === 'extract' && (
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm">
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-3">
                                <Scissors className="w-4 h-4 text-purple-500" />
                                要提取的单品
                            </h3>
                            <p className="text-[11px] text-pastel-muted mb-3">
                                选择或输入你想从穿搭中提取出来的单品（最多 8 件）
                            </p>

                            {detectedItems.length > 0 && (
                                <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/50 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs font-black text-green-700">
                                            <Sparkles className="h-4 w-4" />
                                            AI 已识别搭配
                                        </div>
                                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-green-700">
                                            已预选 {selectedDetectedIds.size}/{detectedItems.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {detectedItems.map(item => {
                                            const sel = selectedDetectedIds.has(item.id);
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => !isProcessing && toggleDetectedItem(item.id)}
                                                    disabled={isProcessing}
                                                    className={`min-h-[5.5rem] rounded-xl border p-3 text-left transition-all ${
                                                        sel
                                                            ? 'border-green-300 bg-white text-green-800 shadow-sm'
                                                            : 'border-green-100 bg-white/60 text-pastel-muted hover:border-green-200'
                                                    } disabled:opacity-40`}
                                                >
                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                        <span className="truncate text-xs font-black">{item.label}</span>
                                                        <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700">
                                                            {Math.round(item.confidence * 100)}%
                                                        </span>
                                                    </div>
                                                    <p className="line-clamp-2 text-[10px] leading-relaxed opacity-80">{item.colorMaterial}</p>
                                                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed opacity-70">{item.occlusion || item.keyDetails}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Preset Tags */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {PRESET_ITEMS.map(item => {
                                    const sel = selectedPresets.has(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => !isProcessing && togglePreset(item.id)}
                                            disabled={isProcessing}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                sel
                                                    ? 'bg-purple-50 border-purple-200 text-purple-600 shadow-sm'
                                                    : 'bg-gray-50 border-gray-100 text-pastel-muted hover:border-purple-100'
                                            } disabled:opacity-40`}
                                        >
                                            {item.icon}
                                            {item.label}
                                            {sel && <CheckCircle2 className="w-3 h-3" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom Item Input */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={customInput}
                                    onChange={e => setCustomInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                                    placeholder="输入自定义单品，如：丝巾、腰带..."
                                    className="flex-1 px-3 py-2 bg-pastel-bg/40 border border-pastel-border rounded-xl text-xs text-pastel-text focus:ring-2 focus:ring-purple-200 outline-none placeholder:text-pastel-muted/50"
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={addCustomItem}
                                    disabled={isProcessing || !customInput.trim()}
                                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold hover:bg-purple-100 transition-all disabled:opacity-30 flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    添加
                                </button>
                            </div>

                            {/* Custom Items List */}
                            {customItems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {customItems.map(item => (
                                        <span
                                            key={item}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-[10px] font-bold text-purple-600"
                                        >
                                            <Tag className="w-3 h-3" />
                                            {item}
                                            <button
                                                onClick={() => !isProcessing && removeCustomItem(item)}
                                                disabled={isProcessing}
                                                className="ml-0.5 p-0.5 hover:bg-purple-200 rounded-full disabled:opacity-30"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Selected Summary */}
                            {totalSelected > 0 && (
                                <div className="flex items-center gap-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                                    <Sparkles className="w-4 h-4 text-orange-500" />
                                    <span className="text-xs font-bold text-orange-700">
                                        共 {totalSelected} 件单品待提取
                                    </span>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={isProcessing ? handleCancel : activeWorkflow === 'match' ? handleGenerateMatch : handleExtract}
                            disabled={activeWorkflow === 'match' ? (!canGenerateMatch && !isProcessing) : (!canExtract && !isProcessing)}
                            className={`w-full py-4 rounded-[1.25rem] text-base font-black flex items-center justify-center gap-2.5 shadow-lg transition-all ${
                                isProcessing
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : (activeWorkflow === 'match' ? canGenerateMatch : canExtract)
                                        ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:scale-[1.01] active:scale-95'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {activeWorkflow === 'match' ? '取消生成' : '取消提取'}
                                </>
                            ) : (
                                <>
                                    {activeWorkflow === 'match' ? <Wand2 className="w-5 h-5" /> : <Scissors className="w-5 h-5" />}
                                    {activeWorkflow === 'match'
                                        ? `开始生成搭配 (${selectedMatchTargetList.length} 件 + 预览)`
                                        : `开始提取 (${totalSelected} 件)`}
                                </>
                            )}
                        </button>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Results */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-5 shadow-sm min-h-[300px]">
                            {activeWorkflow === 'extract' ? (
                            <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-green-500" />
                                提取结果
                                {displayItems.length > 0 && (
                                    <span className="text-[10px] text-pastel-muted font-normal">
                                        ({displayDoneCount}/{displayItems.length})
                                    </span>
                                )}
                            </h3>
                                {displayItems.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedResultIds(new Set(displayItems.map(item => item.id)))}
                                            disabled={isProcessing}
                                            className="flex items-center gap-1 rounded-lg border border-pastel-border bg-white px-3 py-1.5 text-[10px] font-bold text-pastel-text transition-all hover:bg-pastel-bg disabled:opacity-40"
                                        >
                                            <CheckSquare className="h-3 w-3" />
                                            全选
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRegenerateItems(selectedResultItems)}
                                            disabled={isProcessing || selectedResultItems.length === 0}
                                            className="flex items-center gap-1 rounded-lg border border-purple-100 bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-700 transition-all hover:bg-purple-100 disabled:opacity-40"
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            重生成选中({selectedResultItems.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadAll}
                                            disabled={!hasDownloadableItems}
                                            className="flex items-center gap-1 rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-[10px] font-bold text-green-700 transition-all hover:bg-green-100 disabled:opacity-40"
                                        >
                                            <Download className="h-3 w-3" />
                                            全部下载
                                        </button>
                                    </div>
                                )}
                            </div>

                            {items.length === 0 && !isProcessing && (
                                <div className="py-16 text-center">
                                    <div className="p-4 rounded-2xl bg-pastel-bg w-fit mx-auto mb-3">
                                        <Scissors className="w-10 h-10 text-pastel-muted/30" />
                                    </div>
                                    <p className="text-sm font-bold text-pastel-muted">尚无提取结果</p>
                                    <p className="text-[11px] text-pastel-muted/60 mt-1">
                                        上传图片并选择单品种类后开始提取
                                    </p>
                                </div>
                            )}

                            {/* Results Grid — skip the first item */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {displayItems.map(item => {
                                    const selected = selectedResultIds.has(item.id);
                                    return (
                                    <div
                                        key={item.id}
                                        className={`rounded-2xl border overflow-hidden transition-all ${
                                            selected
                                                ? 'border-purple-300 bg-purple-50/30 shadow-sm ring-2 ring-purple-100'
                                                : item.status === 'done'
                                                ? 'border-green-200 bg-green-50/20 shadow-sm'
                                                : item.status === 'error'
                                                    ? 'border-red-200 bg-red-50/20'
                                                    : 'border-pastel-border bg-white'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
                                            <button
                                                type="button"
                                                onClick={() => toggleResultSelection(item.id)}
                                                disabled={isProcessing}
                                                className="min-w-0 text-xs font-bold text-pastel-text flex items-center gap-1.5 disabled:opacity-50"
                                                title="选择后可批量重新生成"
                                            >
                                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                    selected ? 'border-purple-400 bg-purple-500 text-white' : 'border-pastel-border bg-white'
                                                }`}>
                                                    {selected && <CheckCircle2 className="h-3 w-3" />}
                                                </span>
                                                <Tag className="w-3 h-3 text-purple-400" />
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRegenerateItems([item])}
                                                    disabled={isProcessing}
                                                    className="rounded-md p-1 text-pastel-muted transition-all hover:bg-white hover:text-purple-600 disabled:opacity-40"
                                                    title="重新生成当前单品"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </button>
                                                {item.status === 'processing' && (
                                                    <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                                                )}
                                                {item.status === 'done' && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                )}
                                                {item.status === 'error' && (
                                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="aspect-square bg-white flex items-center justify-center p-2">
                                            {item.status === 'pending' && (
                                                <span className="text-[10px] text-pastel-muted">等待中...</span>
                                            )}
                                            {item.status === 'processing' && (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                                                    <span className="text-[10px] text-pastel-muted">AI 提取中...</span>
                                                </div>
                                            )}
                                            {item.status === 'error' && (
                                                <div className="flex flex-col items-center gap-2 text-center px-2">
                                                    <AlertCircle className="w-6 h-6 text-red-300" />
                                                    <span className="text-[10px] text-red-400">{item.error || '提取失败'}</span>
                                                </div>
                                            )}
                                            {item.status === 'done' && item.imageUrl && (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.label}
                                                    className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => setSelectedPreview(item.imageUrl)}
                                                />
                                            )}
                                        </div>

                                        {/* Card Footer */}
                                        {item.status === 'done' && item.imageUrl && (
                                            <div className="px-3 py-2 border-t border-inherit flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleRegenerateItems([item])}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-pastel-bg transition-all disabled:opacity-40"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    重新生成
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(item.imageUrl!, item.label)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-pastel-bg transition-all"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    下载原图
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                            </>
                            ) : (
                            <div className="space-y-6">
                                <div>
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-green-500" />
                                            搭配单品
                                            {matchItems.length > 0 && (
                                                <span className="text-[10px] text-pastel-muted font-normal">
                                                    ({matchDoneCount}/{matchItems.length})
                                                </span>
                                            )}
                                        </h3>
                                        {matchItems.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedResultIds(new Set(matchItems.map(item => item.id)))}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 rounded-lg border border-pastel-border bg-white px-3 py-1.5 text-[10px] font-bold text-pastel-text transition-all hover:bg-pastel-bg disabled:opacity-40"
                                                >
                                                    <CheckSquare className="h-3 w-3" />
                                                    全选
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRegenerateMatchItems(selectedMatchResultItems)}
                                                    disabled={isProcessing || selectedMatchResultItems.length === 0}
                                                    className="flex items-center gap-1 rounded-lg border border-purple-100 bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-700 transition-all hover:bg-purple-100 disabled:opacity-40"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    重生成选中({selectedMatchResultItems.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleDownloadAll}
                                                    disabled={!hasDownloadableItems}
                                                    className="flex items-center gap-1 rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-[10px] font-bold text-green-700 transition-all hover:bg-green-100 disabled:opacity-40"
                                                >
                                                    <Download className="h-3 w-3" />
                                                    全部下载
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {matchItems.length === 0 && !isProcessing && !outfitPreview && (
                                        <div className="py-14 text-center">
                                            <div className="p-4 rounded-2xl bg-pastel-bg w-fit mx-auto mb-3">
                                                <Wand2 className="w-10 h-10 text-pastel-muted/30" />
                                            </div>
                                            <p className="text-sm font-bold text-pastel-muted">尚无搭配生成结果</p>
                                            <p className="text-[11px] text-pastel-muted/60 mt-1">
                                                上传产品图片并选择风格后开始生成
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {matchItems.map(item => {
                                            const selected = selectedResultIds.has(item.id);
                                            return (
                                            <div
                                                key={item.id}
                                                className={`rounded-2xl border overflow-hidden transition-all ${
                                                    selected
                                                        ? 'border-purple-300 bg-purple-50/30 shadow-sm ring-2 ring-purple-100'
                                                        : item.status === 'done'
                                                            ? 'border-green-200 bg-green-50/20 shadow-sm'
                                                            : item.status === 'error'
                                                                ? 'border-red-200 bg-red-50/20'
                                                                : 'border-pastel-border bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleResultSelection(item.id)}
                                                        disabled={isProcessing}
                                                        className="min-w-0 text-xs font-bold text-pastel-text flex items-center gap-1.5 disabled:opacity-50"
                                                        title="选择后可批量重新生成"
                                                    >
                                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                            selected ? 'border-purple-400 bg-purple-500 text-white' : 'border-pastel-border bg-white'
                                                        }`}>
                                                            {selected && <CheckCircle2 className="h-3 w-3" />}
                                                        </span>
                                                        <Tag className="w-3 h-3 text-purple-400" />
                                                        <span className="truncate">{item.label}</span>
                                                    </button>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRegenerateMatchItems([item])}
                                                            disabled={isProcessing}
                                                            className="rounded-md p-1 text-pastel-muted transition-all hover:bg-white hover:text-purple-600 disabled:opacity-40"
                                                            title="重新生成当前搭配单品"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </button>
                                                        {item.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
                                                        {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                                        {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                                    </div>
                                                </div>

                                                <div className="aspect-square bg-white flex items-center justify-center p-2">
                                                    {item.status === 'processing' && (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                                                            <span className="text-[10px] text-pastel-muted">AI 生成中...</span>
                                                        </div>
                                                    )}
                                                    {item.status === 'error' && (
                                                        <div className="flex flex-col items-center gap-2 text-center px-2">
                                                            <AlertCircle className="w-6 h-6 text-red-300" />
                                                            <span className="text-[10px] text-red-400">{item.error || '生成失败'}</span>
                                                        </div>
                                                    )}
                                                    {item.status === 'done' && item.imageUrl && (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.label}
                                                            className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                                            onClick={() => setSelectedPreview(item.imageUrl)}
                                                        />
                                                    )}
                                                </div>

                                                {item.status === 'done' && item.imageUrl && (
                                                    <div className="px-3 py-2 border-t border-inherit flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleRegenerateMatchItems([item])}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-pastel-bg transition-all disabled:opacity-40"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                            重新生成
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(item.imageUrl!, item.label)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-pastel-bg transition-all"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            下载原图
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-orange-100 bg-orange-50/20 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4 text-orange-500" />
                                            模特上身预览
                                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                                                3:4
                                            </span>
                                        </h3>
                                        {outfitPreview?.imageUrl && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleRegenerateOutfitPreview}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-[10px] font-bold text-purple-700 transition-all hover:bg-purple-50 disabled:opacity-40"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    重新生成
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => outfitPreview.imageUrl && handleDownload(outfitPreview.imageUrl, outfitPreview.label)}
                                                    className="flex items-center gap-1 rounded-lg border border-green-100 bg-white px-3 py-1.5 text-[10px] font-bold text-green-700 transition-all hover:bg-green-50"
                                                >
                                                    <Download className="h-3 w-3" />
                                                    下载
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-h-[18rem] rounded-2xl bg-white flex items-center justify-center p-3">
                                        {outfitPreview?.status === 'processing' && (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-7 h-7 text-orange-400 animate-spin" />
                                                <span className="text-xs font-bold text-pastel-muted">AI 正在生成模特上身效果...</span>
                                            </div>
                                        )}
                                        {outfitPreview?.status === 'error' && (
                                            <div className="flex flex-col items-center gap-2 text-center px-2">
                                                <AlertCircle className="w-7 h-7 text-red-300" />
                                                <span className="text-xs font-bold text-red-400">{outfitPreview.error || '预览生成失败'}</span>
                                            </div>
                                        )}
                                        {outfitPreview?.status === 'done' && outfitPreview.imageUrl && (
                                            <img
                                                src={outfitPreview.imageUrl}
                                                alt={outfitPreview.label}
                                                className="max-h-[34rem] w-full object-contain cursor-pointer hover:scale-[1.01] transition-transform"
                                                onClick={() => setSelectedPreview(outfitPreview.imageUrl)}
                                            />
                                        )}
                                        {!outfitPreview && (
                                            <p className="text-xs font-bold text-pastel-muted">生成后会在这里展示模特上身效果</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedPreview && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 backdrop-blur-2xl"
                    onClick={() => setSelectedPreview(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-white rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                        onClick={e => e.stopPropagation()}
                    >
                        <img src={selectedPreview} className="max-h-[80vh] w-auto object-contain" alt="preview" />
                        <button
                            onClick={() => setSelectedPreview(null)}
                            className="absolute top-6 right-6 p-3 bg-black/20 hover:bg-black/50 text-white rounded-full transition-all backdrop-blur-md"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutfitExtractionTab;
