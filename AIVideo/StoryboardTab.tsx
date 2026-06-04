import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clapperboard,
  Clock,
  Copy,
  Download,
  FileVideo,
  Filter,
  FolderUp,
  Grid3X3,
  Image as ImageIcon,
  Key,
  Loader2,
  Maximize2,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Video,
  WandSparkles,
  X,
} from 'lucide-react';
import { blobToBase64, generateVideoScript } from '../Cyzx4/services/geminiService';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';

type AssetRole = 'product' | 'scene' | 'character' | 'reference';
type AssetFilter = 'all' | 'image' | 'video' | 'character' | 'scene' | 'uploaded';
type OutputAspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16';

interface FlowAsset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  role: AssetRole;
  mimeType: string;
  name: string;
}

interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  mimeType: string;
  name: string;
  progress: number;
}

interface ScriptScene {
  time: string;
  visual: string;
  audio: string;
  overlay: string;
  prompt?: string;
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
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', subLabel: '3.1 Flash' },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', subLabel: '3 Pro' },
];

const videoModelOptions = [
  { id: 'omni-flash', label: 'Omni Flash' },
];

const imageAspectRatios: OutputAspectRatio[] = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const videoAspectRatios: OutputAspectRatio[] = ['9:16', '16:9'];
const durationOptions = ['4s', '6s', '8s', '10s'];

const StoryboardTab: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionContainerRef = useRef<HTMLDivElement>(null);
  const assetCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [assets, setAssets] = useState<FlowAsset[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [activeFilter, setActiveFilter] = useState<AssetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState('10s');
  const [selectedImageModel, setSelectedImageModel] = useState(imageModelOptions[0].id);
  const [selectedVideoModel, setSelectedVideoModel] = useState(videoModelOptions[0].id);
  const [aspectRatio, setAspectRatio] = useState<OutputAspectRatio>('9:16');
  const [outputKind, setOutputKind] = useState<'image' | 'video'>('video');
  const [sourceKind, setSourceKind] = useState<'frame' | 'asset'>('asset');
  const [variationCount, setVariationCount] = useState(1);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [creativePrompt, setCreativePrompt] = useState('');
  const [script, setScript] = useState<ScriptScene[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomAsset, setZoomAsset] = useState<FlowAsset | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const addFiles = (files: File[]) => {
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (mediaFiles.length === 0) return;

    const pendingItems = mediaFiles.map((file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      return {
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type,
        mimeType: file.type,
        name: file.name,
        progress: 0,
      } satisfies PendingUpload;
    });

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
    return assets.filter((asset) => {
      const matchesFilter =
        activeFilter === 'all' ||
        activeFilter === 'uploaded' ||
        asset.type === activeFilter ||
        asset.role === activeFilter;
      const matchesSearch = !query || asset.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, assets, searchQuery]);

  const filteredPendingUploads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pendingUploads.filter((asset) => {
      const matchesFilter = activeFilter === 'all' || activeFilter === 'uploaded' || asset.type === activeFilter;
      const matchesSearch = !query || asset.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, pendingUploads, searchQuery]);

  const totalAssetCount = assets.length + pendingUploads.length;

  const updateAssetRole = (id: string, role: AssetRole) => {
    setAssets((prev) => prev.map((asset) => (asset.id === id ? { ...asset, role } : asset)));
  };

  const removeAsset = (id: string) => {
    setAssets((prev) => {
      const target = prev.find((asset) => asset.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((asset) => asset.id !== id);
    });
    setScript([]);
  };

  const handleGenerate = async () => {
    if (assets.length === 0 || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload = await Promise.all(assets.slice(0, 12).map(async (asset) => ({
        base64: await blobToBase64(asset.file),
        mimeType: asset.mimeType,
        name: asset.name,
        role: asset.role,
        type: asset.type,
      })));

      const result = await generateVideoScript(
        payload,
        duration,
        `model=${outputKind === 'image' ? selectedImageModel : selectedVideoModel}; output=${outputKind}; aspect=${aspectRatio}; variations=${variationCount}; source=${sourceKind}`,
        creativePrompt || '基于上传素材生成一组适合电商投放的创意视频分镜。'
      );

      setScript(Array.isArray(result) ? result : []);
    } catch {
      setError('生成分镜失败，请检查素材、模型或 API 密钥后重试。');
    } finally {
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

  const renderPendingTile = (asset: PendingUpload) => (
    <div key={asset.id} className="relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/20 shadow-sm aspect-[5/7]">
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
      className={`group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition-all ${
        selected && !compact ? 'border-pastel-highlight ring-4 ring-pastel-highlight/20' : 'border-pastel-border'
      }`}
    >
      <button onClick={() => setZoomAsset(asset)} className={`block w-full bg-white overflow-hidden ${compact ? 'aspect-[4/5]' : 'aspect-[5/7]'}`}>
        {asset.type === 'image' ? (
          <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <video src={asset.previewUrl} className="w-full h-full object-cover" muted playsInline />
        )}
      </button>
      <div className="absolute left-2 top-2 h-7 px-2 rounded-full bg-white/90 border border-white/70 text-[10px] font-black flex items-center gap-1 shadow-sm">
        {asset.type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
        {asset.type === 'video' ? '视频' : '图片'}
      </div>
      <button
        onClick={() => removeAsset(asset.id)}
        className="absolute right-2 top-2 w-7 h-7 rounded-full bg-white/90 text-pastel-muted opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex items-center justify-center"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {!compact && (
        <div className="p-3 space-y-2">
          <div className="text-xs font-bold text-pastel-text truncate" title={asset.name}>{asset.name}</div>
          <div className="grid grid-cols-2 gap-1">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                onClick={() => updateAssetRole(asset.id, role.id)}
                className={`h-7 rounded-md text-[10px] font-bold border transition-all ${
                  asset.role === role.id
                    ? 'bg-pastel-highlight text-white border-pastel-highlight'
                    : 'bg-pastel-card text-pastel-muted border-pastel-border hover:text-pastel-highlight'
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
    <div className="h-full bg-pastel-bg text-pastel-text overflow-hidden flex">
      <aside className="w-60 shrink-0 bg-white border-r border-pastel-border flex flex-col">
        <div className="h-16 px-4 flex items-center gap-3">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-10 h-10 rounded-full text-pastel-text hover:bg-pastel-bg flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-black truncate">分镜创作</div>
            <div className="text-[11px] text-pastel-muted">Flow 工作台</div>
          </div>
          <button className="ml-auto w-8 h-8 rounded-full text-pastel-muted hover:bg-pastel-bg flex items-center justify-center">
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
                className={`w-full h-12 px-3 rounded-xl flex items-center justify-between text-sm font-bold transition-all ${
                  active ? 'bg-pastel-pink text-pastel-text shadow-sm' : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-text'
                }`}
              >
                <span className="flex items-center gap-3"><Icon className="w-4 h-4" />{filter.label}</span>
                <span className="text-[10px] text-pastel-muted">{counts[filter.id]}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-5 px-3 pt-4 border-t border-pastel-border">
          <button className="w-full h-11 rounded-xl flex items-center gap-3 px-3 text-sm font-bold text-pastel-muted hover:bg-pastel-bg">
            <WandSparkles className="w-4 h-4" />工具
          </button>
        </div>
        <div className="mt-auto px-3 pb-4 pt-3 border-t border-pastel-border">
          <button className="w-full h-11 rounded-xl flex items-center gap-3 px-3 text-sm font-bold text-pastel-muted hover:bg-pastel-bg">
            <Trash2 className="w-4 h-4" />回收站
          </button>
        </div>
      </aside>

      <main
        className={`flex-1 min-w-0 relative overflow-hidden ${isDraggingFiles ? 'bg-pastel-highlight/5' : ''}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={handleCanvasDrop}
      >
        <div className="h-16 px-6 flex items-center gap-3">
          <div className="relative w-[min(520px,45vw)] mx-auto">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-pastel-muted" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索资源"
              className="w-full h-11 rounded-full border border-pastel-border bg-white pl-12 pr-4 text-sm outline-none focus:border-pastel-highlight focus:ring-2 focus:ring-pastel-highlight/10 shadow-sm"
            />
          </div>
          <button className="w-11 h-11 rounded-full bg-white border border-pastel-border flex items-center justify-center text-pastel-muted hover:text-pastel-highlight shadow-sm">
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowAddMenu((value) => !value); setShowSettingsPanel(false); }}
            className="w-11 h-11 rounded-full bg-pastel-highlight text-white flex items-center justify-center shadow-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button className="w-11 h-11 rounded-full bg-white border border-pastel-border flex items-center justify-center text-pastel-muted hover:text-pastel-highlight shadow-sm">
            <Settings className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
        </div>

        <div className="h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar px-6 pb-40">
          {totalAssetCount === 0 && script.length === 0 ? (
            <div
              className={`h-full min-h-[520px] w-full flex flex-col items-center justify-center text-center transition-all ${
                isDraggingFiles ? 'scale-[1.01]' : ''
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white border border-pastel-border shadow-sm flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-pastel-highlight" />
              </div>
              <div className="text-lg font-black text-pastel-text">开始创建或拖放媒体</div>
              <div className="text-sm text-pastel-muted mt-2">上传产品、角色、场景图，再用底部输入框生成分镜</div>
              {isDraggingFiles && (
                <div className="mt-6 h-11 px-5 rounded-full bg-white border border-pastel-highlight/40 text-pastel-highlight text-sm font-black flex items-center gap-2 shadow-sm">
                  <Upload className="w-4 h-4" />松开鼠标开始上传
                </div>
              )}
            </div>
          ) : (
            <>
              <section
                ref={selectionContainerRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="pt-2 relative select-none"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black">{filters.find((item) => item.id === activeFilter)?.label || '所有媒体内容'}</h2>
                    <p className="text-xs text-pastel-muted mt-1">上传后会自动进入素材库，可按图片、视频、角色、场景或上传内容筛选。</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-4 rounded-full bg-pastel-highlight text-white text-sm font-black flex items-center gap-2 hover:bg-orange-600 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />添加素材
                  </button>
                </div>

                {filteredAssets.length > 0 || filteredPendingUploads.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 gap-4">
                    {filteredPendingUploads.map((asset) => renderPendingTile(asset))}
                    {filteredAssets.map((asset) => renderAssetTile(asset))}
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-[360px] w-full rounded-3xl border border-dashed border-pastel-border bg-white/70 flex flex-col items-center justify-center text-center"
                  >
                    <Sparkles className="w-12 h-12 text-pastel-muted/40 mb-3" />
                    <div className="text-sm font-black text-pastel-text">未找到任何结果</div>
                    <div className="text-xs text-pastel-muted mt-2">换一个分类，或继续上传图片和视频素材。</div>
                  </button>
                )}
                {selectionRect && (
                  <div
                    className="pointer-events-none absolute z-30 border border-pastel-highlight bg-pastel-highlight/15 rounded-lg"
                    style={{
                      left: selectionRect.x,
                      top: selectionRect.y,
                      width: selectionRect.width,
                      height: selectionRect.height,
                    }}
                  />
                )}
              </section>

              {script.length > 0 && (
                <section className="mt-8">
                  <div className="mb-4">
                    <h2 className="text-lg font-black flex items-center gap-2">
                      <Clapperboard className="w-5 h-5 text-pastel-highlight" />分镜面板
                    </h2>
                    <p className="text-xs text-pastel-muted mt-1">每张卡片都可以作为后续图片或视频生成 prompt 的起点。</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {script.map((scene, index) => (
                      <article key={`${scene.time}-${index}`} className="bg-white border border-pastel-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="h-36 bg-pastel-card border-b border-pastel-border flex items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-white border border-pastel-border flex items-center justify-center">
                            <Clapperboard className="w-7 h-7 text-pastel-highlight" />
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="h-7 px-2.5 rounded-full bg-pastel-pink text-pastel-text text-xs font-black flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />{scene.time}
                            </span>
                            <button
                              onClick={() => copyScenePrompt(scene, index)}
                              className="w-8 h-8 rounded-full border border-pastel-border text-pastel-muted hover:text-pastel-highlight hover:border-pastel-highlight/40 flex items-center justify-center"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div><div className="text-[11px] font-black text-pastel-muted mb-1">画面</div><p className="text-sm text-pastel-text leading-relaxed">{scene.visual}</p></div>
                          <div><div className="text-[11px] font-black text-pastel-muted mb-1">声音</div><p className="text-sm text-pastel-muted leading-relaxed">{scene.audio}</p></div>
                          <div className="rounded-xl bg-pastel-bg border border-pastel-border p-3 text-sm font-bold text-pastel-text">{scene.overlay}</div>
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

        <div className="absolute left-1/2 bottom-5 -translate-x-1/2 w-[min(640px,calc(100%-3rem))]">
          {showAddMenu && (
            <div className="absolute left-1/2 bottom-[118px] -translate-x-1/2 w-[min(780px,calc(100vw-18rem))] rounded-2xl bg-white border border-pastel-border shadow-2xl p-3 z-20">
              <div className="flex items-center gap-2 mb-3">
                <button className="h-9 px-3 rounded-full bg-pastel-pink text-pastel-text text-xs font-black">今天</button>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pastel-muted" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索资源"
                    className="w-full h-9 rounded-xl bg-pastel-card border border-pastel-border pl-9 pr-3 text-xs outline-none focus:border-pastel-highlight"
                  />
                </div>
                <button className="h-9 px-3 rounded-xl bg-pastel-card border border-pastel-border text-xs font-bold text-pastel-muted">最近</button>
              </div>
              <div className="grid grid-cols-[140px_1fr_38%] gap-3 h-[520px]">
                <div className="relative space-y-1">
                  {filters.map((filter) => {
                    const Icon = filter.icon;
                    const active = activeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`w-full h-9 px-3 rounded-lg flex items-center justify-between text-xs font-black ${
                          active ? 'bg-pastel-pink text-pastel-text' : 'text-pastel-muted hover:bg-pastel-bg'
                        }`}
                      >
                        <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{filter.label}</span>
                        <span className="text-[10px]">{counts[filter.id]}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-1 bottom-0 h-9 px-3 rounded-lg text-xs font-black text-pastel-highlight hover:bg-pastel-bg flex items-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />上传媒体
                  </button>
                </div>

                <div className="rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  {filteredAssets.length === 0 && filteredPendingUploads.length === 0 ? (
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 mx-auto text-pastel-muted/40 mb-3" />
                      <div className="text-sm font-black text-pastel-text">未找到任何结果</div>
                    </div>
                  ) : (
                    <div className="w-full h-full grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1">
                      {filteredPendingUploads.slice(0, 12).map((asset) => renderPendingTile(asset))}
                      {filteredAssets.slice(0, 12).map((asset) => renderAssetTile(asset, true))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-pastel-card border border-pastel-border flex items-center justify-center text-center px-6">
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
                      <Sparkles className="w-12 h-12 mx-auto text-pastel-muted/30 mb-3" />
                      <div className="text-sm font-black text-pastel-text">预览区域</div>
                      <div className="text-xs text-pastel-muted mt-2">上传后这里会显示当前素材预览</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showSettingsPanel && (
            <div className="absolute right-16 bottom-[72px] w-72 rounded-2xl bg-white border border-pastel-border shadow-2xl p-2 z-20">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setOutputKind('image'); setAspectRatio('9:16'); }} className={`h-9 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 ${outputKind === 'image' ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>
                  <ImageIcon className="w-3.5 h-3.5" />图片
                </button>
                <button onClick={() => { setOutputKind('video'); setAspectRatio('9:16'); }} className={`h-9 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 ${outputKind === 'video' ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>
                  <FileVideo className="w-3.5 h-3.5" />视频
                </button>
              </div>

              {outputKind === 'video' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => setSourceKind('frame')} className={`h-9 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 ${sourceKind === 'frame' ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>
                    <Grid3X3 className="w-3.5 h-3.5" />帧
                  </button>
                  <button onClick={() => setSourceKind('asset')} className={`h-9 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 ${sourceKind === 'asset' ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>
                    <FolderUp className="w-3.5 h-3.5" />素材
                  </button>
                </div>
              )}

              <div className={`grid gap-2 mt-2 ${outputKind === 'image' ? 'grid-cols-5' : 'grid-cols-2'}`}>
                {(outputKind === 'image' ? imageAspectRatios : videoAspectRatios).map((ratio) => (
                  <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`h-11 rounded-xl text-xs font-black border ${aspectRatio === ratio ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>{ratio}</button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2">
                {[1, 2, 3, 4].map((count) => (
                  <button key={count} onClick={() => setVariationCount(count)} className={`h-9 rounded-xl text-xs font-black border ${variationCount === count ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>x{count}</button>
                ))}
              </div>

              {outputKind === 'image' ? (
                <select
                  value={selectedImageModel}
                  onChange={(event) => setSelectedImageModel(event.target.value)}
                  className="mt-2 w-full h-9 rounded-xl bg-pastel-card border border-pastel-border px-3 text-xs font-black text-pastel-text outline-none"
                >
                  {imageModelOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label} · {option.subLabel}</option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    value={selectedVideoModel}
                    onChange={(event) => setSelectedVideoModel(event.target.value)}
                    className="mt-2 w-full h-9 rounded-xl bg-pastel-card border border-pastel-border px-3 text-xs font-black text-pastel-text outline-none"
                  >
                    {videoModelOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {durationOptions.map((option) => (
                      <button key={option} onClick={() => setDuration(option)} className={`h-9 rounded-xl text-xs font-black border ${duration === option ? 'bg-pastel-pink border-pastel-border' : 'bg-pastel-card border-pastel-border'}`}>{option}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-xl border border-pastel-border shadow-xl rounded-2xl p-3">
            {error && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-2">
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
              rows={2}
              className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-pastel-muted/70"
            />
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-pastel-border">
              <button
                onClick={() => { setShowAddMenu((value) => !value); setShowSettingsPanel(false); }}
                className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                  showAddMenu ? 'bg-pastel-pink border-pastel-border text-pastel-text' : 'border-pastel-border text-pastel-muted hover:text-pastel-highlight hover:border-pastel-highlight/40'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="h-9 px-3 rounded-full bg-pastel-card border border-pastel-border text-xs font-bold text-pastel-muted flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-pastel-highlight" />智能体
              </span>
              <button
                onClick={() => { setShowSettingsPanel((value) => !value); setShowAddMenu(false); }}
                className={`ml-auto h-9 px-3 rounded-full border text-xs font-black flex items-center gap-2 ${
                  showSettingsPanel ? 'bg-pastel-pink border-pastel-border text-pastel-text' : 'bg-pastel-card border-pastel-border text-pastel-text'
                }`}
              >
                {outputKind === 'image'
                  ? `${imageModelOptions.find((option) => option.id === selectedImageModel)?.label || 'Banana 2'} · ${variationCount}x`
                  : `${videoModelOptions.find((option) => option.id === selectedVideoModel)?.label || 'Omni Flash'} · ${duration} · ${variationCount}x`}
              </button>
              <button
                onClick={handleGenerate}
                disabled={assets.length === 0 || isLoading}
                className={`h-10 px-4 rounded-full text-sm font-black flex items-center gap-2 transition-all ${
                  assets.length === 0 || isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-pastel-highlight text-white hover:bg-orange-600 shadow-sm'
                }`}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />生成中</>
                ) : (
                  <>生成分镜<ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {zoomAsset && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setZoomAsset(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setZoomAsset(null)} className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white text-pastel-text shadow-lg flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            {zoomAsset.type === 'image' ? (
              <img src={zoomAsset.previewUrl} alt={zoomAsset.name} className="max-h-[84vh] max-w-full rounded-2xl shadow-2xl object-contain" />
            ) : (
              <video src={zoomAsset.previewUrl} className="max-h-[84vh] max-w-full rounded-2xl shadow-2xl" controls autoPlay />
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button onClick={() => downloadAsset(zoomAsset)} className="h-10 px-4 rounded-full bg-white text-pastel-text text-sm font-bold flex items-center gap-2 shadow-sm">
                <Download className="w-4 h-4" />下载素材
              </button>
              <button onClick={() => setZoomAsset(null)} className="h-10 px-4 rounded-full bg-pastel-highlight text-white text-sm font-bold flex items-center gap-2 shadow-sm">
                <Maximize2 className="w-4 h-4" />返回工作台
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardTab;
