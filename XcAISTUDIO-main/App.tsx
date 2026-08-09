

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { XIAOCHE_AVATAR_BASE64 } from './services/avatarData';
import { Node } from './components/Node';
import { SidebarDock } from './components/SidebarDock';
import { AssistantPanel } from './components/AssistantPanel';
import { ImageCropper } from './components/ImageCropper';
import { SketchEditor } from './components/SketchEditor';
import { SmartSequenceDock } from './components/SmartSequenceDock';
import { SonicStudio } from './components/SonicStudio';
import { UnifiedSettingsModal } from '../components/UnifiedSettingsModal';
import { HistoryModal } from './components/HistoryModal';

declare global {
    interface Window {
        aistudio: any;
    }
}
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, SmartSequenceItem, StoryboardOptionType, GridCropConfig } from './types';
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, orchestrateVideoPrompt, compileMultiFramePrompt, urlToBase64, extractLastFrame, generateAudio, generateStoryboardGridImages, cropGridCellCanvas } from './services/geminiService';


import { getGenerationStrategy } from './services/videoStrategies';
import { saveToStorage, loadFromStorage } from './services/storage';
import {
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon,
    ScanFace, Brush, MousePointerClick, LayoutTemplate, X, Film, Link, RefreshCw, Upload,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan, Music, Mic2, Loader2, Workflow as WorkflowIcon,
    Layers, Volume2, Box, Clapperboard, History, Play, Save
} from 'lucide-react';
import { saveGeneratedProject } from '../services/projectHistoryService';
import { STYLE_PRESETS } from '../Cyzx4/constants/stylePresets';

// Apple Physics Curve
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_THRESHOLD = 8; // Pixels for magnetic snap
const COLLISION_PADDING = 24; // Spacing when nodes bounce off each other
const CANVAS_SAVE_DELAY = 800;
const VIEWPORT_BUFFER_PX = 320;
const PREVIEW_MAX_EDGE = 640;
const GROUP_PADDING_X = 44;
const GROUP_PADDING_TOP = 72;
const GROUP_PADDING_BOTTOM = 250;
const IMAGE_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

const getClosestAspectRatio = (width: number, height: number) => {
    if (!width || !height) return '1:1';
    const target = width / height;
    return IMAGE_ASPECT_RATIOS.reduce((closest, ratio) => {
        const [ratioW, ratioH] = ratio.split(':').map(Number);
        const [closestW, closestH] = closest.split(':').map(Number);
        return Math.abs((ratioW / ratioH) - target) < Math.abs((closestW / closestH) - target) ? ratio : closest;
    }, IMAGE_ASPECT_RATIOS[0]);
};

const getImageSourceFingerprint = (src?: string) => {
    if (!src) return '';
    if (src.startsWith('data:')) return `${src.length}:${src.slice(-32)}`;
    return src;
};

const createCanvasImagePreview = (src: string): Promise<string> => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const ratio = Math.min(1, PREVIEW_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
        canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
        const context = canvas.getContext('2d');
        if (!context) {
            reject(new Error('Canvas preview context is unavailable'));
            return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Image preview encoding failed'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        }, 'image/webp', 0.78);
    };
    image.onerror = () => reject(new Error('Image preview loading failed'));
    image.src = src;
});

const buildImageGenerationPrompt = (node: AppNode, userPrompt: string, hasReferenceImages: boolean) => {
    const preset = node.data.stylePresetId
        ? STYLE_PRESETS.find(item => item.id === node.data.stylePresetId)
        : undefined;
    if (!preset) return userPrompt;

    return [
        hasReferenceImages ? preset.promptWithRef : preset.prompt,
        userPrompt.trim() ? `用户补充说明：\n${userPrompt.trim()}` : '',
        preset.negativePrompt ? `负面约束：\n${preset.negativePrompt}` : '',
    ].filter(Boolean).join('\n\n');
};

// Helper to get image dimensions
const getImageDimensions = (src: string): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
    });
};

// Expanded View Component (Modal)
const ExpandedView = ({ media, onClose }: { media: any, onClose: () => void }) => {
    const [visible, setVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);

    useEffect(() => {
        if (media) {
            requestAnimationFrame(() => setVisible(true));
            setCurrentIndex(media.initialIndex || 0);
        } else {
            setVisible(false);
        }
    }, [media]);

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 400);
    }, [onClose]);

    const hasMultiple = media?.images && media.images.length > 1;

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev + 1) % media.images.length);
        }
    }, [hasMultiple, media]);

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev - 1 + media.images.length) % media.images.length);
        }
    }, [hasMultiple, media]);

    useEffect(() => {
        if (!visible) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, handleClose, handleNext, handlePrev]);

    // Handle Video Blob Fetching for Expanded View
    useEffect(() => {
        if (!media) return;
        const currentSrc = hasMultiple ? media.images[currentIndex] : media.src;
        const isVideo = (media.type === 'video') && !(currentSrc && currentSrc.startsWith('data:image'));

        if (isVideo) {
            if (currentSrc.startsWith('blob:') || currentSrc.startsWith('data:')) {
                setVideoBlobUrl(currentSrc);
                return;
            }
            setIsLoadingVideo(true);
            let active = true;
            fetch(currentSrc)
                .then(res => res.blob())
                .then(blob => {
                    if (active) {
                        // FORCE VIDEO/MP4
                        const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                        setVideoBlobUrl(URL.createObjectURL(mp4Blob));
                        setIsLoadingVideo(false);
                    }
                })
                .catch(() => { if (active) setIsLoadingVideo(false); });
            return () => { active = false; };
        } else {
            setVideoBlobUrl(null);
        }
    }, [media, currentIndex, hasMultiple]);

    if (!media) return null;

    // Determine current source and type
    const currentSrc = hasMultiple ? media.images[currentIndex] : media.src;
    const isVideo = (media.type === 'video') && !(currentSrc && currentSrc.startsWith('data:image'));

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ease-[${SPRING}] ${visible ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'}`} onClick={handleClose}>
            <div className={`relative w-full h-full flex items-center justify-center p-8 transition-all duration-500 ease-[${SPRING}] ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`} onClick={e => e.stopPropagation()}>

                {hasMultiple && (
                    <button
                        onClick={handlePrev}
                        className="absolute left-4 md:left-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                <div className="relative max-w-full max-h-full flex flex-col items-center">
                    {!isVideo ? (
                        <img
                            key={currentSrc}
                            src={currentSrc}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-[#0a0a0c]"
                            draggable={false}
                        />
                    ) : (
                        // If video blob is ready, show it. If loading, show loader.
                        isLoadingVideo || !videoBlobUrl ? (
                            <div className="w-[60vw] h-[40vh] flex items-center justify-center bg-black/50 rounded-lg">
                                <Loader2 className="animate-spin text-white" size={48} />
                            </div>
                        ) : (
                            <video
                                key={videoBlobUrl}
                                src={videoBlobUrl}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-black"
                                controls
                                autoPlay
                                playsInline
                            />
                        )
                    )}

                    {hasMultiple && (
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                            {media.images.map((_: any, i: number) => (
                                <div
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === currentIndex ? 'bg-cyan-500 scale-125' : 'bg-white/30 hover:bg-white/50'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {hasMultiple && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 md:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

            </div>
            <button onClick={handleClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-[110]"><X size={24} /></button>
        </div>
    );
};

export const App = () => {
    // --- Global App State ---
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [assetHistory, setAssetHistory] = useState<any[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [agentAttachments, setAgentAttachments] = useState<{ id: string; src: string; title: string }[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Sketch Editor State
    const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);

    // Multi-Frame Dock State
    const [isMultiFrameOpen, setIsMultiFrameOpen] = useState(false);

    // Sonic Studio (Music) State
    const [isSonicStudioOpen, setIsSonicStudioOpen] = useState(false);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Controlled Sidebar Panel State
    const [activeSidebarPanel, setActiveSidebarPanel] = useState<'history' | 'workflow' | 'add' | null>(null);

    // --- Canvas State ---
    const [nodes, setNodes] = useState<AppNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [clipboard, setClipboard] = useState<AppNode | null>(null);

    // History
    const [history, setHistory] = useState<any[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Viewport
    const [scale, setScale] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [isViewportAnimating, setIsViewportAnimating] = useState(false);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // 新增 UI 与交互状态
    const [showGrid, setShowGrid] = useState(true);
    const [showMinimap, setShowMinimap] = useState(false);
    const [showHelpDropdown, setShowHelpDropdown] = useState(false);
    const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
    const [interactionMode, setInteractionMode] = useState<'default' | 'comfyui'>('default');

    // Interaction / Selection
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]); // Changed to Array for multi-select
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [draggingNodeParentGroupId, setDraggingNodeParentGroupId] = useState<string | null>(null);
    const [draggingGroup, setDraggingGroup] = useState<any>(null);
    const [resizingGroupId, setResizingGroupId] = useState<string | null>(null);
    const [activeGroupNodeIds, setActiveGroupNodeIds] = useState<string[]>([]);
    const [connectionStart, setConnectionStart] = useState<{ id: string, x: number, y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<any>(null);
    const [runningGroupIds, setRunningGroupIds] = useState<Set<string>>(new Set());
    const [groupRunMessages, setGroupRunMessages] = useState<Record<string, string>>({});
    const [groupSaveMessages, setGroupSaveMessages] = useState<Record<string, string>>({});

    // Node Resizing
    const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
    const [initialSize, setInitialSize] = useState<{ width: number, height: number } | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState<{ x: number, y: number } | null>(null);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [contextMenuTarget, setContextMenuTarget] = useState<any>(null);

    // Media Overlays
    const [expandedMedia, setExpandedMedia] = useState<any>(null);
    const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);

    const handleAddImageToAgent = useCallback((src: string, title: string) => {
        setAgentAttachments(prev => {
            if (prev.some(item => item.src === src)) return prev;
            return [...prev, { id: `agent-image-${Date.now()}`, src, title }].slice(-6);
        });
        setIsChatOpen(true);
    }, []);

    // Refs for closures
    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const groupsRef = useRef(groups);
    const historyRef = useRef(history);
    const historyIndexRef = useRef(historyIndex);
    const connectionStartRef = useRef(connectionStart);
    const dragPreviewRef = useRef<{ nodeIds: string[]; dx: number; dy: number } | null>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null); // For RAF Throttling
    const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const persistenceDirtyRef = useRef(false);
    const previousInteractionRef = useRef(false);
    const previewJobsRef = useRef(new Set<string>());
    const previewFailuresRef = useRef(new Set<string>());
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const scaleRef = useRef(scale);
    const panRef = useRef(pan);
    const interactionModeRef = useRef(interactionMode);

    // Replacement Input Refs
    const replaceVideoInputRef = useRef<HTMLInputElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const replacementTargetRef = useRef<string | null>(null);

    // Interaction Refs
    const dragNodeRef = useRef<{
        id: string,
        startX: number,
        startY: number,
        mouseStartX: number,
        mouseStartY: number,
        parentGroupId?: string | null,
        siblingNodeIds: string[],
        draggedNodeStartById: Map<string, { startX: number, startY: number }>,
        draggedNodeElements: Map<string, {
            element: HTMLElement,
            transition: string,
            willChange: string,
            backdropFilter: string,
            boxShadow: string,
        }>,
        nodeWidth: number,
        nodeHeight: number
    } | null>(null);

    const resizeContextRef = useRef<{
        nodeId: string,
        initialWidth: number,
        initialHeight: number,
        startX: number,
        startY: number,
        parentGroupId: string | null,
        siblingNodeIds: string[]
    } | null>(null);

    const dragGroupRef = useRef<{
        id: string,
        startX: number,
        startY: number,
        mouseStartX: number,
        mouseStartY: number,
        childNodes: { id: string, startX: number, startY: number }[],
        childNodeStartById: Map<string, { startX: number, startY: number }>
    } | null>(null);

    useEffect(() => {
        nodesRef.current = nodes; connectionsRef.current = connections; groupsRef.current = groups;
        historyRef.current = history; historyIndexRef.current = historyIndex; connectionStartRef.current = connectionStart;
        scaleRef.current = scale; panRef.current = pan; interactionModeRef.current = interactionMode;
    }, [nodes, connections, groups, history, historyIndex, connectionStart, scale, pan, interactionMode]);

    useEffect(() => {
        const handleResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Persistence ---
    useEffect(() => {
        if (window.aistudio) window.aistudio.hasSelectedApiKey().then(hasKey => { if (!hasKey) window.aistudio.openSelectKey(); });
        const loadData = async () => {
            try {
                const sAssets = await loadFromStorage<any[]>('assets'); if (sAssets) setAssetHistory(sAssets);
                const sWfs = await loadFromStorage<Workflow[]>('workflows'); if (sWfs) setWorkflows(sWfs);
                const sNodes = await loadFromStorage<AppNode[]>('nodes'); if (sNodes) setNodes(sNodes);
                const sConns = await loadFromStorage<Connection[]>('connections'); if (sConns) setConnections(sConns);
                const sGroups = await loadFromStorage<Group[]>('groups'); if (sGroups) setGroups(sGroups);
            } catch (e) {
                console.error("Failed to load storage", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    const isCanvasInteracting = Boolean(
        isDraggingCanvas ||
        draggingNodeId ||
        draggingGroup ||
        resizingNodeId ||
        resizingGroupId ||
        connectionStart ||
        selectionRect
    );

    const flushCanvasPersistence = useCallback(() => {
        if (!isLoaded) return;
        if (persistenceTimerRef.current) {
            clearTimeout(persistenceTimerRef.current);
            persistenceTimerRef.current = null;
        }
        persistenceDirtyRef.current = false;
        void Promise.all([
            saveToStorage('assets', assetHistory),
            saveToStorage('workflows', workflows),
            saveToStorage('nodes', nodesRef.current),
            saveToStorage('connections', connectionsRef.current),
            saveToStorage('groups', groupsRef.current),
        ]).catch(error => console.error('Failed to persist workstation state', error));
    }, [assetHistory, workflows, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        persistenceDirtyRef.current = true;
        if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
        if (isCanvasInteracting) return;
        persistenceTimerRef.current = setTimeout(flushCanvasPersistence, CANVAS_SAVE_DELAY);
        return () => {
            if (persistenceTimerRef.current) {
                clearTimeout(persistenceTimerRef.current);
                persistenceTimerRef.current = null;
            }
        };
    }, [assetHistory, workflows, nodes, connections, groups, isLoaded, isCanvasInteracting, flushCanvasPersistence]);

    useEffect(() => {
        const wasInteracting = previousInteractionRef.current;
        previousInteractionRef.current = isCanvasInteracting;
        if (!wasInteracting || isCanvasInteracting || !persistenceDirtyRef.current) return;
        const timer = window.setTimeout(flushCanvasPersistence, 0);
        return () => window.clearTimeout(timer);
    }, [isCanvasInteracting, flushCanvasPersistence]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && persistenceDirtyRef.current) flushCanvasPersistence();
        };
        const handleBeforeUnload = () => {
            if (persistenceDirtyRef.current) flushCanvasPersistence();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [flushCanvasPersistence]);

    useEffect(() => {
        const handleAssetsCleared = () => setAssetHistory([]);
        window.addEventListener('video-factory-assets-cleared', handleAssetsCleared);
        return () => window.removeEventListener('video-factory-assets-cleared', handleAssetsCleared);
    }, []);


    const calculateStoryboardNodeHeight = (aspectRatioStr = '2:3', gridSizeStr = '3x3', currentWidth = 560) => {
        const [rw, rh] = (aspectRatioStr || '2:3').split(':').map(Number);
        const r = (rw && rh) ? (rw / rh) : (2 / 3);
        const cols = parseInt((gridSizeStr || '3x3').split('x')[0]) || 3;
        const rows = parseInt((gridSizeStr || '3x3').split('x')[1]) || 3;

        const innerWidth = currentWidth - 32;
        const gap = 8;
        const cellWidth = (innerWidth - (cols - 1) * gap) / cols;
        const cellHeight = cellWidth / r;
        const gridHeight = rows * cellHeight + (rows - 1) * gap;

        return Math.round(gridHeight + 100);
    };

    const getApproxNodeHeight = (node: AppNode) => {
        if (node.height) return node.height;
        const width = node.width || (node.type === NodeType.STORYBOARD_GRID ? 560 : 420);
        if (['PROMPT_INPUT', 'VIDEO_ANALYZER', 'IMAGE_EDITOR'].includes(node.type)) return 360;
        if (node.type === NodeType.AUDIO_GENERATOR) return 200;
        if (node.type === NodeType.STORYBOARD_GRID) {
            return calculateStoryboardNodeHeight(node.data.storyboardAspectRatio, node.data.storyboardGridSize, width);
        }
        const [w, h] = (node.data.aspectRatio || '16:9').split(':').map(Number);
        const extra = (node.type === NodeType.VIDEO_GENERATOR && node.data.generationMode === 'CUT') ? 36 : 0;
        return ((width * h / w) + extra);
    };

    const getNodeBounds = (node: AppNode) => {
        const w = node.width || (node.type === NodeType.STORYBOARD_GRID ? 560 : 420);
        const h = node.height || getApproxNodeHeight(node);
        return { x: node.x, y: node.y, width: w, height: h, r: node.x + w, b: node.y + h };
    };

    const inferLegacyGroupNodeIds = useCallback((group: Group, sourceNodes = nodesRef.current) => (
        sourceNodes
            .filter(node => {
                const bounds = getNodeBounds(node);
                const centerX = bounds.x + bounds.width / 2;
                const centerY = bounds.y + bounds.height / 2;
                return (
                    centerX > group.x &&
                    centerX < group.x + group.width &&
                    centerY > group.y &&
                    centerY < group.y + group.height
                );
            })
            .map(node => node.id)
    ), []);

    const getGroupNodeIds = useCallback((group: Group, sourceNodes = nodesRef.current) => (
        group.nodeIds?.filter(id => sourceNodes.some(node => node.id === id)) ||
        inferLegacyGroupNodeIds(group, sourceNodes)
    ), [inferLegacyGroupNodeIds]);

    const getGroupBoundsForNodes = useCallback((memberNodes: AppNode[]) => {
        if (memberNodes.length === 0) return null;
        const bounds = memberNodes.map(getNodeBounds);
        const minX = Math.min(...bounds.map(item => item.x));
        const minY = Math.min(...bounds.map(item => item.y));
        const maxRight = Math.max(...bounds.map(item => item.r));
        const maxBottom = Math.max(...bounds.map(item => item.b));
        return {
            x: minX - GROUP_PADDING_X,
            y: minY - GROUP_PADDING_TOP,
            width: (maxRight - minX) + GROUP_PADDING_X * 2,
            height: (maxBottom - minY) + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM,
        };
    }, []);

    const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

    const groupMembershipByNodeId = useMemo(() => {
        const membership = new Map<string, { group: Group, nodeIds: string[] }>();
        groups.forEach(group => {
            const nodeIds = getGroupNodeIds(group, nodes);
            nodeIds.forEach(nodeId => {
                if (!membership.has(nodeId)) membership.set(nodeId, { group, nodeIds });
            });
        });
        return membership;
    }, [groups, nodes, getGroupNodeIds]);

    const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
    const activeGroupNodeIdSet = useMemo(() => new Set(activeGroupNodeIds), [activeGroupNodeIds]);
    const nodeInputAssetsById = useMemo(() => {
        const assetsById = new Map<string, {
            id: string;
            type: 'image' | 'video' | 'audio';
            src: string;
        }[]>();

        nodes.forEach(node => {
            const inputAssets = node.inputs
                .map(inputId => nodeById.get(inputId))
                .filter(inputNode => inputNode && (inputNode.data.image || inputNode.data.videoUri || inputNode.data.croppedFrame || inputNode.data.audioUri))
                .slice(0, 15)
                .map(inputNode => ({
                    id: inputNode!.id,
                    type: (inputNode!.data.croppedFrame || inputNode!.data.image) ? 'image' as const : inputNode!.data.videoUri ? 'video' as const : 'audio' as const,
                    src: inputNode!.data.croppedFrame || inputNode!.data.imagePreview || inputNode!.data.image || inputNode!.data.videoUri || inputNode!.data.audioUri!
                }));
            assetsById.set(node.id, inputAssets);
        });

        return assetsById;
    }, [nodes, nodeById]);

    const visibleNodeIds = useMemo(() => {
        const currentScale = Math.max(scale, 0.01);
        const buffer = VIEWPORT_BUFFER_PX / currentScale;
        const viewLeft = (-pan.x / currentScale) - buffer;
        const viewTop = (-pan.y / currentScale) - buffer;
        const viewRight = ((viewportSize.width - pan.x) / currentScale) + buffer;
        const viewBottom = ((viewportSize.height - pan.y) / currentScale) + buffer;
        const forcedIds = new Set(selectedNodeIds);
        if (draggingNodeId) forcedIds.add(draggingNodeId);
        if (resizingNodeId) forcedIds.add(resizingNodeId);
        if (connectionStart?.id && connectionStart.id !== 'smart-sequence-dock') forcedIds.add(connectionStart.id);

        const ids = new Set<string>();
        nodes.forEach(node => {
            if (forcedIds.has(node.id)) {
                ids.add(node.id);
                return;
            }
            const bounds = getNodeBounds(node);
            if (bounds.r >= viewLeft && bounds.x <= viewRight && bounds.b >= viewTop && bounds.y <= viewBottom) {
                ids.add(node.id);
            }
        });
        return ids;
    }, [nodes, pan.x, pan.y, scale, viewportSize, selectedNodeIds, draggingNodeId, resizingNodeId, connectionStart]);

    const visibleNodes = useMemo(
        () => nodes.filter(node => visibleNodeIds.has(node.id)),
        [nodes, visibleNodeIds]
    );

    const visibleConnections = useMemo(
        () => connections.filter(connection => visibleNodeIds.has(connection.from) || visibleNodeIds.has(connection.to)),
        [connections, visibleNodeIds]
    );

    useEffect(() => {
        if (draggingGroup || draggingNodeId || resizingNodeId || resizingGroupId || groups.length === 0) return;
        setGroups(previous => {
            let changed = false;
            const next = previous.map(group => {
                const nodeIds = getGroupNodeIds(group, nodes);
                const memberNodes = nodeIds.map(id => nodeById.get(id)).filter(Boolean) as AppNode[];
                const fitted = getGroupBoundsForNodes(memberNodes);
                if (!fitted) return group;
                const needsUpdate =
                    !group.nodeIds ||
                    group.nodeIds.length !== nodeIds.length ||
                    group.nodeIds.some((id, index) => id !== nodeIds[index]) ||
                    Math.abs(group.x - fitted.x) > 1 ||
                    Math.abs(group.y - fitted.y) > 1 ||
                    Math.abs(group.width - fitted.width) > 1 ||
                    Math.abs(group.height - fitted.height) > 1;
                if (!needsUpdate) return group;
                changed = true;
                return { ...group, ...fitted, nodeIds };
            });
            return changed ? next : previous;
        });
    }, [
        nodes,
        groups.length,
        draggingGroup,
        draggingNodeId,
        resizingNodeId,
        resizingGroupId,
        nodeById,
        getGroupNodeIds,
        getGroupBoundsForNodes,
    ]);

    useEffect(() => {
        const candidate = visibleNodes.find(node => {
            const source = node.data.image;
            if (!source) return false;
            const fingerprint = getImageSourceFingerprint(source);
            const jobKey = `${node.id}:${fingerprint}`;
            return (
                node.data.imagePreviewSource !== fingerprint &&
                !previewJobsRef.current.has(node.id) &&
                !previewFailuresRef.current.has(jobKey)
            );
        });
        if (!candidate?.data.image) return;

        const source = candidate.data.image;
        const fingerprint = getImageSourceFingerprint(source);
        previewJobsRef.current.add(candidate.id);
        const run = () => {
            void createCanvasImagePreview(source)
                .then(preview => {
                    setNodes(previous => previous.map(node => {
                        if (node.id !== candidate.id || getImageSourceFingerprint(node.data.image) !== fingerprint) return node;
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                imagePreview: preview,
                                imagePreviewSource: fingerprint,
                            },
                        };
                    }));
                })
                .catch(error => {
                    previewFailuresRef.current.add(`${candidate.id}:${fingerprint}`);
                    console.debug('Image preview generation skipped:', error);
                })
                .finally(() => previewJobsRef.current.delete(candidate.id));
        };

        const idleWindow = window as Window & {
            requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        if (idleWindow.requestIdleCallback) {
            idleWindow.requestIdleCallback(run, { timeout: 1200 });
        } else {
            window.setTimeout(run, 80);
        }
    }, [visibleNodes]);

    const getNodeNameCN = (t: string) => {
        switch (t) {
            case NodeType.PROMPT_INPUT: return '创意描述';
            case NodeType.IMAGE_GENERATOR: return '文字生图';
            case NodeType.VIDEO_GENERATOR: return '文生视频';
            case NodeType.AUDIO_GENERATOR: return '灵感音乐';
            case NodeType.VIDEO_ANALYZER: return '视频分析';
            case NodeType.IMAGE_EDITOR: return '图像编辑';
            default: return t;
        }
    };
    const getNodeIcon = (t: string) => {
        switch (t) {
            case NodeType.PROMPT_INPUT: return Type;
            case NodeType.IMAGE_GENERATOR: return ImageIcon;
            case NodeType.VIDEO_GENERATOR: return Film;
            case NodeType.AUDIO_GENERATOR: return Mic2;
            case NodeType.VIDEO_ANALYZER: return ScanFace;
            case NodeType.IMAGE_EDITOR: return Brush;
            default: return Plus;
        }
    };

    const handleFitView = useCallback(() => {
        if (nodes.length === 0) {
            setPan({ x: 0, y: 0 });
            setScale(1);
            return;
        }

        const padding = 100;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(n => {
            const h = n.height || getApproxNodeHeight(n);
            const w = n.width || 420;
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + w > maxX) maxX = n.x + w;
            if (n.y + h > maxY) maxY = n.y + h;
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const scaleX = (window.innerWidth - padding * 2) / contentW;
        const scaleY = (window.innerHeight - padding * 2) / contentH;
        let newScale = Math.min(scaleX, scaleY, 1);
        newScale = Math.max(0.2, newScale);

        const contentCenterX = minX + contentW / 2;
        const contentCenterY = minY + contentH / 2;

        const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale);
        const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale);

        setPan({ x: newPanX, y: newPanY });
        setScale(newScale);
    }, [nodes]);

    const saveHistory = useCallback(() => {
        try {
            const currentStep = {
                nodes: nodesRef.current.map(node => ({
                    ...node,
                    data: node.data,
                    inputs: [...node.inputs],
                })),
                connections: connectionsRef.current.map(connection => ({ ...connection })),
                groups: groupsRef.current.map(group => ({ ...group })),
            };
            const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
            newHistory.push(currentStep); if (newHistory.length > 50) newHistory.shift();
            setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
        } catch (e) {
            console.warn("History save failed:", e);
        }
    }, []);

    const createWorkflowGroupFromNodeIds = useCallback((nodeIds: string[]) => {
        const uniqueNodeIds = Array.from(new Set(nodeIds));
        if (uniqueNodeIds.length === 0) return;

        const selectedIdSet = new Set(uniqueNodeIds);
        const memberNodes = nodesRef.current.filter(node => selectedIdSet.has(node.id));
        const fitted = getGroupBoundsForNodes(memberNodes);
        if (!fitted) return;

        saveHistory();
        setGroups(previous => [...previous, {
            id: `g-${Date.now()}`,
            title: '新建工作流',
            ...fitted,
            nodeIds: memberNodes.map(node => node.id),
        }]);
        setSelectedGroupId(null);
    }, [getGroupBoundsForNodes, saveHistory]);

    const undo = useCallback(() => {
        const idx = historyIndexRef.current; if (idx > 0) { const prev = historyRef.current[idx - 1]; setNodes(prev.nodes); setConnections(prev.connections); setGroups(prev.groups); setHistoryIndex(idx - 1); }
    }, []);

    const redo = useCallback(() => {
        const idx = historyIndexRef.current; if (idx < historyRef.current.length - 1) { const next = historyRef.current[idx + 1]; setNodes(next.nodes); setConnections(next.connections); setGroups(next.groups); setHistoryIndex(idx + 1); }
    }, []);

    const deleteNodes = useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        saveHistory();
        setNodes(p => p.filter(n => !ids.includes(n.id)).map(n => ({ ...n, inputs: n.inputs.filter(i => !ids.includes(i)) })));
        setConnections(p => p.filter(c => !ids.includes(c.from) && !ids.includes(c.to)));
        setGroups(previous => previous
            .map(group => group.nodeIds ? { ...group, nodeIds: group.nodeIds.filter(id => !ids.includes(id)) } : group)
            .filter(group => !group.nodeIds || group.nodeIds.length > 0)
        );
        setSelectedNodeIds([]);
    }, [saveHistory]);

    const deleteConnection = useCallback((from: string, to: string) => {
        saveHistory();
        setConnections(previous => previous.filter(connection => connection.from !== from || connection.to !== to));
        setNodes(previous => previous.map(node => (
            node.id === to
                ? { ...node, inputs: node.inputs.filter(inputId => inputId !== from) }
                : node
        )));
        setContextMenu(null);
    }, [saveHistory]);

    const addNode = useCallback((type: NodeType, x?: number, y?: number, initialData?: any) => {
        if (type === NodeType.IMAGE_EDITOR) {
            setIsSketchEditorOpen(true);
            return undefined;
        }

        try { saveHistory(); } catch (e) { }

        const defaults: any = {
            model: type === NodeType.VIDEO_GENERATOR ? 'seedance-2.0' :
                type === NodeType.VIDEO_ANALYZER ? 'gemini-3-pro-preview' :
                    type === NodeType.AUDIO_GENERATOR ? 'gemini-2.5-flash-preview-tts' :
                        type === NodeType.PROMPT_INPUT ? 'gemini-3.1-flash-lite-preview' :
                            type.includes('IMAGE') ? 'gemini-3.1-flash-image-preview' :
                                'gemini-3-pro-preview',
            generationMode: type === NodeType.VIDEO_GENERATOR ? 'DEFAULT' : undefined, // Initialize as DEFAULT (Off)
            aspectRatio: initialData?.aspectRatio,
            resolution: type === NodeType.IMAGE_GENERATOR ? '2K' : type === NodeType.VIDEO_GENERATOR ? '1080p' : initialData?.resolution,
            duration: type === NodeType.VIDEO_GENERATOR ? 5 : initialData?.duration,
            generateAudio: type === NodeType.VIDEO_GENERATOR ? true : initialData?.generateAudio,
            imageCount: type === NodeType.IMAGE_GENERATOR ? 1 : initialData?.imageCount,
            textMode: type === NodeType.PROMPT_INPUT ? 'launcher' : undefined,
            storyboardAspectRatio: initialData?.storyboardAspectRatio || '2:3',
            storyboardGridSize: initialData?.storyboardGridSize || '3x3',
            ...initialData
        };

        const typeMap: Record<string, string> = {
            [NodeType.PROMPT_INPUT]: '创意描述',
            [NodeType.IMAGE_GENERATOR]: '文字生图',
            [NodeType.VIDEO_GENERATOR]: '文生视频',
            [NodeType.AUDIO_GENERATOR]: '灵感音乐',
            [NodeType.VIDEO_ANALYZER]: '视频分析',
            [NodeType.IMAGE_EDITOR]: '图像编辑',
            [NodeType.STORYBOARD_GRID]: '分镜格子'
        };

        const safeX = x !== undefined ? x : (-pan.x + window.innerWidth / 2) / scale - 210;
        const safeY = y !== undefined ? y : (-pan.y + window.innerHeight / 2) / scale - 180;

        const newNode: AppNode = {
            id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type,
            x: isNaN(safeX) ? 100 : safeX,
            y: isNaN(safeY) ? 100 : safeY,
            width: 420,
            title: typeMap[type] || '未命名节点',
            status: NodeStatus.IDLE,
            data: defaults,
            inputs: []
        };

        setNodes(prev => [...prev, newNode]);
        return newNode.id;
    }, [pan, scale, saveHistory]);

    const addReferencedNode = useCallback((type: NodeType) => {
        if (!contextMenu) return;
        const sourceNodeId = contextMenuTarget?.sourceNodeId;
        const initialData =
            type === NodeType.VIDEO_GENERATOR
                ? { generationMode: 'CONTINUE' }
                : undefined;
        const newNodeId = addNode(type, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale, initialData);

        if (sourceNodeId && newNodeId) {
            setConnections(prev => [...prev, { from: sourceNodeId, to: newNodeId }]);
            setNodes(prev => prev.map(n => n.id === newNodeId ? { ...n, inputs: [...n.inputs, sourceNodeId] } : n));
        }

        setContextMenu(null);
    }, [addNode, contextMenu, contextMenuTarget, pan, scale]);

    const handleTextQuickAction = useCallback((nodeId: string, action: 'write' | 'upload' | 'text-to-video' | 'image-to-prompt') => {
        if (action === 'write' || action === 'upload') return;
        const sourceNode = nodesRef.current.find(node => node.id === nodeId);
        if (!sourceNode) return;

        const sourceWidth = sourceNode.width || 420;
        if (action === 'text-to-video') {
            const newNodeId = addNode(
                NodeType.VIDEO_GENERATOR,
                sourceNode.x + sourceWidth + 150,
                sourceNode.y,
                { generationMode: 'DEFAULT' }
            );
            if (!newNodeId) return;
            setConnections(previous => [...previous, { from: nodeId, to: newNodeId }]);
            setNodes(previous => previous.map(node => (
                node.id === newNodeId
                    ? { ...node, inputs: node.inputs.includes(nodeId) ? node.inputs : [...node.inputs, nodeId] }
                    : node
            )));
            setSelectedNodeIds([newNodeId]);
            return;
        }

        const newNodeId = addNode(
            NodeType.IMAGE_GENERATOR,
            sourceNode.x - 420 - 150,
            sourceNode.y
        );
        if (!newNodeId) return;
        setConnections(previous => [...previous, { from: newNodeId, to: nodeId }]);
        setNodes(previous => previous.map(node => (
            node.id === nodeId
                ? {
                    ...node,
                    data: { ...node.data, textMode: 'editor', error: undefined },
                    inputs: node.inputs.includes(newNodeId) ? node.inputs : [...node.inputs, newNodeId],
                }
                : node
        )));
        setSelectedNodeIds([newNodeId]);
    }, [addNode]);

    const handleFocusNode = useCallback((nodeId: string) => {
        const targetNode = nodesRef.current.find(node => node.id === nodeId);
        const canvas = canvasRef.current;
        if (!targetNode || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const width = targetNode.width || 420;
        const height = targetNode.height || getApproxNodeHeight(targetNode);
        const nextScale = Math.min(1.4, Math.max(scaleRef.current, 1.2));
        const nextPan = {
            x: rect.width / 2 - (targetNode.x + width / 2) * nextScale,
            y: rect.height / 2 - (targetNode.y + height / 2) * nextScale,
        };

        setSelectedNodeIds([nodeId]);
        setIsViewportAnimating(true);
        scaleRef.current = nextScale;
        panRef.current = nextPan;
        setScale(nextScale);
        setPan(nextPan);
        window.setTimeout(() => setIsViewportAnimating(false), 320);
    }, []);

    const persistAssetHistory = useCallback((updater: (current: any[]) => any[]) => {
        setAssetHistory(current => {
            const next = updater(current);
            if (next !== current) {
                saveToStorage('assets', next).catch(error => console.error('Failed to persist assets', error));
            }
            return next;
        });
    }, []);

    const handleAssetGenerated = useCallback((type: 'image' | 'video' | 'audio', src: string, title: string) => {
        if (!src) return;
        persistAssetHistory(h => {
            const exists = h.find(a => a.src === src);
            if (exists) return h;
            return [{ id: `a-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type, src, title, timestamp: Date.now() }, ...h];
        });
    }, [persistAssetHistory]);

    const handleAssetsGenerated = useCallback((type: 'image' | 'video' | 'audio', srcs: string[], title: string) => {
        const cleanSrcs = srcs.filter(Boolean);
        if (cleanSrcs.length === 0) return;
        persistAssetHistory(h => {
            const existing = new Set(h.map(a => a.src));
            const timestamp = Date.now();
            const additions = cleanSrcs
                .filter(src => !existing.has(src))
                .map((src, index) => ({
                    id: `a-${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`,
                    type,
                    src,
                    title: cleanSrcs.length > 1 ? `${title} #${index + 1}` : title,
                    timestamp: timestamp + index
                }));
            return additions.length > 0 ? [...additions, ...h] : h;
        });
    }, [persistAssetHistory]);

    const handleSketchResult = (type: 'image' | 'video', result: string, prompt: string) => {
        const centerX = (-pan.x + window.innerWidth / 2) / scale - 210;
        const centerY = (-pan.y + window.innerHeight / 2) / scale - 180;

        if (type === 'image') {
            addNode(NodeType.IMAGE_GENERATOR, centerX, centerY, { image: result, prompt, status: NodeStatus.SUCCESS });
        } else {
            addNode(NodeType.VIDEO_GENERATOR, centerX, centerY, { videoUri: result, prompt, status: NodeStatus.SUCCESS });
        }

        handleAssetGenerated(type, result, prompt || 'Sketch Output');
    };

    const handleDeleteAsset = useCallback((id: string) => {
        persistAssetHistory(current => current.filter(a => a.id !== id));
    }, [persistAssetHistory]);

    const handleBatchDeleteAssets = useCallback((ids: string[]) => {
        const idSet = new Set(ids);
        persistAssetHistory(current => current.filter(a => !idSet.has(a.id)));
    }, [persistAssetHistory]);

    const handleMultiFrameGenerate = async (frames: SmartSequenceItem[]): Promise<string> => {
        const complexPrompt = compileMultiFramePrompt(frames as any[]);

        try {
            const res = await generateVideo(
                complexPrompt,
                'veo-3.1-generate-preview',
                { aspectRatio: '16:9', count: 1 },
                frames[0].src,
                null,
                frames.length > 1 ? frames.map(f => f.src) : undefined
            );

            if (res.isFallbackImage) {
                handleAssetGenerated('image', res.uri, 'Smart Sequence Preview (Fallback)');
            } else {
                handleAssetGenerated('video', res.uri, 'Smart Sequence');
            }
            return res.uri;
        } catch (e: any) {
            throw new Error(e.message || "Smart Sequence Generation Failed");
        }
    };

    const zoomCanvasAtPoint = useCallback((deltaY: number, clientX: number, clientY: number, zoomIntensity: number) => {
        const currentScale = scaleRef.current;
        const newScale = Math.min(Math.max(0.2, currentScale - deltaY * zoomIntensity * currentScale), 3);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || newScale === currentScale) return;

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const scaleDiff = newScale - currentScale;

        setPan(p => {
            const nextPan = {
                x: p.x - (x - p.x) * (scaleDiff / currentScale),
                y: p.y - (y - p.y) * (scaleDiff / currentScale)
            };
            panRef.current = nextPan;
            return nextPan;
        });
        scaleRef.current = newScale;
        setScale(newScale);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleNativeWheel = (event: WheelEvent) => {
            if (!canvas.contains(event.target as Node)) return;

            const shouldZoom = interactionModeRef.current === 'comfyui' || event.ctrlKey || event.metaKey;
            if (!shouldZoom) return;

            event.preventDefault();
            event.stopPropagation();
            zoomCanvasAtPoint(event.deltaY, event.clientX, event.clientY, interactionModeRef.current === 'comfyui' ? 0.0015 : 0.001);
        };

        canvas.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
        return () => canvas.removeEventListener('wheel', handleNativeWheel, { capture: true });
    }, [zoomCanvasAtPoint]);

    const isTargetInAssistant = (target: EventTarget | null) => {
        if (!target) return false;
        const el = target as HTMLElement;
        return Boolean(el.closest?.('.assistant-panel-container') || el.closest?.('.floating-assistant-btn'));
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (isTargetInAssistant(e.target)) return;

        if (interactionMode === 'comfyui') {
            e.preventDefault();
            // ComfyUI 模式：鼠标滚轮直接进行画布缩放
            zoomCanvasAtPoint(e.deltaY, e.clientX, e.clientY, 0.0015);
        } else {
            // 默认模式：Ctrl + 滚轮进行缩放，普通滚轮进行平移
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                zoomCanvasAtPoint(e.deltaY, e.clientX, e.clientY, 0.001);
            } else {
                setPan(p => {
                    const nextPan = { x: p.x - e.deltaX, y: p.y - e.deltaY };
                    panRef.current = nextPan;
                    return nextPan;
                });
            }
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (isTargetInAssistant(e.target)) return;

        if (contextMenu) setContextMenu(null);
        setSelectedGroupId(null);
        
        // 默认左键选择（且未按下 Shift 与 Space）
        const isSpacePressed = document.body.classList.contains('cursor-grab-override');
        if (e.button === 0 && !e.shiftKey && !isSpacePressed) {
            if (e.detail > 1) { e.preventDefault(); return; }
            setSelectedNodeIds([]);
            setSelectionRect({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
        }
        
        // 判断平移画布：
        // 1. 中键平移 (button === 1)
        // 2. 空格 + 左键平移 (Space + button === 0)
        // 3. 默认模式下：Shift + 左键平移 (Shift + button === 0)
        // 4. ComfyUI 模式下：右键平移 (button === 2)
        const isMiddleClick = e.button === 1;
        const isSpaceDrag = isSpacePressed && e.button === 0;
        const isDefaultShiftDrag = interactionMode === 'default' && e.button === 0 && e.shiftKey;
        const isComfyRightDrag = interactionMode === 'comfyui' && e.button === 2;

        if (isMiddleClick || isSpaceDrag || isDefaultShiftDrag || isComfyRightDrag) {
            setIsDraggingCanvas(true);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            if (e.button === 2) {
                e.preventDefault();
            }
        }
    };

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (
            !selectionRect &&
            !dragGroupRef.current &&
            !isDraggingCanvas &&
            !draggingNodeId &&
            !resizingNodeId &&
            !connectionStartRef.current
        ) {
            return;
        }
        const { clientX, clientY } = e;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (connectionStartRef.current) setMousePos({ x: clientX, y: clientY });

            if (selectionRect) { setSelectionRect((prev: any) => prev ? ({ ...prev, currentX: clientX, currentY: clientY }) : null); return; }

            if (dragGroupRef.current) {
                const { id, startX, startY, mouseStartX, mouseStartY, childNodes, childNodeStartById } = dragGroupRef.current;
                const dx = (clientX - mouseStartX) / scale;
                const dy = (clientY - mouseStartY) / scale;
                setGroups(prev => prev.map(g => g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g));
                if (childNodes.length > 0) {
                    setNodes(prev => prev.map(n => {
                        const child = childNodeStartById.get(n.id);
                        return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n;
                    }));
                }
                return;
            }

            if (isDraggingCanvas) {
                const dx = clientX - lastMousePosRef.current.x;
                const dy = clientY - lastMousePosRef.current.y;
                setPan(p => ({ x: p.x + dx, y: p.y + dy }));
                lastMousePosRef.current = { x: clientX, y: clientY };
            }

            if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.id === draggingNodeId) {
                const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight, draggedNodeStartById, draggedNodeElements } = dragNodeRef.current;
                let dx = (clientX - mouseStartX) / scale;
                let dy = (clientY - mouseStartY) / scale;
                let proposedX = startX + dx;
                let proposedY = startY + dy;
                const isDraggingSelection = draggedNodeStartById.size > 1;

                // Snap Logic
                const SNAP = SNAP_THRESHOLD / scale;
                const myL = proposedX; const myC = proposedX + nodeWidth / 2; const myR = proposedX + nodeWidth;
                const myT = proposedY; const myM = proposedY + nodeHeight / 2; const myB = proposedY + nodeHeight;
                let snappedX = false; let snappedY = false;

                if (!isDraggingSelection && nodesRef.current.length <= 80) {
                    nodesRef.current.forEach(other => {
                        if (other.id === draggingNodeId) return;
                        const otherBounds = getNodeBounds(other);
                        if (!snappedX) {
                            if (Math.abs(myL - otherBounds.x) < SNAP) { proposedX = otherBounds.x; snappedX = true; }
                            else if (Math.abs(myL - otherBounds.r) < SNAP) { proposedX = otherBounds.r; snappedX = true; }
                            else if (Math.abs(myR - otherBounds.x) < SNAP) { proposedX = otherBounds.x - nodeWidth; snappedX = true; }
                            else if (Math.abs(myR - otherBounds.r) < SNAP) { proposedX = otherBounds.r - nodeWidth; snappedX = true; }
                            else if (Math.abs(myC - (otherBounds.x + otherBounds.width / 2)) < SNAP) { proposedX = (otherBounds.x + otherBounds.width / 2) - nodeWidth / 2; snappedX = true; }
                        }
                        if (!snappedY) {
                            if (Math.abs(myT - otherBounds.y) < SNAP) { proposedY = otherBounds.y; snappedY = true; }
                            else if (Math.abs(myT - otherBounds.b) < SNAP) { proposedY = otherBounds.b; snappedY = true; }
                            else if (Math.abs(myB - otherBounds.y) < SNAP) { proposedY = otherBounds.y - nodeHeight; snappedY = true; }
                            else if (Math.abs(myB - otherBounds.b) < SNAP) { proposedY = otherBounds.b - nodeHeight; snappedY = true; }
                            else if (Math.abs(myM - (otherBounds.y + otherBounds.height / 2)) < SNAP) { proposedY = (otherBounds.y + otherBounds.height / 2) - nodeHeight / 2; snappedY = true; }
                        }
                    });
                }

                const nextPreview = {
                    nodeIds: Array.from(draggedNodeStartById.keys()),
                    dx: isDraggingSelection ? dx : proposedX - startX,
                    dy: isDraggingSelection ? dy : proposedY - startY,
                };
                dragPreviewRef.current = nextPreview;
                const transform = `translate3d(${nextPreview.dx}px, ${nextPreview.dy}px, 0)`;
                draggedNodeElements.forEach(({ element }) => {
                    element.style.transform = transform;
                });

            } else if (draggingNodeId) {
                const dx = (clientX - lastMousePosRef.current.x) / scale;
                const dy = (clientY - lastMousePosRef.current.y) / scale;
                const nextPreview = {
                    nodeIds: [draggingNodeId],
                    dx,
                    dy,
                };
                dragPreviewRef.current = nextPreview;
                const draggedElement = canvasRef.current?.querySelector<HTMLElement>(`[data-canvas-node-id="${draggingNodeId}"]`);
                if (draggedElement) draggedElement.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                lastMousePosRef.current = { x: clientX, y: clientY };
            }

            if (resizingNodeId && initialSize && resizeStartPos) {
                const dx = (clientX - resizeStartPos.x) / scale; const dy = (clientY - resizeStartPos.y) / scale;
                setNodes(prev => prev.map(n => n.id === resizingNodeId ? { ...n, width: Math.max(360, initialSize.width + dx), height: Math.max(240, initialSize.height + dy) } : n));
            }
        });
    }, [selectionRect, isDraggingCanvas, draggingNodeId, resizingNodeId, initialSize, resizeStartPos, scale]);

    const handleGlobalMouseUp = useCallback((e?: MouseEvent) => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        const pendingConnection = connectionStartRef.current;
        if (pendingConnection && e) {
            const sourceNode = nodesRef.current.find(n => n.id === pendingConnection.id);
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: pendingConnection.id });
            setContextMenuTarget({ type: 'reference-create', sourceNodeId: pendingConnection.id, sourceNodeType: sourceNode?.type });
        }
        if (selectionRect) {
            const x = Math.min(selectionRect.startX, selectionRect.currentX); const y = Math.min(selectionRect.startY, selectionRect.currentY);
            const w = Math.abs(selectionRect.currentX - selectionRect.startX); const h = Math.abs(selectionRect.currentY - selectionRect.startY);
            if (w > 10) {
                const rect = { x: (x - pan.x) / scale, y: (y - pan.y) / scale, w: w / scale, h: h / scale };
                const enclosed = nodesRef.current.filter(n => { const cx = n.x + (n.width || 420) / 2; const cy = n.y + 160; return cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h; });
                if (enclosed.length > 0) {
                    setSelectedNodeIds(enclosed.map(node => node.id));
                    setSelectedGroupId(null);
                }
            }
            setSelectionRect(null);
        }

        const preview = dragPreviewRef.current;
        const dragContext = dragNodeRef.current;
        const draggedNodeElements = dragContext?.draggedNodeElements;
        const committedPreviewDrag = Boolean(preview && dragContext);
        if (preview && dragContext) {
            setNodes(prev => prev.map(node => {
                const start = dragContext.draggedNodeStartById.get(node.id);
                return start ? { ...node, x: start.startX + preview.dx, y: start.startY + preview.dy } : node;
            }));
            dragPreviewRef.current = null;
        }

        if (draggedNodeElements) {
            requestAnimationFrame(() => {
                draggedNodeElements.forEach(({ element, transition, willChange, backdropFilter, boxShadow }) => {
                    element.style.transform = '';
                    element.style.transition = transition;
                    element.style.willChange = willChange;
                    element.style.backdropFilter = backdropFilter;
                    element.style.boxShadow = boxShadow;
                });
            });
        }

        // Collision logic for dropped node
        if (draggingNodeId && !committedPreviewDrag) {
            const draggedNode = nodesRef.current.find(n => n.id === draggingNodeId);
            if (draggedNode) {
                const myBounds = getNodeBounds(draggedNode);
                const otherNodes = nodesRef.current.filter(n => n.id !== draggingNodeId);
                let resolvedX = draggedNode.x;
                let resolvedY = draggedNode.y;

                // Simple Iterative Solver for Collision
                // We check against all nodes. If we collide, we move out the shortest distance.
                // To handle multiple collisions, a physics engine iterates this, but for UI, one pass usually suffices 
                // or we check the 'closest' collision. Here we iterate all to clear overlaps.

                for (const other of otherNodes) {
                    const otherBounds = getNodeBounds(other);

                    // AABB Collision Check
                    const isOverlapping = (
                        myBounds.x < otherBounds.r &&
                        myBounds.r > otherBounds.x &&
                        myBounds.y < otherBounds.b &&
                        myBounds.b > otherBounds.y
                    );

                    if (isOverlapping) {
                        // Calculate overlap amounts on all 4 sides
                        const overlapLeft = myBounds.r - otherBounds.x;
                        const overlapRight = otherBounds.r - myBounds.x;
                        const overlapTop = myBounds.b - otherBounds.y;
                        const overlapBottom = otherBounds.b - myBounds.y;

                        // Find the smallest overlap (shortest path to separate)
                        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                        if (minOverlap === overlapLeft) {
                            resolvedX = otherBounds.x - myBounds.width - COLLISION_PADDING;
                        } else if (minOverlap === overlapRight) {
                            resolvedX = otherBounds.r + COLLISION_PADDING;
                        } else if (minOverlap === overlapTop) {
                            resolvedY = otherBounds.y - myBounds.height - COLLISION_PADDING;
                        } else if (minOverlap === overlapBottom) {
                            resolvedY = otherBounds.b + COLLISION_PADDING;
                        }

                        // Update temporary bounds for next iteration in loop
                        myBounds.x = resolvedX;
                        myBounds.y = resolvedY;
                        myBounds.r = resolvedX + myBounds.width;
                        myBounds.b = resolvedY + myBounds.height;
                    }
                }

                // Update State
                setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: resolvedX, y: resolvedY } : n));
            }
        }

        if (draggingNodeId || resizingNodeId || dragGroupRef.current) saveHistory();
        connectionStartRef.current = null;
        setIsDraggingCanvas(false); setDraggingNodeId(null); setDraggingNodeParentGroupId(null); setDraggingGroup(null); setResizingGroupId(null); setActiveGroupNodeIds([]); setResizingNodeId(null); setInitialSize(null); setResizeStartPos(null); setConnectionStart(null);
        dragNodeRef.current = null; resizeContextRef.current = null; dragGroupRef.current = null;
    }, [selectionRect, pan, scale, saveHistory, draggingNodeId, resizingNodeId]);

    useEffect(() => { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); }; }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    const clearConnectionInteraction = useCallback(() => {
        connectionStartRef.current = null;
        setConnectionStart(null);
        window.getSelection()?.removeAllRanges();
    }, []);

    useEffect(() => {
        if (!connectionStart) return;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        document.documentElement.classList.add('xc-connecting');
        window.getSelection()?.removeAllRanges();
        const handleBlur = () => clearConnectionInteraction();
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') clearConnectionInteraction();
        };
        window.addEventListener('blur', handleBlur);
        window.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.userSelect = previousUserSelect;
            document.documentElement.classList.remove('xc-connecting');
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [connectionStart, clearConnectionInteraction]);

    const handleNodeUpdate = useCallback((id: string, data: any, size?: any, title?: string) => {
        setNodes(prev => prev.map(n => {
            if (n.id === id) {
                const imageChanged = typeof data.image === 'string' && data.image !== n.data.image;
                const updated = {
                    ...n,
                    data: {
                        ...n.data,
                        ...data,
                        ...(imageChanged ? { imagePreview: undefined, imagePreviewSource: undefined } : {}),
                    },
                    title: title || n.title
                };
                if (size) { if (size.width) updated.width = size.width; if (size.height) updated.height = size.height; }

                if (data.images?.length) {
                    handleAssetsGenerated('image', data.images, updated.title);
                } else if (data.image) {
                    handleAssetGenerated('image', data.image, updated.title);
                }

                if (data.videoUris?.length) {
                    handleAssetsGenerated('video', data.videoUris, updated.title);
                } else if (data.videoUri) {
                    handleAssetGenerated('video', data.videoUri, updated.title);
                }

                if (data.videoUri) {
                    // Auto-Save Video Project
                    saveGeneratedProject({
                        type: 'VIDEO',
                        generated: [data.videoUri],
                        prompt: n.data.prompt || updated.title,
                        params: { source: 'xc-workstation', nodeType: n.type }
                    });
                }
                if (data.audioUri) handleAssetGenerated('audio', data.audioUri, updated.title);

                return updated;
            }
            return n;
        }));
    }, [handleAssetGenerated, handleAssetsGenerated]);

    const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        const targetId = replacementTargetRef.current;
        if (file && targetId) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                if (type === 'image') handleNodeUpdate(targetId, { image: result });
                else handleNodeUpdate(targetId, { videoUri: result });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; setContextMenu(null); replacementTargetRef.current = null;
    };

    const handleComposeStoryboard = useCallback(async (sourceNode: AppNode) => {
        const storyboardAspectRatio = sourceNode.data.storyboardAspectRatio || '2:3';
        const storyboardGridSize = sourceNode.data.storyboardGridSize || '3x3';
        const cells = sourceNode.data.storyboardCells || [];

        const [rw, rh] = storyboardAspectRatio.split(':').map(Number);
        const r = (rw && rh) ? (rw / rh) : (2 / 3);
        const cols = parseInt(storyboardGridSize.split('x')[0]) || 3;
        const rows = parseInt(storyboardGridSize.split('x')[1]) || 3;

        const cellWidth = 600;
        const cellHeight = Math.round(cellWidth / r);

        const canvas = document.createElement('canvas');
        canvas.width = cols * cellWidth;
        canvas.height = rows * cellHeight;
        const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });

        if (!ctx) return;

        ctx.fillStyle = '#1c1c1f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const loadAndDrawImage = (src: string, dx: number, dy: number, dw: number, dh: number) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const imgRatio = img.width / img.height;
                    const targetRatio = dw / dh;
                    let sx = 0, sy = 0, sw = img.width, sh = img.height;
                    if (imgRatio > targetRatio) {
                        sw = img.height * targetRatio;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / targetRatio;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = src;
            });
        };

        const drawPromises: Promise<void>[] = [];

        for (let rIdx = 0; rIdx < rows; rIdx++) {
            for (let cIdx = 0; cIdx < cols; cIdx++) {
                const cellIdx = rIdx * cols + cIdx;
                const x = cIdx * cellWidth;
                const y = rIdx * cellHeight;
                const cell = cells[cellIdx];

                if (cell?.image) {
                    drawPromises.push(loadAndDrawImage(cell.image, x, y, cellWidth, cellHeight));
                } else {
                    ctx.fillStyle = '#262629';
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x + cellWidth / 2 - 20, y + cellHeight / 2);
                    ctx.lineTo(x + cellWidth / 2 + 20, y + cellHeight / 2);
                    ctx.moveTo(x + cellWidth / 2, y + cellHeight / 2 - 20);
                    ctx.lineTo(x + cellWidth / 2, y + cellHeight / 2 + 20);
                    ctx.stroke();
                }

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, cellWidth, cellHeight);
            }
        }

        await Promise.all(drawPromises);

        const composedDataUrl = canvas.toDataURL('image/png');
        const targetX = sourceNode.x + (sourceNode.width || 560) + 80;
        const targetY = sourceNode.y;

        const composedNode: AppNode = {
            id: `node-composed-${Date.now()}`,
            type: NodeType.IMAGE_GENERATOR,
            title: '合成',
            x: targetX,
            y: targetY,
            width: 420,
            status: NodeStatus.SUCCESS,
            data: {
                image: composedDataUrl,
                aspectRatio: storyboardAspectRatio,
                model: 'gemini-3.1-flash-image-preview',
                generationMode: 'DEFAULT',
                prompt: `分镜合成图像 (${storyboardGridSize})`
            },
            inputs: [sourceNode.id]
        };

        setNodes(prev => [...prev, composedNode]);
        setConnections(prev => [...prev, { id: `c-${sourceNode.id}-${composedNode.id}`, from: sourceNode.id, to: composedNode.id }]);
        handleAssetGenerated('image', composedDataUrl, '合成');
    }, [handleAssetGenerated]);

    const handleStoryboardOption = useCallback(async (sourceNodeId: string, optionType: StoryboardOptionType) => {
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        // 1. 获取/检测原图节点的比例尺寸
        let detectedAspectRatio = sourceNode.data.aspectRatio || '2:3';
        if (!sourceNode.data.aspectRatio && sourceNode.data.image) {
            try {
                const img = new Image();
                img.src = sourceNode.data.image;
                if (img.naturalWidth && img.naturalHeight) {
                    const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
                    const r = img.naturalWidth / img.naturalHeight;
                    let minDiff = Infinity;
                    ratios.forEach(ratio => {
                        const [w, h] = ratio.split(':').map(Number);
                        const targetR = w / h;
                        const diff = Math.abs(r - targetR);
                        if (diff < minDiff) {
                            minDiff = diff;
                            detectedAspectRatio = ratio;
                        }
                    });
                }
            } catch { }
        }

        // 2. 根据所选功能确定网格规格与标题
        let gridSize = '3x3';
        let optionTitle = '分镜大师';
        if (optionType === 'MODEL_SCENE_FISSION') {
            gridSize = '3x3';
            optionTitle = '模特场景图裂变';
        } else if (optionType === 'MULTI_ANGLE_9GRID') {
            gridSize = '3x3';
            optionTitle = '多机位九宫格';
        } else if (optionType === 'STORY_DEDUCTION_4GRID') {
            gridSize = '2x2';
            optionTitle = '剧情推演四宫格';
        } else if (optionType === 'CONTINUOUS_25GRID') {
            gridSize = '5x5';
            optionTitle = '25宫格连贯分镜';
        }

        const cols = parseInt(gridSize.split('x')[0]) || 3;
        const rows = parseInt(gridSize.split('x')[1]) || 3;
        const totalCells = cols * rows;

        const targetX = sourceNode.x + (sourceNode.width || 420) + 80;
        const targetY = sourceNode.y;
        const gridNodeId = `node-storyboard-${Date.now()}`;

        // 3. 实例化分镜格子节点，自动设定为对应原图的比例尺寸
        const gridNode: AppNode = {
            id: gridNodeId,
            type: NodeType.STORYBOARD_GRID,
            title: optionTitle,
            x: targetX,
            y: targetY,
            width: optionType === 'CONTINUOUS_25GRID' ? 640 : 560,
            status: NodeStatus.WORKING,
            data: {
                storyboardAspectRatio: detectedAspectRatio,
                storyboardGridSize: gridSize,
                storyboardCells: Array.from({ length: totalCells }).map((_, i) => ({
                    id: `cell-placeholder-${i + 1}`,
                    prompt: `${optionTitle} 镜头 ${i + 1}`,
                })),
                prompt: `${optionTitle} (${gridSize})`,
            },
            inputs: [sourceNodeId],
        };

        // 4. 自动建立连线与更新看板
        setNodes(prev => [...prev, gridNode]);
        setConnections(prev => [...prev, { id: `c-${sourceNodeId}-${gridNodeId}`, from: sourceNodeId, to: gridNodeId }]);

        // 5. 异步调用 AI 批量生成镜头画面填入分镜单元
        try {
            const sourceImg = sourceNode.data.image || '';
            const generatedCells = await generateStoryboardGridImages(
                sourceImg,
                optionType,
                detectedAspectRatio
            );

            handleNodeUpdate(
                gridNodeId,
                {
                    storyboardCells: generatedCells,
                }
            );
            setNodes(prev => prev.map(n => n.id === gridNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
        } catch (err: any) {
            console.error("Storyboard grid generation error:", err);
            handleNodeUpdate(gridNodeId, { error: err?.message || '分镜格子生成失败' });
            setNodes(prev => prev.map(n => n.id === gridNodeId ? { ...n, status: NodeStatus.ERROR } : n));
        }
    }, [handleNodeUpdate]);

    const handleGridCropOption = useCallback(async (sourceNodeId: string, config: GridCropConfig) => {
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (!sourceNode || !sourceNode.data.image) return;

        const sourceImage = sourceNode.data.image;
        const rows = config.rows || 2;
        const cols = config.cols || 2;

        // 1. 检测原图节点的比例尺寸
        let detectedAspectRatio = sourceNode.data.aspectRatio || '2:3';
        if (!sourceNode.data.aspectRatio) {
            try {
                const img = new Image();
                img.src = sourceImage;
                if (img.naturalWidth && img.naturalHeight) {
                    const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
                    const r = img.naturalWidth / img.naturalHeight;
                    let minDiff = Infinity;
                    ratios.forEach(ratio => {
                        const [w, h] = ratio.split(':').map(Number);
                        const targetR = w / h;
                        const diff = Math.abs(r - targetR);
                        if (diff < minDiff) {
                            minDiff = diff;
                            detectedAspectRatio = ratio;
                        }
                    });
                }
            } catch { }
        }

        // 2. 切割整图成 rows x cols 张局部图片
        const slicedCells: string[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellUrl = await cropGridCellCanvas(sourceImage, r, c, rows, cols);
                slicedCells.push(cellUrl);
            }
        }

        // 模式 A：创建分镜格子节点 (自动填充到分镜节点)
        if (config.mode === 'storyboard') {
            const gridSizeStr = `${cols}x${rows}`;
            const targetX = sourceNode.x + (sourceNode.width || 420) + 80;
            const targetY = sourceNode.y;
            const gridNodeId = `node-gridcrop-sb-${Date.now()}`;

            const gridNode: AppNode = {
                id: gridNodeId,
                type: NodeType.STORYBOARD_GRID,
                title: config.title || `${cols}×${rows} 宫格分镜`,
                x: targetX,
                y: targetY,
                width: cols >= 5 ? 640 : 560,
                status: NodeStatus.SUCCESS,
                data: {
                    storyboardAspectRatio: detectedAspectRatio,
                    storyboardGridSize: gridSizeStr,
                    storyboardCells: slicedCells.map((img, idx) => ({
                        id: `cell-crop-${Date.now()}-${idx + 1}`,
                        image: img,
                        prompt: `${config.title || '宫格裁剪'} 单元 ${idx + 1}`,
                    })),
                    prompt: `${config.title || '宫格裁剪'} (${gridSizeStr})`,
                },
                inputs: [sourceNodeId],
            };

            setNodes(prev => [...prev, gridNode]);
            setConnections(prev => [...prev, { id: `c-${sourceNodeId}-${gridNodeId}`, from: sourceNodeId, to: gridNodeId }]);
            handleAssetGenerated('image', slicedCells[0], config.title || '宫格分镜');
        } else {
            // 模式 B：仅裁剪 (创建独立图片节点，单个单个放)
            const newNodes: AppNode[] = [];
            const newConnections: Connection[] = [];
            const childWidth = 320;
            const gapX = 30;
            const gapY = 30;
            const startX = sourceNode.x + (sourceNode.width || 420) + 80;
            const startY = sourceNode.y;

            slicedCells.forEach((cellImg, index) => {
                const r = Math.floor(index / cols);
                const c = index % cols;
                const posX = startX + c * (childWidth + gapX);
                const posY = startY + r * (360 + gapY);
                const newNodeId = `node-gridcrop-single-${Date.now()}-${index + 1}`;

                newNodes.push({
                    id: newNodeId,
                    type: NodeType.IMAGE_GENERATOR,
                    title: `${config.title || '宫格裁剪'} (${r + 1},${c + 1})`,
                    x: posX,
                    y: posY,
                    width: childWidth,
                    status: NodeStatus.SUCCESS,
                    data: {
                        image: cellImg,
                        aspectRatio: detectedAspectRatio,
                        prompt: `${config.title || '宫格局部'} (${r + 1},${c + 1})`,
                    },
                    inputs: [sourceNodeId],
                });

                newConnections.push({ id: `c-${sourceNodeId}-${newNodeId}`, from: sourceNodeId, to: newNodeId });
            });

            setNodes(prev => [...prev, ...newNodes]);
            setConnections(prev => [...prev, ...newConnections]);
            handleAssetGenerated('image', slicedCells[0], config.title || '宫格局部');
        }
    }, [handleAssetGenerated]);



    const handleNodeAction = useCallback(async (id: string, promptOverride?: string): Promise<boolean> => {
        const node = nodesRef.current.find(n => n.id === id); if (!node) return false;
        
        if (promptOverride === 'compose-storyboard' || node.type === NodeType.STORYBOARD_GRID) {
            await handleComposeStoryboard(node);
            setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
            return true;
        }

        handleNodeUpdate(id, { error: undefined });
        setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

        try {
            const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];

            const upstreamTexts = inputs.map(n => {
                if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
                if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
                return null;
            }).filter(t => t && t.trim().length > 0) as string[];

            let prompt = promptOverride || node.data.prompt || '';
            if (upstreamTexts.length > 0) {
                const combinedUpstream = upstreamTexts.join('\n');
                prompt = prompt ? `${combinedUpstream}\n${prompt}` : combinedUpstream;
            }

            if (node.type === NodeType.IMAGE_GENERATOR) {
                const inputImages: string[] = [];
                inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });

                const isStoryboard = /分镜|storyboard|sequence|shots|frames|json/i.test(prompt);

                if (isStoryboard) {
                    try {
                        const storyboard = await planStoryboard(prompt, upstreamTexts.join('\n'));
                        if (storyboard.length > 1) {
                            // ... (storyboard expansion logic preserved) ...
                            const newNodes: AppNode[] = [];
                            const newConnections: Connection[] = [];
                            const COLUMNS = 3;
                            const gapX = 40; const gapY = 40;
                            const childWidth = node.width || 420;
                            const ratio = node.data.aspectRatio || '16:9';
                            const [rw, rh] = ratio.split(':').map(Number);
                            const childHeight = (childWidth * rh / rw);
                            const startX = node.x + (node.width || 420) + 150;
                            const startY = node.y;
                            storyboard.forEach((shotPrompt, index) => {
                                const col = index % COLUMNS;
                                const row = Math.floor(index / COLUMNS);
                                const posX = startX + col * (childWidth + gapX);
                                const posY = startY + row * (childHeight + gapY);
                                const newNodeId = `n-${Date.now()}-${index}`;
                                newNodes.push({
                                    id: newNodeId, type: NodeType.IMAGE_GENERATOR, x: posX, y: posY, width: childWidth, height: childHeight,
                                    title: `分镜 ${index + 1}`, status: NodeStatus.WORKING,
                                    data: { ...node.data, aspectRatio: ratio, prompt: shotPrompt, image: undefined, images: undefined, imageCount: 1 },
                                    inputs: [node.id]
                                });
                                newConnections.push({ from: node.id, to: newNodeId });
                            });

                            const fittedStoryboardGroup = getGroupBoundsForNodes(newNodes);
                            if (fittedStoryboardGroup) {
                                setGroups(prev => [...prev, {
                                    id: `g-${Date.now()}`,
                                    title: '分镜生成组',
                                    ...fittedStoryboardGroup,
                                    nodeIds: newNodes.map(item => item.id),
                                }]);
                            }
                            setNodes(prev => [...prev, ...newNodes]);
                            setConnections(prev => [...prev, ...newConnections]);
                            handleNodeUpdate(id, { status: NodeStatus.SUCCESS });

                            newNodes.forEach(async (n) => {
                                try {
                                    const generationPrompt = buildImageGenerationPrompt(n, n.data.prompt || '', inputImages.length > 0);
                                    const res = await generateImageFromText(generationPrompt, n.data.model!, inputImages, { aspectRatio: n.data.aspectRatio, resolution: n.data.resolution, count: 1 });
                                    handleNodeUpdate(n.id, { image: res[0], images: res, status: NodeStatus.SUCCESS });
                                    await saveGeneratedProject({
                                        type: 'OTHER',
                                        generated: res,
                                        original: inputImages,
                                        prompt: generationPrompt,
                                        params: {
                                            source: 'xc-workstation',
                                            nodeType: n.type,
                                            model: n.data.model,
                                            aspectRatio: n.data.aspectRatio,
                                            resolution: n.data.resolution,
                                        }
                                    });
                                } catch (e: any) {
                                    handleNodeUpdate(n.id, { error: e.message, status: NodeStatus.ERROR });
                                }
                            });
                            return true;
                        }
                    } catch (e) {
                        console.warn("Storyboard planning failed", e);
                    }
                }
                const generationPrompt = buildImageGenerationPrompt(node, prompt, inputImages.length > 0);
                const res = await generateImageFromText(generationPrompt, node.data.model, inputImages, { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount });
                handleNodeUpdate(id, { image: res[0], images: res });
                await saveGeneratedProject({
                    type: 'OTHER',
                    generated: res,
                    original: inputImages,
                    prompt: generationPrompt,
                    params: {
                        source: 'xc-workstation',
                        nodeType: node.type,
                        model: node.data.model,
                        aspectRatio: node.data.aspectRatio,
                        resolution: node.data.resolution,
                    }
                });

            } else if (node.type === NodeType.VIDEO_GENERATOR) {
                const referenceImages = inputs.filter(input => input?.data.croppedFrame || input?.data.image);
                const referenceVideos = inputs.filter(input => input?.data.videoUri);
                const referenceAudios = inputs.filter(input => input?.data.audioUri);
                const mode = node.data.generationMode || 'DEFAULT';

                if (mode === 'CHARACTER_REF') {
                    if (referenceImages.length + referenceVideos.length + referenceAudios.length === 0) {
                        throw new Error('全能参考需要连接上游素材节点');
                    }
                    if (referenceImages.length > 9 || referenceVideos.length > 3 || referenceAudios.length > 3) {
                        throw new Error('全能参考最多支持 9 张图片、3 个视频和 3 个音频');
                    }
                }
                if (mode === 'CONTINUE' && (referenceImages.length !== 1 || referenceVideos.length > 0 || referenceAudios.length > 0)) {
                    throw new Error('首帧模式只能连接 1 个图片节点');
                }
                if (
                    mode === 'FIRST_LAST_FRAME' &&
                    (
                        referenceImages.length < 1 ||
                        referenceImages.length > 2 ||
                        referenceVideos.length > 0 ||
                        referenceAudios.length > 0
                    )
                ) {
                    throw new Error('首尾帧模式仅支持连接 1–2 张图片');
                }

                const strategy = await getGenerationStrategy(node, inputs, prompt);

                const res = await generateVideo(
                    strategy.finalPrompt,
                    node.data.model,
                    {
                        aspectRatio: node.data.aspectRatio,
                        count: node.data.videoCount || 1,
                        generationMode: strategy.generationMode,
                        resolution: node.data.resolution,
                        duration: node.data.duration || 5,
                        generateAudio: node.data.generateAudio !== false
                    },
                    strategy.inputImageForGeneration,
                    strategy.videoInput,
                    strategy.referenceImages,
                    strategy.referenceVideos,
                    strategy.referenceAudios
                );

                if (res.isFallbackImage) {
                    handleNodeUpdate(id, {
                        image: res.uri,
                        videoUri: undefined,
                        videoMetadata: undefined,
                        error: "Region restricted: Generated preview image instead.",
                        status: NodeStatus.SUCCESS
                    });
                    await saveGeneratedProject({
                        type: 'OTHER',
                        generated: [res.uri],
                        prompt: strategy.finalPrompt,
                        params: { source: 'xc-workstation', nodeType: node.type, fallbackFromVideo: true }
                    });
                } else {
                    handleNodeUpdate(id, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris });
                }

            } else if (node.type === NodeType.AUDIO_GENERATOR) {
                const audioUri = await generateAudio(prompt);
                handleNodeUpdate(id, { audioUri: audioUri });

            } else if (node.type === NodeType.VIDEO_ANALYZER) {
                const vid = node.data.videoUri || inputs.find(n => n?.data.videoUri)?.data.videoUri;
                if (!vid) throw new Error("未找到视频输入");
                let vidData = vid;
                if (vid.startsWith('http')) vidData = await urlToBase64(vid);
                const txt = await analyzeVideo(vidData, prompt, node.data.model);
                handleNodeUpdate(id, { analysis: txt });
            } else if (node.type === NodeType.IMAGE_EDITOR) {
                const inputImages: string[] = [];
                inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
                const img = node.data.image || inputImages[0];
                const res = await editImageWithText(img, prompt, node.data.model);
                handleNodeUpdate(id, { image: res });
                await saveGeneratedProject({
                    type: 'RETOUCHING',
                    generated: [res],
                    original: img ? [img] : [],
                    prompt,
                    params: { source: 'xc-workstation', nodeType: node.type, model: node.data.model }
                });
            }
            setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
            return true;
        } catch (e: any) {
            handleNodeUpdate(id, { error: e.message });
            setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
            return false;
        }
    }, [handleNodeUpdate]);

    const runGroupWorkflow = useCallback(async (groupId: string) => {
        if (runningGroupIds.has(groupId)) return;
        const group = groupsRef.current.find(item => item.id === groupId);
        if (!group) return;
        const memberIds = getGroupNodeIds(group);
        const memberIdSet = new Set(memberIds);
        const groupNodes = memberIds
            .map(id => nodesRef.current.find(node => node.id === id))
            .filter(Boolean) as AppNode[];
        if (groupNodes.length === 0) {
            setGroupRunMessages(previous => ({ ...previous, [groupId]: '分组内没有可运行节点' }));
            return;
        }

        const internalDependencies = new Map<string, Set<string>>();
        const dependents = new Map<string, Set<string>>();
        groupNodes.forEach(node => {
            internalDependencies.set(node.id, new Set(node.inputs.filter(id => memberIdSet.has(id))));
            dependents.set(node.id, new Set());
        });
        connectionsRef.current.forEach(connection => {
            if (!memberIdSet.has(connection.from) || !memberIdSet.has(connection.to)) return;
            internalDependencies.get(connection.to)?.add(connection.from);
        });
        internalDependencies.forEach((dependencies, nodeId) => {
            dependencies.forEach(dependencyId => dependents.get(dependencyId)?.add(nodeId));
        });

        const remaining = new Map(Array.from(internalDependencies, ([id, dependencies]) => [id, dependencies.size]));
        const levels: string[][] = [];
        let ready = groupNodes.filter(node => remaining.get(node.id) === 0).map(node => node.id);
        let processed = 0;
        while (ready.length > 0) {
            levels.push(ready);
            processed += ready.length;
            const next: string[] = [];
            ready.forEach(nodeId => {
                dependents.get(nodeId)?.forEach(dependentId => {
                    const count = (remaining.get(dependentId) || 0) - 1;
                    remaining.set(dependentId, count);
                    if (count === 0) next.push(dependentId);
                });
            });
            ready = next;
        }
        if (processed !== groupNodes.length) {
            setGroupRunMessages(previous => ({ ...previous, [groupId]: '工作流存在循环连接，请先调整连线' }));
            return;
        }

        setRunningGroupIds(previous => new Set(previous).add(groupId));
        setGroupRunMessages(previous => ({ ...previous, [groupId]: '正在启动工作流…' }));
        try {
            for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
                const runnableIds = levels[levelIndex].filter(nodeId => {
                    const node = nodesRef.current.find(item => item.id === nodeId);
                    if (!node || node.type === NodeType.PROMPT_INPUT) return false;
                    const hasInternalDependencies = (internalDependencies.get(nodeId)?.size || 0) > 0;
                    const hasExistingSource =
                        node.type === NodeType.IMAGE_GENERATOR ? Boolean(node.data.image) :
                        node.type === NodeType.VIDEO_GENERATOR ? Boolean(node.data.videoUri) :
                        node.type === NodeType.AUDIO_GENERATOR ? Boolean(node.data.audioUri) :
                        node.type === NodeType.VIDEO_ANALYZER ? Boolean(node.data.analysis) :
                        false;
                    return hasInternalDependencies || !hasExistingSource;
                });
                if (runnableIds.length === 0) continue;
                setGroupRunMessages(previous => ({
                    ...previous,
                    [groupId]: `正在运行第 ${levelIndex + 1}/${levels.length} 阶段（${runnableIds.length} 个节点）`,
                }));
                const results = await Promise.all(runnableIds.map(nodeId => handleNodeAction(nodeId)));
                if (results.some(result => !result)) {
                    throw new Error('部分节点执行失败，工作流已停止');
                }
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
            setGroupRunMessages(previous => ({ ...previous, [groupId]: '工作流运行完成' }));
        } catch (error: any) {
            setGroupRunMessages(previous => ({ ...previous, [groupId]: error?.message || '工作流运行失败' }));
        } finally {
            setRunningGroupIds(previous => {
                const next = new Set(previous);
                next.delete(groupId);
                return next;
            });
        }
    }, [getGroupNodeIds, handleNodeAction, runningGroupIds]);


    const saveCurrentAsWorkflow = () => {
        if (nodes.length === 0) return;
        const thumbnailNode = nodes.find(n => n.data.imagePreview || n.data.image);
        const thumbnail = thumbnailNode?.data.imagePreview || thumbnailNode?.data.image || '';
        const now = Date.now();
        const newWf: Workflow = {
            id: `wf-${now}`,
            title: `工作流 ${new Date(now).toLocaleDateString()}`,
            thumbnail,
            nodes: JSON.parse(JSON.stringify(nodes)),
            connections: JSON.parse(JSON.stringify(connections)),
            groups: JSON.parse(JSON.stringify(groups)),
            updatedAt: now,
        };
        setWorkflows(prev => [newWf, ...prev]);
    };

    const saveGroupAsWorkflow = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const explicitNodeIds = getGroupNodeIds(group, nodes);
        const explicitNodeIdSet = new Set(explicitNodeIds);
        const nodesInGroup = nodes.filter(node => explicitNodeIdSet.has(node.id));
        const nodeIds = new Set(nodesInGroup.map(n => n.id));
        const connectionsInGroup = connections.filter(c => nodeIds.has(c.from) && nodeIds.has(c.to));
        if (nodesInGroup.length === 0) return;
        const thumbNode = nodesInGroup.find(n => n.data.imagePreview || n.data.image);
        const thumbnail = thumbNode?.data.imagePreview || thumbNode?.data.image || '';
        const existingWorkflow = workflows.find(workflow => workflow.sourceGroupId === groupId);
        const now = Date.now();
        const newWf: Workflow = {
            id: existingWorkflow?.id || `wf-${now}`,
            title: group.title || '未命名工作流',
            thumbnail: thumbnail || '',
            nodes: JSON.parse(JSON.stringify(nodesInGroup)),
            connections: JSON.parse(JSON.stringify(connectionsInGroup)),
            groups: [JSON.parse(JSON.stringify({ ...group, nodeIds: explicitNodeIds }))],
            sourceGroupId: groupId,
            updatedAt: now,
        };
        setWorkflows(prev => [newWf, ...prev.filter(workflow => workflow.id !== newWf.id)]);
        setGroupSaveMessages(previous => ({ ...previous, [groupId]: existingWorkflow ? '工作流已更新' : '已保存到我的工作流' }));
        window.setTimeout(() => {
            setGroupSaveMessages(previous => {
                const next = { ...previous };
                delete next[groupId];
                return next;
            });
        }, 2400);
    };

    const loadWorkflow = (id: string) => {
        const wf = workflows.find(w => w.id === id);
        if (wf) { saveHistory(); setNodes(JSON.parse(JSON.stringify(wf.nodes))); setConnections(JSON.parse(JSON.stringify(wf.connections))); setGroups(JSON.parse(JSON.stringify(wf.groups))); setSelectedWorkflowId(id); }
    };

    const deleteWorkflow = (id: string) => { setWorkflows(prev => prev.filter(w => w.id !== id)); if (selectedWorkflowId === id) setSelectedWorkflowId(null); };
    const renameWorkflow = (id: string, newTitle: string) => { setWorkflows(prev => prev.map(w => w.id === id ? { ...w, title: newTitle } : w)); };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            
            // Undo & Redo
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }

            // Zoom Keyboard Shortcuts
            if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setScale(s => Math.min(3, s + 0.15));
                return;
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                setScale(s => Math.max(0.2, s - 0.15));
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault();
                setScale(1);
                return;
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedNodeIds(nodesRef.current.map(n => n.id)); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { const lastSelected = selectedNodeIds[selectedNodeIds.length - 1]; if (lastSelected) { const nodeToCopy = nodesRef.current.find(n => n.id === lastSelected); if (nodeToCopy) { e.preventDefault(); setClipboard(JSON.parse(JSON.stringify(nodeToCopy))); } } return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedGroupId) { saveHistory(); setGroups(prev => prev.filter(g => g.id !== selectedGroupId)); setSelectedGroupId(null); return; } if (selectedNodeIds.length > 0) { deleteNodes(selectedNodeIds); } }
        };
        const handleKeyDownSpace = (e: KeyboardEvent) => { if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { document.body.classList.add('cursor-grab-override'); } };
        const handleKeyUpSpace = (e: KeyboardEvent) => { if (e.code === 'Space') { document.body.classList.remove('cursor-grab-override'); } };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keydown', handleKeyDownSpace); window.addEventListener('keyup', handleKeyUpSpace);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keydown', handleKeyDownSpace); window.removeEventListener('keyup', handleKeyUpSpace); };
    }, [selectedWorkflowId, selectedNodeIds, selectedGroupId, deleteNodes, undo, redo, saveHistory]);

    useEffect(() => {
        const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target?.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });

        const handlePaste = async (event: ClipboardEvent) => {
            if (event.defaultPrevented) return;
            const target = event.target as HTMLElement | null;
            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

            const imageFiles = Array.from(event.clipboardData?.items || [])
                .filter(item => item.type.startsWith('image/'))
                .map(item => item.getAsFile())
                .filter((file): file is File => Boolean(file));

            if (imageFiles.length > 0) {
                event.preventDefault();
                const currentScale = scaleRef.current || 1;
                const currentPan = panRef.current;
                const rect = canvasRef.current?.getBoundingClientRect();
                const viewportCenterX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                const viewportCenterY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                const startX = (viewportCenterX - currentPan.x) / currentScale - 210;
                const startY = (viewportCenterY - currentPan.y) / currentScale - 180;

                try {
                    const images = await Promise.all(imageFiles.map(file => readFileAsDataUrl(file)));
                    images.forEach((src, index) => {
                        const col = index % 3;
                        const row = Math.floor(index / 3);
                        const nodeId = addNode(
                            NodeType.IMAGE_GENERATOR,
                            startX + col * 460,
                            startY + row * 450,
                            {
                                image: src,
                                prompt: imageFiles[index]?.name || 'Clipboard image',
                                status: NodeStatus.SUCCESS
                            }
                        );
                        if (nodeId && index === images.length - 1) setSelectedNodeIds([nodeId]);
                    });
                } catch (error) {
                    console.error('Failed to paste image from clipboard', error);
                }
                return;
            }

            if (clipboard) {
                event.preventDefault();
                saveHistory();
                const newNode: AppNode = {
                    ...clipboard,
                    id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    x: clipboard.x + 50,
                    y: clipboard.y + 50,
                    status: NodeStatus.IDLE,
                    inputs: []
                };
                setNodes(prev => [...prev, newNode]);
                setSelectedNodeIds([newNode.id]);
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [addNode, clipboard, saveHistory]);

    const handleCanvasDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropX = (e.clientX - pan.x) / scale;
        const dropY = (e.clientY - pan.y) / scale;
        const assetData = e.dataTransfer.getData('application/json');
        const workflowId = e.dataTransfer.getData('application/workflow-id');

        if (workflowId && workflows) {
            const wf = workflows.find(w => w.id === workflowId);
            if (wf) {
                saveHistory();
                const minX = Math.min(...wf.nodes.map(n => n.x));
                const minY = Math.min(...wf.nodes.map(n => n.y));
                const width = Math.max(...wf.nodes.map(n => n.x + (n.width || 420))) - minX;
                const height = Math.max(...wf.nodes.map(n => n.y + 320)) - minY;
                const offsetX = dropX - (minX + width / 2);
                const offsetY = dropY - (minY + height / 2);
                const idMap = new Map<string, string>();
                const newNodes = wf.nodes.map(n => { const newId = `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; idMap.set(n.id, newId); return { ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY, status: NodeStatus.IDLE, inputs: [] }; });
                newNodes.forEach((n, i) => { const original = wf.nodes[i]; n.inputs = original.inputs.map(oldId => idMap.get(oldId)).filter(Boolean) as string[]; });
                const newConnections = wf.connections.map(c => ({ from: idMap.get(c.from)!, to: idMap.get(c.to)! })).filter(c => c.from && c.to);
                const newGroups = (wf.groups || []).map(g => ({
                    ...g,
                    id: `g-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    x: g.x + offsetX,
                    y: g.y + offsetY,
                    nodeIds: (g.nodeIds || wf.nodes.map(node => node.id))
                        .map(oldId => idMap.get(oldId))
                        .filter(Boolean) as string[],
                }));
                setNodes(prev => [...prev, ...newNodes]); setConnections(prev => [...prev, ...newConnections]); setGroups(prev => [...prev, ...newGroups]);
            }
            return;
        }
        if (assetData) {
            try {
                const asset = JSON.parse(assetData);
                if (asset && asset.type) {
                    if (asset.type === 'image') addNode(NodeType.IMAGE_GENERATOR, dropX - 210, dropY - 180, { image: asset.src, prompt: asset.title });
                    else if (asset.type === 'video') addNode(NodeType.VIDEO_GENERATOR, dropX - 210, dropY - 180, { videoUri: asset.src });
                }
                return;
            } catch (err) { console.error("Drop failed", err); }
        }

        // Updated Multi-File Logic (9-Grid Support)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files) as File[];
            const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));

            if (validFiles.length > 0) {
                const COLS = 3;
                const GAP = 40;
                const BASE_WIDTH = 420;
                const BASE_HEIGHT = 450;

                const startX = dropX - 210;
                const startY = dropY - 180;

                validFiles.forEach((file, index) => {
                    const col = index % COLS;
                    const row = Math.floor(index / COLS);

                    const xPos = startX + (col * (BASE_WIDTH + GAP));
                    const yPos = startY + (row * BASE_HEIGHT);

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const res = event.target?.result as string;
                        if (file.type.startsWith('image/')) {
                            addNode(NodeType.IMAGE_GENERATOR, xPos, yPos, { image: res, prompt: file.name, status: NodeStatus.SUCCESS });
                        } else if (file.type.startsWith('video/')) {
                            addNode(NodeType.VIDEO_GENERATOR, xPos, yPos, { videoUri: res, prompt: file.name, status: NodeStatus.SUCCESS });
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    };

    const handleCreateDerivedImageNode = useCallback((sourceNodeId: string, promptInstruction: string, customTitle?: string) => {
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const childWidth = sourceNode.width || 420;
        const childHeight = sourceNode.height || 560;
        const posX = sourceNode.x + childWidth + 120;
        const posY = sourceNode.y;
        const newNodeId = `n-${Date.now()}`;

        const newNode: AppNode = {
            id: newNodeId,
            type: NodeType.IMAGE_GENERATOR,
            x: posX,
            y: posY,
            width: childWidth,
            height: childHeight,
            title: customTitle || `${sourceNode.title || '图片'} - 人物调节`,
            status: NodeStatus.WORKING,
            data: {
                model: sourceNode.data.model || 'gemini-3.1-flash-image-preview',
                aspectRatio: sourceNode.data.aspectRatio || '2:3',
                resolution: sourceNode.data.resolution || '2K',
                prompt: promptInstruction,
                imageCount: 1,
            },

            inputs: [sourceNodeId]
        };

        const newConnection: Connection = {
            from: sourceNodeId,
            to: newNodeId
        };

        setNodes(prev => [...prev, newNode]);
        setConnections(prev => [...prev, newConnection]);
        setSelectedNodeIds([newNodeId]);

        window.setTimeout(() => {
            handleNodeAction(newNodeId, promptInstruction);
        }, 50);
    }, [handleNodeAction]);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = ` .cursor-grab-override, .cursor-grab-override * { cursor: grab !important; } .cursor-grab-override:active, .cursor-grab-override:active * { cursor: grabbing !important; } `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // 监听全局点击以自动收起帮助菜单气泡
    useEffect(() => {
        if (!showHelpDropdown) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.help-dropdown-container')) {
                setShowHelpDropdown(false);
            }
        };
        window.addEventListener('mousedown', handleOutsideClick);
        return () => window.removeEventListener('mousedown', handleOutsideClick);
    }, [showHelpDropdown]);

    const getMinimapRects = () => {
        if (nodes.length === 0) return { nodesRects: [], viewportRect: null };
        
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        nodes.forEach(n => {
            const w = n.width || 420;
            const h = getApproxNodeHeight(n);
            if (n.x < minX) minX = n.x;
            if (n.x + w > maxX) maxX = n.x + w;
            if (n.y < minY) minY = n.y;
            if (n.y + h > maxY) maxY = n.y + h;
        });

        groups.forEach(g => {
            if (g.x < minX) minX = g.x;
            if (g.x + g.width > maxX) maxX = g.x + g.width;
            if (g.y < minY) minY = g.y;
            if (g.y + g.height > maxY) maxY = g.y + g.height;
        });

        const padding = 300;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        const boundsW = maxX - minX;
        const boundsH = maxY - minY;

        const viewLeft = -pan.x / scale;
        const viewTop = -pan.y / scale;
        const viewWidth = window.innerWidth / scale;
        const viewHeight = window.innerHeight / scale;

        const mapW = 180;
        const mapH = 120;

        const project = (x: number, y: number) => {
            const px = ((x - minX) / boundsW) * mapW;
            const py = ((y - minY) / boundsH) * mapH;
            return { x: px, y: py };
        };

        const projectSize = (w: number, h: number) => {
            const pw = (w / boundsW) * mapW;
            const ph = (h / boundsH) * mapH;
            return { w: pw, h: ph };
        };

        const nodesRects = nodes.map(n => {
            const w = n.width || 420;
            const h = getApproxNodeHeight(n);
            const pos = project(n.x, n.y);
            const size = projectSize(w, h);
            return {
                id: n.id,
                x: Math.max(0, Math.min(mapW - 1, pos.x)),
                y: Math.max(0, Math.min(mapH - 1, pos.y)),
                w: Math.max(2, size.w),
                h: Math.max(2, size.h),
                type: n.type
            };
        });

        const viewPos = project(viewLeft, viewTop);
        const viewSize = projectSize(viewWidth, viewHeight);

        const viewportRect = {
            x: Math.max(-50, Math.min(mapW + 50, viewPos.x)),
            y: Math.max(-50, Math.min(mapH + 50, viewPos.y)),
            w: Math.max(4, Math.min(mapW * 3, viewSize.w)),
            h: Math.max(4, Math.min(mapH * 3, viewSize.h))
        };

        return { nodesRects, viewportRect };
    };

    return (
        <div className="w-screen h-screen overflow-hidden bg-[#0a0a0c]">
            <div
                ref={canvasRef}
                className={`w-full h-full overflow-hidden text-slate-200 select-none selection:bg-cyan-500/30 ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
                onMouseDown={handleCanvasMouseDown} onWheel={handleWheel}
                onDragStart={(event) => {
                    if (connectionStartRef.current) event.preventDefault();
                }}
                onDoubleClick={(e) => {
                    e.preventDefault();
                    if (isTargetInAssistant(e.target)) return;
                    if (e.detail > 1 && !selectionRect) {
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' });
                        setContextMenuTarget({ type: 'create' });
                    }
                }}
                onContextMenu={(e) => { e.preventDefault(); if (e.target === e.currentTarget) setContextMenu(null); }}
                onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
            >
                <div className="absolute inset-0 noise-bg" />
                <div 
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300" 
                    style={{ 
                        opacity: showGrid ? 0.06 : 0,
                        backgroundImage: 'radial-gradient(circle, #aaa 1px, transparent 1px)', 
                        backgroundSize: `${32 * scale}px ${32 * scale}px`, 
                        backgroundPosition: `${pan.x}px ${pan.y}px` 
                    }} 
                />

                <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[${SPRING}] z-40 pointer-events-none ${(nodes.length > 0 || contextMenu) ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
                    {/* Floating Pill: 双击屏幕 画布自由生成 */}
                    <div className={`flex items-center gap-3 mb-10 bg-[#09090b]/60 border border-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-lg ${(nodes.length > 0 || contextMenu) ? 'pointer-events-none' : 'pointer-events-auto'} animate-in fade-in slide-in-from-bottom-3 duration-1000`}>
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                            <MousePointerClick size={13} className="text-emerald-400" />
                            <span>双击屏幕</span>
                        </div>
                        <span className="text-zinc-400 text-sm font-semibold tracking-wide">画布自由生成</span>
                    </div>

                    {/* Horizontal 4 Actions Grid */}
                    <div className={`flex items-center gap-4 p-2.5 rounded-[24px] bg-[#0c0c0e]/95 border border-white/5 backdrop-blur-2xl shadow-2xl transition-all duration-500 ${(nodes.length > 0 || contextMenu) ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                        <button 
                            onClick={() => addNode(NodeType.VIDEO_GENERATOR)} 
                            className="flex items-center gap-3 px-6 py-3.5 rounded-[16px] bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
                        >
                            <Film size={18} className="text-zinc-500 transition-colors group-hover:text-purple-400" />
                            <span className="text-sm font-semibold tracking-wide">文字生视频</span>
                        </button>

                        <button 
                            onClick={() => addNode(NodeType.IMAGE_EDITOR)} 
                            className="flex items-center gap-3 px-6 py-3.5 rounded-[16px] bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
                        >
                            <Sparkles size={18} className="text-zinc-500 transition-colors group-hover:text-cyan-400" />
                            <span className="text-sm font-semibold tracking-wide">图片换背景</span>
                        </button>

                        <button 
                            onClick={() => addNode(NodeType.VIDEO_GENERATOR, undefined, undefined, { generationMode: 'FIRST_LAST_FRAME' })} 
                            className="flex items-center gap-3 px-6 py-3.5 rounded-[16px] bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
                        >
                            <Link size={18} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
                            <span className="text-sm font-semibold tracking-wide">首尾帧生视频</span>
                        </button>

                        <button 
                            onClick={() => setActiveSidebarPanel('workflow')} 
                            className="flex items-center gap-3 px-6 py-3.5 rounded-[16px] bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
                        >
                            <WorkflowIcon size={18} className="text-zinc-500 transition-colors group-hover:text-amber-400" />
                            <span className="text-sm font-semibold tracking-wide">我的工作流</span>
                        </button>
                    </div>
                </div>

                <input type="file" ref={replaceVideoInputRef} className="hidden" accept="video/*" onChange={(e) => handleReplaceFile(e, 'video')} />
                <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleReplaceFile(e, 'image')} />

                <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: '100%', height: '100%', transformOrigin: '0 0' }} className={`w-full h-full ${isViewportAnimating ? 'transition-transform duration-300 ease-out' : ''}`}>
                    {/* Groups Layer */}
                    {groups.map(g => {
                        const memberIds = getGroupNodeIds(g, nodes);
                        const isRunning = runningGroupIds.has(g.id);
                        const runMessage = groupRunMessages[g.id];
                        const saveMessage = groupSaveMessages[g.id];
                        return (
                            <div
                                key={g.id}
                                className={`absolute z-[1] rounded-[32px] border transition-all ${(draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id) ? 'duration-0' : 'duration-300'} ${selectedGroupId === g.id ? 'border-cyan-400/45 bg-cyan-500/[0.055] shadow-[0_0_40px_rgba(34,211,238,0.08)]' : 'border-white/10 bg-white/[0.025]'}`}
                                style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setSelectedGroupId(g.id);
                                    const childNodes = memberIds
                                        .map(id => nodeById.get(id))
                                        .filter(Boolean)
                                        .map(node => ({ id: node!.id, startX: node!.x, startY: node!.y }));
                                    dragGroupRef.current = {
                                        id: g.id,
                                        startX: g.x,
                                        startY: g.y,
                                        mouseStartX: e.clientX,
                                        mouseStartY: e.clientY,
                                        childNodes,
                                        childNodeStartById: new Map(childNodes.map(child => [child.id, { startX: child.startX, startY: child.startY }]))
                                    };
                                    setActiveGroupNodeIds(childNodes.map(c => c.id));
                                    setDraggingGroup({ id: g.id });
                                }}
                                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: g.id }); setContextMenuTarget({ type: 'group', id: g.id }); }}
                            >
                                <div className="absolute left-5 right-5 top-3 flex h-11 items-center justify-between rounded-2xl border border-white/10 bg-[#111216]/90 px-4 shadow-xl backdrop-blur-xl">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <WorkflowIcon size={14} className="shrink-0 text-cyan-300" />
                                            <span className="truncate text-xs font-bold text-zinc-200">{g.title}</span>
                                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-zinc-500">{memberIds.length} 节点</span>
                                        </div>
                                        {(runMessage || saveMessage) && (
                                            <p className={`mt-0.5 max-w-[360px] truncate text-[9px] ${runMessage?.includes('失败') || runMessage?.includes('循环') ? 'text-red-400' : runMessage?.includes('完成') || saveMessage ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                                {saveMessage || runMessage}
                                            </p>
                                        )}
                                    </div>
                                    <div className="ml-4 flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={memberIds.length === 0}
                                            onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }}
                                            onClick={event => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                saveGroupAsWorkflow(g.id);
                                            }}
                                            className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-zinc-200 transition-all hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="保存或更新到我的工作流"
                                        >
                                            <Save size={12} />
                                            保存
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isRunning || memberIds.length === 0}
                                            onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }}
                                            onClick={event => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                void runGroupWorkflow(g.id);
                                            }}
                                            className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-[10px] font-bold transition-all ${
                                                isRunning
                                                    ? 'cursor-wait bg-cyan-400/10 text-cyan-300'
                                                    : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:scale-105 hover:shadow-lg hover:shadow-emerald-400/20 active:scale-95'
                                            } disabled:cursor-not-allowed disabled:opacity-50`}
                                            title="按连接依赖顺序运行组内工作流"
                                        >
                                            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                                            {isRunning ? '运行中' : '启动'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Connections Layer */}
                    <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                        {visibleConnections.map((conn) => {
                            const f = nodeById.get(conn.from), t = nodeById.get(conn.to);
                            if (!f || !t) return null;
                            const fHeight = f.height || getApproxNodeHeight(f); const tHeight = t.height || getApproxNodeHeight(t);
                            const fx = f.x + (f.width || 420) + 3; let fy = f.y + fHeight / 2; const tx = t.x - 3; let ty = t.y + tHeight / 2;
                            if (Math.abs(fy - ty) < 0.5) ty += 0.5;
                            if (isNaN(fx) || isNaN(fy) || isNaN(tx) || isNaN(ty)) return null;
                            const d = `M ${fx} ${fy} C ${fx + (tx - fx) * 0.5} ${fy} ${tx - (tx - fx) * 0.5} ${ty} ${tx} ${ty}`;
                            return (
                                <g key={`${conn.from}-${conn.to}`} className="pointer-events-auto group/line">
                                    <path d={d} stroke="url(#gradient)" strokeWidth="3" fill="none" strokeOpacity="0.5" className="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40" />
                                    <path
                                        d={d}
                                        stroke="transparent"
                                        strokeWidth="15"
                                        fill="none"
                                        style={{ cursor: 'pointer' }}
                                        onDoubleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            deleteConnection(conn.from, conn.to);
                                        }}
                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: `${conn.from}-${conn.to}` }); setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to }); }}
                                    />
                                </g>
                            );
                        })}
                        <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" /></linearGradient></defs>
                        {connectionStart && (() => {
                            let startX = 0, startY = 0;
                            if (connectionStart.id === 'smart-sequence-dock') {
                                startX = (connectionStart.x - pan.x) / scale; startY = (connectionStart.y - pan.y) / scale;
                            } else {
                                const startNode = nodeById.get(connectionStart.id); if (!startNode) return null;
                                const startHeight = startNode.height || getApproxNodeHeight(startNode); startX = startNode.x + (startNode.width || 420) + 3; startY = startNode.y + startHeight / 2;
                            }
                            const endX = (mousePos.x - pan.x) / scale; const endY = (mousePos.y - pan.y) / scale;
                            return <path d={`M ${startX} ${startY} L ${endX} ${endY}`} stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="4,4" fill="none" />;
                        })()}
                    </svg>

                    {visibleNodes.map(node => (
                        <Node
                            key={node.id} node={node} onUpdate={handleNodeUpdate} onAction={handleNodeAction} onDelete={(id) => deleteNodes([id])} onExpand={setExpandedMedia} onCrop={(id, img) => { setCroppingNodeId(id); setImageToCrop(img); }} onAddToAgent={handleAddImageToAgent}
                            onCreateDerivedNode={handleCreateDerivedImageNode}
                            onTextQuickAction={handleTextQuickAction}
                            onFocusNode={handleFocusNode}
                            onNodeMouseDown={(e, id) => {
                                e.stopPropagation();
                                const isModifierSelection = e.shiftKey || e.metaKey || e.ctrlKey;
                                const nextSelectedNodeIds = isModifierSelection
                                    ? (selectedNodeIdSet.has(id) ? selectedNodeIds.filter(item => item !== id) : [...selectedNodeIds, id])
                                    : (selectedNodeIdSet.has(id) ? selectedNodeIds : [id]);
                                setSelectedNodeIds(nextSelectedNodeIds);
                                const n = nodeById.get(id);
                                if (n) {
                                    const w = n.width || 420; const h = n.height || getApproxNodeHeight(n);
                                    const membership = groupMembershipByNodeId.get(id);
                                    const pGroup = membership?.group;
                                    const siblingNodeIds = membership?.nodeIds.filter(nodeId => nodeId !== id) || [];
                                    const draggedNodeStartById = new Map(
                                        nextSelectedNodeIds
                                            .map(nodeId => nodeById.get(nodeId))
                                            .filter(Boolean)
                                            .map(node => [node!.id, { startX: node!.x, startY: node!.y }])
                                    );
                                    if (!draggedNodeStartById.has(id)) {
                                        draggedNodeStartById.set(id, { startX: n.x, startY: n.y });
                                    }
                                    const canvasNodeElements = new Map<string, HTMLElement>();
                                    canvasRef.current?.querySelectorAll<HTMLElement>('[data-canvas-node-id]').forEach(element => {
                                        const nodeId = element.dataset.canvasNodeId;
                                        if (nodeId) canvasNodeElements.set(nodeId, element);
                                    });
                                    const draggedNodeElements = new Map<string, {
                                        element: HTMLElement,
                                        transition: string,
                                        willChange: string,
                                        backdropFilter: string,
                                        boxShadow: string,
                                    }>();
                                    draggedNodeStartById.forEach((_, nodeId) => {
                                        const element = canvasNodeElements.get(nodeId);
                                        if (!element) return;
                                        draggedNodeElements.set(nodeId, {
                                            element,
                                            transition: element.style.transition,
                                            willChange: element.style.willChange,
                                            backdropFilter: element.style.backdropFilter,
                                            boxShadow: element.style.boxShadow,
                                        });
                                        element.style.transition = 'none';
                                        element.style.willChange = 'transform';
                                        element.style.backdropFilter = 'none';
                                        element.style.boxShadow = 'none';
                                    });
                                    dragNodeRef.current = { id, startX: n.x, startY: n.y, mouseStartX: e.clientX, mouseStartY: e.clientY, parentGroupId: pGroup?.id, siblingNodeIds, draggedNodeStartById, draggedNodeElements, nodeWidth: w, nodeHeight: h };
                                    setDraggingNodeParentGroupId(pGroup?.id || null); setDraggingNodeId(id);
                                }
                            }}
                            onPortMouseDown={(e, id, type) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.getSelection()?.removeAllRanges();
                                const nextConnection = { id, x: e.clientX, y: e.clientY };
                                connectionStartRef.current = nextConnection;
                                setMousePos({ x: e.clientX, y: e.clientY });
                                setConnectionStart(nextConnection);
                            }}
                            onPortMouseUp={(e, id, type) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const start = connectionStartRef.current;
                                if (start && start.id !== id) {
                                    if (start.id === 'smart-sequence-dock') { } else { setConnections(p => [...p, { from: start.id, to: id }]); setNodes(p => p.map(n => n.id === id ? { ...n, inputs: [...n.inputs, start.id] } : n)); }
                                }
                                connectionStartRef.current = null;
                                setConnectionStart(null);
                            }}
                            onNodeContextMenu={(e, id) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const isMultiSelectionTarget = selectedNodeIdSet.has(id) && selectedNodeIds.length > 1;
                                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id });
                                setContextMenuTarget(isMultiSelectionTarget ? { type: 'selection', ids: selectedNodeIds } : { type: 'node', id });
                            }}
                            onResizeMouseDown={(e, id, w, h) => {
                                e.stopPropagation(); const n = nodeById.get(id);
                                if (n) {
                                    const membership = groupMembershipByNodeId.get(id);
                                    const pGroup = membership?.group;
                                    setDraggingNodeParentGroupId(pGroup?.id || null);
                                    const siblingNodeIds = membership?.nodeIds.filter(nodeId => nodeId !== id) || [];
                                    resizeContextRef.current = { nodeId: id, initialWidth: w, initialHeight: h, startX: e.clientX, startY: e.clientY, parentGroupId: pGroup?.id || null, siblingNodeIds };
                                }
                                setResizingNodeId(id); setInitialSize({ width: w, height: h }); setResizeStartPos({ x: e.clientX, y: e.clientY });
                            }}
                            isSelected={selectedNodeIdSet.has(node.id)}
                            canvasScale={scale}
                            inputAssets={nodeInputAssetsById.get(node.id)}
                            onInputReorder={(nodeId, newOrder) => { const targetNode = nodeById.get(nodeId); if (targetNode) { setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n)); } }}
                            onStoryboardOption={handleStoryboardOption}
                            onGridCropOption={handleGridCropOption}

                            suppressNodeChrome={selectedNodeIds.length > 1 && selectedNodeIdSet.has(node.id)}

                            isDragging={draggingNodeId === node.id} isResizing={resizingNodeId === node.id} isConnecting={!!connectionStart} isGroupDragging={activeGroupNodeIdSet.has(node.id)}
                        />
                    ))}

                    {selectionRect && <div className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none" style={{ left: (Math.min(selectionRect.startX, selectionRect.currentX) - pan.x) / scale, top: (Math.min(selectionRect.startY, selectionRect.currentY) - pan.y) / scale, width: Math.abs(selectionRect.currentX - selectionRect.startX) / scale, height: Math.abs(selectionRect.currentY - selectionRect.startY) / scale }} />}
                </div>

                {contextMenu && (
                    <div 
                        className={contextMenuTarget?.type === 'create' || contextMenuTarget?.type === 'reference-create'
                            ? "fixed z-[100] w-80 bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 animate-in fade-in zoom-in-95 duration-200 origin-top-left flex flex-col overflow-y-auto max-h-[75vh] custom-scrollbar space-y-5"
                            : "fixed z-[100] bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-200 origin-top-left"
                        }
                        style={{ top: contextMenu.y, left: contextMenu.x }} 
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {contextMenuTarget?.type === 'node' && (
                            <>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) setClipboard(JSON.parse(JSON.stringify(targetNode))); setContextMenu(null); }}>
                                    <Copy size={12} /> 复制节点
                                </button>
                                {(() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) { const isVideo = targetNode.type === NodeType.VIDEO_GENERATOR || targetNode.type === NodeType.VIDEO_ANALYZER; const isImage = targetNode.type === NodeType.IMAGE_GENERATOR || targetNode.type === NodeType.IMAGE_EDITOR; if (isVideo || isImage) { return (<button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { replacementTargetRef.current = contextMenu.id; if (isVideo) replaceVideoInputRef.current?.click(); else replaceImageInputRef.current?.click(); setContextMenu(null); }}> <RefreshCw size={12} /> 替换素材 </button>); } } return null; })()}
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1" onClick={() => { deleteNodes([contextMenuTarget.id]); setContextMenu(null); }}><Trash2 size={12} /> 删除节点</button>
                            </>
                        )}
                        {contextMenuTarget?.type === 'selection' && (
                            <>
                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    已选中 {contextMenuTarget.ids.length} 个节点
                                </div>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/15 rounded-lg flex items-center gap-2 transition-colors"
                                    onClick={() => {
                                        createWorkflowGroupFromNodeIds(contextMenuTarget.ids);
                                        setContextMenu(null);
                                    }}
                                >
                                    <WorkflowIcon size={12} /> 组成工作流
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1"
                                    onClick={() => {
                                        deleteNodes(contextMenuTarget.ids);
                                        setContextMenu(null);
                                    }}
                                >
                                    <Trash2 size={12} /> 删除选中节点
                                </button>
                            </>
                        )}
                        {contextMenuTarget?.type === 'reference-create' && (
                            <div className="space-y-2 text-left">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">引用该节点生成</div>
                                <button
                                    onClick={() => addReferencedNode(NodeType.PROMPT_INPUT)}
                                    className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                >
                                    <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                        <Type size={16} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">文本</span>
                                        <span className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors mt-0.5">脚本、广告词、品牌文案</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => addReferencedNode(NodeType.IMAGE_GENERATOR)}
                                    className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                >
                                    <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                        <ImageIcon size={16} />
                                    </div>
                                    <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">图片</span>
                                </button>
                                <button
                                    onClick={() => addReferencedNode(NodeType.VIDEO_GENERATOR)}
                                    className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                >
                                    <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                        <Film size={16} />
                                    </div>
                                    <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">视频</span>
                                </button>
                            </div>
                        )}
                        {contextMenuTarget?.type === 'create' && (
                            <>
                                {/* 添加节点 Section */}
                                <div className="space-y-2 text-left">
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">添加节点</div>
                                    
                                    {/* 文本 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.PROMPT_INPUT, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Type size={16} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">文本</span>
                                            <span className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors mt-0.5">脚本、广告词、品牌文案</span>
                                        </div>
                                    </button>

                                    {/* 图片 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.IMAGE_GENERATOR, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <ImageIcon size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">图片</span>
                                    </button>

                                    {/* 视频 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.VIDEO_GENERATOR, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Film size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">视频</span>
                                    </button>


                                    {/* 音频 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.AUDIO_GENERATOR, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Volume2 size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">音频</span>
                                    </button>
                                </div>

                                {/* 功能节点 Section */}
                                <div className="space-y-2 text-left">
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">功能节点</div>

                                    {/* 分镜格子 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.STORYBOARD_GRID, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Clapperboard size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">分镜格子</span>
                                    </button>

                                    {/* 历史记录 Item */}
                                    <button 
                                        onClick={() => { setIsHistoryModalOpen(true); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <History size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">历史记录</span>
                                    </button>
                                </div>

                                {/* 添加资源 Section */}
                                <div className="space-y-2 text-left">
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">添加资源</div>

                                    {/* 上传 Item */}
                                    <button 
                                        onClick={() => { addNode(NodeType.IMAGE_GENERATOR, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Upload size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">上传</span>
                                    </button>

                                    {/* 从作品导入 Item */}
                                    <button 
                                        onClick={() => { setActiveSidebarPanel('history'); setContextMenu(null); }}
                                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                                    >
                                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                                            <Box size={16} />
                                        </div>
                                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">从作品导入</span>
                                    </button>
                                </div>
                            </>
                        )}
                        {contextMenuTarget?.type === 'group' && (
                            <>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 rounded-lg flex items-center gap-2 transition-colors mb-1" onClick={() => { void runGroupWorkflow(contextMenu.id); setContextMenu(null); }}> <Play size={12} fill="currentColor" /> 启动工作流 </button>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors mb-1" onClick={() => { saveGroupAsWorkflow(contextMenu.id); setContextMenu(null); }}> <FolderHeart size={12} className="text-cyan-400" /> 保存为工作流 </button>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setGroups(p => p.filter(g => g.id !== contextMenu.id)); setContextMenu(null); }}> <Trash2 size={12} /> 删除分组 </button>
                            </>
                        )}
                        {contextMenuTarget?.type === 'connection' && (
                            <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => deleteConnection(contextMenuTarget.from, contextMenuTarget.to)}> <Unplug size={12} /> 删除连接线 </button>
                        )}
                    </div>
                )}

                {selectedNodeIds.length > 1 && !contextMenu && (
                    <div className="fixed top-24 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-[#1c1c1e]/90 p-1.5 shadow-2xl backdrop-blur-2xl">
                        <div className="px-3 text-[11px] font-bold text-zinc-400">
                            已选中 {selectedNodeIds.length} 个节点
                        </div>
                        <button
                            type="button"
                            onMouseDown={event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                createWorkflowGroupFromNodeIds(selectedNodeIds);
                            }}
                            className="flex h-8 items-center gap-1.5 rounded-xl bg-cyan-400/15 px-3 text-[11px] font-bold text-cyan-200 transition-all hover:bg-cyan-400/25 active:scale-95"
                        >
                            <WorkflowIcon size={13} /> 组成工作流
                        </button>
                        <button
                            type="button"
                            onMouseDown={event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                deleteNodes(selectedNodeIds);
                            }}
                            className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-red-300 transition-all hover:bg-red-500/20 active:scale-95"
                        >
                            <Trash2 size={13} /> 删除
                        </button>
                    </div>
                )}

                {croppingNodeId && imageToCrop && (
                    <ImageCropper
                        imageSrc={imageToCrop}
                        onCancel={() => {
                            setCroppingNodeId(null);
                            setImageToCrop(null);
                        }}
                        onConfirm={(croppedImage) => {
                            const targetNode = nodesRef.current.find(node => node.id === croppingNodeId);
                            const image = new Image();
                            image.onload = () => {
                                const width = targetNode?.width || 420;
                                const nextHeight = Math.max(240, Math.min(720, width * (image.naturalHeight / Math.max(1, image.naturalWidth))));
                                handleNodeUpdate(
                                    croppingNodeId,
                                    {
                                        image: croppedImage,
                                        images: undefined,
                                        croppedFrame: undefined,
                                        imagePreview: undefined,
                                        imagePreviewSource: undefined,
                                        aspectRatio: getClosestAspectRatio(image.naturalWidth, image.naturalHeight),
                                    },
                                    { height: nextHeight }
                                );
                                setCroppingNodeId(null);
                                setImageToCrop(null);
                            };
                            image.onerror = () => {
                                handleNodeUpdate(croppingNodeId, {
                                    image: croppedImage,
                                    images: undefined,
                                    croppedFrame: undefined,
                                    imagePreview: undefined,
                                    imagePreviewSource: undefined,
                                });
                                setCroppingNodeId(null);
                                setImageToCrop(null);
                            };
                            image.src = croppedImage;
                        }}
                    />
                )}
                <ExpandedView media={expandedMedia} onClose={() => setExpandedMedia(null)} />
                {isSketchEditorOpen && <SketchEditor onClose={() => setIsSketchEditorOpen(false)} onGenerate={handleSketchResult} />}
                <SmartSequenceDock
                    isOpen={isMultiFrameOpen}
                    onClose={() => setIsMultiFrameOpen(false)}
                    onGenerate={handleMultiFrameGenerate}
                    onConnectStart={(e, type) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.getSelection()?.removeAllRanges();
                        const nextConnection = { id: 'smart-sequence-dock', x: e.clientX, y: e.clientY };
                        connectionStartRef.current = nextConnection;
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setConnectionStart(nextConnection);
                    }}
                />
                <SonicStudio
                    isOpen={isSonicStudioOpen}
                    onClose={() => setIsSonicStudioOpen(false)}
                    history={assetHistory.filter(a => a.type === 'audio')}
                    onGenerate={(src, prompt) => handleAssetGenerated('audio', src, prompt)}
                />
                <UnifiedSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialTab="model" />
                <HistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    assetHistory={assetHistory}
                    onHistoryItemClick={(item) => {
                        const type = item.type.includes('image') ? NodeType.IMAGE_GENERATOR : 
                                     item.type.includes('video') ? NodeType.VIDEO_GENERATOR : 
                                     NodeType.AUDIO_GENERATOR;
                        const data = item.type === 'image' ? { image: item.src } : 
                                     item.type === 'video' ? { videoUri: item.src } : 
                                     { audioUri: item.src };
                        addNode(type, undefined, undefined, data);
                        setIsHistoryModalOpen(false);
                    }}
                    onDeleteAsset={handleDeleteAsset}
                    onBatchDeleteAssets={handleBatchDeleteAssets}
                />

                <SidebarDock
                    onAddNode={addNode}
                    onUndo={undo}
                    isHistoryModalOpen={isHistoryModalOpen}
                    onToggleHistoryModal={() => setIsHistoryModalOpen(!isHistoryModalOpen)}
                    isMultiFrameOpen={isMultiFrameOpen}
                    onToggleMultiFrame={() => setIsMultiFrameOpen(!isMultiFrameOpen)}
                    isSonicStudioOpen={isSonicStudioOpen}
                    onToggleSonicStudio={() => setIsSonicStudioOpen(!isSonicStudioOpen)}
                    assetHistory={assetHistory}
                    onHistoryItemClick={(item) => {
                        const type = item.type.includes('image') ? NodeType.IMAGE_GENERATOR : 
                                     item.type.includes('video') ? NodeType.VIDEO_GENERATOR : 
                                     NodeType.AUDIO_GENERATOR;
                        const data = item.type === 'image' ? { image: item.src } : 
                                     item.type === 'video' ? { videoUri: item.src } : 
                                     { audioUri: item.src };
                        addNode(type, undefined, undefined, data);
                    }}
                    onDeleteAsset={handleDeleteAsset}
                    workflows={workflows}
                    selectedWorkflowId={selectedWorkflowId}
                    onSelectWorkflow={loadWorkflow}
                    onSaveWorkflow={saveCurrentAsWorkflow}
                    onDeleteWorkflow={deleteWorkflow}
                    onRenameWorkflow={renameWorkflow}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    activePanel={activeSidebarPanel}
                    onChangeActivePanel={setActiveSidebarPanel}
                />

                <AssistantPanel
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    attachments={agentAttachments}
                    onRemoveAttachment={(id) => setAgentAttachments(prev => prev.filter(item => item.id !== id))}
                    onInsertAssetToCanvas={(url, title, mediaType = 'image') => {
                        addNode(
                            mediaType === 'video' ? NodeType.VIDEO_GENERATOR : NodeType.IMAGE_GENERATOR,
                            undefined,
                            undefined,
                            mediaType === 'video'
                                ? { videoUri: url, prompt: `Agent【${title}】生成的视频资产` }
                                : { image: url, imagePreview: url, prompt: `Agent【${title}】生成的图片资产` },
                        );
                    }}
                    onInsertImageModificationWorkflow={(inputImages, outputImage) => {
                        const canvas = canvasRef.current;
                        const rect = canvas ? canvas.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
                        const centerX = (-panRef.current.x + rect.width / 2) / scaleRef.current;
                        const centerY = (-panRef.current.y + rect.height / 2) / scaleRef.current;

                        // 1. 原图输入节点 (包含原始参考图片)
                        const sourceNodeId = addNode(
                            NodeType.IMAGE_GENERATOR,
                            centerX - 300,
                            centerY - 150,
                            {
                                image: inputImages[0]?.url,
                                imagePreview: inputImages[0]?.url,
                                prompt: `原图参考【${inputImages[0]?.title || '图片'}】`,
                            }
                        );

                        // 2. AI 调整生成节点 (包含修改后生成的成果图)
                        const outputNodeId = addNode(
                            NodeType.IMAGE_GENERATOR,
                            centerX + 200,
                            centerY - 150,
                            {
                                image: outputImage.url,
                                imagePreview: outputImage.url,
                                prompt: outputImage.prompt,
                            }
                        );

                        // 3. 建立输入 -> 输出贝塞尔连线与节点依附关系
                        if (sourceNodeId && outputNodeId) {
                            setConnections(prev => [...prev, { from: sourceNodeId, to: outputNodeId }]);
                            setNodes(prev => prev.map(n => n.id === outputNodeId ? { ...n, inputs: [...n.inputs, sourceNodeId] } : n));
                            handleFocusNode(outputNodeId);
                        }
                    }}
                    onLocateAssetOnCanvas={(url) => {
                        const targetNode = [...nodesRef.current].reverse().find(node => (
                            node.data.image === url
                            || node.data.imagePreview === url
                            || node.data.videoUri === url
                            || node.data.images?.includes(url)
                            || node.data.videoUris?.includes(url)
                        ));
                        if (!targetNode) return false;
                        setIsChatOpen(false);
                        window.setTimeout(() => handleFocusNode(targetNode.id), 80);
                        return true;
                    }}
                />

                {/* Canvas Mini-map (Dynamic Scale Projection) */}
                {showMinimap && (() => {
                    const { nodesRects, viewportRect } = getMinimapRects();
                    return (
                        <div className="absolute bottom-[92px] left-[96px] w-[180px] h-[120px] bg-[#0d0d10]/95 border border-white/10 rounded-[20px] shadow-3xl overflow-hidden z-50 backdrop-blur-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                            {/* Minimap Box Area */}
                            <div className="relative w-full h-full bg-zinc-950/80 rounded-xl overflow-hidden border border-white/5">
                                {/* Nodes representation */}
                                {nodesRects.map(r => (
                                    <div 
                                        key={r.id} 
                                        className={`absolute rounded-[2px] opacity-60 border border-white/10 ${
                                            r.type.includes('IMAGE') ? 'bg-cyan-500' :
                                            r.type.includes('VIDEO') ? 'bg-purple-500' :
                                            r.type.includes('PROMPT') ? 'bg-emerald-500' :
                                            'bg-zinc-600'
                                        }`}
                                        style={{ 
                                            left: `${r.x}px`, 
                                            top: `${r.y}px`, 
                                            width: `${r.w}px`, 
                                            height: `${r.h}px` 
                                        }} 
                                    />
                                ))}

                                {/* Viewport representation */}
                                {viewportRect && (
                                    <div 
                                        className="absolute border border-emerald-400 bg-emerald-400/5 rounded-md shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-150"
                                        style={{ 
                                            left: `${viewportRect.x}px`, 
                                            top: `${viewportRect.y}px`, 
                                            width: `${viewportRect.w}px`, 
                                            height: `${viewportRect.h}px` 
                                        }} 
                                    />
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Pill Zoom and Controller at Bottom Left */}
                <div className="absolute bottom-8 left-[96px] flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Pill Bar */}
                    <div className="flex items-center gap-4 px-5 py-2.5 bg-[#0d0d10]/90 backdrop-blur-3xl border border-white/5 rounded-full shadow-2xl">
                        {/* Map Icon */}
                        <button 
                            onClick={() => setShowMinimap(!showMinimap)} 
                            className={`p-1.5 transition-all rounded-lg ${showMinimap ? 'text-emerald-400 bg-emerald-500/10 scale-105' : 'text-zinc-500 hover:text-zinc-200'}`}
                            title="切换缩略图"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.12 3.88 16 2"/><path d="M18.6 5.4 20 4"/><path d="m22 7.6-2-.6"/><path d="m22 12-2 .5"/><path d="m20 16.6 2 .4"/><path d="M16 20l-1.88 1.88"/><path d="M12 22l-.5-2"/><path d="M7.6 22l.4-2"/><path d="M4 20l1.4-1.4"/><path d="M2 16.4l2-.4"/><path d="M2 12l2-.5"/><path d="M4 7.6l-2-.6"/><path d="M5.4 5.4 4 4"/><path d="M8 2l-.4 2"/><path d="M12 2l.5 2"/><path d="m15.4 5.4-1.4 1.4"/><path d="M18 8a6 6 0 0 0-6-6"/><path d="M12 20a8 8 0 1 0 0-16"/><path d="M12 20a6 6 0 0 1-6-6"/></svg>
                        </button>

                        {/* Grid Icon */}
                        <button 
                            onClick={() => setShowGrid(!showGrid)} 
                            className={`p-1.5 transition-all rounded-lg ${showGrid ? 'text-emerald-400 bg-emerald-500/10 scale-105' : 'text-zinc-500 hover:text-zinc-200'}`}
                            title="切换网格"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /><path d="M3 9h18" /><path d="M3 15h18" /></svg>
                        </button>

                        {/* Focus View Icon */}
                        <button 
                            onClick={handleFitView} 
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-all hover:bg-white/5 rounded-lg"
                            title="适配视图"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="1" /><path d="M12 8v2" /><path d="M12 14v2" /><path d="M8 12h2" /><path d="M14 12h2" /></svg>
                        </button>

                        {/* Zoom Slider */}
                        <div className="flex items-center gap-3">
                            <input 
                                type="range" 
                                min="0.2" 
                                max="3" 
                                step="0.05" 
                                value={scale} 
                                onChange={(e) => setScale(parseFloat(e.target.value))} 
                                className="w-24 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer outline-none transition-all relative z-10 
                                [&::-webkit-slider-runnable-track]:bg-transparent
                                [&::-webkit-slider-thumb]:appearance-none 
                                [&::-webkit-slider-thumb]:w-3.5 
                                [&::-webkit-slider-thumb]:h-3.5 
                                [&::-webkit-slider-thumb]:rounded-full 
                                [&::-webkit-slider-thumb]:bg-emerald-400 
                                [&::-webkit-slider-thumb]:border-2 
                                [&::-webkit-slider-thumb]:border-white 
                                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(16,185,129,0.6)]
                                hover:[&::-webkit-slider-thumb]:scale-110 
                                active:[&::-webkit-slider-thumb]:scale-125
                                [&::-webkit-slider-thumb]:transition-transform"
                                style={{
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${((scale - 0.2) / (3.0 - 0.2)) * 100}%, #27272a ${((scale - 0.2) / (3.0 - 0.2)) * 100}%, #27272a 100%)`
                                }}
                            />
                            <span 
                                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-200 transition-colors w-10 text-right font-mono cursor-pointer" 
                                onClick={() => setScale(1)} 
                                title="重置为 100%"
                            >
                                {Math.round(scale * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Button 1: Question mark Button */}
                    <div className="relative help-dropdown-container">
                        <button 
                            onClick={() => setShowHelpDropdown(!showHelpDropdown)} 
                            className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#0d0d10]/90 backdrop-blur-3xl border ${showHelpDropdown ? 'border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]' : 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'} transition-all shadow-2xl`}
                            title="帮助与教程"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                        </button>

                        {/* Question Button Dropdown */}
                        {showHelpDropdown && (
                            <div className="absolute bottom-[48px] left-0 w-[140px] bg-[#0d0d10]/95 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <button 
                                    onClick={() => { setIsGuideModalOpen(true); setShowHelpDropdown(false); }} 
                                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2.5 transition-all group"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover:text-emerald-400 transition-colors"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                    使用教程
                                </button>
                                <button 
                                    onClick={() => { setIsShortcutsModalOpen(true); setShowHelpDropdown(false); }} 
                                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2.5 transition-all group"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover:text-emerald-400 transition-colors"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>
                                    快捷键
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Button 2: Document/Edit Button */}
                    <button 
                        onClick={() => {
                            setActiveSidebarPanel('workflow');
                            setIsSettingsOpen(true);
                        }} 
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0d0d10]/90 backdrop-blur-3xl border border-white/5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all shadow-2xl"
                        title="系统配置 / 工作流"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                </div>

                {/* Shortcuts Key Center Modal */}
                {isShortcutsModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center z-[150] bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
                        {/* Overlay Click to Close */}
                        <div className="absolute inset-0" onClick={() => setIsShortcutsModalOpen(false)} />
                        
                        {/* Modal Box */}
                        <div className="w-[580px] bg-[#141416]/98 border border-white/10 rounded-[28px] shadow-3xl p-8 backdrop-blur-md flex flex-col gap-6 relative z-10 animate-in zoom-in-95 duration-300 text-left">
                            {/* Close Button */}
                            <button 
                                onClick={() => setIsShortcutsModalOpen(false)} 
                                className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/80 rounded-full transition-all border border-white/5"
                            >
                                <X size={15} />
                            </button>

                            {/* Header */}
                            <div>
                                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>
                                    快捷键
                                </h3>
                                <p className="text-zinc-500 text-[11px] mt-1 font-medium">使用快捷操作在 XcAi 智能工坊中以双倍效率进行创作与编排。</p>
                            </div>

                            {/* Columns Layout */}
                            <div className="grid grid-cols-2 gap-8 py-2 border-y border-white/5">
                                {/* Left Column: 缩放 & 移动画布 */}
                                <div className="flex flex-col gap-6">
                                    {/* 缩放 Section */}
                                    <div>
                                        <h4 className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">缩放</h4>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">放大</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">+</kbd>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">缩小</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">-</kbd>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">鼠标</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <span className="text-[11px] text-zinc-400 font-semibold">滚轮</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">触控板</span>
                                                <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-500"><path d="M18 15a6 6 0 0 0-6-6"/><path d="M12 20a8 8 0 1 0 0-16"/><path d="M12 20a6 6 0 0 1-6-6"/></svg>
                                                    双指捏合
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 移动画布 Section */}
                                    <div>
                                        <h4 className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">移动画布</h4>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">鼠标</span>
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                                                        <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Space</kbd>
                                                        <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                        左键拖拽
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                                                        <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                        <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                        左键拖拽
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400 font-semibold">鼠标中键拖拽</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">触控板</span>
                                                <span className="text-[11px] text-zinc-400 font-semibold">双指拖拽</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: 其他 */}
                                <div className="flex flex-col gap-6">
                                    <div>
                                        <h4 className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">其他</h4>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">删除</span>
                                                <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Delete</kbd>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">撤销</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Z</kbd>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">重做</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Shift</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Z</kbd>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">复制</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">C</kbd>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-400 text-xs font-semibold">粘贴</span>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">Ctrl</kbd>
                                                    <span className="text-zinc-600 text-[10px] font-bold">+</span>
                                                    <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-md text-[10px] font-mono font-bold shadow-[0_1.5px_0_rgba(0,0,0,0.4)]">V</kbd>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Canvas Mode Toggle Switch */}
                            <div className="flex justify-between items-center pt-2 bg-white/[0.02] p-4 rounded-2xl border border-white/5 mt-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[13px] font-bold text-zinc-100 flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${interactionMode === 'comfyui' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                                        画布模式
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-medium">
                                        {interactionMode === 'comfyui' 
                                            ? '🚀 ComfyUI 模式：滚轮直接缩放，右键/中键拖拽画布' 
                                            : '💡 默认模式：Ctrl+滚轮缩放，Shift+左键或中键拖拽画布'}
                                    </span>
                                </div>

                                <button 
                                    onClick={() => setInteractionMode(m => m === 'default' ? 'comfyui' : 'default')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                        interactionMode === 'comfyui' ? 'bg-emerald-500' : 'bg-zinc-800'
                                    }`}
                                >
                                    <span 
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            interactionMode === 'comfyui' ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* User Guide Tutorial Modal */}
                {isGuideModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center z-[150] bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
                        {/* Overlay Click to Close */}
                        <div className="absolute inset-0" onClick={() => setIsGuideModalOpen(false)} />

                        {/* Modal Box */}
                        <div className="w-[520px] bg-[#141416]/98 border border-white/10 rounded-[28px] shadow-3xl p-8 backdrop-blur-md flex flex-col gap-6 relative z-10 animate-in zoom-in-95 duration-300 text-left">
                            {/* Close Button */}
                            <button 
                                onClick={() => setIsGuideModalOpen(false)} 
                                className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/80 rounded-full transition-all border border-white/5"
                            >
                                <X size={15} />
                            </button>

                            {/* Header */}
                            <div>
                                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                    使用教程
                                </h3>
                                <p className="text-zinc-500 text-[11px] mt-1 font-medium">几步轻松上手 XcAi 智能编排与生成系统，释放无限创意。</p>
                            </div>

                            {/* Steps list */}
                            <div className="flex flex-col gap-4 py-2 border-y border-white/5">
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 animate-pulse">1</div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-zinc-200 text-[13px] font-bold">创建创意描述</span>
                                        <span className="text-zinc-500 text-xs leading-relaxed">双击画布空白处，在弹出菜单中选择“创意描述”创建输入节点，这是生成画面的核心提示词基础。</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">2</div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-zinc-200 text-[13px] font-bold">使用 AI 智能体提效</span>
                                        <span className="text-zinc-500 text-xs leading-relaxed">点击右下角眯眼笑嘴小球，召唤“AI 导演助理”，精选 9 大创作技能磨砂卡片（如电商衣图、网感设计），点击卡片自动填充专业提示词！</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">3</div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-zinc-200 text-[13px] font-bold">连线编排与智能生成</span>
                                        <span className="text-zinc-500 text-xs leading-relaxed">拖动节点连接圆点，将“创意描述”连入“图像生成”或“视频生成”节点。点击生成按钮，高品质素材将直接沉淀到您的左下角资产库。</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">4</div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-zinc-200 text-[13px] font-bold">切换 ComfyUI 交互模式</span>
                                        <span className="text-zinc-500 text-xs leading-relaxed">习惯 ComfyUI 操作？在快捷键面板底部开启“ComfyUI 模式”，直接滑动滚轮缩放画布，右键或中键拖拽画布！</span>
                                    </div>
                                </div>
                            </div>

                            {/* Got it button */}
                            <button 
                                onClick={() => setIsGuideModalOpen(false)} 
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-98"
                            >
                                我知道了
                            </button>
                        </div>
                    </div>
                )}

                {/* Floating AI Assistant Avatar Ball (小彻智能助手悬浮头像球) */}
                {!isChatOpen && (
                    <div className="absolute bottom-8 right-8 flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <button 
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setIsChatOpen(true); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            className="floating-assistant-btn relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-400 flex items-center justify-center cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.7)] hover:shadow-[0_0_45px_rgba(249,115,22,0.95)] hover:scale-110 transition-all duration-300 group animate-[bounce_3s_infinite]"
                            title="小彻智能助手"
                        >
                            {/* Breathing light aura */}
                            <div className="absolute inset-0 rounded-full bg-orange-400/30 animate-ping opacity-75 pointer-events-none duration-1000" />
                            
                            {/* 小彻酷炫卡通头像 Web 图像 */}
                            <img 
                                src={XIAOCHE_AVATAR_BASE64} 
                                alt="小彻智能助手" 
                                className="w-full h-full object-cover rounded-full pointer-events-none transform group-hover:scale-105 transition-transform" 
                            />
                            
                            {/* Hover Tooltip */}
                            <div className="absolute -top-11 scale-0 group-hover:scale-100 transition-all duration-200 px-3 py-1 rounded-xl bg-[#09090b]/90 border border-orange-500/40 text-xs font-bold text-orange-400 whitespace-nowrap shadow-xl">
                                小彻智能助手
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
