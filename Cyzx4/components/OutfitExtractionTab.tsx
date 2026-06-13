import React, { useState, useRef } from 'react';
import {
    Upload, X, Sparkles, Loader2,
    Download, Scissors, Shirt, Tag,
    CheckCircle2, AlertCircle, Image as ImageIcon,
    ShoppingBag, Watch, Footprints, Crown, Plus, Trash2,
    Glasses, Gem, MonitorSmartphone, Ratio, Cpu
} from 'lucide-react';
import { analyzeOutfitItems, generateImageToImage, compressImage, type OutfitAnalysisItem } from '../services/geminiService';
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

interface ExtractionTarget {
    id: string;
    label: string;
    englishName: string;
    analysis?: OutfitAnalysisItem;
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
    // Image state
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);

    // Remove elements (tag-based selection)
    const [removeTags, setRemoveTags] = useState<Set<string>>(
        new Set(REMOVE_TAGS.filter(t => t.default).map(t => t.id))
    );

    // Settings
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [selectedResolution, setSelectedResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');
    const [extractionMode, setExtractionMode] = useState<ExtractionMode>('precise');

    // Items to extract
    const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
    const [detectedItems, setDetectedItems] = useState<OutfitAnalysisItem[]>([]);
    const [selectedDetectedIds, setSelectedDetectedIds] = useState<Set<string>>(new Set());
    const [customItems, setCustomItems] = useState<string[]>([]);
    const [customInput, setCustomInput] = useState('');

    // Generation state
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [items, setItems] = useState<ExtractedItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);

    // Preview
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
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
            setDetectedItems([]);
            setSelectedDetectedIds(new Set());
            setIsProcessing(false);

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

    const removeImage = () => {
        analysisAbortRef.current?.abort();
        if (sourceImage?.preview) URL.revokeObjectURL(sourceImage.preview);
        setSourceImage(null);
        setItems([]);
        setDetectedItems([]);
        setSelectedDetectedIds(new Set());
        setError(null);
        setAnalysisNotice(null);
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
- Premium product catalog photo on pure white background (#FFFFFF), not transparent and not checkerboard.
- Clean refined edges, no jagged mask, no leftover skin/hair/background pixels, no white holes, no pasted-crop feeling.
- Natural product presentation: flat-lay, ghost-mannequin, or standalone packshot as appropriate for "${itemLabel}".
- Add a very subtle natural contact shadow only if it helps the product read as a finished catalog image.
- No visible person, body parts, mannequin, hanger, or extra objects.
- The "${itemLabel}" must fill the frame naturally at ${ratioText} aspect ratio.

[NEGATIVE]
raw cutout, in-place mask, copied crop, jagged edge, broken edge, leftover body, leftover skin, leftover hair, background fragments, white holes, occlusion gaps, incomplete product, distorted product, changed color, changed pattern, added logo, low resolution, blurry, messy shadow`;
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
- Preserve original item placement as much as possible inside ${ratioText}; do not force a polished flat-lay if it changes the true shape.
- Clean mask edges, no leftover skin/hair/background, no jagged edge, no white holes inside visible target pixels.

[NEGATIVE]
wrong item, all clothing kept, extra garments, leftover body, leftover skin, leftover hair, background fragments, changed color, changed pattern, invented logo, completed hidden parts, redesigned item, blurry product details`;
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
- Premium product catalog photo on pure white background (#FFFFFF), not transparent and not checkerboard.
- Natural product presentation: flat-lay, ghost-mannequin, or standalone packshot as appropriate for "${itemLabel}".
- Add a very subtle natural contact shadow only if it helps the product read as a finished catalog image.
- The "${itemLabel}" must fill the frame naturally at ${ratioText} aspect ratio.

[NEGATIVE]
raw cutout, in-place mask, copied crop, jagged edge, broken edge, leftover body, leftover skin, leftover hair, background fragments, white holes, occlusion gaps, incomplete product, distorted product, changed color, changed pattern, added logo, low resolution, blurry, messy shadow`;
    };

    const extractSingleTarget = async (target: ExtractionTarget, signal?: AbortSignal): Promise<string> => {
        if (!sourceImage?.base64) throw new Error('No source image');
        const prompt = buildSmartExtractionPrompt(target, selectedRatio);
        const results = await generateImageToImage(
            [{ base64: sourceImage.base64, mimeType: sourceImage.mime || 'image/png' }],
            prompt,
            {
                aspectRatio: selectedRatio,
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
            status: 'pending' as const,
        }));
        setItems(initialItems);

        // Create abort controller
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            for (const target of targets) {
                setItems(prev => prev.map(i =>
                    i.id === target.id ? { ...i, status: 'processing' as const } : i
                ));

                try {
                    const imageUrl = await extractSingleTarget(target, controller.signal);
                    setItems(prev => prev.map(i =>
                        i.id === target.id
                            ? { ...i, imageUrl, status: 'done' as const, error: undefined }
                            : i
                    ));
                } catch (err) {
                    if (isAbortError(err)) throw err;
                    console.error(`Extraction failed for "${target.label}":`, err);
                    setItems(prev => prev.map(i =>
                        i.id === target.id
                            ? { ...i, imageUrl: null, status: 'error' as const, error: getErrorMessage(err) }
                            : i
                    ));
                }
            }
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

    const handleDownload = (dataUrl: string, label: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${label}_提取图.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalSelected = getExtractionTargets().length;
    const canExtract = sourceImage && totalSelected > 0 && !isProcessing;

    const displayItems = items;
    const displayDoneCount = displayItems.filter(i => i.status === 'done').length;

    return (
        <div className="h-full flex flex-col bg-pastel-bg text-pastel-text overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-8 py-5 border-b border-pastel-border bg-white/50 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl font-black text-pastel-text tracking-tight">
                        穿搭单品提取
                    </h1>
                    <p className="text-xs text-pastel-muted mt-1">
                        上传一张模特穿搭图，AI 自动拆解并提取每件单品的独立白底图
                    </p>
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
                                上传穿搭图片
                            </h3>

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
                                        支持 JPG/PNG/WebP，建议上传清晰的模特全身或半身穿搭照
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
                                        alt="穿搭原图"
                                    />
                                    <button
                                        onClick={removeImage}
                                        disabled={isProcessing}
                                        className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all disabled:opacity-30"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                                        <span className="text-white text-xs font-bold">穿搭原图</span>
                                    </div>
                                </div>
                            )}
                            {(isAnalyzing || analysisNotice) && (
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
                        </div>

                        {/* Remove Elements */}
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

                        {/* Extract Items */}
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

                        {/* Action Button */}
                        <button
                            onClick={isProcessing ? handleCancel : handleExtract}
                            disabled={!canExtract && !isProcessing}
                            className={`w-full py-4 rounded-[1.25rem] text-base font-black flex items-center justify-center gap-2.5 shadow-lg transition-all ${
                                isProcessing
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : canExtract
                                        ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:scale-[1.01] active:scale-95'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    取消提取
                                </>
                            ) : (
                                <>
                                    <Scissors className="w-5 h-5" />
                                    开始提取 ({totalSelected} 件)
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
                            <h3 className="font-bold text-pastel-text text-sm flex items-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-green-500" />
                                提取结果
                                {displayItems.length > 0 && (
                                    <span className="text-[10px] text-pastel-muted font-normal">
                                        ({displayDoneCount}/{displayItems.length})
                                    </span>
                                )}
                            </h3>

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
                                {displayItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`rounded-2xl border overflow-hidden transition-all ${
                                            item.status === 'done'
                                                ? 'border-green-200 bg-green-50/20 shadow-sm'
                                                : item.status === 'error'
                                                    ? 'border-red-200 bg-red-50/20'
                                                    : 'border-pastel-border bg-white'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
                                            <span className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
                                                <Tag className="w-3 h-3 text-purple-400" />
                                                {item.label}
                                            </span>
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

                                        {/* Card Body */}
                                        <div className="aspect-square bg-[#F5F5F5] flex items-center justify-center p-2">
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
                                            <div className="px-3 py-2 border-t border-inherit flex justify-center">
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
                                ))}
                            </div>
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
