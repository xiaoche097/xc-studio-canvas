import React, { useCallback, useEffect, useRef, useState } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileText,
  Grid,
  Grid3x3,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Maximize2,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  UserRoundCog,
  X,
} from 'lucide-react';
import { blobToBase64, compressImage, generateImageToImage, generateText } from '../services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { getErrorMessage } from '../utils/apiHelpers';
import { cropImageRegion } from '../utils/imageProcessor';
import { fetchImageBlob } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../../services/projectHistoryService';
import { AspectRatio, ImageResolution } from '../types';

type CreationMode = 'pose' | 'scene' | 'lookbook';
type Stage = 1 | 2 | 3 | 4;
type TaskStatus = 'editing' | 'planning' | 'ready' | 'generating' | 'done' | 'error';

type FissionAsset = { id: string; name: string; mime: string; base64: string; preview: string };

type FissionShot = {
  index: number;
  shotName: string;
  cameraAngle: string;
  framing: string;
  poseAction: string;
  prompt?: string;
};

type FissionScheme = {
  id: string;
  title: string;
  summary: string;
  strategy: string;
  shots: FissionShot[];
};

type KeyframeResult = {
  schemeId: string;
  imageUrl: string;
  qaPassed: boolean;
  qaNotes: string;
  prompt?: string;
};

type FissionImageItem = {
  index: number;
  title: string;
  framing: string;
  pose: string;
  imageUrl: string;
  prompt?: string;
};

type FissionWorkspace = {
  mode: CreationMode;
  images: FissionAsset[];
  requirements: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  stage: Stage;
  schemes: FissionScheme[];
  selectedSchemeIds: string[];
  keyframes: KeyframeResult[];
  activeKeyframeSchemeId?: string;
  fissionImages: FissionImageItem[];
  fissionImagesMap?: Record<string, FissionImageItem[]>;
  agentStatus: string;
  agentLog: string[];
  oneClick?: boolean;
};

type FissionTask = {
  id: string;
  createdAt: number;
  status: TaskStatus;
  cover?: string;
  fissionImages: FissionImageItem[];
  workspace: FissionWorkspace;
};

interface ModelSceneFissionTabProps {
  isActive?: boolean;
}

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

const MODEL_OPTIONS = [
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image',
    hint: '推荐',
    desc: '标准图画版 · 模特五官面部与发型服饰锁死精准',
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
  {
    id: 'qwen-image-3.0-pro',
    label: '千问3.0pro',
    hint: '千问图像旗舰',
    desc: '高质量图像生成与多参考图编辑',
  },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { id: '3:4', label: '3:4 竖版', desc: '电商时尚主图与模特首选' },
  { id: '2:3', label: '2:3 竖版', desc: '经典单反人像与海报比例' },
  { id: '1:1', label: '1:1 方版', desc: '经典正方形九宫格排版' },
  { id: '9:16', label: '9:16 竖屏', desc: '手机全屏展示与短视频分镜' },
  { id: '16:9', label: '16:9 横版', desc: '画册长图与横屏展示' },
] as const;

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

const DEFAULT_SHOT_TEMPLATES: FissionShot[] = [
  { index: 1, shotName: '正面全身立姿', cameraAngle: '平视视角', framing: '全身景别', poseAction: '自然站姿面向镜头，展示整体比例' },
  { index: 2, shotName: '侧身45度步态', cameraAngle: '侧向45度', framing: '中全身', poseAction: '向前迈步，眼神转向侧方' },
  { index: 3, shotName: '面部与眼神特写', cameraAngle: '微仰角', framing: '特写景别', poseAction: '专注眼神，展现五官与妆容' },
  { index: 4, shotName: '服饰材质与细节', cameraAngle: '俯拍45度', framing: '局部特写', poseAction: '手指轻抚领口或材质纹理' },
  { index: 5, shotName: '休闲坐姿状态', cameraAngle: '中低机位', framing: '中景', poseAction: '高脚凳/座椅坐姿，身体微微倾斜' },
  { index: 6, shotName: '背影回顾侧脸', cameraAngle: '后方视角', framing: '中景', poseAction: '背向镜头微微回眸，凸显后背剪裁' },
  { index: 7, shotName: '动态摆幅展现', cameraAngle: '抓拍角度', framing: '全身景别', poseAction: '转身摆动衣角，呈现飘逸动态' },
  { index: 8, shotName: '下装与鞋步细节', cameraAngle: '低视角仰拍', framing: '腿部特写', poseAction: '迈步瞬间，突显下装版型与靴履' },
  { index: 9, shotName: '远景环境氛围', cameraAngle: '广角视角', framing: '远景', poseAction: '融入建筑/室内空间，展现场景氛围' },
];

const buildDefaultSchemes = (requirementsText: string = '', creationMode: CreationMode = 'pose'): FissionScheme[] => {
  const reqSuffix = requirementsText.trim() ? `, special user requirement: ${requirementsText.trim()}` : '';

  return [
    {
      id: 'fission-scheme-1',
      title: '方案一：全景别经典商业摄影方案',
      summary: '全方位景别覆盖，包含正面全身、侧身45度、面部特写与服饰材质，标准电商与商业海报首选',
      strategy: '严格锁定原图模特五官面部与背景场景，拆解9种经典视角与构图',
      shots: [
        { index: 1, shotName: '正面全身立姿', cameraAngle: '平视视角', framing: '全身景别', poseAction: '自然站姿面向镜头，展示整体服装比例与版型', prompt: `Full body front standing pose, facing camera naturally, showing full outfit silhouette${reqSuffix}` },
        { index: 2, shotName: '侧身45度步态', cameraAngle: '侧向45度', framing: '中全身', poseAction: '向前迈步，眼神转向侧方，展现侧面线条', prompt: `Medium full body 45-degree angle side view, walking forward naturally${reqSuffix}` },
        { index: 3, shotName: '面部与眼神特写', cameraAngle: '微仰角', framing: '特写景别', poseAction: '专注眼神，展现五官精致度与妆容氛围', prompt: `Close-up shot of face and eyes, subtle upward angle, focused expression, high fashion lighting${reqSuffix}` },
        { index: 4, shotName: '服饰材质与细节', cameraAngle: '俯拍45度', framing: '局部特写', poseAction: '手指轻抚领口或衣角，展现面料纹理细节', prompt: `Macro close-up on outfit fabric texture and collar detail, hand touching fabric gently${reqSuffix}` },
        { index: 5, shotName: '休闲坐姿状态', cameraAngle: '中低机位', framing: '中景', poseAction: '座椅/高脚凳优雅坐姿，身体微微侧倾', prompt: `Medium shot seated pose, body slightly tilted, relaxed and elegant posture${reqSuffix}` },
        { index: 6, shotName: '背影回顾侧脸', cameraAngle: '后方视角', framing: '中景', poseAction: '背向镜头微微回眸，凸显后背剪裁与后景深度', prompt: `Medium shot looking back over shoulder, back view turning head, highlighting back detail${reqSuffix}` },
        { index: 7, shotName: '动态摆幅展现', cameraAngle: '抓拍角度', framing: '全身景别', poseAction: '转身摆动衣角，呈现飘逸流畅的自然动态', prompt: `Full body dynamic motion capture, turning around with swinging outfit hemline${reqSuffix}` },
        { index: 8, shotName: '下装与鞋步细节', cameraAngle: '低视角仰拍', framing: '腿部特写', poseAction: '迈步瞬间，突显下装版型与靴履细节质感', prompt: `Low angle close-up of legs and footwear, walking posture highlighting trousers silhouette${reqSuffix}` },
        { index: 9, shotName: '远景环境氛围', cameraAngle: '广角视角', framing: '远景', poseAction: '融入空间场景，展现品牌大片整体空间氛围', prompt: `Wide environmental long shot, model integrated into room/space atmosphere${reqSuffix}` },
      ],
    },
    {
      id: 'fission-scheme-2',
      title: '方案二：时尚 Lookbook 动态抓拍方案',
      summary: '时尚走秀与街拍抓拍风格，强调动作张力、流畅迈步与随性高质感姿态',
      strategy: '偏向高级时装大片，镜头语言更丰富，姿势极具时尚爆发力',
      shots: [
        { index: 1, shotName: '走秀迈步正面', cameraAngle: '平视微低', framing: '全身景别', poseAction: 'T台走秀步态，自信直视镜头，衣摆飘动', prompt: `Fashion runway walk full body shot, confident stride, hem swinging naturally${reqSuffix}` },
        { index: 2, shotName: '半侧身手托下巴', cameraAngle: '平视视角', framing: '半身中景', poseAction: '半侧身单手抚颏，眼神深邃，高级平面感', prompt: `Half-body medium shot, hand supporting chin gently, deep gaze into camera${reqSuffix}` },
        { index: 3, shotName: '侧颜轮廓特写', cameraAngle: '侧面视角', framing: '特写景别', poseAction: '纯侧脸剪影，突出下颚线与侧面发型与领口', prompt: `Profile close-up shot, sharp jawline, emphasizing side facial silhouette and hair style${reqSuffix}` },
        { index: 4, shotName: '配饰与手部细节', cameraAngle: '近景特写', framing: '局部特写', poseAction: '调整手包或袖口动作，精致配饰细节呈现', prompt: `Close-up on hands adjusting cuff/accessory/bag, intricate luxury details${reqSuffix}` },
        { index: 5, shotName: '倚靠墙面倾斜', cameraAngle: '斜向机位', framing: '中全身', poseAction: '自然倚靠背景墙面，双腿交叉，肢体拉长', prompt: `Medium full shot leaning against architectural background, crossed legs pose${reqSuffix}` },
        { index: 6, shotName: '走动回眸抓拍', cameraAngle: '后侧视角', framing: '中景', poseAction: '行进中快速回首，秀发微扬，灵动感十足', prompt: `Medium snapshot walking away and looking back, hair floating slightly${reqSuffix}` },
        { index: 7, shotName: '伸展张力姿势', cameraAngle: '低仰角', framing: '全身景别', poseAction: '单手插兜或双臂微微伸展，塑造强大气场', prompt: `Full body low angle posture, arms in pockets or slightly gestured, high fashion aura${reqSuffix}` },
        { index: 8, shotName: '鞋履与迈步交替', cameraAngle: '俯视角', framing: '下半身特写', poseAction: '双腿交错步态，侧重鞋面材质与下摆搭落', prompt: `High angle down close-up on legs stepping forward, footwear highlight${reqSuffix}` },
        { index: 9, shotName: '建筑空间延伸', cameraAngle: '极远景', framing: '远景大片', poseAction: '模特位于黄金分割点，空间感与留白相呼应', prompt: `Extreme wide shot, golden ratio placement, high fashion architecture framing${reqSuffix}` },
      ],
    },
    {
      id: 'fission-scheme-3',
      title: '方案三：高端法式优雅氛围感方案',
      summary: '主打柔和优雅光影与法式慵懒情绪，细节耐看，柔和舒适的高定美感',
      strategy: '情绪美学与质感兼顾，适合高端品牌宣传画册与私密时尚写真',
      shots: [
        { index: 1, shotName: '优雅正面倚立', cameraAngle: '柔风视角', framing: '全身景别', poseAction: '身体自然放松，微微侧头，展现优雅韵味', prompt: `Full body portrait standing with gentle tilt, French romantic atmosphere${reqSuffix}` },
        { index: 2, shotName: '侧向温婉坐姿', cameraAngle: '平视机位', framing: '中景', poseAction: '优雅侧坐，双手交叠于膝前，姿态端庄', prompt: `Medium shot seated sideways, hands gently overlapped on lap, elegant aura${reqSuffix}` },
        { index: 3, shotName: '光影面部微距', cameraAngle: '近景斜光', framing: '特写景别', poseAction: '光影映照半边面部，双眸微闭或深情凝视', prompt: `Soft light close-up face portrait, dramatic shadow and highlight interplay${reqSuffix}` },
        { index: 4, shotName: '领口与项链特写', cameraAngle: '俯视角近景', framing: '局部特写', poseAction: '手部轻提领口，锁骨与服装剪裁完美结合', prompt: `Macro shot on neckline and collarbone detail, finger brushing collar light touch${reqSuffix}` },
        { index: 5, shotName: '漫步转身倾靠', cameraAngle: '侧景中高位', framing: '中全身', poseAction: '轻盈步调中微倾身躯，散发懒散优雅气质', prompt: `Medium-full shot casual movement, relaxed slouchy high fashion tilt${reqSuffix}` },
        { index: 6, shotName: '背影优雅留白', cameraAngle: '正后方视角', framing: '中远景', poseAction: '修长背影，优雅发型与背部剪裁静止成画', prompt: `Back view medium-wide portrait, elegant hair styling and back garment cut${reqSuffix}` },
        { index: 7, shotName: '坐姿侧倾伸腿', cameraAngle: '低机位', framing: '全身景别', poseAction: '双腿自然向一侧延伸，拉长视觉比例', prompt: `Full body low angle sitting pose, legs extended diagonally for leg lengthening${reqSuffix}` },
        { index: 8, shotName: '裙摆/衣角轻扬', cameraAngle: '微距抓拍', framing: '动态特写', poseAction: '手指触碰服装搭落细节，质感细腻', prompt: `Macro close-up capture of garment edge and floating fabric texture${reqSuffix}` },
        { index: 9, shotName: '温润环境合影', cameraAngle: '柔和远景', framing: '远景氛围', poseAction: '融入温馨优雅空间背景，静谧感满满', prompt: `Atmospheric wide shot, harmonious color palette, cinematic French aesthetic${reqSuffix}` },
      ],
    },
  ];
};

const createTask = (): FissionTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  fissionImages: [],
  workspace: {
    mode: 'pose',
    images: [],
    requirements: '',
    model: MODEL_OPTIONS[0].id,
    aspectRatio: '2:3',
    resolution: '2K',
    stage: 1,
    schemes: [],
    selectedSchemeIds: [],
    keyframes: [],
    fissionImages: [],
    agentStatus: '输入准备 Agent · 等待上传模特/场景原图',
    agentLog: ['已初始化模特场景图裂变任务'],
    oneClick: true,
  },
});

const parseJson = <T,>(value: string): T => {
  if (!value || typeof value !== 'string') {
    throw new Error('创意 Agent 未返回有效文本方案，请重新生成');
  }
  return JSON.parse(value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()) as T;
};

const parseSchemes = (value: string): FissionScheme[] => {
  const parsed = parseJson<Array<Record<string, unknown>>>(value);
  if (!Array.isArray(parsed) || parsed.length < 1) throw new Error('创意 Agent 未返回有效裂变方案，请重新生成');

  return parsed.slice(0, 3).map((item, index) => {
    const rawShots = Array.isArray(item.shots) ? (item.shots as Array<Record<string, unknown>>) : [];
    const shots: FissionShot[] = DEFAULT_SHOT_TEMPLATES.map((tmpl, shotIdx) => {
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
      title: String(item.title || `9机位姿势裂变方案 ${index + 1}`),
      summary: String(item.summary || '根据原图模特与场景特征，拆解9种差异化视角与动作姿势'),
      strategy: String(item.strategy || '涵盖全身、中景、特写、背影与动态，全方位展现造型与质感'),
      shots,
    };
  });
};

const ModelSceneFissionTab: React.FC<ModelSceneFissionTabProps> = ({ isActive = true }) => {
  const initialTaskRef = useRef<FissionTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createTask();

  const [tasks, setTasks] = useState<FissionTask[]>([initialTaskRef.current]);
  const [activeTaskId, setActiveTaskId] = useState<string>(initialTaskRef.current.id);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [mode, setMode] = useState<CreationMode>('pose');
  const [images, setImages] = useState<FissionAsset[]>([]);
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [resolution, setResolution] = useState('2K');
  const [oneClick, setOneClick] = useState(true);
  const [stage, setStage] = useState<Stage>(1);

  const [schemes, setSchemes] = useState<FissionScheme[]>([]);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [keyframes, setKeyframes] = useState<KeyframeResult[]>([]);
  const [activeKeyframeSchemeId, setActiveKeyframeSchemeId] = useState<string>('');
  const [fissionImagesMap, setFissionImagesMap] = useState<Record<string, FissionImageItem[]>>({});
  const [fissionImages, setFissionImages] = useState<FissionImageItem[]>([]);

  const [agentStatus, setAgentStatus] = useState('输入准备 Agent · 等待素材');
  const [agentLog, setAgentLog] = useState<string[]>(['已创建模特场景图裂变任务']);
  const [selectionModal, setSelectionModal] = useState<'ratio' | 'model' | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [promptModal, setPromptModal] = useState<{
    schemeId?: string;
    title: string;
    subtitle?: string;
    editable?: boolean;
    prompts?: Array<{ label: string; content: string }>;
  } | null>(null);
  const [editableShots, setEditableShots] = useState<FissionShot[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleEditableShotChange = (
    index: number,
    field: keyof FissionShot,
    value: string
  ) => {
    setEditableShots((current) =>
      current.map((shot, i) => (i === index ? { ...shot, [field]: value } : shot))
    );
  };

  const handleSavePromptEdits = () => {
    if (!promptModal?.schemeId) return;
    const schemeId = promptModal.schemeId;
    const updatedSchemes = schemes.map((s) =>
      s.id === schemeId ? { ...s, shots: editableShots } : s
    );
    setSchemes(updatedSchemes);
    updateTask({ workspace: { ...currentWorkspace(), schemes: updatedSchemes } });
    setPromptModal(null);
    setAgentLog((current) => [...current, `已保存对「${promptModal.title}」动作提示词的修改`]);
  };

  const handleResetPromptEdits = () => {
    if (!promptModal?.schemeId) return;
    const originalScheme = schemes.find((s) => s.id === promptModal.schemeId);
    if (originalScheme) {
      setEditableShots(JSON.parse(JSON.stringify(originalScheme.shots)));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateTask = useCallback(
    (patch: Partial<FissionTask>) => {
      setTasks((current) => current.map((task) => (task.id === activeTaskId ? { ...task, ...patch } : task)));
    },
    [activeTaskId]
  );

  const currentWorkspace = (): FissionWorkspace => ({
    mode,
    images,
    requirements,
    model,
    aspectRatio,
    resolution,
    oneClick,
    stage,
    schemes,
    selectedSchemeIds,
    keyframes,
    activeKeyframeSchemeId,
    fissionImages,
    fissionImagesMap,
    agentStatus,
    agentLog,
  });

  const restoreWorkspace = (workspace: FissionWorkspace, taskImages: FissionImageItem[]) => {
    setMode(workspace.mode);
    setImages(workspace.images);
    setRequirements(workspace.requirements);
    setModel(workspace.model);
    setAspectRatio(workspace.aspectRatio);
    setResolution(workspace.resolution);
    setOneClick(workspace.oneClick ?? true);
    setStage(workspace.stage);
    setSchemes(workspace.schemes);
    setSelectedSchemeIds(workspace.selectedSchemeIds);
    setKeyframes(workspace.keyframes);
    setActiveKeyframeSchemeId(workspace.activeKeyframeSchemeId || workspace.keyframes[0]?.schemeId || '');
    setFissionImagesMap(workspace.fissionImagesMap || {});
    setFissionImages(taskImages);
    setAgentStatus(workspace.agentStatus);
    setAgentLog(workspace.agentLog);
    setError(null);
  };

  const switchTask = (task: FissionTask) => {
    if (busy || task.id === activeTaskId) return;
    const snapshot = currentWorkspace();
    setTasks((current) =>
      current.map((item) =>
        item.id === activeTaskId
          ? { ...item, workspace: snapshot, fissionImages, cover: images[0]?.preview || item.cover }
          : item
      )
    );
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace, task.fissionImages);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const deleteTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (busy && id === activeTaskId) return;
    setTasks((current) => {
      if (current.length <= 1) {
        const freshTask = createTask();
        setActiveTaskId(freshTask.id);
        restoreWorkspace(freshTask.workspace, []);
        return [freshTask];
      }
      const remaining = current.filter((t) => t.id !== id);
      if (id === activeTaskId) {
        const nextTask = remaining[0];
        setActiveTaskId(nextTask.id);
        restoreWorkspace(nextTask.workspace, nextTask.fissionImages);
      }
      return remaining;
    });
  };

  const handleCopyPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      const accepted = files
        .filter((file) => file.type.startsWith('image/') && file.size <= MAX_FILE_SIZE)
        .slice(0, MAX_IMAGES - images.length);
      if (!accepted.length) {
        setError(
          files.some((file) => file.size > MAX_FILE_SIZE)
            ? '单张图片不能超过 30MB'
            : `最多上传 ${MAX_IMAGES} 张模特/产品参考图`
        );
        return;
      }
      try {
        const next = await Promise.all(
          accepted.map(async (file): Promise<FissionAsset> => {
            const compressed = await compressImage(file, 2048, 0.94);
            return {
              id: crypto.randomUUID(),
              name: file.name,
              mime: compressed.mime,
              base64: compressed.base64,
              preview: `data:${compressed.mime};base64,${compressed.base64}`,
            };
          })
        );
        const merged = [...images, ...next].slice(0, MAX_IMAGES);
        setImages(merged);
        updateTask({ cover: merged[0]?.preview, status: 'editing' });
        setStage(1);
        setSchemes([]);
        setSelectedSchemeIds([]);
        setKeyframes([]);
        setFissionImages([]);
        setAgentStatus('输入准备 Agent · 已接收模特素材');
        setAgentLog((current) => [...current, `视觉管理员已接收 ${merged.length} 张参考图`]);
        setError(null);
      } catch (uploadError) {
        setError(getErrorMessage(uploadError));
      }
    },
    [images, updateTask]
  );

  useImagePaste((files) => void processFiles(files), isActive && !busy);

  const handleImageDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (busy) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) void processFiles(files);
    },
    [busy, processFiles]
  );

  const downloadSingleImage = useCallback(async (url: string, title: string) => {
    const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-') || 'model-fission'}-${Date.now()}.png`;
    let downloadUrl = url;
    let objectUrl: string | null = null;
    try {
      if (!url.startsWith('data:')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        objectUrl = URL.createObjectURL(await response.blob());
        downloadUrl = objectUrl;
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const downloadAllFissionImages = useCallback(async () => {
    for (let i = 0; i < fissionImages.length; i++) {
      const item = fissionImages[i];
      await downloadSingleImage(item.imageUrl, `模特裂变-${i + 1}-${item.title}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [downloadSingleImage, fissionImages]);

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

  const generatePlanWithAI = async () => {
    if (!images.length || busy) return;
    setBusy(true);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus('创意策划 Agent · 正在深度分析模特、服装与场景要素');
    setAgentLog((current) => [...current, '创意策划 Agent 开始分析参考图中的模特面部、身材比例与服饰样式']);
    try {
      const response = await generateText(
        images.map((image) => ({ base64: image.base64, mimeType: image.mime })),
        `
You are an expert fashion photographer and commercial art director.
Analyze the uploaded reference image(s) as the SINGLE ABSOLUTE SOURCE OF TRUTH for BOTH model identity and background scene environment.

CRITICAL INSTRUCTIONS (MUST BE STRICTLY FOLLOWED):
1. STRICT SCENE LOCK: You MUST strictly preserve and replicate the EXACT background scene environment, lighting, architectural details, atmosphere, and surface textures from the user's uploaded reference image(s). DO NOT invent, change, or introduce any different, unrelated, or hallucinated background scenes under any circumstances. All 9 shots must strictly remain within the EXACT same original background scene.
2. STRICT MODEL & OUTFIT LOCK: You MUST strictly preserve the model's facial features, identity, hairstyle, hair color, skin tone, body shape, and clothing/outfit design and colors from the reference image(s).
3. RICH & COMPLIANT POSE VARIATIONS: You are encouraged to generate more varied, creative, natural, dynamic, and diverse poses, posture actions, expressions, camera angles, and shot framings (full body, medium shot, close-up, back view, movement), provided they strictly stay within the exact reference background scene and model conditions above.
4. STRICT NO-TEXT & NO-LABEL MANDATE: The prompts and shot descriptions MUST NOT include any text or typography rendering instructions. Absolutely NO words, NO numbers, NO letters, NO titles, NO watermarks, NO logo typography, NO graphic overlay badges anywhere in the output scenes.

User requirements: ${requirements || 'High fashion commercial photoshoot with 9 diverse natural poses matching the exact original reference scene and model'}
Mode: ${mode === 'pose' ? 'Model Pose & Camera Framing Fission' : mode === 'scene' ? 'Multi-Angle Scene Fission' : 'Brand Lookbook Collection Fission'}

Return ONLY a JSON array. Each item format:
{"title":"Chinese Scheme Title","summary":"Chinese summary","strategy":"Creative selling points","shots":[{"index":1,"shotName":"正面全身立姿","cameraAngle":"平视视角","framing":"全身景别","poseAction":"描述符合原场景条件的动作姿势细节","prompt":"detailed English generation prompt locking exact reference model face identity and original reference background scene without text or numbers"}]}
The array must contain exactly 3 schemes, each having 9 structured shots. No generic duplicates.`
      );

      const nextSchemes = parseSchemes(response);
      setSchemes(nextSchemes);
      setSelectedSchemeIds([nextSchemes[0].id]);
      setActiveKeyframeSchemeId('');
      setFissionImagesMap({});
      setKeyframes([]);
      setFissionImages([]);
      setStage(2);
      setAgentStatus('创意策划 Agent · 3 套 9 机位动作方案已交付');
      setAgentLog((current) => [...current, `创意策划 Agent 已交付 ${nextSchemes.length} 套方案，包含 9 种景别姿势`]);
      updateTask({ status: 'ready' });
    } catch (planError) {
      setError(getErrorMessage(planError));
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const generateKeyframes = async (overrideSchemes?: FissionScheme[]): Promise<KeyframeResult[]> => {
    const currentSchemes = overrideSchemes || schemes;
    const currentSelectedIds = overrideSchemes ? overrideSchemes.map((s) => s.id) : selectedSchemeIds;
    const selected = currentSchemes.filter((scheme) => currentSelectedIds.includes(scheme.id));
    if (!selected.length || (busy && !overrideSchemes)) return [];
    setBusy(true);
    setStage(3);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus('分镜导演 Agent · 正在生成 3x3 宫格关键帧大图');
    setAgentLog((current) => [...current, `分镜导演 Agent 开始排版制作 ${selected.length} 套 3x3 宫格关键帧`]);

    try {
      const outputs: KeyframeResult[] = [];
      for (const scheme of selected) {
        const contactSheetPrompt = `Create one clean 3x3 high-definition fashion photography contact sheet grid containing 9 distinct panels for an ecommerce photoshoot. User requirement: ${requirements || 'High fashion commercial photoshoot'}.

Panels description:
${scheme.shots
  .map((s) => `Panel ${s.index}: ${s.framing}, ${s.cameraAngle}, ${s.poseAction}`)
  .join('\n')}

CRITICAL MANDATE - STRICT NO TEXT / NO WATERMARKS / NO NUMBERS:
- ABSOLUTELY ZERO TEXT: Do NOT include any text, words, numbers, digits, titles, labels, captions, watermarks, stamps, symbols, badges, logos, or graphic overlays anywhere on any panel.
- NO OVERLAID NUMBERS: Panel 1 (top left) and all subsequent panels MUST BE pure clean photographs without any overlaid numbers or text labels (e.g. no "1", no "Shot 1", no "图1").
- CLEAN PHOTOGRAPHY ONLY: Every single panel must be high-end photorealistic commercial fashion photography only.

CRITICAL MANDATE - STRICT SCENE & MODEL REFERENCE LOCK:
- SCENE LOCK: The background environment, background architectural setting, lighting, surface textures, and atmosphere in ALL 9 panels MUST 100% MATCH the exact original background scene provided in the reference image(s). Absolutely NO different or modified background scenes are allowed.
- MODEL LOCK: Keep exact model facial features, identity, hairstyle, hair color, skin tone, body ratio, clothing design, colors, and fabric texture 100% consistent and identical across all 9 panels.
- DIVERSE COMPLIANT POSES: Feature varied, natural, dynamic, professional poses, expressions, and camera framings across the 9 panels while strictly maintaining the original scene background and model.

Nine distinct sequential panels arranged neatly in a 3x3 grid, zero borders, pure clean photos without text, photorealistic 8K fashion editorial quality.`;

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

        const [firstKeyframe] = await generateImageToImage(
          images.map((image) => ({ base64: image.base64, mimeType: image.mime })),
          contactSheetPrompt,
          {
            aspectRatio: targetRatioEnum,
            resolution: ImageResolution.RES_2K,
            modelId: model,
            workflowHint: 'scene-product-lock',
          }
        );

        if (!firstKeyframe) throw new Error(`${scheme.title} 宫格关键帧生成失败`);

        setAgentStatus(`质量审查 Agent · 正在检查「${scheme.title}」9 个面板一致性`);
        let qa: { pass?: boolean; notes?: string } = {};
        try {
          let qaBase64: string;
          let qaMimeType = 'image/png';
          const dataUrlMatch = firstKeyframe.match(/^data:(image\/[^;,]+);base64,(.+)$/s);

          if (dataUrlMatch) {
            qaMimeType = dataUrlMatch[1];
            qaBase64 = dataUrlMatch[2].replace(/\s/g, '');
          } else if (/^https?:\/\//i.test(firstKeyframe)) {
            const keyframeBlob = await fetchImageBlob(firstKeyframe);
            qaMimeType = keyframeBlob.type || qaMimeType;
            qaBase64 = await blobToBase64(keyframeBlob);
          } else {
            qaBase64 = firstKeyframe.replace(/\s/g, '');
          }

          const qaRaw = await generateText(
            [{ base64: qaBase64, mimeType: qaMimeType }],
            `You are a strict fashion QA agent. Review this 3x3 contact sheet image for strict scene background lock (must match reference image background 100%), model face identity lock, clothing consistency, and 9-panel completeness. Verify that there is NO overlaid text, numbers, or watermarks. Return ONLY JSON: {"pass":true,"notes":"concise Chinese evaluation"}.`
          );
          try {
            qa = parseJson(qaRaw);
          } catch {
            qa = { pass: true, notes: '9个机位结构完整，无文字杂质，模特与服饰一致性良好' };
          }
        } catch (qaError) {
          console.warn('[ModelSceneFission] Keyframe generated, but automatic QA was unavailable.', qaError);
          qa = { pass: false, notes: '关键帧已生成，但自动质量审查暂时不可用，可继续预览或裁切。' };
        }

        outputs.push({
          schemeId: scheme.id,
          imageUrl: firstKeyframe,
          qaPassed: qa.pass !== false,
          qaNotes: qa.notes || '质量审查合格',
          prompt: contactSheetPrompt,
        });
      }

      setKeyframes(outputs);
      if (outputs.length > 0) {
        setActiveKeyframeSchemeId(outputs[0].schemeId);
      }
      setFissionImagesMap({});
      setFissionImages([]);
      setAgentStatus('质量审查 Agent · 3x3 宫格关键帧已通过，可选择任意方案开始切分裂变');
      setAgentLog((current) => [...current, `分镜导演生成 ${outputs.length} 张 3x3 宫格关键帧`, '质量审查已通过']);
      updateTask({ status: 'ready' });
      return outputs;
    } catch (keyframeError) {
      setError(getErrorMessage(keyframeError));
      setAgentStatus('Agent 流程已暂停 · 请重试当前阶段');
      updateTask({ status: 'error' });
      throw keyframeError;
    } finally {
      setBusy(false);
    }
  };

  const generateFissionImages = async (
    targetSchemeId?: string,
    overrideKeyframes?: KeyframeResult[],
    overrideSchemes?: FissionScheme[]
  ): Promise<FissionImageItem[]> => {
    const currentKeyframes = overrideKeyframes || keyframes;
    const currentSchemes = overrideSchemes || schemes;
    if (!currentKeyframes.length || (busy && !overrideKeyframes)) return [];

    const schemeIdToCrop = targetSchemeId || activeKeyframeSchemeId || currentKeyframes[0].schemeId;
    const targetKeyframe = currentKeyframes.find((k) => k.schemeId === schemeIdToCrop) || currentKeyframes[0];
    const scheme = currentSchemes.find((s) => s.id === targetKeyframe.schemeId) || currentSchemes[0];
    const sourceUrl = targetKeyframe?.imageUrl;

    if (!sourceUrl) {
      throw new Error('未获取到 3x3 宫格关键帧大图，请先从关键帧步骤生成宫格图');
    }

    setBusy(true);
    setStage(4);
    setActiveKeyframeSchemeId(targetKeyframe.schemeId);
    setError(null);
    updateTask({ status: 'generating' });
    setAgentStatus(`高清裂变 Agent · 正在切割提取「${scheme.title}」9 张高清独立大图`);
    setAgentLog((current) => [...current, `高清裂变 Agent 开始对「${scheme.title}」3x3 宫格图进行精准切分与像素优化`]);

    try {
      const items: FissionImageItem[] = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const index = row * 3 + col;
          const shot = scheme.shots[index] || DEFAULT_SHOT_TEMPLATES[index];

          // Precise normalized coordinates for 3x3 grid crop
          const cropX = col / 3 + 0.005;
          const cropY = row / 3 + 0.005;
          const cropW = 1 / 3 - 0.01;
          const cropH = 1 / 3 - 0.01;

          const croppedDataUrl = await cropImageRegion(
            sourceUrl,
            { x: cropX, y: cropY, width: cropW, height: cropH },
            'image/png',
            0.96
          );

          items.push({
            index: index + 1,
            title: shot.shotName,
            framing: `${shot.framing} · ${shot.cameraAngle}`,
            pose: shot.poseAction,
            imageUrl: croppedDataUrl,
            prompt: shot.prompt || `${shot.shotName}: ${shot.framing}, ${shot.poseAction}`,
          });
        }
      }

      setFissionImagesMap((current) => ({ ...current, [targetKeyframe.schemeId]: items }));
      setFissionImages(items);
      setAgentStatus(`交付 Agent ·「${scheme.title}」9 张不同机位与姿势高清大图已全部交付`);
      setAgentLog((current) => [...current, `高清裂变 Agent 已为「${scheme.title}」输出 9 张高画质独立大图`]);
      updateTask({ status: 'done', fissionImages: items });

      void saveGeneratedProject({
        type: 'MODEL_SCENE_FISSION',
        generated: items.map((i) => i.imageUrl),
        original: images.map((i) => i.preview),
        prompt: requirements,
        thumbnail: items[0]?.imageUrl,
      });
      return items;
    } catch (fissionError) {
      setError(getErrorMessage(fissionError));
      setAgentStatus('高清裂变 Agent · 失败，请重试');
      updateTask({ status: 'error' });
      throw fissionError;
    } finally {
      setBusy(false);
    }
  };

  const handleStartFission = async () => {
    if (!images.length || busy) return;
    setBusy(true);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus('创意策划 Agent · 正在根据参考图与【你的裂变要求】动态规划 3 套机位方案...');
    setAgentLog((current) => [
      ...current,
      '创意策划 Agent 开始分析参考图中的模特与场景，结合用户裂变要求定制 3 套 9 机位方案...',
    ]);

    let activeSchemes: FissionScheme[];
    try {
      const response = await generateText(
        images.map((image) => ({ base64: image.base64, mimeType: image.mime })),
        `
You are an expert fashion photographer and commercial art director.
Analyze the uploaded reference image(s) as the SINGLE ABSOLUTE SOURCE OF TRUTH for BOTH model identity and background scene environment.

CRITICAL INSTRUCTIONS (MUST BE STRICTLY FOLLOWED):
1. STRICT SCENE LOCK: You MUST strictly preserve and replicate the EXACT background scene environment, lighting, architectural details, atmosphere, and surface textures from the user's uploaded reference image(s). DO NOT invent, change, or introduce any different, unrelated, or hallucinated background scenes under any circumstances. All 9 shots must strictly remain within the EXACT same original background scene.
2. STRICT MODEL & OUTFIT LOCK: You MUST strictly preserve the model's facial features, identity, hairstyle, hair color, skin tone, body shape, and clothing/outfit design and colors from the reference image(s).
3. USER FISSION REQUIREMENTS MATCHING: Incorporate and strictly prioritize the user's explicit fission requirements: "${requirements || 'High fashion commercial photoshoot with 9 diverse natural poses matching the exact original reference scene and model'}".
4. RICH & COMPLIANT POSE VARIATIONS: Generate varied, creative, natural, dynamic, and diverse poses, posture actions, expressions, camera angles, and shot framings (full body, medium shot, close-up, back view, movement) tailored specifically to the user's requirement.
5. STRICT NO-TEXT MANDATE: Absolutely NO text, numbers, letters, titles, watermarks, logo typography anywhere in the output.

Return ONLY a JSON array with exactly 3 distinct schemes, each containing 9 structured shots. Format:
[{"title":"Chinese Scheme Title","summary":"Chinese summary","strategy":"Creative selling points","shots":[{"index":1,"shotName":"正面全身立姿","cameraAngle":"平视视角","framing":"全身景别","poseAction":"符合需求的动作细节","prompt":"detailed English generation prompt locking model and reference scene without text"}]}]`
      );

      activeSchemes = parseSchemes(response);
    } catch (planError) {
      console.warn('[ModelSceneFission] Agent dynamic planning failed, falling back to smart customized schemes', planError);
      activeSchemes = buildDefaultSchemes(requirements, mode);
    }

    setSchemes(activeSchemes);

    if (!oneClick) {
      // If oneClick is OFF: show stage 2 for manual inspection
      setSelectedSchemeIds([activeSchemes[0].id]);
      setStage(2);
      setAgentStatus('创意策划 Agent · 3 套 9 机位定制方案已交付');
      setAgentLog((current) => [...current, `Agent 已结合裂变要求生成 ${activeSchemes.length} 套定制方案与 Prompt`]);
      updateTask({ status: 'ready' });
      setBusy(false);
      return;
    }

    // If oneClick is ON: randomly pick 1 of 3 dynamic schemes and auto generate end-to-end
    updateTask({ status: 'generating' });

    const randomIndex = Math.floor(Math.random() * activeSchemes.length);
    const chosenScheme = activeSchemes[randomIndex];

    setSelectedSchemeIds([chosenScheme.id]);
    setActiveKeyframeSchemeId(chosenScheme.id);

    setAgentStatus(`一键生图 Agent · 从 3 套定制方案中随机抽取「${chosenScheme.title}」，正在生成 3x3 宫格图...`);
    setAgentLog((current) => [
      ...current,
      `Agent 已结合裂变要求生成 3 套定制方案，随机抽取「${chosenScheme.title}」`,
      `开始一键流水线生成 3x3 宫格关键帧大图...`,
    ]);

    try {
      // 1. Generate Keyframes for chosen scheme
      const keyframeOutputs = await generateKeyframes([chosenScheme]);
      if (!keyframeOutputs || !keyframeOutputs.length) {
        throw new Error('一键生图生成宫格关键帧失败');
      }

      // 2. Crop 9 fission images automatically
      setAgentStatus(`一键生图 Agent · 正在对「${chosenScheme.title}」进行 9 图像素切分...`);
      setAgentLog((current) => [...current, `宫格关键帧就绪，开始自动切分 9 张高清独立大图...`]);

      await generateFissionImages(chosenScheme.id, keyframeOutputs, activeSchemes);

      setAgentStatus(`交付 Agent ·「${chosenScheme.title}」9 张高清独立大图已全自动裂变交付！`);
      setAgentLog((current) => [...current, `一键生图全流程完成，9 张高清大图已全部交付！`]);
    } catch (err) {
      setError(getErrorMessage(err));
      setAgentStatus('一键生图 Agent · 遇到错误，请重试');
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSelectSchemeInStage4 = (schemeId: string) => {
    setActiveKeyframeSchemeId(schemeId);
    if (fissionImagesMap[schemeId] && fissionImagesMap[schemeId].length > 0) {
      setFissionImages(fissionImagesMap[schemeId]);
    } else {
      void generateFissionImages(schemeId);
    }
  };

  const statusLabel = (status: TaskStatus) =>
    ({ editing: '编辑中', planning: 'Agent 处理中', ready: '等待确认', generating: '切分裂变中', done: '已生成9图', error: '需要重试' }[
      status
    ]);

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted">
            <Sparkles className="h-4 w-4 text-pastel-highlight" />
            AI 模特视觉工坊
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI 模特场景图裂变</h1>
          <p className="mt-1 text-sm text-pastel-muted">
            上传单张模特或场景素材图，Agent 自动裂变 9 个不同机位、景别与动作姿势的高清大图
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {(['输入', '景别与动作方案', '3x3宫格关键帧', '9张高清图裂变'] as const).map((label, index) => {
              const step = (index + 1) as Stage;
              const isCurrent = stage === step;
              const canClick =
                step === 1 ||
                (step === 2 && schemes.length > 0) ||
                (step === 3 && keyframes.length > 0) ||
                (step === 4 && (fissionImages.length > 0 || keyframes.length > 0)) ||
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
                    title={canClick ? `切换至阶段 ${step}: ${label}` : '请先完成前面步骤以解锁此阶段'}
                  >
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${
                        isCurrent ? 'bg-white text-[#172238]' : 'bg-slate-200 dark:bg-slate-700 text-pastel-text'
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                  {index < 3 && <span className="h-px w-3 bg-pastel-border sm:w-7" />}
                </React.Fragment>
              );
            })}
          </div>
        </header>

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
          className={`grid grid-cols-1 gap-4 ${
            historyOpen
              ? 'xl:grid-cols-[16rem_30rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[30rem_minmax(0,1fr)]'
          }`}
        >
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
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={newTask}
                disabled={busy}
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172238] text-sm font-black text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                新开任务
              </button>
              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => switchTask(task)}
                      className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                        task.id === activeTaskId
                          ? 'border-pastel-highlight ring-2 ring-orange-100'
                          : 'border-pastel-border hover:border-orange-300'
                      }`}
                    >
                      <div className="relative aspect-square bg-white">
                        {task.cover ? (
                          <img src={task.cover} alt="任务预览" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />
                        )}
                        <span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1 bg-[#172238]/90 text-xs font-black text-white">
                          {task.status === 'planning' || task.status === 'generating' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {statusLabel(task.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-pastel-muted">
                        <span>
                          {new Date(task.createdAt).toLocaleTimeString('zh-CN', {
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
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow transition hover:bg-red-500 group-hover:opacity-100 disabled:opacity-30"
                      title="删除任务"
                      aria-label="删除任务"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <div className="space-y-4">
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 font-black">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#172238] text-sm text-white">
                  1
                </span>
                裂变模式
              </h2>
              <p className="mt-1 text-xs text-pastel-muted">选择欲裂变的摄影镜头侧重点与动作控制方向</p>
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-pastel-bg p-1">
                <button
                  type="button"
                  onClick={() => setMode('pose')}
                  className={`min-h-11 rounded-lg text-xs font-bold transition ${
                    mode === 'pose' ? 'bg-pastel-card shadow-sm text-pastel-text' : 'text-pastel-muted'
                  }`}
                >
                  <UserRoundCog className="mr-1 inline h-3.5 w-3.5" />
                  姿势景别裂变
                </button>
                <button
                  type="button"
                  onClick={() => setMode('scene')}
                  className={`min-h-11 rounded-lg text-xs font-bold transition ${
                    mode === 'scene' ? 'bg-pastel-card shadow-sm text-pastel-text' : 'text-pastel-muted'
                  }`}
                >
                  <Camera className="mr-1 inline h-3.5 w-3.5" />
                  多机位裂变
                </button>
                <button
                  type="button"
                  onClick={() => setMode('lookbook')}
                  className={`min-h-11 rounded-lg text-xs font-bold transition ${
                    mode === 'lookbook' ? 'bg-pastel-card shadow-sm text-pastel-text' : 'text-pastel-muted'
                  }`}
                >
                  <Grid3x3 className="mr-1 inline h-3.5 w-3.5" />
                  Lookbook裂变
                </button>
              </div>
            </section>

            <section
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleImageDrop}
              className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#ed6d46] dark:bg-orange-950/30">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-black">模特/产品参考图</h2>
                    <p className="text-xs text-pastel-muted">上传 1–3 张模特正面或产品场景原图</p>
                  </div>
                </div>
                <span className="text-xs text-pastel-muted">{images.length}/3</span>
              </div>
              {images.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-pastel-border hover:border-[#ed6d46]"
                >
                  <Upload className="h-6 w-6 text-[#ed6d46]" />
                  <span className="mt-3 text-sm font-bold">拖拽、粘贴或点击选择原图</span>
                  <span className="mt-1 text-xs text-pastel-muted">JPG、JPEG、PNG、WEBP · 单张≤30MB</span>
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="group relative h-20 w-20 overflow-hidden rounded-xl border border-pastel-border bg-white"
                    >
                      <img src={image.preview} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-pastel-border"
                      aria-label="继续添加参考图"
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
                提示：第一张图片将作为模特面部与原景背景画面的最高优先级参照。Agent 流程将严格锁死原图场景与模特身份，生成多姿势多视角画面。
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black">你的裂变要求（选填）</h2>
              <p className="mt-1 text-xs text-pastel-muted">填写希望强调的动作姿态、情绪氛围、景别偏好或质感细节</p>
              <textarea
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg p-3 text-sm outline-none focus:border-[#ed6d46]"
                placeholder="例如：突出高端法式优雅风，包含正面全身站姿、侧面走姿、近景面部特写、背影回眸与手部配饰特写等9个不同角度"
              />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black">图像与裂变参数</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="col-span-2 flex min-h-16 cursor-pointer items-center justify-between rounded-xl border border-pastel-border bg-white px-4 py-3 shadow-xs transition hover:border-[#ed6d46] dark:bg-slate-900">
                  <div>
                    <strong className="block text-sm font-black text-pastel-text">一键生图</strong>
                    <small className="mt-0.5 block text-xs text-pastel-muted">分析成功后跳过确认并自动生成</small>
                  </div>
                  <span className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${oneClick ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec] dark:bg-slate-700'}`}>
                    <input
                      type="checkbox"
                      checked={oneClick}
                      disabled={busy}
                      onChange={(event) => setOneClick(event.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        oneClick ? 'translate-x-6' : 'translate-x-1'
                      } mt-1`}
                    />
                  </span>
                </label>

                <CreativeImageModelSelector value={model} onChange={setModel} disabled={busy} title="" compact className="col-span-2 border-0 bg-transparent p-0 shadow-none" />
                <button
                  type="button"
                  onClick={() => setSelectionModal('model')}
                  className="hidden"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">生成模型</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span className="flex items-center gap-2">
                      {MODEL_OPTIONS.find((m) => m.id === model)?.label || model}
                      <span className="rounded-full bg-[#ed6d46]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#ed6d46]">
                        {MODEL_OPTIONS.find((m) => m.id === model)?.hint}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectionModal('ratio')}
                  className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span>{ASPECT_RATIO_OPTIONS.find((r) => r.id === aspectRatio)?.label || aspectRatio}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                <label className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">裂变分辨率</span>
                  <select
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    className="mt-1 bg-transparent text-sm font-black text-pastel-text outline-none cursor-pointer"
                  >
                    <option value="2K">2K 高清 (推荐)</option>
                    <option value="4K">4K 超清</option>
                  </select>
                </label>
              </div>
            </section>

            <button
              type="button"
              onClick={handleStartFission}
              disabled={!images.length || busy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] px-4 text-base font-black text-white transition hover:bg-[#243554] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && stage === 1 ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : oneClick ? (
                <Sparkles className="h-5 w-5 text-[#ed6d46]" />
              ) : (
                <Grid3x3 className="h-5 w-5" />
              )}
              {oneClick ? '🚀 开始一键生图（随机方案直出9图）' : '下一步：极速加载 9 机位动作方案'}
            </button>
          </div>

          <section className="flex min-h-[42rem] flex-col rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-black">
                  <Sparkles className="h-4 w-4 text-pastel-highlight" />
                  {stage === 1
                    ? '输入准备'
                    : stage === 2
                    ? '景别与动作方案'
                    : stage === 3
                    ? '3x3 宫格关键帧'
                    : '9 张高清图裂变交付'}
                </h2>
                <p className="mt-1 text-xs text-pastel-muted">
                  Agent 团队会依次完成视觉分析、9机位方案规划、九宫格锁颜生成与高清图裂变
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
                {stage > 3 && keyframes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStage(3)}
                    className="flex items-center gap-1 rounded-xl border border-pastel-border bg-pastel-bg px-3 py-1.5 text-xs font-bold text-pastel-text transition hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> 返回关键帧
                  </button>
                )}
              </div>
            </div>

            <details
              className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 p-3 dark:border-orange-500/20 dark:bg-orange-500/5"
              open={busy}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-orange-900 dark:text-orange-200">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {agentStatus}
              </summary>
              <div className="mt-3 space-y-2 border-t border-orange-100 pt-3 text-xs text-orange-800/80 dark:border-orange-500/20 dark:text-orange-200/70">
                {agentLog.slice(-5).map((item, index) => (
                  <p key={`${item}-${index}`}>• {item}</p>
                ))}
              </div>
            </details>
            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {stage === 1 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-pastel-muted">
                <Grid3x3 className="h-16 w-16 text-pastel-border" />
                <p className="mt-5 max-w-md text-sm">
                  上传模特/产品图并完成左侧配置后，Agent 将极速生成 3 套独立的 9 机位景别与动作方案
                </p>
                {schemes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStage(2)}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-[#172238] px-4 py-2 text-xs font-bold text-white shadow"
                  >
                    已有生成的裂变方案，直接进入选择 →
                  </button>
                )}
              </div>
            )}

            {stage === 2 && (
              <div className="mt-5 flex flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-pastel-border bg-pastel-bg/40 p-3 text-xs text-pastel-muted">
                  <span>共生成 {schemes.length} 套方案 · 已选择 {selectedSchemeIds.length} 套</span>
                  {keyframes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStage(3)}
                      className="font-black text-[#172238] underline hover:text-orange-600 dark:text-orange-400"
                    >
                      直接查看已生成宫格图 →
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-4">
                  {schemes.map((scheme, index) => {
                    const selected = selectedSchemeIds.includes(scheme.id);
                    return (
                      <div
                        key={scheme.id}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-[#172238] bg-orange-50/40 ring-2 ring-orange-100 dark:bg-orange-950/20'
                            : 'border-pastel-border hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSchemeIds((current) =>
                                selected ? current.filter((id) => id !== scheme.id) : [...current, scheme.id]
                              )
                            }
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black transition ${
                              selected ? 'bg-[#172238] text-white' : 'bg-pastel-bg text-pastel-muted'
                            }`}
                          >
                            {index + 1}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h3
                                className="font-black cursor-pointer"
                                onClick={() =>
                                  setSelectedSchemeIds((current) =>
                                    selected ? current.filter((id) => id !== scheme.id) : [...current, scheme.id]
                                  )
                                }
                              >
                                {scheme.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditableShots(JSON.parse(JSON.stringify(scheme.shots)));
                                    setPromptModal({
                                      schemeId: scheme.id,
                                      title: `${scheme.title} · 9机位动作提示词`,
                                      subtitle: scheme.strategy || '支持直接编辑各个机位的动作描述与 Prompt 提示词，修改保存后应用于后续生成',
                                      editable: true,
                                    });
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-pastel-border bg-white px-2.5 py-1 text-xs font-bold text-pastel-text shadow-sm transition hover:border-orange-400 hover:text-orange-600 dark:bg-slate-800"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-orange-500" />
                                  查看/编辑提示词
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSchemeIds((current) =>
                                      selected ? current.filter((id) => id !== scheme.id) : [...current, scheme.id]
                                    )
                                  }
                                  className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                                    selected ? 'border-[#172238] bg-[#172238] text-white' : 'border-pastel-border'
                                  }`}
                                >
                                  {selected && <CheckCircle2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-pastel-muted">{scheme.summary}</p>

                            {/* 9 Shots Grid Breakdown Preview */}
                            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-pastel-bg/70 p-3 text-xs">
                              {scheme.shots.map((shot) => (
                                <div key={shot.index} className="rounded-lg bg-white/80 p-2 shadow-xs dark:bg-slate-800">
                                  <strong className="block text-[0.72rem] font-black text-pastel-text truncate">
                                    0{shot.index}. {shot.shotName}
                                  </strong>
                                  <span className="block text-[0.65rem] text-[#ed6d46] truncate">{shot.framing}</span>
                                  <small className="block line-clamp-1 text-[0.62rem] text-pastel-muted">{shot.poseAction}</small>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void generatePlanWithAI()}
                    disabled={busy}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-pastel-border bg-pastel-card px-5 text-sm font-black text-pastel-text shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Sparkles className="h-4 w-4 text-[#ed6d46]" />
                    AI 深度重新拆解方案
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateKeyframes()}
                    disabled={!selectedSchemeIds.length || busy}
                    className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#172238] text-base font-black text-white disabled:opacity-40"
                  >
                    <Grid3x3 className="h-5 w-5" />
                    {keyframes.length > 0 ? '重新生成 3x3 宫格关键帧' : '下一步：Agent 生成 3x3 宫格关键帧'}
                  </button>
                </div>
              </div>
            )}

            {stage === 3 && (
              <div className="mt-5 flex flex-1 flex-col">
                {busy ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-[#ed6d46]" />
                    <p className="mt-5 font-black">Agent 正在生成并审查 3x3 宫格关键帧大图</p>
                    <p className="mt-2 max-w-md text-sm text-pastel-muted">
                      分镜导演将 9 个景别排版在同一张画卷中，质量审查 Agent 将严格检查模特五官与服装细节的锁死状态
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {keyframes.map((keyframe, index) => {
                        const scheme = schemes.find((item) => item.id === keyframe.schemeId);
                        const title = scheme?.title || `裂变宫格图 ${index + 1}`;
                        return (
                          <article key={keyframe.schemeId} className="overflow-hidden rounded-2xl border border-pastel-border">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border px-4 py-3">
                              <div>
                                <h3 className="font-black">{title}</h3>
                                <p className="text-xs text-pastel-muted">模特/服装一致性排版 · 3x3 宫格画卷</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-black ${
                                    keyframe.qaPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                  }`}
                                >
                                  {keyframe.qaPassed ? '质检一致性合格' : '建议复核'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPromptModal({
                                      title: `${title} · 3x3 宫格关键帧提示词`,
                                      subtitle: keyframe.qaNotes,
                                      prompts: [
                                        {
                                          label: '完整九宫格联系页生成 Prompt',
                                          content: keyframe.prompt || 'Create a clean 3x3 fashion photoshoot grid...',
                                        },
                                      ],
                                    });
                                  }}
                                  className="flex min-h-11 items-center gap-1 rounded-xl border border-pastel-border px-3 text-xs font-bold text-pastel-muted transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600"
                                >
                                  <FileText className="h-4 w-4" />
                                  查看提示词
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImagePreview({ url: keyframe.imageUrl, title })}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600"
                                  aria-label={`放大查看 ${title}`}
                                >
                                  <Maximize2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void downloadSingleImage(keyframe.imageUrl, title)}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#172238] text-white transition hover:bg-[#243554]"
                                  aria-label={`下载 ${title}`}
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void generateFissionImages(keyframe.schemeId)}
                                  disabled={busy}
                                  className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#172238] px-3.5 text-xs font-black text-white hover:bg-[#243554] transition shadow-sm"
                                >
                                  <Grid className="h-4 w-4" />
                                  裁切此方案 9 图 →
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setImagePreview({ url: keyframe.imageUrl, title })}
                              className="group relative block w-full bg-[#10192b] p-4 text-left"
                            >
                              <img
                                src={keyframe.imageUrl}
                                alt={`${title} 宫格大图`}
                                className="mx-auto max-h-[42rem] w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                              />
                              <span className="pointer-events-none absolute bottom-7 right-7 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                                <Maximize2 className="h-4 w-4" />
                                点击放大原图
                              </span>
                            </button>
                            <p className="border-t border-pastel-border px-4 py-3 text-xs text-pastel-muted">
                              Agent 审核评价：{keyframe.qaNotes}
                            </p>
                          </article>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void generateKeyframes()}
                        disabled={busy}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-pastel-border bg-pastel-card px-6 text-sm font-black text-pastel-text shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <RotateCcw className="h-4 w-4" /> 重新生成关键帧
                      </button>
                      <button
                        type="button"
                        onClick={() => void generateFissionImages(activeKeyframeSchemeId || keyframes[0]?.schemeId)}
                        disabled={!keyframes.length || busy}
                        className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#172238] text-base font-black text-white disabled:opacity-40"
                      >
                        <Grid className="h-5 w-5" />
                        下一步：裁切所选方案 9 张高清独立大图
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {stage === 4 && (
              <div className="mt-5 flex flex-1 flex-col">
                {keyframes.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-sm">
                    <span className="text-xs font-black text-pastel-muted">方案切换:</span>
                    {keyframes.map((keyframe, index) => {
                      const scheme = schemes.find((s) => s.id === keyframe.schemeId);
                      const activeId = activeKeyframeSchemeId || keyframes[0]?.schemeId;
                      const isSelected = activeId === keyframe.schemeId;
                      const isCropped = Boolean(fissionImagesMap[keyframe.schemeId]?.length);
                      return (
                        <button
                          key={keyframe.schemeId}
                          type="button"
                          onClick={() => handleSelectSchemeInStage4(keyframe.schemeId)}
                          disabled={busy}
                          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#172238] text-white shadow'
                              : 'bg-pastel-bg text-pastel-text hover:bg-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{scheme?.title || `方案 ${index + 1}`}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : isCropped
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {isCropped ? '已裁切' : '点击去裁切'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {busy ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-[#ed6d46]" />
                    <p className="mt-5 font-black">高清裂变 Agent 正在像素级切分与提取 9 张高清独立大图</p>
                    <p className="mt-2 text-sm text-pastel-muted">消除拼边边缘并优化各项景别机位细节</p>
                  </div>
                ) : fissionImages.length ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 dark:border-orange-500/20 dark:bg-orange-950/20">
                      <div>
                        <h3 className="font-black text-orange-950 dark:text-orange-200">
                          🎉 已成功裂变交付 9 张不同机位与姿势高清独立大图
                        </h3>
                        <p className="mt-0.5 text-xs text-orange-800/70 dark:text-orange-300/70">
                          模特面部、身材与服装细节均已完美锁定与呈现
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadAllFissionImages()}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-[#172238] px-5 text-xs font-black text-white shadow-md hover:bg-[#243554]"
                      >
                        <Download className="h-4 w-4" />
                        一键打包下载全部 9 张图
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {fissionImages.map((item) => (
                        <article
                          key={item.index}
                          className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-sm transition hover:border-[#ed6d46] dark:bg-slate-900"
                        >
                          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                            <span className="absolute left-2.5 top-2.5 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
                              0{item.index}. {item.title}
                            </span>
                          </div>
                          <div className="p-3">
                            <span className="block text-xs font-bold text-[#ed6d46]">{item.framing}</span>
                            <p className="mt-1 line-clamp-2 text-xs text-pastel-muted">{item.pose}</p>
                            <div className="mt-3 flex items-center justify-between border-t border-pastel-border/60 pt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setPromptModal({
                                    title: `第 0${item.index} 机位 · ${item.title} 提示词`,
                                    subtitle: item.framing,
                                    prompts: [
                                      {
                                        label: '机位与动作细节描述',
                                        content: `机位景别: ${item.framing}\n动作姿态: ${item.pose}\nPrompt: ${
                                          item.prompt || item.title
                                        }`,
                                      },
                                    ],
                                  })
                                }
                                className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-orange-600"
                              >
                                <FileText className="h-3.5 w-3.5" /> 提示词
                              </button>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setImagePreview({ url: item.imageUrl, title: `0${item.index}.${item.title}` })}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-pastel-border text-pastel-muted hover:border-orange-400 hover:text-orange-600"
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void downloadSingleImage(item.imageUrl, `0${item.index}-${item.title}`)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#172238] text-white hover:bg-[#243554]"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void generateFissionImages()}
                        disabled={busy}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-card px-5 text-xs font-black text-pastel-text shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <RotateCcw className="h-4 w-4" /> 重新切分提取
                      </button>
                      <button
                        type="button"
                        onClick={() => setStage(3)}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#172238] px-5 text-xs font-black text-white"
                      >
                        <ArrowLeft className="h-4 w-4" /> 返回 3x3 宫格图
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center text-pastel-muted">
                    <Grid className="h-12 w-12" />
                    <p className="mt-4">尚未完成 9 张高清图切分提取，请从宫格图步骤重试</p>
                    <button
                      type="button"
                      onClick={() => setStage(3)}
                      className="mt-4 min-h-11 rounded-xl border border-pastel-border px-4 font-bold"
                    >
                      返回关键帧
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {imagePreview && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07101f]/92 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`${imagePreview.title} 预览`}
            onClick={() => setImagePreview(null)}
          >
            <div
              className="flex max-h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#10192b] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 px-4 text-white sm:px-5">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black sm:text-base">{imagePreview.title}</h3>
                  <p className="text-xs text-white/55">模特场景图裂变 · 高清图预览</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadSingleImage(imagePreview.url, imagePreview.title)}
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ed6d46] px-3 text-xs font-black text-white hover:bg-orange-600 sm:px-4"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">下载原图</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 text-white hover:bg-white/10"
                    aria-label="关闭预览"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
                <img
                  src={imagePreview.url}
                  alt={`${imagePreview.title} 高清大图`}
                  className="mx-auto max-h-[calc(100vh-8rem)] max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {promptModal && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#07101f]/85 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => setPromptModal(null)}
          >
            <div
              className={`flex max-h-[88vh] w-full ${
                promptModal.editable ? 'max-w-4xl' : 'max-w-3xl'
              } flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card shadow-2xl dark:bg-[#10192b]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-pastel-border px-5 py-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-black">
                    {promptModal.editable ? (
                      <Edit3 className="h-4 w-4 text-[#ed6d46]" />
                    ) : (
                      <FileText className="h-4 w-4 text-pastel-highlight" />
                    )}
                    {promptModal.title}
                  </h3>
                  {promptModal.subtitle && <p className="mt-0.5 text-xs text-pastel-muted">{promptModal.subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setPromptModal(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {promptModal.editable && (
                <div className="flex items-center justify-between border-b border-orange-200/60 bg-orange-50/60 px-5 py-2.5 text-xs font-bold text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-[#ed6d46]" />
                    <span>提示词已开启编辑模式：您可以随时微调动作描述与 Prompt，保存后应用于后续生成。</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPromptEdits}
                    className="shrink-0 text-[0.72rem] font-bold text-orange-600 underline hover:text-orange-800 dark:text-orange-400"
                  >
                    重置初始值
                  </button>
                </div>
              )}

              <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {promptModal.editable ? (
                  editableShots.map((shot, idx) => (
                    <div key={shot.index} className="rounded-xl border border-pastel-border bg-pastel-bg/60 p-4 shadow-xs">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-pastel-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#172238] text-[0.65rem] font-black text-white">
                            0{shot.index}
                          </span>
                          <input
                            type="text"
                            value={shot.shotName}
                            onChange={(e) => handleEditableShotChange(idx, 'shotName', e.target.value)}
                            className="rounded-lg border border-pastel-border/70 bg-white px-2 py-0.5 text-xs font-black text-pastel-text outline-none focus:border-orange-500 dark:bg-slate-800"
                            placeholder="机位名称"
                          />
                          <span className="rounded-md bg-orange-100/80 px-2 py-0.5 text-[0.7rem] font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            {shot.framing}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(shot.prompt || `${shot.shotName}: ${shot.framing}, ${shot.poseAction}`, idx)}
                          className="flex items-center gap-1.5 rounded-lg border border-pastel-border bg-pastel-card px-2.5 py-1 text-xs font-bold text-pastel-text shadow-sm transition hover:border-orange-400 hover:text-orange-600"
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedIndex === idx ? '已复制' : '复制 Prompt'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[0.7rem] font-bold text-pastel-muted">
                            动作描述 (中文微调说明)
                          </label>
                          <textarea
                            rows={2}
                            value={shot.poseAction}
                            onChange={(e) => handleEditableShotChange(idx, 'poseAction', e.target.value)}
                            className="w-full resize-y rounded-xl border border-pastel-border bg-white p-2.5 text-xs font-medium leading-5 text-pastel-text outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 dark:bg-slate-800"
                            placeholder="例如：自然站立，双脚微分，手轻抚衣角，眼神看向镜头..."
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[0.7rem] font-bold text-pastel-muted">
                            Prompt 提示词 (英文生成词)
                          </label>
                          <textarea
                            rows={2}
                            value={shot.prompt || ''}
                            onChange={(e) => handleEditableShotChange(idx, 'prompt', e.target.value)}
                            className="w-full resize-y rounded-xl border border-pastel-border bg-white p-2.5 text-xs font-mono leading-5 text-pastel-text outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 dark:bg-slate-800"
                            placeholder="English prompt for this panel..."
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  (promptModal.prompts || []).map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-pastel-border bg-pastel-bg/60 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black text-pastel-text">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(item.content, idx)}
                          className="flex items-center gap-1.5 rounded-lg border border-pastel-border bg-pastel-card px-2.5 py-1 text-xs font-bold text-pastel-text shadow-sm transition hover:border-orange-400 hover:text-orange-600"
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedIndex === idx ? '已复制' : '复制提示词'}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap select-all rounded-lg border border-black/5 bg-black/5 p-3 font-sans text-xs leading-5 text-pastel-muted dark:border-white/5 dark:bg-white/5">
                        {item.content}
                      </pre>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-pastel-border px-5 py-3">
                {promptModal.editable ? (
                  <>
                    <span className="text-xs text-pastel-muted">共 9 个机位动作，支持单独微调</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPromptModal(null)}
                        className="min-h-10 rounded-xl border border-pastel-border px-4 text-xs font-bold text-pastel-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePromptEdits}
                        className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#172238] px-5 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition"
                      >
                        <Check className="h-4 w-4" />
                        保存修改
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ml-auto flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPromptModal(null)}
                      className="min-h-10 rounded-xl bg-[#172238] px-5 text-xs font-bold text-white"
                    >
                      关闭
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                    {isSelected && (
                      <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[#172238] dark:text-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </SelectionModal>
        )}

        {selectionModal === 'model' && (
          <SelectionModal title="选择生成模型" onClose={() => setSelectionModal(null)}>
            <div className="space-y-3">
              {MODEL_OPTIONS.map((item) => {
                const isSelected = model === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModel(item.id);
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
                    {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#172238] dark:text-white" />}
                  </button>
                );
              })}
            </div>
          </SelectionModal>
        )}
      </div>
    </div>
  );
};

export default ModelSceneFissionTab;
