import ImageCropModal from './ImageCropModal';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateInpainting, blobToBase64 } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { storageService } from '../../../services/storageService';
import { 
  Eraser, Upload, Loader2, AlertCircle, X, Sparkles, Key, Image as ImageIcon, 
  Wand2, Monitor, Grid, Download, Paintbrush, RotateCcw, Cpu, Minus, Plus, 
  Crop, SlidersHorizontal, Layers, Palette, Shirt, ChevronLeft, PanelLeftOpen, 
  Check, Maximize2, HelpCircle, Trash2, ChevronDown, RotateCw, RefreshCw, ZoomIn, ZoomOut, Hand, Search
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { downloadImageFile } from '../utils/imageDownload';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';

// 自定义香蕉图标组件（复用）
const BananaIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ color: '#fbbf24' }}
  >
    <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
    <path d="M15 3s-1.5 1-2 3" />
  </svg>
);

type InpaintingTabProps = {
  isActive?: boolean;
};

// 悬停区域类型：用于 Ctrl+V 定向粘贴
type HoveredPasteZone = 'source' | 'ref' | 'structure' | 'fabric' | 'color' | null;

// 正在编辑/放大裁切的目标图片信息
type CropTargetInfo = {
  type: 'source' | 'ref' | 'structure' | 'fabric' | 'color';
  index?: number;
  url: string;
  file: File;
};

// 画幅比例选项阵列与几何图标
const ASPECT_RATIO_OPTIONS = [
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版', desc: '电商时尚主图与模特首选', width: 22, height: 29 },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3 竖版', desc: '经典单反人像与海报比例', width: 20, height: 30 },
  { id: AspectRatio.SQUARE, label: '1:1 方版', desc: '经典正方形九宫格排版', width: 26, height: 26 },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏', desc: '手机全屏展示与短视频', width: 17, height: 30 },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版', desc: '画册长图与横屏展示', width: 32, height: 18 },
  { id: AspectRatio.LANDSCAPE_3_2, label: '3:2 横版', desc: '单反横向摄影与场景大图', width: 30, height: 20 },
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3 常规', desc: '传统显示器与常用规格', width: 28, height: 21 },
] as const;

// 画笔颜色预设 (默认红色)
const BRUSH_COLOR_PRESETS = [
  { id: 'red', name: '红', hex: '#ef4444' },
  { id: 'yellow', name: '黄', hex: '#eab308' },
  { id: 'blue', name: '蓝', hex: '#3b82f6' },
  { id: 'green', name: '绿', hex: '#22c55e' },
  { id: 'black', name: '黑', hex: '#000000' },
  { id: 'white', name: '白', hex: '#ffffff' },
] as const;

// 辅助函数：HEX 转 RGBA 字符串
const hexToRgba = (hex: string, alpha: number) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

// 任务工作区快照
type InpaintingWorkspace = {
  sourceFile: File | null;
  sourceUrl: string | null;
  hasMask: boolean;
  maskPreviewUrl: string | null;
  refFiles: File[];
  refUrls: string[];
  isBatchMode: boolean;
  selectedRefIdxs: number[];
  fabricRefFiles: File[];
  fabricRefUrls: string[];
  colorRefFiles: File[];
  colorRefUrls: string[];
  structureRefFiles: File[];
  structureRefUrls: string[];
  cropPasteEnabled: boolean;
  cropPadding: number;
  cropBlend: number;
  cropExpand: number;
  description: string;
  generatedImages: string[];
  batchResults: Array<{ refIdx: number; refUrl: string; image?: string; error?: string }>;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  selectedModel: string;
  zoomLevel?: number;
  panOffset?: { x: number; y: number };
};

type InpaintingTask = {
  id: string;
  createdAt: number;
  status: 'editing' | 'generating' | 'done' | 'error';
  cover?: string;
  workspace: InpaintingWorkspace;
};

// 默认参数：画幅比例默认 2:3，画质精度默认 2K
const createFreshWorkspace = (): InpaintingWorkspace => ({
  sourceFile: null,
  sourceUrl: null,
  hasMask: false,
  maskPreviewUrl: null,
  refFiles: [],
  refUrls: [],
  isBatchMode: false,
  selectedRefIdxs: [],
  fabricRefFiles: [],
  fabricRefUrls: [],
  colorRefFiles: [],
  colorRefUrls: [],
  structureRefFiles: [],
  structureRefUrls: [],
  cropPasteEnabled: true,
  cropPadding: 5,
  cropBlend: 1,
  cropExpand: 0.3,
  description: '',
  generatedImages: [],
  batchResults: [],
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  selectedModel: 'gemini-3.1-flash-image-preview',
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
});

const createInpaintingTask = (): InpaintingTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  workspace: createFreshWorkspace(),
});

/**
 * 8 手柄交互式图片放大与裁切 Modal 弹窗组件 (默认比例设为 2:3)
 */
const InpaintingTab: React.FC<InpaintingTabProps> = ({ isActive = true }) => {
  // 多任务记录状态
  const initialTaskRef = useRef<InpaintingTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createInpaintingTask();

  const [tasks, setTasks] = useState<InpaintingTask[]>([initialTaskRef.current]);
  const [activeTaskId, setActiveTaskId] = useState<string>(initialTaskRef.current.id);
  const [historyOpen, setHistoryOpen] = useState(true);

  // 悬停区域追踪
  const [hoveredZone, setHoveredZone] = useState<HoveredPasteZone>(null);

  // 弹窗控制器：涂抹 Modal、比例选择 Modal、放大与裁切 Modal
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [ratioModalOpen, setRatioModalOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTargetInfo | null>(null);

  // 画板放大与缩放比例 (1.0 到 4.0x 超高清放大)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // 快捷抓手平移与工具模式状态 ('brush' | 'eraser' | 'zoom')
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'zoom'>('brush');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanDragging, setIsPanDragging] = useState(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // 当前任务的工作区状态
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // 画笔粗细、颜色 (默认红 #ef4444) 与不透明度 (默认 0.6)
  const [brushSize, setBrushSize] = useState(35);
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [brushOpacity, setBrushOpacity] = useState<number>(0.6);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);
  const [showMaskGuide, setShowMaskGuide] = useState(false);
  const [showStructureGuide, setShowStructureGuide] = useState(false);

  // 参考图状态
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // 批量生成
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedRefIdxs, setSelectedRefIdxs] = useState<number[]>([]);
  const [resultView, setResultView] = useState<'single' | 'batch'>('single');
  const [batchResults, setBatchResults] = useState<Array<{ refIdx: number; refUrl: string; image?: string; error?: string }>>([]);

  // 面料 & 颜色 & 结构参考
  const [fabricRefFiles, setFabricRefFiles] = useState<File[]>([]);
  const [fabricRefUrls, setFabricRefUrls] = useState<string[]>([]);
  const [colorRefFiles, setColorRefFiles] = useState<File[]>([]);
  const [colorRefUrls, setColorRefUrls] = useState<string[]>([]);
  const [structureRefFiles, setStructureRefFiles] = useState<File[]>([]);
  const [structureRefUrls, setStructureRefUrls] = useState<string[]>([]);
  const [cropPasteEnabled, setCropPasteEnabled] = useState(true);
  const [cropPadding, setCropPadding] = useState(5);
  const [cropBlend, setCropBlend] = useState(1);
  const [cropExpand, setCropExpand] = useState(0.3);

  // 生成状态：默认 2:3 比例，默认 2K 精度
  const [description, setDescription] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_2_3);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');

  // 监听全局键盘事件
  useEffect(() => {
    if (!showCanvasModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.altKey) setIsAltPressed(true);

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        setActiveTool((prev) => (prev === 'brush' ? 'eraser' : 'brush'));
      } else if (key === 'e') {
        e.preventDefault();
        setActiveTool('eraser');
      } else if (key === 'z') {
        e.preventDefault();
        setActiveTool('zoom');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltPressed(false);
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanDragging(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showCanvasModal]);

  // 当切换到 gpt-image-2 时，自动修正参数
  useEffect(() => {
    if (selectedModel === 'gpt-image-2') {
      if (resolution === ImageResolution.RES_05K) {
        setResolution(ImageResolution.RES_1K);
      }
      const allowedRatios = [
        AspectRatio.SQUARE, 
        AspectRatio.LANDSCAPE_3_2, 
        AspectRatio.PORTRAIT_2_3, 
        AspectRatio.LANDSCAPE_16_9, 
        AspectRatio.PORTRAIT_9_16
      ];
      if (!allowedRatios.includes(aspectRatio)) {
        setAspectRatio(AspectRatio.PORTRAIT_2_3);
      }
    }
  }, [selectedModel, aspectRatio, resolution]);

  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // 拖拽状态
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isDraggingFabric, setIsDraggingFabric] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [isDraggingStructure, setIsDraggingStructure] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const fabricRefInputRef = useRef<HTMLInputElement>(null);
  const colorRefInputRef = useRef<HTMLInputElement>(null);
  const structureRefInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const savedMaskDataUrlRef = useRef<string | null>(null);
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // 导出外框主界面透明背景的彩色半透明蒙版预览图
  const syncMaskPreview = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const url = maskCanvas.toDataURL('image/png');
    savedMaskDataUrlRef.current = url;
    setMaskPreviewUrl(url);
    setHasMask(true);
  }, []);

  // 确认裁切回调，智能更新对应的图片和列表
  const handleConfirmCrop = (newFile: File, newUrl: string) => {
    if (!cropTarget) return;

    if (cropTarget.type === 'source') {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceFile(newFile);
      setSourceUrl(newUrl);
      setHasMask(false);
      setMaskPreviewUrl(null);
      updateCurrentTask({ cover: newUrl });
    } else if (cropTarget.type === 'ref' && cropTarget.index !== undefined) {
      const idx = cropTarget.index;
      URL.revokeObjectURL(refUrls[idx]);
      setRefFiles((prev) => prev.map((f, i) => (i === idx ? newFile : f)));
      setRefUrls((prev) => prev.map((u, i) => (i === idx ? newUrl : u)));
    } else if (cropTarget.type === 'structure' && cropTarget.index !== undefined) {
      const idx = cropTarget.index;
      URL.revokeObjectURL(structureRefUrls[idx]);
      setStructureRefFiles((prev) => prev.map((f, i) => (i === idx ? newFile : f)));
      setStructureRefUrls((prev) => prev.map((u, i) => (i === idx ? newUrl : u)));
    } else if (cropTarget.type === 'fabric' && cropTarget.index !== undefined) {
      const idx = cropTarget.index;
      URL.revokeObjectURL(fabricRefUrls[idx]);
      setFabricRefFiles((prev) => prev.map((f, i) => (i === idx ? newFile : f)));
      setFabricRefUrls((prev) => prev.map((u, i) => (i === idx ? newUrl : u)));
    } else if (cropTarget.type === 'color' && cropTarget.index !== undefined) {
      const idx = cropTarget.index;
      URL.revokeObjectURL(colorRefUrls[idx]);
      setColorRefFiles((prev) => prev.map((f, i) => (i === idx ? newFile : f)));
      setColorRefUrls((prev) => prev.map((u, i) => (i === idx ? newUrl : u)));
    }
  };

  // 更新 Task 快照
  const updateCurrentTask = useCallback(
    (patch: Partial<InpaintingTask>) => {
      setTasks((current) => current.map((task) => (task.id === activeTaskId ? { ...task, ...patch } : task)));
    },
    [activeTaskId]
  );

  const getCurrentWorkspace = (): InpaintingWorkspace => ({
    sourceFile,
    sourceUrl,
    hasMask,
    maskPreviewUrl,
    refFiles,
    refUrls,
    isBatchMode,
    selectedRefIdxs,
    fabricRefFiles,
    fabricRefUrls,
    colorRefFiles,
    colorRefUrls,
    structureRefFiles,
    structureRefUrls,
    cropPasteEnabled,
    cropPadding,
    cropBlend,
    cropExpand,
    description,
    generatedImages,
    batchResults,
    aspectRatio,
    resolution,
    selectedModel,
    zoomLevel,
    panOffset,
  });

  const restoreWorkspace = (ws: InpaintingWorkspace) => {
    setSourceFile(ws.sourceFile);
    setSourceUrl(ws.sourceUrl);
    setHasMask(ws.hasMask);
    setMaskPreviewUrl(ws.maskPreviewUrl);
    savedMaskDataUrlRef.current = ws.maskPreviewUrl || null;
    setRefFiles(ws.refFiles);
    setRefUrls(ws.refUrls);
    setIsBatchMode(ws.isBatchMode);
    setSelectedRefIdxs(ws.selectedRefIdxs);
    setFabricRefFiles(ws.fabricRefFiles);
    setFabricRefUrls(ws.fabricRefUrls);
    setColorRefFiles(ws.colorRefFiles);
    setColorRefUrls(ws.colorRefUrls);
    setStructureRefFiles(ws.structureRefFiles);
    setStructureRefUrls(ws.structureRefUrls);
    setCropPasteEnabled(ws.cropPasteEnabled);
    setCropPadding(ws.cropPadding);
    setCropBlend(ws.cropBlend);
    setCropExpand(ws.cropExpand);
    setDescription(ws.description);
    setGeneratedImages(ws.generatedImages);
    setBatchResults(ws.batchResults);
    setAspectRatio(ws.aspectRatio);
    setResolution(ws.resolution);
    setSelectedModel(ws.selectedModel);
    setZoomLevel(ws.zoomLevel ?? 1.0);
    setPanOffset(ws.panOffset ?? { x: 0, y: 0 });
    setError(null);
  };

  const switchTask = (task: InpaintingTask) => {
    if (isGenerating || task.id === activeTaskId) return;
    const snapshot = getCurrentWorkspace();
    setTasks((current) =>
      current.map((item) =>
        item.id === activeTaskId
          ? { ...item, workspace: snapshot, cover: sourceUrl || item.cover }
          : item
      )
    );
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const deleteTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isGenerating && id === activeTaskId) return;
    setTasks((current) => {
      if (current.length <= 1) {
        const fresh = createInpaintingTask();
        setActiveTaskId(fresh.id);
        restoreWorkspace(fresh.workspace);
        return [fresh];
      }
      const remaining = current.filter((t) => t.id !== id);
      if (id === activeTaskId) {
        const nextTask = remaining[0];
        setActiveTaskId(nextTask.id);
        restoreWorkspace(nextTask.workspace);
      }
      return remaining;
    });
  };

  const newTask = () => {
    if (isGenerating) return;
    const fresh = createInpaintingTask();
    const snapshot = getCurrentWorkspace();
    setTasks((current) =>
      [
        fresh,
        ...current.map((item) =>
          item.id === activeTaskId
            ? { ...item, workspace: snapshot, cover: sourceUrl || item.cover }
            : item
        ),
      ].slice(0, 20)
    );
    setActiveTaskId(fresh.id);
    restoreWorkspace(fresh.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  // 上传原图
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) return;
      setSourceFile(file);
      const url = URL.createObjectURL(file);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(url);
      setGeneratedImages([]);
      setHasMask(false);
      setMaskPreviewUrl(null);
      savedMaskDataUrlRef.current = null;
      updateCurrentTask({ cover: url });

      setTimeout(() => {
        setShowCanvasModal(true);
      }, 150);
    }
  };

  const removeSource = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl(null);
    setHasMask(false);
    setMaskPreviewUrl(null);
    savedMaskDataUrlRef.current = null;
    setGeneratedImages([]);
  };

  // 静默绑定剪贴板 Ctrl+V 粘贴事件
  useImagePaste((files) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (hoveredZone === 'source') {
      const file = validFiles[0];
      setSourceFile(file);
      const url = URL.createObjectURL(file);
      setSourceUrl(url);
      setGeneratedImages([]);
      setHasMask(false);
      setMaskPreviewUrl(null);
      updateCurrentTask({ cover: url });
      setTimeout(() => setShowCanvasModal(true), 150);
      return;
    }

    if (hoveredZone === 'ref') {
      if (refFiles.length + validFiles.length > 10) {
        setError('参考图最多10张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = validFiles.map(f => URL.createObjectURL(f));
      setRefFiles(prev => [...prev, ...validFiles]);
      setRefUrls(prev => [...prev, ...urls]);
      return;
    }

    if (hoveredZone === 'structure') {
      if (structureRefFiles.length + validFiles.length > 2) {
        setError('结构参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = validFiles.map(f => URL.createObjectURL(f));
      setStructureRefFiles(prev => [...prev, ...validFiles]);
      setStructureRefUrls(prev => [...prev, ...urls]);
      return;
    }

    if (hoveredZone === 'fabric') {
      if (fabricRefFiles.length + validFiles.length > 2) {
        setError('面料参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = validFiles.map(f => URL.createObjectURL(f));
      setFabricRefFiles(prev => [...prev, ...validFiles]);
      setFabricRefUrls(prev => [...prev, ...urls]);
      return;
    }

    if (hoveredZone === 'color') {
      if (colorRefFiles.length + validFiles.length > 2) {
        setError('颜色参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = validFiles.map(f => URL.createObjectURL(f));
      setColorRefFiles(prev => [...prev, ...validFiles]);
      setColorRefUrls(prev => [...prev, ...urls]);
      return;
    }

    if (!sourceFile) {
      const file = validFiles[0];
      setSourceFile(file);
      const url = URL.createObjectURL(file);
      setSourceUrl(url);
      setGeneratedImages([]);
      setHasMask(false);
      setMaskPreviewUrl(null);
      updateCurrentTask({ cover: url });
      setTimeout(() => setShowCanvasModal(true), 150);
    } else {
      if (refFiles.length + validFiles.length > 10) {
        setError('参考图最多10张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = validFiles.map(f => URL.createObjectURL(f));
      setRefFiles(prev => [...prev, ...validFiles]);
      setRefUrls(prev => [...prev, ...urls]);
    }
  }, isActive);

  // 参考图操作
  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (refFiles.length + files.length > 10) {
        setError('参考图最多10张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const startIdx = refFiles.length;
      const urls = files.map(f => URL.createObjectURL(f));

      setRefFiles(prev => [...prev, ...files]);
      setRefUrls(prev => [...prev, ...urls]);

      if (isBatchMode) {
        setSelectedRefIdxs(prev => {
          const next = new Set(prev);
          for (let i = 0; i < files.length; i++) next.add(startIdx + i);
          return Array.from(next).sort((a, b) => a - b);
        });
      }
    }
  };

  const handleFabricRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (fabricRefFiles.length + files.length > 2) {
        setError('面料参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setFabricRefFiles(prev => [...prev, ...files]);
      setFabricRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleColorRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (colorRefFiles.length + files.length > 2) {
        setError('颜色参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setColorRefFiles(prev => [...prev, ...files]);
      setColorRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleStructureRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (structureRefFiles.length + files.length > 2) {
        setError('结构参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setStructureRefFiles(prev => [...prev, ...files]);
      setStructureRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeRefImage = (idx: number) => {
    URL.revokeObjectURL(refUrls[idx]);
    setRefFiles(prev => prev.filter((_, i) => i !== idx));
    setRefUrls(prev => prev.filter((_, i) => i !== idx));
    setSelectedRefIdxs(prev => prev.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i)));
    setBatchResults(prev => prev.filter(r => r.refIdx !== idx).map(r => (r.refIdx > idx ? { ...r, refIdx: r.refIdx - 1 } : r)));
  };

  const removeFabricRefImage = (idx: number) => {
    URL.revokeObjectURL(fabricRefUrls[idx]);
    setFabricRefFiles(prev => prev.filter((_, i) => i !== idx));
    setFabricRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const removeColorRefImage = (idx: number) => {
    URL.revokeObjectURL(colorRefUrls[idx]);
    setColorRefFiles(prev => prev.filter((_, i) => i !== idx));
    setColorRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const removeStructureRefImage = (idx: number) => {
    URL.revokeObjectURL(structureRefUrls[idx]);
    setStructureRefFiles(prev => prev.filter((_, i) => i !== idx));
    setStructureRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // 初始化双层 Canvas
  useEffect(() => {
    if (!sourceUrl || !showCanvasModal) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      
      const setupCanvas = () => {
        const srcCanvas = sourceCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!srcCanvas || !maskCanvas) return;

        const targetHeight = Math.min(window.innerHeight * 0.74, 760);
        const aspect = img.naturalWidth / img.naturalHeight;
        const targetWidth = targetHeight * aspect;

        srcCanvas.width = targetWidth;
        srcCanvas.height = targetHeight;
        maskCanvas.width = targetWidth;
        maskCanvas.height = targetHeight;

        srcCanvas.style.width = `${targetWidth}px`;
        srcCanvas.style.height = `${targetHeight}px`;
        maskCanvas.style.width = `${targetWidth}px`;
        maskCanvas.style.height = `${targetHeight}px`;

        const srcCtx = srcCanvas.getContext('2d');
        if (srcCtx) {
          srcCtx.clearRect(0, 0, targetWidth, targetHeight);
          srcCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }

        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx && savedMaskDataUrlRef.current) {
          const maskImg = new Image();
          maskImg.onload = () => {
            maskCtx.clearRect(0, 0, targetWidth, targetHeight);
            maskCtx.drawImage(maskImg, 0, 0, targetWidth, targetHeight);
          };
          maskImg.src = savedMaskDataUrlRef.current;
        }
      };
      
      setupCanvas();
      window.addEventListener('resize', setupCanvas);
      return () => window.removeEventListener('resize', setupCanvas);
    };
    img.src = sourceUrl;
  }, [sourceUrl, showCanvasModal]);

  // 精准计算鼠标/触摸在 Canvas 绝对本地分辨率 `[0, width] x [0, height]` 坐标系中的位置
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      const me = e as React.MouseEvent<HTMLCanvasElement>;
      clientX = me.clientX;
      clientY = me.clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }, []);

  const drawAt = useCallback((x: number, y: number, previous?: { x: number; y: number } | null) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isEraseMode = activeTool === 'eraser';
    ctx.globalCompositeOperation = isEraseMode ? 'destination-out' : 'source-over';
    
    // 绘图采用纯色 Alpha 1.0，画面透明度由 Canvas CSS style.opacity 动态统一接管控制
    const colorRgba = hexToRgba(brushColor, 1.0);
    ctx.fillStyle = colorRgba;
    ctx.strokeStyle = colorRgba;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (previous) {
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = colorRgba;
    ctx.fill();

    if (!isEraseMode && !hasMask) setHasMask(true);
  }, [brushSize, brushColor, activeTool, hasMask]);

  // 高性能 GPU 硬件加速光圈指示器位置更新 (无需解构触发 React 重新渲染)
  const updateCursorPos = useCallback((x: number, y: number) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${x - brushSize / 2}px, ${y - brushSize / 2}px, 0)`;
      cursorRef.current.style.opacity = '1';
    }
  }, [brushSize]);

  // 鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpacePressed) {
      setIsPanDragging(true);
      startPanRef.current = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      };
      return;
    }

    if (activeTool === 'zoom') {
      if (isAltPressed || e.altKey) {
        setZoomLevel((prev) => Math.max(0.5, Number((prev - 0.5).toFixed(1))));
      } else {
        setZoomLevel((prev) => Math.min(4.0, Number((prev + 0.5).toFixed(1))));
      }
      return;
    }

    setIsDrawing(true);
    const pos = getCanvasPos(e);
    lastDrawPointRef.current = pos;
    drawAt(pos.x, pos.y);
  }, [isSpacePressed, activeTool, isAltPressed, panOffset, getCanvasPos, drawAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanDragging && isSpacePressed) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        setPanOffset({
          x: e.clientX - startPanRef.current.x,
          y: e.clientY - startPanRef.current.y,
        });
      });
      return;
    }

    const pos = getCanvasPos(e);
    updateCursorPos(pos.x, pos.y);
    
    if (!isDrawing || isSpacePressed || activeTool === 'zoom') return;
    drawAt(pos.x, pos.y, lastDrawPointRef.current);
    lastDrawPointRef.current = pos;
  }, [isPanDragging, isSpacePressed, isDrawing, activeTool, getCanvasPos, updateCursorPos, drawAt]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setIsPanDragging(false);
    lastDrawPointRef.current = null;
    if (hasMask) syncMaskPreview();
  }, [hasMask, syncMaskPreview]);

  const handleMouseEnter = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '1';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
    setIsPanDragging(false);
    lastDrawPointRef.current = null;
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0';
    }
    if (hasMask) syncMaskPreview();
  }, [hasMask, syncMaskPreview]);

  // 触摸事件支持
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isSpacePressed || activeTool === 'zoom') return;
    setIsDrawing(true);
    const pos = getCanvasPos(e);
    lastDrawPointRef.current = pos;
    drawAt(pos.x, pos.y);
  }, [isSpacePressed, activeTool, getCanvasPos, drawAt]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    updateCursorPos(pos.x, pos.y);
    if (!isDrawing || isSpacePressed || activeTool === 'zoom') return;
    drawAt(pos.x, pos.y, lastDrawPointRef.current);
    lastDrawPointRef.current = pos;
  }, [isDrawing, isSpacePressed, activeTool, getCanvasPos, updateCursorPos, drawAt]);

  const handleTouchEnd = useCallback(() => {
    setIsDrawing(false);
    lastDrawPointRef.current = null;
    if (hasMask) syncMaskPreview();
  }, [hasMask, syncMaskPreview]);

  // 鼠标滚轮实时调节画笔 / 橡皮擦大小
  const handleCanvasWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 3 : -3;
    setBrushSize((prev) => Math.max(5, Math.min(150, prev + delta)));
  }, []);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    viewport.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel, showCanvasModal]);

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasMask(false);
    setMaskPreviewUrl(null);
  };

  const getMaskExpandPixels = () => {
    if (!cropPasteEnabled || structureRefFiles.length === 0) return 0;
    return Math.max(0, Math.round(cropPadding + cropExpand * 30));
  };

  const exportMask = async (sourceDataUrl: string, expandPixels = 0): Promise<string | null> => {
    let maskSrc = savedMaskDataUrlRef.current;
    if (maskCanvasRef.current) {
      maskSrc = maskCanvasRef.current.toDataURL('image/png');
    }
    if (!maskSrc || !sourceDataUrl) return null;

    try {
      const [sourceImg, maskImg] = await Promise.all([
        loadCanvasImage(sourceDataUrl),
        loadCanvasImage(maskSrc),
      ]);

      const naturalW = sourceImg.naturalWidth || sourceImg.width;
      const naturalH = sourceImg.naturalHeight || sourceImg.height;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = naturalW;
      exportCanvas.height = naturalH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, naturalW, naturalH);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = naturalW;
      tempCanvas.height = naturalH;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      if (expandPixels > 0) {
        tempCtx.filter = `blur(${expandPixels}px)`;
        tempCtx.drawImage(maskImg, 0, 0, naturalW, naturalH);
        tempCtx.filter = 'none';
      } else {
        tempCtx.drawImage(maskImg, 0, 0, naturalW, naturalH);
      }

      const imageData = tempCtx.getImageData(0, 0, naturalW, naturalH);
      const data = imageData.data;

      const outData = ctx.getImageData(0, 0, naturalW, naturalH);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > (expandPixels > 0 ? 2 : 10)) {
          outData.data[i] = 255;
          outData.data[i + 1] = 255;
          outData.data[i + 2] = 255;
          outData.data[i + 3] = 255;
        }
      }
      ctx.putImageData(outData, 0, 0);

      return exportCanvas.toDataURL('image/png').split(',')[1];
    } catch (err) {
      console.error('exportMask error:', err);
      return null;
    }
  };

  const exportPaintEditMap = async (sourceDataUrl: string): Promise<string | null> => {
    let maskSrc = savedMaskDataUrlRef.current;
    if (maskCanvasRef.current) {
      maskSrc = maskCanvasRef.current.toDataURL('image/png');
    }
    if (!maskSrc || !sourceDataUrl) return null;

    try {
      const [sourceImg, maskImg] = await Promise.all([
        loadCanvasImage(sourceDataUrl),
        loadCanvasImage(maskSrc),
      ]);

      const naturalW = sourceImg.naturalWidth || sourceImg.width;
      const naturalH = sourceImg.naturalHeight || sourceImg.height;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = naturalW;
      exportCanvas.height = naturalH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(sourceImg, 0, 0, naturalW, naturalH);
      ctx.globalAlpha = 0.72;
      ctx.drawImage(maskImg, 0, 0, naturalW, naturalH);
      ctx.globalAlpha = 1;

      return exportCanvas.toDataURL('image/png').split(',')[1];
    } catch (err) {
      console.error('exportPaintEditMap error:', err);
      return null;
    }
  };

  const loadCanvasImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const pasteGeneratedIntoMask = async (
    sourceDataUrl: string,
    generatedDataUrl: string,
    maskBase64: string,
    blendRadius = 0
  ): Promise<string> => {
    const [sourceImg, generatedImg, maskImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(generatedDataUrl),
      loadCanvasImage(`data:image/png;base64,${maskBase64}`),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) return generatedDataUrl;

    resultCtx.drawImage(sourceImg, 0, 0, width, height);

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = width;
    patchCanvas.height = height;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) return generatedDataUrl;

    patchCtx.drawImage(generatedImg, 0, 0, width, height);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return generatedDataUrl;
    if (blendRadius > 0) {
      maskCtx.filter = `blur(${Math.max(0, blendRadius)}px)`;
      maskCtx.drawImage(maskImg, 0, 0, width, height);
      maskCtx.filter = 'none';
    } else {
      maskCtx.drawImage(maskImg, 0, 0, width, height);
    }

    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(maskCanvas, 0, 0, width, height);

    resultCtx.drawImage(patchCanvas, 0, 0, width, height);
    return resultCanvas.toDataURL('image/png');
  };

  const parseAspectRatioValue = (ratio: AspectRatio) => {
    const [w, h] = ratio.split(':').map(Number);
    return w / h;
  };

  const closestAspectRatioForSize = (width: number, height: number) => {
    const sourceRatio = width / height;
    return Object.values(AspectRatio).reduce((best, current) => {
      const bestDiff = Math.abs(parseAspectRatioValue(best) - sourceRatio);
      const currentDiff = Math.abs(parseAspectRatioValue(current) - sourceRatio);
      return currentDiff < bestDiff ? current : best;
    }, AspectRatio.PORTRAIT_2_3);
  };

  const createMaskedCropPackage = async (
    sourceDataUrl: string,
    maskBase64: string,
    editMapBase64: string | null,
    extraPadding: number
  ) => {
    const [sourceImg, maskImg, editMapImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(`data:image/png;base64,${maskBase64}`),
      editMapBase64 ? loadCanvasImage(`data:image/png;base64,${editMapBase64}`) : Promise.resolve(null),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;

    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = width;
    scanCanvas.height = height;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!scanCtx) return null;
    scanCtx.drawImage(maskImg, 0, 0, width, height);

    const data = scanCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        if (data[idx] > 180 || data[idx + 3] > 180) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;

    const maskWidth = maxX - minX + 1;
    const maskHeight = maxY - minY + 1;
    const contextualPadding = Math.max(
      24,
      Math.round(Math.max(maskWidth, maskHeight) * 0.22),
      Math.round(extraPadding)
    );
    const x = Math.max(0, minX - contextualPadding);
    const y = Math.max(0, minY - contextualPadding);
    const right = Math.min(width, maxX + contextualPadding + 1);
    const bottom = Math.min(height, maxY + contextualPadding + 1);
    const cropWidth = right - x;
    const cropHeight = bottom - y;

    const makeCrop = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      return canvas.toDataURL('image/png').split(',')[1];
    };

    const sourceCrop = makeCrop(sourceImg);
    const maskCrop = makeCrop(maskImg);
    const editMapCrop = editMapImg ? makeCrop(editMapImg) : null;
    if (!sourceCrop || !maskCrop) return null;

    return {
      source: { base64: sourceCrop, mimeType: 'image/png' },
      mask: { base64: maskCrop, mimeType: 'image/png' },
      editMap: editMapCrop ? { base64: editMapCrop, mimeType: 'image/png' } : undefined,
      bounds: { x, y, width: cropWidth, height: cropHeight },
      aspectRatio: closestAspectRatioForSize(cropWidth, cropHeight),
    };
  };

  const pasteGeneratedCropIntoSource = async (
    sourceDataUrl: string,
    generatedCropDataUrl: string,
    cropMaskBase64: string,
    bounds: { x: number; y: number; width: number; height: number },
    blendRadius = 0
  ) => {
    const [sourceImg, generatedImg, maskImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(generatedCropDataUrl),
      loadCanvasImage(`data:image/png;base64,${cropMaskBase64}`),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) return generatedCropDataUrl;
    resultCtx.drawImage(sourceImg, 0, 0, width, height);

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = bounds.width;
    patchCanvas.height = bounds.height;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) return generatedCropDataUrl;
    patchCtx.drawImage(generatedImg, 0, 0, bounds.width, bounds.height);

    const cropMaskCanvas = document.createElement('canvas');
    cropMaskCanvas.width = bounds.width;
    cropMaskCanvas.height = bounds.height;
    const cropMaskCtx = cropMaskCanvas.getContext('2d');
    if (!cropMaskCtx) return generatedCropDataUrl;
    if (blendRadius > 0) {
      cropMaskCtx.filter = `blur(${Math.max(0, blendRadius)}px)`;
    }
    cropMaskCtx.drawImage(maskImg, 0, 0, bounds.width, bounds.height);
    cropMaskCtx.filter = 'none';

    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(cropMaskCanvas, 0, 0, bounds.width, bounds.height);
    resultCtx.drawImage(patchCanvas, bounds.x, bounds.y);
    return resultCanvas.toDataURL('image/png');
  };

  const buildStructureLockedPrompt = (basePrompt: string, hasStructureRef: boolean) => {
    if (!hasStructureRef) return basePrompt;
    return `${basePrompt}

# 结构参考裁切贴回硬规则
这是局部边缘修图，不是整件衣服重画。
- 当前可能只提供了涂抹区域周围的裁切小图。必须把这块裁切图当作局部手术区域处理，重绘白色蒙版内的结构后再无缝贴回原图。
- 只编辑白色蒙版区域；黑色蒙版区域必须保持原图不变。
- 结构参考图只用于白色区域内的局部边缘结构：领口边、袖口边、包边厚度、缝线位置、边缘曲线、褶皱方向和端点连接。
- 不要把结构参考图里的整件衣服、人体、背景、肤色、首饰或光线复制进来。
- 如果蒙版只涂了窄边，只生成窄边；不要扩展到胸口、肩膀、整只袖子或整件上衣。
- 新边缘必须贴合原图未涂抹区域，和原本布料自然连接，不允许出现双领口、双袖口、漂浮边、断裂缝线、错位拼接。`;
  };

  // 单次生成
  const handleGenerate = async () => {
    if (!sourceFile || !hasMask || !description) return;
    setError(null);
    setProgress('');
    setResultView('single');
    updateCurrentTask({ status: 'generating' });

    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      assertCurrentGenerationTask(taskId, signal);
      setProgress('正在压缩原图...');
      const sourceBase64 = await blobToBase64(sourceFile);
      assertCurrentGenerationTask(taskId, signal);
      const sourceDataUrl = `data:${sourceFile.type};base64,${sourceBase64}`;

      const maskExpandPixels = getMaskExpandPixels();
      setProgress(maskExpandPixels > 0 ? `正在导出蒙版并外扩 ${maskExpandPixels}px...` : '正在导出蒙版...');
      const maskBase64 = await exportMask(sourceDataUrl, maskExpandPixels);
      if (!maskBase64) {
        throw new Error('蒙版不能为空，请点击【开启涂抹画板】用画笔涂抹要修改的区域');
      }
      const editMapBase64 = await exportPaintEditMap(sourceDataUrl);
      assertCurrentGenerationTask(taskId, signal);

      let refImagesData: { base64: string; mimeType: string }[] | undefined;
      if (refFiles.length > 0) {
        setProgress('正在处理参考图...');
        refImagesData = await Promise.all(refFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let fabricRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (fabricRefFiles.length > 0) {
        setProgress('正在处理面料参考...');
        fabricRefImagesData = await Promise.all(fabricRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let colorRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (colorRefFiles.length > 0) {
        setProgress('正在处理颜色参考...');
        colorRefImagesData = await Promise.all(colorRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let structureRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (structureRefFiles.length > 0) {
        setProgress('正在处理结构参考...');
        structureRefImagesData = await Promise.all(structureRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      setProgress('正在生成 (预计 30-90 秒)...');
      const stablePrompt = buildStructureLockedPrompt(description, !!structureRefImagesData);
      const cropPackage = cropPasteEnabled && structureRefImagesData
        ? await createMaskedCropPackage(sourceDataUrl, maskBase64, editMapBase64, Math.max(maskExpandPixels, cropPadding + cropExpand * 30))
        : null;
      const results = await generateInpainting(
        cropPackage?.source || { base64: sourceBase64, mimeType: sourceFile.type },
        cropPackage?.mask || { base64: maskBase64, mimeType: 'image/png' },
        stablePrompt,
        {
          aspectRatio: cropPackage?.aspectRatio || aspectRatio,
          resolution,
          modelId: selectedModel,
          editMapImage: cropPackage?.editMap || (editMapBase64 ? { base64: editMapBase64, mimeType: 'image/png' } : undefined),
          refImages: refImagesData,
          fabricRefImages: fabricRefImagesData,
          colorRefImages: colorRefImagesData,
          structureRefImages: structureRefImagesData,
          cropPaste: cropPasteEnabled && structureRefImagesData ? {
            padding: cropPadding,
            blend: cropBlend,
            expand: cropExpand,
          } : undefined,
          signal,
        }
      );

      assertCurrentGenerationTask(taskId, signal);
      setProgress('正在按蒙版贴回原图...');
      const maskedResults = await Promise.all(
        results.map((result: string) => cropPackage
          ? pasteGeneratedCropIntoSource(sourceDataUrl, result, cropPackage.mask.base64, cropPackage.bounds, cropBlend)
          : pasteGeneratedIntoMask(
            sourceDataUrl,
            result,
            maskBase64,
            cropPasteEnabled && structureRefImagesData ? cropBlend : 0
          )
        )
      );

      assertCurrentGenerationTask(taskId, signal);
      setProgress('生成完成！');
      setGeneratedImages(maskedResults);
      updateCurrentTask({ status: 'done' });

      try {
        await storageService.saveProject({
          id: crypto.randomUUID(),
          type: 'RETOUCHING',
          createdAt: Date.now(),
          thumbnail: maskedResults[0],
          assets: {
            original: [sourceUrl!, maskBase64],
            generated: maskedResults,
          },
          metadata: {
            subType: 'inpainting',
            prompt: description,
            aspectRatio,
            resolution,
            model: selectedModel,
            hasRefImages: !!refImagesData,
            hasFabricRef: !!fabricRefImagesData,
            hasColorRef: !!colorRefImagesData,
            hasStructureRef: !!structureRefImagesData,
            cropPasteEnabled: cropPasteEnabled && !!structureRefImagesData,
          },
        });
      } catch (saveErr) {
        console.error('Failed to save inpainting results to history:', saveErr);
      }

    } catch (error: any) {
      if (!isAbortError(error)) {
        setError(getErrorMessage(error));
        updateCurrentTask({ status: 'error' });
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setProgress('');
    }
  };

  // 批量生成
  const handleBatchGenerate = async () => {
    if (!sourceFile || !hasMask || !description) return;

    const selected = selectedRefIdxs
      .filter((idx) => idx >= 0 && idx < refFiles.length)
      .slice(0, 10);

    if (selected.length === 0) {
      setError('请至少勾选 1 张参考图进行批量生成');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setProgress('');
    setResultView('batch');
    updateCurrentTask({ status: 'generating' });

    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setBatchResults([]);

    try {
      assertCurrentGenerationTask(taskId, signal);
      setProgress('正在压缩原图...');
      const sourceBase64 = await blobToBase64(sourceFile);
      assertCurrentGenerationTask(taskId, signal);
      const sourceDataUrl = `data:${sourceFile.type};base64,${sourceBase64}`;

      const maskExpandPixels = getMaskExpandPixels();
      setProgress(maskExpandPixels > 0 ? `正在导出蒙版并外扩 ${maskExpandPixels}px...` : '正在导出蒙版...');
      const maskBase64 = await exportMask(sourceDataUrl, maskExpandPixels);
      if (!maskBase64) throw new Error('蒙版不能为空，请点击【开启涂抹画板】用画笔涂抹要修改的区域');
      const editMapBase64 = await exportPaintEditMap(sourceDataUrl);
      assertCurrentGenerationTask(taskId, signal);

      let fabricRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (fabricRefFiles.length > 0) {
        setProgress('正在处理面料参考...');
        fabricRefImagesData = await Promise.all(fabricRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let colorRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (colorRefFiles.length > 0) {
        setProgress('正在处理颜色参考...');
        colorRefImagesData = await Promise.all(colorRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let structureRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (structureRefFiles.length > 0) {
        setProgress('正在处理结构参考...');
        structureRefImagesData = await Promise.all(structureRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      const prompt = buildStructureLockedPrompt(
        `${description}\n\nUse the clothing/outfit from the selected reference image for the WHITE mask area only. Match the requested garment structure, pattern, and fabric appearance as closely as possible.`,
        !!structureRefImagesData
      );
      const cropPackage = cropPasteEnabled && structureRefImagesData
        ? await createMaskedCropPackage(sourceDataUrl, maskBase64, editMapBase64, Math.max(maskExpandPixels, cropPadding + cropExpand * 30))
        : null;

      const currentBatchResults: Array<{ refIdx: number; refUrl: string; image?: string; error?: string }> = [];

      for (let i = 0; i < selected.length; i++) {
        assertCurrentGenerationTask(taskId, signal);
        const refIdx = selected[i];
        const refFile = refFiles[refIdx];
        const refUrl = refUrls[refIdx];

        setProgress(`批量生成中 ${i + 1}/${selected.length}...`);

        try {
          const refBase64 = await blobToBase64(refFile);
          const results = await generateInpainting(
            cropPackage?.source || { base64: sourceBase64, mimeType: sourceFile.type },
            cropPackage?.mask || { base64: maskBase64, mimeType: 'image/png' },
            prompt,
            {
              aspectRatio: cropPackage?.aspectRatio || aspectRatio,
              resolution,
              modelId: selectedModel,
              editMapImage: cropPackage?.editMap || (editMapBase64 ? { base64: editMapBase64, mimeType: 'image/png' } : undefined),
              refImages: [{ base64: refBase64, mimeType: refFile.type }],
              fabricRefImages: fabricRefImagesData,
              colorRefImages: colorRefImagesData,
              structureRefImages: structureRefImagesData,
              cropPaste: cropPasteEnabled && structureRefImagesData ? {
                padding: cropPadding,
                blend: cropBlend,
                expand: cropExpand,
              } : undefined,
              signal,
            }
          );

          assertCurrentGenerationTask(taskId, signal);
          const first = results?.[0];
          if (!first) throw new Error('模型未返回图片');
          const maskedFirst = cropPackage
            ? await pasteGeneratedCropIntoSource(sourceDataUrl, first, cropPackage.mask.base64, cropPackage.bounds, cropBlend)
            : await pasteGeneratedIntoMask(
              sourceDataUrl,
              first,
              maskBase64,
              cropPasteEnabled && structureRefImagesData ? cropBlend : 0
            );

          const resultItem = { refIdx, refUrl, image: maskedFirst };
          currentBatchResults.push(resultItem);
          setBatchResults((prev) => [...prev, resultItem]);
        } catch (e: any) {
          if (isAbortError(e)) {
            break;
          }
          const errorItem = { refIdx, refUrl, error: getErrorMessage(e) };
          currentBatchResults.push(errorItem);
          setBatchResults((prev) => [...prev, errorItem]);
        }
      }

      assertCurrentGenerationTask(taskId, signal);
      setProgress('批量生成完成！');
      updateCurrentTask({ status: 'done' });

      try {
        const successfulResults = currentBatchResults
          .filter(r => r.image)
          .map(r => r.image!);

        if (successfulResults.length > 0) {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'RETOUCHING',
            createdAt: Date.now(),
            thumbnail: successfulResults[0],
            assets: {
              original: [sourceUrl!, maskBase64],
              generated: successfulResults,
            },
            metadata: {
              subType: 'inpainting_batch',
              prompt: description,
              aspectRatio,
              resolution,
              model: selectedModel,
              refCount: selected.length,
              successCount: successfulResults.length,
            },
          });
        }
      } catch (saveErr) {
        console.error('Failed to save batch inpainting results to history:', saveErr);
      }
    } catch (error: any) {
      if (!isAbortError(error)) {
        setError(getErrorMessage(error));
        updateCurrentTask({ status: 'error' });
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask();
    setIsGenerating(false);
    setProgress('');
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      await downloadImageFile(url, filename);
    } catch (downloadError) {
      console.error('Failed to download inpainting result.', downloadError);
      setError('图片下载失败，请检查网络后重试。');
    }
  };

  const getCurrentStep = () => {
    if (generatedImages.length > 0 || batchResults.length > 0) return 5;
    if (isGenerating) return 5;
    if (refFiles.length > 0 || fabricRefFiles.length > 0 || colorRefFiles.length > 0 || structureRefFiles.length > 0) return 3;
    if (description.trim().length > 0) return 2;
    return 1;
  };

  const currentStepNum = getCurrentStep();
  const currentRatioMeta = ASPECT_RATIO_OPTIONS.find(opt => opt.id === aspectRatio) || ASPECT_RATIO_OPTIONS[1];

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        
        {/* Header */}
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted">
            <Sparkles className="h-4 w-4 text-pastel-highlight" />
            AI 图像精修工坊
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-pastel-text">
            局部替换 <span className="text-base font-normal text-pastel-muted">(Inpainting)</span>
          </h1>
          <p className="mt-1 text-sm text-pastel-muted">
            支持外框涂抹多色蒙版实时可视、Alt 键快捷缩小、按住 [Space] GPU 丝滑平移
          </p>
          
          {/* 步骤导航指示器 */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {[
              { step: 1, label: '上传原图' },
              { step: 2, label: '替换描述' },
              { step: 3, label: '多维参考' },
              { step: 4, label: '核心参数' },
              { step: 5, label: '生成结果' },
            ].map(({ step, label }, index) => {
              const isCurrent = currentStepNum === step;
              const isPassed = currentStepNum > step;
              return (
                <React.Fragment key={label}>
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all ${
                      isCurrent
                        ? 'bg-[#172238] text-white shadow-sm ring-2 ring-[#172238]/20 dark:bg-amber-500 dark:text-black dark:ring-amber-500/30'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50'
                        : 'bg-pastel-card/60 text-pastel-muted border border-pastel-border/50'
                    }`}
                  >
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-black ${
                        isCurrent
                          ? 'bg-white text-[#172238] dark:bg-black dark:text-amber-500'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-pastel-text'
                      }`}
                    >
                      {isPassed ? '✓' : step}
                    </span>
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  {index < 4 && <span className="h-px w-3 bg-pastel-border sm:w-6" />}
                </React.Fragment>
              );
            })}
          </div>
        </header>

        {/* 侧边栏收起时的左下角悬浮胶囊按钮 */}
        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-lg md:left-[16.25rem] lg:left-[17rem] text-pastel-text dark:bg-[#10192b]"
          >
            <PanelLeftOpen className="h-4 w-4" />生成记录{' '}
            <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs">{tasks.length}</span>
          </button>
        )}
        {historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="关闭生成记录"
            className="fixed inset-0 z-[59] bg-black/30 xl:hidden"
          />
        )}

        {/* 主体布局栅格 */}
        <div
          className={`grid grid-cols-1 gap-5 ${
            historyOpen
              ? 'xl:grid-cols-[16rem_28rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[28rem_minmax(0,1fr)]'
          }`}
        >
          {/* 生成记录侧边栏 */}
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3.5 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm dark:bg-[#10192b]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-black text-base text-pastel-text">生成记录</h2>
                  <p className="text-xs text-pastel-muted">可同时开多个替换任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-pastel-border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4 text-pastel-muted" />
                </button>
              </div>

              <button
                type="button"
                onClick={newTask}
                disabled={isGenerating}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#172238] dark:bg-amber-500 text-sm font-black text-white dark:text-black disabled:opacity-50 hover:opacity-95 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                新开任务
              </button>

              <div className="no-scrollbar mt-3.5 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => {
                  const isSelected = task.id === activeTaskId;
                  return (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => switchTask(task)}
                        className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20 dark:bg-orange-950/20 dark:border-orange-500'
                            : 'border-pastel-border bg-pastel-bg/50 hover:border-slate-300 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                          {task.cover ? (
                            <img src={task.cover} alt="Task Cover" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <ImageIcon className="h-8 w-8 opacity-40" />
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                            {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="p-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
                            <span className="truncate">
                              {task.workspace.description || '新替换任务'}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] font-bold text-pastel-muted">
                            {task.status === 'editing' ? '准备中' : task.status === 'generating' ? '生成中...' : task.status === 'done' ? '已生成' : '重试'}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => deleteTask(task.id, e)}
                        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        title="删除此任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* 中间/左侧 配置面板 */}
          <div className="flex flex-col gap-5">

            {/* 卡片 1: 目标原图与画笔涂抹 */}
            <div 
              className={`rounded-2xl border bg-pastel-card p-5 shadow-sm dark:bg-[#10192b] transition-all relative ${
                hoveredZone === 'source' ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-pastel-border'
              }`}
              onMouseEnter={() => setHoveredZone('source')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#172238] text-xs font-black text-white dark:bg-amber-500 dark:text-black">
                    1
                  </span>
                  <h2 className="text-base font-black text-pastel-text flex items-center gap-2">
                    目标原图与画笔涂抹
                  </h2>
                </div>
                {sourceUrl && sourceFile && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCropTarget({ type: 'source', url: sourceUrl, file: sourceFile })}
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <Crop className="w-3.5 h-3.5" /> 放大裁切原图
                    </button>
                    <button
                      onClick={removeSource}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> 更换原图
                    </button>
                  </div>
                )}
              </div>

              {!sourceUrl ? (
                <div
                  className="border-2 border-dashed border-pastel-border hover:border-orange-500 hover:bg-orange-50/20 rounded-2xl p-8 transition-all flex flex-col items-center justify-center min-h-[220px] cursor-pointer text-center"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const file = e.dataTransfer.files[0];
                      if (file.type.startsWith('image/')) {
                        setSourceFile(file);
                        setSourceUrl(URL.createObjectURL(file));
                        setGeneratedImages([]);
                        setHasMask(false);
                        setMaskPreviewUrl(null);
                        setTimeout(() => setShowCanvasModal(true), 150);
                      }
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 bg-white dark:bg-slate-800 shadow-md border border-pastel-border rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-7 h-7 text-orange-500" />
                  </div>
                  <p className="text-base font-black text-pastel-text">点击或拖拽上传图片</p>
                  <p className="text-xs text-pastel-muted mt-1.5">支持 JPG, PNG, WEBP (上传后自动打开居中放大画板绘制)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 外框卡片 1 包含图片 + 红色涂抹蒙版实时遮罩 */}
                  <div className="relative rounded-2xl overflow-hidden border border-pastel-border bg-slate-900 aspect-[4/3] flex items-center justify-center group">
                    <img src={sourceUrl} alt="Source Preview" className="h-full w-full object-contain" />
                    
                    {/* 红色/彩色涂抹区域实时遮罩 */}
                    {maskPreviewUrl && hasMask && (
                      <img src={maskPreviewUrl} alt="Mask Preview Overlay" className="absolute inset-0 h-full w-full object-contain pointer-events-none z-10 transition-opacity duration-75" style={{ opacity: brushOpacity }} />
                    )}

                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center gap-2 opacity-90 group-hover:opacity-100 transition-all z-20">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-md ${
                        hasMask ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                      }`}>
                        {hasMask ? '✓ 蒙版已完成绘制' : '未绘制涂抹蒙版'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCanvasModal(true)}
                          className="px-4 py-2 bg-white text-slate-900 hover:bg-orange-500 hover:text-white rounded-xl text-xs font-black shadow-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Paintbrush className="w-3.5 h-3.5 text-orange-500 group-hover:text-white" />
                          {hasMask ? '修改蒙版' : '开启涂抹画板'}
                        </button>
                        
                        {sourceFile && (
                          <button
                            type="button"
                            onClick={() => setCropTarget({ type: 'source', url: sourceUrl, file: sourceFile })}
                            className="px-4 py-2 bg-slate-900 text-white hover:bg-black rounded-xl text-xs font-black shadow-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Crop className="w-3.5 h-3.5 text-orange-400" />
                            放大与裁切
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-pastel-muted px-1">
                    <span>{hasMask ? '🎨 蒙版状态：已锁定局部区域 (已在上方展示)' : '⚠️ 请点击画板按钮完成涂抹区域'}</span>
                    <button
                      type="button"
                      onClick={() => setShowMaskGuide(true)}
                      className="text-orange-500 underline hover:text-orange-600"
                    >
                      正确涂抹指南
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 卡片 2: 替换描述 (可垂直拉长) */}
            <div className="rounded-2xl border border-pastel-border bg-pastel-card p-5 shadow-sm dark:bg-[#10192b]">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#172238] text-xs font-black text-white dark:bg-amber-500 dark:text-black">
                  2
                </span>
                <h2 className="text-base font-black text-pastel-text flex items-center gap-2">
                  替换描述与提示词
                </h2>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="详细描述涂抹区域要替换成的目标外观...
例如：
- 替换为一件优雅的蓝色翻领商务西装，保持布料与暗纹质感
- 戴上一副款时尚墨镜与金色长款项链
- 替换为法式宫廷花园与喷泉场景"
                className="w-full min-h-[110px] bg-white border border-pastel-border rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-orange-500/30 outline-none resize-y shadow-sm text-pastel-text placeholder:text-slate-400 dark:bg-[#0c1424] dark:border-slate-800 transition-all"
              />
            </div>

            {/* 卡片 3: 多维度参考配置 */}
            <div className="rounded-2xl border border-pastel-border bg-pastel-card p-5 shadow-sm dark:bg-[#10192b]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#172238] text-xs font-black text-white dark:bg-amber-500 dark:text-black">
                    3
                  </span>
                  <h2 className="text-base font-black text-pastel-text flex items-center gap-2">
                    多维参考配置 <span className="text-xs font-bold text-pastel-muted">(点击缩略图放大裁切，默认2:3)</span>
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                {/* 样式参考图 */}
                <div 
                  className={`p-3.5 rounded-xl border bg-pastel-bg/50 transition-all relative ${
                    hoveredZone === 'ref' ? 'border-orange-500 ring-2 ring-orange-500/30 bg-orange-50/20' : 'border-pastel-border'
                  }`}
                  onMouseEnter={() => setHoveredZone('ref')}
                  onMouseLeave={() => setHoveredZone(null)}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingRef(false);
                    if (e.dataTransfer.files) {
                      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                      if (refFiles.length + files.length > 10) {
                        setError('参考图最多10张');
                        setTimeout(() => setError(null), 3000);
                        return;
                      }
                      setRefFiles(prev => [...prev, ...files]);
                      setRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-pastel-text flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-500" /> 替换参考图 (最多10张，支持勾选批量裂变)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-pastel-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isBatchMode}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setIsBatchMode(next);
                          if (next) setSelectedRefIdxs(refFiles.map((_, i) => i));
                          else setSelectedRefIdxs([]);
                        }}
                        className="rounded border-slate-300 accent-orange-500"
                      />
                      批量模式
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {refUrls.map((url, idx) => {
                      const isSelected = selectedRefIdxs.includes(idx);
                      return (
                        <div key={idx} className={`relative w-14 h-14 rounded-xl overflow-hidden border group/ref cursor-pointer transition-all ${isBatchMode && isSelected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-pastel-border'}`}>
                          <img
                            src={url}
                            alt={`Ref ${idx}`}
                            className="w-full h-full object-cover"
                            onClick={() => setCropTarget({ type: 'ref', index: idx, url, file: refFiles[idx] })}
                          />

                          <div
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover/ref:opacity-100 flex items-center justify-center gap-1 transition-all"
                            onClick={() => setCropTarget({ type: 'ref', index: idx, url, file: refFiles[idx] })}
                          >
                            <Crop className="w-3.5 h-3.5 text-white" />
                          </div>

                          {isBatchMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedRefIdxs(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b));
                              }}
                              className={`absolute left-1 top-1 z-10 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-black transition-all ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/90 border-gray-300 text-gray-500'}`}
                            >
                              {isSelected ? '✓' : ''}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRefImage(idx); }}
                            className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/ref:opacity-100 transition-all z-20"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}

                    {refFiles.length < 10 && (
                      <button
                        type="button"
                        onClick={() => refInputRef.current?.click()}
                        className="w-14 h-14 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-xl cursor-pointer hover:bg-white hover:border-orange-500/50 transition-colors text-pastel-muted hover:text-orange-500 dark:hover:bg-slate-800"
                      >
                        <Upload className="w-4 h-4 mb-0.5 opacity-60" />
                        <span className="text-[9px] font-bold">添加</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={refInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleRefUpload}
                    className="hidden"
                  />

                  {isBatchMode && refFiles.length > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t border-pastel-border pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRefIdxs(refFiles.map((_, i) => i))}
                          className="px-2 py-1 bg-white dark:bg-slate-800 border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-slate-50 transition-all"
                        >
                          全选
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRefIdxs([])}
                          className="px-2 py-1 bg-white dark:bg-slate-800 border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-text hover:bg-slate-50 transition-all"
                        >
                          全不选
                        </button>
                        <span className="text-[10px] font-bold text-pastel-muted ml-1">已选 {selectedRefIdxs.length} 张</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleBatchGenerate}
                        disabled={!sourceFile || !hasMask || !description || isGenerating || selectedRefIdxs.length === 0}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${!sourceFile || !hasMask || !description || isGenerating || selectedRefIdxs.length === 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                          : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:brightness-105'
                          }`}
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        批量生成 ({Math.min(10, selectedRefIdxs.length)})
                      </button>
                    </div>
                  )}
                </div>

                {/* 结构参考 / 裁切贴回 */}
                <div 
                  className={`p-3.5 rounded-xl border bg-pastel-bg/50 transition-all relative ${
                    hoveredZone === 'structure' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/20' : 'border-pastel-border'
                  }`}
                  onMouseEnter={() => setHoveredZone('structure')}
                  onMouseLeave={() => setHoveredZone(null)}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingStructure(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingStructure(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingStructure(false);
                    if (e.dataTransfer.files) {
                      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                      if (structureRefFiles.length + files.length > 2) {
                        setError('结构参考最多2张');
                        setTimeout(() => setError(null), 3000);
                        return;
                      }
                      setStructureRefFiles(prev => [...prev, ...files]);
                      setStructureRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-black text-pastel-text flex items-center gap-1.5">
                        <Crop className="w-3.5 h-3.5 text-blue-500" /> 结构参考 / 裁切贴回 (领口/袖口改款)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowStructureGuide(true)}
                        className="text-[10px] font-bold text-orange-500 underline"
                      >
                        使用说明
                      </button>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-pastel-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cropPasteEnabled}
                        onChange={(e) => setCropPasteEnabled(e.target.checked)}
                        className="rounded border-slate-300 accent-orange-500"
                      />
                      启用裁切贴回
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {structureRefUrls.map((url, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-pastel-border group/struct cursor-pointer">
                        <img
                          src={url}
                          alt={`Structure Ref ${idx}`}
                          className="w-full h-full object-cover"
                          onClick={() => setCropTarget({ type: 'structure', index: idx, url, file: structureRefFiles[idx] })}
                        />
                        <div
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover/struct:opacity-100 flex items-center justify-center transition-all"
                          onClick={() => setCropTarget({ type: 'structure', index: idx, url, file: structureRefFiles[idx] })}
                        >
                          <Crop className="w-3.5 h-3.5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeStructureRefImage(idx); }}
                          className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/struct:opacity-100 transition-all z-20"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {structureRefFiles.length < 2 && (
                      <button
                        type="button"
                        onClick={() => structureRefInputRef.current?.click()}
                        className="w-14 h-14 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-xl cursor-pointer hover:bg-white hover:border-orange-500/50 transition-colors text-pastel-muted hover:text-orange-500 dark:hover:bg-slate-800"
                      >
                        <Upload className="w-4 h-4 mb-0.5 opacity-60" />
                        <span className="text-[9px] font-bold">结构参考</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={structureRefInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleStructureRefUpload}
                    className="hidden"
                  />

                  {structureRefFiles.length > 0 && (
                    <div className="mt-3 border-t border-pastel-border pt-3">
                      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-black text-pastel-text">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" /> 贴回边缘微调参数
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="text-[10px] font-bold text-pastel-muted">
                          Padding: {cropPadding.toFixed(1)}
                          <input type="range" min={0} max={16} step={0.5} value={cropPadding} onChange={(e) => setCropPadding(Number(e.target.value))} className="w-full h-1 accent-orange-500 cursor-pointer" />
                        </label>
                        <label className="text-[10px] font-bold text-pastel-muted">
                          Blend: {cropBlend.toFixed(2)}
                          <input type="range" min={0} max={2} step={0.05} value={cropBlend} onChange={(e) => setCropBlend(Number(e.target.value))} className="w-full h-1 accent-orange-500 cursor-pointer" />
                        </label>
                        <label className="text-[10px] font-bold text-pastel-muted">
                          Expand: {cropExpand.toFixed(2)}
                          <input type="range" min={0} max={1} step={0.05} value={cropExpand} onChange={(e) => setCropExpand(Number(e.target.value))} className="w-full h-1 accent-orange-500 cursor-pointer" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 面料 & 颜色参考 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    className={`p-3 rounded-xl border bg-pastel-bg/50 transition-all relative ${
                      hoveredZone === 'fabric' ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/20' : 'border-pastel-border'
                    }`}
                    onMouseEnter={() => setHoveredZone('fabric')}
                    onMouseLeave={() => setHoveredZone(null)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFabric(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFabric(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFabric(false);
                      if (e.dataTransfer.files) {
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (fabricRefFiles.length + files.length > 2) {
                          setError('面料参考最多2张');
                          setTimeout(() => setError(null), 3000);
                          return;
                        }
                        setFabricRefFiles(prev => [...prev, ...files]);
                        setFabricRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                      }
                    }}
                  >
                    <label className="block text-xs font-black text-pastel-text mb-1.5 flex items-center gap-1">
                      <Shirt className="w-3.5 h-3.5 text-purple-500" /> 面料参考 (最多2张)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {fabricRefUrls.map((url, idx) => (
                        <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-pastel-border group/fab cursor-pointer">
                          <img
                            src={url}
                            alt={`Fabric Ref ${idx}`}
                            className="w-full h-full object-cover"
                            onClick={() => setCropTarget({ type: 'fabric', index: idx, url, file: fabricRefFiles[idx] })}
                          />
                          <div
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover/fab:opacity-100 flex items-center justify-center transition-all"
                            onClick={() => setCropTarget({ type: 'fabric', index: idx, url, file: fabricRefFiles[idx] })}
                          >
                            <Crop className="w-3.5 h-3.5 text-white" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeFabricRefImage(idx); }}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/fab:opacity-100 transition-all z-20"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {fabricRefFiles.length < 2 && (
                        <button
                          type="button"
                          onClick={() => fabricRefInputRef.current?.click()}
                          className="w-12 h-12 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-white transition-colors text-pastel-muted hover:text-purple-500 dark:hover:bg-slate-800"
                        >
                          <Upload className="w-3.5 h-3.5 mb-0.5 opacity-60" />
                          <span className="text-[8px] font-bold">面料</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={fabricRefInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFabricRefUpload}
                      className="hidden"
                    />
                  </div>

                  <div 
                    className={`p-3 rounded-xl border bg-pastel-bg/50 transition-all relative ${
                      hoveredZone === 'color' ? 'border-pink-500 ring-2 ring-pink-500/30 bg-pink-50/20' : 'border-pastel-border'
                    }`}
                    onMouseEnter={() => setHoveredZone('color')}
                    onMouseLeave={() => setHoveredZone(null)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingColor(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingColor(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingColor(false);
                      if (e.dataTransfer.files) {
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (colorRefFiles.length + files.length > 2) {
                          setError('颜色参考最多2张');
                          setTimeout(() => setError(null), 3000);
                          return;
                        }
                        setColorRefFiles(prev => [...prev, ...files]);
                        setColorRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                      }
                    }}
                  >
                    <label className="block text-xs font-black text-pastel-text mb-1.5 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-pink-500" /> 颜色参考 (最多2张)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {colorRefUrls.map((url, idx) => (
                        <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-pastel-border group/col cursor-pointer">
                          <img
                            src={url}
                            alt={`Color Ref ${idx}`}
                            className="w-full h-full object-cover"
                            onClick={() => setCropTarget({ type: 'color', index: idx, url, file: colorRefFiles[idx] })}
                          />
                          <div
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover/col:opacity-100 flex items-center justify-center transition-all"
                            onClick={() => setCropTarget({ type: 'color', index: idx, url, file: colorRefFiles[idx] })}
                          >
                            <Crop className="w-3.5 h-3.5 text-white" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeColorRefImage(idx); }}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/col:opacity-100 transition-all z-20"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {colorRefFiles.length < 2 && (
                        <button
                          type="button"
                          onClick={() => colorRefInputRef.current?.click()}
                          className="w-12 h-12 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-white transition-colors text-pastel-muted hover:text-pink-500 dark:hover:bg-slate-800"
                        >
                          <Upload className="w-3.5 h-3.5 mb-0.5 opacity-60" />
                          <span className="text-[8px] font-bold">颜色</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={colorRefInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleColorRefUpload}
                      className="hidden"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 卡片 4: 核心生成参数 */}
            <div className="rounded-2xl border border-pastel-border bg-pastel-card p-5 shadow-sm dark:bg-[#10192b]">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#172238] text-xs font-black text-white dark:bg-amber-500 dark:text-black">
                  4
                </span>
                <h2 className="text-base font-black text-pastel-text flex items-center gap-2">
                  核心生成参数
                </h2>
              </div>

              <div className="space-y-4">
                {/* 图像模型 */}
                <div>
                  <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-500" /> 图像模型选择
                  </label>
                  <CreativeImageModelSelector value={selectedModel} onChange={setSelectedModel} title="" compact className="border-0 bg-transparent p-0 shadow-none" />
                  <div className="hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${selectedModel === 'gemini-3.1-flash-image-preview'
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:bg-purple-950/40 dark:border-purple-400'
                        : 'border-pastel-border hover:border-purple-300 bg-pastel-bg/50'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <BananaIcon className="w-3.5 h-3.5" />
                        <span className={`text-xs font-black ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700 dark:text-purple-300' : 'text-pastel-text'}`}>
                          Banana 2
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-pastel-muted">3.1 Flash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${selectedModel === 'gemini-3-pro-image-preview'
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:bg-purple-950/40 dark:border-purple-400'
                        : 'border-pastel-border hover:border-purple-300 bg-pastel-bg/50'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <BananaIcon className="w-3.5 h-3.5" />
                        <span className={`text-xs font-black ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700 dark:text-purple-300' : 'text-pastel-text'}`}>
                          Banana Pro
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-pastel-muted">3.0 Pro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedModel('gpt-image-2')}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${selectedModel === 'gpt-image-2'
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:bg-purple-950/40 dark:border-purple-400'
                        : 'border-pastel-border hover:border-purple-300 bg-pastel-bg/50'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                        <span className={`text-xs font-black ${selectedModel === 'gpt-image-2' ? 'text-purple-700 dark:text-purple-300' : 'text-pastel-text'}`}>
                          GPT Image 2
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-pastel-muted">Ultra Quality</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedModel('qwen-image-3.0-pro')}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${selectedModel === 'qwen-image-3.0-pro'
                        ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20 dark:bg-cyan-950/40 dark:border-cyan-400'
                        : 'border-pastel-border hover:border-cyan-300 bg-pastel-bg/50'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                        <span className={`text-xs font-black ${selectedModel === 'qwen-image-3.0-pro' ? 'text-cyan-700 dark:text-cyan-300' : 'text-pastel-text'}`}>千问3.0pro</span>
                      </div>
                      <span className="text-[9px] font-bold text-pastel-muted">Qwen Image</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 画幅比例 */}
                  <div>
                    <label className="block text-xs font-bold text-pastel-muted mb-1.5 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-blue-500" /> 画幅比例
                    </label>
                    <button
                      type="button"
                      onClick={() => setRatioModalOpen(true)}
                      className="w-full flex items-center justify-between bg-pastel-bg border border-pastel-border rounded-xl py-2 px-3 text-xs font-bold text-pastel-text outline-none hover:border-orange-500 transition-all cursor-pointer dark:bg-[#0c1424]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-4 h-4 border border-slate-400 rounded-xs">
                          <span 
                            className="bg-slate-700 rounded-2xs" 
                            style={{ 
                              width: `${Math.min(12, (currentRatioMeta.width / 30) * 12)}px`, 
                              height: `${Math.min(12, (currentRatioMeta.height / 30) * 12)}px` 
                            }} 
                          />
                        </span>
                        {currentRatioMeta.label}
                      </span>
                      <ChevronDown className="w-4 h-4 text-pastel-muted" />
                    </button>
                  </div>

                  {/* 画质精度 */}
                  <div>
                    <label className="block text-xs font-bold text-pastel-muted mb-1.5 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-emerald-500" /> 画质精度
                    </label>
                    <div className="relative">
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as ImageResolution)}
                        className="w-full appearance-none bg-pastel-bg border border-pastel-border rounded-xl py-2 px-3 text-xs font-bold text-pastel-text outline-none focus:ring-2 focus:ring-orange-500/20 transition-all hover:border-orange-500/50 cursor-pointer dark:bg-[#0c1424]"
                      >
                        <option value={ImageResolution.RES_2K}>2K (默认高清商业级)</option>
                        {selectedModel !== 'gpt-image-2' && (
                          <option value={ImageResolution.RES_05K}>0.5K (512px 极速)</option>
                        )}
                        <option value={ImageResolution.RES_1K}>1K (标准画质)</option>
                        <option value={ImageResolution.RES_4K}>4K (超清细节)</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-pastel-muted">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 开始生成操作栏 */}
            <div className="space-y-3">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:border-red-900 animate-in slide-in-from-bottom-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {(error.includes("403") || error.includes("权限")) && (
                      <button
                        onClick={() => (window as any).aistudio?.openSelectKey()}
                        className="mt-1.5 text-xs font-black underline hover:text-red-700 flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5" /> 点击配置 API Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!sourceFile || !hasMask || !description || isGenerating}
                className={`w-full py-4 text-base font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] cursor-pointer ${!sourceFile || !hasMask || !description || isGenerating
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                  : 'bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105'
                  }`}
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paintbrush className="w-5 h-5" />}
                {isGenerating ? '正在局部替换生成中...' : '开始局部替换生成'}
              </button>

              {isGenerating && (
                <button
                  type="button"
                  onClick={handleCancelGenerate}
                  className="w-full py-3 text-xs font-black rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-all cursor-pointer"
                >
                  中止生成
                </button>
              )}

              {cancelMessage && !isGenerating && (
                <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
              )}
            </div>

          </div>

          {/* 右侧生成结果栏 */}
          <div className="flex flex-col h-full min-h-[500px]">
            <div className="flex-1 rounded-2xl border border-pastel-border bg-pastel-card p-5 shadow-sm flex flex-col overflow-hidden dark:bg-[#10192b]">
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#172238] text-xs font-black text-white dark:bg-amber-500 dark:text-black">
                    5
                  </span>
                  <h3 className="text-base font-black text-pastel-text flex items-center gap-2">
                    生成结果
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {(generatedImages.length > 0 || batchResults.length > 0) && (
                    <div className="flex items-center gap-1 bg-pastel-bg border border-pastel-border rounded-xl p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setResultView('single')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${resultView === 'single'
                          ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-800 dark:text-orange-400'
                          : 'text-pastel-muted hover:text-pastel-text'}`}
                      >
                        单次模式
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultView('batch')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${resultView === 'batch'
                          ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-800 dark:text-orange-400'
                          : 'text-pastel-muted hover:text-pastel-text'}`}
                      >
                        批量模式
                      </button>
                    </div>
                  )}

                  {generatedImages.length > 0 && resultView === 'single' && (
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full dark:bg-emerald-950 dark:text-emerald-300">
                      已完成
                    </span>
                  )}
                  {batchResults.length > 0 && resultView === 'batch' && (
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full dark:bg-emerald-950 dark:text-emerald-300">
                      批量完成
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center bg-pastel-bg/60 rounded-2xl border-2 border-dashed border-pastel-border/80 overflow-hidden relative p-4">
                {resultView === 'batch' ? (
                  batchResults.length > 0 ? (
                    <div className="w-full h-full overflow-y-auto space-y-4 no-scrollbar">
                      {batchResults
                        .slice()
                        .sort((a, b) => a.refIdx - b.refIdx)
                        .map((item) => (
                          <div key={`batch-${item.refIdx}`} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-pastel-border shadow-sm animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-pastel-border bg-slate-100 shrink-0">
                                <img src={item.refUrl} alt={`Ref ${item.refIdx}`} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-black text-pastel-text">参考图 #{item.refIdx + 1} 结果</div>
                                {item.error ? (
                                  <div className="text-[10px] font-bold text-red-500">{item.error}</div>
                                ) : (
                                  <div className="text-[10px] font-bold text-emerald-600">生成并贴回成功</div>
                                )}
                              </div>
                            </div>

                            {item.image && (
                              <div className="group/card relative rounded-lg overflow-hidden border border-pastel-border shadow-sm mt-2">
                                <img
                                  src={item.image}
                                  alt="Batch Inpainting Result"
                                  className="w-full h-auto cursor-zoom-in hover:brightness-105 transition-all duration-300"
                                  onClick={() => setZoomImage(item.image!)}
                                />
                                <div className="p-2 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => downloadImage(item.image!, `inpainting_batch_${item.refIdx + 1}_${Date.now()}.png`)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-pastel-border rounded-lg text-xs font-bold text-pastel-text hover:bg-slate-100 shadow-sm transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5 text-orange-500" /> 下载结果图
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setZoomImage(item.image!)}
                                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  >
                                    <Maximize2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-pastel-muted p-6">
                      <div className="w-20 h-20 bg-white dark:bg-slate-800 border-2 border-dashed border-pastel-border rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Grid className="w-10 h-10 text-orange-400 opacity-60" />
                      </div>
                      <p className="text-sm font-black text-pastel-text">
                        {isGenerating && progress ? progress : '批量替换生成的结果将显示在这里'}
                      </p>
                      {isGenerating && (
                        <div className="mt-4 flex justify-center">
                          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  generatedImages.length > 0 ? (
                    <div className="w-full h-full overflow-y-auto space-y-4 no-scrollbar">
                      {generatedImages.map((imgSrc, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-pastel-border shadow-sm animate-in fade-in duration-300">
                          <div className="relative rounded-lg overflow-hidden border border-pastel-border shadow-sm">
                            <img
                              src={imgSrc}
                              alt="Inpainting Result"
                              className="w-full h-auto cursor-zoom-in hover:brightness-105 transition-all duration-300"
                              onClick={() => setZoomImage(imgSrc)}
                            />
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <button
                              type="button"
                              onClick={() => downloadImage(imgSrc, `inpainting_${Date.now()}.png`)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#172238] dark:bg-amber-500 text-white dark:text-black rounded-xl text-xs font-black shadow-sm hover:opacity-90 transition-all cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" /> 下载高清大图
                            </button>

                            <button
                              type="button"
                              onClick={() => setZoomImage(imgSrc)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text"
                            >
                              <Maximize2 className="w-3.5 h-3.5" /> 放大查看
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-pastel-muted p-6">
                      <div className="w-20 h-20 bg-white dark:bg-slate-800 border-2 border-dashed border-pastel-border rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Paintbrush className="w-10 h-10 text-orange-500 opacity-70" />
                      </div>
                      <p className="text-sm font-black text-pastel-text">
                        {isGenerating && progress ? progress : '完成涂抹与设置后，生成的精修图片将显示在这里'}
                      </p>
                      {isGenerating && (
                        <div className="mt-4 flex justify-center">
                          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* 选择尺寸比例 Modal 弹窗 */}
      {ratioModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setRatioModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-pastel-border bg-white dark:bg-[#10192b] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-pastel-border px-6 py-4">
              <h3 className="text-base font-black text-pastel-text">选择尺寸比例</h3>
              <button
                type="button"
                onClick={() => setRatioModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-h-[75vh] overflow-y-auto no-scrollbar">
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const isSelected = aspectRatio === option.id;
                const isNotAllowed = selectedModel === 'gpt-image-2' && (option.id === AspectRatio.LANDSCAPE_4_3 || option.id === AspectRatio.PORTRAIT_3_4);

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isNotAllowed}
                    onClick={() => {
                      setAspectRatio(option.id as AspectRatio);
                      setRatioModalOpen(false);
                    }}
                    className={`relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-black dark:border-white ring-2 ring-black/10 dark:ring-white/20 bg-white dark:bg-slate-900 shadow-md'
                        : isNotAllowed
                        ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 dark:bg-slate-950'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-400 bg-blue-50/20 dark:bg-slate-900/40'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-black">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}

                    <div className="h-16 w-full flex items-center justify-center my-1">
                      <div
                        className={`rounded-xs border-2 transition-all ${
                          isSelected ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800' : 'border-slate-400 dark:border-slate-600'
                        }`}
                        style={{
                          width: `${option.width}px`,
                          height: `${option.height}px`,
                        }}
                      />
                    </div>

                    <span className="text-xs font-black text-pastel-text text-center mt-1">
                      {option.label}
                    </span>

                    <span className="text-[9px] font-bold text-pastel-muted text-center mt-1 leading-tight line-clamp-2">
                      {option.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 居中大图涂抹 Modal 弹窗 */}
      {showCanvasModal && sourceUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setShowCanvasModal(false)}
        >
          <div
            className="w-fit max-w-[92vw] h-[92vh] max-h-[95vh] bg-white dark:bg-[#10192b] rounded-3xl overflow-hidden shadow-2xl border border-pastel-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal 顶栏 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border px-6 py-3.5 bg-slate-50 dark:bg-[#182338]">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <Paintbrush className="w-6 h-6 text-orange-500 flex-shrink-0" />
                <h3 className="text-lg font-black text-pastel-text">局部替换画笔涂抹画布</h3>
                <span className="text-xs text-pastel-muted hidden xl:inline-flex items-center gap-1">
                  (按住 <kbd className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-bold text-slate-800 dark:text-slate-200">Space</kbd> 抓手平移，按 <kbd className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-bold text-slate-800 dark:text-slate-200">Z</kbd> 放大镜按 <kbd className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-bold text-slate-800 dark:text-slate-200">Alt</kbd> 缩小)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* 模式选择 */}
                <button
                  type="button"
                  onClick={() => setActiveTool('brush')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-black transition-all shadow-sm ${activeTool === 'brush'
                    ? 'bg-red-500 text-white ring-2 ring-red-500/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                >
                  <Paintbrush className="w-4 h-4" /> 画笔 <span className="text-xs opacity-80 font-semibold">[B]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('eraser')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-black transition-all shadow-sm ${activeTool === 'eraser'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                >
                  <Eraser className="w-4 h-4" /> 橡皮擦 <span className="text-xs opacity-80 font-semibold">[E]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('zoom')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-black transition-all shadow-sm ${activeTool === 'zoom'
                    ? 'bg-amber-500 text-black ring-2 ring-amber-500/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  title="点击画布放大，按住 Alt 点击缩小"
                >
                  <Search className="w-4 h-4" /> 放大镜 <span className="text-xs opacity-80 font-semibold">[Z]</span>
                </button>

                {/* 画笔多色选择盘 (红黄蓝绿黑白，默认红色) */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-pastel-border shadow-sm" title="画笔颜色选择">
                  {BRUSH_COLOR_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setBrushColor(item.hex); if (activeTool !== 'brush') setActiveTool('brush'); }}
                      className={`w-5 h-5 rounded-full transition-all border ${brushColor === item.hex ? 'ring-2 ring-orange-500 scale-110 border-white shadow' : 'border-slate-300/80 hover:scale-110'}`}
                      style={{ backgroundColor: item.hex }}
                      title={`画笔颜色: ${item.name}`}
                    />
                  ))}
                </div>

                {/* 画笔不透明度 (10% ~ 100%) */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-pastel-border shadow-sm" title="画笔不透明度调节">
                  <span className="text-xs font-bold text-pastel-muted">透明度</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={brushOpacity}
                    onChange={(e) => setBrushOpacity(Number(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-black text-pastel-muted w-10 text-right">{Math.round(brushOpacity * 100)}%</span>
                </div>

                {/* 粗细 Slider */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-pastel-border shadow-sm" title="在画布上滚动鼠标滚轮也可直接改变大小">
                  <button type="button" onClick={() => setBrushSize(Math.max(5, brushSize - 5))} className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min={5}
                    max={150}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 accent-orange-500 cursor-pointer"
                  />
                  <button type="button" onClick={() => setBrushSize(Math.min(150, brushSize + 5))} className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs sm:text-sm font-black text-pastel-muted w-11 text-right">{brushSize}px</span>
                </div>

                <div className="h-5 w-px bg-pastel-border mx-1 hidden sm:block" />

                {/* 画板 0.5x ~ 4.0x 缩放控制器 */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-pastel-border shadow-sm">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                    className="p-1 text-slate-600 hover:text-orange-500 dark:text-slate-300 transition-colors"
                    title="缩小"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs sm:text-sm font-black text-pastel-text min-w-14 text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.min(4.0, Number((prev + 0.25).toFixed(2))))}
                    className="p-1 text-slate-600 hover:text-orange-500 dark:text-slate-300 transition-colors"
                    title="放大"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setZoomLevel(1.0); setPanOffset({ x: 0, y: 0 }); }}
                    className="text-xs font-black px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 ml-1 transition-colors"
                  >
                    重置
                  </button>
                </div>

                {/* ✂️ 顶栏直接裁切按钮 (默认2:3) */}
                {sourceFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setCropTarget({ type: 'source', url: sourceUrl, file: sourceFile });
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
                  >
                    <Crop className="w-4 h-4 text-orange-400" /> 裁切原图
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearMask}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 border border-pastel-border transition-all shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" /> 清除
                </button>

                <button
                  type="button"
                  onClick={() => { syncMaskPreview(); setShowCanvasModal(false); }}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors ml-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 大图画板容器 */}
            <div
              ref={canvasViewportRef}
              className="flex-1 overflow-hidden p-3 sm:p-5 bg-slate-950 flex items-center justify-center min-h-[520px] max-h-[78vh] select-none relative"
            >
              <div
                ref={canvasContainerRef}
                className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black transition-transform duration-75 origin-center"
                style={{
                  transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoomLevel})`,
                  willChange: 'transform',
                  cursor: isSpacePressed
                    ? isPanDragging ? 'grabbing' : 'grab'
                    : activeTool === 'zoom'
                    ? (isAltPressed ? 'zoom-out' : 'zoom-in')
                    : 'none',
                }}
              >
                <canvas
                  ref={sourceCanvasRef}
                  className="block object-contain"
                />
                <canvas
                  ref={maskCanvasRef}
                  className="absolute top-0 left-0 w-full h-full transition-opacity duration-75"
                  style={{ opacity: activeTool === 'eraser' ? 1.0 : brushOpacity }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />

                {/* 涂抹画笔光圈指示器 (采用 GPU translate3d 零延迟渲染，避免全页面 React 重新渲染) */}
                {!isSpacePressed && activeTool !== 'zoom' && (
                  <div
                    ref={cursorRef}
                    className="pointer-events-none absolute left-0 top-0 rounded-full border-2 z-30 opacity-0 transition-opacity duration-150"
                    style={{
                      width: brushSize,
                      height: brushSize,
                      willChange: 'transform',
                      borderColor: activeTool === 'eraser' ? 'rgba(59, 130, 246, 0.9)' : hexToRgba(brushColor, 0.9),
                      backgroundColor: activeTool === 'eraser' ? 'rgba(59, 130, 246, 0.2)' : hexToRgba(brushColor, brushOpacity * 0.4),
                    }}
                  />
                )}
              </div>
            </div>

            {/* Modal 底栏 */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-pastel-border bg-white dark:bg-[#182338]">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${hasMask ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} style={hasMask ? { backgroundColor: brushColor } : undefined} />
                <span className="text-xs font-bold text-pastel-text">
                  {isSpacePressed
                    ? '🖐️ 空格抓手平移中：按住鼠标左键可自由拖拽挪动画面'
                    : activeTool === 'zoom'
                    ? (isAltPressed ? '🔍⁻ 缩小镜模式：点击画布缩小视角' : '🔍⁺ 放大镜模式：点击画布放大视角 (按住 Alt 变缩小)')
                    : hasMask
                    ? '涂抹蒙版区域已就绪'
                    : '按住 [Space] 抓手平移，按 [Z] 放大镜(Alt缩小)，按 [B] 换画笔'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMaskGuide(true)}
                  className="text-xs font-bold text-orange-500 underline mr-2"
                >
                  涂抹技巧说明
                </button>

                <button
                  type="button"
                  onClick={() => {
                    syncMaskPreview();
                    setShowCanvasModal(false);
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-xl text-xs font-black shadow-lg hover:brightness-105 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> 完成涂抹并保存蒙版
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8 手柄图片放大与裁切 Modal 弹窗 (默认 2:3 比例) */}
      {cropTarget && (
        <ImageCropModal
          target={cropTarget}
          onClose={() => setCropTarget(null)}
          onConfirmCrop={handleConfirmCrop}
        />
      )}

      {/* 正确涂抹指南 Modal */}
      {showMaskGuide && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
          onClick={() => setShowMaskGuide(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#10192b] rounded-3xl shadow-2xl border border-pastel-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-pastel-border pb-3">
              <div className="flex items-center gap-2 font-black text-base text-pastel-text">
                <Paintbrush className="w-4 h-4 text-orange-500" /> 正确涂抹方式指南
              </div>
              <button 
                type="button" 
                onClick={() => setShowMaskGuide(false)} 
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs font-medium text-pastel-muted leading-relaxed">
              <p className="text-pastel-text font-bold">做领口、袖口、包边修图时，请特别注意：</p>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li>不要只涂抹一条极细的红线，容易导致 AI 生成边缘断裂。</li>
                <li>涂抹区域应当完全覆盖旧边缘、需替换为皮肤或背景的部分，以及新边缘经过的路径。</li>
                <li>涂抹区域宁愿稍微外扩放大一点，避免遗留旧版型的痕迹。</li>
                <li>使用橡皮擦工具可随时修正涂抹过度的地方。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 结构参考裁切贴回说明 Modal */}
      {showStructureGuide && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
          onClick={() => setShowStructureGuide(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#10192b] rounded-3xl shadow-2xl border border-pastel-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-pastel-border pb-3">
              <div className="flex items-center gap-2 font-black text-base text-pastel-text">
                <Crop className="w-4 h-4 text-blue-500" /> 结构参考裁切贴回说明
              </div>
              <button 
                type="button" 
                onClick={() => setShowStructureGuide(false)} 
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs font-medium text-pastel-muted leading-relaxed">
              <p className="text-pastel-text font-bold">结构参考图与贴回原理：</p>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li>上传目标结构图（如特定领口、袖口或纹理构造），AI 会将白色蒙版区域锁定该结构的版型进行绘制。</li>
                <li>生成后仅把白色蒙版区域自动裁切并无缝缝合贴回原图，完全不破坏未涂抹的全身和背景。</li>
                <li><strong>Padding</strong>：微调贴回区块外扩包围盒的尺寸。</li>
                <li><strong>Blend</strong>：控制新老图像接触边缘的羽化过度渐变程度。</li>
                <li><strong>Expand</strong>：蒙版黑白边缘的外扩模糊范围。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 大图放大的 Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomImage}
            alt="Zoomed"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};

export default InpaintingTab;
