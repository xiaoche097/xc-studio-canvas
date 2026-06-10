import React, { useState, useRef } from 'react';
import {
    Upload, X, Sparkles, Loader2,
    Download, Scissors, Shirt, Tag,
    CheckCircle2, AlertCircle, Image as ImageIcon,
    ShoppingBag, Watch, Footprints, Crown, Plus, Trash2,
    Glasses, Gem, MonitorSmartphone, Ratio, Cpu
} from 'lucide-react';
import { generateImageToImage, compressImage } from '../services/geminiService';
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
    error?: string;
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

    // Items to extract
    const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
    const [customItems, setCustomItems] = useState<string[]>([]);
    const [customInput, setCustomInput] = useState('');

    // Generation state
    const [isProcessing, setIsProcessing] = useState(false);
    const [items, setItems] = useState<ExtractedItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Preview
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

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
        try {
            const uploaded = await processUploadFile(file);
            setSourceImage(uploaded);
            setItems([]);
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
        if (sourceImage?.preview) URL.revokeObjectURL(sourceImage.preview);
        setSourceImage(null);
        setItems([]);
        setError(null);
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

        return `[ROLE: Senior fashion image masking and garment extraction specialist]
[TASK: Perform exact in-place garment extraction from the source image]
[EXTRACT TARGET: ${itemLabel}]

[ABSOLUTE GOAL]
- Extract ONLY the "${itemLabel}" from the image.
- Keep the "${itemLabel}" exactly where it is in the original image.
- Preserve the original camera angle, pose-driven shape, perspective, folds, stretch, wrinkles, drape, fabric shadows, and occlusion contours.
- Do NOT straighten, rotate, recenter, resize, redraw, complete, beautify, or redesign the clothing.
- The output must look like the source image with every non-"${itemLabel}" pixel painted pure white.

[STRICT KEEP]
- Preserve all visible "${itemLabel}" pixels exactly as they appear: silhouette, color, pattern, trims, buttons, zippers, seams, folds, drape, fabric texture, stitching, labels, and construction details.
- If "${itemLabel}" overlaps with other garments, keep only the "${itemLabel}" portion and paint the overlapping areas white where they are hidden.

[STRICT REMOVE]
- Remove ALL non-"${itemLabel}" pixels:${removal}
- Remove: body, skin, face, head, hair, hands, arms, legs, feet, background, room, studio, floor, props, accessories, jewelry, bags, phones, hanger, mannequin, text, watermark, and logo overlays.
- Remove all OTHER clothing items that are NOT "${itemLabel}".
- Where removed body parts or props occluded the garment, do not hallucinate missing fabric; leave those removed/occluded pixels pure white.

[OUTPUT]
- Same garment placement and angle as the original source image.
- Pure white background (#FFFFFF), not transparent and not checkerboard.
- No visible person, body parts, mannequin, hanger, or extra objects.
- Preserve pixel-level alignment as closely as possible.
- The extracted "${itemLabel}" must fill the frame naturally at ${ratioText} aspect ratio.`;
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
                workflowHint: 'garment-extraction',
                signal,
                sampleCount: 1,
            }
        );

        if (!results || results.length === 0) {
            throw new Error(`未能生成 ${itemLabel}`);
        }
        return results[0];
    };

    const handleExtract = async () => {
        const allItemLabels: string[] = [
            ...Array.from(selectedPresets).map(id => PRESET_ITEMS.find(p => p.id === id)?.label || id),
            ...customItems,
        ];

        if (allItemLabels.length === 0) {
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
        const initialItems: ExtractedItem[] = allItemLabels.map(label => ({
            id: label,
            label,
            imageUrl: null,
            status: 'pending' as const,
        }));
        setItems(initialItems);

        // Create abort controller
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const results: ExtractedItem[] = [];

            for (const itemLabel of allItemLabels) {
                setItems(prev => prev.map(i =>
                    i.label === itemLabel ? { ...i, status: 'processing' as const } : i
                ));

                try {
                    const imageUrl = await extractSingleItem(itemLabel, controller.signal);
                    results.push({
                        id: itemLabel,
                        label: itemLabel,
                        imageUrl,
                        status: 'done' as const,
                    });
                } catch (err) {
                    if (isAbortError(err)) throw err;
                    console.error(`Extraction failed for "${itemLabel}":`, err);
                    results.push({
                        id: itemLabel,
                        label: itemLabel,
                        imageUrl: null,
                        status: 'error' as const,
                        error: getErrorMessage(err),
                    });
                }

                // Update items progressively
                setItems([...results]);
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

    const totalSelected = selectedPresets.size + customItems.length;
    const canExtract = sourceImage && totalSelected > 0 && !isProcessing;

    // Display results skipping the first item
    const displayItems = items.slice(1);
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
