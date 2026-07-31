import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Loader2,
  Download,
  ZoomIn,
  RefreshCw,
  X,
  Zap,
  AlertCircle,
  Layers,
  Palette,
  UserRoundCog,
  Shirt,
  Footprints,
  CheckCircle2,
  Plus,
  Trash2,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Camera,
  Grid3x3,
  Check,
  Eye,
  UserCircle2,
} from 'lucide-react';
import { generateUniversalTryOn } from '../services/geminiService';
import { compressImage, getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { ModelLibraryModal } from './ModelLibraryModal';
import { modelLibrary, ModelItem } from '../services/modelLibrary';

export type UniversalTryOnSubMode = 'model' | 'mannequin' | 'shoes';
export type ClothingType = 'two-piece' | 'one-piece';
export type ActiveUploadTarget = 'top' | 'bottom' | 'full' | 'model';
type Stage = 1 | 2 | 3 | 4;
type SelectionModalType = 'model' | 'ratio' | 'resolution' | null;

interface UploadedImage {
  id?: string;
  file?: File;
  preview: string;
  base64: string;
  mime: string;
  name?: string;
}

interface UniversalTask {
  id: string;
  createdAt: number;
  subMode: UniversalTryOnSubMode;
  clothingType: ClothingType;
  status: 'editing' | 'generating' | 'done' | 'error';
  topImages: UploadedImage[];
  bottomImages: UploadedImage[];
  fullImages: UploadedImage[];
  productImages: UploadedImage[];
  modelReference: UploadedImage | null;
  selectedModelPersonaId?: string | null;
  customPrompt: string;
  selectedModel: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  count: number;
  stage: Stage;
  agentStatus: string;
  agentLog: string[];
  cotStep: number;
  generatedResults: string[];
}

const SUB_MODE_OPTIONS: Array<{
  id: UniversalTryOnSubMode;
  title: string;
  subtitle: string;
  icon: any;
  promptExample: string;
}> = [
  {
    id: 'model',
    title: '模特换衣',
    subtitle: '真人/模特服装穿搭拟真迁移',
    icon: Shirt,
    promptExample: '保持模特面部肤色与动作，服装自然贴合身体，呈现微风垂坠褶皱感。',
  },
  {
    id: 'mannequin',
    title: '人台换衣',
    subtitle: '人台服饰转化商业模特实穿',
    icon: Layers,
    promptExample: '将人台上的服装转换为时尚商业街拍模特穿着，呈现高级光影质感。',
  },
  {
    id: 'shoes',
    title: '鞋靴试穿',
    subtitle: '腿部/脚部鞋靴真实上脚试穿',
    icon: Footprints,
    promptExample: '鞋靴精准贴合模特双脚与踝关节透视，保持鞋面皮质光彩与地面对接阴影。',
  },
];

const MODEL_OPTIONS = [
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image',
    hint: '推荐',
    desc: '面部细节与面料纹理精准锁定，极致高精试穿算法',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image',
    hint: '旗舰商业级',
    desc: '专业级画质细节 · 超强构图与高精度材质渲染',
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    hint: '高清逼真',
    desc: '商业摄影级画质 · 适合大牌时尚 Lookbook 与时尚海报',
  },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3 竖版', desc: '经典单反人像与海报首选' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版', desc: '电商时尚主图与模特常用' },
  { id: AspectRatio.SQUARE, label: '1:1 方版', desc: '正方形商品排版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏', desc: '手机全屏与短视频展示' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版', desc: '画册长图与横屏展示' },
] as const;

const RESOLUTION_OPTIONS = [
  { id: ImageResolution.RES_2K, label: '2K 高清 (推荐)', desc: '标准电商画质与快速交付' },
  { id: ImageResolution.RES_4K, label: '4K 超清', desc: '极致 8K 放大面料与缝线纹理' },
] as const;

// Inline SVG Preset Recommendations
const SVG_TOP_PRESETS = [
  {
    name: '经典黑白拼袖T恤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="%23f8fafc"><rect width="300" height="400" fill="%23f1f5f9"/><path d="M70,80 L110,60 L190,60 L230,80 L250,140 L210,160 L200,120 L200,320 L100,320 L100,120 L90,160 L50,140 Z" fill="%23ffffff" stroke="%23334155" stroke-width="4"/><path d="M70,80 L110,60 L130,100 L90,160 Z" fill="%230f172a"/><path d="M230,80 L190,60 L170,100 L210,160 Z" fill="%230f172a"/><path d="M130,60 Q150,85 170,60" fill="none" stroke="%23334155" stroke-width="4"/><text x="150" y="370" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23475569">上装 · 时尚T恤</text></svg>',
  },
  {
    name: '牛仔外套',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="%23e0f2fe"><rect width="300" height="400" fill="%23f0f9ff"/><path d="M60,80 L110,50 L190,50 L240,80 L260,180 L210,190 L195,130 L195,330 L105,330 L105,130 L90,190 L40,180 Z" fill="%230284c7" stroke="%230369a1" stroke-width="4"/><line x1="150" y1="50" x2="150" y2="330" stroke="%230369a1" stroke-width="3"/><rect x="115" y="140" width="30" height="35" fill="%230369a1" rx="4"/><rect x="155" y="140" width="30" height="35" fill="%230369a1" rx="4"/><text x="150" y="370" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%230369a1">上装 · 复古牛仔</text></svg>',
  },
  {
    name: '真丝白衬衫',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fafafa"/><path d="M65,75 L110,55 L190,55 L235,75 L255,200 L215,205 L195,130 L195,340 L105,340 L105,130 L85,205 L45,200 Z" fill="%23ffffff" stroke="%2364748b" stroke-width="3"/><path d="M110,55 L150,110 L190,55 L170,55 L150,90 L130,55 Z" fill="%23e2e8f0" stroke="%2364748b" stroke-width="2"/><line x1="150" y1="110" x2="150" y2="340" stroke="%2394a3b8" stroke-width="2" stroke-dasharray="4 4"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23475569">上装 · 法式衬衫</text></svg>',
  },
  {
    name: '条纹针织衫',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f8fafc"/><path d="M65,75 L110,55 L190,55 L235,75 L255,200 L215,205 L195,130 L195,330 L105,330 L105,130 L85,205 L45,200 Z" fill="%231e3a8a" stroke="%231e293b" stroke-width="3"/><line x1="105" y1="150" x2="195" y2="150" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="190" x2="195" y2="190" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="230" x2="195" y2="230" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="270" x2="195" y2="270" stroke="%23ffffff" stroke-width="10"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%231e3a8a">上装 · 条纹毛衣</text></svg>',
  },
];

const SVG_BOTTOM_PRESETS = [
  {
    name: '浅蓝水洗牛仔裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f0f9ff"/><path d="M100,60 L200,60 L215,350 L160,350 L150,140 L140,350 L85,350 Z" fill="%2338bdf8" stroke="%230284c7" stroke-width="4"/><line x1="150" y1="60" x2="150" y2="140" stroke="%230369a1" stroke-width="3"/><rect x="100" y="60" width="100" height="20" fill="%230284c7" rx="3"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%230284c7">下装 · 牛仔阔腿裤</text></svg>',
  },
  {
    name: '米白色休凉西裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fefce8"/><path d="M105,60 L195,60 L210,350 L158,350 L150,150 L142,350 L90,350 Z" fill="%23fef08a" stroke="%23ca8a04" stroke-width="3"/><line x1="125" y1="80" x2="125" y2="340" stroke="%23eab308" stroke-width="1 stroke-dasharray=3"/><line x1="175" y1="80" x2="175" y2="340" stroke="%23eab308" stroke-width="1 stroke-dasharray=3"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23ca8a04">下装 · 垂感西裤</text></svg>',
  },
  {
    name: '高腰百褶半身裙',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fdf2f8"/><path d="M110,60 L190,60 L230,280 L70,280 Z" fill="%23f472b6" stroke="%23db2777" stroke-width="3"/><line x1="120" y1="60" x2="90" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="140" y1="60" x2="130" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="160" y1="60" x2="170" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="180" y1="60" x2="210" y2="280" stroke="%23be185d" stroke-width="2"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23db2777">下装 · 高腰半身裙</text></svg>',
  },
];

const SVG_FULL_PRESETS = [
  {
    name: '法式印花连衣裙',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23faf5ff"/><path d="M110,50 L190,50 L210,120 L240,340 L60,340 L90,120 Z" fill="%23c084fc" stroke="%239333ea" stroke-width="3"/><path d="M110,50 Q150,90 190,50" fill="none" stroke="%237e22ce" stroke-width="3"/><circle cx="120" cy="180" r="8" fill="%23ffffff"/><circle cx="180" cy="220" r="8" fill="%23ffffff"/><circle cx="140" cy="280" r="8" fill="%23ffffff"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%239333ea">连体 · 优雅连衣裙</text></svg>',
  },
  {
    name: '干练工装连体裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f0fdf4"/><path d="M100,50 L200,50 L220,130 L210,350 L155,350 L150,180 L145,350 L90,350 L80,130 Z" fill="%234ade80" stroke="%2316a34a" stroke-width="3"/><rect x="110" y="90" width="35" height="30" fill="%2316a34a" rx="4"/><rect x="155" y="90" width="35" height="30" fill="%2316a34a" rx="4"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%2316a34a">连体 · 工装裤</text></svg>',
  },
];

const SelectionModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="w-full max-w-2xl overflow-hidden rounded-3xl border border-pastel-border bg-white shadow-2xl dark:bg-[#10192b]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-pastel-border px-6 py-4">
        <h3 className="text-base font-black text-pastel-text">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-pastel-bg text-pastel-muted hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
    </div>
  </div>
);

const COT_STEPS = [
  { id: 1, label: "服饰/鞋靴结构解构", desc: "正在分析商品剪裁、领口/鞋楦版型与印花特征..." },
  { id: 2, label: "模特体态与骨架匹配", desc: "正在分析人体 3D 透视骨架、脚部关节与肤色光照..." },
  { id: 3, label: "三维物理拟合与变态重绘", desc: "正在将服装/鞋靴柔性弯曲变形并包裹人体曲面..." },
  { id: 4, label: "环境光影与阴影重构", desc: "正在匹配现场主光、环境软光与脚部/贴身阴影..." },
  { id: 5, label: "材质纹理与缝线增强", desc: "正在渲染 8K 级面料织纹、皮质光泽与金属扣细节..." },
  { id: 6, label: "边缘自然融合", desc: "正在平滑衣领、袖口与脚踝边界，消除违和痕迹..." },
  { id: 7, label: "Color Guard 色彩调和", desc: "正在校准商品原色，防止色偏与皮肤泛红..." },
  { id: 8, label: "商业级高保真交付", desc: "正在生成高清试穿效果大图..." },
];

const createNewTask = (subMode: UniversalTryOnSubMode = 'model'): UniversalTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  subMode,
  clothingType: 'two-piece',
  status: 'editing',
  topImages: [],
  bottomImages: [],
  fullImages: [],
  productImages: [],
  modelReference: null,
  selectedModelPersonaId: null,
  customPrompt: '',
  selectedModel: MODEL_OPTIONS[0].id,
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  count: 1,
  stage: 1,
  agentStatus: '输入准备 Agent · 等待素材',
  agentLog: ['已初始化万物上身任务'],
  cotStep: 0,
  generatedResults: [],
});

interface UniversalTryOnTabProps {
  isActive?: boolean;
}

const UniversalTryOnTab: React.FC<UniversalTryOnTabProps> = ({ isActive = true }) => {
  const [tasks, setTasks] = useState<UniversalTask[]>(() => [createNewTask('model')]);
  const [activeTaskId, setActiveTaskId] = useState<string>(() => tasks[0].id);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [selectionModal, setSelectionModal] = useState<SelectionModalType>(null);
  const [activeUploadTarget, setActiveUploadTarget] = useState<ActiveUploadTarget>('top');

  // Model Library Modal States
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelPersonas, setModelPersonas] = useState<ModelItem[]>([]);

  useEffect(() => {
    modelLibrary.list().then(setModelPersonas).catch(() => {});
  }, []);

  const handleCreateModelPersona = async (name: string, file: File) => {
    const compressed = await compressImage(file, 2048, 0.92);
    const model: ModelItem = {
      id: crypto.randomUUID(),
      name,
      preview: `data:${compressed.mime};base64,${compressed.base64}`,
      base64: compressed.base64,
      mime: compressed.mime,
      prompt: `High-Precision Model Reference: reproduce exact face contour, eyes, nose, lips, hair, and body type matching ${name}.`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await modelLibrary.save(model);
    setModelPersonas((prev) => [model, ...prev]);
    updateCurrentTask((t) => ({ ...t, selectedModelPersonaId: model.id }));
  };

  const handleRenameModelPersona = async (model: ModelItem, newName: string) => {
    const next = { ...model, name: newName, updatedAt: Date.now() };
    await modelLibrary.save(next);
    setModelPersonas((prev) => prev.map((m) => (m.id === model.id ? next : m)));
  };

  const handleDeleteModelPersona = async (id: string) => {
    await modelLibrary.remove(id);
    setModelPersonas((prev) => prev.filter((m) => m.id !== id));
    updateCurrentTask((t) => (t.selectedModelPersonaId === id ? { ...t, selectedModelPersonaId: null } : t));
  };

  const currentTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  const {
    startGenerationTask,
    cancelGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lightbox Zoom Modal Image State (For ALL images)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // File input refs
  const topInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [isDraggingTop, setIsDraggingTop] = useState(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);
  const [isDraggingFull, setIsDraggingFull] = useState(false);
  const [isDraggingModel, setIsDraggingModel] = useState(false);

  const updateCurrentTask = useCallback((updater: (task: UniversalTask) => UniversalTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTaskId ? updater(t) : t))
    );
  }, [activeTaskId]);

  const handleAddNewTask = (mode: UniversalTryOnSubMode = 'model') => {
    const newTask = createNewTask(mode);
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tasks.length <= 1) {
      const resetTask = createNewTask('model');
      setTasks([resetTask]);
      setActiveTaskId(resetTask.id);
      return;
    }
    const nextTasks = tasks.filter((t) => t.id !== id);
    setTasks(nextTasks);
    if (activeTaskId === id) {
      setActiveTaskId(nextTasks[0].id);
    }
  };

  const processImageFile = async (file: File): Promise<UploadedImage> => {
    const { base64, mime } = await compressImage(file, 2048, 0.92);
    return {
      id: crypto.randomUUID(),
      file,
      preview: `data:${mime};base64,${base64}`,
      base64,
      mime,
      name: file.name,
    };
  };

  const handleUploadTarget = async (files: FileList | File[], target: ActiveUploadTarget) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;
    try {
      const processed = await Promise.all(fileList.slice(0, 6).map(processImageFile));
      updateCurrentTask((task) => {
        if (target === 'top') {
          return { ...task, topImages: [...task.topImages, ...processed].slice(0, 6) };
        } else if (target === 'bottom') {
          return { ...task, bottomImages: [...task.bottomImages, ...processed].slice(0, 6) };
        } else if (target === 'full') {
          return { ...task, fullImages: [...task.fullImages, ...processed].slice(0, 6) };
        } else {
          return { ...task, modelReference: processed[0] };
        }
      });
    } catch (err: any) {
      setError('图像处理失败，请重试');
    }
  };

  const handlePresetSelect = async (preset: { name: string; preview: string }, target: ActiveUploadTarget) => {
    const base64 = preset.preview.startsWith('data:')
      ? preset.preview.split(',')[1] || ''
      : preset.preview;
    const item: UploadedImage = {
      id: crypto.randomUUID(),
      preview: preset.preview,
      base64,
      mime: 'image/svg+xml',
      name: preset.name,
    };

    updateCurrentTask((task) => {
      if (target === 'top') {
        return { ...task, topImages: [...task.topImages, item].slice(0, 6) };
      } else if (target === 'bottom') {
        return { ...task, bottomImages: [...task.bottomImages, item].slice(0, 6) };
      } else {
        return { ...task, fullImages: [...task.fullImages, item].slice(0, 6) };
      }
    });
  };

  useImagePaste((files) => {
    if (files.length > 0) {
      handleUploadTarget(files, activeUploadTarget);
    }
  }, isActive && !isLoading);

  const handleStartTryOn = async () => {
    let productImgs: Array<{ base64: string; mime: string }> = [];
    let customPromptAddon = '';

    if (currentTask.subMode === 'model') {
      if (currentTask.clothingType === 'two-piece') {
        if (currentTask.topImages.length === 0 && currentTask.bottomImages.length === 0) {
          setError('请至少在【上装】或【下装】中上传一张服装素材图');
          return;
        }
        productImgs = [
          ...currentTask.topImages.map((img) => ({ base64: img.base64, mime: img.mime })),
          ...currentTask.bottomImages.map((img) => ({ base64: img.base64, mime: img.mime })),
        ];
        customPromptAddon = `[Two-Piece Try-On]: Fit upper garment (Top Images) and lower garment (Bottom Images) onto the model figure.`;
      } else {
        if (currentTask.fullImages.length === 0) {
          setError('请在【连体/连衣裙】区域上传至少一张服装素材图');
          return;
        }
        productImgs = currentTask.fullImages.map((img) => ({ base64: img.base64, mime: img.mime }));
        customPromptAddon = `[One-Piece Try-On]: Fit the full dress/suit (Full Outfit Images) onto the model figure.`;
      }
    } else {
      const combined = [
        ...currentTask.topImages,
        ...currentTask.bottomImages,
        ...currentTask.fullImages,
        ...currentTask.productImages,
      ];
      if (combined.length === 0) {
        setError('请至少上传一张商品/服饰素材图');
        return;
      }
      productImgs = combined.map((img) => ({ base64: img.base64, mime: img.mime }));
    }

    setError(null);
    setIsLoading(true);

    const { taskId, signal } = startGenerationTask();

    // Check if fixed model persona from library is selected
    let modelRef = currentTask.modelReference
      ? { base64: currentTask.modelReference.base64, mime: currentTask.modelReference.mime }
      : null;

    if (!modelRef && currentTask.selectedModelPersonaId) {
      const persona = modelPersonas.find((m) => m.id === currentTask.selectedModelPersonaId);
      if (persona?.base64 && persona?.mime) {
        modelRef = { base64: persona.base64, mime: persona.mime };
        customPromptAddon += ` Maintain exact facial structure and identity matching fixed model "${persona.name}".`;
      }
    }

    const fullPrompt = `${currentTask.customPrompt} ${customPromptAddon}`.trim();

    updateCurrentTask((t) => ({
      ...t,
      status: 'generating',
      stage: 2,
      cotStep: 1,
      agentStatus: `AI 试穿 Agent · 正在对「${SUB_MODE_OPTIONS.find((s) => s.id === t.subMode)?.title}」素材进行 CoT 思维链解构...`,
      agentLog: [...t.agentLog, `开始执行「${SUB_MODE_OPTIONS.find((s) => s.id === t.subMode)?.title}」算法推理`],
    }));

    const stepInterval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task.id === activeTaskId && task.cotStep < 7) {
            const nextStep = task.cotStep + 1;
            const nextStage = nextStep >= 7 ? 4 : nextStep >= 4 ? 3 : 2;
            return {
              ...task,
              cotStep: nextStep,
              stage: nextStage as Stage,
              agentStatus: `AI 试穿 Agent · Step ${nextStep}: ${COT_STEPS[nextStep - 1]?.label}`,
              agentLog: [...task.agentLog, COT_STEPS[nextStep - 1]?.desc || '处理中...'],
            };
          }
          return task;
        })
      );
    }, 1800);

    try {
      const results = await generateUniversalTryOn(
        productImgs,
        modelRef,
        currentTask.subMode,
        fullPrompt,
        {
          aspectRatio: currentTask.aspectRatio,
          resolution: currentTask.resolution,
          count: currentTask.count,
          model: currentTask.selectedModel,
          signal,
        }
      );

      clearInterval(stepInterval);

      if (results && results.length > 0) {
        updateCurrentTask((t) => ({
          ...t,
          status: 'done',
          stage: 4,
          cotStep: 8,
          generatedResults: results,
          agentStatus: 'AI 试穿 Agent · 万物上身成果渲染完成！',
          agentLog: [...t.agentLog, '🎉 商业级试穿渲染交付成功！已生成高清大图'],
        }));

        try {
          await saveGeneratedProject({
            type: 'MODEL',
            generated: results,
            original: productImgs.map((img) => `data:${img.mime};base64,${img.base64}`),
            prompt: fullPrompt,
            params: {
              subMode: currentTask.subMode,
              clothingType: currentTask.clothingType,
              model: currentTask.selectedModel,
              aspectRatio: currentTask.aspectRatio,
              resolution: currentTask.resolution,
            },
          });
        } catch (e) {
          console.warn('保存项目历史失败:', e);
        }
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      if (isAbortError(err)) {
        updateCurrentTask((t) => ({
          ...t,
          status: 'editing',
          stage: 1,
          agentStatus: '任务已被用户手动取消',
          agentLog: [...t.agentLog, '用户终止了生成任务'],
        }));
      } else {
        const msg = getErrorMessage(err);
        setError(msg);
        updateCurrentTask((t) => ({
          ...t,
          status: 'error',
          stage: 1,
          agentStatus: `生成错误: ${msg}`,
          agentLog: [...t.agentLog, `错误提示: ${msg}`],
        }));
      }
    } finally {
      finishGenerationTask(taskId);
      setIsLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'generating':
        return '试穿渲染中';
      case 'done':
        return '已生成';
      case 'error':
        return '需要重试';
      default:
        return '编辑中';
    }
  };

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        {/* HEADER SECTION - 1:1 Matched with ModelSceneFissionTab */}
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted">
            <Sparkles className="h-4 w-4 text-[#ed6d46]" />
            AI 服饰视觉工坊
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI 万物上身</h1>
          <p className="mt-1 text-sm text-pastel-muted">
            模特换装 · 人台试穿 · 鞋靴上脚，Agent 全流程自然拟合交付高清大图
          </p>

          {/* STEP PROGRESS BAR */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {(['素材输入', '试穿拟合方案', 'CoT光影渲染', '高清成果交付'] as const).map((label, index) => {
              const step = (index + 1) as Stage;
              const isCurrent = currentTask.stage === step;
              return (
                <React.Fragment key={label}>
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                      isCurrent
                        ? 'bg-[#172238] text-white shadow-sm ring-2 ring-[#172238]/20'
                        : currentTask.stage > step
                        ? 'bg-pastel-card text-pastel-text'
                        : 'bg-pastel-card/50 text-pastel-muted opacity-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${
                        isCurrent ? 'bg-white text-[#172238]' : 'bg-slate-200 dark:bg-slate-700 text-pastel-text'
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  {index < 3 && <span className="h-px w-3 bg-pastel-border sm:w-7" />}
                </React.Fragment>
              );
            })}
          </div>
        </header>

        {/* FLOATING HISTORY TOGGLE BUTTON */}
        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-lg xl:left-24"
          >
            <PanelLeftOpen className="h-4 w-4" />
            生成记录{' '}
            <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs">{tasks.length}</span>
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

        {/* ERROR BANNER */}
        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* THREE-COLUMN GRID - 1:1 Matched Width & Proportions */}
        <div
          className={`grid grid-cols-1 gap-4 ${
            historyOpen
              ? 'xl:grid-cols-[16rem_30rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[30rem_minmax(0,1fr)]'
          }`}
        >
          {/* 1. LEFT SIDEBAR: GENERATION HISTORY */}
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-black text-pastel-text">生成记录</h2>
                  <p className="text-xs text-pastel-muted">可同时开多个试穿任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border hover:bg-pastel-bg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAddNewTask(currentTask.subMode)}
                disabled={isLoading}
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172238] text-sm font-black text-white disabled:opacity-50 hover:bg-[#1f2e4c] transition"
              >
                <Plus className="h-4 w-4" />
                新开任务
              </button>

              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => {
                  const cover =
                    task.generatedResults[0] ||
                    task.topImages[0]?.preview ||
                    task.fullImages[0]?.preview ||
                    task.productImages[0]?.preview;
                  const subModeInfo = SUB_MODE_OPTIONS.find((s) => s.id === task.subMode);
                  return (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveTaskId(task.id)}
                        className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                          task.id === activeTaskId
                            ? 'border-pastel-highlight ring-2 ring-orange-100'
                            : 'border-pastel-border hover:border-orange-300'
                        }`}
                      >
                        <div className="relative aspect-square bg-white dark:bg-slate-800">
                          {cover ? (
                            <img src={cover} alt="任务预览" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1 bg-[#172238]/90 text-xs font-black text-white">
                            {task.status === 'generating' && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-pastel-muted">
                          <span className="font-bold">{subModeInfo?.title}</span>
                          <span>
                            {task.subMode === 'model' && task.clothingType === 'two-piece'
                              ? `${task.topImages.length + task.bottomImages.length}张`
                              : `${task.fullImages.length || task.topImages.length}张`}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        disabled={isLoading && task.id === activeTaskId}
                        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow transition hover:bg-red-500 group-hover:opacity-100 disabled:opacity-30"
                        title="删除任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* 2. MIDDLE COLUMN: FORM CONFIG CARDS */}
          <div className="space-y-4">
            {/* Step 1 Card: 试穿模式 */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 font-black text-pastel-text">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#172238] text-sm text-white">
                  1
                </span>
                试穿模式
              </h2>
              <p className="mt-1 text-xs text-pastel-muted">
                选择欲上身拟合的场景模式：模特换衣、人台转化或鞋靴试穿
              </p>
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-pastel-bg p-1">
                {SUB_MODE_OPTIONS.map((sub) => {
                  const Icon = sub.icon;
                  const active = currentTask.subMode === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => updateCurrentTask((t) => ({ ...t, subMode: sub.id }))}
                      className={`min-h-11 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-pastel-card shadow-sm text-pastel-text'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {sub.title}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 2 Card: 平铺/人台图上传 Card (Refined 1:1 matching Screenshot 1 & 2) */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-pastel-border pb-3">
                <h2 className="font-black text-pastel-text text-sm flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    01
                  </span>
                  平铺 / 人台图
                </h2>
                {/* Sub-tabs for Clothing Type in 模特换衣 */}
                {currentTask.subMode === 'model' && (
                  <div className="flex items-center gap-1 rounded-xl bg-pastel-bg p-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateCurrentTask((t) => ({ ...t, clothingType: 'two-piece' }));
                        setActiveUploadTarget('top');
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        currentTask.clothingType === 'two-piece'
                          ? 'bg-pastel-card text-pastel-text shadow-xs border-b-2 border-[#17243c]'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Shirt className="h-3.5 w-3.5 text-orange-500" />
                      换上下装
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateCurrentTask((t) => ({ ...t, clothingType: 'one-piece' }));
                        setActiveUploadTarget('full');
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        currentTask.clothingType === 'one-piece'
                          ? 'bg-pastel-card text-pastel-text shadow-xs border-b-2 border-[#17243c]'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5 text-purple-500" />
                      换连体
                    </button>
                  </div>
                )}
              </div>

              {/* RENDER MODE A: 换上下装 (TWO-PIECE) */}
              {currentTask.subMode === 'model' && currentTask.clothingType === 'two-piece' ? (
                <div className="space-y-4">
                  {/* 【上装】 BOX */}
                  <div
                    onClick={() => setActiveUploadTarget('top')}
                    className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                      activeUploadTarget === 'top'
                        ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                        : 'border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shirt className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-black text-pastel-text">
                          上传 / 拖拽 / 粘贴【上装】
                        </span>
                        {activeUploadTarget === 'top' && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                            当前粘贴目标
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-pastel-muted">
                        {currentTask.topImages.length} / 6 张
                      </span>
                    </div>

                    {/* Recommendation Presets Bar */}
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                      <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                        <Eye className="h-3.5 w-3.5 text-orange-500" />
                        推荐示例
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {SVG_TOP_PRESETS.map((preset, idx) => (
                          <div key={idx} className="group relative shrink-0">
                            <img
                              src={preset.preview}
                              alt={preset.name}
                              onClick={() => handlePresetSelect(preset, 'top')}
                              className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-orange-500"
                              title={`点击使用: ${preset.name}`}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(preset.preview);
                              }}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                              title="点击放大查看"
                            >
                              <ZoomIn className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image Dropzone & Thumbnails */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingTop(true);
                      }}
                      onDragLeave={() => setIsDraggingTop(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingTop(false);
                        if (e.dataTransfer.files?.length) {
                          handleUploadTarget(e.dataTransfer.files, 'top');
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                        isDraggingTop
                          ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                          : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                      }`}
                    >
                      {currentTask.topImages.length > 0 ? (
                        <div className="w-full">
                          <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                            {currentTask.topImages.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                              >
                                <img
                                  src={img.preview}
                                  alt={`Top ${idx}`}
                                  onClick={() => setZoomedImage(img.preview)}
                                  className="h-full w-full object-cover cursor-pointer"
                                  title="点击放大预览"
                                />
                                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCurrentTask((t) => ({
                                      ...t,
                                      topImages: t.topImages.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            {currentTask.topImages.length < 6 && (
                              <button
                                type="button"
                                onClick={() => topInputRef.current?.click()}
                                className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                              >
                                <Plus className="h-6 w-6" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                            点击预览大图 · 支持拖拽和复制粘贴
                          </p>
                        </div>
                      ) : (
                        <div
                          onClick={() => topInputRef.current?.click()}
                          className="flex flex-col items-center justify-center py-3 cursor-pointer"
                        >
                          <Upload className="h-6 w-6 text-[#ed6d46] mb-1.5" />
                          <p className="text-xs font-bold text-pastel-text">
                            点击、拖拽或粘贴【上装】款式图
                          </p>
                          <p className="mt-1 text-[0.62rem] text-pastel-muted">
                            款式图无遮挡、无褶皱，生成效果更好
                          </p>
                        </div>
                      )}
                      <input
                        ref={topInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'top')}
                      />
                    </div>
                  </div>

                  {/* 【下装】 BOX */}
                  <div
                    onClick={() => setActiveUploadTarget('bottom')}
                    className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                      activeUploadTarget === 'bottom'
                        ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                        : 'border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-black text-pastel-text">
                          上传 / 拖拽 / 粘贴【下装】
                        </span>
                        {activeUploadTarget === 'bottom' && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                            当前粘贴目标
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-pastel-muted">
                        {currentTask.bottomImages.length} / 6 张
                      </span>
                    </div>

                    {/* Recommendation Presets Bar */}
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                      <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                        推荐示例
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {SVG_BOTTOM_PRESETS.map((preset, idx) => (
                          <div key={idx} className="group relative shrink-0">
                            <img
                              src={preset.preview}
                              alt={preset.name}
                              onClick={() => handlePresetSelect(preset, 'bottom')}
                              className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-blue-500"
                              title={`点击使用: ${preset.name}`}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(preset.preview);
                              }}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                              title="点击放大查看"
                            >
                              <ZoomIn className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image Dropzone & Thumbnails */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingBottom(true);
                      }}
                      onDragLeave={() => setIsDraggingBottom(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingBottom(false);
                        if (e.dataTransfer.files?.length) {
                          handleUploadTarget(e.dataTransfer.files, 'bottom');
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                        isDraggingBottom
                          ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                          : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                      }`}
                    >
                      {currentTask.bottomImages.length > 0 ? (
                        <div className="w-full">
                          <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                            {currentTask.bottomImages.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                              >
                                <img
                                  src={img.preview}
                                  alt={`Bottom ${idx}`}
                                  onClick={() => setZoomedImage(img.preview)}
                                  className="h-full w-full object-cover cursor-pointer"
                                  title="点击放大预览"
                                />
                                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCurrentTask((t) => ({
                                      ...t,
                                      bottomImages: t.bottomImages.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            {currentTask.bottomImages.length < 6 && (
                              <button
                                type="button"
                                onClick={() => bottomInputRef.current?.click()}
                                className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                              >
                                <Plus className="h-6 w-6" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                            点击预览大图 · 支持拖拽和复制粘贴
                          </p>
                        </div>
                      ) : (
                        <div
                          onClick={() => bottomInputRef.current?.click()}
                          className="flex flex-col items-center justify-center py-3 cursor-pointer"
                        >
                          <Upload className="h-6 w-6 text-blue-500 mb-1.5" />
                          <p className="text-xs font-bold text-pastel-text">
                            点击、拖拽或粘贴【下装】款式图
                          </p>
                          <p className="mt-1 text-[0.62rem] text-pastel-muted">
                            支持裤装、半身裙平铺图或细节素材
                          </p>
                        </div>
                      )}
                      <input
                        ref={bottomInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'bottom')}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* RENDER MODE B: 换连体 (ONE-PIECE / FULL OUTFIT) */
                <div
                  onClick={() => setActiveUploadTarget('full')}
                  className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                    activeUploadTarget === 'full'
                      ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                      : 'border-pastel-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-black text-pastel-text">
                        上传 / 拖拽 / 粘贴【连体/连衣裙】
                      </span>
                      {activeUploadTarget === 'full' && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          当前粘贴目标
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-pastel-muted">
                      {currentTask.fullImages.length} / 6 张
                    </span>
                  </div>

                  {/* Recommendation Presets Bar */}
                  <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                    <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                      <Eye className="h-3.5 w-3.5 text-purple-500" />
                      推荐示例
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      {SVG_FULL_PRESETS.map((preset, idx) => (
                        <div key={idx} className="group relative shrink-0">
                          <img
                            src={preset.preview}
                            alt={preset.name}
                            onClick={() => handlePresetSelect(preset, 'full')}
                            className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-purple-500"
                            title={`点击使用: ${preset.name}`}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(preset.preview);
                            }}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                            title="点击放大查看"
                          >
                            <ZoomIn className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Image Dropzone & Thumbnails */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFull(true);
                    }}
                    onDragLeave={() => setIsDraggingFull(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFull(false);
                      if (e.dataTransfer.files?.length) {
                        handleUploadTarget(e.dataTransfer.files, 'full');
                      }
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                      isDraggingFull
                        ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                        : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                    }`}
                  >
                    {currentTask.fullImages.length > 0 ? (
                      <div className="w-full">
                        <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                          {currentTask.fullImages.map((img, idx) => (
                            <div
                              key={img.id || idx}
                              className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                            >
                              <img
                                src={img.preview}
                                alt={`Full ${idx}`}
                                onClick={() => setZoomedImage(img.preview)}
                                className="h-full w-full object-cover cursor-pointer"
                                title="点击放大预览"
                              />
                              <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCurrentTask((t) => ({
                                    ...t,
                                    fullImages: t.fullImages.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}

                          {currentTask.fullImages.length < 6 && (
                            <button
                              type="button"
                              onClick={() => fullInputRef.current?.click()}
                              className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                            >
                              <Plus className="h-6 w-6" />
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                          点击预览大图 · 支持拖拽和复制粘贴
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={() => fullInputRef.current?.click()}
                        className="flex flex-col items-center justify-center py-4 cursor-pointer"
                      >
                        <Upload className="h-6 w-6 text-purple-500 mb-1.5" />
                        <p className="text-xs font-bold text-pastel-text">
                          点击、拖拽或粘贴【连体/连衣裙】款式图
                        </p>
                        <p className="mt-1 text-[0.62rem] text-pastel-muted">
                          支持连体裤、连衣裙、大衣套装平铺图
                        </p>
                      </div>
                    )}
                    <input
                      ref={fullInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'full')}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[0.68rem] text-pastel-muted font-bold pt-1">
                <span>Tips. 款式图上传无遮挡、无褶皱，生成效果更好~</span>
              </div>
            </section>

            {/* Step 2 Sub Card: 模特/姿势参考图 (选填) - Matches Screenshot 2 */}
            <section
              onClick={() => setActiveUploadTarget('model')}
              className={`rounded-[1.5rem] border bg-white p-4 shadow-sm transition-all dark:bg-[#11151c] ${
                activeUploadTarget === 'model'
                  ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                  : 'border-pastel-border'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    02
                  </span>
                  <h3 className="text-sm font-black text-pastel-text">
                    {currentTask.subMode === 'shoes'
                      ? '模特腿部/脚部参考图 (选填)'
                      : currentTask.subMode === 'mannequin'
                      ? '人台或目标模特参考图 (选填)'
                      : '带模特图 (选填)'}
                  </h3>
                  {activeUploadTarget === 'model' && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      当前粘贴目标
                    </span>
                  )}
                </div>
                {currentTask.modelReference && (
                  <button
                    type="button"
                    onClick={() => updateCurrentTask((t) => ({ ...t, modelReference: null }))}
                    className="text-[0.68rem] font-bold text-red-500 hover:underline"
                  >
                    移除
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-pastel-muted">
                上传需要上身拟合的模特照片，不上传则由 AI 自动生成完美模特
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingModel(true);
                }}
                onDragLeave={() => setIsDraggingModel(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingModel(false);
                  if (e.dataTransfer.files?.length) {
                    handleUploadTarget(e.dataTransfer.files, 'model');
                  }
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                  isDraggingModel
                    ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                    : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                }`}
              >
                {currentTask.modelReference ? (
                  <div className="w-full">
                    <div className="flex items-center justify-center gap-3">
                      <div className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800">
                        <img
                          src={currentTask.modelReference.preview}
                          alt="Model Reference"
                          onClick={() => setZoomedImage(currentTask.modelReference!.preview)}
                          className="h-full w-full object-cover cursor-pointer"
                          title="点击放大预览"
                        />
                        <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                          #1
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                      点击预览大图 · 支持拖拽和复制粘贴
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => modelInputRef.current?.click()}
                    className="flex flex-col items-center justify-center py-4 cursor-pointer"
                  >
                    <Upload className="h-6 w-6 text-[#ed6d46] mb-1.5" />
                    <p className="text-xs font-bold text-pastel-text">
                      点击、拖拽或粘贴【模特/人体参考图】
                    </p>
                    <p className="mt-1 text-[0.62rem] text-pastel-muted">
                      图片支持全屏放大预览查看
                    </p>
                  </div>
                )}
                <input
                  ref={modelInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'model')}
                />
              </div>
            </section>

            {/* MODEL LIBRARY CARD (1:1 Matched with User Screenshot) */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f4ff] text-[#3b82f6]">
                    <UserCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-pastel-text">模特库 (可选)</h3>
                    <p className="mt-1 text-xs text-pastel-muted">
                      固定模特面部与人体参考，保持高精度一致性生成
                    </p>
                  </div>
                </div>
                {currentTask.selectedModelPersonaId && (
                  <button
                    type="button"
                    onClick={() => updateCurrentTask((t) => ({ ...t, selectedModelPersonaId: null }))}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    清除选择
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsModelModalOpen(true)}
                className="mt-4 flex min-h-16 w-full items-center justify-between rounded-xl border border-pastel-border bg-[#f8fbff] p-3 text-left transition hover:border-[#ed6d46] dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  {currentTask.selectedModelPersonaId ? (
                    <>
                      <img
                        src={modelPersonas.find((m) => m.id === currentTask.selectedModelPersonaId)?.preview}
                        alt="固定模特"
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                      <div>
                        <strong className="block text-sm font-black text-[#17243c] dark:text-white">
                          {modelPersonas.find((m) => m.id === currentTask.selectedModelPersonaId)?.name}
                        </strong>
                        <span className="text-[0.68rem] text-pastel-muted">高精度人物一致性已开启</span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <strong className="block text-sm font-black text-[#17243c] dark:text-white">
                        选择 / 管理固定模特...
                      </strong>
                      <span className="text-[0.68rem] text-pastel-muted">
                        包含官方图2固定模特，亦可上传自定义模特
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
              </button>
            </section>

            {/* Step 3 Card: 你的试穿要求 (选填) */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-black text-pastel-text">你的试穿要求（选填）</h2>
                <button
                  type="button"
                  onClick={() => {
                    const example = SUB_MODE_OPTIONS.find((s) => s.id === currentTask.subMode)?.promptExample || '';
                    updateCurrentTask((t) => ({ ...t, customPrompt: example }));
                  }}
                  className="text-[0.68rem] font-bold text-[#ed6d46] hover:underline"
                >
                  填入参考提示
                </button>
              </div>
              <textarea
                value={currentTask.customPrompt}
                onChange={(e) => updateCurrentTask((t) => ({ ...t, customPrompt: e.target.value }))}
                rows={3}
                placeholder="例如：保持模特姿态与气场，服装自然贴合透气，呈现高级商业街拍全景效果..."
                className="w-full rounded-xl border border-pastel-border bg-pastel-bg p-3 text-xs text-pastel-text placeholder-pastel-muted outline-none focus:border-orange-500"
              />
            </section>

            {/* Step 4 Card: 图像与试穿参数 */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black text-pastel-text">图像与试穿参数</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* 1. 生成模型 Modal Button */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('model')}
                  className="col-span-2 flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">生成模型</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span className="flex items-center gap-2">
                      {MODEL_OPTIONS.find((m) => m.id === currentTask.selectedModel)?.label || currentTask.selectedModel}
                      <span className="rounded-full bg-[#ed6d46]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#ed6d46]">
                        {MODEL_OPTIONS.find((m) => m.id === currentTask.selectedModel)?.hint}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                {/* 2. 尺寸比例 Modal Button */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('ratio')}
                  className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span>
                      {ASPECT_RATIO_OPTIONS.find((r) => r.id === currentTask.aspectRatio)?.label || currentTask.aspectRatio}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                {/* 3. 试穿分辨率 Modal Button */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('resolution')}
                  className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">试穿分辨率</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span>
                      {RESOLUTION_OPTIONS.find((res) => res.id === currentTask.resolution)?.label || currentTask.resolution}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>
              </div>
            </section>

            {/* ACTION BUTTON */}
            {isLoading ? (
              <button
                type="button"
                onClick={() => cancelGenerationTask()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-black text-white shadow transition hover:bg-red-600"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                终止试穿 Agent (点击取消)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTryOn}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] text-sm font-black text-white shadow transition hover:bg-[#1f2e4c] active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4 text-orange-400" />
                一键 AI 万物上身
              </button>
            )}
          </div>

          {/* 3. RIGHT COLUMN: AGENT OUTPUT PANEL */}
          <div className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm min-h-[35rem] flex flex-col">
            {/* Agent Status Banner */}
            <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 p-3 text-xs font-bold text-orange-600 dark:text-orange-400 mb-4">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{currentTask.agentStatus}</span>
            </div>

            {/* CoT Progress Step Bar */}
            {currentTask.status === 'generating' && (
              <div className="mb-4 grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-pastel-bg">
                {COT_STEPS.map((step) => {
                  const isCompleted = currentTask.cotStep > step.id;
                  const isCurrent = currentTask.cotStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[0.62rem] font-bold ${
                        isCurrent
                          ? 'bg-[#172238] text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'text-pastel-muted opacity-50'
                      }`}
                    >
                      <span className="truncate">{step.label.slice(0, 4)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Output Display / Empty State */}
            <div className="flex-1 flex flex-col">
              {currentTask.generatedResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-pastel-text text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      试穿成果交付大图 ({currentTask.generatedResults.length} 张)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentTask.generatedResults.map((url, i) => (
                      <div
                        key={i}
                        className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card shadow-sm hover:shadow-md transition"
                      >
                        <img src={url} alt={`Result ${i}`} className="w-full h-auto object-cover" />
                        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 group-hover:opacity-100 transition">
                          <span className="text-xs font-bold text-white">试穿图 #{i + 1}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setZoomedImage(url)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 backdrop-blur-md"
                              title="放大预览"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </button>
                            <a
                              href={url}
                              download={`万物上身-${i + 1}.png`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                              title="下载图片"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-pastel-muted">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pastel-bg text-pastel-border">
                    <Grid3x3 className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-bold max-w-sm text-pastel-text">
                    上传模特/产品图片并完成左侧配置后，AI 试穿 Agent 将为您输出高保真试穿效果大图
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PARAMETER SELECTION MODALS */}
      {/* 1. Model Selection Modal */}
      {selectionModal === 'model' && (
        <SelectionModal title="选择生成模型" onClose={() => setSelectionModal(null)}>
          <div className="space-y-3">
            {MODEL_OPTIONS.map((item) => {
              const isSelected = currentTask.selectedModel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, selectedModel: item.id }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-pastel-text">{item.label}</span>
                      <span className="rounded-full bg-[#ed6d46]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#ed6d46]">
                        {item.hint}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-pastel-muted">{item.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-[#172238] dark:text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* 2. Aspect Ratio Selection Modal */}
      {selectionModal === 'ratio' && (
        <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ASPECT_RATIO_OPTIONS.map((ratio) => {
              const [w, h] = ratio.id.split(':').map(Number);
              const scale = 50 / Math.max(w, h);
              const isSelected = currentTask.aspectRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, aspectRatio: ratio.id as AspectRatio }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-transparent bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <span
                    className="block rounded border-2 border-slate-700 dark:border-slate-300"
                    style={{ width: Math.max(20, Math.round(w * scale)), height: Math.max(20, Math.round(h * scale)) }}
                  />
                  <strong className="mt-3 text-xs font-black text-pastel-text">{ratio.label}</strong>
                  <span className="mt-1 text-[0.65rem] text-pastel-muted">{ratio.desc}</span>
                  {isSelected && (
                    <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[#172238] dark:text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* 3. Resolution Selection Modal */}
      {selectionModal === 'resolution' && (
        <SelectionModal title="选择试穿分辨率" onClose={() => setSelectionModal(null)}>
          <div className="space-y-3">
            {RESOLUTION_OPTIONS.map((item) => {
              const isSelected = currentTask.resolution === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, resolution: item.id as ImageResolution }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="text-sm font-black text-pastel-text">{item.label}</span>
                    <p className="mt-1 text-xs text-pastel-muted">{item.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-[#172238] dark:text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* 4. Model Library Management Modal */}
      {isModelModalOpen && (
        <ModelLibraryModal
          selectedModelId={currentTask.selectedModelPersonaId || null}
          models={modelPersonas}
          onSelectModel={(model) =>
            updateCurrentTask((t) => ({ ...t, selectedModelPersonaId: model?.id || null }))
          }
          onCreateModel={handleCreateModelPersona}
          onRenameModel={handleRenameModelPersona}
          onDeleteModel={handleDeleteModelPersona}
          onClose={() => setIsModelModalOpen(false)}
        />
      )}

      {/* FULLSCREEN LIGHTBOX ZOOM MODAL (Applies to ALL Images) */}
      {zoomedImage !== null && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-5xl overflow-hidden rounded-3xl bg-pastel-card p-3 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              title="关闭预览"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomedImage}
              alt="High-Res Zoom View"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
            />
            <div className="mt-2 flex items-center gap-3">
              <a
                href={zoomedImage}
                download="高清素材图片.png"
                className="flex items-center gap-1.5 rounded-full bg-[#17243c] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#25395c]"
              >
                <Download className="h-3.5 w-3.5" /> 下载高清原图
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalTryOnTab;
