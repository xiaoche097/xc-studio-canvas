import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Crop,
  Download,
  Eye,
  Grid3x3,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Shirt,
  Sparkles,
  Sliders,
  Store,
  Trash2,
  User,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage, generateText } from '../services/geminiService';
import { compressImage, getErrorMessage } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { applyColorCorrection } from '../utils/imageProcessor';
import { downloadImageFile } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { CROP_FRAMING_OPTIONS, CropFramingId, cropFramingById } from '../constants/cropFramingPresets';
import { CLOTHING_POSES } from '../constants/clothingPresets';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { MENS_SHIRT_POSES } from '../constants/mensShirtPosePresets';
import { MENS_KNIT_POSES } from '../constants/mensKnitPosePresets';
import { MENS_TEE_POSES } from '../constants/mensTeePosePresets';
import { SWIM_SHORTS_POSES } from '../constants/swimShortsPosePresets';
import { MENS_SHORTS_POSES } from '../constants/mensShortsPosePresets';
import { MENS_PANTS_POSES } from '../constants/mensPantsPosePresets';
import { LONG_DRESS_POSES } from '../constants/longDressPosePresets';
import { WOMENS_FASHION_POSES } from '../constants/womensFashionPosePresets';
import { SOLAVIBE_POSES } from '../constants/solavibePosePresets';
import { KARISMINA_POSES } from '../constants/karisminaPosePresets';
import { Y2K_POSES } from '../constants/y2kPosePresets';
import { SURI_MIRA_POSES } from '../constants/suriMiraPosePresets';
import { QURAKEM_POSES } from '../constants/qurakemPosePresets';

export type UploadRole = 'model' | 'product' | 'scene' | 'action' | 'accessory' | 'overall';
export type PlatformKey = 'amazon' | 'shein' | 'temu' | 'tmall' | 'independent';
export type ActionMode = 'agent' | 'random' | 'manual' | 'promptText' | 'referenceImage';

export type PoseLibraryKey =
  | 'clothing'
  | 'womensFashion'
  | 'mensShirt'
  | 'mensKnit'
  | 'mensTee'
  | 'mensShorts'
  | 'mensPants'
  | 'swimShorts'
  | 'longDress'
  | 'karismina'
  | 'suriMira'
  | 'sleepwear'
  | 'solavibe'
  | 'y2k'
  | 'qurakem';

export interface ActionReferenceAnalysis {
  shotType: string;
  shootingAngle: string;
  poseDescription: string;
  cropRange: string;
  promptBlock: string;
}

export type GarmentProductKind =
  | 'upper'
  | 'lower'
  | 'skirt'
  | 'dress'
  | 'set'
  | 'outerwear'
  | 'swimwear'
  | 'sleepwear'
  | 'accessory'
  | 'other';

export interface ProductGarmentAnalysis {
  kind: GarmentProductKind;
  label: string;
  displayArea: string;
  productDescription: string;
  mustShow: string[];
  canCrop: string[];
}

export interface FissionAsset {
  id: string;
  base64: string;
  mime: string;
  preview: string;
  role: UploadRole;
  poseAnalysis?: ActionReferenceAnalysis;
  garmentAnalysis?: ProductGarmentAnalysis;
}

export interface FissionShot {
  index: number;
  shotName: string;
  cameraAngle: string;
  framing: string;
  poseAction: string;
  prompt?: string;
}

export interface FissionScheme {
  id: string;
  title: string;
  summary: string;
  strategy: string;
  shots: FissionShot[];
}

export interface FissionImageItem {
  index: number;
  title: string;
  framing: string;
  pose: string;
  imageUrl: string;
  prompt: string;
  colorCorrected?: boolean;
}

export type Stage = 1 | 2 | 3 | 4;
export type TaskStatus = 'editing' | 'planning' | 'ready' | 'generating' | 'done' | 'error';

export interface FissionWorkspace {
  images: FissionAsset[];
  requirements: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  platform: PlatformKey;
  poseLibrary: PoseLibraryKey;
  cropFraming: CropFramingId;
  actionMode: ActionMode;
  selectedSpecificPoseId: string;
  customActionPrompts: string;
  count: number;
  stage: Stage;
  schemes: FissionScheme[];
  selectedSchemeIds: string[];
  fissionImages: FissionImageItem[];
  agentStatus: string;
  agentLog: string[];
}

export interface FissionTask {
  id: string;
  createdAt: number;
  status: TaskStatus;
  workspace: FissionWorkspace;
  fissionImages: FissionImageItem[];
  cover?: string;
}

interface ModelPoseFissionTabProps {
  isActive?: boolean;
}

const MAX_IMAGES = 10;
const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const POSE_REVERSE_PROMPT = `你是一个高准确度的服装模特动作反推助手。请根据这张动作参考图，反推出一条可直接用于图像生成的中文动作提示词。

必须严格按照这个顺序组织完整描述：裁图范围 → 身体朝向 → 重心与腿部 → 头部与视线 → 肩颈状态 → 手臂、手腕与手指 → 整体姿态气质。

要求：
1. 裁图必须明确从哪里到哪里、哪些部位可见或不可见。
2. 明确身体是正面、侧面、背面或四分之三角度。
3. 下半身可见时，明确重心落点、支撑腿以及另一条腿的前伸、后撤或放松关系。
4. 头部方向与目光方向分开描述。
5. 明确肩颈状态，以及双臂、手腕、手指的位置和放松程度。
6. 存在包、球、椅子等关键道具时，准确描述人与道具的接触关系。
7. 优先描述动作结构，不描述服装款式、颜色、人物五官或背景，不使用空泛的“时尚”“有氛围”等表达。
8. 只写一种准确判断，不给备选动作；动作提示词必须是一整段自然、清晰、可直接复制的中文语句。

只返回 JSON，不要 Markdown，不要解释：
{
  "shotType": "简短的中文景别名称",
  "shootingAngle": "简短的中文身体朝向或拍摄角度",
  "cropRange": "准确的入镜范围",
  "poseDescription": "完整中文动作提示词",
  "promptBlock": "与 poseDescription 相同的完整中文动作提示词"
}`;

const reverseActionReference = async (asset: FissionAsset): Promise<ActionReferenceAnalysis> => {
  const text = await generateText(
    [{ base64: asset.base64, mimeType: asset.mime }],
    POSE_REVERSE_PROMPT
  );
  const parsed = parseJson<Record<string, unknown>>(text);
  const promptBlock = String(parsed.promptBlock || parsed.poseDescription || '').trim();
  if (!promptBlock) throw new Error('动作反推未返回有效提示词，请重试');

  return {
    shotType: String(parsed.shotType || '参考图景别'),
    shootingAngle: String(parsed.shootingAngle || '参考图角度'),
    cropRange: String(parsed.cropRange || '按参考图裁切范围'),
    poseDescription: String(parsed.poseDescription || promptBlock),
    promptBlock,
  };
};

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash', hint: '速度首选' },
  { id: 'nanobananapro', label: 'Banana Pro', desc: '3.0 Pro', hint: '细节精准' },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', hint: '商业摄影' },
  { id: 'qwen-image-3.0-pro', label: '千问3.0pro', desc: 'Qwen Image', hint: '高质量生成' },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { id: '2:3', label: '2:3 竖版', desc: '经典单反人像与电商主图' },
  { id: '3:4', label: '3:4 竖版', desc: '时尚服装与详情页展示' },
  { id: '1:1', label: '1:1 方版', desc: '经典正方形排版' },
  { id: '9:16', label: '9:16 竖屏', desc: '手机全屏展示与短视频' },
  { id: '16:9', label: '16:9 横版', desc: '画册长图与横屏展示' },
] as const;

const PLATFORM_STYLES: Array<{ key: PlatformKey; label: string; desc: string; icon: string; prompt: string }> = [
  {
    key: 'independent',
    label: '独立站',
    desc: '品牌调性Lookbook',
    icon: '🛒',
    prompt: 'Independent DTC brand DNA: brand-forward lifestyle fashion photography, tasteful scene design, cohesive styling.',
  },
  {
    key: 'shein',
    label: 'SHEIN',
    desc: '年轻潮流街拍风',
    icon: '👗',
    prompt: 'SHEIN fashion marketplace DNA: trendy youthful styling, clean lively fashion composition, flattering model pose.',
  },
  {
    key: 'amazon',
    label: 'Amazon',
    desc: '纯白高光商业视觉',
    icon: 'A',
    prompt: 'Amazon ecommerce catalog DNA: clean high-key lighting, pure white background, product-first commercial styling.',
  },
  {
    key: 'temu',
    label: 'Temu',
    desc: '高饱和对比电商',
    icon: '🧡',
    prompt: 'Temu marketplace DNA: bright high-saturation commercial look, clear product readability, conversion-focused image.',
  },
  {
    key: 'tmall',
    label: '天猫淘宝',
    desc: '高级大牌光影质感',
    icon: '🏬',
    prompt: 'Tmall premium ecommerce DNA: refined studio lighting, polished fabric texture, high perceived value visual hierarchy.',
  },
];

const POSE_LIBRARIES: Array<{ key: PoseLibraryKey; label: string; desc: string; poses: Array<{ id: string; name: string; prompt: string }> }> = [
  { key: 'clothing', label: '通用服装动作库', desc: '默认百搭', poses: CLOTHING_POSES },
  { key: 'womensFashion', label: '通用时尚女装', desc: '街拍/棚拍姿势', poses: WOMENS_FASHION_POSES },
  { key: 'mensShirt', label: '男士衬衫姿姿', desc: '商务/休闲衬衫', poses: MENS_SHIRT_POSES },
  { key: 'mensKnit', label: '男士针织/Polo', desc: '质感针织/Polo', poses: MENS_KNIT_POSES },
  { key: 'mensTee', label: '男士T恤姿态', desc: '基础T恤动作', poses: MENS_TEE_POSES },
  { key: 'mensShorts', label: '男士短裤姿势', desc: '短裤动作展示', poses: MENS_SHORTS_POSES },
  { key: 'mensPants', label: '男士长裤姿势', desc: '长裤腿型姿态', poses: MENS_PANTS_POSES },
  { key: 'swimShorts', label: '泳裤/沙滩裤', desc: '阳光度假姿姿', poses: SWIM_SHORTS_POSES },
  { key: 'longDress', label: '长裙/连衣裙', desc: '裙摆飘逸姿态', poses: LONG_DRESS_POSES },
  { key: 'karismina', label: 'KARISMINA 高点击裙装', desc: '法式度假高点击姿态', poses: KARISMINA_POSES },
  { key: 'suriMira', label: 'Suri Mira 宫廷复古', desc: '复古法式宫廷姿态', poses: SURI_MIRA_POSES },
  { key: 'sleepwear', label: '睡衣/家居服', desc: '居家温馨舒适', poses: SLEEPWEAR_POSES },
  { key: 'solavibe', label: 'Solavibe 大码姿态', desc: '度假大码姿态', poses: SOLAVIBE_POSES },
  { key: 'y2k', label: 'Y2K 时尚姿调', desc: '千禧复古街拍姿工', poses: Y2K_POSES },
  { key: 'qurakem', label: 'Qurakem 冷感男装', desc: '冷感设计师姿态', poses: QURAKEM_POSES },
];

const ROLE_LABELS: Record<UploadRole, { label: string; bg: string; text: string }> = {
  model: { label: '模特原图', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  product: { label: '服装/产品图', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  scene: { label: '场景图', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  action: { label: '动作反推', bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  accessory: { label: '配饰参考图', bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
  overall: { label: '整体参考图', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' },
};

const DEFAULT_POSE_TEMPLATES: FissionShot[] = [
  { index: 1, shotName: '正面全身立姿', cameraAngle: '平视视角', framing: '全身景别', poseAction: '自然站姿面向镜头，展示服装整体剪裁与全身轮廓' },
  { index: 2, shotName: '侧身45度迈步', cameraAngle: '侧向45度', framing: '中全身', poseAction: '向前迈步行走，眼神自然转向侧方，展现动态走姿' },
  { index: 3, shotName: '面部与领口特写', cameraAngle: '微仰角', framing: '特写景别', poseAction: '专注眼神微颔首，突出领口剪裁与妆容氛围' },
  { index: 4, shotName: '手部与面料细节', cameraAngle: '俯拍45度', framing: '局部特写', poseAction: '轻抚口袋或衣摆，展示面料质感与针织纹路' },
  { index: 5, shotName: '休闲倚靠坐姿', cameraAngle: '中低机位', framing: '中景景别', poseAction: '身体稍微倾斜倚靠，腿部一弯一伸，呈现随性慵懒姿态' },
  { index: 6, shotName: '背影回眸侧脸', cameraAngle: '后方视角', framing: '中景景别', poseAction: '背向镜头微微回眸看侧方，凸显后背设计与修长线条' },
  { index: 7, shotName: '动态摆幅抓拍', cameraAngle: '抓拍视角', framing: '全身景别', poseAction: '轻盈转身带动衣摆摆幅，展现飘逸质感' },
  { index: 8, shotName: '下装与 footwear 特写', cameraAngle: '低视角仰拍', framing: '腿部特写', poseAction: '迈步瞬间，突出下装版型、腿部比例与鞋履匹配' },
];

const createTask = (): FissionTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  fissionImages: [],
  workspace: {
    images: [],
    requirements: '',
    model: MODEL_OPTIONS[0].id,
    aspectRatio: '2:3',
    resolution: '2K',
    platform: 'independent',
    poseLibrary: 'clothing',
    cropFraming: 'auto',
    actionMode: 'agent',
    selectedSpecificPoseId: '',
    customActionPrompts: '',
    count: 1,
    stage: 1,
    schemes: [],
    selectedSchemeIds: [],
    fissionImages: [],
    agentStatus: '输入准备 Agent · 等待上传模特/服装/参考图',
    agentLog: ['已初始化模特姿势裂变任务'],
  },
});

const parseJson = <T,>(value: string): T => {
  if (!value || typeof value !== 'string') {
    throw new Error('创意 Agent 未返回有效文本方案，请重新生成');
  }
  return JSON.parse(value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()) as T;
};

const parseSchemes = (value: string, requestedCount: number): FissionScheme[] => {
  const parsed = parseJson<Array<Record<string, unknown>>>(value);
  if (!Array.isArray(parsed) || parsed.length < 1) throw new Error('创意 Agent 未返回有效姿势方案，请重新生成');

  return parsed.slice(0, 3).map((item, index) => {
    const rawShots = Array.isArray(item.shots) ? (item.shots as Array<Record<string, unknown>>) : [];
    const shots: FissionShot[] = Array.from({ length: requestedCount }).map((_, shotIdx) => {
      const tmpl = DEFAULT_POSE_TEMPLATES[shotIdx % DEFAULT_POSE_TEMPLATES.length];
      const matched = rawShots[shotIdx] || {};
      return {
        index: shotIdx + 1,
        shotName: String(matched.shotName || tmpl.shotName),
        cameraAngle: String(matched.cameraAngle || tmpl.cameraAngle),
        framing: String(matched.framing || tmpl.framing),
        poseAction: String(matched.poseAction || tmpl.poseAction),
        prompt: String(matched.prompt || `${tmpl.shotName}: ${tmpl.framing}, ${tmpl.cameraAngle}, ${tmpl.poseAction}`),
      };
    });

    return {
      id: `fission-scheme-${index + 1}`,
      title: String(item.title || `${requestedCount}张姿态裂变方案 ${index + 1}`),
      summary: String(item.summary || `拆解 ${requestedCount} 种符合电商高点击的单张独立姿势与视角`),
      strategy: String(item.strategy || '包含全身、侧身、坐姿与面料细节，单图高画质并发生成'),
      shots,
    };
  });
};

const useImagePaste = (onPaste: (files: File[]) => void, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onPaste(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onPaste, enabled]);
};

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
      className="w-full max-w-3xl overflow-hidden rounded-3xl border border-pastel-border bg-white shadow-2xl dark:bg-[#10192b]"
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

const ModelPoseFissionTab: React.FC<ModelPoseFissionTabProps> = ({ isActive = true }) => {
  const initialTaskRef = useRef<FissionTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createTask();

  const [tasks, setTasks] = useState<FissionTask[]>([initialTaskRef.current]);
  const [activeTaskId, setActiveTaskId] = useState<string>(initialTaskRef.current.id);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [images, setImages] = useState<FissionAsset[]>([]);
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [resolution, setResolution] = useState('2K');
  const [platform, setPlatform] = useState<PlatformKey>('independent');
  const [poseLibrary, setPoseLibrary] = useState<PoseLibraryKey>('clothing');
  const [cropFraming, setCropFraming] = useState<CropFramingId>('auto');
  const [actionMode, setActionMode] = useState<ActionMode>('agent');
  const [selectedSpecificPoseId, setSelectedSpecificPoseId] = useState<string>('');
  const [customActionPrompts, setCustomActionPrompts] = useState<string>('');
  const [count, setCount] = useState<number>(1);
  const [stage, setStage] = useState<Stage>(1);

  const [schemes, setSchemes] = useState<FissionScheme[]>([]);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [fissionImages, setFissionImages] = useState<FissionImageItem[]>([]);

  const [completedCount, setCompletedCount] = useState(0);
  const [agentStatus, setAgentStatus] = useState('输入准备 Agent · 等待素材');
  const [agentLog, setAgentLog] = useState<string[]>(['已初始化模特姿势裂变任务']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectionModal, setSelectionModal] = useState<'model' | 'ratio' | 'platform' | 'library' | 'crop' | 'count' | null>(null);
  const [roleModalAssetId, setRoleModalAssetId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const actionCount = useMemo(() => images.filter((i) => i.role === 'action').length, [images]);

  const parsedPromptActions = useMemo(
    () => customActionPrompts.split(/[;\n]/).map((s) => s.trim()).filter(Boolean),
    [customActionPrompts]
  );

  const currentLibraryPoses = useMemo(() => {
    const lib = POSE_LIBRARIES.find((l) => l.key === poseLibrary);
    return lib?.poses || CLOTHING_POSES;
  }, [poseLibrary]);

  useEffect(() => {
    if (!selectedSpecificPoseId && currentLibraryPoses.length > 0) {
      setSelectedSpecificPoseId(currentLibraryPoses[0].id);
    }
  }, [currentLibraryPoses, selectedSpecificPoseId]);

  // Auto-adapt generation count & action mode based on user assets and prompt text
  useEffect(() => {
    if (actionCount > 0) {
      setActionMode('referenceImage');
      setCount(Math.min(8, Math.max(1, actionCount)));
    } else if (actionMode === 'promptText' && parsedPromptActions.length > 0) {
      setCount(Math.min(8, Math.max(1, parsedPromptActions.length)));
    }
  }, [actionCount, actionMode, parsedPromptActions.length]);

  const currentWorkspace = useCallback(
    (): FissionWorkspace => ({
      images,
      requirements,
      model,
      aspectRatio,
      resolution,
      platform,
      poseLibrary,
      cropFraming,
      actionMode,
      selectedSpecificPoseId,
      customActionPrompts,
      count,
      stage,
      schemes,
      selectedSchemeIds,
      fissionImages,
      agentStatus,
      agentLog,
    }),
    [
      images,
      requirements,
      model,
      aspectRatio,
      resolution,
      platform,
      poseLibrary,
      cropFraming,
      actionMode,
      selectedSpecificPoseId,
      customActionPrompts,
      count,
      stage,
      schemes,
      selectedSchemeIds,
      fissionImages,
      agentStatus,
      agentLog,
    ]
  );

  const updateTask = useCallback(
    (patch: Partial<FissionTask>) => {
      setTasks((current) =>
        current.map((item) => {
          if (item.id !== activeTaskId) return item;
          const workspace = patch.workspace ? patch.workspace : { ...item.workspace, ...currentWorkspace() };
          return {
            ...item,
            ...patch,
            workspace,
            cover: images[0]?.preview || patch.cover || item.cover,
          };
        })
      );
    },
    [activeTaskId, currentWorkspace, images]
  );

  const restoreWorkspace = (ws: FissionWorkspace, fissionOutput: FissionImageItem[]) => {
    setImages(ws.images || []);
    setRequirements(ws.requirements || '');
    setModel(ws.model || MODEL_OPTIONS[0].id);
    setAspectRatio(ws.aspectRatio || '2:3');
    setResolution(ws.resolution || '2K');
    setPlatform(ws.platform || 'independent');
    setPoseLibrary(ws.poseLibrary || 'clothing');
    setCropFraming(ws.cropFraming || 'auto');
    setActionMode(ws.actionMode || 'random');
    setSelectedSpecificPoseId(ws.selectedSpecificPoseId || '');
    setCustomActionPrompts(ws.customActionPrompts || '');
    setCount(ws.count || 8);
    setStage(ws.stage || 1);
    setSchemes(ws.schemes || []);
    setSelectedSchemeIds(ws.selectedSchemeIds || []);
    setFissionImages(fissionOutput || ws.fissionImages || []);
    setAgentStatus(ws.agentStatus || '就绪');
    setAgentLog(ws.agentLog || []);
    setError(null);
  };

  const switchTask = (task: FissionTask) => {
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace, task.fissionImages);
  };

  const deleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tasks.length <= 1) return;
    const remaining = tasks.filter((t) => t.id !== id);
    setTasks(remaining);
    if (activeTaskId === id) {
      const nextTask = remaining[0];
      setActiveTaskId(nextTask.id);
      restoreWorkspace(nextTask.workspace, nextTask.fissionImages);
    }
  };

  const processFiles = useCallback(
    async (files: File[], forcedRole?: UploadRole) => {
      if (!files.length) return;
      const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, MAX_IMAGES - images.length);
      if (!accepted.length) return;

      try {
        const next = await Promise.all(
          accepted.map(async (file, index) => {
            const compressed = await compressImage(file, 1920, 0.88);
            let role: UploadRole = forcedRole || 'model';
            if (!forcedRole) {
              if (images.length === 0 && index === 0) role = 'model';
              else if (images.length === 1 && index === 0) role = 'product';
              else role = 'action';
            }
            return {
              id: crypto.randomUUID(),
              base64: compressed.base64,
              mime: compressed.mime,
              preview: `data:${compressed.mime};base64,${compressed.base64}`,
              role,
            };
          })
        );
        const merged = [...images, ...next].slice(0, MAX_IMAGES);
        setImages(merged);
        updateTask({ cover: merged[0]?.preview, status: 'editing' });
        setStage(1);
        setSchemes([]);
        setSelectedSchemeIds([]);
        setFissionImages([]);
        setAgentStatus('输入准备 Agent · 已接收素材图片');
        setAgentLog((current) => [...current, `已接收 ${merged.length} 张参考图，已智能标注功能角色`]);
        setError(null);
      } catch (uploadError) {
        setError(getErrorMessage(uploadError));
      }
    },
    [images, updateTask]
  );

  const handleImageDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (busy) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) void processFiles(files);
    },
    [busy, processFiles]
  );

  useImagePaste((files) => void processFiles(files), isActive && !busy);

  const updateAssetRole = (id: string, role: UploadRole) => {
    setImages((current) => current.map((item) => (item.id === id ? { ...item, role } : item)));
    if (role === 'action') {
      setActionMode('referenceImage');
    }
  };

  const removeAsset = (id: string) => {
    setImages((current) => current.filter((item) => item.id !== id));
  };

  const downloadSingleImage = useCallback(async (url: string, title: string) => {
    const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-') || 'pose-fission'}-${Date.now()}.png`;
    try {
      await downloadImageFile(url, filename);
    } catch (downloadError) {
      setError(`图片下载失败：${getErrorMessage(downloadError)}`);
    }
  }, []);

  const downloadAllFissionImages = useCallback(async () => {
    for (let i = 0; i < fissionImages.length; i++) {
      const item = fissionImages[i];
      await downloadSingleImage(item.imageUrl, `模特姿态裂变-${i + 1}-${item.title}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [downloadSingleImage, fissionImages]);

  const toggleColorCorrection = async (index: number) => {
    const target = fissionImages[index];
    if (!target) return;
    const newCorrected = !target.colorCorrected;
    const correctedUrl = newCorrected
      ? await applyColorCorrection(target.imageUrl, { mode: 'redSuppress' })
      : target.imageUrl;

    setFissionImages((current) =>
      current.map((item, idx) => (idx === index ? { ...item, colorCorrected: newCorrected, imageUrl: correctedUrl } : item))
    );
  };

  const newTask = () => {
    if (busy) return;
    const task = createTask();
    const snapshot = currentWorkspace();
    setTasks((current) =>
      [
        task,
        ...current.map((item) =>
          item.id === activeTaskId
            ? { ...item, workspace: snapshot, fissionImages, cover: images[0]?.preview || item.cover }
            : item
        ),
      ].slice(0, 20)
    );
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace, []);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const generatePlan = async () => {
    if (!images.length || busy) return;
    setBusy(true);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus(`创意策划 Agent · 正在规划 ${count} 张单图姿态动作方案`);
    setAgentLog((current) => [...current, `创意策划 Agent 开始分析参考图，规划 ${count} 张独立姿姿与景别动作`]);

    try {
      const selectedLib = POSE_LIBRARIES.find((lib) => lib.key === poseLibrary) || POSE_LIBRARIES[0];
      const selectedPlat = PLATFORM_STYLES.find((p) => p.key === platform) || PLATFORM_STYLES[0];
      let effectiveCropFraming: CropFramingId = cropFraming;

      // Auto-detect crop framing from action reference images when 'auto' is selected
      if (cropFraming === 'auto') {
          setAgentStatus('🤖 Agent 正在分析裁图范围...');
          setAgentLog((current) => [...current, '🤖 Agent 正在逐张分析参考图的可见身体区域...']);

          // Only analyze action reference images when action mode is referenceImage and action images exist
          const imagesToAnalyze = actionMode === 'referenceImage' && actionCount > 0
            ? images.filter((img) => img.role === 'action')
            : images;

          try {
          const cropAnalysis = await generateText(
            imagesToAnalyze.map((img) => ({ base64: img.base64, mimeType: img.mime })),
            `**ROLE**: Precision Crop Framing Copycat. You do NOT analyze fashion. You do NOT recommend. You COPY what the reference image already shows.

**TASK**: The user uploaded action reference images. These images define EVERYTHING — pose, angle, AND crop framing. Look at what body parts are VISIBLE in the reference frame. Report that SAME crop. Do not improve it, do not second-guess it, do not suggest what "would be better." The reference IS the answer.

---

**BEFORE YOU START — CORE PRINCIPLE**
These images are the user's GROUND TRUTH. Your output MUST match the crop boundaries shown in the reference. If the reference is cropped at the thigh, you output "top". Even if the person is wearing a floor-length gown — you STILL output "top" because that's what the reference shows. The crop is about FRAME BOUNDARIES, not about clothing.

---

**STEP 1 — BODY PART VISIBILITY AUDIT**
For the reference image(s), mark each body part as VISIBLE or CUT OFF:

[HEAD]    — Top of head / hairline
[FACE]    — Full face
[CHEST]   — Shoulders / collarbone
[WAIST]   — Natural waistline / mid-torso
[HIP]     — Hip bone / crotch area
[THIGH]   — Upper thigh (above knee)
[KNEE]    — Knee joint
[CALF]    — Mid-calf area
[ANKLE]   — Ankle joint
[FEET]    — Toes / shoes

ONLY count what is FULLY inside the frame. If a body part is partially or fully cut off by the image edge, mark it CUT OFF.

---

**STEP 2 — STRICT CROP MAPPING (NO DEVIATION ALLOWED)**
Map what you see to cropFraming using this table. Pick the BEST match:

| Condition | cropFraming | Typical visual cue |
|---|---|---|
| HEAD visible, lowest visible is THIGH (knee CUT OFF) | "top" | Head-and-shoulders or half-body portrait |
| HEAD visible, lowest visible is KNEE (calf CUT OFF) | "mid-length" | Three-quarter shot, stops at/near knees |
| HEAD visible, lowest visible is ANKLE or FEET | "full-length" | Entire person from head to toes |
| HEAD CUT OFF, top of frame is WAIST area, lowest is CALF | "short-bottom" | Waist-down crop, stops above ankle |
| HEAD CUT OFF, top of frame is WAIST area, lowest is ANKLE/FEET | "long-bottom" | Waist-down crop, full legs visible |

---

**STEP 3 — MANDATORY SELF-CHECK**
Before you output, verify:
1. "Did I identify the correct LOWEST visible body part?"
2. "Did I ignore clothing entirely and judge ONLY by frame boundaries?"
3. "Would MY cropFraming produce the SAME frame boundaries as what I see in the reference?"

If ANY answer is NO, redo your analysis from Step 1.

---

**FORBIDDEN BEHAVIORS**
- ❌ Inferring crop from clothing type (e.g., "it's a dress, so full-length")
- ❌ Defaulting to "full-length" when unsure — pick the closest match from the table
- ❌ Recommending a crop different from what the reference shows
- ❌ Letting pose, aesthetics, or image quality influence your decision

---

**MULTI-IMAGE RULE**
If multiple reference images show DIFFERENT crops, output the TIGHTEST (most zoomed-in) crop among them. This is safer because the generation system can always zoom out but cannot zoom in after the fact.

If they all show the same crop, output that one.

---

**OUTPUT FORMAT — return ONLY this JSON, no markdown, no extra text**
{
  "cropFraming": "top | mid-length | full-length | short-bottom | long-bottom",
  "visibleRange": "e.g., HEAD → MID-THIGH",
  "reason": "one-sentence Chinese explanation"
}`
          );
          const parsed = JSON.parse(cropAnalysis.replace(/^`*(?:json)?\s*/i, '').replace(/\s*`*$/, '').trim());
          if (['full-length','top','short-bottom','long-bottom','mid-length'].includes(parsed.cropFraming)) {
            effectiveCropFraming = parsed.cropFraming;
            const logMsg = parsed.visibleRange
              ? `🤖 Agent 检测到裁图范围: ${parsed.visibleRange} → ${parsed.cropFraming} (${parsed.reason || ''})`
              : `🤖 Agent: ${parsed.reason || '已自动匹配裁图范围'}`;
            setAgentLog((current) => [...current, logMsg]);
          }
        } catch {
          setAgentLog((current) => [...current, '🤖 Agent 分析裁图失败，使用默认全图']);
          effectiveCropFraming = 'full-length';
        }
      }

      const selectedCropOption = cropFramingById(effectiveCropFraming);

      let nextSchemes: FissionScheme[] = [];

      if (actionMode === 'agent') {
        // 0. Agent 智能规划：由 AI 艺术总监自主规划商业高点击姿态解构方案
        setAgentStatus(`🤖 Agent 艺术总监 · 正在规划 ${count} 张商业高点击姿态动作方案...`);
        setAgentLog((current) => [...current, `🤖 Agent 艺术总监：分析素材特点，深度解构与规划 ${count} 张商业视角姿势`]);

        const rolesSummary = images
          .map((img, i) => `Image ${i + 1}: ${ROLE_LABELS[img.role].label}`)
          .join('; ');

        const responseText = await generateText(
          images.map((img) => ({ base64: img.base64, mimeType: img.mime })),
          `
You are a top fashion art director specializing in commercial model pose fission and ecommerce lookbook creation.
Analyze the uploaded image(s) with assigned roles: [${rolesSummary}].
Primary Goal: Generate 3 distinct posture fission schemes, each containing ${count} distinct standalone posture shots that maximize ecommerce click-through rate (CTR) and highlight product features.

Configuration Context:
- Requested Count: ${count} distinct standalone photos
- Target Platform Style: ${selectedPlat.label} (${selectedPlat.prompt})
- Pose Preset Library: ${selectedLib.label} (${selectedLib.desc})
- Crop Framing Lock: ${selectedCropOption.label} (${selectedCropOption.description}) -> ${selectedCropOption.promptRule}
- User Extra Instructions: ${requirements || 'Commercial fashion model poses with high aesthetic variety and natural postures'}

STRICT MANDATES:
1. MODEL & SCENE FIDELITY: Maintain 100% face identity, hairstyle, outfit style, and room/scene background atmosphere from the uploaded reference image(s).
2. DIVERSE POSES: Create ${count} distinct, natural, elegant, dynamic body poses across the ${count} shots.
3. ECOMMERCE SELLING POINTS: Highlight clothing fit, neckline, sleeve drape, waist shaping, and fabric movement naturally.

Return ONLY a JSON array containing 3 schemes. Format:
[
  {
    "title": "Chinese Scheme Title",
    "summary": "Chinese summary",
    "strategy": "Creative selling strategy",
    "shots": [
      {
        "index": 1,
        "shotName": "正面全身立姿",
        "cameraAngle": "平视视角",
        "framing": "全身景别",
        "poseAction": "描述符合条件的自然动作细节",
        "prompt": "detailed English prompt specifying model identity lock and pose"
      }
    ]
  }
]
No extra markdown outside the JSON code block.`
        );

        nextSchemes = parseSchemes(responseText, count);
      } else if (actionMode === 'random') {
        // 1. 智能随机动作：100% 精准从当前选定动作库随机抽取
        setAgentStatus(`🎲 正在从动作库「${selectedLib.label}」中随机抽取 ${count} 个动作预设...`);
        setAgentLog((current) => [...current, `🎲 动作控制：从「${selectedLib.label}」随机抽取姿态，提示词 100% 保持动作库定义`]);

        const shuffled = [...currentLibraryPoses].sort(() => 0.5 - Math.random());
        const selectedPoses = Array.from({ length: count }).map((_, idx) => shuffled[idx % shuffled.length]);

        const shots: FissionShot[] = selectedPoses.map((pose, idx) => ({
          index: idx + 1,
          shotName: pose.name,
          cameraAngle: idx % 2 === 0 ? '标准正面视角' : '侧向 45 度视角',
          framing: selectedCropOption.shortLabel,
          poseAction: pose.prompt,
          prompt: pose.prompt,
        }));

        nextSchemes = [
          {
            id: 'scheme-random-1',
            title: `姿态库抽取方案（来自：${selectedLib.label}）`,
            summary: `从动作库中精选 ${count} 种高点击商业姿势，确保提示词精准度`,
            strategy: '动作预设 100% 保持动作库原生提示词，不经过 Agent 擅自修改',
            shots,
          },
        ];
      } else if (actionMode === 'manual') {
        // 2. 手动指定动作：100% 锁定用户在动作库里选择的动作
        const specificPose = currentLibraryPoses.find((p) => p.id === selectedSpecificPoseId) || currentLibraryPoses[0];
        setAgentStatus(`📌 已锁定用户指定动作「${specificPose.name}」...`);
        setAgentLog((current) => [...current, `📌 动作控制：锁定指定动作「${specificPose.name}」，提示词 100% 精准匹配预设`]);

        const anglePresets = ['标准正面', '侧向 45 度', '微仰角度', '全身视角', '半身特写', '膝上 3/4 视角', '侧后方背影', '动态抓拍视角'];
        const shots: FissionShot[] = Array.from({ length: count }).map((_, idx) => ({
          index: idx + 1,
          shotName: `${specificPose.name} (${anglePresets[idx % anglePresets.length]})`,
          cameraAngle: anglePresets[idx % anglePresets.length],
          framing: selectedCropOption.shortLabel,
          poseAction: specificPose.prompt,
          prompt: specificPose.prompt,
        }));

        nextSchemes = [
          {
            id: 'scheme-manual-1',
            title: `指定动作方案（${specificPose.name}）`,
            summary: `全套统一锁定姿态「${specificPose.name}」，搭配多角度光影与机位`,
            strategy: '严格锁定用户指定的动作姿态，100% 精准使用预设提示词',
            shots,
          },
        ];
      } else if (actionMode === 'promptText') {
        // 3. 动作提示词：100% 保留用户填写的自定义提示词原文，绝不被 Agent 改写
        setAgentStatus(`📝 正在应用用户自定义的 ${parsedPromptActions.length || 1} 条动作提示词...`);
        setAgentLog((current) => [...current, `📝 动作控制：100% 原样保留用户输入的 ${parsedPromptActions.length || 1} 条动作提示词原文`]);

        const shots: FissionShot[] = Array.from({ length: count }).map((_, idx) => {
          const userPromptText = parsedPromptActions[idx % parsedPromptActions.length] || requirements || '自然时尚商业模特拍摄姿态';
          return {
            index: idx + 1,
            shotName: `自定义动作 #${idx + 1}`,
            cameraAngle: '指定视角',
            framing: selectedCropOption.shortLabel,
            poseAction: userPromptText,
            prompt: userPromptText,
          };
        });

        nextSchemes = [
          {
            id: 'scheme-prompt-1',
            title: '用户自定义动作提示词方案',
            summary: `按用户输入的 ${parsedPromptActions.length || 1} 条提示词原文精准生成`,
            strategy: '用户原生提示词直通，不经过 Agent 任意改写或替换，做到 100% 精准',
            shots,
          },
        ];
      } else if (actionMode === 'referenceImage') {
        // 4. 动作参考图：反推参考图中的模特姿态与视角，精准替换提示词
        const actionAssets = images.filter((img) => img.role === 'action');

        if (actionAssets.length > 0) {
          setAgentStatus(`📸 正在精准反推 ${actionAssets.length} 张动作参考图的肢体姿态与视角...`);
          setAgentLog((current) => [...current, `📸 动作参考图反推中：精准提取 ${actionAssets.length} 张动作图的姿势形态、手臂摆放与视角...`]);

          const analyzedPoses = await Promise.all(
            actionAssets.slice(0, count).map(async (actionImg, idx) => {
              try {
                const analysis = actionImg.poseAnalysis || await reverseActionReference(actionImg);
                if (!actionImg.poseAnalysis) {
                  setImages((current) => current.map((item) => (
                    item.id === actionImg.id ? { ...item, poseAnalysis: analysis } : item
                  )));
                }
                return {
                  shotName: `${analysis.shotType || '反推动作'} #${idx + 1}`,
                  cameraAngle: analysis.shootingAngle || '参考图视角',
                  poseAction: analysis.promptBlock,
                };
              } catch {
                return {
                  shotName: `动作反推 #${idx + 1}`,
                  cameraAngle: '参考图视角',
                  poseAction: '严格按照动作参考图还原人物裁图、身体朝向、重心、腿部、头部视线、肩颈与手部姿态',
                };
              }
            })
          );

          const shots: FissionShot[] = Array.from({ length: count }).map((_, idx) => {
            if (idx < analyzedPoses.length) {
              const pose = analyzedPoses[idx];
              return {
                index: idx + 1,
                shotName: pose.shotName,
                cameraAngle: pose.cameraAngle,
                framing: selectedCropOption.shortLabel,
                poseAction: pose.poseAction,
                prompt: pose.poseAction,
              };
            } else {
              const fallbackPose = currentLibraryPoses[idx % currentLibraryPoses.length];
              return {
                index: idx + 1,
                shotName: fallbackPose.name,
                cameraAngle: '辅助视角',
                framing: selectedCropOption.shortLabel,
                poseAction: fallbackPose.prompt,
                prompt: fallbackPose.prompt,
              };
            }
          });

          nextSchemes = [
            {
              id: 'scheme-ref-1',
              title: '动作参考图精准反推与替换方案',
              summary: `根据上传的 ${actionAssets.length} 张动作参考图反推肢体姿态并精准替换`,
              strategy: '1:1 视觉反推姿姿形态，提示词精准替换为参考图的肢体语言',
              shots,
            },
          ];
        } else {
          setAgentStatus('💡 未检测到动作参考图，自动从动作库中随机抽取姿势...');
          setAgentLog((current) => [...current, '💡 提示：您未上传「动作参考图」，已自动按当前选定动作库抽取姿态']);

          const shuffled = [...currentLibraryPoses].sort(() => 0.5 - Math.random());
          const selectedPoses = Array.from({ length: count }).map((_, idx) => shuffled[idx % shuffled.length]);

          const shots: FissionShot[] = selectedPoses.map((pose, idx) => ({
            index: idx + 1,
            shotName: pose.name,
            cameraAngle: '标准视角',
            framing: selectedCropOption.shortLabel,
            poseAction: pose.prompt,
            prompt: pose.prompt,
          }));

          nextSchemes = [
            {
              id: 'scheme-ref-fallback-1',
              title: `动作库抽取方案（未上传参考图自动抽取）`,
              summary: `未上传动作参考图，已从「${selectedLib.label}」中选出 ${count} 个动作`,
              strategy: '可上传「动作参考图」实现 1:1 姿态精准反推与替换',
              shots,
            },
          ];
        }
      }

      setSchemes(nextSchemes);
      setSelectedSchemeIds([nextSchemes[0].id]);
      setStage(2);
      setAgentStatus(`姿态方案 Agent · ${count} 张单图姿态动作方案精准规划完成`);
      setAgentLog((current) => [...current, `姿态方案 Agent 已交付 100% 精准匹配的姿态动作方案`]);
      updateTask({ status: 'ready' });
    } catch (planError) {
      setError(getErrorMessage(planError));
      setAgentStatus('姿态方案 Agent · 生成失败，请重试');
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const generateConcurrentFissionImages = async () => {
    const selected = schemes.filter((scheme) => selectedSchemeIds.includes(scheme.id));
    if (!selected.length || busy) return;
    setBusy(true);
    setStage(3);
    setError(null);
    setCompletedCount(0);
    setFissionImages([]);
    updateTask({ status: 'generating' });
    setAgentStatus(`高清并发 Agent · 正在并发生成 ${count} 张独立高画质姿态大图 (0/${count})...`);
    setAgentLog((current) => [...current, `高清并发 Agent 启动！正在最高 ${count} 并发并行生成单图...`]);

    try {
      const scheme = selected[0];
      const selectedPlat = PLATFORM_STYLES.find((p) => p.key === platform) || PLATFORM_STYLES[0];
      const selectedCropOption = cropFramingById(cropFraming);

      const targetRatioEnum =
        aspectRatio === '2:3'
          ? AspectRatio.PORTRAIT_2_3
          : aspectRatio === '9:16'
          ? AspectRatio.PORTRAIT_9_16
          : aspectRatio === '3:4'
          ? AspectRatio.PORTRAIT_3_4
          : aspectRatio === '1:1'
          ? AspectRatio.SQUARE
          : AspectRatio.LANDSCAPE_16_9;

      let localCompleted = 0;
      const actionImages = images.filter((img) => img.role === 'action');

      // Concurrent parallel generation for all N shots directly
      const tasks = scheme.shots.map(async (shot) => {
        const currentActionImg = actionImages[shot.index - 1];
        const targetImages = currentActionImg
          ? [...images.filter((img) => img.role !== 'action'), currentActionImg]
          : images;

        const shotPrompt = `Standalone high-definition commercial fashion photography portrait. Platform DNA: ${selectedPlat.prompt}. Pose Shot #${shot.index}: ${shot.shotName}. Camera Framing: ${selectedCropOption.promptRule}. Pose details: ${shot.poseAction}. User goal: ${requirements}.

STRICT MANDATES - ABSOLUTE MODEL & PRODUCT & SCENE FIDELITY:
- MODEL LOCK: Keep exact facial identity, eyes, nose, hair color, skin tone, and body proportions identical to the reference model image.
- PRODUCT LOCK: Retain 100% clothing colors, fabric texture, sleeve drape, waist shaping, and outfit details.
- POSE LOCK: Match the exact physical posture and body gesture: "${shot.poseAction}".
- SCENE LOCK: Replicate studio lighting, background atmosphere, and color grading from reference image(s).
- SINGLE STANDALONE PHOTO: This must be a clean, standalone, high-resolution single fashion portrait photo (NOT a contact sheet or grid). 8K photorealistic fashion magazine style.`;

        const [generatedUrl] = await generateImageToImage(
          targetImages.map((img) => ({ base64: img.base64, mimeType: img.mime })),
          shotPrompt,
          {
            aspectRatio: targetRatioEnum,
            resolution: ImageResolution.RES_2K,
            modelId: model,
            workflowHint: 'scene-product-lock',
          }
        );

        if (!generatedUrl) throw new Error(`姿态 #${shot.index} 生成失败`);

        const item: FissionImageItem = {
          index: shot.index,
          title: shot.shotName,
          framing: `${shot.framing} · ${shot.cameraAngle}`,
          pose: shot.poseAction,
          imageUrl: generatedUrl,
          prompt: shotPrompt,
        };

        localCompleted += 1;
        setCompletedCount(localCompleted);
        setFissionImages((current) => [...current, item].sort((a, b) => a.index - b.index));
        setAgentStatus(`高清并发 Agent · 已完成并发生成 (${localCompleted}/${count} 张)...`);

        return item;
      });

      const items = await Promise.all(tasks);

      setFissionImages(items);
      setStage(4);
      setAgentStatus(`交付 Agent · 全部 ${count} 张单图独立姿姿大图已高画质交付！`);
      setAgentLog((current) => [...current, `成功并发生成 ${items.length} 张单图高画质姿势大图`]);
      updateTask({ status: 'done', fissionImages: items });

      void saveGeneratedProject({
        type: 'MODEL_POSE_FISSION',
        generated: items.map((i) => i.imageUrl),
        original: images.map((i) => i.preview),
        prompt: requirements,
        thumbnail: items[0]?.imageUrl,
      });
    } catch (concurrentError) {
      setError(getErrorMessage(concurrentError));
      setAgentStatus('并发生成终止 · 请检查网络并重试');
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: TaskStatus) =>
    ({ editing: '编辑中', planning: 'Agent 处理中', ready: '方案已就绪', generating: '并发生成中', done: '已生成大图', error: '需要重试' }[
      status
    ]);

  const activeLibraryObj = POSE_LIBRARIES.find((l) => l.key === poseLibrary) || POSE_LIBRARIES[0];
  const activeSpecificPoseObj = currentLibraryPoses.find((p) => p.id === selectedSpecificPoseId);

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted">
            <Sparkles className="h-4 w-4 text-pastel-highlight" />
            AI 模特视觉工坊
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI 模特姿势裂变</h1>
          <p className="mt-1 text-sm text-pastel-muted">
            上传模特或服饰原图，支持 1-8 张单图并发直出，结合动作参考图/提示词智能精准识别
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {(['1. 输入', '2. 姿势解构方案', '3. 并发生成中', '4. 高清姿势图交付'] as const).map((label, index) => {
              const step = (index + 1) as Stage;
              const isCurrent = stage === step;
              const canClick =
                step === 1 ||
                (step === 2 && schemes.length > 0) ||
                (step === 3 && fissionImages.length > 0) ||
                (step === 4 && fissionImages.length > 0) ||
                stage >= step;
              return (
                <React.Fragment key={label}>
                  <button
                    type="button"
                    disabled={!canClick || busy}
                    onClick={() => setStage(step)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                      isCurrent
                        ? 'bg-[#172238] text-white shadow-sm ring-2 ring-[#172238]/20'
                        : canClick
                        ? 'bg-pastel-card text-pastel-text hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                        : 'bg-pastel-card/50 text-pastel-muted cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${
                        isCurrent ? 'bg-white text-[#172238]' : 'bg-slate-200 dark:bg-slate-700 text-pastel-text'
                      }`}
                    >
                      {step}
                    </span>
                    <span>{label}</span>
                  </button>
                  {index < 3 && <ChevronRight className="h-4 w-4 text-pastel-muted/50" />}
                </React.Fragment>
              );
            })}
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-300/70 bg-rose-500/10 p-4 text-xs font-bold text-rose-700 dark:text-rose-300">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button type="button" onClick={() => setError(null)} className="rounded-lg p-1 hover:bg-rose-500/20">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Collapsible History Drawer Toggle Button */}
        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-lg md:left-[16.25rem] lg:left-[17rem]"
          >
            <PanelLeftOpen className="h-4 w-4" />生成记录{' '}
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

        <div
          className={`grid grid-cols-1 gap-6 ${
            historyOpen
              ? 'xl:grid-cols-[16rem_28rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[28rem_minmax(0,1fr)]'
          }`}
        >
          {/* Collapsible Left History Drawer */}
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-black">生成记录</h2>
                  <p className="text-xs text-pastel-muted">可同时开多个裂变任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-pastel-border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={newTask}
                disabled={busy}
                className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#172238] text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                新开任务
              </button>

              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => {
                  const isActiveTask = task.id === activeTaskId;
                  return (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => switchTask(task)}
                        className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                          isActiveTask
                            ? 'border-[#172238] ring-2 ring-sky-100 dark:ring-slate-700'
                            : 'border-pastel-border hover:border-slate-300'
                        }`}
                      >
                        <div className="relative aspect-square bg-white dark:bg-slate-800">
                          {task.cover ? (
                            <img src={task.cover} alt="任务预览" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex min-h-7 items-center justify-center gap-1 bg-[#172238]/90 text-[0.68rem] font-bold text-white">
                            {task.status === 'planning' || task.status === 'generating' ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 text-[0.65rem] text-pastel-muted">
                          <span>
                            {new Date(task.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {task.workspace.images.length > 0 && <span>{task.workspace.images.length}张素材</span>}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => deleteTask(task.id, e)}
                        disabled={busy && task.id === activeTaskId}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow transition hover:bg-rose-500 group-hover:opacity-100 disabled:opacity-30"
                        title="删除任务"
                        aria-label="删除任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Left Column Controls */}
          <div className="space-y-6">
            {/* Unified Upload Card */}
            <section
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black">参考图素材管理</h2>
                  <p className="mt-0.5 text-xs text-pastel-muted">点击素材上的标签调出弹窗，清晰修改角色</p>
                </div>
                <span className="text-xs font-bold text-pastel-muted">{images.length} / {MAX_IMAGES}</span>
              </div>

              {images.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  className="mt-4 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg p-6 text-center transition hover:border-[#172238] dark:hover:border-white/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-slate-800">
                    <Wand2 className="h-6 w-6 text-pastel-highlight" />
                  </div>
                  <strong className="mt-3 text-sm font-black text-pastel-text">点击或拖拽上传模特 / 服装 / 参考图</strong>
                  <p className="mt-1 text-xs text-pastel-muted">支持 PNG, JPG, WebP 格式 · 可剪贴板 Ctrl+V 粘贴</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {images.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg">
                      <img src={img.preview} alt="Asset" className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setRoleModalAssetId(img.id)}
                        className={`absolute left-1.5 top-1.5 rounded-lg px-2 py-0.5 text-[0.65rem] font-black backdrop-blur-md transition hover:scale-105 shadow-sm ${ROLE_LABELS[img.role].bg} ${ROLE_LABELS[img.role].text}`}
                        title="点击选择角色标记"
                      >
                        {ROLE_LABELS[img.role].label}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAsset(img.id)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleImageDrop}
                      className="flex h-24 items-center justify-center rounded-xl border border-dashed border-pastel-border bg-pastel-bg text-pastel-muted hover:border-[#172238]"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void processFiles(Array.from(event.target.files || []));
                  event.target.value = '';
                }}
              />
              <div className="mt-3 rounded-xl border border-pastel-border bg-pastel-bg/50 px-3 py-2 text-xs leading-5 text-pastel-muted">
                提示：第一张图片将作为模特五官与服装锁定的第一参照。将图片标记为「动作反推」后，点击下方「下一步」才会开始反推并输出提示词。
              </div>
            </section>

            {/* Action Control Mode Card */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-black">
                    <Sparkles className="h-4 w-4 text-[#172238]" />
                    动作控制与姿态来源
                  </h2>
                  <p className="mt-0.5 text-xs text-pastel-muted">
                    默认使用 Agent 智能规划；也可按姿态库抽取、从参考图反推动作提示词或直接填写动作提示词
                  </p>
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[0.68rem] font-black text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                  {actionMode === 'agent'
                    ? '🤖 Agent 智能规划'
                    : actionMode === 'referenceImage'
                    ? `反推动作提示词 (${actionCount}张)`
                    : actionMode === 'random'
                    ? '智能随机动作'
                    : actionMode === 'manual'
                    ? `指定动作 (${activeSpecificPoseObj?.name || '单个动作'})`
                    : `提示词动作 (${parsedPromptActions.length}条)`}
                </span>
              </div>

              {/* Action mode selection */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { key: 'agent', label: 'Agent智能规划', desc: 'AI总监策划解构', icon: '🤖' },
                  { key: 'random', label: '智能随机动作', desc: '按姿态库抽取', icon: '🎲' },
                  { key: 'referenceImage', label: '反推动作提示词', desc: '标记图片后输出', icon: '📌' },
                  { key: 'promptText', label: '动作提示词', desc: '多条独立动作', icon: '📝' },
                ].map((m) => {
                  const isSelected = actionMode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setActionMode(m.key as ActionMode);
                      }}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition ${
                        isSelected
                          ? 'border-[#172238] bg-sky-50/60 font-black shadow-sm dark:bg-slate-800'
                          : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <strong className="mt-1 text-xs font-black text-pastel-text">{m.label}</strong>
                      <span className="mt-0.5 text-[0.62rem] text-pastel-muted">{m.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Agent Mode Active Status */}
              {actionMode === 'agent' && (
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs leading-5 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  <span>🤖 已开启「Agent 智能规划」。AI 艺术总监将根据您的素材与服装特点，自动构思并解构 {count} 张商业高点击姿态构图方案。</span>
                </div>
              )}

              {/* Manual Mode Active Status */}
              {actionMode === 'manual' && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-pastel-border bg-pastel-bg p-3">
                  <div>
                    <span className="text-[0.68rem] font-bold text-pastel-muted">已指定动作预设:</span>
                    <p className="mt-0.5 text-xs font-black text-pastel-text">
                      {activeLibraryObj.label} · {activeSpecificPoseObj?.name || '默认第一个动作'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectionModal('library')}
                    className="rounded-lg bg-[#172238] px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                  >
                    切换动作预设
                  </button>
                </div>
              )}

              {/* Prompt Text Mode Option */}
              {actionMode === 'promptText' && (
                <div className="mt-4 rounded-xl border border-pastel-border bg-pastel-bg p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-pastel-muted">自定义动作提示词 (每行或用分号分隔):</label>
                    <span className="rounded-md bg-[#172238]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#172238] dark:bg-white/10 dark:text-white">
                      已识别 {parsedPromptActions.length} 条动作
                    </span>
                  </div>
                  <textarea
                    value={customActionPrompts}
                    onChange={(e) => setCustomActionPrompts(e.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-lg border border-pastel-border bg-white p-2.5 text-xs outline-none focus:border-[#172238] dark:bg-slate-800"
                    placeholder="例如：侧身站立，一手扶腰; 向前走路，回头看镜头; 坐姿，双腿自然交叠"
                  />
                </div>
              )}

              {/* Reference Image Mode Status */}
              {actionMode === 'referenceImage' && (
                <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-xs leading-5 text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-300">
                  {actionCount > 0 ? (
                    <span>✨ 已标记 {actionCount} 张「动作反推」图片，点击下方「下一步」后，右侧会按图片编号输出高准确动作提示词。</span>
                  ) : (
                    <span>💡 请点击上方素材图片，在角色弹窗中标记为「动作反推」，系统会立即分析并输出动作提示词。</span>
                  )}
                </div>
              )}
            </section>

            {/* Fission Requirements Card */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black">自定义姿势与风格要求（选填）</h2>
              <p className="mt-1 text-xs text-pastel-muted">填写希望强调的动作姿态、情绪氛围、景别偏好或特定细节</p>
              <textarea
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                className="mt-3 min-h-28 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg p-3 text-sm outline-none focus:border-[#172238]"
                placeholder="例如：突出法式轻奢感，包含正面立姿、侧身迈步走姿、优雅倚靠坐姿、下装鞋靴特写等姿态"
              />
            </section>

            {/* Parameters Control Card */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black">参数配置</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* Generation Model */}
                <CreativeImageModelSelector value={model} onChange={setModel} disabled={busy} title="" compact className="col-span-2 border-0 bg-transparent p-0 shadow-none" />
                <button
                  type="button"
                  onClick={() => setSelectionModal('model')}
                  className="hidden"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">生成模型</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs font-black text-pastel-text">
                    <span>{MODEL_OPTIONS.find((m) => m.id === model)?.label || model}</span>
                    <ChevronRight className="h-4 w-4 text-pastel-muted" />
                  </span>
                </button>

                {/* Aspect Ratio */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('ratio')}
                  className="flex min-h-14 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#172238]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs font-black text-pastel-text">
                    <span>{ASPECT_RATIO_OPTIONS.find((r) => r.id === aspectRatio)?.label || aspectRatio}</span>
                    <ChevronRight className="h-4 w-4 text-pastel-muted" />
                  </span>
                </button>

                {/* Platform Style */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('platform')}
                  className="flex min-h-14 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#172238]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">投放平台</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs font-black text-pastel-text">
                    <span>{PLATFORM_STYLES.find((p) => p.key === platform)?.label || platform}</span>
                    <ChevronRight className="h-4 w-4 text-pastel-muted" />
                  </span>
                </button>

                {/* Crop Framing Option */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('crop')}
                  className="col-span-2 flex min-h-14 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#172238]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">裁图范围</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs font-black text-pastel-text">
                    <span className="truncate">{cropFramingById(cropFraming).shortLabel}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                {/* Generation Count / Concurrency Option (1-8) */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('count')}
                  className="col-span-2 flex min-h-14 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#172238]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">生成张数 (1-8并发)</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs font-black text-pastel-text">
                    <span>
                      {count} 张单图{' '}
                      {actionCount > 0
                        ? `(匹配 ${actionCount} 张动作参考图)`
                        : parsedPromptActions.length > 0
                        ? `(匹配 ${parsedPromptActions.length} 条提示词动作)`
                        : count === 8
                        ? '(最高 8 并发直出)'
                        : '(单图并发)'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-pastel-muted" />
                  </span>
                </button>
              </div>
            </section>

            {/* Action Trigger Button */}
            <button
              type="button"
              onClick={generatePlan}
              disabled={!images.length || busy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] px-4 text-base font-black text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && stage === 1 ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
              下一步：AI 规划 {count} 姿势动作方案
            </button>
          </div>

          {/* Right Column Interactive Dynamic Stage */}
          <div className="min-w-0">
            <section className="flex min-h-[42rem] flex-col rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border pb-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-black text-pastel-text">
                    <Sparkles className="h-4 w-4 text-pastel-highlight" />
                    {stage === 1
                      ? '输入准备'
                      : stage === 2
                      ? '姿势解构方案'
                      : stage === 3
                      ? '单图并发生成中'
                      : `${fissionImages.length || count} 张高清姿势单图交付`}
                  </h2>
                  <p className="mt-1 text-xs text-pastel-muted">
                    Agent 团队将依次完成姿态动作规划，并直接并发生成 {count} 张独立高清姿态大图
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {stage > 1 && (
                    <button
                      type="button"
                      onClick={() => setStage(1)}
                      className="flex items-center gap-1 rounded-xl border border-pastel-border bg-pastel-bg px-3 py-1.5 text-xs font-bold text-pastel-text transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> 返回修改输入
                    </button>
                  )}
                  {stage > 2 && schemes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStage(2)}
                      className="flex items-center gap-1 rounded-xl border border-pastel-border bg-pastel-bg px-3 py-1.5 text-xs font-bold text-pastel-text transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> 返回选择方案
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-pastel-bg px-4 py-2.5 text-xs font-bold text-pastel-muted">
                <span className="flex items-center gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#172238]" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {agentStatus}
                </span>
                <span>阶段 {stage} / 4</span>
              </div>

              {/* Stage 1 Content Preview */}
              {stage === 1 && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  onClick={() => images.length === 0 && fileInputRef.current?.click()}
                  className={`mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/50 p-8 text-center ${
                    images.length === 0 ? 'cursor-pointer hover:border-[#172238]' : ''
                  }`}
                >
                  {images.length > 0 ? (
                    <div className="w-full max-w-xl">
                      <h3 className="text-sm font-black text-pastel-text">已加载 {images.length} 张参考图素材</h3>
                      <div className="mt-4 grid grid-cols-4 gap-3">
                        {images.map((img) => (
                          <div key={img.id} className="relative overflow-hidden rounded-xl border border-pastel-border bg-white shadow-sm dark:bg-slate-800">
                            <img src={img.preview} alt="Input" className="h-24 w-full object-cover" />
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                              {ROLE_LABELS[img.role].label}
                            </span>
                          </div>
                        ))}
                      </div>
                      {images.some((img) => img.role === 'action') && (
                        <div className="mt-5 space-y-3 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-black text-pastel-text">反推动作提示词</h3>
                            <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[0.65rem] font-black text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                              一张图对应一条提示词
                            </span>
                          </div>
                          {images.filter((img) => img.role === 'action').map((img, index) => {
                            const isReversing = busy && actionMode === 'referenceImage' && !img.poseAnalysis;
                            return (
                              <div key={img.id} className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                                <div className="flex items-center justify-between gap-3">
                                  <strong className="text-xs text-purple-800 dark:text-purple-200">{index + 1}.</strong>
                                  {img.poseAnalysis && (
                                    <button
                                      type="button"
                                      onClick={() => void navigator.clipboard.writeText(img.poseAnalysis?.promptBlock || '')}
                                      className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-[0.65rem] font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-slate-900 dark:text-purple-300"
                                    >
                                      复制提示词
                                    </button>
                                  )}
                                </div>
                                <p className="mt-2 text-xs leading-6 text-pastel-text">
                                  {isReversing
                                    ? '正在按高准确动作反推公式分析图片…'
                                    : img.poseAnalysis?.promptBlock || '已标记为「动作反推」，点击下方「下一步」后开始反推。'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="mt-5 text-xs text-pastel-muted">
                        点击左侧「下一步：AI 规划 {count} 姿姿动作方案」开始 Agent 规划
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-md">
                      <Wand2 className="mx-auto h-12 w-12 text-pastel-muted/50" />
                      <h3 className="mt-4 text-base font-black text-pastel-text">请先上传模特与参考图素材</h3>
                      <p className="mt-2 text-xs leading-6 text-pastel-muted">
                        在左侧上传模特原图、服装产品图或动作参考图，AI 姿态 Agent 将为你规划 {count} 张单图并发姿势大图。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Stage 2 Content: Pose Schemes */}
              {stage === 2 && (
                <div className="mt-6 flex-1 space-y-6">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {schemes.map((scheme) => {
                      const isSelected = selectedSchemeIds.includes(scheme.id);
                      return (
                        <div
                          key={scheme.id}
                          onClick={() => setSelectedSchemeIds([scheme.id])}
                          className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                            isSelected
                              ? 'border-[#172238] bg-sky-50/40 shadow-lg dark:bg-slate-800/60'
                              : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-pastel-text">{scheme.title}</h3>
                            <input
                              type="radio"
                              name="schemeSelection"
                              checked={isSelected}
                              onChange={() => setSelectedSchemeIds([scheme.id])}
                              className="h-4 w-4 accent-[#172238]"
                            />
                          </div>
                          <p className="mt-2 text-xs text-pastel-muted">{scheme.summary}</p>
                          <div className="mt-3 rounded-xl bg-white/70 p-2.5 text-[0.7rem] font-bold text-pastel-text dark:bg-slate-900/50">
                            <strong>亮点策略:</strong> {scheme.strategy}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            {scheme.shots.map((shot) => (
                              <div key={shot.index} className="rounded-lg bg-pastel-card p-1.5 text-center text-[0.65rem] font-bold">
                                <span className="block text-[#172238] dark:text-sky-400">#{shot.index} {shot.shotName}</span>
                                <span className="block truncate text-pastel-muted">{shot.framing}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end border-t border-pastel-border pt-4">
                    <button
                      type="button"
                      onClick={generateConcurrentFissionImages}
                      disabled={!selectedSchemeIds.length || busy}
                      className="flex min-h-12 items-center gap-2 rounded-xl bg-[#172238] px-6 text-sm font-black text-white shadow-md hover:opacity-90 disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      开始并发直出生成 {count} 张高清姿姿大图
                    </button>
                  </div>
                </div>
              )}

              {/* Stage 3 Content: Concurrent Generation Progress */}
              {stage === 3 && (
                <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-pastel-border bg-pastel-bg/50 p-8 text-center">
                  <div className="w-full max-w-md space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#172238] text-white shadow-xl">
                      <Zap className="h-8 w-8 animate-pulse text-amber-400" />
                    </div>
                    <h3 className="text-base font-black text-pastel-text">正在并发并行生成 {count} 张单图姿态大图</h3>
                    <p className="text-xs text-pastel-muted">
                      最高 {count} 并发并行调用，保留原图面部五官与面料细节，单图高画质独立生成中...
                    </p>

                    <div className="mt-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-3 rounded-full bg-[#172238] transition-all duration-500"
                        style={{ width: `${Math.round((completedCount / count) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-pastel-text">
                      已完成 {completedCount} / {count} 张姿态单图
                    </span>
                  </div>

                  {fissionImages.length > 0 && (
                    <div className="mt-8 w-full">
                      <div className="mb-4 flex items-center justify-between gap-3 text-left">
                        <div>
                          <h3 className="text-sm font-black text-pastel-text">
                            已实时返回 {fissionImages.length} 张，剩余任务继续并行生成
                          </h3>
                          <p className="mt-1 text-xs text-pastel-muted">每张图片完成后会立即显示，无需等待全部任务结束。</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {fissionImages.map((item) => (
                          <div
                            key={item.index}
                            className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-white text-left shadow-sm dark:bg-slate-900"
                          >
                            <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(item.imageUrl)}
                                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:bg-slate-100"
                                  title="大图预览"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadSingleImage(item.imageUrl, item.title)}
                                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:bg-slate-100"
                                  title="下载大图"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                              <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.65rem] font-black text-white backdrop-blur-md">
                                #{item.index} {item.title}
                              </span>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-bold text-pastel-text">{item.framing}</p>
                              <p className="mt-1 line-clamp-2 text-[0.68rem] text-pastel-muted">{item.pose}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stage 4 Content: High-Res Standalone Fission Images */}
              {stage === 4 && (
                <div className="mt-6 flex-1 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-pastel-bg p-4">
                    <div>
                      <h3 className="text-sm font-black text-pastel-text">已成功生成 {fissionImages.length} 张高清独立姿势单图</h3>
                      <p className="mt-0.5 text-xs text-pastel-muted">支持单张放大、反偏色修复、独立品质查看与一键打包下载</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadAllFissionImages}
                      className="flex items-center gap-2 rounded-xl bg-[#172238] px-4 py-2 text-xs font-black text-white shadow-md hover:opacity-90"
                    >
                      <Download className="h-4 w-4" /> 批量打包下载全部 {fissionImages.length} 张大图
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {fissionImages.map((item, idx) => (
                      <div key={item.index} className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-sm dark:bg-slate-900">
                        <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setPreviewImage(item.imageUrl)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:bg-slate-100"
                              title="大图预览"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleColorCorrection(idx)}
                              className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md ${
                                item.colorCorrected ? 'bg-amber-500 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'
                              }`}
                              title="反偏色修复"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadSingleImage(item.imageUrl, item.title)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:bg-slate-100"
                              title="下载大图"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.65rem] font-black text-white backdrop-blur-md">
                            #{item.index} {item.title}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-bold text-pastel-text">{item.framing}</p>
                          <p className="mt-1 line-clamp-2 text-[0.68rem] text-pastel-muted">{item.pose}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Role Tag Selection Modal */}
      {roleModalAssetId && (
        <SelectionModal title="选择参考图标记角色" onClose={() => setRoleModalAssetId(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { role: 'model', label: '模特原图', desc: '作为面部五官与身体比例的核心参照', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
                { role: 'product', label: '服装/产品图', desc: '作为服装版型、颜色与面料材质核心参照', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
                { role: 'scene', label: '场景图', desc: '作为背景建筑、拍摄环境与光影调性参照', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
                { role: 'action', label: '动作反推', desc: '按裁图、朝向、重心、肢体和视线反推动作提示词', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
                { role: 'accessory', label: '配饰参考图', desc: '作为包包/鞋履/首饰配饰局部参照', color: 'bg-rose-500/10 text-rose-600 border-rose-200' },
                { role: 'overall', label: '整体参考图', desc: '综合参考人物、服装与氛围 DNA', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' },
              ] as const
            ).map((item) => {
              const activeAsset = images.find((i) => i.id === roleModalAssetId);
              const isSelected = activeAsset?.role === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => {
                    updateAssetRole(roleModalAssetId, item.role);
                    setRoleModalAssetId(null);
                  }}
                  className={`flex flex-col rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <span className={`inline-block w-fit rounded-lg px-2.5 py-1 text-xs font-black ${item.color}`}>
                    {item.label}
                  </span>
                  <span className="mt-2 text-xs text-pastel-muted">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* Parameter Selection Modals */}
      {selectionModal === 'model' && (
        <SelectionModal title="选择 AI 生成模型" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODEL_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setModel(item.id);
                  setSelectionModal(null);
                }}
                className={`flex flex-col rounded-2xl border-2 p-4 text-left transition ${
                  model === item.id ? 'border-[#172238] bg-sky-50/60 dark:bg-slate-800' : 'border-pastel-border bg-pastel-bg'
                }`}
              >
                <span className="text-xs font-bold text-pastel-muted">{item.desc}</span>
                <strong className="mt-1 text-sm font-black text-pastel-text">{item.label}</strong>
                <span className="mt-3 rounded-full bg-[#172238]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#172238] dark:bg-white/10 dark:text-white">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        </SelectionModal>
      )}

      {selectionModal === 'ratio' && (
        <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ASPECT_RATIO_OPTIONS.map((ratio) => {
              const [w, h] = ratio.id.split(':').map(Number);
              const scale = 50 / Math.max(w, h);
              const isSelected = aspectRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => {
                    setAspectRatio(ratio.id);
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
                  {isSelected && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[#172238] dark:text-white" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {selectionModal === 'platform' && (
        <SelectionModal title="选择目标投放平台风格" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLATFORM_STYLES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPlatform(p.key);
                  setSelectionModal(null);
                }}
                className={`flex flex-col rounded-2xl border-2 p-4 text-left transition ${
                  platform === p.key ? 'border-[#172238] bg-sky-50/60 dark:bg-slate-800' : 'border-pastel-border bg-pastel-bg'
                }`}
              >
                <span className="text-xl">{p.icon}</span>
                <strong className="mt-2 text-sm font-black text-pastel-text">{p.label}</strong>
                <span className="mt-1 text-xs text-pastel-muted">{p.desc}</span>
              </button>
            ))}
          </div>
        </SelectionModal>
      )}

      {/* Enhanced Unified Pose Preset Library & Specific Pose Selector Modal */}
      {selectionModal === 'library' && (
        <SelectionModal title="选择姿势预设库与具体动作" onClose={() => setSelectionModal(null)}>
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-pastel-muted">1. 选择姿势预设分类</h4>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {POSE_LIBRARIES.map((lib) => {
                  const isLibSelected = poseLibrary === lib.key;
                  return (
                    <button
                      key={lib.key}
                      type="button"
                      onClick={() => {
                        setPoseLibrary(lib.key);
                        const newPoses = lib.poses || CLOTHING_POSES;
                        if (newPoses.length > 0) setSelectedSpecificPoseId(newPoses[0].id);
                      }}
                      className={`flex flex-col rounded-xl border-2 p-3 text-left transition ${
                        isLibSelected
                          ? 'border-[#172238] bg-sky-50/60 font-black shadow-sm dark:bg-slate-800'
                          : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                      }`}
                    >
                      <strong className="text-xs font-black text-pastel-text">{lib.label}</strong>
                      <span className="mt-1 text-[0.68rem] text-pastel-muted">{lib.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-pastel-border pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-pastel-muted">
                  2. 动作模式与【{activeLibraryObj.label}】的具体姿势:
                </h4>
                <span className="text-[0.65rem] font-bold text-[#172238] dark:text-sky-400">
                  包含 {currentLibraryPoses.length} 种基础姿姿
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Option 1: Random option */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMode('random');
                    setSelectionModal(null);
                  }}
                  className={`flex flex-col rounded-xl border-2 p-3 text-left transition ${
                    actionMode === 'random'
                      ? 'border-[#172238] bg-sky-50/60 font-black shadow-sm dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black text-pastel-text">
                    🎲 智能随机抽取
                  </span>
                  <span className="mt-1 text-[0.68rem] text-pastel-muted">
                    在当前动作库全范围内智能随机编排动作姿势
                  </span>
                </button>

                {/* Specific pose items */}
                {currentLibraryPoses.map((pose) => {
                  const isThisSelected = actionMode === 'manual' && selectedSpecificPoseId === pose.id;
                  return (
                    <button
                      key={pose.id}
                      type="button"
                      onClick={() => {
                        setActionMode('manual');
                        setSelectedSpecificPoseId(pose.id);
                        setSelectionModal(null);
                      }}
                      className={`flex flex-col rounded-xl border-2 p-3 text-left transition ${
                        isThisSelected
                          ? 'border-[#172238] bg-sky-50/60 font-black shadow-sm dark:bg-slate-800'
                          : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center justify-between text-xs font-black text-pastel-text">
                        <span>📌 {pose.name}</span>
                        {isThisSelected && <CheckCircle2 className="h-4 w-4 text-[#172238] dark:text-white" />}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[0.68rem] text-pastel-muted">{pose.prompt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SelectionModal>
      )}

      {/* Crop Framing Modal */}
      {selectionModal === 'crop' && (
        <SelectionModal title="选择裁图范围" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CROP_FRAMING_OPTIONS.map((option) => {
              const isSelected = cropFraming === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setCropFraming(option.id);
                    setSelectionModal(null);
                  }}
                  className={`relative flex min-h-36 flex-col justify-between rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm dark:bg-slate-700">
                      {option.icon}
                    </span>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-[#172238] dark:text-white" />}
                  </div>
                  <div className="mt-3">
                    <strong className="block text-sm font-black text-pastel-text">{option.label}</strong>
                    <small className="mt-1 block text-xs leading-5 text-pastel-muted">{option.description}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* Count Modal (1 to 8) */}
      {selectionModal === 'count' && (
        <SelectionModal title="选择并发生成张数 (1 - 8 张)" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNT_OPTIONS.map((num) => {
              const isMatched = actionCount === num;
              const isSelected = count === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setCount(num);
                    setSelectionModal(null);
                  }}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-5 text-center transition ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl font-black text-[#172238] dark:text-sky-400">{num} 张</span>
                  <span className="mt-1 text-xs text-pastel-muted">
                    {isMatched ? '✨ 自动匹配动作图数' : num === 8 ? '推荐最高并发' : '单图并发'}
                  </span>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* Big Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-black p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={previewImage} alt="Preview" className="max-h-[85vh] w-auto rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelPoseFissionTab;
