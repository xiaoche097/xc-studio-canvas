

// ... existing imports
import { AppNode, NodeStatus, NodeType } from '../types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, Settings, SlidersHorizontal, Grid3X3, Rotate3D, SunMedium, Bot, Replace } from 'lucide-react';
import { SceneDirectorOverlay } from './VideoNodeModules';
import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { STYLE_PRESETS, StylePreset } from '../../Cyzx4/constants/stylePresets';
import * as mammoth from 'mammoth/mammoth.browser';

// ... (keep constants and helper functions: arePropsEqual, safePlay, safePause, InputThumbnails, AudioVisualizer) ...

// Restore missing constants
interface InputAsset {
    id: string;
    type: 'image' | 'video' | 'audio';
    src: string;
}

interface NodeProps {
    node: AppNode;
    onUpdate: (id: string, data: Partial<AppNode['data']>, size?: { width?: number, height?: number }, title?: string) => void;
    onAction: (id: string, prompt?: string) => void;
    onDelete: (id: string) => void;
    onExpand?: (data: { type: 'image' | 'video', src: string, rect: DOMRect, images?: string[], initialIndex?: number }) => void;
    onCrop?: (id: string, imageBase64: string) => void;
    onAddToAgent?: (image: string, title: string) => void;
    onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onPortMouseUp: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
    onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
    inputAssets?: InputAsset[];
    onInputReorder?: (nodeId: string, newOrder: string[]) => void;
    onTextQuickAction?: (nodeId: string, action: TextQuickActionId) => void;
    onFocusNode?: (nodeId: string) => void;

    isDragging?: boolean;
    isGroupDragging?: boolean;
    isSelected?: boolean;
    isResizing?: boolean;
    isConnecting?: boolean;
    canvasScale?: number;
    dragOffset?: { x: number; y: number };
    suppressNodeChrome?: boolean;
}

type TextQuickActionId = 'write' | 'upload' | 'text-to-video' | 'image-to-prompt';

const IMAGE_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const VIDEO_ASPECT_RATIOS = ['9:16', '16:9', '4:3', '1:1', '3:4', '21:9'];
const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p', '2k', '4k', 'native1080p', 'native4k'];
const VIDEO_DURATIONS = Array.from({ length: 12 }, (_, index) => index + 4);
const IMAGE_COUNTS = [1, 2, 3, 4];
const VIDEO_COUNTS = [1, 2, 3, 4];
const UPLOAD_IMAGE_MAX_EDGE = 1536;
const UPLOAD_IMAGE_QUALITY = 0.86;
const IMAGE_NODE_MAX_HEIGHT = 560;
const GLASS_PANEL = "bg-[#2c2c2e]/95 backdrop-blur-2xl border border-white/10 shadow-2xl";
const STYLE_PRESET_TABS = ['风格库', '滤镜', '功能', '自定义前后缀'] as const;
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360;
const AUDIO_NODE_HEIGHT = 200;

const getClosestAspectRatio = (width: number, height: number, ratios = IMAGE_ASPECT_RATIOS) => {
    if (!width || !height) return ratios[0];
    const target = width / height;
    return ratios.reduce((closest, ratio) => {
        const [rw, rh] = ratio.split(':').map(Number);
        const [cw, ch] = closest.split(':').map(Number);
        return Math.abs((rw / rh) - target) < Math.abs((cw / ch) - target) ? ratio : closest;
    }, ratios[0]);
};

const normalizeAspectRatio = (ratio?: string, ratios = IMAGE_ASPECT_RATIOS) => {
    if (!ratio) return ratios[0];
    if (ratios.includes(ratio)) return ratio;
    const [width, height] = ratio.split(':').map(Number);
    return getClosestAspectRatio(width, height, ratios);
};
const IMAGE_QUICK_ACTIONS = [
    { label: '图生图', prompt: '基于参考图片生成一张高质感图片，保持主体特征，优化光影、构图和细节。', icon: ImageIcon },
    { label: '图生视频', prompt: '基于参考图片生成一段流畅视频，保留主体一致性，加入自然镜头运动。', icon: Film },
    { label: '图片换背景', prompt: '为图片主体更换干净高级的背景，保持主体边缘自然、光影统一。', icon: Scissors },
    { label: '首帧图生视频', prompt: '将图片作为视频首帧，生成具有电影感运镜和自然动态的视频。', icon: VideoIcon },
];
const IMAGE_MODEL_CONFIGS = [
    {
        l: 'Gemini 3.1 Flash',
        v: 'gemini-3.1-flash-image-preview',
        badge: '默认',
        ratios: IMAGE_ASPECT_RATIOS,
    },
    {
        l: 'Gemini 3 Pro',
        v: 'gemini-3-pro-image-preview',
        badge: '高质',
        ratios: IMAGE_ASPECT_RATIOS,
    },
    {
        l: 'Imagen 3',
        v: 'imagen-3.0-generate-002',
        badge: '写实',
        ratios: IMAGE_ASPECT_RATIOS,
    },
];
const VIDEO_QUICK_ACTIONS = [
    { label: '全能参考', mode: 'CHARACTER_REF' as const, prompt: '基于上传参考素材生成高质感视频，保持主体一致，镜头运动自然，画面稳定。', icon: Film },
    { label: '文生视频', mode: 'DEFAULT' as const, prompt: '生成一段电影感短视频，主体明确，动作自然，光影高级，画面稳定。', icon: Type },
    { label: '首帧图生视频', mode: 'CONTINUE' as const, prompt: '将参考图作为视频首帧，生成自然延展的镜头运动和流畅动态。', icon: ImageIcon },
    { label: '首尾帧', mode: 'FIRST_LAST_FRAME' as const, prompt: '根据首帧和尾帧生成连贯过渡视频，保持主体一致和运动逻辑自然。', icon: Link },
];
const VIDEO_MODE_TABS = [
    { label: '全能参考', mode: 'CHARACTER_REF' as const },
    { label: '文生视频', mode: 'DEFAULT' as const },
    { label: '首帧', mode: 'CONTINUE' as const },
    { label: '首尾帧', mode: 'FIRST_LAST_FRAME' as const },
];
const VIDEO_MODEL_CONFIGS = [
    { l: 'Seedance 2.0', v: 'seedance-2.0', badge: '推荐' },
    { l: 'Veo 3.1 Fast', v: 'veo-3.1-fast-generate-preview', badge: '快速' },
    { l: 'Veo 3.1', v: 'veo-3.1-generate-preview', badge: 'Pro' },
    { l: 'Wan 2.1', v: 'wan-2.1-t2v-14b', badge: 'Animate' },
];
const TEXT_QUICK_ACTIONS = [
    { id: 'write' as const, label: '自己编写内容', icon: Edit },
    { id: 'upload' as const, label: '上传文档解析文本', icon: Upload },
    { id: 'text-to-video' as const, label: '文字生视频', icon: VideoIcon },
    { id: 'image-to-prompt' as const, label: '图片反推提示词', icon: Type },
];
const TEXT_MODEL_CONFIGS = [
    { l: '全能语言模型3.5 flash', v: 'gemini-3.1-flash-lite-preview', badge: '快速' },
    { l: 'Gemini 3 Pro', v: 'gemini-3-pro-preview', badge: '高质' },
    { l: 'Gemini 2.5 Pro', v: 'gemini-2.5-pro', badge: '稳定' },
];

// --- SECURE VIDEO COMPONENT ---
// Fetches video as blob to bypass auth/cors issues with <video src>
const SecureVideo = ({ src, className, autoPlay, muted, loop, onMouseEnter, onMouseLeave, onClick, controls, videoRef, style }: any) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setBlobUrl(src);
            return;
        }

        let active = true;
        // Fetch the video content
        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error("Video fetch failed");
                return response.blob();
            })
            .then(blob => {
                if (active) {
                    // FORCE MIME TYPE TO VIDEO/MP4 to fix black screen issues with generic binary blobs
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    const url = URL.createObjectURL(mp4Blob);
                    setBlobUrl(url);
                }
            })
            .catch(err => {
                console.error("SecureVideo load error:", err);
                if (active) setError(true);
            });

        return () => {
            active = false;
            if (blobUrl && !blobUrl.startsWith('data:')) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [src]);

    if (error) {
        return <div className={`flex items-center justify-center bg-zinc-800 text-xs text-red-400 ${className}`}>Load Error</div>;
    }

    if (!blobUrl) {
        return <div className={`flex items-center justify-center bg-zinc-900 ${className}`}><Loader2 className="animate-spin text-zinc-600" /></div>;
    }

    return (
        <video
            ref={videoRef}
            src={blobUrl}
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
            preload="auto"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            style={{ backgroundColor: '#18181b', ...style }} // Force background and apply passed styles
        />
    );
};

// Helper for safe video playback
const safePlay = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (!vid) return;
    const p = vid.play();
    if (p !== undefined) {
        p.catch((error: any) => {
            // Ignore AbortError which happens when pausing immediately after playing
            if (error.name !== 'AbortError') {
                console.debug("Video play prevented:", error);
            }
        });
    }
};

const safePause = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (vid) {
        vid.pause();
        vid.currentTime = 0; // Optional: reset to start
    }
};

// Custom Comparator for React.memo to prevent unnecessary re-renders during drag
const arePropsEqual = (prev: NodeProps, next: NodeProps) => {
    const renderQualityChanged = (prev.canvasScale < 0.65) !== (next.canvasScale < 0.65);
    const selectedScaleChanged = Boolean(prev.isSelected || next.isSelected) && prev.canvasScale !== next.canvasScale;
    if (prev.isDragging !== next.isDragging ||
        prev.isResizing !== next.isResizing ||
        prev.isSelected !== next.isSelected ||
        renderQualityChanged ||
        selectedScaleChanged ||
        prev.isGroupDragging !== next.isGroupDragging ||
        prev.isConnecting !== next.isConnecting ||
        prev.suppressNodeChrome !== next.suppressNodeChrome ||
        prev.dragOffset?.x !== next.dragOffset?.x ||
        prev.dragOffset?.y !== next.dragOffset?.y) {
        return false;
    }
    if (prev.node !== next.node) return false;
    const prevInputs = prev.inputAssets || [];
    const nextInputs = next.inputAssets || [];
    if (prevInputs.length !== nextInputs.length) return false;
    for (let i = 0; i < prevInputs.length; i++) {
        if (
            prevInputs[i].id !== nextInputs[i].id ||
            prevInputs[i].src !== nextInputs[i].src ||
            prevInputs[i].type !== nextInputs[i].type
        ) return false;
    }
    return true;
};

const InputThumbnails = ({ assets, onReorder }: { assets: InputAsset[], onReorder: (newOrder: string[]) => void }) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const onReorderRef = useRef(onReorder);
    onReorderRef.current = onReorder;
    const stateRef = useRef({ draggingId: null as string | null, startX: 0, originalAssets: [] as InputAsset[] });
    const THUMB_WIDTH = 48;
    const GAP = 6;
    const ITEM_FULL_WIDTH = THUMB_WIDTH + GAP;

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const delta = e.clientX - stateRef.current.startX;
        setDragOffset(delta);
    }, []);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const { draggingId, startX, originalAssets } = stateRef.current;
        const currentOffset = e.clientX - startX;
        const moveSlots = Math.round(currentOffset / ITEM_FULL_WIDTH);
        const currentIndex = originalAssets.findIndex(a => a.id === draggingId);
        const newIndex = Math.max(0, Math.min(originalAssets.length - 1, currentIndex + moveSlots));

        if (newIndex !== currentIndex) {
            const newOrderIds = originalAssets.map(a => a.id);
            const [moved] = newOrderIds.splice(currentIndex, 1);
            newOrderIds.splice(newIndex, 0, moved);
            onReorderRef.current(newOrderIds);
        }
        setDraggingId(null);
        setDragOffset(0);
        stateRef.current.draggingId = null;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [ITEM_FULL_WIDTH]);

    useEffect(() => {
        return () => {
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDraggingId(id);
        setDragOffset(0);
        stateRef.current = { draggingId: id, startX: e.clientX, originalAssets: [...assets] };
        document.body.style.cursor = 'grabbing';
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    if (!assets || assets.length === 0) return null;

    return (
        <div className="flex items-center justify-center h-14 pointer-events-none select-none relative z-0" onMouseDown={e => e.stopPropagation()}>
            <div className="relative flex items-center gap-[6px]">
                {assets.map((asset, index) => {
                    const isItemDragging = asset.id === draggingId;
                    const originalIndex = assets.findIndex(a => a.id === draggingId);
                    let translateX = 0;
                    let scale = 1;
                    let zIndex = 10;

                    if (isItemDragging) {
                        translateX = dragOffset;
                        scale = 1.15;
                        zIndex = 100;
                    } else if (draggingId) {
                        const draggingVirtualIndex = Math.max(0, Math.min(assets.length - 1, originalIndex + Math.round(dragOffset / ITEM_FULL_WIDTH)));
                        if (index > originalIndex && index <= draggingVirtualIndex) translateX = -ITEM_FULL_WIDTH;
                        else if (index < originalIndex && index >= draggingVirtualIndex) translateX = ITEM_FULL_WIDTH;
                    }
                    const isVideo = asset.type === 'video';
                    const isAudio = asset.type === 'audio';
                    return (
                        <div
                            key={asset.id}
                            className={`relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto border border-white/20 shadow-lg bg-black/60 group`}
                            style={{
                                width: `${THUMB_WIDTH}px`, height: `${THUMB_WIDTH}px`,
                                transform: `translateX(${translateX}px) scale(${scale})`,
                                zIndex,
                                transition: isItemDragging ? 'none' : 'transform 0.5s cubic-bezier(0.32,0.72,0,1)',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, asset.id)}
                        >
                            {isVideo ? (
                                <SecureVideo src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900" muted loop autoPlay />
                            ) : isAudio ? (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-300">
                                    <Music size={18} />
                                </div>
                            ) : (
                                <img src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900" alt="" />
                            )}
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md"></div>
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 z-20 shadow-sm pointer-events-none">
                                <span className="text-[9px] font-bold text-white leading-none">{index + 1}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
};

const AudioVisualizer = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full opacity-60">
        {[...Array(20)].map((_, i) => (
            <div key={i} className="w-1 bg-cyan-400/80 rounded-full" style={{ height: isPlaying ? `${20 + Math.random() * 80}%` : '20%', transition: 'height 0.1s ease', animation: isPlaying ? `pulse 0.5s infinite ${i * 0.05}s` : 'none' }} />
        ))}
    </div>
);

const dataUrlFromBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image compression failed')), type, quality);
});

const prepareUploadedImage = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        bitmap.close();
        throw new Error('Canvas is not available');
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvasToBlob(canvas, 'image/webp', UPLOAD_IMAGE_QUALITY);
    return {
        dataUrl: await dataUrlFromBlob(blob),
        width,
        height,
    };
};

const getFittedImageNodeSize = (imageWidth: number, imageHeight: number, currentWidth: number) => {
    const ratio = imageWidth / imageHeight;
    const maxWidth = Math.max(280, currentWidth || DEFAULT_NODE_WIDTH);
    let width = Math.min(maxWidth, DEFAULT_NODE_WIDTH);
    let height = width / ratio;

    if (height > IMAGE_NODE_MAX_HEIGHT) {
        height = IMAGE_NODE_MAX_HEIGHT;
        width = height * ratio;
    }

    return {
        width: Math.max(260, Math.round(width)),
        height: Math.max(220, Math.round(height)),
    };
};

const NodeComponent: React.FC<NodeProps> = ({
    node, onUpdate, onAction, onDelete, onExpand, onCrop, onAddToAgent, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, inputAssets, onInputReorder, onTextQuickAction, onFocusNode, isDragging, isGroupDragging, isSelected, isResizing, isConnecting, canvasScale = 1, dragOffset, suppressNodeChrome
}) => {
    const isWorking = node.status === NodeStatus.WORKING;
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const isHoveringRef = useRef(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [showImageGrid, setShowImageGrid] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(node.title);
    const [isHovered, setIsHovered] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isPreparingImageUpload, setIsPreparingImageUpload] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const generationMode = node.data.generationMode || 'DEFAULT';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const textDocumentInputRef = useRef<HTMLInputElement>(null);
    const textEditorRef = useRef<HTMLTextAreaElement>(null);
    const [localPrompt, setLocalPrompt] = useState(node.data.prompt || '');
    const [inputHeight, setInputHeight] = useState(48);
    const [isStylePresetOpen, setIsStylePresetOpen] = useState(false);
    const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
    const [isImageMoreOpen, setIsImageMoreOpen] = useState(false);
    const [stylePresetTab, setStylePresetTab] = useState<'风格库' | '滤镜' | '功能' | '自定义前后缀'>('风格库');
    const [styleCategory, setStyleCategory] = useState<string>('全部');
    const [isParsingDocument, setIsParsingDocument] = useState(false);
    const [isTextEditorActive, setIsTextEditorActive] = useState(false);
    const isResizingInput = useRef(false);
    const inputStartDragY = useRef(0);
    const inputStartHeight = useRef(0);

    useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);
    useEffect(() => {
        if (node.type !== NodeType.IMAGE_GENERATOR || !node.data.image || node.data.aspectRatio) return;

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (cancelled) return;
            const detectedRatio = getClosestAspectRatio(image.naturalWidth || image.width, image.naturalHeight || image.height);
            if (node.data.aspectRatio !== detectedRatio) {
                onUpdate(node.id, { aspectRatio: detectedRatio });
            }
        };
        image.src = node.data.imagePreview || node.data.image;
        return () => { cancelled = true; };
    }, [node.id, node.type, node.data.image, node.data.imagePreview, node.data.aspectRatio]);
    const commitPrompt = () => { if (localPrompt !== (node.data.prompt || '')) onUpdate(node.id, { prompt: localPrompt }); };
    const handleActionClick = () => { commitPrompt(); onAction(node.id, localPrompt); };
    const handleCmdEnter = (e: React.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitPrompt(); onAction(node.id, localPrompt); } };

    const textMode = node.data.textMode || ((node.data.prompt || node.inputs.length > 0) ? 'editor' : 'launcher');

    const enterTextEditor = useCallback(() => {
        onUpdate(node.id, { textMode: 'editor', error: undefined });
    }, [node.id, onUpdate]);

    const focusTextEditor = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsTextEditorActive(true);
        onFocusNode?.(node.id);
        window.setTimeout(() => textEditorRef.current?.focus(), 180);
    }, [node.id, onFocusNode]);

    const handleTextQuickAction = (action: TextQuickActionId) => {
        if (action === 'upload') {
            textDocumentInputRef.current?.click();
            return;
        }
        setIsTextEditorActive(action !== 'image-to-prompt');
        enterTextEditor();
        onTextQuickAction?.(node.id, action);
    };

    const handleTextDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setIsParsingDocument(true);
        try {
            const extension = file.name.split('.').pop()?.toLowerCase();
            let text = '';
            if (extension === 'txt' || file.type === 'text/plain') {
                text = await file.text();
            } else if (extension === 'docx') {
                const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                text = result.value;
            } else {
                throw new Error('仅支持 .docx 和 .txt 文件');
            }

            const normalizedText = text.replace(/\r\n/g, '\n').trim();
            if (!normalizedText) throw new Error('文档中没有可读取的文本内容');
            setLocalPrompt(normalizedText);
            setIsTextEditorActive(true);
            onUpdate(node.id, { prompt: normalizedText, textMode: 'editor', error: undefined });
        } catch (error) {
            const message = error instanceof Error ? error.message : '文档解析失败，请检查文件后重试';
            onUpdate(node.id, { error: message });
        } finally {
            setIsParsingDocument(false);
        }
    };

    const handleInputResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        isResizingInput.current = true; inputStartDragY.current = e.clientY; inputStartHeight.current = inputHeight;
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isResizingInput.current) return;
            setInputHeight(Math.max(48, Math.min(inputStartHeight.current + (e.clientY - inputStartDragY.current), 300)));
        };
        const handleGlobalMouseUp = () => { isResizingInput.current = false; window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
        window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    React.useEffect(() => {
        if (videoBlobUrl) { URL.revokeObjectURL(videoBlobUrl); setVideoBlobUrl(null); }
        if ((node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_ANALYZER) && node.data.videoUri) {
            if (node.data.videoUri.startsWith('data:')) { setVideoBlobUrl(node.data.videoUri); return; }
            let isActive = true; setIsLoadingVideo(true);
            // Standard fetch for local usage in analysis/display
            fetch(node.data.videoUri).then(res => res.blob()).then(blob => {
                if (isActive) {
                    // Force video/mp4 for local analysis blob too
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    setVideoBlobUrl(URL.createObjectURL(mp4Blob));
                    setIsLoadingVideo(false);
                }
            }).catch(err => { if (isActive) setIsLoadingVideo(false); });
            return () => { isActive = false; if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl); };
        }
    }, [node.data.videoUri, node.type]);

    const toggleAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = mediaRef.current as HTMLAudioElement;
        if (!audio) return;
        if (audio.paused) { audio.play(); setIsPlayingAudio(true); } else { audio.pause(); setIsPlayingAudio(false); }
    };

    useEffect(() => {
        return () => {
            if (mediaRef.current && (mediaRef.current instanceof HTMLVideoElement || mediaRef.current instanceof HTMLAudioElement)) {
                try { mediaRef.current.pause(); mediaRef.current.src = ""; mediaRef.current.load(); } catch (e) { }
            }
        }
    }, []);

    const handleMouseEnter = () => {
        isHoveringRef.current = true;
        if (node.data.images?.length > 1 || (node.data.videoUris && node.data.videoUris.length > 1)) setShowImageGrid(true);

        // Play Video on Hover
        if (mediaRef.current instanceof HTMLVideoElement) {
            safePlay(mediaRef.current);
        }
    };

    const handleMouseLeave = () => {
        isHoveringRef.current = false;
        setShowImageGrid(false);

        // Pause Video on Leave
        if (mediaRef.current instanceof HTMLVideoElement) {
            safePause(mediaRef.current);
        }
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onExpand && mediaRef.current) {
            const rect = mediaRef.current.getBoundingClientRect();
            if (node.data.image) {
                onExpand({ type: 'image', src: node.data.image, rect, images: node.data.images || [node.data.image], initialIndex: (node.data.images || [node.data.image]).indexOf(node.data.image) });
            } else if (node.data.videoUri) {
                const src = node.data.videoUri;
                const videos = node.data.videoUris && node.data.videoUris.length > 0 ? node.data.videoUris : [src];
                const currentIndex = node.data.videoUris ? node.data.videoUris.indexOf(node.data.videoUri) : 0;
                const safeIndex = currentIndex >= 0 ? currentIndex : 0;
                // Pass the URIs directly; ExpandedView will use SecureVideo logic
                onExpand({ type: 'video', src: src, rect, images: videos, initialIndex: safeIndex });
            }
        }
    };
    const handleDownload = (e: React.MouseEvent) => { e.stopPropagation(); const a = document.createElement('a'); a.href = node.data.image || videoBlobUrl || node.data.audioUri || ''; a.download = `xcaistudio-${Date.now()}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };
    const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => onUpdate(node.id, { videoUri: e.target?.result as string }); reader.readAsDataURL(file); } };
    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setIsPreparingImageUpload(true);
        try {
            const prepared = await prepareUploadedImage(file);
            const nextSize = getFittedImageNodeSize(prepared.width, prepared.height, node.width || DEFAULT_NODE_WIDTH);
            const detectedRatio = getClosestAspectRatio(prepared.width, prepared.height);
            onUpdate(
                node.id,
                {
                    image: prepared.dataUrl,
                    images: undefined,
                    croppedFrame: undefined,
                    aspectRatio: detectedRatio,
                },
                nextSize
            );
        } catch (error) {
            console.error('Image upload failed:', error);
            const reader = new FileReader();
            reader.onload = (event) => onUpdate(node.id, { image: event.target?.result as string });
            reader.readAsDataURL(file);
        } finally {
            setIsPreparingImageUpload(false);
        }
    };

    const triggerReplaceImage = () => {
        window.setTimeout(() => replaceImageInputRef.current?.click(), 0);
        setIsImageMoreOpen(false);
    };
    const handleUploadVideoReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            e.target.value = '';
            const prepared = await prepareUploadedImage(file);
            onUpdate(node.id, {
                image: prepared.dataUrl,
                videoUri: undefined,
                videoMetadata: undefined,
                generationMode: node.data.generationMode === 'FIRST_LAST_FRAME' ? 'FIRST_LAST_FRAME' : 'CONTINUE',
            });
            return;
        }
        handleUploadVideo(e);
    };
    const handleAspectRatioSelect = (newRatio: string) => {
        const [w, h] = newRatio.split(':').map(Number);
        let newSize: { width?: number, height?: number } = { height: undefined };
        if (w && h) {
            const currentWidth = node.width || DEFAULT_NODE_WIDTH;
            const projectedHeight = (currentWidth * h) / w;
            if (projectedHeight > 600) newSize.width = (600 * w) / h;
        }
        onUpdate(node.id, { aspectRatio: newRatio }, newSize);
    };
    const handleTitleSave = () => { setIsEditingTitle(false); if (tempTitle.trim() && tempTitle !== node.title) onUpdate(node.id, {}, undefined, tempTitle); else setTempTitle(node.title); };

    const getNodeConfig = () => {
        switch (node.type) {
            case NodeType.PROMPT_INPUT: return { icon: Type, color: 'text-amber-400', border: 'border-amber-500/30' };
            case NodeType.IMAGE_GENERATOR: return { icon: ImageIcon, color: 'text-cyan-400', border: 'border-cyan-500/30' };
            case NodeType.VIDEO_GENERATOR: return { icon: VideoIcon, color: 'text-purple-400', border: 'border-purple-500/30' };
            case NodeType.AUDIO_GENERATOR: return { icon: Mic2, color: 'text-pink-400', border: 'border-pink-500/30' };
            case NodeType.VIDEO_ANALYZER: return { icon: FileSearch, color: 'text-emerald-400', border: 'border-emerald-500/30' };
            case NodeType.IMAGE_EDITOR: return { icon: Edit, color: 'text-rose-400', border: 'border-rose-500/30' };
            default: return { icon: Type, color: 'text-slate-400', border: 'border-white/10' };
        }
    };
    const { icon: NodeIcon, color: iconColor } = getNodeConfig();

    const getNodeHeight = () => {
        if (node.height) return node.height;
        if (node.type === NodeType.VIDEO_ANALYZER || node.type === NodeType.IMAGE_EDITOR || node.type === NodeType.PROMPT_INPUT) return DEFAULT_FIXED_HEIGHT;
        if (node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT;
        const ratio = node.data.aspectRatio || '16:9';
        const [w, h] = ratio.split(':').map(Number);
        const extra = (node.type === NodeType.VIDEO_GENERATOR && generationMode === 'CUT') ? 36 : 0;
        return ((node.width || DEFAULT_NODE_WIDTH) * h / w) + extra;
    };
    const nodeHeight = getNodeHeight();
    const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
    const hasInputs = inputAssets && inputAssets.length > 0;
    const inputImageCount = inputAssets?.filter(asset => asset.type === 'image').length || 0;
    const inputVideoCount = inputAssets?.filter(asset => asset.type === 'video').length || 0;
    const inputAudioCount = inputAssets?.filter(asset => asset.type === 'audio').length || 0;
    const referenceCount = inputImageCount + inputVideoCount + inputAudioCount;
    const getVideoModeAvailability = (mode: AppNode['data']['generationMode']) => {
        if (mode === 'DEFAULT') return { enabled: true, tip: '无需连接参考素材' };
        if (mode === 'CHARACTER_REF') {
            return {
                enabled: referenceCount > 0 && inputImageCount <= 9 && inputVideoCount <= 3 && inputAudioCount <= 3,
                tip: '需要连接上游节点（最多 9 张图片 / 3 个视频 / 3 个音频）',
            };
        }
        if (mode === 'CONTINUE') {
            return {
                enabled: inputImageCount === 1 && inputVideoCount === 0 && inputAudioCount === 0,
                tip: '需断开其他素材，仅连接 1 个图片节点',
            };
        }
        return {
            enabled: inputImageCount >= 1 && inputImageCount <= 2 && inputVideoCount === 0 && inputAudioCount === 0,
            tip: '仅支持连接 1–2 张图片',
        };
    };
    const isTextNode = node.type === NodeType.PROMPT_INPUT;
    const isImageNode = node.type === NodeType.IMAGE_GENERATOR;
    const isVideoNode = node.type === NodeType.VIDEO_GENERATOR;
    const isEmptyTextNode = isTextNode && !(node.data.prompt || '').trim();
    const isEmptyImageNode = isImageNode && !node.data.image && !node.data.videoUri;
    const isEmptyVideoNode = isVideoNode && !node.data.videoUri && !node.data.image;
    const isEmptyCreativeNode = isEmptyTextNode || isEmptyImageNode || isEmptyVideoNode;
    const isReferencedEmptyNode = Boolean(hasInputs && isEmptyCreativeNode);
    const styleCategories = ['全部', ...Array.from(new Set(STYLE_PRESETS.map(preset => preset.category)))];
    const visibleStylePresets = styleCategory === '全部'
        ? STYLE_PRESETS
        : STYLE_PRESETS.filter(preset => preset.category === styleCategory);

    const applyStylePreset = (preset: StylePreset) => {
        const isSamePreset = node.data.stylePresetId === preset.id;
        onUpdate(node.id, {
            stylePresetId: isSamePreset ? undefined : preset.id,
            stylePresetName: isSamePreset ? undefined : preset.name,
            stylePresetNegativePrompt: isSamePreset ? undefined : preset.negativePrompt,
        });
        if (!isSamePreset) setIsStylePresetOpen(false);
    };

    const clearStylePreset = () => {
        onUpdate(node.id, {
            stylePresetId: undefined,
            stylePresetName: undefined,
            stylePresetNegativePrompt: undefined,
        });
    };

    useEffect(() => {
        if (!isVideoNode || generationMode === 'DEFAULT') return;
        if (!getVideoModeAvailability(generationMode).enabled) {
            onUpdate(node.id, { generationMode: 'DEFAULT' });
        }
    }, [isVideoNode, generationMode, inputImageCount, inputVideoCount, inputAudioCount]);

    const applyImageToolPrompt = (instruction: string) => {
        const currentPrompt = localPrompt.trim();
        const nextPrompt = currentPrompt ? `${currentPrompt}\n${instruction}` : instruction;
        setLocalPrompt(nextPrompt);
        onUpdate(node.id, { prompt: nextPrompt });
    };

    const imageToolButtonClass = 'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white';

    const renderImageSelectionToolbar = () => {
        if (!isImageNode || !node.data.image || !isSelected) return null;
        const toolbarScale = 1 / Math.max(0.2, canvasScale);
        const detectedAspectRatio = normalizeAspectRatio(node.data.aspectRatio);

        return (
            <div
                className="absolute bottom-full left-1/2 z-[240] mb-4 flex w-max items-center gap-0.5 whitespace-nowrap rounded-2xl border border-white/10 bg-[#252527]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
                style={{
                    transform: `translateX(-50%) scale(${toolbarScale})`,
                    transformOrigin: 'bottom center',
                }}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
            >
                <label className={`${imageToolButtonClass} cursor-pointer`}>
                    <Scaling size={13} />
                    <select
                        value={detectedAspectRatio}
                        onChange={e => handleAspectRatioSelect(e.target.value)}
                        className="cursor-pointer appearance-none bg-transparent pr-1 text-[10px] font-bold text-zinc-300 outline-none"
                        title="画面比例"
                    >
                        {IMAGE_ASPECT_RATIOS.map(ratio => <option key={ratio} value={ratio} className="bg-[#252527]">{ratio}</option>)}
                    </select>
                </label>
                <button className={imageToolButtonClass} title="增强画面细节" onClick={() => applyImageToolPrompt('增强画面清晰度、材质细节与光影层次，保持主体和构图不变。')}>
                    <SlidersHorizontal size={13} />增强
                </button>
                <button className={imageToolButtonClass} title="编辑画面元素" onClick={() => applyImageToolPrompt('编辑画面中的指定元素，保持未指定区域、主体身份和整体风格不变。')}>
                    <Layers size={13} />编辑元素
                </button>
                <button className={imageToolButtonClass} title="生成分镜方案" onClick={() => applyImageToolPrompt('以当前图片为视觉基准，设计一组镜头连贯、主体一致的专业分镜。')}>
                    <Film size={13} />分镜大师
                </button>
                <button className={imageToolButtonClass} title="生成宫格构图" onClick={() => applyImageToolPrompt('将当前主题扩展为构图统一、视角丰富的九宫格画面方案。')}>
                    <Grid3X3 size={13} />宫格裁剪
                </button>
                <button className={imageToolButtonClass} title="调整拍摄角度" onClick={() => applyImageToolPrompt('调整拍摄角度和透视关系，保持主体造型、材质和场景一致。')}>
                    <Rotate3D size={13} />角度
                </button>
                <button className={imageToolButtonClass} title="调整画面打光" onClick={() => applyImageToolPrompt('重新设计专业摄影打光，提升主体轮廓、层次和商业质感。')}>
                    <SunMedium size={13} />打光
                </button>
                <div className="relative">
                    <button className={`${imageToolButtonClass} ${isImageMoreOpen ? 'bg-white/10 text-white' : ''}`} title="更多图片工具" onClick={() => setIsImageMoreOpen(open => !open)}>
                        <MoreHorizontal size={13} />更多
                    </button>
                    {isImageMoreOpen && (
                        <div className="absolute left-0 top-full z-[500] mt-2 min-w-[140px] rounded-2xl border border-white/15 bg-[#101114]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-black/40 backdrop-blur-2xl">
                            <button className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[11px] font-bold text-zinc-100 transition-colors hover:bg-cyan-400/15 hover:text-cyan-100" onClick={() => { onCrop?.(node.id, node.data.image!); setIsImageMoreOpen(false); }}>
                                <CropIcon size={13} />裁剪图片
                            </button>
                            <button className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[11px] font-bold text-zinc-100 transition-colors hover:bg-emerald-400/15 hover:text-emerald-100" onClick={triggerReplaceImage}>
                                <Replace size={13} />替换图片
                            </button>
                        </div>
                    )}
                </div>
                <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
                <button className={imageToolButtonClass} title="下载图片" onClick={handleDownload}>
                    <Download size={13} />
                </button>
                <button className={imageToolButtonClass} title="放大预览" onClick={handleExpand}>
                    <Maximize2 size={13} />
                </button>
                <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
                <button className={`${imageToolButtonClass} pr-3`} title="将图片加入右侧 Agent" onClick={() => onAddToAgent?.(node.data.image!, node.title)}>
                    <Bot size={13} />加入 Agent
                </button>
            </div>
        );
    };

    const renderConnectedPlaceholder = (Icon: React.ElementType, title = '已连接，点击选中配置参数') => (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-zinc-500">
            <Icon size={38} strokeWidth={1.8} className="text-zinc-600" />
            <div className="space-y-1">
                <p className="text-[13px] font-bold text-zinc-400">{title}</p>
                <p className="text-[11px] font-medium text-zinc-600">选中节点后在下方配置并生成</p>
            </div>
        </div>
    );

    const renderTopBar = () => {
        if (suppressNodeChrome) return null;
        const showTopBar = isSelected || isHovered || isEmptyCreativeNode;
        return (
            <div className={`absolute -top-10 left-0 w-full flex items-center justify-between px-1 transition-all duration-300 ${showTopBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div className="flex items-center gap-1.5 pointer-events-auto">
                    {isTextNode && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-slate-300 shadow-lg">
                            <Type size={13} className="text-slate-300" />
                            <span className="text-[11px] font-bold tracking-wide">Text</span>
                        </div>
                    )}
                    {isImageNode && !node.data.image && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-slate-300 shadow-lg">
                            <ImageIcon size={13} className="text-slate-300" />
                            <span className="text-[11px] font-bold tracking-wide">Image</span>
                        </div>
                    )}
                    {isVideoNode && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-slate-300 shadow-lg">
                            <VideoIcon size={13} className="text-slate-300" />
                            <span className="text-[11px] font-bold tracking-wide">Video</span>
                        </div>
                    )}
                    {(node.data.videoUri || node.data.audioUri) && (
                        <div className="flex items-center gap-1">
                            <button onClick={handleDownload} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="下载"><Download size={14} /></button>
                            {node.type !== NodeType.AUDIO_GENERATOR && <button onClick={handleExpand} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="全屏预览"><Maximize2 size={14} /></button>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    {isImageNode && !node.data.image && (
                        <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-[11px] font-bold text-slate-300 hover:text-white hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-colors shadow-lg"
                            title="上传图片"
                        >
                            <Upload size={13} />
                            上传
                        </button>
                    )}
                    {isVideoNode && !node.data.videoUri && (
                        <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-[11px] font-bold text-slate-300 hover:text-white hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-colors shadow-lg"
                            title="上传视频"
                        >
                            <Upload size={13} />
                            上传
                        </button>
                    )}
                    {isWorking && !isImageNode && !isVideoNode && <div className="bg-[#2c2c2e]/90 backdrop-blur-md p-1.5 rounded-full border border-white/10"><Loader2 className="animate-spin w-3 h-3 text-cyan-400" /></div>}
                    <div className={`px-2 py-1 flex items-center gap-2`}>
                        {isEditingTitle ? (
                            <input className="bg-transparent border-none outline-none text-slate-400 text-[10px] font-bold uppercase tracking-wider w-24 text-right select-text" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} onMouseDown={e => e.stopPropagation()} autoFocus />
                        ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-text text-right" onClick={() => setIsEditingTitle(true)}>{node.title}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderMediaContent = () => {
        if (node.type === NodeType.PROMPT_INPUT) {
            return (
                <div className="w-full h-full flex flex-col group/text">
                    {textMode === 'launcher' ? (
                        <div className="relative h-full overflow-hidden bg-[#1b1c1e]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.15),transparent_43%),linear-gradient(145deg,rgba(255,255,255,0.055),transparent_36%)]" />
                            <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
                            <div className="relative z-10 flex h-full flex-col justify-center px-10">
                                <p className="mb-5 text-[11px] font-bold tracking-wide text-zinc-500">尝试:</p>
                                <div className="grid gap-3">
                                    {TEXT_QUICK_ACTIONS.map(({ id, label, icon: ActionIcon }) => (
                                        <button
                                            key={id}
                                            onClick={(e) => { e.stopPropagation(); handleTextQuickAction(id); }}
                                            className="group/action flex w-fit min-w-[156px] items-center gap-3 rounded-xl border border-transparent px-3 py-1.5 text-left text-[12px] font-bold text-zinc-400 transition-all duration-200 hover:border-emerald-400/25 hover:bg-emerald-400/10 hover:text-emerald-100"
                                        >
                                            <ActionIcon size={15} className="text-zinc-500 transition-colors group-hover/action:text-emerald-300" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input ref={textDocumentInputRef} type="file" className="hidden" accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleTextDocumentUpload} />
                            {isParsingDocument && <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/55 text-xs font-bold text-emerald-200 backdrop-blur-sm"><Loader2 size={16} className="animate-spin" />正在解析文档...</div>}
                            {node.data.error && <div className="absolute inset-x-6 bottom-5 z-20 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{node.data.error}</div>}
                        </div>
                    ) : (
                        isReferencedEmptyNode && !localPrompt && !isTextEditorActive ? (
                            <div className="relative h-full overflow-hidden bg-[#1b1c1e]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.12),transparent_43%),linear-gradient(145deg,rgba(255,255,255,0.045),transparent_36%)]" />
                                <div className="relative z-10 flex h-full items-center justify-center text-[13px] font-medium text-zinc-600" onDoubleClick={focusTextEditor}>
                                    双击开始编辑...
                                </div>
                            </div>
                        ) : (
                            <div className="m-5 flex-1 bg-black/10 rounded-2xl border border-white/5 p-4 relative overflow-hidden backdrop-blur-sm transition-colors group-hover/text:bg-black/20" onDoubleClick={focusTextEditor}>
                                <textarea ref={textEditorRef} className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-slate-200 placeholder-slate-500 font-medium leading-relaxed custom-scrollbar selection:bg-emerald-500/30 select-text" placeholder="双击开始编辑..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={commitPrompt} onKeyDown={handleCmdEnter} onWheel={(e) => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onDoubleClick={focusTextEditor} maxLength={10000} />
                                {node.data.error && <div className="absolute inset-x-4 bottom-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{node.data.error}</div>}
                            </div>
                        )
                    )}
                </div>
            );
        }
        if (node.type === NodeType.VIDEO_ANALYZER) {
            return (
                <div className="w-full h-full p-5 flex flex-col gap-3">
                    <div className="relative w-full h-32 rounded-xl bg-black/20 border border-white/5 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors group/upload" onClick={() => !node.data.videoUri && fileInputRef.current?.click()}>
                        {videoBlobUrl ? <video src={videoBlobUrl} className="w-full h-full object-cover opacity-80" muted onMouseEnter={safePlay} onMouseLeave={safePause} onClick={handleExpand} /> : <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:upload:text-slate-300"><Upload size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">上传视频</span></div>}
                        {node.data.videoUri && <button className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-slate-400 hover:text-white backdrop-blur-md" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><Edit size={10} /></button>}
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleUploadVideo} />
                    </div>
                    <div className="flex-1 bg-black/10 rounded-xl border border-white/5 overflow-hidden relative group/analysis">
                        <textarea className="w-full h-full bg-transparent p-3 resize-none focus:outline-none text-xs text-slate-300 font-mono leading-relaxed custom-scrollbar select-text placeholder:italic placeholder:text-slate-600" value={node.data.analysis || ''} placeholder="等待分析结果，或在此粘贴文本..." onChange={(e) => onUpdate(node.id, { analysis: e.target.value })} onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} spellCheck={false} />
                        {node.data.analysis && <button className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-md text-slate-400 hover:text-white transition-all opacity-0 group-hover/analysis:opacity-100 backdrop-blur-md z-10" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.data.analysis || ''); }} title="复制全部"><Copy size={12} /></button>}
                    </div>
                    {isWorking && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10"><Loader2 className="animate-spin text-emerald-400" /></div>}
                </div>
            )
        }
        if (node.type === NodeType.AUDIO_GENERATOR) {
            return (
                <div className="w-full h-full p-6 flex flex-col justify-center items-center relative overflow-hidden group/audio">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-900/10 z-0"></div>
                    {node.data.audioUri ? (
                        <div className="flex flex-col items-center gap-4 w-full z-10">
                            <audio ref={mediaRef as any} src={node.data.audioUri} onEnded={() => setIsPlayingAudio(false)} onPlay={() => setIsPlayingAudio(true)} onPause={() => setIsPlayingAudio(false)} className="hidden" />
                            <div className="w-full px-4"><AudioVisualizer isPlaying={isPlayingAudio} /></div>
                            <div className="flex items-center gap-4"><button onClick={toggleAudio} className="w-12 h-12 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/50 flex items-center justify-center transition-all hover:scale-105">{isPlayingAudio ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-1" />}</button></div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-600 z-10 select-none">{isWorking ? <Loader2 size={32} className="animate-spin text-pink-500" /> : <Mic2 size={32} className="text-slate-500" />}<span className="text-[10px] font-bold uppercase tracking-widest">{isWorking ? '生成中...' : '准备生成'}</span></div>
                    )}
                    {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
                </div>
            )
        }

        const hasContent = node.data.image || node.data.videoUri;
        return (
            <div
                className="w-full h-full relative group/media overflow-hidden bg-zinc-900"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={hasContent ? handleExpand : undefined}
                title={hasContent ? '单击选择，双击放大查看' : undefined}
            >
                {isPreparingImageUpload && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-slate-600/80 to-blue-950/80 p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/12 px-4 py-2 text-[12px] font-bold text-white shadow-lg">
                            <Loader2 size={14} className="animate-spin" />
                            上传中，请稍后
                        </div>
                    </div>
                )}
                {!hasContent ? (
                    isImageNode ? (
                        isReferencedEmptyNode ? (
                            <div className="absolute inset-0 overflow-hidden bg-[#1b1c1e]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.16),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_34%)]" />
                                {renderConnectedPlaceholder(ImageIcon)}
                            </div>
                        ) : (
                        <div className="absolute inset-0 overflow-hidden bg-[#1b1c1e]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%)]" />
                            <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
                            <div className="relative z-10 flex h-full flex-col justify-center px-10">
                                <p className="mb-5 text-[11px] font-bold tracking-wide text-zinc-500">尝试:</p>
                                <div className="grid gap-3">
                                    {IMAGE_QUICK_ACTIONS.map(({ label, prompt, icon: ActionIcon }) => (
                                        <button
                                            key={label}
                                            onClick={(e) => { e.stopPropagation(); setLocalPrompt(prompt); onUpdate(node.id, { prompt }); }}
                                            className="group/action flex w-fit min-w-[142px] items-center gap-3 rounded-xl border border-transparent px-3 py-1.5 text-left text-[12px] font-bold text-zinc-400 transition-all duration-200 hover:border-emerald-400/25 hover:bg-emerald-400/10 hover:text-emerald-100"
                                        >
                                            <ActionIcon size={15} className="text-zinc-500 transition-colors group-hover/action:text-emerald-300" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="absolute bottom-5 right-5 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] font-bold text-zinc-300 backdrop-blur-md transition-all hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
                            >
                                <Upload size={13} />
                                添加参考
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadImage} />
                        </div>
                        )
                    ) : isVideoNode ? (
                        isReferencedEmptyNode ? (
                            <div className="absolute inset-0 overflow-hidden bg-[#1b1c1e]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.14),transparent_43%),linear-gradient(145deg,rgba(255,255,255,0.05),transparent_36%)]" />
                                {renderConnectedPlaceholder(VideoIcon, '选中节点后在下方配置并生成')}
                            </div>
                        ) : (
                        <div className="absolute inset-0 overflow-hidden bg-[#1b1c1e]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.16),transparent_43%),linear-gradient(145deg,rgba(255,255,255,0.055),transparent_36%)]" />
                            <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
                            <div className="relative z-10 flex h-full flex-col justify-center px-10">
                                <p className="mb-5 text-[11px] font-bold tracking-wide text-zinc-500">尝试:</p>
                                <div className="grid gap-3">
                                    {VIDEO_QUICK_ACTIONS.map(({ label, prompt, mode, icon: ActionIcon }) => (
                                        <button
                                            key={label}
                                            onClick={(e) => { e.stopPropagation(); setLocalPrompt(prompt); onUpdate(node.id, { prompt, generationMode: mode }); }}
                                            className="group/action flex w-fit min-w-[150px] items-center gap-3 rounded-xl border border-transparent px-3 py-1.5 text-left text-[12px] font-bold text-zinc-400 transition-all duration-200 hover:border-emerald-400/25 hover:bg-emerald-400/10 hover:text-emerald-100"
                                        >
                                            <ActionIcon size={15} className="text-zinc-500 transition-colors group-hover/action:text-emerald-300" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="absolute bottom-5 right-5 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] font-bold text-zinc-300 backdrop-blur-md transition-all hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
                            >
                                <Upload size={13} />
                                上传参考
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleUploadVideoReference} />
                        </div>
                        )
                    ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600"><div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 hover:scale-105 transition-all duration-300 shadow-inner" onClick={() => fileInputRef.current?.click()}>{isWorking ? <Loader2 className="animate-spin text-cyan-500" size={32} /> : <NodeIcon size={32} className="opacity-50" />}</div><span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">{isWorking ? "处理中..." : "拖拽或上传"}</span><input type="file" ref={fileInputRef} className="hidden" accept={node.type.includes('VIDEO') ? "image/*,video/*" : "image/*"} onChange={node.type.includes('VIDEO') ? handleUploadVideoReference : handleUploadImage} /></div>
                    )
                ) : (
                    <>
                        {node.data.image ?
                            <>
                                <img
                                    ref={mediaRef as any}
                                    src={node.data.imagePreview || node.data.image}
                                    className={`w-full h-full object-cover bg-zinc-900 ${isSelected && canvasScale >= 0.65 ? 'transition-transform duration-300 group-hover/media:scale-[1.02]' : ''}`}
                                    draggable={false}
                                    loading="lazy"
                                    decoding="async"
                                    style={{ filter: showImageGrid && canvasScale >= 0.65 ? 'blur(8px)' : 'none' }}
                                    onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)}
                                />
                                <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={handleUploadImage} />
                                {node.data.stylePresetId && node.data.stylePresetName && (
                                    <div
                                        className="absolute left-3 top-3 z-[90] flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-400/20 px-3 py-1.5 text-[11px] font-bold text-emerald-100 shadow-lg backdrop-blur-md"
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    >
                                        <Wand2 size={11} className="text-emerald-300" />
                                        <span>{node.data.stylePresetName}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearStylePreset(); }}
                                            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-emerald-400/70 transition-colors hover:bg-white/15 hover:text-white"
                                            title="清除预设"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}
                                {!suppressNodeChrome && (isSelected || isHovered) && (
                                    <button
                                        type="button"
                                        className="absolute right-3 top-3 z-[90] flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/70 px-3 text-[12px] font-bold text-white shadow-2xl backdrop-blur-md transition-all hover:border-emerald-300/35 hover:bg-black/85 hover:text-emerald-100"
                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerReplaceImage(); }}
                                    >
                                        <Replace size={13} />
                                        替换
                                    </button>
                                )}
                            </>
                            :
                            <SecureVideo
                                videoRef={mediaRef} // Pass Ref to Video
                                src={node.data.videoUri}
                                className="w-full h-full object-cover bg-zinc-900"
                                loop
                                muted
                                // autoPlay removed to rely on hover logic
                                onContextMenu={(e: React.MouseEvent) => onMediaContextMenu?.(e, node.id, 'video', node.data.videoUri!)}
                                style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} // Pass Style
                            />
                        }
                        {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
                        {showImageGrid && (node.data.images || node.data.videoUris) && (
                            <div className="absolute inset-0 bg-black/40 z-10 grid grid-cols-2 gap-2 p-2 animate-in fade-in duration-200">
                                {node.data.images ? node.data.images.map((img, idx) => (
                                    <div key={idx} className={`relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900 ${img === node.data.image ? 'border-cyan-500' : 'border-transparent hover:border-white/50'}`} onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { image: img }); }}>
                                        <img src={img} className="w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
                                    </div>
                                )) : node.data.videoUris?.map((uri, idx) => (
                                    <div key={idx} className={`relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900 ${uri === node.data.videoUri ? 'border-cyan-500' : 'border-transparent hover:border-white/50'}`} onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { videoUri: uri }); }}>
                                        {uri ? (
                                            <SecureVideo src={uri} className="w-full h-full object-cover bg-zinc-900" muted loop autoPlay />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-white/5 text-xs text-slate-500">Failed</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {generationMode === 'CUT' && node.data.croppedFrame && <div className="absolute top-4 right-4 w-24 aspect-video bg-black/80 rounded-lg border border-purple-500/50 shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right opacity-0 group-hover:opacity-100 transition-opacity duration-300"><img src={node.data.croppedFrame} className="w-full h-full object-cover" /></div>}
                        {generationMode === 'CUT' && !node.data.croppedFrame && hasInputs && inputAssets?.some(a => a.src) && (<div className="absolute top-4 right-4 w-24 aspect-video bg-black/80 rounded-lg border border-purple-500/30 border-dashed shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right flex flex-col items-center justify-center group/preview opacity-0 group-hover:opacity-100 transition-opacity duration-300"><div className="absolute inset-0 bg-purple-500/10 z-10"></div>{(() => { const asset = inputAssets!.find(a => a.src); if (asset?.type === 'video') { return <SecureVideo src={asset.src} className="w-full h-full object-cover opacity-60 bg-zinc-900" muted autoPlay />; } else { return <img src={asset?.src} className="w-full h-full object-cover opacity-60 bg-zinc-900" />; } })()}<span className="absolute z-20 text-[8px] font-bold text-purple-200 bg-black/50 px-1 rounded">分镜参考</span></div>)}
                    </>
                )}
                {isWorking && (isImageNode || isVideoNode) && (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#111615]/85 px-5 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/25">
                                <Loader2 size={22} className="animate-spin" />
                            </div>
                            <div>
                                <p className="text-[13px] font-black text-emerald-100">{hasContent ? '重新生成中...' : '生成中...'}</p>
                                <p className="mt-1 text-[10px] font-medium text-emerald-100/55">{hasContent ? '正在替换为新的结果' : '结果会显示在这里'}</p>
                            </div>
                        </div>
                    </div>
                )}
                {node.type === NodeType.VIDEO_GENERATOR && generationMode === 'CUT' && (videoBlobUrl || node.data.videoUri) &&
                    <SceneDirectorOverlay
                        visible={true}
                        videoRef={mediaRef as React.RefObject<HTMLVideoElement>}
                        onCrop={() => {
                            const vid = mediaRef.current as HTMLVideoElement;
                            if (vid) { // Safety check to prevent null access
                                const canvas = document.createElement('canvas');
                                canvas.width = vid.videoWidth;
                                canvas.height = vid.videoHeight;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(vid, 0, 0);
                                    onCrop?.(node.id, canvas.toDataURL('image/png'));
                                }
                            }
                        }}
                        onTimeHover={() => { }}
                    />
                }
            </div>
        );
    };

    const renderStylePresetPanel = () => {
        if (!isImageNode || !isStylePresetOpen) return null;

        return (
            <div
                className="absolute bottom-full left-1/2 z-[260] mb-3 w-[820px] max-w-[92vw] -translate-x-1/2 rounded-[16px] border border-white/10 bg-[#1c1c1e]/95 p-5 shadow-2xl backdrop-blur-2xl"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                        {STYLE_PRESET_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setStylePresetTab(tab)}
                                className={`pb-2 text-[13px] font-bold transition-colors ${stylePresetTab === tab ? 'border-b-2 border-white text-white' : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {node.data.stylePresetId && (
                            <button
                                onClick={clearStylePreset}
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-zinc-400 transition-colors hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200"
                                title="取消当前预设"
                            >
                                清除预设
                            </button>
                        )}
                        <button
                            onClick={() => setIsStylePresetOpen(false)}
                            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                            title="关闭"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {stylePresetTab === '风格库' ? (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            {styleCategories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setStyleCategory(category)}
                                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${styleCategory === category ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20' : 'bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300'}`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                        <div className="grid max-h-[330px] grid-cols-3 gap-4 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-4 md:grid-cols-5">
                            {visibleStylePresets.map(preset => {
                                const active = node.data.stylePresetId === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        onClick={() => applyStylePreset(preset)}
                                        className={`group/preset overflow-hidden rounded-[10px] text-left transition-all ${active ? 'bg-emerald-400/10 ring-2 ring-emerald-300' : 'bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06] hover:ring-white/20'}`}
                                        title={preset.description}
                                    >
                                        <div className="aspect-square w-full overflow-hidden bg-zinc-900">
                                            <img src={preset.previewUrl} alt={preset.name} className="h-full w-full object-cover transition-transform duration-300 group-hover/preset:scale-105" />
                                        </div>
                                        <div className="flex min-h-[46px] items-center px-2.5 py-2">
                                            <span className={`line-clamp-2 text-[12px] font-bold leading-snug ${active ? 'text-emerald-100' : 'text-zinc-200'}`}>{preset.name}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-[12px] font-bold text-zinc-600">
                        暂无内容
                    </div>
                )}
            </div>
        );
    };

    const renderBottomPanel = () => {
        if (suppressNodeChrome) return null;
        const isOpen = (isHovered || isInputFocused || isEmptyCreativeNode);
        const hasGeneratedMedia = Boolean((node.data.image || node.data.videoUri) && node.status === NodeStatus.SUCCESS);
        const promptPlaceholder = node.type === NodeType.AUDIO_GENERATOR
            ? '描述你想生成的音乐或音效...'
            : isTextNode
                ? '描述你想要生成的内容，并在下方调整生成参数。（Enter 生成，Shift+Enter 换行，可在左下角快捷键中修改）'
                : '描述你想要生成的内容，使用 @ 可快速引用上传的文件，按 / 呼出指令';
        const effectivePromptPlaceholder = isImageNode && node.data.stylePresetId
            ? `填写补充说明，当前预设：${node.data.stylePresetName || '已选择'}`
            : hasGeneratedMedia && (isImageNode || isVideoNode)
                ? '修改提示词后点击「重新生成」'
                : promptPlaceholder;
        let models: { l: string, v: string, badge?: string, ratios?: string[] }[] = [];
        if (node.type === NodeType.VIDEO_GENERATOR) {
            models = VIDEO_MODEL_CONFIGS;
        } else if (node.type === NodeType.VIDEO_ANALYZER) {
            models = [{ l: 'Gemini 3.1 Flash Lite', v: 'gemini-3.1-flash-lite-preview' }, { l: 'Gemini 3 Pro', v: 'gemini-3-pro-preview' }];
        } else if (node.type === NodeType.AUDIO_GENERATOR) {
            models = [{ l: 'Voice Factory (Gemini 2.0)', v: 'gemini-2.5-flash-preview-tts' }];
        } else if (isTextNode) {
            models = TEXT_MODEL_CONFIGS;
        } else {
            models = IMAGE_MODEL_CONFIGS;
        }
        const activeModelConfig = models.find(m => m.v === node.data.model);
        const activeAspectRatios = node.type.includes('VIDEO') ? VIDEO_ASPECT_RATIOS : (activeModelConfig?.ratios || IMAGE_ASPECT_RATIOS);
        const displayedAspectRatio = normalizeAspectRatio(node.data.aspectRatio, activeAspectRatios);

        return (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                {/* InputThumbnails: Set strict Z-Index to lower layer */}
                {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}
                {/* Glass Panel: Set strict Z-Index to higher layer to overlap thumbnails */}
                <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} ${isEmptyCreativeNode ? 'border-emerald-400/20 shadow-[0_18px_60px_-24px_rgba(16,185,129,0.55)]' : ''} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                    {renderStylePresetPanel()}
                    {isVideoNode && (
                        <div className="flex items-center justify-between gap-3 px-2 pt-1">
                            <div className="flex items-center gap-1">
                                {VIDEO_MODE_TABS.map(tab => {
                                    const active = generationMode === tab.mode;
                                    const availability = getVideoModeAvailability(tab.mode);
                                    return (
                                        <div key={tab.label} className="group/mode relative">
                                            <button
                                                type="button"
                                                aria-disabled={!availability.enabled}
                                                onClick={() => availability.enabled && onUpdate(node.id, { generationMode: tab.mode })}
                                                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                                    active
                                                        ? 'bg-white/10 text-zinc-100 ring-1 ring-white/10'
                                                        : availability.enabled
                                                            ? 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                                            : 'cursor-not-allowed text-zinc-700'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                            {tab.mode !== 'DEFAULT' && (
                                                <div className="pointer-events-none absolute bottom-full left-1/2 z-[300] mb-2 hidden w-max max-w-[230px] -translate-x-1/2 rounded-lg border border-white/10 bg-black/95 px-2.5 py-1.5 text-[10px] font-medium leading-4 text-zinc-300 shadow-xl group-hover/mode:block">
                                                    {availability.tip}
                                                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-black/95" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <button className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300" title="展开">
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    )}
                    {isEmptyVideoNode && (
                        <div className="flex items-center gap-2 px-2 pt-2">
                            <button className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-bold text-zinc-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200">
                                <Layers size={16} />
                                素材库
                            </button>
                            <button className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-bold text-zinc-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200">
                                <Wand2 size={16} />
                                预设
                            </button>
                        </div>
                    )}
                    {isImageNode && (
                        <div className="flex items-center gap-2 px-2 pt-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-bold text-zinc-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
                                title="添加"
                            >
                                <Plus size={16} />
                                添加
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsStylePresetOpen(open => !open); }}
                                className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-bold transition-colors ${isStylePresetOpen || node.data.stylePresetId ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200'}`}
                                title={node.data.stylePresetName || '预设'}
                            >
                                <Settings size={16} />
                                预设
                            </button>
                            {node.data.stylePresetId && node.data.stylePresetName && (
                                <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-400/20 px-2.5 py-1.5" onMouseDown={e => e.stopPropagation()}>
                                    <Wand2 size={11} className="text-emerald-300 shrink-0" />
                                    <span className="text-[10px] font-bold text-emerald-100 whitespace-nowrap">{node.data.stylePresetName}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); clearStylePreset(); }}
                                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-emerald-400/70 transition-colors hover:bg-white/15 hover:text-white shrink-0"
                                        title="清除预设"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {(!hasGeneratedMedia || isImageNode || isVideoNode) && (
                        <div className={`relative group/input rounded-[16px] ${hasGeneratedMedia ? 'bg-black/20 ring-1 ring-white/5' : 'bg-black/10'}`}>
                            <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed select-text" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder={effectivePromptPlaceholder} value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} readOnly={isWorking} />
                            <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-white/10 group-hover/input:bg-white/20" /></div>
                        </div>
                    )}
                    <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20 gap-1.5 flex-nowrap">
                        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                            {isTextNode && (
                                <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-bold text-zinc-100 whitespace-nowrap">
                                    <Type size={13} />
                                    <span>文本</span>
                                    <ChevronDown size={10} className="text-zinc-500" />
                                </div>
                            )}
                            <div className="relative group/model">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/30 hover:bg-emerald-400/10 cursor-pointer transition-colors text-[10px] font-bold text-emerald-300 hover:text-emerald-200"><span className="whitespace-nowrap">{activeModelConfig?.l || models.find(m => m.v === node.data.model)?.l || 'AI Model'}</span><ChevronDown size={10} /></div>
                                <div className="absolute bottom-full left-0 pb-2 w-48 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden p-1">{models.map(m => (<div key={m.v} onClick={() => onUpdate(node.id, isVideoNode ? { model: m.v, resolution: node.data.resolution || '1080p', duration: m.v.includes('veo-3.1') ? 8 : (node.data.duration || 5) } : { model: m.v, aspectRatio: normalizeAspectRatio(node.data.aspectRatio, m.ratios || IMAGE_ASPECT_RATIOS) })} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.model === m.v ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}><span>{m.l}</span>{m.badge && <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500">{m.badge}</span>}</div>))}</div></div>
                            </div>
                            {node.type !== NodeType.VIDEO_ANALYZER && node.type !== NodeType.AUDIO_GENERATOR && !isVideoNode && !isTextNode && (<div className="relative group/ratio"><div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/30 hover:bg-emerald-400/10 cursor-pointer transition-colors text-[10px] font-bold text-slate-300 hover:text-emerald-200"><Scaling size={12} /><span>{displayedAspectRatio}</span></div><div className="absolute bottom-full left-0 pb-2 w-28 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden p-1">{activeAspectRatios.map(r => (<div key={r} onClick={() => handleAspectRatioSelect(r)} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${displayedAspectRatio === r ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}><span>{r}</span><span className="h-3 w-4 rounded-sm border border-current opacity-50" style={{ aspectRatio: r.replace(':', '/') }} /></div>))}</div></div></div>)}
                            {isVideoNode && (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsVideoSettingsOpen(open => !open)}
                                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
                                    >
                                        <span>
                                            {node.data.resolution || '1080p'} / {node.data.duration || 5}s / {node.data.generateAudio === false ? '否' : '是'} / {node.data.aspectRatio || '自适应'}
                                        </span>
                                        <ChevronDown size={10} className={isVideoSettingsOpen ? 'rotate-180' : ''} />
                                    </button>
                                    {isVideoSettingsOpen && (
                                        <div className="absolute bottom-full left-0 z-[240] mb-2 w-[320px] rounded-2xl border border-white/10 bg-[#232325] p-4 shadow-2xl">
                                            <div className="space-y-4">
                                                <section>
                                                    <div className="mb-2 text-[11px] font-bold text-zinc-400">分辨率</div>
                                                    <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/20 p-1">
                                                        {VIDEO_RESOLUTIONS.map(resolution => (
                                                            <button
                                                                key={resolution}
                                                                onClick={() => onUpdate(node.id, { resolution })}
                                                                className={`rounded-lg px-1 py-2 text-[10px] font-bold transition-colors ${node.data.resolution === resolution ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                                            >
                                                                {resolution}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </section>
                                                <section>
                                                    <div className="mb-2 text-[11px] font-bold text-zinc-400">生成时长</div>
                                                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/20 p-1">
                                                        {VIDEO_DURATIONS.map(duration => (
                                                            <button
                                                                key={duration}
                                                                onClick={() => onUpdate(node.id, { duration })}
                                                                className={`rounded-lg py-2 text-[10px] font-bold transition-colors ${(node.data.duration || 5) === duration ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                                            >
                                                                {duration}s
                                                            </button>
                                                        ))}
                                                    </div>
                                                </section>
                                                <section>
                                                    <div className="mb-2 text-[11px] font-bold text-zinc-400">生成视频音频</div>
                                                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
                                                        {[true, false].map(enabled => (
                                                            <button
                                                                key={String(enabled)}
                                                                onClick={() => onUpdate(node.id, { generateAudio: enabled })}
                                                                className={`rounded-lg py-2 text-[10px] font-bold transition-colors ${(node.data.generateAudio !== false) === enabled ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                                            >
                                                                {enabled ? '是' : '否'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </section>
                                                <section>
                                                    <div className="mb-2 text-[11px] font-bold text-zinc-400">比例</div>
                                                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/20 p-1">
                                                        <button
                                                            onClick={() => onUpdate(node.id, { aspectRatio: undefined })}
                                                            className={`rounded-lg py-2 text-[10px] font-bold transition-colors ${!node.data.aspectRatio ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                                        >
                                                            自适应
                                                        </button>
                                                        {VIDEO_ASPECT_RATIOS.map(ratio => (
                                                            <button
                                                                key={ratio}
                                                                onClick={() => handleAspectRatioSelect(ratio)}
                                                                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-colors ${node.data.aspectRatio === ratio ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                                            >
                                                                <span className="block h-3 rounded-sm border border-current opacity-70" style={{ aspectRatio: ratio.replace(':', '/'), width: ratio === '9:16' ? 7 : 14 }} />
                                                                {ratio}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </section>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {node.type.includes('IMAGE') && (<div className="relative group/resolution"><div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><Monitor size={12} /><span>{node.data.resolution || '2K'}</span></div><div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:translate-y-0 group-hover/resolution:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{IMAGE_RESOLUTIONS.map(r => (<div key={r} onClick={() => onUpdate(node.id, { resolution: r })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${(node.data.resolution || '2K').toUpperCase() === r ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{r}</div>))}</div></div></div>)}
                            {(node.type.includes('IMAGE') || node.type === NodeType.VIDEO_GENERATOR) && (<div className="relative group/count"><div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><Layers size={12} /><span>{node.type.includes('IMAGE') ? (node.data.imageCount || 1) : (node.data.videoCount || 1)}</span></div><div className="absolute bottom-full left-0 pb-2 w-16 opacity-0 translate-y-2 pointer-events-none group-hover/count:opacity-100 group-hover/count:translate-y-0 group-hover/count:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{(node.type.includes('IMAGE') ? IMAGE_COUNTS : VIDEO_COUNTS).map(c => (<div key={c} onClick={() => onUpdate(node.id, node.type.includes('IMAGE') ? { imageCount: c } : { videoCount: c })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${((node.type.includes('IMAGE') ? node.data.imageCount : node.data.videoCount) || 1) === c ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{c}</div>))}</div></div></div>)}
                        </div>
                        {isTextNode ? (
                            <div className="flex items-center gap-3 ml-auto shrink-0">
                                <button className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="文本设置">
                                    <Settings size={14} />
                                </button>
                                <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:shadow-lg hover:shadow-emerald-400/20 active:scale-95'}`}>
                                    {isWorking ? <Loader2 className="animate-spin" size={13} /> : <Wand2 size={13} />}
                                    <span>生成</span>
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ml-auto shrink-0 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:shadow-lg hover:shadow-emerald-400/20 hover:scale-105 active:scale-95'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : hasGeneratedMedia ? <RefreshCw size={12} /> : <Wand2 size={12} />}<span>{isWorking ? (hasGeneratedMedia ? '重新生成中...' : '生成中...') : (hasGeneratedMedia ? '重新生成' : '生成')}</span></button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const isInteracting = isDragging || isResizing || isGroupDragging;
    const enableExpensiveEffects = Boolean((isSelected || isEmptyCreativeNode) && canvasScale >= 0.65 && !isInteracting);
    return (
        <div
            className={`absolute group ${isTextNode || isImageNode || isVideoNode ? 'rounded-[18px]' : 'rounded-[24px]'} ${isSelected || isEmptyCreativeNode ? 'ring-1 ring-emerald-400/80 shadow-[0_0_0_1px_rgba(45,212,191,0.12),0_0_42px_-14px_rgba(16,185,129,0.7)] z-30' : 'ring-1 ring-white/10 hover:ring-white/20 z-10'}`}
            style={{
                left: node.x, top: node.y, width: nodeWidth, height: nodeHeight,
                transform: dragOffset ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined,
                background: isSelected || isEmptyCreativeNode ? 'rgba(28, 28, 30, 0.88)' : 'rgba(28, 28, 30, 0.6)',
                transition: enableExpensiveEffects ? 'all 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
                backdropFilter: enableExpensiveEffects ? 'blur(18px)' : 'none',
                boxShadow: isInteracting ? 'none' : undefined,
                willChange: isInteracting || dragOffset ? 'transform' : 'auto'
            }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onContextMenu={(e) => onNodeContextMenu(e, node.id)}
        >
            {!suppressNodeChrome && renderImageSelectionToolbar()}
            {renderTopBar()}
            {!suppressNodeChrome && <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border ${isEmptyCreativeNode ? 'border-emerald-300/45 bg-[#101615] shadow-[0_0_18px_rgba(16,185,129,0.28)]' : 'border-white/20 bg-[#1c1c1e]'} flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md select-none ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPortMouseDown(e, node.id, 'input'); }} onMouseUp={(e) => onPortMouseUp(e, node.id, 'input')} title="Input"><Plus size={10} strokeWidth={3} className={isEmptyCreativeNode ? 'text-emerald-200/80' : 'text-white/50'} /></div>}
            {!suppressNodeChrome && <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border ${isEmptyCreativeNode ? 'border-emerald-300/45 bg-[#101615] shadow-[0_0_18px_rgba(16,185,129,0.28)]' : 'border-white/20 bg-[#1c1c1e]'} flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md select-none ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPortMouseDown(e, node.id, 'output'); }} onMouseUp={(e) => onPortMouseUp(e, node.id, 'output')} title="Output"><Plus size={10} strokeWidth={3} className={isEmptyCreativeNode ? 'text-emerald-200/80' : 'text-white/50'} /></div>}
            <div className={`w-full h-full flex flex-col relative overflow-hidden bg-zinc-900 ${isTextNode || isImageNode || isVideoNode ? 'rounded-[18px]' : 'rounded-[24px]'}`}><div className="flex-1 min-h-0 relative bg-zinc-900">{renderMediaContent()}</div></div>
            {renderBottomPanel()}
            {!suppressNodeChrome && <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>}
        </div>
    );
};

export const Node = memo(NodeComponent, arePropsEqual);
