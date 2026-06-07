import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clapperboard,
  Clock,
  Copy,
  Download,
  Eraser,
  Eye,
  FileVideo,
  FolderUp,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  Key,
  Loader2,
  Maximize2,
  MoreVertical,
  Mic,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Video,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { blobToBase64, generateImageToImage, generateVideoScript } from '../Cyzx4/services/geminiService';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';

type AssetRole = 'product' | 'scene' | 'character' | 'reference';
type AssetFilter = 'all' | 'image' | 'video' | 'character' | 'scene' | 'uploaded';
type OutputAspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
type AgentDrawer = 'commands' | 'settings' | null;
type SortOrder = 'newest' | 'oldest';
type SourceFilter = 'uploaded' | 'generated';

interface FlowAsset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  role: AssetRole;
  mimeType: string;
  name: string;
  aspectRatio?: string;
}

interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  mimeType: string;
  name: string;
  progress: number;
  aspectRatio?: string;
}

interface ScriptScene {
  time: string;
  visual: string;
  audio: string;
  overlay: string;
  prompt?: string;
}

interface GenerationCard {
  id: string;
  progress: number;
  aspectRatio: OutputAspectRatio;
  kind: 'image' | 'video';
  order: number;
}

interface GeneratedOutput {
  id: string;
  type: 'image' | 'video';
  previewUrl?: string;
  aspectRatio: OutputAspectRatio;
  order: number;
  prompt: string;
  modelLabel: string;
  createdAt: number;
}

const filters: Array<{ id: AssetFilter; label: string; icon: React.ElementType }> = [
  { id: 'all', label: '所有媒体内容', icon: Grid3X3 },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video },
  { id: 'character', label: '角色', icon: UserRound },
  { id: 'scene', label: '场景', icon: Clapperboard },
  { id: 'uploaded', label: '上传的内容', icon: Upload },
];

const roleOptions: Array<{ id: AssetRole; label: string }> = [
  { id: 'product', label: '产品' },
  { id: 'scene', label: '场景' },
  { id: 'character', label: '角色' },
  { id: 'reference', label: '参考' },
];

const imageModelOptions = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', subLabel: '3.1 Flash' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', subLabel: '3 Pro' },
  { id: 'imagen-4', label: 'Imagen 4', subLabel: 'Image' },
];

const videoModelOptions = [
  { id: 'omni-flash', label: 'Omni Flash' },
];

const imageAspectRatios: OutputAspectRatio[] = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const videoAspectRatios: OutputAspectRatio[] = ['9:16', '16:9'];
const durationOptions = ['4s', '6s', '8s', '10s'];

const settingsRows = [
  { label: '光标悬停时播放声音', icon: Volume2 },
  { label: '返回无声视频', icon: Mic },
  { label: '显示功能块详细信息', icon: Eye },
  { label: '提交后清除提示', icon: Eraser },
];

const getMediaAspectRatio = (previewUrl: string, type: 'image' | 'video') => new Promise<string>((resolve) => {
  if (type === 'image') {
    const image = new Image();
    image.onload = () => resolve(`${image.naturalWidth} / ${image.naturalHeight}`);
    image.onerror = () => resolve('4 / 5');
    image.src = previewUrl;
    return;
  }

  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => resolve(`${video.videoWidth || 9} / ${video.videoHeight || 16}`);
  video.onerror = () => resolve('9 / 16');
  video.src = previewUrl;
});

const getAspectValue = (aspectRatio?: string) => {
  if (!aspectRatio) return 0;
  const [width, height] = aspectRatio.split('/').map((part) => Number(part.trim()));
  return width > 0 && height > 0 ? width / height : 0;
};

const getAssetTileStyle = (aspectRatio?: string, fallback = '4 / 5') => {
  const ratio = getAspectValue(aspectRatio || fallback) || getAspectValue(fallback) || 0.8;
  return {
    width: `${Math.round(260 * ratio)}px`,
    height: '260px',
    aspectRatio: aspectRatio || fallback,
  };
};

const StoryboardTab: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentTimerRef = useRef<number | null>(null);
  const generationTimerRef = useRef<number | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement>(null);
  const assetCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [assets, setAssets] = useState<FlowAsset[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [activeFilter, setActiveFilter] = useState<AssetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState('10s');
  const [selectedImageModel, setSelectedImageModel] = useState(imageModelOptions[0].id);
  const [selectedVideoModel, setSelectedVideoModel] = useState(videoModelOptions[0].id);
  const [aspectRatio, setAspectRatio] = useState<OutputAspectRatio>('16:9');
  const [outputKind, setOutputKind] = useState<'image' | 'video'>('image');
  const [sourceKind, setSourceKind] = useState<'frame' | 'asset'>('asset');
  const [variationCount, setVariationCount] = useState(1);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showGenerationPanel, setShowGenerationPanel] = useState(false);
  const [showImageModelMenu, setShowImageModelMenu] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [isAgentTransitioning, setIsAgentTransitioning] = useState(false);
  const [agentDrawer, setAgentDrawer] = useState<AgentDrawer>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [creativePrompt, setCreativePrompt] = useState('');
  const [script, setScript] = useState<ScriptScene[]>([]);
  const [generationCards, setGenerationCards] = useState<GenerationCard[]>([]);
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomAsset, setZoomAsset] = useState<FlowAsset | null>(null);
  const [zoomOutput, setZoomOutput] = useState<GeneratedOutput | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [outputMenuId, setOutputMenuId] = useState<string | null>(null);
  const [favoriteOutputIds, setFavoriteOutputIds] = useState<Set<string>>(new Set());
  const [typeFilters, setTypeFilters] = useState<Set<'image' | 'video'>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Set<AssetRole>>(new Set());
  const [aspectFilters, setAspectFilters] = useState<Set<OutputAspectRatio>>(new Set());
  const [sourceFilters, setSourceFilters] = useState<Set<SourceFilter>>(new Set());
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => () => {
    if (agentTimerRef.current) window.clearTimeout(agentTimerRef.current);
    if (generationTimerRef.current) window.clearInterval(generationTimerRef.current);
  }, []);

  const addFiles = async (files: File[]) => {
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (mediaFiles.length === 0) return;

    const pendingItems = await Promise.all(mediaFiles.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const previewUrl = URL.createObjectURL(file);
      const aspectRatio = await getMediaAspectRatio(previewUrl, type);
      return {
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
        type,
        mimeType: file.type,
        name: file.name,
        progress: 0,
        aspectRatio,
      } satisfies PendingUpload;
    }));

    setPendingUploads((prev) => [...pendingItems, ...prev]);
    setActiveFilter('uploaded');
    setScript([]);
    setError(null);

    pendingItems.forEach((item, index) => {
      const startedAt = window.setTimeout(() => {
        const timer = window.setInterval(() => {
          setPendingUploads((prev) => prev.map((pending) => (
            pending.id === item.id ? { ...pending, progress: Math.min(100, pending.progress + 18 + Math.round(Math.random() * 12)) } : pending
          )));
        }, 160);

        window.setTimeout(() => {
          window.clearInterval(timer);
          setPendingUploads((prev) => prev.filter((pending) => pending.id !== item.id));
          setAssets((prev) => [{
            id: item.id,
            file: item.file,
            previewUrl: item.previewUrl,
            type: item.type,
            role: item.type === 'video' ? 'reference' : 'product',
            mimeType: item.mimeType,
            name: item.name,
            aspectRatio: item.aspectRatio,
          }, ...prev]);
        }, 900 + index * 110);
      }, index * 60);

      return () => window.clearTimeout(startedAt);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  };

  useImagePaste((files) => addFiles(files));

  const counts = useMemo(() => ({
    all: assets.length + pendingUploads.length,
    image: assets.filter((asset) => asset.type === 'image').length + pendingUploads.filter((asset) => asset.type === 'image').length,
    video: assets.filter((asset) => asset.type === 'video').length + pendingUploads.filter((asset) => asset.type === 'video').length,
    character: assets.filter((asset) => asset.role === 'character').length,
    scene: assets.filter((asset) => asset.role === 'scene').length,
    uploaded: assets.length + pendingUploads.length,
  }), [assets, pendingUploads]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = assets.filter((asset) => {
      const matchesFilter =
        activeFilter === 'all' ||
        activeFilter === 'uploaded' ||
        asset.type === activeFilter ||
        asset.role === activeFilter;
      const matchesType = typeFilters.size === 0 || typeFilters.has(asset.type);
      const matchesRole = roleFilters.size === 0 || roleFilters.has(asset.role);
      const matchesSource = sourceFilters.size === 0 || sourceFilters.has('uploaded');
      const matchesSearch = !query || asset.name.toLowerCase().includes(query);
      return matchesFilter && matchesType && matchesRole && matchesSource && matchesSearch;
    });
    return sortOrder === 'newest' ? list : list.slice().reverse();
  }, [activeFilter, assets, roleFilters, searchQuery, sortOrder, sourceFilters, typeFilters]);

  const filteredPendingUploads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pendingUploads.filter((asset) => {
      const matchesFilter = activeFilter === 'all' || activeFilter === 'uploaded' || asset.type === activeFilter;
      const matchesSearch = !query || asset.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, pendingUploads, searchQuery]);

  const filteredGeneratedOutputs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = generatedOutputs.filter((output) => {
      const matchesActive =
        activeFilter === 'all' ||
        output.type === activeFilter ||
        (activeFilter === 'image' && output.type === 'image') ||
        (activeFilter === 'video' && output.type === 'video');
      const matchesType = typeFilters.size === 0 || typeFilters.has(output.type);
      const matchesAspect = aspectFilters.size === 0 || aspectFilters.has(output.aspectRatio);
      const matchesSource = sourceFilters.size === 0 || sourceFilters.has('generated');
      const matchesFavorite = !onlyFavorites || favoriteOutputIds.has(output.id);
      const matchesSearch = !query ||
        output.prompt.toLowerCase().includes(query) ||
        output.modelLabel.toLowerCase().includes(query) ||
        `${output.order}`.includes(query);
      return matchesActive && matchesType && matchesAspect && matchesSource && matchesFavorite && matchesSearch;
    });
    return list.slice().sort((a, b) => sortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
  }, [activeFilter, aspectFilters, favoriteOutputIds, generatedOutputs, onlyFavorites, searchQuery, sortOrder, sourceFilters, typeFilters]);

  const activeFilterCount = typeFilters.size + roleFilters.size + aspectFilters.size + sourceFilters.size + (onlyFavorites ? 1 : 0) + (sortOrder === 'oldest' ? 1 : 0);

  const totalAssetCount = assets.length + pendingUploads.length;
  const centerOffsetClass = isSidebarCollapsed ? 'lg:-translate-x-8' : 'lg:-translate-x-[120px]';
  const centerLeftClass = isSidebarCollapsed ? 'lg:left-[calc(50%-32px)]' : 'lg:left-[calc(50%-120px)]';
  const selectedImageModelLabel = imageModelOptions.find((option) => option.id === selectedImageModel)?.label || 'Nano Banana 2';
  const selectedVideoModelLabel = videoModelOptions.find((option) => option.id === selectedVideoModel)?.label || 'Omni Flash';
  const canGenerate = creativePrompt.trim().length > 0 || assets.length > 0;
  const hasGenerationView = generationCards.length > 0 || generatedOutputs.length > 0;
  const generationGridClass = ['9:16', '3:4'].includes(aspectRatio)
    ? 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))] max-w-6xl'
    : aspectRatio === '1:1'
      ? 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-w-6xl'
      : 'grid-cols-[repeat(auto-fill,minmax(min(520px,100%),1fr))] max-w-[1440px]';
  const linkPanelItems = useMemo(() => ([
    ...assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      previewUrl: asset.previewUrl,
      role: asset.role,
    })),
    ...generatedOutputs.map((output) => ({
      id: output.id,
      name: `${output.modelLabel} #${output.order}`,
      type: output.type,
      previewUrl: output.previewUrl || '',
      role: 'reference' as AssetRole,
    })),
    ...script.map((scene, index) => ({
      id: `scene-${index}`,
      name: scene.overlay || `分镜 ${index + 1}`,
      type: 'storyboard' as const,
      previewUrl: '',
      role: 'reference' as AssetRole,
    })),
  ]), [assets, generatedOutputs, script]);

  const handleAgentClick = () => {
    if (agentTimerRef.current) window.clearTimeout(agentTimerRef.current);

    if (isAgentActive) {
      setIsAgentActive(false);
      setIsAgentTransitioning(false);
      setAgentDrawer(null);
      return;
    }

    setShowLinkPanel(false);
    setShowAddMenu(false);
    setShowSettingsPanel(false);
    setShowGenerationPanel(false);
    setShowImageModelMenu(false);
    setIsAgentActive(true);
    setIsAgentTransitioning(true);
    setAgentDrawer(null);

    agentTimerRef.current = window.setTimeout(() => {
      setIsAgentTransitioning(false);
      setAgentDrawer('commands');
    }, 900);
  };

  const updateAssetRole = (id: string, role: AssetRole) => {
    setAssets((prev) => prev.map((asset) => (asset.id === id ? { ...asset, role } : asset)));
  };

  const toggleSetValue = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clearAllFilters = () => {
    setTypeFilters(new Set());
    setRoleFilters(new Set());
    setAspectFilters(new Set());
    setSourceFilters(new Set());
    setOnlyFavorites(false);
    setSortOrder('newest');
  };

  const removeAsset = (id: string) => {
    setAssets((prev) => {
      const target = prev.find((asset) => asset.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((asset) => asset.id !== id);
    });
    setScript([]);
  };

  const downloadGeneratedOutput = (output: GeneratedOutput) => {
    if (!output.previewUrl) return;
    const link = document.createElement('a');
    link.href = output.previewUrl;
    link.download = `video-factory-${output.type}-${output.order}.${output.type === 'image' ? 'png' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const appendPromptFromOutput = (output: GeneratedOutput) => {
    setCreativePrompt((current) => current.trim() ? `${current.trim()}\n${output.prompt}` : output.prompt);
  };

  const copyGeneratedPrompt = async (output: GeneratedOutput) => {
    await navigator.clipboard.writeText(output.prompt);
    setCopiedIndex(output.order);
    window.setTimeout(() => setCopiedIndex(null), 1200);
  };

  const removeGeneratedOutput = (id: string) => {
    setGeneratedOutputs((prev) => prev.filter((output) => output.id !== id));
    setFavoriteOutputIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOutputMenuId(null);
  };

  const handleGenerate = async () => {
    if (!canGenerate || isLoading) return;
    setIsLoading(true);
    setError(null);
    setShowGenerationPanel(false);
    setShowLinkPanel(false);
    setGeneratedOutputs([]);

    const count = variationCount;
    const prompt = creativePrompt.trim() || '基于上传素材生成一组适合电商投放的创意视频分镜。';
    const modelLabel = outputKind === 'image' ? selectedImageModelLabel : selectedVideoModelLabel;
    const nextCards = Array.from({ length: count }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      progress: 0,
      aspectRatio,
      kind: outputKind,
      order: index + 1,
    } satisfies GenerationCard));
    setGenerationCards(nextCards);

    if (generationTimerRef.current) window.clearInterval(generationTimerRef.current);
    generationTimerRef.current = window.setInterval(() => {
      setGenerationCards((prev) => prev.map((card) => ({
        ...card,
        progress: Math.min(92, card.progress + 7 + Math.round(Math.random() * 9)),
      })));
    }, 260);

    try {
      const payload = await Promise.all(assets.slice(0, 12).map(async (asset) => ({
        base64: await blobToBase64(asset.file),
        mimeType: asset.mimeType,
        name: asset.name,
        role: asset.role,
        type: asset.type,
      })));

      if (outputKind === 'image') {
        const resultImages = await generateImageToImage(
          payload.filter((asset) => asset.type === 'image').map((asset) => ({
            base64: asset.base64,
            mimeType: asset.mimeType,
          })),
          prompt,
          {
            aspectRatio: aspectRatio as AspectRatio,
            resolution: ImageResolution.RES_2K,
            modelId: selectedImageModel,
            sampleCount: count,
          }
        );

        const createdAt = Date.now();
        const outputs = resultImages.slice(0, count).map((url, index) => ({
          id: `${Date.now()}-image-${index}`,
          type: 'image' as const,
          previewUrl: url,
          aspectRatio,
          order: index + 1,
          prompt,
          modelLabel,
          createdAt: createdAt + index,
        }));

        setGenerationCards((prev) => prev.map((card) => ({ ...card, progress: 100 })));
        window.setTimeout(() => {
          setGeneratedOutputs(outputs);
          setGenerationCards([]);
          setActiveFilter('image');
        }, 450);
      } else {
        const result = await generateVideoScript(
          payload,
          duration,
          `model=${selectedVideoModel}; output=${outputKind}; aspect=${aspectRatio}; variations=${variationCount}; source=${sourceKind}`,
          prompt
        );

        const nextScript = Array.isArray(result) ? result : [];
        setScript(nextScript);
        setGenerationCards((prev) => prev.map((card) => ({ ...card, progress: 100 })));
        window.setTimeout(() => {
          const createdAt = Date.now();
          setGeneratedOutputs(nextCards.map((card, index) => ({
            id: `${Date.now()}-video-${index}`,
            type: 'video' as const,
            aspectRatio,
            order: index + 1,
            prompt: nextScript[index]?.prompt || prompt,
            modelLabel,
            createdAt: createdAt + index,
          })));
          setGenerationCards([]);
          setActiveFilter('video');
        }, 450);
      }
    } catch {
      setGenerationCards([]);
      setError(outputKind === 'image' ? '图片生成失败，请检查模型、提示词或 API 密钥后重试。' : '生成分镜失败，请检查素材、模型或 API 密钥后重试。');
    } finally {
      if (generationTimerRef.current) window.clearInterval(generationTimerRef.current);
      setIsLoading(false);
    }
  };

  const copyScenePrompt = async (scene: ScriptScene, index: number) => {
    const text = scene.prompt || `${scene.time}\n画面：${scene.visual}\n声音：${scene.audio}\n字幕：${scene.overlay}`;
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1200);
  };

  const downloadAsset = (asset: FlowAsset) => {
    const link = document.createElement('a');
    link.href = asset.previewUrl;
    link.download = asset.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateSelectionFromPointer = (clientX: number, clientY: number) => {
    if (!selectionStart || !selectionContainerRef.current) return;
    const containerRect = selectionContainerRef.current.getBoundingClientRect();
    const left = Math.min(selectionStart.clientX, clientX);
    const top = Math.min(selectionStart.clientY, clientY);
    const right = Math.max(selectionStart.clientX, clientX);
    const bottom = Math.max(selectionStart.clientY, clientY);

    setSelectionRect({
      x: Math.min(selectionStart.x, clientX - containerRect.left),
      y: Math.min(selectionStart.y, clientY - containerRect.top),
      width: Math.abs(clientX - selectionStart.clientX),
      height: Math.abs(clientY - selectionStart.clientY),
    });

    const nextSelected = new Set<string>();
    Object.entries(assetCardRefs.current).forEach(([id, element]) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const intersects = rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top;
      if (intersects) nextSelected.add(id);
    });
    setSelectedAssetIds(nextSelected);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !selectionContainerRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select')) return;
    const containerRect = selectionContainerRef.current.getBoundingClientRect();
    setSelectionStart({
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    setSelectionRect({ x: event.clientX - containerRect.left, y: event.clientY - containerRect.top, width: 0, height: 0 });
    setSelectedAssetIds(new Set());
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionStart) return;
    event.preventDefault();
    updateSelectionFromPointer(event.clientX, event.clientY);
  };

  const handleCanvasMouseUp = () => {
    setSelectionStart(null);
    setSelectionRect(null);
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) setIsDraggingFiles(true);
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  };

  const renderPendingTile = (asset: PendingUpload, compact = false) => (
    <div
      key={asset.id}
      className={`relative shrink-0 rounded-lg overflow-hidden bg-[#17181a] border border-white/10 shadow-sm ${compact ? '' : ''}`}
      style={compact ? { aspectRatio: asset.aspectRatio || (asset.type === 'video' ? '9 / 16' : '4 / 5') } : getAssetTileStyle(asset.aspectRatio, asset.type === 'video' ? '9 / 16' : '4 / 5')}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-500 to-slate-950 opacity-80" />
      <div className="absolute inset-0 backdrop-blur-sm" />
      <div className="absolute left-3 top-3 text-white/70">
        {asset.type === 'video' ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
      </div>
      <div className="absolute right-3 top-3 text-white/80 text-sm font-black">{asset.progress}%</div>
      <div className="absolute left-3 right-3 bottom-3">
        <div className="h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white/80 transition-all duration-200" style={{ width: `${asset.progress}%` }} />
        </div>
      </div>
    </div>
  );

  const renderAssetTile = (asset: FlowAsset, compact = false) => {
    const selected = selectedAssetIds.has(asset.id);
    return (
    <div
      key={asset.id}
      ref={(element) => {
        if (!compact) assetCardRefs.current[asset.id] = element;
      }}
      className={`group relative shrink-0 rounded-lg overflow-hidden bg-[#151618] border transition-all ${
        selected && !compact ? 'border-white ring-2 ring-white/25' : 'border-white/10 hover:border-white/30'
      }`}
      style={compact ? undefined : getAssetTileStyle(asset.aspectRatio, asset.type === 'video' ? '9 / 16' : '4 / 5')}
    >
        <button
          onClick={() => setZoomAsset(asset)}
          className="block w-full h-full bg-[#101113] overflow-hidden"
          style={{ aspectRatio: compact ? '4 / 5' : asset.aspectRatio || (asset.type === 'video' ? '9 / 16' : '4 / 5') }}
        >
        {asset.type === 'image' ? (
          <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <video src={asset.previewUrl} className="w-full h-full object-cover" muted playsInline />
        )}
      </button>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/75 via-transparent to-black/15 opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="absolute left-2 bottom-2 right-2 flex items-center gap-1.5 text-white">
        {asset.type === 'video' ? <Video className="w-3.5 h-3.5 shrink-0 drop-shadow" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0 drop-shadow" />}
        <span className="text-[11px] font-black truncate drop-shadow" title={asset.name}>{asset.name}</span>
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 border border-white/10 p-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur">
        <button
          onClick={(event) => event.stopPropagation()}
          className="w-7 h-7 rounded-full text-white/75 hover:bg-white/15 hover:text-white flex items-center justify-center"
          title="收藏"
        >
          <Heart className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(event) => event.stopPropagation()}
          className="w-7 h-7 rounded-full text-white/75 hover:bg-white/15 hover:text-white flex items-center justify-center"
          title="更多"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="hidden absolute left-2 top-2 h-7 px-2 rounded-full bg-black/70 border border-white/15 text-white/90 text-[10px] font-black items-center gap-1 shadow-sm backdrop-blur">
        {asset.type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
        {asset.type === 'video' ? '视频' : '图片'}
      </div>
      <button
        onClick={() => removeAsset(asset.id)}
        className="hidden absolute right-2 top-2 w-7 h-7 rounded-full bg-black/70 text-white/60 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-all items-center justify-center backdrop-blur"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {false && !compact && (
        <div className="p-3 space-y-2">
          <div className="text-xs font-bold text-white truncate" title={asset.name}>{asset.name}</div>
          <div className="grid grid-cols-2 gap-1">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                onClick={() => updateAssetRole(asset.id, role.id)}
                className={`h-7 rounded-md text-[10px] font-bold border transition-all ${
                  asset.role === role.id
                    ? 'bg-[#56575a] text-white border-[#56575a]'
                    : 'bg-[#202124] text-white/55 border-white/10 hover:text-white hover:border-white/25'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="h-full bg-black text-white overflow-hidden flex font-sans">
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-60'} shrink-0 bg-black border-r border-white/10 flex flex-col transition-all duration-300`}>
        <div className={`${isSidebarCollapsed ? 'px-3 justify-center' : 'px-4'} h-16 flex items-center gap-3`}>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-10 h-10 rounded-full text-white hover:bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`min-w-0 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            <div className="text-sm font-black truncate">视频工厂</div>
            <div className="text-[11px] text-white/45">Flow 工作台</div>
          </div>
          <button className={`ml-auto w-8 h-8 rounded-full text-white/55 hover:bg-white/10 hover:text-white items-center justify-center ${isSidebarCollapsed ? 'hidden' : 'flex'}`}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <nav className="px-3 py-2 space-y-1">
          {filters.map((filter) => {
            const Icon = filter.icon;
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                title={isSidebarCollapsed ? filter.label : undefined}
                className={`w-full h-12 px-3 rounded-xl flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} text-sm font-bold transition-all ${
                  active ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3"><Icon className="w-4 h-4 shrink-0" /><span className={isSidebarCollapsed ? 'hidden' : 'inline'}>{filter.label}</span></span>
                <span className={`text-[10px] text-white/35 ${isSidebarCollapsed ? 'hidden' : 'inline'}`}>{counts[filter.id]}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-5 px-3 pt-4 border-t border-white/15">
          <button title={isSidebarCollapsed ? '工具' : undefined} className={`w-full h-11 rounded-xl flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white`}>
            <WandSparkles className="w-4 h-4 shrink-0" /><span className={isSidebarCollapsed ? 'hidden' : 'inline'}>工具</span>
          </button>
        </div>
        <div className="mt-auto px-3 pb-4 pt-3 border-t border-white/15 space-y-1">
          <button title={isSidebarCollapsed ? '回收站' : undefined} className={`w-full h-11 rounded-xl flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white`}>
            <Trash2 className="w-4 h-4 shrink-0" /><span className={isSidebarCollapsed ? 'hidden' : 'inline'}>回收站</span>
          </button>
          <button
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            title={isSidebarCollapsed ? '展开' : '收起'}
            className={`w-full h-11 rounded-xl flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white`}
          >
            <ArrowLeft className={`w-4 h-4 shrink-0 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
            <span className={isSidebarCollapsed ? 'hidden' : 'inline'}>收起</span>
          </button>
        </div>
      </aside>

      <main
        className={`flex-1 min-w-0 relative overflow-hidden bg-black ${isDraggingFiles ? 'bg-white/[0.03]' : ''}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={handleCanvasDrop}
      >
        <div className="h-16 px-6 flex items-center gap-3 relative z-30">
          <div className={`relative w-[min(520px,45vw)] mx-auto transition-transform duration-300 ${centerOffsetClass}`}>
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-white/45" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索资源"
              className="w-full h-10 rounded-2xl border border-white/10 bg-[#1b1b1d] pl-12 pr-12 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-2 focus:ring-white/10"
            />
            <button
              onClick={() => { setShowFilterPanel((value) => !value); setShowAddMenu(false); setShowSettingsPanel(false); setShowGenerationPanel(false); setShowImageModelMenu(false); }}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                showFilterPanel || activeFilterCount > 0
                  ? 'bg-[#3a3b3e] text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title="筛选"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-3.5 h-3.5 px-1 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => { setShowFilterPanel((value) => !value); setShowAddMenu(false); setShowSettingsPanel(false); setShowGenerationPanel(false); setShowImageModelMenu(false); }}
            className={`hidden relative w-10 h-10 rounded-2xl border items-center justify-center transition-colors ${
              showFilterPanel || activeFilterCount > 0
                ? 'bg-[#2f3033] border-white/15 text-white'
                : 'bg-[#1b1b1d] border-white/10 text-white/80 hover:bg-[#2a2a2d] hover:text-white'
            }`}
            title="筛选条件"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setShowAddMenu((value) => !value); setShowFilterPanel(false); setShowSettingsPanel(false); setShowGenerationPanel(false); setShowImageModelMenu(false); }}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors ${
              showAddMenu
                ? 'bg-[#2f3033] border-white/10 text-white'
                : 'bg-[#1b1b1d] border-white/10 text-white hover:bg-[#2a2a2d]'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setShowSettingsPanel((value) => !value); setShowFilterPanel(false); setShowAddMenu(false); setShowGenerationPanel(false); setShowImageModelMenu(false); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              showSettingsPanel ? 'bg-[#1f2022] text-white' : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-full bg-[#1f2022] text-white/75 flex items-center justify-center hover:bg-[#2c2d30] hover:text-white transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
          {showAddMenu && (
            <div className="absolute right-20 top-14 w-48 rounded-2xl bg-[#18191b] border border-white/10 shadow-2xl p-2">
              {[
                { label: '上传媒体', icon: Upload, action: () => fileInputRef.current?.click() },
                { label: '创建集合', icon: FolderUp, action: () => undefined },
                { label: '创建角色', icon: UserRound, action: () => setActiveFilter('character') },
                { label: '创建场景', icon: Clapperboard, action: () => setActiveFilter('scene') },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); setShowAddMenu(false); }}
                    className="w-full h-10 px-3 rounded-xl text-left text-xs font-black text-white/90 hover:bg-[#3d3e41] flex items-center gap-3"
                  >
                    <Icon className="w-4 h-4" />{item.label}
                  </button>
                );
              })}
            </div>
          )}
          {showFilterPanel && (
            <div className="absolute left-1/2 top-14 w-[336px] -translate-x-1/2 rounded-2xl bg-[#1b1c1e]/98 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <SlidersHorizontal className="w-4 h-4" />过滤条件
                </div>
                <button onClick={clearAllFilters} className="text-[11px] font-black text-white/45 hover:text-white">重置</button>
              </div>

              <div className="p-4 space-y-4">
                <section>
                  <div className="text-[11px] font-black text-white/35 mb-2">类型</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'image' as const, label: '图片', icon: ImageIcon },
                      { id: 'video' as const, label: '视频', icon: Video },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = typeFilters.has(item.id);
                      return (
                        <button key={item.id} onClick={() => toggleSetValue(setTypeFilters, item.id)} className={`h-9 px-3 rounded-lg border text-xs font-black flex items-center gap-2 ${active ? 'bg-white text-black border-white' : 'bg-[#222325] text-white/75 border-white/10 hover:text-white'}`}>
                          <Icon className="w-3.5 h-3.5" />{item.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="text-[11px] font-black text-white/35 mb-2">角色/来源</div>
                  <div className="grid grid-cols-2 gap-2">
                    {roleOptions.map((role) => {
                      const active = roleFilters.has(role.id);
                      return (
                        <button key={role.id} onClick={() => toggleSetValue(setRoleFilters, role.id)} className={`h-9 px-3 rounded-lg border text-xs font-black text-left ${active ? 'bg-white text-black border-white' : 'bg-[#222325] text-white/75 border-white/10 hover:text-white'}`}>
                          {role.label}
                        </button>
                      );
                    })}
                    {[
                      { id: 'uploaded' as const, label: '已上传' },
                      { id: 'generated' as const, label: '已生成' },
                    ].map((source) => {
                      const active = sourceFilters.has(source.id);
                      return (
                        <button key={source.id} onClick={() => toggleSetValue(setSourceFilters, source.id)} className={`h-9 px-3 rounded-lg border text-xs font-black text-left ${active ? 'bg-white text-black border-white' : 'bg-[#222325] text-white/75 border-white/10 hover:text-white'}`}>
                          {source.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="text-[11px] font-black text-white/35 mb-2">宽高比</div>
                  <div className="grid grid-cols-5 gap-1 rounded-xl bg-[#222325] p-1">
                    {imageAspectRatios.map((ratio) => (
                      <button key={ratio} onClick={() => toggleSetValue(setAspectFilters, ratio)} className={`h-9 rounded-lg text-[11px] font-black ${aspectFilters.has(ratio) ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}>
                        {ratio}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOnlyFavorites((value) => !value)} className={`h-9 px-3 rounded-lg border text-xs font-black flex items-center justify-center gap-2 ${onlyFavorites ? 'bg-white text-black border-white' : 'bg-[#222325] text-white/75 border-white/10 hover:text-white'}`}>
                    <Heart className="w-3.5 h-3.5" />收藏
                  </button>
                  <div className="grid grid-cols-2 rounded-lg bg-[#222325] p-1 border border-white/10">
                    <button onClick={() => setSortOrder('newest')} className={`h-7 rounded-md text-[11px] font-black ${sortOrder === 'newest' ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}>最新</button>
                    <button onClick={() => setSortOrder('oldest')} className={`h-7 rounded-md text-[11px] font-black ${sortOrder === 'oldest' ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}>最早</button>
                  </div>
                </section>
              </div>

              <div className="h-12 px-4 border-t border-white/10 flex items-center justify-between text-xs font-black text-white/70">
                <span>{filteredAssets.length + filteredPendingUploads.length + filteredGeneratedOutputs.length} 条结果</span>
                <button onClick={() => setShowFilterPanel(false)} className="h-8 px-3 rounded-lg bg-white text-black hover:bg-white/90">完成</button>
              </div>
            </div>
          )}
          {showSettingsPanel && (
            <div className="absolute right-16 top-14 w-[304px] rounded-2xl bg-[#1b1c1e] border border-white/10 shadow-2xl p-3">
              <div className="text-[11px] font-black text-white/45 mb-2 px-1">视图模式</div>
              <div className="grid grid-cols-2 rounded-xl bg-[#222325] p-1">
                <button className="h-9 rounded-lg text-xs font-black flex items-center justify-center gap-2 bg-[#56575a] text-white">
                  <Grid3X3 className="w-3.5 h-3.5" />网格
                </button>
                <button className="h-9 rounded-lg text-xs font-black flex items-center justify-center gap-2 text-white/75 hover:text-white">
                  <Grid3X3 className="w-3.5 h-3.5" />批量
                </button>
              </div>

              <div className="text-[11px] font-black text-white/45 mt-4 mb-2 px-1">网格大小</div>
              <div className="grid grid-cols-3 rounded-xl bg-[#222325] p-1">
                {['S', 'M', 'L'].map((size) => (
                  <button key={size} className={`h-9 rounded-lg text-xs font-black ${size === 'M' ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>
                    {size}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {settingsRows.map((row, index) => {
                  const Icon = row.icon;
                  const enabled = index === settingsRows.length - 1;
                  return (
                    <div key={row.label} className="grid grid-cols-[24px_1fr_120px] items-center gap-2">
                      <Icon className="w-5 h-5 text-white/85" />
                      <div className="text-xs font-black text-white/85 whitespace-nowrap">{row.label}</div>
                      <div className="grid grid-cols-2 rounded-xl bg-[#222325] p-1">
                        <button className={`h-8 rounded-lg text-xs font-black ${enabled ? 'text-white/75 hover:text-white' : 'bg-[#56575a] text-white'}`}>
                          已关闭
                        </button>
                        <button className={`h-8 rounded-lg text-xs font-black ${enabled ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>
                          已开启
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar px-6 pb-40">
          {totalAssetCount === 0 && script.length === 0 && !hasGenerationView ? (
            <div
              className={`h-full min-h-[520px] w-full flex flex-col items-center justify-center text-center transition-all duration-300 ${centerOffsetClass} ${
                isDraggingFiles ? 'scale-[1.01]' : ''
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 shadow-sm flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="text-lg font-black text-white/80">开始创建或拖放媒体</div>
              <div className="text-sm text-white/35 mt-2">上传产品、角色、场景图，再用底部输入框生成分镜</div>
              {isDraggingFiles && (
                <div className="mt-6 h-11 px-5 rounded-full bg-[#1b1c1e] border border-white/20 text-white text-sm font-black flex items-center gap-2 shadow-sm">
                  <Upload className="w-4 h-4" />松开鼠标开始上传
                </div>
              )}
            </div>
          ) : (
            <>
              {hasGenerationView && (
                <section className="pt-2 mb-8">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">{isLoading ? '正在生成' : '生成结果'}</h2>
                      <p className="text-xs text-white/40 mt-1">
                        {isLoading ? '按当前比例生成，完成后会自动排序。' : `已按 ${aspectRatio} 和生成顺序排列。`}
                      </p>
                    </div>
                    <span className="h-8 px-3 rounded-full bg-[#252629] border border-white/10 text-xs font-black text-white/65 flex items-center gap-2">
                      {outputKind === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                      {outputKind === 'image' ? selectedImageModelLabel : selectedVideoModelLabel}
                    </span>
                  </div>
                  <div className={`grid ${generationGridClass} gap-4 mx-auto`}>
                    {generationCards.slice().sort((a, b) => a.order - b.order).map((card) => (
                      <article
                        key={card.id}
                        className="relative overflow-hidden rounded-xl border border-white/10 bg-[#161719]"
                        style={{ aspectRatio: card.aspectRatio.replace(':', ' / ') }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(125deg,#111315,#5b5f63,#202326,#8c8f91,#151719)] bg-[length:220%_220%] animate-pulse" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
                        <div className="absolute left-4 top-4 text-white/65">
                          {card.kind === 'image' ? <ImageIcon className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                        </div>
                        <div className="absolute right-4 top-4 text-lg font-black text-white/65">{card.progress}%</div>
                        <div className="absolute left-4 right-4 bottom-4">
                          <div className="h-1.5 rounded-full bg-black/35 overflow-hidden">
                            <div className="h-full bg-white/75 transition-all duration-300" style={{ width: `${card.progress}%` }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] font-black text-white/55">
                            <span>#{card.order}</span>
                            <span>{card.aspectRatio}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                    {generationCards.length === 0 && filteredGeneratedOutputs.map((output) => (
                      <article
                        key={output.id}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#151617] hover:border-white/30 transition-all cursor-zoom-in"
                        style={{ aspectRatio: output.aspectRatio.replace(':', ' / ') }}
                        onClick={() => setZoomOutput(output)}
                      >
                        {output.previewUrl ? (
                          <img src={output.previewUrl} alt={output.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1c1f] via-[#4e5255] to-[#101214]">
                            <Video className="w-10 h-10 text-white/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        <div className="absolute left-3 top-3 h-7 px-2 rounded-full bg-black/60 border border-white/10 text-[11px] font-black text-white/80 flex items-center gap-1">
                          #{output.order} {output.aspectRatio}
                        </div>
                        <div className="absolute right-3 top-3 h-7 px-2 rounded-full bg-black/60 border border-white/10 text-[11px] font-black text-white/80 transition-opacity group-hover:opacity-0">
                          100%
                        </div>
                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(event) => event.stopPropagation()}>
                          <button
                            onClick={() => setFavoriteOutputIds((current) => {
                              const next = new Set(current);
                              if (next.has(output.id)) next.delete(output.id);
                              else next.add(output.id);
                              return next;
                            })}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center backdrop-blur ${favoriteOutputIds.has(output.id) ? 'bg-white text-black border-white' : 'bg-white/75 text-black border-white/20 hover:bg-white'}`}
                            title="收藏"
                          >
                            <Heart className={`w-4 h-4 ${favoriteOutputIds.has(output.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => appendPromptFromOutput(output)}
                            className="w-8 h-8 rounded-lg bg-white/75 text-black border border-white/20 hover:bg-white flex items-center justify-center backdrop-blur"
                            title="添加到提示"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setOutputMenuId((id) => id === output.id ? null : output.id)}
                            className="w-8 h-8 rounded-lg bg-white/75 text-black border border-white/20 hover:bg-white flex items-center justify-center backdrop-blur"
                            title="更多"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>

                        {outputMenuId === output.id && (
                          <div className="absolute right-3 top-12 w-48 rounded-xl bg-[#1b1c1e]/98 border border-white/10 shadow-2xl overflow-hidden z-20 backdrop-blur" onClick={(event) => event.stopPropagation()}>
                            {[
                              { label: '添加动画效果', icon: WandSparkles, action: () => { setOutputKind('video'); appendPromptFromOutput(output); setShowGenerationPanel(true); } },
                              { label: '添加到提示', icon: Plus, action: () => appendPromptFromOutput(output) },
                              { label: '下载', icon: Download, action: () => downloadGeneratedOutput(output) },
                              { label: '复制提示', icon: Copy, action: () => copyGeneratedPrompt(output) },
                              { label: '分享', icon: ArrowRight, action: () => copyGeneratedPrompt(output) },
                            ].map((item) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={item.label}
                                  onClick={() => { item.action(); setOutputMenuId(null); }}
                                  className="w-full h-10 px-3 text-left text-xs font-black text-white/85 hover:bg-white/10 flex items-center gap-3"
                                >
                                  <Icon className="w-4 h-4" />{item.label}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => removeGeneratedOutput(output.id)}
                              className="w-full h-10 px-3 text-left text-xs font-black text-red-400 hover:bg-red-500/15 flex items-center gap-3 border-t border-white/10"
                            >
                              <Trash2 className="w-4 h-4" />移至回收站
                            </button>
                          </div>
                        )}
                        <div className="absolute left-3 bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-[11px] font-black text-white/80 line-clamp-2">{output.prompt}</div>
                          {copiedIndex === output.order && <div className="mt-1 text-[10px] font-black text-emerald-300">已复制</div>}
                        </div>
                      </article>
                    ))}
                    {generationCards.length === 0 && generatedOutputs.length > 0 && filteredGeneratedOutputs.length === 0 && (
                      <div className="col-span-full h-56 rounded-2xl border border-dashed border-white/15 bg-[#101113] flex flex-col items-center justify-center text-center">
                        <SlidersHorizontal className="w-10 h-10 text-white/25 mb-3" />
                        <div className="text-sm font-black text-white">没有符合筛选的生成结果</div>
                        <button onClick={clearAllFilters} className="mt-3 h-8 px-3 rounded-lg bg-white text-black text-xs font-black">清空筛选</button>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {!hasGenerationView && (
                <section
                  ref={selectionContainerRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="pt-2 relative select-none"
                >
                  <div className="hidden mb-4 items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">{filters.find((item) => item.id === activeFilter)?.label || '所有媒体内容'}</h2>
                      <p className="text-xs text-white/40 mt-1">上传后会自动进入素材库，可按图片、视频、角色、场景或上传内容筛选。</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 px-4 rounded-full bg-[#3a3a3a] text-white text-sm font-black flex items-center gap-2 hover:bg-[#4a4a4a] shadow-sm"
                    >
                      <Plus className="w-4 h-4" />添加素材
                    </button>
                  </div>

                  {filteredAssets.length > 0 || filteredPendingUploads.length > 0 ? (
                    <div className="flex flex-wrap items-start gap-4">
                      {filteredPendingUploads.map((asset) => renderPendingTile(asset))}
                      {filteredAssets.map((asset) => renderAssetTile(asset))}
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-[360px] w-full rounded-2xl border border-dashed border-white/15 bg-[#101113] flex flex-col items-center justify-center text-center"
                    >
                      <Sparkles className="w-12 h-12 text-white/25 mb-3" />
                      <div className="text-sm font-black text-white">未找到任何结果</div>
                      <div className="text-xs text-white/40 mt-2">换一个分类，或继续上传图片和视频素材。</div>
                    </button>
                  )}
                  {selectionRect && (
                    <div
                      className="pointer-events-none absolute z-30 border border-white bg-white/15 rounded-lg"
                      style={{
                        left: selectionRect.x,
                        top: selectionRect.y,
                        width: selectionRect.width,
                        height: selectionRect.height,
                      }}
                    />
                  )}
                </section>
              )}

              {!hasGenerationView && script.length > 0 && (
                <section className="mt-8">
                  <div className="mb-4">
                    <h2 className="text-lg font-black flex items-center gap-2 text-white">
                      <Clapperboard className="w-5 h-5 text-white/75" />分镜面板
                    </h2>
                    <p className="text-xs text-white/40 mt-1">每张卡片都可以作为后续图片或视频生成 prompt 的起点。</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {script.map((scene, index) => (
                      <article key={`${scene.time}-${index}`} className="bg-[#151618] border border-white/10 rounded-lg shadow-sm overflow-hidden">
                        <div className="h-36 bg-[#101113] border-b border-white/10 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-[#1b1c1e] border border-white/10 flex items-center justify-center">
                            <Clapperboard className="w-7 h-7 text-white/75" />
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="h-7 px-2.5 rounded-full bg-[#303134] text-white text-xs font-black flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />{scene.time}
                            </span>
                            <button
                              onClick={() => copyScenePrompt(scene, index)}
                              className="w-8 h-8 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 flex items-center justify-center"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div><div className="text-[11px] font-black text-white/40 mb-1">画面</div><p className="text-sm text-white/85 leading-relaxed">{scene.visual}</p></div>
                          <div><div className="text-[11px] font-black text-white/40 mb-1">声音</div><p className="text-sm text-white/55 leading-relaxed">{scene.audio}</p></div>
                          <div className="rounded-xl bg-black border border-white/10 p-3 text-sm font-bold text-white/85">{scene.overlay}</div>
                          {copiedIndex === index && <div className="text-[11px] text-green-600 font-bold">已复制到剪贴板</div>}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className={`absolute left-1/2 ${centerLeftClass} bottom-5 -translate-x-1/2 w-[min(640px,calc(100%-3rem))] transition-[left] duration-300`}>
          {showLinkPanel && (
            <div className="absolute left-1/2 bottom-[102px] -translate-x-1/2 w-[min(780px,calc(100vw-18rem))] rounded-[22px] bg-[#171819] border border-white/10 shadow-2xl p-3 z-20">
              <div className="flex items-center gap-2 mb-3">
                <button className="h-9 px-3 rounded-full text-white/65 text-xs font-black flex items-center gap-2">
                  6月06日 <ArrowRight className="w-3 h-3 rotate-90" />
                </button>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索资源"
                    className="w-full h-10 rounded-xl bg-[#2a2b2e] border border-white/10 pl-10 pr-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>
                <button className="h-10 px-4 rounded-xl bg-[#2a2b2e] border border-white/10 text-xs font-bold text-white/70 flex items-center gap-2">
                  最近 <ArrowRight className="w-3 h-3 rotate-90" />
                </button>
              </div>
              <div className="grid grid-cols-[128px_1fr_38%] gap-3 h-[500px]">
                <div className="relative space-y-1">
                  {[
                    { id: 'all' as AssetFilter, label: '全部', icon: Grid3X3 },
                    { id: 'image' as AssetFilter, label: '图片', icon: ImageIcon },
                    { id: 'video' as AssetFilter, label: '视频', icon: Video },
                    { id: 'scene' as AssetFilter, label: '分镜', icon: Clapperboard },
                    { id: 'character' as AssetFilter, label: '角色', icon: UserRound },
                    { id: 'uploaded' as AssetFilter, label: '上传的内容', icon: Upload },
                  ].map((filter) => {
                    const Icon = filter.icon;
                    const active = activeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`w-full h-9 px-3 rounded-lg flex items-center justify-between text-xs font-black ${
                          active ? 'bg-[#56575a] text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{filter.label}</span>
                        <span className="text-[10px]">{filter.id === 'scene' ? script.length : counts[filter.id]}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-1 bottom-0 h-9 px-3 rounded-lg text-xs font-black text-white hover:bg-white/10 flex items-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />上传媒体
                  </button>
                </div>

                <div className="rounded-2xl bg-[#151617] flex items-center justify-center overflow-hidden">
                  {linkPanelItems.length === 0 && filteredPendingUploads.length === 0 ? (
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 mx-auto text-white/35 mb-3" />
                      <div className="text-sm font-black text-white">未找到任何结果</div>
                    </div>
                  ) : (
                    <div className="w-full h-full grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar p-3">
                      {filteredPendingUploads.slice(0, 12).map((asset) => renderPendingTile(asset, true))}
                      {linkPanelItems.slice(0, 16).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            const found = assets.find((asset) => asset.id === item.id);
                            if (found) setZoomAsset(found);
                          }}
                          className="group relative aspect-[4/5] rounded-lg overflow-hidden bg-[#232427] border border-white/10 text-left hover:border-white/30"
                        >
                          {item.type === 'image' ? (
                            <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : item.type === 'video' ? (
                            <video src={item.previewUrl} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Clapperboard className="w-8 h-8 text-white/50" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="text-[11px] font-black text-white truncate">{item.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-[#222325] border border-white/5 flex items-center justify-center text-center px-6">
                  {filteredAssets[0] ? (
                    <button onClick={() => setZoomAsset(filteredAssets[0])} className="w-full h-full rounded-xl overflow-hidden">
                      {filteredAssets[0].type === 'image' ? (
                        <img src={filteredAssets[0].previewUrl} alt={filteredAssets[0].name} className="w-full h-full object-cover" />
                      ) : (
                        <video src={filteredAssets[0].previewUrl} className="w-full h-full object-cover" muted playsInline />
                      )}
                    </button>
                  ) : (
                    <div>
                      <Sparkles className="w-12 h-12 mx-auto text-white/20 mb-3" />
                      <div className="text-sm font-black text-white/80">预览区域</div>
                      <div className="text-xs text-white/35 mt-2">上传后这里会显示当前素材预览</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showGenerationPanel && !isAgentActive && (
            <div className="absolute right-9 bottom-[72px] w-[280px] rounded-[18px] bg-[#171819] border border-white/10 shadow-2xl p-2 z-20">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#222325] p-1">
                <button
                  onClick={() => { setOutputKind('image'); setAspectRatio('16:9'); }}
                  className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${outputKind === 'image' ? 'bg-white text-black' : 'text-white/75 hover:text-white'}`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />图片
                </button>
                <button
                  onClick={() => { setOutputKind('video'); setAspectRatio('16:9'); setShowImageModelMenu(false); }}
                  className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${outputKind === 'video' ? 'bg-white text-black' : 'text-white/75 hover:text-white'}`}
                >
                  <Video className="w-3.5 h-3.5" />视频
                </button>
              </div>

              {outputKind === 'video' && (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#222325] p-1 mt-1">
                  <button
                    onClick={() => setSourceKind('frame')}
                    className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${sourceKind === 'frame' ? 'bg-white text-black' : 'text-white/75 hover:text-white'}`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />帧
                  </button>
                  <button
                    onClick={() => setSourceKind('asset')}
                    className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${sourceKind === 'asset' ? 'bg-white text-black' : 'text-white/75 hover:text-white'}`}
                  >
                    <FolderUp className="w-3.5 h-3.5" />素材
                  </button>
                </div>
              )}

              <div className={`grid gap-1 rounded-xl bg-[#222325] p-1 mt-1 ${outputKind === 'image' ? 'grid-cols-5' : 'grid-cols-2'}`}>
                {(outputKind === 'image' ? imageAspectRatios : videoAspectRatios).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`h-12 rounded-xl text-xs font-black ${aspectRatio === ratio ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}
                  >
                    <span className="block text-[10px] mb-0.5">▭</span>{ratio}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#222325] p-1 mt-1">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setVariationCount(count)}
                    className={`h-9 rounded-xl text-xs font-black ${variationCount === count ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}
                  >
                    x{count}
                  </button>
                ))}
              </div>

              {outputKind === 'image' ? (
                <>
                  <button
                    onClick={() => setShowImageModelMenu((value) => !value)}
                    className="mt-1 w-full h-10 rounded-xl bg-[#222325] px-3 text-xs font-black text-white flex items-center justify-between"
                  >
                    {imageModelOptions.find((option) => option.id === selectedImageModel)?.label || 'Nano Banana 2'}
                    <ArrowRight className={`w-3 h-3 text-white/60 transition-transform ${showImageModelMenu ? '-rotate-90' : 'rotate-90'}`} />
                  </button>
                  {showImageModelMenu && (
                    <div className="mt-1 rounded-xl bg-[#191a1c] p-1">
                      {imageModelOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSelectedImageModel(option.id);
                            setShowImageModelMenu(false);
                          }}
                          className={`w-full h-10 rounded-lg px-3 text-left text-xs font-black flex items-center gap-2 ${
                            selectedImageModel === option.id ? 'bg-[#343538] text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button className="mt-1 w-full h-10 rounded-xl bg-[#222325] px-3 text-xs font-black text-white flex items-center justify-between">
                    {videoModelOptions.find((option) => option.id === selectedVideoModel)?.label || 'Omni Flash'}
                    <ArrowRight className="w-3 h-3 rotate-90 text-white/60" />
                  </button>
                  <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#222325] p-1 mt-1">
                    {durationOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => setDuration(option)}
                        className={`h-9 rounded-xl text-xs font-black ${duration === option ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className={`relative overflow-hidden bg-[#191a1c]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[22px] p-3 transition-all duration-500 ${
            isAgentActive ? 'shadow-white/10 ring-1 ring-white/15' : ''
          }`}>
            {isAgentTransitioning && (
              <div className="pointer-events-none absolute inset-0 opacity-90">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.04),rgba(255,255,255,0.2),rgba(120,120,120,0.1),rgba(255,255,255,0.04))] animate-pulse" />
                <div className="absolute -inset-y-10 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-xl animate-[spin_1.2s_linear_infinite]" />
              </div>
            )}
            {isAgentActive && !isAgentTransitioning && (
              <div className="pointer-events-none absolute inset-0 opacity-60">
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/12 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] via-white/[0.01] to-white/[0.04]" />
              </div>
            )}
            {error && (
              <div className="relative mb-3 p-3 rounded-xl bg-red-500/10 border border-red-400/20 text-red-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">{error}</div>
                {error.includes('API') && (
                  <button onClick={() => (window as any).aistudio?.openSelectKey()} className="text-xs font-bold inline-flex items-center gap-1">
                    <Key className="w-3 h-3" />切换密钥
                  </button>
                )}
              </div>
            )}
            <textarea
              value={creativePrompt}
              onChange={(event) => setCreativePrompt(event.target.value)}
              placeholder="你希望创作什么内容？"
              rows={creativePrompt.length > 180 ? 8 : 2}
              className="relative w-full max-h-[260px] resize-none overflow-y-auto custom-scrollbar bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/25"
            />
            <div className="relative flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => { setShowLinkPanel((value) => !value); setShowAddMenu(false); setShowSettingsPanel(false); setShowGenerationPanel(false); setShowImageModelMenu(false); }}
                className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                  showLinkPanel ? 'bg-[#404044] border-white/15 text-white' : 'border-white/10 text-white/60 hover:text-white hover:border-white/25'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleAgentClick}
                className={`h-9 px-4 rounded-full border text-xs font-black flex items-center gap-1 transition-all ${
                  isAgentActive && !isAgentTransitioning
                    ? 'bg-white text-black border-white shadow-lg shadow-white/15'
                    : 'bg-[#252629] border-white/10 text-white/65 hover:text-white hover:border-white/25'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAgentActive && !isAgentTransitioning ? 'text-black' : 'text-white/75'}`} />智能体
              </button>
              {isAgentActive && !isAgentTransitioning && (
                <div className="ml-auto flex items-center gap-2 text-white/55">
                  <button
                    onClick={() => setAgentDrawer('commands')}
                    className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${agentDrawer === 'commands' ? 'text-white bg-white/10' : ''}`}
                    title="智能体指令"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setAgentDrawer('settings')}
                    className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${agentDrawer === 'settings' ? 'text-white bg-white/10' : ''}`}
                    title="智能体设置"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              )}
              {!isAgentActive && (
                <button
                  onClick={() => {
                    setShowGenerationPanel((value) => !value);
                    setShowSettingsPanel(false);
                    setShowAddMenu(false);
                    setShowLinkPanel(false);
                    setShowImageModelMenu(false);
                  }}
                  className={`ml-auto h-9 px-3 rounded-full border text-xs font-black flex items-center gap-2 ${
                    showGenerationPanel ? 'bg-[#404044] border-white/15 text-white' : 'bg-[#252629] border-white/10 text-white/70'
                  }`}
                >
                  {outputKind === 'image' ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      {selectedImageModelLabel}
                      <span className="text-white/45">▭</span>
                      {aspectRatio}
                      <span className="text-white/45">·</span>
                      {variationCount}x
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5 text-white/55" />
                      {selectedVideoModelLabel}
                      <span className="text-white/45">▭</span>
                      {aspectRatio}
                      <span className="text-white/45">·</span>
                      {duration}
                      <span className="text-white/45">·</span>
                      {variationCount}x
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isLoading}
                className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all ${
                  !canGenerate || isLoading ? 'bg-[#26272a] text-white/25 cursor-not-allowed' : 'bg-white text-black hover:bg-white/90 shadow-sm shadow-white/10'
                }`}
                title="生成"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      <aside
        className={`fixed right-3 top-20 bottom-3 z-40 w-80 rounded-2xl bg-[#191a1b] border border-white/10 shadow-2xl transition-transform duration-500 ease-out ${
          agentDrawer ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        {agentDrawer === 'commands' && (
          <div className="h-full flex flex-col p-2">
            <div className="h-12 px-3 flex items-center gap-3">
              <button onClick={() => setAgentDrawer(null)} className="w-8 h-8 rounded-full text-white/65 hover:bg-white/10 hover:text-white flex items-center justify-center">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-base font-black text-white">智能体指令</div>
            </div>
            <button className="h-10 rounded-lg border border-white/35 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-white/10">
              <Plus className="w-4 h-4" />添加指令
            </button>
            <div className="flex-1" />
            <button onClick={() => setAgentDrawer(null)} className="h-10 rounded-xl bg-white text-black text-xs font-black hover:bg-white/90">
              完成
            </button>
          </div>
        )}

        {agentDrawer === 'settings' && (
          <div className="h-full flex flex-col p-2">
            <div className="h-12 px-3 flex items-center gap-3">
              <button onClick={() => setAgentDrawer(null)} className="w-8 h-8 rounded-full text-white/65 hover:bg-white/10 hover:text-white flex items-center justify-center">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-base font-black text-white">智能体设置</div>
            </div>

            <div className="px-1 py-2 space-y-5 overflow-y-auto custom-scrollbar">
              <section>
                <div className="text-xs font-black text-white/45 mb-2">生成前先确认</div>
                <div className="space-y-2">
                  {[
                    { title: '始终', desc: '智能体将在生成媒体内容之前征求确认。', active: true },
                    { title: '永不', desc: '智能体将自动生成媒体内容并消耗点数。', active: false },
                  ].map((item) => (
                    <button key={item.title} className={`w-full rounded-lg p-3 text-left flex gap-2 ${item.active ? 'bg-[#242527]' : 'hover:bg-white/5'}`}>
                      <span className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${item.active ? 'border-white' : 'border-white/60'}`}>
                        {item.active && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <span>
                        <span className="block text-sm font-black text-white">{item.title}</span>
                        <span className="block text-[11px] text-white/45 mt-0.5">{item.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="text-xs font-black text-white/45 mb-2">图片生成默认设置</div>
                <div className="grid grid-cols-5 rounded-xl bg-[#222325] p-1">
                  {imageAspectRatios.map((ratio, index) => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`h-14 rounded-lg text-xs font-black ${index === 0 ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>
                      <span className="block text-[10px] mb-1">▭</span>{ratio}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 rounded-xl bg-[#222325] p-1 mt-1">
                  {[1, 2, 3, 4].map((count) => (
                    <button key={count} onClick={() => setVariationCount(count)} className={`h-9 rounded-lg text-xs font-black ${variationCount === count ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>x{count}</button>
                  ))}
                </div>
                <button className="mt-1 w-full h-9 rounded-xl bg-[#222325] px-3 text-xs font-black text-white flex items-center justify-between">
                  Nano Banana 2 <ArrowRight className="w-3 h-3 rotate-90 text-white/60" />
                </button>
              </section>

              <section>
                <div className="text-xs font-black text-white/45 mb-2">视频生成默认设置</div>
                <div className="grid grid-cols-2 rounded-xl bg-[#222325] p-1">
                  {videoAspectRatios.map((ratio) => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`h-14 rounded-lg text-xs font-black ${ratio === '16:9' ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>
                      <span className="block text-[10px] mb-1">▭</span>{ratio}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 rounded-xl bg-[#222325] p-1 mt-1">
                  {[1, 2, 3, 4].map((count) => (
                    <button key={count} onClick={() => setVariationCount(count)} className={`h-9 rounded-lg text-xs font-black ${count === 1 ? 'bg-[#56575a] text-white' : 'text-white/75 hover:text-white'}`}>x{count}</button>
                  ))}
                </div>
                <button className="mt-1 w-full h-9 rounded-xl bg-[#222325] px-3 text-xs font-black text-white flex items-center justify-between">
                  Omni Flash <ArrowRight className="w-3 h-3 rotate-90 text-white/60" />
                </button>
              </section>
            </div>

            <button onClick={() => setAgentDrawer(null)} className="mt-auto h-10 rounded-xl bg-white text-black text-xs font-black hover:bg-white/90">
              保存
            </button>
          </div>
        )}
      </aside>

      {zoomAsset && (
        <div className="hidden fixed inset-0 bg-black/85 z-50 items-center justify-center p-6" onClick={() => setZoomAsset(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setZoomAsset(null)} className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-[#242528] text-white shadow-lg flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            {zoomAsset.type === 'image' ? (
              <img src={zoomAsset.previewUrl} alt={zoomAsset.name} className="max-h-[84vh] max-w-full rounded-lg shadow-2xl object-contain border border-white/10" />
            ) : (
              <video src={zoomAsset.previewUrl} className="max-h-[84vh] max-w-full rounded-lg shadow-2xl border border-white/10" controls autoPlay />
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button onClick={() => downloadAsset(zoomAsset)} className="h-10 px-4 rounded-full bg-[#242528] text-white text-sm font-bold flex items-center gap-2 shadow-sm">
                <Download className="w-4 h-4" />下载素材
              </button>
              <button onClick={() => setZoomAsset(null)} className="h-10 px-4 rounded-full bg-[#3a3a3d] text-white text-sm font-bold flex items-center gap-2 shadow-sm">
                <Maximize2 className="w-4 h-4" />返回工作台
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomAsset && (
        <div className="fixed inset-0 bg-black z-50 text-white">
          <div className="absolute left-0 right-0 top-0 h-16 px-6 flex items-center justify-between z-20">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => setZoomAsset(null)} className="w-9 h-9 rounded-full text-white hover:bg-white/10 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-sm font-black truncate max-w-[360px]">{zoomAsset.name}</div>
              <button className="w-8 h-8 rounded-full text-white/85 hover:bg-white/10 flex items-center justify-center" title="信息">
                <AlertCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute left-1/2 top-4 -translate-x-1/2 flex items-center gap-1.5">
              {assets.slice(0, 8).map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setZoomAsset(asset)}
                  className={`w-7 h-7 rounded-md overflow-hidden border ${asset.id === zoomAsset.id ? 'border-white' : 'border-white/20 hover:border-white/60'}`}
                  title={asset.name}
                >
                  {asset.type === 'image' ? (
                    <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <video src={asset.previewUrl} className="w-full h-full object-cover" muted playsInline />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full text-white hover:bg-white/10 flex items-center justify-center" title="收藏">
                <Heart className="w-4 h-4" />
              </button>
              <button onClick={() => downloadAsset(zoomAsset)} className="w-9 h-9 rounded-full text-white hover:bg-white/10 flex items-center justify-center" title="下载">
                <Download className="w-4 h-4" />
              </button>
              <button className="h-10 px-4 rounded-full bg-[#1d1e20] text-xs font-black text-white hover:bg-[#2a2b2d]">隐藏历史记录</button>
              <button onClick={() => setZoomAsset(null)} className="h-10 px-4 rounded-full bg-white text-xs font-black text-black hover:bg-white/90">完成</button>
            </div>
          </div>

          <div className="absolute left-0 top-16 bottom-0 w-20 flex flex-col items-center justify-center gap-6">
            <button className="w-10 h-10 rounded-full text-white/85 hover:bg-white/10 flex items-center justify-center" title="裁剪">
              <Maximize2 className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full bg-[#242528] text-white flex items-center justify-center" title="选择">
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full text-white/85 hover:bg-white/10 flex items-center justify-center" title="编辑">
              <WandSparkles className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-0 pt-16 pb-48 px-28 flex items-center justify-center">
            {zoomAsset.type === 'image' ? (
              <img src={zoomAsset.previewUrl} alt={zoomAsset.name} className="max-h-full max-w-[min(760px,58vw)] rounded-xl object-contain shadow-2xl bg-[#101113]" />
            ) : (
              <video src={zoomAsset.previewUrl} className="max-h-full max-w-[min(760px,58vw)] rounded-xl shadow-2xl bg-[#101113]" controls autoPlay />
            )}
          </div>

          <div className="absolute right-8 top-24 bottom-24 w-64 border-l border-white/5 pl-6 flex flex-col justify-end">
            <button className="w-36 rounded-xl overflow-hidden border-2 border-white bg-[#101113] shadow-lg" style={{ aspectRatio: zoomAsset.aspectRatio || (zoomAsset.type === 'video' ? '9 / 16' : '4 / 5') }}>
              {zoomAsset.type === 'image' ? (
                <img src={zoomAsset.previewUrl} alt={zoomAsset.name} className="w-full h-full object-cover" />
              ) : (
                <video src={zoomAsset.previewUrl} className="w-full h-full object-cover" muted playsInline />
              )}
            </button>
          </div>

          <div className="absolute left-1/2 bottom-5 -translate-x-1/2 w-[min(620px,calc(100%-3rem))] rounded-[20px] bg-[#171819] border border-white/10 shadow-2xl p-3">
            <textarea
              value={creativePrompt}
              onChange={(event) => setCreativePrompt(event.target.value)}
              placeholder="您想要更改什么？"
              className="w-full h-12 resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full border border-white/10 text-white/75 hover:bg-white/10 hover:text-white flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 rounded-full bg-[#232426] border border-white/10 text-[11px] font-black text-white/70">Nano Banana Pro</button>
                <button onClick={handleGenerate} disabled={!canGenerate || isLoading} className="w-9 h-9 rounded-full bg-[#242528] text-white/65 disabled:opacity-40 hover:bg-white hover:text-black flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomOutput && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6" onClick={() => setZoomOutput(null)}>
          <div className="relative max-w-5xl max-h-[92vh] flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setZoomOutput(null)} className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-[#242528] text-white shadow-lg flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            {zoomOutput.previewUrl ? (
              zoomOutput.type === 'image' ? (
                <img src={zoomOutput.previewUrl} alt={zoomOutput.prompt} className="max-h-[82vh] max-w-full rounded-lg shadow-2xl object-contain border border-white/10 bg-[#101113]" />
              ) : (
                <video src={zoomOutput.previewUrl} className="max-h-[82vh] max-w-full rounded-lg shadow-2xl border border-white/10 bg-[#101113]" controls autoPlay />
              )
            ) : (
              <div className="w-[min(720px,80vw)] aspect-video rounded-lg border border-white/10 bg-gradient-to-br from-[#1a1c1f] via-[#4e5255] to-[#101214] flex items-center justify-center">
                <Video className="w-12 h-12 text-white/50" />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => appendPromptFromOutput(zoomOutput)} className="h-10 px-4 rounded-full bg-[#242528] text-white text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-[#303134]">
                <Plus className="w-4 h-4" />添加到提示
              </button>
              <button onClick={() => downloadGeneratedOutput(zoomOutput)} className="h-10 px-4 rounded-full bg-[#242528] text-white text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-[#303134]">
                <Download className="w-4 h-4" />下载
              </button>
              <button onClick={() => copyGeneratedPrompt(zoomOutput)} className="h-10 px-4 rounded-full bg-[#3a3a3d] text-white text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-[#46464a]">
                <Copy className="w-4 h-4" />复制提示
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardTab;
