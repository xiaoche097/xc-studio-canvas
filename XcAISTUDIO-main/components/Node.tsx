

// ... existing imports
import { AppNode, NodeStatus, NodeType } from '../types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, Settings } from 'lucide-react';
import { VideoModeSelector, SceneDirectorOverlay } from './VideoNodeModules';
import React, { memo, useRef, useState, useEffect, useCallback } from 'react';

// ... (keep constants and helper functions: arePropsEqual, safePlay, safePause, InputThumbnails, AudioVisualizer) ...

// Restore missing constants
interface InputAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
}

interface NodeProps {
    node: AppNode;
    onUpdate: (id: string, data: Partial<AppNode['data']>, size?: { width?: number, height?: number }, title?: string) => void;
    onAction: (id: string, prompt?: string) => void;
    onDelete: (id: string) => void;
    onExpand?: (data: { type: 'image' | 'video', src: string, rect: DOMRect, images?: string[], initialIndex?: number }) => void;
    onCrop?: (id: string, imageBase64: string) => void;
    onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onPortMouseUp: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
    onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
    inputAssets?: InputAsset[];
    onInputReorder?: (nodeId: string, newOrder: string[]) => void;

    isDragging?: boolean;
    isGroupDragging?: boolean;
    isSelected?: boolean;
    isResizing?: boolean;
    isConnecting?: boolean;
}

const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
const VIDEO_DURATIONS = [5, 8];
const IMAGE_COUNTS = [1, 2, 3, 4];
const VIDEO_COUNTS = [1, 2, 3, 4];
const GLASS_PANEL = "bg-[#2c2c2e]/95 backdrop-blur-2xl border border-white/10 shadow-2xl";
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360;
const AUDIO_NODE_HEIGHT = 200;
const IMAGE_QUICK_ACTIONS = [
    { label: '图生图', prompt: '基于参考图片生成一张高质感图片，保持主体特征，优化光影、构图和细节。', icon: ImageIcon },
    { label: '图生视频', prompt: '基于参考图片生成一段流畅视频，保留主体一致性，加入自然镜头运动。', icon: Film },
    { label: '图片换背景', prompt: '为图片主体更换干净高级的背景，保持主体边缘自然、光影统一。', icon: Scissors },
    { label: '首帧图生视频', prompt: '将图片作为视频首帧，生成具有电影感运镜和自然动态的视频。', icon: VideoIcon },
];
const IMAGE_MODEL_CONFIGS = [
    {
        l: 'Gemini 3 Pro',
        v: 'gemini-3-pro-image-preview',
        badge: '高质',
        ratios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    },
    {
        l: 'Gemini 3.1 Flash',
        v: 'gemini-3.1-flash-image-preview',
        badge: '快速',
        ratios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    },
    {
        l: 'Imagen 3',
        v: 'imagen-3.0-generate-002',
        badge: '写实',
        ratios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
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
    { l: 'Veo 极速版', v: 'veo-3.0-fast-generate-001', badge: '快速' },
    { l: 'Veo 专业版', v: 'veo-3.0-generate-001', badge: 'Pro' },
    { l: 'Wan 2.1', v: 'wan-2.1-t2v-14b', badge: 'Animate' },
];
const TEXT_QUICK_ACTIONS = [
    { label: '自己编写内容', prompt: '', icon: Edit },
    { label: '上传文档解析文本', prompt: '请解析上传文档内容，并整理为清晰、可复用的创作提示词。', icon: Upload },
    { label: '文字生视频', prompt: '请把这段文字改写成适合视频生成的镜头提示词，包含主体、场景、运动、光影和风格。', icon: VideoIcon },
    { label: '图片反推提示词', prompt: '请根据参考图片反推出完整提示词，包含主体、构图、光线、材质、风格和负面约束。', icon: Type },
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
    if (prev.isDragging !== next.isDragging ||
        prev.isResizing !== next.isResizing ||
        prev.isSelected !== next.isSelected ||
        prev.isGroupDragging !== next.isGroupDragging ||
        prev.isConnecting !== next.isConnecting) {
        return false;
    }
    if (prev.node !== next.node) return false;
    const prevInputs = prev.inputAssets || [];
    const nextInputs = next.inputAssets || [];
    if (prevInputs.length !== nextInputs.length) return false;
    for (let i = 0; i < prevInputs.length; i++) {
        if (prevInputs[i].id !== nextInputs[i].id || prevInputs[i].src !== nextInputs[i].src) return false;
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

const NodeComponent: React.FC<NodeProps> = ({
    node, onUpdate, onAction, onDelete, onExpand, onCrop, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, inputAssets, onInputReorder, isDragging, isGroupDragging, isSelected, isResizing, isConnecting
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
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const generationMode = node.data.generationMode || 'CONTINUE';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localPrompt, setLocalPrompt] = useState(node.data.prompt || '');
    const [inputHeight, setInputHeight] = useState(48);
    const isResizingInput = useRef(false);
    const inputStartDragY = useRef(0);
    const inputStartHeight = useRef(0);

    useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);
    const commitPrompt = () => { if (localPrompt !== (node.data.prompt || '')) onUpdate(node.id, { prompt: localPrompt }); };
    const handleActionClick = () => { commitPrompt(); onAction(node.id, localPrompt); };
    const handleCmdEnter = (e: React.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitPrompt(); onAction(node.id, localPrompt); } };

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
    const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => onUpdate(node.id, { image: e.target?.result as string }); reader.readAsDataURL(file); } };
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
    const isTextNode = node.type === NodeType.PROMPT_INPUT;
    const isImageNode = node.type === NodeType.IMAGE_GENERATOR;
    const isVideoNode = node.type === NodeType.VIDEO_GENERATOR;
    const isEmptyTextNode = isTextNode && !(node.data.prompt || '').trim();
    const isEmptyImageNode = isImageNode && !node.data.image && !node.data.videoUri;
    const isEmptyVideoNode = isVideoNode && !node.data.videoUri && !node.data.image;
    const isEmptyCreativeNode = isEmptyTextNode || isEmptyImageNode || isEmptyVideoNode;

    const renderTopBar = () => {
        const showTopBar = isSelected || isHovered || isEmptyCreativeNode;
        return (
            <div className={`absolute -top-10 left-0 w-full flex items-center justify-between px-1 transition-all duration-300 ${showTopBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div className="flex items-center gap-1.5 pointer-events-auto">
                    {node.type === NodeType.VIDEO_GENERATOR && !isEmptyVideoNode && (<VideoModeSelector currentMode={generationMode} onSelect={(mode) => onUpdate(node.id, { generationMode: mode })} />)}
                    {isTextNode && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/35 border border-white/10 backdrop-blur-md text-slate-300 shadow-lg">
                            <Type size={13} className="text-slate-300" />
                            <span className="text-[11px] font-bold tracking-wide">Text</span>
                        </div>
                    )}
                    {isImageNode && (
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
                    {(node.data.image || node.data.videoUri || node.data.audioUri) && (
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
                    {isWorking && <div className="bg-[#2c2c2e]/90 backdrop-blur-md p-1.5 rounded-full border border-white/10"><Loader2 className="animate-spin w-3 h-3 text-cyan-400" /></div>}
                    <div className={`px-2 py-1 flex items-center gap-2`}>
                        {isEditingTitle ? (
                            <input className="bg-transparent border-none outline-none text-slate-400 text-[10px] font-bold uppercase tracking-wider w-24 text-right" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} onMouseDown={e => e.stopPropagation()} autoFocus />
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
                    {isEmptyTextNode ? (
                        <div className="relative h-full overflow-hidden bg-[#1b1c1e]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.15),transparent_43%),linear-gradient(145deg,rgba(255,255,255,0.055),transparent_36%)]" />
                            <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
                            <div className="relative z-10 flex h-full flex-col justify-center px-10">
                                <p className="mb-5 text-[11px] font-bold tracking-wide text-zinc-500">尝试:</p>
                                <div className="grid gap-3">
                                    {TEXT_QUICK_ACTIONS.map(({ label, prompt, icon: ActionIcon }) => (
                                        <button
                                            key={label}
                                            onClick={(e) => { e.stopPropagation(); setLocalPrompt(prompt); onUpdate(node.id, { prompt }); }}
                                            className={`group/action flex w-fit min-w-[156px] items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-[12px] font-bold transition-all duration-200 ${label === '文字生视频' ? 'border-white/10 bg-white/8 text-zinc-100 shadow-[0_10px_28px_-18px_rgba(255,255,255,0.5)]' : 'border-transparent text-zinc-400 hover:border-emerald-400/25 hover:bg-emerald-400/10 hover:text-emerald-100'}`}
                                        >
                                            <ActionIcon size={15} className="text-zinc-500 transition-colors group-hover/action:text-emerald-300" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="m-5 flex-1 bg-black/10 rounded-2xl border border-white/5 p-4 relative overflow-hidden backdrop-blur-sm transition-colors group-hover/text:bg-black/20">
                            <textarea className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-slate-200 placeholder-slate-500 font-medium leading-relaxed custom-scrollbar selection:bg-emerald-500/30" placeholder="输入你的创意构想..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={commitPrompt} onKeyDown={handleCmdEnter} onWheel={(e) => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} maxLength={1000} />
                        </div>
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
                className={`w-full h-full relative group/media overflow-hidden bg-zinc-900 ${hasContent ? 'cursor-zoom-in' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={hasContent ? handleExpand : undefined}
                title={hasContent ? '点击放大查看' : undefined}
            >
                {!hasContent ? (
                    isImageNode ? (
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
                    ) : isVideoNode ? (
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
                            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleUploadVideo} />
                        </div>
                    ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600"><div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 hover:scale-105 transition-all duration-300 shadow-inner" onClick={() => fileInputRef.current?.click()}>{isWorking ? <Loader2 className="animate-spin text-cyan-500" size={32} /> : <NodeIcon size={32} className="opacity-50" />}</div><span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">{isWorking ? "处理中..." : "拖拽或上传"}</span><input type="file" ref={fileInputRef} className="hidden" accept={node.type.includes('VIDEO') ? "video/*" : "image/*"} onChange={node.type.includes('VIDEO') ? handleUploadVideo : handleUploadImage} /></div>
                    )
                ) : (
                    <>
                        {node.data.image ?
                            <img ref={mediaRef as any} src={node.data.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 bg-zinc-900" draggable={false} style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)} />
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
                                        <img src={img} className="w-full h-full object-cover" />
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

    const renderBottomPanel = () => {
        const isOpen = (isHovered || isInputFocused || isEmptyCreativeNode);
        const hasGeneratedMedia = Boolean((node.data.image || node.data.videoUri) && node.status === NodeStatus.SUCCESS);
        const promptPlaceholder = node.type === NodeType.AUDIO_GENERATOR
            ? '描述你想生成的音乐或音效...'
            : isTextNode
                ? '描述你想要生成的内容，并在下方调整生成参数。（Enter 生成，Shift+Enter 换行，可在左下角快捷键中修改）'
                : '描述你想要生成的内容，使用 @ 可快速引用上传的文件，按 / 呼出指令';
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

        return (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                {/* InputThumbnails: Set strict Z-Index to lower layer */}
                {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}
                {/* Glass Panel: Set strict Z-Index to higher layer to overlap thumbnails */}
                <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} ${isEmptyCreativeNode ? 'border-emerald-400/20 shadow-[0_18px_60px_-24px_rgba(16,185,129,0.55)]' : ''} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                    {isVideoNode && (
                        <div className="flex items-center justify-between gap-3 px-2 pt-1">
                            <div className="flex items-center gap-1">
                                {VIDEO_MODE_TABS.map(tab => {
                                    const active = generationMode === tab.mode || (tab.label === '文生视频' && generationMode === 'DEFAULT');
                                    return (
                                        <button
                                            key={tab.label}
                                            onClick={() => onUpdate(node.id, { generationMode: tab.mode })}
                                            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${active ? 'bg-white/10 text-zinc-100 ring-1 ring-white/10' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                                        >
                                            {tab.label}
                                        </button>
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
                    {!hasGeneratedMedia && (
                        <div className="relative group/input bg-black/10 rounded-[16px]">
                            <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder={promptPlaceholder} value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} readOnly={isWorking} />
                            <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-white/10 group-hover/input:bg-white/20" /></div>
                        </div>
                    )}
                    <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                        <div className="flex items-center gap-2">
                            {isTextNode && (
                                <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-bold text-zinc-100 whitespace-nowrap">
                                    <Type size={13} />
                                    <span>文本</span>
                                    <ChevronDown size={10} className="text-zinc-500" />
                                </div>
                            )}
                            <div className="relative group/model">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/30 hover:bg-emerald-400/10 cursor-pointer transition-colors text-[10px] font-bold text-emerald-300 hover:text-emerald-200"><span className="whitespace-nowrap">{activeModelConfig?.l || models.find(m => m.v === node.data.model)?.l || 'AI Model'}</span><ChevronDown size={10} /></div>
                                <div className="absolute bottom-full left-0 pb-2 w-48 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden p-1">{models.map(m => (<div key={m.v} onClick={() => onUpdate(node.id, { model: m.v, aspectRatio: (m.ratios?.includes(node.data.aspectRatio || '') ? node.data.aspectRatio : m.ratios?.[0]) || node.data.aspectRatio })} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.model === m.v ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}><span>{m.l}</span>{m.badge && <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500">{m.badge}</span>}</div>))}</div></div>
                            </div>
                            {node.type !== NodeType.VIDEO_ANALYZER && node.type !== NodeType.AUDIO_GENERATOR && !isVideoNode && !isTextNode && (<div className="relative group/ratio"><div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/30 hover:bg-emerald-400/10 cursor-pointer transition-colors text-[10px] font-bold text-slate-300 hover:text-emerald-200"><Scaling size={12} /><span>{node.data.aspectRatio || '16:9'}</span></div><div className="absolute bottom-full left-0 pb-2 w-28 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden p-1">{activeAspectRatios.map(r => (<div key={r} onClick={() => handleAspectRatioSelect(r)} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.aspectRatio === r ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}><span>{r}</span><span className="h-3 w-4 rounded-sm border border-current opacity-50" style={{ aspectRatio: r.replace(':', '/') }} /></div>))}</div></div></div>)}
                            {isVideoNode && (<div className="relative group/videoParams"><div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/30 hover:bg-emerald-400/10 cursor-pointer transition-colors text-[10px] font-bold text-slate-300 hover:text-emerald-200"><span>{node.data.resolution || '720p'} / {node.data.duration || 5}s / {generationMode === 'FIRST_LAST_FRAME' ? '是' : '否'} / {node.data.aspectRatio || '自适应'} / {generationMode === 'CUT' ? '是' : '否'}</span><ChevronDown size={10} /></div><div className="absolute bottom-full left-0 pb-2 w-44 opacity-0 translate-y-2 pointer-events-none group-hover/videoParams:opacity-100 group-hover/videoParams:translate-y-0 group-hover/videoParams:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden p-1"><div className="px-3 py-1.5 text-[9px] font-bold text-zinc-500">清晰度</div>{VIDEO_RESOLUTIONS.map(r => (<div key={r} onClick={() => onUpdate(node.id, { resolution: r })} className={`rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.resolution === r ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}>{r}</div>))}<div className="mt-1 px-3 py-1.5 text-[9px] font-bold text-zinc-500">时长</div>{VIDEO_DURATIONS.map(d => (<div key={d} onClick={() => onUpdate(node.id, { duration: d })} className={`rounded-lg px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${(node.data.duration || 5) === d ? 'text-emerald-300 bg-emerald-400/10' : 'text-slate-400'}`}>{d}s</div>))}</div></div></div>)}
                            {node.type.includes('IMAGE') && (<div className="relative group/resolution"><div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><Monitor size={12} /><span>{node.data.resolution || '1k'}</span></div><div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:translate-y-0 group-hover/resolution:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{IMAGE_RESOLUTIONS.map(r => (<div key={r} onClick={() => onUpdate(node.id, { resolution: r })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.resolution === r ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{r}</div>))}</div></div></div>)}
                            {(node.type.includes('IMAGE') || node.type === NodeType.VIDEO_GENERATOR) && (<div className="relative group/count"><div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><Layers size={12} /><span>{node.type.includes('IMAGE') ? (node.data.imageCount || 1) : (node.data.videoCount || 1)}</span></div><div className="absolute bottom-full left-0 pb-2 w-16 opacity-0 translate-y-2 pointer-events-none group-hover/count:opacity-100 group-hover/count:translate-y-0 group-hover/count:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{(node.type.includes('IMAGE') ? IMAGE_COUNTS : VIDEO_COUNTS).map(c => (<div key={c} onClick={() => onUpdate(node.id, node.type.includes('IMAGE') ? { imageCount: c } : { videoCount: c })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${((node.type.includes('IMAGE') ? node.data.imageCount : node.data.videoCount) || 1) === c ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{c}</div>))}</div></div></div>)}
                        </div>
                        {isTextNode ? (
                            <div className="flex items-center gap-3">
                                <button className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="文本设置">
                                    <Settings size={14} />
                                </button>
                                <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:shadow-lg hover:shadow-emerald-400/20 active:scale-95'}`}>
                                    {isWorking ? <Loader2 className="animate-spin" size={13} /> : <Wand2 size={13} />}
                                    <span>生成</span>
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:shadow-lg hover:shadow-emerald-400/20 hover:scale-105 active:scale-95'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>{isWorking ? '生成中...' : '生成'}</span></button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const isInteracting = isDragging || isResizing || isGroupDragging;
    return (
        <div
            className={`absolute group ${isTextNode || isImageNode || isVideoNode ? 'rounded-[18px]' : 'rounded-[24px]'} ${isSelected || isEmptyCreativeNode ? 'ring-1 ring-emerald-400/80 shadow-[0_0_0_1px_rgba(45,212,191,0.12),0_0_42px_-14px_rgba(16,185,129,0.7)] z-30' : 'ring-1 ring-white/10 hover:ring-white/20 z-10'}`}
            style={{
                left: node.x, top: node.y, width: nodeWidth, height: nodeHeight,
                background: isSelected || isEmptyCreativeNode ? 'rgba(28, 28, 30, 0.88)' : 'rgba(28, 28, 30, 0.6)',
                transition: isInteracting ? 'none' : 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
                backdropFilter: isInteracting ? 'none' : 'blur(24px)',
                boxShadow: isInteracting ? 'none' : undefined,
                willChange: isInteracting ? 'left, top, width, height' : 'auto'
            }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onContextMenu={(e) => onNodeContextMenu(e, node.id)}
        >
            {renderTopBar()}
            <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border ${isEmptyCreativeNode ? 'border-emerald-300/45 bg-[#101615] shadow-[0_0_18px_rgba(16,185,129,0.28)]' : 'border-white/20 bg-[#1c1c1e]'} flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'input')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'input')} title="Input"><Plus size={10} strokeWidth={3} className={isEmptyCreativeNode ? 'text-emerald-200/80' : 'text-white/50'} /></div>
            <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border ${isEmptyCreativeNode ? 'border-emerald-300/45 bg-[#101615] shadow-[0_0_18px_rgba(16,185,129,0.28)]' : 'border-white/20 bg-[#1c1c1e]'} flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'output')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'output')} title="Output"><Plus size={10} strokeWidth={3} className={isEmptyCreativeNode ? 'text-emerald-200/80' : 'text-white/50'} /></div>
            <div className={`w-full h-full flex flex-col relative overflow-hidden bg-zinc-900 ${isTextNode || isImageNode || isVideoNode ? 'rounded-[18px]' : 'rounded-[24px]'}`}><div className="flex-1 min-h-0 relative bg-zinc-900">{renderMediaContent()}</div></div>
            {renderBottomPanel()}
            <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
        </div>
    );
};

export const Node = memo(NodeComponent, arePropsEqual);
